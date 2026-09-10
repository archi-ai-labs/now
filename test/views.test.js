import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * Mọi hàm render phải CHẠY ĐƯỢC, không chỉ nạp được.
 *
 * `test/modules.test.js` chỉ `await import(...)` từng file dưới `public/`, và đó là một
 * lưới khác hẳn: nó bắt lỗi cú pháp, import sai tên, import vòng. Thứ nó không bắt được là
 * lỗi chỉ xuất hiện lúc THÂN HÀM chạy, mà một biến thiếu trong template literal đúng là
 * loại đó: module nạp sạch, rồi `renderX(state)` ném ReferenceError ngay câu đầu. Repo này
 * đã có ca 288 test xanh trong khi `#view` rỗng, và luật 4 trong CLAUDE.md sinh ra từ đó.
 *
 * Nên lưới ở đây gọi THẬT từng hàm với một bản chụp state thật (`test/fixtures/state.json`)
 * rồi soát ba điều rẻ nhất mà vẫn có nghĩa: không ném, trả về chuỗi không rỗng, và chuỗi ấy
 * có thẻ HTML. Không soát nội dung, vì nội dung là việc của mấy test chuyên đề bên cạnh
 * (`quota.test.js`, `chart.test.js`, `stats.test.js`).
 *
 * Danh sách hàm TỰ QUÉT theo tên xuất (`render*` trong `public/views/`), không viết tay:
 * một màn mới thêm vào là tự được che. Mấy hàm không mang tiền tố ấy (`overviewDrawer`,
 * `popoverView`, và bốn hàm vẽ của `views/tools.js`) phải liệt kê tay, nên có một test
 * riêng khoá lại rằng danh sách quét được không hụt đi màn nào.
 *
 * CHƯA che được: thân màn Cửa hàng. `renderPet` đọc sổ thú nuôi từ `fetch('/api/pet')` chứ
 * không từ `/api/state`, nên trong Node nó luôn rơi vào nhánh "đang mở sổ" và chỉ vẽ ra
 * chừng 100 ký tự. Cùng lý do, `popoverView` và `renderBench` nhận `pet: null`.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', 'public');
const mod = (rel) => import(new URL(`file://${path.join(ROOT, rel)}`).href);

const STATE = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'state.json'), 'utf8'));

const { rawText } = await mod('lib/dom.js');
const i18n = await mod('lib/i18n.js');
const { setTab } = await mod('lib/tabs.js');
const { overviewDrawer } = await mod('views/overview.js');
const { renderUsage } = await mod('views/usage.js');
const { agQuotaPanel, agTab, cursorQuotaPanel, cursorTab } = await mod('views/tools.js');
const { popoverView } = await mod('lib/menubar-view.js');

/* ── Danh sách hàm cần vẽ ───────────────────────────────────────────────────── */

const VIEW_FILES = fs
  .readdirSync(path.join(ROOT, 'views'))
  .filter((f) => f.endsWith('.js'))
  .sort();

/** Mỗi mục là `[nhãn, hàm không tham số]`. Nhãn đi vào tên test nên phải đọc ra được ngay. */
const CASES = [];

for (const f of VIEW_FILES) {
  const m = await mod(`views/${f}`);
  for (const [name, fn] of Object.entries(m)) {
    // Chỉ hàm có tiền tố `render` mới nhận đúng bộ tham số `(state, query)`. `renderPet`
    // không đọc tham số nào cả, nhưng truyền thừa thì nó bỏ qua, nên một lối gọi chung là đủ.
    if (/^render[A-Z]/.test(name) && typeof fn === 'function') CASES.push([`views/${f} · ${name}`, () => fn(STATE, '')]);
  }
}

const SCANNED = CASES.map(([label]) => label.split(' · ')[1]);

// Bốn hàm vẽ của `views/tools.js` không mang tiền tố `render`, và hai hàm dưới đây nhận tham
// số khác hẳn, nên phép quét trên không thấy chúng. `renderUsage` chỉ vẽ thân của tab ĐANG
// mở, nên ba tab phải gọi ba lượt, không thì hai phần ba màn Token không ai chạy tới.
const EXTRA = [
  ['views/overview.js · overviewDrawer', () => overviewDrawer(STATE.projects[0], STATE.thresholds)],
  ['views/tools.js · cursorQuotaPanel', () => cursorQuotaPanel(STATE.cursor, STATE.plans?.cursor)],
  ['views/tools.js · agQuotaPanel', () => agQuotaPanel(STATE.agQuota, STATE.plans?.antigravity)],
  ['views/tools.js · cursorTab', () => cursorTab(STATE.cursor, STATE.cursorEvents)],
  ['views/tools.js · agTab', () => agTab(STATE.antigravity, STATE.agTurns, STATE.generatedAt)],
  ['lib/menubar-view.js · popoverView', () => popoverView(STATE, {})],
];

