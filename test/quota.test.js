import test from 'node:test';
import assert from 'node:assert/strict';
import { parseApiQuota, parseQuota, retryAfterMs } from '../src/collect/quota.js';

/**
 * Dữ liệu hạn mức khác mọi thứ khác trong dashboard: nó là ẢNH CHỤP, không phải sự
 * thật hiện tại. Ba chỗ sai được là đơn vị của `resets_at`, phân biệt "hơi cũ" với
 * "chết hẳn", và chiều của sai số khi ảnh cũ.
 */

const NOW = Date.parse('2026-07-25T21:00:00+07:00');
const snap = (over = {}) => ({
  at: NOW - 30_000,
  five_hour: { used_percentage: 42.1, resets_at: (NOW + 2 * 3600_000) / 1000 },
  seven_day: { used_percentage: 18.4, resets_at: (NOW + 3 * 86400_000) / 1000 },
  ...over,
});

test('bóc đủ hai cửa sổ và tính phần còn lại', () => {
  const q = parseQuota(snap(), NOW);
  assert.equal(q.ok, true);
  assert.equal(q.fiveHour.used, 42.1);
  assert.equal(q.fiveHour.remaining, 100 - 42.1);
  assert.equal(q.sevenDay.used, 18.4);
});

test('`resets_at` là GIÂY, phải nhân 1000 — quên là mọi mốc rơi về 1970 và luôn "đã qua"', () => {
  const q = parseQuota(snap(), NOW);
  assert.equal(q.fiveHour.resetsAt, NOW + 2 * 3600_000);
  assert.equal(q.fiveHour.resetsInMs, 2 * 3600_000);
  assert.equal(q.fiveHour.expired, false, 'mốc reset còn ở tương lai');
});

test('quá mốc reset thì đánh dấu chết hẳn, khác với chỉ hơi cũ', () => {
  const q = parseQuota(snap({ five_hour: { used_percentage: 90, resets_at: (NOW - 60_000) / 1000 } }), NOW);
  assert.equal(q.fiveHour.expired, true);
  assert.equal(q.sevenDay.expired, false, 'hai cửa sổ độc lập — một cái lăn không kéo cái kia theo');
});

test('ảnh mới thì không gắn cờ cũ', () => {
  const q = parseQuota(snap(), NOW);
  assert.equal(q.stale, false);
  assert.equal(q.conservative, false);
});

test('ảnh cũ được gắn cờ, và cờ nói rõ sai về phía an toàn', () => {
  // Sai số của ảnh cũ chỉ đi một chiều: không dùng Claude thì quota không tăng, mà
  // cửa sổ vẫn trôi nên phần dùng cũ rơi ra ngoài. Số cũ là cận TRÊN.
  const q = parseQuota(snap({ at: NOW - 40 * 60_000 }), NOW);
  assert.equal(q.stale, true);
  assert.equal(q.conservative, true);
  assert.equal(q.ageMs, 40 * 60_000);
});

test('chỉ có khung 5 giờ vẫn dùng được — script ghi null khi API không kèm khung kia', () => {
  const q = parseQuota(snap({ seven_day: null }), NOW);
  assert.equal(q.ok, true);
  assert.equal(q.sevenDay, null);
  assert.equal(q.fiveHour.used, 42.1);
});

test('file có nhưng chưa cửa sổ nào → "đang chờ", KHÔNG phải "hỏng"', () => {
  // Phân biệt này quan trọng: hook chạy trước lượt gọi API đầu tiên là chuyện bình
  // thường, báo "hỏng" ở đó là dọa người dùng đi sửa thứ không sai.
  const q = parseQuota({ at: NOW, five_hour: null, seven_day: null }, NOW);
  assert.equal(q.ok, false);
  assert.equal(q.reason, 'empty');
});

test('file rác trả reason broken chứ không ném', () => {
  assert.equal(parseQuota(null, NOW).reason, 'broken');
  assert.equal(parseQuota({}, NOW).reason, 'broken');
  assert.equal(parseQuota({ five_hour: { used_percentage: 5 } }, NOW).reason, 'broken', 'thiếu `at` thì không biết ảnh cũ hay mới');
});

test('phần trăm ngoài khoảng bị kẹp về 0–100, thanh không tràn ra ngoài khung', () => {
  const q = parseQuota(snap({ five_hour: { used_percentage: 130, resets_at: NOW / 1000 } }), NOW);
  assert.equal(q.fiveHour.used, 100);
  assert.equal(q.fiveHour.remaining, 0);
});

