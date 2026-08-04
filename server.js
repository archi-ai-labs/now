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
}, 30000).unref?.();
