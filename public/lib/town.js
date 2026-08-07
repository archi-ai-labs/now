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
import { outline, pixels } from './pixel.js';
import { BUTLER_CHARS, BUTLER_H, BUTLER_W, butlerFace, butlerHand, butlerLook, butlerRows, doingArt, doingRing, faceArt, markArt, poseOf } from './pet.js';
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
 * CÁI GIẾNG ở ngã ba sau — vật phong cảnh duy nhất đứng đúng một mắt lưới.
 *
 * ## Vì sao có nó
 *
 * Người dùng chỉ ra rằng mấy con đường cụt: chúng chạy quá toà nhà cuối rồi dừng giữa bãi
 * cỏ. Hai con phố xuyên tâm chữa được bằng cách cho chúng CHẠY RA khỏi khung (xem `ROADS`),
 * nhưng mặt sau thị trấn thì còn một vấn đề thứ hai mà phép ấy không chạm tới: mặt trước có
 * hai đoạn khép xuống ô đất, mặt sau không có gì, nên bản đồ đọc thành một bức tranh vẽ dở
 * ở nửa trên.
 *
 * Cái giếng là mốc để hai ngõ sau khép về. Không phải một toà nhà thứ sáu, và đó là chỗ
 * quan trọng: một toà nhà không bấm được thì ai cũng thử bấm nó — đúng cái bẫy đã ghi cho ô
 * đất. Một cái giếng thì không ai đợi nó mở ra một trang hàng.
 *
 * ## Vì sao rộng đúng ngần này, và vì sao KHÔNG có cần trục
 *
 * `WELL_W = 24` ô = 96px, và con số ấy có ràng buộc: hai ngõ gặp nhau NGAY TRÊN cái sân của
 * nó, mỗi ngõ thò quá mắt lưới `ROAD_PAD`. Sân hẹp hơn hai lần con số ấy thì cái ngã ba thò
 * ra ngoài sân và nằm trên cỏ. Có một bài test canh, và nó đo `ROAD_PAD` từ chính `ROADS`
 * chứ không chép lại con số.
 *
 * Cao 15 hàng = 60px, và đây là con số phải trả giá để có. Nó đứng ở `(-1, -1)`, tức
 * `y = -176`, mà mép trên `TOWN_BOX` ở `-248` — tức trần là 72px. Bản đầu dựng đúng 72px:
 * sân, thành giếng, rồi một cái CẦN TRỤC hai cột một xà bên trên. Mở trang ra thì cái xà
 * nằm đúng trên đường viền khung, và một vật chạm mép khung thì đọc thành BỊ CẮT — đúng
 * cảm giác "cụt" mà cả lượt này đang đi sửa, chỉ là ở một chỗ khác.
 *
 * Cắt cần trục đi thì còn 60px và thừa ra 12px cỏ ở trên đầu. Đổi lại mất cái dáng "hai cột
 * một xà". Cái gàu gỗ đứng trên thành giếng gánh phần ấy: nó nhỏ, nó nằm trong 60px, và ở
 * cỡ này thì một cái gàu cạnh một cái lỗ tối nói "giếng" gọn hơn một cái khung gỗ.
 */
const WELL_W = 24;
const WELL_H = 14;
/** Hàng mà mặt sân bắt đầu, và tâm ngang của nó — mọi thứ đứng trên giếng đo từ hai số này,
 *  cùng luật đã ghi ở `LOT_GROUND`. */
const WELL_GROUND = WELL_H - WELL_W / 2;
const WELL_MID = WELL_W / 2;
/**
 * Thành giếng rộng 12 ô, KHÔNG phải 8, và KHÔNG dựng bằng `boxed`.
 *
 * Hai chỗ đã hỏng trước khi ra được cái vành đá này, và cả hai đều là cùng một cái bẫy:
 * `boxed` tô viền `k` cho mọi ô mặt trên thiếu ô cùng loại ở trên HOẶC ở dưới, và trên một
 * mặt thoi bé thì gần như ô nào cũng thiếu.
 *
 * - Rộng 8 ô: mặt thoi chỉ bốn hàng, `boxed` ăn sạch → một khối đen tuyền.
 * - Rộng 12 ô nhưng vẫn `boxed`: sáu hàng, viền ăn 24 trên 40 ô, cái miệng giếng khoét nốt
 *   phần giữa → lại đen.
 *
 * Nên ở đây chỉ lấy HAI đường của `boxed`, không lấy cả ba: bờ trên (tách vành đá khỏi cỏ)
 * và chân tường (dán nó xuống sân). Bỏ đường diềm — đường ấy sinh ra để tách mái khỏi vách,
 * mà cái giếng thì mặt trên của nó không phải mái, nó là chỗ nhìn xuống nước.
 */
const WELL_CURB = 12;
/** Đặt sao cho ĐỈNH DƯỚI của thành giếng rơi đúng TÂM cái sân — nó đứng giữa sân chứ không
 *  đứng ở mép. `box(w, tall)` cao `w/2 + tall` hàng và đỉnh dưới nằm ở hàng CUỐI, nên trừ đi
 *  `w/2 + tall - 1`. Thiếu số `-1` ấy là cả cái giếng lún xuống sân một hàng. */
const WELL_CURB_Y = WELL_GROUND + WELL_W / 4 - (WELL_CURB / 2 + 2);
export const WELL = layers(
  // Sân, có đường chân — thiếu nó thì mặt sân với mặt cỏ chỉ chênh một bậc sáng và cả vật
  // đọc thành một cái gò, đúng lỗi mà `rim` sinh ra để chữa.
  stamp(blank(WELL_W, WELL_H), rim(diamond(WELL_W, 'b'), 'b', 'k', 1), 0, WELL_GROUND),
  // Thành giếng mang đúng cặp vách của mọi toà nhà trong thị trấn — vách hứng nắng `f`, vách
  // khuất `n`. Cái giếng không được có mặt trời riêng.
  [
    rim(rim(box(WELL_CURB, 3, 'd', 'f', 'n'), 'd', 'k', -1), 'fn', 'k', 1),
    WELL_MID - WELL_CURB / 2,
    WELL_CURB_Y,
  ],
  // Miệng giếng: một hình thoi TỐI khoét vào mặt thoi, nên nó tự nằm đúng phối cảnh mà không
  // phải vẽ tay một hình tròn méo.
  [diamond(4, 'k'), WELL_MID - 2, WELL_CURB_Y + 2],
  // Cái gàu, đứng trên SÂN ở phía trái — không đứng trên vành đá: vành đá chỉ dày hai ô, và
  // một cái gàu bốn ô đặt lên đó thì nó che mất chính cái vành vừa dựng.
  //
  // Vẽ tay, và đây là chỗ được phép: hình học của thị trấn thì DỰNG, còn chi tiết đè lên thì
  // vẽ — một cái gàu bốn ô không có hình học nào để mà sai.
  put(['wwww', 'wnnw', '.kk.'], WELL_MID - 8, WELL_GROUND + WELL_W / 4 + 1),
);

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
   ngoài một cái kệ sát tường.

   ## Vì sao lượt này nới VÁCH chứ không nới SÀN

   Nhận xét: *"home đang hơi bé"*. Đo lại thì nhà mình đã là vật RỘNG nhất bản đồ — sàn 208px
   so với 96px của một cửa hàng. Nên "bé" ở đây không phải bề ngang, và chỗ hỏng lộ ra khi
   xếp nó cạnh bốn hàng quán: **nó là vật duy nhất không có KHỐI.** Bốn chỗ kia có mái chóp,
   mái vòm, mái bằng có lan can — mỗi cái cao 10 đến 16 hàng trên mặt thoi. Nhà mình có hai
   vách cao 18 hàng rồi hết. Ở phối cảnh đẳng cự thì thứ mắt đọc thành "to" là CHIỀU CAO
   trên mặt đất, không phải diện tích mặt nền: mặt nền càng rộng càng bẹt.

   Nên vách 18 → 23 hàng (72px → 92px). Ba thứ được cùng lúc, và không thứ nào phải mua
   bằng chỗ của người khác:

   1. Cả khối cao thêm 20px, tức nhà mình vượt hẳn mái cửa hàng thay vì ngang bằng.
   2. Bức tường sau có chỗ thật cho ô cửa sổ đứng ở nửa trên — trước đây 18 hàng bị hai ô
      cửa ăn gần hết, nên chúng phải dính sát mép.
   3. **Bản đồ KHÔNG rộng thêm một pixel nào**, nên không toà nhà nào phải nhỏ đi và bước
      lưới đứng nguyên. Đây là chỗ khác hẳn lượt năm, lúc phóng to phải lấy chỗ của hai ô
      đất; lần này chiều cao là hướng duy nhất còn trống, vì mọi vật đều neo ĐÁY-GIỮA.

   **23 chứ không phải 26, và đó là một chỗ đã thử rồi lùi.** Bản đầu của lượt này lấy 26
   (+8 hàng). Nhìn màn thật thì nó qua mất một mốc: vách cao bằng đúng chiều sâu của sàn
   (26 hàng vách, 26 hàng thoi), nên căn phòng thôi đọc thành phòng và đọc thành một cái
   GIẾNG — hai mảng tường đứng chiếm hơn nửa diện tích khối, mỗi mảng chỉ có một ô cửa nhỏ
   trên nền trống. Chữa bằng cách treo thêm đồ lên tường thì lại phạm đúng câu đã ghi ngay
   trên: thêm đồ vào một chỗ to là làm nó chật lại. 23 hàng đứng dưới mốc ấy — vách vẫn thấp
   hơn chiều sâu sàn, tỉ lệ vẫn đọc ra là phòng.

   Sàn giữ nguyên 52 ô. Nới cả hai là căn phòng vẫn cùng tỉ lệ, chỉ to đều lên — mà tỉ lệ
   hiện tại không phải chỗ hỏng. */

