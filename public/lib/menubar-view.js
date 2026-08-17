/**
 * Ruột popover thanh menu — tách khỏi `menubar.js` để TRANG DEMO vẽ được đúng cái này.
 *
 * Vì sao tách: mọi lần chỉnh bố cục ở đây đều là chỉnh mù. Popover không chụp được từ
 * terminal, mà dựng lại một bản "gần giống" trong trang demo thì thứ được chỉnh không
 * phải thứ sẽ chạy — đúng cái bẫy "trên demo thì đẹp, lên thanh thì lệch" đã dính một
 * lần ở cỡ chữ trên thanh menu. Nên chỉ có MỘT hàm vẽ, và trang demo gọi chính nó với
 * mấy công tắc khác nhau.
 *
 * `opts` là mấy công tắc ấy — xem `DEFAULTS`. Chốt được cái nào thì sửa mặc định ở đây,
 * không phải sửa hai chỗ.
 */
import { html, ago } from './dom.js';
import { t, getLang, LANGS, LANG_FLAG, LANG_LABEL } from './i18n.js';
import { pixels } from './pixel.js';
import {
  BUTLER_CHARS,
  butlerHand,
  butlerLook,
  butlerRows,
  butlerSays,
  butlerTalk,
  butlerThinks,
  faceArt,
  itemArt,
  lifeClock,
  doingArt,
  doingRing,
  markArt,
  nudgeOf,
  satChip,
  speaking,
  statWords,
  talkArt,
  wallet,
} from './pet.js';
import { MOVES, MOVE_IDS, phaseOf, whereOf } from './petmath.js';
import { nextTheme, themeMode } from './mbtheme.js';
import { briefing, toolWindows } from './butler.js';
import {
  windowsOf,
  stripRows,
  quotaBar,
  cardText,
  spentText,
  usedText,
  resetLabel,
  forecastText,
  readAtText,
  degradedKey,
} from './quota.js';

/**
 * Mặc định của popover thật.
 *
 * `tall`: thanh dày 20px thay vì 7px. Thanh mảnh làm mấy cái nhãn của nó — mốc đều,
 * dự phóng, bỏ phí — bám quanh một sợi chỉ, và ở bề rộng 360pt thì ba nhãn ấy chen
 * nhau. Dày lên thì nhãn nằm TRONG thân thanh, chỗ chúng vốn được thiết kế để nằm
 * (xem `.qbar.tall` và thẻ hạn mức ở màn Token — nơi luôn dùng bản dày).
 *
 * `inline`: gộp nhãn cửa sổ vào cùng hàng với thanh. Đổi chiều cao lấy bề rộng thanh —
 * đúng phép đổi đó, không phải một bố cục "gọn hơn" chung chung.
 *
 * `skyEcho`: lượt vẽ này có phải là lượt NGAY SAU một cú bấm mặt trời không. Cái duy nhất
 * nó bật lên là nhãn chế độ nền dưới mặt trời — xem chỗ dựng nó trong `scene`. Mặc định
 * tắt, và đó là chủ ý: đổi tab hay đổi ngôn ngữ cũng đi qua cùng hàm vẽ này, mà một cái
 * nhãn nháy lên vì người ta vừa bấm sang tab khác là một câu trả lời cho một câu không ai hỏi.
 */
export const DEFAULTS = { tab: 'work', tall: true, inline: false, width: 360, hero: true, est: 'mid', skyEcho: false };

/* QUẢN GIA — nhân vật của popover. Hình của nó nằm ở `lib/pet.js`, không ở đây, vì thị
   trấn cũng vẽ đúng nhân vật ấy trong nhà; xem khối chú thích ở đầu file kia. Chỗ này chỉ
   còn giữ đúng phần mà popover có quyền quyết: mắt mở hay nhắm.

   Băng bỏ phí lớn (`crit`, `warn`) thì mắt nhắm và có "z" bay lên; nhịp đã bám đích hoặc
   đang tiêu mạnh (`ok`, `cheer`, `over`) thì mắt mở. Băng vẫn nói đủ to bằng ba chỗ khác —
   mắt (mở/nhắm), chấm nhịp dưới câu, và chính mấy cái thanh ngay bên dưới. */

/** Mặt trời và một đám mây — cùng lưới 4px với quản gia. Vẽ bằng pixel chứ không phải
 *  một vòng tròn CSS mượt: một vật bo trơn đứng cạnh một vật răng cưa thì cái răng cưa
 *  đọc thành lỗi, không đọc thành phong cách. */
const SUN = [
  '..###..',
  '.#ooo#.',
  '#ooooo#',
  '#ooooo#',
  '#ooooo#',
  '.#ooo#.',
  '..###..',
];
const CLOUD = [
  '..####...',
  '.#######.',
  '#########',
];

/** Trăng khuyết chứ không phải đĩa tròn: đĩa tròn ở 28px trông y hệt mặt trời, mà đúng
 *  cái phải nhận ra ngay là "giờ đang là đêm". `#` là vành sáng, `o` là chỗ tối dần. */
const MOON = [
  '..###..',
  '.##o...',
  '##oo...',
  '##oo...',
  '##oo...',
  '.##o...',
  '..###..',
];

/* `phaseOf` đã dọn sang `petmath.js` ở lượt này. Lý do: từ lượt này bản đồ thị trấn cũng đổi
   trời theo giờ, mà để `views/pet.js` đi hỏi `menubar-view.js` một hàm năm dòng về cái đồng
   hồ là kéo trọn khung cảnh popover vào một màn không dùng tới nó. `petmath.js` vốn đã là
   nhà của mấy hàm thuần ăn theo giờ (`moveForHour`, `wakeOf`).

   KHÔNG xuất lại từ đây. Bản đầu của lượt này có một dòng `export { phaseOf }` để "chỗ gọi
   cũ khỏi phải đổi" — soi lại thì không có chỗ gọi cũ nào: hai người dùng duy nhất là chính
   file này và `views/pet.js`, cả hai lấy thẳng từ `petmath.js`. Một cửa xuất không ai đi qua
   là một cửa mà lần dọn sau phải đoán xem có ai đi qua không. */

/** Sao nền: toạ độ cố định, KHÔNG ngẫu nhiên — mỗi lần mở popover mà trời khác nhau
 *  thì mắt bám vào chỗ đổi, mà chỗ đổi ấy không mang tin gì. Chừa trống góc trên-trái
 *  cho mặt trời và khoảng giữa-phải cho đám mây. */
const STARS = [
  [26, 8], [35, 22], [44, 7], [53, 16], [61, 31], [86, 9], [93, 27],
  [19, 41], [30, 54], [70, 49], [97, 55], [9, 62],
];

export const TABS = ['work', 'token'];

/** Giọng của quản gia → băng màu của thang bỏ phí. Cùng bảng màu, cùng nghĩa. */
const WORK_TONE = { alert: 'crit', warn: 'warn', calm: 'ok', mute: 'later' };

