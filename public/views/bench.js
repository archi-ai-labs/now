/**
 * Bàn chỉnh popover — vẽ bằng ĐÚNG `popoverView` mà app thanh menu đang gọi.
 *
 * Không có một dòng nào ở đây vẽ lại giao diện popover. File này chỉ dựng bộ công tắc,
 * gọi hàm thật, rồi ĐO cái vừa vẽ ra. Đo là phần quan trọng nhất: mọi câu hỏi đang mở
 * ("cắt mất chưa", "thanh rộng bao nhiêu") đều là câu hỏi về số đo, mà popover thật thì
 * không chụp được từ terminal.
 *
 * HAI LOẠI công tắc, và chúng chốt vào hai file khác nhau:
 *   - bố cục   → tham số của `popoverView`, chép vào `DEFAULTS` ở lib/menubar-view.js
 *   - ánh sáng → biến CSS đặt lên `.mb-wrap`, chép vào khối `.mb-wrap` ở styles.css
 * Loại thứ hai có vì ánh sáng là thứ chỉnh bằng MẮT, không bằng lý lẽ: một vệt nắng đậm
 * 20% hay 30% thì không suy ra được, phải vặn thử rồi nhìn.
 *
 * ## Một bàn chỉnh, hai chỗ mở
 *
 * Nó là một màn trong nav dashboard (`#bench`), và cũng là trang lẻ `/menubar-demo.html`.
 * Cả hai gọi đúng `renderBench` này — không có bản thứ hai để lệch. Trang lẻ còn sống vì
 * nó không có thanh rail và ô tìm kiếm ở cạnh, tức là chỗ duy nhất xem được popover mà
 * không có gì khác trong tầm mắt; còn màn trong nav là chỗ TÌM RA nó, thứ trước đây
 * không có — bàn chỉnh nằm ở một URL không ai trỏ tới thì coi như không tồn tại.
 *
 * ## Vì sao chữ ở đây không đi qua i18n
 *
 * Mấy nhãn công tắc dưới đây là tiếng Việt trần, cố ý. Chúng gọi tên những thứ chỉ có
 * nghĩa với người đang SỬA repo này ("chép dòng này đè lên DEFAULTS"), nên chúng bám
 * theo mã nguồn chứ không bám theo người đọc dashboard. Nhét chúng vào `i18n.js` là bắt
 * bộ thuật ngữ sản phẩm gánh thêm ba chục chuỗi của một cái tuốc-nơ-vít. Chỉ tên màn
 * (`nav.bench` / `title.bench`) đi qua i18n, vì nó nằm trên thanh rail cạnh bảy màn kia.
 */
import { html } from '../lib/dom.js';
import { popoverView, DEFAULTS } from '../lib/menubar-view.js';

/**
 * Ánh sáng ĐANG CHỐT trong `.mb-wrap` ở styles.css. Chép lại đây vì bàn chỉnh cần biết
 * mình đang lệch khỏi bản thật ở đâu — đổi số bên kia thì đổi cả bên này.
 *
 * `theme` KHÔNG nằm trong `DEFAULTS` và không được in ra dòng chép: popover thật lấy nền
 * theo appearance của macOS, không có công tắc nào cả. Đây thuần là kính lúp của bàn
 * chỉnh — để xem một bảng màu ở cả hai nền mà không phải đi đổi cài đặt máy.
 */
const LIGHT0 = { washK: '1.4', washA: '30/22', gloss: '1', glossCut: '51%' };

/**
 * Bản thật đang là gì — dùng để đánh dấu "đã chốt" lên đúng một lựa chọn mỗi núm.
 *
 * Cái dấu này TÍNH RA, không viết tay vào nhãn. Trước đây mấy nhãn tự ghi "— như hiện
 * tại", và chốt một trị mới là cái chữ ấy nói dối cho tới khi có người nhớ ra phải sửa
 * nhãn — mà bàn chỉnh nói dối về bản thật thì nó thôi là bàn chỉnh.
 */
const BASE = { ...DEFAULTS, ...LIGHT0 };
const opts = { ...BASE, theme: 'auto', phase: 'auto' };

/**
 * Trần chiều cao popover trên máy này — cùng phép tính với `maxPopoverHeight()` trong
 * Swift: chiều cao màn hình trừ thanh menu và một khoảng thở. Vượt qua nó thì macOS cắt,
 * không cuộn, nên đây là con số duy nhất biến "cao quá" thành một câu trả lời được.
 */
const roof = () => Math.round(screen.availHeight - 24);

