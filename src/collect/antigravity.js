import fs from 'node:fs/promises';
import path from 'node:path';
import { ANTIGRAVITY_CONVOS, ANTIGRAVITY_SUMMARIES, CONVO_IDLE_MS, CONVO_KEEP_DAYS } from '../config.js';
import { all, decode, int, str, sub, timestampMs } from '../lib/pb.js';

/**
 * Hội thoại Antigravity (IDE agent của Google).
 *
 * Antigravity KHÔNG để lại dấu vết nào trong `~/.claude`: nó không chạy Claude Code,
 * nó có agent riêng. Nên với sở chỉ huy này nó là một bề mặt làm việc thứ ba, song
 * song với Claude Code và Cursor — và cho tới giờ là bề mặt DUY NHẤT hoàn toàn vô
 * hình, dù trên máy này nó đang giữ 80 hội thoại và 179MB.
 *
 * Ba nguồn, xuống dần theo độ tin cậy:
 *
 * 1. `agyhub_summaries_proto.pb` — sổ mục lục: id, tiêu đề, workspace, số bước, mốc
 *    tạo và mốc cập nhật. Protobuf nhị phân, KHÔNG có tài liệu.
 * 2. `conversations/<id>.db` — mtime của file, tức là lần ghi cuối. Đây là mốc đáng
 *    tin nhất về "còn sống hay không", vì nó do hệ tệp ghi chứ không do app tự khai.
 * 3. Tiến trình `Antigravity.app` đang chạy hay không (xem `collect/procs.js`).
 *
 * Vì (1) không có tài liệu nên mọi trường đều đọc phòng thủ: thiếu thì để `null` và
 * hội thoại vẫn hiện ra với những gì còn đọc được. Google đổi hình dạng thì màn hình
 * mất chữ, không mất cả trang — cùng một luật đã áp cho endpoint hạn mức.
 *
 * ## Hình dạng đã dò được (2026-07-26, Antigravity 2.3.1)
 *
 * ```
 * <file>            1  = hội thoại (lặp)
 *   hội thoại       1  = id (uuid)
 *                   2  = tóm tắt
 *   tóm tắt         1  = tiêu đề
 *                   2  = số bước
 *                   3  = Timestamp — cập nhật lần cuối
 *                   7  = Timestamp — tạo
 *                   9  = { 1 = workspace URI }
 * ```
 *
 * Trường 3 luôn ≥ trường 7 trên toàn bộ 80 bản ghi ở đây, nên phép gán "3 = cập nhật,
 * 7 = tạo" là quan sát chứ không phải phỏng đoán. Dù vậy `at` vẫn lấy mtime của file
 * `.db` làm chuẩn khi có — nguồn (2) không phụ thuộc vào việc đọc đúng schema.
 */

/** `file:///Users/…` → `/Users/…`. Bỏ qua thứ không phải file cục bộ. */
function pathOfUri(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('file://')) return null;
  try {
    return decodeURIComponent(new URL(uri).pathname) || null;
  } catch {
    return null;
  }
}

/** Bóc sổ mục lục. Tách khỏi I/O để test được bằng một buffer dựng tay. */
export function parseSummaries(buf, now = Date.now()) {
  let root;
  try {
    root = decode(buf);
  } catch {
    return { ok: false, reason: 'broken' };
  }

  const rows = [];
  for (const entry of all(root, 1)) {
    if (!Buffer.isBuffer(entry)) continue;
    const e = decode(entry);
    const id = str(e, 1);
    if (!id) continue;
    const s = sub(e, 2);
    const updatedAt = timestampMs(s, 3);
    rows.push({
      id,
      title: str(s, 1) || null,
      steps: int(s, 2) ?? null,
      cwd: pathOfUri(str(sub(s, 9), 1)),
      createdAt: timestampMs(s, 7),
      updatedAt,
    });
  }

  // Sổ đọc được nhưng không ra bản ghi nào = hình dạng đã đổi. Khác hẳn "chưa dùng
  // Antigravity bao giờ" (lúc đó file không tồn tại), nên phải nói khác đi.
  if (!rows.length) return { ok: false, reason: buf.length ? 'shape' : 'empty' };
  return { ok: true, rows, at: now };
}

/** mtime của từng file hội thoại — nguồn "sống chết" không phụ thuộc schema. */
async function touchTimes() {
  const times = new Map();
  let names;
  try {
    names = await fs.readdir(ANTIGRAVITY_CONVOS);
  } catch {
    return times;
  }
  await Promise.all(
    names
      .filter((n) => n.endsWith('.db'))
      .map(async (n) => {
        try {
          const st = await fs.stat(path.join(ANTIGRAVITY_CONVOS, n));
          times.set(n.slice(0, -3), { at: st.mtimeMs, bytes: st.size });
        } catch {
          /* file vừa bị xoá giữa readdir và stat — bỏ qua, lượt sau sẽ đúng */
        }
      }),
  );
  return times;
}

/** Khỏi đọc lại 100KB protobuf mỗi 30 giây khi sổ không đổi. */
let cache = null;

export async function collectAntigravity({ now = Date.now(), running = false } = {}) {
  let st;
  try {
    st = await fs.stat(ANTIGRAVITY_SUMMARIES);
  } catch {
    // Không có file = chưa cài, hoặc cài rồi mà chưa mở hội thoại nào. Cả hai đều là
    // "không có gì để kể", không phải hỏng.
    return { ok: false, reason: 'missing', running, convos: [] };
  }

  const key = `${st.mtimeMs}:${st.size}`;
  let parsed = cache?.key === key ? cache.parsed : null;
  if (!parsed) {
    try {
      parsed = parseSummaries(await fs.readFile(ANTIGRAVITY_SUMMARIES), now);
    } catch (err) {
      return { ok: false, reason: 'broken', error: err.message, running, convos: [] };
    }
    cache = { key, parsed };
  }
  if (!parsed.ok) return { ...parsed, running, convos: [] };

  const times = await touchTimes();
  const floor = now - CONVO_KEEP_DAYS * 86400_000;

  const convos = parsed.rows
    .map((r) => {
      const touch = times.get(r.id);
      // mtime thắng mốc trong sổ: sổ do app tự khai và chỉ được ghi lại lúc app thấy
      // cần, còn mtime là do hệ tệp ghi mỗi lần thật sự có byte chạm đĩa.
      const at = touch?.at ?? r.updatedAt ?? r.createdAt ?? null;
      const idleMs = at == null ? null : Math.max(0, now - at);
      return {
        ...r,
        at,
        idleMs,
        bytes: touch?.bytes ?? 0,
        sleeping: idleMs == null || idleMs > CONVO_IDLE_MS,
        folder: r.cwd ? path.basename(r.cwd) : null,
      };
    })
    .filter((c) => c.at != null && c.at >= floor)
    .sort((a, b) => b.at - a.at);

  return {
    ok: true,
    running,
    at: parsed.at,
    convos,
    /** Tổng số hội thoại trong sổ, kể cả những cái đã quá cũ để hiện — để nói ra chỗ đã cắt. */
    total: parsed.rows.length,
    keepDays: CONVO_KEEP_DAYS,
  };
}
