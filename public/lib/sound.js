/**
 * Tiếng của màn Cửa hàng — SINH RA bằng Web Audio, không phải file.
 *
 * ## Vì sao tổng hợp chứ không chép file vào repo
 *
 * Cùng một lý lẽ đã dựng nên toàn bộ phần hình của màn này: hình học ở `town.js` được DỰNG
 * (`diamond`, `box`, `hip`) chứ không vẽ tay, sắc độ suy từ chính hình (`shadeOf`) chứ không
 * chép bảng bóng. Một cái tiếng "bíp" là ba con số — tần số, kiểu sóng, đường bao — và ba
 * con số ấy đọc được, sửa được, và không lệch với gì cả. Một file `.ogg` thì ngược lại:
 * ngoài repo không kiểm được, không suy ra được, và nó là nhị phân đầu tiên trong một cây
 * thư mục hiện chỉ có đúng hai file ảnh icon.
 *
 * Cái giá phải trả rất thật và nói thẳng ra đây: **tiếng tổng hợp bằng oscillator thì mỏng**.
 * Không có cách nào để một `sine` với một `triangle` nghe ra tiếng đồng xu thật. Chỗ đổi lại
 * là nó nghe đúng như một trò chơi 8-bit, tức là cùng một thời với pixel art trên màn hình —
 * một tiếng thu âm chất lượng cao đứng cạnh mấy ô 4px mới là thứ lệch tông.
 *
 * ## Ba hàng rào, và cả ba là điều kiện để lớp này được tồn tại
 *
 * 1. **MẶC ĐỊNH TẮT.** Một dashboard tự phát ra tiếng ngay lần mở đầu tiên là một dashboard
 *    bị tắt tiếng vĩnh viễn ở tầng hệ điều hành, và lúc ấy công tắc ở đây thành vô nghĩa.
 * 2. **Popover thanh menu KHÔNG BAO GIỜ kêu.** File này chỉ được `views/pet.js` nhập; nó
 *    không có mặt trong cây phụ thuộc của `menubar.js`. Đó là hàng rào bằng KIẾN TRÚC chứ
 *    không phải bằng một câu `if` ai đó có thể xoá: app thanh menu sống suốt phiên đăng
 *    nhập, và một app thanh menu phát ra tiếng là một app bị gỡ.
 * 3. **Không tự phát.** `AudioContext` chỉ dựng lên trong một cú bấm thật (trình duyệt cũng
 *    chặn khác đi), và mọi tiếng đều là hậu quả trực tiếp của một cú bấm.
 *
 * ## Vì sao KHÔNG treo vào `prefers-reduced-motion`
 *
 * Nó là thiết lập về CHUYỂN ĐỘNG — người ta bật nó vì chóng mặt, vì tiền đình, vì màn hình
 * rung làm buồn nôn. Suy từ đó ra "vậy chắc cũng không muốn nghe tiếng" là đoán hộ người
 * dùng một nhu cầu khác hẳn. Âm thanh có công tắc riêng, và mặc định của nó đã là tắt.
 */

const KEY = 'now.pet.sound';

/**
 * Bật hay tắt — đọc `localStorage` một lần lúc nạp.
 *
 * Mặc định TẮT nghĩa là: thiếu khoá, khoá hỏng, hay `localStorage` bị chặn đều ra `false`.
 * Đó là chiều an toàn duy nhất — một lỗi đọc thiết lập không được phép làm máy người ta
 * kêu lên.
 */
let on = false;
try {
  on = localStorage.getItem(KEY) === '1';
} catch {
  on = false;
}

export const soundOn = () => on;

export function setSound(next) {
  on = Boolean(next);
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Chặn `localStorage` (chế độ riêng tư, cấu hình trình duyệt) thì lựa chọn chỉ sống hết
    // phiên này. Không báo lỗi: người dùng vừa bấm một cái công tắc và nó VỪA hoạt động —
    // thứ không sống sót là lần mở sau, mà đó không phải một lỗi để kêu lên giữa lúc bấm.
  }
  return on;
}

/**
 * `AudioContext` dựng LƯỜI, đúng một lần, và chỉ trong một cú bấm thật.
 *
 * Dựng sẵn lúc nạp module thì Chrome tạo nó ở trạng thái `suspended` và ghi một dòng cảnh
 * báo vào console mỗi lần mở màn — mà console sạch là một trong những tiêu chí nghiệm thu
 * của dự án này.
 */
