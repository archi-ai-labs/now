import { t, locale } from './i18n.js';

/** Đánh dấu chuỗi đã an toàn, được phép chèn thẳng làm HTML. */
const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: String(s) });

/**
 * Hai ký tự cuối bảng là dấu bọc giá trị pha (xem khối "Giá trị pha"). Nội dung từ đĩa mang được
 * đúng hai ký tự ấy, vì Nerd Fonts đặt biểu tượng Pomicons ở U+E000–E00A, nên chúng được viết
 * thành thực thể: trình duyệt vẫn hiện ra đúng ký tự, còn dấu bọc trần trong chuỗi HTML thì chỉ
 * có thể đến từ `phase()`.
 */
const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\uE000': '&#xE000;', '\uE001': '&#xE001;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"'\uE000\uE001]/g, (c) => escapeMap[c]);

function interpolate(v) {
  if (v == null || v === false) return '';
  if (v[RAW] !== undefined) return v[RAW];
  if (Array.isArray(v)) return v.map(interpolate).join('');
  return esc(v);
}

/**
 * Template HTML tự thoát ký tự. Nội dung NOW board do người dùng viết nên mọi
 * giá trị chèn vào đều được escape; muốn chèn HTML thật thì bọc bằng `raw()`.
 */
export function html(strings, ...vals) {
  return raw(strings.reduce((acc, s, i) => acc + s + (i < vals.length ? interpolate(vals[i]) : ''), ''));
}

/**
 * Chuỗi HTML thật bên trong kết quả `html`.
 *
 * Có cửa này vì `RAW` là Symbol nội bộ, mà test thì chạy trong Node — không có DOM để
 * `mount` vào, nên cách duy nhất soát được cái `quotaBar` vẽ ra là đọc thẳng chuỗi. Không
 * xuất ra thì test phải tự mò `Object.getOwnPropertySymbols`, tức là bám vào đúng thứ
 * `RAW` sinh ra để giấu đi.
 */
export const rawText = (tpl) => tpl?.[RAW] ?? String(tpl ?? '');

