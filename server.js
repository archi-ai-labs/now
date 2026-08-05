#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { PORT, SESSIONS_DIR, TASKS_DIR } from './src/config.js';
import { buildState } from './src/state.js';
import { badgeOf } from './src/badge.js';
import {
  accrue, buy, cancelBreak, emptyLedger, observeRest, petView, readLedger, resolveBreak,
  startBreak, wear, writeLedger, ITEMS, MOVES, SLOTS,
} from './src/pet.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  // Trình duyệt bỏ qua manifest nếu content-type không phải kiểu này — thiếu dòng đây
  // thì icon và tên của web app trên Dock lặng lẽ về mặc định, không báo lỗi gì.
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

// ── Trạng thái + phát tán ────────────────────────────────────────────────────

let cache = null;
let building = null;
const clients = new Set();

/** Quá tuổi này thì bản trong tay coi như cũ, phải dựng lượt mới. */
const STALE_MS = 1500;

/**
 * Gộp mọi yêu cầu dựng trạng thái đang chạy — nhiều sự kiện fs không được phép spawn
 * nhiều lượt git.
 *
 * `watched` mặc định theo số tab đang mở, vì nhịp quét nền và watcher đều chạy tiếp
 * kể cả khi đã đóng hết tab. Chỉ hạn mức đọc tới cờ này — nó là thứ duy nhất gọi ra
 * ngoài, và gọi cho không ai đọc thì vừa phí vừa ăn rate limit vô ích.
 */
function getState({ force = false, watched = clients.size > 0, badge = false } = {}) {
  if (building) return building;
  if (!force && cache && Date.now() - cache.generatedAt < STALE_MS) return Promise.resolve(cache);
  building = buildState({ watched, badge })
    .then((s) => {
      cache = s;
      return s;
    })
    .finally(() => {
      building = null;
    });
  return building;
}

/**
 * Bản đang có trong tay, TRẢ NGAY, không chờ lượt dựng nào. `null` khi chưa từng dựng.
 *
 * Có cửa này vì `getState` đo đúng một thứ — bản trong tay còn dùng được không — rồi
 * dùng câu trả lời ấy cho cả hai việc: có dựng lại không, VÀ có bắt người hỏi chờ không.
 * Hai việc đó không đi cùng nhau.
 *
 * Popover trên thanh menu là chỗ lộ ra rõ nhất. Nó mở dăm bảy lần một ngày, cách nhau
 * hàng phút, nên lượt hỏi của nó gần như LUÔN trượt cache 1,5 giây — mà một lượt
 * `buildState` là 325–1614 ms (đo 6 lần, 3/8). Suốt quãng ấy trong popover chỉ có đúng
 * chữ "đang đọc…", lần nào cũng vậy, vì trang tải lại mỗi lần mở.
 *
 * Nên tách ra: đưa bản cũ lên màn hình trước, dựng bản mới phía sau. Bản cũ nhiều nhất
 * là 30 giây tuổi (nhịp badge của app Swift) — với board và phiên thì đó là cùng một
 * tin, còn hạn mức thì lượt dựng nền sẽ đè lên sau vài trăm mili giây. Người hỏi biết
 * mình đang cầm bản cũ qua header `x-now-building`, và hỏi lại bằng `?wait=1` để lấy
 * bản mới ngay khi nó xong.
 *
 * Lượt dựng nền có `broadcast`: nó đã tốn công quét rồi, tab đang mở không có lý do gì
 * phải đợi thêm một nhịp nữa mới thấy.
 */
function peekState({ watched = clients.size > 0 } = {}) {
  if (!cache) return null;
  if (!building && Date.now() - cache.generatedAt >= STALE_MS) {
    getState({ force: true, watched })
      .then(broadcast)
      .catch((err) => console.error('[now-dash] dựng nền lỗi:', err.message));
  }
  return cache;
}