const HOME_W = 52;
const HOME_WALL = 23;
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
  // Hàng 7 chứ không phải hàng 5 kể từ lượt vách cao lên 26: cửa sổ vẫn phải nằm ở NỬA TRÊN
  // của bức tường (cửa sổ thật thì cao), nhưng dính sát mép trên thì nó đọc thành ô thông
  // gió sát trần. Hai hàng là đủ để có một dải tường mỏng bên trên nó.
  [layers(opening(14, 7, -1, 'k', 'g'), [panel(1, 5, 'k', -1), 6, 1]), HOME_X + 5, 7],
  // Bức tranh trên vách phải, để hai vách không đối xứng. Hai bức tường trống hệt nhau đọc
  // thành một cái hộp, không đọc thành một căn phòng.
  [opening(12, 6, 1, 'k', 'v'), HOME_X + 33, 7],
);

/**
 * ## Cỡ cái bàn KHÔNG do cái bàn quyết — nó do cái màn hình quyết
 *
 * Người dùng báo: "laptop máy tính nhìn bé quá". Đo thì đúng: mặt kính sáng chỉ 20×12px,
 * đứng cạnh một nhân vật cao 64px. Và chỗ ĐÁNG ghi là vì sao nó bé — không phải vì ai đó vẽ
 * bé, mà vì nó không có chỗ nào để lớn:
 *
 * Quản gia đứng ở ĐỈNH SAU mặt bàn, và anh ta được vẽ SAU cả căn phòng, nên anh ta che mọi
 * thứ mình chồng lên. Tức mọi vật đứng trên bàn chỉ có đúng một dải trống để mọc lên: từ
 * hàng chân anh ta xuống tới mép trước mặt bàn. Dải ấy cao đúng `DESK_W / 2` hàng, không
 * hơn — nó LÀ chiều cao mặt thoi.
 *
 * Bàn cũ rộng 12 ô → dải 6 hàng = 24px, mà cái màn hình cũ đã cao 7 hàng. Nó không bé vì
 * chọn sai cỡ; nó đã tràn sẵn một hàng rồi.
 *
 * Nên muốn màn hình to thì phải nới BÀN, và con số suy ngược từ vật đứng trên nó: laptop cần
 * 12 hàng (8 màn + 4 đế), nên mặt bàn phải cao 12 hàng, nên `DESK_W = 24`.
 *
 * Bàn 24 ô rộng 96px thì không đứng vừa chỗ cũ nữa — mặt sàn thu vào bốn ô mỗi hàng, nên nó
 * phải lùi về gần trục giữa phòng. `DESK_X` từ `HOME_X + 36` về `+ 28`, và `DESK_Y` xuống ba
 * hàng. Mỗi con số đã kiểm bề rộng sàn ở đúng hàng nó chạm, cùng phép đã ghi cho bốn món đồ.
 */
const DESK_W = 24;
const DESK_TALL = 4;
const DESK_X = HOME_X + 28;
const DESK_Y = HOME_FLOOR_Y + 17;
/** Số hàng của MẶT bàn — `box(w, tall)` mở đầu bằng một hình thoi cao `w/2`. Thứ đứng trên
 *  bàn phải đo từ con số này chứ không từ chiều cao cả cái bàn: đổi chiều cao chân bàn thì
 *  cái laptop không được nhấc lên theo. */
const TABLE_TOP = DESK_W / 2;

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
const TABLE = rim(box(DESK_W, DESK_TALL, 'N', 'M', 'O'), 'MO', 'k', 1);

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
/* Bốn hằng số của cái bàn khai ở TRÊN `TABLE` chứ không ở dưới, và đó là bắt buộc chứ không
   phải gu: `TABLE` gọi `box(DESK_W, DESK_TALL, …)` ngay lúc nạp module, mà một `const` chưa
   khởi tạo thì chưa đọc được — đặt dưới là cả trang trắng với đúng một dòng "Cannot access
   DESK_W before initialization". Cùng cái bẫy đã ghi cho `sizeOf`.

   Chúng tách ra thành hằng số vì có BA người đọc: bản vẽ căn phòng, cái laptop đứng trên mặt
   bàn, và CHỖ ĐỨNG của quản gia lúc làm việc (`SPOT.desk`). Ba bản chép tay của cùng một toạ
   độ là ba bản sẽ trôi khỏi nhau. */
/**
 * LAPTOP trên bàn — vật duy nhất trong nhà có ô mang class riêng (`screen`).
 *
 * Cần class riêng vì nó là thứ duy nhất trong bức tranh ĐỔI theo trạng thái: sáng khi quản
 * gia đang gõ, tối khi anh ta đói lả hoặc hết nhịp. Gán cho nó một sắc `--art-*` có sẵn thì
 * CSS không có chỗ nào để bám vào mà không đụng tới mấy ô khác cùng sắc.
 *
 * ## Laptop chứ không phải màn hình rời, và đây là chỗ đổi có lý do
 *
 * Một màn hình rời đòi một bàn phím rời để đọc ra "đang gõ", mà bàn phím thì phải nằm ở nửa
 * TRƯỚC mặt bàn — đúng chỗ mà cái đế màn hình cũng muốn đứng. Hai vật tranh nhau một chỗ
 * trên một mặt thoi cao 12 hàng. Laptop gộp cả hai thành MỘT vật: màn dựng đứng, đế nằm
 * ngang, một cái bản lề nối chúng — và cái đế chính là bàn phím.
 *
 * ## Cái ĐẾ là nửa dưới của một hình thoi, không phải một chữ nhật
 *
 * Đây là phần duy nhất của laptop nằm PHẲNG trên bàn, nên nó phải mang đúng độ dốc 2:1 của
 * mặt bàn — một chữ nhật đặt lên một mặt nghiêng là chỗ mắt bắt lỗi phối cảnh nhanh nhất
 * (cùng câu đã ghi ở `panel`). Nó là ba hàng cuối của `rim(diamond(8), …)`, và ba hàng ấy đã
 * đối chiếu với bề rộng mặt bàn ở từng hàng: hai hàng cuối vừa ĐÚNG BẰNG.
 *
 * Đế rộng 8 ô chứ không 12, và đây là chỗ bản đầu hỏng phải sửa sau khi mở trang ra nhìn:
 * đế 12 ô khớp khít nửa trước mặt bàn, tức nó ĂN TRỌN nửa ấy — trên màn hình thì cả cái bàn
 * biến mất dưới một mảng kem, và mảng kem ấy lại mang đúng sắc `foam` của bức vách bên trái
 * ngay cạnh. Không đọc thành laptop trên bàn, đọc thành một tấm khăn trải. Thu về 8 ô thì
 * mặt bàn lộ ra ở cả bốn phía và cái đế đọc ra là một VẬT đặt lên.
 *
 * Màn thì ngược lại — nó DỰNG ĐỨNG, nên nó là một chữ nhật thật và nó được phép rộng hơn mặt
 * bàn ở hàng nó đứng. Một tấm kính đứng thẳng trong phối cảnh này chiếu ra đúng một chữ nhật.
 *
 * ## Ba dòng CHỮ trên mặt kính, và vì sao chúng là ba ký tự khác nhau
 *
 * Người dùng báo: "màn hình máy tính có chữ xuất hiện như đang làm việc hoặc bạn làm cách nào
 * đó nhìn vui hơn nhấp nháy". Bản trước mặt kính là một mảng lam trơn 40×24px, và cái duy
 * nhất nói "đang làm việc" là một nhịp mờ đi 28% mỗi 1,1 giây. Nhịp ấy chở đúng một tin — có
 * điện — và nó là tin mà một cái đèn ngủ cũng chở được.
 *
 * Ba dòng chữ chở tin thứ hai, và đó là tin người ta thật sự đọc: **có ai đó đang gõ**. Điều
 * kiện để nó nói được câu ấy là chúng phải hiện ra LẦN LƯỢT — ba dòng cùng bật một lúc là một
 * trang đã viết xong, không phải một trang đang được viết.
 *
 * Nên mỗi dòng mang một ký tự riêng (`t`/`u`/`w`) chứ không chung một ký tự `c`: `pixels` gán
 * class theo ký tự, và ba dòng cùng class thì CSS không có chỗ nào bám vào để cho chúng ba cái
 * mốc thời gian khác nhau. Con trỏ `x` là ký tự thứ tư vì nó nháy theo nhịp RIÊNG, không theo
 * nhịp của dòng nào — đó là cách một con trỏ văn bản vẫn hoạt động.
 *
 * Chữ tắt hẳn khi màn hình tắt, và nó tắt bằng cách mang đúng sắc của mặt kính tối chứ không
 * bằng `display: none` — cùng lý lẽ đã ghi cho chính mặt kính: hỏng về phía im lặng.
 *
 * `k` viền · `s` mặt kính · `t`/`u`/`w` ba dòng chữ · `x` con trỏ · `q` vỏ máy
 */
