// Rasterizes the app icon (rounded square with "</>") to PNG and ICO without any dependencies.
// Output: public/icon-{16..512}.png, public/icon.ico
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = [201, 100, 66];

// Shapes in a 64x64 design space (matches public/icon.svg).
const SEGMENTS = [
  [[20, 22], [12, 32]], [[12, 32], [20, 42]],
  [[44, 22], [52, 32]], [[52, 32], [44, 42]],
  [[36, 18], [28, 46]],
];
const STROKE = 2.5;

function distSeg(px, py, [[ax, ay], [bx, by]]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function roundedRectAlpha(x, y, r) {
  const cx = Math.min(Math.max(x, r), 64 - r);
  const cy = Math.min(Math.max(y, r), 64 - r);
  return Math.hypot(x - cx, y - cy) <= r ? 1 : 0;
}

function render(size) {
  const ss = 4; // supersampling
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0, w = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = ((x + (sx + 0.5) / ss) / size) * 64;
          const v = ((y + (sy + 0.5) / ss) / size) * 64;
          const inside = roundedRectAlpha(u, v, 14);
          a += inside;
          if (inside && SEGMENTS.some((s) => distSeg(u, v, s) <= STROKE)) w++;
        }
      }
      const n = ss * ss;
      const alpha = a / n;
      const white = a ? w / a : 0;
      const i = (y * size + x) * 4;
      px[i] = Math.round(BG[0] + (255 - BG[0]) * white);
      px[i + 1] = Math.round(BG[1] + (255 - BG[1]) * white);
      px[i + 2] = Math.round(BG[2] + (255 - BG[2]) * white);
      px[i + 3] = Math.round(alpha * 255);
    }
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const pngs = {};
for (const s of [16, 24, 32, 48, 64, 128, 256, 512]) {
  pngs[s] = png(s, render(s));
  fs.writeFileSync(path.join(out, `icon-${s}.png`), pngs[s]);
}

// ICO with embedded PNGs (supported since Windows Vista).
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const header = Buffer.alloc(6 + 16 * icoSizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
icoSizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header[e] = s === 256 ? 0 : s;
  header[e + 1] = s === 256 ? 0 : s;
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[s].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += pngs[s].length;
});
fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([header, ...icoSizes.map((s) => pngs[s])]));
console.log('Wrote icons to', out);