/**
 * NỬA TRÊN của popover: trời theo buổi, mặt trời hoặc mặt trăng, quản gia và đồ đạc của nó.
 *
 * ## Dải chân đã BIẾN MẤT — mọi thứ của con vật giờ nằm trong chính bức tranh
 *
 * Trước lượt này khung này là hai tầng: bức tranh 94px, rồi một dải 39px mang thanh đói,
 * đồng hồ tập trung và cái ví. Người dùng chỉ ra chỗ hỏng: hai tầng ấy nói về đúng một con
 * vật, nên cái viền giữa chúng là một cái viền không ngăn cách hai thứ gì cả — nó chỉ tốn
 * 39px trên một cửa sổ 561px.
 *
 * Ba mảnh dọn vào ba chỗ khác nhau TRONG tranh, và chỗ nào cũng suy từ loại của mảnh ấy:
 *
 * - **No và nhịp** → sổ mở ra bên TRÁI nhân vật, bấm mới hiện, tự hiện khi anh ta đang nói.
 *   Chúng là *trạng thái*, mà bức tranh đã kể được một nửa (mắt nhắm, bụng kêu) — nên chúng
 *   được phép chờ một cú bấm.
 * - **Bên phải** → chỗ anh ta nói và nghĩ (xem `speaking`/`butlerThinks` bên `lib/pet.js`).
 * - **Ví** → KHÔNG vào tranh. Nó xuống một hàng riêng ngay dưới, mang theo cái tên "Cửa
 *   hàng" (xem `.mb-money`). Bản đầu treo nó thành tấm biển trong tranh và người dùng bác
 *   ngay: bức tranh chỉ rộng 326px, thêm một vật thường trực 100px là góc trái-dưới hết chỗ
 *   cho món đồ đã mua — gộp mà làm khung chật hơn thì gộp để làm gì.
 *
 * Phép gộp vì thế đọc được thành một câu: **trạng thái vào tranh, cửa ở lại ngoài tranh.**
 *
 * Bức tranh cao 148px chứ không 94px như trước, và chỗ thêm ra là chỗ để mỗi thứ có DẢI
 * RIÊNG: bong bóng thoại chiếm y 6–81, còn nhân vật và cái sổ bắt đầu đúng ở y 81. Ở 94px
 * thì ba thứ chồng lên nhau và cái sổ che mất cả mặt trời.
 *
 * Trọn khối này là TRÒ CHƠI, và đó là luật của nó: không một con số hạn mức nào được lọt
 * vào trong cái viền. Dòng trạng thái từng nằm ở đây và đã dọn xuống nửa dưới (xem
 * `saying`) — nó là số thật, mà một số thật kẹp giữa hai nửa của một trò chơi thì người
 * đọc phải tự tách chúng ra mỗi lần liếc.
 *
 * Khung cảnh KHÔNG đổi màu theo băng — nó là một bức tranh, và một bức tranh đổi màu
 * theo số liệu thì người xem nhớ màu chứ không nhớ số. Băng nói bằng ba chỗ giữ nguyên:
 * mắt quản gia (mở hay nhắm), chấm nhịp trước câu trạng thái, và mấy cái thanh bên dưới.
 *
 * Nó đổi theo GIỜ — sáng khác chiều khác đêm. Giờ thì không phải số liệu của sản phẩm
 * này, nên nó đổi được mà không tranh chỗ với thứ gì: nó chỉ làm cái cửa sổ giống chỗ
 * người dùng đang ngồi.
 *
 * HƯỚNG NẮNG thì đứng yên ở trên-trái suốt cả bốn buổi. Cho mặt trời chạy vòng cung thì
 * phải xoay lại toàn bộ phép chấm sắc độ trong `shadeOf`, và một nhân vật đổi hướng đổ
 * bóng bốn lần một ngày là bốn lần người xem phải nhận lại cái hình.
 *
 * ## Luật của phần CHUYỂN ĐỘNG
 *
 * Khung cảnh thở — sao lấp lánh, mây trôi, quầng nắng phập phồng, quản gia hít vào thở ra
 * và thỉnh thoảng chớp mắt. Ba điều kiện, và cả ba đều là điều kiện để nó được phép động:
 *
 * 1. **Không chuyển động nào chở tin.** Cái chở tin là mắt MỞ hay NHẮM, không phải nhịp
 *    chớp; là có chữ "z" hay không, không phải chữ z bay nhanh hay chậm. Ai đó sau này
 *    muốn gắn tốc độ vào một con số thì đó là lúc dựng một cái đồng hồ đo thứ hai ngay
 *    trong bức tranh — đúng thứ mà luật "khung cảnh không đổi màu theo băng" đã cấm.
 * 2. **Không vật nào đổi CHỖ ĐỨNG.** Sao lấp lánh bằng độ mờ chứ không nhảy chỗ, mây đi
 *    ra rồi về đúng chỗ cũ. Popover tải lại mỗi lần mở nên mọi nhịp đều bắt đầu từ 0 —
 *    tức là mở lần nào cũng thấy đúng một bức tranh, không phải một khung hình ngẫu nhiên
 *    của nó. Đây là chính cái lý lẽ đã ghim toạ độ `STARS` xuống cứng.
 * 3. **Chạy trong mọi nhịp đều là VÒNG LẶP, không có màn dạo đầu.** Cửa sổ này mở chín
 *    lần một ngày; một hiệu ứng "hiện dần lúc mở" là chín lần bắt người ta chờ tranh
 *    dựng xong mới đọc được số.
 *
 * Cỡ dịch chuyển đều là SỐ NGUYÊN pixel và đi bằng `steps()`. Trượt mượt nửa pixel trên
 * một cái sprite lưới 4px thì cạnh nào cũng nhoè, và cái nhoè ấy đọc thành lỗi render
 * chứ không đọc thành chuyển động — cùng lý lẽ với ghi chú "bo trơn cạnh răng cưa" ở SUN.
 *
 * `prefers-reduced-motion` tắt sạch, xem khối cuối phần khung cảnh trong `styles.css`.
 */
/**
 * Chỗ đứng của từng món trang trí trong khung trời.
 *
 * Bảng ánh xạ món→chỗ từng nằm ở đây và đã DỌN ĐI: server gửi thẳng `pet.worn` — một bảng
 * chỗ→món đã lọc sạch (đã mua, đúng chỗ, mã có thật; xem `normWorn` trong `src/pet.js`).
 * Giữ lại bản ở đây thì từ lúc nhiều món chung một chỗ nó thành bản thứ hai của cùng một
 * quyết định, và bản thứ hai là bản sẽ lệch.
 *
 * `head` vẫn nằm TRONG `.mb-sprite` chứ không nằm trong `.mb-sky`, và đó là lý do khung
 * cảnh không thể vẽ mọi chỗ bằng một vòng lặp: cái mũ phải đi theo cái đầu, mà `.mb-sprite`
 * là thứ duy nhất biết cái đầu đang ở đâu (nó căn `left:50%` rồi dịch lại một nửa). Đặt mũ
 * vào bầu trời thì mỗi lần đổi bề rộng popover là mũ trượt khỏi đầu — và bề rộng thì bàn
 * chỉnh vặn được.
 */

/**
 * Băng của cửa sổ đang quyết — MỘT chỗ suy ra, hai chỗ dùng.
 *
 * Mắt quản gia và chấm nhịp trước câu hạn mức đều đọc nó, mà từ lần chia đôi popover thì
 * hai thứ ấy không còn chung một khối nữa: khung cảnh lên nửa trên, câu hạn mức xuống nửa
 * dưới. Để mỗi bên tự lấy `b.quota.binding?.tone` là dựng hai bản của cùng một phép —
 * sửa một bên xong thì hai bên nói khác nhau về đúng một cửa sổ.
 */
const toneOf = (b) => b.quota.binding?.tone ?? 'mute';

/* ── Khung cảnh CÔNG VIÊN ──────────────────────────────────────────────────────

   Lúc quản gia đang đi bộ hay đang ra nắng thì anh ta KHÔNG ở nhà, và cái khung này nói
   điều đó ra: một vạt cỏ mọc lên dưới chân, hai tán cây và một cái ghế đá hiện sau lưng.

   Vì sao phải nói ra: hai động tác ấy khác ba động tác kia đúng ở chỗ chúng đòi bạn bước ra
   khỏi cửa (xem `where` trong `MOVES`), mà cái đòi hỏi ấy là toàn bộ giá của chúng. Một cái
   đếm ngược ba phút trong đúng khung cảnh phòng khách thì "ra nắng" chỉ là một cái nhãn dán
   lên một cái đồng hồ. Đổi cả khung cảnh thì màn hình đang kể lại việc bạn vừa nhận làm.

   Vẽ NHÌN NGANG chứ không đẳng cự, khác hẳn mấy cái cây trên bản đồ thị trấn: khung này là
   một bức tranh nhìn ngang (mặt trời, đám mây, quản gia đứng thẳng), và một tán cây đẳng cự
   thả vào đây là vật duy nhất trong khung không theo phối cảnh của nó. Hai bộ hình cho hai
   phối cảnh không phải là nhân bản — nhân bản là khi hai bản trả lời CÙNG một câu hỏi.

   `L` lá sáng · `P` lá khuất · `b` thân · `f` mặt ghế · `k` chân ghế */
const PARK_TREE = [
  '...LLLL...',
  '..LLLLLL..',
  '.LLLLLLPP.',
  'LLLLLLPPPP',
  'LLLLLPPPPP',
  '.LLLLPPPP.',
  '..LLPPPP..',
  '....bb....',
  '....bb....',
  '....bb....',
  '...bbbb...',
];

const PARK_BENCH = [
  'ffffffffffff',
  'k..........k',
  'ffffffffffff',
  'k..........k',
  'k..........k',
];

const PARK_CHARS = { L: 'leaf', P: 'pine', b: 'broth', f: 'foam', k: 'ink' };

const parkArt = (rows, cls) => html`<span class="pet-art ${cls}" aria-hidden="true"
  style="width:${rows[0].length * 4}px;height:${rows.length * 4}px"
  >${pixels(rows, PARK_CHARS, false)}</span
>`;

/** Quản gia có đang ở ngoài công viên không. Một cửa duy nhất, và nó đọc đúng cái trường
 *  mà bản đồ thị trấn đang đọc để quyết chỗ anh ta đứng — hai bề mặt, một câu trả lời. */
const inPark = (pet) => Boolean(pet?.on) && whereOf(pet.doing) === 'park';

