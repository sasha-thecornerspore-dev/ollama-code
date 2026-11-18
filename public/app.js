import { md, esc } from './md.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

const state = {
  config: null,
  sessions: [],
  session: null,
  es: null,
  running: false,
  live: null, // { streamId, node, text, thinking }
  cards: new Map(), // tool call id -> card element
  pending: new Set(),
  browsePath: null,
};

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ---------- boot ----------

let markConfigReady;
const loadConfigReady = new Promise((r) => (markConfigReady = r));

async function boot() {
  await loadConfig();
  markConfigReady();
  await refreshSessions();
  const id = location.hash.match(/^#\/s\/(.+)/)?.[1];
  if (id && state.sessions.some((s) => s.id === id)) openSession(id);
  else showEmpty();
  setInterval(refreshOllamaStatus, 15000);
}

async function loadConfig() {
  state.config = await api('GET', '/api/config');
  renderOllamaStatus();
}

async function refreshOllamaStatus() {
  try {
    state.config = await api('GET', '/api/config');
  } catch { /* server down */ }
  renderOllamaStatus();
}

function renderOllamaStatus() {
  const c = state.config;
  const box = $('#ollama-status');
  if (c.ollamaError) {
    box.innerHTML = `<span class="bad">Ollama unreachable</span>`;
    box.title = c.ollamaError;
    $('#empty-error').textContent = c.ollamaError;
    $('#empty-error').classList.remove('hidden');
  } else {
    box.innerHTML = `<span class="ok">Ollama · ${c.models.length} model${c.models.length === 1 ? '' : 's'}</span>`;
    box.title = c.ollamaUrl;
    $('#empty-error').classList.add('hidden');
  }
  fillModelSelect($('#model-select'), state.session?.model);
}

function fillModelSelect(sel, current) {
  const models = state.config?.models || [];
  const names = models.map((m) => m.name);
  if (current && !names.includes(current)) names.unshift(current);
  sel.innerHTML = names.map((n) => {
    const m = models.find((x) => x.name === n);
    const extra = m?.params ? ` · ${m.params}` : '';
    return `<option value="${esc(n)}">${esc(n)}${esc(extra)}</option>`;
  }).join('');
  if (current) sel.value = current;
}

async function refreshSessions() {
  state.sessions = await api('GET', '/api/sessions');
  renderSessionList();
}

function renderSessionList() {
  const list = $('#session-list');
  list.innerHTML = '';
  for (const s of state.sessions) {
    const item = el('div', 'session-item' + (s.id === state.session?.id ? ' active' : ''));
    const base = s.cwd.split(/[\\/]/).filter(Boolean).pop() || s.cwd;
    item.innerHTML = `${s.id === state.session?.id && state.running ? '<span class="dot"></span>' : ''}
      <div class="meta"><div class="t">${esc(s.title)}</div><div class="s">${esc(base)} · ${esc(s.model)}</div></div>
      <button class="del" title="Delete session">✕</button>`;
    item.onclick = () => openSession(s.id);
    item.querySelector('.del').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${s.title}"? This removes its history.`)) return;
      await api('DELETE', `/api/sessions/${s.id}`);
      if (state.session?.id === s.id) showEmpty();
      refreshSessions();
    };
    list.append(item);
  }
}

function showEmpty() {
  closeStream();
  state.session = null;
  history.replaceState(null, '', '#');
  $('#chat').classList.add('hidden');
  $('#empty').classList.remove('hidden');
  renderSessionList();
}

// ---------- session view ----------

async function openSession(id) {
  closeStream();
  const s = await api('GET', `/api/sessions/${id}`);
  state.session = s;
  state.cards.clear();
  state.live = null;
  state.pending = new Set(s.pending);
  state.running = s.running;
  history.replaceState(null, '', `#/s/${id}`);
  $('#empty').classList.add('hidden');
  $('#chat').classList.remove('hidden');
  $('#chat-title').textContent = s.title;
  $('#chat-cwd').textContent = s.cwd;
  $('#chat-cwd').title = s.cwd;
  fillModelSelect($('#model-select'), s.model);
  $('#mode-select').value = s.permissionMode;
  setCtxSelect(s.numCtx);
  $('#usage').textContent = '';
  const t = $('#transcript');
  t.innerHTML = '';
  for (const ev of s.events) renderEvent(ev, true);
  renderTodos(s.todos);
  setRunning(s.running);
  renderSessionList();
  scrollDown(true);
  openStream(id, s.seq);
  $('#input').focus();
}