/* ── Biến CSS nội tuyến → class dùng chung ─────────────────────────────────────

   ## Vì sao mount() không gán thẳng innerHTML nữa

   Safari tự tải lại web app trên Dock với câu "This web app was reloaded because it was
   using significant memory". Đo trên Safari 17.6: mỗi 100 lượt vẽ màn Dự án làm tiến trình
   WebContent phình thêm 64,5 MB, tăng tuyến tính, và một lượt GC đầy đủ của JS không lấy
   lại được byte nào. Chrome đứng phẳng.

   Chỗ rò nằm trong WebKit. Mỗi `Style::Resolver` giữ một `MatchedDeclarationsCache`, khoá
   của mỗi mục gồm các khối khai báo khớp được cộng với ĐỊA CHỈ bộ biến CSS mà phần tử thừa
   kế từ cha, và một mục chỉ bị dọn khi một khối khai báo của nó không còn ai giữ. Phần tử tự
   khai biến qua thuộc tính style="--x:…" thì mỗi lần dựng lại mang một đối tượng biến
   (`StyleCustomPropertyData`) MỚI, tức một địa chỉ mới. Mọi con cháu của nó, kể cả
   ::before/::after, vì vậy băm ra một khoá chưa từng thấy và nhận một mục mới cỡ 1 KB; khai
   báo của chúng đến từ styles.css nên mục ấy không bao giờ bị dọn. Màn Dự án có 27 phần tử
   như thế phủ 346 trên 385 phần tử của #view, tức khoảng 315 mục vĩnh viễn mỗi lượt vẽ.
   WebKit đã nhận lỗi (bug 312236, commit ebcf88c1bc) nhưng chỉ đặt trần 16 nghìn mục trên
   nhánh main, còn Safari 17.6 không có trần nào.

   Cách chữa là mỗi thuộc tính style có khai biến thành đúng một luật, ví dụ
   `.nv-12 { --a: x !important; width: 3px !important }`, trong một stylesheet dựng sẵn
   (constructed stylesheet) gắn vào document. Phần tử nhận class đó thay cho thuộc tính style,
   và thuộc tính giống hệt nhau ở mọi lượt vẽ thì dùng chung một luật, nên phần tử dựng lại vẫn
   trỏ về cùng một khối khai báo và cache thôi mọc. Gán lại từng biến bằng
   `element.style.setProperty` sau khi dựng thì KHÔNG chữa được (54,5 MB), vì đó vẫn là style
   nội tuyến; số đo của bản chữa nằm ở CHANGELOG.md.

   Khai báo thường đứng chung thuộc tính với biến (`width`, `z-index`, `animation-delay`…)
   cũng vào luật, giữ đúng thứ tự viết. Phần tử còn giữ dù chỉ một khai báo nội tuyến thì mỗi
   lần dựng vẫn mang một khối khai báo mới, nên nó trượt cache, WebKit tạo cho nó một bộ biến
   mới, và con cháu của nó lại nhận mục vĩnh viễn.

   Thuộc tính style ĐỌC biến (`color:var(--dim)`) cũng được dời, dù nó không khai biến nào. WebKit
   gộp các style nội tuyến giống hệt nhau vào một khối dùng chung
   (`ImmutableStyleProperties::createDeduplicating`), nhưng giá trị chứa `var()` không băm được
   nên không bao giờ được gộp: lượt vẽ nào phần tử ấy cũng mang khối mới, trượt cache và thêm một
   mục. Mục ấy chỉ đi ở lượt dọn một phút sau, nên bộ nhớ dao động theo số lượt vẽ mỗi phút. Đo
   trên WebKit, màn Quyết định vẽ mỗi 500 ms: 15,0 MB mỗi 100 lượt còn 4,3 khi bỏ `var()` khỏi
   style nội tuyến. Thuộc tính không khai biến và không đọc biến thì ở lại nguyên văn: WebKit gộp
   được nó, phần tử ấy không tạo bộ biến riêng, và con cháu vẫn thừa kế đúng địa chỉ của cha.

   Chỉ cần một khai báo trong thuộc tính không chép an toàn được vào luật là cả thuộc tính ở
   lại nội tuyến. Dời một phần là đổi nghĩa: `--x:a; --x:<lạ>` thì bản nội tuyến lấy cái sau,
   còn bản đã dời với `!important` lại lấy cái trước.

   `!important` giả lập thứ bậc của style nội tuyến, vốn thắng mọi luật thường của tác giả. Nó
   khác style nội tuyến thường ở ba chỗ. Thứ nhất, nó thắng hoạt hình CSS. Thứ hai, nó đổi thứ
   bậc với mọi luật `!important` khác của tác giả, hôm nay là styles.css, và cả một stylesheet
   thêm vào sau này. Vì vậy test/dom.test.js canh hai luật: không biến nào do `@property` khai
   hay do `@keyframes` đổi được đặt nội tuyến, và không thuộc tính thường nào được dời (đi cùng
   biến, hay nằm trong thuộc tính đọc biến) bị một `@keyframes` đổi hay bị styles.css khai
   `!important`, trừ ngoại lệ được ghi tên và kiểm chứng trong test. Thứ ba, từ khoá
   `revert-layer` (và `revert-rule`) lùi về một tầng khác: nội tuyến thì lùi về luật thường của
   styles.css, còn trong luật `!important` thì lùi qua cả tầng ấy. Giá trị nào chứa hai từ khoá
   này thì không được dời. Phép soát theo chữ bỏ sót đúng một đường vòng: `color:var(--x)` khi
   `--x` mang giá trị `revert-layer`. Hiện không file CSS hay JS nào trong public/ dùng từ
   `revert`.

   Thẻ tr, td, th, thead, tbody, tfoot tạo bộ biến mới ở mọi lượt dù trúng cache, vì html.css
   của WebKit khai `border-color: inherit` cho chúng. Vì vậy thẻ bảng mang biến chỉ được là thẻ
   lá, và test/dom.test.js canh điều đó.

   Chèn hay xoá một luật trong stylesheet đang dùng làm WebKit bỏ cả `Style::Resolver` cùng
   cache của nó (đọc mã Safari 17.6: `Style::Scope::scheduleUpdate`), rồi tính lại style cả
   trang. Một màn có HTML ổn định vì thế không chèn thêm luật nào sau lượt vẽ đầu. Màn thị
   trấn, bench và popover thì mang giá trị mới ở mọi lượt dựng lại (`--now` của `lifeClock`, độ
   trễ của người qua đường, nhịp vơi của món đang ăn), nên lượt dựng lại nào của chúng cũng chèn
   luật mới.

   Lần bỏ resolver ấy có giá, đo trên WebKit: một luật chèn thêm cộng một lần tính style tốn
   24 ms trên DOM 632 phần tử và 49 ms trên DOM 7.106 phần tử của màn thị trấn, so với 0 và 5 ms
   khi chỉ đổi một class. Một lượt dựng lại màn thị trấn tốn 81 ms, so với 64 ms trước bản chữa.
   Bench không đắt thêm chút nào (27,0 so với 27,0 ms), vì khối style đặt trong #view của nó vốn
   đã làm WebKit dựng lại resolver ở mọi lượt. Ở #view (màn thị trấn và bench), lượt vẽ chỉ khác
   giá trị pha nay được bỏ qua hẳn, xem khối "Giá trị pha", nên màn thị trấn chỉ dựng lại 3 lần
   trong 278 lượt đẩy và giá mỗi lượt đẩy còn 11,4 ms thay vì 74,5 ms. Lượt vẽ có nội dung đổi
   vẫn trả đúng giá 81 ms ấy, và popover thì trả giá ấy ở mọi lượt vẽ.

   Trên màn thị trấn, lần bỏ resolver ở mỗi lượt dựng lại còn đang che một chỗ rò khác: bản đồ có
   6.757 style nội tuyến với 2.216 chuỗi khác nhau, vượt bảng gộp 1.024 mục của WebKit, nên các
   khối gộp bị đẩy ra rồi tạo lại liên tục. Bỏ `--now` khỏi lượt dựng lại mà không giảm số chuỗi
   ấy thì bộ nhớ dao động 148–819 MB (đo trên WebKit, vẽ mỗi 500 ms).

   Riêng popover thì mỗi document sống ngắn, vì app thanh menu tải lại menubar.html mỗi lần mở
   (`showPopover` trong app/NowMenuBar.swift). Một lần mở chỉ vẽ vài lượt: bản trạng thái có sẵn,
   bản vừa dựng xong nếu server đang dựng, sổ quản gia, cú bấm, và mốc xong việc.

   Thứ tự trong mount() cũng xuất phát từ lần bỏ resolver ấy: gán innerHTML và gắn class TRƯỚC,
   chèn luật SAU. Lý do sau đây đọc từ mã Safari 17.6 và chưa được đo. styles.css có bộ chọn `:has()`,
   nên lúc thay con của #view WebKit hỏi resolver ngay để tính phần phải vô hiệu
   (`Style::ChildChangeInvalidation`). Luật chèn trước thì resolver vừa bỏ được dựng lại ngay
   lúc ấy, rồi bị bỏ thêm lần nữa ở lượt tính style kế tiếp, tức hai lần dựng cho một lượt vẽ.
   Style chỉ được tính khi trình duyệt cần tới, và giữa hai bước này không có gì đòi nó, nên
   kết quả cuối không đổi. */

/** Năm thực thể của `esc()` mà bộ tách đọc được. Hai thực thể còn lại của nó, `&#xE000;` và
 *  `&#xE001;`, cố ý vắng mặt: thuộc tính style mang chúng ở lại nội tuyến. */
const ENTITY = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const ENTITY_AT = /&(?:amp|lt|gt|quot|#39);/y;
const decode = (s) => s.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ENTITY[m]);

/** Tên biến chép được nguyên văn vào văn bản luật CSS. Tên có ký tự thoát hay chữ ngoài ASCII
 *  thì ở lại nội tuyến: hiếm tới mức không đáng một bộ thoát ký tự riêng. */
const VAR_NAME = /^--[A-Za-z0-9_-]+$/;

/** Tên thuộc tính thường chép được nguyên văn: chữ ASCII và gạch nối, cho phép tiền tố hãng
 *  như `-webkit-`. Cùng lý do như `VAR_NAME`. */
const PROP_NAME = /^-?[A-Za-z][A-Za-z0-9-]*$/;

/** Một giá trị ĐỌC biến: `var(` hay `env(`. Tên hàm CSS không phân biệt hoa thường, và phần
 *  đứng trước không được là chữ, để `--my-var(` hay `navvar(` không bị tính nhầm. */
