import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CURSOR_EVENTS_FILE,
  CURSOR_EVENTS_MAX_PAGES,
  CURSOR_EVENTS_PAGE,
  CURSOR_EVENTS_REDO_DAYS,
  CURSOR_EVENTS_TTL_MS,
} from '../config.js';
import { post, readCursorToken } from './cursor.js';
import { localDay } from './usage.js';

/**
 * Sổ sự kiện Cursor — trục thời gian mà hai endpoint kia không có.
 *
 * `GetCurrentPeriodUsage` và `GetAggregatedUsageEvents` đều chỉ nói **tổng cả chu kỳ**: đã
 * tiêu bao nhiêu phần trăm, model nào ăn bao nhiêu đô. Không có một con số nào theo ngày,
 * nên tab Cursor cho tới giờ không trả lời được câu đơn giản nhất — *hôm qua tốn bao nhiêu*.
 *
 * `GetFilteredUsageEvents` thì trả về **từng lượt gọi**, kèm mốc thời gian, model, tiền đã
 * tính, bốn loại token, mã hội thoại, và `kind` (được tính tiền, lỗi không tính tiền, hay
 * dùng credit miễn phí). Đo trên máy này: **5.279 sự kiện**, xếp mới→cũ, 1.000 sự kiện mỗi
 * trang (~476KB, ~1,6 giây).
 *
 * ## Vì sao phải có SỔ, không đọc thẳng mỗi lượt
 *
 * **Không** phải vì sợ mất lịch sử. Endpoint này hào phóng hơn hẳn dự đoán ban đầu: đo được
 * **148 ngày, lùi tới 2025-01-10**, tức là nó phơi ra cả những chu kỳ đã đóng từ lâu chứ
 * không chỉ chu kỳ hiện hành. Khác hẳn hạn mức Claude, nơi `collect/quotalog.js` phải chốt
 * sổ vì endpoint chỉ có trạng thái ngay lúc hỏi.
 *
 * Lý do là CHI PHÍ: kéo trọn 6 trang mất ~10 giây và ~2,9MB. Đặt nó vào đường đi của một
 * lượt quét 30 giây thì lần mở trang đầu tiên treo 10 giây, và mỗi 30 giây lại gõ cửa
 * endpoint của người khác thêm 6 lần cho một bộ số gần như không đổi.
 *
 * Sổ cũng mua thêm một thứ rẻ: nếu Anysphere có ngày cắt ngắn khoảng lịch sử, phần đã chốt
 * vẫn còn. Đó là phần thưởng, không phải lý do.
 *
 * ## Gộp bằng GHI ĐÈ THEO NGÀY, không bằng mốc nước
 *
 * Sự kiện là bất biến và xếp mới→cũ, nên nghe thì chỉ cần một mốc nước "đã đọc tới đây".
 * Nhưng mốc nước theo mili-giây có một ca hỏng thật: hai sự kiện trùng mốc ở đúng ranh giới
 * thì một cái bị bỏ (`>` mốc) hoặc bị đếm hai lần (`>=` mốc). Phép sửa cho ca đó đắt hơn hẳn
 * phép tránh nó.
 *
 * Nên: mỗi lượt kéo lại **trọn hai ngày cuối** rồi ghi đè đúng hai ngày ấy trong sổ. Không
 * cộng dồn thì không có gì để đếm hai lần, và ngày cũ hơn thì đóng băng — vừa đúng vừa
 * không phải nhớ trạng thái gì ngoài chính cái sổ.
 *
 * ## Lượt kéo KHÔNG chặn lượt quét
 *
 * Nguội thì 10 giây; để nó trong `await` của `buildState` là lần mở trang đầu tiên treo 10
 * giây. Nên hàm này luôn trả về **cái sổ đang có** rồi tự châm một lượt kéo chạy nền; lượt
 * quét 30 giây sau nhặt kết quả. Sổ còn trống thì nói thẳng là **đang nạp**, không giả vờ
 * là "không có dữ liệu" — hai chuyện đó khác nhau và người đọc cần phân biệt được.
 */

const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** `kind` mà Cursor gán cho một lượt. Chỉ ba giá trị gặp ngoài đời, đọc phòng thủ vì đây vẫn là RPC nội bộ. */
const ERRORED = 'USAGE_EVENT_KIND_ERRORED_NOT_CHARGED';

/** Cửa sổ của bảng xếp hạng hội thoại: hôm nay + hai ngày trước, tính theo ngày địa phương. */
const CONVO_DAYS = 3;

/** Ngày địa phương của một sự kiện. Mốc là chuỗi mili-giây, không phải số. */
const dayOf = (ev) => {
  const ts = num(ev?.timestamp);
  return ts ? localDay(new Date(ts).toISOString()) : null;
};

/**
 * Danh sách sự kiện → bảng theo ngày. Hàm thuần, test được mà không cần mạng.
 *
 * Mỗi ngày giữ luôn bảng con theo HỘI THOẠI, không giữ ở cấp trên: phép gộp là ghi đè theo
 * ngày, nên bất cứ thứ gì trải ngang nhiều ngày đều không ghi đè lại được cho đúng. Tổng
 * theo hội thoại thì cộng lại lúc đọc — một vòng lặp trên vài trăm hàng, rẻ hơn hẳn một sổ
 * sai.
 */
