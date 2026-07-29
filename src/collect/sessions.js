import fs from 'node:fs/promises';
import path from 'node:path';
import { SESSIONS_DIR, TRANSCRIPTS_DIR, SESSION_IDLE_MS } from '../config.js';
import { mapLimit } from '../lib/sh.js';
import { readTodos } from './tasks.js';
import { collectCcdIndex } from './ccd.js';
import { hostOf, processTable } from './procs.js';

/**
 * `procStart` trong file phiên được ghi theo **UTC**, còn `ps lstart` in theo giờ
 * **địa phương**. So sánh chuỗi trực tiếp thì không phiên nào khớp; phải ép chuỗi
 * về UTC rồi so bằng epoch. Đo trên máy này: lệch đúng 7 tiếng (UTC+7).
 */
export function parseProcStartUtc(s) {
  const t = Date.parse(`${String(s || '').trim()} UTC`);
  return Number.isNaN(t) ? null : t;
}

/** Cách Claude Code mã hoá cwd thành tên thư mục transcript: mọi ký tự không phải chữ/số → `-`. */
export function encodeCwd(cwd) {
  return String(cwd).replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * Nhớ tiêu đề đã đọc, khoá theo (đường dẫn, mtime, kích thước). Có mấy chục phiên
 * và ta quét lại mỗi 30 giây; không có cache thì mỗi lượt đọc lại hàng chục MB
 * transcript chỉ để lấy vài chuỗi hiếm khi đổi.
 */
const titleCache = new Map();

/**
 * Lấy tên phiên do người dùng đặt (`customTitle`) hoặc Claude tự đặt (`aiTitle`).
 * Transcript có thể tới vài MB nên chỉ đọc phần đuôi — bản ghi tiêu đề được lặp
 * lại nhiều lần trong file, lần xuất hiện cuối là tên hiện hành.
 */
async function readTranscriptTitle(file, size, mtime) {
  const key = `${file}:${mtime}:${size}`;
  if (titleCache.has(key)) return titleCache.get(key);

  const title = await readTitleFromDisk(file, size);
  // Giữ cache nhỏ: transcript cũ không còn được hỏi tới nữa.
  if (titleCache.size > 400) titleCache.clear();
  titleCache.set(key, title);
  return title;
}

async function readTitleFromDisk(file, size) {
  const TAIL = 512 * 1024;
  let fh;
  try {
    fh = await fs.open(file, 'r');
    const start = Math.max(0, size - TAIL);
    const buf = Buffer.alloc(Math.min(TAIL, size));
    await fh.read(buf, 0, buf.length, start);
    let chunk = buf.toString('utf8');
    let hit = lastTitleIn(chunk);
    if (!hit && start > 0) {
      // Tiêu đề chỉ được ghi ở đầu phiên → đọc thêm phần đầu.
      const head = Buffer.alloc(Math.min(TAIL, size));
      await fh.read(head, 0, head.length, 0);
      hit = lastTitleIn(head.toString('utf8'));
    }
    return hit;
  } catch {
    return null;
  } finally {
    await fh?.close();
  }
}

function lastTitleIn(text) {
  let custom = null;
  let ai = null;
  for (const m of text.matchAll(/"customTitle"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) custom = m[1];
  for (const m of text.matchAll(/"aiTitle"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) ai = m[1];
  const pick = custom || ai;
  if (!pick) return null;
  try {
    return JSON.parse(`"${pick}"`);
  } catch {
    return pick;
  }
}

/** Hoạt động cuối = mtime của transcript. Rẻ hơn nhiều so với parse cả file JSONL. */
async function transcriptInfo(cwd, sessionId) {
  const dir = path.join(TRANSCRIPTS_DIR, encodeCwd(cwd));
  const file = path.join(dir, `${sessionId}.jsonl`);
  try {
    const st = await fs.stat(file);
    return { file, lastActivityAt: st.mtimeMs, size: st.size };
  } catch {
    return null;
  }
}

export async function collectSessions() {
  let files = [];
  try {
    files = (await fs.readdir(SESSIONS_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    return { sessions: [], ghosts: 0 };
  }

  // Hai lượt quét độc lập nhau: bảng tiến trình đọc `ps`, bảng id archive đọc sổ
  // của desktop. Nối đuôi thì cộng thẳng độ trễ vào mỗi lần làm mới 30 giây.
  const [procs, ccdIndex] = await Promise.all([processTable(), collectCcdIndex()]);
  const now = Date.now();
  let ghosts = 0;

  // Mỗi phiên là 3–4 lượt đi đĩa độc lập (stat transcript, đọc đuôi lấy tên, đọc thư
  // mục todo). Làm tuần tự thì 39 phiên = 39 lần ngồi chờ nối đuôi nhau; đo được
  // 556–868ms mà gần như toàn bộ là chờ. Chúng không phụ thuộc nhau nên chạy song song.
  const built = await mapLimit(files, 8, async (f) => {
    let raw;
    try {
      raw = JSON.parse(await fs.readFile(path.join(SESSIONS_DIR, f), 'utf8'));
    } catch {
      return null;
    }
    const wantStart = parseProcStartUtc(raw.procStart);
    const gotStart = procs.start.get(raw.pid);
    // Cho phép lệch 2 giây: `ps` làm tròn tới giây, file ghi lúc tiến trình đã chạy.
    const alive = gotStart != null && wantStart != null && Math.abs(gotStart - wantStart) <= 2000;

    if (!alive) {
      ghosts++;
      return null;
    }

    const tr = await transcriptInfo(raw.cwd, raw.sessionId);
    const [title, todos] = await Promise.all([
      tr ? readTranscriptTitle(tr.file, tr.size, tr.lastActivityAt) : null,
      readTodos(raw.sessionId),
    ]);
    const lastActivityAt = tr?.lastActivityAt ?? raw.updatedAt ?? raw.startedAt ?? null;
    const idleMs = lastActivityAt ? now - lastActivityAt : null;

    return {
      id: raw.sessionId,
      short: String(raw.sessionId).slice(0, 8),
      pid: raw.pid,
      /** Tên gợi nhớ (user đặt hoặc Claude đặt) — thứ panel/extension tìm kiếm theo. */
      title: title || null,
      /** Tên suy ra từ thư mục, luôn có. */
      name: raw.name || null,
      cwd: raw.cwd,
      folder: path.basename(raw.cwd || ''),
      entrypoint: raw.entrypoint || 'unknown',
      /**
       * App CHỦ, suy từ cây tiến trình — thứ `entrypoint` không nói được.
       *
       * Hai trường này trả lời hai câu khác nhau và cả hai đều đúng: `entrypoint` là
       * Claude Code tự khai mình được gọi kiểu nào (`cli`, `claude-vscode`…), còn
       * `host` là cái cửa sổ mà người dùng đang thật sự nhìn. Cặp `cli` + `claude-desktop`
       * nghĩa là terminal tích hợp trong Claude Desktop; `claude-vscode` + `cursor`
       * nghĩa là Cursor chứ không phải VS Code. Không có `host` thì cả hai ca đó đều
       * biến mất.
       */
      host: hostOf(raw.pid, procs),
      kind: raw.kind || 'interactive',
      version: raw.version || null,
      status: raw.status || null,
      startedAt: raw.startedAt ?? null,
      lastActivityAt,
      idleMs,
      sleeping: idleMs != null && idleMs > SESSION_IDLE_MS,
      transcriptBytes: tr?.size ?? 0,
      todos,
      resumeCmd: `claude --resume ${raw.sessionId}`,
      /**
       * Id mà lệnh archive nhận. `null` khi phiên không do desktop mở (VS Code,
       * terminal) — chỗ đó không có gì để archive. Câu prompt dựng ở CLIENT chứ
       * không dựng ở đây: server bày một `state` chung cho mọi client nên không
       * biết client đang xem tiếng Việt hay tiếng Anh.
       */
      ccdId: ccdIndex.get(raw.sessionId) ?? null,
    };
  });

  const sessions = built.filter(Boolean);
  sessions.sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));

  // App chủ chỉ đọc được khi tiến trình còn sống. Đưa ra ngoài để `state.js` chốt vào
  // sổ — đó là đường duy nhất để quy token của phiên này về đúng editor sau khi nó tắt.
  const hosts = new Map();
  for (const x of sessions) if (x.host) hosts.set(x.id, x.host);

  return { sessions, ghosts, hosts, procs };
}
