/**
 * Popover của app trên thanh menu — cửa vào, không phải chỗ vẽ.
 *
 * Việc vẽ nằm ở `lib/menubar-view.js` để trang demo (`menubar-demo.html`) gọi được ĐÚNG
 * hàm đó với mấy công tắc khác nhau. Chỉnh bố cục ở đây là chỉnh mù — popover không chụp
 * được từ terminal — nên một bản dựng lại "gần giống" để ngắm là bản sẽ lệch khỏi bản
 * chạy thật.
 *
 * File này chỉ còn ba việc: lấy dữ liệu, đổi tab, và khai chiều cao cho app Swift.
 */
import { mount } from './lib/dom.js';
import { popoverView, errorView, TABS, DEFAULTS } from './lib/menubar-view.js';
import { loadPet as cachedPet, savePet } from './lib/petcache.js';
import { livePet } from './lib/petmath.js';

const root = document.getElementById('mb');
const TAB_KEY = 'now-mb-tab';

/**
 * Tab đang mở, nhớ qua `localStorage`.
 *
 * WKWebView trong app có kho riêng, không chung với Safari — chỗ này là một trong hai
 * lần cái kho riêng ấy có lợi (lần kia là theme, xem `menubar.html`). Popover tải lại
 * mỗi lần mở, nên không nhớ thì lần nào cũng bật về tab Việc, kể cả với người mở nó
 * chín lần một ngày chỉ để xem hạn mức.
 */
function readTab() {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (TABS.includes(v)) return v;
  } catch {
    /* chế độ riêng tư chặn localStorage — dùng mặc định */
  }
  return DEFAULTS.tab;
}

let state = null;
/**
 * Sổ khởi đầu từ BẢN NHỚ, không từ `null`.
 *
 * Cửa sổ này tải lại mỗi lần mở, nên trước đây nhịp vẽ đầu tiên luôn không có con vật:
 * bức tranh hiện ra trống chỗ rồi mấy cái thanh nhảy vào sau. Bản nhớ giữ mốc gốc và tính
 * lại theo đồng hồ (xem `lib/petcache.js`), nên nó không phải một cái ảnh chụp cũ — thứ
 * lượt hỏi thật đem về chủ yếu là con số ví.
 *
 * `null` khi chưa từng mở, khác ngày, hay `localStorage` bị chặn — và cả ba ca ấy rơi về
 * đúng hành vi cũ, không rơi vào một nhánh mới nào.
 */
let pet = cachedPet();
let tab = readTab();
/**
 * Phần xu vừa vào ví kể từ lần mở trước — số để NẢY, không phải số để bày.
 *
 * Popover chỉ hỏi sổ đúng một lần mỗi lần mở, nên trong một phiên nó không có nhịp nào để
 * đếm lên. Cái nhảy duy nhất có thật là chỗ này: bản nhớ vẽ ra con số của lần mở trước, rồi
 * lượt mạng đè lên bằng con số bây giờ. Hiệu hai số ấy đúng bằng số token đã tiêu từ lần
 * liếc trước — nên nó đáng được nhìn thấy chứ không đáng bị thay lặng lẽ.
 *
 * `painted` là điều kiện để cái nảy không nói dối: lượt mạng có thể về TRƯỚC cả lượt vẽ đầu
 * (hai `fetch` chạy song song), và lúc ấy con số cũ chưa từng lên màn hình — diễn lại một
 * thay đổi không ai thấy thì cái nảy là trang trí, không phải thông tin.
 */
let bump = 0;
let painted = false;

function render() {
  // Vặn sổ về đúng giây đang vẽ, y như cửa hàng — xem `livePet`. Ở đây nó còn cần hơn: màn
  // này chỉ hỏi sổ MỘT lần lúc mở, rồi vẽ lại theo nhịp SSE của dashboard. Không vặn thì
  // một popover mở sẵn nửa tiếng đang bày độ no của nửa tiếng trước.
  mount(root, popoverView(state, { tab, pet: livePet(pet), bump }));
  // Tiêu ngay sau một lượt vẽ. Cái nảy là hoạt hình CSS chạy trên một thẻ vừa dựng, nên nó
  // tự diễn đúng một lần; không xoá thì mỗi lần đổi tab lại dựng thẻ mới và nó diễn lại một
  // khoản tiền đã cũ.
  bump = 0;
  painted = true;
  reportSize();
}

/**
 * Sổ quản gia — lượt hỏi RIÊNG, chạy song song với lượt hỏi trạng thái.
 *
 * Không đi nhờ `/api/state` vì bản ấy có cache 30 giây: mua xong quay lại popover mà ví
 * vẫn hiện số cũ thì cú bấm trông như trượt. Và không `await` chung với nó: sổ hỏng hay
 * server bản cũ không có endpoint này thì popover vẫn phải vẽ đủ mọi thứ còn lại —
 * `pet` để `null` là khung cảnh y như trước khi có trò chơi.
 */