/**
 * Quản gia đang ở trạng thái nào — và từ 5/8 câu này do CON VẬT trả lời, không do hạn mức.
 *
 * ## Chỗ hỏng
 *
 * Bản trước: `dozing = tone === 'crit' || 'warn' || 'mute'`, tức là ngủ khi tiền nằm
 * không. Trên máy này `tone` gần như luôn là `mute` (không có cửa sổ hạn mức nào đang
 * quyết) hoặc `warn` — nên quản gia NGỦ QUANH NĂM. Người dùng báo đúng chuyện đó: "toàn
 * thấy ngủ thôi". Và cái ngủ ấy không chỉ nhàm, nó nuốt luôn mọi thứ khác: cú chớp mắt chỉ
 * chạy khi thức (mắt đã nhắm sẵn thì một cái mí cụp xuống chẳng che được gì), nên bản
 * trước không ai từng thấy nó bao giờ.
 *
 * ## Vì sao con vật thắng
 *
 * Từ lúc có lớp chỉ số sức khoẻ, nhân vật này có ĐỜI RIÊNG: nó đói, nó cạn tập trung, nó
 * đang ăn hoặc đang đi bộ. Một nhân vật ngủ vì một cửa sổ hạn mức đang rảnh, ngay bên cạnh
 * hai cái thanh nói về chính nó, là một nhân vật đang trả lời câu hỏi của người khác.
 *
 * Ba trạng thái, và mỗi cái nói một điều đọc được:
 * - **Đang làm gì đó** → thức, và ĐỔI TƯ THẾ theo việc (`poseOf`, chung bảng với bức tranh
 *   trong nhà). Đây là thứ đổi thường xuyên nhất, vì ăn và nghỉ là hai việc người ta bấm
 *   mỗi ngày.
 * - **Quá nhịp hoặc đói lả** → ngủ gật, mắt nhắm, ba chữ z. Đúng lúc lời nhắc sức khoẻ
 *   ngay dưới đang nói cùng một câu, nên hai thứ cộng lại chứ không cãi nhau.
 * - **Còn lại** → thức, thở, thỉnh thoảng chớp mắt. Trạng thái mặc định giờ là thức, đúng
 *   như một con vật đang khoẻ.
 *
 * Băng hạn mức vẫn còn HAI kênh — chấm nhịp và mấy cái thanh ở nửa dưới — nên nó không mất
 * tiếng nói, chỉ mất chỗ mượn. Và khi trò chơi TẮT thì đôi mắt trả lại cho băng: lúc ấy
 * không có con vật nào để nói về, mà cái khung vẫn phải nói được một điều gì đó.
 */
function moodOfScene(pet, tone) {
  // Trò chơi TẮT: không có con vật nào để nói về, nên đôi mắt trả lại cho băng hạn mức —
  // đúng như trước khi lớp trò chơi tồn tại. Đây là nhánh DUY NHẤT còn đọc `tone`.
  if (!pet?.on) {
    return { state: 'off', pose: 'stand', eyes: 'shut', dozing: tone === 'crit' || tone === 'warn' || tone === 'mute', mark: null };
  }
  // Mọi nhánh còn lại do CON VẬT quyết, và luật nằm ở `butlerLook` — chung với bản đồ thị
  // trấn. Trước lượt này chỗ này giữ một bản luật riêng, và bản ấy gộp "đói lả" với "kiệt
  // tập trung" vào cùng một hình ngủ gật; xem `stateOf` bên `petmath.js` để biết thứ hạng
  // giờ là gì và vì sao.
  const look = butlerLook(pet, { cheer: false });
  return { ...look, dozing: look.eyes === 'shut' };
}