const VAR_REF = /(?<![\w-])(?:var|env)\(/i;

/** Bộ khai báo có lý do để dời: khai ít nhất một biến, hoặc có một giá trị đọc biến. */
const hoistable = (decls) => decls.some(([n, v]) => n.startsWith('--') || VAR_REF.test(v));

/** Ký tự làm một giá trị không chép an toàn được vào `{ … }`: đóng hay mở khối, thoát ký tự,
 *  mở chú thích, và `!` (một `!important` có sẵn mà nhân đôi thì thành khai báo hỏng). */
const UNSAFE_VALUE = /[{}<\\!]|\/\*/;

/** Từ khoá lùi tầng, xử khác nhau giữa style nội tuyến và luật `!important` (xem khối đầu mục).
 *  Soát theo chuỗi con: bỏ sót một chỗ dời an toàn hơn đổi nghĩa một khai báo. */
const ROLLBACK = /revert-(?:layer|rule)/i;

/** Cắt khoảng trắng hai đầu theo đúng định nghĩa của CSS: dấu cách, tab, xuống dòng, về đầu dòng,
 *  sang trang. `String.prototype.trim()` cắt thêm NBSP, U+FEFF và U+3000, mà với CSS thì đó là
 *  ký tự thường, nên `--a:\u00a0x` nội tuyến giữ nguyên NBSP. */
const cssTrim = (s) => s.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '');

/** Thẻ có nội dung là chữ thô: dấu `<` bên trong không mở thẻ nào. `noscript` chỉ là chữ thô
 *  khi trang chạy script, và coi nó là chữ thô trong mọi trường hợp thì chỉ bỏ sót một chỗ
 *  dời, không viết nhầm vào chữ. */
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript']);

/** Thuộc tính đánh dấu tạm, sống từ lúc gán innerHTML tới lúc class được gắn. */
const MARK = 'data-nv';
const CLASS_RE = /^nv-\d+$/;

const isSpace = (c) => c === 32 || c === 10 || c === 9 || c === 13 || c === 12;

/**
 * Tách giá trị của thuộc tính style (đang ở dạng đã escape) theo dấu `;` ngoài cùng.
 *
 * Soi ngoặc và nháy vì `steps(3,end)` hay `url(data:…;base64,…)` mang dấu phân cách bên
 * trong. Năm thực thể của `esc()` được đọc như MỘT ký tự: `&quot;` chứa dấu `;`, và cắt ở
 * đó là xé đôi một chuỗi trong nháy. Trả mỗi mảnh ở dạng NGUYÊN VĂN để khai báo thường
 * được viết lại đúng từng byte.
 *
 * Trả `null` khi không tách chắc chắn được, và chỗ gọi hiểu `null` là "để nguyên thuộc tính
 * này". Mỗi trường hợp dưới đây là một chỗ bộ đọc CSS của trình duyệt cắt khác cách cắt theo
 * dấu `;`: thực thể lạ, dấu thoát `\`, chú thích, nháy hay ngoặc không cân, ngoặc đóng sai
 * loại (`f[1px)` nuốt cả phần sau vào khối `[`), dấu `{` hay `}` ngoài nháy (mở một khối nuốt
 * luôn các khai báo phía sau), và xuống dòng trong nháy (chuỗi hỏng, phần sau bị đọc lệch).
 */
export function splitStyle(src) {
  const parts = [];
  const open = [];
  let start = 0;
  let quote = '';
  for (let i = 0; i < src.length; i++) {
    let c = src[i];
    if (c === '&') {
      ENTITY_AT.lastIndex = i;
      const m = ENTITY_AT.exec(src);
      if (!m) return null;
      c = ENTITY[m[0]];
      i += m[0].length - 1;
    }
    if (c === '\\') return null;
    if (quote) {
      if (c === quote) quote = '';
      else if (c === '\n' || c === '\r' || c === '\f') return null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') open.push(')');
    else if (c === '[') open.push(']');
    else if (c === ')' || c === ']') {
      if (open.pop() !== c) return null;
    } else if (c === '{' || c === '}') return null;
    else if (c === '/' && src[i + 1] === '*') return null;
    else if (c === ';' && !open.length) {
      parts.push(src.slice(start, i));
      start = i + 1;
    }
  }
  if (quote || open.length) return null;
  parts.push(src.slice(start));
  return parts;
}

/**
 * Một khai báo ở dạng chép được vào luật, hoặc `null`.
 *
 * Tên thuộc tính thường được viết thường, vì CSS không phân biệt hoa thường ở tên ấy, còn tên
 * biến thì giữ nguyên. Giá trị rỗng cũng trả `null`: bản nội tuyến bỏ khai báo hỏng, và cách an
 * toàn duy nhất để bản đã dời làm y hệt là không dời.
 */
function declOf(name, value) {
  const isVar = name.startsWith('--');
  if (!(isVar ? VAR_NAME : PROP_NAME).test(name)) return null;
  if (!value || UNSAFE_VALUE.test(value) || ROLLBACK.test(value)) return null;
  return [isVar ? name : name.toLowerCase(), value];
}

const keyOf = (decls) => decls.map(([n, v]) => `${n}:${v}`).join(';');

/**
 * Toàn bộ khai báo của một thuộc tính style, nếu dời đi được.
 *
 * Trả `{ key, decls }`: `decls` là MỌI khai báo, biến lẫn thường, ở dạng [tên, giá trị] đã giải
 * thực thể theo đúng thứ tự viết, còn `key` là dạng chuẩn hoá của chúng. Trả `null` khi thuộc
 * tính không khai biến nào và không giá trị nào đọc biến (nó ở lại nội tuyến nguyên văn), hoặc
 * khi có MỘT khai báo không chép an toàn được. Lý do nằm ở khối đầu mục.
 */
export function declsOf(src) {
  if (!src.includes('--') && !VAR_REF.test(src)) return null;
  const parts = splitStyle(src);
  if (!parts) return null;
  const decls = [];
  for (const part of parts) {
    const d = decode(part);
    if (!cssTrim(d)) continue;
    const colon = d.indexOf(':');
    const decl = colon < 0 ? null : declOf(cssTrim(d.slice(0, colon)), cssTrim(d.slice(colon + 1)));
    if (!decl) return null;
    decls.push(decl);
  }
  if (!hoistable(decls)) return null;
  return { key: keyOf(decls), decls };
}

