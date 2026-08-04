import { $, mount, copy, html, clock, esc, raw } from './lib/dom.js';
import { t, getLang, setLang, nextLang, LANG_LABEL, locale, applyStaticI18n, onLangChange } from './lib/i18n.js';
import { briefing } from './lib/butler.js';
import { quotaStrip, stripRows } from './lib/quota.js';
import { parseTip } from './lib/tip.js';
import { nextSkin, onSkinChange, setSkin } from './lib/skin.js';
import { onTabChange, setTab, tabKey } from './lib/tabs.js';
import { renderReport, scrapeView } from './lib/report.js';
import { empty } from './views/shared.js';
import { renderOverview, overviewDrawer } from './views/overview.js';
import { renderSessions } from './views/sessions.js';
import { renderDecisions } from './views/decisions.js';
import { renderTimeline } from './views/timeline.js';
import { renderHealth } from './views/health.js';
import { renderStats } from './views/stats.js';
import { renderUsage } from './views/usage.js';
import { renderLookback } from './views/lookback.js';
import { renderBench, initBench } from './views/bench.js';

// Nhãn và tiêu đề giữ dưới dạng KHOÁ i18n rồi dịch lúc vẽ — không phải chuỗi cố định,
// vì cả VIEWS được dựng một lần lúc nạp module còn ngôn ngữ thì đổi được giữa chừng.
const VIEWS = {
  overview: { icon: '▦', labelKey: 'nav.overview', titleKey: 'title.overview', render: renderOverview },
  sessions: { icon: '◍', labelKey: 'nav.sessions', titleKey: 'title.sessions', render: renderSessions },
  decisions: { icon: '◆', labelKey: 'nav.decisions', titleKey: 'title.decisions', render: renderDecisions },
  timeline: { icon: '✓', labelKey: 'nav.timeline', titleKey: 'title.timeline', render: renderTimeline },
  stats: { icon: '◔', labelKey: 'nav.stats', titleKey: 'title.stats', render: renderStats },
  // Màn Token mang cả ba công cụ. Màn Công cụ riêng đã bị gộp vào đây: hai màn hỏi đúng một
  // câu ("cái này đang tiêu tới đâu"), và tách ra thì câu gấp nhất — *chỗ nào sắp chặn tôi
  // trước* — không màn nào trả lời nổi vì mỗi màn chỉ giữ một nửa số. Xem `views/usage.js`.
  usage: { icon: '◈', labelKey: 'nav.usage', titleKey: 'title.usage', render: renderUsage },
  health: { icon: '⌬', labelKey: 'nav.health', titleKey: 'title.health', render: renderHealth },
  // Màn Nhìn lại đứng CUỐI, phím 8: nó đọc lịch sử — mọi màn trước nó là hiện tại, và
  // thứ tự nav đi từ "đang cháy" tới "đã qua". Phím số ăn theo ORDER nên chỉ cần thêm ở đây.
  lookback: { icon: '⟲', labelKey: 'nav.lookback', titleKey: 'title.lookback', render: renderLookback },
  // Bàn chỉnh đứng SAU cả Nhìn lại, phím 9. Bảy màn trên là chỗ đọc số; cái này là một
  // cái tuốc-nơ-vít — nó không nói gì về hôm nay cả, nên nó không được chen vào giữa
  // dòng "đang cháy → đã qua".
  //
  // Nhưng nó PHẢI ở trong nav. Trước 3/8 nó chỉ sống ở /menubar-demo.html, không một
  // đường nào trên dashboard trỏ tới — và một công cụ phải nhớ URL mới mở được thì lần
  // sau cần đến sẽ tìm không ra. Đó đúng là chuyện đã xảy ra.
  bench: { icon: '⚙', labelKey: 'nav.bench', titleKey: 'title.bench', render: renderBench },
};
const ORDER = Object.keys(VIEWS);

/**
 * Màn đã bị gộp đi → màn nhận nó.
 *
 * Không bỏ trống được: `#tools` còn nằm trong bookmark, trong lịch sử trình duyệt, và
 * trong chính app trên Dock nếu nó được đóng lúc đang ở màn ấy. Không có bảng này thì cả
 * ba lối đó rơi thẳng về màn Dự án, tức là một cú "app quên mất tôi đang ở đâu".
 */
const MOVED = { tools: 'usage' };

const viewFromHash = () => {
  const v = location.hash.slice(1);
  return MOVED[v] ?? v;
};

/**
 * `workSlide` — việc thứ mấy đang hiện ở ô một của quản gia.
 *
 * Ở ĐÂY chứ không trong DOM: trang tự vẽ lại 30 giây một lần, mà `mount()` thay sạch
 * `innerHTML` — trạng thái nào nằm trong đám thẻ đó thì cứ 30 giây lại bị nắn về mặc
 * định, tức là đang đọc việc thứ ba thì bị lôi về việc thứ nhất.
 */
export const app = { state: null, view: viewFromHash() || 'overview', query: '', workSlide: 0 };
if (!VIEWS[app.view]) app.view = 'overview';
// Viết lại thanh địa chỉ ngay nếu nó trỏ vào một màn đã chuyển chỗ: để nguyên `#tools`
// thì lần nạp lại sau vẫn đi qua bảng `MOVED`, mà bookmark thì không bao giờ tự sửa.
if (location.hash && location.hash.slice(1) !== app.view) location.replace(`#${app.view}`);

// ── Kết nối trực tiếp ─────────────────────────────────────────────────────────

let es;

/**
 * Dấu vân của trạng thái, KHÔNG tính `generatedAt`/`buildMs`.
 *
 * Server phát lại mỗi 30 giây dù có gì đổi hay không, mà hai trường kia thì lượt nào
 * cũng khác — so nguyên payload là lượt nào cũng "có đổi" và ta lại vẽ lại toàn trang
 * cho một bức tranh y hệt. Cắt đúng hai trường đó ra thì phần lớn các lượt trở thành
 * "không có gì mới" và trang đứng yên.
 *
 * Giờ cập nhật ở thanh trên vẫn phải nhích, nên nó được viết riêng ở dưới.
 */
function fingerprint(s) {
  const { generatedAt, buildMs, ...rest } = s;
  // `idleMs` là `now - lastActivityAt`: một cái ĐỒNG HỒ, không phải trạng thái. Nó khác
  // ở mọi lượt quét dù không có gì xảy ra — đo được: giữa hai lượt liên tiếp, thứ duy
  // nhất lệch là `generatedAt`, `buildMs`, và `idleMs` của cả 24 phiên. Để nó trong bộ
  // so thì lượt nào cũng "có đổi" và cả cơ chế này thành vô dụng.
  return JSON.stringify(rest, (k, v) => (k === 'idleMs' ? undefined : v));
}
let lastPrint = null;
let lastDrawAt = 0;

/**
 * Trần cũ cho một lượt vẽ.
 *
 * Bỏ qua lượt vẽ thì các nhãn thời gian tương đối ("ngủ 40 phút") đứng im theo. Nên vẫn
 * vẽ lại ít nhất 5 phút một lần: đủ thưa để trang thôi giật dưới tay, đủ dày để nhãn
 * không nói sai quá một khoảng mà chính nó làm tròn tới. Giờ cập nhật ở thanh trên thì
 * luôn đúng — nó được viết lại ở MỌI lượt, kể cả lượt bị bỏ.
 */
const MAX_STALE_MS = 5 * 60 * 1000;

function apply(state) {
  const print = fingerprint(state);
  const same = print === lastPrint && Date.now() - lastDrawAt < MAX_STALE_MS;
  lastPrint = print;
  app.state = state;
  stopBoot();
  setPulse(true);
  if (same) {
    // Không có gì mới: chỉ nhích lại giờ cập nhật, giữ nguyên DOM — cùng đó là giữ
    // nguyên vệt bôi đen, focus, và cả cái tooltip đang mở.
    stampClock();
    return;
  }
  lastDrawAt = Date.now();
  render();
}

function connect() {
  es?.close();
  es = new EventSource('/api/stream');
  es.addEventListener('state', (e) => {
    apply(JSON.parse(e.data));
  });
  es.onerror = () => setPulse(false);
  es.onopen = () => setPulse(true);
}