test('thiếu resets_at vẫn đọc được % — chỉ là không đếm ngược được', () => {
  const q = parseQuota(snap({ five_hour: { used_percentage: 12 } }), NOW);
  assert.equal(q.fiveHour.used, 12);
  assert.equal(q.fiveHour.resetsAt, null);
  assert.equal(q.fiveHour.resetsInMs, null);
  assert.equal(q.fiveHour.expired, false, 'không biết mốc reset thì không được kết luận là đã qua');
});

/**
 * Nguồn thứ hai: endpoint. Hình dạng KHÁC HẲN file hook dù cùng nói một chuyện —
 * `utilization` thay cho `used_percentage`, ISO có timezone thay cho epoch giây.
 * Fixture dưới đây chép nguyên văn một phản hồi thật, cắt bớt phần không dùng tới.
 */

const API_NOW = Date.parse('2026-07-25T17:00:00Z');
const FIVE_RESET = '2026-07-25T21:29:59.881673+00:00';
const WEEK_RESET = '2026-07-30T17:59:59.881693+00:00';

const body = (over = {}) => ({
  five_hour: { utilization: 3.0, resets_at: FIVE_RESET, limit_dollars: null },
  seven_day: { utilization: 28.0, resets_at: WEEK_RESET, limit_dollars: null },
  seven_day_opus: null,
  seven_day_sonnet: null,
  limits: [
    { kind: 'session', group: 'session', percent: 3, severity: 'normal', resets_at: FIVE_RESET, scope: null, is_active: false },
    { kind: 'weekly_all', group: 'weekly', percent: 28, severity: 'normal', resets_at: WEEK_RESET, scope: null, is_active: true },
    {
      kind: 'weekly_scoped',
      group: 'weekly',
      percent: 18,
      severity: 'normal',
      resets_at: WEEK_RESET,
      scope: { model: { id: null, display_name: 'Fable' }, surface: null },
      is_active: false,
    },
  ],
  ...over,
});

test('endpoint dùng `utilization`, không phải `used_percentage` — đọc nhầm tên là mất trắng cả hai cửa sổ', () => {
  const q = parseApiQuota(body(), API_NOW, API_NOW);
  assert.equal(q.ok, true);
  assert.equal(q.source, 'api');
  assert.equal(q.fiveHour.used, 3);
  assert.equal(q.sevenDay.used, 28);
  assert.equal(q.sevenDay.remaining, 72);
});

test('`resets_at` của endpoint là chuỗi ISO, không phải epoch giây', () => {
  const q = parseApiQuota(body(), API_NOW, API_NOW);
  assert.equal(q.fiveHour.resetsAt, Date.parse(FIVE_RESET));
  assert.equal(q.fiveHour.resetsInMs, Date.parse(FIVE_RESET) - API_NOW);
  assert.equal(q.fiveHour.expired, false);
});

test('hạn mức tuần theo model được bóc kèm tên model — hook không hề có thứ này', () => {
  const q = parseApiQuota(body(), API_NOW, API_NOW);
  assert.equal(q.scoped.length, 1);
  assert.equal(q.scoped[0].model, 'Fable');
  assert.equal(q.scoped[0].used, 18, 'trong limits[] trường tên là `percent`, không phải `utilization`');
  assert.equal(q.scoped[0].resetsAt, Date.parse(WEEK_RESET));
});

test('thiếu trường cấp cao nhất thì lùi về limits[] — cùng số, không mất cửa sổ nào', () => {
  const q = parseApiQuota(body({ five_hour: null, seven_day: undefined }), API_NOW, API_NOW);
  assert.equal(q.ok, true);
  assert.equal(q.fiveHour.used, 3, 'lấy từ kind=session');
  assert.equal(q.sevenDay.used, 28, 'lấy từ kind=weekly_all');
});

test('phản hồi không có cửa sổ nào → "đang chờ", không phải "hỏng"', () => {
  const q = parseApiQuota({ five_hour: null, seven_day: null, limits: [] }, API_NOW, API_NOW);
  assert.equal(q.ok, false);
  assert.equal(q.reason, 'empty');
});

