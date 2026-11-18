// Ollama Code: local HTTP server for the agent and its web UI.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { config } from './src/config.js';
import { Store } from './src/store.js';
import { Agent } from './src/agent.js';
import { listModels, modelCapabilities } from './src/ollama.js';
import { runChecks, ensureOllamaRunning } from './src/doctor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
export const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;
const store = new Store(config.dataDir);
const agent = new Agent(store, config);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};
const HOSTS = new Set([`localhost:${config.port}`, `127.0.0.1:${config.port}`]);
const ORIGINS = new Set([...HOSTS].map((h) => `http://${h}`));

function json(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let s = '';
  for await (const c of req) {
    s += c;
    if (s.length > 5e6) throw new Error('Body too large');
  }
  return s ? JSON.parse(s) : {};
}

function sessionView(s) {
  return {
    id: s.id, title: s.title, cwd: s.cwd, model: s.model, permissionMode: s.permissionMode,
    numCtx: s.numCtx, seq: s.seq, events: s.events, todos: s.todos, alwaysAllow: s.alwaysAllow,
    running: agent.isRunning(s.id), pending: agent.pendingIds(s.id),
  };
}

function listDrives() {
  const drives = [];
  for (let c = 65; c <= 90; c++) {
    const d = String.fromCharCode(c) + ':\\';
    if (fs.existsSync(d)) drives.push(d);
  }
  return drives;
}

function serveStatic(req, res, pathname) {
  const file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC)) return json(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
}

