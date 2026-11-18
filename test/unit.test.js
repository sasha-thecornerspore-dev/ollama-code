import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractTextToolCalls } from '../src/parse.js';
import { globToRegex, runTool, TOOL_NAMES } from '../src/tools.js';

test('parses fenced tool calls and strips them from text', () => {
  const r = extractTextToolCalls('Let me look.\n```tool\n{"name":"read_file","arguments":{"path":"a.js"}}\n```', TOOL_NAMES);
  assert.deepEqual(r.calls, [{ name: 'read_file', args: { path: 'a.js' } }]);
  assert.equal(r.text, 'Let me look.');
});

test('parses bare JSON, <tool_call> tags, and string arguments', () => {
  assert.equal(extractTextToolCalls('{"name":"glob","parameters":{"pattern":"*.js"}}', TOOL_NAMES).calls[0].args.pattern, '*.js');
  const t = extractTextToolCalls('<tool_call>{"name":"bash","arguments":"{\\"command\\":\\"ls\\"}"}</tool_call>', TOOL_NAMES);
  assert.equal(t.calls[0].args.command, 'ls');
});

test('ignores JSON that is not a known tool', () => {
  const r = extractTextToolCalls('```json\n{"name":"bob","age":3}\n```', TOOL_NAMES);
  assert.equal(r.calls.length, 0);
});

test('glob regex', () => {
  assert.ok(globToRegex('**/*.ts').test('src/a/b.ts'));
  assert.ok(globToRegex('**/*.ts').test('b.ts'));
  assert.ok(!globToRegex('src/*.ts').test('src/a/b.ts'));
  assert.ok(globToRegex('*.{js,ts}').test('x.ts'));
});

test('file tools: write, edit, read, grep, glob', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-'));
  const ctx = { cwd: dir };
  await runTool('write_file', { path: 'src/a.js', content: 'const x = 1;\nconst y = 2;\n' }, ctx);
  const e = await runTool('edit_file', { path: 'src/a.js', old_string: 'const y = 2;', new_string: 'const y = 3;' }, ctx);
  assert.ok(!e.error, e.output);
  const r = await runTool('read_file', { path: 'src/a.js' }, ctx);
  assert.match(r.output, /2\tconst y = 3;/);
  const dup = await runTool('edit_file', { path: 'src/a.js', old_string: 'const', new_string: 'let' }, ctx);
  assert.ok(dup.error);
  const ap = await runTool('edit_file', { path: 'src/a.js', new_string: 'const z = 4;' }, ctx);
  assert.match(ap.output, /Appended/);
  assert.match(fs.readFileSync(path.join(dir, 'src/a.js'), 'utf8'), /const z = 4;$/);
  const g = await runTool('grep', { pattern: 'y = 3', include: '*.js' }, ctx);
  assert.match(g.output, /src\/a\.js:2/);
  const gl = await runTool('glob', { pattern: '**/*.js' }, ctx);
  assert.equal(gl.output, 'src/a.js');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('model recommendation follows hardware', async () => {
  const { recommendModel } = await import('../src/doctor.js');
  const base = { platform: 'linux', arch: 'x64', ramGB: 32, gpus: [] };
  assert.equal(recommendModel({ ...base, gpus: [{ vramGB: 24 }] }).model, 'qwen2.5-coder:32b');
  assert.equal(recommendModel({ ...base, gpus: [{ vramGB: 12 }] }).model, 'qwen2.5-coder:14b');
  assert.equal(recommendModel({ ...base, gpus: [{ vramGB: 8 }] }).model, 'qwen2.5-coder:7b');
  assert.equal(recommendModel({ ...base, ramGB: 8 }).model, 'qwen2.5-coder:3b');
  assert.equal(recommendModel({ ...base, platform: 'darwin', arch: 'arm64', ramGB: 16 }).model, 'qwen2.5-coder:7b');
  // Approximate (capped) Windows VRAM readings are ignored.
  assert.equal(recommendModel({ ...base, ramGB: 16, gpus: [{ vramGB: 4, approximate: true }] }).model, 'qwen2.5-coder:7b');
});

test('bash tool runs a command', async () => {
  const r = await runTool('bash', { command: 'echo hello-oc' }, { cwd: os.tmpdir() });
  assert.match(r.output, /exit code 0/);
  assert.match(r.output, /hello-oc/);
});
