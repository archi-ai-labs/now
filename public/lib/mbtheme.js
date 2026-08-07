/**
 * Nền sáng/tối của popover — BA chế độ, mặc định đi theo macOS.
 *
 * ## Vì sao popover phải có công tắc riêng
 *
 * Cùng một lý do đã bắt nút đổi ngôn ngữ mọc lên ở đây lượt trước, và đây là lần thứ tư cái
 * lý do ấy lộ ra: **WKWebView trong app Swift có kho `localStorage` riêng, không chung với
 * Safari**. Nút theme trên dashboard ghi vào `now-theme` của một kho khác, nên nó không với
 * tới cửa sổ này được — và trong cửa sổ này thì trước lượt 18 không có đường nào để sửa.
 *
 * Trước đó popover bám cứng `prefers-color-scheme`. Đúng ở ca thường, sai ở ca người ta thật
 * sự muốn sửa: máy để nền sáng cả ngày nhưng cái popover treo dưới thanh menu thì người dùng
 * muốn nó tối, hoặc ngược lại. Không có cửa nào cho việc đó cả.
 *
 * ## Ba chế độ, và vì sao `auto` là mặc định chứ không phải một chế độ thứ ba cho đủ bộ
 *
 * `auto` không phải "sáng hoặc tối, tuỳ": nó là **không có ý kiến**, và đó là trạng thái đúng
 * của một cửa sổ treo dưới thanh menu hệ thống — đổi appearance của máy thì nó đi theo, không
 * bắt ai vào đây bấm lại. Hai chế độ kia là chỗ ghi đè, và chúng chỉ có nghĩa vì `auto` là
 * chỗ mặc định để quay về sau đúng ba cú bấm.
 *
 * ## Bản chép trong `menubar.html`, và vì sao nó được phép tồn tại
 *
 * Nền phải đặt TRƯỚC nhịp vẽ đầu, nếu không thì mỗi lần mở popover là một nháy trắng dưới
 * một thanh menu tối. Mà file này là module, tức là `defer` — nó chạy sau khi HTML đã dựng.
 * Nên `menubar.html` có một đoạn script đồng bộ làm đúng phép `resolve()` dưới đây.
 *
 * Đó là bản chép DUY NHẤT được phép, và nó phải khớp `KEY` với chỗ này. Ghi ra để lần sửa
 * sau không phải đoán: đổi tên khoá ở đây thì đổi cả ở đó, và cái hỏng sẽ là một nháy trắng
 * chứ không phải một dòng lỗi.
 */

export const KEY = 'now-mb-theme';

/** Vòng xoay, và thứ tự của nó là thứ tự người ta sẽ bấm: từ chỗ không có ý kiến, sang ép
 *  sáng, sang ép tối, rồi về lại chỗ không có ý kiến. Ba cú bấm là một vòng trọn — đủ ngắn
 *  để thử cả ba mà không phải nhớ mình đang ở đâu. */
export const THEMES = ['auto', 'light', 'dark'];

/** Chế độ đang lưu. Mã lạ hay `localStorage` bị chặn (chế độ riêng tư) đều rơi về `auto` —
 *  đúng hành vi trước khi có công tắc này, không rơi vào một nhánh mới nào. */
export function themeMode() {
  try {
    const v = localStorage.getItem(KEY);
    if (THEMES.includes(v)) return v;
  } catch {
    /* chế độ riêng tư chặn localStorage — bám macOS như cũ */
  }
  return 'auto';
}

export const nextTheme = () => THEMES[(THEMES.indexOf(themeMode()) + 1) % THEMES.length];

/** Chế độ → giá trị thật cho `data-theme`. `auto` hỏi macOS; hai chế độ kia trả chính nó.
 *
 *  `matchMedia` có thể không tồn tại — hàm này gọi được từ chỗ vẽ, mà chỗ vẽ thì bài test
 *  chạy trong Node. Thiếu nó thì rơi về `light`, đúng mặc định của `prefers-color-scheme`. */
export const resolveTheme = (mode) =>
  mode !== 'auto'
    ? mode
    : typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

export const paintTheme = (mode = themeMode()) =>
  document.documentElement.setAttribute('data-theme', resolveTheme(mode));

/**
 * Đặt chế độ rồi sơn lại ngay. Không cất được thì vẫn sơn: một cú bấm phải có tác dụng
 * trong phiên này kể cả khi nó không sống qua lần mở sau.
 */
export function setTheme(mode) {
  const m = THEMES.includes(mode) ? mode : 'auto';
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* không nhớ được thì lần mở sau về auto, không sao */
  }
  paintTheme(m);
  return m;
}

/**
 * Bám theo macOS khi và chỉ khi đang ở `auto`.
 *
 * Thiếu cái cửa `themeMode() === 'auto'` thì hệ điều hành đổi appearance lúc hoàng hôn sẽ
 * đạp lên đúng cái chế độ người dùng vừa ép — tức công tắc này im lặng mất tác dụng, và mất
 * đúng vào lúc không ai đang nhìn để hiểu vì sao.
 */
export function followSystem() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeMode() === 'auto') paintTheme('auto');
  });
}
