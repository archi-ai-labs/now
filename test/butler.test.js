import test from 'node:test';
import assert from 'node:assert/strict';
import { briefing } from '../public/lib/butler.js';
import { bindingOf, cardText, idleMsOf, quotaBar, stripRows, toneOf, usedText, verdictOf } from '../public/lib/quota.js';
import { rawText } from '../public/lib/dom.js';

/**
 * Quản gia có HAI ô cố định, và cái đắt nhất ở đây là chúng không tranh nhau.
 *
 * Bản trước có đúng một chỗ nói nên hai loại việc phải xếp chung một thang gấp — mà một
 * quyết định treo ba ngày và một cửa sổ sắp bỏ phí 82% thì không so được với nhau. Thứ
 * thua cuộc biến mất khỏi trang trong khi nó vẫn đang chờ nguyên ở đó.
 *
 * Nên nhóm test này canh hai chuyện:
 *
 * - **Cả hai ô luôn có mặt.** Ô hạn mức nói cả những ngày đẹp trời, vì "bỏ phí" không có
 *   mốc nào để tự kêu lên — nó chỉ lặng lẽ xảy ra lúc reset.
 * - **Màu chỉ đo BỎ PHÍ.** Cạn trước reset không bao giờ là đỏ; đỏ chỉ dành cho việc quá
 *   nửa hạn mức sẽ mất trắng. Chi phí thời gian của việc cạn sớm (ngồi không bao lâu) đi
 *   ra chữ qua `idleMsOf`, không đi vào kênh màu.
 */

const H = 3600_000;

/**
 * Lời chào đổi theo GIỜ MÁY — năm bản, không phải một (`greet` trong lib/butler.js).
 *
 * Bản trước chốt chết `/^Chào /`, nên hai test này đỏ mỗi khi chạy sau 22h hoặc trước 5h:
 * lúc ấy quản gia nói "Khuya rồi, sếp". Thứ cần canh là "có chào hay không", không phải
 * chào bằng câu nào — nên khuôn phải phủ cả năm bản.
 */
const GREET = '(?:Chào buổi (?:sáng|trưa|chiều|tối)|Khuya rồi), sếp';
const D = 86400_000;

/** Một cửa sổ như `collect/quota.js` dựng ra, đã tính sẵn phần trôi qua và dự báo. */
function win(used, elapsedFrac, windowMs, extra = {}) {
  const leftMs = windowMs * (1 - elapsedFrac);
  const elapsedMs = windowMs - leftMs;
  const perMs = used / elapsedMs;
  const projected = used + perMs * leftMs;
  const raw = used >= 100 ? 0 : perMs > 0 ? (100 - used) / perMs : null;
  return {
    used,
    remaining: 100 - used,
    resetsAt: Date.now() + leftMs,
    resetsInMs: leftMs,
    expired: false,
    windowMs,
    elapsedFrac,
    forecast: {
      known: true,
      elapsedMs,
      leftMs,
      frac: elapsedFrac,
      perHour: perMs * H,
      projected,
      willExhaust: projected > 100,
      exhaustInMs: raw != null && raw < leftMs ? raw : null,
      exhaustAt: raw != null && raw < leftMs ? Date.now() + raw : null,
    },
    ...extra,
  };
}

const state = (quota, over = {}) => ({
  quota,
  decisions: [],
  waiting: [],
  projects: [],
  usage: { ok: true, models: [{ key: 'claude-opus-5' }] },
  stats: { awake: 1 },
  ...over,
});

/** Hai cửa sổ hạ cánh quanh 100% — không có gì để nhắc ở ô hạn mức. */
const onTarget = { ok: true, fiveHour: win(48, 0.5, 5 * H), sevenDay: win(46, 0.5, 7 * D), scoped: [] };
/** Nửa cửa sổ trôi qua mà mới tiêu một phần tư — quá nửa hạn mức sẽ mất trắng. */
const wasting = { ok: true, fiveHour: win(10, 0.4, 5 * H), sevenDay: win(20, 0.5, 7 * D), scoped: [] };

