import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accrue, buy, cancelBreak, emptyLedger, fullnessOf, moodOf, normWorn, petView,
  focusOf, focusMoodOf, observeRest, resolveBreak, startBreak, wear,
  FULL_MS, FOCUS_MS, BREAK_MS, COIN_PER_HOUR, EAT_MS, FOODS, ITEMS, MOVES, RATE,
  REST_RAMP_MS, SLOTS, doingOf,
} from '../src/pet.js';
import { ART, MOVE_ART, bulbRows, coinNum, focusGlass, glassRows, hungerBar } from '../public/lib/pet.js';
import { rawText } from '../public/lib/dom.js';
import { FOCUS_CELL_MS, FOCUS_DIP, MOVE_HOME, MOVE_IDS, MOVE_PARK, livePet, moveForHour, wakeOf, whereOf } from '../public/lib/petmath.js';
import { LOTS, PLACE_IDS, PLACES, ROADS, SCENE_SPOTS, STEP, TOWN_BOX, sizeOf } from '../public/lib/town.js';
import { lastHumanIn } from '../src/collect/sessions.js';
import { tableOf } from '../public/lib/i18n.js';

const DAY = 86400000;
const T0 = Date.parse('2026-08-05T09:00:00Z');

const series = (...pairs) => pairs.map(([day, cost]) => ({ day, cost }));

test('sổ mới KHÔNG cộng tiền của lịch sử, nhưng lấy trọn hôm nay', () => {
  // Đây là ca hỏng dễ nhất và tốn nhất: máy này đã tiêu $6.813 trước khi trò chơi tồn
  // tại. Cộng hết chỗ đó vào là giây đầu tiên đã mua sạch cửa hàng.
  const s = series(['2026-08-03', 4000], ['2026-08-04', 2800], ['2026-08-05', 50]);
  const l = accrue(emptyLedger(s, '2026-08-05', T0), s, '2026-08-05');
  assert.equal(Math.floor(l.coins), 50, 'chỉ được cộng phần của hôm nay');
  assert.equal(l.credited['2026-08-03'], 4000, 'ngày cũ phải được đánh dấu là đã cộng');
});

test('cộng tiền là IDEMPOTENT — quét lại mười lần không đẻ thêm xu', () => {
  // Trang tự vẽ lại 30 giây một lần và popover hỏi sổ mỗi lần mở. Nếu mỗi lượt hỏi lại
  // cộng một lần nữa thì ví phồng lên theo số lần nhìn, không theo số tiền tiêu.
  const s = series(['2026-08-05', 40]);
  let l = accrue(emptyLedger([], '2026-08-05', T0), s, '2026-08-05');
  const first = l.coins;
  for (let i = 0; i < 10; i++) l = accrue(l, s, '2026-08-05');
  assert.equal(l.coins, first);
});

test('tiêu thêm trong ngày thì chỉ cộng phần CHÊNH', () => {
  let l = accrue(emptyLedger([], '2026-08-05', T0), series(['2026-08-05', 40]), '2026-08-05');
  l = accrue(l, series(['2026-08-05', 62]), '2026-08-05');
  assert.equal(Math.round(l.coins), 62 * RATE);
});

test('tổng lịch sử TỤT xuống không làm mất xu, cũng không cộng lại', () => {
  // Claude Code tự xoá transcript cũ nên `cost` của một ngày có thể tụt giữa hai lượt
  // quét. Khoá theo ngày chịu được chuyện đó; một biến "đã cộng tới $X" thì không —
  // xem khối chú thích của `accrue`.
  let l = accrue(emptyLedger([], '2026-08-05', T0), series(['2026-08-05', 90]), '2026-08-05');
  l = accrue(l, series(['2026-08-05', 30]), '2026-08-05');
  assert.equal(Math.round(l.coins), 90, 'không được trừ đi');
  l = accrue(l, series(['2026-08-05', 90]), '2026-08-05');
  assert.equal(Math.round(l.coins), 90, 'và không được cộng lại lần hai');
});

test('sổ token lỗi (series rỗng) thì không đoán bừa đồng nào', () => {
  const l0 = emptyLedger([], '2026-08-05', T0);
  assert.equal(accrue(l0, [], '2026-08-05').coins, 0);
});

test('không đủ xu thì bị từ chối, và ví không suy suyển', () => {
  // Số dư đọc từ CHÍNH bảng giá, không viết cứng. Bản trước để cứng 5 xu và nó đứng vững
  // đúng tới lượt hạ giá đồ ăn: phở tụt xuống dưới 5 xu, phép mua thành công, và bài test
  // của cái ví lặng lẽ đổi nghĩa thành một phép mua trót lọt.
  const short = ITEMS.pho.price - 0.01;
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: short };
  const { ledger, error } = buy(l, 'pho', T0);
  assert.equal(error, 'không đủ xu');
  assert.equal(ledger.coins, short);
});

test('đồ trang trí mua một lần; lần hai bị từ chối chứ không lặng lẽ trừ tiền', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 500 };
  const one = buy(l, 'hat', T0);
  assert.equal(one.error, null);
  assert.deepEqual(one.ledger.owned, ['hat']);
  assert.equal(one.ledger.coins, 500 - ITEMS.hat.price);

  const two = buy(one.ledger, 'hat', T0);
  assert.equal(two.error, 'đã có rồi');
  assert.equal(two.ledger.coins, one.ledger.coins, 'không được trừ tiền lần hai');
});

test('mã món lạ bị từ chối', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  assert.equal(buy(l, 'constructor', T0).error, 'không có món này');
  assert.equal(buy(l, '__proto__', T0).error, 'không có món này');
});

test('độ no tụt theo ĐỒNG HỒ, không theo lượt quét', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  assert.equal(fullnessOf(l, T0), 1);
  assert.ok(Math.abs(fullnessOf(l, T0 + FULL_MS / 2) - 0.5) < 1e-9);
  assert.equal(fullnessOf(l, T0 + FULL_MS * 2), 0, 'chạm đáy rồi thì không âm');
});

test('cho ăn lúc đang no KHÔNG đẩy mốc ra tương lai', () => {
  // Cộng thẳng `fill` vào `fedAt` thì ăn ba bát phở lúc đang no sẽ khoá thanh ở mức đầy
  // suốt hai ngày, và cơn đói — thứ duy nhất làm nhân vật cần được để ý — biến mất.
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const fed = buy(l, 'pho', T0).ledger;
  assert.equal(fullnessOf(fed, T0), 1);
  assert.ok(fullnessOf(fed, T0 + 60000) < 1, 'một phút sau đã phải bắt đầu tụt');
});

test('cho ăn lúc đói thì no thêm đúng phần của món — nhưng phải ĂN XONG đã', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const now = T0 + FULL_MS; // đói lả
  const fed = buy(l, 'coffee', now).ledger;
  // Ngay lúc bấm thì CHƯA có gì: món ăn còn nguyên, cái bụng còn nguyên.
  assert.ok(fullnessOf(fed, now) < 1e-9, 'giây đầu chưa được no thêm miếng nào');
  // Hết một phút thì đúng bằng phần của món — TRỪ ĐI một phút đói đã trôi qua trong lúc
  // ăn. Phần trừ ấy phải có mặt trong phép kiểm chứ không được nới bằng dung sai: nó là
  // hệ quả thẳng của việc ăn tốn thời gian, và một bài test làm ngơ nó sẽ vẫn xanh vào
  // ngày ai đó lỡ tay cho `fedAt` nhảy tới tương lai.
  const want = ITEMS.coffee.fill - EAT_MS / FULL_MS;
  assert.ok(Math.abs(fullnessOf(fed, now + EAT_MS) - want) < 1e-9);
});

/**
 * Cái thanh phải BÒ, và con số trong sổ phải bò cùng nó.
 *
 * Đây là chỗ dễ làm sai nhất của cả lượt này: cách rẻ tiền là cộng đủ vào sổ ngay giây đầu
 * rồi cho CSS chạy một hoạt hình từ 20% lên 70%. Lúc ấy popover mở giữa chừng sẽ đọc ra
 * con số thật (70%) trong khi cửa hàng đang vẽ 45% — hai màn hình nói hai điều về cùng một
 * con vật, và không có chỗ nào trên trang nói cái nào đúng.
 */
test('ăn nửa chừng thì no ĐÚNG một nửa phần của món', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const now = T0 + FULL_MS;
  const fed = buy(l, 'pho', now).ledger;
  const half = fullnessOf(fed, now + EAT_MS / 2);
  assert.ok(Math.abs(half - ITEMS.pho.fill / 2) < 3e-3, `nửa chừng ra ${half}`);
  // Và nó phải TĂNG đều, không nhảy bậc: ba mốc liên tiếp phải xếp tăng dần.
  const a = fullnessOf(fed, now + EAT_MS * 0.25);
  const b = fullnessOf(fed, now + EAT_MS * 0.75);
  assert.ok(a < half && half < b, 'độ no phải bò lên, không nhảy');
});

test('đang ăn dở thì KHÔNG gọi thêm món — mỗi lúc một món thôi', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const one = buy(l, 'pho', T0).ledger;
  const two = buy(one, 'coffee', T0 + EAT_MS / 2);
  assert.equal(two.error, 'đang bận');
  assert.equal(two.ledger.coins, one.coins, 'bị từ chối thì không được trừ xu');
  assert.equal(two.ledger.meals, 1);
  // Hết một phút thì quán mở lại.
  assert.equal(buy(one, 'coffee', T0 + EAT_MS).error, null);
});

test('đồ TRANG TRÍ vẫn mua được trong lúc bận — nó không phải một việc phải làm', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const eating = buy(l, 'pho', T0).ledger;
  assert.equal(buy(eating, 'hat', T0 + 1000).error, null);
  const resting = startBreak(l, 'water', T0).ledger;
  assert.equal(buy(resting, 'hat', T0 + 1000).error, null);
});

test('hai việc không chồng nhau được, theo CẢ HAI chiều', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  assert.equal(startBreak(buy(l, 'pho', T0).ledger, 'walk', T0 + 1000).error, 'đang ăn dở');
  assert.equal(buy(startBreak(l, 'walk', T0).ledger, 'pho', T0 + 1000).error, 'đang bận');
});