function broadcast(state) {
  const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

let pending = null;
let firstEventAt = 0;

/**
 * Gom sự kiện dồn dập (một lượt ghi NOW.json sinh nhiều event) thành một lượt dựng.
 *
 * Có TRẦN CHỜ: debounce thuần thì một chuỗi sự kiện cách nhau dưới 500ms đẩy lùi lượt
 * dựng vô hạn — `npm install` trong một repo đang theo dõi, hay `/now update` ghi liền
 * `NOW.json` rồi `NOW.md`, đều dồn đúng kiểu đó và trang đứng im không rõ lý do.
 */
const MAX_WAIT = 3000;
function scheduleRefresh(delay = 500) {
  const now = Date.now();
  if (!pending) firstEventAt = now;
  clearTimeout(pending);
  const wait = Math.min(delay, Math.max(0, firstEventAt + MAX_WAIT - now));
  pending = setTimeout(async () => {
    pending = null;
    try {
      broadcast(await getState({ force: true }));
    } catch (err) {
      console.error('[now-dash] dựng trạng thái lỗi:', err.message);
    }
  }, wait);
}

// ── Theo dõi thay đổi ────────────────────────────────────────────────────────

const watchers = [];
function watch(dir, opts = {}) {
  try {
    const w = fs.watch(dir, { persistent: false, ...opts }, () => scheduleRefresh());
    w.on('error', () => {});
    watchers.push(w);
    return true;
  } catch {
    return false;
  }
}

async function installWatchers(state) {
  for (const w of watchers.splice(0)) w.close();
  watch(SESSIONS_DIR);
  watch(TASKS_DIR, { recursive: true });
  // Theo dõi thư mục gốc từng dự án để bắt lượt ghi NOW.json / NOW.md.
  for (const p of state.projects) watch(p.path);
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

function json(res, code, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    ...headers,
  });
  res.end(text);
}

async function serveStatic(req, res, urlPath) {
  let rel;
  if (urlPath === '/') {
    rel = 'index.html';
  } else {
    try {
      rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
    } catch {
      // `decodeURIComponent` ném URIError với đường dẫn hỏng (`/%`). Trước đây lỗi này
      // đi thẳng ra handler async không ai bắt và GIẾT cả tiến trình — một URL sai là
      // mất dashboard.
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('đường dẫn hỏng');
      return;
    }
  }
  const file = path.join(PUBLIC, rel);
  // Chặn thoát khỏi thư mục public.
  if (!file.startsWith(PUBLIC + path.sep) && file !== path.join(PUBLIC, 'index.html')) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const data = await fsp.readFile(file);
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      // `no-store` chứ không phải `no-cache`: trình duyệt vẫn giữ ES module đã tải
      // với `no-cache`, khiến sửa giao diện xong phải nạp cứng mới thấy.
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('không tìm thấy');
  }
}

/** Đọc NOW.md của một dự án để xem ngay trong dashboard, không phải mở editor. */
async function serveNowMd(res, projectId) {
  const state = await getState();
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return json(res, 404, { error: 'không có dự án này' });
  try {
    const md = await fsp.readFile(path.join(p.path, 'NOW.md'), 'utf8');
    return json(res, 200, { project: p.name, markdown: md });
  } catch (err) {
    return json(res, 404, { error: `chưa có NOW.md (${err.code})` });
  }
}

/**
 * Mở thư mục dự án bằng ứng dụng mặc định của macOS. Chỉ nhận đường dẫn đã có
 * trong trạng thái hiện tại — không bao giờ mở đường dẫn tuỳ ý từ client.
 */
/**
 * App được phép mở thư mục, và tên bundle tương ứng.
 *
 * Danh sách CỐ ĐỊNH, không phải thứ client gửi lên. `open -a <tên>` là một lời gọi vào
 * hệ điều hành: nhận tên tự do từ trình duyệt thì trang web bất kỳ trong máy cũng khởi
 * chạy được ứng dụng tuỳ ý qua localhost. Khoá cứng ở đây thì cái xấu nhất một client
 * làm được là mở một trong bốn app này lên một thư mục mà chính dashboard đã bày ra.
 */
