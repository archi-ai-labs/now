/**
 * Phép vẽ pixel — lưới 4px, đặt tuyệt đối, và phép chấm bóng theo hướng nắng.
 *
 * Tách khỏi `menubar-view.js` vì có HAI người dùng và nếu để nó ở đấy thì hai người ấy
 * nhập vòng nhau: quản gia sống ở `menubar-view.js`, còn đồ ăn và đồ trang trí sống ở
 * `pet.js` — mà khung cảnh popover thì phải vẽ cả hai. ESM chịu được vòng ấy đúng tới lúc
 * ai đó đọc một hằng số ở tầng module, và lỗi lúc ấy là một `undefined` giữa lượt vẽ chứ
 * không phải một câu báo tử tế. Một module chung, một chiều phụ thuộc, hết chuyện.
 */

import { html } from './dom.js';

/**
 * Nguồn sáng ở TRÊN-TRÁI, đúng chỗ mặt trời đang đứng trong khung.
 *
 * Sắc độ của mỗi ô suy ra từ chính hình, không phải từ một bản đồ bóng chép tay: khuyết
 * ô chéo phía mặt trời thì ô ấy là cạnh hứng nắng, khuyết ô chéo phía đối diện thì nó là
 * cạnh khuất, còn lại là thân. Sửa hình một dòng là bóng tự đi theo — bản chép tay thì
 * lần sửa thứ hai đã lệch.
 */
export function shadeOf(rows, x, y) {
  const at = (xx, yy) => (((rows[yy] ?? '')[xx]) ?? '.') !== '.';
  if (!at(x - 1, y - 1)) return 'rim';
  if (!at(x + 1, y + 1)) return 'shade';
  return '';
}

/** Một sprite → một mớ ô 4px đặt tuyệt đối. `chars` gán class riêng cho ký tự đặc biệt;
 *  ký tự không có trong đó thì lấy sắc độ theo hướng nắng. */
export function pixels(rows, chars = {}, shaded = true) {
  return rows.map(
    (row, y) => html`${[...row].map((c, x) =>
      c === '.'
        ? ''
        : html`<i class="px ${chars[c] ?? (shaded ? shadeOf(rows, x, y) : '')}"
            style="left:${x * 4}px;top:${y * 4}px"></i>`,
    )}`,
  );
}