/**
 * Đọc một thẻ bắt đầu ở `lt` (`<a` hay `</a`). Trả tên thẻ, vị trí dấu `>`, và thuộc tính
 * style nếu nó có nháy và là thuộc tính style DUY NHẤT của thẻ. Trình phân tích HTML chỉ giữ
 * thuộc tính đầu khi một tên bị lặp, nên gỡ cái đầu đi là làm cái thứ hai sống dậy. Trả
 * `null` khi thẻ không đóng.
 */
function readTag(s, lt) {
  const n = s.length;
  let i = s[lt + 1] === '/' ? lt + 2 : lt + 1;
  const from = i;
  while (i < n && !isSpace(s.charCodeAt(i)) && s[i] !== '/' && s[i] !== '>') i++;
  const name = s.slice(from, i).toLowerCase();
  let style = null;
  let styles = 0;
  let marked = false;
  for (;;) {
    let slash = false;
    while (i < n && (isSpace(s.charCodeAt(i)) || s[i] === '/')) slash = s[i++] === '/';
    if (i >= n) return null;
    if (s[i] === '>') return { name, end: i, style: styles === 1 ? style : null, marked, selfClosing: slash };
    const at = i;
    while (i < n && !isSpace(s.charCodeAt(i)) && s[i] !== '/' && s[i] !== '>' && s[i] !== '=') i++;
    const attr = s.slice(at, i).toLowerCase();
    if (attr === MARK) marked = true;
    let j = i;
    while (j < n && isSpace(s.charCodeAt(j))) j++;
    if (s[j] !== '=') continue;
    j++;
    while (j < n && isSpace(s.charCodeAt(j))) j++;
    const q = s[j];
    let from;
    let to;
    if (q === '"' || q === "'") {
      from = j + 1;
      to = s.indexOf(q, from);
      if (to < 0) return null;
      i = to + 1;
    } else {
      from = j;
      to = j;
      while (to < n && !isSpace(s.charCodeAt(to)) && s[to] !== '>') to++;
      i = to;
    }
    if (attr === 'style' && ++styles === 1 && (q === '"' || q === "'")) style = { start: at, end: i, from, to, q };
  }
}

/**
 * Viết lại một chuỗi HTML: mỗi thuộc tính style có khai biến thành một class. Không đụng DOM.
 *
 * `classFor(key, decls)` trả tên class cho một bộ khai báo, hoặc `null` để giữ nguyên thuộc
 * tính ấy. Phần tử được dời mất hẳn thuộc tính style và mang `data-nv="<class>"` ở đúng chỗ
 * đó. Chuỗi không có gì để dời thì trả về chính nó, nên phép so `===` ở chỗ gọi là đủ để biết
 * có phải gắn class hay không.
 *
 * Bộ quét chỉ đọc THẺ MỞ: chú thích HTML, thẻ đóng và nội dung của script, style, textarea,
 * title đi qua nguyên vẹn, vì một chữ style= nằm trong đó không phải thuộc tính của phần tử
 * nào. Chỗ nào bộ quét đọc khác trình phân tích HTML thì nó phải lệch về phía BỎ SÓT một chỗ
 * dời (biến ở lại nội tuyến, vẫn đúng), không bao giờ về phía viết vào chữ.
 *
 * Hai vùng cần thêm một bước. Trong template, phần tử nằm ở một DocumentFragment riêng mà
 * querySelectorAll của mount() không với tới, nên dấu tạm ở đó không bao giờ thành class: bộ
 * quét vẫn đọc thẻ để biết chữ thô bắt đầu và kết thúc ở đâu, nhưng không dời gì. Trong svg
 * hay math, style, script, title, textarea… KHÔNG phải chữ thô, nhưng một thẻ như b, br, div
 * hay table lại kéo trình phân tích ra khỏi svg ngay giữa chừng. Theo đúng các quy tắc ấy đòi
 * một bộ phân tích thật, nên gặp một thẻ chữ thô sau một thẻ svg hay math chưa đóng thì bộ
 * quét dừng hẳn và để nguyên phần còn lại. Mẫu HTML của dashboard không có trường hợp nào
 * như vậy.
 */
export function hoistVars(markup, classFor) {
  const s = String(markup);
  if (!s.includes('style=') || (!s.includes('--') && !VAR_REF.test(s))) return { html: s, marks: 0 };
  const n = s.length;
  const isLetter = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
  let out = '';
  let last = 0;
  let marks = 0;
  let inTemplate = 0;
  let foreign = 0;
  let i = 0;
  while (i < n) {
    const lt = s.indexOf('<', i);
    if (lt < 0) break;
    if (s.startsWith('<!--', lt)) {
      // Hai dạng rỗng <!--> và <!---> đóng ngay tại chỗ, và dấu --!> cũng đóng một chú thích.
      // Không dùng backtick ở đây: test/modules.test.js đọc đoạn này như một chú thích HTML.
      if (s.startsWith('>', lt + 4)) i = lt + 5;
      else if (s.startsWith('->', lt + 4)) i = lt + 6;
      else {
        const a = s.indexOf('-->', lt + 4);
        const b = s.indexOf('--!>', lt + 4);
        if (a < 0 && b < 0) break;
        i = b < 0 || (a >= 0 && a < b) ? a + 3 : b + 4;
      }
      continue;
    }
    const c = s.charCodeAt(lt + 1);
    const closing = c === 47 && isLetter(s.charCodeAt(lt + 2));
    if (!isLetter(c) && !closing) {
      // `<!doctype…>`, `<?…>` và `</` không theo sau bởi chữ cái là chú thích hỏng, kéo tới
      // dấu `>` đầu tiên. Dấu `<` đứng trước bất cứ thứ gì khác chỉ là chữ.
      if (s.startsWith('<![CDATA[', lt)) {
        // Trong SVG thì đây là chữ tới `]]>`; ngoài SVG nó tắt ở dấu `>` đầu, nên kéo tới `]]>`
        // chỉ bỏ sót thêm, không viết nhầm vào đâu.
        const end = s.indexOf(']]>', lt + 9);
        if (end < 0) break;
        i = end + 3;
      } else if (c === 33 || c === 63 || c === 47) {
        const gt = s.indexOf('>', lt + 2);
        if (gt < 0) break;
        i = gt + 1;
      } else i = lt + 1;
      continue;
    }
    const tag = readTag(s, lt);
    if (!tag) break;
    if (closing) {
      if (tag.name === 'template' && inTemplate) inTemplate--;
      else if ((tag.name === 'svg' || tag.name === 'math') && foreign) foreign--;
      i = tag.end + 1;
      continue;
    }
    if (tag.name === 'plaintext') break;
    if (tag.style && !tag.marked && !inTemplate) {
      const set = declsOf(s.slice(tag.style.from, tag.style.to));
      const cls = set ? classFor(set.key, set.decls) : null;
      if (cls) {
        out += s.slice(last, tag.style.start) + `${MARK}="${cls}"`;
        last = tag.style.end;
        marks++;
      }
    }
    i = tag.end + 1;
    if (tag.name === 'template') inTemplate++;
    else if ((tag.name === 'svg' || tag.name === 'math') && !tag.selfClosing) foreign++;
    else if (RAW_TEXT.has(tag.name)) {
      if (foreign) break;
      const close = new RegExp(`</${tag.name}[\\s/>]`, 'ig');
      close.lastIndex = i;
      const m = close.exec(s);
      if (!m) break;
      i = m.index;
    }
  }
  return marks ? { html: out + s.slice(last), marks } : { html: s, marks: 0 };
}