test('hai ô luôn cùng có mặt — hạn mức không còn phải tranh chỗ với việc', () => {
  const b = briefing(state(onTarget));
  assert.equal(b.works[0].tone, 'calm', 'không có gì chặn thì ô việc không được báo động');
  assert.equal(b.works.length, 1, 'không có gì chặn = đúng một việc, không có gì để lật');
  assert.ok(b.burn.text, 'ô hạn mức nói cả những ngày đẹp trời');
  assert.equal(b.burn.tone, 'ok');
  assert.equal(b.burn.action, null, 'đúng nhịp thì không có gì để làm — im lặng đúng chỗ');
  assert.equal(b.quota.rows.length, 2);
});

test('quyết định nóng và hạn mức nói CÙNG LÚC, không cái nào nuốt cái nào', () => {
  // Đây là ca mà bản trước làm hỏng: khung 5 giờ sắp cạn thì câu quyết định biến mất
  // khỏi trang, dù nó vẫn đang treo nguyên ở đó.
  const burning = { ok: true, fiveHour: win(92, 0.5, 5 * H), sevenDay: win(20, 0.5, 7 * D), scoped: [] };
  const hot = [{ id: 'd-1', heat: 'now', title: 'chốt cái này', ageDays: 3, project: 'x' }];
  const b = briefing(state(burning, { decisions: hot }));
  assert.equal(b.works[0].tone, 'alert');
  assert.match(b.works[0].text, /d-1/);
  assert.equal(b.burn.goto, 'usage');
  assert.doesNotMatch(b.burn.text, /d-1/, 'mỗi ô chỉ nói chuyện của nó');
});

/**
 * Ô một trưng NHIỀU việc, xoay vòng — cùng lý do với việc tách hai ô, chỉ là ở một tầng
 * sâu hơn: board cũ không so được với quyết định đang treo, nhưng nó cũng không hết hỏng
 * chỉ vì có quyết định treo. Bản trước dừng ở việc đầu tiên khớp và vứt phần còn lại.
 */
const stalePrj = (name) => ({ name, health: 'stale', ageDays: 9, git: { driftCommits: 4, worktrees: [] }, now: null });

test('mỗi hạng mục đang hỏng được MỘT slide, xếp theo cái gì khoá tay trước', () => {
  const b = briefing(
    state(onTarget, {
      decisions: [{ id: 'd-1', heat: 'now', title: 'x', ageDays: 3, project: 'p' }],
      projects: [stalePrj('board-cu')],
      waiting: [{ who: 'Ai đó', what: 'review', ageDays: 30, nudge: true, project: 'p' }],
    }),
  );
  assert.equal(b.works.length, 3);
  assert.equal(b.works[0].key, 'hot', 'quyết định nóng đứng đầu — nó khoá tay thật');
  assert.equal(b.works[1].key, 'stale');
  assert.equal(b.works[2].key, 'nudge');
  // Mỗi slide mang nút RIÊNG của nó — đó là lý do slide tồn tại.
  assert.match(b.works[0].action.copy, /^chốt d-1/);
  assert.equal(b.works[1].action.copy, '/now update');
});

test('không quá ba slide, kể cả khi hỏng nhiều hơn ba chỗ', () => {
  // Ô này đọc trong 3 giây. Dài bằng số việc đang chờ thì nó thôi là một câu và thành
  // cái danh sách mà bốn màn bên dưới đã làm kỹ hơn.
  const b = briefing(
    state(onTarget, {
      decisions: [{ id: 'd-1', heat: 'now', title: 'x', ageDays: 3, project: 'p' }],
      projects: [
        { ...stalePrj('a'), git: { driftCommits: 4, worktrees: [{ name: 'w', path: '/tmp/w', inTmp: true, branch: 'b', dirty: 1 }] } },
      ],
      waiting: [{ who: 'Ai đó', what: 'review', ageDays: 30, nudge: true, project: 'p' }],
    }),
  );
  assert.equal(b.works.length, 3, 'bốn hạng mục cùng hỏng, vẫn chỉ ba slide');
});

/**
 * Ca thật đã làm lộ ra chỗ hỏng này: máy đang có **24 quyết định treo, không cái nào
 * `now`**, và quản gia im hoàn toàn về quyết định — cả ô chỉ nói được một câu về board cũ.
 *
 * Cửa `heat === 'now'` là một cái cửa nhị phân, và một cái cửa nhị phân thì có ngày đóng
 * suốt. `soon` không khoá tay sếp lại như `now` nên nó đứng SAU board cũ và worktree, hai
 * thứ hỏng ngay hôm nay — nhưng đứng sau thì vẫn là đứng trên trang.
 */
