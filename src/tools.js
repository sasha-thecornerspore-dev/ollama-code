// Agent tools: file reading/editing, search, shell, and the task list.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const IS_WIN = process.platform === 'win32';
export const SHELL_NAME = IS_WIN ? 'PowerShell' : 'bash';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', '.cache', 'coverage', 'target', '.idea', '.vs', '.gradle',
]);
const MAX_OUTPUT = 30000;

const fn = (name, description, properties, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});
const str = (description) => ({ type: 'string', description });

export const TOOL_DEFS = [
  fn('read_file', 'Read a text file. Returns lines prefixed with line numbers. Use offset/limit for large files.', {
    path: str('File path, absolute or relative to the working directory'),
    offset: { type: 'integer', description: '1-based line number to start reading from' },
    limit: { type: 'integer', description: 'Maximum number of lines to read (default 2000)' },
  }, ['path']),
  fn('write_file', 'Create a new file or completely overwrite an existing one. Prefer edit_file for changing existing files.', {
    path: str('File path'),
    content: str('The full file content'),
  }, ['path', 'content']),
  fn('edit_file', 'Replace an exact string in a file. old_string must match the file exactly (including indentation) and must be unique unless replace_all is true. If old_string is empty, new_string is appended to the end of the file. Always read the file first.', {
    path: str('File path'),
    old_string: str('Exact text to replace (empty to append)'),
    new_string: str('Replacement text'),
    replace_all: { type: 'boolean', description: 'Replace every occurrence' },
  }, ['path', 'old_string', 'new_string']),
  fn('list_dir', 'List the files and folders in a directory.', {
    path: str('Directory path (default: working directory)'),
  }),
  fn('glob', 'Find files by glob pattern, e.g. "**/*.ts" or "src/**/test_*.py". Results are sorted by most recently modified.', {
    pattern: str('Glob pattern'),
    path: str('Directory to search in (default: working directory)'),
  }, ['pattern']),
  fn('grep', 'Search file contents with a regular expression. Returns matches as path:line: text.', {
    pattern: str('Regular expression (JavaScript syntax)'),
    path: str('File or directory to search (default: working directory)'),
    include: str('Only search files matching this glob, e.g. "*.js" or "**/*.{ts,tsx}"'),
    ignore_case: { type: 'boolean', description: 'Case-insensitive search' },
  }, ['pattern']),
  fn('bash', `Run a shell command in the working directory using ${SHELL_NAME}. Use it for builds, tests, git and package managers. Output is truncated to ${MAX_OUTPUT} characters. Do not start interactive programs or servers that never exit.`, {
    command: str('The command to run'),
    timeout_ms: { type: 'integer', description: 'Timeout in milliseconds (default 120000, max 600000)' },
  }, ['command']),
  fn('todo_write', 'Create or update the task list shown to the user. Send the whole list every time. Keep exactly one task in_progress while working; mark tasks completed as soon as they are done.', {
    todos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: str('Short imperative description'),
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
        },
        required: ['content', 'status'],
      },
    },
  }, ['todos']),
];

export const TOOL_NAMES = new Set(TOOL_DEFS.map((t) => t.function.name));
export const READ_ONLY_TOOLS = new Set(['read_file', 'list_dir', 'glob', 'grep', 'todo_write']);
export const EDIT_TOOLS = new Set(['write_file', 'edit_file']);

// ---------- helpers ----------

function resolvePath(cwd, p) {
  if (!p || p === '.') return cwd;
  return path.resolve(cwd, String(p));
}

function rel(cwd, p) {
  const r = path.relative(cwd, p);
  return (r && !r.startsWith('..') && !path.isAbsolute(r) ? r : p).split(path.sep).join('/');
}

function truncate(s, max = MAX_OUTPUT) {
  if (s.length <= max) return s;
  const half = Math.floor(max / 2);
  return `${s.slice(0, half)}\n\n... [${s.length - max} characters truncated] ...\n\n${s.slice(-half)}`;
}

function isBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

const reEscape = (s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&');

export function globToRegex(glob) {
  const g = glob.replace(/\\/g, '/');
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = g.indexOf('}', i);
      if (end > i) {
        re += '(?:' + g.slice(i + 1, end).split(',').map(reEscape).join('|') + ')';
        i = end;
      } else re += '\\{';
    } else re += reEscape(c);
  }
  return new RegExp('^' + re + '$', IS_WIN ? 'i' : '');
}