const LAPTOP = [
  'kkkkkkkkkkkk',
  'kstttstttssk',
  'kssssssssssk',
  'kssuusuuuusk',
  'kssssssssssk',
  'ksswwwsxsssk',
  'kssssssssssk',
  'kkkkkkkkkkkk',
  '..qqqqqqqq..',
  '..kkqqqqkk..',
  '....kkkk....',
];

/**
 * ## Bàn ĂN — mặt TRÒN trên một chân trụ, không phải cái bàn làm việc đổi màu
 *
 * Người dùng xin: "khi ăn và tập thể dục thì [bàn làm việc] biến mất thay bằng bàn ăn (có đồ
 * ăn ở trên)". Cách rẻ nhất là giữ nguyên khối `box` cũ rồi đặt bát lên — và cách ấy sai ở
 * đúng chỗ nó rẻ: hai cái bàn cùng khối, cùng cỡ, cùng hai sắc thì đó là MỘT cái bàn có bát
 * đặt lên, không phải một cái bàn khác. Mà câu người dùng nói là cái bàn kia *biến mất*.
 *
 * Nên chúng khác nhau ở ĐƯỜNG BAO, đúng cái luật đã cứu ba toà nhà ngoài phố: bàn làm việc là
 * một khối hộp bốn chân vuông, bàn ăn là một mặt tròn trên một cái trụ.
 *
 * ## Đế lọt KHÍT vào nửa dưới mặt bàn, và đó là một phép đồng nhất chứ không phải một con số
 *
 * Một hình thoi rộng `w − 8` dời xuống 4 hàng và sang phải 4 ô thì nó trùng KHÍT nửa dưới của
 * hình thoi rộng `w` — cùng phép đã dựng tấm thảm (`HOME_RUG`) và mặt mái lõm của tiệm trang
 * trí. Nhờ nó cái trụ không có một ô nào thò ra ngoài mép bàn, và không phải đo tay ô nào.
 *
 * Cao đúng 16 hàng, BẰNG cái bàn làm việc. Không phải trùng hợp: quản gia đứng ở đỉnh sau mặt
 * bàn, và chỗ đứng ấy suy từ chiều cao cái bàn (`SPOT.desk`). Lệch một hàng là lúc đổi cảnh
 * anh ta nhích lên hoặc lún xuống một ô — thứ mắt bắt ngay vì hai cảnh nối nhau tức thì.
 */
const DINE_W = 20;
const DINE_BASE_W = DINE_W - 8;
const DINE_BASE_TALL = 6;
/** Mặt bàn có một vòng khăn lót sáng ở giữa — lại là phép hình-thoi-lồng-nhau, và ở đây nó
 *  làm một việc thứ hai: cái bát đứng trên một nền sáng thì đường bao của nó đọc được, còn
 *  đứng thẳng trên mặt bàn tối thì viền `ink` của bát lẫn vào mặt bàn. */
/* `rim` chạy TRƯỚC `stamp`, và thứ tự ấy không đổi được: `rim(…, 'N', 'k', 1)` tô lại mọi ô
   `N` không có `N` ở ngay dưới, mà sau khi đắp khăn lót thì cả vành TRÊN của tấm khăn cũng
   thoả điều kiện ấy — ra một cái cung tối ôm nửa trên tấm khăn và không có gì ôm nửa dưới.
   Kẻ mép bàn trước rồi mới đắp khăn thì mỗi phép làm đúng việc của mình. */
const DINE_TOP = stamp(rim(diamond(DINE_W, 'N'), 'N', 'k', 1), diamond(DINE_W - 8, 'q'), 4, 2);
/** Bát có khói, đặt giữa khăn lót. Khói là ký tự `z` chứ không phải `s`: `s` đã là MẶT KÍNH
 *  của cái laptop trong bảng màu căn phòng, và hai nghĩa trên một ký tự là một cái bát bốc ra
 *  ánh sáng màn hình. */
const DINE_BOWL = [
  '...zz...',
  '..zzzz..',
  '.zzzz...',
  'kkkkkkkk',
  'kbbbbbbk',
  '.kbbbbk.',
  '..kkkk..',
];
const DINE_TABLE = layers(
  blank(DINE_W, DINE_W / 2 + DINE_BASE_TALL),
  [rim(box(DINE_BASE_W, DINE_BASE_TALL, 'N', 'M', 'O'), 'MO', 'k', 1), 4, 4],
  [DINE_TOP, 0, 0],
  [DINE_BOWL, (DINE_W - 8) / 2, 1],
);

/**
 * ## Góc tập — thảm, tạ và quả bóng
 *
 * Thảm tập THAY CHỖ tấm thảm giữa phòng chứ không nằm chồng lên nó, và đó là chỗ duy nhất
 * trong ba cảnh có một món của căn phòng bị dọn đi. Lý do là hình học chứ không phải câu
 * chuyện: tấm thảm rộng 24 ô nằm đúng giữa sàn, mà chỗ duy nhất đủ dài cho một tấm thảm tập
 * cũng là chỗ ấy — hai mảng phẳng chồng nhau trên một mặt sàn thì cái trên đọc thành một vũng
 * loang, không đọc thành hai vật.
 *
 * Thảm dựng bằng `lane` chứ không bằng `diamond`: nó là hình chữ NHẬT nằm phẳng, không phải
 * hình vuông — và một chữ nhật nằm phẳng trong phối cảnh này là một dải chạy theo một trục
 * lưới, đúng thứ `lane` sinh ra để dựng.
 */
/** Thảm tập nằm CAO HƠN tấm thảm tròn bảy hàng, và con số ấy do mặt sàn quyết chứ không do
 *  bố cục: sàn là một hình thoi nên nó THU LẠI bốn ô mỗi hàng khi đi xuống, còn tấm thảm tập
 *  là một chữ nhật nên nó không thu. Đặt nó thấp bằng tấm thảm tròn thì hai góc trước của nó
 *  thò hẳn ra ngoài mép sàn và đứng lơ lửng trên cỏ. Tấm thảm tròn không dính lỗi ấy vì nó
 *  cũng là một hình thoi — nó thu đúng theo sàn. */
const RUG_Y = HOME_FLOOR_Y + 24;
const MAT_X = HOME_X + 28;
const MAT_Y = HOME_FLOOR_Y + 16;
const MAT = stamp(lane(6, 18, 'r'), lane(4, 14, 'q'), 4, 1);
/** Đôi tạ và quả bóng — hai món ĐỨNG, để góc tập không phải một mảng phẳng nằm dưới chân.
 *
 *  Tạ mang sắc `N` (dim) chứ không `M` (broth): chúng đứng trên sàn gỗ nâu, và một khối nâu
 *  trên nền nâu thì chỉ còn cái viền nói là có gì ở đấy — cùng ca đã ghi cho cái bàn cũ.
 *
 *  Chúng đứng ở mép TRƯỚC, tức DƯỚI quản gia trên màn hình. Đó là chỗ duy nhất chúng không bị
 *  che: anh ta vẽ sau cả căn phòng, nên mọi thứ nằm cao hơn chân anh ta đều khuất — cùng cái
 *  ràng buộc đã quyết cỡ cái bàn làm việc. */
const WEIGHTS = [
  '.kkk....kkk.',
  'kNNNk..kNNNk',
  'kNNNkkkkNNNk',
  'kNNNkkkkNNNk',
  'kNNNk..kNNNk',
  '.kkk....kkk.',
];
const BALL = ['..kkk..', '.krrrk.', 'krrrrrk', 'krrrrrk', '.krrrk.', '..kkk..'];

/* ── Ba BỐI CẢNH của cùng một căn phòng ────────────────────────────────────────

   Người dùng xin: "bàn làm việc + máy tính chỉ xuất hiện khi làm việc, khi ăn và tập thể dục
   thì biến mất thay bằng bàn ăn (có đồ ăn ở trên) … vươn vai thì là có hiện các công cụ thể
   dục".

   ## Đây là một SÂN KHẤU, và nó thừa nhận điều đó

   Một cái bàn làm việc không bốc hơi khi người ta ngồi xuống ăn. Cảnh này vẫn cho nó bốc hơi,
   và đó là một quy ước cố ý chứ không phải một chỗ quên: căn phòng rộng 208×136px, tức mọi
   thứ đặt vào nó đều tranh chỗ với mọi thứ khác. Bày cùng lúc bàn làm việc, bàn ăn và một góc
   tập thì ba thứ chồng lên nhau và không thứ nào đọc được — mà cái đọc được mới là toàn bộ
   việc của bức tranh này. Nên căn phòng đổi ĐỒ ĐẠC theo việc, y như một sân khấu đổi cảnh.

   ## Hai việc KHÔNG đổi cảnh, và vì sao

   - **Uống nước** (`water`) giữ nguyên bàn làm việc. Nó khai là "nghỉ ngay tại bàn" (xem
     `MOVES`), và cái bàn chính là thứ định nghĩa câu ấy — dọn bàn đi là dọn mất nghĩa của
     động tác.
   - **Rời mắt** (`eyes`) cũng giữ nguyên bàn, nhưng NGƯỜI thì đi khỏi phòng — xem `STROLL`.
     Ở đây cái đổi là nhân vật chứ không phải đồ đạc, nên căn phòng đứng nguyên như anh ta vừa
     bỏ lại: bàn còn đó, màn hình tắt.

   Bốn tên trả về là bốn CẢNH, không phải bốn trạng thái mới — chúng suy hết từ `doing`, thứ
   đã có sẵn. Thêm một trường vào máy trạng thái cho việc này là dựng bản thứ hai của một sự
   thật. */