test('quyết định `soon` cũng lên được ô việc — không cái nào `now` KHÔNG có nghĩa là không có gì', () => {
  const b = briefing(
    state(onTarget, {
      decisions: [
        { id: 'd-moi', heat: 'soon', title: 'x', question: 'hỏi gì đó', ageDays: 1, project: 'p' },
        { id: 'd-cu', heat: 'soon', title: 'y', question: 'hỏi cái khác', ageDays: 6, project: 'p' },
        { id: 'd-xa', heat: 'later', title: 'z', ageDays: 40, project: 'p' },
      ],
    }),
  );
  assert.equal(b.works.length, 1);
  assert.equal(b.works[0].key, 'soon');
  assert.match(b.works[0].text, /d-cu/, 'lấy cái CŨ NHẤT, không phải cái đầu danh sách');
  assert.doesNotMatch(b.works[0].text, /d-xa/, '`later` không được đếm vào đây');
  assert.match(b.works[0].text, new RegExp(`^${GREET}.*\\b2 quyết định\\b`), 'số đếm chỉ tính `soon`');
  assert.match(b.works[0].action.copy, /^chốt d-cu/);
});

test('`now` và `soon` cùng đứng được, và hai câu không đọc thành mâu thuẫn', () => {
  const b = briefing(
    state(onTarget, {
      decisions: [
        { id: 'd-1', heat: 'now', title: 'x', ageDays: 3, project: 'p' },
        { id: 'd-2', heat: 'soon', title: 'y', ageDays: 2, project: 'p' },
      ],
      projects: [stalePrj('board-cu')],
    }),
  );
  assert.deepEqual(b.works.map((w) => w.key), ['hot', 'stale', 'soon'], '`soon` đứng sau board cũ');
  // Hai câu cùng mở bằng một con số đếm quyết định, nên động từ phải khác nhau, nếu không
  // "1 quyết định" rồi "1 quyết định" đọc ra thành hai cách đếm cùng một đống.
  assert.match(b.works[0].text, /đang khoá/);
  assert.match(b.works[2].text, /sắp phải quyết/);
});

/**
 * Ngưỡng `nudge` (7 ngày) thôi làm cái cửa, chỉ còn chọn GIỌNG.
 *
 * Hai mục QA trên máy này đứng 6 ngày và biến mất khỏi trang vì đúng một ngày ấy. Nhưng
 * hạ ngưỡng xuống thì lại ra một câu khuyên nhắc người khác lúc mới ngày thứ hai — cũng
 * là một câu sai, chỉ sai kiểu khác. Nên: mục nào cũng lên trang, còn "nhắc được rồi"
 * thì phải trả giá bằng đủ số ngày mới được nói.
 */
test('mục chờ chưa tới ngưỡng vẫn lên trang, nhưng KHÔNG được giục', () => {
  const soft = briefing(state(onTarget, { waiting: [{ who: 'QA', what: 'review', ageDays: 6, nudge: false, project: 'p' }] }));
  assert.equal(soft.works[0].key, 'nudge');
  assert.equal(soft.works[0].tone, 'calm', 'chưa tới ngưỡng thì không phải màu cảnh báo');
  assert.doesNotMatch(soft.works[0].text, /nhắc được rồi/);

  const hard = briefing(state(onTarget, { waiting: [{ who: 'QA', what: 'review', ageDays: 30, nudge: true, project: 'p' }] }));
  assert.equal(hard.works[0].tone, 'warn');
  assert.match(hard.works[0].text, /nhắc được rồi/);
});