/**
 * Mất kết nối thì trang vẫn còn dữ liệu cũ trên màn hình — và trông y hệt dữ liệu
 * mới. Một chấm đỏ 6px ở góc không đủ để chặn việc đó: phải nói thẳng ra là đang
 * xem ảnh chụp lúc mấy giờ, nếu không sếp tin nhầm một bức tranh đã chết.
 */
let online = false;
function setPulse(ok) {
  online = ok;
  const el = $('#pulse');
  el.classList.toggle('off', !ok);
  $('#pulse-t').textContent = ok ? t('top.live') : t('top.lost');
  $('#offline').hidden = ok || !app.state;
  if (!ok) {
    $('#off-t').textContent = clock(app.state?.generatedAt);
    return;
  }
  el.classList.remove('beat');
  void el.offsetWidth;
  el.classList.add('beat');
}

// ── Lần nạp đầu ───────────────────────────────────────────────────────────────

/**
 * Mấy giây đầu, khi CHƯA TỪNG có dữ liệu nào về.
 *
 * Đây không phải trường hợp "mất kết nối" ở trên: lúc mất kết nối, số cũ vẫn nằm trên
 * màn và việc cần làm là nói ra rằng chúng đã chết. Lúc này thì màn trống hẳn — và một
 * trang trống trong 4–6 giây đọc ra y hệt một trang hỏng. Dải cảnh báo mất kết nối cũng
 * không cứu được: `setPulse` giấu nó đi khi chưa có `app.state`, nên nếu server không
 * chạy thì trước đây trang đứng trắng VĨNH VIỄN, không một chữ nào.
 *
 * Ba câu khác nhau, phân biệt bằng /api/ping — cùng một màn trống nhưng việc phải làm
 * thì khác hẳn nhau:
 *
 * - `ready:false` → server sống, đang quét lượt đầu. Ngồi chờ là xong.
 * - `ready:true`  → server đã có số mà tab này chưa nhận được. Tải lại trang.
 * - ping hỏng     → server chưa chạy. Phải đi gõ lệnh.
 */
const BOOT_DELAY_MS = 300;
const BOOT_POLL_MS = 1500;
let bootTimer = null;
let bootPhase = null;

function stopBoot() {
  clearTimeout(bootTimer);
  bootTimer = null;
}

/**
 * Hoãn 300 ms trước khi vẽ.
 *
 * Server ấm thì lượt SSE đầu về trong vài chục mili-giây, và một câu "đang quét lần đầu"
 * loé lên rồi biến mất ngay còn khó chịu hơn khoảng trống nó định lấp. Chỉ trang nào chờ
 * thật mới thấy nó.
 */
function startBoot() {
  if (bootTimer || app.state) return;
  bootTimer = setTimeout(probeBoot, BOOT_DELAY_MS);
}

async function probeBoot() {
  bootTimer = null;
  if (app.state) return;
  try {
    const r = await fetch('/api/ping');
    bootPhase = (await r.json()).ready ? 'wait' : 'scanning';
  } catch {
    bootPhase = 'down';
  }
  if (app.state) return;
  renderBoot();
  bootTimer = setTimeout(probeBoot, BOOT_POLL_MS);
}

/** Biểu tượng, câu, và lời chỉ việc phải làm — mỗi pha một bộ. */
const BOOT_FACE = {
  scanning: { icon: '◍', msg: 'boot.scanning', hint: 'boot.scanningHint', sub: 'boot.scanningSub' },
  wait: { icon: '◍', msg: 'boot.wait', hint: 'boot.waitHint', sub: 'boot.waitSub' },
  down: { icon: '⚠', msg: 'boot.down', hint: 'boot.downHint', sub: 'boot.downSub' },
};

/**
 * Khối quản gia bị ẩn HẲN chứ không để khung rỗng: cái khung ấy có nhãn "Các việc đáng
 * làm lúc này" và một chỗ trống bên dưới — đọc ra thành "không có việc nào đáng làm",
 * tức là một câu trả lời sai chứ không phải một chỗ chưa có câu trả lời.
 */
function renderBoot() {
  const face = BOOT_FACE[bootPhase] ?? BOOT_FACE.scanning;
  $('#butler').hidden = true;
  $('#vsub').textContent = t(face.sub);
  mount($('#view'), empty(face.icon, t(face.msg), t(face.hint)));
}

let refreshing = false;
async function forceRefresh() {
  if (refreshing) return;
  refreshing = true;
  $('#pulse').classList.add('scanning');
  $('#pulse-t').textContent = t('top.scanning');
  try {
    const r = await fetch('/api/state?force=1');
    apply(await r.json());
  } catch {
    setPulse(false);
  } finally {
    refreshing = false;
    $('#pulse').classList.remove('scanning');
  }
}

// ── Vẽ ────────────────────────────────────────────────────────────────────────

function navPip(key, s) {
  if (!s) return null;
  // Số 0 không phải thông tin — để trống thì phím tắt hiện ra, hữu ích hơn.
  if (key === 'decisions' && s.stats.hotDecisions) return { cls: 'hot', text: s.stats.hotDecisions };
  if (key === 'decisions' && s.stats.decisions) return { cls: '', text: s.stats.decisions };
  if (key === 'sessions' && s.stats.awake) return { cls: '', text: s.stats.awake };
  if (key === 'overview' && s.stats.projects) return { cls: '', text: s.stats.projects };
  if (key === 'health') {
    const n = s.stats.needsUpdate + s.stats.worktreeWarn + s.stats.schemaProblems;
    return n ? { cls: 'warn', text: n } : null;
  }
  return null;
}

/**
 * Nav là `<button>`, không phải `<div>` gắn onclick.
 *
 * Sáu mục này là lối đi chính của cả app mà trước đây không Tab tới được cái nào —
 * dùng bàn phím thì chỉ còn phím số, và phím số thì phải biết trước là có.
 *
 * `aria-current="page"` cho màn đang xem: dấu hiệu duy nhất trước đây là màu nền,
 * tức là không có dấu hiệu nào cho người không nhìn thấy màu nền.
 * `aria-label` trên `.pip` vì "3" đứng một mình không nói lên nó là số gì.
 */
function renderNav() {
  mount(
    $('#nav'),
    html`${ORDER.map((k, i) => {
      const v = VIEWS[k];
      const pip = navPip(k, app.state);
      return html`<button type="button" class="nav-item ${k === app.view ? 'active' : ''}" data-view="${k}"
        ${k === app.view ? raw('aria-current="page"') : ''}>
        <span class="ico" aria-hidden="true">${v.icon}</span>
        <span class="label">${t(v.labelKey)}</span>
        ${pip
          ? html`<span class="pip ${pip.cls}" aria-label="${t('nav.pipAria', { n: pip.text })}">${pip.text}</span>`
          : html`<span class="key" aria-hidden="true">${i + 1}</span>`}
      </button>`;
    })}`,
  );
}

/**
 * Một ô của quản gia: nhãn loại việc, câu, lý do, rồi nút làm việc đó.
 *
 * Nút nằm NGAY trong ô của câu nó phục vụ, không dồn cả hai xuống một hàng chung ở đáy
 * khối: hai ô có hai nút khác nhau (`chốt d-7` và `/model opus`), mà hai nút đứng cạnh
 * nhau dưới hai câu thì không nút nào còn chỉ về câu nào.
 *
 * `id` chỉ có ở ô đầu, cho `aria-labelledby` của cả khối — nó là câu giới thiệu khối,
 * còn ô hai luôn nói về cùng một chuyện nên không cần tên riêng.
 */
function butlerSlot(slot, { kind, id, extra = '', nav = '' }) {
  const a = slot.action;
  return html`<div class="bslot ${slot.tone ?? ''}">
    <span class="bslot-k">${t(`butler.slot.${kind}`)}${nav}</span>
    <p class="butler-say"${id ? raw(` id="${id}"`) : ''}>${slot.text}</p>
    ${slot.why ? html`<p class="butler-why">${slot.why}</p>` : ''}
    ${extra}
    <div class="butler-act">
      ${a
        ? html`<button type="button" class="go" data-copy="${a.copy}"
            aria-label="${t('common.copyAria', { text: a.copy })} — ${a.hint ?? t('butler.sayToClaude')}">${a.label}</button>`
        : ''}
      ${a?.hint ? html`<span class="hint">${a.hint}</span>` : ''}
      ${slot.goto
        ? html`<button type="button" class="jump" data-view="${slot.goto}">${t('butler.seeAll', { name: t(`viewname.${slot.goto}`) })}</button>`
        : ''}
    </div>
  </div>`;
}

