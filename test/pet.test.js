import test from 'node:test';
import assert from 'node:assert/strict';
// Đọc thẳng `styles.css`: từ lượt 23 có mấy phép kiểm bắc cầu sang bên ấy (ba lúc đầu, thêm
// một cho bảng trạng thái ngày 9/8), vì một cái tên gõ sai bên CSS là lỗi DUY NHẤT trong lớp
// trò chơi không gây ra triệu chứng nào — xem chúng ở dưới.
import fs from 'node:fs';
import {
  accrue, buy, cancelBreak, emptyLedger, fullnessOf, moodOf, normWorn, petView,
  focusOf, focusMoodOf, observeRest, resolveBreak, startBreak, wear,
  FULL_MS, FOCUS_MS, BREAK_MS, COIN_PER_HOUR, EAT_MS, FOODS, ITEMS, MOVES, RATE,
  REST_RAMP_MS, SLOTS, doingOf,
} from '../src/pet.js';
import { ART, DISHES, FACE_NAMES, MOVE_ART, STATE_SCALES, TIP_KEYS, TIP_KINDS, butlerFace, butlerLook, butlerRows, butlerSays, butlerTalk, butlerThinks, coinNum, dialRows, doingRing, faceRows, focusDial, hungerText, hungerTray, markArt, nudgeOf, speaking, statCells, stateTable, statWords, tipArt, trayRows } from '../public/lib/pet.js';
import { rawText } from '../public/lib/dom.js';
import { FOCUS_DIP, HUNGER_MARKS, MOVE_HOME, MOVE_IDS, MOVE_PARK, REST_STAGE_MIN, livePet, moveForHour, restStageOf, stampPet, stateOf, wakeOf, whereOf } from '../public/lib/petmath.js';
import { LOTS, PLACE_IDS, PLACES, ROADS, SCENE_SPOTS, STEP, TOWN_BOX, WALKERS, WELL, butlerArt, cellPos, onRoad, sizeOf } from '../public/lib/town.js';
import { outlineRows } from '../public/lib/pixel.js';
import { lastHumanIn } from '../src/collect/sessions.js';
import { t, tableOf } from '../public/lib/i18n.js';

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

/**
 * Đồng hồ đói đếm tới MỐC KẾ TIẾP CÓ TÊN — chữ và số không được cãi nhau.
 *
 * Ca gãy có thật (ảnh người dùng gửi 9/8): màn Cửa hàng bày "Đói lả · còn 43 phút nữa thì
 * đói" — vì bản cũ luôn đếm tới 0% mà gọi mốc ấy là "đói", trong khi cái chữ bên cạnh đã
 * đổi thành "Đói lả" từ mốc 12%. Từ lượt này đích của phép đếm là đúng chỗ chữ sẽ đổi.
 */
test('đồng hồ đói trỏ đúng mốc mà chữ trạng thái sẽ đổi, không trỏ mốc 0%', () => {
  const at = (full) => hungerText({ full, fullMs: FULL_MS });
  // Mọi con số dưới đây suy từ nhịp 16 giờ, và nhấc bậc `FULL_MS` là phải tính lại chúng.
  // Đó là chủ đích: test này ghim ĐÍCH của phép đếm, nên nó phải đọc ra đích ấy bằng số
  // thật chứ không bằng một phép nhân chép lại từ chính `hungerText`.
  // Đang ổn (0,5): đích là mốc ĐÓI — (0,5 − 0,35) × 16h = 144′ → nói bằng giờ.
  assert.equal(at(0.5), 'còn 2 giờ nữa thì đói');
  // Đang đói (0,2): đích là mốc ĐÓI LẢ — (0,2 − 0,12) × 16h = 76,8′ → trần lên 77, sang giờ.
  assert.equal(at(0.2), 'còn 1 giờ nữa thì đói lả');
  // Đói lả (0,09): đích là ĐÁY — 0,09 × 16h = 86,4′. Đúng ca trong ảnh: chữ "Đói lả"
  // đứng cạnh một cái đếm về "bụng rỗng", không còn hứa "sắp đói".
  assert.equal(at(0.09), 'còn 1 giờ nữa thì bụng rỗng');
  // Nhịp 16 giờ đẩy CẢ HAI nhánh cuối sang cách nói bằng giờ, nên hai ca này vào đây cùng
  // lượt nhấc bậc: thiếu chúng thì nhánh phút của `starve*` và `empty*` không còn ai đi
  // qua, mà một khoá không ai đi qua là một khoá sẽ hỏng lặng lẽ.
  assert.equal(at(0.15), 'còn 29 phút nữa thì đói lả'); // (0,15 − 0,12) × 16h = 28,8′
  assert.equal(at(0.05), 'còn 48 phút nữa thì bụng rỗng'); // 0,05 × 16h = 48′
  assert.equal(at(0), 'đói lả rồi');
  // Không bao giờ "còn 0 phút": sát mốc thì trần lên 1 — một cái đếm ngược bày số 0 mà
  // chưa đổi chữ đọc thành lỗi, không đọc thành gấp.
  assert.equal(at(HUNGER_MARKS.hungry + 0.0001), 'còn 1 phút nữa thì đói');
  // Chữ đổi ở đâu thì đồng hồ đổi đích ở đúng đó — hai bên đọc CHUNG một bảng mốc.
  assert.equal(moodOf(HUNGER_MARKS.hungry), 'hungry');
  assert.equal(moodOf(HUNGER_MARKS.starving), 'starving');
});

