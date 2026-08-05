/**
 * Thị trấn nhỏ — nhìn từ TRÊN CAO XUỐNG, và cái bản đồ thay chỗ cho một trang cửa hàng
 * cuộn dọc.
 *
 * ## Vì sao một bản đồ chứ không phải mấy khối xếp dọc
 *
 * Màn này đã lớn quá cỡ của thứ nó vốn là. Bản trước xếp bốn khối chồng nhau — nghỉ ngắn,
 * ăn uống, trang trí, cách tính — và tới lúc có 25 món hàng, sáu chỗ đứng và tám khối chữ
 * giải thích thì cuộn từ đầu tới cuối mất ba màn hình. Một trang dài không có lối tắt: muốn
 * mua cái nón thì phải đi qua toàn bộ đồ ăn, mỗi lần.
 *
 * Bản đồ đổi cái danh sách ấy lấy một CHỖ. Mỗi việc có một toà nhà, và bấm vào toà nhà là
 * tới thẳng việc ấy — cùng số nội dung, nhưng cái mắt nhớ được vị trí trong khi nó không
 * nhớ được thứ tự các khối.
 *
 * ## Vì sao ĐẲNG CỰ chứ không phải một dãy nhà nhìn ngang
 *
 * Bản đầu là năm toà nhà vẽ chính diện xếp thành một hàng trên một dải đường. Nó đọc được,
 * nhưng nó đọc thành một KỆ HÀNG chứ không đọc thành một thị trấn: mọi thứ cùng một khoảng
 * cách, cùng một hướng, và cái duy nhất phân biệt "giữa phố" với "cuối phố" là thứ tự trái
 * sang phải — đúng cái thứ tự mà bản đồ sinh ra để thôi phải nhớ.
 *
 * Phối cảnh đẳng cự 2:1 cho lại hai thứ mà hình chính diện không có:
 *
 * 1. **Mặt đất.** Có mặt đất thì mới có "ở giữa" — nhà mình không còn là toà nhà thứ ba
 *    trên năm, nó là toà nhà ở TÂM, có bốn hàng quán vây quanh và mấy ô đất bỏ trống ở rìa.
 * 2. **Nhìn được vào TRONG.** Từ trên cao thì một căn phòng không mái là một căn phòng mở
 *    ra — và đó là chỗ quản gia sống, đi lại, ăn uống, tập thể dục.
 *
 * Cái giá phải trả: hình đẳng cự vẽ tay thì sai hình học rất dễ mà rất khó thấy — lệch một
 * ô ở cạnh mái là cả khối trông như bị vênh, và mắt chỉ báo "sai sai" chứ không chỉ ra chỗ.
 * Nên HÌNH HỌC ở đây được DỰNG chứ không chép tay (xem `diamond`, `box`, `backWall`,
 * `panel`, `rim`), còn tay chỉ vẽ mấy chi tiết đè lên.
 *
 * ## Độ phân giải: cùng lưới 4px, nhiều Ô HƠN
 *
 * Bản trước mỗi cửa hàng là một khối 12 ô ngang và nhà là 36 ô. Ở cỡ ấy một mái nhà chỉ có
 * chỗ cho đúng một màu: không đủ ô để có đường bờ mái, có diềm, có một ô cửa nghiêng đúng
 * độ dốc. Cửa hàng nở lên 20 ô, thư viện 24, nhà 44 — tức số ô trên cùng một vật gấp rưỡi
 * tới gấp đôi, và đó chính là nghĩa của "phân giải cao hơn" trên một lưới cố định.
 *
 * Cái giá đo được: màn Cửa hàng đi từ 1792 ô lên 4085 ô rồi lên 4710 ô sau lượt phóng to
 * 5/8 — 97KB → 213KB → 245KB, và một lượt dựng lại từ 4,8ms lên 28ms rồi 46ms (đo trên máy
 * này). Nhịp một giây chỉ chạy khi có việc đang làm, tức vài phút mỗi lần, nên 46ms là 5%
 * một lõi trong quãng ấy — chấp nhận được, và nó là lý do đường với cỏ KHÔNG được phép
 * cũng là pixel.
 *
 * KHÔNG hạ ô xuống 2px, dù đó là cách hiển nhiên hơn. Hai lý do, và cả hai đều nặng: (1)
 * quản gia ở popover, đồ ăn, đồng xu đều là lưới 4px, mà cái dải "đang làm" bày một món ăn
 * đứng ngay cạnh bản đồ — hai cỡ ô trong một màn hình đọc thành hai bức tranh dán cạnh
 * nhau; (2) ô 2px là gấp bốn số thẻ `<i>` cho cùng một diện tích, mà chỗ này đã là phần
 * nặng nhất của cả trang và nó dựng lại mỗi giây khi có việc đang chạy.
 *
 * ## Đường xá
 *
 * Đường KHÔNG vẽ bằng pixel, nó là CSS — xem `.town-road` trong `styles.css` và `ROADS` ở
 * cuối file này. Lý do cùng lý do đã ghi cho mặt đất: đường là MẶT ĐẤT, không phải vật đứng
 * trên đất. Bốn đoạn phủ 1696×40px, tức **hơn bốn nghìn** thẻ `<i>` nữa nếu vẽ bằng pixel —
 * gấp đôi toàn bộ số ô đang có trên màn hình, cho một thứ không ai bấm vào. Bốn thẻ `div`
 * bị lệch trục 26,57° làm đúng việc ấy, và độ dốc thì lấy từ chính cái lưới nên chúng
 * không lệch đi đâu được.
 *
 * ## Bảng màu
 *
 * Mượn nguyên bảng `--art-*` của `.pet-art` (xem `styles.css`), nên mỗi toà nhà bọc trong
 * đúng class ấy. Không món nào mượn màu BĂNG, cùng luật đã ghi cho đồ vật.
 *
 * Mỗi toà nhà khác nhau ở BA kênh chứ không chỉ ở màu mái: dáng ngoài (ống khói / cột cờ /
 * mái vòm / một tán cây), màu mái, và cái biển tên chữ bên dưới. Theme daltonized làm màu
 * mái hết phân biệt, và lúc ấy dáng với chữ vẫn còn nguyên.
 *
 * Hai vách của mọi khối thì NGƯỢC LẠI — chúng cố ý giống hệt nhau ở mọi toà nhà: vách
 * hứng nắng sáng (`foam`), vách khuất tối (`dim`). Đó là cái nói "cùng một mặt trời, cùng
 * một thị trấn"; cho mỗi nhà một kiểu đổ sáng riêng là năm bức tranh dán cạnh nhau.
 */

import { html } from './dom.js';
import { pixels } from './pixel.js';
import { BUTLER_CHARS, BUTLER_H, BUTLER_W, butlerHand, butlerRows, doingArt, poseOf } from './pet.js';
import { whereOf } from './petmath.js';

/* ── Hình học đẳng cự ──────────────────────────────────────────────────────────
   Năm hàm dựng nên mọi khối trong thị trấn. Chúng chỉ biết ĐỘ DỐC 2:1 — mỗi hàng xuống
   thì cạnh chạy ngang hai ô — và mọi thứ khác suy ra từ đó. */

/**
 * Hình thoi đẳng cự: rộng `w` ô, cao `w/2` ô. `w` phải chia hết cho 4.
 *
 * Đây là mặt phẳng nằm ngang trong phối cảnh này — nền nhà, mặt mái, ô đất. Nửa trên nở ra
 * bốn ô mỗi hàng, nửa dưới thu lại đúng như thế, nên hai hàng giữa cùng rộng tối đa. Cái
 * "hai hàng giữa" ấy không phải lỗi làm tròn: thiếu nó thì đỉnh trái và đỉnh phải rơi vào
 * giữa hai hàng, và cạnh dưới lệch nửa ô so với cạnh trên.
 */
function diamond(w, ch = '#') {
  const h = w / 2;
  return Array.from({ length: h }, (_, i) => {
    const j = i < h / 2 ? i : h - 1 - i;
    const run = 4 * (j + 1);
    const pad = (w - run) / 2;
    return '.'.repeat(pad) + ch.repeat(run) + '.'.repeat(pad);
  });
}

/**
 * Khối hộp đẳng cự: mặt trên là một hình thoi rộng `w`, hai vách trước cao `tall` hàng.
 *
 * Bóng của khối dựng bằng phép hợp: một ô là thân nếu có ô nào của mặt trên nằm ĐÚNG trên
 * nó trong vòng `tall` hàng. Đó là định nghĩa của một khối bị kéo thẳng xuống, và nó tự
 * cho ra cả cạnh đứng hai bên lẫn cạnh dưới hình thoi mà không phải kể ra ca nào.
 */
function box(w, tall, top = 'R', left = 'L', right = 'W') {
  const d = diamond(w);
  const h = w / 2;
  const rows = [];
  for (let r = 0; r < h + tall; r++) {
    let line = '';
    for (let c = 0; c < w; c++) {
      const onTop = r < h && d[r][c] !== '.';
      let solid = onTop;
      for (let k = 1; k <= tall && !solid; k++) solid = r - k >= 0 && r - k < h && d[r - k][c] !== '.';
      line += onTop ? top : solid ? (c < w / 2 ? left : right) : '.';
    }
    rows.push(line);
  }
  return rows;
}

/**
 * Vách SAU của một căn phòng không mái: cạnh trên của nền dựng đứng lên `tall` hàng.
 *
 * Khác `box` ở chỗ nó dựng đúng hai bức tường mà từ trên cao ta nhìn thấy MẶT TRONG, chứ
 * không phải cái vỏ ngoài của một khối đặc. Đây là toàn bộ chỗ "nhìn thấy bên trong nhà"
 * sống: bỏ mái đi thì căn phòng mở ra, mà bỏ luôn hai vách trước thì nó mở ra về phía người
 * xem — cái nhìn quen thuộc của mọi trò chơi đẳng cự.
 *
 * Mỗi hàng của mặt vách là một đoạn LIỀN, không phải một bậc thang rời: cạnh nền tụt hai ô
 * mỗi hàng, và mỗi ô cạnh dày hai ô, nên các bậc chồng khít lên nhau khi kéo lên.
 *
 * `mirror` lật sang vách bên kia. Lật chuỗi chứ không viết một nhánh thứ hai: hai vách là
 * ảnh gương của nhau, và một bản chép tay của phép đối xứng là bản sẽ lệch.
 *
 * `foot` là đường CHÂN TƯỜNG, và nhìn màn hình thật thì đây là chi tiết quyết định: sàn gỗ
 * và vách khuất chỉ chênh nhau một bậc sáng, và không có đường nào chia chúng ra thì cả căn
 * phòng đọc thành một cái gò chứ không đọc thành phòng.
 */
function backWall(w, tall, ch, mirror = false, foot = ch) {
  const top = w / 4;
  const edge = (r) => Math.max(0, w / 2 - 2 - 2 * r);
  const rows = [];
  for (let R = -tall; R <= top; R++) {
    const lo = Math.max(0, R);
    const hi = Math.min(top, R + tall);
    const a = edge(hi);
    const b = edge(lo) + 1;
    const skirt = R >= 0 ? 2 : 0;
    const line =
      '.'.repeat(a) + ch.repeat(b - a + 1 - skirt) + foot.repeat(skirt) + '.'.repeat(w - b - 1);
    rows.push(mirror ? [...line].reverse().join('') : line);
  }
  return rows;
}

/**
 * Một mảng chữ nhật NẰM TRONG mặt vách — ô cửa sổ, cánh cửa, bức tranh, tấm biển.
 *
 * Trong phối cảnh này một hình chữ nhật dán lên tường không còn là chữ nhật: cạnh ngang của
 * nó phải nghiêng theo tường (một hàng cho mỗi hai ô), còn cạnh đứng thì vẫn đứng. Vẽ tay
 * thì đây đúng là chỗ sai nhiều nhất — một ô cửa sổ VUÔNG trên một bức tường nghiêng là chỗ
 * mắt bắt lỗi phối cảnh nhanh nhất, nhanh hơn cả một mái nhà lệch.
 *
 * `dir` là chiều nghiêng: `+1` cho mặt chạy xuống về bên phải (vách phải của một khối hộp,
 * vách sau bên phải của căn phòng), `-1` cho mặt kia.
 */
function panel(w, h, ch, dir = 1) {
  const H = h + Math.floor((w - 1) / 2);
  const grid = Array.from({ length: H }, () => Array.from({ length: w }, () => '.'));
  for (let j = 0; j < w; j++) {
    const t = dir > 0 ? Math.floor(j / 2) : Math.floor((w - 1 - j) / 2);
    for (let i = 0; i < h; i++) grid[t + i][j] = ch;
  }
  return grid.map((r) => r.join(''));
}

