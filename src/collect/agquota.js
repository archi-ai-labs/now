import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AG_QUOTA_CACHE,
  AG_QUOTA_STALE_MS,
  AG_QUOTA_TTL_MS,
  AG_RPC_METHOD,
  AG_STATUS_METHOD,
  ANTIGRAVITY_DIR,
} from '../config.js';
import { run } from '../lib/sh.js';
import { forecastOf } from './quota.js';

/**
 * Hạn mức Antigravity — bề mặt thứ ba trả tiền theo chu kỳ, và bề mặt cuối cùng còn
 * thiếu số trên dashboard này.
 *
 * Khác Claude và Cursor ở đúng một chỗ, và chỗ đó làm mọi thứ dễ hơn: **dashboard không
 * cầm credential nào**. `language_server` của Antigravity đang chạy sẵn trên máy, nó tự
 * phơi `RetrieveUserQuotaSummary` ở loopback và tự xác thực với Google. Ta chỉ hỏi nó.
 * Đổi lại, số chỉ có khi Antigravity đang mở — xem `reason: 'not-running'`.
 *
 * ## Đừng đếm step
 *
 * Cám dỗ lớn nhất ở đây là suy hạn mức ra từ số bước trong `brain/<id>/.system_generated/
 * logs/transcript.jsonl`: file đó có sẵn, đọc nguội được, và chia cho một hằng số là ra
 * ngay một con số trông rất giống phần trăm. Nó sai ba tầng:
 *
 * - Chính server nói quota tiêu theo **chi phí token**, không theo số lượt. Một bước
 *   Flash và một bước Opus lệch nhau cả bậc.
 * - Có **hai hồ chứa riêng** (Gemini, và Claude+GPT). Đo trên máy này có lúc một hồ đã
 *   tiêu 64% còn hồ kia còn nguyên 100% — một con số không diễn tả được hai hồ.
 * - Mốc reset là mốc **tuyệt đối do server cấp**, không phải cửa sổ trượt tính từ bước
 *   cũ nhất.
 *
 * Đã có một bản dựng theo lối đó (`~/.gemini/antigravity/scratch/quota_server.py`, hằng
 * số `ESTIMATED_WEEKLY_LIMIT = 3800`): nó in ra 70,5% và gọi là "đã dùng", trong khi số
 * thật là 29,1% đã dùng. Hằng số được chỉnh cho khớp con số 71% mà giao diện Antigravity
 * hiện — mà 71% đó là phần **CÒN LẠI**. Sai đúng bằng phần bù, và trông hoàn toàn hợp lý.
 *
 * ## `remainingFraction` → `used`
 *
 * Giao diện Antigravity hiện phần CÒN LẠI (71%), dashboard này hiện phần ĐÃ TIÊU (29%).
 * Cố ý lệch: cả màn Token lẫn thẻ Cursor đều lấy "đã tiêu" làm số dẫn, và luật nền của
 * chỗ này là hạn mức không cộng dồn — phần chưa dùng tới lúc reset là tiền đã trả rồi bỏ
 * đi. Nhưng vì hai bên hiện hai con số bù nhau cho cùng một sự thật, giao diện phải in
 * kèm phần còn lại có nhãn rõ ràng, không thì người dùng đối chiếu với app rồi kết luận
 * dashboard hỏng.
 */

const BACKOFF_MS = {
  // Xem `not-installed` bên `collect/cursor.js`: cài app là việc của con người, nhưng vẫn
  // có hạn để cài xong không phải khởi động lại dashboard.
  'not-installed': 30 * 60 * 1000,
  'not-running': 60 * 1000,
  'no-port': 2 * 60 * 1000,
  http: 5 * 60 * 1000,
  timeout: 60 * 1000,
  network: 60 * 1000,
};