function scene(b, phase, pet, bump = 0, skyEcho = false) {
  const tone = toneOf(b);
  const { state, pose, dozing, mark } = moodOfScene(pet, tone);
  const rows = butlerRows(pose, dozing ? 'shut' : 'open');
  const night = phase === 'night';
  // Trò chơi tắt, hoặc chưa hỏi được sổ → khung cảnh y như trước khi có nó. Không có
  // nhánh nào bày một cái thanh rỗng hay một ô xám chờ dữ liệu: popover mở ra trong vài
  // giây, và một chỗ trống đang chờ thì tệ hơn hẳn một chỗ không có gì.
  const on = Boolean(pet?.on);
  const nudge = on ? nudgeOf(pet) : null;
  // NÓI hay NGHĨ — luật ở `speaking`/`butlerThinks`/`butlerTalk` bên `lib/pet.js`, không ở
  // đây. Chỗ này chỉ chọn cái hình cho mỗi giọng.
  //
  // Từ lượt 19 CẢ HAI bong bóng đều dựng, mọi lúc, và cái quyết định thứ nào hiện ra là
  // thuộc tính `open` của `details` — tức là một cú bấm, không phải một câu `if` ở đây. Lý do
  // là ràng buộc đã dựng nên cái `details` này: popover thật chạy trong WKWebView, trang demo
  // gọi CHUNG hàm vẽ này, và không bên nào có một handler chung để nghe cú bấm. Đổi bong bóng
  // bằng CSS thì không cần bên nào nghe cả.
  //
  // `loud` vì thế chỉ còn một việc: mở SẴN cái sổ ở hai bậc gấp. Nó không còn chọn bong bóng.
  const loud = on && speaking(pet);
  const talk = butlerTalk(pet);
  const thoughts = on ? butlerThinks(pet) : [];
  const worn = on ? (pet.worn ?? {}) : {};
  // Trả thẳng cả cái thẻ chỗ đứng, không trả mảng hình: chỗ nào cũng đúng một món (bảng
  // `worn` khoá theo chỗ), nên nhánh "có món thì bọc, không thì thôi" lặp lại y hệt ở mọi
  // chỗ — mỗi bản chép của một câu `if` là thêm một chỗ để quên.
  const deco = (slot) =>
    worn[slot] ? html`<div class="pet-slot slot-${slot}">${itemArt(worn[slot])}</div>` : '';

  // `--now` (khoá pha) dọn lên `.mb-wrap` ở lượt 24 — xem `popoverView` cuối file. Nó từng
  // ngồi ngay đây, và chỗ ấy hụt: mọi thứ NGOÀI bức tranh mà vẫn trong popover — chấm nhịp
  // ở câu quản gia, vân bò của mảng dự phóng — không với tới được nó.
  return html`<div class="mb-scene tone-${tone} pet-${state}">
    <!-- Bức tranh và hàng trò chơi nằm trong MỘT cái khung. Trước đây chúng là hai khối
         rời cách nhau 8px, mà chen đúng vào giữa là câu hạn mức — một con số THẬT kẹp
         giữa hai nửa của một trò chơi. Gộp lại thì cái khung trả lời trọn một câu hỏi
         (con vật đang thế nào, mua được gì) và câu hạn mức dọn xuống nửa dưới, chỗ nó
         thuộc về. Ranh giới giữa hai thế giới vì thế thành một cái viền, không còn là
         một khoảng trống ai cũng đọc ra một kiểu. -->
    <div class="mb-stage">
      <div class="mb-sky">
        ${STARS.map(([x, y]) => html`<i class="mb-star" style="left:${x}%;top:${y}%"></i>`)}
        <!-- MẶT TRỜI LÀ CÔNG TẮC THEME, từ lượt 18. Người dùng xin: "bấm vào mặt trời trên
             popover có thể chuyển chế độ, mặc định là auto".
             Đây là chỗ đúng cho nó dù mọi thứ khác trong cái viền này là trò chơi: mặt trời
             và mặt trăng là hình vẽ SẴN CÓ của sáng và tối, và một nút riêng ở hàng chrome
             thì phải tự dựng lấy một cặp biểu tượng thứ hai nói y hệt hai cái này. Ngoại lệ
             hẹp và có điều kiện: nó không đọc một số liệu nào, nó chỉ nhận một cú bấm.
             Hình vẫn do GIỜ quyết, không do theme — trăng lúc nửa đêm kể cả khi đang ép nền
             sáng. Bức tranh nói về chỗ người dùng đang ngồi; theme nói về cái cửa sổ.
             data-sky chở chế độ KẾ TIẾP, cùng quy ước với data-lang ở hàng trên: chỗ nghe
             không phải tính lại vòng xoay lần thứ hai.

             ## NHÃN chữ, lượt 20 — vì sao tooltip là một câu trả lời hỏng

             Người dùng: *"tôi chỉ biết bấm bấm nhưng không biết mình đang ở trạng thái nào"*.
             Đúng, và bản lượt 18 để toàn bộ phản hồi trong thuộc tính title. Ba chỗ hỏng:
             một tooltip phải RÊ CHUỘT và ĐỢI, mà cửa sổ này mở rồi đóng trong vài giây; nó
             không tồn tại trên bàn phím; và ba chế độ thì chỉ có HAI cái nền phân biệt được
             bằng mắt — auto-ra-tối và ép-tối vẽ ra đúng một màn hình giống hệt nhau.

             ## Lượt 21 đảo lại: thường trực → chỉ hiện sau cú bấm, DƯỚI mặt trời, tan sau 3s

             Người dùng: *"Nội dung nền này chỉ cần hiện lúc bấm vào sau 3s tự fade đi và nó sẽ
             hiện ở dưới mặt trời thay vì bên phải"*.

             Lượt 20 chọn thường trực và lý lẽ khi ấy là "nháy lên rồi tắt thì lần mở sau lại mù".
             Lý lẽ ấy đúng về một chuyện và sai về một chuyện. Đúng: sau khi nhãn tan, cái nút lại
             không tự khai chế độ. Sai: nó đánh đổi bằng thứ đắt hơn — một nhãn chữ NẰM VĨNH VIỄN
             giữa một bức tranh, tức là cái duy nhất trong cả khung cảnh không phải hình vẽ. Nó
             cũng ăn mất dải y 15–31, dải trống duy nhất còn lại của bầu trời.

             Cái chuộc lại chỗ mất kia là tooltip: nó vẫn ở nguyên trên nút và vẫn nói đủ "đang X,
             bấm sang Y". Tooltip hỏng khi nó là ĐƯỜNG DUY NHẤT — đó là ca của lượt 18. Làm lớp
             thứ hai sau một phản hồi tức thì thì nó đúng vai.

             DƯỚI chứ không bên phải, và chỗ đứng ấy có một cái giá đo được: món lơ lửng ngồi
             cách trái 58px, cách trần 42px (xem slot-air), nên một cái nhãn dưới mặt trời có
             thể chạm mép trái của nó trong 3 giây. Nhãn thắng, và nó thắng vì nó là phản hồi
             cho cú bấm vừa xong — thứ đang được nhìn. Xem mb-sky-tag trong styles.css để biết
             cách nó đè lên.

             Chú thích này CỐ Ý không có một dấu backtick nào, kể cả quanh tên class và tên
             file: khối chú thích HTML này nằm trong một template literal, nên một dấu backtick
             ở đây ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3. Lượt 20 lọt vào nó một lần ở views/pet.js,
             và lượt 21 lọt lại đúng ở đây, lần này cách dòng cảnh báo cũ hẳn một file.

             Nó vẫn nằm TRONG cái nút, nên nó vừa là nhãn vừa là thêm vùng bấm — hai thứ ấy phải
             là một, nếu không thì cái nhãn thành một vật thứ hai nằm cạnh cái nút, và người ta
             sẽ bấm vào nhãn. -->
        <button type="button" class="${night ? 'mb-moon' : 'mb-sun'}" data-sky="${nextTheme()}"
          title="${t('mb.sky', { now: t(`mb.theme.${themeMode()}`), next: t(`mb.theme.${nextTheme()}`) })}"
          >${pixels(night ? MOON : SUN, { o: 'core' }, false)}${skyEcho
            ? html`<b class="mb-sky-tag">${t(`mb.skyTag.${themeMode()}`)}</b>`
            : ''}</button>
        <div class="mb-cloud">${pixels(CLOUD, {}, false)}</div>
        ${inPark(pet)
          ? html`<div class="mb-park">
              ${parkArt(PARK_TREE, 'park-tree t1')}${parkArt(PARK_TREE, 'park-tree t2')}
              ${parkArt(PARK_BENCH, 'park-bench')}
            </div>`
          : ''}
        <!-- Cầu vồng vẽ TRƯỚC quản gia để nó nằm dưới; mấy chỗ còn lại vẽ sau. Thứ tự trong
             DOM là toàn bộ thứ tự lớp ở đây, không có z-index nào — thêm z-index vào một
             khung cảnh chỉ có sáu vật là dựng một hệ thứ hai để nói điều thứ tự đã nói. -->
        ${deco('back')}${deco('top')}
        <!-- BẤM VÀO NHÂN VẬT thì SỔ TRẠNG THÁI mở ra bên trái anh ta. Dựng bằng
             details/summary chứ không bằng một cái nút cộng một dòng JS, và lý do là một
             ràng buộc của bề mặt này chứ không phải khẩu vị: popover thật chạy trong
             WKWebView, mà trên macOS thì một cú bấm chuột lên nút KHÔNG trao focus cho nó —
             nên mọi mẹo dựa vào focus sẽ chạy ở trình duyệt và câm ở đúng chỗ nó phải chạy.
             details thì mở bằng chính trạng thái DOM, không mượn focus của ai.
             Rẻ hơn một cái nút cộng handler nữa: trang demo và popover thật dùng chung một
             hàm vẽ này, nên một handler phải gắn ở HAI chỗ mới đủ. Không handler thì không
             có chỗ thứ hai để quên.
             Thuộc tính open bật sẵn khi anh ta đang NÓI — hai trạng thái mà bức tranh vẽ ra
             một người ngừng làm việc. Lúc ấy cái sổ không còn là thứ phải xin mới thấy.
             details mang display: contents, nên summary vẫn là con trực tiếp của .mb-sky và
             phép đặt tuyệt đối của .mb-sprite không phải đổi một dòng nào. -->
        <details class="mb-who" ${loud ? 'open' : ''}>
        <summary class="mb-sprite ${dozing ? 'dozing' : ''}" title="${t('pet.statOpen')}">
          ${pixels(rows, BUTLER_CHARS)}
          <!-- MÍ MẮT: hai mảng che đúng hai ô mắt, cụp xuống rồi mở ra.
               Nó không vẽ lại sprite. Chớp mắt bằng cách hoán hai hàng pixel là một lượt
               dựng DOM cho một việc kéo 200ms, và cái hẹn giờ chạy nó thì phải sống suốt
               thời gian popover mở — đắt gấp bội một mảng CSS cao 8px.
               Chỉ có khi đang THỨC. Lúc ngủ gật mắt đã nhắm sẵn trong chính sprite
               (hàng mắt nhắm), nên một cái mí cụp lên đôi mắt đang nhắm thì không che
               được gì, mà lại xoá mất đúng cái dấu gạch đang nói "nó đang ngủ". -->
          ${dozing ? '' : html`<i class="mb-lid lid-l"></i><i class="mb-lid lid-r"></i>`}
          ${deco('head')}
          <!-- BA chữ z, không phải một. Một chữ nhấp nháy tại chỗ đọc thành một cái đèn
               báo; ba chữ so le nhau thì cái mắt đọc ra hướng đi lên, và hướng ấy mới là
               thứ nói "đang ngủ". Chúng bay ra ngoài khung 64px của sprite — sang phải và
               lên trên — nên chỗ đứng của chúng là chỗ trống, không đè lên cái đầu. -->
          ${dozing ? html`<span class="mb-zzz zz1">z</span><span class="mb-zzz zz2">z</span><span class="mb-zzz zz3">z</span>` : ''}
          <!-- ĐÃ NGỒI LIỀN BAO LÂU — huy hiệu số, treo ở vai phải, ngoài khung 64px.
               Người dùng: "tôi muốn nhìn thấy lượng thời gian tôi đang tập trung trên
               popover trong không gian của pet quản gia".
               Con số ấy trước nay chỉ có ở câu nhắc dưới bức tranh, mà nudgeOf trả null
               ngay khi focusMood là sharp — tức suốt cái quãng người ta ĐANG tập trung,
               thứ đáng nhìn nhất, màn hình không có con số nào. Nó chỉ hiện sau khi đã quá
               mốc, tức lúc câu trả lời đã thành lời trách.
               Đứng NGOÀI details, không nằm trong sổ trạng thái: sổ chỉ mở sau một cú bấm,
               mà một con số phải xin mới thấy thì không phải là thứ nhìn thấy được.
               Vai TRÁI, không phải vai phải: nửa phải bầu trời là chỗ của hai bong bóng nói
               và nghĩ, nên treo con số bên ấy là mời hai thứ tranh nhau một góc mỗi lần quản
               gia có gì để kể. Bên trái chỉ có vòng đếm ngược, mà nó chỉ sống đúng một phút
               mỗi bữa ăn.
               Ba chữ z lúc ngủ gật cũng ở góc phải, nên luật một-nét-một-lúc trên sprite
               64px tự thoả — không cần một câu if nào cho ca ấy nữa.
               BẤM vào thì nó TẮT, và con số dọn vào sổ trạng thái (xem statWords bên
               lib/pet.js): lúc sổ mở, chính sổ chiếm cột trái, nên hai thứ sẽ đứng chồng
               nhau. Luật ẩn nằm ở CSS chứ không ở đây, vì cú bấm không dựng lại DOM — một
               câu if ở chỗ này sẽ đóng băng theo trạng thái lúc vẽ. Xem mb-sat trong
               styles.css.
               Chữ trần, không backtick: backtick trong chú thích HTML nằm trong template
               literal sẽ ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3. -->
          ${on ? satChip(pet) : ''}
          <!-- Nét trạng thái — bụng kêu khi đói, giọt mồ hôi khi sắp hết nhịp. Nó nằm
               TRONG mb-sprite cùng lý do với món đồ đang cầm: nó bám vào thân của đúng tư
               thế đang vẽ (xem bellyOf trong lib/pet.js), nên đổi tư thế là nó đi theo.
               Ngủ gật thì không có nét nào — ba chữ z đã là nét của trạng thái ấy, và hai
               nét cùng lúc trên một sprite 64px là hai thứ tranh nhau một chỗ nhìn.
               ĐÓI LẢ thì nét crave phải nhường chỗ cho tấm bảng NÓI trên bề mặt NÀY, và chỉ ở
               đây. Crave là một bong bóng nghĩ vẽ bằng pixel, neo ra ngoài mép phải cái đầu —
               tức đúng chỗ tấm bảng vừa dọn tới, và nói đúng một câu với nó. Bản đầu để cả
               hai: cái bong bóng pixel 44px nằm trọn sau tấm bảng, mất trắng. Bản đồ thị trấn
               không có tấm bảng nào nên ở đó nó ở lại nguyên.
               Việc nhường ấy do CSS quyết chứ không do chỗ này, từ lượt 19: tấm bảng giờ hiện
               theo cú BẤM, mà cú bấm thì không dựng lại DOM — nên một câu if ở đây sẽ đóng
               băng theo trạng thái lúc vẽ, và gập cái sổ lại lúc đang đói lả là mất cả tấm
               bảng lẫn cái bong bóng pixel. Xem mb-who trong styles.css. -->
          ${markArt(mark, pose)}
          <!-- Thứ quản gia đang dùng — món ăn, cốc nước, cái tạ — và nó VƠI DẦN rồi biến
               mất đúng lúc việc ấy xong (doing do server tính, xem doingOf). Nó là phần
               thưởng cho cú bấm mua: không có nó thì mua đồ ăn chỉ là một con số tụt đi và
               một cái thanh dài ra.
               Nó nằm TRONG mb-sprite và neo vào BÀN TAY của đúng tư thế đang vẽ, y như
               resident-item ngoài bản đồ. Bản trước nó đứng trong bầu trời ở một toạ độ
               cố định, đúng cho mỗi tư thế đứng — mà từ lượt này tư thế đổi theo việc, nên
               một toạ độ cố định là cái tạ lơ lửng cách bàn tay đang giơ hai ô.
               Popover không có nhịp vẽ lại nào, nên cái vơi ở đây chạy trọn vẹn bằng CSS
               từ lượt vẽ đầu — xem animation-delay âm trong drawArt.
               Chữ trần, không quote: backtick trong comment HTML nằm trong template
               literal sẽ ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3. -->
          ${on && pet.doing
            ? html`<div class="pet-slot slot-meal" style="left:${butlerHand(pose).x}px;top:${butlerHand(pose).y}px">
                ${doingArt(pet.doing)}
              </div>`
            : ''}
          <!-- Vòng đếm ngược, bay ở vai TRÁI. Bên phải đã là tay cầm đồ (butlerHand rơi về
               mép phải ở mọi tư thế), nên hai thứ của cùng một việc đứng hai bên người và
               không tranh chỗ nhau. Nó chạy trọn bằng CSS từ lượt vẽ đầu — điều kiện sống
               ở đây, vì popover không có nhịp vẽ lại nào. Xem doingRing trong lib/pet.js. -->
          ${on && pet.doing ? doingRing(pet.doing) : ''}
        </summary>
        <!-- SỔ TRẠNG THÁI — độ no và nhịp tập trung, dọn từ dải chân vào ĐÂY.
             Bên TRÁI nhân vật, vì bên phải đã là chỗ nói và nghĩ: hai thứ về cùng một con
             vật đứng hai bên nó thì mắt không phải chọn xem đọc cái nào trước, còn xếp
             chồng lên nhau thì phải.
             Từ lượt 18 nó là CHỮ CÓ MÀU, không còn khay đĩa với mặt đồng hồ — người dùng xin
             đúng thế. Lý lẽ đầy đủ ở statWords bên lib/pet.js; gọn lại: hai vật pixel ấy
             đứng trên một bức tranh pixel và cãi nhau với nó bằng chính ngôn ngữ nét của nó,
             còn chữ thì thuộc lớp giao diện nên nó không tranh chỗ nhìn với thứ gì.
             Nó ĐÈ lên bức tranh — che cả mặt trời và món trang trí góc trái — và điều đó
             được phép đúng vì nó không thường trực: hoặc vừa được bấm ra, hoặc đang ở một
             trạng thái mà bức tranh phía sau không còn gì đáng ngắm. Cùng lý lẽ đã ghi cho
             bong bóng thoại. -->
        <div class="mb-stat">
          ${on ? statWords(pet) : html`<p class="mb-stat-off">${butlerSays(pet)}</p>`}
        </div>
        <!-- HỘI THOẠI — nửa phải bầu trời, đè lên bức tranh. Hai giọng.
             Từ lượt 18 chúng khác nhau ở BỐN kênh, không phải hai. Người dùng báo thẳng:
             "không thấy được rõ đâu là nghĩ đâu là nói". Đúng — hai bong bóng cũ cùng một sắc
             kem, cùng một chỗ đứng, khác nhau đúng ở góc bo và ở cái đuôi, mà cái đuôi thì nằm
             ngoài vùng mắt nhìn khi đang đọc chữ.
             Bốn kênh giờ là: NÉT VIỀN (liền dày / đứt mảnh), DÁNG CHỮ (đứng đậm / nghiêng),
             ĐUÔI (một mũi nhọn chỉ vào người / hai chấm tròn rơi xuống), và ĐỘ ĐẶC. Hình và
             nét chứ không phải màu, vì theme daltonized không được dựa vào mỗi khác biệt sắc.
             Từ lượt 19 có kênh thứ NĂM, và nó là kênh mạnh nhất: hai bong bóng không bao giờ
             cùng lúc trên màn hình, và cái quyết định là CÚ BẤM. Không bấm thì anh ta nghĩ;
             bấm thì anh ta nói. Người dùng xin đúng thế — "bấm vào quản gia ngoài hiển thị
             bảng status thì kết hợp nói chuyện nữa chứ".
             Chỉ bong bóng NÓI nằm TRONG cái details, và bong bóng NGHĨ đứng NGOÀI ngay sau nó.
             Bản đầu của lượt 19 nhét cả hai vào trong rồi ẩn hiện bằng CSS, và mở trang ra thì
             bong bóng nghĩ biến mất sạch: trình duyệt bọc phần ruột của một details ĐANG ĐÓNG
             trong một lớp riêng mang content-visibility hidden, mà một luật display ở ngoài thì
             không với tới lớp ấy. Đo được: bong bóng vẽ ở y=35 trong khi bầu trời bắt đầu ở
             y=165, tức nó rơi hẳn ra ngoài khung rồi bị overflow hidden cắt.
             Nên luật đảo lại: cái phải hiện khi ĐÓNG thì đứng ngoài, cái phải hiện khi MỞ thì
             đứng trong. Bong bóng nghĩ tắt đi lúc mở nhờ một selector anh-em (xem mb-who trong
             styles.css) — quan hệ anh-em đọc trên cây DOM, mà display contents chỉ đổi cây HỘP,
             nên nó vẫn đúng.
             NÓI thì luôn dựng, kể cả lúc trò chơi tắt: mẹo không đọc sổ, nên nó vẫn có gì đó
             để nói khi con vật không có. NGHĨ thì tắt hẳn lúc ấy — không có con vật nào để mà
             nghĩ thay.
             Mỗi câu chở theo một hình tự vẽ (xem FACES bên lib/pet.js) — người dùng xin
             "thêm emoji cho vui vẻ". Nó là huy hiệu của câu, không phải một kênh tin: bỏ nó đi
             thì không câu nào mất nghĩa.
             HAI bảng hình, không một, từ lượt 20: câu NGHĨ và câu trạng thái mang KHUÔN MẶT,
             còn câu MẸO mang HUY HIỆU LOẠI (xem TIP_ART bên lib/pet.js). Người dùng xin đúng
             thế — "hiển thị emoji khác thay vì mặt trạng thái" — và nó đúng: mẹo là câu duy
             nhất không nói về quản gia, nên mượn bảng chữ "quản gia đang thế nào" để nói nó là
             mời người đọc hiểu nhầm. talkArt chọn bảng, chỗ này không phải biết có mấy bảng. -->
        <div class="mb-bubble say">
          <span class="mb-plaque">${talkArt(talk)}<b>${talk.say}</b></span>
        </div>
        </details>
        <!-- Ba câu nghĩ nằm chồng lên nhau trong MỘT ô lưới và thay phiên nhau bằng CSS —
             popover không có nhịp vẽ lại nào, nên một cái hẹn giờ ở đây sẽ phải sống suốt thời
             gian cửa sổ mở để làm đúng việc mà ba cái animation-delay đã làm.
             aria-hidden: ba câu đọc liền một mạch là ba câu vô nghĩa, mà chúng vốn không chở
             tin nào — đó là điều kiện để chúng được phép tồn tại. Bong bóng NÓI thì không
             giấu: nó là thứ người ta vừa bấm để lấy. -->
        ${thoughts.length
          ? html`<div class="mb-bubble think" aria-hidden="true">
              ${thoughts.map(
                (o, i) => html`<i class="mb-thought t${i + 1}">${faceArt(o.face)}<em>${o.say}</em></i>`,
              )}
            </div>`
          : ''}
        ${deco('left')}${deco('right')}${deco('air')}
      </div>
      <!-- CỬA VÀO CỬA HÀNG — một hàng riêng DƯỚI bức tranh, mang tên tiệm và số dư.
           Bản đầu của lượt này treo cái ví thành một tấm biển ngay trong tranh, ở góc
           trái-dưới. Người dùng bác ngay và lý do đo được: bức tranh rộng 326px mà đã phải
           chở sổ trạng thái, bong bóng thoại, nhân vật và cả một khung trời đồ trang trí — thêm một vật
           thường trực 100px nữa thì góc trái-dưới không còn chỗ cho món đồ đã mua, và cả
           khung đọc thành chật chứ không đọc thành rộng.
           Ở đây thì nó trả lời câu hỏi tốt hơn hẳn một tấm biển: hàng này có TÊN — nó ghi
           thẳng "Cửa hàng" chứ không bắt người ta đoán rằng một đống xu nghĩa là bấm được.
           Chỉ có cái ví, không có hai chỉ số kia: đó là toàn bộ phép gộp của lượt này —
           trạng thái vào tranh, cửa ở lại ngoài tranh. -->
      ${on
        ? html`<a class="mb-money" href="now://open?view=pet" title="${t('pet.openShop')}">
            <b>${t('nav.pet')}</b><i class="mb-money-go" aria-hidden="true">›</i>${wallet(pet, bump)}
          </a>`
        : ''}
      <!-- Lời nhắc sức khoẻ. Nó nằm TRONG cái khung của con vật chứ không đứng riêng, vì
           nó nói về đúng hai chỉ số trong cái sổ ngay trên nó. Và nó là dòng DUY NHẤT trong
           popover nói về người dùng chứ không nói về số liệu — nên nó cũng là dòng duy nhất
           được phép biến mất hoàn toàn khi không có việc gì để nói.
           Không còn bậc lv-urge ở đây. Bậc to giờ là chính cái bong bóng NÓI cộng cái sổ tự
           mở — hai kênh cho cùng một tin đã là đủ, và một sợi viền đang thở làm kênh thứ ba
           thì cái đang cạnh tranh không còn là sự chú ý của người đọc mà là chỗ nhìn. Bậc ấy
           vẫn sống nguyên ở màn Cửa hàng, nơi nó có một cái nút để dẫn đi (xem town-alert). -->
      ${on && nudge ? html`<p class="mb-nudge focus-${pet.focusMood}">${nudge.say}</p>` : ''}
      <!-- HÀNG NÚT NGHỈ - năm động tác có kiểm, ngay dưới câu nhắc vừa mời chúng.
           Trước hàng này, con đường từ lời nhắc tới cái nút là ba bước qua hai bề mặt:
           popover, bấm Cửa hàng, dashboard mở tab mới, cuộn tới công viên. Lời nhắc mời
           một việc mà nút làm việc ấy ở tận bề mặt thứ ba thì lời mời không có tay nắm.
           Mọc CÙNG câu nhắc và chỉ khi câu nhắc trỏ về công viên: đói lả thì việc cần làm
           là ăn (nudge go=food) chứ không phải đứng dậy, còn đang dở một việc thì server
           kiểu gì cũng từ chối (một lúc một việc, xem startBreak) - bày nút chỉ để bấm
           vào một lời từ chối là dạy người ta thôi bấm. Cộng phút lấy từ chính MOVES,
           không chép: bảng đổi thì nhãn theo. -->
      ${on && nudge && nudge.go === 'park' && !pet.doing
        ? html`<div class="mb-moves">
            ${MOVE_IDS.map(
              (id) => html`<button type="button" class="mb-move" data-mb-move="${id}" title="${t(`pet.move.${id}`)}">
                <b>${t(`pet.moveShort.${id}`)}</b><i>+${Math.round(MOVES[id].back / 60000)}′</i>
              </button>`,
            )}
          </div>`
        : ''}
    </div>
  </div>`;
}