/**
 * Sổ bộ khai báo → class, không đụng DOM, để test đọc được luật giữ sổ có trần.
 *
 * Tên class không bao giờ dùng lại: một luật đã xoá mà tên của nó sống lại với giá trị khác
 * thì phần tử nào còn giữ tên cũ sẽ lặng lẽ đổi màu.
 *
 * Trần sổ tự giãn. Vượt trần thì bỏ mọi class không còn phần tử nào trong document mang, rồi
 * đặt trần mới bằng max(sàn, 2 × số class còn sống). Màn thị trấn có hàng trăm bộ khai báo CÙNG
 * sống; một trần cố định thấp hơn con số ấy thì lượt vẽ nào cũng dọn mà không bỏ được gì.
 */
export class VarClasses {
  constructor(floor = 512) {
    this.floor = floor;
    this.cap = floor;
    this.n = 0;
    this.byKey = new Map();
    this.keyOf = new Map();
    this.fresh = [];
    this.refused = new Set();
  }

  /** Class cho một bộ khai báo; bộ mới thì ghi thêm luật chờ chèn. `null` khi trình duyệt đã từ
   *  chối luật của bộ này. */
  classFor(key, decls) {
    if (this.refused.has(key)) return null;
    let cls = this.byKey.get(key);
    if (!cls) {
      cls = `nv-${++this.n}`;
      this.byKey.set(key, cls);
      this.keyOf.set(cls, key);
      this.fresh.push([cls, `.${cls}{${decls.map(([k, v]) => `${k}:${v} !important`).join(';')}}`]);
    }
    return cls;
  }

  /** Lấy ra các luật chưa chèn, mỗi luật đúng một lần. */
  drain() {
    const f = this.fresh;
    this.fresh = [];
    return f;
  }

  /** Trình duyệt không nhận luật này: quên class, và từ nay bộ khai báo ấy ở lại nội tuyến. */
  refuse(cls) {
    const key = this.keyOf.get(cls);
    this.keyOf.delete(cls);
    this.byKey.delete(key);
    // Có trần để một giá trị hỏng lặp lại ở mọi lượt vẽ không thành chính chỗ rò mới.
    if (this.refused.size >= 256) this.refused.clear();
    this.refused.add(key);
  }

  get size() {
    return this.keyOf.size;
  }

  get over() {
    return this.keyOf.size > this.cap;
  }

  /** Bỏ mọi class không nằm trong `live`, trả về tên của chúng, rồi đặt lại trần. */
  sweep(live) {
    const dead = [];
    for (const [cls, key] of this.keyOf) {
      if (live.has(cls)) continue;
      dead.push(cls);
      this.keyOf.delete(cls);
      this.byKey.delete(key);
    }
    this.cap = Math.max(this.floor, 2 * this.keyOf.size);
    return dead;
  }
}

/**
 * Sổ và stylesheet của một document. `null` khi bề mặt không có stylesheet để ghi (Node,
 * hay một document không có head): khi ấy mount() gán innerHTML nguyên văn như trước.
 *
 * Ưu tiên stylesheet dựng sẵn gắn qua `adoptedStyleSheets` vì nó không thêm thẻ nào vào
 * DOM. Bề mặt chưa có API ấy thì dùng sheet của một thẻ style trong head, và luật vẫn đi
 * qua `insertRule`, không qua textContent.
 */
const sheets = new WeakMap();

function sheetFor(doc) {
  if (!doc) return null;
  if (sheets.has(doc)) return sheets.get(doc);
  let sheet = null;
  try {
    const Sheet = doc.defaultView?.CSSStyleSheet;
    if (Sheet && 'adoptedStyleSheets' in doc) {
      sheet = new Sheet();
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    }
  } catch {
    sheet = null;
  }
  if (!sheet) {
    try {
      const el = doc.createElement('style');
      el.id = 'nv-vars';
      doc.head.append(el);
      sheet = el.sheet;
    } catch {
      sheet = null;
    }
  }
  const box = sheet ? { sheet, vars: new VarClasses() } : null;
  sheets.set(doc, box);
  return box;
}

/** Chèn mọi luật mới của sổ. Trả `false` nếu có luật bị từ chối, để chỗ gọi viết lại. */
function flush(box) {
  let ok = true;
  for (const [cls, rule] of box.vars.drain()) {
    try {
      box.sheet.insertRule(rule, box.sheet.cssRules.length);
    } catch {
      box.vars.refuse(cls);
      ok = false;
    }
  }
  return ok;
}

/**
 * Vượt trần thì xoá luật của mọi class không còn phần tử nào mang.
 *
 * Chạy SAU khi nội dung mới đã vào DOM, nên class của lượt vẽ này luôn được tính là sống.
 * Xoá từng luật chết bằng `deleteRule` thay vì dựng lại cả sheet: luật còn sống giữ nguyên
 * đối tượng, không bị phân tích lại.
 */
function evict(box, doc) {
  const live = new Set();
  for (const el of doc.querySelectorAll('[class*="nv-"]')) {
    for (const c of el.classList) if (CLASS_RE.test(c)) live.add(c);
  }
  const dead = new Set(box.vars.sweep(live));
  if (!dead.size) return;
  const rules = box.sheet.cssRules;
  for (let i = rules.length - 1; i >= 0; i--) {
    if (dead.has(rules[i].selectorText?.slice(1))) box.sheet.deleteRule(i);
  }
}

