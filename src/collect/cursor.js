import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CURSOR_ANALYTICS_DAYS,
  CURSOR_API_BASE,
  CURSOR_API_CACHE,
  CURSOR_STALE_MS,
  CURSOR_STATE_DB,
  CURSOR_TTL_MS,
} from '../config.js';
import { run } from '../lib/sh.js';
import { forecastOf } from './quota.js';

/**
 * Hạn mức gói Cursor — bề mặt thứ hai trả tiền theo tháng, và cũng là bề mặt thứ hai
 * mà con số "đã tiêu bao nhiêu" **không nằm trên đĩa**.
 *
 * Cursor cất mọi thứ nó biết về usage ở server, client chỉ hỏi lúc mở tab Dashboard.
 * Không có file cache, không có sổ theo ngày, không có gì để đọc nguội — nên muốn đưa
 * nó lên đây thì bắt buộc phải gọi endpoint, đúng như Claude (xem `collect/quota.js`).
 *
 * Cùng bộ đánh đổi ấy, và ở đây gắt hơn một bậc: đây là **RPC nội bộ của client**, giao
 * thức Connect, không có một dòng tài liệu nào. Anysphere đổi hình dạng là hỏng, không
 * ai báo trước. Nên mọi trường đọc phòng thủ, hỏng thì rơi xuống ảnh chụp cũ, và không
 * đường nào ném lỗi ra ngoài.
 *
 * ## Cái bẫy lớn nhất: `limit` KHÔNG phải trần dùng
 *
 * Phản hồi có `limit: 2000` và `includedSpend: 2000` nằm ngay cạnh `totalSpend: 4883`.
 * Đọc thẳng ra "đã tiêu 4883/2000 = 244%". Nhưng chính phản hồi đó nói `totalPercentUsed:
 * 14.15`. Hai con số cách nhau mười bảy lần.
 *
 * Lý do: **2000 xu là GIÁ GÓI ($20/tháng), không phải trần dùng.** Trần thật lớn hơn
 * nhiều và không có trường nào chứa nó — nó chỉ hiện ra qua phần trăm.
 *
 * Nên module này suy ngược trần ra từ phần trăm: `trần = đã tiêu ÷ phần trăm`. Trên máy
 * này ra $300 cho nhóm model tự chọn, $45 cho nhóm gọi tên, tổng $345 — ba số tròn trịa,
 * khớp tới từng xu, tức là giả định đúng chứ không phải trùng hợp.
 *
 * Nói cách khác: **phần trăm là số gốc, trần là số suy ra.** Bất cứ lúc nào suy không nổi
 * (chưa tiêu gì nên chưa có phần trăm để chia), giao diện vẫn còn phần trăm để hiện — và
 * đó vẫn đúng cái con số Cursor tự hiện trong app của nó.
 *
 * ## Mấy chuỗi `displayMessage` thì bỏ hẳn
 *
 * Phản hồi mang ba câu tiếng Anh dựng sẵn, và chúng **mâu thuẫn nhau**: `displayMessage`
 * nói "You've hit your usage limit" trong khi hai câu kia nói mới dùng 14% và 4%. Chúng
 * là template mà server gửi kèm cho client tự chọn theo ngữ cảnh, không phải kết luận.
 * Chép lên dashboard thì có ngày báo cạn hạn mức giữa lúc còn 86%.
 */

/** Bao lâu thì thôi gọi lại sau một lượt hỏng, theo từng kiểu hỏng. */
const BACKOFF_MS = {
  // Cài một ứng dụng là việc của con người, không phải của một lượt quét 30 giây. Lâu
  // nhất bảng này, nhưng vẫn có hạn: cài Cursor xong không phải khởi động lại dashboard.
  'not-installed': 30 * 60 * 1000,
  'no-auth': 10 * 60 * 1000,
  'token-expired': 10 * 60 * 1000,
  http: 5 * 60 * 1000,
  timeout: 60 * 1000,
  network: 60 * 1000,
};

let memo = null; // { at, body, agg } — lượt gọi thành công gần nhất
let blockUntil = 0;
let blockFail = null;
let calls = 0;

