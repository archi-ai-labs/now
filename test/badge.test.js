import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { badgeOf } from '../src/badge.js';
// Ba mốc ngồi-lâu SUY từ FOCUS_MS. Bài test dưới lấy số phút từ đây chứ không chép tay,
// nên hạ nhịp (90 → 60 phút, 18/8) không làm vỡ một bài nào.
import { REST_STAGE_MIN } from '../public/lib/petmath.js';

/**
 * Mục trên thanh menu là bề mặt DUY NHẤT chạy suốt ngày, nên nó phải nói được cả lúc
 * mọi thứ hỏng — và đó đúng là nhánh trước nay chưa ai chạy thử, vì thử nó nghĩa là bịa
 * cho endpoint của Anthropic chết.
 *
 * Ca đã xảy ra thật (3–4/8): token OAuth trong Keychain hết hạn, `/api/state` biết thừa
 * (`degraded: "token-expired"`), mà thứ người dùng nhìn thấy suốt buổi thì không nói gì
 * cả — mất trọn một phiên đi dò một câu trả lời nằm sẵn trong API.
 */

const NOW = Date.parse('2026-08-04T02:00:00+07:00');

/** Hạn mức đọc được, nhịp tiêu bình thường. */
const healthy = (over = {}) => ({
  quota: {
    ok: true,
    at: NOW,
    ageMs: 30_000,
    stale: false,
    fiveHour: { used: 11, resetsAt: NOW + 3600_000, windowMs: 18000_000, elapsedFrac: 0.7, expired: false },
    sevenDay: { used: 41, resetsAt: NOW + 86400_000, windowMs: 604800_000, elapsedFrac: 0.57, expired: false },
    ...over,
  },
  stats: { awake: 2, hotDecisions: 3 },
});

test('bình thường: hai con số đã tiêu, không kèm lời nhắc nào', () => {
  const b = badgeOf(healthy(), NOW);
  assert.equal(b.quota.text, '11%·41%');
  assert.equal(b.quota.stale, false);
  // Tooltip lúc không hỏng gì không phải chỗ nhét thêm chữ.
  assert.equal(b.quota.note, null);
});

test('token hết hạn: nói ra CÁCH CHỮA, không chỉ nói là hỏng', () => {
  const b = badgeOf(healthy({ degraded: 'token-expired', stale: true }), NOW);
  assert.ok(b.quota.note, 'phải có lời nhắc');
  assert.match(b.quota.note, /Claude Code/, 'lời nhắc phải nói việc phải làm');
  // Số vẫn còn (rơi xuống ảnh chụp cũ) — nên `stale` là kênh DUY NHẤT nói rằng mấy con
  // số đang bày ra kia không phải số của bây giờ. Mất cờ này là mất cả cảnh báo.
  assert.equal(b.quota.stale, true);
  assert.equal(b.quota.text, '11%·41%');
});

test('mỗi lý do tụt tầng đều có câu của nó, không rơi vào im lặng', () => {
  for (const reason of ['no-auth', 'token-expired', 'http', 'timeout', 'network']) {
    const b = badgeOf(healthy({ degraded: reason }), NOW);
    assert.ok(b.quota.note, `${reason} phải nói được một câu`);
    assert.notEqual(b.quota.note, reason, `${reason} không được lọt ra màn hình ở dạng khoá`);
  }
});

test('lý do lạ vẫn ra được một câu, không lọt khoá thô ra màn hình', () => {
  const b = badgeOf(healthy({ degraded: 'chua-tung-gap' }), NOW);
  assert.ok(b.quota.note);
  assert.doesNotMatch(b.quota.note, /chua-tung-gap/);
});

test('không đọc được gì: dấu gạch, không phải "0%·0%"', () => {
  const b = badgeOf({ quota: { ok: false, degraded: 'no-auth' }, stats: {} }, NOW);
  assert.equal(b.quota.text, '—');
  assert.equal(b.quota.tone, 'mute');
  assert.equal(b.quota.stale, true);
  assert.ok(b.quota.note);
});

test('không có hạn mức nào trong trạng thái: vẫn trả huy hiệu, không ném', () => {
  const b = badgeOf({}, NOW);
  assert.equal(b.ok, true);
  assert.equal(b.quota.text, '—');
  assert.equal(b.quota.stale, true, 'không biết gì thì phải coi là số cũ, không phải số tươi');
  assert.deepEqual(b.work, { awake: 0, hot: 0 });
});