const OPENERS = {
  cursor: 'Cursor',
  antigravity: 'Antigravity',
  vscode: 'Visual Studio Code',
  windsurf: 'Windsurf',
};

/**
 * Đọc hoặc đặt công tắc icon thanh menu. `on === null` là chỉ hỏi.
 *
 * Toàn bộ hiểu biết về launchd, plist và tiến trình nằm trong `bin/now-menu` — ở đây chỉ
 * dịch một bit thành một trong ba chữ `on`/`off`/`status`. Không có nhánh nào nối chuỗi
 * từ client vào dòng lệnh, và `execFile` (không phải `exec`) nên cũng không có shell để
 * mà chen vào.
 *
 * Vì sao endpoint này tồn tại, khi menu chuột phải đã có ô bật/tắt: khi icon đã tắt thì
 * cái menu ấy không còn để mà bấm. Server chạy độc lập với icon, nên đây là bề mặt duy
 * nhất LUÔN với tới được — không có nó thì "tắt" vẫn là cửa một chiều, chỉ khác là lần
 * này có nhãn tử tế.
 */
function menubar(res, on) {
  if (process.platform !== 'darwin') {
    return json(res, 501, { error: 'chỉ có trên macOS' });
  }
  const arg = on === null ? 'status' : on ? 'on' : 'off';
  execFile(path.join(ROOT, 'bin', 'now-menu'), [arg], (err, stdout, stderr) => {
    // Từ đầu tiên là thứ máy đọc; phần trong ngoặc (nếu có) là lúc hai sự thật lệch
    // nhau — xem phần `status` trong bin/now-menu.
    const word = String(stdout).trim().split(/\s+/)[0];
    if (word !== 'on' && word !== 'off') {
      return json(res, 500, { error: String(stderr).trim() || err?.message || 'không đọc được trạng thái' });
    }
    return json(res, 200, { ok: true, on: word === 'on', note: String(stdout).trim() });
  });
}

/* ── Quản gia nuôi được ───────────────────────────────────────────────────────
   Endpoint RIÊNG, không nhét vào `/api/state`. Lý do là cái cache 30 giây ngay trên:
   mua xong mà ví vẫn hiện số cũ tới nửa phút thì cú bấm trông như trượt, và người ta
   bấm lần hai. Sổ này bé (≈1KB) nên một lượt hỏi riêng rẻ hơn hẳn việc phá cache của
   một payload 300KB. */

/**
 * Ngày ĐỊA PHƯƠNG hôm nay, cùng dạng khoá với `series` của sổ token.
 *
 * Phải trùng cách `collect/usage.js` cắt ngày (`localDay`), nếu không thì máy ở UTC+7
 * sẽ cộng tiền của "hôm nay" vào một khoá không ngày nào có, và ví đứng yên.
 */
function todayLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Nối đuôi mọi lượt đọc-sửa-ghi sổ.
 *
 * Hai cú bấm mua gần nhau đi qua hai request song song; cả hai đọc ví 100 xu, cả hai
 * trừ 70, và người mua được hai cái mũ bằng tiền một cái. Sổ này quá bé để đáng một cơ
 * chế khoá tử tế — một hàng đợi promise là đủ, vì mọi đường vào sổ đều đi qua đây.
 */
let petQueue = Promise.resolve();
const petLock = (fn) => (petQueue = petQueue.then(fn, fn));

/**
 * Đọc sổ, cộng phần tiền chưa cộng, rồi (tuỳ chọn) làm một việc lên nó.
 *
 * Cộng tiền chạy ở MỌI lượt kể cả lượt chỉ đọc: nguồn tiền là sổ token, mà sổ token thì
 * cập nhật theo lượt quét chứ không theo cú bấm. Không cộng lúc đọc thì ví chỉ nhúc nhích
 * khi người ta mua gì đó — đúng lúc họ đang thiếu tiền.
 */