async function loadPet() {
  try {
    const res = await fetch('/api/pet');
    if (!res.ok) return;
    const fresh = (await res.json()).pet ?? null;
    // Bản cũ trên màn hình còn hơn không có gì: server bản cũ không có endpoint này, hay
    // sổ hỏng, thì giữ nguyên thứ bản nhớ vừa vẽ ra thay vì xoá nó đi.
    if (!fresh) return;
    // Hiệu số tính TRƯỚC khi thay `pet`, và chỉ khi bản cũ đã lên màn hình. Xem `bump`.
    // `>= 0.005` chứ không `> 0`: hai số đã cắt hai chữ số lẻ ở server, nên hiệu thật luôn
    // là bội của 0,01 — thứ nhỏ hơn thế chỉ là rác dấu phẩy động, và nó sẽ nảy ra một dòng
    // "+0.00" cho một khoản tiền không tồn tại.
    if (painted && pet && fresh.coins - pet.coins >= 0.005) bump = fresh.coins - pet.coins;
    pet = fresh;
    savePet(fresh);
    if (state) render();
  } catch {
    /* không có sổ thì thôi — khung cảnh không phụ thuộc vào nó */
  }
}

/**
 * Khai kích thước cho app Swift — trang ĐẨY, app không hỏi.
 *
 * App từng hỏi trong `didFinish` và luôn nhận về đúng một con số. `didFinish` báo
 * document tải xong, nhưng file này là module và lúc ấy nó còn đang `await fetch` —
 * trong `#mb` mới chỉ có màn chờ, `.mb-wrap` chưa tồn tại, nên câu truy vấn rơi vào
 * nhánh mặc định 320. Popover vì thế cao đúng 320pt bất kể trong nó có gì, và mọi thứ
 * dưới mốc đó bị cắt cụt — kể cả hai cái nút ở đáy.
 *
 * Gửi cả bề rộng: bề rộng popover là một quyết định bố cục, và bố cục thì sống ở CSS
 * chứ không phải ở một hằng số trong file Swift mà mỗi lần đổi là một lần dựng lại app.
 *
 * `?.` cả chuỗi: mở trang này trong trình duyệt thường thì không có `webkit`, và ở đó
 * nó phải là một hàm không làm gì.
 */
function reportSize() {
  const el = root.querySelector('.mb-wrap');
  if (!el) return;
  const box = el.getBoundingClientRect();
  window.webkit?.messageHandlers?.size?.postMessage({ w: Math.ceil(box.width), h: Math.ceil(box.height) });
}

// `ResizeObserver` chứ không phải gọi một lần sau `mount`: chiều cao còn đổi SAU nhịp vẽ
// đầu (font hệ thống hoán chỗ, câu quản gia xuống dòng khác đi), và một con số đo sớm hơn
// layout cuối cùng thì sai đúng theo chiều cắt mất chữ.
new ResizeObserver(reportSize).observe(root);

// Uỷ quyền ở gốc: mỗi lần đổi tab là một lần vẽ lại, nên nút gắn tay sẽ mất ngay sau đó.
root.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn || !state) return;
  tab = btn.dataset.tab;
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    /* không nhớ được thì lần sau về mặc định, không sao */
  }
  render();
});

/**
 * Hai lượt hỏi: bản trong tay để vẽ NGAY, rồi bản vừa dựng xong để đè lên.
 *
 * Lượt đầu không bắt server dựng lại nên nó về trong vài mili giây. Trước đây chỉ có
 * một lượt và lượt ấy chờ trọn một `buildState` — 325–1614 ms đo được — nên "đang đọc…"
 * hiện ra ở mọi lần bấm, đủ lâu để đọc hết.
 *
 * Lượt hai chỉ đi khi server nói nó đang dựng dở (`x-now-building`). Hỏng thì im lặng
 * bỏ qua: trên màn hình đang là bản cũ vài chục giây tuổi, mà bản cũ vẫn hơn hẳn một
 * khối báo lỗi thay chỗ cho thứ người ta vừa đọc được.
 */
async function load() {
  let res;
  try {
    res = await fetch('/api/state');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state = await res.json();
    render();
  } catch (err) {
    // Popover không có chỗ cho một stack trace, nhưng "không hiện gì" là trạng thái tệ
    // nhất: người dùng không phân biệt được server chết với hạn mức bằng không.
    mount(root, errorView(err.message));
    reportSize();
    return;
  }

  if (res.headers.get('x-now-building') !== '1') return;
  try {
    const fresh = await fetch('/api/state?wait=1');
    if (!fresh.ok) return;
    state = await fresh.json();
    render();
  } catch {
    /* bản cũ vẫn đang trên màn hình — để yên */
  }
}

load();
loadPet();
