/**
 * Bản nhớ của sổ quản gia — để popover và cửa hàng vẽ NGAY, không đợi một lượt hỏi.
 *
 * ## Vấn đề nó giải
 *
 * Popover mở chừng chín lần một ngày và mỗi lần là một lượt tải trang mới. Sổ thì đi
 * đường riêng (`/api/pet`, xem chú thích của `loadPet` trong `menubar.js`), nên nhịp vẽ
 * đầu tiên luôn KHÔNG có con vật: bức tranh hiện ra trống chỗ, rồi vài chục mili giây sau
 * mấy cái thanh với cái ví nhảy vào. Một khung cảnh tự sắp lại sau khi đã hiện ra thì mỗi
 * lần mở là một lần mắt phải bám lại — đúng cái mà luật "không có màn dạo đầu" của phần
 * chuyển động đã cấm, chỉ là lần này nó đến từ mạng chứ không từ CSS.
 *
 * ## Vì sao nó không phải là một cái ảnh chụp
 *
 * Hai con số trong sổ TỤT THEO ĐỒNG HỒ — độ no và độ tập trung. Bày lại bản chép của
 * chúng sau ba tiếng không phải là bày một con số cũ, mà là bày một con số SAI: thanh
 * tập trung sẽ đầy căng đúng lúc bạn vừa ngồi liền ba tiếng, tức là câm đúng lúc nó phải
 * lên tiếng. Nên bản nhớ giữ MỐC GỐC (`fedAt`, `restedAt`, `lastMealAt`) rồi tính lại,
 * bằng đúng phép của server — cùng một `petmath.js`, không phải một bản chép tay ở đây.
 *
 * ## Cái nó KHÔNG dựng lại được, và cách xử
 *
 * Ví xu. Nó đến từ hoá đơn token do server cộng theo ngày, không có công thức nào ở phía
 * này suy ra được. Nên bản nhớ chỉ dùng trong ĐÚNG NGÀY nó được ghi: `accrue` chốt sổ
 * theo ngày lịch, nên một bản nhớ của hôm qua mang một cái ví thuộc một kỳ kế toán khác.
 * Qua ngày thì bỏ, chịu một lượt chờ — sai một cái ví thì tệ hơn chờ 40ms.
 *
 * Trong ngày thì con số vẫn có thể cũ vài chục xu, và điều đó chấp nhận được vì lượt hỏi
 * thật luôn đè lên ngay sau đó: bản nhớ vẽ khung, mạng chốt số. Chỗ DUY NHẤT chuyện ấy có
 * hậu quả là cửa hàng, nơi một cái ví cũ có thể làm một món trông như chưa mua nổi — và
 * chỗ ấy thì server mới là người quyết (`buy()` tra giá và trừ tiền ở phía nó), nên tệ
 * nhất là một cái nhãn "còn thiếu 3 xu" sống được nửa giây.
 */

import { livePet } from './petmath.js';

const KEY = 'now-pet';

/** `YYYY-MM-DD` theo giờ MÁY, cùng mốc ngày mà server dùng để chốt sổ xu. */
function today(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Cất sổ. Nuốt mọi lỗi: chế độ riêng tư chặn `localStorage`, và kho đầy thì `setItem` ném.
 * Không cất được thì chỉ mất một lần vẽ sớm, không mất gì khác — nên nó không đáng một
 * dòng lỗi trên màn hình.
 */
export function savePet(pet, now = new Date()) {
  if (!pet) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: today(now), at: now.getTime(), pet }));
  } catch {
    /* không cất được thì lần sau vẫn chờ mạng như cũ */
  }
}

/**
 * Lấy sổ đã cất và TÍNH LẠI mọi thứ tụt theo đồng hồ. `null` khi không có, hỏng, hay
 * khác ngày.
 *
 * Ba thứ bị bỏ đi chứ không tính lại, vì chúng là câu trả lời cho một cú bấm chứ không
 * phải một trạng thái:
 * - `lastBreak` — kết quả quãng nghỉ vừa chốt. Bày lại lúc mở trang là trả lời một câu
 *   hỏi không ai vừa hỏi.
 * - `break` khi đã hết giờ — chỉ server mới chốt được nó đạt hay trượt (nó phải so
 *   `idleMs`), nên phía này để `null` và đợi lượt hỏi thật thay vì đoán.
 * - `error` — không bao giờ được cất, xem `savePet` ở chỗ gọi.
 */
export function loadPet(now = new Date()) {
  let box;
  try {
    box = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
  if (!box?.pet || box.day !== today(now)) return null;

  const pet = box.pet;
  const nowMs = now.getTime();
  // Bản nhớ tính lại bằng ĐÚNG `livePet` mà lượt vẽ dùng, không phải một bản chép của nó:
  // hai chỗ cùng dựng lại độ no từ `fedAt` là hai chỗ sẽ trôi khỏi nhau đúng lần đầu ai đó
  // chỉnh một cái. Đoạn hồi cũng tụt theo đồng hồ y như hai cái mốc kia — bản nhớ ghi lúc
  // đang ăn dở mà mở lại sau hai phút thì nó đã xong từ lâu, và `livePet` tự ra con số
  // CUỐI chứ không ra con số giữa chừng.
  //
  // Đồng hồ máy khách so với chính nó, không so với server: `leftMs` là một HIỆU SỐ do
  // server tính, còn `box.at` là mốc của chính máy này. Trừ hai thứ cùng gốc thì lệch giờ
  // giữa hai máy không lọt vào được.
  const left = pet.doing ? pet.doing.leftMs - (nowMs - box.at) : 0;

  return {
    ...livePet(pet, nowMs),
    // Hết giờ thì bỏ, kể cả với quãng nghỉ — phía này KHÔNG được kết luận nó đạt hay
    // trượt (phép kiểm cần `idleMs`, thứ chỉ server có), nên nó chỉ dọn cái đang chạy đi
    // và để lượt hỏi thật nói tiếp.
    doing: left > 0 ? { ...pet.doing, leftMs: left } : null,
    lastBreak: null,
  };
}