let ctx = null;
function audio() {
  if (!ctx) {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/**
 * Một nốt: sóng, tần số, độ dài, độ to.
 *
 * Đường bao là `exponentialRampToValueAtTime` chứ không phải `linearRamp`, và đây không
 * phải chuyện thẩm mỹ: tai nghe độ to theo thang gần-lô-ga-rit, nên một đường thẳng tuyến
 * tính nghe ra là **tắt đột ngột ở cuối**, đúng cái tiếng "cụp" mà mọi nốt tổng hợp nghiệp
 * dư đều có. Không hạ tới 0 được (hàm ấy cấm số 0), nên đích là 0,0001.
 *
 * Mức to trần 0,12 — thấp có chủ ý. Đây là tiếng phản hồi cho một cú bấm trong một cái
 * dashboard người ta mở suốt ngày, không phải hiệu ứng của một trò chơi người ta ngồi chơi
 * một tiếng rồi tắt.
 */
function note(freq, { type = 'sine', dur = 0.12, gain = 0.12, at = 0 } = {}) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/**
 * Bốn tiếng, và mỗi tiếng gắn với đúng một việc người dùng vừa làm.
 *
 * Chúng phân biệt nhau bằng HƯỚNG của quãng nhạc, không bằng âm sắc: đi lên là chuyện tốt
 * (mua được, nghỉ xong), đứng một chỗ là một cú bấm trung tính, đi xuống là bị từ chối. Ở
 * mức to 0,12 trong một cái loa laptop thì hướng là kênh duy nhất còn đọc được — hai âm sắc
 * khác nhau ở cùng cao độ thì nghe như nhau.
 *
 * - `tap` — bấm sang một chỗ khác trong thị trấn. Một nốt, ngắn nhất, nhẹ nhất: nó nổ nhiều
 *   lần nhất trong một phiên nên nó phải là tiếng dễ quên nhất.
 * - `buy` — mua được. Quãng ba trưởng đi lên (A5 → C#6), tiếng mà mọi trò chơi dùng để nói
 *   "xong rồi".
 * - `deny` — không đủ xu. Quãng hai thứ đi XUỐNG, sóng vuông: chói hơn hẳn ba tiếng kia,
 *   vì nó là tiếng duy nhất nói "việc vừa rồi KHÔNG xảy ra".
 * - `rest` — chốt xong một quãng nghỉ. Ba nốt đi lên, thưa và mềm (sine), dài gấp đôi
 *   `buy` — đây là phần thưởng cho việc đứng dậy khỏi ghế, thứ đắt nhất trong cả trò chơi.
 */
const CUES = {
  tap: () => note(660, { type: 'triangle', dur: 0.07, gain: 0.06 }),
  buy: () => {
    note(880, { type: 'triangle', dur: 0.1, gain: 0.1 });
    note(1109, { type: 'triangle', dur: 0.16, gain: 0.09, at: 0.08 });
  },
  deny: () => {
    note(330, { type: 'square', dur: 0.09, gain: 0.06 });
    note(294, { type: 'square', dur: 0.14, gain: 0.05, at: 0.07 });
  },
  rest: () => {
    note(523, { dur: 0.16, gain: 0.09 });
    note(659, { dur: 0.16, gain: 0.09, at: 0.12 });
    note(784, { dur: 0.3, gain: 0.08, at: 0.24 });
  },
};

/**
 * Kêu một tiếng — cửa duy nhất ra ngoài, và nó tự kiểm công tắc.
 *
 * Chỗ gọi KHÔNG được tự hỏi `soundOn()` rồi mới gọi: hai chỗ kiểm cùng một thiết lập là hai
 * chỗ để quên một cái, và cái quên ở đây kêu thành tiếng. Mã lạ thì im lặng bỏ qua, không
 * ném — một cái tên gõ sai không đáng làm hỏng cú bấm mà nó đi kèm.
 *
 * Bọc `try` vì `AudioContext` từ chối được vì đủ thứ lý do ngoài tầm với (hết kênh phần
 * cứng, thiết bị ra bị rút). Không có tiếng thì màn hình vẫn phải chạy tiếp.
 */
export function cue(name) {
  if (!on) return;
  try {
    CUES[name]?.();
  } catch {
    // Im. Xem chú thích ngay trên.
  }
}