async function withPet(action) {
  const state = await getState({ watched: false });
  const series = state.usage?.ok ? (state.usage.series ?? []) : [];
  const today = todayLocal();

  let ledger = await readLedger();
  const fresh = !ledger;
  // `emptyLedger` rồi `accrue` NGAY, không phải một trong hai. Sổ mới đánh dấu mọi ngày
  // cũ là đã cộng và để hôm nay ở 0; chính lượt `accrue` liền sau mới biến hôm nay thành
  // xu. Tách hai nhánh loại trừ nhau thì lần mở đầu tiên ví rỗng dù hôm nay đã tiêu $50,
  // và nó chỉ tự đúng ở lượt hỏi sau — một cái ví sai trong đúng lần người ta nhìn kỹ nhất.
  if (fresh) ledger = emptyLedger(series, today);
  // Sổ token lỗi thì `series` rỗng và `accrue` không cộng gì — đúng như vậy. Đoán bừa
  // một khoản tiền lúc không đọc được hoá đơn là kiểu bịa mà cả file `pet.js` tránh.
  if (series.length) ledger = accrue(ledger, series, today);

  // Quãng nghỉ, cùng lý lẽ với phép cộng tiền ngay trên: nó là thứ quan sát được theo
  // LƯỢT QUÉT chứ không theo cú bấm, nên nó phải chạy ở mọi lượt đọc sổ.
  //
  // Nhưng khác phép cộng tiền ở chỗ ghi đĩa: `accrue` dựng lại được từ `credited` cộng
  // `series` nên bỏ qua một lượt ghi không mất gì, còn `restedAt` thì không có nguồn nào
  // dựng lại — không ghi là mất. Vì thế nó có cờ riêng chứ không đi nhờ phép so
  // `out.ledger !== ledger` bên dưới (phép ấy so với sổ SAU khi đã quan sát, nên một lượt
  // chỉ đọc sẽ luôn ra "không đổi" và mốc nghỉ chẳng bao giờ xuống đĩa).
  const beforeRest = ledger;
  const idle = idleOf(state);
  // Chốt quãng nghỉ TRƯỚC khi quan sát khoảng lặng. Hai thứ này cùng viết vào `restedAt`,
  // và nếu đảo thứ tự thì một quãng nghỉ 5 phút vừa đạt sẽ bị `observeRest` ghi đè bằng
  // đúng cái mốc nó vừa đặt — vô hại hôm nay, nhưng nó làm thứ tự thành một chi tiết ngầm
  // mà lần sửa sau sẽ đạp phải. Chốt trước thì `observeRest` chỉ còn việc bám theo, đúng
  // vai của nó.
  // Hai phép này nhận HAI con số khác nhau, và đó là chỗ sửa chính của lượt 5/8.
  //
  // `observeRest` là phép quan sát THỤ ĐỘNG — nó tặng lại tập trung mà không ai khai gì
  // — nên nó phải dè dặt: hễ Claude Code còn có lượt thì coi như bạn đang ngồi. `idle`
  // đúng vai ấy.
  //
  // `resolveBreak` chốt một quãng bạn ĐÃ KHAI và đã trả bằng một phút chờ, nên nó được
  // hỏi một câu hẹp hơn và đúng hơn: nãy giờ BẠN có gõ gì không. Xem `awayOf`.
  ledger = resolveBreak(ledger, awayOf(state), Date.now());
  ledger = observeRest(ledger, idle, Date.now());
  const rested = ledger !== beforeRest;

  const out = action ? action(ledger) : { ledger, error: null };
  if (out.ledger !== ledger || fresh || rested) await writeLedger(out.ledger);
  return { view: petView(out.ledger), error: out.error ?? null };
}

/**
 * Khoảng lặng của phiên Claude Code hoạt động gần nhất — `null` khi không có phiên nào.
 *
 * Lấy MIN chứ không phải max hay trung bình: câu hỏi là "bạn có đang làm gì không", nên
 * một phiên vừa có lượt cách đây 30 giây đã đủ trả lời, kể cả khi năm phiên khác ngủ từ
 * sáng. Lấy max thì mở sẵn một tab cũ là tập trung không bao giờ cạn.
 */