test('mục chờ lấy cái CŨ NHẤT, và câu dài bị cắt về vừa một dòng tiêu đề', () => {
  const long = 'Re-baseline F-1/F-2/F-3 trên deploy dev hiện tại + sửa mô tả F-9/F-10 (cần gửi docs/93_qa/update-2026-07-21.md trước)';
  const b = briefing(
    state(onTarget, {
      waiting: [
        { who: 'A', what: 'mới', ageDays: 2, nudge: false, project: 'p' },
        { who: 'QA', what: long, ageDays: 9, nudge: true, project: 'p' },
      ],
    }),
  );
  assert.match(b.works[0].text, /QA/, 'cũ nhất đứng trước');
  assert.match(b.works[0].text, /…/, 'câu 118 ký tự phải bị cắt');
  assert.ok(b.works[0].text.length < 130, `câu dài ${b.works[0].text.length} ký tự thì đẩy nút xuống dưới tầm mắt`);
  assert.doesNotMatch(b.works[0].text, /F-9\/F-1…/, 'cắt ở ranh giới TỪ, không cắt giữa một mã');
  // Cắt chữ chỉ được phép nếu bản đầy đủ còn lấy lại được ở đâu đó trong cùng cái ô —
  // nếu không thì `clip()` là một phép làm mất dữ liệu, không phải một phép dàn trang.
  assert.ok(b.works[0].action, 'mục chờ phải có nút chép, dù nó không có lệnh nào để chạy');
  assert.match(b.works[0].action.copy, /trước\)$/, 'nút chép mang NGUYÊN VĂN, không mang bản đã cắt');
  assert.doesNotMatch(b.works[0].action.copy, /…/);
});

test('"không có gì chặn sếp" là ĐƯỜNG LUI, không xếp cùng hàng với việc đang chặn', () => {
  // Câu đó mở bằng "Không có gì chặn sếp". Đứng cạnh một quyết định đang treo thì nó
  // thành nói dối, nên có việc chặn là nó im.
  const blocked = briefing(
    state(onTarget, {
      decisions: [{ id: 'd-1', heat: 'now', title: 'x', ageDays: 3, project: 'p' }],
      projects: [{ name: 'p', health: 'fresh', git: { worktrees: [] }, now: { focus: { nextAction: 'làm tiếp' } } }],
    }),
  );
  assert.equal(blocked.works.length, 1);
  assert.equal(blocked.works[0].key, 'hot');
  assert.ok(!blocked.works.some((w) => w.key === 'lead'));
});

test('lời chào chỉ ở slide ĐẦU — bấm sang slide hai không bị chào lại', () => {
  const b = briefing(
    state(onTarget, {
      decisions: [{ id: 'd-1', heat: 'now', title: 'x', ageDays: 3, project: 'p' }],
      projects: [stalePrj('board-cu')],
    }),
  );
  assert.match(b.works[0].text, new RegExp(`^${GREET}`), 'slide đầu chào một lần');
  assert.doesNotMatch(b.works[1].text, new RegExp(`^${GREET}`));
  // Và lời chào không được ăn mất chữ đang phải nói việc.
  assert.match(b.works[1].text, /board-cu/);
});

test('bỏ phí thì ô hạn mức nhắc, và đề xuất model MẠNH hơn một bậc', () => {
  // Chiều ngược với ca cạn sớm, vì hai đầu thang hỏng theo hai kiểu ngược nhau: bỏ phí
  // sửa được bằng cách mỗi lượt tiêu nhiều hơn.
  const b = briefing(state(wasting, { usage: { ok: true, models: [{ key: 'claude-haiku-4-5' }] } }));
  assert.equal(b.burn.tone, 'crit');
  assert.equal(b.burn.action.copy, '/model sonnet');
});

test('ở bậc đắt nhất thì KHÔNG bịa ra lệnh — lúc đó câu trung thực là giao thêm việc', () => {
  // `state()` để model đang tiêu nhiều nhất là Opus; trên nó không còn nấc nào.
  assert.equal(briefing(state(wasting)).burn.action, null);
});

test('cạn sớm rồi ngồi không thì đề xuất model RẺ hơn một bậc', () => {
  const q = { ok: true, fiveHour: win(48, 0.5, 5 * H), sevenDay: win(46, 0.5, 7 * D), scoped: [win(90, 0.5, 7 * D, { model: 'Opus 5' })] };
  assert.equal(briefing(state(q)).burn.action.copy, '/model sonnet');

  const onSonnet = { ...q, scoped: [win(90, 0.5, 7 * D, { model: 'Sonnet 5' })] };
  assert.equal(briefing(state(onSonnet)).burn.action.copy, '/model haiku');
});

test('ở bậc rẻ nhất thì KHÔNG bịa ra lệnh — câu trung thực lúc đó là chờ reset', () => {
  const q = { ok: true, fiveHour: win(48, 0.5, 5 * H), sevenDay: win(46, 0.5, 7 * D), scoped: [win(92, 0.5, 7 * D, { model: 'Haiku 4.5' })] };
  const b = briefing(state(q));
  assert.equal(b.burn.action, null);
  assert.equal(b.burn.goto, 'usage');
});

