/**
 * Đọc địa chỉ của một request thành một `URL` — hoặc `null` khi nó không phải địa chỉ.
 *
 * ## Vì sao không gọi thẳng `new URL(req.url, 'http://localhost')`
 *
 * Vì `req.url` KHÔNG phải một URL. Nó là "request target" của HTTP, và ở dạng thường gặp
 * (origin-form) nó chỉ là đường dẫn cộng chuỗi truy vấn. Ném nguyên nó vào `new URL` là
 * mời cái nghĩa THỨ HAI của hai dấu gạch chéo vào một chỗ chỉ được có đường dẫn:
 *
 * - `//` → `new URL` NÉM (`Invalid URL`), vì nó đọc phần sau `//` làm tên máy chủ và ở đây
 *   phần ấy rỗng. Chỗ gọi nằm trong handler async, nên cú ném đi thẳng ra lưới bắt cuối
 *   cùng của `server.js` và ra màn hình dưới dạng **500** — tức "server tôi hỏng" cho một
 *   địa chỉ do client gõ sai. Đây là ca thật, bắt được 10/8 trong lúc dò một sự cố khác:
 *   một vòng lặp `curl` nối chuỗi thừa một dấu gạch và log server hiện `lỗi khi phục vụ
 *   GET // — Invalid URL`. Một URL rác không được phép đọc thành một server hỏng.
 * - `//lib/pet.js` → KHÔNG ném, và ca này khó chịu hơn hẳn: nó phân giải thành máy chủ
 *   `lib`, đường dẫn `/pet.js`. Bộ định tuyến vì thế thấy một đường dẫn KHÁC hẳn cái client
 *   vừa hỏi, lặng lẽ, không lỗi nào. Hôm nay nó chỉ trả 404 nhầm chỗ; ngày mai, khi có một
 *   luật nào đó so `pathname` để quyết định quyền, nó là một cửa đi vòng.
 *
 * Nên luật ở đây là: origin-form phải mở đầu bằng ĐÚNG MỘT dấu `/`. Không có ngoại lệ nào
 * cần tới hai dấu — không trang nào trong `public/` xin một địa chỉ như thế.
 *
 * ## Vì sao vẫn nhận absolute-form
 *
 * `GET http://host/x HTTP/1.1` là dạng một proxy gửi, và RFC 7230 bắt server phải nhận.
 * Không ai chạy dashboard này sau proxy, nhưng phép cũ (`new URL(target, base)`) vốn đã
 * nhận nó đúng — bỏ đi là một sự thụt lùi lặng lẽ đổi lấy đúng hai dòng mã. Chỉ nhận
 * `http`/`https`: mấy giao thức khác không mang đường dẫn theo nghĩa này.
 *
 * Trả `URL` để chỗ gọi dùng nguyên `pathname` và `searchParams` như trước; trả `null` thay
 * vì ném, vì "địa chỉ hỏng" là một CÂU TRẢ LỜI (400), không phải một sự cố.
 */

/** Máy chủ giả, chỉ để `URL` có gốc mà phân giải. Không đi ra ngoài hàm này. */
const BASE = 'http://localhost';

export function reqUrl(target) {
  if (typeof target !== 'string' || target === '') return null;
  if (target.startsWith('/')) {
    if (target.startsWith('//')) return null;
    try {
      return new URL(target, BASE);
    } catch {
      return null;
    }
  }
  try {
    const u = new URL(target);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}