export function foldEvents(events) {
  const days = {};
  for (const ev of events ?? []) {
    const day = dayOf(ev);
    if (!day) continue;
    const d = (days[day] ??= { events: 0, errored: 0, cents: 0, inTok: 0, out: 0, cr: 0, cw: 0, convos: {} });
    const tu = ev?.tokenUsage ?? {};
    const cents = num(ev?.chargedCents);
    d.events += 1;
    if (ev?.kind === ERRORED) d.errored += 1;
    d.cents += cents;
    d.inTok += num(tu.inputTokens);
    d.out += num(tu.outputTokens);
    d.cr += num(tu.cacheReadTokens);
    d.cw += num(tu.cacheWriteTokens);

    const cid = ev?.conversationId;
    if (cid) {
      const c = (d.convos[cid] ??= { events: 0, cents: 0 });
      c.events += 1;
      c.cents += cents;
    }
  }
  return days;
}

/**
 * Sổ → hình dạng mà giao diện ăn được.
 *
 * `models` KHÔNG có ở đây dù sự kiện nào cũng mang tên model: bảng theo model đã có sẵn từ
 * `GetAggregatedUsageEvents`, do chính Cursor cộng, và cộng lại lần nữa từ sự kiện thì có
 * hai bảng cùng đề một chuyện mà lệch nhau ở phần lịch sử đã bị cắt. Sổ này chỉ mang thứ
 * bảng kia không có: **trục thời gian**.
 */