test('cửa sổ bỏ phí NẶNG đứng trước cửa sổ đang cạn sớm', () => {
  // Thứ tự này là chỗ đổi hướng của cả lượt sửa: bỏ phí quá nửa là tiền mất hẳn, còn
  // cạn sớm chỉ là một buổi chiều ngồi không — và cửa sổ cạn sớm vẫn còn nguyên câu của
  // nó ở dải bên phải, nên không có gì bị giấu đi.
  const q = { ok: true, fiveHour: win(92, 0.5, 5 * H), sevenDay: win(20, 0.5, 7 * D), scoped: [] };
  assert.equal(toneOf(q.fiveHour), 'cheer');
  assert.equal(toneOf(q.sevenDay), 'crit');
  assert.equal(bindingOf(q).key, 'seven');
});

test('cùng một băng vàng thì cửa sổ bỏ phí NHIỀU hơn được chọn', () => {
  // Ca thật trên máy này: khung Fable tiêu nhiều hơn (36% so với 16%) nhưng bỏ phí ít
  // hơn (29% so với 46%), và phép so cũ theo "tiêu nhiều nhất" cho nó cướp chỗ.
  const q = { ok: true, fiveHour: win(16, 0.3, 5 * H), sevenDay: win(46, 0.5, 7 * D), scoped: [win(36, 0.5, 7 * D, { model: 'Fable' })] };
  assert.equal(toneOf(q.fiveHour), 'warn'); // dự phóng 53 → bỏ phí 47
  assert.equal(toneOf(q.scoped[0]), 'warn'); // dự phóng 72 → bỏ phí 28
  assert.equal(bindingOf(q).key, 'five');
});

test('cùng một băng thì cửa sổ cạn TRƯỚC được chọn, không phải cửa sổ tiêu nhiều nhất', () => {
  const q = {
    ok: true,
    fiveHour: win(55, 0.25, 5 * H), // 220%/cửa sổ → cạn sau khoảng một giờ
    sevenDay: win(80, 0.7, 7 * D), // 114%/cửa sổ → cũng vượt trần, nhưng còn hơn một ngày
    scoped: [],
  };
  assert.equal(toneOf(q.fiveHour), 'cheer');
  assert.equal(toneOf(q.sevenDay), 'cheer');
  assert.equal(bindingOf(q).key, 'five');
});

test('không đọc được hạn mức thì quản gia im về nó, không đoán bừa', () => {
  const b = briefing(state({ ok: false, reason: 'missing' }));
  assert.deepEqual(b.quota.rows, []);
  assert.equal(b.quota.binding, null);
  assert.equal(b.quota.tone, 'mute');
});

test('cửa sổ đã lăn thì không còn là mối lo — số cũ không được kéo báo động theo', () => {
  const rolled = { ...win(97, 1, 5 * H), expired: true };
  assert.equal(verdictOf(rolled), 'rolled');
  assert.equal(toneOf(rolled), 'mute');
});

test('cửa sổ đã lăn thì KHÔNG in con số nào — số ấy nói về một chu kỳ khác', () => {
  // `used` của một cửa sổ đã qua mốc reset là số cuối của chu kỳ ĐÃ ĐÓNG. In nó dưới
  // nhãn của cửa sổ đang chạy là để người đọc hiểu ngược, mà đây là con số to nhất khối.
  //
  // Ca thật 3/8: token OAuth hết hạn lúc 17:08 nên bản đọc kẹt ở `used: 6`; tới 23:20 đã
  // trôi qua HƠN MỘT cửa sổ 5 giờ trọn vẹn, tức 6% còn không phải số của chu kỳ liền
  // trước. Popover, thẻ màn Token, dải quản gia và cả huy hiệu thanh menu đều in "6%".
  const rolled = { ...win(6, 1, 5 * H), expired: true };
  assert.equal(usedText(rolled), '—');
  assert.equal(usedText(win(6, 0.5, 5 * H)), '6%', 'cửa sổ đang chạy thì vẫn in số');
  assert.equal(usedText(null), '—', 'không có cửa sổ cũng là không có số');

  // Thanh phải im theo, không được vẽ một mảng đặc dài 6% cãi lại dấu gạch ngay trên nó.
  const bar = rawText(quotaBar(rolled, { labels: true }));
  assert.match(bar, /qb-fill" style="width:0%/);
  assert.doesNotMatch(bar, /qb-waste/);
});