test('việc đang làm gộp MỘT trường, và ăn xong thì nó tự tắt', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const eat = doingOf(buy(l, 'pho', T0).ledger, T0 + 20_000);
  assert.deepEqual({ kind: eat.kind, id: eat.id, ms: eat.ms }, { kind: 'food', id: 'pho', ms: EAT_MS });
  assert.equal(eat.leftMs, EAT_MS - 20_000);
  assert.equal(doingOf(buy(l, 'pho', T0).ledger, T0 + EAT_MS), null);

  const mv = doingOf(startBreak(l, 'walk', T0).ledger, T0 + 60_000);
  assert.deepEqual({ kind: mv.kind, id: mv.id, ms: mv.ms }, { kind: 'move', id: 'walk', ms: MOVES.walk.ms });
});

test('tâm trạng có đủ bốn bậc và không có kẽ hở', () => {
  assert.equal(moodOf(0), 'starving');
  assert.equal(moodOf(0.2), 'hungry');
  assert.equal(moodOf(0.6), 'fine');
  assert.equal(moodOf(1), 'stuffed');
});

test('ví ra màn hình giữ HAI chữ số lẻ, và luôn cắt XUỐNG', () => {
  // Chiều cắt là một quyết định về hành vi: cắt lên thì một sổ có 12,996 xu hiện thành
  // "13,00" ngay cạnh một món giá 13, người ta bấm, và server từ chối trong khi màn hình
  // vẫn đang nói họ có vừa đủ.
  assert.equal(petView({ ...emptyLedger([], '2026-08-05', T0), coins: 12.876 }, T0).coins, 12.87);
  assert.equal(petView({ ...emptyLedger([], '2026-08-05', T0), coins: 12.999 }, T0).coins, 12.99);
  // Rác dấu phẩy động không được ăn mất một xu: 0.29 * 100 ra 28.999999999999996 trong
  // JavaScript, và một phép `Math.floor` thẳng tay biến nó thành 0,28.
  assert.equal(petView({ ...emptyLedger([], '2026-08-05', T0), coins: 0.29 }, T0).coins, 0.29);
  assert.equal(petView({ ...emptyLedger([], '2026-08-05', T0), coins: 7 }, T0).coins, 7);
});

test('món đang ăn đứng cạnh nhân vật đúng bằng quãng ăn nó, rồi biến mất', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const fed = buy(l, 'banhmi', T0).ledger;
  assert.equal(petView(fed, T0 + EAT_MS / 2).doing.id, 'banhmi');
  // Hết giờ là hết, không nằm lại làm một tấm huy chương: cái hình phải nói "vừa ăn", chứ
  // không nói "có một ổ bánh mì ở đây".
  assert.equal(petView(fed, T0 + EAT_MS).doing, null);
  assert.equal(petView(fed, T0 + DAY).doing, null);
});

/**
 * Bảng GIÁ ở server và bảng HÌNH ở trình duyệt là hai file, và chúng phải khớp mã.
 *
 * Không gộp được: server không quyết định hình, còn trình duyệt thì không được quyết
 * định giá (mở DevTools là mua sạch). Cái nối chúng chỉ có thể là một bài test — nó bắt
 * đúng ca thêm món ở một bên mà quên bên kia, thứ mà chạy thật sẽ ra một ô trống hoặc
 * một món không mua nổi.
 */
test('mỗi món có đủ GIÁ, HÌNH và TÊN ở cả hai ngôn ngữ', () => {
  assert.deepEqual(Object.keys(ITEMS).sort(), Object.keys(ART).sort(), 'bảng giá và bảng hình lệch mã');

  const vi = tableOf('vi');
  const en = tableOf('en');
  for (const id of Object.keys(ITEMS)) {
    assert.ok(`pet.item.${id}` in vi, `thiếu tên VI cho ${id}`);
    assert.ok(`pet.item.${id}` in en, `thiếu tên EN cho ${id}`);
    const it = ITEMS[id];
    assert.ok(it.price > 0, `${id} phải có giá`);
    if (it.kind === 'food') assert.ok(it.fill > 0 && it.fill <= 1, `${id} phải no được`);
    else assert.ok(it.slot, `${id} phải có chỗ đứng trong khung trời`);
  }
});

test('sprite của mỗi món là lưới CHỮ NHẬT — hàng lệch nhau là hình vỡ', () => {
  for (const [id, a] of Object.entries(ART)) {
    const w = a.rows[0].length;
    for (const row of a.rows) assert.equal(row.length, w, `${id}: hàng "${row}" lệch bề rộng`);
  }
});

/* ── Tập trung ─────────────────────────────────────────────────────────────── */

test('tập trung cạn theo ĐỒNG HỒ và không âm', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  assert.equal(focusOf(l, T0), 1);
  assert.ok(Math.abs(focusOf(l, T0 + FOCUS_MS / 2) - 0.5) < 1e-9);
  assert.equal(focusOf(l, T0 + FOCUS_MS * 2), 0);
});

test('sổ đời cũ chưa có mốc nghỉ thì tập trung ĐẦY, không phải cạn', () => {
  // Trả 0 ở đây là bắn một lời nhắc sức khoẻ dựa trên một con số chưa từng được đo —
  // đúng kiểu bịa mà cả file này tránh. Chưa đo được thì im.
  const { restedAt, ...old } = emptyLedger([], '2026-08-05', T0);
  assert.equal(restedAt, new Date(T0).toISOString(), 'sổ mới phải CÓ mốc nghỉ');
  assert.equal(focusOf(old, T0 + FOCUS_MS * 3), 1);
});

test('ba bậc tập trung cắt đúng chỗ pha trũng bắt đầu', () => {
  assert.equal(focusMoodOf(1), 'sharp');
  assert.equal(focusMoodOf(0.23), 'sharp');
  assert.equal(focusMoodOf(0.22), 'dip');
  assert.equal(focusMoodOf(0.01), 'dip');
  assert.equal(focusMoodOf(0), 'spent');
});

test('đang làm thì KHÔNG đụng vào sổ — một mạch dài không sinh lượt ghi đĩa nào', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  assert.equal(observeRest(l, BREAK_MS - 1, T0 + FOCUS_MS), l, 'phải trả về chính sổ cũ');
});

test('sổ đời cũ được GIEO mốc ngay cả khi đang làm', () => {
  // Ca thật, bắt được lúc chạy: máy này dùng liên tục nên `idleMs` luôn dưới mốc nghỉ.
  // Không có nhánh gieo thì `restedAt` không bao giờ ra đời và thanh đứng đầy cả ngày.
  const { restedAt, ...old } = emptyLedger([], '2026-08-05', T0);
  assert.ok(restedAt);
  const seeded = observeRest(old, 5_000, T0);
  assert.equal(seeded.restedAt, new Date(T0).toISOString());
  assert.equal(observeRest(seeded, 5_000, T0 + 60_000), seeded, 'gieo xong thì thôi, không gieo lại');
});

test('vắng đủ lâu thì tập trung đầy lại', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  const now = T0 + FOCUS_MS; // đã cạn
  assert.equal(focusOf(l, now), 0);
  const rested = observeRest(l, BREAK_MS, now);
  assert.notEqual(rested, l);
  assert.equal(focusOf(rested, now), 1);
});

test('không có phiên nào sống cũng tính là nghỉ', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  assert.notEqual(observeRest(l, null, T0 + FOCUS_MS), l);
});

test('nghỉ liên tục KHÔNG ghi đĩa mỗi lượt quét', () => {
  // Vòng quét nền chạy 30 giây một lượt. Không có mốc chặn này thì một buổi tối không
  // ngồi máy là 960 lượt ghi lại một file y hệt.
  const l = observeRest(emptyLedger([], '2026-08-05', T0), null, T0);
  assert.equal(observeRest(l, null, T0 + 30_000), l, '30 giây sau: chưa đáng ghi');
  assert.notEqual(observeRest(l, null, T0 + 61_000), l, 'quá một phút: mới ghi');
  // Và cái mốc chặn ấy không được phép làm thanh sai quá một ô trên mười.
  assert.ok(focusOf(l, T0 + 60_000) > 0.98);
});

test('cà phê kéo lại một PHẦN tập trung, không phải tất cả', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const now = T0 + FOCUS_MS; // cạn sạch
  const woke = buy(l, 'coffee', now).ledger;
  const after = now + EAT_MS; // uống xong đã
  // Trừ đi một phút nhịp tập trung đã trôi trong lúc uống, cùng lý lẽ với phần độ no.
  assert.ok(Math.abs(focusOf(woke, after) - (ITEMS.coffee.wake - EAT_MS / FOCUS_MS)) < 1e-9);
  assert.equal(focusMoodOf(focusOf(woke, after)), 'sharp', 'một ly phải đủ thoát pha trũng');
  assert.ok(focusOf(woke, after) < 1, 'nhưng không được đầy — chỉ nghỉ mới đầy');
});

test('uống cà phê lúc đang tỉnh KHÔNG đẩy mốc ra tương lai', () => {
  // Cùng cái bẫy đã bắt được ở `fedAt`: cộng thẳng thì ba ly liên tiếp khoá thanh ở mức
  // đầy suốt bốn tiếng, và lời nhắc câm đúng quãng nó cần lên tiếng.
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const woke = buy(l, 'coffee', T0).ledger;
  assert.equal(focusOf(woke, T0), 1);
  assert.ok(focusOf(woke, T0 + 60_000) < 1, 'một phút sau đã phải bắt đầu tụt');
});

test('món không phải cà phê thì không đụng vào mốc nghỉ', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const fed = buy(l, 'pho', T0 + FOCUS_MS / 2).ledger;
  assert.equal(fed.restedAt, l.restedAt);
});

test('bản gửi ra trình duyệt có đủ tập trung, bậc và số phút đã ngồi', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  const v = petView(l, T0 + 78 * 60_000);
  assert.equal(v.satMin, 78);
  assert.equal(v.focusMood, 'dip', '78 phút là đã vào pha trũng của nhịp 90 phút');
  assert.equal(v.focusMs, FOCUS_MS);
});

