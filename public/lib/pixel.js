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

/**
 * VIỀN của một hình — dựng TỪ hình, không vẽ tay.
 *
 * Người dùng chỉ ra chỗ hỏng bằng một ví dụ: mochi đi qua tấm thảm hồng thì nó hoà vào tấm
 * thảm. Đó không phải chuyện chọn màu sai — nó là chuyện một hình đặc không có đường bao
 * thì nó chỉ đọc được khi cái nền phía sau đủ khác nó, mà một nhân vật ĐI thì nó đi qua đủ
 * mọi thứ nền: cỏ, đường, sàn gỗ, thảm hồng. Không có màu thân nào thắng được cả bốn.
 *
 * Đường bao thì thắng, vì nó không cãi nhau với nền theo sắc — nó cãi nhau theo ĐỘ SÁNG,
 * và nó luôn đứng đúng ở chỗ nền chạm vào hình. Đây là lý do mọi nhân vật trong tranh pixel
 * đều có một đường bao tối, và vì sao mấy toà nhà thì KHÔNG cần: nhà đứng yên trên đúng một
 * nền, còn nhân vật thì không.
 *
 * Ô nào TRỐNG mà có ô đặc kề bên — kể cả kề CHÉO — thì nó là một ô viền. Kề chéo là phần
 * bắt buộc: thiếu nó thì mọi chỗ hình đi bậc thang đều hở một ô, và đường bao rò ra đúng ở
 * mấy góc mà mắt nhìn vào nhiều nhất.
 *
 * Trả về một mảng hình RIÊNG, rộng và cao hơn hình gốc mỗi phía một ô — nên chỗ gọi vẽ nó
 * thành một lớp lệch lên trên-trái đúng một ô (`.pet-outline`), và hình gốc giữ nguyên khung
 * của mình. Làm ngược lại — nhét ô viền vào chính mảng hình — thì `shadeOf` đọc ô viền
 * thành thân và mọi ô rìa đổi sắc độ, tức cái viền đi sửa luôn phép chấm bóng.
 */
export function outlineRows(rows, ch = 'o') {
  const w = Math.max(...rows.map((r) => r.length));
  const solid = (x, y) => (((rows[y] ?? '')[x]) ?? '.') !== '.';
  return Array.from({ length: rows.length + 2 }, (_, ry) =>
    Array.from({ length: w + 2 }, (_, rx) => {
      const x = rx - 1;
      const y = ry - 1;
      if (solid(x, y)) return '.';
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) if (solid(x + dx, y + dy)) return ch;
      }
      return '.';
    }).join(''),
  );
}

/** Lớp viền, vẽ dưới hình. `.pet-outline` lệch nó lên trên-trái một ô để hàng `ry` cột `rx`
 *  của mảng viền rơi đúng lên hàng `ry-1` cột `rx-1` của hình gốc. */
export const outline = (rows) => html`<span class="pet-outline"
  >${pixels(outlineRows(rows), { o: 'edge' }, false)}</span
>`;

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