/* ── Đích là tiêu hết ───────────────────────────────────────────────────────────
   Nhóm này canh đúng một chỗ dễ trượt về nếp cũ: coi thanh dài là nguy, thanh ngắn là
   an toàn. Hạn mức reset theo cửa sổ và KHÔNG cộng dồn, nên phần chưa dùng lúc reset
   là mất trắng — thanh ngắn mới là cái phải giải trình. */

test('tiêu chậm bị NÊU RA, không được đọc thành "vẫn ổn"', () => {
  // Nửa cửa sổ trôi qua mà mới tiêu 35% → hạ cánh ở 70%, tức 30% đã trả tiền rồi bỏ đi.
  assert.equal(verdictOf(win(35, 0.5, 7 * D)), 'slack');
  assert.equal(toneOf(win(35, 0.5, 7 * D)), 'warn');
});

test('ngoại suy sát trần là ĐẠT, không phải báo động', () => {
  // 92% lúc reset = dùng gần trọn thứ đã mua. Chừa 10% cuối làm sai số vì phép ngoại
  // suy là một đường thẳng, còn nhịp thật thì giật cục.
  assert.equal(verdictOf(win(46, 0.5, 7 * D)), 'full');
  assert.equal(toneOf(win(46, 0.5, 7 * D)), 'ok');
});

test('cạn trước reset KHÔNG bao giờ là đỏ — đỏ chỉ dành cho bỏ phí quá nửa', () => {
  // Hai cửa sổ cùng chạm trần, khác nhau đúng một chuyện: đòi vượt trần bao nhiêu.
  // 99% khi đã trôi 98% cửa sổ 5 giờ → hạ cánh đúng 101%, tức quanh đích.
  assert.equal(verdictOf(win(99, 0.98, 5 * H)), 'full');
  // 92% khi mới trôi nửa cửa sổ → nhịp này đòi 184%, gấp gần hai lần thứ có.
  assert.equal(verdictOf(win(92, 0.5, 5 * H)), 'over');
  assert.equal(toneOf(win(92, 0.5, 5 * H)), 'cheer');
  // Còn đỏ thì chỉ có một nghĩa, và nó nằm ở đầu kia của thang.
  assert.equal(verdictOf(win(10, 0.4, 5 * H)), 'cold');
  assert.equal(toneOf(win(10, 0.4, 5 * H)), 'crit');
});

test('bốn băng cắt đúng ở ±10% và 50% bỏ phí', () => {
  // Ranh giới là chỗ duy nhất một thang có thể lệch mà không ai thấy, nên nó được đóng
  // đinh bằng số: `used / elapsedFrac` chính là dự phóng, nên bỏ phí = 100 − số đó.
  assert.equal(verdictOf(win(45.5, 0.5, 7 * D)), 'full'); // dự phóng 91 → bỏ phí 9
  assert.equal(verdictOf(win(45, 0.5, 7 * D)), 'slack'); // 90 → bỏ phí đúng 10
  assert.equal(verdictOf(win(25.5, 0.5, 7 * D)), 'slack'); // 51 → bỏ phí 49
  assert.equal(verdictOf(win(25, 0.5, 7 * D)), 'cold'); // 50 → bỏ phí đúng 50
  assert.equal(verdictOf(win(55, 0.5, 7 * D)), 'full'); // 110 → bỏ phí đúng −10
  assert.equal(verdictOf(win(56, 0.5, 7 * D)), 'over'); // 112 → bỏ phí −12
});