/**
 * Câu của cửa sổ đang quyết — một dòng, mở đầu nửa dưới.
 *
 * Nó ĐÚNG như nhau ở cả hai tab, nên nó đứng trên hàng tab chứ không nằm trong tab nào:
 * một câu lặp lại y hệt ở hai bên tab đọc thành nội dung của tab, và người ta sẽ đổi tab
 * để xem nó có đổi không. Trước 5/8 nó nằm giữa khung cảnh, chỗ nó là con số thật duy
 * nhất bị kẹp giữa hai nửa của một trò chơi.
 *
 * Chấm nhịp mang sắc băng và nó là kênh THỨ HAI của cùng cái băng mà mắt quản gia đang
 * chở — hai kênh cho một tin, vì theme daltonized làm đỏ/lục hết phân biệt.
 */
function saying(b) {
  const bind = b.quota.binding;
  return html`<div class="mb-say tone-${toneOf(b)}">
    <i class="mb-pulse"></i>${bind ? html`<b>${bind.short}</b> · ` : ''}${bind ? forecastText(bind.w) : t('mb.noQuota')}
  </div>`;
}

/**
 * Việc đáng làm — hai câu đầu, mỗi câu là một cái bấm.
 *
 * HAI, không phải một: quản gia trên dashboard xoay vòng tối đa ba việc vì chúng không
 * so được với nhau, mà popover thì không có chỗ cho nút xoay và cũng không mở đủ lâu để
 * xoay. Lấy hai đầu bảng là giữ được cái mà bản một-câu làm hỏng — việc hạng nhì không
 * biến mất khỏi trang — trong khi câu thứ ba thì màn Quyết định ngay sau một cú bấm.
 */
