// System checks: what the machine has, what Ollama Code needs, and which model fits the hardware.
// Used by the CLI (`ollama-code doctor`), the installers, and the in-app setup screen.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

async function tryRun(cmd, args = [], timeout = 8000) {
  try {
    const { stdout } = await execFileP(cmd, args, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    return stdout.toString().trim();
  } catch {
    return null;
  }
}

const round1 = (n) => Math.round(n * 10) / 10;

// Recommended coding models by available memory (GB). Sizes are Q4 download sizes.
export const MODEL_TIERS = [
  { min: 22, model: 'qwen2.5-coder:32b', downloadGB: 20 },
  { min: 11, model: 'qwen2.5-coder:14b', downloadGB: 9 },
  { min: 6, model: 'qwen2.5-coder:7b', downloadGB: 4.7 },
  { min: 3.5, model: 'qwen2.5-coder:3b', downloadGB: 1.9 },
  { min: 0, model: 'qwen2.5-coder:1.5b', downloadGB: 1 },
];

export async function detectGpus() {
  const gpus = [];
  const nv = await tryRun('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits']);
  if (nv) {
    for (const line of nv.split('\n')) {
      const [name, mem] = line.split(',').map((s) => s.trim());
      if (name) gpus.push({ name, vendor: 'NVIDIA', vramGB: round1(Number(mem) / 1024) });
    }
    if (gpus.length) return gpus;
  }
  if (IS_WIN) {
    const out = await tryRun('powershell.exe', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_VideoController | ForEach-Object { "$($_.Name)|$($_.AdapterRAM)" }']);
    for (const line of (out || '').split('\n')) {
      const [name, ram] = line.trim().split('|');
      if (!name || /basic display|remote|virtual/i.test(name)) continue;
      // AdapterRAM is a 32-bit field and caps at 4 GB, so treat it as a lower bound.
      gpus.push({ name, vendor: /amd|radeon/i.test(name) ? 'AMD' : /intel/i.test(name) ? 'Intel' : 'Other', vramGB: ram ? round1(Number(ram) / 1024 ** 3) : 0, approximate: true });
    }
  } else if (IS_MAC) {
    const out = await tryRun('system_profiler', ['SPDisplaysDataType']);
    const m = out?.match(/Chipset Model:\s*(.+)/);
    if (m) gpus.push({ name: m[1].trim(), vendor: /apple/i.test(m[1]) ? 'Apple' : 'Other', vramGB: 0, unified: process.arch === 'arm64' });
  } else {
    const rocm = await tryRun('rocm-smi', ['--showmeminfo', 'vram', '--csv']);
    const total = rocm?.match(/,(\d{9,})/);
    if (total) gpus.push({ name: 'AMD GPU (ROCm)', vendor: 'AMD', vramGB: round1(Number(total[1]) / 1024 ** 3) });
    else {
      const lspci = await tryRun('lspci');
      for (const line of (lspci || '').split('\n')) {
        if (/VGA|3D controller/i.test(line)) gpus.push({ name: line.split(': ').pop(), vendor: 'Other', vramGB: 0 });
      }
    }
  }
  return gpus;
}

export async function systemInfo(dataDir) {
  const gpus = await detectGpus();
  let diskFreeGB = null;
  try {
    const st = fs.statfsSync(dataDir || os.homedir());
    diskFreeGB = round1((st.bavail * st.bsize) / 1024 ** 3);
  } catch { /* unsupported */ }
  return {
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    cpu: os.cpus()[0]?.model?.trim() || 'unknown',
    cores: os.cpus().length,
    ramGB: round1(os.totalmem() / 1024 ** 3),
    gpus,
    diskFreeGB,
    node: process.versions.node,
  };
}

export function recommendModel(sys) {
  const vram = Math.max(0, ...sys.gpus.map((g) => (g.approximate ? 0 : g.vramGB || 0)));
  let budget;
  let basis;
  if (sys.platform === 'darwin' && sys.arch === 'arm64') {
    budget = sys.ramGB * 0.65;
    basis = `${sys.ramGB} GB unified memory (Apple Silicon)`;
  } else if (vram >= 3.5) {
    budget = vram;
    basis = `${vram} GB of GPU memory`;
  } else {
    budget = Math.min(sys.ramGB * 0.5, 10);
    basis = `${sys.ramGB} GB RAM and no supported GPU detected (runs on CPU, so expect it to be slower)`;
  }
  const tier = MODEL_TIERS.find((t) => budget >= t.min);
  return { model: tier.model, downloadGB: tier.downloadGB, basis };
}

export function findOllamaBinary() {
  const candidates = IS_WIN
    ? [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'), 'C:\\Program Files\\Ollama\\ollama.exe']
    : ['/usr/local/bin/ollama', '/opt/homebrew/bin/ollama', '/usr/bin/ollama', '/Applications/Ollama.app/Contents/Resources/ollama', path.join(os.homedir(), '.local', 'bin', 'ollama')];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (dir) candidates.unshift(path.join(dir, IS_WIN ? 'ollama.exe' : 'ollama'));
  }
  return candidates.find((c) => c && fs.existsSync(c)) || null;
}

async function ollamaGet(url, p, timeout = 3000) {
  const res = await fetch(`${url}${p}`, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function ollamaStatus(url) {
  try {
    const v = await ollamaGet(url, '/api/version');
    const tags = await ollamaGet(url, '/api/tags');
    return { reachable: true, version: v.version, models: (tags.models || []).map((m) => m.name) };
  } catch (e) {
    return { reachable: false, error: e.cause?.code || e.message, models: [] };
  }
}

// Start the Ollama server in the background if it is installed but not running.
export async function ensureOllamaRunning(url, waitMs = 20000) {
  if ((await ollamaStatus(url)).reachable) return { started: false, running: true };
  // Only start a local server when Ollama is configured to run on this machine.
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(url)) return { started: false, running: false, reason: `Ollama at ${url} is not reachable (remote server; not starting a local one)` };
  const bin = findOllamaBinary();
  if (!bin) return { started: false, running: false, reason: 'Ollama is not installed' };
  try {
    if (IS_MAC && fs.existsSync('/Applications/Ollama.app')) spawn('open', ['-a', 'Ollama'], { detached: true, stdio: 'ignore' }).unref();
    else spawn(bin, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch (e) {
    return { started: false, running: false, reason: e.message };
  }
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 750));
    if ((await ollamaStatus(url)).reachable) return { started: true, running: true };
  }
  return { started: true, running: false, reason: 'Ollama did not respond in time' };
}

function versionAtLeast(v, min) {
  const a = String(v).split(/[.-]/).map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < b.length; i++) {
    if ((a[i] || 0) > b[i]) return true;
    if ((a[i] || 0) < b[i]) return false;
  }
  return true;
}