test('mọi chữ của phần tập trung có đủ ở CẢ HAI ngôn ngữ', () => {
  const vi = tableOf('vi');
  const en = tableOf('en');
  const keys = [
    'pet.focus', 'pet.focusAria', 'pet.focusNote', 'pet.satMin', 'pet.satRested', 'pet.wakes',
    'pet.focusMood.sharp', 'pet.focusMood.dip', 'pet.focusMood.spent',
    'pet.nudge.dip', 'pet.nudge.spent', 'pet.nudge.afternoon', 'pet.nudge.night',
  ];
  for (const k of keys) {
    assert.ok(k in vi, `thiếu ${k} ở VI`);
    assert.ok(k in en, `thiếu ${k} ở EN`);
  }
});

test('mọi món trang trí đứng ở một chỗ CÓ THẬT, và chỗ nào cũng có hàng', () => {
  // Luật cũ là "không hai món nào chung chỗ" — đã đổi: giờ mỗi chỗ là một cái khe THAY
  // ĐƯỢC, nhiều món cùng đứng vào. Cái còn phải giữ là hai chiều của phép ánh xạ: không
  // món nào trỏ vào một chỗ không tồn tại (nó sẽ không bao giờ hiện ra), và không chỗ nào
  // rỗng hàng (cửa hàng sẽ có một tiêu đề không có gì bên dưới).
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.kind !== 'decor') continue;
    assert.ok(SLOTS.includes(it.slot), `${id} đứng ở chỗ lạ: ${it.slot}`);
  }
  for (const slot of SLOTS) {
    const n = Object.values(ITEMS).filter((i) => i.slot === slot).length;
    assert.ok(n > 0, `chỗ ${slot} không có món nào`);
  }
});

test('không món BÁN nào kéo tập trung quá nửa — đường về đầy chỉ có đứng dậy', () => {
  // Đây là luận điểm sức khoẻ của cả cửa hàng, và nó phải là một phép kiểm chứ không phải
  // một câu trong chú thích: thêm một món `wake: 0.9` là biến cái thanh tím thành nút
  // "bấm để hết mệt", đúng thứ mà lớp chỉ số này sinh ra để cản.
  for (const [id, it] of Object.entries(ITEMS)) {
    if (!it.wake) continue;
    assert.ok(it.wake <= 0.5, `${id} kéo lại ${it.wake} — quá trần 0,5 của món bán`);
  }
  assert.ok(Object.values(ITEMS).some((i) => i.wake), 'phải còn ít nhất một món tỉnh táo để phép kiểm có nghĩa');
});

/* ── Chỗ đứng và món đang bày ──────────────────────────────────────────────── */

test('mua đồ trang trí là ĐEO LUÔN, và món cũ ở chỗ đó không mất', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const one = buy(l, 'hat', T0).ledger;
  assert.equal(one.worn.head, 'hat');
  const two = buy(one, 'beanie', T0).ledger;
  assert.equal(two.worn.head, 'beanie', 'món mới lên đầu ngay');
  assert.deepEqual(two.owned.sort(), ['beanie', 'hat'], 'món cũ vẫn trong sổ, đổi lại được');
  assert.equal(wear(two, 'head', 'hat').ledger.worn.head, 'hat');
});

test('đeo món CHƯA MUA bị từ chối — nếu không thì mở DevTools là đội vương miện', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 0 };
  assert.equal(wear(l, 'head', 'crown').error, 'chưa mua món này');
  assert.equal(wear(l, 'head', 'crown').ledger, l);
});

test('đeo sai chỗ, chỗ lạ, mã lạ — cả ba bị chặn', () => {
  const l = buy({ ...emptyLedger([], '2026-08-05', T0), coins: 999 }, 'hat', T0).ledger;
  assert.equal(wear(l, 'left', 'hat').error, 'món này không đứng chỗ đó');
  assert.equal(wear(l, 'nowhere', 'hat').error, 'không có chỗ này');
  assert.equal(wear(l, 'head', 'constructor').error, 'không có món này');
  assert.equal(wear(l, 'head', 'pho').error, 'không có món này', 'đồ ăn không phải đồ đeo');
});

test('dọn trống một chỗ', () => {
  const l = buy({ ...emptyLedger([], '2026-08-05', T0), coins: 999 }, 'hat', T0).ledger;
  const bare = wear(l, 'head', null).ledger;
  assert.equal(bare.worn.head, undefined);
  assert.equal(wear(bare, 'head', null).ledger, bare, 'dọn chỗ đã trống thì không đụng vào sổ');
});

test('sổ đời cũ chưa có bảng đang-bày thì dựng lại từ đồ đã mua', () => {
  // Ca thật khi lên bản này: người đã tiêu 800 xu mua đồ, mà bản mới đọc `worn` trống nên
  // khung trời trắng trơn — mất sạch thứ họ đã trả tiền, không có gì giải thích.
  assert.deepEqual(normWorn(undefined, ['hat', 'plant', 'rainbow']), {
    head: 'hat', left: 'plant', back: 'rainbow',
  });
  // Và bảng bị sửa tay thì lọc ở cửa đọc, không để lọt xuống chỗ vẽ.
  assert.deepEqual(normWorn({ head: 'crown', left: 'constructor', right: 'hat' }, ['hat']), {});
});

/* ── Quãng nghỉ khai trước ─────────────────────────────────────────────────── */

test('quãng nghỉ chưa hết giờ thì không đụng vào sổ', () => {
  const started = startBreak(emptyLedger([], '2026-08-05', T0), 'water', T0).ledger;
  assert.equal(started.breakMs, MOVES.water.ms);
  assert.equal(resolveBreak(started, 0, T0 + MOVES.water.ms - 1), started);
});

test('nghỉ thật thì tập trung hồi lại ĐÚNG phần động tác ấy khai, và sổ đếm nhích lên', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  const at = T0 + FOCUS_MS; // đã cạn sạch
  const started = startBreak(l, 'stretch', at).ledger;
  const span = MOVES.stretch.ms;
  const done = resolveBreak(started, span, at + span);
  // Đoạn hồi bắt đầu lúc CHỐT, không lúc bấm — xem `REST_RAMP_MS`. Trong lúc nghỉ thì
  // chưa ai biết nó có tính hay không, nên cái thanh không được bò lên trước.
  assert.ok(focusOf(done, at + span) < 0.05, 'giây chốt thì thanh mới bắt đầu bò');
  // Vươn vai gỡ 45 phút khỏi một đồng hồ 90 phút, tức đúng một nửa thanh — không phải về
  // đầy. Trừ đi hai mươi giây đoạn hồi vừa trôi — 0,37% của một chu kỳ, chưa tới một phần
  // ba của một ô.
  const drift = REST_RAMP_MS / FOCUS_MS;
  const got = focusOf(done, at + span + REST_RAMP_MS);
  assert.ok(Math.abs(got - (wakeOf(MOVES.stretch) - drift)) < 0.005, `hồi ${got}`);
  assert.ok(got < 0.55 && got > 0.45, 'nửa thanh, không phải cả thanh');
  // Ra khỏi cửa thì mới về đầy — và đó là cả điểm của bậc thang này.
  const walked = resolveBreak(startBreak(l, 'walk', at).ledger, MOVES.walk.ms, at + MOVES.walk.ms);
  assert.ok(focusOf(walked, at + MOVES.walk.ms + REST_RAMP_MS) > 0.99, 'đi bộ thì về đầy');
  assert.equal(done.lastBreak.ok, true);
  assert.equal(done.breaks, 1);
  assert.equal(done.breakAt, null, 'chốt xong phải dọn quãng đi, không để nó chốt lần hai');
});

/**
 * Phần thưởng CỘNG DỒN và có TRẦN — không gán.
 *
 * Ca gán là ca hỏng theo hai chiều cùng lúc: uống nước lúc đã ngồi hai tiếng mà nhảy về đầy
 * thì cả bậc thang không tồn tại; còn uống nước lúc đang tỉnh 90% mà tụt về 22% thì một
 * quãng nghỉ vừa PHẠT người vừa nghỉ. Trần nằm ở hiện tại vì `satMinAt` đọc mốc nghỉ ra số
 * phút đã ngồi, và một mốc nằm ở tương lai là một số phút âm.
 */
test('quãng nghỉ CỘNG vào chỗ đang đứng, và không bao giờ vượt quá đầy', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  const spent = { ...l, restedAt: new Date(T0 - FOCUS_MS).toISOString() };
  const done = resolveBreak(startBreak(spent, 'water', T0).ledger, MOVES.water.ms, T0 + MOVES.water.ms);
  const drift = REST_RAMP_MS / FOCUS_MS;
  const after = focusOf(done, T0 + MOVES.water.ms + REST_RAMP_MS);
  assert.ok(Math.abs(after - (wakeOf(MOVES.water) - drift)) < 0.005, `cạn sạch thì hồi đúng phần khai, được ${after}`);

  // Đang gần đầy: cộng vào rồi CHẶN ở 1, không đẩy mốc ra tương lai.
  const fresh = { ...l, restedAt: new Date(T0 - 5 * 60_000).toISOString() };
  const done2 = resolveBreak(startBreak(fresh, 'water', T0).ledger, MOVES.water.ms, T0 + MOVES.water.ms);
  const t2 = T0 + MOVES.water.ms + REST_RAMP_MS;
  assert.ok(focusOf(done2, t2) > 0.99, 'đang tỉnh mà nghỉ thì đầy, không tụt xuống');
  assert.ok(Date.parse(done2.restedAt) <= T0 + MOVES.water.ms, 'mốc nghỉ không được rơi vào tương lai');
});

/**
 * Cái thanh phải BÒ trong lúc ăn, và nó phải bò bằng chính đồng hồ của trình duyệt.
 *
 * Đây là một lỗi đã nhìn thấy trên màn hình, và nó không phải lỗi của công thức: `ramped`
 * tính đúng đoạn dốc ấy từ lâu, nhưng nó chỉ được GỌI ở hai chỗ — server lúc trả lời, và
 * `loadPet` lúc mở lại trang. Giữa hai lượt hỏi cách nhau 30 giây thì `pet.full` là một
 * con số chết, nên suốt một phút ăn cái thanh đi ba bước: đứng im, nhảy ở giây ~30, nhảy
 * ở giây ~61. Không có phép kiểm nào đỏ, vì mọi hàm thuần đều đúng.
 *
 * Nên phép kiểm này đo đúng thứ đã hỏng: **bản sổ mà trình duyệt đang CẦM**, vặn tới bằng
 * `livePet`, không hỏi lại server lần nào. Nó cũng ghim luôn tính tuyến tính — hai đường
 * tụt song song nối bằng một đoạn dốc thì các bước cách đều, và một bước lệch nghĩa là ai
 * đó vừa nhét một hàm mượt vào giữa.
 */