// `TABS` trong `views/usage.js` không xuất ra ngoài nên tên nhóm phải chép tay ở đây. Test
// "ba tab vẽ ra ba thân khác nhau" dưới cùng canh đúng chỗ chép ấy: tên nhóm lệch đi thì
// `getTab` rơi về tab đầu cả ba lượt, và ba chuỗi giống hệt nhau là dấu hiệu lộ ra ngay.
const USAGE_GROUP = 'usage';
const USAGE_TABS = ['claude', 'cursor', 'ag'];
for (const id of USAGE_TABS) {
  EXTRA.push([
    `views/usage.js · renderUsage[tab=${id}]`,
    () => {
      setTab(USAGE_GROUP, id);
      return renderUsage(STATE, '');
    },
  ]);
}

/* ── Trợ giúp ───────────────────────────────────────────────────────────────── */

/**
 * Đổi ngôn ngữ rồi chạy `fn`, với một `document` giả dựng lên ĐÚNG trong lúc đổi.
 *
 * `setLang` gán thẳng `document.documentElement.lang`, không bọc `typeof`, nên gọi nó trong
 * Node là ném ReferenceError. Dựng cái giả rồi gỡ ngay chứ không để lại, vì các hàm render
 * phải chạy trong đúng môi trường KHÔNG có DOM mà lưới này canh; để `document` nằm đó là
 * đẩy chúng sang nhánh trình duyệt, tức là canh nhầm bề mặt.
 *
 * Không sửa `public/lib/i18n.js` cho hết ném: file đó là việc của lượt khác.
 */
function withLang(lang, fn) {
  const prev = globalThis.document;
  globalThis.document = { documentElement: {} };
  try {
    i18n.setLang(lang);
  } finally {
    if (prev === undefined) delete globalThis.document;
    else globalThis.document = prev;
  }
  return fn();
}

/** Gọi một hàm vẽ và soát kết quả. Trả về chuỗi HTML để chỗ gọi so tiếp nếu cần. */
function paint(label, fn) {
  let out;
  try {
    out = fn();
  } catch (err) {
    // Gắn nhãn vào thông báo gốc chứ không nuốt lỗi: dòng đầu của stack là chỗ ném thật,
    // và đó mới là thứ người sửa cần, còn nhãn chỉ nói giúp là màn nào.
    err.message = `${label} ném lúc render: ${err.message}`;
    throw err;
  }
  const s = rawText(out);
  assert.equal(typeof s, 'string', `${label} phải trả về kết quả của \`html\`, nhận được ${typeof out}`);
  assert.ok(s.trim().length > 0, `${label} vẽ ra chuỗi rỗng`);
  assert.ok(s.includes('<'), `${label} vẽ ra chuỗi không có thẻ HTML nào: ${JSON.stringify(s.slice(0, 80))}`);
  return s;
}

/* ── Lưới ───────────────────────────────────────────────────────────────────── */

