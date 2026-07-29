/**
 * Phong cách vẽ chart.
 *
 * Cùng một con số vẽ được bằng nhiều hình, và mỗi hình làm nổi một chuyện khác nhau:
 * cột đọc ra xu hướng, vùng đọc ra hình dáng của cả đoạn, quạt tròn đọc ra tỉ lệ,
 * treemap đọc ra "cái nào chiếm chỗ". Nút phong cách cho phép đổi giữa chúng — kể cả
 * đổi ngẫu nhiên — mà **không bao giờ** rơi vào một hình sai với dữ liệu.
 *
 * Đó là toàn bộ lý do file này tồn tại: chỗ ngẫu nhiên phải có hàng rào. Chuỗi theo
 * NGÀY không được vẽ thành quạt tròn (quạt tròn nói về tỉ lệ của một tổng, mà tổng của
 * "token mỗi ngày" thì không có nghĩa gì với thứ tự thời gian đã bị vứt đi), và bảng
 * XẾP HẠNG không được vẽ thành đường (đường ngụ ý hai mốc cạnh nhau có liên hệ, mà thứ
 * tự ở đây chỉ là do sắp xếp). Nên "ngẫu nhiên" ở đây là ngẫu nhiên TRONG danh sách
 * hợp lệ của từng kiểu dữ liệu, không phải ngẫu nhiên trên tất cả các hình.
 *
 * Hai kiểu dữ liệu:
 * - `series` — có trục thời gian, thứ tự mang nghĩa.
 * - `rank`   — các hạng mục rời, cộng lại thành một tổng có nghĩa.
 */

const KEY = 'now-skin';

const FORMS = {
  series: ['columns', 'area', 'lollipop'],
  rank: ['hbars', 'donut', 'treemap'],
};

/** Thứ tự vòng của nút. `random` đứng cuối để ba phong cách xác định đi trước. */
export const SKINS = ['plain', 'curve', 'block', 'random'];

/** Hình của từng phong cách. Ở cạnh danh sách phong cách để không bao giờ lệch nhau. */
export const SKIN_ICON = { plain: '▤', curve: '◠', block: '▨', random: '⁘' };

/** Phong cách xác định = lấy dạng thứ N trong danh sách của mỗi kiểu. */
const NTH = { plain: 0, curve: 1, block: 2 };

function read() {
  try {
    const v = localStorage.getItem(KEY);
    if (SKINS.includes(v)) return v;
  } catch {
    /* chế độ riêng tư chặn localStorage — dùng mặc định */
  }
  return 'plain';
}

let skin = read();
/**
 * Hạt giống của phong cách ngẫu nhiên.
 *
 * Trang tự vẽ lại 30 giây một lần. Gọi `Math.random()` lúc vẽ thì mỗi lượt quét là mọi
 * chart nhảy sang một hình khác — không đọc nổi, và tệ hơn là trông như dashboard bị
 * lỗi. Nên ngẫu nhiên chỉ xảy ra đúng một lần: lúc bấm nút.
 */
let seed = 1;
const listeners = new Set();

export const getSkin = () => skin;
export const nextSkin = () => SKINS[(SKINS.indexOf(skin) + 1) % SKINS.length];

export function setSkin(next) {
  skin = SKINS.includes(next) ? next : 'plain';
  if (skin === 'random') seed = Math.floor(Math.random() * 0x7fffffff);
  try {
    localStorage.setItem(KEY, skin);
  } catch {
    /* không nhớ được thì lần sau mở lại về mặc định, không sao */
  }
  for (const fn of listeners) fn();
}

export function onSkinChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Băm tên chart + hạt giống → chỉ số dạng vẽ.
 *
 * Hai chart khác tên phải ra hai hình khác nhau (nếu không thì "ngẫu nhiên" chỉ là đổi
 * đồng loạt), còn một chart thì phải giữ nguyên hình qua mọi lượt vẽ lại.
 */
function hash(id) {
  let h = seed >>> 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return h;
}

/** `id` là mã ổn định của chart (dùng luôn mã của bảng số song sinh). */
export function formFor(kind, id) {
  const list = FORMS[kind];
  if (!list) return null;
  if (skin !== 'random') return list[Math.min(NTH[skin] ?? 0, list.length - 1)];
  return list[hash(String(id ?? kind)) % list.length];
}

/** Chỉ dùng cho test: đặt hạt giống cố định để kiểm tra tính ổn định. */
export function _setSeed(v) {
  seed = v >>> 0;
}
