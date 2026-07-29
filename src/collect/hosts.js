import fs from 'node:fs/promises';
import path from 'node:path';
import { SESSION_HOST_FILE } from '../config.js';

/**
 * Sổ "phiên nào chạy trong app nào".
 *
 * ## Vì sao phải có sổ
 *
 * Transcript ghi `entrypoint: "claude-vscode"` cho CẢ VS Code, Cursor lẫn bất kỳ bản
 * fork nào khác — cả ba dùng chung một extension nên với Claude Code chúng là một.
 * Đo trên máy này: 22.897 bản ghi mang nhãn đó, tức là gần một phần ba lượng token,
 * gộp vào một cái tên không nói lên editor nào.
 *
 * Thứ duy nhất phân biệt được là cây tiến trình — mà cây tiến trình chết theo phiên.
 * Nên: mỗi lượt quét thấy một phiên còn SỐNG là chốt app chủ của nó ra đĩa. Về sau
 * phiên tắt, transcript vẫn còn, và sổ này là đường duy nhất để quy token về đúng chỗ.
 *
 * ## Ba tính chất phải giữ
 *
 * - **Chỉ ghi thêm, không sửa lại.** Một phiên đã chạy trong Cursor thì vĩnh viễn là
 *   Cursor; ghi đè bằng lần quan sát sau chỉ có thể làm sai đi.
 * - **Không biết thì không ghi.** `hostOf` trả `null` khi leo hết cây mà không gặp app
 *   nào (chạy từ launchd, ssh, tiến trình nền). Ghi `null` vào sổ là đóng băng một câu
 *   trả lời sai — để trống thì lần chạy sau còn cơ hội.
 * - **Cắt bớt phần đã chết.** Claude Code tự xoá transcript sau ~30 ngày, nên mục sổ
 *   cũ hơn thế không còn gì để quy trách nhiệm nữa. Giữ 120 ngày cho rộng tay rồi cắt.
 */

const PRUNE_MS = 120 * 86400_000;

/** `{ sessionId: { host, at } }`, nạp một lần rồi giữ trong bộ nhớ. */
let ledger = null;
let dirty = false;

async function load() {
  if (ledger) return ledger;
  ledger = new Map();
  try {
    const raw = JSON.parse(await fs.readFile(SESSION_HOST_FILE, 'utf8'));
    for (const [id, v] of Object.entries(raw?.sessions ?? {})) {
      if (v?.host) ledger.set(id, { host: v.host, at: Number(v.at) || 0 });
    }
  } catch {
    /* chưa có sổ — lượt quét này sẽ tạo */
  }
  return ledger;
}

/** Ghi tạm rồi đổi tên: đọc trúng lúc đang ghi thì thấy bản cũ nguyên vẹn. */
async function flush(now) {
  if (!dirty) return;
  dirty = false;
  const sessions = {};
  for (const [id, v] of ledger) {
    if (now - v.at <= PRUNE_MS) sessions[id] = v;
  }
  const tmp = `${SESSION_HOST_FILE}.${process.pid}`;
  try {
    await fs.mkdir(path.dirname(SESSION_HOST_FILE), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify({ version: 1, sessions }));
    await fs.rename(tmp, SESSION_HOST_FILE);
  } catch {
    await fs.rm(tmp, { force: true }).catch(() => {});
    // Mất sổ chỉ tốn độ chính xác của một biểu đồ; làm sập lượt quét thì mất cả trang.
    dirty = true;
  }
}

/**
 * Cập nhật sổ bằng những gì đang quan sát được, rồi trả về bảng tra đầy đủ.
 *
 * `seen` là `Map<sessionId, host>` của các phiên CÒN SỐNG lượt này.
 */
export async function syncHosts(seen, now = Date.now()) {
  const book = await load();
  for (const [id, host] of seen) {
    if (!host || book.has(id)) continue;
    book.set(id, { host, at: now });
    dirty = true;
  }
  // Không await: đĩa chậm không có lý do gì chặn lượt quét, và mất một lượt ghi chỉ
  // có nghĩa là lượt sau ghi lại.
  flush(now);
  return book;
}

/** Chỉ dùng cho test: quên hết để mỗi ca chạy trên sổ sạch. */
export function _reset() {
  ledger = null;
  dirty = false;
}