/**
 * Nút xoay vòng của ô "việc đáng làm" — nằm NGAY trên câu nó lật, cạnh cái nhãn loại
 * việc, chứ không ở thanh tiêu đề của cả khối. Nó chỉ điều khiển đúng một ô; đẩy lên
 * thanh chung là để nó trông như đang lật cả khối, mà ô hạn mức thì không lật đi đâu cả.
 *
 * Một việc thì không có nút nào: hai mũi tên bấm vào rồi chẳng thấy gì đổi còn tệ hơn
 * là không có mũi tên nào.
 *
 * Vạch chạy `.bspin` là thứ DUY NHẤT nói trước rằng lát nữa chữ sẽ tự đổi. Thiếu nó thì
 * câu đang đọc dở nhảy đi không báo trước, và cái nhảy ấy đọc ra thành trang bị lỗi chứ
 * không đọc ra thành "còn hai việc nữa". Nó cũng chỉ là vạch — thời gian còn lại không
 * bao giờ ra chữ, vì đó là con số duy nhất trong cả khối mà biết chính xác cũng không
 * làm được gì.
 */
function slideNav(i, n, spin) {
  if (n < 2) return '';
  return html`<span class="bnav">
    <button type="button" data-bstep="-1" aria-label="${t('butler.slidePrev')}">‹</button>
    <span class="bpos" aria-label="${t('butler.slideAria', { i: i + 1, n })}">${t('butler.slidePos', { i: i + 1, n })}</span>
    <button type="button" data-bstep="1" aria-label="${t('butler.slideNext')}">›</button>
    ${spin ? html`<i class="bspin" style="animation-duration:${SPIN_MS}ms" aria-hidden="true"></i>` : ''}
  </span>`;
}

/**
 * Ô một tự chuyển việc sau ngần này.
 *
 * Bản trước chỉ lật bằng tay, và cách ấy hỏng theo đúng kiểu mà cả khối này sinh ra để
 * sửa: việc thứ hai vẫn không có trên trang, chỉ là giờ nó nằm sau một cái nút thay vì
 * nằm sau một phép so. Ai liếc ba giây rồi đi thì không bao giờ bấm cái nút đó.
 */
const SPIN_MS = 8000;

/**
 * Hai thứ chặn không cho tự chuyển, và chúng KHÔNG được dùng chung một biến:
 *
 * - `pause.pointer` — con trỏ đang nằm trong khối.
 * - `pause.focus` — focus đang nằm trong khối (người dùng bàn phím).
 * - `prefers-reduced-motion` — hỏi lại mỗi lượt hẹn giờ chứ không chốt một lần lúc nạp:
 *   đây là thứ đổi được ngay trong System Settings mà trang thì mở suốt ngày.
 *
 * Tách hai lối vì chúng chồng lên nhau được: đang tab tới nút trong khối rồi vô tình
 * quệt chuột ra ngoài, mà chung một biến thì cú quệt ấy bật chạy lại ngay dưới tay người
 * đang đọc bằng bàn phím.
 *
 * Bấm ‹ › thì KHÔNG tắt hẳn — nó chỉ đếm lại từ đầu, vì `renderButler` dựng lại cả vạch
 * chạy lẫn đồng hồ. Bản trước tắt hẳn sau một cú bấm, và cách đó hỏng ở chỗ không có gì
 * trên màn nói ra là nó vừa tắt: nhìn y hệt lúc hỏng. Rê chuột vào vẫn là cách dừng —
 * đó cũng là cái WCAG 2.2.2 đòi, và nó tự nói ra bằng việc vạch chạy biến mất.
 */
const pause = { pointer: false, focus: false };
let spinTimer = null;
let spinPaused = false;
let workCount = 0;

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

const canSpin = () => workCount > 1 && !spinPaused && !reduceMotion();

/**
 * Hẹn giờ bằng `setTimeout` bắc cầu, KHÔNG phải `setInterval`.
 *
 * Mỗi lượt vẽ lại đều gọi hàm này, nên nhịp luôn được đặt lại từ đầu — mà "đặt lại từ
 * đầu" chính là thứ phải xảy ra sau khi thôi rê chuột: vạch chạy `.bspin` cũng khởi động
 * lại từ 0 vì `mount()` vừa dựng lại cái thẻ ấy. Một `setInterval` chạy nền thì hai cái
 * đồng hồ trôi lệch nhau, và vạch sẽ về đích trước hoặc sau lúc chữ đổi.
 */
function scheduleSpin() {
  clearTimeout(spinTimer);
  spinTimer = null;
  if (!canSpin()) return;
  spinTimer = setTimeout(() => {
    app.workSlide += 1;
    renderButler(app.state);
  }, SPIN_MS);
}

/** Rê chuột / focus vào khối là dừng; ra khỏi là chạy lại từ đầu. */
function bindSpinPause() {
  const box = $('#butler');
  const sync = () => {
    const v = pause.pointer || pause.focus;
    if (spinPaused === v) return;
    spinPaused = v;
    box.classList.toggle('paused', v);
    // Vẽ lại để vạch chạy khởi động lại từ 0 cùng lúc với đồng hồ. Chỉ đổi một thuộc
    // tính CSS thì vạch chạy tiếp từ chỗ nó đang đứng, còn `scheduleSpin` thì đếm lại
    // đủ tám giây — hai cái nói hai điều khác nhau về cùng một khoảnh khắc.
    if (!v && app.state) renderButler(app.state);
    else scheduleSpin();
  };

  // Con trỏ đo bằng "nó đang ở đâu", KHÔNG bằng cặp `pointerenter`/`pointerleave`.
  //
  // Đây là chỗ bản trước kẹt: hai sự kiện kia phải nổ ĐÚNG THÀNH CẶP thì mới cân, mà
  // `pointerleave` thì nổ thiếu ở mấy ca có thật — con trỏ ra khỏi hẳn cửa sổ, hay
  // `mount()` thay sạch DOM ngay dưới con trỏ giữa lúc rê. Thiếu một lần là kẹt vĩnh
  // viễn ở trạng thái dừng, và trên màn thì kẹt ấy trông y hệt lúc hỏng.
  //
  // Tính lại từ vị trí thật mỗi cú di chuột thì không có gì để lệch: nổ thiếu một sự
  // kiện chỉ làm trễ tới cú di tiếp theo.
  document.addEventListener('pointermove', (e) => {
    pause.pointer = !!e.target?.closest?.('#butler');
    sync();
  });
  // Hai ca không còn cú di nào để tự chữa: con trỏ ra khỏi cửa sổ, và sếp chuyển hẳn
  // sang app khác. Cả hai đều nghĩa là không ai đang đọc, nên chạy tiếp.
  document.addEventListener('pointerleave', () => {
    pause.pointer = false;
    sync();
  });
  window.addEventListener('blur', () => {
    pause.pointer = false;
    pause.focus = false;
    sync();
  });

  box.addEventListener('focusin', () => {
    pause.focus = true;
    sync();
  });
  // `relatedTarget` chứ không phải `document.activeElement`: lúc `focusout` nổ thì focus
  // chưa dời chỗ xong, `activeElement` còn đang là `<body>` — đọc nó thì lần nào cũng
  // ra "đã rời khối", kể cả khi focus vừa nhảy từ nút ‹ sang nút › ngay bên cạnh.
  box.addEventListener('focusout', (e) => {
    pause.focus = !!e.relatedTarget && box.contains(e.relatedTarget);
    sync();
  });
}