function works(b) {
  const rows = (b.works ?? []).slice(0, 2);
  if (!rows.length) return '';
  // Chấm tròn thay cho thẻ có nền. Bản trước bọc mỗi việc trong một hộp `--surface` —
  // hai cái hộp ấy tốn 28px padding để nói đúng thứ mà một chấm màu cỡ 6px nói được,
  // trong khi chính chúng lại là nội dung PHẢI ĐỌC chứ không phải nội dung để liếc.
  return html`<div class="mb-works">
    ${rows.map(
      (w) => html`<a class="mb-work tone-${WORK_TONE[w.tone] ?? 'later'}"
        href="now://open?view=${w.goto ?? 'projects'}" title="${w.why ?? ''}"
        ><i class="mb-dot"></i><span>${w.text}</span></a>`,
    )}
  </div>`;
}

/**
 * Một cửa sổ hạn mức: hai dòng, không phải ba.
 *
 * Số dẫn là ĐÃ TIÊU (luật 1), chưa bao giờ là phần còn lại. Câu thứ ba chỉ hiện khi
 * `cardText` thực sự còn gì để nói — tức khoảng ngồi không, thứ duy nhất trên cái thanh
 * không có mảng nào vẽ được. Cửa sổ đã sang chu kỳ mới thì im hẳn: `resetLabel` ở đầu
 * thẻ đã nói đúng câu đó rồi.
 *
 * Luật đi kèm, đã phạm một lần: thanh CÓ NHÃN thì câu dưới nó là `cardText`, không bao
 * giờ là `forecastText` — bản đầy đủ in lại đúng hai con số mà nhãn vừa in. Xem khối
 * chú thích của `cardText` trong `lib/quota.js`.
 */
function windowRow(r, o) {
  const money = spentText(r.w);
  const say = r.w.expired ? '' : cardText(r.w);
  // Hàng đầu chia hai CỰC: tên cửa sổ với mấy thứ phụ dồn về trái, con số đã tiêu đứng
  // một mình ở lề phải và mang cỡ lớn nhất khối. Bản trước xếp cả bốn thứ thành một
  // hàng chảy từ trái — mắt phải quét hết hàng mới gặp con số, mà đây là thứ duy nhất
  // trong hàng người ta mở popover ra để xem.
  const head = html`<span class="mb-win-head">
    <span class="mb-win-lead">
      <span class="mb-win-name">${r.win ?? r.short}</span>
      <span class="mb-win-meta">${resetLabel(r.w)}${money ? html` · ${money}` : ''}</span>
    </span>
    <span class="mb-win-used tone-${r.tone}">${usedText(r.w)}</span>
  </span>`;
  return html`<div class="mb-win ${o.inline ? 'inline' : ''}">
    ${head}
    <span class="mb-win-bar">${quotaBar(r.w, { labels: true, tall: o.tall, pace: false, est: o.est })}</span>
    ${say ? html`<div class="mb-win-say">${say}</div>` : ''}
  </div>`;
}

/**
 * Nhãn nhóm: chữ nhỏ viết hoa, rồi một sợi kẻ chạy hết phần còn lại.
 *
 * Có nó vì tab Việc chở hai loại nội dung khác hẳn nhau — việc đáng làm, rồi hạn mức —
 * mà ranh giới giữa chúng trước đây chỉ là một khoảng trống 14px, cùng khoảng trống đang
 * ngăn hai cửa sổ hạn mức với nhau. Khoảng trống không nói được "hết loại này, sang loại
 * khác"; sợi kẻ thì nói, và nó rẻ hơn một dòng chữ.
 *
 * Chỉ có NHÃN, không có đuôi chú bên phải. Đuôi ấy từng tồn tại và đã bỏ hai lần vì cùng
 * một lý do: thứ nhét được vào một mẩu chữ 10px ở cuối một sợi kẻ thì hoặc đã có ở chỗ
 * khác, hoặc ngắn tới mức không ai đọc ra nghĩa.
 */