test('phản hồi rác trả broken chứ không ném — endpoint không có tài liệu, hình dạng đổi lúc nào không biết', () => {
  assert.equal(parseApiQuota(null, API_NOW, API_NOW).reason, 'broken');
  assert.equal(parseApiQuota('<html>502</html>', API_NOW, API_NOW).reason, 'broken');
  assert.equal(parseApiQuota({ limits: 'không phải mảng' }, API_NOW, API_NOW).reason, 'empty');
});

test('ảnh chụp endpoint cũng cũ đi được, và cũng sai về phía an toàn', () => {
  const q = parseApiQuota(body(), API_NOW - 40 * 60_000, API_NOW);
  assert.equal(q.stale, true);
  assert.equal(q.conservative, true);
  assert.equal(q.ageMs, 40 * 60_000);
});

/**
 * `Retry-After` là thứ đứng giữa "bị 429 một lát" và "bị phạt nặng hơn vì cứ đâm vào".
 * Endpoint này từng trả 1602 giây, gấp năm lần backoff cứng của ta.
 */

const headers = (v) => ({ headers: { get: (k) => (k === 'retry-after' && v != null ? v : null) } });

test('Retry-After dạng số giây được đổi sang mili-giây', () => {
  assert.equal(retryAfterMs(headers('1602'), API_NOW), 1_602_000);
  assert.equal(retryAfterMs(headers('0'), API_NOW), 0);
});

test('Retry-After dạng HTTP-date được quy về khoảng chờ còn lại', () => {
  const at = new Date(API_NOW + 90_000).toUTCString(); // toUTCString cắt phần mili-giây
  assert.equal(retryAfterMs(headers(at), API_NOW), Date.parse(at) - API_NOW);
});

test('Retry-After đã qua thì chờ 0, không ra số âm — số âm làm backoff hết tác dụng', () => {
  assert.equal(retryAfterMs(headers(new Date(API_NOW - 60_000).toUTCString()), API_NOW), 0);
  assert.equal(retryAfterMs(headers('-30'), API_NOW), 0);
});

test('không có header hoặc header rác thì trả null để backoff mặc định lo', () => {
  assert.equal(retryAfterMs(headers(null), API_NOW), null);
  assert.equal(retryAfterMs(headers('lúc nào đó'), API_NOW), null);
});

test('mốc thời gian dạng số vẫn đúng dù là giây hay mili-giây', () => {
  const sec = parseApiQuota(body({ five_hour: { utilization: 5, resets_at: API_NOW / 1000 + 600 } }), API_NOW, API_NOW);
  const ms = parseApiQuota(body({ five_hour: { utilization: 5, resets_at: API_NOW + 600_000 } }), API_NOW, API_NOW);
  assert.equal(sec.fiveHour.resetsInMs, 600_000);
  assert.equal(ms.fiveHour.resetsInMs, 600_000, 'ngưỡng 1e11 tách được hai đơn vị, không cần đoán');
});

/**
 * Dự báo tuyến tính.
 *
 * Cả khối này chỉ để bảo vệ một điều: dashboard **không được đoán khi chưa có gì để
 * chia**. Ngoại suy từ một mẫu dài 1% cửa sổ là cách sinh ra báo động giả nhanh nhất,
 * mà báo động giả về hạn mức thì đắt — nó khiến người dùng đổi model hoặc dừng việc.
 */

const H = 3600_000;
const D = 86400_000;

/** Một cửa sổ 5 giờ đã trôi qua `elapsedH` giờ, đã tiêu `used`%. */
const five = (used, elapsedH) =>
  parseApiQuota(
    body({ five_hour: { utilization: used, resets_at: API_NOW + (5 - elapsedH) * H } }),
    API_NOW,
    API_NOW,
  ).fiveHour;

test('nhịp đều thì % dự kiến lúc reset là phép chia thẳng — ai cũng kiểm lại được bằng đầu', () => {
  // 20% trong 1 giờ đầu của khung 5 giờ → giữ nhịp là 100% đúng lúc reset.
  const w = five(20, 1);
  assert.equal(w.forecast.known, true);
  assert.equal(Math.round(w.forecast.projected), 100);
  assert.equal(Math.round(w.forecast.perHour), 20);
  assert.equal(w.forecast.willExhaust, false, 'chạm đúng 100 lúc reset thì chưa phải là cạn TRƯỚC reset');
});