/** Quản gia chỉ nói ở màn Dự án — các màn khác đã là câu trả lời cho chính nó. */
function renderButler(s) {
  const box = $('#butler');
  const onOverview = app.view === 'overview' && !app.query;
  box.hidden = !onOverview;
  // Khối ẩn thì đồng hồ phải tắt theo, không chỉ vì tốn: nó vẫn cộng `workSlide` sau
  // lưng, nên quay lại màn Dự án sẽ thấy ô đứng ở một việc mình chưa từng mở tới.
  if (!onOverview) {
    workCount = 0;
    scheduleSpin();
    return;
  }

  const b = briefing(s);
  $('#bclock').textContent = new Date().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

  // Hạn mức: ẩn HẲN khi chưa đọc được, không để lại khung rỗng. Khung rỗng ở đúng chỗ
  // này đọc ra thành "còn 0%", tức là ngược hẳn sự thật.
  const qrows = stripRows(b.quota.rows);
  $('#bquota').hidden = !qrows.length;
  if (qrows.length) mount($('#bquota'), quotaStrip(qrows));

  // Cảnh báo Cursor + Antigravity đi vào ô HẠN MỨC, không đứng dưới cả khối: chúng nói
  // đúng chuyện của ô đó bằng đúng đơn vị đó. Số chi tiết nằm ở tooltip của từng câu.
  const tools = b.tools ?? [];
  const toolLines = tools.length
    ? html`<div class="butler-tools">
        ${tools.map(
          (l) => html`<p class="btool ${l.tone}" tabindex="0" data-tip="${l.tip}" data-tip-tone="${l.tone}">${l.text}</p>`,
        )}
      </div>`
    : '';

  // Số việc đổi giữa hai lượt quét (chốt xong một quyết định là danh sách ngắn lại), nên
  // chỗ đang đứng phải được kẹp lại mỗi lượt vẽ. Kẹp bằng phép chia dư chứ không cắt về 0:
  // đang ở việc thứ 3 mà việc thứ 1 vừa xong thì nhảy về đầu là đọc lại thứ vừa đọc xong.
  const works = b.works ?? [];
  const at = works.length ? ((app.workSlide % works.length) + works.length) % works.length : 0;
  app.workSlide = at;
  workCount = works.length;

  // Nút vừa bấm phải giữ được focus qua lượt vẽ lại. Khối quản gia nằm NGOÀI `#view` nên
  // `keepUI` không đụng tới nó — không chụp lại ở đây thì bấm ‹ xong, 30 giây sau focus
  // văng về `body` giữa lúc đang lật.
  const held = document.activeElement?.closest?.('#bslots')?.dataset?.bstep
    ?? document.activeElement?.dataset?.bstep
    ?? null;

  mount(
    $('#bslots'),
    html`${butlerSlot(works[at] ?? { text: '', tone: 'mute' }, {
      kind: 'work',
      id: 'btxt',
      nav: slideNav(at, works.length, canSpin()),
    })}${butlerSlot(b.burn, { kind: 'burn', extra: toolLines })}`,
  );

  if (held) $(`#bslots [data-bstep="${held}"]`)?.focus();
  scheduleSpin();
}

/**
 * Trang tự vẽ lại mỗi lượt broadcast (30 giây một lần, hoặc ngay khi có file đổi).
 * Vẽ lại bằng `innerHTML` thì mất hai thứ người dùng vừa tự tay đặt: chỗ đang cuộn
 * và các khối `<details>` vừa mở. Mất chúng giữa lúc đang đọc thì cảm giác đúng
 * như trang tự nhảy — nên chụp lại trước khi vẽ và trả lại ngay sau.
 */
const openDetails = new Set();

/**
 * Đường dẫn ổn định tới một phần tử, để tìm lại nó sau khi `innerHTML` bị thay sạch.
 * Dùng mã sẵn có nếu phần tử tự giới thiệu (`data-project`, `data-k`, `data-copy`…),
 * không thì lấy vị trí trong cây — đủ chính xác cho một trang vẽ lại y hệt.
 */
function pathOf(el, root) {
  if (!el || el === root || !root.contains(el)) return null;
  for (const attr of ['data-open-project', 'data-project', 'data-k', 'data-copy', 'data-report', 'data-skin', 'data-tab', 'data-view', 'data-tip', 'id']) {
    const v = el.getAttribute?.(attr);
    if (v) return `[${attr}="${CSS.escape(v)}"]`;
  }
  const parts = [];
  for (let n = el; n && n !== root; n = n.parentElement) {
    parts.unshift([...n.parentElement.children].indexOf(n));
  }
  return parts.length ? `>${parts.join('.')}` : null;
}

function findByPath(p, root) {
  if (!p) return null;
  if (!p.startsWith('>')) return root.querySelector(p);
  let n = root;
  for (const i of p.slice(1).split('.')) {
    n = n?.children[Number(i)];
    if (!n) return null;
  }
  return n;
}

function keepUI(draw) {
  const box = $('#scroll');
  const view = $('#view');
  const top = box.scrollTop;
  for (const d of view.querySelectorAll('details[data-k]')) {
    if (d.open) openDetails.add(d.dataset.k);
    else openDetails.delete(d.dataset.k);
  }

  // Thay `innerHTML` là **chắc chắn** mất focus bàn phím và vệt bôi đen trong vùng bị
  // thay. Trước đây chỉ vị trí cuộn và `<details>` được chụp lại, nên cứ 30 giây một
  // lần: đang bôi đen đường dẫn để chép tay thì mất, đang `Tab` tới một cột chart để
  // nghe tooltip thì focus văng về `body`. Chart được làm rất kỹ cho bàn phím rồi bị
  // chính vòng vẽ lại phá — nên chụp cả hai thứ đó luôn.
  const focusPath = view.contains(document.activeElement) ? pathOf(document.activeElement, view) : null;
  const sel = window.getSelection();
  const selPath =
    sel && !sel.isCollapsed && view.contains(sel.anchorNode)
      ? {
          anchor: pathOf(sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode, view),
          text: sel.toString(),
        }
      : null;

  draw();

  for (const d of view.querySelectorAll('details[data-k]')) d.open = openDetails.has(d.dataset.k);
  box.scrollTop = Math.min(top, box.scrollHeight - box.clientHeight);

  const again = findByPath(focusPath, view);
  // `preventScroll`: trả focus mà để trình duyệt tự cuộn theo là phá đúng cái vị trí
  // cuộn vừa khôi phục ở dòng trên.
  again?.focus?.({ preventScroll: true });

  if (selPath) {
    const host = findByPath(selPath.anchor, view);
    // Chỉ nối lại vệt bôi đen khi chữ ở chỗ cũ KHÔNG đổi. Bôi lại một đoạn đã khác nội
    // dung thì tệ hơn là mất hẳn: sếp tưởng mình đang chép cái vừa nhìn thấy.
    if (host && host.textContent.includes(selPath.text)) {
      const r = document.createRange();
      r.selectNodeContents(host);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }
}

/**
 * Giờ cập nhật đứng trước: khi liếc, câu hỏi luôn là "cái này còn mới không", chứ không
 * phải "quét mất bao lâu" — thời gian quét là chỉ số cho người sửa dashboard, để sau
 * cùng và nhỏ đi.
 *
 * Tách riêng khỏi `render()` vì đây là thứ DUY NHẤT phải nhích khi lượt quét mới không
 * mang theo thay đổi nào.
 */
function stampClock() {
  const s = app.state;
  if (!s) return;
  $('#vsub').textContent = t('top.sub', {
    time: clock(s.generatedAt),
    projects: s.stats.projects,
    sessions: s.stats.sessions,
    needsUpdate: s.stats.needsUpdate,
    buildMs: s.buildMs,
  });
}

function render() {
  const s = app.state;
  renderNav();
  const v = VIEWS[app.view];
  $('#vtitle').textContent = t(v.titleKey);
  // Chưa có gì để vẽ thì phải NÓI RA đang chờ cái gì — xem `startBoot`.
  if (!s) return bootPhase ? renderBoot() : startBoot();

  stampClock();
  renderButler(s);
  keepUI(() => mount($('#view'), v.render(s, app.query)));
  if (drawerId) syncDrawer();
}

// ── Công tắc icon thanh menu ──────────────────────────────────────────────────
//
// Nút nằm trong chrome tĩnh của trang (`#menubar` ở index.html), không bị lượt vẽ 30 giây
// dựng lại — nên gắn listener thẳng, không cần uỷ quyền như các nút trong `#view`.
//
// Trạng thái không đi qua `app.state`: đó là sổ ghi những gì lượt quét THẤY, còn đây là
// một công tắc chỉ có nghĩa trên macOS. Nhét vào state thì mọi người đọc — test, SSE,
// popover — đều phải mang theo một trường không dùng tới.

/** `null` = chưa hỏi xong. Nút còn ẩn suốt lúc đó, nên không có khoảnh khắc nào nó nói ra
 *  một trạng thái mà nó chưa biết. */
let menubarOn = null;

function paintMenubar() {
  const btn = $('#menubar');
  if (menubarOn === null) return; // vẫn ẩn: chưa biết thì chưa hiện
  btn.hidden = false;
  btn.disabled = false;
  btn.classList.toggle('off', !menubarOn);
  btn.title = t(menubarOn ? 'menubar.toOff' : 'menubar.toOn');
  $('#menubar-t').textContent = t('menubar.label');
}

/** Hỏi MỘT lần lúc nạp trang. Không hỏi lại theo lượt quét: công tắc này chỉ đổi khi có
 *  người bấm — hoặc ở đây, hoặc trên menu chuột phải của chính cái icon, và trường hợp
 *  sau thì trang đã không còn nút để mà lệch. */
function probeMenubar() {
  fetch('/api/menubar')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d) return; // 501 ngoài macOS — để nút ẩn hẳn, đừng bày một công tắc chết
      menubarOn = d.on;
      paintMenubar();
    })
    .catch(() => {});
}