/** Số nguyên 64-bit của protobuf sang JSON là CHUỖI, không phải số. */
const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * Phần trăm nhỏ nhất còn chia được để suy ra trần.
 *
 * Phần trăm về server tính ở độ chính xác đầy đủ (`15.726666666666667`), nên sai số làm
 * tròn không phải mối lo — mối lo duy nhất là chia cho 0 ở đầu chu kỳ, lúc chưa tiêu gì.
 */
const MIN_PCT = 0.05;

/**
 * Trần suy ngược từ phần trăm, làm tròn về đơn vị đô.
 *
 * Hạn mức bán theo đô chẵn, còn phép chia thì nhả ra `30003.1` vì `totalSpend` ở cấp cao
 * nhất là số nguyên xu đã cắt đuôi trong khi phần trăm thì không. Làm tròn về $1 gần nhất
 * trả lại con số người ta thật sự mua; lệch quá 1% thì tức là giả định "phần trăm = đã
 * tiêu ÷ trần" sai ở đâu đó, và lúc đó thà không có số còn hơn có số bịa.
 */
export function ceilingFrom(cents, pct) {
  if (!Number.isFinite(cents) || !Number.isFinite(pct) || pct < MIN_PCT) return null;
  const raw = (cents / pct) * 100;
  const rounded = Math.round(raw / 100) * 100;
  return Math.abs(raw - rounded) <= raw * 0.01 ? rounded : null;
}

/**
 * Một nhóm hạn mức, mang **đúng hình dạng cửa sổ hạn mức của Claude**.
 *
 * Cố ý trùng khuôn: `lib/quota.js` phía client đã có sẵn cả thanh ba mảng, phép chấm kết
 * cục, và tooltip trải ra chữ — tất cả chỉ đòi `used`/`resetsAt`/`windowMs`/`forecast`.
 * Đây không phải trùng khuôn gượng ép, vì luật nền của hai bên giống nhau tới từng chữ:
 * **hạn mức không cộng dồn**, nên phần chưa dùng tới lúc reset là tiền đã trả rồi bỏ đi,
 * và "còn nhiều" là báo cáo về một khoản lỗ chứ không phải một tin tốt.
 *
 * Khác đúng một chỗ, và nó nằm ở giao diện chứ không ở đây: chạm trần bên Claude là **bị
 * chặn**, còn bên Cursor là **hết phần đã trả** — sau đó tính tiền tiếp hay dừng lại còn
 * tuỳ hạn mức chi tiêu người dùng tự đặt, thứ dashboard không đọc được. Nên chỗ nào Claude
 * nói "ngồi không" thì màn Công cụ nói "vượt phần đã trả".
 */
function bucketOf(key, cents, pct, cycle, now) {
  const p = Number.isFinite(pct) ? Math.max(0, pct) : null;
  const ceilCents = cents == null || p == null ? null : ceilingFrom(cents, p);
  const used = p == null ? null : Math.max(0, Math.min(100, p));
  return {
    key,
    used,
    remaining: used == null ? null : 100 - used,
    resetsAt: cycle.endAt,
    resetsInMs: cycle.resetsInMs,
    expired: cycle.endAt != null && cycle.endAt <= now,
    windowMs: cycle.windowMs,
    elapsedFrac: cycle.elapsedFrac,
    forecast: used == null ? { known: false, reason: 'unknown' } : forecastOf(used, cycle.endAt, cycle.windowMs, now),
    cents: cents ?? null,
    ceilCents,
    // Trần là số SUY RA, không phải số server gửi. Giao diện cần biết để nói đúng mức
    // chắc chắn của nó — và để đừng bao giờ hiện trần mà giấu mất phần trăm gốc.
    derived: ceilCents != null,
  };
}

/**
 * Nhịp làm việc trong editor, theo ngày — `GetUserAnalytics`.
 *
 * Trục HOÀN TOÀN khác với mọi thứ còn lại của màn Token: cả Claude lẫn Antigravity đều chỉ
 * đo được thứ **model sinh ra**, còn ở đây Cursor đếm thứ **thật sự vào file** — dòng thêm,
 * dòng bị nhận, số lần Tab hiện ra so với số lần được nhận. Đó là phép chia duy nhất trong
 * cả dashboard nói được về CHẤT: gợi ý nhiều mà bị bỏ nhiều thì không phải làm được nhiều.
 *
 * Xin 90 ngày, server trả về bao nhiêu thì lấy bấy nhiêu (đo được: 80). Không tự cắt lại
 * theo một ngưỡng của mình — chỗ nào server còn dữ liệu thì đó là dữ liệu thật.
 *
 * Hàm thuần, và mọi trường đọc phòng thủ đúng như phần hạn mức: đây vẫn là RPC nội bộ.
 */