/** Độ dài cửa sổ theo tên server đặt. Chỉ để vẽ nhịp; thiếu thì mất dự báo, không mất số. */
const WINDOW_MS = {
  '5h': 5 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

let memo = null; // { at, body }
let endpoint = null; // { pid, port, token }
let blockUntil = 0;
let blockFail = null;
let calls = 0;

/** PID của `language_server`, moi từ bảng `ps` đã đọc sẵn — không gọi `ps` lần nữa. */
function serverPid(procs) {
  for (const [pid, args] of procs?.args ?? []) {
    if (args.includes('/Antigravity.app/') && args.includes('language_server')) return pid;
  }
  return null;
}

/**
 * Tìm cổng API và lấy token, bằng cách thử từng cổng loopback của tiến trình đó.
 *
 * Cổng API là cổng duy nhất trả về trang giao diện. Mấy cổng còn lại (LSP, sidecar) hoặc
 * im lặng hoặc đáp 400, nên phép thử này không mơ hồ. Thăm dò tuần tự chứ không song
 * song: hàng chục cổng, mà cổng đúng thường nằm trong nhóm đầu.
 */
async function discover(pid) {
  const out = await run('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n', '-a', '-p', String(pid)], {
    timeout: 5000,
  });
  const ports = [
    ...new Set(
      String(out)
        .match(/127\.0\.0\.1:(\d+)/g)
        ?.map((s) => Number(s.split(':')[1])) ?? [],
    ),
  ];

  for (const port of ports) {
    let html;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) continue;
      html = await res.text();
    } catch {
      continue;
    }
    const token = html.match(/"csrfToken":"([^"]+)"/)?.[1];
    if (token) return { pid, port, token };
  }
  return null;
}

/**
 * Một lượt RPC. Không bao giờ ném.
 *
 * `body` là tham số chứ không phải hằng số vì hai RPC ở đây ăn hai thân khác nhau:
 * hạn mức nhận `forceRefresh`, còn `GetUserStatus` nhận thân rỗng. Đút thừa một trường
 * vào RPC không khai nó là cách rẻ nhất để ăn 400 ở một chỗ đáng lẽ chạy được.
 */
