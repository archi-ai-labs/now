/**
 * Cửa hàng — chỗ tiêu xu, và chỗ DUY NHẤT nói ra xu từ đâu mà có.
 *
 * ## Vì sao cái cửa hàng ở dashboard mà con thú ở popover
 *
 * Popover rộng 360pt và nó tồn tại để LIẾC. Nhét một lưới mười một món hàng vào đấy là
 * đổi cái nó giỏi lấy một cái nó không cần giỏi. Còn nhân vật thì ngược lại: nó phải ở
 * chỗ mở ra chín lần một ngày, không phải ở màn thứ mười của một trang web.
 *
 * Nên chia đúng theo nhịp dùng: **cho ăn và mua sắm là việc thỉnh thoảng** (dashboard),
 * **nhìn con thú là việc thường xuyên** (popover).
 *
 * ## Luật của màn này
 *
 * Không một con số THẬT nào được dán nhãn trò chơi. Ví xu là ví xu; muốn biết đã tiêu bao
 * nhiêu tiền thật thì màn Token ngay trên nav. Chỗ duy nhất hai thế giới chạm nhau là câu
 * giải thích tỉ giá ở đầu màn, và nó nói thẳng: 1 xu = $1 ước tính, kể từ ngày mở sổ.
 * Giấu chỗ ấy đi là biến một trò chơi lương thiện thành một thanh XP bịa.
 */

import { html } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { itemArt, hungerBar, hungerText } from '../lib/pet.js';
import { empty, ulabel } from './shared.js';

/**
 * Sổ quản gia KHÔNG nằm trong `app.state`.
 *
 * `app.state` là kết quả một lượt quét — mọi thứ trong đó đều là thứ máy này QUAN SÁT
 * được. Ví xu thì không: nó là thứ dashboard tự ghi, và nó đổi lúc người ta bấm mua chứ
 * không đổi theo lượt quét 30 giây. Trộn hai loại vào một chỗ là bắt mọi người đọc state
 * — SSE, popover, test — mang theo một trường không dùng tới, và tệ hơn là bắt cú bấm mua
 * phải chờ hết một lượt quét mới thấy kết quả.
 */
let pet = null;
let err = null;
let busy = null;
let redraw = () => {};
let wired = false;
let askedAt = 0;

/**
 * Sổ cũ hơn ngần này thì hỏi lại. Đúng nhịp quét của dashboard.
 *
 * Có mốc này vì nguồn tiền chảy theo LƯỢT QUÉT, không theo cú bấm: ngồi làm việc cả buổi
 * với tab mở sẵn thì tiền vào ví liên tục, mà bản đầu chỉ hỏi sổ đúng một lần lúc nạp
 * trang. Kết quả là ví đứng hình suốt buổi rồi nhảy một phát khi mua gì đó — và trong lúc
 * ấy mấy món "còn thiếu 11 xu" thật ra đã mua được từ lâu.
 */
const STALE_MS = 30_000;

/**
 * Sổ đang giữ trong tay, cho chỗ khác đọc nhờ.
 *
 * Chỗ khác ở đây là BÀN CHỈNH: nó vẽ popover bằng đúng `popoverView` mà app thanh menu
 * gọi, nên nếu nó không đưa `pet` vào thì cái nó bày ra thiếu mất nhân vật — và một bàn
 * chỉnh bày ra thứ khác với thứ sẽ chạy thì đúng bằng cái bẫy "trên demo thì đẹp, lên
 * thanh thì lệch" mà cả file `menubar-view.js` sinh ra để tránh.
 *
 * Trả `null` khi chưa hỏi xong hoặc trò chơi đang tắt — chỗ gọi không cần phân biệt hai
 * ca ấy, cả hai đều là "vẽ khung cảnh như trước khi có trò chơi".
 */
export const currentPet = () => pet;