$('#menubar').addEventListener('click', () => {
  // Không hỏi lại "bạn có chắc không": tooltip đã nói đúng việc sắp xảy ra, và CHÍNH nút
  // này là nút bật lại. Một hành động tự lật lại được bằng cú bấm thứ hai vào cùng chỗ
  // thì hộp thoại xác nhận chỉ là một cú bấm thừa.
  if (menubarOn === null) return;
  const want = !menubarOn;
  const btn = $('#menubar');
  btn.disabled = true;
  btn.title = t('menubar.busy');
  fetch('/api/menubar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ on: want }),
  })
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || r.status);
      // Tin vào cái server TRẢ VỀ, không phải cái vừa xin: `bin/now-menu on` ghi được mục
      // đăng nhập rồi vẫn có thể không dựng nổi tiến trình, và khi ấy nó báo lỗi chứ
      // không báo `on`.
      menubarOn = d.on;
      paintMenubar();
    })
    .catch((err) => {
      btn.disabled = false;
      btn.title = t('menubar.err', { msg: err.message });
    });
});

// Ngôn ngữ đổi thì tooltip phải đổi theo — nó là chuỗi dịch, không phải nhãn cố định.
onLangChange(() => paintMenubar());
probeMenubar();

export function go(view, query) {
  if (!VIEWS[view]) return;
  const same = view === app.view;
  app.view = view;
  if (query !== undefined) {
    clearTimeout(queryTimer);
    app.query = query;
    $('#q').value = query;
  }
  location.hash = view;
  render();
  if (!same || query !== undefined) $('#scroll').scrollTop = 0;
}

// ── Ngăn kéo ──────────────────────────────────────────────────────────────────

/** Dự án đang mở trong ngăn kéo — giữ theo `id` chứ không giữ object, để lượt
 *  quét mới thay được nội dung mà không đóng ngăn kéo đang đọc dở. */
let drawerId = null;

/**
 * Thứ đang được focus lúc ngăn kéo mở ra — để trả focus về đúng đó khi đóng.
 * Không trả về thì đóng xong focus rơi về `<body>` và Tab tiếp theo bắt đầu lại
 * từ đầu trang, tức là mất chỗ y như cuộn bị đặt lại.
 *
 * Giữ CẢ phần tử lẫn đường dẫn tới nó: đọc một board thường mất hơn 30 giây, mà
 * mỗi lượt quét là `#view` bị thay sạch — phần tử đã lưu thành mồ côi và
 * `focus()` trên nó im lặng không làm gì. Đường dẫn thì tìm lại được cái mới.
 */
let drawerOpener = null;

/** Mở board đầy đủ của một dự án. Lật qua lại được bằng ← → nên không phải
 *  đóng–mở từng cái khi muốn điểm qua vài dự án một lượt. */
export function openProject(id, keepScroll = false) {
  const list = app.state?.projects ?? [];
  const p = list.find((x) => x.id === id);
  if (!p) return;
  const body = $('#dbody');
  const drawer = $('#drawer');
  const firstOpen = drawerId === null;
  const top = keepScroll ? body.scrollTop : 0;
  if (id !== drawerId) mdOpenFor = null;
  if (firstOpen) {
    const el = document.activeElement;
    drawerOpener = { el, path: pathOf(el, $('#view')) };
  }
  drawerId = id;

  // Nội dung ngăn kéo cũng bị thay sạch mỗi lượt quét, đúng như `#view` — nên nó
  // cần đúng cái bảo vệ mà `keepUI` đã dựng cho `#view`: đang Tab tới nút "chép
  // lệnh mở Claude" mà tới lượt quét 30 giây thì focus văng về đầu trang.
  const focusPath = body.contains(document.activeElement) ? pathOf(document.activeElement, body) : null;

  $('#dtitle').textContent = p.name;
  $('#dnav').hidden = list.length < 2;
  $('#dpos').textContent = `${list.indexOf(p) + 1}/${list.length}`;
  mount(body, overviewDrawer(p, app.state.thresholds));
  drawer.removeAttribute('inert');
  drawer.classList.add('open');
  $('#scrim').classList.add('open');
  body.scrollTop = top;

  findByPath(focusPath, body)?.focus?.({ preventScroll: true });
  // Chỉ dời focus vào ngăn kéo ở nhịp MỞ. Lượt quét sau đó (`syncDrawer`) và lúc
  // lật ← → đều gọi lại hàm này — cướp focus ở đó thì đang đọc dở bị giật về đầu
  // bảng cứ 30 giây một lần.
  if (firstOpen) $('#dclose').focus({ preventScroll: true });

  // Ngăn kéo vẽ lại mỗi lượt quét; NOW.md đang mở phải mở lại, nếu không nó biến
  // mất giữa lúc đang đọc. Nạp lại chứ không cache — file có thể vừa được
  // `/now update` ghi đè, hiện bản cũ còn tệ hơn.
  if (mdOpenFor === id) loadNowMd(id, $('#dbody [data-md]'));
}

/** Vẽ lại ngăn kéo theo trạng thái mới mà không giật chỗ đang đọc. */
function syncDrawer() {
  if (app.state?.projects.some((p) => p.id === drawerId)) openProject(drawerId, true);
}

function stepProject(delta) {
  const list = app.state?.projects ?? [];
  const i = list.findIndex((p) => p.id === drawerId);
  if (i < 0) return;
  openProject(list[(i + delta + list.length) % list.length].id);
}

export function closeDrawer() {
  if (drawerId === null) return;
  drawerId = null;
  mdOpenFor = null;
  const drawer = $('#drawer');
  drawer.classList.remove('open');
  $('#scrim').classList.remove('open');
  // `inert` chứ không chỉ trượt ra ngoài màn: ngăn kéo đóng vẫn nằm trong DOM ở
  // `translate: 100%`, nên ba nút của nó VẪN trong tab order. Tab từ ô tìm là rơi
  // vào ba nút vô hình, và Enter ở đó lật dự án trong một bảng không ai thấy.
  drawer.setAttribute('inert', '');
  const back = drawerOpener?.el?.isConnected ? drawerOpener.el : findByPath(drawerOpener?.path, $('#view'));
  back?.focus?.({ preventScroll: true });
  drawerOpener = null;
}

const helpOpen = () => !$('#help').hidden;

/** Bảng phím tắt là một hộp thoại: mở thì focus vào nó, đóng thì trả focus về chỗ
 *  cũ. Trước đây bấm `?` xong Tab tiếp là đi thẳng qua bảng ra sau lưng nó. */
let helpOpener = null;
const toggleHelp = (on) => {
  const want = on === undefined ? !helpOpen() : on;
  if (want === helpOpen()) return;
  if (want) helpOpener = document.activeElement;
  $('#help').hidden = !want;
  if (want) $('#helpclose').focus({ preventScroll: true });
  else {
    helpOpener?.focus?.({ preventScroll: true });
    helpOpener = null;
  }
};