export function shapeRollup(book, { now = Date.now() } = {}) {
  const days = Object.entries(book?.days ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (!days.length) return { ok: true, warming: !book?.at, days: 0, series: [], convos: [], totals: null, at: book?.at ?? null };

  const series = days.map(([day, d]) => ({
    day,
    events: d.events,
    errored: d.errored,
    cents: d.cents,
    inTok: d.inTok,
    out: d.out,
    cr: d.cr,
    cw: d.cw,
  }));

  // Hội thoại chỉ gom trong 3 NGÀY gần nhất (tính theo ngày địa phương, cùng lịch với
  // khoá của sổ). Bảng xếp hạng toàn-lịch-sử bị chính lịch sử đóng băng: mười hội thoại
  // đắt nhất của 148 ngày thì tháng sau vẫn là mười cái đó. Ba ngày mới trả lời được
  // "dạo này cái gì đang đốt tiền" — và mấy ngày nghỉ thì danh sách rỗng, giao diện tự
  // rút tấm chart thay vì vẽ gượng số cũ.
  const cut = localDay(new Date(now - (CONVO_DAYS - 1) * 86400_000).toISOString());
  const byConvo = new Map();
  for (const [day, d] of days) {
    if (day < cut) continue;
    for (const [id, c] of Object.entries(d.convos ?? {})) {
      const cur = byConvo.get(id) ?? { id, events: 0, cents: 0, firstDay: day, lastDay: day };
      cur.events += c.events;
      cur.cents += c.cents;
      if (day < cur.firstDay) cur.firstDay = day;
      if (day > cur.lastDay) cur.lastDay = day;
      byConvo.set(id, cur);
    }
  }

  const sum = (k) => series.reduce((n, d) => n + d[k], 0);
  return {
    ok: true,
    warming: false,
    at: book.at ?? null,
    ageMs: book.at ? Math.max(0, now - book.at) : null,
    from: series[0].day,
    to: series.at(-1).day,
    days: series.length,
    series,
    // Mười hội thoại đắt nhất là trọn bảng xếp hạng của giao diện — chở thêm đuôi uuid
    // chỉ để không chart nào vẽ tới là phí đường truyền mỗi 30 giây.
    convos: [...byConvo.values()].sort((a, b) => b.cents - a.cents).slice(0, 10),
    convoCount: byConvo.size,
    convoDays: CONVO_DAYS,
    totals: {
      events: sum('events'),
      errored: sum('errored'),
      cents: sum('cents'),
      inTok: sum('inTok'),
      out: sum('out'),
      cr: sum('cr'),
      cw: sum('cw'),
    },
  };
}

/* ── Sổ trên đĩa ──────────────────────────────────────────────────────────── */

let book = null; // { v, at, days }
let loading = null;
let inFlight = false;
let lastTry = 0;
let lastFail = null;

async function readBook() {
  try {
    const raw = JSON.parse(await fs.readFile(CURSOR_EVENTS_FILE, 'utf8'));
    if (raw?.v === 1 && raw.days && typeof raw.days === 'object') return raw;
  } catch {
    /* chưa có sổ, hoặc sổ hỏng — cả hai đều là "bắt đầu lại từ đầu" */
  }
  return { v: 1, at: null, days: {} };
}

/** Ghi tạm rồi đổi tên — đọc trúng lúc đang ghi thì thấy bản cũ nguyên vẹn. */
async function writeBook(next) {
  const tmp = `${CURSOR_EVENTS_FILE}.${process.pid}`;
  try {
    await fs.mkdir(path.dirname(CURSOR_EVENTS_FILE), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(next));
    await fs.rename(tmp, CURSOR_EVENTS_FILE);
  } catch {
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}

/**
 * Ngày sớm nhất còn phải kéo lại.
 *
 * Sổ trống thì `null` — kéo hết những gì server còn giữ. Có sổ rồi thì chỉ hai ngày cuối,
 * vì mọi ngày trước đó đã chốt và sự kiện thì không sửa lại được.
 */
function redoFrom(current, now) {
  if (!current?.at || !Object.keys(current.days).length) return null;
  return localDay(new Date(now - CURSOR_EVENTS_REDO_DAYS * 86400_000).toISOString());
}

/**
 * Kéo sự kiện về, trang một cho tới khi chạm ngày không cần kéo nữa.
 *
 * Dừng SỚM ngay khi trang vừa lấy đã lùi qua `floor`: mỗi trang là ~476KB và ~1,6 giây, nên
 * kéo thừa một trang là trả giá thật. Trang cuối được giữ nguyên cả trang chứ không cắt —
 * `foldEvents` tự bỏ sự kiện ngoài khoảng lúc gộp.
 */
async function fetchEvents(floor, now) {
  const token = await readCursorToken();
  if (!token) return { ok: false, reason: 'no-auth' };

  const events = [];
  let pages = 0;
  for (let page = 1; page <= CURSOR_EVENTS_MAX_PAGES; page++) {
    const res = await post('GetFilteredUsageEvents', token, now, { page, pageSize: CURSOR_EVENTS_PAGE });
    if (!res.ok) return pages ? { ok: true, events, pages, partial: true } : res;
    const rows = Array.isArray(res.body?.usageEventsDisplay) ? res.body.usageEventsDisplay : [];
    pages += 1;
    events.push(...rows);
    if (rows.length < CURSOR_EVENTS_PAGE) break;
    const oldest = dayOf(rows.at(-1));
    if (floor && oldest && oldest < floor) break;
  }
  return { ok: true, events, pages };
}

/**
 * Một lượt làm mới, chạy NGOÀI lượt quét.
 *
 * Không bao giờ ném và không bao giờ chạy hai lượt chồng nhau: `inFlight` là cái khoá duy
 * nhất, và nó cũng là thứ giữ cho lượt quét 30 giây không châm thêm một lượt kéo 10 giây
 * mỗi lần nó thấy sổ vẫn còn nguội.
 */
async function refresh(now) {
  if (inFlight) return;
  inFlight = true;
  lastTry = now;
  try {
    const current = book ?? (await readBook());
    const floor = redoFrom(current, now);
    const got = await fetchEvents(floor, now);
    if (!got.ok) {
      lastFail = got.reason;
      return;
    }
    lastFail = null;
    const fresh = foldEvents(got.events);
    // GHI ĐÈ theo ngày, không cộng dồn: ngày nào vừa kéo lại thì lấy bản mới trọn vẹn, ngày
    // cũ hơn giữ nguyên. Lượt kéo nguội (`floor === null`) thay sạch cả sổ.
    const days = floor ? { ...current.days } : {};
    for (const [day, d] of Object.entries(fresh)) {
      if (!floor || day >= floor) days[day] = d;
    }
    book = { v: 1, at: now, days, pages: got.pages, partial: !!got.partial };
    await writeBook(book);
  } catch {
    lastFail = 'broken';
  } finally {
    inFlight = false;
  }
}

/**
 * Sổ sự kiện Cursor. Trả về ngay, làm mới ở nền.
 *
 * `watched` tắt (không ai mở dashboard) thì không châm lượt kéo nào: đây là endpoint của
 * người khác, và gõ cửa cho một cái màn hình không ai nhìn là gõ cửa thừa.
 */
export async function collectCursorEvents({ now = Date.now(), watched = true } = {}) {
  if (!book) {
    loading ??= readBook();
    book = await loading;
  }

  const stale = !book.at || now - book.at >= CURSOR_EVENTS_TTL_MS;
  // Hỏng thì lùi một nhịp trước khi thử lại — cùng tinh thần với `BACKOFF_MS` của
  // `collect/cursor.js`, chỉ khác là ở đây một lượt thử tốn hàng giây nên nhịp lùi dài hơn.
  const backoff = lastFail ? 5 * 60_000 : 0;
  if (watched && stale && !inFlight && now - lastTry >= backoff) void refresh(now);

  const shaped = shapeRollup(book, { now });
  return {
    ...shaped,
    // Nói ra ba trạng thái khác nhau thay vì gộp thành "không có dữ liệu": đang kéo lượt
    // đầu, kéo hỏng, hay sổ cũ vì dashboard vừa mở lại.
    loading: inFlight,
    degraded: lastFail,
    ttlMs: CURSOR_EVENTS_TTL_MS,
  };
}
