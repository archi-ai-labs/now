/**
 * Tabs — chia một màn quá dài thành mấy tấm, mỗi lượt chỉ vẽ một tấm.
 *
 * ## Vì sao lại cần đến nó ở đúng màn Token
 *
 * Màn Token gộp cả màn Công cụ vào, nên nó phải kể chuyện của BA nguồn dữ liệu rời nhau:
 * Claude Code (transcript trên đĩa + hạn mức từ API), Cursor (một RPC nội bộ), Antigravity
 * (máy chủ nội bộ của app). Nối đuôi cả ba thành một cuộn dọc thì phần dưới cùng không bao
 * giờ được ai đọc, và tệ hơn: ba khối đứng liền nhau trông như ba mục của một câu chuyện,
 * trong khi số của chúng **không so với nhau được** (phần trăm hạn mức, đô thật, phần trăm
 * của hai hồ tách rời). Tab là chỗ nói ra điều đó bằng bố cục — mỗi lần chỉ một đơn vị đo
 * trên màn, nên không có cách nào vô tình đặt hai con số khác đơn vị cạnh nhau.
 *
 * Thứ KHÔNG vào tab: khối hạn mức của cả ba, vì đó là câu hỏi gấp nhất ("tôi sắp bị chặn
 * chưa") và nó phải trả lời được mà không cần bấm gì.
 *
 * ## Trạng thái sống ở đâu
 *
 * Trang tự vẽ lại 30 giây một lần (`keepUI` trong `app.js`). Giữ tab đang mở trong DOM thì
 * mỗi lượt quét là nó nhảy về tab đầu — nên nó sống ở module này, và nhớ qua cả lần mở
 * sau bằng `localStorage`, đúng khuôn của `lib/skin.js`. Cùng lý do, cùng cách.
 *
 * Nhóm (`group`) để nhiều khối tab cùng tồn tại mà không giẫm nhau; hiện chỉ có một, nhưng
 * một `Map` theo nhóm rẻ hơn hẳn việc sau này phải đi tách một biến đơn ra.
 *
 * ## Bàn phím
 *
 * Theo đúng khuôn ARIA cho tab: chỉ tab đang mở nằm trong vòng `Tab` (`tabindex="0"`, các
 * tab kia `-1`), còn `←`/`→` mới là thứ đi giữa các tab. Làm ngược lại — mọi tab đều
 * `Tab` tới được — thì người dùng bàn phím phải bấm qua cả dãy nút mới xuống được nội
 * dung, mà nội dung mới là thứ họ đang đi tới.
 */

import { html } from './dom.js';

const KEY = 'now-tabs';

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    /* chế độ riêng tư chặn localStorage — mở tab đầu như lần đầu tiên */
    return {};
  }
}

let picked = read();
const listeners = new Set();

/**
 * Tab đang mở của một nhóm.
 *
 * `ids` là danh sách hợp lệ HIỆN TẠI, không phải danh sách lúc ghi: một tab bị bỏ đi giữa
 * hai bản thì `localStorage` vẫn còn giữ tên nó, và trả về một mã không còn ai vẽ thì màn
 * trắng trơn. Không khớp thì rơi về tab đầu.
 */
export const getTab = (group, ids) => (ids.includes(picked[group]) ? picked[group] : ids[0]);

export function setTab(group, id) {
  if (picked[group] === id) return;
  picked = { ...picked, [group]: id };
  try {
    localStorage.setItem(KEY, JSON.stringify(picked));
  } catch {
    /* không nhớ được thì lần sau mở lại về tab đầu, không sao */
  }
  for (const fn of listeners) fn();
}

export function onTabChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const tabId = (group, id) => `tb-${group}-${id}`;
const panelId = (group, id) => `tp-${group}-${id}`;

/**
 * Dãy nút tab, kèm chỗ cho dụng cụ của cả khối.
 *
 * `tools` (nút phong cách, nút báo cáo) đứng ở ĐÂY chứ không ở tiêu đề mục đầu tiên như
 * trước: phạm vi của chúng vừa đổi. Nút phong cách đổi hình mọi chart của tấm đang mở, nút
 * báo cáo chép số của đúng tấm ấy — nên chỗ đứng đúng của chúng là cái thanh quyết định
 * tấm nào đang mở. Để lại trong mục đầu tiên thì mỗi tab phải có một bản, tức là ba cặp
 * nút giống hệt nhau làm cùng một việc.
 */
export function tabBar({ group, items, active, tools = '', label = '' }) {
  return html`<div class="tabs">
    <div class="tab-row" role="tablist" ${label ? html`aria-label="${label}"` : ''}>
      ${items.map((it) => {
        const on = it.id === active;
        return html`<button
          type="button"
          class="tab ${on ? 'on' : ''}"
          role="tab"
          id="${tabId(group, it.id)}"
          aria-controls="${panelId(group, it.id)}"
          aria-selected="${on ? 'true' : 'false'}"
          tabindex="${on ? '0' : '-1'}"
          data-tab-group="${group}"
          data-tab="${it.id}"
        >
          ${it.label}${it.note ? html`<small>${it.note}</small>` : ''}
        </button>`;
      })}
    </div>
    ${tools ? html`<div class="tab-tools">${tools}</div>` : ''}
  </div>`;
}

/** Tấm nội dung. `aria-labelledby` trỏ về nút tab để trình đọc màn hình gọi được tên tấm. */
export function tabPanel({ group, active, body }) {
  return html`<div class="tab-body" role="tabpanel" id="${panelId(group, active)}" aria-labelledby="${tabId(group, active)}" tabindex="0">
    ${body}
  </div>`;
}

/**
 * `←`/`→` trong một dãy tab: đổi tab và trả về mã tab mới, hoặc `null` nếu phím này
 * không phải việc của tab.
 *
 * Vòng lại ở hai đầu (`Home`/`End` nhảy thẳng về đầu/cuối) — đúng khuôn ARIA, và quan
 * trọng hơn là nó khớp với cách người ta thật sự dùng một dãy ba nút: bấm → mãi thì phải
 * quay về đầu chứ không phải kẹt ở nút cuối.
 */
export function tabKey(el, key) {
  const group = el?.dataset?.tabGroup;
  if (!group) return null;
  const list = [...el.closest('[role="tablist"]').querySelectorAll('[data-tab]')].map((b) => b.dataset.tab);
  const i = list.indexOf(el.dataset.tab);
  if (i < 0) return null;
  const next =
    key === 'ArrowRight' ? list[(i + 1) % list.length]
    : key === 'ArrowLeft' ? list[(i - 1 + list.length) % list.length]
    : key === 'Home' ? list[0]
    : key === 'End' ? list.at(-1)
    : null;
  if (next == null || next === el.dataset.tab) return null;
  setTab(group, next);
  return next;
}