async function call(body) {
  askedAt = Date.now();
  try {
    const res = await fetch('/api/pet', {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await res.json();
    // Server trả ví mới nhất KỂ CẢ khi việc bị từ chối ("không đủ xu"). Nhận nó vào luôn:
    // lúc bị từ chối là đúng lúc người ta cần thấy số dư thật.
    if (d.pet) pet = d.pet;
    err = d.error ?? (res.ok ? null : d.error ?? `HTTP ${res.status}`);
  } catch (e) {
    err = e.message;
  } finally {
    busy = null;
    redraw();
  }
}

function onClick(e) {
  const buy = e.target.closest('[data-buy]');
  if (buy) {
    if (busy) return;
    busy = buy.dataset.buy;
    err = null;
    redraw();
    return call({ action: 'buy', id: buy.dataset.buy });
  }
  const tg = e.target.closest('[data-pet-toggle]');
  if (tg) {
    if (busy) return;
    busy = 'toggle';
    err = null;
    redraw();
    return call({ action: 'toggle', on: tg.dataset.petToggle === 'on' });
  }
}

/**
 * Bật màn: nhận cách vẽ lại của chỗ chủ rồi gắn một cái nghe.
 *
 * Là HÀM chứ không phải mấy dòng chạy lúc nạp module, cùng lý do đã ghi cho `initBench`:
 * `test/modules.test.js` nạp mọi file dưới `views/` trong Node, nơi không có `document`.
 */
export function initPet(onChange) {
  redraw = onChange;
  if (wired) return;
  wired = true;
  document.addEventListener('click', onClick);
  call(null);
}

/** Một ô hàng. Đã có thì không bấm được nữa, thiếu tiền thì bấm được nhưng nói rõ là
 *  thiếu — chặn cứng cú bấm thì người ta không biết mình còn thiếu bao nhiêu. */
function tile(id, item) {
  const owned = item.kind === 'decor' && pet.owned.includes(id);
  const poor = pet.coins < item.price;
  // `disabled` chứ không phải bỏ `data-buy` đi: nút đã disabled thì trình duyệt không
  // phát sự kiện click nào cả, nên cái nghe uỷ quyền ở trên không cần biết chuyện này.
  return html`<button type="button" class="shop-item ${owned ? 'owned' : ''} ${poor && !owned ? 'poor' : ''}"
    data-buy="${id}" ${owned || busy === id ? 'disabled' : ''}
    title="${owned ? t('pet.owned') : poor ? t('pet.tooPoor', { n: item.price - pet.coins }) : ''}">
    <span class="shop-art">${itemArt(id)}</span>
    <span class="shop-name">${t(`pet.item.${id}`)}</span>
    <span class="shop-price">${owned ? t('pet.owned') : t('pet.coins', { n: item.price })}</span>
    ${item.kind === 'food' ? html`<span class="shop-fill">${t('pet.fills', { pct: Math.round(item.fill * 100) })}</span>` : ''}
  </button>`;
}

function section(kind, label, hint) {
  const ids = Object.keys(pet.items).filter((k) => pet.items[k].kind === kind);
  return html`<section class="shop-sec">
    <h2>${label}</h2>
    <p class="shop-hint">${hint}</p>
    <div class="shop-grid">${ids.map((id) => tile(id, pet.items[id]))}</div>
  </section>`;
}

export function renderPet() {
  // Hỏi lại sổ NGAY TRONG lượt vẽ, và chỉ khi màn này đang mở — `renderPet` không được
  // gọi ở màn khác, nên đây là cái hẹn giờ rẻ nhất có thể: không có `setInterval` nào
  // chạy nền cho một màn không ai xem.
  //
  // Không thành vòng lặp: `call` cập nhật `askedAt` TRƯỚC khi đi, rồi `redraw` gọi lại
  // hàm này, và lúc đó phép so tuổi đã sai nên không có lượt hỏi thứ hai.
  if (!busy && Date.now() - askedAt > STALE_MS) call(null);
  if (!pet) return empty('◈', t('pet.loading'));

  if (!pet.on) {
    return html`<div class="shop">
      ${empty('◇', t('pet.off'), t('pet.offNote'))}
      <div class="shop-foot">
        <button type="button" class="btn" data-pet-toggle="on" ${busy === 'toggle' ? 'disabled' : ''}>${t('pet.turnOn')}</button>
      </div>
    </div>`;
  }

  return html`<div class="shop">
    <!-- Ví và cơn đói đứng CÙNG một khối: hai thứ này là toàn bộ trạng thái của trò chơi,
         và mọi cú bấm bên dưới chỉ đổi đúng hai con số ấy. Tách ra hai thẻ thì người ta
         phải liếc hai chỗ để trả lời một câu hỏi duy nhất — mua được gì bây giờ. -->
    <div class="shop-top">
      <div class="shop-wallet">
        ${ulabel(t('pet.wallet'))}
        <span class="v">${t('pet.coins', { n: pet.coins })}</span>
        <!-- Câu này KHÔNG được giấu đi. Nó là chỗ duy nhất nối đồng xu với hoá đơn thật,
             và một trò chơi không nói ra nguồn điểm của mình thì đúng bằng cái thanh XP
             mà chốt d-game đã gỡ. -->
        <p class="shop-why">${t('pet.rateNote')}${pet.since ? html` ${t('pet.since', { day: pet.since })}` : ''}</p>
      </div>
      <div class="shop-hunger">
        ${ulabel(t('pet.hunger'))}
        ${hungerBar(pet)}
        <p class="shop-mood">${t(`pet.mood.${pet.mood}`)} · ${hungerText(pet)}</p>
      </div>
    </div>

    ${err ? html`<p class="shop-err">${err}</p>` : ''}

    ${section('food', t('pet.secFood'), t('pet.feedHint'))}
    ${section('decor', t('pet.secDecor'), t('pet.decorHint'))}

    <div class="shop-foot">
      <span class="shop-tally">${t('pet.tally', { earned: pet.earned, spent: pet.spent, meals: pet.meals })}</span>
      <button type="button" class="btn ghost" data-pet-toggle="off" ${busy === 'toggle' ? 'disabled' : ''}>${t('pet.turnOff')}</button>
    </div>
  </div>`;
}