test('ăn thì độ no bò lên đều, tính bằng đồng hồ của chính trình duyệt', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  const hungry = { ...l, coins: 50, fedAt: new Date(T0 - 0.75 * FULL_MS).toISOString() };
  const { ledger, error } = buy(hungry, 'banhmi', T0);
  assert.equal(error, null);

  // Đúng cái gói mà trình duyệt nhận được ở lượt bấm, không phải sổ server.
  const sent = petView(ledger, T0);
  const at = (ms) => livePet(sent, T0 + ms).full;

  assert.ok(Math.abs(sent.full - 0.25) < 0.005, `lúc bấm thì thanh vẫn ở chỗ cũ, được ${sent.full}`);
  assert.ok(at(30_000) > sent.full + 0.2, 'nửa quãng ăn mà thanh chưa nhúc nhích là bản cũ');
  assert.ok(Math.abs(at(EAT_MS) - 0.75) < 0.01, `ăn xong phải đúng 0,75, được ${at(EAT_MS)}`);

  const steps = [15_000, 30_000, 45_000, 60_000].map((ms, i, a) => at(ms) - at(i ? a[i - 1] : 0));
  for (const s of steps) {
    assert.ok(Math.abs(s - steps[0]) < 0.002, `bước không đều: ${steps.map((x) => x.toFixed(4)).join(' ')}`);
    assert.ok(s > 0, 'phải đi lên, không đứng');
  }

  // Hết quãng thì thôi bò — và tụt lại theo đúng nhịp đói cũ, không giữ nguyên.
  assert.ok(at(EAT_MS + 60_000) < at(EAT_MS), 'ăn xong là đói lại từ đó, không đứng đầy');
});

/**
 * Quãng nghỉ hồi tập trung cũng phải bò — và nó là ca KHÁC hẳn bữa ăn ở một chỗ.
 *
 * Đoạn hồi của bữa ăn chạy TRONG lúc ăn, nên `pet.doing` che được cho nó. Đoạn hồi của
 * quãng nghỉ thì bắt đầu đúng lúc quãng nghỉ KẾT THÚC (xem `REST_RAMP_MS`), tức lúc
 * `doing` vừa tắt — nên một nhịp vẽ chỉ trông vào `doing` sẽ bỏ trọn hai mươi giây ấy.
 */
test('nghỉ xong thì tập trung bò lên trong lúc KHÔNG còn việc gì đang chạy', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  const spent = { ...l, restedAt: new Date(T0 - FOCUS_MS).toISOString() };
  const end = T0 + MOVES.water.ms;
  const done = resolveBreak(startBreak(spent, 'water', T0).ledger, MOVES.water.ms, end);
  const sent = petView(done, end);

  assert.equal(sent.doing, null, 'nghỉ xong thì không còn việc nào đang chạy');
  const at = (ms) => livePet(sent, end + ms).focus;
  assert.ok(at(REST_RAMP_MS / 2) > at(0) + 0.05, 'giữa đoạn hồi mà đứng im là bỏ mất cả đoạn');
  assert.ok(at(REST_RAMP_MS) > at(REST_RAMP_MS / 2), 'cuối đoạn phải cao hơn giữa đoạn');
});

test('vẫn GÕ trong quãng đó thì KHÔNG tính — và cũng không phạt gì', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  const at = T0 + FOCUS_MS;
  const started = startBreak(l, 'walk', at).ledger;
  const span = MOVES.walk.ms;
  const done = resolveBreak(started, 30_000, at + span);
  assert.equal(done.lastBreak.ok, false);
  assert.equal(done.restedAt, l.restedAt, 'không được đụng vào mốc nghỉ');
  assert.equal(done.breaks, 0);
  assert.equal(done.coins, l.coins, 'trượt thì không mất xu — phép kiểm này sai được');
});

/**
 * Một lượt của NGƯỜI, tách khỏi hàng nghìn lượt ghi của máy.
 *
 * Đây là hạt nhân của phép sửa 5/8. Bản trước phép kiểm nhận `idleMs` — mtime transcript,
 * tức lượt ghi cuối của MÁY — nên một lượt chạy dài giữ nó quanh 0 suốt, mà đúng quãng ấy
 * mới là quãng người ta rảnh để đứng dậy. Đi bộ thật một phút trong lúc Claude đang chạy
 * thì bao giờ cũng bị huỷ: càng làm đúng càng chắc chắn trượt.
 *
 * Cả phép sửa đứng trên một phép phân biệt duy nhất, và nó phải đúng: kết quả công cụ cũng
 * ghi vào transcript dưới vai `user`. Đo trên máy này, một phiên có 2664 dòng `user` mà chỉ
 * 81 dòng là người thật gõ — nhận nhầm một dòng thôi là `humanAt` bằng đúng mtime và cả
 * lượt sửa này thành vô nghĩa mà không có gì báo.
 */
test('lượt gõ của NGƯỜI tách được khỏi lượt ghi của máy', () => {
  const line = (o) => JSON.stringify(o);
  const human = { type: 'user', userType: 'external', timestamp: '2026-08-05T10:31:20.886Z', message: {} };
  const tool = { type: 'user', userType: 'external', timestamp: '2026-08-05T10:44:00.000Z', toolUseResult: { ok: 1 } };
  const sub = { type: 'user', userType: 'external', isSidechain: true, timestamp: '2026-08-05T10:45:00.000Z' };
  const bot = { type: 'assistant', timestamp: '2026-08-05T10:46:00.000Z' };

  assert.equal(lastHumanIn([human, tool, sub, bot].map(line).join('\n')), Date.parse(human.timestamp),
    'chỉ lượt của người mới được tính, dù ba dòng kia mới hơn');
  assert.equal(lastHumanIn([tool, sub, bot].map(line).join('\n')), null,
    'không có lượt nào của người thì phải trả null — "không biết", không phải "vừa xong"');
  // Lấy lượt MỚI NHẤT, không phải lượt đầu tiên gặp.
  const later = { ...human, timestamp: '2026-08-05T11:00:00.000Z' };
  assert.equal(lastHumanIn([human, tool, later].map(line).join('\n')), Date.parse(later.timestamp));
  // Khối đọc từ đĩa cắt ngang một dòng ở đầu là chuyện thường; dòng cụt phải bị bỏ qua chứ
  // không được ném, và nó cũng luôn là dòng CŨ nhất trong khối.
  assert.equal(lastHumanIn(`{"type":"user","userTy\n${line(human)}`), Date.parse(human.timestamp));
});

test('không có phiên nào sống cũng tính là đã nghỉ', () => {
  const started = startBreak(emptyLedger([], '2026-08-05', T0), 'eyes', T0).ledger;
  assert.equal(resolveBreak(started, null, T0 + MOVES.eyes.ms).lastBreak.ok, true);
});

test('đang nghỉ dở thì không khởi động lại được', () => {
  const started = startBreak(emptyLedger([], '2026-08-05', T0), 'water', T0).ledger;
  assert.equal(startBreak(started, 'walk', T0 + 60_000).error, 'đang nghỉ rồi');
  assert.equal(startBreak(started, 'walk', T0 + 60_000).ledger.breakKind, 'water');
  assert.equal(cancelBreak(started).ledger.breakAt, null);
});

test('động tác lạ bị từ chối ngay ở hàm thuần, không đợi cửa HTTP', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  assert.equal(startBreak(l, 'constructor', T0).error, 'không có động tác này');
  assert.equal(startBreak(l, 'nap', T0).error, 'không có động tác này');
});

/**
 * Động tác nghỉ giờ là Ô HÀNG, nên nó phải có HÌNH — và bảng hình ấy cần chính cái phép
 * kiểm parity đang giữ bảng hàng hoá.
 *
 * `MOVE_ART` cố ý đứng NGOÀI `ART`: bài test ngay trên bắt `ART` khớp đúng mã với `ITEMS`
 * bên server, nên nhét đồ nghề vào đấy là phá phép kiểm đó. Đổi lại, chúng cần bảng canh
 * của riêng mình — thêm một động tác vào `MOVES` mà quên vẽ là một ô trống giữa lưới công
 * viên, đúng hạng lỗi mà bảng kia đang canh cho cửa hàng.
 */
test('mỗi động tác nghỉ có HÌNH, và hình là lưới CHỮ NHẬT', () => {
  assert.deepEqual(MOVE_IDS.slice().sort(), Object.keys(MOVE_ART).sort(), 'bảng động tác và bảng hình lệch mã');
  for (const [id, a] of Object.entries(MOVE_ART)) {
    const w = a.rows[0].length;
    for (const [i, row] of a.rows.entries()) {
      assert.equal(row.length, w, `${id} hàng ${i} dài ${row.length}, phải là ${w}`);
    }
  }
});

/**
 * BA BẬC, cắt theo chỗ bạn đứng lúc làm — và mọi con số phải suy ra được từ mô hình.
 *
 * Đây là chỗ dễ trượt trở lại nhất của cả file: "cho cái này hơn cái kia một tí" là đúng
 * loại trọng số bịa mà chốt `d-game` đã gỡ thanh XP vì nó. Nên bài test không chỉ hỏi
 * "chúng có khác nhau không", nó hỏi TỪNG con số lấy ở đâu ra.
 */