/**
 * Viền: ô nào mang một trong các ký tự `from` mà KHÔNG có ô cùng loại ở hướng `(dy, dx)`
 * thì đổi sang `to`.
 *
 * Đây là chỗ "vẽ đẹp hơn" rẻ nhất trong cả file, và nó rẻ vì nó không vẽ gì cả — nó đọc
 * chính cái hình đã dựng rồi tô lại đúng mấy ô ở mép. Ba đường sinh ra từ nó, và mỗi đường
 * trả lời một câu:
 *
 * - **Bờ mái** (`R`, không có mái ở TRÊN) — tách mái ra khỏi nền cỏ. Thiếu nó thì một mái
 *   xanh lá đứng trên cỏ xanh lá là một vệt loang.
 * - **Diềm mái** (`R`, không có mái ở DƯỚI) — tách mái ra khỏi vách. Đây là đường mà mắt
 *   dùng để đọc ra "cái này có mái", và nó phải tối hơn cả hai bên.
 * - **Chân tường** (`L`/`W`, không có vách ở DƯỚI) — dán toà nhà xuống đất. Thiếu nó thì
 *   nhà trông như đang lơ lửng vài pixel trên cỏ, một cảm giác không ai chỉ ra được nhưng
 *   ai cũng thấy.
 *
 * Cùng lý lẽ với `shadeOf` bên `pixel.js`: bóng suy ra từ hình, không chép tay — sửa hình
 * một dòng là mọi đường viền tự đi theo.
 */
function rim(rows, from, to, dy, dx = 0) {
  const at = (y, x) => (rows[y] ?? '')[x] ?? '.';
  return rows.map((row, y) =>
    [...row].map((c, x) => (from.includes(c) && !from.includes(at(y + dy, x + dx)) ? to : c)).join(''),
  );
}

const blank = (w, h) => Array.from({ length: h }, () => '.'.repeat(w));
const solid = (w, h, ch) => Array.from({ length: h }, () => ch.repeat(w));

/** Đè `art` lên `base` tại `(x, y)`. Ký tự `.` là trong suốt, nên chi tiết vẽ tay chỉ cần
 *  khai đúng chỗ nó chạm vào — phần còn lại để hình học dựng sẵn lộ ra. */
function stamp(base, art, x, y) {
  const out = base.map((r) => [...r]);
  art.forEach((row, ry) => {
    [...row].forEach((c, rx) => {
      if (c === '.') return;
      const Y = y + ry;
      const X = x + rx;
      if (out[Y] && X >= 0 && X < out[Y].length) out[Y][X] = c;
    });
  });
  return out.map((r) => r.join(''));
}

/** Đè nhiều lớp một lượt. `[art, x, y]` mỗi lớp, theo đúng thứ tự vẽ. */
const layers = (base, ...arts) => arts.reduce((acc, [art, x, y]) => stamp(acc, art, x, y), base);

/**
 * Đè `art` lên `base`, nhưng CHỈ ở những ô mà `base` đang mang một trong các ký tự `onto`.
 *
 * Đây là cái giữ cho mọi chi tiết mặt tiền nằm đúng trên mặt tiền. Vẽ tay một ô cửa lên một
 * bức vách nghiêng thì lỗi thường gặp không phải là nó xấu, mà là nó THÒ RA — một góc cửa
 * đậu lên nền cỏ, hoặc một tấm mái hiên chạy quá mép nhà bốn ô. Ở cỡ 12 ô của bản trước thì
 * nhìn ra ngay; ở cỡ 20–24 ô thì nó lẫn vào, và mắt chỉ báo "toà nhà này trông sai sai".
 *
 * Đắp có mặt nạ thì lỗi ấy không xảy ra được: cái mặt nạ CHÍNH LÀ hình đã dựng, nên chi
 * tiết không thể ra ngoài cái hình mà nó đang trang trí. Đổi lại phải gọi nó SAU `edged` —
 * mấy đường viền lúc ấy đã là `k` chứ không còn là `L`/`W`, nên chúng nằm ngoài mặt nạ và
 * không bị một cánh cửa xoá mất.
 */
function inlay(base, art, x, y, onto) {
  return base.map((row, Y) =>
    [...row]
      .map((c, X) => {
        const s = (art[Y - y] ?? '')[X - x] ?? '.';
        return s !== '.' && onto.includes(c) ? s : c;
      })
      .join(''),
  );
}

/** Như `layers` nhưng mọi lớp đều đi qua mặt nạ. Dùng cho chi tiết MẶT TIỀN. */
const facade = (base, onto, ...arts) => arts.reduce((acc, [art, x, y]) => inlay(acc, art, x, y, onto), base);

/**
 * Một dải nằm trên mặt đất, chạy theo một trục của lưới: `n` hàng, dày `w` ô.
 *
 * Mỗi hàng xuống thì dải chạy ngang hai ô — đúng độ dốc 2:1, cùng một câu mà `diamond` và
 * `box` đang nói. Lối đi trong công viên dựng bằng nó, và nó phải dựng chứ không vẽ tay vì
 * một lối đi lệch độ dốc là vật duy nhất trên bãi cỏ không theo phối cảnh.
 */
function lane(n, w, ch, dir = 1) {
  const W = 2 * (n - 1) + w;
  return Array.from({ length: n }, (_, r) => {
    const s = dir > 0 ? 2 * r : 2 * (n - 1 - r);
    return '.'.repeat(s) + ch.repeat(w) + '.'.repeat(W - s - w);
  });
}

/** Đặt một vật ĐỨNG trên mặt đất: `(cx, cy)` là chỗ chân nó chạm đất, không phải góc trên
 *  trái của khung. Mọi cây, ghế, đèn trong file này khai chỗ đứng kiểu ấy — một cái cây
 *  khai bằng góc khung là một cái cây sẽ trôi mỗi lần sửa tán lá. */
const put = (art, cx, cy) => [art, cx - Math.floor(art[0].length / 2), cy - art.length + 1];

/**
 * Ba đường viền của một khối hộp, gọi thành một cụm.
 *
 * Luôn đi cùng nhau và luôn theo đúng thứ tự này: bờ mái trước (nó đọc `R` khi `R` còn
 * nguyên), rồi diềm, rồi chân tường. Đảo thứ tự thì lượt sau đọc phải mấy ô vừa bị lượt
 * trước đổi tên, và đường viền dày lên gấp đôi ở đúng mấy chỗ hai đường gặp nhau.
 */
const boxed = (w, tall, top = 'R', left = 'L', right = 'W') => {
  const b = box(w, tall, top, left, right);
  return rim(rim(rim(b, top, 'k', -1), top, 'k', 1), left + right, 'k', 1);
};

/**
 * Tô một đa giác LỒI lên lưới đang có, đỉnh khai bằng toạ độ pixel (cho phép số lẻ).
 *
 * Thêm vào cùng lượt với mái chóp, và nó là hàm dựng hình duy nhất trong file không suy ra
 * từ độ dốc 2:1 — vì mái chóp là vật đầu tiên trong thị trấn có cạnh KHÔNG nằm trên một
 * trục nào của lưới: hai cạnh dốc của nó chạy 1:1, tức đường thẳng nối một góc mặt thoi lên
 * đỉnh chóp. `diamond`, `lane`, `panel` đều không kẻ được đường ấy.
 *
 * Chiều quay của các đỉnh KHÔNG quan trọng: hàm tự đọc dấu của diện tích rồi lật phép thử
 * theo. Bắt chỗ gọi phải nhớ chiều kim đồng hồ là mời một lỗi câm — đa giác quay ngược thì
 * ra một mảng trống, không ra một thông báo nào.
 */
function poly(grid, pts, ch) {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % n];
    area += ax * by - bx * ay;
  }
  const s = area >= 0 ? 1 : -1;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      let ok = true;
      for (let i = 0; i < n && ok; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % n];
        ok = s * ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) >= 0;
      }
      if (ok) grid[y][x] = ch;
    }
  }
}

/**
 * Mái CHÓP: bốn dốc chụm lên một đỉnh nằm trên tâm mặt thoi rộng `w`, nhô `rise` hàng.
 *
 * ## Vì sao mái chóp chứ không phải mái dốc hai mặt
 *
 * Mái dốc hai mặt (sống mái chạy theo một trục nền) là hình quen hơn, và nó đã được dựng
 * thử trước. Nó KHÔNG dùng được ở phối cảnh này, vì một lý do đo được: trong phép chiếu
 * đang dùng, một bước lưới nền đi (2, 1) pixel còn một đơn vị cao đi (0, −1) pixel, nên mặt
 * dốc phía xa quay lưng lại người xem ngay khi sống mái nhô quá `w/4` hàng. Dưới ngưỡng ấy
 * mái gần như phẳng — đúng cái hình mà cả lượt này sinh ra để bỏ. Trên ngưỡng ấy mặt xa
 * biến mất và cái còn lại đọc thành một mái LỆCH một bên, không đọc thành mái nhà.
 *
 * Mái chóp không có ngưỡng ấy: hai mặt nhìn thấy được là hai mặt TRƯỚC, và chúng quay về
 * phía người xem ở mọi độ cao. Nhô bao nhiêu cũng còn là một cái chóp.
 *
 * ## Vì sao nó tự phủ kín mặt thoi bên dưới
 *
 * Bóng của mái là tứ giác `W → đỉnh → E → S`, mà tứ giác ấy LỒI và chứa cả bốn góc của mặt
 * thoi (góc sau `N` nằm gọn bên trong). Nên chỗ gọi cứ dựng khối bằng `boxed` như mọi toà
 * nhà khác rồi đè mái lên: không có ô nào của mặt thoi cũ thò ra ngoài mái.
 */
function hip(w, rise, lit = 'R', shade = 'T') {
  const left = [-1, (w - 2) / 4];
  const right = [w, (w - 2) / 4];
  const front = [(w - 1) / 2, (2 * w - 1) / 4];
  const peak = [(w - 1) / 2, (w - 2) / 4 - rise];
  const top = Math.ceil(-peak[1]);
  const g = Array.from({ length: Math.ceil(front[1]) + top + 1 }, () => Array(w).fill('.'));
  const P = (p) => [p[0], p[1] + top];
  poly(g, [left, peak, front].map(P), lit);
  poly(g, [peak, right, front].map(P), shade);
  let rows = g.map((r) => r.join(''));
  // Bờ mái trên, diềm dưới, rồi SỐNG GIỮA hai mặt dốc — cái thứ ba là đường quyết định:
  // hai mặt chỉ chênh nhau một bậc sáng, và không có đường chia thì cái chóp đọc thành một
  // mảng loang chứ không đọc thành hai mặt gặp nhau.
  rows = rim(rows, lit + shade, 'k', -1);
  rows = rim(rows, lit + shade, 'k', 1);
  rows = rim(rows, shade, 'k', 0, -1);
  return { rows, top };
}

/* ── Ba cửa hàng ───────────────────────────────────────────────────────────────
   Cùng khung 32×42 ô (128×168px), khác nhau ở DÁNG MÁI trước, ở chi tiết mặt tiền sau.
   Chung khung là cố ý: chúng đứng trên cùng một mặt đất, nên chân chúng phải rơi vào cùng
   một hàng — lệch một ô là một toà nhà lún xuống đất.

   Hàng CUỐI của khung phải là hàng cuối của mặt nền, không được thừa một hàng trống nào:
   `.place-art` neo đáy-giữa, nên một hàng trống ở dưới là cả toà nhà nhấc lên 4px.

   ## Lượt này sửa MÁI, không sửa mặt tiền

   Người dùng báo thẳng: nhìn ba toà nhà mà không đọc ra cái nào là quán ăn, cái nào là
   tiệm trang trí, cái nào là thư viện. Bản trước có ba kênh phân biệt ghi ngay trong chú
   thích — dáng ngoài, màu mái, biển tên — và đo ra thì hai trong ba kênh ấy gần như không
   chở gì:

   - **Dáng ngoài** chỉ khác nhau ở mấy vật CẮM THÊM: ống khói 5×10px, cột cờ 5×40px, mái
     vòm 36×32px. Trên một sprite 128×136px thì đó là mấy cái mụn, không phải cái dáng.
     Thân của cả ba là đúng MỘT khối — mặt thoi phẳng trên hai vách — và hai trong ba cái
     còn rộng bằng nhau, lệch nhau đúng hai hàng vách. Nhìn từ xa thì chúng là một hình.
   - **Biển tên** nằm dưới đáy và đè trúng chỗ có cửa, tức chỗ duy nhất mặt tiền đang nói
     điều gì đó thì bị chính cái tên che.

   Còn lại đúng MÀU MÁI. Mà màu mái là kênh mà theme daltonized bóp phẳng, và cũng đúng cái
   kênh mà chú thích cũ hứa là sẽ không phải kênh quyết định.

   Nên lượt này đổi thứ chiếm nửa diện tích mỗi sprite: **mặt mái**. Ba dáng, không phải ba
   màu:

   - **Quán ăn** — mái CHÓP dốc, chìa ra, ống khói bốc khói. Nói: có người đang nấu ở trong.
   - **Tiệm trang trí** — mái BẰNG lõm trong một vành lan can, có chậu cây bày trên nóc, mặt
     tiền là một dải kính chạy suốt. Nói: một chỗ bày đồ.
   - **Thư viện** — đứng trên BỆ ĐÁ rộng, hàng cột, tang trống và mái vòm. Nói: nhà công.

   Ba dáng ấy đọc được ở cỡ 40px và đọc được cả khi in đen trắng — chúng là SILHOUETTE.
   Màu mái giữ nguyên như cũ (hồng / tím / lam), vì đổi màu không chữa được gì: ba màu ấy
   vốn đã phân biệt được, cái không phân biệt được là màu nào nghĩa là gì.

   ## Cỡ khung: 34 → 42 hàng

   Mái chóp nhô 4 hàng trên mặt thoi, ống khói với cột khói xin thêm 10, và bệ đá của thư
   viện ăn 4 hàng dưới đáy. Khung cũ hết chỗ. `TOWN_BOX` tự nuốt phần cao thêm nên không có
   con số nào bên `styles.css` phải sửa theo — đó đúng là lý do nó được TÍNH RA thay vì
   viết cứng. */

