#!/usr/bin/env node
// Ollama Code command-line entry point.
import { spawn } from 'node:child_process';
import { config } from '../src/config.js';
import { runChecks, formatReport, ensureOllamaRunning, findOllamaBinary } from '../src/doctor.js';

const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith('-') ? args[0] : 'start';
const flag = (f) => args.includes(f);

const HELP = `Ollama Code — a local coding agent for Ollama models

Usage:
  ollama-code [start] [--no-open]            Start the app and open its window (--no-open: server only)
  ollama-code stop                           Stop a running instance
  ollama-code doctor [--json] [--fix]        Check this system; --fix starts Ollama and downloads a model
  ollama-code pull <model>                   Download a model with Ollama
  ollama-code version                        Print the version
  ollama-code help                           Show this help

Settings: ${config.configPath}
Data:     ${config.dataDir}
Docs:     https://github.com/sasha-thecornerspore-dev/ollama-code/blob/main/docs/MANUAL.md
`;

function pull(model) {
  const bin = findOllamaBinary();
  if (!bin) {
    console.error('Ollama is not installed. Run the installer or get it from https://ollama.com/download');
    return Promise.resolve(1);
  }
  console.log(`Downloading ${model} (this can take a while)…`);
  return new Promise((resolve) => {
    const p = spawn(bin, ['pull', model], { stdio: 'inherit' });
    p.on('close', resolve);
    p.on('error', () => resolve(1));
  });
}

async function main() {
  switch (cmd) {
    case 'help':
    case '--help':
      console.log(HELP);
      return 0;
    case 'version':
    case '--version': {
      const { VERSION } = await import('../server.js');
      console.log(VERSION);
      process.exit(0);
    }
    case 'doctor': {
      if (flag('--fix')) {
        const o = await ensureOllamaRunning(config.ollamaUrl);
        if (o.started && o.running) console.log('Started the Ollama server.');
      }
      let report = await runChecks(config);
      if (flag('--fix') && report.ollama.reachable && !report.recommendation.installed && !report.checks.find((c) => c.id === 'models' && c.status === 'ok')) {
        const code = await pull(report.recommendation.model);
        if (code === 0) report = await runChecks(config);
      }
      if (flag('--json')) console.log(JSON.stringify(report, null, 2));
      else console.log(formatReport(report));
      return report.ok ? 0 : 2;
    }
    case 'stop': {
      const r = await fetch(`http://localhost:${config.port}/api/shutdown`, { method: 'POST' }).catch(() => null);
      console.log(r?.ok ? 'Ollama Code stopped.' : 'Ollama Code is not running.');
      return 0;
    }
    case 'pull':
      if (!args[1]) {
        console.error('Usage: ollama-code pull <model>');
        return 1;
      }
      await ensureOllamaRunning(config.ollamaUrl);
      return pull(args[1]);
    case 'start': {
      const { startServer } = await import('../server.js');
      startServer({ open: !flag('--no-open') });
      return null; // keep running
    }
    default:
      console.error(`Unknown command "${cmd}".\n`);
      console.log(HELP);
      return 1;
  }
}

main().then((code) => {
  if (code !== null && code !== undefined) process.exit(code);
}).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