function globMatcher(pattern) {
  const re = globToRegex(pattern);
  // A pattern without "/" matches the file name at any depth.
  const byName = !pattern.includes('/');
  return (relPath) => re.test(byName ? relPath.split('/').pop() : relPath);
}

async function walk(root, onFile, max = 100000) {
  const stack = [root];
  let n = 0;
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!IGNORE_DIRS.has(e.name)) stack.push(full);
      } else if (e.isFile()) {
        if (++n > max) return;
        if ((await onFile(full)) === false) return;
      }
    }
  }
}

// ---------- tools ----------

async function readFile({ path: p, offset, limit }, { cwd }) {
  const file = resolvePath(cwd, p);
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat) throw new Error(`File not found: ${file}`);
  if (stat.isDirectory()) throw new Error(`${file} is a directory. Use list_dir instead.`);
  if (stat.size > 10 * 1024 * 1024) throw new Error('File is larger than 10MB.');
  const buf = await fsp.readFile(file);
  if (isBinary(buf)) return { output: `(binary file, ${stat.size} bytes)` };
  const lines = buf.toString('utf8').split(/\r?\n/);
  const start = Math.max(1, Number(offset) || 1);
  const count = Math.max(1, Number(limit) || 2000);
  const slice = lines.slice(start - 1, start - 1 + count);
  if (!slice.length) return { output: `(file has ${lines.length} lines; nothing at offset ${start})` };
  const body = slice
    .map((l, i) => `${String(start + i).padStart(5)}\t${l.length > 2000 ? l.slice(0, 2000) + '…' : l}`)
    .join('\n');
  const more = start - 1 + slice.length < lines.length
    ? `\n\n(showing lines ${start}-${start + slice.length - 1} of ${lines.length}; use offset to read more)`
    : '';
  return { output: truncate(body) + more };
}

async function writeFile({ path: p, content }, { cwd }) {
  if (typeof content !== 'string') throw new Error('content must be a string');
  const file = resolvePath(cwd, p);
  const existed = fs.existsSync(file);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, content, 'utf8');
  const lines = content.split('\n').length;
  return { output: `${existed ? 'Overwrote' : 'Created'} ${rel(cwd, file)} (${lines} lines)` };
}