test('bộ khoá đồng hồ đói đủ ở CẢ HAI ngôn ngữ — và năm khoá *Short đã gỡ hẳn', () => {
  const vi = tableOf('vi');
  const en = tableOf('en');
  for (const k of ['pet.starved', 'pet.leftMin', 'pet.leftHour', 'pet.starveMin', 'pet.starveHour', 'pet.emptyMin', 'pet.emptyHour']) {
    assert.ok(k in vi, `thiếu ${k} ở VI`);
    assert.ok(k in en, `thiếu ${k} ở EN`);
  }
  // Gỡ là gỡ hẳn: khoá chết nằm lại trong bảng là mời người sau nối lại cái cửa không ai đi.
  for (const k of ['pet.starvedShort', 'pet.leftMinShort', 'pet.leftHourShort', 'pet.satMinShort', 'pet.satRestedShort']) {
    assert.ok(!(k in vi) && !(k in en), `${k} đáng lẽ đã gỡ khỏi cả hai bảng`);
  }
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

  const mv = doingOf(startBreak(l, 'walk', T0).ledger, T0 + MOVES.walk.ms / 2);
  assert.deepEqual({ kind: mv.kind, id: mv.id, ms: mv.ms }, { kind: 'move', id: 'walk', ms: MOVES.walk.ms });

  // Quãng NGHỈ cũng phải tự tắt, y như bữa ăn — chỗ sửa của lượt 18. Tới lượt trước nhánh
  // này trả về một việc "đang làm" với `leftMs: 0` cho tới khi server chốt quãng và xoá nó
  // khỏi sổ, nên hai nhánh của cùng một hàm nói hai câu khác nhau: ăn xong thì hết, còn vươn
  // vai xong thì vẫn đang vươn vai. Người dùng thấy đúng chỗ ấy — "làm gì xong không tự back
  // về trạng thái làm việc".
  //
  // `resolveBreak` không mất gì: nó đọc thẳng sổ, và cái ở lại trong sổ là cái CHƯA CHỐT,
  // còn cái hàm này trả về là cái ĐANG DIỄN RA.
  assert.equal(doingOf(startBreak(l, 'walk', T0).ledger, T0 + MOVES.walk.ms), null);
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

/**
 * GIÁ CAO PHẢI VẼ TO — luật lượt 21, và nó phải là một phép kiểm chứ không phải một thói quen.
 *
 * Người dùng: *"Khinh khí cầu, cây quất có thể cân nhắc vẽ to hơn, những vật đắt tiền thế nên
 * có kích thước khác. Bạn tự rà soát lại các mặt hàng trong chợ và quyết định"*.
 *
 * Rà soát ra ba chỗ vỡ, và cả ba đều là chuyện KHÔNG AI ĐO nên không ai thấy:
 *
 * - Khe LƠ LỬNG phẳng tuyệt đối: bóng bay 130 xu và khinh khí cầu 480 xu chung đúng một khung
 *   20×32. Bốn lần giá, không một pixel khác nhau.
 * - Vòm hoa hồng 560 xu NHỎ HƠN giàn tử đằng 340 xu (1216 so với 1520 px²).
 * - Đường chân trời 880 xu — món đắt nhất cả cửa hàng — nhỏ hơn cực quang 520 xu.
 *
 * Chỗ vỡ ấy không nằm ở tay vẽ, nó nằm ở chỗ chưa ai viết luật ra. Nên luật là: **trong một
 * khe, món đắt hơn không bao giờ được vẽ nhỏ hơn**, và món đắt nhất phải to gấp đôi món rẻ
 * nhất — gấp đôi để cái khác nhau còn đọc được ở 4px, chứ không phải chỉ đúng trên bảng số.
 *
 * BẰNG NHAU thì được, và đó là chỗ luật cố ý lỏng: mũ len 60 xu với nón chóp 70 xu chênh nhau
 * mười xu, mà một sự khác biệt mười xu vẽ ra được thì nó cũng nhỏ tới mức không ai thấy. Cái
 * luật này chặn chuyện ĐI LÙI, không ép mỗi bậc giá phải có một bậc kích thước.
 */
test('trong mỗi khe, món đắt hơn không được vẽ nhỏ hơn', () => {
  const area = (id) => {
    const rows = ART[id].rows;
    return Math.max(...rows.map((r) => r.length)) * 4 * rows.length * 4;
  };
  for (const slot of SLOTS) {
    const ids = Object.keys(ITEMS)
      .filter((id) => ITEMS[id].kind === 'decor' && ITEMS[id].slot === slot)
      .sort((a, b) => ITEMS[a].price - ITEMS[b].price);
    assert.ok(ids.length >= 4, `khe ${slot} chỉ có ${ids.length} món — phép kiểm này cần cả bậc thang`);
    for (let i = 1; i < ids.length; i += 1) {
      assert.ok(
        area(ids[i]) >= area(ids[i - 1]),
        `${ids[i]} (${ITEMS[ids[i]].price} xu, ${area(ids[i])}px²) nhỏ hơn ${ids[i - 1]} ` +
          `(${ITEMS[ids[i - 1]].price} xu, ${area(ids[i - 1])}px²) — giá đi lên mà hình đi xuống`,
      );
    }
    const lo = area(ids[0]);
    const hi = area(ids[ids.length - 1]);
    assert.ok(
      hi >= lo * 2,
      `khe ${slot}: món đắt nhất ${hi}px² chỉ gấp ${(hi / lo).toFixed(2)} lần món rẻ nhất — dưới hai lần thì không ai thấy`,
    );
  }
});

/**
 * TRẦN của mọi sprite là cái bệ trong cửa hàng, và trần ấy phải nói ra được.
 *
 * `artFit` co hình cho vừa bệ, nhưng nó bám ba bậc {1 · 0,75 · 0,5} để mỗi ô pixel còn là số
 * nguyên (4 / 3 / 2px). Bậc cuối là SÀN: vẽ một món rộng hơn 184px thì `artFit` trả 0,5 mà
 * 0,5 vẫn không đủ, và `overflow: hidden` xén phần thừa — đúng cái lỗi im lặng đã ăn mất tám
 * pixel của cực quang suốt bốn lượt.
 *
 * 184 = 92 × 2 và 112 = 56 × 2, hai con số chỗ thật hẹp nhất của bệ (xem `BOX_TALL` trong
 * `views/pet.js`).
 */
test('không sprite nào vượt bệ — trần 184×112, tức bậc co cuối cùng', () => {
  for (const [id, a] of Object.entries(ART)) {
    const w = Math.max(...a.rows.map((r) => r.length)) * 4;
    const h = a.rows.length * 4;
    assert.ok(w <= 184, `${id} rộng ${w}px — quá trần 184, cửa hàng sẽ xén nó`);
    assert.ok(h <= 112, `${id} cao ${h}px — quá trần 112, cửa hàng sẽ xén nó`);
  }
});

/* ── Nhịp sống của đồ trang trí ────────────────────────────────────────────── */

/**
 * MỖI món trang trí phải TRẢ LỜI câu hỏi "động vì cái gì" — kể cả khi câu trả lời là không.
 *
 * Lượt 23 gắn cho mỗi món một nhịp (`life`), và cái bẫy của một trường như thế là nó im lặng
 * khi thiếu: quên khai thì món ấy đứng chết giữa một bức tranh mà mọi thứ khác đều thở, và
 * không có gì kêu lên. Đúng cái lớp lỗi đã để bốn món khe lơ lửng chung một khung 20×32 suốt
 * bốn lượt.
 *
 * Nên phép kiểm bắt KHAI, không bắt phải có nhịp: `null` là một câu trả lời hợp lệ và sáu món
 * đang dùng nó. Chỗ nó chặn là chỗ trường không tồn tại — tức là chưa ai nghĩ tới món ấy.
 */
test('mỗi món trang trí đều KHAI nhịp sống, kể cả khi nhịp ấy là "đứng yên"', () => {
  const quen = Object.keys(ITEMS).filter(
    (id) => ITEMS[id].kind === 'decor' && !Object.hasOwn(ART[id] ?? {}, 'life'),
  );
  assert.deepEqual(
    quen,
    [],
    `chưa khai \`life\` cho: ${quen.join(', ')} — khai \`null\` nếu nó cố ý đứng yên, ` +
      'vì bỏ trống thì không phân biệt được "đã quyết" với "đã quên"',
  );
  // Phải còn cả hai phía để phép kiểm trên có nghĩa: một bảng toàn `null` cũng qua được nó.
  const co = Object.values(ART).filter((a) => a.life).length;
  const khong = Object.values(ART).filter((a) => Object.hasOwn(a, 'life') && !a.life).length;
  assert.ok(co >= 20 && khong >= 4, `${co} món có nhịp / ${khong} món đứng yên — bảng đã lệch hẳn về một phía`);
});

/**
 * HAI KHUNG của một con vật phải CÙNG KHUNG HÌNH, và phải KHÁC NHAU.
 *
 * Hai điều kiện ngược chiều nhau, và cả hai đều hỏng theo kiểu không ai thấy lúc viết:
 *
 * - Lệch kích thước → `drawArt` khai bề rộng từ khung A, nên khung B rộng hơn sẽ bị lòi ra
 *   ngoài hộp, còn hẹp hơn thì con vật NHẢY ngang mỗi lần hoán. Đếm tay một hàng 17 ký tự là
 *   đúng thứ sai được, và bốn con vật này có 43 hàng.
 * - Giống hệt nhau → hai lớp chồng khít, hoán qua hoán lại, và cái đọc ra là một hình đứng
 *   yên. Test vẫn xanh, `npm test` vẫn sạch, và món 720 xu vẫn không nhúc nhích.
 */
test('con vật hai khung: cùng khổ, mà không được giống hệt nhau', () => {
  const doi = Object.entries(ART).filter(([, a]) => a.alt);
  assert.ok(doi.length >= 4, `chỉ có ${doi.length} món hai khung — chờ ít nhất bốn con vật`);
  for (const [id, a] of doi) {
    const kho = (rows) => `${Math.max(...rows.map((r) => r.length))}×${rows.length}`;
    assert.equal(kho(a.alt), kho(a.rows), `${id}: khung B ${kho(a.alt)} lệch khung A ${kho(a.rows)} — con vật sẽ nhảy`);
    // So từng hàng chứ không so cả mảng: mảng khác nhau ở đâu thì câu báo lỗi phải nói ra.
    const khac = a.rows.filter((r, i) => r !== a.alt[i]).length;
    assert.ok(khac > 0, `${id}: hai khung giống hệt nhau — hoán qua hoán lại vẫn là một hình đứng yên`);
  }
});

/**
 * CÁI TÊN NHỊP phải có thật ở bên CSS — nếu không nó là một món đứng yên trong im lặng.
 *
 * Đây là chỗ duy nhất trong cả bộ mà một lỗi CHÍNH TẢ không gây ra bất cứ triệu chứng nào:
 * gõ `life: 'sawy'` thì `drawArt` vẫn gắn lớp `life-sawy`, DOM vẫn có nó, không console nào
 * kêu, và món đồ chỉ đơn giản là không động. Cùng hình dạng với lỗi đã để `.shop-art` xén
 * âm thầm ba sprite 104px suốt năm lượt.
 *
 * Đọc thẳng `styles.css` chứ không dựng một danh sách tên hợp lệ ở đây: một danh sách như thế
 * là bản thứ hai của một sự thật, và nó lệch khỏi CSS đúng lần đầu ai đó thêm một nhịp.
 */
/**
 * `styles.css` đã BỎ CHÚ THÍCH — ba phép kiểm dưới đây đều đọc qua cửa này.
 *
 * Không phải chuyện gọn: file này chú thích dày hơn luật, và trong chú thích có cả tên
 * selector lẫn khối `{ }` viết ra làm ví dụ. Bản đầu của phép kiểm `glow` quét thẳng file
 * thô và nó KHÔNG bắt được lỗi nó sinh ra để bắt — thử phá bằng cách trả `.art-halo` về
 * `life-glow` thì test vẫn xanh, vì một khối `{ }` trong chú thích phía trên đã nuốt mất
 * đoạn ấy trong lượt quét trước đó.
 *
 * Một phép kiểm không bắt được đúng cái nó tả thì tệ hơn không có: nó bán một sự yên tâm.
 */
const cssRaw = () => fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const cssNoComments = () => cssRaw().replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * VĂN XUÔI RƠI VÀO DÒNG MÃ — hai phép kiểm cho một cái bẫy đã sập hai lần.
 *
 * `styles.css` chú thích dày hơn luật, nên xác suất một khối chú thích khép sai chỗ không
 * phải là nhỏ. Và khi nó khép sai thì hậu quả **không có triệu chứng tại chỗ**: CSS không
 * ném lỗi, không ghi console, không hiện gì trong Sources. Bộ phân tích chỉ lặng lẽ nuốt
 * đoạn văn xuôi làm bộ chọn, gặp `{` đầu tiên thì bỏ trọn luật ấy — đúng MỘT luật, luật
 * ngay sau đoạn văn, tức luật mà đoạn văn vừa giải thích.
 *
 * Ca thật: một dấu đóng chú thích thừa ở khối `.shop-pick .shop-art` làm rơi mất
 * `flex: none; width: 72px`, nên `.shop-art` giữ `width: 100%` và cái khay chọn món thành
 * một dải tím dài với một bát xôi tí xíu ở giữa, cụm chữ bên cạnh bị bóp còn một chữ mỗi
 * dòng. Chú thích ngay trên chỗ hỏng đã tả trước cảnh ấy — nó chỉ không tự canh được mình.
 *
 * Hai phép kiểm vì có hai đường vào, và mỗi đường cần một cái lưới khác nhau:
 *  1. dấu đóng thừa / khối không đóng  → đếm cặp
 *  2. văn xuôi lọt vào mã vì bất kỳ lý do nào khác (quên mở `/*`, dán nhầm một dòng)
 *     → sau khi bóc chú thích và chuỗi, mã CSS của dự án này thuần ASCII, mà văn xuôi
 *       tiếng Việt thì không bao giờ thuần ASCII. Một dòng lọt là lộ ngay.
 */
test('chú thích trong styles.css phải đóng đúng một lần', () => {
  const s = cssRaw();
  const dong = (p) => s.slice(0, p).split('\n').length;
  const moCoi = [];
  let i = 0;
  let mo = false;
  let moTai = 0;
  while (i < s.length - 1) {
    const hai = s.slice(i, i + 2);
    if (!mo && hai === '/*') { mo = true; moTai = i; i += 2; continue; }
    if (mo && hai === '*/') { mo = false; i += 2; continue; }
    // Dấu đóng gặp lúc KHÔNG có khối nào đang mở: đây là cái làm rơi luật ngay dưới nó.
    if (!mo && hai === '*/') { moCoi.push(dong(i)); i += 2; continue; }
    i++;
  }
  if (mo) moCoi.push(dong(moTai));
  assert.deepEqual(moCoi, [], `dấu chú thích mồ côi ở dòng ${moCoi.join(', ')} — luật ngay dưới nó đang bị trình duyệt bỏ`);
});

test('không có văn xuôi nào lọt vào dòng mã của styles.css', () => {
  // Bóc chú thích, rồi bóc chuỗi trong ngoặc (`content: '›'`, `[data-x="..."]`) — hai chỗ
  // duy nhất mà một ký tự ngoài ASCII được phép đứng trong mã.
  const code = cssRaw()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"[^"\n]*"|'[^'\n]*'/g, "''");
  const lot = [];
  code.split('\n').forEach((d, i) => {
    if (/[^\x00-\x7F]/.test(d)) lot.push(`${i + 1}: ${d.trim().slice(0, 70)}`);
  });
  assert.deepEqual(lot, [], `văn xuôi đứng ngoài chú thích:\n  ${lot.join('\n  ')}`);
});

test('mọi nhịp đã khai đều có luật thật trong styles.css', () => {
  const css = cssNoComments();
  const dung = [...new Set(Object.values(ART).map((a) => a.life).filter(Boolean))];
  assert.ok(dung.length >= 6, `mới có ${dung.length} nhịp — chờ ít nhất sáu`);
  for (const kind of dung) {
    assert.ok(css.includes(`.life-${kind}`), `khai \`life: '${kind}'\` mà styles.css không có luật \`.life-${kind}\``);
  }
  // Nhịp hai khung còn cần hai bộ khung hình mang đúng tên, một cho mỗi lớp.
  for (const kind of [...new Set(Object.entries(ART).filter(([, a]) => a.alt).map(([, a]) => a.life))]) {
    for (const f of ['a', 'b']) {
      assert.ok(css.includes(`@keyframes ${kind}-${f}`), `thiếu \`@keyframes ${kind}-${f}\` cho nhịp hai khung '${kind}'`);
    }
  }
});

/**
 * `glow` chỉ được chạm mấy Ô ĐÈN, không bao giờ chạm cả thẻ — nếu không hai lớp mờ NHÂN nhau.
 *
 * Lỗi này tự gây ra rồi tự đo thấy ngay trong lượt 23, và nó là bản dựng lại của đúng con bug
 * người dùng vừa báo. Bản đầu để `glow` chạy ở cả hai tầng: một luật cho từng ô sáng
 * (`.life-glow .px.gold`) và một luật cho cả thẻ (`.art-halo.life-glow`). Vòng hào quang toàn
 * thân là `gold` nên nó ăn cả hai, và hai lớp opacity nhân nhau: 0,55 × 0,55 = **0,30** — đúng
 * con số của `mb-float` mà cả lượt này sinh ra để gỡ.
 *
 * Cái làm nó nguy hiểm là không có triệu chứng riêng: món đồ vẫn động, vẫn đúng nhịp, chỉ là
 * mờ gấp đôi mức đã định. Không ai đọc ra "0,30" từ một bức tranh.
 *
 * Nên luật: mọi luật CSS gắn hoạt hình cho `.life-glow` đều phải nhắm vào `.px`. Vật nào cần
 * cả hình cùng sáng thì đó là `shimmer`, một nhịp khác, và nó không chồng lên gì cả.
 */
test('nhịp `glow` không được chạm cả thẻ — hai lớp mờ nhân nhau thì món đồ tối gấp đôi', () => {
  const css = cssNoComments();
  const xau = [];
  for (const m of css.matchAll(/^([^@{}\n][^{}]*)\{([^}]*)\}/gm)) {
    const [, sel, body] = m;
    if (!sel.includes('life-glow') || !/animation(-name)?\s*:/.test(body)) continue;
    // Mỗi vế của danh sách selector phải tự nhắm tới một ô pixel.
    for (const one of sel.split(',')) if (one.includes('life-glow') && !one.includes('.px')) xau.push(one.trim());
  }
  assert.deepEqual(
    xau,
    [],
    `luật gắn hoạt hình cho cả thẻ \`.life-glow\`: ${xau.join(' | ')} — nó chồng lên luật ` +
      '`.life-glow .px.*` và hai lớp opacity nhân nhau. Vật cần cả hình cùng sáng thì dùng `shimmer`.',
  );
  // Và phải còn ít nhất một luật `glow` thật, không thì phép kiểm trên xanh vì rỗng.
  assert.ok(/\.life-glow[^,{]*\.px/.test(css), 'không còn luật `.life-glow … .px` nào — bộ chọn có vẻ đã hụt');
});

/**
 * CHỖ NGHỈ của một hoạt hình phải là chỗ nghỉ THẬT của vật — 0% và 100% phải bằng nhau.
 *
 * Đây là phép kiểm sinh ra từ đúng con bug người dùng báo ở lượt 23. Chỗ đứng lơ lửng mượn
 * `mb-float`, mà `mb-float` viết cho ba chữ `z` của giấc ngủ:
 *
 *     0%, 100%  opacity 0.3      50%  opacity 0.85
 *
 * Với ba chữ `z` thì đúng — chúng phải tan đi. Với cái đèn lồng thì nó là một món 150 xu mờ
 * còn 30% suốt nửa mỗi vòng. Và cái bẫy còn một tầng nữa: khối `prefers-reduced-motion` ở đầu
 * file tắt hoạt hình bằng cách cho nó chạy 0,01ms rồi dừng, nên KHUNG CUỐI là thứ người bật
 * "giảm chuyển động" nhìn thấy vĩnh viễn. File đã phải chữa tay cho `.mb-zzz`, `.slot-air`,
 * ba nét trạng thái, và cột khói quán ăn — bốn lần cùng một bệnh.
 *
 * Luật cắt hẳn gốc: khung ở hai đầu phải là chỗ nghỉ THẬT — phép biến hình đơn vị, hoặc
 * `opacity: 1`. Bản đầu của phép kiểm này chỉ so 0% với 100% xem có bằng nhau không, và thử
 * phá thì nó KHÔNG bắt được: đổi cả hai đầu thành `translateY(-4px)` vẫn qua, trong khi đó
 * đúng là con bug — quả bóng bay đứng lơ lửng vĩnh viễn với người tắt chuyển động. So bằng
 * nhau là điều kiện cần, không phải điều kiện đủ; phải nói ra chỗ nghỉ LÀ CÁI GÌ.
 *
 * Chỉ soi mấy bộ khung hình của lớp nhịp sống. Mấy bộ cũ có bộ cố ý tan đi (`mb-zzz`,
 * `town-fade`) và chúng đã có luật chữa riêng ở khối `prefers-reduced-motion`.
 */
test('khung hình nhịp sống nghỉ đúng chỗ — hai đầu phải là chỗ đứng yên thật', () => {
  // Chỗ nghỉ viết ra được bằng đúng mấy dạng này. Danh sách trắng chứ không phép thử "có
  // chứa số 0 không": `rotate(0.5deg)` cũng chứa số 0.
  const NGHI = new Set(['transform:none', 'transform:rotate(0)', 'transform:translateY(0)', 'transform:scale(1,1)', 'opacity:1']);
  const gon = (s) => s.replace(/\s+/g, '').replace(/;$/, '');
  const css = cssNoComments();
  // Thân một `@keyframes` có `{}` LỒNG NHAU, nên không có biểu thức chính quy nào cắt đúng
  // được nó: bản đầu dùng `[\s\S]*?\n\}` và nó bỏ sót đúng sáu bộ viết gọn trên một dòng —
  // im lặng, vì "không tìm thấy" trông y hệt "không có gì sai". Đếm ngoặc thì không sót.
  const bodyOf = (open) => {
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}' && (depth -= 1) === 0) return css.slice(open + 1, i);
    }
    return null;
  };
  const found = [];
  for (const m of css.matchAll(/@keyframes\s+(life-[a-z]+|blink-[ab]|peck-[ab]|swim-[ab])\s*\{/g)) {
    const name = m[1];
    const body = bodyOf(m.index + m[0].length - 1);
    assert.ok(body !== null, `@keyframes ${name}: không đóng ngoặc`);
    const stop = (pct) => {
      // Bắt đúng khối có mốc `pct`, dù nó đứng một mình hay đi cùng mốc khác ("0%, 100%").
      const hit = [...body.matchAll(/([\d.%,\s]+)\{([^}]*)\}/g)].find((k) =>
        k[1].split(',').some((p) => p.trim() === pct),
      );
      return hit ? hit[2].replace(/\s+/g, ' ').trim() : null;
    };
    const a = stop('0%');
    const b = stop('100%');
    assert.ok(a && b, `@keyframes ${name}: thiếu mốc ${a ? '100%' : '0%'} — không nói ra được chỗ nghỉ`);
    assert.equal(b, a, `@keyframes ${name}: 100% ("${b}") khác 0% ("${a}") — vòng lặp sẽ giật ở chỗ nối`);
    // Khung B của con vật là ngoại lệ DUY NHẤT, và nó ngược hẳn: chỗ nghỉ của nó là BIẾN MẤT,
    // vì lúc nghỉ thì khung A mới là con vật. `.pet-frame.fb { opacity: 0 }` ở khối giảm
    // chuyển động nói đúng điều ấy một lần nữa, ở tầng khác.
    const can = name.endsWith('-b') ? 'opacity:0' : null;
    if (can) {
      assert.equal(gon(a), can, `@keyframes ${name}: hai đầu là "${a}", mà khung B lúc nghỉ phải ẩn hẳn`);
    } else {
      assert.ok(
        NGHI.has(gon(a)),
        `@keyframes ${name}: hai đầu là "${a}" — không phải một chỗ đứng yên. Người bật "giảm ` +
          `chuyển động" đọng ở đúng khung này vĩnh viễn, nên nó phải là một trong: ${[...NGHI].join(' · ')}`,
      );
    }
    found.push(name);
  }
  assert.ok(found.length >= 11, `chỉ soi được ${found.length} bộ khung hình (${found.join(', ')}) — bộ chọn có vẻ đã hụt`);
});

