// The agent loop: stream a model reply, run any tool calls (asking permission when needed), repeat.
import crypto from 'node:crypto';
import { chatStream, modelCapabilities } from './ollama.js';
import { TOOL_DEFS, TOOL_NAMES, READ_ONLY_TOOLS, EDIT_TOOLS, runTool } from './tools.js';
import { buildSystemPrompt } from './prompt.js';
import { extractTextToolCalls } from './parse.js';

const DISPLAY_LIMIT = 8000;

function clip(s, n = DISPLAY_LIMIT) {
  return s.length > n ? s.slice(0, n) + `\n… (${s.length - n} more characters)` : s;
}

function normalizeArgs(a) {
  if (typeof a === 'string') {
    try {
      return JSON.parse(a);
    } catch {
      return { _raw: a };
    }
  }
  return a && typeof a === 'object' ? a : {};
}

export function needsApproval(session, name) {
  if (READ_ONLY_TOOLS.has(name)) return false;
  if (session.permissionMode === 'bypass') return false;
  if (EDIT_TOOLS.has(name) && session.permissionMode === 'acceptEdits') return false;
  if (session.alwaysAllow?.includes(name)) return false;
  return true;
}

// Keep the conversation inside the context window: shrink old tool output first, then drop the oldest turns.
function fitContext(messages, numCtx, systemLen) {
  const budget = Math.max(4000, numCtx * 3.2 - systemLen - 6000);
  const size = (ms) => ms.reduce((n, m) => n + (m.content?.length || 0) + JSON.stringify(m.tool_calls || '').length, 0);
  let out = messages.map((m) => ({ ...m }));
  if (size(out) <= budget) return out;
  const keep = 8;
  for (let i = 0; i < out.length - keep && size(out) > budget; i++) {
    const m = out[i];
    if ((m.role === 'tool' || m.fromTool) && m.content.length > 400) {
      out[i] = { ...m, content: m.content.slice(0, 300) + '\n…[older tool output removed to save context]' };
    }
  }
  while (size(out) > budget && out.length > keep) {
    out.shift();
    while (out.length && out[0].role !== 'user') out.shift();
  }
  return out;
}

// Drop consecutive repeats of the same assistant action (and their results) so a model that got
// stuck in a loop doesn't keep seeing, and copying, a wall of identical calls.
export function dedupeHistory(messages) {
  const out = [];
  let lastSig = null;
  let skipping = false;
  for (const m of messages) {
    const isResult = m.role === 'tool' || m.fromTool;
    if (m.role === 'assistant') {
      const sig = m.tool_calls?.length ? JSON.stringify(m.tool_calls.map((c) => c.function)) : (m.content || '').trim();
      if (sig && sig === lastSig) {
        skipping = true;
        continue;
      }
      lastSig = sig;
      skipping = false;
    } else if (isResult) {
      if (skipping) continue;
    } else {
      lastSig = null;
      skipping = false;
    }
    out.push(m);
  }
  return out;
}

export class Agent {
  constructor(store, config) {
    this.store = store;
    this.config = config;
    this.runs = new Map();
  }

  isRunning(id) {
    return this.runs.has(id);
  }

  pendingIds(id) {
    return [...(this.runs.get(id)?.pending.keys() || [])];
  }

  send(session, text) {
    if (this.runs.has(session.id)) throw new Error('This session is already working. Stop it first.');
    const run = { ctrl: new AbortController(), pending: new Map() };
    this.runs.set(session.id, run);
    if (session.title === 'New session') session.title = text.replace(/\s+/g, ' ').slice(0, 60);
    session.messages.push({ role: 'user', content: text });
    const emit = (ev, persist) => this.store.emit(session, ev, persist);
    emit({ type: 'user', text });
    emit({ type: 'status', running: true }, false);

    this.loop(session, run, emit)
      .catch((e) => {
        if (run.ctrl.signal.aborted) emit({ type: 'notice', text: 'Stopped by user.' });
        else emit({ type: 'error', text: e.cause?.code === 'ECONNREFUSED' ? `Can't reach Ollama at ${this.config.ollamaUrl}. Is it running?` : e.message });
      })
      .finally(() => {
        for (const p of run.pending.values()) p('deny');
        this.runs.delete(session.id);
        emit({ type: 'status', running: false }, false);
        this.store.save(session);
      });
  }

  stop(id) {
    const run = this.runs.get(id);
    if (!run) return false;
    run.ctrl.abort();
    for (const p of run.pending.values()) p('deny');
    return true;
  }

  resolvePermission(id, callId, decision) {
    const p = this.runs.get(id)?.pending.get(callId);
    if (!p) return false;
    p(decision);
    return true;
  }