function setCtxSelect(n) {
  const sel = $('#ctx-select');
  if (![...sel.options].some((o) => Number(o.value) === n)) sel.add(new Option(`${Math.round(n / 1024)}k ctx`, n));
  sel.value = String(n);
}

function openStream(id, after) {
  const es = new EventSource(`/api/sessions/${id}/stream?after=${after}`);
  state.es = es;
  es.onmessage = (m) => {
    if (state.session?.id !== id) return;
    const ev = JSON.parse(m.data);
    renderEvent(ev, false);
  };
}

function closeStream() {
  state.es?.close();
  state.es = null;
}

function nearBottom() {
  const t = $('#transcript');
  return t.scrollHeight - t.scrollTop - t.clientHeight < 120;
}
function scrollDown(force) {
  const t = $('#transcript');
  if (force || nearBottom()) requestAnimationFrame(() => (t.scrollTop = t.scrollHeight));
}

function setRunning(running) {
  state.running = running;
  $('#send-btn').classList.toggle('hidden', running);
  $('#stop-btn').classList.toggle('hidden', !running);
  $('#clear-btn').disabled = running;
  let w = $('#working');
  if (running && !w) {
    w = el('div', 'working', '<span class="spin"></span>Working…');
    w.id = 'working';
    $('#transcript').append(w);
    scrollDown();
  } else if (!running && w) w.remove();
  if (!running) {
    for (const [id, card] of state.cards) if (card.classList.contains('running')) markCardDecided(id, null);
    state.pending.clear();
  }
  renderSessionList();
}

function append(node) {
  const t = $('#transcript');
  const stick = nearBottom();
  const w = $('#working');
  if (w) t.insertBefore(node, w);
  else t.append(node);
  if (stick) scrollDown(true);
  return node;
}

function renderEvent(ev, replay) {
  switch (ev.type) {
    case 'user': {
      const n = el('div', 'msg-user');
      n.append(el('div', 'bubble', esc(ev.text)));
      append(n);
      if (!replay) scrollDown(true);
      if (state.session && state.session.title === 'New session') {
        state.session.title = ev.text.slice(0, 60);
        $('#chat-title').textContent = state.session.title;
        refreshSessions();
      }
      break;
    }
    case 'delta': {
      if (!state.live || state.live.streamId !== ev.streamId) {
        const node = append(el('div', 'msg-assistant'));
        state.live = { streamId: ev.streamId, node, text: '', thinking: '' };
      }
      if (ev.text) state.live.text += ev.text;
      if (ev.thinking) state.live.thinking += ev.thinking;
      scheduleLiveRender();
      break;
    }
    case 'stream_end':
      if (state.live?.streamId === ev.streamId) {
        state.live.node.remove();
        state.live = null;
      }
      break;
    case 'assistant': {
      const n = el('div', 'msg-assistant');
      if (ev.thinking) n.append(thinkingNode(ev.thinking, false));
      if (ev.text) n.append(el('div', 'md', md(ev.text)));
      append(n);
      break;
    }
    case 'tool_call':
      append(toolCard(ev));
      break;
    case 'permission':
      if (state.running || !replay) {
        state.pending.add(ev.id);
        showPermission(ev.id, ev.name);
      }
      break;
    case 'permission_resolved':
      state.pending.delete(ev.id);
      markCardDecided(ev.id, ev.decision);
      break;
    case 'tool_result': {
      const card = state.cards.get(ev.id);
      if (card) finishCard(card, ev);
      break;
    }
    case 'todos':
      renderTodos(ev.todos);
      break;
    case 'usage': {
      const k = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n);
      $('#usage').textContent = `context ${k(ev.contextTokens)} / ${k(ev.numCtx)}${ev.tokensPerSec ? ` · ${ev.tokensPerSec} tok/s` : ''}`;
      break;
    }
    case 'notice':
      append(el('div', 'notice', esc(ev.text)));
      break;
    case 'error':
      append(el('div', 'notice error', '⚠ ' + esc(ev.text)));
      break;
    case 'cleared':
      append(el('div', 'notice', '— context cleared —'));
      renderTodos([]);
      break;
    case 'status':
      if (!replay) setRunning(ev.running);
      break;
  }
}