async function post(port, token, method = AG_RPC_METHOD, body = { forceRefresh: true }) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${method}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Tên header này là thứ duy nhất trong cả đường đi không đoán ra được — xem config.
        'x-codeium-csrf-token': token,
      },
      // `forceRefresh` để server đi hỏi backend chứ đừng trả bản nó nhớ từ lần mở panel
      // trước; nhịp gọi ở đây đã thưa (5 phút) nên không có gì phải tiết kiệm.
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, reason: 'http', status: res.status };
    return { ok: true, body: await res.json() };
  } catch (err) {
    return { ok: false, reason: err?.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}

/**
 * Bậc gói, moi từ `GetUserStatus`.
 *
 * Giữ lại ĐÚNG hai chuỗi trong một phản hồi ~12KB. Phần còn lại là cấu hình model, giới
 * hạn tính năng, tên và email tài khoản — không thứ nào có việc gì ở dashboard này, và
 * đống đó mà lọt vào ảnh chụp trên đĩa thì mỗi lượt ghi đệm lại chép thêm một bản danh
 * tính người dùng ra chỗ chẳng ai cần tới nó.
 */
export function pickAgPlan(body) {
  const info = body?.userStatus?.planStatus?.planInfo;
  const label = typeof info?.planName === 'string' && info.planName ? info.planName : null;
  if (!label) return null;
  return { label, raw: typeof info.teamsTier === 'string' ? info.teamsTier : null };
}

/** ISO của server → mili-giây. Chuỗi rác thì `null`, không phải NaN len lỏi vào phép trừ. */
function toMs(iso) {
  if (typeof iso !== 'string') return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * Một cửa sổ hạn mức, đúng hình dạng mà `lib/quota.js` phía client ăn được.
 *
 * Trùng khuôn với Claude và Cursor là cố ý: thanh ba mảng, phép chấm kết cục và tooltip
 * đã có sẵn ở đó, và luật nền của cả ba giống nhau tới từng chữ.
 */
function bucketOf(b, now) {
  const frac = Number(b?.remainingFraction);
  if (!Number.isFinite(frac)) return null;
  const used = Math.max(0, Math.min(100, (1 - frac) * 100));
  const resetsAt = toMs(b?.resetTime);
  const windowMs = WINDOW_MS[b?.window] ?? null;
  return {
    key: String(b?.bucketId ?? b?.window ?? '—'),
    label: String(b?.displayName ?? b?.window ?? '—'),
    window: String(b?.window ?? ''),
    used,
    remaining: 100 - used,
    resetsAt,
    resetsInMs: resetsAt == null ? null : resetsAt - now,
    expired: resetsAt != null && resetsAt <= now,
    windowMs,
    elapsedFrac:
      resetsAt == null || !windowMs ? null : Math.max(0, Math.min(1, (windowMs - (resetsAt - now)) / windowMs)),
    forecast: forecastOf(used, resetsAt, windowMs, now),
    // Câu tự thuật của server ("...will fully refresh in 2 days, 7 hours"). Giữ nguyên
    // vì nó là lời của bên nắm hạn mức; nhưng nó KHÔNG được thay chỗ mốc reset đã quy về
    // số — chuỗi tiếng Anh dựng sẵn không dịch được và không sắp xếp được.
    say: typeof b?.description === 'string' && b.description ? b.description : null,
  };
}

/** Bóc phản hồi thành trạng thái hạn mức. Hàm thuần, test được. */
export function parseAgQuota(body, at, now = Date.now(), plan = null) {
  const r = body?.response ?? body;
  if (!r || typeof r !== 'object') return { ok: false, reason: 'broken' };

  const raw = Array.isArray(r.groups) && r.groups.length
    ? r.groups
    : // Server cho phép trả buckets phẳng, không gói nhóm. Chưa gặp ngoài đời, nhưng
      // đọc phòng thủ ở đây rẻ hơn nhiều so với một màn trống không giải thích được.
      Array.isArray(r.buckets) && r.buckets.length
      ? [{ displayName: null, buckets: r.buckets }]
      : [];

  const groups = raw
    .map((g, i) => {
      const buckets = (Array.isArray(g?.buckets) ? g.buckets : []).map((b) => bucketOf(b, now)).filter(Boolean);
      if (!buckets.length) return null;
      return {
        // Khoá lấy từ `bucketId` (`gemini-weekly` → `gemini`), không lấy từ `displayName`:
        // tên hiển thị là chuỗi tiếng Anh có thể đổi bất cứ lúc nào, `bucketId` thì là
        // định danh.
        key: String(buckets[0].key).split('-')[0] || `g${i}`,
        name: typeof g?.displayName === 'string' && g.displayName ? g.displayName : null,
        // "Models within this group: Gemini Flash, Gemini Pro" — bỏ phần dẫn, giữ danh sách.
        models: typeof g?.description === 'string' ? g.description.replace(/^[^:]*:\s*/, '') : null,
        buckets,
      };
    })
    .filter(Boolean);

  if (!groups.length) return { ok: false, reason: 'empty' };

  const ageMs = Math.max(0, now - at);
  return {
    ok: true,
    source: 'ls-rpc',
    at,
    ageMs,
    stale: ageMs > AG_QUOTA_STALE_MS,
    groups,
    // Bậc gói sống lâu hơn hẳn hạn mức, nên ảnh chụp cũ vẫn nói đúng nó rất lâu sau khi
    // các con số bên trên đã hết hạn — kể cả lúc Antigravity đã đóng.
    plan,
    note: typeof r.description === 'string' && r.description ? r.description : null,
  };
}

async function readCache() {
  try {
    const snap = JSON.parse(await fs.readFile(AG_QUOTA_CACHE, 'utf8'));
    return typeof snap?.at === 'number' && snap.body ? snap : null;
  } catch {
    return null;
  }
}

/** Ghi tạm rồi đổi tên — đọc trúng lúc đang ghi thì thấy bản cũ nguyên vẹn. */
async function writeCache(snap) {
  const tmp = `${AG_QUOTA_CACHE}.${process.pid}`;
  try {
    await fs.mkdir(path.dirname(AG_QUOTA_CACHE), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(snap));
    await fs.rename(tmp, AG_QUOTA_CACHE);
  } catch {
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}

/**
 * Máy này có Antigravity không.
 *
 * Probe là `~/.gemini/antigravity` — thư mục app tự dựng ở lần chạy đầu, và cũng là chỗ
 * `collect/antigravity.js` đọc hội thoại. Không probe theo tiến trình được: tiến trình
 * vắng mặt chính là thứ đang cần phân biệt.
 */
async function agInstalled() {
  return fs
    .access(ANTIGRAVITY_DIR)
    .then(() => true)
    .catch(() => false);
}

async function fetchFresh(procs, now) {
  calls += 1;
  const pid = serverPid(procs);
  // Antigravity đóng là mất cả cổng lẫn token. Đây không phải hỏng — nó là trạng thái
  // bình thường của một bề mặt chỉ trả lời khi đang mở, và giao diện phải nói khác đi.
  //
  // Nhưng "đang đóng" chỉ đúng khi máy có Antigravity. Máy chưa cài thì cũng không có
  // tiến trình, và bản trước in ra "Antigravity đang đóng" — một câu bảo người dùng đi
  // mở một ứng dụng không tồn tại. Hai ca ra hai reason vì chúng dẫn tới hai kết cục:
  // đóng thì khối vẫn đứng đó chờ (mở lên là có số), chưa cài thì khối biến mất hẳn.
  if (!pid) {
    endpoint = null;
    return { ok: false, reason: (await agInstalled()) ? 'not-running' : 'not-installed' };
  }

  // Khởi động lại là PID đổi, và cả cổng lẫn token đều hết hiệu lực cùng lúc. Bám vào
  // PID nên không cần dò lại mỗi lượt, mà cũng không bao giờ dùng nhầm token của lần chạy trước.
  if (endpoint?.pid !== pid) endpoint = await discover(pid);
  if (!endpoint) return { ok: false, reason: 'no-port' };

  let res = await post(endpoint.port, endpoint.token);
  // 401/403 = token đã xoay trong lúc app vẫn chạy. Dò lại một lần rồi thôi: lặp mãi thì
  // một lỗi thật sẽ biến thành vòng quét cổng vô tận.
  if (!res.ok && res.status === 401) {
    endpoint = await discover(pid);
    if (!endpoint) return { ok: false, reason: 'no-port' };
    res = await post(endpoint.port, endpoint.token);
  }
  if (!res.ok) return res;

  // Bậc gói đi NHỜ lượt này: cùng cổng, cùng token, cùng nhịp 5 phút. Nó được phép hỏng
  // riêng mà không kéo theo hạn mức — hạn mức là thứ đổi từng giờ và là lý do cả module
  // này tồn tại, còn bậc gói thì hàng tháng mới đổi một lần. Đánh sập cái đầu vì cái sau
  // là đổi một con số đang sống lấy một cái nhãn gần như tĩnh.
  const st = await post(endpoint.port, endpoint.token, AG_STATUS_METHOD, {});
  return { ok: true, at: now, body: res.body, plan: st.ok ? pickAgPlan(st.body) : null };
}

/**
 * Hai tầng, xuống dần theo độ tươi: RPC nội bộ → ảnh chụp lần gọi gần nhất.
 *
 * Ảnh chụp quan trọng hơn ở đây so với Claude/Cursor: nguồn này tắt theo app, nên khi
 * Antigravity đóng thì ảnh cũ là thứ DUY NHẤT còn nói được điều gì.
 */
export async function collectAgQuota({ now = Date.now(), watched = true, procs = null } = {}) {
  if (!memo) memo = await readCache();
  if (memo && now - memo.at < AG_QUOTA_TTL_MS) return { ...parseAgQuota(memo.body, memo.at, now, memo.plan), calls };

  const attempt = !watched
    ? { ok: false, reason: 'idle' }
    : now < blockUntil
      ? blockFail
      : await fetchFresh(procs, now);

  if (attempt.ok) {
    // Bậc gói cũ được GIỮ khi lượt này không moi ra được: `GetUserStatus` hỏng riêng là
    // chuyện thường (nó đi nhờ), mà quên bậc gói vì một lượt hỏng thì cái nhãn trên màn
    // hình cứ chớp tắt theo từng lượt quét — trong khi bậc gói hàng tháng mới đổi.
    memo = { at: attempt.at, body: attempt.body, plan: attempt.plan ?? memo?.plan ?? null };
    blockUntil = 0;
    blockFail = null;
    writeCache(memo);
    return { ...parseAgQuota(memo.body, memo.at, now, memo.plan), calls };
  }

  if (watched && now >= blockUntil) {
    blockUntil = now + (BACKOFF_MS[attempt.reason] ?? 60_000);
    blockFail = attempt;
  }

  const why = {
    calls,
    ...(attempt.reason === 'idle'
      ? {}
      : { degraded: attempt.reason, ...(attempt.status ? { status: attempt.status } : {}) }),
  };
  if (memo) return { ...parseAgQuota(memo.body, memo.at, now, memo.plan), ...why };
  // Antigravity đóng và chưa có ảnh chụp nào: không hạn mức, mà cũng không bậc gói.
  return { ok: false, reason: attempt.reason, plan: null, ...why };
}