function stream(req, res, s, after) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const write = (ev) => res.write(`${ev.seq ? `id: ${ev.seq}\n` : ''}data: ${JSON.stringify(ev)}\n\n`);
  for (const ev of s.events) if (ev.seq > after) write(ev);
  write({ type: 'status', running: agent.isRunning(s.id) });
  const unsub = store.subscribe(s.id, write);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => {
    unsub();
    clearInterval(ping);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    // This server can run shell commands, so only accept requests addressed to localhost from our own page.
    if (!HOSTS.has(req.headers.host)) return json(res, 403, { error: 'Host not allowed' });
    if (req.method !== 'GET' && req.headers.origin && !ORIGINS.has(req.headers.origin)) return json(res, 403, { error: 'Origin not allowed' });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;
    const parts = p.split('/').filter(Boolean);

    if (!p.startsWith('/api/')) return serveStatic(req, res, p);

    if (p === '/api/config' && req.method === 'GET') {
      let models = [];
      let ollamaError = null;
      try {
        models = await listModels(config.ollamaUrl);
      } catch (e) {
        ollamaError = `Can't reach Ollama at ${config.ollamaUrl} (${e.cause?.code || e.message}). Start it with "ollama serve".`;
      }
      const recent = [...new Set(store.list().map((s) => s.cwd))].slice(0, 8);
      return json(res, 200, {
        models, ollamaError, ollamaUrl: config.ollamaUrl, defaultModel: config.defaultModel,
        defaultNumCtx: config.defaultNumCtx, home: os.homedir(), recentFolders: recent, platform: process.platform,
      });
    }

    if (p === '/api/version' && req.method === 'GET') return json(res, 200, { app: 'ollama-code', version: VERSION });

    if (p === '/api/doctor' && req.method === 'GET') return json(res, 200, await runChecks(config));

    if (p === '/api/shutdown' && req.method === 'POST') {
      json(res, 200, { ok: true });
      for (const s of store.list()) agent.stop(s.id);
      setTimeout(() => process.exit(0), 200);
      return;
    }

    if (p === '/api/ollama/start' && req.method === 'POST') return json(res, 200, await ensureOllamaRunning(config.ollamaUrl));

    if (p === '/api/pull' && req.method === 'POST') {
      // Stream Ollama's download progress straight through as NDJSON.
      const b = await readBody(req);
      if (!/^[\w.\-/:]+$/.test(String(b.model || ''))) return json(res, 400, { error: 'Invalid model name' });
      const ctrl = new AbortController();
      req.on('close', () => ctrl.abort());
      const up = await fetch(`${config.ollamaUrl}/api/pull`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: b.model, stream: true }), signal: ctrl.signal,
      }).catch((e) => ({ ok: false, statusText: e.message }));
      if (!up.ok) return json(res, 502, { error: `Ollama pull failed: ${up.statusText}` });
      res.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' });
      try {
        for await (const chunk of up.body) res.write(chunk);
      } catch { /* client went away */ }
      return res.end();
    }

    if (p === '/api/model-info' && req.method === 'GET') {
      try {
        return json(res, 200, await modelCapabilities(config.ollamaUrl, url.searchParams.get('model')));
      } catch (e) {
        return json(res, 200, { error: e.message });
      }
    }

    if (p === '/api/fs' && req.method === 'GET') {
      const target = url.searchParams.get('path') || os.homedir();
      if (target === '::drives') return json(res, 200, { path: '', parent: null, dirs: listDrives() });
      const abs = path.resolve(target);
      let dirs = [];
      try {
        dirs = fs.readdirSync(abs, { withFileTypes: true })
          .filter((d) => d.isDirectory() && !d.name.startsWith('$'))
          .map((d) => d.name)
          .sort((a, b) => a.localeCompare(b));
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
      const parentDir = path.dirname(abs);
      const parent = parentDir !== abs ? parentDir : process.platform === 'win32' ? '::drives' : null;
      return json(res, 200, { path: abs, parent, dirs });
    }

    if (p === '/api/sessions' && req.method === 'GET') return json(res, 200, store.list());

    if (p === '/api/sessions' && req.method === 'POST') {
      const b = await readBody(req);
      const cwd = path.resolve(String(b.cwd || ''));
      if (!b.cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) return json(res, 400, { error: `Folder not found: ${b.cwd}` });
      if (!b.model) return json(res, 400, { error: 'Choose a model' });
      const s = store.create({
        cwd, model: b.model,
        permissionMode: ['ask', 'acceptEdits', 'bypass'].includes(b.permissionMode) ? b.permissionMode : 'ask',
        numCtx: Number(b.numCtx) || config.defaultNumCtx,
      });
      return json(res, 201, sessionView(s));
    }

    if (parts[1] === 'sessions' && parts[2]) {
      const s = store.get(parts[2]);
      if (!s) return json(res, 404, { error: 'Session not found' });
      const action = parts[3];

      if (!action && req.method === 'GET') return json(res, 200, sessionView(s));
      if (!action && req.method === 'DELETE') {
        agent.stop(s.id);
        store.delete(s.id);
        return json(res, 200, { ok: true });
      }
      if (!action && req.method === 'PATCH') {
        const b = await readBody(req);
        if (b.model) s.model = String(b.model);
        if (['ask', 'acceptEdits', 'bypass'].includes(b.permissionMode)) s.permissionMode = b.permissionMode;
        if (b.numCtx) s.numCtx = Number(b.numCtx);
        if (b.title) s.title = String(b.title).slice(0, 100);
        store.save(s);
        return json(res, 200, sessionView(s));
      }
      if (action === 'stream' && req.method === 'GET') {
        const after = Math.max(Number(url.searchParams.get('after')) || 0, Number(req.headers['last-event-id']) || 0);
        return stream(req, res, s, after);
      }
      if (action === 'messages' && req.method === 'POST') {
        const b = await readBody(req);
        const text = String(b.text || '').trim();
        if (!text) return json(res, 400, { error: 'Empty message' });
        try {
          agent.send(s, text);
        } catch (e) {
          return json(res, 409, { error: e.message });
        }
        return json(res, 202, { ok: true });
      }
      if (action === 'permission' && req.method === 'POST') {
        const b = await readBody(req);
        const decision = ['allow', 'always', 'deny'].includes(b.decision) ? b.decision : 'deny';
        return json(res, agent.resolvePermission(s.id, b.id, decision) ? 200 : 404, { ok: true });
      }
      if (action === 'stop' && req.method === 'POST') return json(res, 200, { ok: agent.stop(s.id) });
      if (action === 'clear' && req.method === 'POST') {
        if (agent.isRunning(s.id)) return json(res, 409, { error: 'Stop the session first' });
        s.messages = [];
        s.todos = [];
        store.emit(s, { type: 'cleared' });
        return json(res, 200, sessionView(s));
      }
    }
    json(res, 404, { error: 'Not found' });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

export function openBrowser(url) {
  // Prefer a chromeless app window (Edge/Chrome --app) so it feels like a desktop app.
  const cmd = process.platform === 'win32'
    ? `start "" msedge --app=${url} || start "" chrome --app=${url} || start "" ${url}`
    : process.platform === 'darwin'
      ? `open -na "Google Chrome" --args --app=${url} 2>/dev/null || open ${url}`
      : `(google-chrome --app=${url} || chromium --app=${url} || xdg-open ${url}) >/dev/null 2>&1 &`;
  exec(cmd, { shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' });
}

export function startServer({ open = false } = {}) {
  const url = `http://localhost:${config.port}`;
  server.on('error', async (e) => {
    if (e.code !== 'EADDRINUSE') throw e;
    // Already running (e.g. the launcher was clicked twice): just open the window.
    const other = await fetch(`${url}/api/version`).then((r) => r.json()).catch(() => null);
    if (other?.app === 'ollama-code') {
      console.log(`Ollama Code is already running at ${url}`);
      if (open) openBrowser(url);
      setTimeout(() => process.exit(0), 500);
    } else {
      console.error(`Port ${config.port} is in use by another program. Set PORT or "port" in ${config.configPath}.`);
      process.exit(1);
    }
  });
  server.listen(config.port, '127.0.0.1', async () => {
    console.log(`Ollama Code ${VERSION} running at ${url}`);
    console.log(`Ollama: ${config.ollamaUrl}   Data: ${config.dataDir}`);
    const o = await ensureOllamaRunning(config.ollamaUrl);
    if (o.started && o.running) console.log('Started the Ollama server.');
    else if (!o.running) console.log(`Warning: Ollama is not running (${o.reason}). Open the app for setup help.`);
    if (open) openBrowser(url);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer({ open: process.argv.includes('--open') });
}
