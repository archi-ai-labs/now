import fs from 'node:fs/promises';
import path from 'node:path';
import { CCD_SESSIONS_DIR } from '../config.js';
import { mapLimit } from '../lib/sh.js';

/**
 * Claude Code desktop giữ sổ phiên riêng, và hai sổ đánh số bằng HAI KHÔNG GIAN
 * TÊN KHÁC NHAU — đo trên máy này: không một UUID nào trùng giữa chúng.
 *
 *   ~/.claude/sessions/<pid>.json      sessionId = UUID transcript   → `claude --resume` nhận
 *   claude-code-sessions/…/local_*.json sessionId = "local_<uuid>"   → lệnh archive nhận
 *
 * Cầu nối duy nhất là trường `cliSessionId` trong sổ của desktop. Không có nó thì
 * từ một hàng trên dashboard KHÔNG suy ra được phiên nào cần archive.
 *
 * Phiên mở từ VS Code hoặc terminal không có mặt trong sổ desktop nên không có
 * `local_` id — với chúng archive là khái niệm không tồn tại, và hàng đó không
 * mọc nút.
 */

/**
 * Mỗi file sổ nặng 10–45KB vì kèm nguyên schema của mọi MCP tool, mà thứ ta cần
 * chỉ là ba trường nằm ở đầu. Đọc cả trăm file mỗi 30 giây là ~4MB đọc lãng phí
 * cho vài trăm byte dùng được, nên chỉ đọc phần đầu.
 */
const HEAD_BYTES = 8 * 1024;

/** Khoá theo (đường dẫn, mtime, kích thước) — sổ hiếm khi đổi, quét thì liên tục. */
const storeCache = new Map();

/**
 * Bóc ba trường cần thiết bằng regex thay vì `JSON.parse`, vì ta cố tình chỉ cầm
 * một mẩu đầu file — mẩu đó gần như chắc chắn không phải JSON hợp lệ.
 */
export function parseStoreHead(text) {
  const ccdId = text.match(/"sessionId"\s*:\s*"(local_[^"]+)"/)?.[1] ?? null;
  const cliSessionId = text.match(/"cliSessionId"\s*:\s*"([^"]+)"/)?.[1] ?? null;
  if (!ccdId || !cliSessionId) return null;
  return { ccdId, cliSessionId, archived: /"isArchived"\s*:\s*true/.test(text) };
}

/** Đi sâu tối đa `depth` cấp: sổ xếp theo <workspace>/<project>/local_*.json. */
async function findStoreFiles(dir, depth) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth > 0) out.push(...(await findStoreFiles(p, depth - 1)));
    } else if (e.name.startsWith('local_') && e.name.endsWith('.json')) {
      out.push(p);
    }
  }
  return out;
}

async function readStore(file, size) {
  let fh;
  try {
    fh = await fs.open(file, 'r');
    const buf = Buffer.alloc(Math.min(HEAD_BYTES, size));
    await fh.read(buf, 0, buf.length, 0);
    const hit = parseStoreHead(buf.toString('utf8'));
    // Thứ tự khoá trong file là quan sát, không phải hợp đồng. Hụt thì mới chịu
    // trả giá đọc cả file — chứ không im lặng bỏ mất một phiên.
    if (!hit && size > HEAD_BYTES) return parseStoreHead(await fs.readFile(file, 'utf8'));
    return hit;
  } catch {
    return null;
  } finally {
    await fh?.close();
  }
}

/**
 * Bảng tra UUID transcript → id archive, CHỈ gồm phiên chưa archive.
 * Không có sổ (máy không phải macOS, hoặc chưa từng mở desktop) → bảng rỗng.
 */
export async function collectCcdIndex() {
  const files = await findStoreFiles(CCD_SESSIONS_DIR, 3);
  if (!files.length) return new Map();

  const rows = await mapLimit(files, 8, async (p) => {
    let st;
    try {
      st = await fs.stat(p);
    } catch {
      return null;
    }
    const key = `${st.mtimeMs}:${st.size}`;
    const hit = storeCache.get(p);
    if (hit?.key === key) return hit.entry;
    const entry = await readStore(p, st.size);
    if (storeCache.size > 400) storeCache.clear();
    storeCache.set(p, { key, entry });
    return entry;
  });

  const index = new Map();
  for (const r of rows) if (r && !r.archived) index.set(r.cliSessionId, r.ccdId);
  return index;
}