/**
 * Trường `rest` — thang ngồi-lâu đi RA icon. Ba cửa phải đóng đúng:
 * không sổ / trò chơi tắt → null (bản Swift cũ đọc badge mới cũng chỉ thấy thiếu một
 * trường), đang giữa một động tác nghỉ → bậc null (icon không được giục người vừa nghe
 * lời nó), còn lại → bậc do restStageOf quyết, đúng một nguồn.
 */
test('rest: không sổ hay trò chơi tắt thì null, không bịa số', () => {
  assert.equal(badgeOf(healthy(), NOW).rest, null, 'không truyền sổ thì không có phần nghỉ');
  assert.equal(badgeOf(healthy(), NOW, { on: false, satMin: 200 }).rest, null, 'tắt trò chơi là tắt cả icon');
});

test('rest: bậc theo số phút ngồi, và đang nghỉ dở thì icon phải im', () => {
  const at = (satMin, doing = null) => badgeOf(healthy(), NOW, { on: true, satMin, doing }).rest;
  const hush = REST_STAGE_MIN.dip - 1; // ngay dưới mốc đầu
  const sat = REST_STAGE_MIN.spent + 5; // qua trọn một chu kỳ, chưa tới hai
  assert.deepEqual(at(hush), { satMin: hush, stage: null }, 'dưới mốc đầu là im lặng');
  assert.deepEqual(at(sat), { satMin: sat, stage: 'spent' });
  assert.equal(at(sat, { kind: 'move', id: 'walk', ms: 6e4, leftMs: 3e4 }).stage, null, 'vừa bấm đi bộ mà icon vẫn đỏ là huy hiệu cãi cú bấm');
  // Đang ĂN thì khác đang nghỉ: cái bát không cắt mạch ngồi, bậc phải giữ nguyên.
  assert.equal(at(sat, { kind: 'food', id: 'pho', ms: 6e4, leftMs: 3e4 }).stage, 'spent');
});

/**
 * Trường `alert` — huy hiệu đã CHỐT HÌNH cho icon (dot/bang/flood), sinh sau `rest` một
 * ngày (9/8). Bốn cửa đóng ở đây: bậc do MỘT MÌNH thang ngồi-lâu quyết; cơn đói không bao
 * giờ tự bật đèn, kể cả `starving`; chỉ động tác NGHỈ mới bịt được lời nhắc, đúng một luật
 * `doing` dùng chung với trường `rest` ngay trên; nhưng tooltip vẫn phải nói ra cơn đói khi
 * đã có một bậc `rest` thật, và nói theo đúng thứ tự.
 *
 * Vì sao cửa thứ hai đổi chiều so với bản 9/8: hôm ấy `starving` được cho đứng ngang
 * `spent`, và ngày 10/9 đo được cái giá. `fedAt` trong ~/.now-dashboard/pet.json đứng từ
 * 7/9, tức icon mang đĩa đỏ hơn hai ngày liền vì một trạng thái trò chơi mà chủ máy vẫn
 * không cho ăn. `bang` là kênh chung của hạn mức token và của thang ngồi-lâu, nên một mục
 * đỏ bị lờ đi hai ngày dạy mắt bỏ qua cả kênh ấy. Hàng rào 4 của brief 6/8 đã chốt sẵn
 * luật cho ca này: trò chơi không đứng trên mặt số liệu.
 */
test('alert: đói lả MỘT MÌNH không bật đèn — hàng rào 4, trò chơi không đứng trên số liệu', () => {
  const hush = REST_STAGE_MIN.dip - 1; // đồng hồ ngồi chưa chạm mốc nào
  assert.equal(badgeOf(healthy(), NOW, { on: true, satMin: 3, mood: 'starving', doing: null }).alert, null);
  assert.equal(badgeOf(healthy(), NOW, { on: true, satMin: hush, mood: 'starving', doing: null }).alert, null);
});

test('alert: đói THƯỜNG không lên icon — nổ mỗi ngày thì huy hiệu thành đèn luôn sáng', () => {
  const hush = REST_STAGE_MIN.dip - 1; // chưa tới mốc nào, nên đói thường phải im hẳn
  assert.equal(badgeOf(healthy(), NOW, { on: true, satMin: hush, mood: 'hungry', doing: null }).alert, null);
});

test('alert: bậc do một mình thang ngồi-lâu quyết, cơn đói không kéo bậc nào lên', () => {
  const mk = (satMin, mood) => badgeOf(healthy(), NOW, { on: true, satMin, mood, doing: null }).alert;
  const dip = REST_STAGE_MIN.dip + 1; // trong pha trũng, chưa trọn chu kỳ
  const spent = REST_STAGE_MIN.spent + 5; // trọn một chu kỳ
  const over = REST_STAGE_MIN.over + 20; // hai chu kỳ liền
  assert.equal(mk(dip, 'fine').level, 'dot');
  assert.equal(mk(dip, 'starving').level, 'dot', 'đói không được kéo chấm vàng thành đĩa đỏ');
  assert.equal(mk(spent, 'starving').level, 'bang');
  assert.equal(mk(over, 'starving').level, 'flood', 'over vẫn là mức mạnh nhất');
});