  async loop(session, run, emit) {
    const { signal } = run.ctrl;
    const info = await modelCapabilities(this.config.ollamaUrl, session.model).catch(() => null);
    let textMode = info?.capabilities ? !info.capabilities.includes('tools') : false;
    if (textMode) emit({ type: 'notice', text: `${session.model} has no native tool calling, so tools are described in the prompt instead. Results may be less reliable.` }, false);
    const numCtx = Math.min(session.numCtx || this.config.defaultNumCtx, info?.contextLength || Infinity);
    const seen = new Map();
    let blockedInARow = 0;
    let warnedSlow = false;

    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      if (signal.aborted) throw new Error('aborted');
      const system = buildSystemPrompt(session, textMode);
      const history = fitContext(dedupeHistory(session.messages), numCtx, system.length).map(({ fromTool, ...m }) => m);
      const body = {
        model: session.model,
        messages: [{ role: 'system', content: system }, ...history],
        stream: true,
        options: { num_ctx: numCtx, temperature: this.config.temperature },
      };
      if (!textMode) body.tools = TOOL_DEFS;

      const streamId = crypto.randomUUID();
      let content = '';
      let thinking = '';
      const nativeCalls = [];
      let stats = null;
      try {
        for await (const chunk of chatStream(this.config.ollamaUrl, body, signal)) {
          const m = chunk.message || {};
          if (m.thinking) {
            thinking += m.thinking;
            emit({ type: 'delta', streamId, thinking: m.thinking }, false);
          }
          if (m.content) {
            content += m.content;
            emit({ type: 'delta', streamId, text: m.content }, false);
          }
          if (m.tool_calls?.length) nativeCalls.push(...m.tool_calls);
          if (chunk.done) stats = chunk;
        }
      } catch (e) {
        if (!textMode && /does not support tools/i.test(e.message)) {
          textMode = true;
          emit({ type: 'notice', text: `${session.model} does not support native tool calling; switching to the text tool protocol.` }, false);
          iter--;
          continue;
        }
        throw e;
      }

      let calls = nativeCalls.map((c) => ({ name: c.function?.name, args: normalizeArgs(c.function?.arguments), native: true }));
      let display = content;
      if (!calls.length) {
        const parsed = extractTextToolCalls(content, TOOL_NAMES);
        if (parsed.calls.length) {
          calls = parsed.calls.map((c) => ({ ...c, native: false }));
          display = parsed.text;
        }
      }

      session.messages.push({ role: 'assistant', content, ...(nativeCalls.length ? { tool_calls: nativeCalls } : {}) });
      emit({ type: 'stream_end', streamId }, false);
      if (display.trim() || thinking.trim()) emit({ type: 'assistant', text: display.trim(), thinking: thinking.trim() || undefined });
      if (stats) {
        const tps = stats.eval_duration ? (stats.eval_count / (stats.eval_duration / 1e9)) : 0;
        emit({ type: 'usage', contextTokens: (stats.prompt_eval_count || 0) + (stats.eval_count || 0), numCtx, tokensPerSec: Math.round(tps * 10) / 10 }, false);
        if (!warnedSlow && tps > 0 && tps < 5 && (stats.eval_count || 0) > 20) {
          warnedSlow = true;
          emit({ type: 'notice', text: `Generation is slow (${tps.toFixed(1)} tokens/sec). The model plus its ${Math.round(numCtx / 1024)}k context probably doesn't fit in GPU memory, so it's running partly on the CPU. Pick a smaller context (16k) in the header, or a smaller model.` });
        }
      }

      if (!calls.length) return;

      for (const call of calls) {
        if (signal.aborted) throw new Error('aborted');
        const id = crypto.randomUUID();
        emit({ type: 'tool_call', id, name: call.name, args: call.args });

        // Loop guard: refuse the same call (same tool + same arguments) a third time in one turn.
        const sig = call.name + JSON.stringify(call.args);
        const count = (seen.get(sig) || 0) + 1;
        seen.set(sig, count);
        if (count >= 3) {
          blockedInARow++;
          const msg = `Blocked: you already made this exact ${call.name} call ${count - 1} times this turn and got the same result. Repeating it will not help. Do something different, re-read the user's latest message, or give your final answer.`;
          emit({ type: 'tool_result', id, output: msg, error: true });
          if (call.native && !textMode) session.messages.push({ role: 'tool', content: msg, tool_name: call.name });
          else session.messages.push({ role: 'user', content: `[result of ${call.name}]\n${msg}`, fromTool: true });
          if (blockedInARow >= 3) {
            emit({ type: 'notice', text: 'Stopped: the model kept repeating the same action. Rephrase the request, start a new session, or try a larger model.' });
            return;
          }
          continue;
        }
        blockedInARow = 0;

        let decision = 'allow';
        if (needsApproval(session, call.name)) {
          emit({ type: 'permission', id, name: call.name });
          decision = await new Promise((resolve) => run.pending.set(id, resolve));
          run.pending.delete(id);
          emit({ type: 'permission_resolved', id, decision });
          if (decision === 'always' && !session.alwaysAllow.includes(call.name)) session.alwaysAllow.push(call.name);
        }
        if (signal.aborted) throw new Error('aborted');

        const result = decision === 'deny'
          ? { output: 'The user denied this tool call. Do not retry it; ask the user how they want to proceed.', error: true }
          : await runTool(call.name, call.args, { cwd: session.cwd, signal, session, emit });

        emit({ type: 'tool_result', id, output: clip(result.output), error: !!result.error });
        if (call.native && !textMode) session.messages.push({ role: 'tool', content: result.output, tool_name: call.name });
        else session.messages.push({ role: 'user', content: `[result of ${call.name}]\n${result.output}`, fromTool: true });
        if (decision === 'deny') {
          emit({ type: 'notice', text: 'Tool call denied. Tell the model what to do instead.' });
          return;
        }
      }
    }
    emit({ type: 'notice', text: `Stopped after ${this.config.maxIterations} steps. Send a message to continue.` });
  }
}