function idleOf(state) {
  const live = (state.sessions ?? []).map((s) => s.idleMs).filter((n) => Number.isFinite(n));
  return live.length ? Math.min(...live) : null;
}

/**
 * Bạn rời bàn phím bao lâu rồi — con số dùng để CHỐT một quãng nghỉ đã khai.
 *
 * ## Vì sao không dùng lại `idleOf`
 *
 * `idleOf` đo khoảng lặng của Claude Code, tức là **mtime transcript**, tức là lượt ghi
 * cuối cùng của cái MÁY. Trong một lượt chạy dài — agent, build, một chuỗi công cụ —
 * máy ghi liên tục, nên `idleOf` đứng quanh 0 suốt. Mà đúng cái quãng ấy là quãng người
 * ta rảnh nhất để đứng dậy: máy đang làm việc, không ai phải ngồi nhìn.
 *
 * Hệ quả đo được, và nó chính là lỗi người dùng báo 5/8: bấm "đi dạo", đi thật một phút,
 * quay lại thì quãng nghỉ bị huỷ — vì trong phút ấy Claude vẫn đang gõ. Càng làm đúng
 * càng chắc chắn trượt.
 *
 * ## Con số này đo gì
 *
 * `humanIdleMs` (xem `lastHumanIn` trong `collect/sessions.js`) là khoảng lặng tính từ
 * lượt gõ cuối của NGƯỜI, lọc sạch kết quả công cụ và lượt của agent con. Lấy MIN qua
 * các phiên, cùng lý lẽ với `idleOf`: một phiên vừa nhận câu hỏi cách đây 20 giây đã đủ
 * nói bạn đang ở bàn.
 *
 * Chỗ rơi về phải tính TỪNG PHIÊN, không tính cho cả đám — và đây là một cái bẫy đã sập
 * một lần trong lượt này. Cách hiển nhiên là "lấy min của mọi `humanIdleMs` đọc được, đọc
 * không được thì rơi về `idleOf`", nhưng nó bỏ RA NGOÀI đúng cái phiên không đọc được. Đo
 * trên máy này: phiên đang chạy trả `null` (transcript 89MB, chưa gieo xong), ba phiên ngủ
 * quên trả 730 giây — min ra 730 giây, tức mọi quãng nghỉ đều đạt, dựa trên một phiên
 * không ai đụng vào từ trưa. Đọc không được một phiên nghĩa là KHÔNG BIẾT phiên ấy, và
 * không biết thì phải giữ nguyên phép cũ cho chính nó.
 *
 * Phép này chỉ NỚI ra chứ không siết vào, và điều đó chứng minh được: một lượt gõ của
 * người cũng là một lượt ghi vào transcript, nên `humanIdleMs >= idleMs` luôn đúng.
 */
function awayOf(state) {
  const live = (state.sessions ?? [])
    .map((s) => (Number.isFinite(s.humanIdleMs) ? s.humanIdleMs : s.idleMs))
    .filter((n) => Number.isFinite(n));
  return live.length ? Math.min(...live) : null;
}