let liveQueued = false;
function scheduleLiveRender() {
  if (liveQueued) return;
  liveQueued = true;
  requestAnimationFrame(() => {
    liveQueued = false;
    const L = state.live;
    if (!L) return;
    const stick = nearBottom();
    L.node.innerHTML = '';
    if (L.thinking) L.node.append(thinkingNode(L.thinking, !L.text));
    // Hide raw tool-call JSON that text-protocol models stream before it is parsed.
    const shown = L.text.replace(/```(?:tool|tool_call)[\s\S]*$/, '').replace(/<tool_call>[\s\S]*$/, '');
    if (shown.trim()) {
      const body = el('div', 'md cursor', md(shown));
      L.node.append(body);
    }
    if (stick) scrollDown(true);
  });
}

function thinkingNode(text, open) {
  const d = el('details', 'thinking');
  d.open = open;
  d.innerHTML = `<summary>Thinking</summary><div>${esc(text)}</div>`;
  return d;
}

// ---------- tool cards ----------

const LABELS = {
  read_file: ['Read', (a) => a.path],
  write_file: ['Write', (a) => a.path],
  edit_file: ['Edit', (a) => a.path],
  list_dir: ['List', (a) => a.path || '.'],
  glob: ['Glob', (a) => a.pattern + (a.path ? `  in ${a.path}` : '')],
  grep: ['Grep', (a) => a.pattern + (a.include ? `  (${a.include})` : '') + (a.path ? `  in ${a.path}` : '')],
  bash: ['Bash', (a) => a.command],
  todo_write: ['Update tasks', () => ''],
};

function diffHtml(oldS, newS) {
  const lines = (s, cls) => String(s ?? '').split('\n').map((l) => `<div class="${cls}">${esc(l) || ' '}</div>`).join('');
  return `<div class="diff">${lines(oldS, 'del')}${lines(newS, 'add')}</div>`;
}

function toolCard(ev) {
  const [label, argFn] = LABELS[ev.name] || [ev.name, (a) => JSON.stringify(a)];
  const args = ev.args || {};
  const wrap = el('div', 'tool');
  const card = el('div', 'tool-card running');
  card.dataset.name = ev.name;
  let argText = '';
  try { argText = argFn(args) ?? ''; } catch { argText = ''; }
  card.innerHTML = `<div class="tool-head"><span class="ic"></span><span class="tool-name">${esc(label)}</span><span class="tool-arg" title="${esc(argText)}">${esc(argText)}</span><span class="tool-sum"></span></div><div class="tool-body"></div>`;
  const body = card.querySelector('.tool-body');
  if (ev.name === 'edit_file') body.innerHTML = diffHtml(args.old_string, args.new_string);
  else if (ev.name === 'write_file') body.innerHTML = `<div class="lbl">content</div><pre>${esc(String(args.content ?? '').slice(0, 20000))}</pre>`;
  else if (ev.name === 'bash') body.innerHTML = `<div class="lbl">command</div><pre>${esc(args.command)}</pre>`;
  else if (ev.name !== 'todo_write') body.innerHTML = `<div class="lbl">input</div><pre>${esc(JSON.stringify(args, null, 2))}</pre>`;
  if (ev.name === 'edit_file' || ev.name === 'write_file') card.classList.add('open');
  card.querySelector('.tool-head').onclick = () => card.classList.toggle('open');
  wrap.append(card);
  state.cards.set(ev.id, card);
  if (ev.name === 'todo_write') wrap.classList.add('hidden');
  return wrap;
}

function finishCard(card, ev) {
  card.classList.remove('running', 'waiting');
  card.classList.add(ev.error ? 'err' : 'ok');
  const out = ev.output || '';
  const name = card.dataset.name;
  let sum = '';
  const n = out.split('\n').length;
  if (name === 'read_file') sum = ev.error ? 'failed' : `${n} lines`;
  else if (name === 'grep' || name === 'glob') sum = /^No (matches|files)/.test(out) ? 'no results' : `${n} result${n === 1 ? '' : 's'}`;
  else if (name === 'bash') sum = out.match(/^\[(exit code \d+|[^\]]+)\]/)?.[1] || '';
  else if (ev.error) sum = 'failed';
  card.querySelector('.tool-sum').textContent = sum;
  const body = card.querySelector('.tool-body');
  const res = el('div');
  res.innerHTML = `<div class="lbl">${ev.error ? 'error' : 'output'}</div><pre>${esc(out)}</pre>`;
  body.append(res);
  if (ev.error && name !== 'bash') card.classList.add('open');
}

function showPermission(id, name) {
  const card = state.cards.get(id);
  if (!card || card.querySelector('.perm')) return;
  card.classList.add('waiting', 'open');
  const what = { bash: 'Run this command?', edit_file: 'Make this edit?', write_file: 'Write this file?' }[name] || `Allow ${name}?`;
  const always = { bash: 'Always allow commands', edit_file: 'Always allow edits', write_file: 'Always allow writes' }[name] || 'Always allow';
  const p = el('div', 'perm');
  p.innerHTML = `<span class="q">${esc(what)}</span>
    <button class="primary" data-d="allow">Allow <kbd>⏎</kbd></button>
    <button data-d="always">${esc(always)} (session)</button>
    <button class="ghost" data-d="deny">Deny</button>`;
  p.querySelectorAll('button').forEach((b) => (b.onclick = () => decide(id, b.dataset.d)));
  card.append(p);
  scrollDown(true);
}

async function decide(id, decision) {
  const card = state.cards.get(id);
  card?.querySelectorAll('.perm button').forEach((b) => (b.disabled = true));
  try {
    await api('POST', `/api/sessions/${state.session.id}/permission`, { id, decision });
  } catch (e) {
    markCardDecided(id, null);
  }
}

function markCardDecided(id, decision) {
  const card = state.cards.get(id);
  if (!card) return;
  card.classList.remove('waiting');
  card.querySelector('.perm')?.remove();
  if (decision === 'deny') {
    card.classList.remove('running');
    card.classList.add('err');
    card.querySelector('.tool-sum').textContent = 'denied';
  } else if (decision === null && card.classList.contains('running')) {
    card.classList.remove('running');
    card.querySelector('.tool-sum').textContent = 'not run';
  }
  if (decision === 'allow' || decision === 'always') {
    if (card.dataset.name !== 'edit_file' && card.dataset.name !== 'write_file') card.classList.remove('open');
  }
}

function renderTodos(todos) {
  const box = $('#todos');
  if (!todos?.length) {
    box.classList.add('hidden');
    return;
  }
  const icon = { pending: '○', in_progress: '◐', completed: '✓' };
  box.innerHTML = todos.map((t) => `<div class="todo ${t.status}"><span class="box">${icon[t.status] || '○'}</span><span>${esc(t.content)}</span></div>`).join('');
  box.classList.remove('hidden');
  if (todos.every((t) => t.status === 'completed') && !state.running) setTimeout(() => box.classList.add('hidden'), 4000);
}

// ---------- composer ----------

const input = $('#input');
function autosize() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 240) + 'px';
}
input.addEventListener('input', autosize);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.running && !$('#new-dialog').open && !$('#setup-dialog').open) stop();
  // Enter approves the newest pending permission when the composer is empty.
  if (e.key === 'Enter' && state.pending.size && document.activeElement === input && !input.value.trim()) {
    e.preventDefault();
    e.stopImmediatePropagation();
    decide([...state.pending].pop(), 'allow');
  }
}, true);

async function send() {
  const text = input.value.trim();
  if (!text || !state.session) return;
  if (state.running) return;
  if (text === '/clear') {
    input.value = '';
    return clearContext();
  }
  input.value = '';
  autosize();
  try {
    await api('POST', `/api/sessions/${state.session.id}/messages`, { text });
  } catch (e) {
    input.value = text;
    append(el('div', 'notice error', '⚠ ' + esc(e.message)));
  }
}

async function stop() {
  if (state.session) await api('POST', `/api/sessions/${state.session.id}/stop`).catch(() => {});
}

async function clearContext() {
  if (!state.session || state.running) return;
  await api('POST', `/api/sessions/${state.session.id}/clear`);
}

$('#send-btn').onclick = send;
$('#stop-btn').onclick = stop;
$('#clear-btn').onclick = clearContext;

async function patch(body) {
  if (!state.session) return;
  const s = await api('PATCH', `/api/sessions/${state.session.id}`, body);
  Object.assign(state.session, { model: s.model, permissionMode: s.permissionMode, numCtx: s.numCtx });
  refreshSessions();
}
$('#model-select').onchange = (e) => patch({ model: e.target.value });
$('#mode-select').onchange = (e) => patch({ permissionMode: e.target.value });
$('#ctx-select').onchange = (e) => patch({ numCtx: Number(e.target.value) });

// ---------- new session dialog ----------

const dlg = $('#new-dialog');

function openNewDialog() {
  const c = state.config;
  fillModelSelect($('#new-model'), localStorage.getItem('oc.model') || c.defaultModel || pickDefaultModel());
  $('#new-mode').value = localStorage.getItem('oc.mode') || 'ask';
  $('#cwd-input').value = state.session?.cwd || c.recentFolders[0] || '';
  $('#recent-folders').innerHTML = '';
  for (const f of c.recentFolders) {
    const b = el('button', 'chip', esc(f.split(/[\\/]/).filter(Boolean).pop() || f));
    b.type = 'button';
    b.title = f;
    b.onclick = () => ($('#cwd-input').value = f);
    $('#recent-folders').append(b);
  }
  $('#browser').classList.add('hidden');
  $('#new-error').classList.add('hidden');
  updateModelNote();
  dlg.showModal();
  $('#cwd-input').focus();
}

function pickDefaultModel() {
  const names = (state.config.models || []).map((m) => m.name);
  return names.find((n) => /coder|code|qwen|devstral|llama3\.[1-9]|mistral|gpt-oss/i.test(n)) || names[0];
}

async function updateModelNote() {
  const model = $('#new-model').value;
  const note = $('#model-note');
  note.textContent = '';
  if (!model) {
    note.textContent = 'No models installed. Run "ollama pull qwen2.5-coder:7b" first.';
    return;
  }
  const info = await api('GET', `/api/model-info?model=${encodeURIComponent(model)}`).catch(() => null);
  if (!info || $('#new-model').value !== model) return;
  if (info.capabilities && !info.capabilities.includes('tools')) note.textContent = 'This model has no native tool calling. It will use a text-based tool protocol, which is less reliable.';
  else if (info.capabilities) note.textContent = `Native tool calling supported${info.contextLength ? ` · trained context ${Math.round(info.contextLength / 1024)}k` : ''}.`;
}
$('#new-model').onchange = updateModelNote;

async function browse(p) {
  try {
    const r = await api('GET', `/api/fs?path=${encodeURIComponent(p || '')}`);
    state.browsePath = r.path;
    $('#browser-path').textContent = r.path || 'This PC';
    const list = $('#browser-list');
    list.innerHTML = '';
    if (r.parent) {
      const up = el('div', '', '↑ ..');
      up.onclick = () => browse(r.parent);
      list.append(up);
    }
    for (const d of r.dirs) {
      const item = el('div', '', '📁 ' + esc(d));
      item.onclick = () => browse(r.path ? `${r.path.replace(/[\\/]$/, '')}${state.config.platform === 'win32' ? '\\' : '/'}${d}` : d);
      list.append(item);
    }
    $('#browser-pick').disabled = !r.path;
  } catch (e) {
    $('#browser-path').textContent = e.message;
  }
}

$('#browse-btn').onclick = () => {
  $('#browser').classList.remove('hidden');
  browse($('#cwd-input').value.trim() || state.config.home);
};
$('#browser-pick').onclick = () => {
  $('#cwd-input').value = state.browsePath;
  $('#browser').classList.add('hidden');
};
$('#new-cancel').onclick = () => dlg.close();
$('#new-form').onsubmit = async (e) => {
  e.preventDefault();
  const body = { cwd: $('#cwd-input').value.trim(), model: $('#new-model').value, permissionMode: $('#new-mode').value, numCtx: state.config.defaultNumCtx };
  try {
    const s = await api('POST', '/api/sessions', body);
    localStorage.setItem('oc.model', body.model);
    localStorage.setItem('oc.mode', body.permissionMode);
    dlg.close();
    state.config.recentFolders = [body.cwd, ...state.config.recentFolders.filter((f) => f !== body.cwd)];
    await refreshSessions();
    openSession(s.id);
  } catch (err) {
    $('#new-error').textContent = err.message;
    $('#new-error').classList.remove('hidden');
  }
};

$('#new-session').onclick = openNewDialog;
$('#empty-new').onclick = openNewDialog;

// ---------- setup / system check ----------

const setupDlg = $('#setup-dialog');

async function openSetup() {
  if (!setupDlg.open) setupDlg.showModal();
  $('#checks').innerHTML = '<div class="note">Checking…</div>';
  $('#setup-actions').innerHTML = '';
  let r;
  try {
    r = await api('GET', '/api/doctor');
  } catch (e) {
    $('#checks').innerHTML = `<div class="note">${esc(e.message)}</div>`;
    return;
  }
  const icon = { ok: '✔', warn: '!', fail: '✖' };
  $('#checks').innerHTML = r.checks.map((c) => `<div class="check"><span class="i ${c.status}">${icon[c.status]}</span><span>${esc(c.label)}</span><span class="d">${esc(c.detail)}</span>${c.fix ? `<span class="fix">→ ${esc(c.fix)}</span>` : ''}</div>`).join('');

  const actions = $('#setup-actions');
  if (!r.ollama.reachable && r.ollama.binary) {
    const b = el('button', 'primary', 'Start Ollama');
    b.onclick = async () => {
      b.disabled = true;
      b.textContent = 'Starting…';
      await api('POST', '/api/ollama/start').catch(() => {});
      await loadConfig();
      openSetup();
    };
    actions.append(b);
  } else if (!r.ollama.reachable) {
    actions.innerHTML = `<div class="rec"><span class="grow">Ollama isn't installed. Run the Ollama Code installer again, or install it from <a href="https://ollama.com/download" target="_blank" rel="noopener">ollama.com/download</a>, then click Re-check.</span></div>`;
  } else {
    const rec = r.recommendation;
    const box = el('div', 'rec');
    box.innerHTML = `<span class="grow">Recommended for this computer: <strong class="mono">${esc(rec.model)}</strong> (~${rec.downloadGB} GB), based on ${esc(rec.basis)}.</span>`;
    if (rec.installed) box.append(el('span', '', '✔ installed'));
    else {
      const b = el('button', 'primary', 'Download');
      b.onclick = () => pullModel(rec.model);
      box.append(b);
    }
    actions.append(box);
    $('#pull-name').value = rec.installed ? '' : rec.model;
  }
}

async function pullModel(name) {
  name = (name || $('#pull-name').value).trim();
  if (!name) return;
  const prog = $('#pull-progress');
  const bar = prog.querySelector('.bar span');
  const text = prog.querySelector('.ptext');
  prog.classList.remove('hidden');
  $('#pull-btn').disabled = true;
  bar.style.width = '0';
  text.textContent = `Starting download of ${name}…`;
  try {
    const res = await fetch('/api/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: name }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let failed = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        const j = JSON.parse(line);
        if (j.error) failed = j.error;
        if (j.total && j.completed != null) {
          const pct = Math.round((j.completed / j.total) * 100);
          bar.style.width = pct + '%';
          text.textContent = `${j.status} — ${pct}% of ${(j.total / 1e9).toFixed(1)} GB`;
        } else if (j.status) text.textContent = j.status;
      }
    }
    if (failed) throw new Error(failed);
    bar.style.width = '100%';
    text.textContent = `${name} is ready.`;
    await loadConfig();
    openSetup();
  } catch (e) {
    text.textContent = `Download failed: ${e.message}`;
  } finally {
    $('#pull-btn').disabled = false;
  }
}

$('#pull-btn').onclick = () => pullModel();
$('#recheck-btn').onclick = async () => {
  await loadConfig();
  openSetup();
};
$('#setup-close').onclick = () => setupDlg.close();
$('#open-setup').onclick = openSetup;
$('#empty-setup').onclick = openSetup;

api('GET', '/api/version').then((v) => ($('#app-version').textContent = `v${v.version}`)).catch(() => {});
loadConfigReady.then(() => {
  if (state.config.ollamaError || !state.config.models.length) openSetup();
});

boot().catch((e) => {
  document.body.innerHTML = `<div class="empty"><h1>Couldn't start</h1><p>${esc(e.message)}</p></div>`;
});