const SHOP_W = 32;
/** Góc trên-trái của khối trong khung cao `h`, và `foot` là số hàng chừa lại DƯỚI chân khối
 *  cho một cái bệ. Mọi chi tiết khai theo cặp này chứ không khai bằng số tuyệt đối: một toạ
 *  độ tuyệt đối là một con số chỉ đúng cho đúng một cỡ, và cả khối này vừa đổi cỡ lần nữa. */
const shopAt = (h, w, tall, foot = 0) => ({ x: (SHOP_W - w) / 2, y: h - foot - w / 2 - tall });
const SHOP = (h, w, tall, foot = 0) => {
  const o = shopAt(h, w, tall, foot);
  return stamp(blank(SHOP_W, h), boxed(w, tall), o.x, o.y);
};

/**
 * Một DẢI ôm lấy chân mái: `n` hàng ngay dưới mép mặt thoi rộng `w`, ở MỌI cột.
 *
 * Đây là hình mà lượt này dùng nhiều nhất, và nó sinh ra từ một lỗi lặp lại ba lần trong
 * bản nháp: mái hiên, dải kính và đường gờ mái đều được vẽ bằng `solid(w, n)` — một hình
 * chữ nhật. Trên màn hình thì cả ba đọc thành một thanh NGANG dán lên một bức tường
 * nghiêng, đúng cái lỗi mà chú thích của `panel` đã gọi tên là chỗ mắt bắt phối cảnh nhanh
 * nhất. Một dải chạy quanh nhà phải bám đúng chữ V của chân mái, mà chữ V ấy đã có sẵn
 * trong `box`: hai vách của một khối cao `n` hàng CHÍNH LÀ dải ấy.
 *
 * Chỗ gọi dời dải xuống bằng cách đặt nó thấp hơn `d` hàng so với mặt thoi — vì dải bám
 * theo chân mái nên dời cả dải xuống `d` hàng là dời nó xuống đúng `d` hàng dưới chân mái ở
 * MỌI cột, không phải chỉ ở cột giữa.
 */
const band = (w, n, ch) => box(w, n, '.', ch, ch);

/**
 * Ô cửa sổ / cánh cửa: khung tối bọc ngoài, lòng sáng bên trong, dựng SẴN thành một sprite
 * rồi mới đắp lên nhà.
 *
 * Dựng sẵn chứ không đắp từng lớp qua mặt nạ, và đây là một cái bẫy đã sập một lần: mặt nạ
 * chỉ nhận `L`/`W`, nên lớp thứ hai của cùng một ô cửa rơi trúng lớp thứ nhất và bị chặn
 * sạch — cái nẹp cửa sổ biến mất mà không có lỗi nào. Gộp thành một hình rồi đắp MỘT lần
 * thì bên trong nó muốn chồng bao nhiêu lớp cũng được, còn mặt nạ vẫn làm đúng việc của nó
 * ở mép ngoài.
 *
 * `dir` phải khớp với VÁCH: vách TRÁI của một khối hộp có mép trên chạy xuống về bên phải,
 * nên nó là `+1`; vách phải chạy ngược lại, nên nó là `-1`. Bản trước gán ngược cả hai, và
 * lỗi ấy nằm im được vì mặt nạ cắt gọn phần thò ra — cái còn lại vẫn là một ô cửa, chỉ
 * nghiêng ngược chiều bức tường nó đang nằm trên. (Vách SAU của nhà mình thì ngược lại lần
 * nữa, và chỗ ấy vốn đã đúng: mép trên của vách sau-trái chạy LÊN về bên phải.)
 */
const opening = (w, h, dir, outer, inner) =>
  layers(blank(w, h + Math.floor((w - 1) / 2)), [panel(w, h, outer, dir), 0, 0], [panel(w - 2, h - 2, inner, dir), 1, 1]);

/** Sọc: đổi màu theo `(x + y) mod 4`, tức sọc chạy ĐÚNG độ dốc của vách. Một dãy sọc vẽ
 *  tay lệch nửa ô thì cả tấm bạt trông như bị gấp. */
const stripe = (rows, a, b) =>
  rows.map((r, y) => [...r].map((c, x) => (c === '.' ? c : (x + y) % 4 < 2 ? a : b)).join(''));

/**
 * Quán ăn: mái CHÓP dốc, ống khói bốc khói, mái hiên sọc chạy quanh chân mái.
 *
 * ## Mái chóp
 *
 * Đây là toà nhà duy nhất trong thị trấn không có mặt mái phẳng, và nó phải là toà nhà ấy:
 * "có người đang nấu ở trong" là câu mà một cái mái nhọn với một ống khói nói được bằng
 * hình, còn hai câu kia — chỗ bày đồ, nhà công — không cần cái mái nhọn, mà cái mái bằng
 * với cái mái vòm lại nói giúp chúng.
 *
 * Mái chìa ra hai ô mỗi bên: dựng bằng `hip` trên một mặt thoi RỘNG HƠN 4 ô rồi lùi lại
 * hai ô. Cái chìa không phải chuyện thẩm mỹ — nó là thứ tách "toà nhà CÓ MÁI" khỏi "khối
 * hộp sơn hai màu", vì nó cho một đường bóng chạy vòng quanh, và ở cỡ này một đường bóng
 * dễ đọc hơn một sắc màu.
 *
 * ## Khói, và vì sao nó là chi tiết đắt nhất mà vẫn đáng
 *
 * Ống khói với cột khói cao 18 hàng trên đỉnh mái — một mình chúng xin 40% chiều cao của cả
 * khung, và chính chúng là lý do khung phải nới từ 34 lên 42. Đắt. Đáng, vì khói là thứ DUY
 * NHẤT trên bản đồ BỐC LÊN: bốn toà nhà kia, ô đất, cây cối, đèn đường đều là vật đứng yên
 * có mép cứng. Một vệt mờ toả lên giữa một màn hình toàn mép cứng thì mắt bắt được trước
 * cả khi kịp đọc hình dạng — nhanh hơn mọi tấm biển.
 *
 * Ống khói cắm LỆCH sang mặt dốc khuất chứ không cắm vào đỉnh: đặt trúng đỉnh thì nó với
 * cái sống mái chồng lên nhau và cả hai cùng mất.
 */
const FOOD_H = 40;
const FOOD_W = 24;
const FOOD_TALL = 14;
const FOOD_AT = shopAt(FOOD_H, FOOD_W, FOOD_TALL);
/** Hàng đầu tiên của VÁCH, tức ngay dưới chân mái. Mọi chi tiết mặt tiền đo từ đây, vì
 *  chúng thuộc về cái vách chứ không thuộc về cái khung. */
const FOOD_EAVE = FOOD_AT.y + FOOD_W / 2;
const FOOD_ROOF = hip(FOOD_W + 4, 10);
/** Mái hiên sọc, bốn hàng, có gấu tối. Nó bám chân mái CHÌA chứ không bám chân vách, nên
 *  nó dựng trên cùng bề rộng với mái và đặt cùng chỗ với mái. */
const FOOD_AWN = rim(stripe(band(FOOD_W + 4, 4, '#'), 'a', 'f'), 'af', 'k', 1);
const FOOD = layers(
  facade(
    layers(
      SHOP(FOOD_H, FOOD_W, FOOD_TALL),
      [FOOD_ROOF.rows, FOOD_AT.x - 2, FOOD_AT.y - FOOD_ROOF.top],
      [['kkkkkk', 'knnnnk', 'kkkkkk', '.knnk.', '.knnk.', '.knnk.', '.knnk.', '.knnk.', '.knnk.', '.knnk.', '.knnk.'], FOOD_AT.x + 14, FOOD_AT.y - FOOD_ROOF.top - 5],
      // Ba cụm khói to dần và lệch dần sang một bên. Khói bay thẳng đứng đọc thành một cái
      // cột thứ hai, không đọc thành khói.
      [['..ssss..', '.ssssss.', 'ssssss..', '.ssss...', '..ss....'], FOOD_AT.x + 13, FOOD_AT.y - FOOD_ROOF.top - 10],
    ),
    'LW',
    // Cửa sổ sáng đèn trên vách trái, có nẹp chia đôi — hai ô cửa nhỏ đọc ra là cửa sổ
    // nhanh hơn một ô lớn, vốn dễ đọc thành một tấm biển.
    [layers(opening(10, 5, 1, 'k', 'g'), [panel(1, 3, 'k', 1), 5, 1]), FOOD_AT.x + 2, FOOD_EAVE + 5],
    // Cửa ra vào ở vách phải, có tay nắm.
    [layers(opening(6, 6, -1, 'k', 'd'), [['g'], 3, 4]), FOOD_AT.x + 15, FOOD_EAVE + 6],
  ),
  // Mái hiên đè SAU mặt nạ, vì nó cố ý thò ra ngoài vách — đi qua mặt nạ là mất đúng cái
  // phần làm nên chữ "chìa".
  [FOOD_AWN, FOOD_AT.x - 2, FOOD_AT.y],
);

/**
 * Tiệm trang trí: mái BẰNG lõm trong một vành lan can, chậu cây bày trên nóc, mặt tiền là
 * một dải kính chạy suốt hai vách.
 *
 * ## Vì sao lan can, và vì sao lõm
 *
 * Một mặt thoi phẳng KHÔNG nói được nó là mái bằng — nó là cái hình mà mọi khối hộp đều có,
 * kể cả khối chưa ai gọi là nhà. Cái nói ra là mặt mái LÕM XUỐNG so với mép: có vành nghĩa
 * là có lan can, có lan can nghĩa là người lên được, mà người lên được nghĩa là mặt ấy
 * phẳng và có ích. Hai chậu cây đứng trong lòng vành nói nốt phần còn lại — đây là tiệm bán
 * đồ bày, và món nó bày thì bày ngay trên nóc.
 *
 * Bản nháp làm lan can bằng hàng cột thưa dựng trên mép trước. Nhìn màn hình thì nó là một
 * vệt lốm đốm: mép trước tụt hai ô mỗi hàng, nên "cột cách một ô" rơi thành một ô sáng một
 * ô tối chạy chéo — đúng cái hoạ tiết mà mắt đọc thành nhiễu. Mặt lõm không có chỗ nào để
 * mà lốm đốm, vì nó là hai hình thoi lồng nhau, cùng phép đã dựng tấm thảm trong nhà.
 *
 * ## Mặt kính chạy suốt
 *
 * Bản trước có một ô kính lớn ở vách trái và một cánh cửa ở vách phải, tức mỗi vách một
 * chuyện. Giờ dải kính vắt qua CẢ HAI vách như một tủ trưng bày thật: đó là chi tiết duy
 * nhất trong ba toà nhà nói "chỗ này bày đồ cho người đi đường nhìn", và nó chỉ nói được
 * khi nó liền một dải — một ô kính vuông trên một vách thì đọc thành cửa sổ nhà ở.
 *
 * Nẹp kính kẻ ĐỨNG chứ không kẻ theo độ dốc, và đó không phải bỏ sót: nẹp là thanh đứng
 * trong đời thật, mà một thanh đứng thì chiếu lên màn hình vẫn đứng. Sọc mái hiên bên quán
 * ăn thì ngược lại — nó nằm trên mặt vải áp vào tường, nên nó phải nghiêng theo tường.
 */