// ── Sự kiện ───────────────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-view]');
  if (nav) return go(nav.dataset.view, nav.dataset.q);

  const cp = e.target.closest('[data-copy]');
  if (cp) {
    e.stopPropagation();
    return copy(cp.dataset.copy, cp);
  }

  // Báo cáo cả màn. KHÔNG đi qua `data-copy`: nội dung dài vài chục nghìn ký tự và
  // phải nằm trong một thuộc tính HTML đã escape — vừa phình DOM ở mọi lượt vẽ lại
  // (30 giây một lần) vừa chỉ để dùng cho một cú bấm. Nên nó được dựng lúc BẤM, từ
  // cây DOM đang có, và dùng đúng dấu thời gian của dữ liệu đang hiện.
  const rp = e.target.closest('[data-report]');
  if (rp) {
    e.stopPropagation();
    return copyReport(rp);
  }

  // Nút phong cách được vẽ lại cùng trang nên không gắn listener trực tiếp được.
  // `reroll` gọi lại đúng phong cách đang bật: `setSkin('random')` gieo hạt mới
  // (xem `lib/skin.js`), nên bấm lại là ra một bộ hình khác mà không rời chế độ.
  const sk = e.target.closest('[data-skin]');
  if (sk) {
    e.stopPropagation();
    return setSkin(sk.dataset.skin === 'reroll' ? 'random' : nextSkin());
  }

  // Tab cũng vẽ lại cùng trang nên cùng lý do với nút phong cách: bắt bằng uỷ quyền, đổi
  // trạng thái ở `lib/tabs.js`, rồi để `onTabChange` gọi lại `render`.
  const tb = e.target.closest('[data-tab]');
  if (tb) {
    e.stopPropagation();
    return setTab(tb.dataset.tabGroup, tb.dataset.tab);
  }

  const open = e.target.closest('[data-open]');
  if (open) {
    e.stopPropagation();
    fetch('/api/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // `data-open-app` = mở BẰNG app đó (Cursor, Antigravity…); vắng mặt = mở bằng app
      // mặc định của hệ điều hành, tức là Finder với một thư mục.
      body: JSON.stringify({ path: open.dataset.open, app: open.dataset.openApp }),
    });
    return;
  }

  // `data-bstep`, không phải `data-step`: cái tên kia đã là của ngăn kéo dự án (ngay dưới),
  // và hai nút khác hẳn nhau dùng chung một khoá thì bấm lật việc lại lật cả dự án.
  const bstep = e.target.closest('[data-bstep]');
  if (bstep) {
    e.stopPropagation();
    app.workSlide += Number(bstep.dataset.bstep);
    // Không tắt tự chuyển — `renderButler` dựng lại vạch chạy nên đồng hồ đếm lại từ đầu,
    // tức là bấm tay được trọn tám giây để đọc thứ mình vừa lật tới. Muốn dừng hẳn thì
    // để con trỏ trong khối, và lúc đó vạch chạy biến mất để nói ra là nó đang dừng.
    return renderButler(app.state);
  }

  const step = e.target.closest('[data-step]');
  if (step) return stepProject(Number(step.dataset.step));

  const md = e.target.closest('[data-md]');
  if (md) {
    e.stopPropagation();
    return loadNowMd(md.dataset.md, md);
  }

  // Nút "xem board đầy đủ" mang `data-open-project` (không phải `data-project`, vì
  // lý do ở `overview.js`) — bắt nó trước khi rơi xuống nhánh bấm-cả-thẻ.
  const openCard = e.target.closest('[data-open-project]');
  if (openCard) {
    e.stopPropagation();
    return openProject(openCard.dataset.openProject);
  }

  const card = e.target.closest('[data-project]');
  if (card) return openProject(card.dataset.project);
});

/** Toàn văn NOW.md, đọc ngay tại chỗ. Board đầy đủ là thứ hay cần nhất khi quay
 *  lại một dự án, mà tới giờ vẫn phải rời dashboard sang editor mới xem được. */
let mdOpenFor = null;

async function loadNowMd(projectId, btn) {
  const box = $('#nowmd');
  if (!box || !btn) return;
  btn.disabled = true;
  btn.textContent = t('md.loading');
  try {
    const r = await fetch(`/api/now-md?project=${encodeURIComponent(projectId)}`);
    const data = await r.json();
    mount(box, data.markdown ? renderMd(data.markdown) : html`<div class="md-err">${data.error}</div>`);
    mdOpenFor = projectId;
    btn.remove();
  } catch (err) {
    mount(box, html`<div class="md-err">${t('md.error', { msg: err.message })}</div>`);
    btn.disabled = false;
    btn.textContent = t('common.retry');
  }
}

/**
 * Markdown tối thiểu, đúng những gì `/now update` sinh ra: tiêu đề, gạch đầu
 * dòng, đậm, `code`, kẻ ngang. Không kéo thư viện về chỉ để hiện một file mình
 * tự sinh ra — cả dashboard này không phụ thuộc gói nào.
 */
function renderMd(src) {
  // Escape TRƯỚC rồi mới nhận diện cú pháp: NOW.md là file trên đĩa, coi nội dung
  // của nó là HTML tin được thì một dấu `<` trong tiêu đề việc là đủ hỏng trang.
  // Đậm trước rồi mới tới nghiêng: `**x**` mà gặp luật nghiêng trước thì bị xé
  // thành hai dấu sao lẻ và hỏng cả hai.
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>');

  const out = src.split('\n').map((line) => {
    const t = line.trimEnd();
    if (/^\s*---+\s*$/.test(t)) return '<hr>';
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) return `<h${Math.min(4, h[1].length)}>${inline(h[2])}</h${Math.min(4, h[1].length)}>`;
    const q = t.match(/^\s*>\s?(.*)$/);
    if (q) return `<blockquote>${inline(q[1])}</blockquote>`;
    const li = t.match(/^\s*[-*]\s+(.*)$/);
    if (li) return `<li>${inline(li[1])}</li>`;
    return t.trim() ? `<p>${inline(t)}</p>` : '';
  });
  return raw(`<div class="md">${out.join('')}</div>`);
}

/**
 * Tooltip cho chart.
 *
 * Uỷ quyền ở `document` chứ không gắn vào từng mốc: `#view` bị thay sạch mỗi
 * lượt quét, listener gắn trực tiếp sẽ chết theo. Bàn phím dùng chung đúng
 * đường này (`focusin`) nên tooltip không bao giờ là lối đọc duy nhất — mỗi
 * chart còn một bảng số mở ra được nữa.
 *
 * Nội dung dựng bằng `createElement` + `textContent`, KHÔNG `innerHTML`: `data-tip` đi
 * qua tên dự án, tên skill, tên model — toàn chuỗi từ đĩa, và đây là chỗ duy nhất trong
 * app nhận chuỗi ngoài rồi vẽ ra DOM mà không qua `html` (hàm đó tự escape).
 */
function paintTip(tip, el) {
  const { head, rows, notes } = parseTip(el.dataset.tip);
  tip.textContent = '';
  tip.className = `tip ${el.dataset.tipTone ?? ''}`;

  if (head) {
    const h = document.createElement('div');
    h.className = 'tip-h';
    // Ô màu chỉ có ở chỗ màu MANG NGHĨA (mảnh quạt tròn) — nó là cây cầu duy nhất nối
    // mảnh với tên, nên tooltip phải mang nó theo, không thì vẫn phải dò sang chú giải.
    if (el.dataset.tipC) {
      const sw = document.createElement('i');
      sw.className = 'tip-sw';
      sw.style.background = el.dataset.tipC;
      h.append(sw);
    }
    h.append(document.createTextNode(head));
    tip.append(h);
  }

  if (rows.length) {
    const g = document.createElement('dl');
    g.className = 'tip-g';
    for (const r of rows) {
      const dt = document.createElement('dt');
      dt.textContent = r.k;
      const dd = document.createElement('dd');
      dd.textContent = r.v;
      if (r.tone) dd.className = r.tone;
      g.append(dt, dd);
    }
    tip.append(g);
  }

  for (const n of notes) {
    const p = document.createElement('p');
    p.className = 'tip-n';
    p.textContent = n;
    tip.append(p);
  }
}