test('phần hồi của động tác nghỉ chia ba bậc, và bậc nào cũng suy được từ mô hình', () => {
  // Ra khỏi phòng → trọn chu kỳ. Đây là ca duy nhất khai "về đầy", và cửa hàng nói đúng câu
  // ấy cho đúng hai ô này.
  for (const id of MOVE_PARK) assert.equal(MOVES[id].back, FOCUS_MS, `${id} phải gỡ trọn chu kỳ`);
  // Rời ghế, vẫn trong phòng → nửa chu kỳ.
  assert.equal(MOVES.stretch.back, FOCUS_MS / 2);
  // Vẫn ngồi nguyên → đúng độ dài pha trũng, tức `FOCUS_DIP` của một chu kỳ.
  for (const id of ['water', 'eyes']) {
    assert.equal(MOVES[id].back, Math.round(FOCUS_DIP * FOCUS_MS), `${id} phải bằng đúng pha trũng`);
  }
  // Và bậc thang phải thật sự là một bậc thang: ngồi < đứng < ra ngoài.
  assert.ok(MOVES.water.back < MOVES.stretch.back);
  assert.ok(MOVES.stretch.back < MOVES.walk.back);
  // Không món BÁN nào được trèo lên bậc trên cùng — trần 0,5 của `wake` vẫn giữ, và cà phê
  // (0,40) phải nằm LỌT GIỮA hai bậc dưới. Đó là thứ làm bảng giá thành một phép chọn.
  assert.ok(ITEMS.coffee.wake > wakeOf(MOVES.water));
  assert.ok(ITEMS.coffee.wake < wakeOf(MOVES.stretch));
});

/**
 * Cả năm cùng MỘT PHÚT, và đúng một phút của bữa ăn.
 *
 * Không phải một sự trùng hợp cần chốt lại: nếu quãng nghỉ dài hơn hay ngắn hơn bữa ăn thì
 * dải "đang làm" ở đầu màn đang đếm ngược hai loại đồng hồ khác nhau dưới cùng một cái nhãn.
 */
test('mọi động tác nghỉ dài đúng một phút, bằng một bữa ăn', () => {
  for (const [id, m] of Object.entries(MOVES)) assert.equal(m.ms, EAT_MS, `${id} lệch nhịp bữa ăn`);
});

test('đầu giờ chiều thì gợi ý ra chỗ có NẮNG, không phải đi bộ', () => {
  // Bằng chứng nói về ánh sáng mạnh, không nói về việc đi lại — trước khi có ô `sun` thì
  // một cái tên phải gánh cả hai nghĩa. Xem `moveForHour`.
  assert.equal(moveForHour(14), 'sun');
  assert.equal(moveForHour(10), 'stretch');
  assert.equal(moveForHour(21), 'stretch');
});

test('mọi động tác nghỉ có đủ tên + câu bằng chứng ở cả hai ngôn ngữ', () => {
  // Câu `why` là điều kiện để một động tác được đứng trong bảng: một mẹo sức khoẻ không
  // nói được nó dựa vào đâu thì nó là một mẹo trên mạng, không phải một tính năng.
  const vi = tableOf('vi');
  const en = tableOf('en');
  for (const k of Object.keys(MOVES)) {
    for (const key of [`pet.move.${k}`, `pet.move.${k}.why`]) {
      assert.ok(key in vi, `thiếu ${key} ở VI`);
      assert.ok(key in en, `thiếu ${key} ở EN`);
    }
    assert.ok(MOVES[k].back > 0, `${k} không khai gỡ được phút nào`);
  }
});

test('mọi chữ của khối "cách tính" và chỗ đứng có đủ ở cả hai ngôn ngữ', () => {
  const vi = tableOf('vi');
  const en = tableOf('en');
  const keys = [
    'pet.how', 'pet.howHint', 'pet.howSrc', 'pet.parkHint',
    ...['home', 'park'].flatMap((w) => [`pet.secFree.${w}`, `pet.freeHint.${w}`]),
    'pet.slotEmpty', 'pet.wear', 'pet.wearOff', 'pet.moveMin', 'pet.moveBest',
    'pet.breakWatch', 'pet.breakStop', 'pet.breakOk', 'pet.breakBusy',
    ...SLOTS.map((s) => `pet.slot.${s}`),
    ...['coin', 'full', 'focus', 'price'].flatMap((k) => [`pet.how.${k}.t`, `pet.how.${k}.f`, `pet.how.${k}.p`]),
    ...['rest', 'dip', 'wake', 'eat', 'no'].flatMap((k) => [`pet.how.${k}.t`, `pet.how.${k}.p`]),
    'pet.free', 'pet.wakesFull', 'pet.oneAtATime', 'pet.eatingNote',
  ];
  for (const k of keys) {
    assert.ok(k in vi, `thiếu ${k} ở VI`);
    assert.ok(k in en, `thiếu ${k} ở EN`);
  }
});


/* ── Bảng giá suy ra ────────────────────────────────────────────────────────── */

/**
 * Bài test giữ cho giá đồ ăn KHÔNG quay lại thành mấy con số đặt tay.
 *
 * Nó dựng lại đúng công thức thay vì đọc một hằng số đã tính sẵn — nếu không thì nó chỉ
 * đang so `ITEMS.pho.price` với `ITEMS.pho.price`, và một cái giá gõ đè lên vẫn lọt.
 */
test('giá mỗi món ăn = số GIỜ nó mua cho bạn, ở đúng một tỉ giá', () => {
  const h = (ms) => ms / 3600000;
  for (const id of FOODS) {
    const it = ITEMS[id];
    const want = (it.fill * h(FULL_MS) + (it.wake ?? 0) * h(FOCUS_MS)) * COIN_PER_HOUR;
    // Sai số một nửa xu lẻ: giá cất trong bảng đã làm tròn tới hai chữ số (sô-cô-la ra
    // đúng 0,975), nên phép so phải chấp nhận đúng cái nửa bậc ấy chứ không hơn.
    assert.ok(Math.abs(it.price - want) <= 0.0051, `${id}: ${it.price} xu, công thức ra ${want}`);
  }
});

test('1 xu mua đúng 1 giờ no — chỗ neo của cả bảng giá', () => {
  // Chốt riêng vì đây là câu mà khối "cách tính" nói ra với người đọc, và một câu nói ra
  // với người đọc thì phải có phép kiểm của nó.
  const perBar = FULL_MS / 3600000 * COIN_PER_HOUR;
  assert.equal(perBar, 5, 'thanh no đầy phải giá đúng 5 xu ở nhịp 5 giờ');
});

/**
 * Không món ăn nào ĐÈ BẸP món khác — rẻ hơn mà lại hơn ở mọi mặt.
 *
 * Đây là ca mà bảng giá đặt tay đã mắc hai lần và không ai thấy: cà phê 6 xu vừa rẻ hơn
 * vừa hơn sô-cô-la 7 xu ở cả no lẫn tỉnh táo, còn trà xanh 9 xu thì hơn hẳn kem 9 xu ở
 * đúng cùng giá. Món bị đè thì không có lý do nào để tồn tại ngoài việc chiếm một ô.
 */
test('không món ăn nào rẻ hơn mà lại hơn món khác ở mọi mặt', () => {
  for (const a of FOODS) {
    for (const b of FOODS) {
      if (a === b) continue;
      const A = ITEMS[a];
      const B = ITEMS[b];
      const beats =
        A.price <= B.price &&
        A.fill >= B.fill &&
        (A.wake ?? 0) >= (B.wake ?? 0) &&
        (A.price < B.price || A.fill > B.fill || (A.wake ?? 0) > (B.wake ?? 0));
      assert.ok(!beats, `${a} đè bẹp ${b} — rẻ hơn hoặc bằng mà hơn ở mọi mặt`);
    }
  }
});

test('tiền ăn một ngày làm việc không nuốt trọn một ngày thu nhập nhẹ', () => {
  // Ràng buộc THẬT, không phải thẩm mỹ: đo trên máy này một ngày nhẹ vào chừng 50 xu. Đây
  // đúng là chỗ bảng giá cũ hỏng — nó ngốn 50–60 xu cho một ngày ăn, tức là cửa hàng trang
  // trí thành thứ không bao giờ với tới.
  const bars = 10 / (FULL_MS / 3600000); // ngày làm 10 tiếng cần ngần này lượt no đầy
  const cheapest = Math.min(...FOODS.map((id) => ITEMS[id].price / ITEMS[id].fill));
  assert.ok(bars * cheapest <= 12.5, `một ngày ăn tốn ${bars * cheapest} xu — quá một phần tư ngày nhẹ`);
});

test('viết số xu: nguyên thì trần, có lẻ thì ĐÚNG hai chữ số', () => {
  // Hai chữ số cố định chứ không cắt số 0 cuối: ví gần như không bao giờ tròn, nên cắt số
  // 0 là bề rộng con số nhảy qua lại mỗi lượt quét.
  assert.equal(coinNum(60), '60');
  assert.equal(coinNum(1.85), '1.85');
  assert.equal(coinNum(12.4), '12.40');
  assert.equal(coinNum(0.98), '0.98');
  assert.equal(coinNum(undefined), '0');
});

test('mua nhiều lượt KHÔNG để lại rác dấu phẩy động trong sổ', () => {
  // `spent` chỉ cộng dồn mấy con số hai chữ số lẻ, nên nó phải đọc được: một sổ trên đĩa
  // ghi `0.30000000000000004` là một sổ không ai soi tay được.
  let l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  // Cách nhau đúng một quãng ăn: từ lượt này, hai món trong cùng một phút thì món thứ hai
  // bị từ chối (xem cửa "đang bận" trong `buy`).
  ['socola', 'tea', 'coffee', 'socola'].forEach((id, i) => {
    l = buy(l, id, T0 + i * EAT_MS).ledger;
  });
  const frac = String(l.spent).split('.')[1] ?? '';
  assert.ok(frac.length <= 2, `spent = ${l.spent} — thừa chữ số lẻ`);
  // Vế phải phải làm tròn, và chính chỗ đó là bằng chứng: cộng bốn cái giá bằng phép cộng
  // trần ra 5.1899999999999995, đúng con số mà sổ sẽ mang nếu `buy` không làm tròn lúc ghi.
  const want = ITEMS.socola.price * 2 + ITEMS.tea.price + ITEMS.coffee.price;
  assert.equal(l.spent, Math.round(want * 100) / 100);
});

/* ── Thị trấn ───────────────────────────────────────────────────────────────── */

