// Session persistence (one JSON file per session) and event fan-out to SSE clients.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class Store {
  constructor(dataDir) {
    this.dir = path.join(dataDir, 'sessions');
    fs.mkdirSync(this.dir, { recursive: true });
    this.sessions = new Map();
    this.listeners = new Map();
    this.timers = new Map();
    for (const f of fs.readdirSync(this.dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const s = JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8'));
        this.sessions.set(s.id, s);
      } catch {
        /* skip corrupt file */
      }
    }
  }

  list() {
    return [...this.sessions.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ id, title, cwd, model, updatedAt }) => ({ id, title, cwd, model, updatedAt }));
  }

  get(id) {
    return this.sessions.get(id);
  }

  create({ cwd, model, permissionMode = 'ask', numCtx }) {
    const now = Date.now();
    const s = {
      id: crypto.randomUUID(),
      title: 'New session',
      cwd,
      model,
      permissionMode,
      numCtx,
      createdAt: now,
      updatedAt: now,
      seq: 0,
      messages: [],
      events: [],
      todos: [],
      alwaysAllow: [],
    };
    this.sessions.set(s.id, s);
    this.save(s);
    return s;
  }

  delete(id) {
    this.sessions.delete(id);
    fs.rmSync(path.join(this.dir, `${id}.json`), { force: true });
  }

  save(s) {
    clearTimeout(this.timers.get(s.id));
    this.timers.delete(s.id);
    if (!this.sessions.has(s.id)) return;
    const file = path.join(this.dir, `${s.id}.json`);
    fs.writeFileSync(file + '.tmp', JSON.stringify(s));
    fs.renameSync(file + '.tmp', file);
  }

  scheduleSave(s) {
    if (this.timers.has(s.id)) return;
    this.timers.set(s.id, setTimeout(() => this.save(s), 400));
  }

  // persist=false is for transient events (streaming deltas, status) that should not be replayed.
  emit(s, event, persist = true) {
    const ev = { ...event, ts: Date.now() };
    if (persist) {
      ev.seq = ++s.seq;
      s.events.push(ev);
      s.updatedAt = ev.ts;
      this.scheduleSave(s);
    }
    for (const fn of this.listeners.get(s.id) || []) fn(ev);
  }

  subscribe(id, fn) {
    if (!this.listeners.has(id)) this.listeners.set(id, new Set());
    this.listeners.get(id).add(fn);
    return () => this.listeners.get(id)?.delete(fn);
  }
}
