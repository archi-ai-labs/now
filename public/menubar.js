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
let tab = readTab();

function render() {
  mount(root, popoverView(state, { tab }));
  reportSize();
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