test('mỗi chỗ trong thị trấn có HÌNH và có TÊN ở cả hai ngôn ngữ', () => {
  const vi = tableOf('vi');
  const en = tableOf('en');
  for (const p of PLACES) {
    assert.ok(p.rows.length, `${p.id} không có hình`);
    assert.ok(`town.${p.id}` in vi, `thiếu town.${p.id} ở VI`);
    assert.ok(`town.${p.id}` in en, `thiếu town.${p.id} ở EN`);
  }
  for (const k of ['town.lot', 'town.lotNote', 'pet.homeHint', 'pet.homeBare', 'pet.noMoves']) {
    assert.ok(k in vi, `thiếu ${k} ở VI`);
    assert.ok(k in en, `thiếu ${k} ở EN`);
  }
});

test('hình toà nhà là lưới CHỮ NHẬT — hàng lệch nhau là hình vỡ', () => {
  for (const p of PLACES) {
    const w = p.rows[0].length;
    for (const [i, row] of p.rows.entries()) {
      assert.equal(row.length, w, `${p.id} hàng ${i} dài ${row.length}, phải là ${w}`);
    }
  }
});

/**
 * Mọi ký tự trong hình phải có tên màu, và mọi tên màu phải có ký tự dùng tới.
 *
 * Hụt một chiều là một lỗi CÂM: `pixels` không ném khi gặp ký tự lạ, nó chỉ trả về một ô
 * không mang class nào, tức một ô `--art-base` — kem nhạt. Trên một bức tường kem thì mấy ô
 * ấy biến mất hẳn; trên mái thì chúng đọc thành một vệt loang. Lượt vẽ lại kiến trúc này
 * thêm bảy ký tự mới vào bốn chỗ, và đó đúng là lúc dễ quên nhất.
 *
 * Chiều ngược lại (tên màu thừa) không làm hỏng hình, nhưng nó là dấu vết của một chi tiết
 * đã bị xoá mà bảng màu còn giữ chỗ — và cái chỗ ấy là thứ lượt sau sẽ đọc như một lời hứa.
 */
test('bảng màu và hình khớp nhau CẢ HAI CHIỀU', () => {
  for (const p of PLACES) {
    const used = new Set();
    for (const row of p.rows) for (const c of row) if (c !== '.') used.add(c);
    for (const c of used) assert.ok(c in p.chars, `${p.id}: ký tự '${c}' không có tên màu — nó sẽ là một ô kem câm`);
    for (const c of Object.keys(p.chars)) assert.ok(used.has(c), `${p.id}: tên màu '${c}' không còn ký tự nào dùng`);
  }
});

/**
 * Ba cửa hàng phải khác nhau ở DÁNG, không chỉ ở màu.
 *
 * Đây là bài test viết ra từ đúng một câu người dùng nói: nhìn ba toà nhà mà không đọc ra
 * cái nào là quán ăn, cái nào là tiệm trang trí, cái nào là thư viện. Lúc ấy cả ba đều là
 * một mặt thoi phẳng trên hai vách, khác nhau ở màu mái và ở mấy vật cắm thêm cỡ vài chục
 * pixel — mà màu mái thì theme daltonized bóp phẳng, và bản in đen trắng bóp phẳng nốt.
 *
 * Nên phép kiểm này BỎ MÀU đi: nó chỉ giữ lại tập ô CÓ VẼ, neo đáy-giữa đúng như
 * `.place-art` neo, rồi hỏi hai hình khác nhau bao nhiêu phần. Đo trên bản lượt này: quán
 * ăn ↔ tiệm trang trí 20%, quán ăn ↔ thư viện 24%, tiệm trang trí ↔ thư viện 17%. Ngưỡng
 * 12% chừa chỗ cho việc sửa vặt mà vẫn đỏ ngay nếu hai toà nhà quay về cùng một khối hộp.
 */
test('ba cửa hàng khác nhau ở DÁNG, không chỉ ở màu', () => {
  const shape = (p) => {
    const H = p.rows.length;
    const W = p.rows[0].length;
    const on = new Set();
    p.rows.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && on.add(`${x - (W - 1) / 2},${y - (H - 1)}`)));
    return on;
  };
  const shops = ['food', 'decor', 'library'].map((id) => PLACES.find((p) => p.id === id));
  for (const s of shops) assert.ok(s, 'thiếu một trong ba cửa hàng');
  const arts = shops.map(shape);
  for (let i = 0; i < arts.length; i++) {
    for (let j = i + 1; j < arts.length; j++) {
      const union = new Set([...arts[i], ...arts[j]]);
      let apart = 0;
      for (const cell of union) if (arts[i].has(cell) !== arts[j].has(cell)) apart++;
      const ratio = apart / union.size;
      assert.ok(
        ratio >= 0.12,
        `${shops[i].id} và ${shops[j].id} chỉ khác nhau ${(ratio * 100).toFixed(1)}% số ô — bỏ màu đi là hai hình một khối`,
      );
    }
  }
});

test('nhà mình TO NHẤT và đứng GIỮA phố', () => {
  // Cả hai đều là yêu cầu đọc ra được bằng mắt, nên cả hai phải có phép kiểm — một lượt
  // thêm toà nhà thứ sáu vào cuối hàng là nhà mình lệch khỏi giữa mà không ai thấy.
  const size = (p) => p.rows.length * Math.max(...p.rows.map((r) => r.length));
  const home = PLACES.find((p) => p.id === 'home');
  for (const p of PLACES) {
    if (p.id !== 'home') assert.ok(size(home) > size(p), `${p.id} không nhỏ hơn nhà mình`);
  }
  // "Ở giữa" giờ là một toạ độ, không phải một chỉ số trong mảng: nhà đứng ở GỐC của lưới
  // đẳng cự, và bốn hàng quán vây quanh nó ở bốn ô chéo liền kề.
  const home2 = PLACES.find((p) => p.id === 'home');
  assert.deepEqual({ x: home2.x, y: home2.y }, { x: 0, y: 0 }, 'nhà mình phải ở gốc lưới');
});

/**
 * Mọi thứ trên bản đồ phải nằm trên ĐÚNG một lưới đẳng cự.
 *
 * Bước lưới đọc thẳng từ `STEP` bên `town.js`, và một mắt lưới hợp lệ luôn có
 * `x/STEP.x + y/STEP.y` chẵn — đó chính
 * là điều kiện `(a−b) + (a+b) = 2a`. Gõ tay một cặp số lệch nửa bước thì toà nhà ấy đứng
 * chênh vênh giữa hai ô, và không có chỗ nào trên màn hình nói ra vì sao trông nó sai.
 *
 * Cả hai số còn phải chia hết cho 4, tức cho đúng một Ô của lưới pixel. Đó là điều kiện mới
 * mà đường xá đặt ra: một đoạn đường nối hai mắt lưới lẻ nửa ô thì hai đầu của nó không
 * thể cùng rơi đúng vào lưới, và chỗ nối sẽ lệch.
 */
test('mọi chỗ đứng rơi đúng vào một mắt lưới đẳng cự', () => {
  for (const s of [...PLACES, ...LOTS]) {
    // `Math.abs` vì `-104 % 104` trong JavaScript ra `-0`, mà `-0` thì trượt `assert.equal`
    // với `0` — một bài test đỏ vì dấu của số không, không vì bản đồ sai.
    assert.equal(Math.abs(s.x % STEP.x), 0, `x = ${s.x} không phải bội của bước lưới`);
    assert.equal(Math.abs(s.y % STEP.y), 0, `y = ${s.y} không phải bội của bước lưới`);
    assert.equal(Math.abs((s.x / STEP.x + s.y / STEP.y) % 2), 0, `(${s.x}, ${s.y}) rơi vào giữa hai mắt lưới`);
    // Bước lưới phải đúng 2:1, y hệt độ dốc mà mọi sprite được dựng theo. Lệch một pixel ở
    // đây là cả thị trấn đứng trên một mặt phẳng khác với mặt phẳng nó được vẽ cho.
    assert.equal(STEP.x / STEP.y, 2, 'bước lưới phải giữ đúng độ dốc 2:1');
    // …và rơi đúng vào lưới pixel, không lệch nửa ô.
    assert.equal(Math.abs(s.x % 4), 0, `x = ${s.x} lệch khỏi lưới pixel`);
    assert.equal(Math.abs(s.y % 4), 0, `y = ${s.y} lệch khỏi lưới pixel`);
  }
});

/**
 * Đỉnh dưới của mặt nền phải nằm ở ĐÁY-GIỮA sprite.
 *
 * `.place-art` neo bằng `bottom: 0` cộng `translate: -50%`, tức nó tin rằng chân của mọi
 * toà nhà nằm chính giữa hàng cuối. Một sprite chừa vài hàng trống dưới đáy — chuyện dễ
 * xảy ra khi nới cao thêm một khối — sẽ lơ lửng bên trên mặt đất, và mắt đọc ra ngay là
 * sai mà không chỉ được chỗ.
 */
test('mọi sprite có chân ở đáy-giữa, để cả thị trấn đứng trên một mặt đất', () => {
  for (const p of PLACES) {
    const last = p.rows[p.rows.length - 1];
    const on = [...last].map((c, i) => (c === '.' ? -1 : i)).filter((i) => i >= 0);
    assert.ok(on.length, `${p.id}: hàng cuối trống — sprite đang lơ lửng`);
    const mid = (on[0] + on[on.length - 1]) / 2;
    assert.equal(mid, (last.length - 1) / 2, `${p.id}: chân lệch khỏi giữa`);
  }
});

/**
 * Sàn nhà và đồ đạc trong nhà KHÔNG được dùng chung một sắc.
 *
 * Đây là lỗi người dùng báo 5/8, và nó thuộc loại chỉ mở trang ra nhìn mới thấy: sàn mang
 * `broth`/`dim`, cái bàn mang `dim`/`broth` — cùng một cặp màu, đảo chỗ. Cái bàn không mờ
 * đi, nó BIẾN MẤT vào sàn; chỉ còn đường viền `ink` nói rằng có gì đó ở đấy.
 *
 * Kiểm được bằng máy vì cả hai đều khai màu bằng CHỮ trong `chars` — bài test hỏi bảng tra
 * màu, không hỏi mấy pixel. Và nó chốt luôn cho lần thêm đồ sau: món thứ năm trong phòng
 * cũng phải trả lời đúng câu hỏi này.
 */
