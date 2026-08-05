/**
 * Đồ ăn và đồ trang trí của quản gia — hình vẽ, và cái thanh đói.
 *
 * Sống ở `lib/` chứ không ở `views/` vì HAI bề mặt dùng chung: popover thanh menu bày
 * món đã mua lên khung trời, còn màn Cửa hàng trên dashboard bày cả bảng hàng. Vẽ hai
 * lần thì cái mũ trong cửa hàng và cái mũ trên đầu nhân vật là hai cái mũ khác nhau —
 * đúng lỗi mà `menubar-view.js` đã tách ra để tránh một lần rồi.
 *
 * Mọi sprite chung LƯỚI 4px với quản gia, và vẽ qua chính `pixels` của nó. Một vật bo
 * trơn đứng cạnh một vật răng cưa thì cái răng cưa đọc thành lỗi chứ không đọc thành
 * phong cách — ghi chú ấy nằm ở `SUN`/`CLOUD` và áp nguyên vào đây.
 *
 * Quy ước ký tự đi theo TỪNG món (`chars` riêng), không phải một bảng chung: `b` là dải
 * băng của cái mũ mà cũng là vành thứ hai của cầu vồng, và ép chúng dùng chung một tên
 * màu chỉ để bảng gọn hơn là đổi một thứ đọc được lấy một thứ ngắn hơn.
 */

import { html } from './dom.js';
import { pixels } from './pixel.js';
import { t } from './i18n.js';

/* ── Ăn uống ──────────────────────────────────────────────────────────────── */

const COFFEE = [
  '..s...s..',
  '#######..',
  '#ooooo#..',
  '#ooooo###',
  '#ooooo#.#',
  '#ooooo###',
  '.#####...',
];

const CHE = [
  '.#####.',
  '.#ppp#.',
  '.#pgp#.',
  '.#gpg#.',
  '.#ppp#.',
  '.#####.',
  '..###..',
];

const BEER = [
  '.fffffff.',
  '#ffffff##',
  '#oooooo.#',
  '#oooooo##',
  '#oooooo..',
  '#oooooo..',
  '.######..',
];

/**
 * Ổ bánh mì: thuôn hai đầu, có VẾT KHÍA.
 *
 * Bản đầu vẽ nó nằm chéo để khỏi lẫn với cái thanh hạn mức. Nhìn thật thì một đường chéo
 * dựng bằng mấy bậc 2 ô đọc thành **cầu thang**, không đọc thành bánh mì — cái nhịp bậc
 * mạnh hơn hẳn cái ý đường chéo. Nằm ngang mà thuôn hai đầu thì hết lẫn, và mấy vết khía
 * mới là thứ nói "đây là bánh".
 */
const BANHMI = [
  '..#######..',
  '.#########.',
  '##o#o#o#o##',
  '.#########.',
  '..#######..',
];

const PHO = [
  '..s...s..',
  '.n.n.n.n.',
  '#########',
  '#ooooooo#',
  '.#######.',
  '..#####..',
];

/* ── Trang trí ────────────────────────────────────────────────────────────── */

/** Nón SÁU ô, không phải tám. Đỉnh đầu quản gia chỉ rộng hai ô (`.......##.......`), nên
 *  một cái nón tám ô ngồi lên đó trông như cái nón đang rơi qua người. */
const HAT = ['.####.', '.####.', '.bbbb.', '######'];

const PLANT = [
  '..g.g..',
  '.ggggg.',
  '.ggggg.',
  '...g...',
  '.#####.',
  '.#####.',
  '..###..',
];

/** Bầu bóng phải CÓ MÀU. Bản đầu để nó lấy sắc gốc trắng ngà và đứng cạnh đám mây —
 *  một khối tròn trắng có cuống thì đọc thành cây kẹo mút, không đọc thành bóng bay. */
const BALLOON = ['.ppp.', 'ppppp', 'ppppp', 'ppppp', '.ppp.', '..p..', '..s..', '..s..'];

/** Dây cờ: một sợi kẻ rồi năm lá cờ tam giác treo dưới. Ba màu xoay vòng chứ không phải
 *  năm — năm màu trên một dải 76px thì mắt đọc thành nhiễu, không đọc thành dây cờ. */
const BUNTING = ['###################', 'aaa.bbb.ccc.aaa.bbb', '.a...b...c...a...b.'];

const CAT = ['#.....#', '##...##', '#######', '#o###o#', '##ooo##', '.#####.', '.##.##.'];

/** Cầu vồng: ba vành LỒNG NHAU, không phải ba sọc xếp chồng. Ba sọc ngang ở cỡ này đọc
 *  thành một lá cờ; chỗ làm nó thành cầu vồng là cái vòng cung, nên vòng cung phải có
 *  thật ở cả ba vành. */