test('alert: có bậc rest thật thì tooltip nói cả hai việc, không nuốt mất cơn đói', () => {
  const spent = REST_STAGE_MIN.spent + 5;
  const at = (mood) => badgeOf(healthy(), NOW, { on: true, satMin: spent, mood, doing: null }).alert;
  const both = at('starving');
  assert.match(both.say, new RegExp(`${spent} phút`), 'câu ngồi-lâu là thứ đã bật đèn, phải có');
  assert.match(both.say, /đói lả/i, 'gỡ đói khỏi bậc icon không phải là giấu luôn cơn đói');
  assert.doesNotMatch(at('fine').say, /đói lả/i, 'không đói mà tooltip vẫn kể chuyện đói là bịa');
});

test('alert: câu ngồi-lâu đứng TRƯỚC câu đói — thứ tự là quyết định, không phải tình cờ', () => {
  const spent = REST_STAGE_MIN.spent + 5;
  const say = badgeOf(healthy(), NOW, { on: true, satMin: spent, mood: 'starving', doing: null }).alert.say;
  // Tooltip đọc từ trên xuống, nên dòng ĐẦU phải trả lời "vì sao icon đang sáng" — mà thứ
  // bật đèn là thang ngồi-lâu, không phải cơn đói. Hai phép `match` rời trên cùng chuỗi thì
  // đúng cả khi thứ tự đảo, nên bài này tách dòng ra và canh từng dòng một.
  const [first, second] = say.split('\n');
  assert.match(first, new RegExp(`${spent} phút`), 'dòng đầu phải là câu ngồi-lâu');
  assert.match(second, /đói lả/i, 'câu đói đi sau, ở vai một tin kèm');
});

test('alert: đang ĂN không bịt lời nhắc nghỉ — chỉ động tác nghỉ mới bịt', () => {
  const spent = REST_STAGE_MIN.spent + 5;
  const eat = { kind: 'food', id: 'pho', ms: 6e4, leftMs: 3e4 };
  const walk = { kind: 'move', id: 'walk', ms: 6e4, leftMs: 3e4 };
  const b = (doing) => badgeOf(healthy(), NOW, { on: true, satMin: spent, mood: 'starving', doing });
  assert.equal(b(eat).alert.level, 'bang', 'cái bát chữa cơn đói chứ không cắt mạch ngồi');
  assert.equal(b(walk).alert, null, 'vừa bấm đi bộ mà icon vẫn giục là huy hiệu cãi lại cú bấm');
  // Hai trường cạnh nhau phải hỏi `doing` bằng CÙNG một luật. Ca hỏng đã có thật: `rest`
  // nói "đã ngồi quá một chu kỳ" trong lúc `alert` im re, cùng một payload.
  assert.equal(b(eat).rest.stage, 'spent', 'trường rest phải nói y hệt trường alert');
  assert.equal(b(walk).rest.stage, null);
  assert.equal(badgeOf(healthy(), NOW, { on: false, satMin: 300, mood: 'starving' }).alert, null, 'tắt trò chơi là tắt cả icon');
});

/* ── Công tắc trò chơi: `/api/badge` là đường đã rò ───────────────────────────
   Mấy bài trên canh `src/badge.js`, còn khối này canh `server.js`, và nó ở đây vì đường rò
   là chính `/api/badge` — cửa duy nhất mà thanh menu đi qua. Ca hỏng đã đo được: cổng
   `on === false` chỉ đặt ở nhịp nền `petTick`, nên trò chơi đã tắt mà lượt hỏi của huy hiệu
   vẫn cộng tiền, vẫn quan sát nghỉ và vẫn ghi đĩa — đúng 30 giây một lần, suốt ngày, vì app
   Swift hỏi đúng nhịp ấy. Cái công tắc khi ấy chỉ tắt được phần nhìn thấy.

   Nên cổng chuyển vào `withPet`, chỗ MỌI đường vào sổ đều đi qua, và bài test phải chạy
   thật thân hàm đó chứ không so chuỗi: so chuỗi thì dời cổng đi một dòng vẫn xanh.

   Không import `server.js` — nạp file đó là mở cổng và hẹn giờ thật. Cắt thân `withPet` rồi
   dựng lại bằng `new Function` với đúng những cửa nó gọi, cùng cách `test/serverloop.test.js`
   làm với `petTick`. Chạm vào một tên ngoài danh sách ấy là ReferenceError, và đó cũng là
   một phép kiểm. */