function eyebrow(label) {
  return html`<div class="mb-eyebrow">
    <span class="mb-eyebrow-k">${label}</span><span class="rule"></span>
  </div>`;
}

/**
 * Bản đọc hạn mức Claude đã cũ tới đâu — và vì sao.
 *
 * Popover trước đây không có chỗ nào nói câu này, trong khi màn Token trên web có đủ cả
 * (`q-age` cộng ghi chú `degraded`). Chênh lệch ấy tự nó là một cái bẫy: dòng "quét 1
 * phút" ở đầu popover nói về tuổi LƯỢT QUÉT, mà lượt quét thì luôn tươi — nên nó đứng
 * ngay trên mấy con số đã ôi và đọc thành lời bảo lãnh cho chúng.
 *
 * Gặp thật 3/8: token OAuth hết hạn lúc 17:08, tới 23:20 bản đọc vẫn nguyên. Sáu tiếng —
 * dài hơn cả cửa sổ 5 giờ — mà popover vẫn trưng "6%" và một dòng "quét 1 phút".
 *
 * Chỉ hiện KHI CÓ CHUYỆN, đúng luật của mấy câu Cursor/Antigravity ngay dưới: `stale` là
 * cờ do `collect/quota.js` bật khi bản đọc quá tuổi cho phép, nên ngày yên thì khối này
 * không tốn dòng nào.
 *
 * Không chở `quota.conservative`. Câu ấy dài hai trăm ký tự và giải thích một chuyện tinh
 * tế (số thật chỉ có thể THẤP hơn) — trong 360pt nó ăn bốn dòng để nói một điều mà người
 * đọc popover chưa cần lúc liếc. Nó vẫn nằm nguyên ở màn Token, chỗ có sức chứa.
 */
function quotaNote(q) {
  if (!q?.ok) return '';
  const why = degradedKey(q);
  if (!q.stale && !why) return '';
  return html`<div class="mb-tools">
    ${q.stale ? html`<div class="mb-tool tone-warn">${readAtText(q)}</div>` : ''}
    ${why ? html`<div class="mb-tool tone-warn">${t(why)}</div>` : ''}
  </div>`;
}

/**
 * Cursor và Antigravity ở TAB VIỆC — mấy câu văn xuôi, và chỉ khi có chuyện.
 *
 * Tab Việc giữ chúng lại dù tab Token đã vẽ chúng đầy đủ: một cảnh báo chỉ đọc được sau
 * khi đổi tab là một cảnh báo không có trên trang. Ngược lại, ngày yên thì khối này
 * không tốn dòng nào — `toolLines` chỉ trả về hai băng bỏ phí, mọi băng khác im.
 */
function toolProse(b) {
  const rows = b.tools ?? [];
  if (!rows.length) return '';
  return html`<div class="mb-tools">
    ${rows.map((r) => html`<div class="mb-tool tone-${r.tone}">${r.text}</div>`)}
  </div>`;
}

/**
 * Một công cụ ở tab Token: tên, rồi các cửa sổ của nó.
 *
 * Công cụ KHÔNG đọc được sổ vẫn phải có mặt và phải nói ra là mình không đọc được. Bỏ
 * nó đi thì "đang yên" và "hỏng thu thập" trông y hệt nhau — mà đây là tab người ta mở
 * ra để đối chiếu ba công cụ, tức là chỗ duy nhất câu hỏi ấy được đặt ra.
 */
function agentBlock(name, rows, o) {
  return html`<div class="mb-agent">
    <div class="mb-agent-h"><span class="mb-agent-n">${name}</span><span class="rule"></span></div>
    ${rows.length
      ? rows.map((r) => windowRow(r, o))
      : html`<div class="mb-none mb-none-sm">${t('mb.noSource', { name })}</div>`}
  </div>`;
}

/**
 * Tab Token — ba công cụ, mỗi cái đầy đủ các cửa sổ của nó. Hết.
 *
 * Đáy tab này từng có thêm một dải mười hai cột: mười hai cửa sổ 5 giờ vừa đóng, để trả
 * lời câu "trần 5 giờ có bao giờ thật sự chặn mình không". Bỏ 31/7. Câu ấy có thật,
 * nhưng nó là câu của một lần ngồi xuống xem lại — mà **màn Nhìn lại đã trả lời nó bằng
 * cả một chart có trục, có trung vị, có tooltip từng cửa sổ**. Dải trong popover chỉ là
 * bản rút không trục của chính chuỗi đó, và nó tính tiền bằng 34px trên MỌI lần mở
 * popover cho một câu mỗi tuần mới hỏi một lần. Muốn xem lại thì mở màn Nhìn lại.
 */
function tokenTab(s, o) {
  const ext = toolWindows(s);
  return html`<div class="mb-agents">
    ${agentBlock('Claude', windowsOf(s?.quota), o)}
    ${quotaNote(s?.quota)}
    ${agentBlock('Cursor', ext.filter((r) => r.key === 'cursor'), o)}
    ${agentBlock('Antigravity', ext.filter((r) => r.key.startsWith('ag-')), o)}
  </div>`;
}

/**
 * Tab Việc — hai ô cố định của quản gia, đúng thứ tự ấy: việc đáng làm, rồi hạn mức.
 *
 * Hạn mức ở đây lọc qua `stripRows`, đúng luật của dải quản gia trên dashboard: hai
 * khung chung được chỗ cố định, khung theo model chỉ chen vào KHI CÓ CHUYỆN. Bản trước
 * trưng cả ba vô điều kiện, nên hàng "Fable" chiếm ~50px mỗi ngày để nói một điều đã
 * yên — mà bảng đầy đủ thì tab Token ngay cạnh đã có.
 */
function workTab(s, b, o) {
  const rows = stripRows(b.quota.rows);
  return html`<div class="mb-tabbody">
    ${works(b)}
    <!-- Nhãn nhóm gọi tên CÔNG CỤ, không chỉ nói "hạn mức": tab này lọc qua stripRows nên
         mấy cái thanh dưới đây đều là của Claude, mà tab Token ngay cạnh thì có cả ba —
         một chữ "hạn mức" trơ đứng giữa hai tab ấy là một câu hỏi bỏ ngỏ.
         Đuôi phải bỏ trống. Nó từng ghi "7 ngày đang quyết" — đúng nhưng không ai đọc ra
         "đang quyết" nghĩa là gì, và ngay dưới khung cảnh đã có nguyên câu của chính cửa
         sổ ấy kèm số. Một nhãn phải giải thích thì nó không còn là nhãn. -->
    ${eyebrow(t('mb.secQuota'))}
    ${rows.length
      ? html`<div class="mb-wins">${rows.map((r) => windowRow(r, o))}</div>`
      : html`<div class="mb-none">${t('mb.noQuota')}</div>`}
    ${quotaNote(s?.quota)}
    ${toolProse(b)}
  </div>`;
}

/**
 * Cả popover. `opts` chồng lên `DEFAULTS` — trang demo đưa vào bộ khác, app đưa vào rỗng.
 */