test('không có dự phóng thì thanh KHÔNG vẽ mảng bỏ phí', () => {
  // Bỏ phí là một lời tiên đoán, nên nó chỉ tồn tại khi có nhịp để suy. Bản trước để
  // `projected` rơi về `used` khi thiếu dự báo, và `100 - used` vẫn ra một con số trông
  // hợp lý — nên cái thanh khẳng định thay cho một phép tính chưa từng chạy.
  // Ba ca gặp thật cùng lúc trên máy 3/8: khung 5 giờ đã sang chu kỳ mới vẽ "bỏ phí 94%",
  // Cursor vừa mở cửa sổ vẽ "bỏ phí 91%" ngay cạnh câu "chưa đủ để đọc nhịp", và quỹ 5
  // giờ của Antigravity ở 0% vẽ "bỏ phí 100%".
  const blind = (reason, used) => ({ ...win(used, 0.5, 5 * H), forecast: { known: false, reason } });
  for (const [reason, used] of [
    ['rolled', 6],
    ['early', 8.9],
    ['unknown', 40],
  ]) {
    const bar = rawText(quotaBar(blind(reason, used), { labels: true }));
    assert.doesNotMatch(bar, /qb-waste/, `${reason}: không được có mảng bỏ phí`);
    assert.doesNotMatch(bar, /wasting/, `${reason}: rãnh không được nhuốm sắc cảnh báo`);
    assert.match(bar, new RegExp(`qb-fill" style="width:${used}%`), `${reason}: mảng đặc vẫn vẽ đúng`);
  }

  // Có dự báo thì mảng vẫn phải còn — đây là ca thường, không được sửa lây sang.
  const seen = rawText(quotaBar(win(25, 0.5, 7 * D), { labels: true }));
  assert.match(seen, /qb-waste/);
  assert.match(seen, /bỏ phí 50%/);
});

test('ngồi không là chi phí THỜI GIAN — nó ra chữ, không ra màu', () => {
  // Ca thật: khung tuần đã tiêu 97% lúc còn 10% cửa sổ. Nó hạ cánh ở 107,8% nên màu là
  // xanh lá — đúng đích về tiền — nhưng vẫn cạn sớm hơn reset khoảng nửa ngày, và câu
  // trên thẻ phải nói ra đúng nửa ngày đó. Trộn hai đại lượng vào một kênh là lỗi cũ.
  const weekly = win(97, 0.9, 7 * D);
  assert.equal(toneOf(weekly), 'ok');
  assert.ok(idleMsOf(weekly) > 10 * H, 'khoảng ngồi không phải được đo, không bị bỏ qua');
  assert.match(cardText(weekly), /ngồi không/);
});

test('ngưỡng "ngồi không" đo theo cửa sổ, và có sàn cho khung ngắn', () => {
  // Cùng MỘT hình dạng nhịp, thả vào hai cửa sổ lệch nhau 33 lần chiều dài. Khoảng ngồi
  // không ra đúng 6,5% cửa sổ ở cả hai — trên ngưỡng tỉ lệ 6%, nên khung tuần báo (10,9
  // giờ, cả một ngày làm việc). Khung 5 giờ thì cùng 6,5% ấy chỉ là 19 phút, dưới sàn 20
  // phút, nên nó im: "kẹt" ngắn hơn thế thì không đủ dài để đáng gọi tên.
  assert.ok(idleMsOf(win(96.25, 0.9, 7 * D)) > 10 * H, 'khung tuần: phần trăm cầm trịch');
  assert.equal(idleMsOf(win(96.25, 0.9, 5 * H)), 0, 'khung 5 giờ: sàn cầm trịch');
});

/* ── Cursor + Antigravity: CÂU CHỮ bên trái, không phải hàng trong dải ──────────
   Hai nguồn này cũng trả tiền theo chu kỳ không cộng dồn, nên "tiêu không hết" ở đó
   cũng là tiền mất y như bên Claude. Nhưng chúng đổi chậm hơn cả chục lần, nên chúng
   không có thanh trong dải — dải là của hạn mức Claude. Thay vào đó là một câu văn
   xuôi dưới câu chính, và luật chen vào là: xuất hiện KHI VÀ CHỈ KHI đang BỎ PHÍ, và
   không bao giờ cướp câu chính — bỏ phí không gấp. */

test('Cursor tiêu không hết thì thành một CÂU cảnh báo, không phải hàng trong dải', () => {
  // Chu kỳ tháng trôi 60% mà mới tiêu 20% → hạ cánh ~33%, bỏ phí ~67%.
  const cursor = { ok: true, total: win(20, 0.6, 30 * D) };
  const b = briefing(state(onTarget, { cursor }));
  const line = b.tools.find((l) => l.key === 'cursor');
  assert.ok(line, 'câu Cursor phải có mặt khi đang bỏ phí');
  assert.equal(line.tone, 'crit', 'bỏ phí 67% là quá nửa — băng đỏ');
  assert.match(line.text, /Cursor/);
  assert.equal(stripRows(b.quota.rows).find((r) => r.key === 'cursor'), undefined, 'dải là của hạn mức Claude');
  assert.equal(b.works[0].tone, 'calm', 'nguồn ngoài không bao giờ chạm vào ô việc');
});