test('bản chụp state có đủ mấy khoá mà các màn đọc', () => {
  // Fixture teo mất một nhánh thì mọi test dưới vẫn "xanh" vì view nào cũng rơi vào nhánh
  // rỗng của nó, im lặng đúng kiểu tệ nhất. Danh sách này gồm mọi nhánh gốc mà một hàm
  // trong `CASES`/`EXTRA` có đọc tới, KHÔNG phải chỉ những nhánh làm màn ném.
  //
  // Phân biệt ấy là chỗ bản trước sai. Nó khai danh sách được đo bằng cách "bỏ từng khoá
  // rồi chạy lại lưới", nhưng phép đo ấy chỉ bắt được nhánh nào làm màn NÉM: bỏ `quota`
  // hay `plans` thì không màn nào đỏ, còn bỏ `cursorEvents`, `antigravity`, `agTurns`,
  // `lookback` thì cũng không đỏ mà bốn khối chart lặng lẽ biến mất. Một fixture mất khối
  // chart vẫn cho cả lưới xanh là đúng cái lỗ mà file này sinh ra để bịt, nên điều kiện
  // phải là "có người đọc", không phải "thiếu thì ném".
  for (const k of ['projects', 'sessions', 'decisions', 'timeline', 'queue', 'waiting', 'orphans', 'stats', 'thresholds', 'usage', 'quota', 'cursor', 'cursorEvents', 'antigravity', 'agTurns', 'agQuota', 'lookback', 'plans']) {
    assert.ok(STATE[k] != null, `fixture thiếu \`${k}\` — chụp lại theo hướng dẫn trong khoá $comment`);
  }
  assert.ok(Array.isArray(STATE.projects) && STATE.projects.length > 0, 'fixture phải có ít nhất một dự án');
  assert.ok(typeof STATE.$comment === 'string' && STATE.$comment.length > 100, 'fixture phải nói rõ nó là bản chụp đã ẩn danh và cách chụp lại');

  // Repo công khai, nên đây là phép canh cuối trước khi một bản chụp mới lọt vào commit.
  // Nó KHÔNG chứng minh được fixture sạch (không phép tự động nào làm được điều đó với văn
  // xuôi), nó chỉ bắt ca người ta chụp lại rồi quên chạy phép thay.
  //
  // Hai mẫu dò được suy ra lúc chạy chứ không viết cứng, vì viết cứng tên thật của người
  // đang chạy vào một file công khai thì chính phép canh lại là chỗ rò. `os.homedir()` cho
  // tên tài khoản trên máy đang chạy, còn `/Users/<gì đó khác dev>` bắt mọi đường dẫn macOS
  // thật kể cả khi bản chụp đến từ máy khác; `dev` là tên giả mà phép thay dùng.
  const raw = JSON.stringify(STATE);
  const tênMáy = path.basename(os.homedir());
  const dấuVết = [/\/Users\/(?!dev\b)[a-z0-9._-]+/i];
  if (tênMáy && tênMáy !== 'dev') dấuVết.push(new RegExp(tênMáy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  for (const mẫu of dấuVết) {
    assert.ok(!mẫu.test(raw), `fixture còn dấu vết máy thật (${mẫu}) — chạy lại phép thay trước khi commit`);
  }
});

test('phép quét thấy đủ mười màn', () => {
  // Bộ chọn hụt đi thì `CASES` teo lại và cả file này "xanh" vì không vẽ gì cả. Danh sách
  // dưới đây viết tay đúng một lần, ở đây, để chỗ đó kêu lên.
  const want = ['renderOverview', 'renderSessions', 'renderDecisions', 'renderTimeline', 'renderStats', 'renderUsage', 'renderHealth', 'renderLookback', 'renderPet', 'renderBench'];
  for (const n of want) assert.ok(SCANNED.includes(n), `phép quét không thấy ${n}`);
  assert.equal(SCANNED.length, want.length, `quét ra ${SCANNED.length} hàm render, chờ ${want.length}: ${SCANNED.join(', ')}`);
});

for (const lang of i18n.LANGS) {
  for (const [label, fn] of [...CASES, ...EXTRA]) {
    test(`[${lang}] ${label} — vẽ được với state thật`, () => {
      withLang(lang, () => paint(`[${lang}] ${label}`, fn));
    });
  }
}

test('ba tab của màn Token vẽ ra ba thân khác nhau', () => {
  const seen = withLang('vi', () =>
    USAGE_TABS.map((id) => {
      setTab(USAGE_GROUP, id);
      return rawText(renderUsage(STATE, ''));
    }),
  );
  assert.equal(new Set(seen).size, USAGE_TABS.length, `ba tab vẽ ra chuỗi trùng nhau — tên nhóm "${USAGE_GROUP}" có lẽ đã lệch khỏi TABS trong views/usage.js`);
});

test('đổi ngôn ngữ thì chữ trên màn đổi theo', () => {
  // Nếu `withLang` im lặng không đổi được ngôn ngữ thì cả vòng lặp trên chạy hai lượt tiếng
  // Việt, tức là nửa lưới biến mất mà không ai biết. Đây là chỗ kêu.
  const [vi, en] = ['vi', 'en'].map((l) => withLang(l, () => rawText(overviewDrawer(STATE.projects[0], STATE.thresholds))));
  assert.notEqual(vi, en, 'hai ngôn ngữ vẽ ra chuỗi giống hệt nhau — setLang không ăn');
});