/**
 * Neo tooltip vào đâu.
 *
 * Mặc định là khung của chính phần tử — đúng cho cột, thanh, ô treemap, chỗ nào khung
 * cũng chính là cái mốc đang trỏ. Nhưng mảnh quạt tròn thì khung của nó là CẢ hình
 * tròn (nó là một lớp phủ bị `clip-path` cắt), nên neo theo khung là đặt tooltip lên
 * giữa cái vành — che mất đúng thứ vừa rê vào. Những chỗ ấy khai `data-tip-at="pointer"`
 * và được neo theo con trỏ.
 */
function placeTip(tip, el, ev) {
  const r =
    el.dataset.tipAt === 'pointer' && ev
      ? { left: ev.clientX, width: 0, top: ev.clientY - 12, bottom: ev.clientY + 18 }
      : el.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const x = Math.max(8, Math.min(window.innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2));
  // Không đủ chỗ phía trên thì lật xuống dưới, đừng để tooltip trèo ra ngoài màn.
  const above = r.top - t.height - 8;
  tip.style.left = `${x}px`;
  tip.style.top = `${above > 8 ? above : r.bottom + 8}px`;
}

/** Phần tử đang được tooltip nói về — để `pointermove` biết khi nào chỉ cần dời chỗ. */
let tipFor = null;

function showTip(el, ev) {
  const tip = $('#tip');
  if (el !== tipFor) {
    paintTip(tip, el);
    tipFor = el;
  }
  tip.hidden = false;
  placeTip(tip, el, ev);
}

const hideTip = () => {
  tipFor = null;
  $('#tip').hidden = true;
};

/** Vẽ lại tooltip của một phần tử dù nó đang mở: `showTip` bỏ qua khi phần tử không đổi. */
function repaintTip(el) {
  tipFor = null;
  showTip(el);
}

/**
 * Backstop trả lại tooltip hướng dẫn khi con trỏ không bao giờ rời nút — bấm xong rồi
 * chuyển sang cửa sổ khác thì `pointerleave` không đến. Đủ dài để đọc hết hai dòng
 * hướng dẫn, đủ ngắn để lần rê vào sau không đọc được "đã chép" của mười phút trước.
 */
const REPORT_TIP_MS = 9000;

/**
 * Chép báo cáo cả màn, rồi TRẢ LỜI ngay tại nút.
 *
 * Vệt ✓ một mình không đủ ở đây. Mấy nút chép khác trong app chép một dòng lệnh — thấy
 * ✓ là biết trong clipboard có gì và làm gì với nó. Nút này chép mười hai nghìn ký tự
 * cho một mục đích mà chính nó phải nói ra, nên nó nói bằng cách ĐỔI tooltip đang mở:
 * chép được bao nhiêu, gồm mấy bảng, và bước tiếp theo là gì.
 *
 * Dùng lại đúng cái tooltip của nút chứ không dựng một hộp thông báo mới: con trỏ đang
 * ở trên nút, tooltip đang mở ở đó, và đó cũng là nơi vừa hiện hướng dẫn "bấm để chép".
 * Trả lời ở chỗ khác thì mắt phải đi tìm.
 */
async function copyReport(btn) {
  const text = renderReport({
    view: btn.dataset.report,
    at: clock(app.state?.generatedAt),
    blocks: scrapeView($('#view')),
  });
  const guide = btn.dataset.tip;
  const ok = await copy(text, btn);
  btn.dataset.tip = ok
    ? t('report.tipDone', {
        chars: text.length.toLocaleString(locale()),
        // Đếm vạch phân cách chứ không đếm khối `chart`: bảng là thứ người ta dán đi,
        // và chart chưa đủ dữ liệu thì không sinh bảng nào.
        tables: (text.match(/^\| --- /gm) ?? []).length,
      })
    : t('report.tipFail');
  repaintTip(btn);

  const restore = () => {
    btn.dataset.tip = guide;
    btn.removeEventListener('pointerleave', restore);
    btn.removeEventListener('focusout', restore);
    clearTimeout(timer);
  };
  const timer = setTimeout(restore, REPORT_TIP_MS);
  btn.addEventListener('pointerleave', restore);
  btn.addEventListener('focusout', restore);
}

/**
 * Mảnh quạt tròn ↔ dòng chú giải, sáng lên cùng nhau.
 *
 * Một cung tròn không mang chữ, nên đọc nó luôn là hai bước: nhớ màu → dò sang chú giải.
 * Nối hai đầu lại thì bước dò biến mất — rê vào mảnh nào thì dòng tên của nó sáng lên,
 * và ngược lại. Phải làm bằng JS vì hai bên nằm ở hai nhánh DOM khác nhau, không có bộ
 * chọn CSS nào bắc qua được.
 */
function hotDonut(el) {
  for (const m of document.querySelectorAll('.dn-w.hot, .dn-key.hot')) m.classList.remove('hot');
  const box = el?.closest('.ch-dn');
  if (!box) return;
  for (const m of box.querySelectorAll(`[data-dn="${el.dataset.dn}"]`)) m.classList.add('hot');
}

document.addEventListener('pointerover', (e) => {
  const m = e.target.closest('[data-tip]');
  if (m) showTip(m, e);
  else if (!e.target.closest('#tip')) hideTip();
  hotDonut(e.target.closest('[data-dn]'));
});
// Chỉ những tooltip neo theo con trỏ mới cần theo chuột — `showTip` thấy phần tử không
// đổi thì bỏ qua phần dựng lại nội dung, chỉ dời chỗ.
document.addEventListener('pointermove', (e) => {
  const m = e.target.closest('[data-tip][data-tip-at="pointer"]');
  if (m) showTip(m, e);
});
document.addEventListener('focusin', (e) => {
  const m = e.target.closest('[data-tip]');
  if (m) showTip(m);
  else hideTip();
  hotDonut(e.target.closest('[data-dn]'));
});
document.addEventListener('pointerleave', hideTip);
$('#scroll').addEventListener('scroll', hideTip, { passive: true });

/* ── Nền sáng / tối ─────────────────────────────────────────────────────────
   Cả hai nền dùng CHUNG một bộ tên biến (xem đầu `styles.css`), nên đổi nền chỉ
   là đổi một thuộc tính trên <html> — không có nhánh JS nào phải biết màu.

   Việc ĐẶT nền lần đầu nằm ở khối <script> chặn trong <head> của `index.html` —
   module này bị hoãn nên tới lượt nó thì trang đã vẽ xong một nhịp. Ở đây chỉ
   đồng bộ lại nhãn nút cho khớp thuộc tính đã đặt sẵn, và lo phần bấm/gõ `t`. */
const THEME_KEY = 'now-theme';

/* `--bg` của hai nền, lặp lại thành hằng JS vì `<meta name=theme-color>` chỉ nhận màu
   thật, không nhận `var(--bg)`. Cùng cặp giá trị này còn nằm trong khối script chặn ở
   `index.html` (nó phải chạy trước khi module này được nạp) — đổi nền thì sửa cả hai. */
const THEME_BG = { light: '#eef1f6', dark: '#0e1016' };

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Thanh tiêu đề cửa sổ web app trên Dock ăn theo màu này; trong tab trình duyệt
  // thường thì nó không có tác dụng gì, nên đây là dòng chỉ chế độ app mới thấy.
  $('meta[name=theme-color]').content = THEME_BG[theme] ?? THEME_BG.light;
  // Nhãn nút là nền SẮP chuyển sang, không phải nền đang xem — nút nói việc nó làm.
  $('#theme-t').textContent = theme === 'dark' ? t('theme.light') : t('theme.dark');
  $('#theme').title = theme === 'dark' ? t('theme.toLight') : t('theme.toDark');
  // Chế độ riêng tư chặn localStorage — mất chỗ nhớ thì thôi, đừng làm sập cả app.
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* không nhớ được thì lần sau mở lại về mặc định, không sao */
  }
}

function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

applyTheme(document.documentElement.getAttribute('data-theme') || 'light');

/* ── Ngôn ngữ (Việt / Anh) ──────────────────────────────────────────────────
   Toàn bộ chữ nằm ở `lib/i18n.js`; đổi ngôn ngữ chỉ là đổi một biến rồi vẽ lại —
   đúng cơ chế của nút đổi nền. Nút hiện MÃ ngôn ngữ đang bật (VI/EN). Phần tĩnh
   trong `index.html` do `applyStaticI18n` dịch, phần động do `render()` dịch. */