test('Cursor đang nhịp đẹp thì KHÔNG có câu nào', () => {
  // Nửa chu kỳ tiêu 48% → hạ cánh ~96%, tức dùng gần trọn thứ đã mua. Không có gì để báo.
  const cursor = { ok: true, total: win(48, 0.5, 30 * D) };
  assert.deepEqual(briefing(state(onTarget, { cursor })).tools, []);
});

test('Antigravity: khung TUẦN bỏ phí thì có câu, khung 5 giờ thì không bao giờ', () => {
  // Khung 5 giờ của một app không mở thường xuyên đương nhiên trống — báo nó là tiếng ồn.
  const weekly = { ...win(5, 0.5, 7 * D), window: 'weekly', label: 'Weekly', key: 'gemini-weekly' };
  const fiveH = { ...win(0, 0.9, 5 * H), window: '5h', label: '5h', key: 'gemini-5h' };
  const agQuota = { ok: true, groups: [{ key: 'gemini', name: 'Gemini', buckets: [fiveH, weekly] }] };
  const b = briefing(state(onTarget, { agQuota }));
  assert.ok(b.tools.find((l) => l.key === 'ag-gemini-weekly'), 'khung tuần bỏ phí phải có câu');
  assert.equal(b.tools.find((l) => l.key === 'ag-gemini-5h'), undefined, 'khung 5 giờ không được lên tiếng');
});

test('nguồn ngoài tiêu vượt cả cửa sổ thì KHÔNG lên tiếng — dự phóng ấy mỏng nhất', () => {
  // Khung TUẦN của Antigravity, mới trôi 7% (~12 giờ) mà đã tiêu 34%: ngoại suy ra hơn
  // 400%, và câu sinh ra là "cạn sau …, rồi ngồi không … tới lúc reset". Mười hai tiếng
  // đủ qua cửa `early` (3% cửa sổ ≈ 5 giờ với khung tuần), nên MỘT buổi làm mạnh là đủ
  // dựng lên một tai hoạ cả tuần. Gỡ ngày 4/8: dòng văn xuôi chỉ chở kênh bỏ phí.
  const weekly = { ...win(34, 0.07, 7 * D), window: 'weekly', label: 'Weekly', key: 'gpt-weekly' };
  const agQuota = { ok: true, groups: [{ key: 'gpt', name: 'Claude and GPT models', buckets: [weekly] }] };
  const b = briefing(state(onTarget, { agQuota }));

  assert.equal(toneOf(weekly), 'cheer', 'ca dựng ra đúng là băng vượt nhịp, không phải ca khác');
  assert.deepEqual(b.tools, [], 'băng vượt nhịp không được thành câu');

  // Cursor vượt nhịp cũng vậy — luật theo BĂNG, không theo tên nguồn.
  const cursor = { ok: true, total: win(34, 0.07, 30 * D) };
  assert.deepEqual(briefing(state(onTarget, { cursor })).tools, []);
});

test('nguồn ngoài không đọc được thì im lặng: dải giữ nguyên, không câu nào', () => {
  const b = briefing(state(onTarget, { cursor: { ok: false, reason: 'no-auth' }, agQuota: { ok: false } }));
  assert.equal(b.quota.rows.length, 2);
  assert.deepEqual(b.tools, []);
});

test('hụt một tiếng cuối khung TUẦN không phải chuyện đáng báo động', () => {
  // Ngoại suy ra ~101% ở ngày thứ hai của bảy ngày = hụt khoảng một tiếng. Sai số của
  // chính phép ngoại suy còn lớn hơn thế, nên đây là hạ cánh đẹp chứ không phải sự cố —
  // ca thật đã gặp trên máy, và bản trước tô nó đỏ.
  const weekly = win(35, 0.348, 7 * D);
  assert.ok(weekly.forecast.projected > 100, 'ca này CÓ chạm trần — nếu không thì test vô nghĩa');
  assert.equal(verdictOf(weekly), 'full');
  assert.equal(toneOf(weekly), 'ok');
});