/**
 * Mọi nhịp NỀN trong popover phải khoá pha vào đồng hồ tường.
 *
 * `mount()` vẽ bằng `innerHTML =` nên mỗi lượt vẽ dựng lại cả cây DOM, và hoạt hình trên
 * thẻ mới luôn bắt đầu ở khung hình 0%. Một lần mở popover đo được BA lượt vẽ trong 2,6
 * giây, cộng một lượt cho mỗi cú bấm. Không khoá pha thì mỗi lượt ấy là một cú giật.
 *
 * Lượt 23 chữa đúng nửa: `--life-lag` khai ở `.pet-art`, nên đồ trang trí đứng yên còn mặt
 * trời, mây, sao và quản gia vẫn nhảy. Lượt 24 chữa nốt popover, và bỏ lại bản đồ thị trấn.
 * Lượt 25 mới hết. Ba lượt cho một cái bệnh, và cả ba lần cái hỏng đều KHÔNG phải một luật
 * viết sai — nó là một luật KHÔNG AI VIẾT, ở một chỗ chưa ai nghĩ tới.
 *
 * Nên phép kiểm này không soi một danh sách tên, cũng không soi một họ selector: nó soi
 * **mọi luật trong file có `infinite`**. Danh sách miễn phải khai từng cái một, kèm lý do.
 * Cái nào mới thêm mà không khoá pha thì đỏ, không cần ai nhớ ra.
 */