const DECOR_H = 28;
const DECOR_W = 24;
const DECOR_TALL = 16;
const DECOR_AT = shopAt(DECOR_H, DECOR_W, DECOR_TALL);
const DECOR_EAVE = DECOR_AT.y + DECOR_W / 2;
/** Mặt mái LÕM trong một vành lan can: hai hình thoi lồng nhau, cùng phép đã dựng tấm thảm
 *  trong nhà — vẽ tay một hình thoi rộng 16 ô thì sai một ô là nó đọc thành vũng nước. */
const DECOR_TOP = stamp(
  rim(rim(diamond(DECOR_W, 'R'), 'R', 'k', -1), 'R', 'k', 1),
  rim(diamond(DECOR_W - 8, 'f'), 'f', 'k', -1),
  4,
  2,
);
/** Dải kính: nẹp đứng cứ bốn ô một, khung tối trên dưới. */
const DECOR_GLASS = (() => {
  const framed = rim(rim(band(DECOR_W, 8, 's'), 's', 'k', -1), 's', 'k', 1);
  return framed.map((row) => [...row].map((c, x) => (c === 's' && x % 6 === 0 ? 'f' : c)).join(''));
})();
/** Chậu cây trên mái — nhỏ hơn hẳn cây ngoài phố, và phải nhỏ: một tán cây cỡ thật đứng
 *  trên nóc thì nó là cái cây mọc xuyên qua nhà, không phải chậu cảnh. */
const DECOR_POT = ['.vvv.', 'vvvvv', '.vvv.', '.ddd.', 'kdddk'];
/** Chậu cây ĐỨNG DƯỚI ĐẤT hai bên cửa — món hàng bày ra vỉa hè, và là thứ duy nhất trong
 *  ba toà nhà tràn ra ngoài bức tường của nó. Một tiệm bày đồ mà không bày gì ra ngoài thì
 *  nó vẫn chỉ là một cái hộp có cửa kính. */
const DECOR_YARD = ['..vv.', '.vvvv', 'vvvv.', '.dd..', 'kddk.'];
const DECOR = layers(
  facade(
    layers(
      SHOP(DECOR_H, DECOR_W, DECOR_TALL),
      [DECOR_TOP, DECOR_AT.x, DECOR_AT.y],
      [DECOR_POT, DECOR_AT.x + 7, DECOR_AT.y + 3],
      [DECOR_POT, DECOR_AT.x + 13, DECOR_AT.y + 5],
    ),
    'LW',
    [DECOR_GLASS, DECOR_AT.x, DECOR_AT.y + 2],
    // Món đang bày trong tủ: một chậu cây bên trái, một ngọn đèn bên phải. Chúng là lý do
    // cái tủ kính có nghĩa — một tủ kính rỗng thì vẫn chỉ là một ô cửa sổ dài.
    [['.vv.', 'vvvv', '.dd.'], DECOR_AT.x + 4, DECOR_EAVE + 5],
    [['gggg', '.kk.', '.kk.'], DECOR_AT.x + 18, DECOR_EAVE + 7],
    // Cửa ở vách phải, có tay nắm.
    [layers(opening(6, 5, -1, 'k', 'd'), [['g'], 3, 3]), DECOR_AT.x + 15, DECOR_EAVE + 11],
  ),
  [DECOR_YARD, DECOR_AT.x + 4, DECOR_AT.y + 21],
  [DECOR_YARD, DECOR_AT.x + 16, DECOR_AT.y + 21],
  // Biển hiệu CHÌA NGANG ra khỏi vách trái, treo trên một cái giá. Nó cố ý nằm ngoài mặt
  // nạ: một tấm biển ốp phẳng vào tường là một vệt sơn, còn một tấm biển thò ra là thứ
  // người đi trên phố đọc được từ bên hông — và đó là toàn bộ việc của một tấm biển.
  [['kkkkk', '.kk..'], DECOR_AT.x - 4, DECOR_EAVE + 3],
  [['kkkk', 'kggk', 'kggk', 'kggk', 'kkkk'], DECOR_AT.x - 4, DECOR_EAVE + 5],
);

/**
 * Thư viện: khối đứng trên một BỆ ĐÁ rộng, hàng cột có khe tối, tang trống và mái vòm.
 *
 * ## Bệ đá — cái mới, và cái quyết định
 *
 * Bốn chỗ kia mọc thẳng từ cỏ. Thư viện thì đứng trên một khối đá rộng hơn thân nó, tức có
 * BẬC để bước lên. Đó là dáng của một nhà công và nó đọc ra ngay ở cỡ 40px: một ngôi nhà
 * đứng trên bệ thì không phải chỗ bán hàng, vì không ai bắt khách khiêng hàng lên bậc. Bệ
 * còn làm một việc thứ hai — nó nâng cả toà nhà lên, nên thư viện cao hơn hai cửa hàng mà
 * không cần vách cao hơn, tức không cần thêm một mảng tường trống nào.
 *
 * Bệ mang bộ ký tự RIÊNG (`j`/`m`) chứ không dùng `L`/`W` như mọi vách khác, và đó là bắt
 * buộc chứ không phải sở thích: mặt nạ mặt tiền nhận `LW`, nên nếu bệ cũng là `LW` thì hàng
 * cột chạy luôn xuống chân bệ và cái bệ thôi là bệ.
 *
 * ## Hàng cột: đổi từ CỘT SÁNG sang KHE TỐI, và đây là một lỗi được sửa
 *
 * Bản trước kẻ cột bằng `foam` — đúng cái sắc của vách trái. Tức là trên vách trái, cả hàng
 * cột TÀNG HÌNH; chỉ nửa bên phải, nơi vách là `dim`, mới còn thấy cột. Một nửa hàng cột
 * không tồn tại, và không có gì đỏ lên để báo. Cùng hạng lỗi với cái bàn trong nhà mượn
 * đúng sắc sàn — và cùng cách phát hiện: mở trang ra nhìn.
 *
 * Chữa bằng cách kẻ cái KHE thay vì kẻ cái cột: khe là `ink`, thân cột để nguyên sắc vách.
 * Đúng cả về vật lý — khoảng giữa hai cột là chỗ tối, còn thân cột hứng đúng thứ nắng mà
 * bức tường sau nó đang hứng — và nó đúng trên MỌI sắc vách, kể cả sắc thêm vào sau này.
 */
const LIB_H = 38;
const LIB_W = 24;
const LIB_TALL = 12;
const LIB_BASE_W = 28;
const LIB_BASE_TALL = 3;
/** Số hàng chừa dưới chân thân cho cái bệ. Suy ra từ điều kiện "tâm mặt nền của thân trùng
 *  tâm mặt trên của bệ", không gõ tay: lệch một hàng là toà nhà lún vào bệ. */
const LIB_FOOT = LIB_BASE_TALL + (LIB_BASE_W - LIB_W) / 4;
const LIB_AT = shopAt(LIB_H, LIB_W, LIB_TALL, LIB_FOOT);
const LIB_EAVE = LIB_AT.y + LIB_W / 2;
/** Hàng cột: khe tối cứ bốn ô một, thân cột là ô trong suốt để sắc vách lộ ra. */
const LIB_COLS = band(LIB_W, 7, 'C').map((row) =>
  [...row].map((c, x) => (c === 'C' && x % 4 < 2 ? 'k' : '.')).join(''),
);
const LIBRARY = facade(
  layers(
    // Bệ trước, thân sau: thân phải đè lên mặt bệ, vì nhìn từ trên cao thì phần bệ sát chân
    // tường bị chính bức tường che.
    stamp(
      blank(SHOP_W, LIB_H),
      boxed(LIB_BASE_W, LIB_BASE_TALL, 'f', 'j', 'm'),
      (SHOP_W - LIB_BASE_W) / 2,
      LIB_H - LIB_BASE_W / 2 - LIB_BASE_TALL,
    ),
    [boxed(LIB_W, LIB_TALL), LIB_AT.x, LIB_AT.y],
    // Tang trống: một khối vuông thấp giữa mái, đỡ lấy mái vòm. Thiếu nó thì cái vòm đậu
    // thẳng lên mặt mái và đọc thành một cái bát úp, không đọc thành mái vòm.
    [boxed(12, 2, 'f', 'j', 'm'), LIB_AT.x + 6, LIB_AT.y - 2],
    // Mái vòm và chóp. Nó nhô hẳn lên trên đường mái — ở cỡ này một cái vòm nằm gọn trong
    // mặt mái thì đọc thành cái giếng trời.
    [
      [
        '.....g.....',
        '.....k.....',
        '...kkkkk...',
        '..kssttsk..',
        '.ksssttssk.',
        'ksssstttssk',
        'ksssstttssk',
        '.kssstttsk.',
        '..kkkkkkk..',
      ],
      LIB_AT.x + 6,
      LIB_AT.y - 10,
    ],
  ),
  'LW',
  // Cửa lớn ở vách phải, vẽ TRƯỚC hàng cột để mấy cái cột đứng chắn trước nó — đó là chỗ
  // cửa của một nhà có hàng cột, và nó cho hàng cột một chiều sâu mà một mặt phẳng không có.
  [opening(8, 6, -1, 'k', 'd'), LIB_AT.x + 14, LIB_EAVE + 4],
  // Đường gờ mái chạy suốt hai vách, ngay dưới chân mái. Nó là thứ mà hàng cột ĐỠ; không có
  // nó thì mấy cái cột chống lên hư không.
  [band(LIB_W, 1, 'k'), LIB_AT.x, LIB_AT.y + 1],
  [band(LIB_W, 1, 'f'), LIB_AT.x, LIB_AT.y + 2],
  [LIB_COLS, LIB_AT.x, LIB_AT.y + 3],
  // Chân cột: một hàng đậm chạy ngang ngay dưới hàng cột.
  [band(LIB_W, 1, 'k'), LIB_AT.x, LIB_AT.y + 10],
);

/**
 * Công viên — chỗ DUY NHẤT trong thị trấn không phải một toà nhà, và nó vẫn phải là một
 * CHỖ ĐƯỢC XÂY.
 *
 * ## Vì sao lượt này phải sửa nó
 *
 * Lượt này vẽ lại kiến trúc ba cửa hàng, và làm xong thì công viên tụt hẳn lại: bốn chỗ kia
 * đều là một khối có mép, có đường viền, có bóng đổ, còn công viên là một mảng cỏ phẳng đặt
 * lên một mảng cỏ phẳng. `--art-leaf` với nền cỏ của bản đồ chênh nhau đúng vài phần trăm
 * độ sáng, nên cái ranh giới duy nhất nói "đây là công viên" là một đường viền mảnh. Nhìn
 * màn hình thì nó không đọc thành một chỗ, nó đọc thành một vệt sáng hơn trên bãi cỏ.
 *
 * Ba thứ kéo nó về cùng ngôn ngữ với bốn chỗ kia, và cả ba đều là thứ mà bốn chỗ kia đã có:
 *
 * 1. **Một cái BỆ.** Mặt cỏ giờ đứng trên một bờ kè ba hàng, dựng bằng chính `boxed` —
 *    cùng hàm dựng mọi khối trong thị trấn. Có bệ là có mặt đứng, có mặt đứng là có bóng,
 *    và cái bóng ấy mới là thứ tách công viên khỏi bãi cỏ. Đây đúng là thứ đã cứu thư viện
 *    ở khối trên.
 * 2. **Một cái MÁI.** Chòi nghỉ bốn cột, mái chóp dựng bằng `hip` — cùng hàm dựng mái quán
 *    ăn. Nó cho công viên một SILHOUETTE: từ xa, cái nhô lên khỏi hàng cây là thứ nói "chỗ
 *    này có người dựng nên", chứ không phải "chỗ này chưa xây".
 * 3. **Một cái HỒ.** Vành đá bọc một mặt nước — vật duy nhất trên bản đồ có màu nước, và
 *    một mảng lam nằm ngang giữa một bãi lục là chỗ mắt dừng lại.
 *
 * Vẫn không có tường và không có cửa: hai việc ở đây miễn phí, và trên bản đồ thì câu ấy
 * nói bằng hình chứ không bằng một dòng chú thích. Chòi thì hở bốn phía — nó là mái không
 * có nhà, tức đúng thứ mà một chỗ miễn phí nên trông giống.
 *
 * ## Chỗ cho quản gia
 *
 * Hai động tác nghỉ ngoài trời (đi bộ, ra nắng) diễn ra ở đây, nên đây phải là một chỗ có
 * người ĐỨNG VÀO được, và cái ràng buộc ấy chi phối mọi chỗ đặt bên dưới: chòi lùi hẳn về
 * góc sau, hồ dạt sang sườn phải, còn khoảng giữa 144px thì để trống cho vòng đi lại 88px.
 * Bản đầu của lượt này đặt chòi vào giữa bãi và quản gia đi xuyên qua bốn cái cột.
 */