const RAINBOW = [
  '...aaaaaaaa...',
  '..a........a..',
  '..a.bbbbbb.a..',
  '.a..b....b..a.',
  '.a..b.cc.b..a.',
  '.a..b.cc.b..a.',
];

/**
 * Bảng hình — khoá TRÙNG mã món trong `src/pet.js`.
 *
 * Hai bảng ở hai bên (giá ở server, hình ở đây) và chúng phải khớp mã. Không gộp được:
 * server không có quyền quyết định hình, còn trình duyệt thì không được quyết định giá
 * (xem khối chú thích của `ITEMS`). Cái nối chúng là bài test parity ở `test/pet.test.js`
 * — nó bắt đúng ca thêm món ở một bên mà quên bên kia.
 */
export const ART = {
  coffee: { rows: COFFEE, chars: { o: 'ink', s: 'steam' } },
  che: { rows: CHE, chars: { p: 'plum', g: 'leaf' } },
  beer: { rows: BEER, chars: { o: 'gold', f: 'foam' } },
  banhmi: { rows: BANHMI, chars: { o: 'ink' } },
  pho: { rows: PHO, chars: { o: 'broth', n: 'foam', s: 'steam' } },

  hat: { rows: HAT, chars: { b: 'gold' } },
  plant: { rows: PLANT, chars: { g: 'leaf' } },
  balloon: { rows: BALLOON, chars: { p: 'plum', s: 'steam' } },
  bunting: { rows: BUNTING, chars: { a: 'gold', b: 'leaf', c: 'plum' } },
  cat: { rows: CAT, chars: { o: 'gold' } },
  rainbow: { rows: RAINBOW, chars: { a: 'gold', b: 'leaf', c: 'plum' } },
};

/**
 * Vẽ một món.
 *
 * `shaded: false` cho mọi món — phép chấm sắc độ `shadeOf` giả định nguồn sáng trên-trái
 * và một khối ĐẶC. Mấy món này phần lớn là viền rỗng (cái ly, cái bát, vòng cầu vồng),
 * nên chấm bóng lên chúng ra một mớ lốm đốm chứ không ra khối.
 */
export function itemArt(id) {
  // `Object.hasOwn` chứ không phải `ART[id]` trơn — cùng cái bẫy kế thừa `Object.prototype`
  // đã ghi ở `buy()` trong `src/pet.js`: `ART['constructor']` là một hàm, và `.rows` của
  // nó là `undefined`, nên `pixels` ném giữa lượt vẽ và cả trang trắng.
  const a = Object.hasOwn(ART, id) ? ART[id] : null;
  if (!a) return '';
  // Kích thước khai từ CHÍNH cái lưới, không chép tay vào CSS. Mấy ô pixel đều nằm tuyệt
  // đối nên thẻ bọc không có bề rộng tự nhiên nào; thiếu con số này thì nó rộng 0 và mọi
  // phép căn giữa — ô hàng trong cửa hàng, `translateX(-50%)` của mấy chỗ đứng trong khung
  // trời — đều căn vào hư không. Sửa một dòng sprite là kích thước tự đi theo, còn bản
  // chép tay thì lần sửa thứ hai đã lệch (cùng lý lẽ với `shadeOf`).
  const w = Math.max(...a.rows.map((r) => r.length)) * 4;
  return html`<span class="pet-art art-${id}" style="width:${w}px;height:${a.rows.length * 4}px"
    >${pixels(a.rows, a.chars, false)}</span
  >`;
}

/**
 * Thanh đói.
 *
 * Nó KHÔNG mượn `quotaBar`, dù trông gần giống. Thanh hạn mức chở một luật đọc rất riêng
 * — "đã tiêu" là số dẫn, kênh màu đo đúng một đại lượng là phần bỏ phí (luật 1 trong
 * CLAUDE.md) — và cho một thanh trò chơi mượn hình dáng ấy là mời người đọc áp cùng luật
 * lên một thứ không có luật đó. Thanh này chỉ nói một điều: còn no bao nhiêu.
 */
export function hungerBar(pet) {
  const pct = Math.round(pet.full * 100);
  return html`<span class="pet-bar mood-${pet.mood}" role="img"
    aria-label="${t('pet.fullAria', { pct })}"
    ><i style="width:${pct}%"></i
  ></span>`;
}

/** Còn bao lâu thì đói hẳn — nói bằng giờ, vì đó là thứ quyết định "có phải cho ăn trước
 *  khi đi ngủ không". Dưới một giờ thì nói bằng phút. */
export function hungerText(pet) {
  const left = pet.full * pet.fullMs;
  if (left <= 0) return t('pet.starved');
  const mins = Math.round(left / 60000);
  return mins < 60 ? t('pet.leftMin', { n: mins }) : t('pet.leftHour', { n: Math.round(mins / 60) });
}
