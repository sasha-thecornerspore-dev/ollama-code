import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = process.env.OLLAMA_CODE_HOME || path.join(os.homedir(), '.ollama-code');
fs.mkdirSync(dataDir, { recursive: true });

let fileConfig = {};
const configPath = path.join(dataDir, 'config.json');
try {
  fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch {
  /* optional */
}

function normalizeHost(h) {
  if (!h) return 'http://127.0.0.1:11434';
  if (!/^https?:\/\//.test(h)) h = 'http://' + h;
  return h.replace(/\/+$/, '').replace('://0.0.0.0', '://127.0.0.1');
}

export const config = {
  dataDir,
  configPath,
  port: Number(process.env.PORT || fileConfig.port || 4317),
  ollamaUrl: normalizeHost(process.env.OLLAMA_HOST || fileConfig.ollamaUrl),
  defaultModel: process.env.OLLAMA_CODE_MODEL || fileConfig.defaultModel || '',
  defaultNumCtx: Number(fileConfig.numCtx || 16384),
  maxIterations: Number(fileConfig.maxIterations || 60),
  temperature: fileConfig.temperature ?? 0.2,
};