/**
 * `chips: true` xếp các lựa chọn thành một hàng ngang thay vì mấy hàng dọc.
 *
 * Không phải để cho đẹp: bảng này đã có mười một núm, mà bàn chỉnh chỉ dùng được khi thứ
 * đang vặn và thứ nó làm đổi cùng nằm trong một màn hình. Núm nào có nhãn là một MỨC
 * ("rộng", "đậm", "1.4") thì mức ấy tự nói hết nghĩa và không cần cả hàng; núm nào nhãn
 * là một câu giải thích thì vẫn xếp dọc.
 */
const CONTROLS = [
  {
    group: 'Bố cục',
    key: 'tab',
    label: 'Tab đang xem',
    opts: [
      ['work', 'Việc'],
      ['token', 'Token · 3 công cụ'],
    ],
  },
  {
    key: 'tall',
    label: 'Thanh hạn mức',
    opts: [
      [true, 'dày 20px (nhãn nằm trong thân)'],
      [false, 'mảnh 7px (nhãn bám quanh sợi chỉ)'],
    ],
  },
  {
    key: 'inline',
    label: 'Nhãn cửa sổ',
    opts: [
      [false, 'trên một hàng riêng — thanh dài hết bề ngang'],
      [true, 'cùng hàng với thanh — thấp hơn, thanh ngắn lại'],
    ],
  },
  {
    key: 'hero',
    label: 'Khung cảnh + quản gia',
    opts: [
      [true, 'có — ngủ gật khi đang bỏ phí, mở mắt khi bám đích'],
      [false, 'không — tiết kiệm ~90px'],
    ],
  },
  {
    key: 'est',
    label: 'Nhãn dự phóng đứng đâu',
    opts: [
      ['mid', 'giữa mảng gạch'],
      ['end', 'sát mép phải mảng gạch — mũi tên chỉ đúng mốc nó ghi'],
      ['below', 'một dòng dưới thanh, căn phải — tốn lại 15px mỗi cửa sổ'],
      ['tail', 'mép phải cả thanh — nhãn bỏ phí phải rút còn số'],
    ],
  },
  {
    key: 'width',
    label: 'Bề rộng popover',
    chips: true,
    opts: [
      [360, '360pt'],
      [400, '400pt'],
      [440, '440pt'],
    ],
  },
  {
    group: 'Ánh sáng',
    key: 'phase',
    label: 'Buổi (bản thật lấy theo giờ máy)',
    chips: true,
    opts: [
      ['auto', 'theo máy'],
      ['dawn', 'sáng sớm'],
      ['day', 'ban ngày'],
      ['dusk', 'chiều muộn'],
      ['night', 'đêm · trăng'],
    ],
  },
  {
    key: 'washK',
    label: 'Vệt nắng nền · kích thước',
    chips: true,
    opts: [
      ['0.7', 'hẹp'],
      ['1', 'vừa'],
      ['1.4', 'rộng'],
      ['1.9', 'tràn cả nền'],
    ],
  },
  {
    // Một núm cho CẢ HAI vệt — nắng trên-trái và tím dưới-phải. Chúng là hai đầu của
    // cùng một khối nền, mà vặn lệch nhau thì cái nền thôi là một mặt phẳng có nắng và
    // thành hai vệt màu không liên quan. Trị ghi "nắng/tím", đơn vị %.
    key: 'washA',
    label: 'Vệt nắng nền · độ đậm',
    chips: true,
    opts: [
      ['0/0', 'tắt'],
      ['12/9', 'nhạt'],
      ['20/15', 'vừa'],
      ['30/22', 'đậm'],
      ['42/30', 'rất đậm'],
    ],
  },
  {
    key: 'gloss',
    label: 'Loá dọc bề dày thanh · độ mạnh',
    chips: true,
    opts: [
      ['0', 'tắt — thanh phẳng'],
      ['0.55', 'nhẹ'],
      ['1', 'vừa'],
      ['1.6', 'mạnh'],
    ],
  },
  {
    // Mép cắt càng cao thì mặt hứng sáng càng mỏng và thanh càng đọc ra "ống tròn"; càng
    // thấp thì nó đọc ra "mặt phẳng nghiêng". Đây là núm quyết định thanh trông như VẬT
    // gì, không phải núm chỉnh độ sáng.
    key: 'glossCut',
    label: 'Loá dọc bề dày thanh · mép cắt',
    chips: true,
    opts: [
      ['38%', '38% — cao'],
      ['51%', '51% — vừa'],
      ['64%', '64% — thấp'],
    ],
  },
  {
    group: 'Chỉ ở bàn chỉnh',
    key: 'theme',
    label: 'Nền (bản thật đi theo macOS)',
    chips: true,
    opts: [
      ['auto', 'theo máy'],
      ['dark', 'tối'],
      ['light', 'sáng'],
    ],
  },
];