/** Khung chuỗi nguồn mà mount() viết lần gần nhất vào mỗi phần tử — xem `unchanged`. */
const written = new WeakMap();

/* ── Giá trị pha ────────────────────────────────────────────────────────────────

   `--now` của `lifeClock` và độ trễ âm của người qua đường, quản gia ra phố, quản gia đi lại
   là PHA: chúng chỉ nói hoạt hình đang ở đâu trên đồng hồ tường, để thẻ vừa dựng lại chạy tiếp
   đúng chỗ thẻ cũ đang chạy. Chúng đổi ở mọi lượt vẽ, nên trước đây màn thị trấn không lượt nào
   trùng lượt trước, và lượt nào cũng dựng lại cả cây, chèn luật `--now` mới và làm WebKit dựng
   lại resolver. Đo trên WebKit (Safari 17.6): một lượt dựng lại màn thị trấn tốn 81 ms so với
   64 ms trước bản chữa, và 100% lượt vẽ chèn luật.

   Chỗ vẽ bọc mỗi giá trị pha bằng `phase()`. `unchanged()` so chuỗi đã bỏ các giá trị ấy, nên
   một lượt vẽ chỉ khác pha được bỏ qua hẳn. Cây cũ vẫn đúng: hoạt hình của nó chạy liên tục từ
   lần dựng trước, tức nó đang ở đúng pha mà con số mới định đặt. Lượt vẽ có nội dung đổi thì
   vẫn dựng lại với pha mới, và vẫn chèn luật `--now` mới như trước. Đo lại sau khi có phép bỏ
   qua ấy: màn thị trấn dựng lại 3 lần trong 278 lượt đẩy, giá mỗi lượt đẩy còn 11,4 ms thay vì
   74,5 ms, và bộ nhớ chỉ nhích 0,5 MB mỗi 100 lượt đẩy qua 1.432 lượt (85 lên 92 MB).

   Cái giá của phép bỏ qua nằm ở chỗ khác: thẻ cũ giữ pha của lần dựng ra nó, nên hoạt hình lặp
   theo đồng hồ tường lệch vài chục mili-giây so với một thẻ vừa dựng (61,8 ms so với 46 ms sau
   120 giây, đo trên Chrome). Độ lệch ấy là độ trễ của lần dựng, không lớn dần theo thời gian.
   Hoạt hình lặp KHÔNG theo đồng hồ tường, ví dụ nắp thanh menu ở màn bench (`mb-blink-lid`, độ
   trễ cố định −5,3 s), nay chạy tiếp thay vì bắt đầu lại ở mỗi lượt đẩy.

   Chỉ `render()` của app.js gọi `unchanged()`, cho #view, tức màn thị trấn và bench.
   menubar.js không so, nên popover vẫn dựng lại và chèn một luật `--now` mới ở mọi lượt vẽ. Nó
   chịu được giá ấy vì một lần mở chỉ vẽ vài lượt, xem đoạn về popover ở khối đầu mục.

   Bỏ qua lượt vẽ cũng bỏ luôn hoạt hình chạy một lần trên thẻ vừa dựng. Chỗ nào cần hoạt hình
   ấy diễn lại cho một cú bấm mà HTML không đổi thì tự khởi động lại nó trên thẻ cũ, ví dụ
   `replayArrival` trong views/pet.js.

   KHÔNG dùng một bộ luật `--now` cố định xoay vòng thay cho cách này. Khoá của
   `MatchedDeclarationsCache` là địa chỉ bộ biến của cha, nên mỗi giá trị `--now` khác nhau vẫn
   sinh một lứa mục mới cho mọi con cháu của `.shop`, và chỉ lần dựng lại resolver mới dọn được
   lứa ấy. Bộ luật cố định thì không mang được giờ thật, còn sửa giá trị một luật đang dùng thì
   WebKit cũng dựng lại resolver y như chèn luật mới.

   Dấu bọc là hai ký tự vùng riêng (U+E000, U+E001). Nội dung từ đĩa có thể mang đúng hai ký tự
   ấy, nên `esc()` viết chúng thành thực thể, còn `phase()` trả một giá trị `raw` để dấu của nó
   không bị viết theo. Dấu trần trong chuỗi HTML vì thế chỉ đến từ `phase()`, trừ chuỗi mà code
   tự đưa vào `raw()` không qua `esc()`; mẫu HTML chỉ đưa vào đó chuỗi dịch ghép với con số và
   ngày. Hệ quả là `phase()` phải nằm trong một template `html`: ghép nó vào chuỗi JS thường thì
   ra "[object Object]". mount() gỡ dấu trước mọi bước khác, nên DOM không bao giờ thấy chúng. */
const PHASE_OPEN = '\uE000';
const PHASE_ANY = /[\uE000\uE001]/g;
const PHASE_VALUE = /\uE000[^\uE000\uE001]*\uE001/g;

/** Bọc một giá trị pha, xem khối "Giá trị pha". Kết quả chỉ dùng được bên trong `html`. */
export const phase = (v) => raw(`\uE000${esc(v)}\uE001`);

/** Chuỗi sẽ vào DOM: giữ giá trị pha, bỏ dấu bọc. */
const unmarked = (s) => (s.includes(PHASE_OPEN) ? s.replace(PHASE_ANY, '') : s);

/** Khung để so: mỗi giá trị pha chỉ còn dấu mở. */
const skeleton = (s) => (s.includes(PHASE_OPEN) ? s.replace(PHASE_VALUE, PHASE_OPEN) : s);