test('sàn nhà không mượn sắc của bất kỳ món đồ nào trong phòng', () => {
  const home = PLACES.find((p) => p.id === 'home');
  // `F` mặt sàn, `e` rãnh ván. `N`/`M`/`O` là ba mặt của cái bàn, và cái kệ dùng lại chúng.
  const floor = new Set([home.chars.F, home.chars.e]);
  for (const ch of ['N', 'M', 'O']) {
    assert.ok(home.chars[ch], `ký tự đồ đạc '${ch}' phải có tên màu`);
    assert.ok(!floor.has(home.chars[ch]), `đồ đạc '${ch}' mang đúng sắc sàn (${home.chars[ch]}) — nó sẽ tàng hình`);
  }
  // Hai sắc sàn phải khác nhau, nếu không thì rãnh ván không tồn tại.
  assert.notEqual(home.chars.F, home.chars.e, 'mặt sàn và rãnh ván trùng sắc — sàn thành một mảng phẳng');
});

/**
 * Hộp bao phải CHỨA HẾT mọi thứ đang đứng trên bản đồ.
 *
 * `TOWN_BOX` là thứ `.town-map` dùng để khai bề rộng thật rồi co lại vừa khung chứa, mà
 * khung thì `overflow: hidden` — tính hụt một bên là cắt mất một toà nhà. Ba con số ấy
 * trước đây viết cứng trong CSS và đã chết lặng lẽ đúng như vậy khi thị trấn nở ra.
 */
test('hộp bao của bản đồ chứa trọn mọi thứ đứng trên nó', () => {
  for (const p of PLACES) {
    const s = sizeOf(p.rows);
    assert.ok(p.x - s.w / 2 + TOWN_BOX.ox >= 0, `${p.id} thò ra mép trái`);
    assert.ok(p.x + s.w / 2 + TOWN_BOX.ox <= TOWN_BOX.w, `${p.id} thò ra mép phải`);
    assert.ok(p.y - s.h + TOWN_BOX.oy >= 0, `${p.id} thò lên trên mép`);
    assert.ok(p.y + TOWN_BOX.oy <= TOWN_BOX.h, `${p.id} thò xuống dưới mép`);
  }
  // Biển tên treo DƯỚI chân toà nhà thấp nhất, nên đáy hộp phải còn chừa chỗ cho nó.
  const lowest = Math.max(...[...PLACES, ...LOTS].map((s) => s.y));
  assert.ok(TOWN_BOX.h - (lowest + TOWN_BOX.oy) >= 20, 'không còn chỗ cho tấm biển dưới chân nhà thấp nhất');
});

test('mỗi chỗ đi được có một khối để mở, và ô đất thì không đi được', () => {
  // Bảng `PANEL` bên `views/pet.js` không nhập được ở đây (nó chạm DOM), nên chốt phần
  // chắc chắn kiểm được: danh sách mã chỗ là ĐÓNG và đủ số ô đất để thị trấn có RÌA.
  assert.deepEqual(PLACE_IDS, ['park', 'food', 'home', 'decor', 'library']);
  assert.ok(LOTS.length > 0 && LOTS.length < PLACES.length, 'ô đất phải có, nhưng ít hơn số nhà');
  // Và không ô đất nào giẫm lên một toà nhà — hai vật cùng một mắt lưới là hai vật chồng
  // khít lên nhau, thứ mà bản đồ không có cách nào nói ra.
  const taken = new Set(PLACES.map((p) => `${p.x},${p.y}`));
  for (const l of LOTS) assert.ok(!taken.has(`${l.x},${l.y}`), `ô đất ${l.x},${l.y} trùng chỗ một toà nhà`);
});


/**
 * Đồ UỐNG thì cạn dần bên trong, đồ CẦM TAY thì ngắn dần đi.
 *
 * Luật treo vào cách vẽ chứ không vào loại món (xem `drawArt`), nên phép kiểm cũng phải hỏi
 * cái hình: món nào khai `fill` thì mấy ký tự ấy phải CÓ THẬT trong lưới, và phải còn lại
 * một cái vỏ sau khi bóc chúng ra. Khai một ký tự không tồn tại là một cốc nước không bao
 * giờ vơi; khai hết sạch ký tự của hình là một cái cốc biến mất ngay giây đầu, để lại một ô
 * trống — cả hai đều lặng lẽ, và cả hai chỉ thấy được khi ngồi nhìn đủ một phút.
 */
test('món có vỏ thì RUỘT vơi đi và VỎ ở lại; món cầm tay thì không khai ruột', () => {
  const withFill = Object.entries(ART).filter(([, a]) => a.fill);
  assert.ok(withFill.length >= 5, 'phải có ít nhất năm món đựng trong vỏ');
  for (const [id, a] of withFill) {
    const cells = a.rows.join('');
    for (const ch of a.fill) {
      assert.ok(cells.includes(ch), `${id}: khai ruột "${ch}" nhưng hình không có ô nào mang nó`);
      assert.ok(a.chars[ch], `${id}: ruột "${ch}" chưa được gán màu`);
    }
    const shell = [...cells].filter((c) => c !== '.' && !a.fill.includes(c));
    assert.ok(shell.length >= 8, `${id}: bóc ruột ra thì không còn cái vỏ nào`);
  }
  // Bốn món cầm tay: cả vật ngắn dần, nên chúng KHÔNG được khai ruột — khai rồi thì thanh
  // sô-cô-la sẽ để lại một cái "vỏ" là chính nó, đứng nguyên hết một phút.
  for (const id of ['socola', 'banhmi', 'xoi', 'kem']) {
    assert.equal(ART[id].fill, undefined, `${id} cầm trên tay, không có vỏ để mà cạn`);
  }
  // Cốc nước là món DUY NHẤT trong bảng đồ nghề có ruột; bốn món kia không dùng hết được.
  assert.ok(MOVE_ART.water.fill, 'cốc nước phải cạn được');
  for (const id of MOVE_IDS.filter((k) => k !== 'water')) {
    assert.equal(MOVE_ART[id].fill, undefined, `${id} là đồ nghề, không phải thứ dùng hết`);
  }
});

/**
 * Mỗi động tác có đúng MỘT chỗ, và ăn thì luôn ở nhà.
 *
 * Một trường `where` quyết ba chuyện cùng lúc: ô hàng hiện ở khối nào, quản gia đứng ở đâu
 * trên bản đồ, và khung cảnh popover có mọc cây ra không. Nếu bảng này thủng — một động tác
 * mới thêm vào mà quên khai chỗ — thì cả ba bề mặt cùng sai theo một kiểu khó lần ra: ô
 * hàng biến mất khỏi cả hai khối, và nhân vật đứng ở nhà làm một việc ngoài trời.
 */
test('mỗi động tác thuộc đúng MỘT chỗ, và không động tác nào rơi ra ngoài', () => {
  assert.deepEqual([...MOVE_HOME, ...MOVE_PARK].sort(), [...MOVE_IDS].sort(), 'có động tác rơi ra ngoài hoặc bị đếm hai lần');
  for (const id of MOVE_IDS) {
    assert.ok(['home', 'park'].includes(MOVES[id].where), `${id} khai một chỗ không có trên bản đồ`);
    assert.equal(whereOf({ kind: 'move', id }), MOVES[id].where);
  }
  // Ba việc làm được ngay tại bàn, hai việc phải ra khỏi cửa. Con số ấy là cả cái lý do
  // tách khối, nên nó phải có chốt.
  assert.deepEqual(MOVE_HOME, ['water', 'eyes', 'stretch']);
  assert.deepEqual(MOVE_PARK, ['walk', 'sun']);
  // Ăn thì luôn ở nhà — bàn ăn ở trong nhà, và một bát phở mang ra công viên là một cảnh
  // khác hẳn cảnh mà EAT_MS đang kể.
  assert.equal(whereOf({ kind: 'food', id: 'pho' }), 'home');
  // Rảnh cũng ở nhà, và một mã lạ trong sổ chép tay cũng vậy: về nhà là cái mặc định an
  // toàn, vì nhà là chỗ duy nhất luôn có trên bản đồ.
  assert.equal(whereOf(null), 'home');
  assert.equal(whereOf({ kind: 'move', id: 'constructor' }), 'home');
});

/**
 * Động tác hợp giờ phải là một động tác CÓ THẬT trên bản đồ.
 *
 * `moveForHour` gắn nhãn "hợp lúc này" lên một ô hàng, mà ô hàng thì nằm trong một khối cụ
 * thể. Trả về một mã không có trong `MOVES` là một cái nhãn không bao giờ hiện ra ở đâu cả.
 */
test('gợi ý theo giờ luôn trỏ vào một động tác có thật', () => {
  for (let h = 0; h < 24; h++) assert.ok(MOVE_IDS.includes(moveForHour(h)), `giờ ${h} trỏ vào mã lạ`);
  assert.equal(moveForHour(14), 'sun', 'đầu giờ chiều thì gợi ý ra chỗ có nắng');
  assert.equal(MOVES.sun.where, 'park', 'và chỗ có nắng thì phải ở ngoài trời');
});

/**
 * Đường xá phải nằm trên đúng hai TRỤC của lưới, không phải hai đường chéo bất kỳ.
 *
 * Một đoạn đường lệch độ dốc là vật duy nhất trên bản đồ không theo phối cảnh, và ở CSS thì
 * nó lệch bằng một góc gõ tay (`skewY(26,565°)`) — tức con số ấy đang sống ở hai chỗ. Phép
 * kiểm này canh chỗ thứ nhất: tâm đoạn đường phải rơi vào một điểm mà đường dốc 1:2 đi qua.
 */
test('mọi đoạn đường chạy đúng độ dốc 2:1 của mặt đất', () => {
  assert.ok(ROADS.length >= 4, 'thị trấn phải có mạng đường, không phải một đoạn lẻ');
  for (const r of ROADS) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    // Tâm đoạn nằm trên đường dốc ±1/2 đi qua gốc, hoặc song song với nó qua một mắt lưới.
    const slope = r.dir === 'a' ? 0.5 : -0.5;
    const off = cy - slope * cx;
    assert.equal(Math.abs(off % STEP.y), 0, `đoạn đường lệch khỏi trục lưới (lệch ${off})`);
    assert.equal(Math.abs(r.w % 4), 0, 'bề dài đoạn đường lệch khỏi lưới pixel');
    assert.ok(r.h > 0 && r.w > r.h, 'một đoạn đường phải dài hơn nó rộng');
  }
});