/** Ba món đứng yên qua cả ba cảnh: hai bức vách, kệ sách và chậu cây. Chúng là CĂN PHÒNG;
 *  mọi thứ khác là đồ đạc.
 *
 *  Kệ lùi bốn ô sang trái so với đời trước: bàn nở từ 12 lên 24 ô và ở cỡ mới nó trùm mất nửa
 *  phải cái kệ. Lùi ra thì chỉ còn hai cột chồng nhau ở hai hàng cuối — đọc thành "bàn đứng
 *  trước kệ", đúng thứ tự chúng đang đứng. */
const HOME_ROOM = layers(
  HOME_WALLS,
  put(SHELF, HOME_X + 14, HOME_FLOOR_Y + 8),
  put(POT, HOME_X + 10, HOME_FLOOR_Y + 16),
);

const HOME_ART = layers(
  HOME_ROOM,
  // Thảm ở giữa-trước: nó là cái đích của những vòng đi lại, và nó nói cho mắt biết đâu là
  // "giữa phòng" khi nhân vật đang đứng ở mép.
  put(HOME_RUG, MAT_X, RUG_Y),
  put(TABLE, DESK_X, DESK_Y),
  // Cái LAPTOP đứng trên bàn, đế của nó khớp vào nửa TRƯỚC mặt thoi: hàng cuối của khung rơi
  // đúng đỉnh trước mặt bàn, nên cả vật suy từ hai hằng số của cái bàn chứ không gõ tay.
  //
  // Nó thay chỗ ngọn đèn của đời trước, và đó không phải chuyện đổi đồ trang trí: từ lượt 14
  // quản gia LÀM VIỆC ở đây, mà một cái bàn có đèn thì là bàn ăn. Ngọn đèn vốn chỉ chở một
  // điểm ấm trong phòng — mặt kính sáng chở đúng điểm ấy, và chở thêm một câu nữa.
  put(LAPTOP, DESK_X, DESK_Y - TABLE.length + TABLE_TOP),
);

/** Cảnh ĂN: bàn tròn đứng đúng chỗ cái bàn làm việc vừa dọn đi. Cùng chỗ chứ không phải chỗ
 *  khác — đổi cả chỗ lẫn hình thì hai cảnh không còn là một căn phòng nữa, chúng là hai bức
 *  tranh. */
const HOME_DINE = layers(HOME_ROOM, put(HOME_RUG, MAT_X, RUG_Y), put(DINE_TABLE, DESK_X, DESK_Y));

/** Cảnh TẬP: thảm tập thế chỗ tấm thảm, tạ và bóng đứng hai bên. Không có bàn nào cả — đó là
 *  cảnh duy nhất trong ba cảnh dọn trống hẳn nửa phải căn phòng, và nó phải trống: một động
 *  tác vươn vai cần chỗ để vươn. */
const HOME_GYM = layers(
  HOME_ROOM,
  put(MAT, MAT_X, MAT_Y),
  // Đôi tạ ở mép TRƯỚC, quả bóng ở sườn PHẢI — hai chỗ đã đối chiếu bề rộng sàn ở đúng hàng
  // chân chúng chạm, cùng phép đã ghi cho bốn món của cảnh bàn làm việc.
  put(WEIGHTS, HOME_X + 26, HOME_FLOOR_Y + 22),
  put(BALL, HOME_X + 43, HOME_FLOOR_Y + 15),
);

/**
 * Việc đang làm thì căn phòng bày cảnh nào.
 *
 * `out` không phải một bộ đồ đạc — nó là câu "người không ở trong phòng". Căn phòng lúc ấy
 * vẫn là cảnh bàn làm việc, nên chỗ gọi phải phân biệt hai câu hỏi khác nhau: *vẽ đồ đạc nào*
 * và *quản gia đứng đâu*. Gộp chúng vào một tên là lần sau thêm một cảnh thứ tư thì phải sửa
 * hai chỗ.
 */
export const homeSetOf = (doing) =>
  doing?.kind === 'food' ? 'dine' : doing?.id === 'stretch' ? 'gym' : doing?.id === 'eyes' ? 'out' : 'desk';

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
//
// Có VIỀN, cùng lý do với hai con vật đi đường: anh ta đi qua lại trên sàn gỗ rồi lên tấm
// thảm hồng, và cái áo tím thì đọc rõ trên gỗ mà chìm trên thảm. Bản popover thì không —
// ở đấy anh ta đứng trên một nền duy nhất, do chính bức tranh ấy đặt ra.
const mini = (pose, eyes = 'open') => {
  const rows = butlerRows(pose, eyes);
  return html`<span class="pet-art mini pose-${pose}"
    style="width:${MINI_W}px;height:${MINI_H}px"
    >${outline(rows)}${pixels(rows, BUTLER_CHARS, false)}</span
  >`;
};

/**
 * Chỗ quản gia đứng, ở mỗi nơi anh ta có thể đang ở.
 *
 * Suy từ chính mấy hằng số dựng nên cái nền, không gõ tay vào CSS. Đây đúng là ca mà
 * `itemArt` đã ghi chú: một cặp toạ độ chép sang file khác là bản thứ hai của một con số,
 * và lần nới rộng căn phòng tiếp theo là quản gia đứng xuyên qua tường.
 *
 * Chân đặt vào TÂM mặt nền — tâm sàn nhà, tâm bãi cỏ — và cái sprite treo lên từ đó.
 */
const standAt = (cx, cy) =>
  `left:${cx * 4 - MINI_W / 2}px;top:${cy * 4 - MINI_H}px;width:${MINI_W}px;height:${MINI_H}px`;
