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
import { t } from './i18n.js';
import { pixels } from './pixel.js';
import { BUTLER_CHARS, butlerHand, butlerRows, poseOf, itemArt, doingArt, hungerBar, focusGlass, nudgeText, wallet } from './pet.js';
import { whereOf } from './petmath.js';
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
 */
export const DEFAULTS = { tab: 'work', tall: true, inline: false, width: 360, hero: true, est: 'mid' };

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

/**
 * Bốn buổi trong ngày, lấy theo GIỜ MÁY.
 *
 * Popover mở ra rồi đóng trong vài giây nên không cần hẹn giờ vẽ lại: mỗi lần mở là một
 * lần đọc đồng hồ. Ranh giới cố ý thô — không có buổi nào mang tin gì, chúng chỉ để cái
 * cửa sổ này giống chỗ người dùng đang ngồi.
 */
export function phaseOf(hour) {
  if (hour >= 5 && hour < 9) return 'dawn';
  if (hour >= 9 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'dusk';
  return 'night';
}

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
 * NỬA TRÊN của popover: trời theo buổi, mặt trời hoặc mặt trăng, quản gia và đồ đạc của
 * nó, rồi một dải chân mang thanh đói với cái ví.
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
 * cảnh không thể vẽ sáu chỗ bằng một vòng lặp: cái mũ phải đi theo cái đầu, mà `.mb-sprite`
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
  if (!pet?.on) return { pose: 'stand', dozing: tone === 'crit' || tone === 'warn' || tone === 'mute' };
  if (pet.doing) return { pose: poseOf(pet.doing), dozing: false };
  return { pose: 'stand', dozing: pet.focusMood === 'spent' || pet.mood === 'starving' };
}

function scene(b, phase, pet, bump = 0) {
  const tone = toneOf(b);
  const { pose, dozing } = moodOfScene(pet, tone);
  const rows = butlerRows(pose, dozing ? 'shut' : 'open');
  const night = phase === 'night';
  // Trò chơi tắt, hoặc chưa hỏi được sổ → khung cảnh y như trước khi có nó. Không có
  // nhánh nào bày một cái thanh rỗng hay một ô xám chờ dữ liệu: popover mở ra trong vài
  // giây, và một chỗ trống đang chờ thì tệ hơn hẳn một chỗ không có gì.
  const on = Boolean(pet?.on);
  const worn = on ? (pet.worn ?? {}) : {};
  // Trả thẳng cả cái thẻ chỗ đứng, không trả mảng hình: chỗ nào cũng đúng một món (bảng
  // `worn` khoá theo chỗ), nên nhánh "có món thì bọc, không thì thôi" lặp lại y hệt ở sáu
  // chỗ — sáu bản chép của một câu `if` là sáu chỗ để quên một cái.
  const deco = (slot) =>
    worn[slot] ? html`<div class="pet-slot slot-${slot}">${itemArt(worn[slot])}</div>` : '';

  return html`<div class="mb-scene tone-${tone}">
    <!-- Bức tranh và hàng trò chơi nằm trong MỘT cái khung. Trước đây chúng là hai khối
         rời cách nhau 8px, mà chen đúng vào giữa là câu hạn mức — một con số THẬT kẹp
         giữa hai nửa của một trò chơi. Gộp lại thì cái khung trả lời trọn một câu hỏi
         (con vật đang thế nào, mua được gì) và câu hạn mức dọn xuống nửa dưới, chỗ nó
         thuộc về. Ranh giới giữa hai thế giới vì thế thành một cái viền, không còn là
         một khoảng trống ai cũng đọc ra một kiểu. -->
    <div class="mb-stage">
      <div class="mb-sky">
        ${STARS.map(([x, y]) => html`<i class="mb-star" style="left:${x}%;top:${y}%"></i>`)}
        ${night
          ? html`<div class="mb-moon">${pixels(MOON, { o: 'core' }, false)}</div>`
          : html`<div class="mb-sun">${pixels(SUN, { o: 'core' }, false)}</div>`}
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
        <div class="mb-sprite ${dozing ? 'dozing' : ''}">
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
        </div>
        ${deco('left')}${deco('right')}${deco('air')}
      </div>
      <!-- Dải chân của khung: thanh đói và ví. Nó ở TRONG khung chứ không đứng dưới khung
           vì cơn đói với cái ví là trạng thái của chính con vật vừa vẽ ở trên — tách ra
           thành một hàng rời là bắt người đọc tự nối lại. Không con số hạn mức nào lọt
           vào đây, và đó là điều kiện để cả cái khung được phép vui. -->
      ${on
        ? html`<a class="mb-pet mood-${pet.mood}" href="now://open?view=pet" title="${t('pet.openShop')}">
            <!-- Độ no LUÔN bên trái, tập trung luôn bên phải. Chỗ đứng TỪNG là một trong
                 ba kênh phân biệt hai chỉ số; từ 5/8 nó chỉ còn là thói quen đọc, vì một
                 cái thanh nằm ngang cạnh một cái đồng hồ cát đứng thì không lẫn được nữa
                 dù đứng đâu. Đồng hồ cát vẽ đúng MỘT cỡ ở cả hai bề mặt — xem focusGlass
                 trong lib/pet.js để biết vì sao không thu nhỏ nó cho vừa dải này. -->
            ${hungerBar(pet)}${focusGlass(pet)}${wallet(pet, bump)}
          </a>`
        : ''}
      <!-- Lời nhắc sức khoẻ. Nó nằm TRONG cái khung của con vật chứ không đứng riêng, vì
           nó nói về đúng cái thanh tím ngay trên nó. Và nó là dòng DUY NHẤT trong popover
           nói về người dùng chứ không nói về số liệu — nên nó cũng là dòng duy nhất được
           phép biến mất hoàn toàn khi không có việc gì để nói. -->
      ${on && nudgeText(pet) ? html`<p class="mb-nudge focus-${pet.focusMood}">${nudgeText(pet)}</p>` : ''}
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
  return html`<div class="mb-wrap sky-${phase}" style="--mb-w:${o.width}px">
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
    </div>

    <!-- HAI nửa, đúng thứ tự này: con vật trước, số liệu sau.
         Hàng tab từng đứng TRÊN khung cảnh, và ở chỗ ấy nó nói dối — khung cảnh không đổi
         theo tab, nên một hàng tab ngay trên nó mời người đọc hiểu rằng nó có đổi. Dời
         xuống dưới thì tab đứng ngay trên đúng thứ nó điều khiển, và ranh giới giữa hai
         nửa rơi đúng chỗ nó vốn phải rơi: hết trò chơi, sang hoá đơn. -->
    ${o.hero ? scene(b, phase, o.pet, o.bump) : ''}

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