const CODER_RE = /coder|code|devstral|qwen3|gpt-oss|llama3\.[1-9]|mistral|granite/i;

export async function runChecks(config) {
  const sys = await systemInfo(config.dataDir);
  const rec = recommendModel(sys);
  const ollama = await ollamaStatus(config.ollamaUrl);
  const bin = findOllamaBinary();
  const checks = [];
  const add = (id, label, status, detail, fix) => checks.push({ id, label, status, detail, fix });

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add('node', 'Node.js', nodeMajor >= 20 ? 'ok' : 'fail', `v${process.versions.node}`, nodeMajor >= 20 ? null : 'Install Node.js 20 or newer from https://nodejs.org');

  const supported = ['win32', 'darwin', 'linux'].includes(sys.platform);
  add('os', 'Operating system', supported ? 'ok' : 'warn', `${sys.platform} ${sys.arch} (${sys.osRelease})`, supported ? null : 'Untested platform; Ollama may not be available.');

  add('ram', 'Memory', sys.ramGB >= 16 ? 'ok' : 'warn', `${sys.ramGB} GB RAM, ${sys.cores} CPU threads`,
    sys.ramGB >= 16 ? null : sys.ramGB >= 8 ? 'Small models only; close other apps for best results.' : 'Below the recommended 8 GB: only the smallest models will run, slowly.');

  const gpuText = sys.gpus.length ? sys.gpus.map((g) => `${g.name}${g.vramGB ? ` (${g.approximate ? '≥' : ''}${g.vramGB} GB)` : ''}`).join(', ') : 'none detected';
  const goodGpu = sys.gpus.some((g) => (g.vendor === 'NVIDIA' && g.vramGB >= 4) || g.unified || (g.vendor === 'AMD' && g.vramGB >= 4));
  add('gpu', 'GPU acceleration', goodGpu ? 'ok' : 'warn', gpuText, goodGpu ? null : 'Models will run on the CPU. That works, but responses are slower.');

  if (sys.diskFreeGB != null) {
    const need = rec.downloadGB + 2;
    add('disk', 'Disk space', sys.diskFreeGB >= need ? 'ok' : 'warn', `${sys.diskFreeGB} GB free`, sys.diskFreeGB >= need ? null : `The recommended model needs about ${need} GB.`);
  }

  add('ollama-installed', 'Ollama installed', bin || ollama.reachable ? 'ok' : 'fail', bin || (ollama.reachable ? 'running (binary not on PATH)' : 'not found'),
    bin || ollama.reachable ? null : 'Install Ollama from https://ollama.com/download (the installer does this for you).');

  if (ollama.reachable) {
    const recent = versionAtLeast(ollama.version, '0.4.0');
    add('ollama-running', 'Ollama server', recent ? 'ok' : 'warn', `v${ollama.version} at ${config.ollamaUrl}`, recent ? null : 'Update Ollama: older versions have weak tool-calling support.');
  } else {
    add('ollama-running', 'Ollama server', 'fail', `not reachable at ${config.ollamaUrl}`, bin ? 'Start it with "ollama serve" (Ollama Code also starts it automatically).' : 'Install Ollama first.');
  }

  const coders = ollama.models.filter((m) => CODER_RE.test(m));
  if (!ollama.reachable) add('models', 'Models', 'fail', 'unknown (Ollama not running)', null);
  else if (!ollama.models.length) add('models', 'Models', 'fail', 'no models installed', `Download one: ollama pull ${rec.model}`);
  else add('models', 'Models', coders.length ? 'ok' : 'warn', ollama.models.join(', '), coders.length ? null : `None of these are coding models. Try: ollama pull ${rec.model}`);

  const git = await tryRun('git', ['--version']);
  add('git', 'Git', git ? 'ok' : 'warn', git || 'not found', git ? null : 'Optional, but the agent works better with git (https://git-scm.com).');

  const ok = !checks.some((c) => c.status === 'fail');
  return { ok, system: sys, recommendation: { ...rec, installed: ollama.models.includes(rec.model) }, ollama: { url: config.ollamaUrl, binary: bin, ...ollama }, checks };
}

export function formatReport(report, color = process.stdout.isTTY) {
  const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const icon = { ok: c(32, '✔'), warn: c(33, '!'), fail: c(31, '✖') };
  const lines = ['', c(1, 'Ollama Code — system check'), ''];
  for (const ch of report.checks) {
    lines.push(` ${icon[ch.status]} ${ch.label.padEnd(18)} ${ch.detail}`);
    if (ch.fix) lines.push(`   ${' '.repeat(18)} ${c(2, '→ ' + ch.fix)}`);
  }
  const r = report.recommendation;
  lines.push('', ` Recommended model: ${c(1, r.model)} (~${r.downloadGB} GB) for ${r.basis}${r.installed ? c(32, ' — installed') : ''}`);
  lines.push('', report.ok ? c(32, ' Ready to go.') : c(31, ' Some required pieces are missing. Run "ollama-code doctor --fix" or the installer.'), '');
  return lines.join('\n');
}