export function popoverView(s, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const b = briefing(s, { greet: false });
  const st = s?.stats ?? {};
  const hot = (b.works ?? []).length;
  // Buổi nằm trên CẢ khối, không chỉ trên khung trời: vệt nắng hắt vào nền popover cũng
  // phải đổi theo, nếu không thì bên trong là nửa đêm mà nền vẫn hắt nắng chiều.
  // `opts.phase` chỉ có ở bàn chỉnh — app không truyền, và không được truyền.
  const phase = o.phase && o.phase !== 'auto' ? o.phase : phaseOf(new Date().getHours());
  // `--now` khoá pha MỌI hoạt hình nền của cửa sổ này vào đồng hồ tường, nên ba lượt vẽ của
  // một lần mở popover không còn giật cả bức tranh về vạch xuất phát ba lần. Xem `lifeClock`
  // trong `lib/pet.js` và khối "KHOÁ PHA" trong `styles.css`.
  // Đặt ở GỐC CỬA SỔ chứ không ở gốc bức tranh: hai thứ giật thấy rõ nhất nằm trong tranh
  // (quầng mặt trời, đám mây), nhưng chấm nhịp và vân thanh hạn mức thì ở ngoài nó.
  return html`<div class="mb-wrap sky-${phase}" style="--mb-w:${o.width}px;${lifeClock()}">
    <!-- Số phiên đang thức đi CHUNG hàng với tuổi lần quét, không chiếm hàng riêng: cả
         hai đều là tình trạng của chính cái số đang hiện, không phải việc phải làm. -->
    <!-- Mark + tên gói trong MỘT cái nút, và đó là cửa ra dashboard — không có hàng nút
         riêng ở đáy nữa (nó tốn 48px để nói một việc mà cái tên đã nói được).
         Nút phải nổi sẵn, không đợi rê chuột: cửa sổ này mở rồi đóng trong vài giây.
         Cặp mark-và-tên lấy đúng của thanh rail dashboard (xem brand-mark trong
         index.html) — cùng một cửa thì phải mang cùng một mặt.
         Đích đi theo tab đang mở: đang xem Token thì nó mở thẳng màn Token, và tooltip
         gọi tên đích vì nhãn "NOW" không tự nói mình đi đâu. -->
    <div class="mb-top">
      <a class="mb-title" href="now://open${o.tab === 'token' ? '?view=usage' : ''}"
        title="${o.tab === 'token' ? t('mb.openUsage') : t('mb.open')}"><span class="mb-mark">◈</span>NOW</a>
      <span class="mb-age">
        ${st.awake ? html`${t('mb.awake', { n: st.awake })} · ` : ''}${t('mb.scan', { ago: ago(Date.now() - (s?.generatedAt ?? Date.now())) })}
      </span>
      <!-- ĐỔI NGÔN NGỮ, và nó phải có mặt ở đây chứ không mượn được nút của dashboard:
           WKWebView trong app Swift có kho localStorage RIÊNG, không chung với Safari. Nên
           người dùng bấm đổi sang tiếng Anh trên dashboard xong mở popover ra thì vẫn là
           tiếng Việt, và không có đường nào trong popover để sửa. Đây là lần thứ ba cái kho
           riêng ấy lộ ra (hai lần trước: tab đang mở, và theme — xem menubar.html).
           Đứng ở đây chứ không trong bức tranh: đây là một CÔNG TẮC của cửa sổ, mà mọi thứ
           trong cái viền kia là trò chơi.

           ## HAI ô thay cho một nút, lượt 20 — và đây là lần thứ hai người dùng xin đúng cái đã có

           Người dùng, lượt 20: *"Cho phép đổi ngôn ngữ ở popover"*. Nút ấy đã có từ lượt 18, và
           nó chạy. Nên cái hỏng không phải chức năng, nó là chuyện KHÔNG AI THẤY — đo trên
           popover thật: 45×21px, chữ 10.5px màu #8f96a4, viền #262b37 trên một cái nền #14171f.
           Tương phản viền-với-nền 1,3:1, tức cái viền không tồn tại; còn lại là hai chữ xám
           cạnh một dòng chữ xám khác cùng cỡ ("2 phiên thức · quét vừa xong").

           Bản cũ bày ngôn ngữ ĐANG bật, đúng quy ước nút trên dashboard. Quy ước ấy sai ở ĐÂY,
           và lý do là một khác biệt thật giữa hai bề mặt: trên dashboard cái nút đứng trong một
           thanh đầy nút khác, nên nó thừa hưởng nghĩa "hàng này bấm được". Popover có đúng ba
           thứ ở hàng trên và hai thứ kia là một wordmark với một dòng chữ tình trạng — không
           có hàng nào để thừa hưởng. Một ô chữ đơn độc bày "VI" thì nó đọc thành một cái nhãn.

           Hai ô thì cái nhìn thấy không còn là một trạng thái, nó là một LỰA CHỌN: ô kia có
           mặt trên màn hình, và thứ duy nhất nó có thể là — một chỗ để bấm sang.

           ## MỘT nút mở ra danh sách, lượt 21 — vì cái dải kia không sống qua ngôn ngữ thứ ba

           Người dùng: *"Hiển thị ngôn ngữ gọn lại thành một nút chọn thôi. Sau này có nhiều
           ngôn ngữ thì sao"*. Đó là một câu hỏi về ĐỘ CO GIÃN, và nó có câu trả lời đo được:
           dải phơi hết lựa chọn nở TUYẾN TÍNH. Hai ô đo được 91,7px trong một hàng rộng 328px,
           mà hàng ấy còn phải nuôi nút NOW (58,4px) và dòng tình trạng (cần 148px trên một
           dòng) — tức trần thật của công tắc là chừng 121px. Ngôn ngữ thứ ba đã là 137px và
           hàng gãy làm đôi; thứ tư thì gãy chắc chắn. Một bố cục chỉ đúng ở đúng một con số
           thì nó không phải bố cục, nó là một sự trùng hợp.

           Một nút mở ra danh sách thì bề rộng KHÔNG phụ thuộc số ngôn ngữ nữa — nó là bề rộng
           của một mục cộng cái mũi. Danh sách dài ra theo chiều dọc, chiều mà popover có sẵn.

           Nút đóng lại bày ngôn ngữ ĐANG bật, tức là quay về đúng thứ lượt 20 đã bỏ. Nó đứng
           được ở đây vì có thêm cái MŨI: lượt 20 hỏng vì một ô chữ đơn độc "VI" không nói được
           mình là nút hay là nhãn, còn một cái mũi chỉ xuống thì chỉ có đúng một nghĩa, và đó
           là nghĩa mà mọi hộp chọn trên đời đã dạy. Cái dải hai ô mua được điều đó bằng cách
           phơi ô thứ hai ra — đắt, và chỉ trả nổi khi có đúng hai ngôn ngữ.

           Dựng bằng details/summary chứ không bằng một cái nút cộng JS, cùng ràng buộc đã dựng
           nên sổ trạng thái của quản gia: popover thật chạy trong WKWebView, mà trên macOS một
           cú bấm chuột lên nút KHÔNG trao focus cho nó — nên mọi mẹo dựa vào focus sẽ chạy ở
           trình duyệt và câm ở đúng chỗ nó phải chạy. Thêm nữa trang demo dùng chung hàm vẽ
           này mà không có handler nào, nên bất cứ thứ gì cần JS để mở sẽ chết ở một trong hai
           chỗ. details mở bằng chính trạng thái DOM.

           Không cần đóng lại bằng tay: mọi cú bấm vào một mục đều đi qua handler ngôn ngữ ở
           menubar.js, và handler ấy VẼ LẠI — thẻ details mới dựng thì mặc định đóng.

           Mỗi mục chở data-lang của CHÍNH nó chứ không chở "cái kế tiếp": một danh sách bốn
           mục thì "kế tiếp" không còn là một khái niệm. -->
      <details class="mb-langbox">
        <summary class="mb-lang-now" title="${t('mb.langPick')}" aria-label="${t('mb.langGroup')}">
          <span aria-hidden="true">${LANG_FLAG[getLang()]}</span>${getLang().toUpperCase()}<i
            class="mb-caret" aria-hidden="true"></i>
        </summary>
        <div class="mb-lang-menu" role="group" aria-label="${t('mb.langGroup')}">
          ${LANGS.map(
            (l) => html`<button type="button" class="mb-lang ${l === getLang() ? 'on' : ''}"
              data-lang="${l}" aria-pressed="${l === getLang()}"
              title="${l === getLang() ? t('mb.langOn', { name: LANG_LABEL[l] }) : t('mb.lang', { next: LANG_LABEL[l] })}"
              ><span aria-hidden="true">${LANG_FLAG[l]}</span>${LANG_LABEL[l]}</button>`,
          )}
        </div>
      </details>
    </div>

    <!-- HAI nửa, đúng thứ tự này: con vật trước, số liệu sau.
         Hàng tab từng đứng TRÊN khung cảnh, và ở chỗ ấy nó nói dối — khung cảnh không đổi
         theo tab, nên một hàng tab ngay trên nó mời người đọc hiểu rằng nó có đổi. Dời
         xuống dưới thì tab đứng ngay trên đúng thứ nó điều khiển, và ranh giới giữa hai
         nửa rơi đúng chỗ nó vốn phải rơi: hết trò chơi, sang hoá đơn. -->
    ${o.hero ? scene(b, phase, o.pet, o.bump, o.skyEcho) : ''}

    <div class="mb-data">
      ${saying(b)}
      <!-- Tab, không phải hai khối xếp dọc: ba công cụ nhân với mấy cửa sổ mỗi cái là hơn
           mười cái thanh, mà popover mở ra để LIẾC. Con số trên tab Việc là số việc đang
           chờ — nhãn tab phải tự nói có gì bên trong, nếu không thì việc đổi tab thành
           một canh bạc. -->
      <div class="mb-tabs" role="tablist">
        <button type="button" class="mb-tab ${o.tab === 'work' ? 'on' : ''}" data-tab="work" role="tab"
          aria-selected="${o.tab === 'work'}">${t('mb.tabWork')}${hot ? html` <b>${hot}</b>` : ''}</button>
        <button type="button" class="mb-tab ${o.tab === 'token' ? 'on' : ''}" data-tab="token" role="tab"
          aria-selected="${o.tab === 'token'}">${t('mb.tabToken')}</button>
      </div>

      ${o.tab === 'token' ? tokenTab(s, o) : workTab(s, b, o)}
    </div>
  </div>`;
}

/** Khối báo lỗi — cùng khuôn `.mb-wrap` để phép đo chiều cao vẫn tìm thấy nó. */
export const errorView = (msg, width = DEFAULTS.width) =>
  html`<div class="mb-wrap" style="--mb-w:${width}px">
    <div class="mb-none">${t('mb.offline')}<br /><small>${msg}</small></div>
  </div>`;

/** Chỉ dùng cho trang demo: câu đầy đủ của một cửa sổ, để đối chiếu với nhãn trên thanh. */
export const debugForecast = forecastText;