/**
 * Cây cối quanh phố phải đứng NGOÀI lưới.
 *
 * Đó là toàn bộ việc của chúng: tám mắt lưới đều tăm tắp đọc thành bàn cờ, và thứ phá cái
 * đều ấy chỉ phá được nếu nó không rơi vào chính mấy mắt ấy. Một cái cây tình cờ đứng đúng
 * mắt lưới trông như một toà nhà chưa vẽ xong.
 */
test('cây cối quanh phố không đứng trên mắt lưới — đó là việc của chúng', () => {
  assert.ok(SCENE_SPOTS.length >= 8, 'ít quá thì hai rìa bản đồ vẫn đọc thành lề thừa');
  for (const s of SCENE_SPOTS) {
    const onNode = s.x % STEP.x === 0 && s.y % STEP.y === 0 && Math.abs((s.x / STEP.x + s.y / STEP.y) % 2) === 0;
    assert.ok(!onNode, `cây ở (${s.x}, ${s.y}) đứng đúng mắt lưới, chỗ dành cho một toà nhà`);
  }
});

/**
 * Bầu đồng hồ cát phải chứa VỪA KHÍT số hạt, không thừa không hụt.
 *
 * Bầu xếp theo dãy lẻ 1, 3, 5, … nên k hàng chứa đúng `k²` hạt: số hạt vừa khít khi và chỉ
 * khi nó là số chính phương. Chín hạt (90 phút chia mười) vừa khít ba hàng.
 *
 * Đây là chỗ phép kiểm phải nói to, vì cái hỏng thì im: đổi `FOCUS_MS` thành 100 phút là
 * mười hạt, hàng ngoài cùng chỉ được lấp một trong năm ô, và cái bầu vẹt mất một góc. Không
 * có lỗi nào ném ra — chỉ có một cái hình xấu mà phải mở đúng màn ấy mới thấy.
 */
test('đồng hồ cát: bầu chứa vừa khít số hạt, và cả hai bầu đối xứng', () => {
  const n = Math.round(FOCUS_MS / FOCUS_CELL_MS);
  const bulb = bulbRows(n);

  assert.ok(bulb.length >= 2, 'một hàng thì không còn là cái bầu');
  assert.equal(
    bulb.reduce((a, b) => a + b, 0),
    n,
    'tổng số ô của bầu phải bằng đúng số hạt',
  );
  assert.deepEqual(
    bulb,
    bulb.map((_, i) => 2 * i + 1),
    `bầu vẹt góc: ${n} hạt không phải số chính phương — đổi FOCUS_MS thì phải xem lại hình`,
  );

  // Khung phải rộng hơn hàng cát rộng nhất, không thì hai nắp trùng khít mép bầu và cả hình
  // đọc thành hai tam giác chồng nhau chứ không thành một cái đồng hồ có khung.
  const rows = glassRows(n);
  assert.ok(rows[0].length > Math.max(...bulb), 'nắp phải nhô ra ngoài mép bầu');
  assert.equal(rows[0], rows[rows.length - 1], 'hai nắp phải giống hệt nhau');
  // Cổ nằm đúng giữa theo chiều dọc, và cả hàng eo là KHUNG — hai vách kính chụm vào một ô
  // cổ. Cát chảy QUA cổ, nó không đọng ở đấy, nên một hạt nằm cổ là một hạt đếm hai lần.
  const waist = rows[(rows.length - 1) / 2];
  assert.equal(waist.replace(/\./g, ''), 'kkk', 'giữa eo phải là khung, không phải cát');

  // VÁCH KÍNH: mỗi hàng lòng bầu phải có đúng hai ô khung ôm hai bên, ở MỌI mức. Đây là thứ
  // giữ hình cái bầu từ khi lớp lót xám bị bỏ — thiếu nó thì một cái bầu rỗng chỉ còn hai
  // cái nắp, và hình đọc thành hai vạch ngang chứ không thành cái đồng hồ.
  for (const lit of [n, Math.floor(n / 2), 0]) {
    for (const [y, r] of glassRows(lit).entries()) {
      if (y === 0 || y === rows.length - 1) continue;
      const on = [...r].map((c, i) => (c === '.' ? -1 : i)).filter((i) => i >= 0);
      assert.equal(r[on[0]], 'k', `mức ${lit} hàng ${y}: mép trái phải là vách kính`);
      assert.equal(r[on[on.length - 1]], 'k', `mức ${lit} hàng ${y}: mép phải phải là vách kính`);
    }
  }
});

/**
 * Cát BẢO TOÀN ở mọi mức — đây là chính cái lỗi đã nhìn thấy trên màn hình, hai đời trước.
 *
 * Bản thanh đời đầu vẽ phần chưa sáng bằng `--text-3` ở 24% trên ô rộng 5px, tức gần như
 * tàng hình: ở mức 79% chỉ còn 12px trên 75px, và cái thanh trông như vừa vặn hết chỗ chứ
 * không như còn hai phần. Mất phần chưa sáng là mất MẪU SỐ, mà không có mẫu số thì con số
 * không đọc được — chỉ còn một vệt tím dài ngắn tuỳ lúc.
 *
 * Đồng hồ cát sửa chuyện ấy theo cách khoẻ hơn một cái vành mờ vẽ thêm cho đủ: mẫu số CHÍNH
 * LÀ đống cát ở bầu dưới. Nên phép kiểm đếm tổng số hạt, và tổng ấy phải là hằng.
 *
 * Từ lượt này hai đống cát mang HAI class khác nhau (`sand` cho phần còn lại, `spent` cho
 * phần đã chảy), nên tổng phải cộng cả hai — và phép kiểm dưới đây canh luôn cái ranh giới
 * ấy: `sand` một mình phải đúng bằng số hạt còn ở bầu trên. Đếm nhầm một class là cái thanh
 * lại đọc thành đầy trong lúc nó đã cạn.
 */
test('đồng hồ cát không làm mất hạt nào, kể cả lúc gần cạn', () => {
  const n = Math.round(FOCUS_MS / FOCUS_CELL_MS);
  const draw = (focus) => rawText(focusGlass({ focus, focusMood: focusMoodOf(focus) }));
  const count = (s, re) => (s.match(re) ?? []).length;
  const sand = (s) => count(s, /px sand/g) + count(s, /px spent/g);
  // Số hạt còn ở bầu TRÊN, đọc từ chính lưới: hàng nào nằm trên cái cổ thì thuộc bầu trên.
  const upper = (focus) => {
    const rows = glassRows(Math.max(1, Math.round(focus * n)));
    return rows
      .slice(0, (rows.length - 1) / 2)
      .join('')
      .split('s').length - 1;
  };

  for (const f of [1, 0.79, 0.5, 0.11, 0.02, 0]) {
    assert.equal(sand(draw(f)), n, `mức ${f}: cát bốc hơi mất — tổng phải luôn là ${n}`);
  }

  assert.equal(upper(1), n, 'đầy thì cát ở cả trên bầu trên');
  assert.equal(glassRows(0).slice(0, 4).join('').includes('s'), false, 'cạn hẳn thì bầu trên phải trống');
  assert.ok(upper(0.02) >= 1, 'còn một chút thì vẫn phải sót một hạt ở bầu trên');
  assert.ok(upper(0.5) < n && upper(0.5) > 0, 'nửa chừng thì cát phải chia hai bầu');

  // Phần CÓ SẮC phải đúng bằng phần còn lại, không bằng tổng: đây là cả nội dung của phép
  // sửa lượt này. Vẽ cả hai đống bằng một class là quay về ca cũ — hai tam giác giống hệt
  // nhau, và người đọc phải so tỉ lệ trên một hình cao 36px.
  for (const f of [1, 0.5, 0.11]) {
    assert.equal(count(draw(f), /px sand/g), upper(f), `mức ${f}: phần có sắc phải là phần CÒN LẠI`);
  }
  assert.equal(count(draw(1), /px spent/g), 0, 'đầy thì chưa có hạt nào đã chảy');
  assert.equal(count(draw(0), /px sand/g), 0, 'cạn hẳn thì không còn hạt nào có sắc');

  // Sổ đời cũ chưa có trường này: không vẽ gì cả, chứ không vẽ một cái đồng hồ rỗng.
  assert.equal(rawText(focusGlass({})), '');
});

/**
 * Hai chỉ số phải khác nhau về LOẠI HÌNH, không chỉ về màu và cỡ.
 *
 * Đời đầu chúng là cùng một cái thanh khác nhau ba thứ nhỏ — mười ô với chín, một cái khe,
 * ô hẹp hơn vài pixel. Trên giấy là ba kênh; trên màn hình thì chênh vài pixel bề rộng đọc
 * thành "cùng một thứ ở hai cỡ", nên phần phân biệt rơi hết về màu — đúng thứ mà luật theme
 * daltonized của dự án cấm ở mọi chỗ khác.
 *
 * Phép kiểm này canh cái ranh giới ấy ở chỗ nó không tự trôi được: hai hàm phải sinh ra hai
 * loại phần tử khác nhau. Cỡ nhỏ và cỡ to của cùng một hình thì vẫn là một loại.
 */
test('độ no và tập trung không còn là hai cái thanh giống nhau', () => {
  const pet = { full: 0.5, mood: 'fine', focus: 0.5, focusMood: 'sharp' };
  const bar = rawText(hungerBar(pet));
  const glass = rawText(focusGlass(pet));

  assert.match(bar, /class="pet-bar/, 'độ no vẫn là cái thanh');
  assert.doesNotMatch(bar, /pet-glass/);
  assert.match(glass, /class="pet-glass/, 'tập trung là cái đồng hồ cát');
  assert.doesNotMatch(glass, /pet-bar/, 'đồng hồ cát mà mượn lại class của thanh là quay về ca cũ');

  // Và nó phải ĐỨNG, không nằm: một cái thanh nằm ngang cạnh một cái hình cũng nằm ngang thì
  // kênh "khác loại" chỉ còn là đường viền.
  const [, w, h] = /width:(\d+)px;height:(\d+)px/.exec(glass) ?? [];
  assert.ok(Number(h) > Number(w), `đồng hồ cát phải cao hơn rộng, đang là ${w}×${h}`);
});
