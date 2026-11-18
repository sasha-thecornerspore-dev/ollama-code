// Builds the release archives in dist/:
//   ollama-code.zip, ollama-code.tar.gz  (app files under an "ollama-code/" folder)
//   install.ps1, install.sh              (copies of the installers)
//   SHA256SUMS.txt
// Uses the system "tar" (bsdtar on Windows/macOS can write zip; on Linux "zip" is used).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const stage = path.join(dist, 'stage', 'ollama-code');
const INCLUDE = ['bin', 'src', 'public', 'installer', 'docs', 'server.js', 'package.json', 'LICENSE', 'README.md', 'CHANGELOG.md'];

fs.rmSync(path.join(dist, 'stage'), { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
for (const item of INCLUDE) {
  const from = path.join(root, item);
  if (!fs.existsSync(from)) throw new Error(`Missing ${item}`);
  fs.cpSync(from, path.join(stage, item), { recursive: true });
}

const cwd = path.join(dist, 'stage');
for (const f of ['ollama-code.zip', 'ollama-code.tar.gz']) fs.rmSync(path.join(dist, f), { force: true });
execFileSync('tar', ['-czf', path.join(dist, 'ollama-code.tar.gz'), 'ollama-code'], { cwd });
if (process.platform === 'linux') execFileSync('zip', ['-qr', path.join(dist, 'ollama-code.zip'), 'ollama-code'], { cwd });
else execFileSync('tar', ['-a', '-cf', path.join(dist, 'ollama-code.zip'), 'ollama-code'], { cwd });
fs.copyFileSync(path.join(root, 'installer', 'install.ps1'), path.join(dist, 'install.ps1'));
fs.copyFileSync(path.join(root, 'installer', 'install.sh'), path.join(dist, 'install.sh'));
fs.rmSync(path.join(dist, 'stage'), { recursive: true, force: true });

const files = fs.readdirSync(dist).filter((f) => f !== 'SHA256SUMS.txt' && fs.statSync(path.join(dist, f)).isFile()).sort();
const sums = files.map((f) => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, f))).digest('hex')}  ${f}`).join('\n') + '\n';
fs.writeFileSync(path.join(dist, 'SHA256SUMS.txt'), sums);
console.log(sums);