async function editFile({ path: p, old_string, new_string, replace_all }, { cwd }) {
  const file = resolvePath(cwd, p);
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}. Use write_file to create it.`);
  if (typeof new_string !== 'string') throw new Error('new_string is required');
  let text = await fsp.readFile(file, 'utf8');
  if (!old_string) {
    // Small models often omit old_string when they mean "add this"; treat it as an append.
    const sep = text.length && !text.endsWith('\n') ? '\n' : '';
    await fsp.writeFile(file, text + sep + new_string, 'utf8');
    return { output: `Appended ${new_string.split('\n').length} lines to the end of ${rel(cwd, file)}` };
  }
  if (old_string === new_string) throw new Error('old_string and new_string are identical');
  const crlf = text.includes('\r\n');
  if (crlf) text = text.replace(/\r\n/g, '\n');
  const oldS = old_string.replace(/\r\n/g, '\n');
  const newS = new_string.replace(/\r\n/g, '\n');
  const count = oldS ? text.split(oldS).length - 1 : 0;
  if (count === 0) throw new Error('old_string was not found in the file. Read the file again and copy the text exactly, including indentation.');
  if (count > 1 && !replace_all) throw new Error(`old_string appears ${count} times. Include more surrounding context to make it unique, or set replace_all.`);
  let out = replace_all ? text.split(oldS).join(newS) : text.replace(oldS, () => newS);
  if (crlf) out = out.replace(/\n/g, '\r\n');
  await fsp.writeFile(file, out, 'utf8');
  const line = text.slice(0, text.indexOf(oldS)).split('\n').length;
  return { output: `Edited ${rel(cwd, file)} (${replace_all ? count : 1} replacement${count > 1 && replace_all ? 's' : ''}, starting at line ${line})` };
}

async function listDir({ path: p }, { cwd }) {
  const dir = resolvePath(cwd, p);
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
  const lines = entries.slice(0, 500).map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  if (entries.length > 500) lines.push(`... and ${entries.length - 500} more`);
  return { output: `${dir}\n` + (lines.join('\n') || '(empty)') };
}

async function globTool({ pattern, path: p }, { cwd }) {
  const root = resolvePath(cwd, p);
  const match = globMatcher(String(pattern));
  const hits = [];
  await walk(root, async (full) => {
    const r = path.relative(root, full).split(path.sep).join('/');
    if (match(r)) {
      const st = await fsp.stat(full).catch(() => null);
      hits.push({ p: rel(cwd, full), m: st?.mtimeMs || 0 });
    }
  });
  hits.sort((a, b) => b.m - a.m);
  if (!hits.length) return { output: 'No files found.' };
  const shown = hits.slice(0, 300).map((h) => h.p);
  if (hits.length > 300) shown.push(`... ${hits.length - 300} more (narrow the pattern)`);
  return { output: shown.join('\n') };
}

async function grepTool({ pattern, path: p, include, ignore_case }, { cwd }) {
  let re;
  try {
    re = new RegExp(String(pattern), ignore_case ? 'i' : '');
  } catch (e) {
    throw new Error(`Invalid regex: ${e.message}`);
  }
  const target = resolvePath(cwd, p);
  const filter = include ? globMatcher(String(include)) : null;
  const out = [];
  const MAX = 300;
  const searchFile = async (full) => {
    const st = await fsp.stat(full).catch(() => null);
    if (!st || st.size > 2 * 1024 * 1024) return;
    const buf = await fsp.readFile(full).catch(() => null);
    if (!buf || isBinary(buf)) return;
    const lines = buf.toString('utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const l = lines[i].length > 300 ? lines[i].slice(0, 300) + '…' : lines[i];
        out.push(`${rel(cwd, full)}:${i + 1}: ${l.trim()}`);
        if (out.length >= MAX) return false;
      }
    }
  };
  const st = await fsp.stat(target).catch(() => null);
  if (!st) throw new Error(`Path not found: ${target}`);
  if (st.isFile()) await searchFile(target);
  else
    await walk(target, (full) => {
      if (filter && !filter(path.relative(target, full).split(path.sep).join('/'))) return;
      return searchFile(full);
    });
  if (!out.length) return { output: 'No matches.' };
  return { output: out.join('\n') + (out.length >= MAX ? `\n(stopped at ${MAX} matches)` : '') };
}

function killTree(child) {
  if (!child.pid) return;
  if (IS_WIN) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

function bashTool({ command, timeout_ms }, { cwd, signal }) {
  const timeout = Math.min(Math.max(Number(timeout_ms) || 120000, 1000), 600000);
  return new Promise((resolve) => {
    const child = IS_WIN
      ? spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
          `[Console]::OutputEncoding=[Text.Encoding]::UTF8; $ProgressPreference='SilentlyContinue'; ${command}`],
          { cwd, windowsHide: true })
      : spawn('/bin/bash', ['-lc', command], { cwd, detached: true });
    let output = '';
    let killed = '';
    const onData = (d) => {
      output += d.toString('utf8');
      if (output.length > MAX_OUTPUT * 4) output = output.slice(-MAX_OUTPUT * 2);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.stdin.end();
    const timer = setTimeout(() => {
      killed = `timed out after ${timeout} ms`;
      killTree(child);
    }, timeout);
    const onAbort = () => {
      killed = 'stopped by user';
      killTree(child);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ output: `Failed to start shell: ${e.message}`, error: true });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      const head = killed ? `[${killed}]` : `[exit code ${code}]`;
      resolve({ output: `${head}\n${truncate(output.trimEnd()) || '(no output)'}`, error: !!killed || code !== 0 });
    });
  });
}

async function todoWrite({ todos }, { session, emit }) {
  let list = todos;
  if (typeof list === 'string') list = JSON.parse(list);
  if (!Array.isArray(list)) throw new Error('todos must be an array');
  session.todos = list
    .map((t) => ({
      content: String(t.content ?? t.task ?? t.title ?? ''),
      status: ['pending', 'in_progress', 'completed'].includes(t.status) ? t.status : 'pending',
    }))
    .filter((t) => t.content);
  emit({ type: 'todos', todos: session.todos });
  const done = session.todos.filter((t) => t.status === 'completed').length;
  return { output: `Task list updated (${done}/${session.todos.length} completed).` };
}

const IMPL = {
  read_file: readFile,
  write_file: writeFile,
  edit_file: editFile,
  list_dir: listDir,
  glob: globTool,
  grep: grepTool,
  bash: bashTool,
  todo_write: todoWrite,
};

export async function runTool(name, args, ctx) {
  const impl = IMPL[name];
  if (!impl) return { output: `Unknown tool "${name}". Available: ${[...TOOL_NAMES].join(', ')}`, error: true };
  try {
    return await impl(args || {}, ctx);
  } catch (e) {
    return { output: `Error: ${e.message}`, error: true };
  }
}