const PARK_W = 48;
const PARK_H = 38;
/** Mặt cỏ và bờ kè. Chân bệ rơi đúng hàng cuối khung, cùng luật đã ghi cho ba cửa hàng. */
const PARK_LAWN_W = 40;
const PARK_KERB = 3;
const PARK_X = (PARK_W - PARK_LAWN_W) / 2;
const PARK_LAWN = PARK_H - PARK_KERB - PARK_LAWN_W / 2;

/** Cây: tán hai sắc và một thân. Hai sắc chứ không một — ở 4px một tán phẳng một màu đọc
 *  thành cái chấm xanh, mà cây là vật lặp lại nhiều nhất trên bản đồ này. */
const TREE = [
  '...LLLL...',
  '..LLLLLL..',
  '.LLLLLLLL.',
  'LLLLLPPPL.',
  'LLLLPPPPPL',
  '.LLLPPPPP.',
  '..LPPPPP..',
  '...PPPP...',
  '....bb....',
  '....bb....',
  '...bbbb...',
];

/** Bụi cỏ thấp — cùng hai sắc với cây, khác ở chỗ không có thân. Nó là thứ lấp mấy khoảng
 *  trống giữa các toà nhà mà không thêm một vật thứ hai cao bằng cây. */
const BUSH = ['..LLLL..', '.LLLLLPP', 'LLLLPPPP', '.LLPPPP.'];

/** Ghế đá: mặt ghế nghiêng đúng độ dốc, hai chân. Nó phải nghiêng — một cái ghế nằm ngang
 *  trong một bức tranh đẳng cự là vật duy nhất trên màn hình không theo phối cảnh, và mắt
 *  bắt ra ngay dù không gọi tên được. */
const BENCH = ['..ffff', 'ffff.k', 'kf.k..', '.k....'];

/** Đèn đường: cột và một chóp sáng. Cao và mảnh — nó là vật đứng duy nhất trong thị trấn
 *  không phải nhà, nên nó chia được mấy khoảng cỏ trống mà không đọc thành một toà nhà nhỏ. */
const LAMP = ['.gg.', 'gggg', '.kk.', '..k.', '..k.', '..k.', '..k.', '..k.', '.kk.'];

/** Khóm hoa: ba chấm màu trên một nhúm lá. Nó không có dáng riêng và không cần có — việc
 *  của nó là phá cái đều đặn của mặt cỏ, ở cỡ 12px. */
const FLOWER = ['r.p.r', 'LLLLL', '.LLL.'];

/**
 * Chòi nghỉ: mái chóp trên bốn cột, có sàn đá.
 *
 * Bốn cột chứ không ba, dù cột sau bị mái che khuất hoàn toàn: chỗ đứng của nó vẫn phải
 * tính, vì nếu sau này mái hạ thấp đi một hàng thì cái cột ấy lộ ra, và lúc ấy mà đi tìm
 * xem nó phải đứng đâu thì đã mất mất cái ràng buộc — bốn chân của một cái chòi là bốn góc
 * mặt sàn, không phải bốn con số chọn cho vừa mắt.
 *
 * Sàn vẽ TRƯỚC mái, cột vẽ SAU: mái che phần sàn ở xa, còn cột thì đứng trước sàn. Đảo thứ
 * tự là mấy cái cột biến mất vào sàn đá cùng sắc.
 */
const PARK_HUT_ROOF = hip(12, 5, 'Y', 'Z');
const PARK_HUT_TALL = 5;
const PARK_HUT = layers(
  blank(12, PARK_HUT_ROOF.rows.length + PARK_HUT_TALL),
  [rim(diamond(12, 'j'), 'j', 'k', 1), 0, 8],
  [PARK_HUT_ROOF.rows, 0, 0],
  [Array.from({ length: PARK_HUT_TALL }, () => 'k'), 0, 6],
  [Array.from({ length: PARK_HUT_TALL }, () => 'k'), 11, 6],
  [Array.from({ length: PARK_HUT_TALL }, () => 'kk'), 5, 9],
);

/** Hồ nước: vành đá bọc một mặt nước, hai hình thoi lồng nhau — cùng phép đã dựng tấm thảm
 *  trong nhà và mặt mái lõm của tiệm trang trí. */
const PARK_POND = stamp(rim(diamond(16, 'j'), 'j', 'k', -1), rim(diamond(8, 'A'), 'A', 'k', -1), 4, 2);

/**
 * Mặt bãi: bệ cỏ, rồi lối đi và hồ ĐẮP CÓ MẶT NẠ lên nó.
 *
 * `boxed` kẻ luôn bờ trên, diềm và chân kè — ba đường ấy là toàn bộ chỗ khác nhau giữa "một
 * công viên" và "một vệt cỏ sáng hơn".
 *
 * Lối đi và hồ đều đi qua mặt nạ `G`, nên chúng dừng đúng ở mép cỏ. Một lối đi chạy quá mép
 * bãi, hay một cái hồ tràn xuống bờ kè, là thứ phá cả cái mặt phẳng mà mọi thứ khác đang
 * đứng lên — và ở cỡ này thì nó không đọc thành lỗi, nó chỉ đọc thành "trông sai sai".
 */
const PARK_GROUND = inlay(
  inlay(
    stamp(blank(PARK_W, PARK_H), boxed(PARK_LAWN_W, PARK_KERB, 'G', 'j', 'm'), PARK_X, PARK_LAWN),
    lane(11, 4, 'S'),
    14,
    PARK_LAWN + 8,
    'G',
  ),
  PARK_POND,
  26,
  PARK_LAWN + 7,
  'GS',
);
const PARK = layers(
  PARK_GROUND,
  // Chòi ở góc SAU, hồ dạt sang sườn phải: khoảng giữa để trống cho quản gia đi lại.
  [PARK_HUT, 12, PARK_LAWN - 3],
  // Cây, ghế, đèn, hoa: khai bằng chỗ CHÂN CHẠM CỎ, không khai bằng góc khung.
  put(TREE, 9, PARK_LAWN + 16),
  put(TREE, 42, PARK_LAWN + 12),
  put(BUSH, 8, PARK_LAWN + 8),
  put(BENCH, 13, PARK_LAWN + 18),
  put(LAMP, 38, PARK_LAWN + 16),
  put(FLOWER, 26, PARK_LAWN + 20),
);

/**
 * Ô chưa mở: một CÔNG TRƯỜNG ĐANG XÂY, không còn là mảnh đất trần.
 *
 * ## Vì sao đổi, và vì sao lý lẽ cũ sai chứ không chỉ cũ
 *
 * Bản trước là một mảnh đất trần có cọc rào, cố ý chỉ cao 16 hàng trong khi mọi thứ khác
 * cao 34 — lý lẽ khi ấy là "chỗ trống phải nhìn ra là chỗ trống ngay từ dáng". Nó đứng
 * được, và nó trả lời sai câu hỏi. Cái ô này không nói "ở đây không có gì"; nó nói **"ở
 * đây SẼ có gì đó"** — nó là lời hứa duy nhất trên bản đồ rằng thị trấn còn lớn thêm. Một
 * bãi đất trần thì đọc thành chỗ bị bỏ quên, và cái biển "chưa mở" phải một mình gánh trọn
 * nghĩa "sắp có" mà bức tranh đang nói ngược lại.
 *
 * Công trường nói đúng câu ấy bằng chính cái dáng, trước cả khi đọc tới biển: có móng đã
 * đổ, có cần cẩu đang treo một bó ván, có vật liệu xếp sẵn. Đây là chỗ HÌNH làm được việc
 * mà một dòng chữ không làm được — "sắp mở" là một câu, còn "đang xây dở" là một cảnh.
 *
 * ## Nó vẫn phải THẤP hơn mọi toà nhà, và giờ thấp theo một cách khác
 *
 * Khung cao 26 hàng, giữa 16 của bản trước và 34 của mấy cửa hàng. Cái quyết định không
 * phải con số mà là thứ chiếm chỗ ở phần trên: ở đây phần trên là cần cẩu — một vật MỎNG,
 * hở trời — chứ không phải khối mái đặc như mấy toà nhà. Một công trường cao bằng nhà mà
 * đặc như nhà thì nó thôi đọc thành công trường.
 *
 * Vẫn KHÔNG bấm được, và lý do cũ còn nguyên: một ô bấm vào rồi hiện ra "chưa có gì" là
 * một cú bấm phí.
 *
 * ## Hình học vẫn DỰNG, chi tiết mới vẽ tay
 *
 * Móng là `boxed` — cùng hàm dựng mọi khối trong thị trấn, nên nó không thể lệch độ dốc.
 * Cần trục là `lane`, cùng hàm dựng lối đi trong công viên: một cái cần vẽ tay lệch khỏi
 * độ dốc 2:1 là vật duy nhất trên bản đồ không theo phối cảnh, và đó đúng là chỗ mắt bắt
 * lỗi nhanh nhất. Chỉ cột cẩu, dây cáp, đống gạch và đống cát là vẽ tay — chúng đứng
 * thẳng hoặc là đống, tức chúng không có độ dốc nào để mà lệch.
 */
const LOT_W = 28;
const LOT_H = 26;
/** Hàng mà mặt đất bắt đầu, và tâm ngang của nó. Mọi thứ đứng trên công trường đo từ hai
 *  con số này chứ không đo từ mép khung — cùng luật đã ghi ở `shopAt`. */
const LOT_GROUND = LOT_H - 12;
const LOT_MID = LOT_W / 2;
/** Bó ván đang treo trên móc — cùng một hình dùng hai chỗ, nên nó có tên. */
const LOT_LOAD = ['ppp', 'kkk'];
const LOT = layers(
  stamp(blank(LOT_W, LOT_H), diamond(24, 'e'), 2, LOT_GROUND),
  // MÓNG đã đổ: một khối bê tông thấp, hai hàng vách. Nó là thứ nói "đã bắt đầu" — một
  // công trường chỉ có cần cẩu với đống gạch thì vẫn đọc thành bãi tập kết vật liệu.
  [boxed(12, 2, 'f', 'd', 'd'), LOT_MID - 6, LOT_GROUND + 2],
  // Cột cẩu: hai ô ngang, cột sáng bên trái và cạnh khuất bên phải — đúng hướng nắng mà
  // mọi vách trong thị trấn đang theo. Chân cắm XUỐNG tới mép trước mảnh đất, không dừng ở
  // mép sau: một cái cột hết ở lưng chừng ruộng thì nó không đứng trên đất, nó lơ lửng.
  //
  // Cần cẩu VÀNG, và đó là chỗ duy nhất trong file này mượn `--art-gold` cho một thứ không
  // phải đèn hay cờ. Nó đáng: màu vàng thiết bị là cái nói "công trường" nhanh hơn mọi chi
  // tiết khác trong khung, mà cả mảnh đất này chỉ có một cú liếc để nói xong câu ấy. Không
  // đụng đồng xu — đồng xu sống ở dải thông số, không ai thấy hai thứ ấy cùng lúc.
  [Array.from({ length: 17 }, () => 'gk'), 21, 5],
  // CẦN, dựng bằng `lane` nên nó nghiêng đúng 2:1: đầu phải gác lên đỉnh cột, đầu trái
  // vươn ra treo bó ván ngay trên móng.
  [lane(5, 4, 'g', -1), 11, 5],
  // Dây cáp và bó ván đang treo. Dây là một ô dọc — mảnh nhất có thể trên lưới này, và nó
  // phải mảnh: một sợi cáp dày hai ô đọc thành cái cột thứ hai.
  [Array.from({ length: 4 }, () => 'k'), 12, 10],
  [LOT_LOAD, 11, 14],
  // Vật liệu xếp sẵn: chồng ván bên trái, đống cát trước móng. Hai đống ở hai chỗ chứ
  // không dồn một chỗ — dồn một chỗ thì nửa còn lại của mảnh đất trống trơn và cả cảnh
  // lệch hẳn về một phía.
  //
  // Cả hai đều chia MẶT SÁNG trên, mặt khuất dưới, và đó không phải chuyện làm đẹp: đống
  // cát vẽ một sắc `dim` trên nền đất `broth` thì hai màu ấy chênh nhau quá ít để tách
  // được ở cỡ thật — nhìn màn hình thì nó tan vào ruộng và cả đống biến mất. Một bậc sáng
  // ở trên là thứ tách nó ra khỏi mặt đất, không phải một đường viền.
  [['.ww.', 'wwww', 'pppp'], 6, 20],
  [['..f..', '.fff.', 'ddddd'], 13, 22],
);

