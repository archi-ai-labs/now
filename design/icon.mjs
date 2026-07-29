#!/usr/bin/env node
/**
 * `design/icon.svg` → `public/icon-1024.png` + `public/icon-180.png`.
 *
 * macOS lấy icon Dock của web app từ PNG, không nhận SVG — nhưng để PNG là nguồn thì
 * đổi màu nhấn trong `design/tokens.json` xong không ai dựng lại được icon. Nguồn vẫn
 * là SVG, file này chỉ là bước ép ra PNG.
 *
 * Dựng bằng Chrome headless vì máy không có `rsvg-convert`/ImageMagick, và thêm một
 * gói npm chỉ để vẽ icon thì phá mất "không phụ thuộc gói nào" của repo.
 *
 *   node design/icon.mjs
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MASTER = 1024;
// Bản nhỏ thu từ bản 1024 bằng `sips`, KHÔNG render lại bằng Chrome: Chrome có cỡ cửa
// sổ tối thiểu nên `--window-size=180,180` bị kẹp lên và ảnh chụp ra lệch khung.
const DOWNSCALE = [180];

const svg = await fsp.readFile(path.join(ROOT, 'design/icon.svg'), 'utf8');
// Bọc trong HTML lề 0: mở thẳng file .svg thì Chrome tự thêm lề của document và ảnh
// chụp ra lệch vài pixel — bọc lại mới khớp đúng khung.
const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block;width:100vw;height:100vh}</style>
${svg}`;

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'now-icon-'));
const page = path.join(tmp, 'icon.html');
await fsp.writeFile(page, html);

try {
  await fsp.access(CHROME);
} catch {
  console.error(`Không thấy Chrome ở ${CHROME} — sửa hằng CHROME trong file này.`);
  process.exit(1);
}

const master = path.join(ROOT, 'public', `icon-${MASTER}.png`);
await run(CHROME, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--window-size=${MASTER},${MASTER}`,
  `--screenshot=${master}`,
  `file://${page}`,
]);
await report(master, MASTER);

for (const size of DOWNSCALE) {
  const out = path.join(ROOT, 'public', `icon-${size}.png`);
  await fsp.copyFile(master, out);
  await run('sips', ['-z', String(size), String(size), out]);
  await report(out, size);
}

async function report(file, size) {
  const { size: bytes } = await fsp.stat(file);
  console.log(`public/${path.basename(file)} — ${size}×${size}, ${(bytes / 1024).toFixed(1)} KB`);
}

await fsp.rm(tmp, { recursive: true, force: true });
