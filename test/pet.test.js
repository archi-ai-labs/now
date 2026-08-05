import test from 'node:test';
import assert from 'node:assert/strict';
import { accrue, buy, emptyLedger, fullnessOf, moodOf, petView, FULL_MS, ITEMS, RATE } from '../src/pet.js';
import { ART } from '../public/lib/pet.js';
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
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 5 };
  const { ledger, error } = buy(l, 'pho', T0);
  assert.equal(error, 'không đủ xu');
  assert.equal(ledger.coins, 5);
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

test('cho ăn lúc đói thì no thêm đúng phần của món', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const now = T0 + FULL_MS; // đói lả
  const fed = buy(l, 'coffee', now).ledger;
  assert.ok(Math.abs(fullnessOf(fed, now) - ITEMS.coffee.fill) < 1e-9);
});

test('tâm trạng có đủ bốn bậc và không có kẽ hở', () => {
  assert.equal(moodOf(0), 'starving');
  assert.equal(moodOf(0.2), 'hungry');
  assert.equal(moodOf(0.6), 'fine');
  assert.equal(moodOf(1), 'stuffed');
});

test('bản gửi ra trình duyệt làm tròn XUỐNG và giấu phần lẻ trong sổ', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 12.87 };
  assert.equal(petView(l, T0).coins, 12);
});

test('món vừa ăn chỉ đứng cạnh nhân vật một lúc rồi biến mất', () => {
  const l = { ...emptyLedger([], '2026-08-05', T0), coins: 999 };
  const fed = buy(l, 'banhmi', T0).ledger;
  assert.equal(petView(fed, T0 + 60000).holding, 'banhmi');
  assert.equal(petView(fed, T0 + DAY).holding, null);
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

test('không món trang trí nào giành chỗ với món khác', () => {
  const slots = Object.values(ITEMS).filter((i) => i.slot).map((i) => i.slot);
  assert.equal(new Set(slots).size, slots.length, 'hai món cùng một chỗ thì món này đè món kia');
});