/* ── Thẻ table dùng lại qua các lượt vẽ ────────────────────────────────────────

   Mỗi thẻ table của WebKit tự tạo MỘT khối khai báo dùng chung cho mọi ô của nó
   (`HTMLTableElement::additionalCellStyle`, mặc định `padding: 1px`), và khối ấy vào
   `MatchResult` của từng td, th như một khai báo cache được. Thẻ table mới thì khối mới, tức mọi
   ô trượt cache và nhận mục mới. Một bảng có từ hai loại ô trở lên (th với td, hay td có style
   riêng) thì các mục ấy cùng giữ khối chung, nên khối không bao giờ còn đúng một chủ và lượt
   dọn (`sweep`, chỉ bỏ mục có khai báo một chủ) không bỏ được mục nào. Đo trên WebKit: màn Quyết
   định giữ lại 40–50 KB mỗi lượt vẽ tới khi resolver bị dựng lại, không phụ thuộc nhịp vẽ, còn
   khi đã bỏ `var()` nội tuyến thì đổi bảng thành div là đứng phẳng. Đo lại sau khi dùng lại thẻ
   table: 1.398 lượt vẽ liên tiếp màn Quyết định (tắt phép bỏ qua ở `unchanged`) chỉ đưa bộ nhớ
   từ 70 lên 71 MB, so với 18,7 MB mỗi 100 lượt khi còn dựng thẻ table mới.

   Vì vậy sau khi gán innerHTML, mỗi thẻ table mới được thay bằng thẻ table của lượt trước ở cùng
   thứ tự: thẻ cũ nhận thuộc tính và con của thẻ mới, rồi đứng vào chỗ thẻ mới. DOM cuối cùng
   giống hệt, chỉ có đối tượng table là cũ, nên khối khai báo chung giữ nguyên địa chỉ và ô trúng
   cache. WebKit chỉ bỏ khối ấy khi border, frame, rules hay cellpadding đổi giá trị; mẫu HTML
   không dùng bốn thuộc tính đó, và test/dom.test.js canh điều này.

   Thẻ table dư của lượt trước (màn mới ít bảng hơn) được buông hết con và nằm chờ trong sổ, để
   quay lại màn nhiều bảng không phải tạo thẻ mới. Sổ vì thế dài bằng số bảng nhiều nhất từng có
   trong một lượt vẽ của phần tử ấy. */
const tables = new WeakMap();

function keepTables(el) {
  const fresh = el.getElementsByTagName?.('table');
  const pool = tables.get(el) ?? [];
  if (!fresh || (!fresh.length && !pool.length)) return;
  const list = [...fresh];
  list.forEach((table, i) => {
    const old = pool[i];
    // Thẻ cũ còn nằm trong document thì ai đó đã dời nó đi dùng chỗ khác: không lấy lại, sổ giữ
    // thẻ mới thay nó.
    if (!old || old.isConnected || old.contains(table)) {
      pool[i] = table;
      return;
    }
    for (const { name } of [...old.attributes]) if (!table.hasAttribute(name)) old.removeAttribute(name);
    for (const { name, value } of table.attributes) if (old.getAttribute(name) !== value) old.setAttribute(name, value);
    old.replaceChildren(...table.childNodes);
    table.replaceWith(old);
  });
  // Cùng lý do với vòng trên: thẻ dư mà còn nằm trong document là thẻ ai đó đang dùng, buông con
  // của nó là xoá nội dung người khác vừa dựng.
  for (const old of pool.slice(list.length)) if (!old.isConnected) old.replaceChildren();
  tables.set(el, pool);
}

/** Gán innerHTML, đổi mọi dấu tạm thành class, rồi dùng lại thẻ table của lượt trước. */
function write(el, markup, src) {
  el.innerHTML = markup;
  if (markup !== src) {
    for (const node of el.querySelectorAll(`[${MARK}]`)) {
      node.classList.add(node.getAttribute(MARK));
      node.removeAttribute(MARK);
    }
  }
  keepTables(el);
}

/**
 * Dựng DOM từ kết quả `html` và gắn vào một phần tử.
 *
 * Mọi lần ghi HTML trong public/ phải đi qua đây (test/dom.test.js canh), vì đây là chỗ duy
 * nhất dời biến CSS nội tuyến ra khỏi thuộc tính style (xem khối đầu mục này), gỡ dấu bọc giá trị
 * pha, và dùng lại thẻ table của lượt trước.
 *
 * Thứ tự là chủ đích thiết kế: gán innerHTML, đổi dấu tạm thành class, rồi mới chèn luật mới
 * và dọn sổ. Chèn luật sau cùng thì một lượt vẽ chỉ làm WebKit dựng lại resolver một lần, lý
 * do nằm ở đoạn cuối khối đầu mục.
 *
 * `el` phải đang nằm trong document. Dọn sổ chỉ đếm class trên các phần tử trong document,
 * nên class của một cây đang tách rời có thể mất luật trước khi cây ấy được gắn vào, và tên
 * class không bao giờ sống lại. Vì vậy phần tử tách rời nhận chuỗi nguyên văn, không dời biến.
 */
export function mount(el, tpl) {
  const text = rawText(tpl);
  const src = unmarked(text);
  const doc = el.ownerDocument;
  const box = el.isConnected ? sheetFor(doc) : null;
  const classFor = (k, d) => box.vars.classFor(k, d);
  let markup = box ? hoistVars(src, classFor).html : src;
  write(el, markup, src);
  if (box && !flush(box)) {
    // Luật bị từ chối thì viết lại một lượt nữa: lượt ấy giữ bộ khai báo hỏng ở nội tuyến. Hỏng
    // cả lượt hai thì dùng chuỗi gốc, vì style nội tuyến luôn đúng, chỉ là tốn bộ nhớ.
    markup = hoistVars(src, classFor).html;
    if (!flush(box)) markup = src;
    write(el, markup, src);
  }
  written.set(el, skeleton(text));
  if (box?.vars.over) evict(box, doc);
  return el;
}

/**
 * Lượt vẽ này có y hệt chuỗi mount() viết lần trước vào `el` không, không kể giá trị pha.
 *
 * So chuỗi NGUỒN, trước khi dời biến, nên kết quả không phụ thuộc sổ class. Chỗ gọi dùng nó
 * để bỏ hẳn một lần dựng lại DOM: cây cũ đã đúng từng byte, còn cây mới thì mất focus, vệt
 * bôi đen và trạng thái details. Giá trị bọc bằng `phase()` không được so, lý do ở khối "Giá
 * trị pha".
 */
export const unchanged = (el, tpl) => written.get(el) === skeleton(rawText(tpl));

/** Việc `setVars` đã làm trên mỗi phần tử: class nó gắn, và các thuộc tính nó phải đặt nội
 *  tuyến ở lần lùi gần nhất. Lượt sau dọn đúng những thứ ấy. */
const setByVars = new WeakMap();