test('mọi nhịp nền phải khoá pha — không thì mỗi lượt vẽ là một cú giật', () => {
  // Miễn thì phải nói được VÌ SAO, và mỗi lý do ở đây là một loại khác nhau:
  //  · LỊCH — `.mb-lid` chớp mắt "cú đầu ở giây 1,3", `.mb-thought` để câu nghĩ đầu hiện sẵn
  //    lúc mở. Khoá vào đồng hồ tường là biến cái lịch thành ngẫu nhiên, mà cửa sổ sống vài
  //    giây thì ngẫu nhiên nghĩa là thường xuyên không xảy ra. Cả hai nghỉ ở khung hình 0%
  //    nên chúng cũng không giật.
  //  · ĐÃ KHOÁ Ở CHỖ KHÁC — người qua đường và quản gia ra phố nhận `animation-delay` âm
  //    thẳng từ JS (`Date.now() % (dur * 2000)`, xem `townMap` trong `views/pet.js`), vì độ
  //    trễ của họ còn phải khớp với chu kỳ `alternate` riêng của từng tuyến. `.resident.pacing`
  //    và `.mini-frame` cũng vậy, từ `butlerArt` (`-(now % PACE_MS)`). Bản đầu của lượt 25 CÓ
  //    thêm `--life-lag` cho hai cái ấy, và đo trên trang thật mới thấy: style nội tuyến thắng,
  //    nên hai dòng vừa thêm không bao giờ chạy. Đã gỡ — một dòng chết đọc thành "chỗ này lo
  //    rồi", và lần sửa sau sẽ tin nó.
  //  · NGOÀI LỚP TRÒ CHƠI — chấm nhịp ở đầu trang không nằm trong `.shop` hay `.mb-wrap`,
  //    tức không có `--now` nào chảy tới. Khoá được, nhưng phải đặt đồng hồ ở một gốc thứ ba
  //    trước đã; chưa làm, và ghi ra đây để nó là việc đã biết chứ không phải chỗ bỏ sót.
  const MIEN = [
    ['.mb-lid', 'lịch'], ['.mb-thought', 'lịch'],
    ['.town-walker', 'JS gửi độ trễ'], ['.town-stroll', 'JS gửi độ trễ'],
    ['.resident.pacing', 'JS gửi độ trễ'], ['.mini-frame', 'JS gửi độ trễ'],
    ['.pulse.scanning', 'ngoài lớp trò chơi'], ['.pulse.off.stale', 'ngoài lớp trò chơi'],
  ];
  const css = cssNoComments();
  // Bắt luật TRONG CÙNG: thân không chứa `{}` nào. Nhờ thế cùng một biểu thức chui được vào
  // trong `@media` mà không nuốt cả khối, và mấy khung hình trong `@keyframes` tuy cũng khớp
  // thì lại rơi hết ở bộ lọc `infinite` — không khung hình nào khai từ khoá ấy.
  //
  // KHÔNG neo bộ chọn vào `}` của luật trước. Bản đầu viết `(?:^|[{}])\s*...` và nó bỏ sót
  // đúng hai luật, im lặng: `matchAll` không cho các lần khớp chồng lên nhau, nên cái `}`
  // vừa bị lần khớp trước ăn mất không còn làm mỏ neo cho lần sau được nữa — hai luật viết
  // liền nhau thì luật thứ hai tàng hình. Đúng cái bẫy mà dòng `luat.length` dưới kia sinh
  // ra để bắt, và nó bắt được thật.
  const luat = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
    .map(([, sel, than]) => ({ sel: sel.trim().replace(/\s+/g, ' '), than }))
    .filter((r) => /\binfinite\b/.test(r.than));

  const quen = luat
    .filter((r) => !MIEN.some(([m]) => r.sel.includes(m)))
    .filter((r) => !r.than.includes('--life-lag'))
    .map((r) => r.sel);
  assert.deepEqual(quen, [], `nhịp nền chạy vô hạn mà không khoá pha:\n  ${quen.join('\n  ')}`);

  // Chặn ca phép kiểm tự rỗng. Bản đầu của phép kiểm anh em ngay trên đã qua một cách vô
  // nghĩa vì bộ chọn hụt mất nửa số luật — im lặng, và một phép kiểm im lặng thì tệ hơn
  // không có phép kiểm nào, vì nó còn bán cả sự yên tâm.
  assert.ok(luat.length >= 40, `chỉ soi được ${luat.length} nhịp nền — bộ chọn có vẻ đã hụt`);
  for (const [m, vi] of MIEN) {
    assert.ok(luat.some((r) => r.sel.includes(m)), `${m} (miễn vì: ${vi}) không còn trong danh sách soi — danh sách miễn đã cũ`);
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
 * Đồng hồ việc đang làm tụt ĐÚNG một giây mỗi giây — hai phép trừ không được chồng lên nhau.
 *
 * Lỗi người dùng đo được trên màn hình: *"cooldown thời gian cho ăn vẫn đang chạy 2s 1
 * lần"*. Không hàm nào sai cả, và đó là chỗ đáng đọc kỹ: `leftMs` là một HIỆU SỐ, nên nó
 * chỉ có nghĩa kèm cái mốc mà nó ứng vào, và bản sổ mang theo đúng cái mốc ấy trong `at`.
 * `livePet` giữ cặp ấy khớp nhau — trừ `leftMs` bao nhiêu thì dời `at` bấy nhiêu. Chỗ hỏng
 * là màn Cửa hàng còn giữ MỘT MỐC THỨ HAI của riêng nó (`petAt`, đóng dấu lúc nhận sổ và
 * đứng yên suốt 30 giây giữa hai lượt hỏi), rồi trừ lần nữa theo mốc đó — nên một phút ăn
 * cạn trong ba mươi giây và mọi nút mua mở khoá sớm gấp đôi, trong khi server vẫn còn khoá.
 *
 * `views/pet.js` chạm DOM nên không nhập được vào đây; thứ ghim được là BẤT BIẾN mà nó dựa
 * vào, cộng với chính ca đã hỏng — để lần sau ai dựng lại một mốc thứ hai thì phép kiểm này
 * đỏ trước khi màn hình kịp nói dối.
 */
test('đồng hồ việc đang làm tụt đúng một giây mỗi giây, không trừ chồng', () => {
  const l = emptyLedger([], '2026-08-05', T0);
  const hungry = { ...l, coins: 50, fedAt: new Date(T0 - 0.75 * FULL_MS).toISOString() };
  const { ledger, error } = buy(hungry, 'banhmi', T0);
  assert.equal(error, null);

  // Đúng chuỗi màn Cửa hàng chạy: nhận sổ → đóng dấu → mỗi lượt vẽ vặn lại một lần.
  const tick = (subtractFrom) => {
    let pet = stampPet(petView(ledger, T0), T0);
    const seen = [];
    for (let s = 1; s <= 5; s++) {
      const now = T0 + s * 1000;
      pet = livePet(pet, now);
      seen.push(pet.doing.leftMs - (now - subtractFrom(pet)));
    }
    return seen;
  };

  // Trừ theo mốc của CHÍNH bản vừa vặn — đây là điều `doingNow` làm từ lượt này.
  assert.deepEqual(tick((p) => p.at), [59_000, 58_000, 57_000, 56_000, 55_000]);
  // Ca đã hỏng, ghim lại nguyên hình: mốc nhận đứng yên thì mỗi giây tụt hai giây.
  assert.deepEqual(tick(() => T0), [58_000, 56_000, 54_000, 52_000, 50_000]);
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
    ...['coin', 'full', 'focus', 'price', 'rest'].flatMap((k) => [`pet.how.${k}.t`, `pet.how.${k}.f`, `pet.how.${k}.p`]),
    ...['state', 'dip', 'wake', 'eat', 'no'].flatMap((k) => [`pet.how.${k}.t`, `pet.how.${k}.p`]),
    ...['byFull', 'bySat', 'underMin', 'rangeMin', 'overMin'].map((k) => `pet.how.state.${k}`),
    'pet.free', 'pet.wakesFull', 'pet.oneAtATime', 'pet.eatingNote',
  ];
  for (const k of keys) {
    assert.ok(k in vi, `thiếu ${k} ở VI`);
    assert.ok(k in en, `thiếu ${k} ở EN`);
  }
});


/**
 * Bảng CHÚ GIẢI trạng thái trong thư viện — sinh 9/8 từ một câu hỏi của người dùng:
 * *"'Đang vào nhịp' với 'Ổn' là sao?"*
 *
 * Một bảng chú giải hỏng theo cách riêng của nó, và cả hai kiểu đều KHÔNG có triệu chứng:
 * chữ lệch khỏi chữ đang hiện trên dải thông số (thành ra nó giải thích cho một màn hình
 * khác), hoặc số lệch khỏi mốc thật trong mã (thành ra nó giải thích sai chính cái nó đi
 * giải thích). Hai phép kiểm dưới đây canh đúng hai chỗ đó, và cả hai đều đọc NGƯỢC từ
 * bảng ra — không dựng lại một danh sách tên hợp lệ ở đây, vì một danh sách như thế là bản
 * thứ hai của cùng một sự thật.
 */
test('bảng trạng thái nói ĐÚNG mấy chữ dải thông số đang in ra', () => {
  const [full, sat] = STATE_SCALES();
  // Cùng khoá i18n mà `statCells` đọc — xem `wordRows`/`statCells` bên `lib/pet.js`.
  assert.deepEqual(
    full.rows.map((r) => r[0]),
    ['stuffed', 'fine', 'hungry', 'starving'].map((m) => t(`pet.mood.${m}`)),
  );
  assert.deepEqual(
    sat.rows.map((r) => r[0]),
    ['sharp', 'dip', 'spent'].map((m) => t(`pet.focusMood.${m}`)),
  );
});

test('mọi con số trong bảng trạng thái đều là một mốc CÓ THẬT trong mã', () => {
  const raw = rawText(stateTable());
  // Phần trăm: đúng ba mốc đói, không hơn không kém. Một con số chép tay vào bảng chữ —
  // "≥ 80%" chẳng hạn — lọt qua mọi phép kiểm khác, nhưng không lọt qua phép so tập hợp này.
  const pcts = [...new Set([...raw.matchAll(/(\d+)%/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  const marks = [HUNGER_MARKS.starving, HUNGER_MARKS.hungry, HUNGER_MARKS.stuffed]
    .map((v) => Math.round(v * 100))
    .sort((a, b) => a - b);
  assert.deepEqual(pcts, marks);
  // Và mấy cái mốc ấy phải là mốc mà `moodOf` thật sự đổi chữ ở đó, không phải ba con số
  // đẹp đứng cạnh nhau: bảng nói "≤ 12% là đói lả" thì ở 12% `moodOf` phải trả về đúng thế.
  assert.equal(moodOf(HUNGER_MARKS.stuffed), 'stuffed');
  assert.equal(moodOf(HUNGER_MARKS.hungry), 'hungry');
  assert.equal(moodOf(HUNGER_MARKS.starving), 'starving');
  // Phút: hai mốc của thang ngồi, cùng hai mốc mà huy hiệu ngoài icon nổ (`REST_STAGE_MIN`).
  const [, sat] = STATE_SCALES();
  const mins = [...new Set([...sat.rows.map((r) => r[1]).join(' ').matchAll(/(\d+)/g)].map((m) => Number(m[1])))].sort(
    (a, b) => a - b,
  );
  assert.deepEqual(mins, [REST_STAGE_MIN.dip, REST_STAGE_MIN.spent].sort((a, b) => a - b));
});

test('mọi lớp CSS bảng trạng thái vẽ ra đều có luật thật trong styles.css', () => {
  // Cùng lý lẽ với phép kiểm nhịp ở trên: một cái tên lớp gõ sai không ném lỗi, không ghi
  // console, chỉ lặng lẽ bày ra một cột chữ không có gạch nối và không thẳng hàng.
  const css = cssNoComments();
  const cls = [...new Set([...rawText(stateTable()).matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)))];
  assert.ok(cls.length >= 4, `mới thấy ${cls.length} lớp — bảng phải có vỏ, cột, tít và dòng`);
  for (const c of cls) assert.ok(css.includes(`.${c}`), `bảng vẽ ra .${c} mà styles.css không có luật nào`);
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
    // đúng 0,285), nên phép so phải chấp nhận đúng cái nửa bậc ấy chứ không hơn.
    assert.ok(Math.abs(it.price - want) <= 0.0051, `${id}: ${it.price} xu, công thức ra ${want}`);
  }
});

/**
 * Đọc tỉ giá NGƯỢC RA TỪ BẢNG HÀNG, không dựng lại công thức.
 *
 * Bản trước chốt con số 5 thẳng vào phép so, và lượt 21 nhấc `FULL_MS` lên 8 giờ là nó đỏ —
 * đúng như thiết kế, nhưng nó đỏ vì một chuyện KHÔNG hỏng. Còn `perBar === FULL_MS/3600000 *
 * COIN_PER_HOUR` thì lại là một phép so một vế với chính nó, chẳng giữ được gì.
 *
 * Chỗ đứng đúng là bảng hàng: chia giá của một món CHỈ LẤP BỤNG cho số giờ no nó mua thì ra
 * tỉ giá thật đang chạy. Một cái giá gõ đè lên vẫn lọt lưới của phép chia ấy — và đó chính
 * là thứ phải bắt.
 */
test('giá một giờ no đọc ngược từ bảng hàng ra ĐÚNG tỉ giá — chỗ neo của cả bảng giá', () => {
  const hours = FULL_MS / 3600000;
  const plain = FOODS.filter((id) => !ITEMS[id].wake);
  assert.ok(plain.length >= 3, 'phải còn ít nhất ba món chỉ lấp bụng để đọc ra tỉ giá');
  for (const id of plain) {
    const it = ITEMS[id];
    const rate = it.price / (it.fill * hours);
    assert.ok(
      Math.abs(rate - COIN_PER_HOUR) <= 0.006,
      `${id}: ${it.price} xu cho ${it.fill * hours} giờ no — tỉ giá ${rate}, phải là ${COIN_PER_HOUR}`,
    );
  }
});

/**
 * NHỊP ĐÓI ĐỔI THÌ VÍ KHÔNG ĐƯỢC ĐỔI — luật lượt 15, đo ở chỗ nó dễ vỡ nhất.
 *
 * Lượt 21 nhấc `FULL_MS` từ 5 lên 8 giờ theo yêu cầu người dùng, và một thay đổi như thế
 * ĐÁNG NGỜ đúng vì nó động vào mẫu số của cả bảng giá. Nó an toàn nhờ một tính chất chứ
 * không nhờ may: giá một món là số GIỜ nó mua, nên đồng hồ đói chậm lại thì món vừa đắt
 * hơn vừa no lâu hơn cùng một tỉ lệ, và tiền ăn của một ngày đứng yên.
 *
 * Phép kiểm neo vào `COIN_PER_HOUR` chứ không vào một con số trần: 9/8 tỉ giá hạ 1 → 0,2
 * (*"giá tiền mua thức ăn đang hơi đắt → giảm 80%"* — sử ký ở `src/pet.js`), và một bản
 * ghim cứng "10 xu" sẽ đỏ vì một chuyện không hỏng — đúng vết xe mà bài test tỉ giá ngay
 * trên đã ghi lại một lần.
 */
test('đổi nhịp đói không đụng tới ví — một ngày 10 tiếng vẫn ăn đúng 10 giờ-no', () => {
  const hours = FULL_MS / 3600000;
  const perHour = Math.min(...FOODS.map((id) => ITEMS[id].price / (ITEMS[id].fill * hours)));
  assert.ok(
    Math.abs(10 * perHour - 10 * COIN_PER_HOUR) <= 0.06,
    `ngày 10 tiếng ăn hết ${10 * perHour} xu — phải là ${10 * COIN_PER_HOUR} ở MỌI nhịp đói`,
  );
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
  // trần ra 1.4999999999999998, đúng con số mà sổ sẽ mang nếu `buy` không làm tròn lúc ghi.
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

/** Mọi bản vẽ của một chỗ, không chỉ bản mặc định. Nhà mình có ba bộ đồ đạc kể từ lượt đổi
 *  cảnh theo việc (xem `homeSetOf`), và hai bài test dưới đây phải nhìn thấy CẢ BA — bản đầu
 *  chỉ nhìn `p.rows` và nó bỏ lọt đúng cái ký tự chỉ có trong cảnh bàn ăn. */
const artsOf = (p) => [...new Set([p.rows, ...Object.values(p.sets ?? {})])];

test('hình toà nhà là lưới CHỮ NHẬT — hàng lệch nhau là hình vỡ', () => {
  for (const p of PLACES) {
    for (const rows of artsOf(p)) {
      const w = rows[0].length;
      for (const [i, row] of rows.entries()) {
        assert.equal(row.length, w, `${p.id} hàng ${i} dài ${row.length}, phải là ${w}`);
      }
    }
  }
});

/**
 * Ba cảnh của căn phòng phải phủ ĐÚNG một khối ô như nhau.
 *
 * Đây là phép canh "không món đồ nào thò ra ngoài sàn", viết bằng thứ đo được. Sàn là một
 * hình THOI nên nó thu vào bốn ô mỗi hàng khi đi xuống, còn tấm thảm tập là một chữ NHẬT nên
 * nó không thu — đặt nó thấp bằng tấm thảm tròn thì hai góc trước của nó đứng lơ lửng trên
 * cỏ, và trên màn hình thì phải nhìn kỹ mới thấy (đã dính đúng lần này, chữa bằng cách nâng
 * nó bảy hàng).
 *
 * Đo bằng phép so tập ô CÓ VẼ chứ không bằng một bảng toạ độ chép tay: mọi món đồ trong nhà
 * đều đắp ĐÈ lên sàn hoặc lên vách, nên chúng chỉ đổi MÀU mấy ô đã có. Một ô có vẽ ở cảnh này
 * mà trống ở cảnh kia thì đúng nghĩa đen là một món đồ vừa mọc ra ngoài căn phòng.
 *
 * Nó canh luôn một điều kiện thứ hai mà `SPOT` đang dựa vào: ba cảnh cùng khung, cùng chiều
 * cao. Lệch một hàng là lúc đổi cảnh quản gia nhích lên hoặc lún xuống một ô.
 */
test('ba cảnh trong nhà phủ đúng một khối ô — không món đồ nào mọc ra ngoài phòng', () => {
  const home = PLACES.find((p) => p.id === 'home');
  const inked = (rows) => {
    const s = new Set();
    rows.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && s.add(`${x},${y}`)));
    return s;
  };
  const [base, ...rest] = artsOf(home).map((rows) => ({ rows, ink: inked(rows) }));
  for (const s of rest) {
    assert.equal(s.rows.length, base.rows.length, 'hai cảnh khác chiều cao — chỗ đứng của quản gia sẽ lệch');
    const out = [...s.ink].filter((k) => !base.ink.has(k));
    const gone = [...base.ink].filter((k) => !s.ink.has(k));
    assert.equal(out.length, 0, `có ${out.length} ô mọc ra ngoài căn phòng, ô đầu ở ${out[0]}`);
    assert.equal(gone.length, 0, `có ${gone.length} ô của căn phòng bị một cảnh đục thủng, ô đầu ở ${gone[0]}`);
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
    for (const rows of artsOf(p)) for (const row of rows) for (const c of row) if (c !== '.') used.add(c);
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
 * Cây cối quanh phố phải đứng NGOÀI lưới — trừ cái giếng, thứ bắt buộc đứng TRÊN lưới.
 *
 * Với cây thì đó là toàn bộ việc của chúng: mấy mắt lưới đều tăm tắp đọc thành bàn cờ, và
 * thứ phá cái đều ấy chỉ phá được nếu nó không rơi vào chính mấy mắt ấy. Một cái cây tình cờ
 * đứng đúng mắt lưới trông như một toà nhà chưa vẽ xong.
 *
 * Cái giếng thì ngược lại, và ngược lại vì một lý do đo được: hai cái ngõ sau khép về nó, mà
 * đầu đường thì chỉ khai được bằng mắt lưới. Đẩy nó lệch đi vài pixel cho "tự nhiên" là hai
 * cái ngõ đứng nguyên còn cái mốc trôi đi, và cái ngã ba hở ra.
 */
test('cây cối quanh phố không đứng trên mắt lưới — trừ cái giếng, thứ phải đứng', () => {
  assert.ok(SCENE_SPOTS.length >= 8, 'ít quá thì hai rìa bản đồ vẫn đọc thành lề thừa');
  const onGrid = (s) => s.x % STEP.x === 0 && s.y % STEP.y === 0 && Math.abs((s.x / STEP.x + s.y / STEP.y) % 2) === 0;
  const wells = SCENE_SPOTS.filter((s) => s.kind === 'well');
  assert.equal(wells.length, 1, 'đúng một cái giếng — nó là MỐC của hai cái ngõ sau');
  assert.ok(onGrid(wells[0]), 'cái giếng phải đứng đúng mắt lưới, nếu không hai cái ngõ trượt khỏi nó');
  for (const s of SCENE_SPOTS.filter((x) => x.kind !== 'well')) {
    assert.ok(!onGrid(s), `cây ở (${s.x}, ${s.y}) đứng đúng mắt lưới, chỗ dành cho một toà nhà`);
  }
});

/**
 * KHÔNG vật phong cảnh nào được đứng TRÊN mặt đường.
 *
 * Người dùng chỉ vào ảnh: "mấy vật thể đang nằm giữa đường nhìn rất là kì". Đo lại thì đúng
 * ba vật — hai cái cây và một cột đèn.
 *
 * Vì sao nó lọt được, và vì sao phải có bài test chứ không phải chỉnh ba con số rồi thôi:
 * mặt đường KHÔNG phải cái hộp bao khai trong `ROADS`. Cái thẻ ấy bị lệch trục 26,565°, nên
 * dải nó phủ trượt lên hoặc xuống tới 190px ở hai đầu. Đặt cây bằng mắt trên toạ độ thì chỗ
 * ấy "trông xa đường" trong khi thật ra nó nằm giữa lòng đường — và mã thì không nói gì cả.
 *
 * Đo trên CẢ hộp của sprite chứ không mỗi cái chân: một cột đèn cao 36px có chân trên cỏ mà
 * thân cắt ngang mặt đường thì vẫn là một cột đèn mọc giữa đường.
 *
 * Cái giếng là ngoại lệ, và nó phải là ngoại lệ: nó LÀ cái mốc mà hai ngõ sau khép về, nên
 * cái sân của nó bắt buộc trùm lên chỗ hai ngõ gặp nhau.
 */
test('không cây, đèn hay bụi nào mọc giữa lòng đường', () => {
  // Cỡ lấy từ `SCENE_SPOTS` — nó đo bằng `sizeOf` trên chính mảng hình, nên bài test không
  // giữ một bảng cỡ thứ hai để mà lệch. Quét theo lưới 4px, đúng cỡ ô của cả bức tranh.
  const covers = (s) => {
    for (let x = s.x - s.w / 2; x <= s.x + s.w / 2; x += 4) {
      for (let y = s.y - s.h; y <= s.y; y += 4) if (onRoad(x, y)) return true;
    }
    return false;
  };
  const wells = SCENE_SPOTS.filter((s) => s.kind === 'well');
  assert.ok(covers(wells[0]), 'cái giếng PHẢI trùm ngã ba — nó là mốc của hai ngõ sau');
  for (const s of SCENE_SPOTS.filter((x) => x.kind !== 'well')) {
    assert.ok(!covers(s), `${s.kind} ở (${s.x}, ${s.y}) đè lên mặt đường`);
  }
});

/**
 * VÒNG ĐẾM NGƯỢC — mười hai ô, và ô nào đã hết giờ thì đã tắt sẵn ở khung hình ĐẦU.
 *
 * Vế thứ hai là vế đáng canh. Popover không có nhịp vẽ lại nào và bản đồ thì vẽ lại mỗi giây;
 * cái giữ cho hai chỗ ấy chạy giống nhau là độ trễ ÂM bằng đúng phần đã trôi. Bỏ dấu trừ đi
 * thì cái vòng đầy lại từ đầu mỗi lượt vẽ — trên bản đồ là mỗi giây một lần, mà không có gì
 * đỏ lên báo.
 *
 * Phép thử đọc thẳng chuỗi `animation-delay` trong style: đó chính là con số quyết.
 */
test('vòng đếm ngược: 12 ô, và phần đã trôi thì đã tắt sẵn', () => {
  const html = rawText(doingRing({ ms: 60000, leftMs: 45000 }));
  const cells = html.match(/animation:ring-out (\d+)ms steps\(1, end\) (-?\d+)ms/g) ?? [];
  assert.equal(cells.length, 12, 'đủ mười hai ô — một mặt đồng hồ, không phải mười một');

  const nums = [...html.matchAll(/animation:ring-out (\d+)ms steps\(1, end\) (-?\d+)ms/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  const gone = 15000;
  assert.ok(nums.every(([, lag]) => lag === -gone), 'mọi ô cùng một độ trễ ÂM bằng phần đã trôi');
  // Mốc tắt phải TĂNG DẦN quanh vành và ô cuối rơi đúng vào lúc hết giờ.
  for (let i = 1; i < nums.length; i += 1) assert.ok(nums[i][0] > nums[i - 1][0], 'kim phải chạy một chiều');
  assert.equal(nums[nums.length - 1][0], 60000, 'ô cuối tắt đúng lúc việc xong');
  // Ba ô đầu (mốc 5000/10000/15000) đã tới hạn ở khung hình đầu — hoạt hình của chúng đã
  // chạy hết ngay từ lúc vẽ, và `forwards` giữ chúng ở trạng thái tắt.
  assert.equal(nums.filter(([t]) => t <= gone).length, 3);

  assert.equal(doingRing(null), '', 'rảnh thì không có vòng nào');
});

/**
 * KHÔNG đầu đường nào được dừng giữa bãi cỏ.
 *
 * Người dùng chỉ ra lỗi bằng đúng một câu: "đường bị cụt, không biết đi tiếp đến đâu". Luật
 * chữa nó có hai vế, và bài test này canh cả hai:
 *
 * 1. Đoạn `open` là con phố CỐ Ý chạy ra khỏi bức tranh. Cả hai đầu phải nằm ngoài
 *    `TOWN_BOX` — chỉ cần một đầu lọt vào trong khung là nó lại cụt, mà lần này cụt ngay
 *    giữa khung.
 * 2. Đoạn thường phải có CẢ HAI đầu đè lên một đoạn khác, tức là một ngã ba. Phép thử chạy
 *    trên MẮT LƯỚI nên nó hoặc đúng hoặc sai, không có vùng xám kiểu "gần một đoạn khác".
 *
 * Đây là loại lỗi mà không có bài test thì không có gì đỏ lên: thêm một toà nhà thứ sáu ở một
 * mắt lưới mới rồi quên kéo đường tới nó thì trang vẫn dựng, vẫn đẹp, và vẫn có một con đường
 * dẫn ra chỗ không có gì.
 */
test('không đầu đường nào cụt: hoặc là ngã ba, hoặc là ra khỏi khung', () => {
  // Một đoạn trên lưới luôn nằm dọc đúng một trục, nên "điểm nằm trên đoạn" là phép thử trên
  // số nguyên: trùng trục kia, và kẹp giữa hai đầu.
  const covers = (rd, [a, b]) => {
    const [[a1, b1], [a2, b2]] = rd.ends;
    const between = (v, p, q) => v >= Math.min(p, q) && v <= Math.max(p, q);
    if (a1 === a2) return a === a1 && between(b, b1, b2);
    if (b1 === b2) return b === b1 && between(a, a1, a2);
    return false;
  };
  const outside = (rd) => rd.x + TOWN_BOX.ox < 0 && rd.x + rd.w + TOWN_BOX.ox > TOWN_BOX.w;
  let junctions = 0;
  for (const rd of ROADS) {
    if (rd.open) {
      assert.ok(outside(rd), `con phố ${JSON.stringify(rd.ends)} dừng lại trong khung — nó phải chạy ra ngoài`);
      continue;
    }
    for (const end of rd.ends) {
      assert.ok(
        ROADS.some((other) => other !== rd && covers(other, end)),
        `đầu ngõ ở mắt lưới (${end}) không gặp đoạn nào khác — nó cụt giữa bãi cỏ`,
      );
      junctions += 1;
    }
  }
  assert.ok(junctions >= 8, 'ít ngã ba quá thì hai đầu bản đồ không khép lại được');
});

/**
 * Sân giếng phải trùm được chỗ hai cái ngõ thò quá nó, và không được đội mép bản đồ lên.
 *
 * Vế thứ nhất: mỗi ngõ chạy quá mắt lưới của cái giếng một đoạn, và đoạn ấy phải nằm TRÊN
 * sân chứ không nằm trên cỏ — một mẩu đường rời trên bãi cỏ đọc đúng thành "cụt", thứ vừa đi
 * sửa. Đo đoạn thò từ chính `ROADS` chứ không chép lại `ROAD_PAD`: chép lại thì lần chỉnh
 * `ROAD_PAD` sau bài test vẫn xanh trong khi bức tranh đã hỏng.
 *
 * Vế thứ hai: nó đứng ở `y = -2 × STEP.y`, còn mép trên bản đồ ở `-TOWN_BOX.oy`. Cao quá
 * khoảng ấy là cả bản đồ phải nở ra vì một vật trang trí — đúng cái giá đã từ chối trả cho
 * hai ô đất ngoài cùng ở lượt trước. Và chạm SÁT mép cũng đã hỏng: một vật chạm đường viền
 * khung thì đọc thành bị cắt.
 */
test('sân giếng trùm được cái ngã ba sau, và không đội mép bản đồ lên', () => {
  const well = SCENE_SPOTS.find((s) => s.kind === 'well');
  const lanes = ROADS.filter((r) => !r.open && r.ends.some(([a, b]) => cellPos(a, b).x === well.x && cellPos(a, b).y === well.y));
  assert.equal(lanes.length, 2, 'phải đúng hai cái ngõ khép về giếng');
  const over = Math.max(...lanes.map((r) => Math.min(r.x + r.w - well.x, well.x - r.x)));
  assert.ok(sizeOf(WELL).w / 2 >= over, `ngõ thò quá giếng ${over}px, sân chỉ với ra được ${sizeOf(WELL).w / 2}px`);
  assert.ok(sizeOf(WELL).h < TOWN_BOX.oy - STEP.y * 2, 'cái giếng chạm hoặc vượt mép trên bản đồ');
});

/**
 * Viền phải dựng TỪ hình, và phải kín.
 *
 * Ba tính chất, và cả ba là thứ mà một bản viền chép tay sẽ hỏng ở lần sửa hình thứ hai:
 *
 * 1. Nở đúng MỘT ô mỗi phía — chỗ gọi lệch lớp viền lên trên-trái đúng 4px, nên lệch con số
 *    này là cả cái viền trượt khỏi hình.
 * 2. Không ô viền nào đè lên ô đặc. Đè thì cái viền đang XOÁ hình chứ không bao lấy hình.
 * 3. Mọi ô đặc nằm ở rìa đều có ô viền kề bên. Đây là vế nói "kín" — một chỗ hở duy nhất
 *    cũng đủ cho cái hình rò ra nền, mà chỗ hở thì mắt chỉ thấy khi đã đứng sai nền.
 */
test('viền dựng từ hình: nở một ô, không đè lên hình, và kín', () => {
  const art = ['.##.', '####', '#..#', '.##.'];
  const edge = outlineRows(art);
  assert.equal(edge.length, art.length + 2, 'viền phải cao hơn hình đúng hai hàng');
  assert.equal(edge[0].length, art[0].length + 2, 'viền phải rộng hơn hình đúng hai cột');
  const solid = (x, y) => ((art[y] ?? '')[x] ?? '.') !== '.';
  const edged = (x, y) => (edge[y + 1] ?? '')[x + 1] === 'o';
  const near = (x, y, f) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => f(x + dx, y + dy)));
  for (let y = 0; y < art.length; y += 1) {
    for (let x = 0; x < art[y].length; x += 1) {
      if (solid(x, y)) {
        assert.ok(!edged(x, y), `ô đặc (${x}, ${y}) bị viền đè lên`);
        if (near(x, y, (a, b) => !solid(a, b))) {
          assert.ok(near(x, y, edged), `ô rìa (${x}, ${y}) không có ô viền nào kề bên`);
        }
      }
    }
  }
});

/**
 * Cái khay VẼ ĐÚNG số đĩa mà nó khai, và nó khai NĂM.
 *
 * Chiều suy đã đảo ở lượt 22 — xem `DISHES` trong `lib/pet.js`. Trước đó số đĩa là hệ quả của
 * `FULL_MS` và phép kiểm này canh đúng chuyện đó; giờ số đĩa là hằng của giao diện, nên chỗ
 * đáng canh cũng đổi: **hình vẽ ra phải khớp với con số đã khai.** `trayRows` với `hungerTray`
 * là hai đường khác nhau tới cùng một cái khay, và chúng trôi khỏi nhau được.
 *
 * Con số 5 chốt thẳng ở đây, cố ý: nó là một quyết định giao diện (người dùng xin đúng con số
 * ấy, và năm là ngưỡng đếm-mà-không-phải-đếm), không phải hệ quả của một hằng số nào. Một
 * quyết định thì phép kiểm được phép gọi tên nó.
 */
test('khay vẽ đúng NĂM cái đĩa, đúng bằng con số nó khai', () => {
  assert.equal(DISHES, 5, 'khay là năm đĩa — xem khối chú thích của DISHES');
  const dishes = DISHES;
  const rows = trayRows(dishes, dishes);

  assert.equal(rows.length, 4, 'một cái đĩa cao 4 hàng, cả khay cũng thế');
  assert.equal(
    rows[0].length,
    dishes * 4 + (dishes - 1),
    'bề rộng phải suy từ số món: mỗi món 4 ô, giữa hai món một ô hở',
  );
  // Số món vẽ ra phải đúng bằng số món khai — đếm bằng cách chia hàng theo ô hở.
  const groups = rows[3].split('.');
  assert.equal(groups.length, dishes, `phải có đúng ${dishes} cái bát`);
  assert.ok(groups.every((g) => g === 'pppp'), 'mỗi cái bát rộng đúng 4 ô');
  // Cái bát phải vẽ Y HỆT nhau ở hai trạng thái, không thì mẫu số co lại theo mức.
  const bowl = (rows2) => rows2.map((r) => [...r].map((c) => (c === 'p' ? 'p' : '.')).join(''));
  assert.deepEqual(bowl(trayRows(1, 1)), bowl(trayRows(0, 1)), 'bát đầy và bát rỗng phải cùng một cái bát');
});

/**
 * Cái ĐĨA là mẫu số, và nó phải ở lại NGUYÊN VẸN ở mọi mức.
 *
 * Đây chính là cái lỗi đã nhìn thấy trên màn hình hai đời trước: cái thanh mười ô vẽ phần
 * chưa sáng bằng `--text-3` ở 24%, tức gần như tàng hình trên theme sáng — mất phần chưa
 * sáng là mất mẫu số, mà không có mẫu số thì con số không đọc được, chỉ còn một vệt lục dài
 * ngắn tuỳ lúc.
 *
 * Khay sửa chuyện ấy bằng cách cho mẫu số một hình THẬT: cái đĩa rỗng rộng đúng bằng cái đĩa
 * đầy. Nên phép kiểm đếm số ô đĩa, và số ấy phải là hằng ở mọi mức.
 */
test('khay không làm mất cái đĩa nào, kể cả lúc cạn sạch', () => {
  const dishes = DISHES;
  const draw = (full) => rawText(hungerTray({ full, mood: moodOf(full) }));
  const count = (s, re) => (s.match(re) ?? []).length;

  // Số ô của MỘT cái bát đọc từ chính lưới bát rỗng — sửa hình là phép kiểm đi theo.
  const perBowl = trayRows(0, 1).join('').split('p').length - 1;
  for (const f of [1, 0.79, 0.5, 0.11, 0.02, 0]) {
    assert.equal(count(draw(f), /px plate/g), dishes * perBowl, `mức ${f}: cái bát biến mất mất rồi`);
  }

  // Phần CÓ MÓN phải đúng bằng phần còn lại. Số ô của MỘT món đọc từ chính cái lưới một
  // món, không gõ tay — sửa hình cái đĩa là phép kiểm đi theo.
  const perDish = trayRows(1, 1).join('').split('f').length - 1;
  assert.equal(count(draw(1), /px food/g), dishes * perDish, 'đầy thì mọi đĩa đều có món');
  assert.equal(count(draw(0), /px food/g), 0, 'cạn sạch thì không còn món nào');
  assert.ok(count(draw(0.02), /px food/g) >= perDish, 'còn một chút thì vẫn phải sót đúng một món');
  const half = count(draw(0.5), /px food/g);
  assert.ok(half > 0 && half < dishes * perDish, 'nửa chừng thì khay phải vơi một nửa');
});

/**
 * Mặt đồng hồ: vành khép KÍN, và phần đã tiêu vẫn ở lại làm mẫu số.
 *
 * Hai tính chất, và cả hai là thứ đổi hình dễ làm gãy nhất:
 *
 * 1. **Vành là một vòng LIỀN.** Mỗi ô của vành phải kề ô trước nó theo đúng thứ tự khai —
 *    lệch một toạ độ là cái vành hở ra một chỗ, mà một vòng tròn hở thì thôi không còn là
 *    vòng tròn. Phép kiểm chạy trên chính bảng toạ độ nên nó bắt được lỗi trước khi ai kịp
 *    mở trang.
 * 2. **Phần đã tiêu KHÔNG biến mất.** Nó là mẫu số, đúng vai cái đĩa rỗng bên khay — thiếu
 *    nó thì cái cung có màu lửng lơ giữa khoảng trống và không ai đọc được "còn bao nhiêu
 *    trên bao nhiêu".
 */
test('mặt đồng hồ: vành khép kín, và phần đã tiêu vẫn ở lại làm mẫu số', () => {
  const cells = (rows, ch) => rows.join('').split(ch).length - 1;
  const full = dialRows(16);
  const n = cells(full, 'w');

  assert.equal(full.length, full[0].length, 'mặt đồng hồ phải VUÔNG — một vành 7×6 là một hình bầu dục');
  assert.ok(n >= 12, `vành ${n} ô thì quá thô để đọc ra một vòng tròn`);

  // Vành liền: mọi ô kề nhau theo đúng thứ tự vẽ, kể cả cặp cuối–đầu (nó là một VÒNG).
  const on = [];
  full.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'w') on.push([x, y]); }));
  assert.equal(on.length, n, 'đầy thì cả vành phải có màu, không sót ô nào');

  for (const lit of [n, 12, 8, 1, 0]) {
    const rows = dialRows(lit);
    assert.equal(rows.length, full.length, `mức ${lit}: khung phải giữ nguyên cỡ`);
    assert.equal(cells(rows, 'w'), lit, `mức ${lit}: số ô có màu phải bằng số ô còn lại`);
    assert.equal(cells(rows, 'd') >= n - lit, true, `mức ${lit}: phần đã tiêu phải ở lại làm mẫu số`);
  }
});

/**
 * Chấm giữa CHÁY hay TẮT là một kênh nhị phân, và nó phải khớp với `focusMood`.
 *
 * Đây là kênh mà đồng hồ cát không có và là lý do bỏ nó: nó BÃO HOÀ — ngồi 91 phút và ngồi
 * 300 phút cho ra cùng một cái bầu rỗng, đúng ở quãng lời nhắc đang kêu. Mặt đồng hồ vẫn bão
 * hoà y như thế (`focus` bị kẹp về 0), nên chính cái chấm giữa là thứ gánh câu trả lời — mất
 * nó là quay về đúng cái lỗi đã bỏ hai đời hình để chữa.
 */
test('mặt đồng hồ: hết nhịp thì chấm giữa tắt và có khói', () => {
  const draw = (focus) => rawText(focusDial({ focus, focusMood: focusMoodOf(focus) }));
  const has = (s, cls) => new RegExp(`px ${cls}`).test(s);

  for (const f of [1, 0.5, 0.05]) {
    assert.ok(has(draw(f), 'flame'), `mức ${f}: còn nhịp thì chấm giữa phải còn cháy`);
    assert.ok(!has(draw(f), 'smoke'), `mức ${f}: chưa hết nhịp thì chưa có khói`);
  }
  assert.ok(!has(draw(0), 'flame'), 'hết nhịp thì chấm giữa phải TẮT');
  assert.ok(has(draw(0), 'smoke'), 'hết nhịp thì phải có khói — đó là kênh thay cho chấm cháy');
  assert.ok(!has(draw(0), 'wax'), 'hết nhịp thì không còn ô nào của vành có màu');

  // Sổ đời cũ chưa có trường này: không vẽ gì cả, chứ không vẽ một mặt đồng hồ rỗng.
  assert.equal(rawText(focusDial({})), '');
});

/**
 * Hai chỉ số phải khác nhau về LOẠI HÌNH, không chỉ về màu và cỡ.
 *
 * Đời đầu chúng là cùng một cái thanh khác nhau ba thứ nhỏ — mười ô với chín, một cái khe,
 * ô hẹp hơn vài pixel. Trên giấy là ba kênh; trên màn hình thì chênh vài pixel bề rộng đọc
 * thành "cùng một thứ ở hai cỡ", nên phần phân biệt rơi hết về màu — đúng thứ mà luật theme
 * daltonized của dự án cấm ở mọi chỗ khác.
 *
 * Từ lượt mặt đồng hồ thì phép kiểm không còn hỏi "một cái nằm, một cái đứng" được nữa: cái
 * đồng hồ VUÔNG. Nó hỏi thứ bền hơn — **một cái là dãy vật RỜI, một cái là đường KHÉP KÍN**
 * — bằng cách đếm số hình chữ nhật bao ngoài: cái khay dài gấp nhiều lần bề cao, cái đồng hồ
 * thì vuông. Hai tỉ lệ ấy không có cỡ nào làm chúng lẫn vào nhau.
 */
test('độ no và tập trung không còn là hai cái thanh giống nhau', () => {
  const pet = { full: 0.5, mood: 'fine', focus: 0.5, focusMood: 'sharp' };
  const tray = rawText(hungerTray(pet));
  const dial = rawText(focusDial(pet));

  assert.match(tray, /class="pet-tray/, 'độ no là cái khay');
  assert.doesNotMatch(tray, /pet-dial/);
  assert.match(dial, /class="pet-dial/, 'tập trung là mặt đồng hồ');
  assert.doesNotMatch(dial, /pet-tray/, 'mặt đồng hồ mà mượn lại class của khay là quay về ca cũ');

  const box = (s) => (/width:(\d+)px;height:(\d+)px/.exec(s) ?? []).slice(1).map(Number);
  const [tw, th] = box(tray);
  const [dw, dh] = box(dial);
  assert.ok(tw >= th * 3, `khay phải là một DẢI dài, đang là ${tw}×${th}`);
  assert.equal(dw, dh, `mặt đồng hồ phải vuông, đang là ${dw}×${dh}`);
  // Nó KHÔNG được cao hơn cây nến cũ: 36px là trần mà dải popover chịu được.
  assert.ok(dh <= 36, `mặt đồng hồ cao ${dh}px — quá 36px là dải popover đội lên`);
});

/* ── Lượt 10: máy trạng thái, hai tư thế mới, ba nét ────────────────────────── */

/**
 * Thứ hạng trạng thái phải KIỂM ĐƯỢC, vì trước lượt này nó không tồn tại thành một vật.
 *
 * Nó nằm trong thứ tự mấy dòng `if` của `moodOfScene` bên popover, còn bản đồ thị trấn thì
 * đọc ba nguồn theo một luật khác — hai bề mặt, hai luật, không ai viết ra luật nào. Phép
 * kiểm này khoá đúng những ca mà hai nguồn CÃI NHAU, vì đó là những ca duy nhất mà thứ hạng
 * có nghĩa; một trạng thái đơn lẻ thì luật nào cũng cho ra cùng đáp án.
 */
test('thứ hạng trạng thái quản gia: việc đang làm > đói lả > kiệt > đói > hết nhịp', () => {
  const p = (o) => ({ on: true, mood: 'fine', focusMood: 'sharp', doing: null, ...o });

  assert.equal(stateOf(p({})), 'well');
  // Việc đang làm thắng MỌI thứ, kể cả đói lả cộng kiệt sức cùng lúc: nó là thứ người dùng
  // vừa bấm, và nó kết thúc trong một phút.
  assert.equal(stateOf(p({ doing: { kind: 'move', id: 'water' }, mood: 'starving', focusMood: 'spent' })), 'busy');
  // Đói lả trên kiệt sức. Lý do là TẦN SUẤT — xem chú thích của `stateOf`.
  assert.equal(stateOf(p({ mood: 'starving', focusMood: 'spent' })), 'starving');
  assert.equal(stateOf(p({ focusMood: 'spent' })), 'spent');
  // Đói (chưa lả) vẫn đứng trên hết-nhịp, cùng luật thứ tự với hai bậc nặng ngay trên.
  assert.equal(stateOf(p({ mood: 'hungry', focusMood: 'dip' })), 'hungry');
  assert.equal(stateOf(p({ focusMood: 'dip' })), 'dip');
  // No căng không phải một trạng thái đáng vẽ riêng — nó chỉ là "vừa ăn xong".
  assert.equal(stateOf(p({ mood: 'stuffed' })), 'well');
  // Trò chơi tắt thì không có con vật nào để nói về.
  assert.equal(stateOf(p({ on: false, mood: 'starving' })), 'well');
});

/**
 * Mỗi trạng thái phải cho ra một CÁCH VẼ khác nhau — đó là toàn bộ việc của lượt này.
 *
 * Chỗ hỏng nó sửa: `starving` và `spent` từng cùng ra một hình ngủ gật, tức hai chuyện sửa
 * bằng hai cách hoàn toàn khác nhau (bấm mua một bát phở / đứng dậy khỏi ghế) nói chung một
 * câu. Phép kiểm khoá đúng chỗ đó và không khoá thêm gì: nó không nói tư thế nào phải là
 * dáng gì, chỉ nói hai trạng thái ấy không được trùng nhau.
 */
test('mỗi trạng thái quản gia có một cách vẽ riêng', () => {
  const look = (o) => butlerLook({ on: true, mood: 'fine', focusMood: 'sharp', doing: null, ...o });
  const key = (l) => `${l.pose}/${l.eyes}/${l.mark}`;

  const starving = look({ mood: 'starving' });
  const spent = look({ focusMood: 'spent' });
  assert.notEqual(key(starving), key(spent), 'đói lả và kiệt sức lại vẽ giống nhau — đúng ca lượt này sinh ra để sửa');

  assert.equal(spent.eyes, 'shut', 'kiệt sức vẫn là ngủ gật');
  assert.equal(starving.eyes, 'open', 'đói lả thì THỨC, khác hẳn ngủ gật');
  assert.equal(look({ mood: 'hungry' }).mark, 'pang');
  assert.equal(look({ focusMood: 'dip' }).mark, 'sweat');
  assert.equal(look({}).mark, null, 'không có gì để nói thì không được vẽ thêm nét nào');

  // Dáng mừng là một SỰ KIỆN, không phải một trạng thái đọc từ sổ — nên nó thắng cả `busy`.
  // Không thắng thì nó không bao giờ được thấy: mua đồ ăn xong `doing` bật lên ngay trong
  // cùng một lượt trả lời.
  const bought = butlerLook({ on: true, mood: 'fine', focusMood: 'sharp', doing: { kind: 'food', id: 'pho' } }, { cheer: true });
  assert.equal(bought.pose, 'cheer');
});

/**
 * Hai tư thế mới phải phân biệt được bằng ĐƯỜNG BAO, không bằng chi tiết.
 *
 * Ở lưới 4px thì một cổ tay xoay hay một khớp gối co là bốn pixel không ai đọc ra — chỉ
 * đường bao còn nói được (xem chú thích của `POSE`). Phép kiểm đo đúng hai đầu của đường
 * bao, hai chỗ mắt đọc trước nhất, và nó đo bằng SỐ Ô chứ không so chuỗi: sửa vài pixel ở
 * giữa thân thì nó phải im, còn làm phẳng cái vai hay chụm lại hai chân thì nó phải đỏ.
 */
test('slump và cheer khác stand ở hai đầu đường bao', () => {
  const w = (rows, y) => [...rows[y]].filter((c) => c !== '.').length;
  const stand = butlerRows('stand').slice(9);
  const slump = butlerRows('slump').slice(9);
  const cheer = butlerRows('cheer').slice(9);

  // Đỉnh: vai của `slump` đã tụt xuống một hàng, nên hàng đầu chỉ còn cái cổ.
  assert.ok(w(slump, 0) < w(stand, 0), 'slump phải hẹp hơn stand ở hàng vai');
  // Đáy: `stand` đứng hai chân tách, `slump` chụm lại thành một khối liền.
  assert.match(stand.at(-1), /#\.+#/, 'stand vốn phải có khe giữa hai chân');
  assert.doesNotMatch(slump.at(-1), /#\.+#/, 'slump phải chụm chân — đó là nửa dưới của cái đường bao');
  // `cheer` thì ngược lại: hai bàn chân hất RA NGOÀI, rộng hơn cả thân.
  assert.ok(w(cheer, 6) >= w(stand, 6), 'cheer phải xoè chân rộng hơn stand');
  assert.ok(cheer.at(-1).indexOf('#') < stand.at(-1).indexOf('#'), 'bàn chân cheer phải hất ra ngoài trục đứng');

  // Cái đầu là cái mark của app và KHÔNG ai được vẽ lại nó — chín hàng đầu phải y hệt nhau
  // ở mọi tư thế. Đây là ràng buộc nặng nhất của cả bộ sprite.
  for (const pose of ['stand', 'walk', 'up', 'hold', 'slump', 'cheer']) {
    assert.deepEqual(butlerRows(pose).slice(0, 9), butlerRows('stand').slice(0, 9), `tư thế ${pose} đã đụng vào cái đầu`);
  }
});

/**
 * Nét bụng kêu phải BÁM THEO tư thế, không đứng ở một toạ độ cố định.
 *
 * Cùng cái lỗi mà `butlerHand` đã sửa cho món đồ đang cầm: một cặp toạ độ chép sang chỗ khác
 * là bản thứ hai của một con số, và lần đổi tư thế sau là cái nét lơ lửng cách cái bụng hai
 * ô.
 *
 * Phép kiểm so với chính MẤY HÀNG PIXEL chứ không so hai tư thế với nhau, và đó là một chỗ
 * bản đầu viết sai rồi bị chính nó bắt: `slump` và `stand` có hàng bụng y hệt (`stand` thu
 * tay ở hàng 4, không phải hàng 3), nên đòi hai tư thế ấy ra hai toạ độ khác nhau là đòi
 * một khác biệt không có thật. Cái đáng khoá là "toạ độ SUY RA từ hình", và cách duy nhất
 * kiểm được điều đó là tính lại nó từ hình.
 */
test('nét trạng thái neo vào thân của tư thế đang vẽ', () => {
  const at = (mark, pose) => /left:(\d+)px;top:(\d+)px/.exec(rawText(markArt(mark, pose)))?.slice(1).map(Number);
  // Hàng bụng là hàng 3 của phần THÂN, tức hàng 12 của cả sprite (đầu chiếm 9 hàng).
  const belly = (pose) => [(butlerRows(pose)[12].lastIndexOf('#') + 1) * 4, 12 * 4];

  assert.equal(rawText(markArt(null, 'stand')), '', 'không có nét thì không vẽ gì');
  for (const pose of ['stand', 'walk', 'up', 'hold', 'slump', 'cheer']) {
    assert.deepEqual(at('pang', pose), belly(pose), `nét bụng kêu ở tư thế ${pose} không suy từ hình`);
  }
  // Và phải có ít nhất một cặp tư thế cho ra hai chỗ khác nhau, nếu không thì phép suy ở
  // trên vẫn đúng mà vô nghĩa — một hằng số cũng thoả.
  assert.notDeepEqual(at('pang', 'stand'), at('pang', 'hold'), 'mọi tư thế cho ra cùng một chỗ — phép neo không thật sự động');

  // Giọt mồ hôi bám THÁI DƯƠNG, mà cái đầu thì cố định ở mọi tư thế — nên nó phải đứng yên.
  assert.deepEqual(at('sweat', 'stand'), at('sweat', 'slump'), 'giọt mồ hôi bám đầu, mà đầu thì không đổi');
  // Hai tia mừng bay quanh cả người nên chỗ đứng do CSS rải, không do sprite.
  assert.equal(rawText(markArt('spark', 'cheer')).match(/pet-mark mark-spark/g)?.length, 2, 'phải là HAI tia, một tia đọc thành đèn báo');
});

/* ── Lượt 14: cơn đói có hậu quả, và quản gia ngồi vào bàn ─────────────────── */

/**
 * Cơn đói phải NÓI được, và nó phải nói ở đúng cái cửa của nó.
 *
 * Người dùng chỉ ra chỗ trống: "gợi ý nổi lên khi đói hoặc thiếu năng lượng tôi chưa thấy
 * gì khác biệt ngoài thanh năng lượng cạn đi cả". Đo lại thì đúng — `nudgeOf` đời trước chỉ
 * đọc `focusMood`, nên một quản gia đói lả mà đầu óc còn tỉnh thì cả màn hình im lặng.
 *
 * Ba vế, và mỗi vế là một cách hỏng riêng:
 *
 * 1. Đói lả thì phải có câu, kể cả khi nhịp ngồi đang tốt.
 * 2. Nó phải THẮNG câu về nhịp ngồi — cùng thứ hạng mà `stateOf` đã dựng, vì việc cần làm
 *    là ăn chứ không phải đứng dậy đi lại.
 * 3. Cái nút phải dẫn về QUÁN ĂN. Một câu "đói lả rồi" kèm cái nút đi ra công viên là lời
 *    khuyên dẫn nhầm chỗ, tệ hơn hẳn không có nút nào.
 */
test('đói lả thì có lời nhắc, và nó dẫn về quán ăn chứ không ra công viên', () => {
  const noon = new Date(2026, 7, 6, 10, 0);
  assert.equal(nudgeOf({ mood: 'fine', focusMood: 'sharp', satMin: 10 }, noon), null, 'ổn cả thì im');

  const starving = nudgeOf({ mood: 'starving', focusMood: 'sharp', satMin: 10 }, noon);
  assert.ok(starving, 'đói lả mà nhịp còn tốt thì vẫn phải có câu — đây là chỗ đời trước câm');
  assert.equal(starving.go, 'food', 'cửa của cơn đói là quán ăn');

  const both = nudgeOf({ mood: 'starving', focusMood: 'spent', satMin: 120 }, noon);
  assert.equal(both.go, 'food', 'đói lả phải thắng hết nhịp — cùng thứ hạng của stateOf');

  const spent = nudgeOf({ mood: 'fine', focusMood: 'spent', satMin: 120 }, noon);
  assert.equal(spent.go, 'park', 'hết nhịp thì vẫn dẫn ra công viên');

  // `hungry` KHÔNG nhắc: nó là ngưỡng 35%, tức hơn một phần ba thời gian trong ngày, và một
  // lời nhắc thường trực là một dòng chữ người ta học cách không nhìn.
  assert.equal(nudgeOf({ mood: 'hungry', focusMood: 'sharp', satMin: 10 }, noon), null);
});

/**
 * CƠN ĐÓI KHÔNG ĐƯỢC ĐỤNG VÀO VÍ — bài test canh chiều ngược lại của lượt trước.
 *
 * Lượt 14 dựng một cửa ở `buy`: đói lả thì không bán đồ trang trí. Người dùng bác ngay ở
 * lượt sau — "đừng đánh vào kinh tế" — và lý do sâu hơn một khẩu vị: ví ở đây ĐỌC RA hoá đơn
 * thật (`RATE` = 1), nên mọi cái van do trò chơi vặn vào chỗ tiêu tiền đều dạy người đọc rằng
 * con số ấy không phải chi tiêu thật.
 *
 * Nên bài test đảo chiều: đói lả tới đâu thì `buy` cũng chỉ được từ chối vì mấy lý do CÓ THẬT
 * — không đủ xu, đang bận, đã có rồi. Viết nó ra chứ không chỉ xoá bài cũ đi: một cửa đã gỡ
 * mà không có gì canh là một cửa sẽ được dựng lại ở lượt sau.
 */
test('đói lả không khoá được cái ví — mọi gian hàng vẫn mở', () => {
  const at = Date.UTC(2026, 7, 6, 9, 0);
  const decor = Object.keys(ITEMS).find((k) => ITEMS[k].kind === 'decor');
  const food = Object.keys(ITEMS).find((k) => ITEMS[k].kind === 'food');
  const led = (fullMs) => ({
    ...emptyLedger(),
    coins: 9999,
    fedAt: new Date(at - fullMs).toISOString(),
    restedAt: new Date(at).toISOString(),
  });

  const lean = led(FULL_MS * 0.95); // no còn 5% → đói lả
  assert.equal(moodOf(fullnessOf(lean, at)), 'starving', 'mốc thử phải thật sự là đói lả');
  assert.equal(buy(lean, decor, at).error, null, 'đói lả KHÔNG được là lý do từ chối một cú mua');
  assert.equal(buy(lean, food, at).error, null, 'quán ăn thì đương nhiên vẫn mở');

  // Còn cái đáng từ chối thì vẫn phải từ chối: gỡ hình phạt không phải gỡ mọi cái cửa.
  const broke = { ...lean, coins: 0 };
  assert.equal(buy(broke, decor, at).error, 'không đủ xu');
});

/**
 * Hậu quả của cơn đói dọn sang đâu — hai chỗ, và cả hai đo được từ chuỗi vẽ ra.
 *
 * 1. BỨC TRANH: `starving` có nét RIÊNG (bong bóng nghĩ) chứ không dùng chung ba vạch bụng
 *    kêu với `hungry` nữa. Đây là chỗ sửa một lỗi mà chính bảng `LOOK` đang cấm bằng chữ.
 * 2. DẢI BÁO ĐỘNG: lời nhắc mang thêm một BẬC, và bậc to chỉ bật ở hai trạng thái mà bức
 *    tranh đã vẽ ra một người ngừng làm việc.
 */
test('đói lả có nét riêng và có bậc báo động riêng', () => {
  const noon = new Date(2026, 7, 6, 10, 0);
  const markOf = (pet) => butlerLook(pet).mark;

  assert.equal(markOf({ mood: 'starving', focusMood: 'sharp' }), 'crave');
  assert.equal(markOf({ mood: 'hungry', focusMood: 'sharp' }), 'pang');
  assert.notEqual(
    markOf({ mood: 'starving', focusMood: 'sharp' }),
    markOf({ mood: 'hungry', focusMood: 'sharp' }),
    'hai bậc đói không được dùng chung một nét — luật ghi ngay trên bảng LOOK',
  );

  const lv = (pet) => nudgeOf(pet, noon)?.level;
  assert.equal(lv({ mood: 'starving', focusMood: 'sharp', satMin: 10 }), 'urge');
  assert.equal(lv({ mood: 'fine', focusMood: 'spent', satMin: 120 }), 'urge');
  assert.equal(lv({ mood: 'fine', focusMood: 'dip', satMin: 70 }), 'hint',
    'sắp hết nhịp thì vẫn ngồi gõ được — kêu to ở đây là kêu to gần như cả ngày');
});

/**
 * Thang ngồi-lâu của icon — ba mốc phải SUY từ chu kỳ, và ranh giới phải khớp cái vạch
 * trên thanh tập trung: huy hiệu nổ ở phút 70 mà vạch dip kẻ ở chỗ khác thì người đọc
 * tin cái vạch (lý lẽ ở REST_STAGE_MIN bên petmath.js).
 */
test('thang ngồi-lâu: mốc suy từ chu kỳ, biên đúng từng phút, rác thì im', () => {
  // Ba mốc là 70/90/180 — nhưng kiểm bằng phép SUY chứ không bằng ba số chép lại:
  // đổi FOCUS_MS hay FOCUS_DIP thì thang phải tự đi theo, và bài test này không được vỡ.
  assert.equal(REST_STAGE_MIN.dip, Math.round((1 - FOCUS_DIP) * 90), 'mốc đầu là hết pha tỉnh');
  assert.equal(REST_STAGE_MIN.spent, 90, 'mốc hai là trọn chu kỳ');
  assert.equal(REST_STAGE_MIN.over, 180, 'mốc ba là hai chu kỳ liền');

  assert.equal(restStageOf(REST_STAGE_MIN.dip - 1), null, 'dưới mốc đầu một phút vẫn phải im');
  assert.equal(restStageOf(REST_STAGE_MIN.dip), 'dip');
  assert.equal(restStageOf(REST_STAGE_MIN.spent - 1), 'dip');
  assert.equal(restStageOf(REST_STAGE_MIN.spent), 'spent');
  assert.equal(restStageOf(REST_STAGE_MIN.over - 1), 'spent');
  assert.equal(restStageOf(REST_STAGE_MIN.over), 'over');
  assert.equal(restStageOf(REST_STAGE_MIN.over * 3), 'over', 'không có bậc thứ tư — quá hai chu kỳ là đã kịch thang');
  // Sổ đời cũ hay sổ chép tay: satMin có thể thiếu hoặc là rác. Im lặng, không đoán.
  for (const junk of [undefined, null, NaN, 'abc', -5]) {
    assert.equal(restStageOf(junk), null, `rác ${String(junk)} phải ra im lặng`);
  }
});

/**
 * Quản gia nói được về MỌI trạng thái mình có thể ở trong.
 *
 * Bong bóng thoại đọc `butlerLook(...).state`, mà bảng `LOOK` thì còn thêm món; thiếu một
 * khoá là một bong bóng trống ở đúng lúc người ta vừa bấm vào để hỏi. Bài test đi qua cả sáu
 * trạng thái của `stateOf` cộng hai ca ngoài sổ (`cheer`, trò chơi tắt).
 */
test('bấm vào quản gia thì trạng thái nào cũng có câu trả lời', () => {
  const pets = [
    { mood: 'fine', focusMood: 'sharp' },
    { mood: 'hungry', focusMood: 'sharp' },
    { mood: 'starving', focusMood: 'sharp' },
    { mood: 'fine', focusMood: 'dip' },
    { mood: 'fine', focusMood: 'spent' },
    { mood: 'fine', focusMood: 'sharp', doing: { kind: 'move', id: 'water', ms: 60000, leftMs: 30000 } },
  ];
  for (const p of pets) {
    const say = butlerSays({ on: true, ...p });
    assert.ok(say && !say.startsWith('pet.says.'), `thiếu câu cho ${butlerLook({ on: true, ...p }).state}`);
  }
  assert.ok(!butlerSays({ on: true, mood: 'fine', focusMood: 'sharp' }, { cheer: true }).startsWith('pet.says.'));
  assert.ok(!butlerSays({ on: false }).startsWith('pet.says.'), 'trò chơi tắt cũng phải có câu');
});

/**
 * Cái ví KHÔNG được lọt vào sổ trạng thái của popover.
 *
 * Đó là toàn bộ phép gộp của lượt mười bảy: hai chỉ số vào trong tranh, cái ví ở lại ngoài
 * tranh với một cái tên. Lượt 18 đổi cách vẽ cái sổ — chữ có màu thay cho khay và mặt đồng hồ
 * — nhưng luật thì không đổi, nên phép kiểm bám vào `statWords`, chỗ mới của nó.
 *
 * Cái ba ô đầy đủ thì vẫn phải còn nguyên ở màn Cửa hàng: ở đó cái ví không phải một CỬA,
 * người dùng đã đứng trong tiệm rồi.
 */
test('sổ trạng thái trên popover chỉ có no và nhịp, không có ví', () => {
  const pet = { on: true, mood: 'fine', full: 0.7, fullMs: FULL_MS, focus: 0.7, focusMood: 'sharp', satMin: 20, coins: 12.5 };
  assert.doesNotMatch(rawText(statWords(pet, 'b')), /pet-wallet/, 'ví lọt vào sổ trạng thái');
  assert.match(rawText(statCells(pet)), /pet-wallet/, 'màn Cửa hàng vẫn phải có đủ ba ô');
});

/**
 * NÓI và NGHĨ — hai giọng, và ranh giới giữa chúng phải là ĐÚNG một cửa.
 *
 * Người dùng xin "nói chỉ khi thực sự có gì quan trọng, còn lại thì thỉnh thoảng nghĩ".
 * Cái dễ sai ở đây không phải chọn trạng thái nào, mà là để hai giọng cùng bật một lúc:
 * lúc ấy popover có hai bong bóng chồng nhau ở cùng nửa phải bầu trời, và không ai thấy
 * cho tới khi đúng cái trạng thái ấy xảy ra thật — tức là lúc người dùng đang đói.
 *
 * Nên phép kiểm là một phép LOẠI TRỪ, không phải hai phép kiểm rời. Và từ lượt "chỉ nói
 * khi có tin", NGHĨ có thêm ba mức của riêng nó: đang yên thì im hẳn (0), có chuyện chưa
 * gấp thì đúng một câu trạng thái (1), đang làm một việc thì trọn bộ ba (3).
 */
test('nói và nghĩ loại trừ nhau, và nghĩ chỉ khi có tin', () => {
  const cases = [
    // [sổ, có NÓI không, số câu NGHĨ]
    [{ mood: 'fine', focusMood: 'sharp' }, false, 0],
    [{ mood: 'hungry', focusMood: 'sharp' }, false, 1],
    [{ mood: 'fine', focusMood: 'dip' }, false, 1],
    [{ mood: 'starving', focusMood: 'sharp' }, true, 0],
    [{ mood: 'fine', focusMood: 'spent' }, true, 0],
    // Đang dở việc thì `stateOf` trả `busy` và nó THẮNG cả đói lả — nên kể cả lúc gần kiệt
    // anh ta vẫn chỉ nghĩ. Đúng: một người vừa bấm ăn thì việc cần nói đã đang được làm.
    [{ mood: 'starving', focusMood: 'spent', doing: { kind: 'food', id: 'pho', ms: 6e4, leftMs: 3e4 } }, false, 3],
  ];
  for (const [p, loud, thinks] of cases) {
    const pet = { on: true, ...p };
    assert.equal(speaking(pet), loud, `sai bậc giọng cho ${JSON.stringify(p)}`);
    assert.equal(butlerThinks(pet).length, thinks, `sai số câu nghĩ cho ${JSON.stringify(p)}`);
  }
  assert.equal(speaking({ on: false }), false, 'trò chơi tắt thì không có giọng nào');
  assert.deepEqual(butlerThinks({ on: false }), [], 'trò chơi tắt thì không nghĩ');
});

/**
 * Câu nghĩ theo luật "chỉ nói khi có tin" — ba mức, và mức nào cũng phải ĐỦ CHỮ.
 *
 * Ba lỗi khác nhau cùng bị chặn ở đây:
 *
 * 1. `t()` im lặng trả lại chính cái khoá khi thiếu chuỗi, nên một mã động tác chưa có câu
 *    sẽ hiện nguyên văn "pet.think.sun.1" trong bong bóng — không lỗi, không log.
 * 2. Đang yên mà vẫn nghĩ là tái phạm đúng cái vừa gỡ: tám câu theo buổi đã xoá khỏi
 *    i18n, một nhánh code còn trỏ tới chúng sẽ bày khoá trần ra màn hình.
 * 3. Sổ chép tay có thể mang một mã lạ. Nó phải rơi về một câu trạng thái đơn, không rơi
 *    ra một khoá trần.
 */
test('bối cảnh việc đủ ba câu, đang yên thì im, có chuyện thì một câu đứng', () => {
  const base = { on: true, mood: 'fine', focusMood: 'sharp' };
  const at = (h) => new Date(2026, 7, 6, h, 0, 0).getTime();
  const ctx = [
    { ...base, doing: { kind: 'food', id: 'pho', ms: 6e4, leftMs: 3e4 } },
    ...MOVE_IDS.map((id) => ({ ...base, doing: { kind: 'move', id, ms: 6e4, leftMs: 3e4 } })),
  ];
  for (const p of ctx) {
    const said = butlerThinks(p, at(12));
    assert.equal(said.length, 3);
    for (const s of said) {
      assert.ok(s.say && !s.say.startsWith('pet.'), `thiếu chuỗi: ${s.say}`);
      // Mỗi câu phải có một khuôn mặt CÓ THẬT trong bảng — `faceRows` rơi về `flat` khi mã
      // lạ, nên một khoá gõ sai không kêu lên mà chỉ lặng lẽ ra cùng một khuôn mặt cho tất cả.
      assert.ok(FACE_NAMES.includes(s.face), `khuôn mặt lạ: ${s.face}`);
    }
    assert.equal(new Set(said.map((s) => s.say)).size, 3, 'ba câu phải khác nhau — trùng thì vòng xoay chỉ còn hai');
  }
  // Đang yên → im tuyệt đối, ở MỌI buổi. Bốn giờ này từng là bốn bối cảnh nói chuyện trời.
  for (const h of [7, 12, 17, 23]) {
    assert.deepEqual(butlerThinks(base, at(h)), [], `đang yên lúc ${h}h mà vẫn nghĩ`);
  }
  // Có chuyện chưa gấp → đúng MỘT câu, là câu trạng thái, mang mặt thật.
  const warn = butlerThinks({ ...base, mood: 'hungry' }, at(12));
  assert.equal(warn.length, 1, 'đói vừa phải ra đúng một câu');
  assert.ok(!warn[0].say.startsWith('pet.') && FACE_NAMES.includes(warn[0].face));
  // Mã lạ trong sổ: rơi về câu trạng thái đơn (ở đây là "đang dở việc" — sổ vẫn khai có
  // việc đang chạy), không dựng bộ ba từ những khoá không tồn tại.
  const odd = butlerThinks({ ...base, doing: { kind: 'move', id: 'constructor', ms: 6e4, leftMs: 3e4 } }, at(12));
  assert.equal(odd.length, 1, `mã lạ phải về một câu, ra ${odd.length}`);
  assert.ok(!odd[0].say.startsWith('pet.'), `khoá trần lọt ra màn hình: ${odd[0].say}`);
});

test('mở popover ở hai lúc khác nhau thì câu nghĩ đầu tiên khác nhau', () => {
  // Vòng xoay giờ chỉ còn ở bối cảnh VIỆC — người đang yên thì không có gì để xoay.
  const pet = { on: true, mood: 'fine', focusMood: 'sharp', doing: { kind: 'food', id: 'pho', ms: 6e4, leftMs: 3e4 } };
  const t0 = new Date(2026, 7, 6, 12, 0, 0).getTime();
  // Cùng một ô 20 giây thì phải RA CÙNG MỘT BỘ: popover vẽ hai lượt (bản nhớ rồi bản mạng)
  // cách nhau vài trăm mili giây, và đổi câu giữa hai lượt là đổi ngay trước mắt người đọc.
  assert.deepEqual(butlerThinks(pet, t0), butlerThinks(pet, t0 + 19000));
  // Ba ô liên tiếp thì phải ra ba câu mở đầu khác nhau — đó là toàn bộ chỗ "thỉnh thoảng".
  const heads = [0, 20000, 40000].map((d) => butlerThinks(pet, t0 + d)[0].say);
  assert.equal(new Set(heads).size, 3, `chỉ xoay được ${new Set(heads).size} câu`);
});

/**
 * Trần độ dài của MỌI câu vào bong bóng, và nó là một phép ĐO HÌNH HỌC.
 *
 * MỘT trần cho cả hai bảng, không phải hai. Tới lượt trước `pet.says.*` không có trần vì nó
 * được cả 128px bề rộng, còn `pet.think.*` bị kẹp ở 46. Từ lượt 18 hai bảng vào CÙNG một cái
 * hộp với CÙNG một khuôn mặt ở đầu dòng, nên hai trần khác nhau là hai con số cho một hình
 * học — và cái không có trần là cái đã tràn.
 *
 * Phép đo, ở popover 360pt:
 *
 *   bong bóng   150px  (từ `left: 52%` tới `right: 6px` của bầu trời rộng 326px)
 *   − viền 2×2    4px
 *   − đệm 9×2    18px
 *   − mặt cười   21px  (28px thu 0,75 — xem `.mb-bubble .pet-face`)
 *   − khe hở      7px
 *   = chữ       100px  ≈ 17 ký tự một dòng ở cỡ 11px
 *
 *   chiều cao còn 76px (neo `bottom: 72px` trong bầu trời 148px), trừ viền và đệm còn 61px
 *   → BỐN dòng 15px vừa khít. Bốn nhân 17 = 68, lấy 56 cho chắc.
 *
 * Đây là lỗi đã xảy ra thật ở lượt 18 và thấy được ngay trên màn hình: `pet.says.starving`
 * bản VI dài 91 ký tự, ra năm dòng, và dòng đầu bị cắt cụt bởi mép trên bức tranh.
 */
test('không câu bong bóng nào dài quá bề rộng của nó', () => {
  const MAX = 56;
  for (const lang of ['vi', 'en']) {
    const table = tableOf(lang);
    const bad = Object.entries(table)
      .filter(([k, v]) => /^pet\.(think|says|tip)\./.test(k) && typeof v === 'string' && v.length > MAX)
      .map(([k, v]) => `${lang}/${k}: ${v.length}`);
    assert.deepEqual(bad, [], `câu bong bóng dài quá ${MAX} ký tự`);
  }
});

/**
 * Mỗi khuôn mặt phải KHÁC nhau thật, không chỉ khác tên.
 *
 * Bộ này dựng từ một khuôn chung rồi thay hàng mắt với hai hàng miệng, nên hai tên trỏ vào
 * cùng một cặp (mắt, miệng) sẽ cho ra hai mảng pixel giống hệt — không lỗi, không cảnh báo,
 * chỉ là hai trạng thái đeo chung một vẻ mặt. Đúng cái lỗi mà bảng `LOOK` đã mắc một lần với
 * nét `pang` dùng chung cho hai bậc đói.
 */
test('mỗi khuôn mặt là một hình khác nhau', () => {
  const seen = new Map();
  for (const name of FACE_NAMES) {
    const key = faceRows(name).join('|');
    assert.ok(!seen.has(key), `${name} trùng hình với ${seen.get(key)}`);
    seen.set(key, name);
  }
  assert.equal(seen.size, FACE_NAMES.length);
  // Mã lạ rơi về một khuôn CÓ THẬT, không rơi ra một hình rỗng: `faceArt` vẽ một khung 28px,
  // và một khung 28px trống giữa bong bóng thoại đọc thành lỗi tải hình.
  assert.deepEqual(faceRows('không-có-thật'), faceRows('flat'));
});

/**
 * Sổ trạng thái chỉ chở CHỮ, và màu của nó đọc PHÂN SỐ chứ không đọc tên trạng thái.
 *
 * Hai điều kiện, và cái thứ hai là chỗ sửa của lượt 19 (người dùng: *"quy về cùng màu xanh gần
 * full → vàng → đỏ"*). Phép kiểm bắt đúng cái làm nên phép quy ấy: mỗi hàng phải gửi ra một
 * `--f` là số 0–1, vì cả sắc lẫn bề rộng vạch đều nhân ra từ đúng con số đó. Còn một cái tên
 * trạng thái nào trong class là còn một thang thứ hai.
 */
test('sổ trạng thái là chữ, và màu đi theo phân số chứ không theo tên', () => {
  const pet = { on: true, mood: 'hungry', focus: 0.3, focusMood: 'dip', satMin: 74, full: 0.25 };
  const vi = tableOf('vi');
  const out = rawText(statWords(pet));
  assert.match(out, new RegExp(vi['pet.mood.hungry']), 'thiếu tên độ no');
  assert.match(out, new RegExp(vi['pet.focusMood.dip']), 'thiếu tên nhịp');
  assert.doesNotMatch(out, /pet-tray|pet-dial|pet-wallet/, 'còn kéo theo hình cũ');
  assert.doesNotMatch(out, /lv-\w/, 'còn gán màu theo tên trạng thái');
  assert.deepEqual([...out.matchAll(/--f:([\d.]+)/g)].map((m) => m[1]), ['0.250', '0.300']);
  // Trị ngoài khoảng bị KẸP chứ không tràn ra CSS: một `--f` bằng 1,4 cho ra một cái vạch dài
  // hơn cả cái sổ, và `clamp` bên CSS chỉ giữ được phần màu chứ không giữ được bề rộng.
  const wild = rawText(statWords({ on: true, mood: 'stuffed', full: 1.4, focus: -0.2, focusMood: 'spent' }));
  assert.deepEqual([...wild.matchAll(/--f:([\d.]+)/g)].map((m) => m[1]), ['1.000', '0.000']);
  // Sổ đời cũ không có nhịp tập trung thì còn đúng MỘT hàng, không bày một hàng rỗng.
  assert.doesNotMatch(rawText(statWords({ on: true, mood: 'fine', full: 0.6 })), new RegExp(vi['pet.focusMood.dip']));
});

/**
 * NÓI và NGHĨ chia việc theo một ranh giới viết ra được: gấp thì nói trạng thái, còn lại thì
 * mách một mẹo.
 *
 * Người dùng, lượt 19: *"Quản gia có thể nhắc nhở user các tip sử dụng claude hiệu quả"* và
 * *"bấm vào quản gia … kết hợp nói chuyện nữa chứ"*. Hai câu, một cơ chế.
 *
 * Bài này canh ba chỗ có thể trôi:
 *
 * 1. **Ranh giới.** Hai bậc `URGENT` phải ra câu trạng thái, mọi bậc khác ra mẹo. Trôi chỗ này
 *    là một người đang đói lả bấm vào thì nhận được một mẹo về `/compact`.
 * 2. **Khoá có thật.** `t()` im lặng trả lại khoá khi thiếu, nên một khoá gõ sai sẽ hiện nguyên
 *    chữ `pet.tip.…` trong bong bóng mà không có gì kêu lên — ở cả hai bảng chữ.
 * 3. **Vòng xoay.** Mười sáu ô liên tiếp phải ra mười sáu câu khác nhau, và hai lượt vẽ trong
 *    cùng một ô phải ra cùng một câu (popover vẽ hai lượt cách nhau vài trăm mili giây).
 * 4. **Hai bảng hình không lẫn nhau**, từ lượt 20. Câu trạng thái mang `face`, câu mẹo mang
 *    `tip` — và không câu nào mang cả hai. Trôi chỗ này thì `talkArt` chọn nhầm bảng, mà nó
 *    chọn bằng `talk.tip ? …` nên "nhầm" ở đây nghĩa là một câu đói lả đeo cái hộp đồ nghề.
 */
test('gấp thì nói trạng thái, còn lại thì mách mẹo', () => {
  const vi = tableOf('vi');
  const at = (h) => new Date(2026, 7, 6, h, 0, 0).getTime();

  for (const [mood, focusMood] of [['starving', 'sharp'], ['fine', 'spent']]) {
    const said = butlerTalk({ on: true, mood, focusMood, full: 0.05, focus: 0 }, at(12));
    assert.match(said.say, /^(Đói lả|Quá nhịp)/, `bậc gấp phải nói trạng thái, lại ra: ${said.say}`);
    assert.ok(said.face, 'câu trạng thái phải mang một khuôn mặt');
    assert.equal(said.tip, undefined, 'câu trạng thái không được đeo huy hiệu mẹo');
  }

  const calm = butlerTalk({ on: true, mood: 'fine', focusMood: 'sharp' }, at(12));
  assert.equal(calm.face, undefined, 'câu mẹo không được đeo khuôn mặt');
  assert.ok(TIP_KINDS.includes(calm.tip), `loại lạ: ${calm.tip}`);
  assert.ok(TIP_KEYS.some((k) => vi[`pet.tip.${k}`] === calm.say), `câu lạ: ${calm.say}`);
  // Trò chơi TẮT thì vẫn có mẹo: mẹo không đọc sổ, nên nó là thứ duy nhất trong cả popover còn
  // nói được khi không có con vật nào.
  assert.ok(butlerTalk(null, at(12)).tip, 'trò chơi tắt vẫn phải còn mẹo');

  for (const lang of ['vi', 'en']) {
    const table = tableOf(lang);
    for (const k of TIP_KEYS) assert.ok(table[`pet.tip.${k}`], `${lang} thiếu pet.tip.${k}`);
  }

  const t0 = at(9);
  assert.equal(butlerTalk(null, t0).say, butlerTalk(null, t0 + 24000).say, 'cùng một ô phải ra cùng một mẹo');
  const heads = TIP_KEYS.map((_, i) => butlerTalk(null, t0 + i * 25000).say);
  assert.equal(new Set(heads).size, TIP_KEYS.length, `chỉ xoay được ${new Set(heads).size} mẹo`);
  // Mọi loại phải có hình, và bốn hình phải KHÁC nhau — cùng lý lẽ với bảng khuôn mặt: hai loại
  // trỏ vào một hình là hai loại đeo chung một huy hiệu, và không có gì kêu lên.
  const kinds = TIP_KEYS.map((_, i) => butlerTalk(null, t0 + i * 25000).tip);
  assert.deepEqual([...new Set(kinds)].sort(), [...TIP_KINDS].sort(), 'có loại không bao giờ tới lượt');
  const shapes = new Map();
  for (const kind of TIP_KINDS) {
    const svg = rawText(tipArt(kind));
    assert.ok(!shapes.has(svg), `${kind} trùng hình với ${shapes.get(svg)}`);
    shapes.set(svg, kind);
  }
});

/**
 * Ở NHÀ thì quản gia ngồi vào bàn, và anh ta chỉ GÕ MÁY khi còn gõ được.
 *
 * Đây là chỗ trả lời cả hai câu người dùng hỏi cùng lúc: "thêm trạng thái gõ máy tính" và
 * "đói thì cần có hậu quả". Cùng một cái công tắc — đói lả hoặc hết nhịp thì tay rời bàn
 * phím, và cái màn hình trên bàn tắt theo (`.resident.typing` là chỗ CSS bám vào).
 *
 * Phép kiểm đọc class chứ không đọc pixel: `typing` / `pacing` / `busy` là ba chế độ loại
 * trừ nhau, và chính cái tên ấy là thứ `styles.css` dùng để bật nhịp gõ với mặt kính sáng.
 */
test('ở nhà thì gõ máy, còn đói lả hay hết nhịp thì tay rời bàn phím', () => {
  const draw = (o) => rawText(butlerArt(null, 'home', 0, { on: true, mood: 'fine', focusMood: 'sharp', doing: null, ...o }));

  assert.match(draw({}), /resident typing/, 'ổn cả thì anh ta đang gõ');
  assert.match(draw({ mood: 'hungry' }), /resident typing/, 'đói bụng vẫn làm được việc');
  assert.match(draw({ focusMood: 'dip' }), /resident typing/, 'trũng nhịp vẫn làm được việc');

  assert.doesNotMatch(draw({ mood: 'starving' }), /typing/, 'đói lả thì DỪNG — đây là cái hậu quả');
  assert.doesNotMatch(draw({ focusMood: 'spent' }), /typing/, 'hết nhịp thì DỪNG');

  // Và không còn chế độ đi lại nào ở nhà: cái đồng hồ tập trung đo "đã ngồi ở bàn bao lâu",
  // nên một người đi tha thẩn trong phòng là bức tranh nói ngược lại con số.
  for (const o of [{}, { mood: 'starving' }, { focusMood: 'spent' }, { mood: 'hungry' }]) {
    assert.doesNotMatch(draw(o), /resident pacing/, 'ở nhà thì không đi lại nữa');
  }
});

/**
 * Người qua đường phải đi ĐÚNG TRÊN đường, không đi cạnh nó.
 *
 * Hai đầu tuyến khai bằng chính `at()` như mọi thứ khác trên bản đồ, nên phép kiểm này bắt
 * đúng ca mà một cặp toạ độ gõ tay sẽ hỏng: lần nới bước lưới tiếp theo.
 */
test('hai người đi đường đi trên hai con đường có thật', () => {
  assert.equal(WALKERS.length, 2);
  for (const w of WALKERS) {
    const onRoad = ROADS.some((r) => {
      const inX = (p) => p >= r.x - 1 && p <= r.x + r.w + 1;
      return inX(w.from.x) && inX(w.to.x);
    });
    assert.ok(onRoad, `tuyến ${w.i} không nằm trên đoạn đường nào`);
  }
  // Hai chu kỳ phải NGUYÊN TỐ CÙNG NHAU: cùng chu kỳ thì cứ mỗi vòng họ lại gặp nhau đúng
  // một chỗ, và cái trùng lặp ấy đọc thành máy móc chứ không đọc thành người qua lại.
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  assert.equal(gcd(WALKERS[0].dur, WALKERS[1].dur), 1, 'hai nhịp đi trùng ước — họ sẽ gặp nhau đều đặn');
});

/**
 * Nhà mình phải là vật CAO NHẤT thị trấn.
 *
 * Nhận xét "home đang hơi bé" hoá ra không phải chuyện bề ngang — nhà vốn đã rộng gấp đôi
 * một cửa hàng. Ở phối cảnh đẳng cự thứ mắt đọc thành "to" là CHIỀU CAO trên mặt đất, và
 * đó đúng là kênh mà nhà mình thua: nó là chỗ duy nhất không có mái. Phép kiểm khoá lại
 * chỗ vừa sửa, để lần phóng to một cửa hàng nào đó sau này không lặng lẽ lật ngược nó.
 */
test('nhà mình cao nhất và rộng nhất thị trấn', () => {
  const home = PLACES.find((p) => p.id === 'home');
  const hs = sizeOf(home.rows);
  for (const p of PLACES) {
    if (p.id === 'home') continue;
    const s = sizeOf(p.rows);
    assert.ok(hs.h > s.h, `${p.id} cao bằng hoặc hơn nhà mình (${s.h} vs ${hs.h})`);
    assert.ok(hs.w > s.w, `${p.id} rộng bằng hoặc hơn nhà mình (${s.w} vs ${hs.w})`);
  }
});