const feet = (x, w, y) => standAt(x + w / 2, y + w / 4);
const SPOT = {
  home: feet(HOME_X, HOME_W, HOME_FLOOR_Y),
  park: feet(PARK_X, PARK_LAWN_W, PARK_LAWN),
  /**
   * Chỗ đứng SAU cái bàn, không phải cạnh nó.
   *
   * Chân đặt vào ĐỈNH SAU của mặt bàn — `DESK_Y` là hàng cuối cả cái bàn, trừ đi chiều cao
   * bàn rồi cộng lại một hàng là ra đỉnh ấy. Đứng thấp hơn một hàng thôi là hai cái chân đè
   * lên mặt bàn, và lúc đó anh ta không đứng sau bàn nữa, anh ta đứng TRÊN bàn: quản gia vẽ
   * SAU căn phòng nên anh ta che mọi thứ mình chồng lên.
   */
  desk: standAt(DESK_X, DESK_Y - TABLE.length + 1),
  /** Đứng GIỮA tấm thảm tập, không đứng sau nó: đây là chỗ duy nhất trong nhà mà nền dưới
   *  chân anh ta là một món đồ chứ không phải cái sàn, và một người tập thể dục đứng cạnh
   *  tấm thảm thay vì trên nó thì cả cảnh nói ngược lại chính nó. */
  mat: standAt(MAT_X, MAT_Y - 2),
  /** Ngoài phố thì KHÔNG có toạ độ tuyệt đối: thẻ bọc (`.town-stroll`) mới là thứ mang chỗ
   *  đứng, và nó thì đang di chuyển. Ở đây chỉ còn phép căn — chân anh ta rơi vào đúng điểm
   *  của thẻ bọc, cùng phép mà `feet` đang dùng cho hai mặt nền. */
  street: standAt(0, 0),
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
export function butlerArt(doing, place, nowMs = Date.now(), pet = null, cheer = false) {
  const set = homeSetOf(doing);
  // BỐN chỗ chứ không hai, và cái thứ tư (`street`) không đọc từ `whereOf`: rời mắt vẫn khai
  // là việc làm tại nhà, chỉ có NGƯỜI là ra ngoài. Xem `STROLL`.
  if ((set === 'out' ? 'street' : whereOf(doing)) !== place) return '';
  const stand = SPOT[place] ?? SPOT.home;
  // `butlerLook` là luật CHUNG với popover kể từ lượt này — xem `stateOf` bên `petmath.js`.
  // Chỗ này chỉ giữ thêm một điều popover không có: cái vòng ĐI LẠI.
  const look = pet ? butlerLook(pet, { cheer }) : { state: doing ? 'busy' : 'well', pose: doing ? poseOf(doing) : 'stand', eyes: 'open', mark: null };
  // ── Anh ta đang LÀM GÌ, và ở CHỖ NÀO ───────────────────────────────────────
  //
  // Ba chế độ, và ranh giới giữa chúng là chỗ lượt này sửa nặng nhất.
  //
  // Đời trước: rảnh ở nhà thì ĐI LẠI trên sàn. Người dùng hỏi thẳng — "có thể thêm trạng
  // thái làm việc gõ máy tính không?" — và câu hỏi ấy chỉ ra một chỗ trống có thật: cả cái
  // đồng hồ tập trung đang đo "đã ngồi ở bàn bao lâu", mà bức tranh thì vẽ một người đi
  // tha thẩn trong phòng. Hai thứ nói ngược nhau, và cái đo được mới là cái đúng.
  //
  // Nay ở nhà thì anh ta ở BÀN LÀM VIỆC, luôn luôn — kể cả lúc uống nước hay vươn vai, vì
  // ba việc ấy vốn khai là "nghỉ ngay tại bàn". Chỉ còn công viên là chỗ có đi lại, và ở
  // đấy đi lại là chính nội dung của việc (`walk`).
  //
  // GÕ MÁY khi và chỉ khi tư thế là `stand` và mắt còn mở, tức ba trạng thái `well`,
  // `hungry`, `dip`. Hai trạng thái còn lại có hình riêng và chúng phải THẮNG: đói lả thì
  // gục (`slump`), hết nhịp thì ngủ gật (mắt nhắm). Đấy chính là cái hậu quả mà người dùng
  // nói là chưa thấy — màn hình tắt, tay rời bàn phím, công việc dừng.
  //
  // Từ lượt này căn phòng còn ĐỔI CẢNH theo việc (`homeSetOf`), và chỗ đứng phải đi theo cảnh
  // chứ không theo cái tên "home": cảnh tập không có cái bàn nào cả, nên đứng ở "sau bàn" là
  // đứng giữa hư không, cách tấm thảm tập bảy hàng.
  const atHome = place === 'home';
  const working = atHome && !doing && look.pose === 'stand' && look.eyes === 'open';
  // ĐI: hoặc động tác `walk` ở công viên, hoặc vòng đi dạo ngoài phố. Hai cái chung một bộ
  // khung hình (bước chân) nhưng KHÁC nhau ở phép dịch — cái ở công viên tự đi vòng quanh bãi
  // cỏ, cái ngoài phố thì thẻ bọc chở nó đi, nên nó không được mang thêm vòng `park-pace`.
  const street = place === 'street';
  const pacing = doing?.id === 'walk';
  const twin = working || pacing || street;
  const spot = atHome ? (set === 'gym' ? SPOT.mat : SPOT.desk) : stand;
  const pose = twin ? null : look.pose;
  // Món đồ neo theo TƯ THẾ, không theo khung sprite. Lúc đang gõ hay đang đi lại thì cả hai
  // khung hình đều là tư thế không rảnh tay, nên `stand` là mốc đúng cho cả cụm.
  const hand = butlerHand(twin ? 'stand' : pose);
  // Pha của vòng lặp lấy từ đồng hồ MÁY chia dư, không lấy từ 0. Đó là thứ làm nhịp sống
  // sót qua mọi lượt vẽ lại — kể cả nhịp một giây lúc đang có việc chạy.
  const lag = -(nowMs % PACE_MS);
  const gait = pacing ? `;animation-delay:${lag}ms` : '';
  const mode = working ? 'typing' : street ? 'strolling' : pacing ? 'pacing' : 'busy';
  // BONG BÓNG NGHĨ treo trên vai — người dùng xin, lượt 18: "cho nhân vật ở web có suy nghĩ
  // (emoji) trạng thái", rồi lượt 19: "cho nó hiển thị như kiểu suy nghĩ trên pop-over".
  //
  // CHỈ khuôn mặt, không có câu chữ, và đó là chỗ nó khác popover chứ không phải một bản rút
  // gọn cho vừa chỗ. Bản đồ này rộng 208px mỗi khu và có tới bảy chỗ có thể có nhân vật; một
  // bong bóng chữ ở đây phải cạnh tranh với tên hàng quán, với món đồ đang cầm, với cái vòng
  // đếm ngược. Mặt cười thì rộng 28px và không có chữ nào để đọc — nó là thứ liếc một cái là
  // xong, đúng vai của một bản đồ. Đám mây với hai cái chấm thì do CSS vẽ, xem `.resident-mind`.
  //
  // Không có `pet` thì không có bong bóng nào: bản đồ vẫn vẽ được khi sổ chưa về (xem `look`
  // ngay trên), và một khuôn mặt mặc định lúc ấy là một khuôn mặt bịa.
  //
  // Và lúc có bong bóng thì nét `crave` phải NHƯỜNG. `crave` cũng là một bong bóng nghĩ, chỉ
  // khác là vẽ bằng pixel — nên để cả hai là hai bong bóng nghĩ mọc ra từ một cái đầu 64px,
  // đúng cái va chạm mà popover đã phải xử (ở đấy là tấm bảng NÓI). Nhìn thật thì nó đọc thành
  // nhiễu chứ không đọc thành "anh ta đang đòi ăn".
  // Đói lả không mất kênh nào vì thế: nó vẫn giữ tư thế `slump` của riêng nó, và khuôn mặt
  // trong bong bóng là `sad` — cũng của riêng nó. Hai kênh, đúng bằng số kênh của mọi trạng
  // thái khác trong bảng `LOOK`.
  const mark = pet && look.mark === 'crave' ? null : look.mark;
  return html`<span class="resident ${mode} at-${place} pet-${look.state}" style="${spot}${gait}" aria-hidden="true"
    >${twin
      ? html`<span class="mini-frame a" style="animation-delay:${lag}ms">${mini(working ? 'type' : 'stand', look.eyes)}</span
          ><span class="mini-frame b" style="animation-delay:${lag}ms">${mini(working ? 'type2' : 'walk', look.eyes)}</span>`
      : mini(pose, look.eyes)}${doing
        ? html`<span class="resident-item" style="left:${hand.x}px;top:${hand.y}px"
            >${doingArt(doing)}</span
          >${doingRing(doing)}`
        : ''}${markArt(mark, twin ? 'stand' : pose)}${pet
        ? html`<span class="resident-mind">${faceArt(butlerFace(pet, { cheer }))}</span>`
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

/** Cùng phép ấy, XUẤT RA cho bài test: hỏi "mắt lưới này nằm ở đâu" mà không phải chép lại
 *  công thức lần thứ hai — một bản chép là một bản sẽ lệch ở lần nới lưới sau. */
export const cellPos = at;

/** Bước lưới, XUẤT RA cho bài test đo. Xuất chứ không để bài test chép lại hai con số: một
 *  bản chép thì lần nới rộng thị trấn sau là bài test đỏ vì nó đang canh một cái lưới đã
 *  chết — cùng lý lẽ đã ghi cho `sizeOf` và cho chỗ `itemArt` khai kích thước từ lưới. */
export const STEP = S;

/**
 * Vòng đi dạo ngoài phố — tuyến, và nhịp.
 *
 * Người dùng xin: "rời mắt thì đi dạo vòng vòng khu phố". Chỗ đáng ghi là vì sao nó KHÔNG
 * dựng bằng cách đổi `MOVES.eyes.where` sang `'park'`, dù đó là một dòng:
 *
 * `where` chở BA việc cùng lúc (xem chú thích của nó bên `petmath.js`) — ô hàng bày ở khối
 * nào, quản gia đứng đâu, và khung cảnh popover có mọc cây không. Rời mắt vẫn là động tác
 * làm được ngay tại bàn, nên ô hàng của nó phải ở lại khối "trong nhà". Đổi `where` là đổi cả
 * ba, tức mua một cái đi dạo bằng một lời nói dối trong bảng động tác.
 *
 * Nên chỗ đứng tách khỏi `where`: `homeSetOf` trả về `out`, và `butlerArt` hiểu thêm một
 * "chỗ" thứ ba tên `street`. Bảng động tác không phải đụng tới.
 *
 * Tuyến là con PHỐ NGANG đi ngang trước cửa nhà — đúng nghĩa "vòng vòng khu phố", và nó có
 * một cái lợi mà một tuyến riêng không có: anh ta gặp người qua đường trên đó. `alternate`
 * cho anh ta đi rồi về, nên hết một phút anh ta ở lại đúng chỗ xuất phát.
 */
const STROLL_MS = 26000;
export const STROLL = { from: at(-1, 0), to: at(1, 0), ms: STROLL_MS };

/** Anh ta có đang ở ngoài phố không. Một cửa, để `views/pet.js` không phải chép lại phép so
 *  chuỗi `homeSetOf(doing) === 'out'` — cùng lý lẽ đã ghi cho `sizeOf` và `cellPos`. */
export const strolling = (doing) => homeSetOf(doing) === 'out';

/** Pha của vòng đi dạo, tính từ đồng hồ MÁY. Chu kỳ là HAI lần `STROLL_MS` vì `alternate` nối
 *  lượt đi với lượt về thành một vòng — lấy dư theo một lần là cứ tới giữa vòng anh ta lại
 *  giật ngược về đầu phố. */
export const strollLag = (nowMs) => -(nowMs % (STROLL_MS * 2));

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
    /**
     * Nhà mình là chỗ DUY NHẤT có nhiều hơn một bản vẽ, vì nó là chỗ duy nhất có người sống
     * bên trong — xem `homeSetOf`. `rows` vẫn là bộ mặc định VÀ là một trong ba bộ, không
     * phải một bản thứ tư đứng riêng: hai bản của cùng một cảnh là hai bản sẽ lệch.
     *
     * Khai ngay trong bảng này chứ không thành một hằng số riêng, và đó là chỗ đáng ghi: cả
     * `placeArt` lẫn hai bài test canh bảng màu đều duyệt `PLACES`, nên một bộ hình sống
     * ngoài bảng ấy là một bộ hình không ai kiểm — mà lỗi đầu tiên lượt này gặp đúng là thế:
     * ký tự `z` (khói bát cơm) chỉ có trong cảnh bàn ăn, và bài test báo nó "không còn ký tự
     * nào dùng" vì nó chỉ nhìn thấy cảnh bàn làm việc.
     */
    sets: { desk: HOME_ART, dine: HOME_DINE, gym: HOME_GYM, out: HOME_ART },
    chars: {
      // Sàn mang hai sắc GỖ RIÊNG, không mượn `broth`/`dim` như bản trước. Đó là chỗ sửa:
      // `broth` là vách trái cái bàn và `dim` là mặt bàn, nên sàn cũ và cái bàn cũ dùng
      // đúng một cặp màu — cái bàn không mờ, nó biến mất. Xem chú thích của `TABLE`.
      F: 'wood', e: 'plank', A: 'foam', B: 'dim', S: 'ink', s: 'screen',
      // Ba dòng chữ trên mặt kính mang BA class khác nhau vì chúng hiện ra ở ba thời điểm
      // khác nhau, còn con trỏ mang class thứ tư vì nó nháy theo nhịp riêng — xem `LAPTOP`.
      t: 'code r1', u: 'code r2', w: 'code r3', x: 'code caret',
      N: 'dim', M: 'broth', O: 'ink',
      // `z` là KHÓI của bát cơm trên bàn ăn. Không dùng lại `s`: `s` đã là mặt kính laptop ở
      // ngay trên, và hai nghĩa trên một ký tự là một bát cơm bốc ra ánh sáng màn hình.
      z: 'steam',
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

   Sáu đoạn: hai con PHỐ đi xuyên qua tâm, rồi hai cặp NGÕ khép về hai mốc ở hai đầu bản đồ
   — ô đất ở mép trước, cái giếng ở mép sau. Vẽ mỗi phố thành một đoạn dài chứ không thành
   nhiều đoạn nối đuôi vì chúng nằm trên đúng MỘT đường thẳng: cắt ra là mời mấy chỗ nối
   lệch nhau nửa pixel.

   ## Đầu đường phải ĐI ĐÂU ĐÓ

   Người dùng chỉ ra lỗi: "đường bị cụt, không biết đi tiếp đến đâu". Đo thì đúng, và cái
   nguyên nhân không phải bề dài — nó là chỗ KẾT THÚC. Bản trước cả bốn đoạn đều dừng cách
   toà nhà cuối 60px, tức dừng ngay ở mép mảnh đất của nhà ấy, GIỮA BÃI CỎ.

   Một chỗ hay bị nhầm, và tôi đã nhầm đúng nó lúc đầu: không thể "giấu đầu đường xuống dưới
   chân nhà" được. Mắt lưới `at()` là đỉnh DƯỚI của mặt nền, còn trục đường thì đi qua chính
   mắt lưới ấy — nên nửa dưới con đường luôn nằm NGOÀI mặt nền, suốt cả quãng nó đi qua nhà.
   Đường chạy dọc theo mép trước mảnh đất, không chui xuống dưới nó. Cộng thêm bao nhiêu
   `pad` cũng không đổi được điều đó.

   Nên luật là: **mỗi đầu đường hoặc là một NGÃ BA, hoặc là ra khỏi khung.** Có một bài test
   canh cả hai vế.

   - Hai con phố kéo dài thêm ĐÚNG MỘT BƯỚC LƯỚI ra ngoài toà nhà cuối, tức tới `(±2, 0)` và
     `(0, ±2)`. Ở đó chúng đã ra ngoài `TOWN_BOX` và bị `.town-map` cắt — mà một con đường bị
     KHUNG TRANH cắt thì đọc thành "còn đi tiếp", không đọc thành cụt. Khai bằng mắt lưới chứ
     không bằng một con số dài: lần nới bước lưới sau chúng tự dài theo.
   - Bốn cái ngõ giữ nguyên `ROAD_PAD`, và ở đó `pad` làm đúng việc của nó: hai đoạn gối lên
     nhau nên chỗ gặp là một mảng liền, không phải hai mũi nhọn chạm nhau.

   `open` đánh dấu mấy đoạn CỐ Ý ra ngoài khung, để `TOWN_BOX` đừng nở ra ôm lấy chúng — nếu
   nó ôm thì cả bản đồ to thêm 150px mỗi bên và không đoạn nào ra được khỏi khung nữa, tức
   phép chữa tự huỷ chính nó.

   Toạ độ suy từ chính `at()`, không gõ tay. `dir` là chiều dốc — hai trục của lưới, và CSS
   lệch thẻ đi đúng arctan(0,5) theo chiều ấy (xem `.town-road`). */

const ROAD_W = 40;
/**
 * Hai đầu thò quá mắt lưới ngần này, để chỗ hai đoạn gặp nhau là một mảng LIỀN.
 *
 * Phải NHỎ HƠN `ROAD_W`, và đây là hình học chứ không phải khẩu vị. Hai dải lệch `±26,57°`
 * gặp nhau ở một mắt lưới thì ở khoảng cách `x` khỏi mắt ấy, tâm chúng cách nhau đúng `x` —
 * nên chúng còn dính vào nhau tới `x = ROAD_W` rồi TÁCH RA. Bản trước để `60`, tức quá điểm
 * tách 20px: cái ngã ba trước ô đất không phải một cái chữ V, nó là một cái chữ V với hai
 * cái càng rời bay ra hai bên. Đúng thứ mà mắt đọc thành "đường cụt".
 *
 * Ba phần tư chứ không đúng bằng: đúng bằng thì hai dải chạm nhau ở một ĐIỂM, và một chỗ nối
 * rộng bằng không thì nó là một chỗ nối trên giấy.
 */
const ROAD_PAD = ROAD_W * 0.75;

function road([a1, b1], [a2, b2], open = false) {
  const p = at(a1, b1);
  const q = at(a2, b2);
  const w = Math.abs(q.x - p.x) + ROAD_PAD * 2;
  return {
    x: (p.x + q.x) / 2 - w / 2,
    y: (p.y + q.y) / 2 - ROAD_W / 2,
    w,
    h: ROAD_W,
    dir: (q.y - p.y) * (q.x - p.x) > 0 ? 'a' : 'b',
    open,
    // Hai đầu giữ lại dưới dạng MẮT LƯỚI, không phải pixel: bài test hỏi "đầu này có đè lên
    // đoạn nào khác không", và câu ấy chỉ trả lời gọn được trên lưới. Từ toạ độ pixel thì
    // phải giải ngược ra chỉ số lưới, tức chép lại `at()` lần thứ hai ở chỗ khác.
    ends: [[a1, b1], [a2, b2]],
  };
}

/**
 * Điểm `(x, y)` có nằm TRÊN mặt đường không.
 *
 * Xuất ra vì bài test cần nó, và nó phải sống Ở ĐÂY chứ không ở bài test: cái thẻ đường là
 * một chữ nhật BỊ LỆCH TRỤC (`transform: skewY(±26,565°)` — xem `.town-road`), nên hộp bao
 * của nó trong `ROADS` KHÔNG phải vùng nó thật sự phủ. Một bài test tự dựng lại phép lệch là
 * bản chép thứ hai của một con số, và lần chỉnh độ dốc sau thì bài test canh một cái hình đã
 * chết.
 *
 * `tan(26,565°) = 0,5` đúng bằng độ dốc 2:1 của cả thị trấn, nên phép lệch viết được bằng
 * đúng một phép nhân: cách tâm thẻ `d` pixel theo trục ngang thì cả dải trượt `d/2` theo trục
 * đứng. Dấu do `dir` quyết, cùng cặp mà CSS đang dùng.
 */
export function onRoad(x, y) {
  return ROADS.some((rd) => {
    if (x < rd.x || x > rd.x + rd.w) return false;
    const lean = (x - (rd.x + rd.w / 2)) * 0.5 * (rd.dir === 'a' ? 1 : -1);
    return y >= rd.y + lean && y <= rd.y + rd.h + lean;
  });
}

export const ROADS = [
  road([-2, 0], [2, 0], true),
  road([0, -2], [0, 2], true),
  road([0, 1], [1, 1]),
  road([1, 0], [1, 1]),
  road([-1, 0], [-1, -1]),
  road([0, -1], [-1, -1]),
];

/** Kích thước sprite của một chỗ, tính bằng pixel — cho `SCENE_SPOTS`, cho hộp bao `TOWN_BOX`,
 *  cho bài test đo "to nhất", và cho chỗ gọi khỏi phải tự nhân 4 lần nữa.
 *
 *  Khai TRƯỚC mọi người đọc nó, không ở cuối file: cả `SCENE_SPOTS` lẫn `TOWN_BOX` đều chạy
 *  ngay lúc nạp module, mà một `const` chưa khởi tạo thì chưa đọc được — đặt dưới là cả trang
 *  trắng với đúng một dòng "Cannot access sizeOf before initialization". Đã dính hai lần, ở
 *  hai người đọc khác nhau. */
export const sizeOf = (rows) => ({ w: Math.max(...rows.map((r) => r.length)) * 4, h: rows.length * 4 });

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

/* `kind` là kênh để CSS bám vào, và nó phải khai ở ĐÂY chứ không dò lại từ mảng hình: từ
   lượt này ba loại vật ứng xử khác nhau theo giờ và theo gió — cây lay, đèn sáng lên lúc
   chạng vạng, hoa với bụi đứng yên — mà `art: TREE` thì CSS không đọc được. Dò ngược bằng
   phép so mảng (`s.art === TREE`) cũng chạy, nhưng nó buộc mọi cây phải dùng CHUNG một
   hằng số mãi mãi; thêm một dáng cây thứ hai là im lặng mất chuyển động. */
const SCENERY = [
  // Cái giếng là NGOẠI LỆ của cả khối này: nó đứng đúng một mắt lưới, `(-1, -1)`, vì hai cái
  // ngõ sau khép về nó — mà một mốc đường thì phải nằm trên lưới đường. Khai bằng `at()` chứ
  // không bằng hai con số: lần nới bước lưới sau nó tự đi theo, y như mấy toà nhà.
  { art: WELL, kind: 'well', ...at(-1, -1) },
  // Hai cây lớn ở hai rìa — chúng vẽ ra mép của bức tranh, và mọi thứ khác nằm giữa.
  { art: TREE, kind: 'tree', x: -318, y: -40 },
  { art: TREE, kind: 'tree', x: 322, y: -18 },
  // Hai góc TRÊN, chỗ hai ô đất ngoài cùng vừa dọn đi.
  { art: TREE, kind: 'tree', x: -258, y: -186 },
  { art: BUSH, kind: 'bush', x: -196, y: -142 },
  { art: TREE, kind: 'tree', x: 266, y: -178 },
  { art: LAMP, kind: 'lamp', x: 206, y: -128 },
  // Hai bên cái giếng. Cần chúng vì cái giếng đứng thẳng phía sau nhà mình, và hai vật cùng
  // sắc gỗ xếp chồng nhau theo trục đứng thì đọc thành MỘT vật — cái giếng biến thành một
  // cái chái mọc trên nóc nhà. Một bụi cỏ và một khóm hoa chen vào giữa là đủ để mắt tách
  // chúng ra, mà không tốn thêm một vật cao nào.
  { art: BUSH, kind: 'bush', x: -120, y: -200 },
  { art: FLOWER, kind: 'flower', x: 108, y: -204 },
  // Hai bên sườn.
  { art: BUSH, kind: 'bush', x: -286, y: 56 },
  { art: FLOWER, kind: 'flower', x: -158, y: 22 },
  { art: BUSH, kind: 'bush', x: 292, y: 46 },
  // Mép trước, hai bên con đường dẫn xuống ô đất.
  //
  // Ba chỗ ở khối này ĐÃ DỜI, và lý do là một phép đo chứ không phải một cảm giác. Người dùng
  // chỉ vào ảnh: "mấy vật thể đang nằm giữa đường nhìn rất là kì". Đo bằng `onRoad` thì đúng
  // ba vật chồng lên mặt đường — một cái cây có CHÂN nằm hẳn trên phố ngang, một cái cây nữa
  // và một cột đèn thì thân cắt ngang qua dải đường.
  //
  // Vì sao ba chỗ ấy lọt: toạ độ của cả khối này chọn bằng mắt trên bãi cỏ, mà mặt đường thì
  // KHÔNG phải cái hộp bao khai trong `ROADS` — nó là hộp ấy đã bị lệch trục 26,565°, tức nó
  // trượt lên hoặc xuống tới 190px ở hai đầu. Nhìn mã thì không thấy; nhìn màn hình thì phải
  // để ý mới thấy. Nay có `onRoad` và một bài test đi qua từng vật, nên nó không lọt lại được.
  { art: TREE, kind: 'tree', x: -246, y: 210 },
  { art: LAMP, kind: 'lamp', x: -96, y: 200 },
  { art: FLOWER, kind: 'flower', x: 58, y: 196 },
  { art: BUSH, kind: 'bush', x: 128, y: 208 },
  { art: TREE, kind: 'tree', x: 230, y: 200 },
];

// `d`, `n`, `w` vào cùng lượt với cái giếng: mặt đá, vách khuất, và gỗ của cần trục. Không
// ký tự nào trong số ấy đang có mặt ở cây, bụi, đèn hay khóm hoa — nên thêm vào là thêm, chứ
// không đổi nghĩa cái gì đang vẽ.
const SCENE_CHARS = { L: 'leaf', P: 'pine', b: 'broth', g: 'gold', k: 'ink', r: 'rose', p: 'plum', f: 'foam', d: 'dim', n: 'plank', w: 'wood' };

/** Cây cối quanh phố, đã kèm chỗ đứng — chỗ gọi chỉ việc xếp chúng cùng mấy toà nhà theo
 *  `y` để phép sắp lớp vẫn là một phép duy nhất.
 *
 *  Kèm CỠ từ lượt này, đo bằng `sizeOf` chứ không gõ tay: bài test "không vật nào mọc giữa
 *  lòng đường" phải đo trên cả hộp của sprite chứ không mỗi cái chân — một cột đèn chân trên
 *  cỏ mà thân cắt ngang mặt đường thì vẫn là một cột đèn mọc giữa đường. Cho bài test tự khai
 *  một bảng cỡ là một bảng sẽ lệch ngay lần sửa dáng cây tiếp theo. */
export const SCENE_SPOTS = SCENERY.map((s, i) => ({ i, kind: s.kind, x: s.x, y: s.y, ...sizeOf(s.art) }));

/**
 * Vẽ một chỗ.
 *
 * `shaded: false` như mọi hình khác: phép chấm bóng giả định một khối đặc lồi được chiếu từ
 * trên-trái, mà ở đây ba mặt của một khối đã có ba sắc riêng do `box` gán — thả `shadeOf`
 * lên trên là hai hệ đổ sáng chồng nhau, và chỗ chúng cãi nhau đọc thành lốm đốm.
 *
 * Kích thước khai từ CHÍNH cái lưới, cùng lý do đã ghi ở `itemArt`.
 *
 * `edged` thêm một lớp VIỀN vẽ dưới hình — chỉ NHÂN VẬT mới bật, không phải nhà cửa: nhà
 * đứng yên trên đúng một nền, còn nhân vật thì đi qua cỏ, qua đường, qua sàn gỗ, qua thảm
 * hồng, và không màu thân nào đọc được trên cả bốn. Cả lý lẽ nằm ở `outlineRows`, `pixel.js`.
 *
 * Khung của thẻ KHÔNG nở theo cái viền: viền đối xứng nên tâm hình không đổi, mà chính cái
 * khung này đang chở phép căn tâm của người đi đường (`--ww`/`--wh`) lẫn phép đo của bài test.
 */
const draw = (rows, chars, cls, edged = false) => {
  const w = Math.max(...rows.map((r) => r.length)) * 4;
  return html`<span class="pet-art ${cls}" aria-hidden="true"
    style="width:${w}px;height:${rows.length * 4}px"
    >${edged ? outline(rows) : ''}${pixels(rows, chars, false)}</span
  >`;
};

/**
 * Vẽ một chỗ — và NHÀ MÌNH là chỗ duy nhất đọc thêm `doing`.
 *
 * Bốn chỗ kia là kiến trúc: một quán ăn không đổi hình vì chủ nhà đang uống nước. Nhà mình
 * thì là chỗ DUY NHẤT có người sống bên trong, nên nó là chỗ duy nhất mà đồ đạc phải kể được
 * việc đang xảy ra — xem `homeSetOf`.
 *
 * Tham số có mặc định `null`, và mặc định ấy phải trả về đúng cảnh bàn làm việc: bài test và
 * mấy chỗ gọi cũ không truyền gì cả, mà một cảnh trống ở đấy là một căn phòng rỗng không ai
 * giải thích được.
 */
export function placeArt(id, doing = null) {
  const p = PLACES.find((x) => x.id === id);
  if (!p) return '';
  // Không có ca riêng cho `home`: chỗ nào khai `sets` thì chỗ ấy đổi cảnh, chỗ nào không khai
  // thì `?.` rơi về `p.rows`. Thêm một chỗ đổi cảnh sau này là thêm một trường, không phải
  // thêm một nhánh `if`.
  const set = p.sets ? homeSetOf(doing) : null;
  return draw(p.sets?.[set] ?? p.rows, p.chars, `town-art art-place-${id}${set ? ` set-${set}` : ''}`);
}

export const lotArt = () =>
  draw(LOT, { e: 'broth', f: 'foam', d: 'dim', k: 'ink', g: 'gold', w: 'wood', p: 'plank' }, 'town-art art-lot');

export const sceneArt = (i) => draw(SCENERY[i].art, SCENE_CHARS, `town-art art-scene kind-${SCENERY[i].kind}`);

/* ── Dân thị trấn ──────────────────────────────────────────────────────────────

   Hai con, đi trên hai con đường xuyên tâm. Chúng không bấm được, không mang tin gì, và đó
   là toàn bộ việc của chúng: một thị trấn mà vật duy nhất chuyển động là chủ nhà thì nó là
   một mô hình có một con búp bê chạy pin, không phải một chỗ có người ở.

   ## Vì sao KHÔNG còn là hình người

   Đời trước là hai bóng người 6×8 ô, khác nhau đúng một màu áo. Người dùng nói thẳng: nhìn
   không dễ thương. Đo lại thì lời ấy có cái nền kỹ thuật của nó, và cái nền ấy là chỗ đáng
   sửa chứ không phải khẩu vị:

   - **Ở 8 hàng, một hình người chỉ còn là cái đường bao của một hình người.** Không mặt,
     không tay, hai chân hai ô. Mà đường bao người thì mắt nhận ra ngay và lập tức đi tìm
     phần còn lại — nó tìm mặt, tìm tay, không thấy, và đọc thành hình chưa vẽ xong. Một con
     vật tròn thì không mời ai đi tìm gì cả: tròn là đã đủ tròn.
   - **Hai bóng người y hệt nhau khác mỗi màu áo đọc thành MỘT người và cái bóng của anh
     ta.** Đời trước phải chữa bằng một luật CSS đổi màu áo cho con thứ hai — một phép chữa
     ở tầng màu cho một vấn đề ở tầng HÌNH. Giờ hai con khác hẳn loài nên luật ấy bỏ được.
   - **Nhịp đi phải kể bằng hai chân, kênh duy nhất còn chỗ.** Hai ô nhấp nháy cạnh thân ở
     cỡ này đọc thành nhiễu render. Mochi và gà con không dùng kênh ấy: một con NHÚN cả
     thân, một con NHẢY cả thân — cả sprite dịch, tức kênh chuyển động rộng bằng cả hình
     thay vì bằng hai ô.

   Vẫn nhỏ hơn quản gia, và lý do không đổi: chúng ở xa hơn về mặt câu chuyện, mà vẽ bằng cỡ
   quản gia thì mắt sẽ đi tìm xem chúng có bấm được không. Nhỏ hơn một bậc thì chúng đọc
   thành phông nền — đúng vai của chúng.

   ## Vì sao chân mochi thôi không còn màu riêng

   Đời trước chân mochi là `M` — một sắc mận tối, để tách hai cái chân ra khỏi cái thân
   hồng. Từ lượt có VIỀN thì cách ấy quay ra chống lại chính nó: cái viền `--art-edge` là
   sắc tối nhất trong bảng, và một cái chân rộng ĐÚNG MỘT Ô, tối, kẹp giữa hai ô viền, thì
   ở 4px nó không còn là cái chân — cả hàng đáy đọc thành một vệt tối liền.

   Nay chân mang đúng sắc thân, và thứ tách chúng ra là cái viền chạy LỌT vào giữa hai chân.
   Đó là cách tranh pixel vẫn làm, và nó tốt hơn hẳn: hai cái chân hồng có viền đen thì đọc
   được ở mọi nền, còn hai cái chân tối thì chỉ đọc được trên nền sáng.

   `m` thân và chân mochi · `y` lông gà · `r` mỏ và chân gà · `k` mắt · `.` trống */

/**
 * MOCHI — đi bằng cách NHÚN: khung a bẹp và bè, khung b vươn cao, chân chụm lại.
 *
 * Cả hai khung cùng 7×5 ô nên hình không nhảy chỗ; cái đổi là thân chiếm mấy hàng. Hai con
 * mắt nằm đúng hai cột 2 và 4 ở CẢ HAI khung — mắt xê dịch giữa hai khung đọc thành hình
 * rung chứ không đọc thành nhún.
 */
const MOCHI = [
  ['.......', '..mmm..', '.mkmkm.', 'mmmmmmm', '.m...m.'],
  ['..mmm..', '.mmmmm.', 'mmkmkmm', 'mmmmmmm', '..mmm..'],
];

/**
 * GÀ CON — đi bằng cách NHẢY: khung b là cả con nhích lên đúng một ô, chân co lại.
 *
 * Đây là chỗ nó hơn hẳn một cú đảo chân ở cỡ này. Một bước chân là hai ô đổi chỗ; một cú
 * nhảy là hai mươi mấy ô cùng dịch lên 4px, tức cùng một quãng chuyển động mà biên độ gấp
 * mười. Ở 24px thì đó là khác biệt giữa "có nhúc nhích gì đó" và "nó đang đi".
 *
 * Mỏ ở cột phải cùng: nó là thứ DUY NHẤT nói con này quay mặt về đâu, mà một con vật đi
 * đường thì phải có mặt trước — xem chú thích chọn tuyến ở `WALKERS`.
 */
const CHICK = [
  ['.......', '..yyy..', '.yyyyy.', '.ykyyyr', '..yyy..', '..r.r..'],
  ['..yyy..', '.yyyyy.', '.ykyyyr', '..yyy..', '...r...', '.......'],
];

const WALKER_ART = [MOCHI, CHICK];
const WALKER_CHARS = { m: 'rose', k: 'ink', y: 'gold', r: 'wood' };

/**
 * Hai con, mỗi con một tuyến và một nhịp.
 *
 * Tuyến khai bằng chính `at()` như mọi thứ khác trên bản đồ, nên chúng đi ĐÚNG trên đường
 * chứ không đi cạnh nó — và lần nới bước lưới tiếp theo thì chúng đi theo, không phải chỉnh
 * tay.
 *
 * `dur` lệch nhau và không phải bội của nhau: hai con cùng chu kỳ thì cứ mỗi vòng lại gặp
 * nhau đúng một chỗ, và cái trùng lặp ấy đọc thành máy móc. 37 với 43 giây là hai số nguyên
 * tố cùng nhau, nên phải hơn mười lăm phút chúng mới lặp lại một thế đứng.
 *
 * Gà con nhận tuyến ĐỨNG (trên xuống dưới) chứ không phải tuyến ngang, và đó không phải một
 * lựa chọn tuỳ tiện: nó có mỏ, tức có mặt trước, mà `alternate` thì cho nó đi rồi lùi trên
 * cùng một tuyến. Trên tuyến ngang, nửa chu kỳ nó sẽ đi giật lùi thấy rõ. Trên tuyến đứng
 * thì hướng mỏ không nói gì về chiều đi, nên không có nửa nào sai. Mochi không có mặt trước
 * nên nó nhận tuyến còn lại mà không mất gì.
 */
export const WALKERS = [
  { i: 0, from: at(-1, 0), to: at(1, 0), dur: 37 },
  { i: 1, from: at(0, 1), to: at(0, -1), dur: 43 },
];

/**
 * Bề rộng và chiều cao gửi sang CSS bằng biến, vì hai con không cùng cỡ và phép căn tâm
 * phải suy từ chính cái lưới. Đời trước viết cứng `-12px`/`-16px` — đúng cho một sprite
 * 24×32 và sai cho mọi sprite khác, mà không có gì báo.
 */
const walkerFrame = (rows, cls) => html`<span class="walker-frame ${cls}"
  style="--ww:${Math.max(...rows.map((r) => r.length)) * 4}px;--wh:${rows.length * 4}px"
  >${draw(rows, WALKER_CHARS, 'town-art art-walker', true)}</span
>`;

export const walkerArt = (i) => {
  const [a, b] = WALKER_ART[i] ?? WALKER_ART[0];
  return html`${walkerFrame(a, 'a')}${walkerFrame(b, 'b')}`;
};

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
  // Mấy đoạn `open` KHÔNG tính vào khung: chúng cố ý chạy ra ngoài để bị `.town-map` cắt
  // (xem khối chú thích của `ROADS`). Ôm lấy chúng là khung nở theo, và lúc đó không đoạn nào
  // ra được khỏi khung nữa — phép chữa tự huỷ chính nó, mà không có gì đỏ lên.
  for (const rd of ROADS) {
    if (rd.open) continue;
    const lean = (rd.w / 2) * 0.5;
    box(rd.x, rd.y - lean, rd.x + rd.w, rd.y + rd.h + lean);
  }
  // Biển tên chỉ treo dưới mấy chỗ có tên, mà chỗ thấp nhất thì luôn là một trong số đó
  // (ô đất ở mép trước) — nên cộng một lần vào đáy là đủ, không phải cộng cho từng vật.
  b += SIGN_DROP;
  return { w: Math.round(r - l), h: Math.round(b - t), ox: Math.round(-l), oy: Math.round(-t) };
})();