const SERVER_SRC = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server.js'),
  'utf8',
);

/** Mọi tên `withPet` gọi ra ngoài thân nó. Thêm một cửa mới thì bài test này phải biết. */
const PET_DOORS = [
  'getState',
  'todayLocal',
  'readLedger',
  'emptyLedger',
  'accrue',
  'idleOf',
  'resolveBreak',
  'awayOf',
  'observeRest',
  'writeLedger',
  'petView',
];

/** Thân hàm `withPet` cắt từ mã nguồn, dựng lại thành một hàm gọi được. */
function loadWithPet(doors) {
  const from = SERVER_SRC.indexOf('async function withPet(');
  assert.ok(from > 0, 'không thấy `async function withPet(` — bài test này đã lạc khỏi mã');
  const to = SERVER_SRC.indexOf('\n}\n', from) + 2;
  assert.ok(to > from, 'không thấy chỗ đóng của `withPet`');
  const make = new Function(...PET_DOORS, `${SERVER_SRC.slice(from, to)}\nreturn withPet;`);
  return make(...PET_DOORS.map((k) => doors[k]));
}

/** Cửa giả kèm bộ đếm. `ledger` là sổ mà `readLedger` trả về. */
function petDoors(ledger) {
  const calls = { accrue: 0, observe: 0, write: 0 };
  const doors = {
    getState: async () => ({ usage: { ok: true, series: [{ day: '2026-09-10', usd: 1 }] } }),
    todayLocal: () => '2026-09-10',
    readLedger: async () => ledger,
    emptyLedger: (_series, today) => ({ on: true, credited: today }),
    accrue: (l) => (calls.accrue++, { ...l, coins: 9 }),
    idleOf: () => 0,
    resolveBreak: (l) => l,
    awayOf: () => 0,
    observeRest: (l) => (calls.observe++, l),
    writeLedger: async () => {
      calls.write++;
    },
    petView: (l) => ({ on: l.on !== false, coins: l.coins ?? 0 }),
  };
  return { calls, run: (action) => loadWithPet(doors)(action) };
}

test('công tắc tắt: lượt CHỈ ĐỌC không cộng tiền, không quan sát nghỉ, không ghi đĩa', async () => {
  const off = petDoors({ on: false, coins: 3 });
  const { view } = await off.run(null);
  assert.equal(off.calls.accrue, 0, 'trò chơi tắt mà vẫn cộng tiền thì công tắc chỉ tắt phần nhìn thấy');
  assert.equal(off.calls.observe, 0, 'tắt rồi thì mốc nghỉ không phải việc của lượt này');
  assert.equal(off.calls.write, 0, 'ghi đĩa 30 giây một lần cho một trò chơi đã tắt');
  assert.equal(view.on, false, 'vẫn phải trả về bản xem được, chỉ là không đụng gì vào sổ');
});

test('công tắc tắt: lượt NGƯỜI DÙNG BẤM vẫn chạy đủ, vì cú bấm bật lại đi qua đây', async () => {
  const off = petDoors({ on: false, coins: 3 });
  const { view } = await off.run((l) => ({ ledger: { ...l, on: true }, error: null }));
  assert.equal(off.calls.accrue, 1, 'bật lại phải cộng bù phần đã bỏ, không thì ví đứng yên');
  assert.equal(off.calls.write, 1, 'sổ đổi mà không ghi thì cú bấm mất luôn khi khởi động lại');
  assert.equal(view.on, true);
});

test('trò chơi bật: cổng không đụng vào gì, lượt chỉ đọc vẫn cộng tiền và vẫn quan sát nghỉ', async () => {
  const on = petDoors({ on: true, coins: 3 });
  await on.run(null);
  assert.equal(on.calls.accrue, 1, 'cộng tiền chạy ở mọi lượt kể cả lượt chỉ đọc — luật cũ, không được đổi');
  assert.equal(on.calls.observe, 1, 'mốc nghỉ quan sát theo lượt quét, không theo cú bấm');
});

test('chưa có sổ (lần chạy đầu) không phải là đã tắt — vẫn dựng và vẫn ghi', async () => {
  const first = petDoors(null);
  await first.run(null);
  assert.equal(first.calls.accrue, 1, '`ledger?.on` trên sổ null phải là undefined, đừng bắt nhầm thành tắt');
  assert.equal(first.calls.write, 1, 'sổ mới mà không ghi thì lần mở sau lại dựng lại từ đầu');
});