function petHandler(req, res, url) {
  if (req.method === 'GET') {
    return petLock(async () => {
      try {
        const { view } = await withPet(null);
        return json(res, 200, { ok: true, pet: view });
      } catch (err) {
        return json(res, 500, { error: err.message });
      }
    });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'chỉ GET hoặc POST' });

  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 512) req.destroy();
  });
  req.on('end', () =>
    petLock(async () => {
      try {
        const { action, id, on, slot, kind } = JSON.parse(body);
        // Mỗi việc kiểm kiểu ngay tại cửa. Không mã nào trong đám này được dùng để tra một
        // đường dẫn hay dựng một lệnh — chúng chỉ tra vào `ITEMS`, `SLOTS`, `MOVES`, ba
        // bảng ĐÓNG — nên mấy phép kiểm này là toàn bộ hàng rào cần có.
        if (action === 'buy') {
          if (typeof id !== 'string' || !Object.hasOwn(ITEMS, id)) {
            return json(res, 400, { error: 'mã món không hợp lệ' });
          }
          const { view, error } = await withPet((l) => buy(l, id));
          // Thiếu tiền hay đã có rồi là câu trả lời BÌNH THƯỜNG của một cửa hàng, không
          // phải lỗi hệ thống — nên vẫn 200 và vẫn trả ví mới nhất về để màn hình đúng.
          return json(res, 200, { ok: !error, error, pet: view });
        }
        if (action === 'wear') {
          if (typeof slot !== 'string' || !SLOTS.includes(slot)) {
            return json(res, 400, { error: 'chỗ đứng không hợp lệ' });
          }
          // `null` là dọn trống chỗ — một việc thật, không phải một đầu vào thiếu. Nên
          // chỉ `undefined` mới là lỗi, và phép kiểm phải phân biệt được hai thứ đó.
          if (id != null && (typeof id !== 'string' || !Object.hasOwn(ITEMS, id))) {
            return json(res, 400, { error: 'mã món không hợp lệ' });
          }
          const { view, error } = await withPet((l) => wear(l, slot, id ?? null));
          return json(res, 200, { ok: !error, error, pet: view });
        }
        if (action === 'break') {
          if (typeof kind !== 'string' || !Object.hasOwn(MOVES, kind)) {
            return json(res, 400, { error: 'động tác không hợp lệ' });
          }
          const { view, error } = await withPet((l) => startBreak(l, kind));
          return json(res, 200, { ok: !error, error, pet: view });
        }
        if (action === 'breakOff') {
          const { view, error } = await withPet((l) => cancelBreak(l));
          return json(res, 200, { ok: !error, error, pet: view });
        }
        if (action === 'toggle') {
          if (typeof on !== 'boolean') return json(res, 400, { error: 'cần {on: true|false}' });
          const { view } = await withPet((l) => ({ ledger: { ...l, on }, error: null }));
          return json(res, 200, { ok: true, pet: view });
        }
        return json(res, 400, { error: 'action lạ' });
      } catch (err) {
        return json(res, 400, { error: err.message });
      }
    }),
  );
}