/* ── Nhà mình ──────────────────────────────────────────────────────────────────

   To nhất, đứng giữa, và là chỗ duy nhất KHÔNG CÓ MÁI.

   ## Vì sao 52 ô chứ không 44

   Sàn 44 ô (176px) đứng được cho tới khi quản gia trong nhà thôi là bản vẽ tay 12 ô và
   thành đúng nhân vật ở popover — 16 ô, 64px. Sau lượt ấy anh ta chiếm hơn một phần ba bề
   ngang sàn, và cái vòng đi lại 56px chỉ còn là một cái nhích: hai đầu vòng đi cách nhau
   chưa tới một thân người. Cộng cái bàn, tấm thảm và chậu cây thì căn phòng đọc thành một
   cái tủ có người đứng trong, không đọc thành một chỗ ở.

   52 ô (208px) cho lại đúng cái đã mất: sàn rộng gấp 3,25 lần thân người, vòng đi lại nới
   ra 88px, và giữa hai món đồ có chỗ TRỐNG. Chỗ trống ấy mới là thứ nói "rộng rãi" — thêm
   đồ vào một căn phòng to là làm nó chật lại, nên lượt này nới sàn mà KHÔNG thêm món nào
   ngoài một cái kệ sát tường. */

const HOME_W = 52;
const HOME_WALL = 18;
const HOME_X = 4;
const HOME_FLOOR_Y = HOME_WALL;
const HOME_FRAME_W = HOME_W + 8;
const HOME_FRAME_H = HOME_FLOOR_Y + HOME_W / 2;

/**
 * Sàn trước, rồi hai vách đè lên.
 *
 * Thứ tự ấy là toàn bộ phép sắp lớp của căn phòng: chân vách phải nằm TRÊN mép sàn, vì
 * đứng từ trên cao nhìn xuống thì bức tường ở xa che mất dải sàn sát nó. Vẽ ngược lại thì
 * sàn tràn lên chân tường và căn phòng trông như một tấm thảm dán lên hai tấm ván.
 */
/**
 * Sàn có VÁN, và mấy đường ván ấy không tốn thêm một thẻ nào.
 *
 * Sàn rộng 52 ô là mảng đặc lớn nhất trong cả bức tranh, và một mảng nâu phẳng 208px đọc
 * thành nền chứ không đọc thành sàn — nó là chỗ duy nhất trong căn phòng không có kết cấu
 * gì cho mắt bám vào. Rãnh ván sửa đúng chỗ đó.
 *
 * Rãnh chạy dọc theo MỘT trục của sàn, tức `x − 2y` không đổi — đúng cái độ dốc 2:1 mà cả
 * file này nói đi nói lại. Kẻ ngang hay kẻ dọc màn hình thì nó là hoạ tiết dán lên, không
 * phải ván sàn của căn phòng ấy.
 *
 * Và nó chỉ ĐỔI MÀU mấy ô đã có sẵn, không thêm ô nào: giá của cả chi tiết này bằng không,
 * khác hẳn mọi thứ khác trong file. Cộng 400 để phép chia dư không gặp số âm.
 */
const HOME_FLOOR = diamond(HOME_W, 'F').map((row, y) =>
  [...row].map((c, x) => (c === 'F' && (x - 2 * y + 400) % 8 === 0 ? 'e' : c)).join(''),
);

/**
 * Góc phòng: đường thẳng đứng chỗ hai vách gặp nhau.
 *
 * Nhìn màn hình thật thì đây là chi tiết thứ hai quyết định (sau đường chân tường): hai
 * vách chênh nhau đúng một bậc sáng, và ở chỗ chúng giáp nhau — đỉnh xa của căn phòng —
 * không có gì chia chúng ra, nên nửa trên bức tranh đọc thành MỘT mảng sáng gãy khúc chứ
 * không đọc thành hai bức tường.
 *
 * Chỉ đánh dấu ô `A` có `B` ngay bên phải, không dùng `rim` chung: dưới mốc sàn thì bên
 * phải vách trái là đường chân tường chứ không phải vách kia, và `rim` sẽ kẻ thêm một
 * đường thứ hai chạy song song với cái chân tường đã có.
 */
const corner = (rows) =>
  rows.map((row) => {
    const a = [...row];
    return a.map((c, x) => (c === 'A' && a[x + 1] === 'B' ? 'k' : c)).join('');
  });

const HOME_SHELL = corner(
  layers(
    blank(HOME_FRAME_W, HOME_FRAME_H),
    [HOME_FLOOR, HOME_X, HOME_FLOOR_Y],
    [backWall(HOME_W, HOME_WALL, 'A', false, 'S'), HOME_X, HOME_FLOOR_Y - HOME_WALL],
    [backWall(HOME_W, HOME_WALL, 'B', true, 'S'), HOME_X, HOME_FLOOR_Y - HOME_WALL],
  ),
);

/**
 * Tấm thảm là một HÌNH THOI dựng bằng chính `diamond`, không phải mấy hàng vẽ tay.
 *
 * Nó nằm phẳng trên sàn, nên nó phải mang đúng độ dốc của sàn — mà vẽ tay một hình thoi
 * rộng 24 ô thì sai một ô là nó đọc thành một vũng nước. Viền trong bằng một hình thoi thứ
 * hai nhỏ hơn, cùng cách: hai hình thoi lồng nhau thì cái viền tự đúng độ dốc.
 */
const HOME_RUG = stamp(diamond(24, 'r'), diamond(16, 'q'), 4, 2);

/**
 * Đồ đạc trong nhà — ít, và ít là chủ ý.
 *
 * Ngôi sao của căn phòng này là người sống trong nó, không phải cái ghế. Mỗi món ở đây phải
 * trả lời được câu "thiếu nó thì mất gì":
 *
 * - **Ô cửa sổ sáng đèn** trên vách trái: thứ duy nhất nói "có người ở" khi quản gia đứng
 *   khuất sau chữ. Nó dựng bằng `panel` nên nó nghiêng đúng độ dốc của vách.
 * - **Bức tranh** trên vách phải: để hai vách không đối xứng. Hai bức tường trống hệt nhau
 *   đọc thành một cái hộp, không đọc thành một căn phòng.
 * - **Kệ sách và chậu cây** ở hai chân tường: chúng cho căn phòng một chiều SÂU — có vật
 *   đứng sát tường thì mới thấy được cái khoảng giữa phòng là khoảng trống.
 * - **Tấm thảm** giữa sàn: nó là cái đích của những vòng đi lại, và nó nói cho mắt biết đâu
 *   là "giữa phòng" khi nhân vật đang đứng ở mép.
 */
const HOME_WALLS = facade(
  HOME_SHELL,
  'AB',
  // Cửa sổ sáng đèn trên vách trái — khung tối, kính vàng, một nẹp chia đôi. Dựng bằng
  // `panel` nên nó nghiêng đúng độ dốc của vách; một ô cửa VUÔNG ở đây là chỗ mắt bắt lỗi
  // phối cảnh nhanh nhất, nhanh hơn cả một mái nhà lệch.
  [layers(opening(14, 7, -1, 'k', 'g'), [panel(1, 5, 'k', -1), 6, 1]), HOME_X + 5, 5],
  // Bức tranh trên vách phải, để hai vách không đối xứng. Hai bức tường trống hệt nhau đọc
  // thành một cái hộp, không đọc thành một căn phòng.
  [opening(12, 6, 1, 'k', 'v'), HOME_X + 33, 5],
);

/**
 * Cái bàn — và MÀU của nó là chỗ sửa chính trong căn phòng lượt này.
 *
 * Bản trước: mặt bàn `dim`, vách trái `broth`, sàn `broth`, rãnh ván `dim`. Tức là mặt bàn
 * mang đúng sắc của rãnh ván và vách bàn mang đúng sắc của sàn — cái bàn không "khó thấy",
 * nó TÀNG HÌNH, và đường viền `ink` do `boxed` kẻ ra là thứ duy nhất còn nói có gì đó ở
 * đấy. Người dùng báo đúng chỗ này 5/8.
 *
 * Chữa ở SÀN chứ không ở cái bàn, và đó là quyết định đáng ghi: sàn là mảng đặc lớn nhất
 * trong cả bức tranh, nên nó phải là thứ lùi ra sau, còn đồ đạc thì nổi lên. Sàn giờ mang
 * hai sắc gỗ RIÊNG (`wood`/`plank`, xem `PLACES`), tối hơn hẳn cả `broth` lẫn `dim`; đồ
 * đạc giữ nguyên bảng cũ và tự khắc nổi lên trên nó. Đổi cái bàn thay vì đổi sàn thì lần
 * thêm món đồ thứ tư lại phải đi tìm một sắc chưa ai dùng, lần nữa.
 *
 * Dựng bằng chính `box` như mọi khối khác trong thị trấn: vẽ tay một cái bàn đẳng cự cao
 * bốn hàng thì sai độ dốc gần như chắc chắn, và một món đồ lệch phối cảnh trong một căn
 * phòng đúng phối cảnh thì đọc thành lỗi.
 *
 * Nhưng KHÔNG dùng `boxed`, và chỗ này chỉ nhìn màn hình mới thấy: `boxed` kẻ cả bờ trên
 * lẫn diềm dưới cho mặt trên, mà mặt trên của một khối rộng 12 ô chỉ cao 6 hàng — hai
 * đường viền ăn từ hai phía và gặp nhau. Đo trên chính hình này: tám trong mười hai cột chỉ
 * còn `ink`, tức mặt bàn gần như là một mảng đen. Trên sàn `broth` sáng của bản trước thì
 * cái mảng đen ấy lại thành đường viền và cái bàn vẫn đọc được — nên lỗi nằm im. Sàn tối đi
 * là nó lộ ra ngay: bàn đen trên sàn nâu đậm.
 *
 * Nên chỉ kẻ CHÂN BÀN (`rim` trên hai vách), để nguyên mặt bàn. Mặt bàn `dim` sáng đứng
 * trên sàn tối đã tự tách ra rồi; thêm một đường viền vào đó là trả tiền hai lần cho một
 * việc, mà lần thứ hai thì trả bằng chính cái mặt bàn.
 */
const TABLE = rim(box(12, 4, 'N', 'M', 'O'), 'MO', 'k', 1);

/** Chậu cây trong nhà — cùng ngôn ngữ nét với cây ngoài phố (tán hai sắc), khác ở chỗ nó
 *  có một cái chậu. Đó là thứ nói "cây này được ai đó mang vào và tưới". */
const POT = ['..LLLL..', '.LLLLPP.', 'LLLLPPPP', '.LLPPPP.', '...bb...', '..kbbk..', '..kbbk..', '...kk...'];

/**
 * Kệ sách sát vách trái — món đồ DUY NHẤT thêm vào cùng lượt nới sàn.
 *
 * Nới sàn mà không thêm gì thì hai góc xa thành hai vũng trống, và một căn phòng có góc
 * trống không đọc thành rộng, nó đọc thành chưa vẽ xong. Một món ở góc là đủ: nó cho mắt
 * một mốc để đo cái khoảng cách từ đó tới giữa phòng, mà chính khoảng cách ấy mới là thứ
 * nói "rộng".
 *
 * Kệ chứ không phải ghế hay tủ, vì nó là món đồ duy nhất trong nhà nói được về NGƯỜI sống
 * ở đây mà không cần thêm một câu chú thích nào — mấy gáy sách nhiều màu làm trọn việc ấy
 * trong tám ô.
 */
const SHELF = [
  '..NNNNNNNN..',
  '.NNNNNNNNNN.',
  'kMvgMrMvgMOk',
  'kMMMMMMMMMOk',
  'kMvrMgMvrMOk',
  'kMMMMMMMMMOk',
  'kOOOOOOOOOOk',
];

/**
 * Bốn món đồ, đặt vào BỐN GÓC PHẦN TƯ khác nhau của sàn.
 *
 * Bản đầu của lượt này xếp kệ ngay trên cái bàn và ngọn đèn lọt vào giữa hai món: nhìn màn
 * hình thì ba món đọc thành MỘT khối cao, còn ngọn đèn thì biến mất hẳn — kệ vẽ sau nên nó
 * đè lên. Chồng lớp không phải là chuyện thẩm mỹ ở đây: nó là chuyện đọc ra được mấy món
 * đồ.
 *
 * Chỗ đứng phải nằm TRỌN trong hình thoi sàn, và đó là ràng buộc thật chứ không phải một
 * lời khuyên: mép sàn thu vào bốn ô mỗi hàng, nên một món đặt ở hàng thấp mà lệch sang trái
 * sẽ thò ra ngoài mép và đứng lơ lửng trên bãi cỏ. Mỗi chỗ dưới đây đã kiểm bề rộng sàn ở
 * đúng hàng chân món đồ.
 *
 * `put` khai bằng chỗ CHÂN CHẠM SÀN, không khai bằng góc khung — một cái bàn khai bằng góc
 * khung là cái bàn sẽ trôi mỗi lần sửa chiều cao chân nó.
 */