export function parseCursorAnalytics(body) {
  const rows = Array.isArray(body?.dailyMetrics) ? body.dailyMetrics : [];
  const exts = new Map();
  const days = rows
    .map((d) => {
      const day = n(d?.date);
      if (!day) return null;
      for (const e of Array.isArray(d?.extensionUsage) ? d.extensionUsage : []) {
        const name = String(e?.name ?? '').trim();
        if (name) exts.set(name, (exts.get(name) ?? 0) + n(e?.count));
      }
      return {
        at: day,
        added: n(d?.linesAdded),
        deleted: n(d?.linesDeleted),
        // "Được nhận" là con số đáng đọc; "gợi ý ra" chỉ là mẫu số của nó.
        accepted: n(d?.acceptedLinesAdded),
        acceptedDeleted: n(d?.acceptedLinesDeleted),
        applies: n(d?.totalApplies),
        accepts: n(d?.totalAccepts),
        tabsShown: n(d?.totalTabsShown),
        tabsAccepted: n(d?.totalTabsAccepted),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);

  if (!days.length) return null;
  const sum = (k) => days.reduce((t, d) => t + d[k], 0);
  return {
    days,
    from: days[0].at,
    to: days.at(-1).at,
    totals: {
      added: sum('added'),
      accepted: sum('accepted'),
      applies: sum('applies'),
      accepts: sum('accepts'),
      tabsShown: sum('tabsShown'),
      tabsAccepted: sum('tabsAccepted'),
    },
    exts: [...exts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  };
}

/**
 * Bóc các phản hồi thành trạng thái hạn mức Cursor. Hàm thuần, test được.
 *
 * `agg` và `an` đều được phép vắng: cái đầu chỉ thêm phần chia theo model, cái sau thêm nhịp
 * làm việc trong editor. Thiếu cái nào thì mất đúng phần đó, không mất hạn mức — nên một
 * lượt gọi hỏng không kéo theo lượt kia.
 */
export function parseCursorUsage(body, agg, at, now = Date.now(), an = null) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'broken' };
  const pu = body.planUsage;
  if (!pu || typeof pu !== 'object') return { ok: false, reason: 'empty' };

  const totalCents = Number.isFinite(Number(pu.totalSpend)) ? n(pu.totalSpend) : null;
  if (totalCents == null) return { ok: false, reason: 'empty' };

  // `tier` cũng chia được hai nhóm, nhưng `autoBucketModels` là danh sách server tự khai
  // ngay trong phản hồi này — nó không lệch pha với phần trăm nó gửi kèm. `tier` chỉ dùng
  // khi danh sách vắng mặt.
  const autoSet = new Set(Array.isArray(body.autoBucketModels) ? body.autoBucketModels : []);
  const rows = Array.isArray(agg?.aggregations) ? agg.aggregations : [];
  const models = rows
    .map((r) => {
      const auto = autoSet.size ? autoSet.has(r?.modelIntent) : r?.tier === 2;
      return {
        model: String(r?.modelIntent ?? '—'),
        auto,
        inTok: n(r?.inputTokens),
        out: n(r?.outputTokens),
        cr: n(r?.cacheReadTokens),
        cw: n(r?.cacheWriteTokens),
        cents: Number.isFinite(Number(r?.totalCents)) ? n(r.totalCents) : 0,
      };
    })
    .sort((a, b) => b.cents - a.cents);

  // Chia tiền theo nhóm chỉ làm được khi có bảng model. Không có thì hai nhóm vẫn còn
  // phần trăm (server gửi thẳng), chỉ mất trần — đúng thứ tự ưu tiên đã nói ở đầu file.
  const split = models.length
    ? models.reduce(
        (acc, m) => {
          acc[m.auto ? 'auto' : 'named'] += m.cents;
          return acc;
        },
        { auto: 0, named: 0 },
      )
    : null;

  const startAt = n(body.billingCycleStart) || null;
  const endAt = n(body.billingCycleEnd) || null;
  const windowMs = startAt && endAt ? endAt - startAt : null;
  const cycle = {
    startAt,
    endAt,
    windowMs,
    resetsInMs: endAt == null ? null : endAt - now,
    // Phần chu kỳ đã trôi qua — mốc "tiêu đều" để so với phần trăm đã tiêu. Đây là
    // SỰ THẬT ĐO ĐƯỢC, không phải ngoại suy.
    elapsedFrac: !windowMs || startAt == null ? null : Math.max(0, Math.min(1, (now - startAt) / windowMs)),
  };

  const ageMs = Math.max(0, now - at);
  return {
    ok: true,
    source: 'api',
    at,
    ageMs,
    stale: ageMs > CURSOR_STALE_MS,
    cycle,
    total: bucketOf('total', totalCents, Number(pu.totalPercentUsed), cycle, now),
    auto: bucketOf('auto', split?.auto ?? null, Number(pu.autoPercentUsed), cycle, now),
    named: bucketOf('named', split?.named ?? null, Number(pu.apiPercentUsed), cycle, now),
    models,
    tokens: agg
      ? {
          inTok: n(agg.totalInputTokens),
          out: n(agg.totalOutputTokens),
          cr: n(agg.totalCacheReadTokens),
          cw: n(agg.totalCacheWriteTokens),
        }
      : null,
    // Tiền thưởng thêm ngoài phần đã mua. Không phải hạn mức, nên nó không vào nhóm nào —
    // chỉ là một dòng ghi chú giải thích vì sao tiêu vượt $20 mà vẫn chưa bị chặn.
    bonusCents: Number.isFinite(Number(pu.bonusSpend)) ? n(pu.bonusSpend) : null,
    planCents: Number.isFinite(Number(pu.includedSpend)) ? n(pu.includedSpend) : null,
    analytics: parseCursorAnalytics(an),
  };
}

/**
 * Token đăng nhập, đọc từ SQLite của Cursor.
 *
 * `mode=ro` chứ không chép file: `state.vscdb` ở đây nặng ~124MB và Cursor để chế độ WAL,
 * nên đọc song song trong lúc nó đang ghi là hợp lệ. **Không dùng `immutable=1`** — cờ đó
 * bỏ qua WAL, nghĩa là đọc trúng token cũ ngay sau khi Cursor làm mới đăng nhập.
 *
 * Giá trị đọc ra không bao giờ đi vào log hay payload, kể cả khi hỏng.
 */
export async function readCursorToken() {
  const out = await run(
    'sqlite3',
    [`file:${CURSOR_STATE_DB}?mode=ro`, "select value from ItemTable where key='cursorAuth/accessToken'"],
    { timeout: 5000 },
  );
  const tok = out.trim();
  // Ba đoạn ngăn bằng dấu chấm = còn là JWT. Chưa đăng nhập hay `sqlite3` vắng mặt đều
  // rơi về chuỗi rỗng ở đây — cả hai là "không có token". Ca "chưa cài Cursor" thì
  // `cursorInstalled` đã bắt trước, vì nó cần một câu trả lời KHÁC hẳn: không có gì để nói.
  return tok && tok.split('.').length === 3 ? tok : null;
}

/**
 * Máy này có Cursor không — hỏi trước khi hỏi token.
 *
 * "Chưa cài" và "cài rồi mà chưa đăng nhập" là hai câu chuyện khác nhau tới mức phải ra
 * hai kết cục khác nhau trên màn hình: câu sau là việc bạn có thể làm (đăng nhập rồi số
 * hiện ra), câu trước thì Cursor không phải công cụ của bạn và cả khối đó chỉ là chỗ
 * trống chiếm nửa hàng. Trước đây cả hai cùng ra `no-auth`.
 *
 * Probe là chính file SQLite mà lượt đọc token sẽ mở — không phải thư mục ứng dụng: máy
 * gỡ Cursor thường còn lại `~/Library/Application Support/Cursor` rỗng, mà cái vỏ rỗng đó
 * thì đúng nghĩa là chưa cài.
 */
async function cursorInstalled() {
  return fs
    .access(CURSOR_STATE_DB)
    .then(() => true)
    .catch(() => false);
}

/**
 * Hạn của token, nếu đọc được.
 *
 * Trên máy này `exp` rơi vào **năm 2107** — Cursor phát token sống gần trăm năm, nên nhánh
 * `token-expired` gần như không bao giờ chạy. Vẫn giữ, vì nó rẻ và vì ngày Cursor đổi sang
 * token ngắn hạn thì đây là chỗ duy nhất chặn được một chuỗi 401 lặp vô ích.
 */
function jwtExpMs(tok) {
  try {
    const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'));
    return typeof p?.exp === 'number' ? p.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Một lượt RPC. Không bao giờ ném. */
export async function post(method, token, now, payload = {}) {
  try {
    const res = await fetch(`${CURSOR_API_BASE}/${method}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        // Bắt buộc với giao thức Connect. Thiếu header này thì server đáp 400 kèm một
        // thông báo về protocol version, nghe không hề giống lỗi thiếu header.
        'connect-protocol-version': '1',
        accept: 'application/json',
        'user-agent': 'now-dashboard',
      },
      body: JSON.stringify(payload),
      // Trang sự kiện 1.000 dòng nặng ~476KB và mất ~1,6 giây; 8 giây đủ rộng cho nó mà
      // vẫn không để một lượt treo giữ chân cả lượt quét.
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[cursor] ${res.status} ${method} — ${detail.slice(0, 300)}`);
      return { ok: false, reason: 'http', status: res.status };
    }
    return { ok: true, body: await res.json() };
  } catch (err) {
    return { ok: false, reason: err?.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}

async function fetchFresh(now) {
  calls += 1;
  if (!(await cursorInstalled())) return { ok: false, reason: 'not-installed' };
  const token = await readCursorToken();
  if (!token) return { ok: false, reason: 'no-auth' };
  const exp = jwtExpMs(token);
  if (exp != null && exp <= now) return { ok: false, reason: 'token-expired' };

  // Ba lượt song song, và hai lượt phụ được phép hỏng riêng: bảng model và nhịp editor đều
  // là phần thêm, hạn mức là phần chính. Trói chúng vào nhau thì một lượt 500 của bảng model
  // xoá luôn cả hạn mức khỏi màn hình.
  const span = { startDate: String(now - CURSOR_ANALYTICS_DAYS * 86400_000), endDate: String(now) };
  const [period, agg, an] = await Promise.all([
    post('GetCurrentPeriodUsage', token, now),
    post('GetAggregatedUsageEvents', token, now),
    post('GetUserAnalytics', token, now, span),
  ]);
  if (!period.ok) return period;
  return { ok: true, at: now, body: period.body, agg: agg.ok ? agg.body : null, an: an.ok ? an.body : null };
}

async function readCache() {
  try {
    const snap = JSON.parse(await fs.readFile(CURSOR_API_CACHE, 'utf8'));
    return typeof snap?.at === 'number' && snap.body ? snap : null;
  } catch {
    return null;
  }
}

/** Ghi tạm rồi đổi tên — đọc trúng lúc đang ghi thì thấy bản cũ nguyên vẹn. */
async function writeCache(snap) {
  const tmp = `${CURSOR_API_CACHE}.${process.pid}`;
  try {
    await fs.mkdir(path.dirname(CURSOR_API_CACHE), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(snap));
    await fs.rename(tmp, CURSOR_API_CACHE);
  } catch {
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}

/**
 * Hai tầng, xuống dần theo độ tươi: endpoint → ảnh chụp endpoint gần nhất.
 *
 * Không có tầng thứ ba như Claude: Cursor không để lại dấu vết nào trên đĩa để đỡ.
 */
export async function collectCursor({ now = Date.now(), watched = true } = {}) {
  if (!memo) memo = await readCache();
  if (memo && now - memo.at < CURSOR_TTL_MS) {
    return { ...parseCursorUsage(memo.body, memo.agg, memo.at, now, memo.an), calls };
  }

  const attempt = !watched
    ? { ok: false, reason: 'idle' }
    : now < blockUntil
      ? blockFail
      : await fetchFresh(now);

  if (attempt.ok) {
    memo = { at: attempt.at, body: attempt.body, agg: attempt.agg, an: attempt.an };
    blockUntil = 0;
    blockFail = null;
    writeCache(memo);
    return { ...parseCursorUsage(memo.body, memo.agg, memo.at, now, memo.an), calls };
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
  if (memo) return { ...parseCursorUsage(memo.body, memo.agg, memo.at, now, memo.an), ...why };
  return { ok: false, reason: attempt.reason, ...why };
}