/** Mấy núm ánh sáng → đúng bộ biến CSS sẽ đặt lên `.mb-wrap`. Một chỗ duy nhất, để cái
 *  đang hiện và cái được in ra không bao giờ lệch nhau. */
function lightTokens() {
  const [sun, skin] = String(opts.washA).split('/');
  return {
    '--wash-k': String(opts.washK),
    '--wash-sun': `${sun}%`,
    '--wash-skin': `${skin}%`,
    '--gloss': String(opts.gloss),
    '--gloss-cut': opts.glossCut,
  };
}

const cssText = (tok) =>
  Object.entries(tok)
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n');

/**
 * Biến ánh sáng đi qua một khối style CHÈN THEO, không qua `el.style.setProperty` sau
 * khi vẽ.
 *
 * Vì hai lẽ. Một: `.mb-wrap` tự khai mặc định của nó trong styles.css, mà một trị khai
 * tại chỗ luôn thắng trị thừa kế từ cha — nên phải nhắm đúng `.mb-wrap`, và
 * `.mbd-stage .mb-wrap` đủ nặng hơn để làm việc đó. Hai: màn này sống trong dashboard,
 * nơi trang tự vẽ lại 30 giây một lần — thứ gì viết vào DOM SAU lượt vẽ thì cứ 30 giây
 * lại bay mất một lần, còn thứ nằm trong chính chuỗi được vẽ thì không.
 */
const stageStyle = (tok) => html`<style>.mbd-stage .mb-wrap { ${cssText(tok)} }</style>`;

function panel() {
  return html`${CONTROLS.map(
    (c) => html`${c.group ? html`<h2>${c.group}</h2>` : ''}
      <div class="mbd-ctl">
        <div class="mbd-k">${c.label}</div>
        <div class="${c.chips ? 'mbd-chips' : ''}">
          ${c.opts.map(
            ([v, lab]) => html`<label class="mbd-opt ${opts[c.key] === v ? 'on' : ''}">
              <!-- Thẻ html ở đây là phép nối chuỗi, không phải lit-html: không có ràng buộc
                   thuộc tính kiểu dấu hỏi, nên trạng thái phải viết thẳng ra chữ. -->
              <input type="radio" name="mbd-${c.key}" value="${String(v)}" ${opts[c.key] === v ? 'checked' : ''} />
              <span>${lab}</span>
              <!-- Hai dấu KHÁC NHAU và cùng phải có mặt: viền accent nói "đang xem cái
                   này", cái dấu dưới đây nói "bản thật đang là cái này". Chúng trùng nhau
                   lúc mới mở trang rồi tách ra ngay khi vặn núm đầu tiên — mà chính lúc
                   tách ra mới là lúc cần biết mình đang lệch khỏi đâu. -->
              ${BASE[c.key] === v ? html`<i class="mbd-now">đã chốt</i>` : ''}
            </label>`,
          )}
        </div>
      </div>`,
  )}`;
}

/**
 * Đo cái vừa vẽ: cỡ popover, bề rộng thân thanh, và có vượt trần màn hình không.
 *
 * Chạy ở nhịp vẽ SAU, vì `renderBench` chỉ trả về chuỗi — lúc nó chạy thì chưa có phần
 * tử nào để đo. Một `requestAnimationFrame` là đủ: chỗ gọi `mount` ngay sau khi hàm trả
 * về, nên tới khung hình kế tiếp thì DOM đã có và đã bố cục xong.
 */
function measureSoon() {
  requestAnimationFrame(() => {
    const wrap = document.querySelector('.mbd-stage .mb-wrap');
    const slot = document.getElementById('mbd-meas');
    if (!wrap || !slot) return;
    const box = wrap.getBoundingClientRect();
    const track = wrap.querySelector('.qb-track');
    const tw = track ? Math.round(track.getBoundingClientRect().width) : 0;
    const th = track ? Math.round(track.getBoundingClientRect().height) : 0;
    const over = Math.round(box.height) - roof();
    const verdict = over > 0 ? `VƯỢT ${over}pt — macOS sẽ cắt` : `còn dư ${-over}pt`;
    slot.innerHTML =
      `<b>${Math.round(box.width)}×${Math.round(box.height)}pt</b>` +
      ` · thân thanh ${tw}×${th}px · trần màn này ${roof()}pt ` +
      `<span class="${over > 0 ? 'mbd-bad' : 'mbd-ok'}">${verdict}</span>`;
  });
}