// Cờ hiện là cờ của ngôn ngữ ĐANG bật, khớp với mã ngay bên cạnh. Trên hệ không vẽ
// được emoji cờ (Windows) thì glyph tự lùi về hai chữ mã vùng — nên mã "VI/EN" vẫn giữ.
const LANG_FLAG = { vi: '🇻🇳', en: '🇬🇧' };
function refreshLang() {
  $('#lang-flag').textContent = LANG_FLAG[getLang()] ?? '';
  $('#lang-t').textContent = getLang().toUpperCase();
  $('#lang').title = t('lang.title', { next: LANG_LABEL[nextLang()] });
}

const toggleLang = () => setLang(nextLang());

/* ── Phong cách chart ───────────────────────────────────────────────────────
   Cùng cơ chế với nền và ngôn ngữ: đổi một biến rồi vẽ lại. Nhưng KHÁC ở một chỗ quan
   trọng — nút không nằm trên thanh công cụ chung, mà nằm ngay trên đầu chart, vì nó chỉ
   đổi được hình của chart (xem `skinSwitch()` trong `lib/chart.js`). Ở đây còn đúng ba
   thứ: phím tắt, chỗ nhận cú bấm ủy quyền, và lệnh vẽ lại.

   Luật "hình nào hợp với kiểu dữ liệu nào" nằm trọn trong `lib/skin.js`. */
const toggleSkin = () => setSkin(nextSkin());

onSkinChange(render);

// Tab của màn Token — cùng cơ chế, cùng lý do: trạng thái sống ngoài DOM (`lib/tabs.js`)
// nên lượt vẽ lại 30 giây một lần không kéo nó về tấm đầu.
onTabChange(render);

// Đổi ngôn ngữ thì dịch lại tất cả: phần tĩnh, nhãn nút nền + nút ngôn ngữ, dòng
// trạng thái kết nối (do state event mới cập nhật, nên phải chủ động gọi), và toàn
// trang động qua `render()`.
onLangChange(() => {
  applyStaticI18n();
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
  refreshLang();
  setPulse(online);
  render();
});

// Dịch phần tĩnh + nhãn nút ngôn ngữ ngay lúc nạp, trước lượt vẽ đầu — nếu ngôn ngữ
// đã lưu là tiếng Anh thì tránh loé một nhịp tiếng Việt.
applyStaticI18n();
refreshLang();

$('#theme').addEventListener('click', toggleTheme);
$('#lang').addEventListener('click', toggleLang);
$('#scrim').addEventListener('click', closeDrawer);
$('#dclose').addEventListener('click', closeDrawer);
$('#pulse').addEventListener('click', forceRefresh);
$('#offretry').addEventListener('click', () => {
  connect();
  forceRefresh();
});
bindSpinPause();
$('#helpopen').addEventListener('click', () => toggleHelp(true));
$('#helpclose').addEventListener('click', () => toggleHelp(false));
$('#help').addEventListener('click', (e) => {
  if (e.target === $('#help')) toggleHelp(false);
});

// Gõ một phím là vẽ lại cả trang — kể cả thanh điều hướng và khối quản gia, hai thứ
// không phụ thuộc ô tìm. Chờ 120ms: đủ ngắn để vẫn thấy tức thì, đủ dài để một từ gõ
// nhanh chỉ tốn một lượt vẽ thay vì bảy.
let queryTimer = null;
$('#q').addEventListener('input', (e) => {
  const v = e.target.value.trim().toLowerCase();
  clearTimeout(queryTimer);
  queryTimer = setTimeout(() => {
    if (v === app.query) return;
    app.query = v;
    render();
  }, 120);
});

document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
  if (e.key === 'Escape') {
    if (helpOpen()) return toggleHelp(false);
    if ($('#drawer').classList.contains('open')) return closeDrawer();
    // Xoá bộ lọc kể cả khi con trỏ KHÔNG còn ở trong ô tìm. Gõ xong rồi bấm ra
    // ngoài để đọc là chuyện thường, và lúc đó Escape không còn xoá được gì:
    // bộ lọc theo sang mọi màn khác, mỗi màn hiện một phần dữ liệu, mà lý do thì
    // nằm ở một ô tìm tận góc trên bên phải.
    if (typing) e.target.blur();
    if (typing || app.query) {
      // Huỷ lượt debounce đang chờ, nếu không nó nổ sau đó và dựng lại đúng cái bộ lọc
      // vừa bị xoá.
      clearTimeout(queryTimer);
      app.query = '';
      $('#q').value = '';
      render();
    }
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

  // ← → ĐI GIỮA CÁC TAB — nhưng chỉ khi con trỏ bàn phím đang đứng trên một nút tab, đúng
  // khuôn ARIA. Đứng trước nhánh ngăn kéo vì nó hẹp hơn hẳn: nó đòi focus ở đúng một chỗ,
  // còn nhánh kia chỉ đòi ngăn kéo mở.
  //
  // Focus phải được dời TAY sang nút mới. `tabKey` đổi trạng thái xong là `onTabChange`
  // vẽ lại ngay trong cùng lượt, và `keepUI` chụp được `activeElement` lúc đó vẫn là nút
  // CŨ — nên nó trung thành trả focus về một nút giờ đã `tabindex="-1"` và không còn được
  // chọn. Với tab thì focus phải đi theo lựa chọn, không thì `Tab` kế tiếp bắt đầu từ chỗ
  // không ai đang đứng.
  if (e.target.dataset?.tab) {
    const next = tabKey(e.target, e.key);
    if (next) {
      e.preventDefault();
      $(`#view [data-tab="${CSS.escape(next)}"]`)?.focus({ preventScroll: true });
      return;
    }
  }

  // ← → lật dự án — chỉ khi ngăn kéo đang mở, để không cướp mất phím cuộn ngang.
  if (drawerId && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    return stepProject(e.key === 'ArrowRight' ? 1 : -1);
  }

  if (e.key === '?') {
    e.preventDefault();
    return toggleHelp();
  }
  if (e.key === '/') {
    e.preventDefault();
    return $('#q').focus();
  }
  if (e.key === 'r') {
    e.preventDefault();
    return forceRefresh();
  }
  if (e.key === 't') {
    e.preventDefault();
    return toggleTheme();
  }
  if (e.key === 'l') {
    e.preventDefault();
    return toggleLang();
  }
  if (e.key === 's') {
    e.preventDefault();
    return toggleSkin();
  }
  // `c` — việc làm nhiều nhất mỗi sáng: chép đúng câu quản gia vừa bảo, rồi dán
  // thẳng vào Claude. Không có phím này thì thao tác mở đầu ngày nào cũng phải
  // rời bàn phím đi tìm chuột.
  //
  // Quản gia có hai ô nên có thể có hai nút; phím này lấy nút ĐẦU, tức nút của ô việc.
  // Đó vẫn là "câu quản gia vừa bảo" theo đúng nghĩa cũ — ô hai là hạn mức, và `/model
  // sonnet` không phải thứ người ta với tay tìm phím tắt để chép.
  if (e.key === 'c') {
    const btn = $('#bslots .go');
    if (btn) {
      e.preventDefault();
      btn.click();
    }
    return;
  }
  if (e.key === 'o') {
    const first = app.state?.projects[0];
    if (first) {
      e.preventDefault();
      openProject(first.id);
    }
    return;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= ORDER.length) {
    // Đổi màn trong lúc ngăn kéo còn mở thì màn mới vẽ ra sau lưng một tấm nền mờ
    // và người bấm tưởng phím không ăn. Đóng trước rồi mới đi — bấm số là "tôi
    // muốn sang màn kia", không phải "tôi muốn ở lại đây".
    closeDrawer();
    go(ORDER[n - 1]);
  }
});

window.addEventListener('hashchange', () => {
  const v = viewFromHash();
  if (VIEWS[v] && v !== app.view) go(v);
});

// Vặn một núm ở bàn chỉnh thì phải vẽ lại. `views/bench.js` không được tự gọi `render()`
// ở đây — nó còn chạy cả trong trang lẻ `/menubar-demo.html`, nơi không có `app.js` nào
// cả. Nên chỗ CHỦ đưa cách vẽ của mình vào, và bàn chỉnh không biết mình đang ở nhà ai.
initBench(render);

connect();
render();