const HOME_ART = layers(
  HOME_WALLS,
  // Thảm ở giữa-trước: nó là cái đích của những vòng đi lại, và nó nói cho mắt biết đâu là
  // "giữa phòng" khi nhân vật đang đứng ở mép.
  put(HOME_RUG, HOME_X + 26, HOME_FLOOR_Y + 24),
  // Kệ sách sát vách sau-trái, chậu cây ở góc trước-trái, bàn ở nửa phải. Ba món ở ba góc
  // khác nhau — chúng đứng thành một vòng quanh chỗ trống, không xếp thành một hàng cắt
  // ngang nó.
  put(SHELF, HOME_X + 18, HOME_FLOOR_Y + 8),
  put(POT, HOME_X + 10, HOME_FLOOR_Y + 16),
  put(TABLE, HOME_X + 36, HOME_FLOOR_Y + 14),
  // Ngọn đèn ĐỨNG TRÊN mặt bàn, không lửng lơ cạnh nó: chân đèn đặt vào tâm mặt thoi của
  // cái bàn, suy từ chính kích thước cái bàn chứ không gõ tay.
  put(['.gg.', 'gggg', '.kk.', '.kk.'], HOME_X + 36, HOME_FLOOR_Y + 14 - 6),
);

/* ── Quản gia trong nhà ────────────────────────────────────────────────────────

   Đây KHÔNG còn là một bản vẽ riêng. Hình lấy nguyên từ `lib/pet.js` — cùng cái đầu, cùng
   bộ tư thế, cùng lưới 16 ô — và thị trấn chỉ chọn tư thế nào thì vẽ tư thế ấy.

   Bản trước là một quản gia 12 ô vẽ tay riêng cho căn phòng này, và nó sai đúng ở chỗ dễ
   thấy nhất: đặt hai màn hình cạnh nhau thì cái đầu ở popover là một viên kim cương có
   đỉnh nhọn, còn cái đầu trong nhà là một khối lục giác bè ngang; nơ cổ ở một bên là hai ô
   vàng giữa vai, ở bên kia là một vệt lệch. Không phải "hơi khác" — khác nhân vật. Lưới
   4px thì không thu nhỏ được, nên "vẽ lại cho vừa phòng" luôn luôn có nghĩa là vẽ một
   người thứ hai.

   Cỡ vì thế giờ do NHÂN VẬT quyết chứ không do căn phòng: 64×64, đúng bằng bản popover.
   Sàn nhà rộng 176px nên anh ta chiếm hơn một phần ba bề ngang — to hơn bản cũ một bậc, và
   đó là phía đúng để lệch: căn phòng có mỗi một người ở, mà một người bé bằng cái ghế thì
   căn phòng đọc thành nhà mô hình.

   Bảng tra màu cũng là MỘT — `BUTLER_CHARS`, chung với popover. Bản đầu của lượt này gán
   cho anh ta mấy tên màu của bảng `--art-*` (`plum`, `ink`, `gold`) vì thị trấn vẽ trên nền
   `.pet-art`, và mở trang ra nhìn thì thấy ngay là chưa xong việc: cùng dáng, nhưng một
   người tím nhạt còn một người đỏ tím, một người mặt tím đen còn một người mặt nâu. Vẫn là
   hai nhân vật. Chỗ chữa nằm ở CSS chứ không ở đây — `.pet-art.mini .px` trong `styles.css`
   dạy đúng cái khung của anh ta đọc token nhân vật, và bảng ký tự thì không phải đụng tới.

   Không gán tên màu cho `#`, và đó là ràng buộc chứ không phải bỏ sót: `pixels` chỉ chấm
   bóng theo hướng nắng cho những ký tự KHÔNG có tên (xem `shadeOf`), nên đặt tên cho thân
   là xoá sạch cạnh sáng/cạnh khuất của quản gia ở popover. */

/* Bảng "việc đang làm → tư thế" đã dọn sang `lib/pet.js` cùng với sprite: từ 5/8 khung cảnh
   popover cũng đổi tư thế theo việc, và hai bề mặt đọc chung một bảng thì không lệch được.
   Xem `poseOf`. */

const MINI_W = BUTLER_W;
const MINI_H = BUTLER_H;

// `.pet-art` là bắt buộc, không phải để cho đẹp: bảng màu `--art-*` và mọi luật `.px.plum`
// đều treo dưới class ấy (xem `styles.css`). Thiếu nó thì quản gia là một khối ô xám.
const mini = (pose) => html`<span class="pet-art mini pose-${pose}"
  style="width:${MINI_W}px;height:${MINI_H}px"
  >${pixels(butlerRows(pose), BUTLER_CHARS, false)}</span
>`;

/**
 * Chỗ quản gia đứng, ở mỗi nơi anh ta có thể đang ở.
 *
 * Suy từ chính mấy hằng số dựng nên cái nền, không gõ tay vào CSS. Đây đúng là ca mà
 * `itemArt` đã ghi chú: một cặp toạ độ chép sang file khác là bản thứ hai của một con số,
 * và lần nới rộng căn phòng tiếp theo là quản gia đứng xuyên qua tường.
 *
 * Chân đặt vào TÂM mặt nền — tâm sàn nhà, tâm bãi cỏ — và cái sprite treo lên từ đó.
 */
const feet = (x, w, y) => {
  const cx = (x + w / 2) * 4;
  const cy = (y + w / 4) * 4;
  return `left:${cx - MINI_W / 2}px;top:${cy - MINI_H}px;width:${MINI_W}px;height:${MINI_H}px`;
};
const SPOT = {
  home: feet(HOME_X, HOME_W, HOME_FLOOR_Y),
  park: feet(PARK_X, PARK_LAWN_W, PARK_LAWN),
};

/**
 * Quản gia — và anh ta ĐỔI CHỖ theo việc đang làm, không chỉ đổi tư thế.
 *
 * Ba trạng thái, và mỗi trạng thái là một câu trả lời cho một câu hỏi khác nhau:
 *
 * - **Rảnh** → ở nhà, hai khung hình luân phiên, cả cụm đi qua đi lại trên sàn. Hai khung
 *   chứ không phải một khung trượt ngang: một hình đứng im trôi trên sàn đọc thành cái hình
 *   bị kéo, không đọc thành người đi.
 * - **Đang làm việc TRONG NHÀ** (ăn, uống nước, vươn vai, rời mắt) → đứng yên trong nhà,
 *   một tư thế, món đồ vơi dần bên cạnh. Đứng yên là phần quan trọng: cái đang chuyển động
 *   lúc này là MÓN ĐỒ, và hai chuyển động cùng lúc trong một khung 208px thì không cái nào
 *   được nhìn.
 * - **Đang làm việc NGOÀI TRỜI** (đi bộ, ra nắng) → anh ta không ở nhà nữa, anh ta ở công
 *   viên. Đây là chỗ trả lời thẳng cho một câu hỏi mà bản trước bỏ ngỏ: nếu quản gia đang
 *   "đi bộ" mà vẫn đứng nguyên trong phòng khách thì cái động tác ấy là một nhãn dán, không
 *   phải một việc. Đi bộ thì anh ta còn ĐI nữa — đó là động tác duy nhất mà bản thân nó là
 *   sự di chuyển, nên nó giữ nhịp đi lại kể cả khi đang bận.
 *
 * Hoạt hình chạy bằng `animation-delay` ÂM tính từ đồng hồ chung, không tự khởi động lại
 * mỗi lượt vẽ — xem `drawArt` trong `lib/pet.js`, cùng cái bẫy. Ở đây nó nặng hơn hẳn: lúc
 * có việc đang chạy thì cả màn hình dựng lại mỗi giây, và thiếu dòng đó thì quản gia giật
 * về đầu phòng đúng một lần một giây.
 *
 * Class là `resident`, không phải `butler`: `.butler` đã là cả cái thẻ tóm tắt ở đầu
 * dashboard, và trùng tên thì luật `position: absolute` ở đây bốc thẻ ấy ra khỏi luồng.
 * Gặp thật, xem chú thích cùng tên trong `styles.css`.
 */
export function butlerArt(doing, place, nowMs = Date.now()) {
  if (whereOf(doing) !== place) return '';
  const stand = SPOT[place] ?? SPOT.home;
  const pacing = !doing || doing.id === 'walk';
  const pose = doing ? poseOf(doing) : null;
  // Món đồ neo theo TƯ THẾ, không theo khung sprite. Lúc đang đi lại thì cả hai khung hình
  // đều là tư thế không rảnh tay, nên `stand` là mốc đúng cho cả cụm.
  const hand = butlerHand(pacing ? 'stand' : pose);
  // Pha của vòng đi lại lấy từ đồng hồ MÁY chia dư, không lấy từ 0. Đó là thứ làm nhịp đi
  // sống sót qua mọi lượt vẽ lại — kể cả nhịp một giây lúc đang có việc chạy.
  const lag = -(nowMs % PACE_MS);
  const gait = pacing ? `;animation-delay:${lag}ms` : '';
  return html`<span class="resident ${pacing ? 'pacing' : 'busy'} at-${place}" style="${stand}${gait}" aria-hidden="true"
    >${pacing
      ? html`<span class="mini-frame a" style="animation-delay:${lag}ms">${mini('stand')}</span
          ><span class="mini-frame b" style="animation-delay:${lag}ms">${mini('walk')}</span>`
      : mini(pose)}${doing
        ? html`<span class="resident-item" style="left:${hand.x}px;top:${hand.y}px"
            >${doingArt(doing)}</span
          >`
        : ''}</span
  >`;
}

/** Một vòng đi lại. Mười một giây cho một lượt đi và về trên 80px sàn — chậm hơn hẳn bước
 *  người, và cố ý: đây là nhịp của một người đang ở trong nhà mình, không phải của một nhân
 *  vật đang đi tới đâu. `styles.css` phải dùng đúng con số này. */
const PACE_MS = 11000;

/* ── Bản đồ ────────────────────────────────────────────────────────────────────

   Chỗ đứng khai bằng LƯỚI đẳng cự, không bằng toạ độ rời. Một bước lưới là `(±176, ±88)`
   pixel — đúng độ dốc 2:1 của mọi hình bên trên, và cả hai số đều chia hết cho 4 nên mỗi
   mắt lưới rơi đúng vào một ô của lưới pixel. Con số thứ hai ấy mới cưới được đường xá vào:
   một bước lưới lẻ nửa ô thì hai đầu một đoạn đường không thể cùng nằm trên lưới.

   Bước lưới nở theo nhà: nhà rộng thêm 8 ô và mấy cửa hàng thêm 4 ô, nên khoảng hở giữa
   hai mái phải nở đúng ngần ấy, nếu không thì cả lượt phóng to chỉ đổi được một thị trấn
   thoáng lấy một thị trấn chen chúc. 152 → 176 giữ nguyên đúng khoảng hở −8px của bản trước.
   Cả hai số phải CHIA HẾT CHO 4, và có một bài test canh: lệch nửa ô thì mắt lưới rơi vào
   giữa hai ô pixel, và mọi cạnh trong thị trấn nhoè đi một nửa.

   Nhà ở GỐC (0, 0), bốn hàng quán ở bốn ô chéo quanh nó, MỘT ô đất ở mép trước. Đổi thứ tự
   trong bảng này là đổi câu chuyện — nên `home` phải ở đúng gốc, và có một bài test giữ
   điều đó. */

const S = { x: 176, y: 88 };
const at = (a, b) => ({ x: (a - b) * S.x, y: (a + b) * S.y });

/** Bước lưới, XUẤT RA cho bài test đo. Xuất chứ không để bài test chép lại hai con số: một
 *  bản chép thì lần nới rộng thị trấn sau là bài test đỏ vì nó đang canh một cái lưới đã
 *  chết — cùng lý lẽ đã ghi cho `sizeOf` và cho chỗ `itemArt` khai kích thước từ lưới. */
export const STEP = S;