/**
 * Bộ khai báo của một lần gọi `setVars`, cùng luật với một thuộc tính style: phải khai ít nhất
 * một biến hoặc có một giá trị đọc biến, và mọi khai báo đều chép được vào luật. Mỗi giá trị được soát riêng, nên một dấu `;`
 * hay một thực thể trong giá trị không tách được nó thành hai khai báo như khi ghép chuỗi.
 */
function setOf(entries) {
  const decls = [];
  for (const [k, v] of entries) {
    const value = cssTrim(v);
    const parts = value.includes('&') ? null : splitStyle(value);
    const decl = parts?.length === 1 ? declOf(k, value) : null;
    if (!decl) return null;
    decls.push(decl);
  }
  return hoistable(decls) ? { key: keyOf(decls), decls } : null;
}

/**
 * Đặt biến CSS từ JS qua cùng sổ class, không qua `style.setProperty`.
 *
 * `setProperty` vẫn là style nội tuyến nên vẫn rò đúng như thuộc tính style (đo: 54,5 MB mỗi
 * 100 lượt vẽ). Luật giống hệt mount(): khai báo thường đi cùng biến vào chung một class, còn
 * bộ không khai và không đọc biến nào, hay có một khai báo không chép được, thì đặt nội tuyến
 * trọn bộ.
 *
 * Một lần gọi khai TRỌN bộ của phần tử, nên class và các thuộc tính nội tuyến mà lần gọi trước
 * để lại đều bị tháo. Phần tử chưa nằm trong document (cùng lý do như ở mount()) cũng lùi về
 * `setProperty`, và đây là chỗ duy nhất trong public/ được gọi nó với một biến.
 *
 * Mỗi giá trị mới là một luật mới, tức một lần WebKit dựng lại resolver cả trang. Chỗ gọi với
 * giá trị liên tục (một tỉ lệ theo bề rộng khung) nên làm tròn trước khi gọi.
 */
export function setVars(el, vars) {
  const entries = Object.entries(vars).map(([k, v]) => [k, String(v)]);
  const set = setOf(entries);
  const box = el.isConnected ? sheetFor(el.ownerDocument) : null;
  let cls = box && set ? box.vars.classFor(set.key, set.decls) : null;
  const prev = setByVars.get(el) ?? { cls: null, inline: [] };
  if (cls && prev.cls === cls) return;
  // Tháo class cũ cả khi lượt này phải lùi về nội tuyến: luật của nó mang `!important`, nên
  // để lại thì nó đè lên đúng giá trị vừa đặt. Đổi class TRƯỚC khi chèn luật, cùng lý do thứ
  // tự như ở mount().
  if (prev.cls) el.classList.remove(prev.cls);
  if (cls) {
    el.classList.add(cls);
    if (!flush(box)) {
      el.classList.remove(cls);
      cls = null;
    }
  }
  // Thuộc tính nội tuyến của lần lùi trước phải đi, kể cả khi lượt này có class: còn một khai
  // báo nội tuyến là phần tử lại mang khối khai báo mới ở mỗi lần dựng lại style.
  for (const k of prev.inline) el.style.removeProperty(k);
  if (cls) {
    setByVars.set(el, { cls, inline: [] });
    if (box.vars.over) evict(box, el.ownerDocument);
    return;
  }
  setByVars.set(el, { cls: null, inline: entries.map(([k]) => k) });
  for (const [k, val] of entries) el.style.setProperty(k, val);
}

export const $ = (sel, root = document) => root.querySelector(sel);

// ── Định dạng ────────────────────────────────────────────────────────────────

/** Khoảng thời gian đọc kiểu người: "vừa xong", "12 phút", "3 giờ", "2 ngày". */
/**
 * Dưới mốc này `ago()` trả về một MỆNH ĐỀ trọn vẹn ("vừa xong") chứ không phải một
 * khoảng thời gian, nên chỗ nào ghép thêm hậu tố kiểu "… trước" phải tự tránh ra —
 * không thì thành "vừa xong trước". Xuất ra để chỗ đó khỏi chép lại con số.
 */
export const JUST_NOW_MS = 45_000;

export function ago(ms) {
  if (ms == null) return '—';
  const s = Math.max(0, Math.round(ms / 1000));
  if (ms < JUST_NOW_MS) return t('fmt.justnow');
  const m = Math.round(s / 60);
  if (m < 60) return t('fmt.min', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('fmt.hour', { n: h });
  const d = Math.round(h / 24);
  if (d < 30) return t('fmt.day', { n: d });
  return t('fmt.month', { n: Math.round(d / 30) });
}

export const agoFrom = (ts) => (ts == null ? '—' : ago(Date.now() - ts));

export function clock(ts) {
  if (ts == null) return '—';
  return new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(dateStr) {
  const d = Date.parse(`${dateStr}T00:00:00`);
  if (Number.isNaN(d)) return dateStr;
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days === 0) return t('fmt.today');
  if (days === 1) return t('fmt.yesterday');
  if (days < 7) return t('fmt.daysAgo', { n: days });
  return new Date(d).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'numeric' });
}

/** Màu ổn định cho mỗi dự án, suy từ tên — để chip dự án luôn cùng màu ở mọi màn. */
export function hueOf(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return h;
}

/**
 * Chép vào clipboard rồi báo lại bằng chính nút vừa bấm.
 *
 * `navigator.clipboard` từ chối với `NotAllowedError` khi tài liệu không được
 * focus (rất hay gặp: cửa sổ dashboard nằm cạnh terminal đang gõ). Không có
 * đường lui thì nút bấm xong không xảy ra gì và cũng không báo gì — tệ hơn hẳn
 * so với báo hỏng. Nên: thử API mới, hỏng thì rơi về `execCommand`, hỏng nữa
 * thì hiện trạng thái lỗi để sếp biết mà bôi đen chép tay.
 *
 * Trả về việc có chép được hay không. Hầu hết chỗ gọi bỏ qua trị này — vệt ✓ trên
 * nút đã là câu trả lời đủ cho một dòng lệnh ngắn. Nút báo cáo thì cần biết, vì nó
 * còn phải nói tiếp "làm gì với 12 nghìn ký tự vừa chép", mà câu đó chỉ đúng khi
 * clipboard thật sự có nội dung.
 */
export async function copy(text, sourceEl) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    ok = legacyCopy(text);
  }
  flag(sourceEl, ok ? 'copied' : 'copyfail');
  return ok;
}

function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

function flag(el, cls) {
  if (!el) return;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 1400);
}
