/**
 * Bản nhớ của lượt quét cuối — để dashboard vẽ NGAY lúc mở, không đợi server quét xong.
 *
 * ## Chỗ hỏng nó lấp, đo được
 *
 * Người dùng, lượt 22: *"Cải thiện ux trên web và ui, trải nghiệm phải load nhanh chóng
 * (chấp nhận stale một chút cũng k sao)"*.
 *
 * Đo trên máy này: khung trang vẽ xong ở **128ms** (first contentful paint), nhưng cái vẽ ra
 * lúc ấy là một khung RỖNG — `render()` thấy `app.state` còn `null` nên nó đi thẳng vào
 * `startBoot()`. Số thật chỉ lên màn khi sự kiện `state` đầu tiên của SSE về, và mốc ấy đo
 * được là **150–550ms khi server ấm**, còn lúc nguội thì nó phải chờ trọn một lượt quét — dải
 * `buildMs` quan sát được ở đây là 0,5 tới 1,6 giây.
 *
 * Tức là nửa giây tới hai giây nhìn một cái khung trống, mỗi lần mở tab. Không có gì hỏng cả;
 * chỉ là trang đang đợi một thứ mà nó đã có sẵn một bản cũ.
 *
 * ## Vì sao cất được, và cái giá của nó
 *
 * Sổ trạng thái nặng **534 KB**. Đo trên máy này:
 *
 *     JSON.stringify   10,8ms      JSON.parse       4,1ms
 *     setItem           2,0ms      getItem          0,3ms
 *
 * Đọc lại hết **4,4ms** — đổi lấy 150–1600ms chờ mạng. Đó là toàn bộ lý lẽ của module này.
 *
 * Chiều GHI thì đắt hơn (12,8ms) và nó là một cục liền, đủ để rớt một khung hình. Nên nó
 * KHÔNG ghi ở mỗi lượt SSE (30 giây một lần, suốt cả ngày) mà chỉ ghi lúc tab ĐI KHUẤT —
 * `pagehide` và `visibilitychange`. Bản nhớ chỉ có ích cho lần mở SAU, nên ghi lúc rời đi là
 * đúng lúc duy nhất nó cần được ghi, và đó cũng là lúc 12,8ms không ai thấy.
 *
 * ## Trần tuổi 90 phút — và vì sao có trần
 *
 * *"Chấp nhận stale một chút"* — một chút, không phải một ngày. Một cái board của tối hôm qua
 * bày ra lúc chín giờ sáng thì không phải "hơi cũ", nó là một câu trả lời cho một câu hỏi
 * khác: số phiên thức, tuổi quyết định, hạn mức còn lại đều đã đổi hẳn. Vẽ nó ra rồi đổi
 * ngay sau đó tốn của người đọc một lượt đọc thừa, và lượt đọc ấy đắt hơn nửa giây chờ.
 *
 * 90 phút là quãng mà "tôi đang làm gì" chưa đổi — đủ để che ca thường gặp nhất (đóng tab đi
 * họp rồi quay lại) và cắt đúng ca gây hại (mở lại sáng hôm sau). Quá trần thì trả `null` và
 * trang đi đúng đường cũ: màn hình chờ có chữ, xem `startBoot` trong `app.js`.
 *
 * Tuổi đếm từ `generatedAt` của chính sổ, KHÔNG từ lúc ghi: một tab mở suốt tám tiếng mà
 * server chết từ sáng thì lúc ghi là 5 giờ chiều trong khi số liệu là của 9 giờ sáng. Cái
 * người đọc quan tâm là số liệu bao nhiêu tuổi.
 *
 * ## Cái nó KHÔNG làm
 *
 * Không nói dối rằng mình đang trực tiếp. Lượt vẽ từ bản nhớ đi qua `apply(state, { cached:
 * true })`, và nhánh ấy bật một cái nhãn riêng ở thanh trên cho tới khi số thật về — cùng
 * nguyên tắc mà dải "mất kết nối" đã dựng ra: một bức tranh đã chết mà không nói ra thì tệ
 * hơn một màn hình trống.
 */

const KEY = 'now-state';

/**
 * 90 phút. Xem khối trên. Để ở đây chứ không trong `app.js` vì nó là một tính chất của bản
 * nhớ, không phải một lựa chọn của màn hình dùng nó.
 */
export const STALE_MAX_MS = 90 * 60 * 1000;

/**
 * Cất sổ. Nuốt mọi lỗi, cùng lý do đã ghi ở `savePet`: chế độ riêng tư chặn `localStorage`,
 * và kho đầy thì `setItem` ném. Không cất được thì lần sau vẫn chờ mạng như cũ — mất một lượt
 * vẽ sớm, không mất gì khác.
 */
export function saveState(state) {
  if (!state) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), state }));
  } catch {
    /* không cất được thì lần sau vẫn chờ mạng như cũ */
  }
}

/**
 * Tuổi của một sổ, tính từ `generatedAt` và lùi về mốc ghi khi sổ không có nó.
 *
 * Nhận CẢ HAI dạng mốc thời gian, và đó là một chuyện đo được chứ không phải phòng xa:
 * `/api/state` hiện trả `generatedAt` là số mili giây, còn sổ quản gia (`fedAt`, `restedAt`)
 * thì trả chuỗi ISO. Một hàm chỉ biết `Date.parse` sẽ ra `NaN` cho dạng số rồi lặng lẽ lùi về
 * mốc GHI — tức là cái ca mà cả trần 90 phút sinh ra để chặn (tab mở suốt tám tiếng, server
 * chết từ sáng) lại là đúng cái ca nó bỏ lọt.
 */
const stampOf = (v) => (typeof v === 'number' ? v : Date.parse(v ?? ''));

const ageOf = (box, now) => {
  const gen = stampOf(box.state?.generatedAt);
  return now - (Number.isFinite(gen) ? gen : box.at);
};

/**
 * Bản nhớ này còn dùng được không — phép quyết THUẦN, tách khỏi `localStorage`.
 *
 * Tách ra vì đây là chỗ duy nhất trong module có một quyết định để sai, mà `localStorage` thì
 * không tồn tại ở Node — để nó dính vào nhau là cả luật tuổi không phép kiểm nào chạm tới
 * được. Cùng phép tách đã dựng nên `petmath.js`.
 */
export const freshEnough = (box, now = Date.now()) =>
  Boolean(box?.state) && ageOf(box, now) <= STALE_MAX_MS;

/** Sổ đã cất, hoặc `null` khi không có, hỏng, hay quá 90 phút. */
export function loadState(now = Date.now()) {
  let box;
  try {
    box = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
  return freshEnough(box, now) ? box.state : null;
}