async function openPath(res, target, app) {
  const state = await getState();
  const known = new Set([
    ...state.projects.map((p) => p.path),
    ...state.projects.flatMap((p) => (p.git.worktrees ?? []).map((w) => w.path)),
    ...state.orphans.map((o) => o.path),
    // Thư mục do chính dashboard bày ra ở màn Phiên: cửa sổ đang mở của Cursor/VS Code
    // và workspace của hội thoại Antigravity. Bấm được thì phải mở được — bày ra một
    // cái nút rồi trả 400 là tệ hơn không bày.
    ...(state.surfaces ?? []).flatMap((f) => f.folders ?? []),
    ...(state.antigravity?.convos ?? []).map((c) => c.cwd).filter(Boolean),
  ]);
  if (!known.has(target)) return json(res, 400, { error: 'đường dẫn không nằm trong danh sách dự án' });

  const bundle = app ? OPENERS[app] : null;
  if (app && !bundle) return json(res, 400, { error: 'app không nằm trong danh sách cho phép' });
  execFile('open', bundle ? ['-a', bundle, target] : [target], () => {});
  return json(res, 200, { ok: true, opened: target, app: bundle });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');

  // Trả lời tức thì, KHÔNG chờ lượt quét. Dùng để kiểm tra "server đã chạy chưa";
  // hỏi `/api/state` cho việc này sẽ timeout trong lúc quét lần đầu và khiến
  // script khởi động tưởng chưa có server rồi dựng thêm tiến trình thứ hai.
  if (url.pathname === '/api/ping') {
    return json(res, 200, { ok: true, pid: process.pid, ready: Boolean(cache) });
  }

  if (url.pathname === '/api/state') {
    try {
      // Có người hỏi thẳng là có người đang xem, kể cả khi chưa mở kênh SSE nào.
      const force = url.searchParams.has('force');
      // Mặc định là ĐỪNG BẮT CHỜ: trả bản trong tay, dựng bản mới phía sau (xem
      // `peekState`). Hai tham số để chọn kiểu chờ khác:
      //   `?wait=1`   chờ lượt đang dựng — lượt hỏi thứ hai của popover đi cửa này.
      //   `?force=1`  vứt bản trong tay, dựng lượt mới rồi mới trả — nút "làm mới".
      // Chưa từng dựng lượt nào thì `peekState` trả `null` và ai hỏi cũng phải chờ,
      // đúng như vậy: lúc ấy không có gì để đưa lên màn hình cả.
      if (!force && !url.searchParams.has('wait')) {
        const snap = peekState({ watched: true });
        if (snap) return json(res, 200, snap, building ? { 'x-now-building': '1' } : {});
      }
      return json(res, 200, await getState({ force, watched: true }));
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // Nguồn duy nhất cho hai mục trên thanh menu. Chữ và bậc màu đều tính XONG ở đây,
  // app Swift chỉ vẽ lại — xem khối import của `verdictOf` ở đầu file.
  //
  // `badge: true` chứ không phải `watched: false` trơn. Mục trên thanh menu IN RA con số
  // hạn mức Claude, nên nó là một người đọc thật: để nó đi cửa "không ai xem" thì lượt gọi
  // ra endpoint ngủ luôn, và con số nó in ra đứng yên tại lần cuối có tab trình duyệt mở.
  // Đo hôm 3/8: chu kỳ 5 giờ chạy được 103 phút mà sổ chỉ ghi 5 mẫu — mười phút cuối, đúng
  // quãng có tab. Cái chốt ấy sinh ra khi thanh menu chưa tồn tại và bề mặt duy nhất là
  // trình duyệt; nay tiền đề "không tab thì không ai đọc" không còn đúng nữa.
  //
  // Đổi lại: app chạy suốt ngày thì trần là 720 lượt gọi/ngày (TTL 2 phút). Muốn thưa hơn
  // thì nới `QUOTA_TTL_MS` — không phải đóng cửa này, vì đóng lại là quay về số chết.
  if (url.pathname === '/api/badge') {
    try {
      return json(res, 200, badgeOf(await getState({ watched: false, badge: true })));
    } catch (err) {
      return json(res, 500, { ok: false, error: err.message });
    }
  }

  if (url.pathname === '/api/now-md') {
    return serveNowMd(res, url.searchParams.get('project'));
  }

  if (url.pathname === '/api/menubar') {
    if (req.method === 'GET') return menubar(res, null);
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 256) req.destroy();
      });
      req.on('end', () => {
        try {
          const { on } = JSON.parse(body);
          // Đúng một bit đi qua đây, và nó được ép về boolean TRƯỚC khi thành đối số.
          // Cùng lý do đã viết cho `OPENERS` ở trên: `bin/now-menu` là một lời gọi vào
          // hệ điều hành, nên không chuỗi nào từ trình duyệt được phép trở thành đối số
          // của nó. Kiểu sai thì từ chối, đừng đoán — `{on:"off"}` mà đoán thành true là
          // đúng kiểu lỗi không ai phát hiện ra.
          if (typeof on !== 'boolean') return json(res, 400, { error: 'cần {on: true|false}' });
          return menubar(res, on);
        } catch (err) {
          return json(res, 400, { error: err.message });
        }
      });
      return;
    }
    return json(res, 405, { error: 'chỉ GET hoặc POST' });
  }

  if (url.pathname === '/api/pet') {
    return petHandler(req, res, url);
  }

  if (url.pathname === '/api/open' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', async () => {
      try {
        const req2 = JSON.parse(body);
        await openPath(res, req2.path, req2.app);
      } catch (err) {
        json(res, 400, { error: err.message });
      }
    });
    return;
  }

  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    const wasIdle = clients.size === 0;
    clients.add(res);
    try {
      res.write(`event: state\ndata: ${JSON.stringify(await getState())}\n\n`);
    } catch {
      /* client đóng ngay lập tức */
    }
    // Người đầu tiên quay lại sau một quãng vắng: trạng thái trong cache được dựng lúc
    // không ai xem, nên hạn mức trong đó là ảnh cũ. Đẩy một lượt dựng lại để họ không
    // phải ngồi nhìn số cũ tới hết nhịp 30 giây. Chỉ làm cho tab ĐẦU TIÊN — mở mười
    // tab không có nghĩa là quét mười lần.
    if (wasIdle) scheduleRefresh(0);
    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        /* dọn ở sự kiện close */
      }
    }, 25000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
  }

  return serveStatic(req, res, url.pathname);
}