test('nhịp vượt trần → willExhaust kèm mốc cạn nằm TRƯỚC reset', () => {
  const w = five(50, 1); // 50%/giờ, còn 4 giờ → 250% lúc reset
  assert.equal(w.forecast.willExhaust, true);
  assert.equal(Math.round(w.forecast.projected), 250);
  assert.equal(w.forecast.exhaustInMs, H, 'còn 50% ở nhịp 50%/giờ = đúng 1 giờ nữa');
  assert.equal(w.forecast.exhaustAt, API_NOW + H);
});

test('nhịp thong thả thì không có mốc cạn, dù ngoại suy vẫn ra số', () => {
  const w = five(10, 2.5); // 4%/giờ, còn 2,5 giờ → 20% lúc reset
  assert.equal(w.forecast.willExhaust, false);
  assert.equal(w.forecast.exhaustInMs, null, 'cạn sau khi cửa sổ đã lăn thì không phải là cạn');
  assert.equal(Math.round(w.forecast.projected), 20);
});

test('cửa sổ vừa mở thì KHÔNG đoán — chia cho mẫu quá ngắn là bịa ra hoảng loạn', () => {
  const w = five(1, 0.1); // mới 2% cửa sổ, ngoại suy thô sẽ ra 50%
  assert.equal(w.forecast.known, false);
  assert.equal(w.forecast.reason, 'early');
});

test('cửa sổ đã lăn thì không đoán — số hiện tại thuộc chu kỳ cũ', () => {
  const w = five(80, 5.5);
  assert.equal(w.expired, true);
  assert.equal(w.forecast.known, false);
  assert.equal(w.forecast.reason, 'rolled');
});

test('thiếu mốc reset thì không suy ra được đã trôi bao lâu, và nói thẳng là không biết', () => {
  const w = parseQuota({ at: NOW, five_hour: { used_percentage: 40 } }, NOW).fiveHour;
  assert.equal(w.forecast.known, false);
  assert.equal(w.forecast.reason, 'unknown');
});

test('đã kịch trần thì cạn NGAY, không phải "sẽ cạn sau …"', () => {
  const w = five(100, 2);
  assert.equal(w.forecast.exhaustInMs, 0);
  assert.equal(w.forecast.willExhaust, true);
});

test('chưa tiêu gì thì dự báo là 0, không phải chia cho 0', () => {
  const w = five(0, 2);
  assert.equal(w.forecast.known, true);
  assert.equal(w.forecast.projected, 0);
  assert.equal(w.forecast.exhaustInMs, null);
  assert.equal(w.forecast.willExhaust, false);
});

test('khung 7 ngày dùng đúng độ dài 7 ngày — lấy nhầm 5 giờ là nhịp sai 33 lần', () => {
  const w = parseApiQuota(
    body({ seven_day: { utilization: 28, resets_at: API_NOW + 5 * D } }),
    API_NOW,
    API_NOW,
  ).sevenDay;
  assert.equal(w.windowMs, 7 * D);
  assert.equal(Math.round(w.forecast.perHour * 24 * 100) / 100, 14, '28% trong 2 ngày = 14%/ngày');
  assert.equal(Math.round(w.forecast.projected), 98);
});

test('hạn mức tuần theo model cũng có dự báo — nó mới là thứ chặn trước, không phải khung chung', () => {
  const w = parseApiQuota(body(), API_NOW, API_NOW).scoped[0];
  assert.equal(w.windowMs, 7 * D);
  assert.equal(w.forecast.known, true);
});

test('phần cửa sổ đã trôi qua là con số RIÊNG, có cả khi chưa đoán nổi nhịp', () => {
  // Vạch "tiêu đều" trên thanh vẽ từ đây. Nó phải sống sót qua đúng cái lúc dự báo
  // chịu thua (cửa sổ vừa mở) — đó là lúc người xem cần một chỗ bấu víu nhất.
  const w = five(1, 0.1);
  assert.equal(w.forecast.known, false, 'chưa đoán được nhịp');
  assert.equal(Math.round(w.elapsedFrac * 1000) / 1000, 0.02, 'nhưng vẫn biết đã trôi 2% cửa sổ');
});

test('phần đã trôi bị kẹp trong 0–1 — vạch không được rơi ra ngoài thanh', () => {
  assert.equal(five(50, 5.5).elapsedFrac, 1, 'cửa sổ đã lăn');
  assert.equal(five(10, -1).elapsedFrac, 0, 'mốc reset xa hơn cả độ dài cửa sổ');
  assert.equal(parseQuota({ at: NOW, five_hour: { used_percentage: 4 } }, NOW).fiveHour.elapsedFrac, null);
});