export const PLACES = [
  {
    id: 'park',
    rows: PARK,
    chars: { G: 'leaf', L: 'leaf', P: 'pine', S: 'dim', A: 'sky', Y: 'broth', Z: 'wood', j: 'foam', m: 'dim', b: 'broth', f: 'foam', g: 'gold', r: 'rose', p: 'plum', k: 'ink' },
    ...at(0, 1),
  },
  {
    id: 'food',
    rows: FOOD,
    chars: { R: 'rose', T: 'berry', L: 'foam', W: 'dim', a: 'rose', f: 'foam', g: 'gold', d: 'broth', n: 'wood', k: 'ink', s: 'steam' },
    ...at(-1, 0),
  },
  {
    id: 'home',
    rows: HOME_ART,
    chars: {
      // Sàn mang hai sắc GỖ RIÊNG, không mượn `broth`/`dim` như bản trước. Đó là chỗ sửa:
      // `broth` là vách trái cái bàn và `dim` là mặt bàn, nên sàn cũ và cái bàn cũ dùng
      // đúng một cặp màu — cái bàn không mờ, nó biến mất. Xem chú thích của `TABLE`.
      F: 'wood', e: 'plank', A: 'foam', B: 'dim', S: 'ink',
      N: 'dim', M: 'broth', O: 'ink',
      L: 'leaf', P: 'pine', b: 'broth', g: 'gold', v: 'leaf', r: 'rose', q: 'foam', k: 'ink',
    },
    ...at(0, 0),
  },
  {
    id: 'decor',
    rows: DECOR,
    chars: { R: 'plum', L: 'foam', W: 'dim', s: 'sky', v: 'leaf', f: 'foam', g: 'gold', d: 'broth', k: 'ink' },
    ...at(0, -1),
  },
  {
    id: 'library',
    rows: LIBRARY,
    chars: { R: 'sky', L: 'foam', W: 'dim', s: 'sky', t: 'deep', j: 'foam', m: 'dim', g: 'gold', d: 'broth', f: 'foam', k: 'ink' },
    ...at(1, 0),
  },
];

export const PLACE_IDS = PLACES.map((p) => p.id);

/**
 * MỘT ô đất chưa mở, ở mép trước.
 *
 * Ba ô như bản trước mua được một câu — "thị trấn còn chỗ lớn thêm" — bằng một cái giá
 * không nhìn ra cho tới khi đo: hai ô ngoài cùng đứng ở `(±344, ∓172)`, tức chúng KÉO RỘNG
 * bản đồ thêm gần ba trăm pixel mỗi bên cho hai mảnh đất trần không bấm được. Cả khung
 * phải co lại để chứa chúng, nên mọi thứ có người dùng tới đều nhỏ đi vì hai thứ không ai
 * dùng tới. Một ô nói đúng câu ấy với một phần ba chỗ, và chỗ tiết kiệm được rót thẳng vào
 * mấy toà nhà: cửa hàng từ 20 lên 24 ô, nhà từ 44 lên 52.
 *
 * Nó đứng ở `(1, 1)` — ngay mép TRƯỚC, chỗ gần người xem nhất. Không phải chỗ nào cũng
 * được: một mảnh đất trần ở góc xa thì đọc thành một chỗ bị bỏ quên, còn ở mép trước, ngay
 * cuối con đường, thì đọc thành lô đất tiếp theo.
 */
export const LOTS = [at(1, 1)];

/* ── Đường xá ──────────────────────────────────────────────────────────────────

   Bốn đoạn, và chúng không phải bốn đoạn rời: hai đoạn dài đi XUYÊN qua tâm (quán ăn → nhà
   → thư viện, và tiệm trang trí → nhà → công viên), rồi hai đoạn ngắn khép xuống ô đất
   trước cổng. Vẽ thành đoạn dài chứ không thành bốn đoạn nối đuôi vì chúng nằm trên đúng
   MỘT đường thẳng: cắt nó ra là mời mấy chỗ nối lệch nhau nửa pixel.

   Toạ độ suy từ chính `at()`, không gõ tay. `dir` là chiều dốc — hai trục của lưới, và CSS
   lệch thẻ đi đúng arctan(0,5) theo chiều ấy (xem `.town-road`). */

const ROAD_W = 40;
/** Hai đầu thò thêm ngần này để chui hẳn xuống dưới chân hai toà nhà ở hai đầu. Thiếu nó
 *  thì con đường dừng lại đúng ở mũi nhà và đọc thành một cái cầu cụt. */
const ROAD_PAD = 60;

function road([a1, b1], [a2, b2]) {
  const p = at(a1, b1);
  const q = at(a2, b2);
  const w = Math.abs(q.x - p.x) + ROAD_PAD * 2;
  return {
    x: (p.x + q.x) / 2 - w / 2,
    y: (p.y + q.y) / 2 - ROAD_W / 2,
    w,
    h: ROAD_W,
    dir: (q.y - p.y) * (q.x - p.x) > 0 ? 'a' : 'b',
  };
}

export const ROADS = [
  road([-1, 0], [1, 0]),
  road([0, -1], [0, 1]),
  road([0, 1], [1, 1]),
  road([1, 0], [1, 1]),
];

/* ── Cây cối quanh thị trấn ────────────────────────────────────────────────────

   Mấy vật này KHÔNG đứng trên mắt lưới, và đó là điểm. Năm toà nhà cộng ô đất đứng đúng sáu
   mắt của một lưới đều tăm tắp, và một bản đồ mà mọi thứ đều đều thì đọc thành một bàn cờ
   chứ không đọc thành một chỗ có người ở. Cây cối chen vào giữa là thứ phá cái đều ấy.

   Chúng cũng làm một việc thứ hai, thầm hơn: chúng lấp mấy khoảng cỏ trống ở rìa: không có
   chúng thì bản đồ rộng 720px mà mọi thứ chụm vào giữa 500px, và hai bên đọc thành lề thừa.
   Từ lượt bỏ hai ô đất ngoài cùng thì việc ấy nặng thêm: hai góc trên vừa trống ra, và một
   góc trống ở rìa một bức tranh thì đọc thành chỗ chưa vẽ.

   Vẫn vẽ bằng PIXEL chứ không bằng CSS như đường và cỏ, và ranh giới ấy nhất quán: đường và
   cỏ là MẶT ĐẤT, còn cây là VẬT đứng trên đất — vật thì phải chung một ngôn ngữ nét với mấy
   toà nhà, nếu không nó đọc thành hình dán lên. */

const SCENERY = [
  // Hai cây lớn ở hai rìa — chúng vẽ ra mép của bức tranh, và mọi thứ khác nằm giữa.
  { art: TREE, x: -318, y: -40 },
  { art: TREE, x: 322, y: -18 },
  // Hai góc TRÊN, chỗ hai ô đất ngoài cùng vừa dọn đi.
  { art: TREE, x: -258, y: -186 },
  { art: BUSH, x: -196, y: -142 },
  { art: TREE, x: 266, y: -178 },
  { art: LAMP, x: 206, y: -128 },
  { art: BUSH, x: -66, y: -204 },
  // Hai bên sườn.
  { art: BUSH, x: -286, y: 56 },
  { art: FLOWER, x: -158, y: 22 },
  { art: BUSH, x: 292, y: 46 },
  // Mép trước, hai bên con đường dẫn xuống ô đất.
  { art: TREE, x: -246, y: 150 },
  { art: LAMP, x: -96, y: 166 },
  { art: FLOWER, x: 58, y: 196 },
  { art: BUSH, x: 128, y: 208 },
  { art: TREE, x: 262, y: 138 },
];

const SCENE_CHARS = { L: 'leaf', P: 'pine', b: 'broth', g: 'gold', k: 'ink', r: 'rose', p: 'plum', f: 'foam' };

/** Cây cối quanh phố, đã kèm chỗ đứng — chỗ gọi chỉ việc xếp chúng cùng mấy toà nhà theo
 *  `y` để phép sắp lớp vẫn là một phép duy nhất. */
export const SCENE_SPOTS = SCENERY.map((s, i) => ({ i, x: s.x, y: s.y }));

/**
 * Vẽ một chỗ.
 *
 * `shaded: false` như mọi hình khác: phép chấm bóng giả định một khối đặc lồi được chiếu từ
 * trên-trái, mà ở đây ba mặt của một khối đã có ba sắc riêng do `box` gán — thả `shadeOf`
 * lên trên là hai hệ đổ sáng chồng nhau, và chỗ chúng cãi nhau đọc thành lốm đốm.
 *
 * Kích thước khai từ CHÍNH cái lưới, cùng lý do đã ghi ở `itemArt`.
 */
const draw = (rows, chars, cls) => {
  const w = Math.max(...rows.map((r) => r.length)) * 4;
  return html`<span class="pet-art ${cls}" aria-hidden="true"
    style="width:${w}px;height:${rows.length * 4}px"
    >${pixels(rows, chars, false)}</span
  >`;
};

export function placeArt(id) {
  const p = PLACES.find((x) => x.id === id);
  return p ? draw(p.rows, p.chars, `town-art art-place-${id}`) : '';
}

export const lotArt = () =>
  draw(LOT, { e: 'broth', f: 'foam', d: 'dim', k: 'ink', g: 'gold', w: 'wood', p: 'plank' }, 'town-art art-lot');

export const sceneArt = (i) => draw(SCENERY[i].art, SCENE_CHARS, 'town-art art-scene');

/* ── Khung của cả bản đồ ───────────────────────────────────────────────────────

   Bề rộng, chiều cao và GỐC toạ độ, TÍNH RA từ chính những thứ đang đứng trên bản đồ.

   Ba con số này từng là ba số viết cứng trong `styles.css` (`height: 440px`,
   `min-width: 760px`, `top: 230px`) kèm một chú thích giải thích chúng đo từ đâu. Chú
   thích ấy đúng vào ngày viết và sai từ lượt sau: lượt này nhà nở thêm 8 ô, cửa hàng thêm
   4 ô, bước lưới từ 152 lên 172 và hai ô đất biến mất — cả ba con số cùng chết một lúc, mà
   không có gì đỏ lên để báo. Đúng cái nhân bản mà `sizeOf` và `butlerHand` đã gọi tên.

   Có ba con số này rồi thì bản đồ CO ĐƯỢC, và đó mới là lý do lượt này phải tính chúng:
   `.town-map` mang bề rộng thật của mình rồi thu nhỏ vừa khung chứa (xem `--town-k` trong
   `views/pet.js`). Bản trước `min-width: 760px` khoá cứng, nên khung hẹp lại thì bản đồ
   không co — nó mọc ra một thanh cuộn ngang, tức là một nửa thị trấn đi ra ngoài màn hình.

   Mọi vật neo ĐÁY-GIỮA (xem `.place-art`), nên hộp bao của một vật là
   `[x − w/2, x + w/2] × [y − h, y]`. Đường thì khác: chúng là thẻ chữ nhật BỊ LỆCH TRỤC
   26,57°, và phép lệch đẩy hai đầu lên xuống thêm `w/2 × 0,5` — không cộng phần ấy vào thì
   hai đầu đường thò ra ngoài khung và bị `overflow: hidden` cắt mất. */

/** Kích thước sprite của một chỗ, tính bằng pixel — cho bài test đo "to nhất", cho hộp bao
 *  ngay dưới đây, và cho chỗ gọi khỏi phải tự nhân 4 lần nữa.
 *
 *  Khai TRƯỚC `TOWN_BOX` chứ không ở cuối file như trước: `TOWN_BOX` chạy ngay lúc nạp
 *  module, mà `const` thì chưa khởi tạo là chưa đọc được — đặt dưới là cả trang trắng với
 *  đúng một dòng "Cannot access sizeOf before initialization" trong console. */
export const sizeOf = (rows) => ({ w: Math.max(...rows.map((r) => r.length)) * 4, h: rows.length * 4 });

/** Biển tên thò xuống dưới chân toà nhà ngần này. Suy được từ CSS nhưng không đo được từ
 *  đây, nên nó là con số duy nhất của khối này phải viết tay — và `.place-sign` phải khớp. */
const SIGN_DROP = 26;

export const TOWN_BOX = (() => {
  let l = 0;
  let r = 0;
  let t = 0;
  let b = 0;
  const box = (x0, y0, x1, y1) => {
    l = Math.min(l, x0);
    r = Math.max(r, x1);
    t = Math.min(t, y0);
    b = Math.max(b, y1);
  };
  const standing = (rows, x, y) => {
    const s = sizeOf(rows);
    box(x - s.w / 2, y - s.h, x + s.w / 2, y);
  };
  for (const p of PLACES) standing(p.rows, p.x, p.y);
  for (const g of LOTS) standing(LOT, g.x, g.y);
  for (const s of SCENERY) standing(s.art, s.x, s.y);
  for (const rd of ROADS) {
    const lean = (rd.w / 2) * 0.5;
    box(rd.x, rd.y - lean, rd.x + rd.w, rd.y + rd.h + lean);
  }
  // Biển tên chỉ treo dưới mấy chỗ có tên, mà chỗ thấp nhất thì luôn là một trong số đó
  // (ô đất ở mép trước) — nên cộng một lần vào đáy là đủ, không phải cộng cho từng vật.
  b += SIGN_DROP;
  return { w: Math.round(r - l), h: Math.round(b - t), ox: Math.round(-l), oy: Math.round(-t) };
})();

