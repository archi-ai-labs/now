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

/* ── Lượt gõ cuối cùng của NGƯỜI ───────────────────────────────────────────────

   ## Vì sao cần con số này bên cạnh mtime

   `lastActivityAt` (mtime) trả lời "Claude Code vừa GHI gì đó lúc nào", và trong một lượt
   chạy dài thì nó chính là nhịp gõ của **máy**: mỗi khối trả lời, mỗi kết quả công cụ đều
   là một lượt ghi. Đúng cái quãng ấy lại là quãng người ta RẢNH NHẤT để đứng dậy — máy
   đang làm việc, không ai phải ngồi nhìn. Lấy mtime làm bằng chứng cho quãng nghỉ khai
   trước (xem `resolveBreak` trong `src/pet.js`) là kết luận ngược hẳn sự thật: càng đúng
   lúc rời ghế được thì càng chắc chắn bị từ chối. Đó là lỗi người dùng báo 5/8.

   `humanAt` trả lời câu khác hẳn: **bạn** vừa gõ lúc nào.

   ## Nhận ra một lượt của người

   `type: "user"` KHÔNG đủ, và đây là chỗ dễ sai nhất: kết quả công cụ cũng ghi vào
   transcript dưới vai `user`. Đo trên máy này, một phiên có 2664 dòng `user` mà chỉ 81
   dòng là người thật gõ — lấy nhầm thì `humanAt` bằng đúng mtime và cả phép sửa này thành
   vô nghĩa. Ba dấu hiệu loại chúng ra: có `toolUseResult` (kết quả công cụ), có
   `isSidechain: true` (câu gửi cho một agent con), và thiếu `userType: "external"`.

   ## Vì sao đọc CHỒNG DẦN chứ không đọc đuôi

   Đọc một khúc đuôi cố định là cách hiển nhiên, và nó hỏng đúng ở ca cần nó nhất. Đo trên
   máy này: sau hai mươi phút gọi công cụ liên tục, lượt gõ cuối của người nằm cách cuối
   file **1,3MB** — ngoài tầm một khúc đuôi 512KB. Mà một phiên bận là phiên duy nhất câu
   hỏi này có nghĩa, nên "đuôi cố định" nghĩa là câm đúng lúc phải nói.

   Nới khúc đuôi lên vài MB thì đọc lại ngần ấy byte mỗi 30 giây cho mỗi phiên. Transcript
   chỉ NỐI THÊM, nên có cách rẻ hơn hẳn: nhớ đã đọc tới byte nào, lượt sau chỉ đọc phần
   mới. Một lượt quét khi ấy tốn đúng số byte vừa sinh ra, và `humanAt` không bao giờ cũ đi
   — nó chỉ được cập nhật khi có lượt mới của người.

   Mốc `scanned` luôn dừng ở một RANH GIỚI DÒNG, không dừng ở `size`: lượt ghi có thể bắt
   gặp giữa chừng một dòng, và bắt đầu lượt sau từ giữa dòng ấy là bỏ sót trọn một bản ghi.
*/

/** `file → { at, scanned }`. `at` là lượt gõ cuối đã thấy (null nếu chưa thấy lần nào),
 *  `scanned` là byte đã đọc tới, luôn rơi đúng sau một dấu xuống dòng. */
const humanSeen = new Map();

/** Lần đầu gặp một phiên thì đọc lùi ngần này. Bốn MB — gấp ba khoảng cách đo được ở ca
 *  bận nhất trên máy này, và chỉ trả một lần cho mỗi phiên; từ lượt sau là đọc phần mới. */
const HUMAN_SEED = 4 * 1024 * 1024;

async function humanTurnAt(file, size) {
  const prev = humanSeen.get(file);
  // File nhỏ đi = phiên khác trùng đường dẫn, hoặc transcript bị viết lại. Gieo lại từ đầu
  // chứ không đọc một khoảng âm.
  const fresh = !prev || size < prev.scanned;
  const from = fresh ? Math.max(0, size - HUMAN_SEED) : prev.scanned;
  if (size <= from) return prev?.at ?? null;

  let fh;
  try {
    fh = await fs.open(file, 'r');
    const buf = Buffer.alloc(size - from);
    const { bytesRead } = await fh.read(buf, 0, buf.length, from);
    const text = buf.toString('utf8', 0, bytesRead);
    // Chỉ nhận phần tới dấu xuống dòng CUỐI: phần sau nó là một dòng đang viết dở.
    const cut = text.lastIndexOf('\n');
    const at = lastHumanIn(cut < 0 ? '' : text.slice(0, cut));
    const seen = { at: at ?? prev?.at ?? null, scanned: cut < 0 ? from : from + Buffer.byteLength(text.slice(0, cut + 1)) };
    if (humanSeen.size > 400) humanSeen.clear();
    humanSeen.set(file, seen);
    return seen.at;
  } catch {
    return prev?.at ?? null;
  } finally {
    await fh?.close();
  }
}

/**
 * Lúc NGƯỜI gõ câu cuối cùng trong đoạn transcript này — `null` khi không có câu nào.
 *
 * Đọc bằng chuỗi con chứ không `JSON.parse` từng dòng: mỗi dòng là một bản ghi có thể tới
 * vài chục KB, và ta chỉ cần một dấu thời gian. Xuất ra để bài test gọi thẳng — nó là
 * toàn bộ phần có luật trong khối này.
 */
export function lastHumanIn(text) {
  let last = null;
  for (const line of text.split('\n')) {
    if (!line.includes('"type":"user"')) continue;
    if (line.includes('"toolUseResult"') || line.includes('"isSidechain":true')) continue;
    if (!line.includes('"userType":"external"')) continue;
    const m = /"timestamp":"([^"]+)"/.exec(line);
    const at = m ? Date.parse(m[1]) : NaN;
    if (!Number.isNaN(at) && (last == null || at > last)) last = at;
  }
  return last;
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
    const [title, humanAt, todos] = await Promise.all([
      tr ? readTranscriptTitle(tr.file, tr.size, tr.lastActivityAt) : null,
      tr ? humanTurnAt(tr.file, tr.size) : null,
      readTodos(raw.sessionId),
    ]);
    const lastActivityAt = tr?.lastActivityAt ?? raw.updatedAt ?? raw.startedAt ?? null;
    const idleMs = lastActivityAt ? now - lastActivityAt : null;
    // Kẹp về 0: dấu thời gian trong transcript do một máy khác ghi cũng được, nhưng một
    // con số ÂM thì mọi phép so ở phía dùng đều đọc thành "vừa gõ xong".
    const humanIdleMs = humanAt ? Math.max(0, now - humanAt) : null;

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
      /**
       * Lúc NGƯỜI gõ câu cuối, và khoảng lặng tính từ đó — hai trường KHÁC hẳn cặp
       * `lastActivityAt`/`idleMs` ngay trên, dù nghe như đồng nghĩa.
       *
       * Cặp trên đo cái MÁY (mtime transcript: mọi khối trả lời, mọi kết quả công cụ);
       * cặp này đo cái NGƯỜI. Trong một lượt chạy dài chúng lệch nhau hàng chục phút, và
       * đúng khoảng lệch ấy là lúc người ta rảnh để đứng dậy. `null` khi đuôi transcript
       * không có lượt nào của người — nghĩa là "không biết", không phải "vừa xong".
       */
      humanAt,
      humanIdleMs,
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