/**
 * Mọi đường lỗi của handler đi ra đúng cửa này.
 *
 * `http.createServer(async …)` trả về một promise KHÔNG ai giữ: một lần ném bên trong
 * là `unhandledRejection`, và Node ≥ 15 mặc định cho thoát tiến trình. Dashboard chết
 * vì một request hỏng thì tệ hơn nhiều so với trả 500 rồi chạy tiếp.
 */
const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[now-dash] lỗi khi phục vụ', req.method, req.url, '—', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    }
    if (!res.writableEnded) res.end('lỗi phía server');
  });
});

// Lưới an toàn cuối: watcher, setInterval và các nhánh async ngoài handler cũng có thể
// ném. Ghi log rồi chạy tiếp — một lượt quét hỏng không được phép cướp cả phiên làm việc.
process.on('unhandledRejection', (err) => {
  console.error('[now-dash] promise bị bỏ rơi:', err?.stack || err);
});

// Mở cổng TRƯỚC khi quét. Lượt quét đầu có thể mất vài giây trên máy nhiều repo;
// nếu chờ quét xong mới listen thì trình duyệt (và `bin/now-dash`) gõ vào cổng
// chưa mở và nhận connection refused. Mọi handler đều `await getState()` nên
// request đến sớm chỉ đơn giản là chờ lượt quét đầu tiên.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Cổng ${PORT} đang được dùng — dashboard có thể đã chạy sẵn ở http://localhost:${PORT}`);
    console.error(`  Đổi cổng bằng NOW_PORT=<số>, hoặc dừng cái cũ: pkill -f "node server.js"\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  NOW dashboard → http://localhost:${PORT}`);
  console.log('  đang quét lần đầu…');
});

const first = await getState();
await installWatchers(first);
console.log(
  `  ${first.stats.projects} dự án · ${first.stats.sessions} phiên sống (${first.stats.awake} đang thức) · ` +
    `${first.stats.hotDecisions} quyết định nóng · quét trong ${first.buildMs}ms\n`,
);

// Trạng thái git (commit mới, file bẩn) không sinh sự kiện ở thư mục ta theo dõi
// nên vẫn cần một nhịp quét nền; danh sách watcher cũng được vá lại theo dự án mới.
setInterval(async () => {
  const s = await getState({ force: true });
  await installWatchers(s);
  broadcast(s);
  // Mốc nghỉ phải chạy ở NHỊP NỀN, không chỉ lúc ai đó mở popover. Nếu chỉ quan sát
  // trong `/api/pet` thì cắm mặt làm ba tiếng không mở popover lần nào sẽ không sinh
  // được lượt quan sát nào, và tới lúc mở ra thanh tập trung vẫn đầy — tức lời nhắc câm
  // đúng vào ca nó cần lên tiếng nhất.
  //
  // Nuốt lỗi: sổ hỏng hay đĩa đầy thì dashboard vẫn phải chạy. Cả lớp trò chơi này là
  // phần thêm, không được phép kéo theo phần số liệu.
  await petLock(() => withPet(null)).catch(() => {});
}, 30000).unref?.();