/** Nền của SÂN KHẤU, không phải của cả trang: đổi nền để so bảng màu thì cái panel đang
 *  đọc dở không có lý do gì phải nhảy theo. `.theme-light` / `.theme-dark` là hai lớp
 *  styles.css để sẵn cho đúng việc xem trước từng khối này. */
function stageTheme() {
  if (opts.theme === 'dark') return 'theme-dark';
  if (opts.theme === 'light') return 'theme-light';
  return '';
}

/**
 * Bật bàn chỉnh: nhận cách vẽ lại của chỗ chủ, rồi gắn hai cái nghe.
 *
 * Là một HÀM chứ không phải mấy dòng chạy lúc nạp module, vì `test/modules.test.js` nạp
 * mọi file dưới `views/` trong Node để bắt lỗi cú pháp và import gãy — mà ở đó không có
 * `document` nào cả. Một view đụng DOM ngay lúc nạp là một view làm hỏng chính cái lưới
 * an toàn đang canh nó.
 *
 * Gọi bao nhiêu lần cũng được: cờ `wired` chặn lượt gắn thứ hai, nên chỗ chủ không phải
 * tự nhớ đã gọi hay chưa.
 */
let redraw = () => {};
let wired = false;

export function initBench(onChange) {
  redraw = onChange;
  if (wired) return;
  wired = true;
  document.addEventListener('change', onKnob);
  document.addEventListener('click', onTab);
}

export function renderBench(s) {
  const tok = lightTokens();
  const line = `export const DEFAULTS = { tab: '${opts.tab}', tall: ${opts.tall}, inline: ${opts.inline}, width: ${opts.width}, hero: ${opts.hero}, est: '${opts.est}' };`;
  measureSoon();
  return html`<div class="mbd">
    ${stageStyle(tok)}
    <div class="mbd-stage ${stageTheme()}">
      <!-- Dải giả lập thanh menu: popover thật luôn treo dưới một dải tối/sáng cỡ này,
           và mấy quyết định về tương phản chỉ đúng khi nhìn cùng cái nền ấy. -->
      <div class="mbd-bar"><span class="mbd-item">CLAUDE<br /><b>6%·37%</b></span></div>
      <div class="mbd-pop" style="width:${opts.width}px">${popoverView(s, opts)}</div>
      <div class="mbd-meas" id="mbd-meas">—</div>
    </div>

    <div class="mbd-panel">
      <p class="mbd-note">Bên trái là <b>đúng mã đang chạy</b> trong app thanh menu, không phải bản dựng lại.</p>
      ${panel()}
      <h2>Chốt bố cục</h2>
      <p class="mbd-note">Chép dòng này đè lên <code>DEFAULTS</code> ở đầu <code>public/lib/menubar-view.js</code>:</p>
      <pre class="mbd-code">${line}</pre>
      <h2>Chốt ánh sáng</h2>
      <p class="mbd-note">Chép mấy dòng này vào khối <code>.mb-wrap</code> trong <code>public/styles.css</code>:</p>
      <pre class="mbd-code">${cssText(tok)}</pre>
    </div>
  </div>`;
}

/**
 * Nghe ở GỐC cho cả bảng công tắc lẫn cái tab bên trong popover: cả hai đều bị vẽ lại
 * sau mỗi lần đổi, nên nút gắn tay sẽ mất ngay sau đó.
 *
 * Cả hai đều PHẢI soi `closest('.mbd')` trước. Bàn chỉnh giờ sống chung nhà với dashboard,
 * mà dashboard có `[data-tab]` của riêng nó (xem `lib/tabs.js`) — một cái nghe ở gốc
 * không soi phạm vi sẽ cướp mọi cú bấm tab trên bảy màn kia. Cùng lý do, tên nhóm radio
 * mang tiền tố `mbd-`.
 *
 * Trị lấy từ CHÍNH bảng khai báo chứ không đoán kiểu từ chuỗi. Bản trước đoán bằng
 * `/^\d+$/` → Number, nên '0.7' ở lại là chuỗi còn '1' thành số, và phép so `=== v` để
 * tô nút đang chọn hụt đúng ở mấy núm mới.
 */
function onKnob(e) {
  const el = e.target;
  if (el.type !== 'radio' || !el.closest('.mbd')) return;
  const c = CONTROLS.find((x) => `mbd-${x.key}` === el.name);
  const hit = c?.opts.find(([v]) => String(v) === el.value);
  if (!hit) return;
  opts[c.key] = hit[0];
  redraw();
}

function onTab(e) {
  const btn = e.target.closest('.mbd-pop [data-tab]');
  if (!btn) return;
  opts.tab = btn.dataset.tab;
  redraw();
}
