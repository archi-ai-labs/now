/**
 * Đồ ăn, đồ trang trí, đồng xu — hình vẽ, và cái thanh đói.
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
import { FULL_MS, MOVES, rampAt, stateOf } from './petmath.js';

/* ── Quản gia ─────────────────────────────────────────────────────────────────

   Nhân vật sống Ở ĐÂY chứ không ở `menubar-view.js`, và việc dọn nó sang là chỗ sửa một
   lỗi nhìn thấy được trên màn hình: popover có một quản gia 16 ô, còn bức tranh trong nhà
   ở thị trấn có một quản gia 12 ô vẽ tay riêng — hai bản, hai cái đầu khác dáng, hai bộ tỉ
   lệ. Đứng cạnh nhau thì chúng không đọc thành một nhân vật ở hai chỗ, chúng đọc thành hai
   nhân vật.

   Nên chỉ còn MỘT bộ hàng pixel, và hai bề mặt khác nhau đúng ở phần chúng có quyền khác:
   popover đổi CẶP MẮT (thức / ngủ gật), thị trấn đổi PHẦN THÂN (đứng / đi / giơ tay / cầm
   đồ). Cái đầu thì không ai được đụng vào — nó là cái mark `◈`, và một cái mark vẽ lại theo
   chỗ đặt thì thôi không còn là mark. */

/**
 * QUẢN GIA — phần ĐẦU, chín hàng.
 *
 * Đầu nó LÀ cái mark `◈` — một viên kim cương, và thứ nằm trong lòng viên ấy, chỗ icon
 * app đặt một viên nhỏ, ở đây là hai con mắt. Nên nhân vật không phải một con vật dán
 * thêm cho vui; nó là chính cái logo mở mắt ra.
 *
 * Viên có VIỀN TÍM và LÒNG TỐI — đúng hình cái mark: viên ngoài, viên trong. Lòng tối là
 * cái mặt, và hai con mắt sáng nằm trên đó. Bản để lòng rỗng cho trời lọt qua đã vẽ rồi
 * và bỏ: cái đầu tan vào khung. Bản tô đặc nguyên viên cũng bỏ: mắt tối trên mặt tím
 * sáng thì cả cái mặt chỉ còn là hai vệt, không ra khối.
 *
 * Sắc của nó là TÍM cố định, không đổi theo băng bỏ phí. Nó là nhân vật chứ không phải
 * cái đồng hồ đo: một nhân vật đổi màu áo theo số liệu thì mỗi lần mở popover lại là một
 * con khác.
 *
 * `.` trống · `#` thân · `:` mặt · `o` mắt · `O` đốm nắng trong mắt · `-` mắt nhắm ·
 * `*` nơ cổ
 */
const HEAD = [
  '.......##.......',
  '......####......',
  '.....#::::#.....',
  '....#::::::#....',
  '...#::::::::#...',
  '....#::::::#....',
  '.....#::::#.....',
  '......####......',
  '.......##.......',
];

/**
 * Hai hàng mắt, thay nguyên cặp để đổi giữa thức và ngủ gật.
 *
 * Mắt cao HAI ô chứ không phải một: một ô là 4px, mà 4px ở cỡ thật thì hai con mắt và
 * hai vết bẩn trông y hệt nhau. Lúc nhắm thì hàng trên trả về thân và chỉ còn hàng dưới
 * là gạch — đó mới là mí sụp xuống, chứ không phải mắt bị xoá.
 *
 * Nó KHÔNG chỉ để ngắm, và đó là điều kiện để nhân vật được chiếm một mảng của cửa sổ đang
 * bị ép cho gọn: **nó ngủ gật đúng lúc tiền nằm không**. Hình dáng vì thế là kênh thứ hai
 * bên cạnh sắc — theme daltonized không được dựa vào mỗi một khác biệt màu.
 */
const EYE_ROW = 3;
const EYES = {
  open: ['....#Oo::Oo#....', '...#:oo::oo:#...'],
  shut: ['....#::::::#....', '...#:--::--:#...'],
};

/**
 * Bốn TƯ THẾ — bảy hàng thân thay vào dưới cái đầu chung.
 *
 * Chúng phân biệt được ở cỡ 64px vì mỗi tư thế đổi SILHOUETTE chứ không đổi chi tiết: tay
 * xuôi, tay vung, hai tay giơ cao, một tay đưa cao. Ở 4px thì một cổ tay xoay hay một khớp
 * gối co là bốn pixel không ai đọc ra — chỉ đường bao là còn nói được.
 *
 * `stand` là NGUYÊN cái thân mà popover vẫn vẽ, không phải một bản chép giống nó. Đó là
 * ràng buộc chứ không phải trùng hợp: nhân vật đứng yên ở hai chỗ phải là một hình.
 *
 * - `walk` — một tay vung tới, một tay ra sau, hai chân tách. Khung động của nhịp đi lại,
 *   và là tư thế của động tác đi bộ.
 * - `up` — hai tay giơ cao: vươn vai, và tắm nắng. Cùng một dáng cho hai việc là cố ý —
 *   cả hai đều là "đứng dậy dang người ra", và bịa thêm một dáng thứ hai chỉ để hai ô hàng
 *   khác nhau là bịa một chuyển động không có thật.
 * - `hold` — một tay đưa cao cầm món đồ: ăn, uống, rời mắt. Món đồ vẽ RỜI cạnh bàn tay ấy,
 *   nên tay phải giơ hẳn ra khỏi đường bao thân, không thu vào trong.
 * - `type` / `type2` — ĐANG GÕ MÁY. Hai khung của một nhịp, và chúng khác nhau đúng ở hàng
 *   khuỷu tay: khung này hai tay đưa RA TRƯỚC (khe hở hai bên biến mất — nhìn từ góc này,
 *   tay đưa ra trước là tay CHỒNG lên thân), khung kia khuỷu hạ thêm một hàng.
 *
 *   Hai ô chênh nhau mỗi bên là một chuyển động nhỏ, và nó cố ý nhỏ: kênh chính kể chuyện
 *   "đang làm việc" là CÁI MÀN HÌNH trên bàn, không phải hai bàn tay. Ở 4px thì một bàn tay
 *   là một ô, mà một ô nhấp nháy đọc thành nhiễu render — đúng cái bẫy đã ghi khi bỏ nhịp
 *   đi bằng hai chân của mochi.
 */
const POSE = {
  stand: [
    '......####......',
    '....###**###....',
    '...##########...',
    '...#.######.#...',
    '...#.######.#...',
    '.....######.....',
    '.....##..##.....',
  ],
  walk: [
    '......####......',
    '....###**###....',
    '..###########...',
    '.....######.#...',
    '.....######.#...',
    '.....######.....',
    '....##....##....',
  ],
  up: [
    '..##..####..##..',
    '..#####**#####..',
    '...##########...',
    '.....######.....',
    '.....######.....',
    '.....######.....',
    '.....##..##.....',
  ],
  hold: [
    '......####..##..',
    '....###**#####..',
    '...##########...',
    '...#.######.....',
    '...#.######.....',
    '.....######.....',
    '.....##..##.....',
  ],
  type: [
    '......####......',
    '....###**###....',
    '...##########...',
    '...##########...',
    '....########....',
    '.....######.....',
    '.....##..##.....',
  ],
  type2: [
    '......####......',
    '....###**###....',
    '...##########...',
    '....########....',
    '...##########...',
    '.....######.....',
    '.....##..##.....',
  ],
  /**
   * `slump` — ĐÓI LẢ. Vai tụt xuống một hàng, tay thu vào, hai chân chụm.
   *
   * Cho tới lượt này, đói lả và kiệt tập trung dùng CHUNG một hình: ngủ gật. Hai chuyện khác
   * hẳn nhau — một cái sửa bằng cách bấm mua một bát phở, cái kia bằng cách đứng dậy khỏi
   * ghế — mà màn hình nói y một câu. Đây là hình riêng của cái thứ nhất; ngủ gật ở lại làm
   * hình riêng của cái thứ hai.
   *
   * Phân biệt bằng ĐƯỜNG BAO, không bằng chi tiết, đúng luật đã ghi cho bốn tư thế đầu — và
   * cụ thể là ở HAI đầu của đường bao, hai chỗ mắt đọc trước nhất:
   *
   * - **Đỉnh**: `stand` mở bằng bốn ô vai; ở đây chỉ còn hai ô cổ, tức cả bộ vai đã tụt
   *   xuống đúng một hàng và cái đầu lún vào giữa hai vai.
   * - **Đáy**: `stand` đứng hai chân tách; ở đây chúng chụm lại thành bốn ô liền — dáng của
   *   một người hết sức đứng, không phải một người đang đứng vững.
   *
   * Hai đầu ấy đủ xa nhau để đọc được ở 64px mà không cần nhìn phần giữa. `handOf` rơi về
   * mép phải như `stand`: không tay nào giơ lên, nên món đồ (nếu có) đứng cạnh người.
   */
  slump: [
    '.......##.......',
    '....###**###....',
    '...##########...',
    '...#.######.#...',
    '....########....',
    '.....######.....',
    '......####......',
  ],
  /**
   * `cheer` — VỪA MUA ĐƯỢC ĐỒ. Hai tay giơ, hai chân rời mặt đất.
   *
   * Khác `up` đúng ở HAI HÀNG CUỐI, và đó là chủ ý chứ không phải làm biếng: phần trên của
   * hai tư thế nói cùng một điều ("hai tay giơ lên"), nên vẽ khác đi là bịa ra một khác biệt
   * không có nghĩa. Cái khác nhau thật nằm ở chân — `up` là vươn vai và tắm nắng, hai việc
   * làm khi đang ĐỨNG; `cheer` là bật lên khỏi mặt đất. Hai bàn chân hất ra ngoài ở hàng
   * cuối là hình duy nhất trong cả bộ có đường bao rời khỏi trục đứng, nên nó đọc ra ngay.
   *
   * Nó là tư thế duy nhất KHÔNG do sổ quyết: nó chạy đúng một nhịp sau một cú mua thành
   * công, rồi tắt (xem `CHEER_MS`). Một trạng thái do sự kiện, không do số đo — nên nó không
   * có mặt trong `stateOf`, thứ chỉ đọc sổ.
   */
  cheer: [
    '..##..####..##..',
    '..#####**#####..',
    '...##########...',
    '.....######.....',
    '.....######.....',
    '....##....##....',
    '...##......##...',
  ],
};

export const BUTLER_CHARS = { ':': 'face', o: 'eye', O: 'eye spark', '-': 'eye shut', '*': 'tie' };

/** Khung của nhân vật, tính từ chính cái lưới. Mọi chỗ đặt chân quản gia — bầu trời
 *  popover, sàn nhà trong thị trấn, bãi cỏ công viên — đọc hai số này chứ không gõ tay:
 *  một cặp kích thước chép sang CSS là bản thứ hai của một con số. */
export const BUTLER_W = HEAD[0].length * 4;
export const BUTLER_H = (HEAD.length + POSE.stand.length) * 4;

/**
 * Chỗ MÓN ĐỒ đứng, theo từng tư thế — tính bằng pixel từ mép trên-trái sprite.
 *
 * Dò ra từ chính mấy hàng pixel, không gõ tay: một cặp toạ độ chép sang CSS là bản thứ hai
 * của một con số, và lần vẽ lại tư thế tiếp theo là bát phở lơ lửng cạnh hông. Cùng cái
 * luật đã ghi ở `itemArt` và ở `feet` bên `town.js`.
 *
 * Phép dò: hàng ĐẦU TIÊN mà thân vươn ra xa hơn tư thế đứng ở mép phải. Ở `stand` thì đường
 * bao dừng đúng chỗ vai với tay xuôi, nên bất cứ ô nào quá mốc ấy chỉ có thể là một cánh tay
 * đã giơ lên. So với `stand` chứ không lấy một cột cố định vì `stand` là bản gốc của cả bộ —
 * nới thân quản gia rộng ra thì mốc so tự đi theo.
 *
 * Tư thế KHÔNG có tay giơ (`stand`, `walk`) rơi về mép phải sprite, ngang vai. Đó là ca
 * thật chứ không phải nhánh phòng hờ: đi bộ thì hai tay đang vung, không tay nào rảnh để
 * cầm chiếc giày — nên món đồ đứng CẠNH người, như một cái nhãn, chứ không dính vào tay.
 */
const handOf = (pose) => {
  for (const [y, row] of POSE[pose].entries()) {
    const x = row.lastIndexOf('#');
    if (x > POSE.stand[y].lastIndexOf('#')) return { x: (x + 1) * 4, y: (HEAD.length + y) * 4 };
  }
  return { x: BUTLER_W, y: HEAD.length * 4 };
};
const HANDS = Object.fromEntries(Object.keys(POSE).map((k) => [k, handOf(k)]));
export const butlerHand = (pose) => HANDS[pose] ?? HANDS.stand;

/** Đầu + thân, ghép lại. `eyes` chỉ có hai giá trị vì cái đầu chỉ có hai trạng thái; một
 *  mã lạ rơi về mắt mở, chứ không rơi về một cái mặt trống. */
export const butlerRows = (pose = 'stand', eyes = 'open') => {
  const eye = EYES[eyes] ?? EYES.open;
  return [...HEAD.map((r, i) => eye[i - EYE_ROW] ?? r), ...(POSE[pose] ?? POSE.stand)];
};

/**
 * Việc đang làm → tư thế. Ở ĐÂY chứ không ở `town.js` như trước, vì từ 5/8 có HAI bề mặt
 * hỏi cùng câu hỏi này: bức tranh trong nhà, và khung cảnh popover.
 *
 * Bảng ở một chỗ thì hai bề mặt không lệch được. Để mỗi bên tự giữ một bản là dựng lại
 * đúng cái lỗi mà lượt trước vừa gỡ — hai bản của một nhân vật.
 *
 * Động tác nào không có tên ở đây thì đứng yên, chứ không ném: `MOVES` bên `petmath.js` là
 * nơi quyết có mấy động tác, và một động tác thêm vào đó mà quên ở đây phải là một nhân
 * vật đứng im, không phải một trang trắng.
 *
 * `eyes` là `hold` chứ không `stand`: rời mắt khỏi màn hình thì trong tay có một thứ để
 * nhìn ra xa — cái hình con mắt — và một tư thế đứng nghiêm với một món đồ lơ lửng bên
 * hông là hai vật không dính gì tới nhau.
 */
export const POSE_OF = { water: 'hold', stretch: 'up', eyes: 'hold', walk: 'walk', sun: 'up' };

/** Tư thế cho một việc đang làm; rảnh tay thì đứng. Ăn thì luôn `hold` — cái bát ở trong
 *  tay, bất kể món gì. */
export const poseOf = (doing) =>
  doing ? (doing.kind === 'move' ? (POSE_OF[doing.id] ?? 'stand') : 'hold') : 'stand';

/* ── Trạng thái → cách vẽ ──────────────────────────────────────────────────────

   `stateOf` bên `petmath.js` trả về một cái TÊN và không biết gì về sprite; bảng dưới đây
   là chỗ duy nhất dịch cái tên ấy ra hình. Hai bề mặt — popover và bản đồ thị trấn — gọi
   chung `butlerLook`, nên chúng không thể lệch nhau nữa.

   Đây là chỗ sửa chính của lượt này. Trước đó popover có luật riêng trong `moodOfScene` và
   thị trấn có luật riêng trong `butlerArt`, hai luật không ai viết ra, và cả hai gộp "đói
   lả" với "kiệt tập trung" vào cùng một hình ngủ gật. */

/** Nét thêm vào ngoài tư thế — mỗi trạng thái nhiều nhất MỘT, và mỗi nét neo vào một chỉ
 *  số thật. Không nét nào là trang trí: `pang` đọc `mood`, `sweat` đọc `focusMood`, `spark`
 *  đọc một cú mua vừa xong. Hai trạng thái không được dùng chung một nét — dùng chung là
 *  quay lại đúng lỗi mà cả khối này sinh ra để sửa. */
const LOOK = {
  busy: { pose: null, eyes: 'open', mark: null },
  // `crave` chứ không `pang`, và đây là chỗ sửa một lỗi mà chính khối chú thích ngay trên
  // đang cấm: tới lượt trước `starving` và `hungry` dùng CHUNG ba vạch bụng kêu. Hai bậc đói
  // vì thế chỉ khác nhau ở tư thế, còn cái nét thì nói y một câu — nên bậc nặng không có kênh
  // nào của riêng nó. Xem `CRAVE`.
  starving: { pose: 'slump', eyes: 'open', mark: 'crave' },
  // Ngủ gật ở lại đây và CHỈ ở đây. Nó là hình của "đã quá một chu kỳ trọn vẹn", không còn
  // phải gánh thêm phần của cơn đói.
  spent: { pose: 'stand', eyes: 'shut', mark: null },
  hungry: { pose: 'stand', eyes: 'open', mark: 'pang' },
  dip: { pose: 'stand', eyes: 'open', mark: 'sweat' },
  well: { pose: 'stand', eyes: 'open', mark: null },
};

/**
 * Dáng mừng chạy ngần này rồi tắt.
 *
 * Hai giây, và nó là một sự kiện chứ không phải một trạng thái: sổ không có trường nào nói
 * "vừa mua xong", mà cũng không nên có — một cú bấm đã xảy ra thì thuộc về màn hình vừa
 * nhận nó, không thuộc về dữ liệu. Chỗ gọi tự giữ mốc và tự tắt.
 */
export const CHEER_MS = 2000;

/**
 * Quản gia đang trông thế nào — MỘT cửa cho cả hai bề mặt.
 *
 * `cheer` là cờ do chỗ gọi đưa vào (một cú mua vừa xong), không đọc từ sổ. Nó thắng mọi
 * trạng thái khác kể cả `busy`, và đó là đúng: mua đồ ăn xong thì `doing` bật lên ngay
 * trong cùng một lượt trả lời, nên nếu `busy` thắng thì dáng mừng không bao giờ được thấy.
 */
export function butlerLook(pet, { cheer = false } = {}) {
  if (cheer) return { state: 'cheer', pose: 'cheer', eyes: 'open', mark: 'spark' };
  const state = stateOf(pet);
  const l = LOOK[state] ?? LOOK.well;
  return { state, pose: l.pose ?? poseOf(pet?.doing), eyes: l.eyes, mark: l.mark };
}

/* ── Ba nét trạng thái ─────────────────────────────────────────────────────────

   Chúng KHÔNG mượn màu băng (`--crit`/`--warn`/`--ok`/`--cheer`) — cùng hàng rào đã ghi cho
   mọi đồ vật trong `d-pet`. Sắc của chúng khai riêng ở `styles.css`, dưới class riêng, nên
   không lẫn với bảng `--art-*` của đồ ăn. */

/** Bụng kêu — ba làn sóng cao dần, toả ra khỏi thân. Ba vạch đứng dài ngắn khác nhau chứ
 *  không phải ba cung tròn: ở lưới 4px một cung bán kính 2–3 ô rơi vào đúng cái bẫy đã hạ
 *  mặt đồng hồ chín chấm — mắt đọc chỗ làm tròn thành hình méo. Vạch thẳng thì lưới không
 *  phá được, mà nhịp dài-dần vẫn nói ra hướng toả. */
const PANG = ['....#', '..#.#', '#.#.#', '#.#.#', '..#.#', '....#'];

/** Giọt mồ hôi — hẹp trên, phình dưới. Nó bám thái dương, chỗ duy nhất quanh cái đầu còn
 *  trống ở mọi tư thế. */
const SWEAT = ['.#.', '.#.', '###', '###', '.#.'];

/** Tia mừng — dấu cộng bốn cánh, KHÔNG phải hình thoi: hình thoi là cái đầu quản gia, và
 *  một nét trang trí trùng dáng với cái mark của app thì nó đọc thành cái đầu thứ hai. */
const SPARK = ['..#..', '..#..', '#####', '..#..', '..#..'];

/**
 * BONG BÓNG NGHĨ — một bát ăn trong một đám mây, cho trạng thái ĐÓI LẢ.
 *
 * ## Vì sao nó tồn tại
 *
 * Tới lượt này `starving` và `hungry` dùng CHUNG nét `pang`, tức là cái luật ghi ngay trên
 * `LOOK` — "hai trạng thái không được dùng chung một nét" — đang bị chính bảng ấy phá. Không
 * ai thấy vì hai trạng thái còn khác nhau ở tư thế (`slump` với `stand`), nhưng cái nét thì
 * nói y một câu ở cả hai bậc đói, và bậc nặng vì thế không có kênh nào của riêng nó.
 *
 * Bong bóng lấp đúng chỗ ấy, và nó nói một câu mà ba vạch bụng kêu không nói được: **anh ta
 * thôi không nghĩ đến việc nữa.** Đó là hình của cơn ĐÌNH CÔNG, không phải hình của cơn đói.
 *
 * ## Vì sao nó đứng BÊN CẠNH đầu chứ không ở trên đầu
 *
 * Chỗ tự nhiên của một bong bóng nghĩ là phía trên đỉnh đầu. Không được, và lý do là một
 * ràng buộc đã ghi một lần rồi ở `HAT`: thân quản gia dùng trọn 16 hàng của khung 64px, khung
 * ấy ngồi ở `bottom: 3px` trong một bầu trời popover cao 74px có `overflow: hidden` — tức
 * trên đỉnh đầu chỉ còn 7px. Một bong bóng 36px đặt ở đấy là một bong bóng bị cắt mất bốn
 * phần năm, đúng cái đã mất trắng một lần với mấy cái mũ cao.
 *
 * Bên phải thì có chỗ: bầu trời rộng theo cửa sổ (326px) còn sprite chỉ 64px. Nên nó neo vào
 * mép phải cái đầu và cái ĐUÔI bong bóng chúc xuống-trái, chỉ về phía người — đó là lý do hai
 * hàng cuối lệch dần sang trái chứ không nằm giữa.
 *
 * `#` viền · `o` ruột bong bóng · `n` món ăn · `b` cái bát
 */
const CRAVE = [
  '...#####...',
  '..#ooooo#..',
  '.#onnnnno#.',
  '#oobbbbboo#',
  '#ooobbbooo#',
  '.#ooooooo#.',
  '..#######..',
  '....##.....',
  '..##.......',
];

/* ── EMOJI TỰ VẼ ──────────────────────────────────────────────────────────────

   Người dùng xin "thêm emoji vào cho vui vẻ", và xin kèm điều kiện: "cố gắng tự tạo emoji
   thì càng tốt". Tự vẽ chứ không lấy emoji hệ thống, và lý do là một phép đo chứ không phải
   khẩu vị: emoji Apple là hình VECTOR bo trơn có gradient, đặt ở 24px cạnh một nhân vật dựng
   bằng ô vuông 4px thì nó sắc nét hơn mọi thứ quanh nó — đúng cái bẫy "bo trơn đứng cạnh
   răng cưa" đã ghi ở `SUN`, chỉ khác chiều thắng thua. Thêm một chuyện nữa: emoji hệ thống
   đổi hình theo phiên bản macOS, tức là một hình mà bản thiết kế không kiểm soát được.

   ## Dựng từ MỘT khuôn, không vẽ tay tám lần

   Cùng luật với `HEAD` và `EYES` của chính quản gia: một khuôn mặt chung, rồi thay HÀNG MẮT
   và HAI HÀNG MIỆNG. Vẽ tay tám bản là tám chỗ để một cái cằm lệch đi một ô, và ở 28px thì
   một ô là một phần bảy khuôn mặt.

   Bảy hàng, 28px — đúng cỡ mặt trời và mặt đồng hồ nhịp, hai vật tròn khác trong cùng khung
   cảnh. Nhỏ hơn thì ruột chỉ còn 3×3 ô, tức hai con mắt với một cái miệng phải chen vào chín
   ô, và ở đó mọi khuôn mặt đều là một khuôn.

   `.` trống · `#` viền · `:` mặt · mắt `o` mở, `-` nhắm, `x` xịu · `m` miệng · `t` lưỡi */
const FACE = [
  '..###..',
  '.#:::#.',
  '#:::::#',
  '#:::::#',
  '#:::::#',
  '.#:::#.',
  '..###..',
];

/** Hàng mắt — hàng thứ ba, thay nguyên hàng. Ba giá trị, đúng ba nhóm mà mắt người bắt được
 *  từ xa trước khi kịp đọc cái miệng.
 *
 *  Có bốn giá trị ở lượt 19: `wink` thêm vào cho câu MẸO. Lượt 20 gỡ nó ra — mẹo giờ mang
 *  HUY HIỆU riêng chứ không mang mặt (xem `TIP_ART`), nên một vẻ mặt nháy mắt không còn chỗ
 *  nào gọi tới. Ghi lại vì đây là hình mẫu của một luật: một giá trị chỉ tồn tại vì đúng một
 *  chỗ gọi thì nó phải chết cùng chỗ gọi ấy. */
const FACE_EYE_ROW = 2;
const FACE_EYES = { open: '#:o:o:#', shut: '#:-:-:#', down: '#:x:x:#' };

/**
 * Hai hàng miệng — hàng năm và sáu, và đây mới là kênh phân biệt THẬT.
 *
 * Ba giá trị mắt không đủ cho tám khuôn mặt, nên cái miệng phải gánh phần còn lại. `grin` và
 * `frown` là hai bản LẬT của nhau (đáy cong xuống / đỉnh cong lên) — cặp đối cực của cả bộ,
 * nên chúng phải đối xứng thật chứ không phải "một cái cười một cái xị vẽ riêng".
 */
const FACE_MOUTH_ROW = 4;
const FACE_MOUTHS = {
  grin: ['#m:::m#', '.#mmm#.'],
  flat: ['#:::::#', '.#mmm#.'],
  yum: ['#:mmm:#', '.#:t:#.'],
  gape: ['#mmmmm#', '.#:::#.'],
  wry: ['#:mm::#', '.#::m#.'],
  dot: ['#:::::#', '.#:m:#.'],
  frown: ['#::m::#', '.#m:m#.'],
};

/**
 * Tám khuôn mặt. Mỗi khuôn là một cặp (mắt, miệng) KHÔNG trùng cặp nào khác — đó là toàn bộ
 * điều kiện để bộ này còn đọc được: hai khuôn chung cả hai kênh thì chúng là một khuôn có hai
 * cái tên, và cái tên thứ hai sẽ được dùng cho một trạng thái không có hình riêng.
 */
const FACES = {
  glad: ['open', 'grin'],
  calm: ['shut', 'grin'],
  flat: ['open', 'flat'],
  yum: ['shut', 'yum'],
  crave: ['open', 'gape'],
  wry: ['shut', 'wry'],
  doze: ['shut', 'dot'],
  sad: ['down', 'frown'],
};

/** Tên tám khuôn mặt, XUẤT RA cho bài test. Xuất chứ không để bài test chép lại danh sách:
 *  `faceRows` rơi về `flat` khi gặp mã lạ, nên một khoá gõ sai không kêu lên — nó chỉ lặng lẽ
 *  cho cả tám bối cảnh cùng một vẻ mặt, và không có bảng đối chiếu thì không ai bắt được. */
export const FACE_NAMES = Object.keys(FACES);

/** Hàng pixel của một khuôn mặt. Mã lạ rơi về `flat` — một khuôn trung tính, không rơi về
 *  một cái mặt trống: khung 28px trống giữa bong bóng thoại đọc thành lỗi tải hình. */
export function faceRows(name) {
  const [eye, mouth] = FACES[name] ?? FACES.flat;
  const m = FACE_MOUTHS[mouth];
  return FACE.map((row, i) =>
    i === FACE_EYE_ROW ? FACE_EYES[eye] : i >= FACE_MOUTH_ROW && i < FACE_MOUTH_ROW + 2 ? m[i - FACE_MOUTH_ROW] : row,
  );
}

export const FACE_W = FACE[0].length * 4;

/**
 * Vẽ một khuôn mặt. `aria-hidden` luôn: câu chữ ngay cạnh đã nói đúng điều nó nói, và một
 * cái nhãn "mặt cười" chen vào giữa một câu là một câu bị cắt đôi.
 *
 * Tên class RIÊNG (`fill`/`iris`/`lid`/`lip`), không mượn `face`/`eye`/`shut` của quản gia.
 * Ba tên ấy đã có luật màu trong `.mb-scene` với đúng độ đặc hiệu như luật của khối này, nên
 * ai thắng là do THỨ TỰ trong file — thứ mà lần dọn CSS sau sẽ đổi mà không ai biết mình vừa
 * đổi cái gì. Tên riêng thì không có cuộc đua nào để thua.
 */
export const faceArt = (name) => html`<span class="pet-face face-${name}" aria-hidden="true"
  style="width:${FACE_W}px;height:${FACE_W}px"
  >${pixels(faceRows(name), { ':': 'fill', o: 'iris', '-': 'lid', x: 'lid cross', m: 'lip', t: 'tongue' }, false)}</span
>`;

/**
 * Trạng thái → khuôn mặt, và VIỆC ĐANG LÀM → khuôn mặt. Hai bảng vì hai câu hỏi khác nhau:
 * câu trạng thái nói "tôi đang thế nào", câu bối cảnh nói "tôi đang làm gì" — và một người
 * đang ăn giữa lúc kiệt nhịp thì hai câu ấy mang hai vẻ mặt khác nhau, đúng như thật.
 */
const FACE_OF_STATE = {
  well: 'glad', busy: 'flat', hungry: 'crave', dip: 'wry', spent: 'doze', starving: 'sad', cheer: 'glad', off: 'doze',
};
const FACE_OF_CTX = {
  // Chỉ còn bối cảnh VIỆC. Bốn buổi trời từng đứng đây đã đi cùng mấy câu nghĩ theo buổi
  // — xem luật "chỉ nghĩ khi có tin" ở butlerThinks.
  eat: 'yum', water: 'calm', eyes: 'calm', stretch: 'glad', walk: 'glad', sun: 'calm',
};

/** Vẻ mặt hiện giờ — một cửa cho cả bong bóng thoại lẫn bản đồ thị trấn. */
export const butlerFace = (pet, { cheer = false } = {}) =>
  FACE_OF_STATE[pet?.on ? butlerLook(pet, { cheer }).state : 'off'] ?? 'flat';

/** Nét nào cần thêm tên màu ngoài `#` thì khai ở đây. Ba nét đầu chỉ có một sắc nên chúng
 *  để trống — `markArt` luôn gán `#` cho chính tên nét, nên chúng không phải khai gì. */
const MARK_ART = {
  pang: { rows: PANG },
  sweat: { rows: SWEAT },
  spark: { rows: SPARK },
  crave: { rows: CRAVE, chars: { o: 'bub', n: 'meal', b: 'bowl' } },
};

/**
 * Chỗ đặt nét — dò từ chính mấy hàng pixel, cùng luật với `handOf`.
 *
 * `pang` bám ngang BỤNG, ngay ngoài cánh tay của tư thế đang vẽ, nên nó đi theo khi tư thế
 * đổi. `sweat` bám THÁI DƯƠNG, mà cái đầu thì cố định ở mọi tư thế — nên nó là một hằng số
 * suy từ `HEAD`, không phải một cặp số gõ tay. `spark` không bám vào đâu cả: nó là mấy tia
 * bay quanh cả người, chỗ đứng do CSS rải.
 */
const BELLY_ROW = 3;
const bellyOf = (pose) => {
  const rows = POSE[pose] ?? POSE.stand;
  return { x: (rows[BELLY_ROW].lastIndexOf('#') + 1) * 4, y: (HEAD.length + BELLY_ROW) * 4 };
};
const TEMPLE = { x: (HEAD[2].lastIndexOf('#') + 1) * 4, y: 2 * 4 };
/**
 * Bong bóng nghĩ neo ra NGOÀI mép phải cái đầu, ngang hàng trên cùng của sprite.
 *
 * Mốc là hàng RỘNG NHẤT của cái đầu (`HEAD[4]`), không phải hàng trên cùng. Bản đầu lấy hàng
 * trên cùng — chỗ cái đầu chỉ rộng hai ô — và mở trang ra thì thấy ngay: bong bóng cao 36px
 * nên nó chạy dọc xuống ngang tầm hai con mắt, và ở đó cái đầu đã nở ra hết cỡ. Nó đè lên
 * mặt nhân vật, tức nó che đúng thứ mà nó đang chú thích.
 *
 * Suy từ `HEAD` chứ không gõ tay, cùng luật với `TEMPLE`: nới cái đầu ra là nó tự dạt theo.
 */
const THOUGHT = { x: (HEAD[4].lastIndexOf('#') + 1) * 4, y: 0 };

/**
 * Vẽ nét trạng thái. Trả chuỗi rỗng khi không có nét — chỗ gọi không phải rẽ nhánh.
 *
 * `spark` ra HAI tia lệch nhau chứ không một: một tia nhấp nháy tại chỗ đọc thành đèn báo,
 * hai tia so le thì đọc thành một cụm đang bung ra. Cùng lý lẽ đã ghi cho ba chữ z.
 */
export function markArt(mark, pose = 'stand') {
  const art = MARK_ART[mark];
  if (!art) return '';
  const { rows } = art;
  const size = `width:${rows[0].length * 4}px;height:${rows.length * 4}px`;
  const one = (cls, at) => html`<span class="pet-mark mark-${mark} ${cls}" style="${at};${size}" aria-hidden="true"
    >${pixels(rows, { '#': mark, ...(art.chars ?? {}) }, false)}</span
  >`;
  if (mark === 'spark') return html`${one('s1', '')}${one('s2', '')}`;
  const p = mark === 'pang' ? bellyOf(pose) : mark === 'crave' ? THOUGHT : TEMPLE;
  return one('', `left:${p.x}px;top:${p.y}px`);
}

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

/**
 * Chén trà: chén HẸP đứng trên một cái đĩa RỘNG, và không có quai.
 *
 * Ở cỡ 36px thì màu không đủ tách bốn món uống; phải tách bằng dáng. Cà phê là cốc có
 * quai, chè là ly lùn, bia là ly cao có bọt — chỗ còn trống là chén-trên-đĩa.
 *
 * Bản đầu vẽ chén rộng gần bằng đĩa, và nhìn thật thì cả thứ ấy đọc thành một cái khay
 * xanh: hai vách gốm chỉ còn một ô mỗi bên nên chúng biến mất, để lại một mảng lục đặc
 * ngồi trên một vạch. Thu chén lại còn ba ô thì tỉ lệ hẹp-trên-rộng làm việc, và hai vách
 * gốm đủ dày để đọc ra là gốm.
 */
const TEA = [
  '...s.s...',
  '..#####..',
  '..#ggg#..',
  '..#ggg#..',
  '..#ggg#..',
  '...###...',
  '#########',
];

/**
 * Thanh sô-cô-la: giấy bạc bên trái, rãnh chia thành BỐN Ô, một góc bị cắn.
 *
 * Bản đầu chia bằng mấy rãnh DỌC và nhìn thật thì nó đọc thành một dãy phím đàn — mấy vạch
 * song song cùng chiều mạnh hơn hẳn cái ý "thanh kẹo". Thêm một rãnh ngang là hết: lưới
 * hai-nhân-hai chỉ có ở thanh sô-cô-la, không có ở nhạc cụ nào.
 */
const SOCOLA = [
  'ffoooboooo',
  'ffoooboooo',
  'ffbbbbbbbb',
  'ffoooboooo',
  'ffoooboo..',
];

/**
 * Nắm xôi trên lá chuối: gò trắng NẰM TRÊN một tàu lá bẹt.
 *
 * Bản đầu là một cái phễu lá chụm xuống, và ở 28px nó đọc thành một cái CÂY — mà chỗ trang
 * trí bên cạnh có sẵn ba loại cây thật. Trải lá ra nằm ngang thì hướng đọc đổi hẳn: khối
 * nặng ở trên, đế mỏng ở dưới, đúng dáng một món ăn đặt trên đĩa.
 */
const XOI = [
  '...fff...',
  '..fffff..',
  '.fffffff.',
  'ggggggggg',
  '.ggggggg.',
];

/** Kem QUE chứ không phải kem ốc quế: ốc quế là một hình nón, mà nón thì đang là xôi ở
 *  ngay ô bên cạnh. Que gỗ thò xuống là dáng không đụng với món nào khác trong bộ. */
const KEM = [
  '.ppppp.',
  'ppppppp',
  'ppppppp',
  'ppppppp',
  '.ppppp.',
  '...b...',
  '...b...',
];

/* ── Trang trí ────────────────────────────────────────────────────────────── */

/**
 * ## Luật của chỗ ĐỘI ĐẦU: sáu ô ngang cho vật ĐẬU LÊN đầu, chiều cao thì tự do
 *
 * Nón SÁU ô, không phải tám. Đỉnh đầu quản gia chỉ rộng hai ô (`.......##.......`), nên
 * một cái nón tám ô ngồi lên đó trông như cái nón đang rơi qua người. Trần ấy còn nguyên,
 * và nó chỉ áp cho vật ĐẬU LÊN: vòng hoa quàng QUANH đầu (8 ô) và vòng hào quang lơ lửng
 * BÊN TRÊN (11 ô) không đậu vào đâu cả, nên chúng không phải trả cái giá ấy.
 *
 * ## Trần bốn hàng đã BỎ ở lượt 21 — nó là trần của một bầu trời không còn tồn tại
 *
 * Con số bốn hàng sinh ra hồi bầu trời cao 74px: khung 64px của quản gia ngồi ở `bottom: 3px`
 * nên đỉnh đầu sát mép trên, mà `.mb-sky` thì `overflow: hidden` — mũ cao hơn là mũ bị CẮT,
 * đã mất trắng một lần ở bản đầu (mua 70 xu xong không thấy gì).
 *
 * Bầu trời lên 148px từ lượt 17, tức trên đỉnh đầu (y=81) có 81px trống, mà cái trần thì nằm
 * lại. Kết quả đo được ở lượt 21: bốn trong năm món đội đầu chung đúng một khung 24×16 — mũ
 * len 60 xu và vương miện 260 xu không khác nhau một pixel nào.
 *
 * Chỗ mở được cái trần là `.slot-head`: nó neo bằng `bottom` chứ không bằng `top` từ lượt này,
 * nên vành nón đứng yên còn phần cao thêm mọc LÊN TRỜI thay vì trùm xuống mặt. Xem khối chú
 * thích của nó trong `styles.css`.
 */
const HAT = ['.####.', '.####.', '.bbbb.', '######'];

/** Mũ len: quả bông trên đỉnh và một vành gập ở dưới. Hai chi tiết ấy là toàn bộ chỗ để
 *  phân biệt nó với nón chóp trong bốn hàng chung. */
const BEANIE = ['..ff..', '.pppp.', 'pppppp', 'ffffff'];

/**
 * Vương miện: bốn chóp ở hàng đầu, hai viên đá, vành đế thu vào.
 *
 * 28×20 ở lượt 21, trước là 24×16. Nó đắt gấp gần bốn lần cái nón chóp mà đứng cạnh nhau thì
 * hai món đúng một khung — xem khối luật ở đầu khe.
 */
const CROWN = [
  'g.g.g.g',
  'ggggggg',
  'gpgggpg',
  'ggggggg',
  '.ggggg.',
];

const PLANT = [
  '..g.g..',
  '.ggggg.',
  '.ggggg.',
  '...g...',
  '.#####.',
  '.#####.',
  '..###..',
];

/** Xương rồng: hai tay so le, không đối xứng. Đối xứng thì nó thành một cái nĩa; chỗ làm
 *  nó thành xương rồng là hai tay mọc ở hai độ cao khác nhau. */
const CACTUS = [
  '..g....',
  'g.g....',
  'g.g.g..',
  'ggg.g..',
  '..ggg..',
  '.#####.',
  '..###..',
];

/** Bonsai: tán BẸT và rộng hơn chậu, thân lộ ra. Chậu cây thường thì tán chụm và cao —
 *  hai dáng ngược nhau, nên đứng cạnh nhau trong cùng một khe vẫn phân biệt được. */
const BONSAI = [
  '.gggggg.',
  'gggggggg',
  'gggggggg',
  '.gggggg.',
  '...bb...',
  '...bb...',
  '.######.',
  '..####..',
];

/** Bầu bóng phải CÓ MÀU. Bản đầu để nó lấy sắc gốc trắng ngà và đứng cạnh đám mây —
 *  một khối tròn trắng có cuống thì đọc thành cây kẹo mút, không đọc thành bóng bay. */
const BALLOON = ['.ppp.', 'ppppp', 'ppppp', 'ppppp', '.ppp.', '..p..', '..s..', '..s..'];

/**
 * ## Khe LƠ LỬNG thôi dùng chung MỘT khung, lượt 21
 *
 * Bốn đời trước cả năm món ở đây chung đúng khung 5×8, và lý do ghi lại khi ấy là nhịp nổi:
 * *"một vật cao 8 hàng và một vật cao 5 hàng bay cùng biên độ thì cái thấp trông như bị
 * giật"*. Lý do ấy sai, và sai theo một kiểu đáng ghi: `mb-float` nhấc 5px cho MỌI vật, nên
 * biên độ tương đối của một vật cao 44px còn NHỎ HƠN của một vật cao 32px. Ràng buộc thật là
 * chỗ neo — mà chỗ neo thì đã sửa (`.slot-air` neo `bottom` từ lượt này), không phải cái hình.
 *
 * Cái giá của khung chung là chuyện người dùng chỉ ra: khinh khí cầu 480 xu và bóng bay 130 xu
 * không khác nhau một pixel. Giờ chúng khác nhau theo giá — 20×32 tới 44×44 — mà vẫn khác nhau
 * ở dáng như cũ: bóng tròn, diều thoi, đèn lồng hộp, pháo hoa toả tia, khinh khí cầu có giỏ.
 */
const KITE = [
  '..kk..',
  '.kkkk.',
  'kkkkkk',
  '.kkkk.',
  '..kk..',
  '..s...',
  '.s....',
  '..s...',
];

/** Đèn lồng: nắp và tua đều bằng vàng, thân đỏ hồng. Cái tua thẳng đứng dưới đáy là chỗ
 *  duy nhất tách nó khỏi quả bóng bay ở cỡ 20px — nên nó dài hai ô, không phải một. */
const LANTERN = [
  '.gggg.',
  '.rrrr.',
  'rrrrrr',
  'rrrrrr',
  'rrrrrr',
  '.rrrr.',
  '.gggg.',
  '.gggg.',
  '..gg..',
];

/** Dây cờ: một sợi kẻ rồi năm lá cờ tam giác treo dưới. Ba màu xoay vòng chứ không phải
 *  năm — năm màu trên một dải 168px thì mắt đọc thành nhiễu, không đọc thành dây cờ.
 *
 *  168×16 từ lượt 21, trước là 76×12. Người dùng: *"dây cờ to thêm bề ngang nữa"*. Bầu trời
 *  rộng 326px, nên một sợi dây 76px treo giữa trần đọc thành một mẩu dây bị đứt hai đầu chứ
 *  không đọc thành dây căng ngang. 168px phủ 52% bề ngang, và trần của nó là hai vật đã đứng
 *  sẵn ở dải trần: mặt trời kết ở x=41, đám mây bắt đầu ở x=272. */
const BUNTING = [
  '##########################################',
  'aaaaa.bbbbb.ccccc.aaaaa.bbbbb.ccccc.aaaaa.',
  '.aaa...bbb...ccc...aaa...bbb...ccc...aaa..',
  '..a.....b.....c.....a.....b.....c.....a...',
];

/** Dây đèn nháy: cùng sợi kẻ với dây cờ, nhưng thứ treo dưới là mấy bóng RỜI cao hai ô
 *  thay vì mấy tam giác liền. Hai màu xen kẽ, không ba — ít hơn dây cờ một bậc để hai món
 *  treo cùng chỗ vẫn khác nhau ở mật độ chứ không chỉ ở hình. */
const LIGHTS = [
  '##########################################',
  '..g.....p.....g.....p.....g.....p.....g...',
  '.ggg...ppp...ggg...ppp...ggg...ppp...ggg..',
  '.ggg...ppp...ggg...ppp...ggg...ppp...ggg..',
  '..g.....p.....g.....p.....g.....p.....g...',
];

const CAT = [
  '#........#',
  '##......##',
  '###....###',
  '##########',
  '#o######o#',
  '##########',
  '####oo####',
  '.########.',
  '.########.',
  '.##....##.',
];

/**
 * ## Khung THỨ HAI — và vì sao con vật phải có nó, còn cái nón thì không
 *
 * Người dùng, lượt 23: *"Cho con vật động đậy đi mèo cá,…"*. Cách rẻ nhất để làm một hình
 * pixel động đậy là nghiêng cả nó đi vài độ bằng `rotate` — và với cái cây thì đúng thế thật,
 * vì cái cây NGHIÊNG khi có gió. Con vật thì không: một con mèo nghiêng cả người qua lại đọc
 * thành một hình dán đang bị lắc, không đọc thành một con mèo. Cái động của một con vật nằm
 * ở một BỘ PHẬN — mắt, tai, đầu, đuôi — trong khi phần còn lại đứng yên.
 *
 * Nên con vật đi đường khác: hai khung hình chồng lên nhau, hoán opacity cho nhau. Đó không
 * phải phép mới trong file này — nhịp đi của quản gia (`.mini-frame`) và của người qua đường
 * (`.walker-frame`) đã chạy bằng đúng cơ chế ấy từ lượt 12. Chỗ mới chỉ là: tới lượt này nó
 * mở cho cả đồ trang trí, qua trường `alt` trong bảng `ART`.
 *
 * ## Vì sao KHÔNG hoán 50/50 như người qua đường
 *
 * Người qua đường hoán đều hai chân, vì hai khung ấy CÙNG hạng: bước trái và bước phải đều là
 * đang-đi. Cái chớp mắt thì không — mắt mở là trạng thái, mắt nhắm là một sự kiện dài một
 * phần mười giây. Hoán 50/50 thì con mèo nhắm mắt đúng một nửa thời gian, và thứ đọc ra
 * không phải "đang chớp" mà là "đang ngủ gật". Cho nên mỗi con vật khai một NHỊP riêng
 * (`life`), và nhịp ấy quyết khung B hiện bao lâu: chớp mắt 7%, cúi đầu 28%, bơi 50%.
 *
 * Mèo khung B đổi đúng hai chỗ: mắt nhắm (hai ô vàng thành ô thân) và một cái tai giật vào
 * trong một ô. Hai chỗ, vì một chỗ thì ở cỡ 40px nó lẫn vào nhịp nháy màn hình.
 */
const CAT_B = [
  '.#.......#',
  '##......##',
  '###....###',
  '##########',
  '##########',
  '##########',
  '####oo####',
  '.########.',
  '.########.',
  '.##....##.',
];

/** Chó: tai VUÔNG cụp hai bên, thân nâu, mắt tối. Mèo bên cạnh là tai nhọn loe ra, thân
 *  trắng ngà, mắt vàng — ba kênh khác nhau, vì hai con vật gần cùng khung mà chỉ khác
 *  đúng cái tai thì ở cỡ này chúng là một. Chó 40×36, mèo 40×40 — mèo đắt hơn 20 xu nên nó
 *  cao hơn một hàng, đủ để luật "giá lên thì hình không được nhỏ đi" còn đứng. */
const DOG = [
  'bb......bb',
  'bb.bbbb.bb',
  'bbbbbbbbbb',
  'bbobbbbobb',
  'bbbboobbbb',
  'bbbbbbbbbb',
  '.bbbbbbbb.',
  '.bbbbbbbb.',
  '.bb....bb.',
];

/** Chó khung B — cùng nhịp chớp mắt với mèo, nhưng KHÔNG cùng chỗ đổi, và đó là chủ ý.
 *  Hai con đứng cạnh nhau trong cùng một khe; chớp giống hệt nhau thì cái động lại xoá mất
 *  đúng ba kênh phân biệt mà lượt 20 đã dựng ra cho chúng. Mèo giật TAI NHỌN (một ô ở đỉnh),
 *  chó thì khép cái khe giữa hai TAI CỤP ở hàng hai — cùng là "cái tai vừa động", mà đường
 *  bao đọc ra vẫn là hai con khác nhau. */
const DOG_B = [
  'bb......bb',
  'bbbbbbbbbb',
  'bbbbbbbbbb',
  'bbbbbbbbbb',
  'bbbboobbbb',
  'bbbbbbbbbb',
  '.bbbbbbbb.',
  '.bbbbbbbb.',
  '.bb....bb.',
];

/** Cây nấm: mũ hồng có đốm trắng, chân trắng loe. Món trang trí rẻ nhất ở chỗ bên phải,
 *  và cũng là món duy nhất trong khung trời không phải sinh vật có mắt — chỗ ấy vốn chỉ
 *  toàn con vật, nên nó mở ra một hướng khác chứ không thêm một con thứ ba. */
const MUSHROOM = [
  '..rrrrr..',
  '.rrrrrrr.',
  'rrrfrrfrr',
  '.rrrrrrr.',
  '...fff...',
  '...fff...',
  '..fffff..',
];

/** Cầu vồng: ba vành LỒNG NHAU, không phải ba sọc xếp chồng. Ba sọc ngang ở cỡ này đọc
 *  thành một lá cờ; chỗ làm nó thành cầu vồng là cái vòng cung, nên vòng cung phải có
 *  thật ở cả ba vành. */
const RAINBOW = [
  '.........aaaaaaaaaaaa.........',
  '......aaa............aaa......',
  '....aa....bbbbbbbbbb....aa....',
  '...a...bb............bb...a...',
  '..a..bb....cccccccc....bb..a..',
  '..a.b...cc..........cc...b.a..',
  '.a..b..c..............c..b..a.',
  '.a..b..c..............c..b..a.',
];

/**
 * Dãy đồi: khối ĐẶC, ba rặng, và rộng 120px — **rộng hơn hẳn thân quản gia**.
 *
 * Bề rộng ấy là chỗ sửa, không phải chỗ trang trí. Bản đầu vẽ 56px cho bằng cầu vồng và
 * chạy thật thì nó biến mất sạch: chỗ nền trời neo ở giữa đáy, mà thân quản gia rộng 64px
 * cũng đứng ở giữa đáy — một khối đặc hẹp hơn thân thì bị che trọn, mua 210 xu xong không
 * thấy gì. Cầu vồng thoát được vì nó là mấy VÀNH RỖNG vòng qua hai bên người; đồi thì
 * không có lỗ nào để lộ ra, nên nó phải thò ra ngoài mới đọc được.
 *
 * Hai đỉnh chứ không một: một đỉnh giữa thì đúng chỗ cái đầu che, và hai bên còn lại là
 * hai vạt phẳng — đọc thành cái bục, không đọc thành đồi.
 *
 * Vẫn là khối đặc, không viền: cầu vồng đã chiếm cách vẽ viền ở chính chỗ đứng này, và
 * hai món cùng một khe mà cùng một ngôn ngữ nét thì đổi món chỉ thấy đổi màu.
 */
const HILLS = [
  '.ggggg..................ggggg.',
  'gggggggggg..gggggg..gggggggggg',
  'gggggggggggggggggggggggggggggg',
  'gggggggggggggggggggggggggggggg',
];

/* ── Bậc CAO: sáu món đắt, mỗi khe một món ────────────────────────────────────

   Người dùng xin: "thiết kế xong tạo thêm các vật phẩm đẹp + đắt tiền mỗi loại nữa nhé".

   ## Vì sao chúng đứng thành một KHỐI RIÊNG chứ không xếp cạnh mấy món cùng khe

   Cả file này vốn nhóm theo KHE, và trộn sáu món mới vào sáu nhóm ấy thì đọc mã dễ hơn đúng
   một chút. Nhưng chúng thật sự là một TẦNG chứ không phải sáu món lẻ: mỗi món đắt hơn món
   đắt nhất cùng khe từ 55% tới 110%, và cả sáu cùng phải trả lời một câu hỏi mà mấy món cũ
   không phải trả lời — *người ta tiết kiệm hai tuần để mua cái này, nó có đáng không*. Nhóm
   theo tầng thì lượt sau thêm tầng nữa còn biết mình đang so với cái gì.

   ## Luật chọn hình: KHÁC SILHOUETTE, không chỉ khác màu

   Cùng luật đã dựng ba toà nhà ngoài phố và đã tách con chó khỏi con mèo. Mỗi món mới đứng
   chung khe với hai hoặc ba món cũ, nên nó phải khác chúng ở ĐƯỜNG BAO trước, ở màu sau:

   - **Vòng hoa** loe LÊN rồi thắt lại ở đáy — ngược hẳn ba món đội đầu cũ, cái nào cũng
     rộng nhất ở vành dưới. Chỗ thắt hai ô ở đáy khớp đúng bề rộng đỉnh đầu.
   - **Anh đào** là một tán TRÒN hồng; chậu cây cũ chụm và cao, bonsai bẹt và rộng, xương
     rồng có tay. Bốn dáng, không phải bốn màu.
   - **Con hạc** là vật DUY NHẤT ở góc phải có cổ và có chân — chó, mèo, nấm đều là khối
     tròn ngồi bệt. Ở 28px thì "có chân" là khác biệt đọc được từ xa nhất.
   - **Pháo hoa** toả ra tám hướng; bóng bay, diều, đèn lồng đều là khối đặc có dây thẳng.
     Cái đuôi zigzag là kênh thứ hai — ba món cũ dùng dây thẳng, không cái nào dùng zigzag.
   - **Giàn tử đằng** treo BA chùm dài; dây cờ có năm tam giác, dây đèn có năm bóng. Ít hơn
     và dài hơn, nên nó khác ở MẬT ĐỘ chứ không chỉ ở hình — và nó cao 5 hàng, hai món kia
     cao 3.
   - **Cực quang** là ba dải NGHIÊNG; dãy đồi là một khối đặc nằm, cầu vồng là mấy vành cung.
     Độ nghiêng lấy đúng 2:1 của cả thị trấn — mỗi dải dời hai ô cho một hàng, nên nó nghiêng
     cùng một góc với mọi mái nhà ngoài kia.

   ## Cỡ vẫn phải theo TRẦN của từng khe

   Vòng hoa vẫn 6×4: trần ấy là trần VẬT LÝ (xem khối chú thích của `HAT`), không phải một
   quy ước — cao hơn bốn hàng là bị cắt, và một món 400 xu bị cắt mất đỉnh thì tệ hơn hẳn một
   món 60 xu bị cắt. Ba chỗ còn lại (`left`, `right`, `air`) giữ đúng khung của mấy món cùng
   khe, vì chúng chung một chỗ neo và một hoạt hình. Chỉ hai chỗ trên trời được nới, và chúng
   nới về phía KHÔNG có gì chắn: tử đằng dài xuống, cực quang rộng ra. */

/**
 * Vòng hoa: một mảng hoa hồng đặc trên một vành lá.
 *
 * Bản đầu xếp hai chùm hồng ở hai góc trên với lá ở giữa, và mở trang ra thì nó không đọc
 * thành vòng hoa — nó đọc thành **hai cái tai**. Ở 24×16px thì hai mảng màu tách rời ở hai
 * góc trên của một vật đội đầu chỉ có đúng một nghĩa, và cái nghĩa ấy mạnh hơn mọi ý đồ.
 * Gộp chúng thành một mảng liền thì cái nghĩa kia không dựng lên được nữa.
 */
const WREATH = [
  '..rrrr..',
  '.rrrrrr.',
  'rrrrrrrr',
  'LLLLLLLL',
  '.LLLLLL.',
  '..LLLL..',
];

/** Anh đào: tán tròn hồng, thân lộ ra, chậu chung khuôn với ba món cùng khe. */
const SAKURA = [
  '..r...r...',
  '.rrr.rrr..',
  '.rrrrrrrr.',
  'rrrrrrrrrr',
  '.rrrrrrrr.',
  '..rrrrrr..',
  '....bb....',
  '....bb....',
  '.########.',
  '..######..',
];

/**
 * Hạc: mào đỏ, mỏ nhọn, cổ vươn, thân bầu, chóp cánh tối, hai chân mảnh có bàn.
 *
 * ## 44×52 từ lượt 20, trước là 28×28
 *
 * Người dùng: *"Hồ cá koi + con hạc vẽ to hơn đi nhìn xấu quá với giá trị cao"*. Đúng, và ở
 * bản 7×7 nó không phải xấu vì vẽ tồi — nó xấu vì **không đủ ô để vẽ**. Một con hạc cần bốn
 * bộ phận mới đọc ra là hạc (mào, mỏ, cổ dài, chân dài), mà 7 hàng thì mỗi bộ phận được một
 * hàng rưỡi: cái mào là một ô đỏ, cái mỏ là hai ô, cổ là một cột. Ở 4px thì một ô đỏ trên
 * đỉnh một khối trắng không đọc thành mào, nó đọc thành một chấm bẩn.
 *
 * 13 hàng thì cổ được ba hàng riêng (đủ để thấy nó VƯƠN), chân được hai hàng cộng một hàng
 * bàn chân, và cái thân còn lại năm hàng để có bụng và có đuôi. Đó là ngưỡng, không phải sở
 * thích: dưới 11 hàng thì hoặc mất cổ hoặc mất chân, mà bỏ cái nào thì con vật cũng thành
 * một khối trắng có mỏ.
 *
 * Chân vẫn là chi tiết quyết định của khe này — thứ duy nhất nói "con này ĐỨNG" giữa chó,
 * mèo và nấm, ba khối ngồi bệt.
 *
 * ## Đuôi phải ở BÊN TRÁI, và đó là một lỗi đã mở trang ra mới thấy
 *
 * Bản đầu của lượt 20 để chóp cánh tối ở rìa PHẢI của thân, tức cùng phía với cái mỏ. Trên
 * màn hình nó không đọc thành cánh: con vật quay mặt sang phải, nên một khối tối nằm phía
 * trước mặt nó đọc thành một vật thứ hai đứng chắn đường. Đuôi dọn sang trái — phía SAU con
 * vật — thì cùng mấy ô ấy lập tức thành chùm lông đuôi.
 *
 * Luật rút ra, và nó đúng cho mọi con vật có hướng: **phần tối phải rơi về phía đối diện với
 * hướng nhìn.** Con chó và con mèo cùng khe không vướng vì cả hai nhìn thẳng ra trước.
 */
const CRANE = [
  '...rr.....',
  '...ffooo..',
  '...ff.....',
  '....f.....',
  '....f.....',
  '...fff....',
  '.offffff..',
  'offffffff.',
  '.offffffff',
  '..ffffffff',
  '...ffffff.',
  '....o.o...',
  '...oo.oo..',
];

/**
 * Hạc khung B — CÚI ĐẦU, không chớp mắt.
 *
 * Con hạc là con vật duy nhất ở khe này nhìn NGANG, nên nó là con duy nhất có một động tác
 * đọc được ở cỡ 40px mà không cần tới đôi mắt: hạ cổ xuống. Chó và mèo nhìn thẳng, cổ khuất
 * sau thân, nên với chúng chỉ còn mắt và tai.
 *
 * Đầu tụt đúng HAI ô (8px) và cái cổ ngắn lại đúng hai ô — thân, cánh, chân không đổi một
 * pixel nào. Đó là chỗ khác giữa "con chim cúi xuống" và "con chim bị kéo xuống": nếu cả
 * hình cùng tụt thì mắt đọc thành cả con vật đang chìm.
 *
 * Nhịp `peck` giữ khung này 28% chu kỳ 6,2 giây, dài hơn hẳn cái chớp mắt — cúi đầu là một tư
 * thế, và một tư thế thoáng qua trong 7% thì đọc thành lỗi vẽ.
 */
const CRANE_B = [
  '..........',
  '..........',
  '...rr.....',
  '...ffooo..',
  '...ff.....',
  '...fff....',
  '.offffff..',
  'offffffff.',
  '.offffffff',
  '..ffffffff',
  '...ffffff.',
  '....o.o...',
  '...oo.oo..',
];

/** Pháo hoa: chùm tia tám hướng, lõi hồng, đuôi zigzag rơi xuống. */
const FIREWORK = [
  '....g....',
  'g...g...g',
  '.g.ggg.g.',
  '..ggrgg..',
  'gggrrrggg',
  '..ggrgg..',
  '.g.ggg.g.',
  'g...g...g',
  '....g....',
];

/** Giàn tử đằng: ba chùm hoa tím rủ dài dưới một vòm lá, treo trên cùng sợi kẻ với dây cờ
 *  và dây đèn — chung chỗ treo thì phải chung cái sợi, nếu không ba món trông như treo ở ba
 *  độ cao khác nhau. */
const WISTERIA = [
  '##########################################',
  'LLLLL.LLLLL.LLLLL.LLLLL.LLLLL.LLLLL.LLLLL.',
  '.LLL...LLL...LLL...LLL...LLL...LLL...LLL..',
  '.ppp...ppp...ppp...ppp...ppp...ppp...ppp..',
  '.ppp...ppp...ppp...ppp...ppp...ppp...ppp..',
  '.ppp...ppp...ppp...ppp...ppp...ppp...ppp..',
  '..p.....p.....p.....p.....p.....p.....p...',
  '..p.....p.....p.....p.....p.....p.....p...',
];

/** Cực quang: ba dải sáng chồng nhau, mỗi dải dời hai ô cho một hàng — đúng độ dốc 2:1 của
 *  cả thị trấn, nên nó nghiêng cùng góc với mọi mái nhà. Rộng 180px từ lượt 21 (trước 104):
 *  ba dải lệch nhau 5 ô một tầng, nên ở bề rộng cũ chúng chồng lên nhau gần hết và cả món
 *  đọc thành một mảng. Rộng ra thì mỗi dải có chỗ để LỆCH, và cái lệch mới là hình. */
const AURORA = [
  'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLL...............',
  '..LLLLLLLLLLLLLLLLLLLLLLLLLLLLLL.............',
  '....LLLLLLLLLLLLLLLLLLLLLLLLLLLLLL...........',
  '.............................................',
  '.....cccccccccccccccccccccccccccccc..........',
  '.......cccccccccccccccccccccccccccccc........',
  '.........cccccccccccccccccccccccccccccc......',
  '.............................................',
  '..........pppppppppppppppppppppppppppppp.....',
  '............pppppppppppppppppppppppppppppp...',
  '..............pppppppppppppppppppppppppppppp.',
  '.............................................',
];

/* ── Bậc XA XỈ: sáu món nữa, mỗi khe một món ──────────────────────────────────

   Người dùng, lượt 19: *"Thêm các đồ trang trí xa xỉ khác đẹp"*.

   Tầng thứ ba, và nó nhóm riêng đúng vì lý do đã ghi cho tầng CAO ngay trên: mỗi món đắt hơn
   món đắt nhất cùng khe từ 55% tới 70%, và cả sáu cùng phải trả lời một câu hỏi mà tầng dưới
   không phải trả lời — *tiết kiệm cả tháng để mua cái này, nó có đáng không*.

   ## Luật chọn hình vẫn là KHÁC SILHOUETTE, và ở tầng này nó khó hơn hẳn

   Mỗi khe giờ đã có bốn món, tức bốn đường bao đã bị chiếm. Nên món thứ năm không còn chỗ để
   "khác một chút"; nó phải khác ở một CHIỀU mà cả khe chưa ai dùng:

   - **Vòng hào quang** là món đội đầu duy nhất KHÔNG chạm vào đầu — một cái vòng rỗng lơ lửng.
     Bốn món kia đều là khối đặc úp xuống, khác nhau ở vành và ở màu.
   - **Cây quất** là tán TAM GIÁC. Chậu cây chụm và cao, bonsai bẹt, anh đào tròn, xương rồng
     có tay — bốn dáng, và tam giác là cái thứ năm. Quả vàng là kênh phụ, không phải kênh chính.
   - **Hồ cá koi** là vật DUY NHẤT trong cả khung trời có nước, và là vật duy nhất ở góc phải
     NẰM NGANG: chó, mèo, hạc, nấm đều cao hơn rộng.
   - **Khinh khí cầu** có hai dây và một cái GIỎ — tức hai khối nặng chồng lên nhau. Bóng bay,
     diều, đèn lồng, pháo hoa đều là một khối với một sợi dây đơn.
   - **Vòm hoa hồng** là dải LIỀN. Dây cờ năm tam giác rời, dây đèn năm bóng rời, tử đằng ba
     chùm rời — cả ba đều là vật treo thưa. Mật độ 100% là chiều chưa ai chiếm.
   - **Đường chân trời** có nét ĐỨNG. Đồi là khối nằm, cầu vồng là vành cung, cực quang là dải
     nghiêng — không món nền trời nào có một cạnh thẳng đứng, mà đó lại là thứ duy nhất nói
     "do người xây".

   ## Cỡ: từ lượt 21 nó là một BẬC THANG THEO GIÁ, không còn là trần của khe

   Ba lượt đầu tầng này giữ đúng khung của mấy món cùng khe, và câu chữ khi ấy nói ra như một
   nguyên tắc. Nó không phải nguyên tắc, nó là một ràng buộc kỹ thuật đã hết hạn — cả hai cái
   trần (`.slot-head` neo `top`, `.slot-air` neo `top`) đều bắt hình mọc XUỐNG, nên món cao hơn
   thì đâm vào mặt quản gia. Cả hai đã đổi sang neo `bottom` ở lượt 21.

   Luật thay chỗ nó: **trong một khe, món đắt hơn không được vẽ nhỏ hơn, và món đắt nhất phải
   to gấp đôi món rẻ nhất.** Có phép kiểm canh (xem test "trong mỗi khe, món đắt hơn không được
   vẽ nhỏ hơn"), nên nó không sống bằng trí nhớ. Trần còn lại là cái BỆ trong cửa hàng: 184×112,
   tức bậc co cuối cùng của `artFit`. */

/**
 * Vòng hào quang: một vành vàng RỖNG.
 *
 * 24×12 → 36×16 (lượt 20) → 44×20 (lượt 21). Bản đầu có đúng MỘT ô lỗ ở giữa mỗi bên, và một
 * cái lỗ 4px thì ở cỡ thật nó đóng lại: cái vòng đọc thành một thanh vàng bẹt, tức mất đúng cái
 * chiều đã đưa nó vào khe này (*"món đội đầu duy nhất KHÔNG chạm vào đầu"* — một vành rỗng).
 *
 * Cỡ lượt 21 cho cái lỗ 5×3 ô và cho vành một đường CONG thật: hai đầu thu vào một ô, giữa nở
 * ra ba. Đó là chỗ khác giữa một cái vòng nhìn nghiêng và một hình chữ nhật rỗng ruột — và ở
 * bản 36×16 thì nó vẫn là hình chữ nhật.
 *
 * Rộng 11 ô, gấp gần đôi trần 6 ô của khe đội đầu, và nó được phép: trần ấy áp cho vật ĐẬU LÊN
 * đầu (xem khối luật ở `HAT`), mà cái vòng này thì lơ lửng bên trên, không chạm vào đâu.
 */
const HALO = [
  '...ggggg...',
  '.gg.....gg.',
  'gg.......gg',
  '.gg.....gg.',
  '...ggggg...',
];

/**
 * Cây quất: tán tam giác, quả vàng rải trong tán, chậu chung khuôn với ba món cùng khe.
 *
 * 44×44 từ lượt 20, trước là 28×28. Cùng phép đo với hạc và hồ cá, và ở đây nó rơi vào cái
 * TÁN: một tam giác cần ít nhất năm bậc mới đọc ra là tam giác — bốn bậc thì mắt đọc nó thành
 * một cái nêm, và cái nêm là hình mà xương rồng cùng khe đã chiếm. Bản cũ có bốn bậc.
 *
 * Quả vẫn nằm TRONG tán chứ không treo ngoài mép: một ô vàng chạm mép tán đọc thành một chỗ
 * tán bị sứt, không đọc thành quả. Cỡ mới cho phép năm quả thay vì ba, và chúng rải so le —
 * xếp thành hàng thì chúng đọc thành dây đèn, thứ đã có ở khe treo cao.
 */
const KUMQUAT = [
  '....ggggg....',
  '...ggggggg...',
  '...gGgggGg...',
  '..ggggggggg..',
  '..ggggggggg..',
  '.gggGgggGggg.',
  '.ggggggggggg.',
  'ggggggggggggg',
  'ggGggggggggGg',
  '.ggggggggggg.',
  '.....bbb.....',
  '.....bbb.....',
  '..#########..',
  '...#######...',
];

/**
 * Hồ cá koi: vành đá bọc một mặt nước, hai con cá bơi ngược chiều nhau, một lá súng.
 *
 * ## 68×44 từ lượt 20, trước là 36×28
 *
 * Cùng lời của người dùng đã bắt vẽ lại con hạc, và ở đây phép đo còn rõ hơn: bản 9×7 dành
 * cho mỗi con cá đúng HAI ô. Hai ô thì không có chỗ cho một cái đuôi tách khỏi một cái thân,
 * nên cái đọc ra không phải hai con cá — nó là hai chấm hồng trong một vũng nước.
 *
 * ## Con cá phải THUÔN, không phải to
 *
 * Bản đầu của lượt 20 cho mỗi con một khối 3×3 với một đốm ở giữa. Mở trang ra thì nó không
 * đọc thành cá: một khối vuông đặc là một khối vuông, và cái đốm ở giữa đọc thành cái lỗ.
 * To hơn mà vẫn vuông thì chỉ là một lỗi to hơn.
 *
 * Bản này cho mỗi con 7×3 và ĐỘ THUÔN mới là thứ làm việc: thân năm ô ngang thóp lại còn ba ô
 * ở hàng trên và hàng dưới, tức một cái mũi nhọn ở đầu này; rồi một cái đuôi CHẺ HÌNH V ở đầu
 * kia — hai ô tách nhau một ô trống, đúng cái mẹo "một ô là nhiễu, hai ô so le mới là một vật"
 * mà file này đã dùng cho hai tia mừng, ba chữ z và hai dây khinh khí cầu.
 *
 * Hai con bơi NGƯỢC chiều nhau và lệch nhau một tầng nước. Cùng chiều thì chúng đọc thành một
 * cặp trang trí đối xứng; ngược chiều thì cái hồ có chuyện đang xảy ra trong đó.
 *
 * Đuôi mang sắc `rose`, thân `foam`, cộng một đốm `rose` giữa lưng — bộ màu của một con koi
 * kohaku thật, và nó cũng là thứ giữ cho con cá không tan vào mặt nước.
 *
 * Lá súng `leaf` nói đây là một cái HỒ chứ không phải một chậu nước. Nó nằm ở góc dưới-trái,
 * chéo với cả hai con cá — chồng lên nhau thì ba vật cùng nổi trên một nền xanh nước và cái
 * mắt phải tự tách chúng ra.
 *
 * Và nó vẫn là vật DUY NHẤT ở góc phải nằm ngang: 68 rộng trên 44 cao, trong khi hạc, chó,
 * mèo, nấm đều cao hơn rộng. Cỡ mới không xoá cái chiều phân biệt ấy, nó phóng to cái chiều ấy.
 */
const KOI = [
  '....sssssssss....',
  '..sswwwwwwwwwss..',
  '.swwwwwwwwwwwwws.',
  'swrwfffwwwwwwwwws',
  'swrrffrffwwwwwwws',
  'swrwfffwwwfffwrws',
  'swwwwwwwffrffrrws',
  'swLLLwwwwwfffwrws',
  '.sLLwwwwwwwwwwws.',
  '..sswwwwwwwwwss..',
  '....sssssssss....',
];

/**
 * Hồ koi khung B — hai con cá BƠI, vành đá và lá súng đứng yên.
 *
 * Đây là món duy nhất trong cả chợ mà cái động là lý do người ta mua nó: một cái hồ có nước
 * mà mặt nước không có gì xảy ra thì nó là một cái đĩa sứ. Nên nó cũng là món duy nhất hoán
 * khung 50/50 — hai khung đều là "đang bơi", cùng hạng, đúng ca mà nhịp đều là đúng (xem
 * khối luật ở `CAT_B`).
 *
 * Mỗi con dịch đúng MỘT ô, và dịch NGƯỢC chiều nhau — con trên sang phải, con dưới sang trái,
 * đúng theo hai hướng bơi mà lượt 20 đã dựng cho chúng. Cùng chiều thì mặt nước đọc thành cả
 * cái hồ đang trượt ngang. Một ô là 4px: đủ để thấy, chưa đủ để thành một cú nhảy.
 *
 * Ba thứ KHÔNG được dịch, và mỗi thứ vì một lý do khác nhau: vành đá `s` là cái khung của
 * chính bức hình, mặt nước `w` là nền, còn lá súng `L` thì neo vào đáy hồ — một cái lá súng
 * trôi ngang cùng con cá là thứ tố cáo rằng cả hai chỉ là một lớp ảnh bị đẩy đi.
 */
const KOI_B = [
  '....sssssssss....',
  '..sswwwwwwwwwss..',
  '.swwwwwwwwwwwwws.',
  'swwrwfffwwwwwwwws',
  'swwrrffrffwwwwwws',
  'swwrwfffwfffwrwws',
  'swwwwwwffrffrrwws',
  'swLLLwwwwfffwrwws',
  '.sLLwwwwwwwwwwws.',
  '..sswwwwwwwwwss..',
  '....sssssssss....',
];

/**
 * Khinh khí cầu: bầu sọc, hai dây, một cái giỏ.
 *
 * Hai dây là chi tiết quyết định — đèn lồng cùng khe cũng có tua thẳng dưới đáy, nhưng nó chỉ
 * có một, và một sợi thì đọc thành cái tua chứ không đọc thành dây treo.
 *
 * Chúng đứng ở HAI CỘT NGOÀI CÙNG, không đứng sát nhau. Bản đầu để `.s.s.` — hai dây cách nhau
 * một ô, ngay trên một cái giỏ ba ô cùng sắc — và mở trang ra thì cả năm ô ấy dính thành một
 * khối nâu: mất dây thì cái giỏ đọc thành một vật thứ hai rơi bên dưới bầu. Đẩy ra hai mép thì
 * giữa chúng có một KHOẢNG HỞ, và chính cái hở ấy là thứ nói "cái giỏ đang treo".
 */
const AIRSHIP = [
  '...ggggg...',
  '..grrrrrg..',
  '.grrgggrrg.',
  'grrgggggrrg',
  'grrgggggrrg',
  '.grrgggrrg.',
  '..grrrrrg..',
  '...ggggg...',
  '..s.....s..',
  '.bbbbbbbbb.',
  '.bbbbbbbbb.',
];

/** Vòm hoa hồng: một dải lá LIỀN dưới sợi kẻ, hoa rải trong lá rồi rủ thưa dần xuống. Bốn
 *  hàng, ít hơn tử đằng một hàng — nó rộng chứ không dài, và đó là toàn bộ chỗ khác nhau. */
const ROSES = [
  '##############################################',
  'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
  'rLLLLrLLLLrLLLLrLLLLrLLLLrLLLLrLLLLrLLLLrLLLLr',
  'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
  'LLLrLLLLrLLLLrLLLLrLLLLrLLLLrLLLLrLLLLrLLLLrLL',
  'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
  '..LL...LL...LL...LL...LL...LL...LL...LL...LL..',
  '..r....r....r....r....r....r....r....r....r...',
];

/**
 * Đường chân trời: bảy toà tháp cao thấp khác nhau, cửa sổ sáng đèn rải trong thân.
 *
 * Rộng 46 ô — món rộng nhất cả cửa hàng, đúng vai món đắt nhất cả cửa hàng. Bề rộng ấy ở đây
 * cần hơn mọi chỗ khác: thân quản gia rộng 16 ô đứng giữa đáy, nên phần ĐỌC ĐƯỢC của một món
 * nền trời là hai mảng ở hai rìa, và mảng càng rộng thì càng chở được nhiều toà.
 *
 * ## 104×36 từ lượt 20, trước là 104×24 — và cùng lượt ấy hai toà cao nhất dọn ra rìa
 *
 * Bản cũ ghi đúng cái luật ("toà cao nhất đứng lệch tâm — đặt nó vào giữa là đặt nó vào đúng
 * chỗ cái đầu che") rồi vẽ ngược lại nó: toà 4 ô cao nhất nằm ở cột 12–15 trên một lưới 26 ô,
 * tức đúng giữa, tức đúng sau lưng quản gia. Đo trên popover thật: nền trời trải x 111–215
 * còn quản gia chiếm x 131–195, nên phần thấy được là cột 0–4 và 21–25.
 *
 * Nên hai toà cao nhất giờ đứng ở đúng hai mảng ấy, và chín hàng thay vì sáu là để chúng có
 * chỗ mà cao: toà bên trái dùng trọn 9 hàng, toà bên phải 8. Bản cũ cao nhất 6 hàng trên tổng
 * 6 — tức không toà nào cao hơn toà nào quá hai hàng, và một đường chân trời mà mọi nóc đều
 * ngang nhau thì nó là một hàng rào.
 *
 * 36px cũng là mốc trần: `.slot-back` ngồi ở `bottom: 4px` trong bầu trời 148px, nên nóc toà
 * cao nhất rơi vào y=108, còn đỉnh đầu quản gia ở y=81. Cao thêm nữa thì hai toà rìa vẫn thấy
 * được nhưng năm toà giữa bắt đầu nhô lên sau gáy anh ta, và một cái nóc mọc ra từ đầu người
 * là thứ mắt bắt được trước cả bảy toà nhà.
 */
const SKYLINE = [
  'dddd..........................................',
  'dddd.................................ddddd....',
  'dgdd.................................ddddd....',
  'dddd.................................dgdgd....',
  'dgdd.............................ddd.ddddd....',
  'dddd.ddd.........................ddd.dgdgd....',
  'dgdd.ddd......ddd................dgd.ddddd.ddd',
  'dddd.dgd......ddd.......ddd......ddd.dgdgd.ddd',
  'dgdd.ddd.dddd.dgd.......ddd.dddd.dgd.ddddd.dgd',
  'dddd.dgd.dddd.ddd.ddddd.dgd.dddd.ddd.dgdgd.ddd',
  'dgdd.ddd.dgdd.dgd.ddddd.ddd.dgdd.dgd.ddddd.dgd',
  'dddd.dgd.dddd.ddd.dgdgd.dgd.dddd.ddd.dgdgd.ddd',
  'dgdd.ddd.dgdd.dgd.ddddd.ddd.dgdd.dgd.ddddd.dgd',
  'dddd.ddd.dddd.ddd.ddddd.ddd.dddd.ddd.ddddd.ddd',
];

/* ── Đồ nghề của mấy động tác miễn phí ────────────────────────────────────────

   Chúng KHÔNG phải hàng hoá và phải nằm ngoài `ART`: bài test parity bắt
   `Object.keys(ART)` khớp đúng `Object.keys(ITEMS)` bên server, cùng lý do đồng xu và mấy
   toà nhà cũng đứng ngoài. Nhưng chúng có bảng parity RIÊNG với `MOVE_IDS` — xem
   `test/pet.test.js`. Thêm một động tác vào `petmath.js` mà quên vẽ là một ô hàng trống
   trong công viên, đúng hạng lỗi mà bảng kia đang canh cho cửa hàng.

   Vì sao chúng cần hình, sau khi đã sống được mấy tuần chỉ với chữ: công viên giờ bày
   chúng thành Ô HÀNG đứng cạnh quán ăn — cùng cỡ ô, cùng chỗ đặt giá, cùng dòng "được bao
   nhiêu". Một ô hàng không có hình giữa một lưới ô có hình thì nó không đọc thành "món này
   khác", nó đọc thành "món này chưa làm xong". */

/** Cốc nước: thành cốc thuôn vào, nước lấp đầy phần trên. Không quai, không đế — cà phê
 *  bên quán ăn đã chiếm cả hai chi tiết ấy, mà hai thứ ở hai chỗ khác nhau thì càng phải
 *  khác nhau ở dáng chứ không chỉ ở màu. */
const WATER = ['#######', '#wwwww#', '#wwwww#', '.#www#.', '.#www#.', '..###..'];

/** Tạ tay: hai bánh tạ và một cái đòn. Bánh tạ phải thu lại ở hàng trên cùng và dưới cùng
 *  — một khối chữ nhật đặc hai đầu thì cả vật đọc thành cái xương, không đọc thành tạ. */
const DUMBBELL = ['#.......#', '##.....##', '##bbbbb##', '##.....##', '#.......#'];

/** Con mắt: viền hạnh nhân, tròng xanh, con ngươi tối ở giữa. Con ngươi là một ô, và nó
 *  là chi tiết duy nhất tách vật này khỏi một quả bóng bầu dục — nên nó không được bỏ dù
 *  ở cỡ 36px nó chỉ là 4 pixel. */
const EYE = ['..#####..', '.#fffff#.', '#ffsosff#', '.#fsosf#.', '..#####..'];

/** Chiếc giày nhìn ngang: mũi vát lên bên trái, ĐẾ tối chạy hết chiều dài. Cái đế mới là
 *  thứ nói "giày"; thiếu nó thì khối này là một ổ bánh mì nằm — mà bánh mì thì đang ở ô
 *  ngay bên cạnh trong quán ăn. */
const SHOE = ['....####.', '..######.', '.#######.', '#########', 'ooooooooo'];

/** Mặt trời có TIA, lõi sáng. Nó là vật duy nhất trong bộ này không cầm được — đúng thế,
 *  vì động tác của nó cũng là động tác duy nhất không làm bằng tay. Tia bốn hướng chính
 *  cộng bốn hướng chéo, vì mặt trời không tia ở cỡ 36px thì nó là một đồng xu vàng. */
const SUNNY = [
  '....#....',
  '.#..#..#.',
  '..#####..',
  '.#ggggg#.',
  '##ggggg##',
  '.#ggggg#.',
  '..#####..',
  '.#..#..#.',
  '....#....',
];

/** Hình của mỗi động tác — khoá TRÙNG `MOVE_IDS` trong `petmath.js`. */
export const MOVE_ART = {
  // Cốc nước là món DUY NHẤT trong bảng này có ruột — bốn món kia là đồ nghề, không phải
  // thứ dùng hết được. Một cái tạ cạn dần thì không có nghĩa gì cả; nhưng nó vẫn vơi theo
  // kiểu cầm tay, và ở đấy cái vơi chở đúng một tin: còn bao lâu nữa thì xong.
  water: { rows: WATER, chars: { w: 'sky' }, fill: 'w' },
  stretch: { rows: DUMBBELL, chars: { '#': 'ink', b: 'broth' } },
  eyes: { rows: EYE, chars: { '#': 'ink', f: 'foam', s: 'sky', o: 'ink' } },
  walk: { rows: SHOE, chars: { '#': 'broth', o: 'ink' } },
  sun: { rows: SUNNY, chars: { '#': 'gold', g: 'foam' } },
};

/* ── Đồng xu ──────────────────────────────────────────────────────────────── */

/**
 * Đồng tiền LỖ VUÔNG — và nó cố ý KHÔNG nằm trong `ART`.
 *
 * `test/pet.test.js` bắt `Object.keys(ART)` phải khớp đúng `Object.keys(ITEMS)` ở server:
 * hai bảng lệch mã là một ô trống trong cửa hàng hoặc một món không mua nổi. Đồng xu
 * không phải hàng hoá, nó là cái ĐƠN VỊ — nhét nó vào `ART` là phá bài test đang giữ hai
 * bảng kia dính nhau, đổi lấy đúng ba dòng dùng chung.
 *
 * Vì sao lỗ vuông chứ không phải một khối tròn vàng trơn: ở cỡ 24px một khối tròn vàng
 * đọc thành cái chấm, hoặc tệ hơn là thành MẶT TRỜI THỨ HAI — mà mặt trời thì đang đứng
 * cách nó chừng 60px trong cùng một khung. Cái lỗ vuông là chi tiết duy nhất ở cỡ này
 * nói ngay "tiền", và nó cũng là đồng tiền cổ của đúng cái mâm cơm bên cạnh.
 *
 * Sắc chấm bằng TAY (`h` hứng nắng trên-trái, `d` cạnh khuất dưới-phải) chứ không nhờ
 * `shadeOf`: đây là một cái vòng, mà phép chấm bóng giả định khối đặc — thả nó vào đây
 * thì cả vòng thành viền sáng, cùng ca đã ghi ở `itemArt`.
 */
const COIN = ['.hggg.', 'hhgggg', 'gg..gg', 'gg..gg', 'ggggdd', '.gggd.'];
/**
 * `hi`/`lo` là hai sắc RIÊNG của đồng xu, không mượn `foam`/`broth` của bàn ăn.
 *
 * Đã thử mượn: `foam` là kem gần trắng (#fff6e0), và trên thẻ Ví nền trắng của theme
 * sáng thì cả mảng hứng nắng biến mất — đồng xu đọc thành một cái vòng bị sứt góc
 * trên-trái. Sắc bevel phải là vàng nhạt, không phải trắng ngà.
 */
const COIN_CHARS = { g: 'gold', h: 'hi', d: 'lo' };

/**
 * Vẽ đồng xu.
 *
 * `aria-hidden` vì chỗ nào gọi nó cũng có chữ "1002 xu" ngay bên cạnh — thêm một cái
 * nhãn nữa chỉ làm trình đọc màn hình đọc con số hai lần.
 *
 * Kích thước khai từ chính cái lưới, cùng lý do đã ghi ở `itemArt`: chép tay vào CSS là
 * dựng bản thứ hai của một con số, và lần sửa sprite sau là hai bản lệch nhau.
 */
export function coinArt() {
  return html`<span class="pet-art art-coin" aria-hidden="true"
    style="width:${COIN[0].length * 4}px;height:${COIN.length * 4}px"
    >${pixels(COIN, COIN_CHARS, false)}</span
  >`;
}

/**
 * Bảng hình — khoá TRÙNG mã món trong `src/pet.js`.
 *
 * Hai bảng ở hai bên (giá ở server, hình ở đây) và chúng phải khớp mã. Không gộp được:
 * server không có quyền quyết định hình, còn trình duyệt thì không được quyết định giá
 * (xem khối chú thích của `ITEMS`). Cái nối chúng là bài test parity ở `test/pet.test.js`
 * — nó bắt đúng ca thêm món ở một bên mà quên bên kia.
 */
/**
 * `fill` — mấy ký tự làm nên phần RUỘT, tức phần vơi đi khi món ấy đang được dùng.
 *
 * Có `fill` là có vỏ, và có vỏ thì cái vơi là mực nước tụt xuống chứ không phải cả vật
 * ngắn lại — xem `drawArt`. Bốn món uống và bát phở khai nó; bốn món cầm tay thì không.
 *
 * Hơi nước tính là ruột chứ không tính là vỏ, và điều đó có lý ở cả hai đầu: nó tan ngay
 * từ ngụm đầu (đúng), và nó không nằm lại lơ lửng trên một cái cốc đã cạn suốt phần còn
 * lại của quãng (đúng hơn nữa — một cái cốc rỗng vẫn bốc khói là một cảnh sai).
 */
/* ── Bậc THỨ TƯ: sáu món nữa, mỗi khe một món ────────────────────────────────

   Người dùng, lượt 22: *"Thêm xa xỉ phẩm nữa trong shop đi"*.

   Tầng thứ tư, và nó theo đúng hai luật đã có sẵn — không luật mới nào:

   1. **Giá** đắt hơn món đắt nhất cùng khe **59–65%**, cùng dải mà tầng CAO (lượt 16) và tầng
      XA XỈ (lượt 19) đã dùng. Dải ấy là điều kiện để "đắt hơn" còn nghĩa gì: dưới nó thì món
      mới chỉ chen vào giữa hai món cũ, trên nó thì nó không còn nối tiếp cái thang nào cả.
   2. **Cỡ** to hơn món đắt nhất cùng khe, theo luật lượt 21 — và luật ấy có phép kiểm canh
      (xem test *"trong mỗi khe, món đắt hơn không được vẽ nhỏ hơn"*), nên nó không sống bằng
      trí nhớ như hai tầng trước.

   Trần mới là **1420 xu**, tức 1420 giờ no. Ở mức thu nhập đo được trên máy này ($50–120 một
   ngày) đó là chừng ba tháng — dài hơn trần cũ (880 xu, chừng tám tuần) đúng một nửa. Vẫn là
   chủ ý cũ: đồ trang trí không mua thứ gì đo được, nên thứ duy nhất chúng có thể là — cái đích
   dài hạn. Một cái đích với tới trong hai tuần thì hai tuần sau nó lại trống.

   ## Luật chọn hình: mỗi khe đã có năm đường bao, nên món thứ sáu phải khác ở một CHIỀU

   - **Mũ cánh chuồn** là món đội đầu duy nhất có cái gì CHÌA NGANG ra khỏi thân nó. Mũ len là
     vòm, nón chóp là ống, vương miện là mấy chóp nhọn, vòng hoa là một vành, hào quang là một
     vành rỗng — năm khối gọn, không cái nào mọc ra hai bên.
   - **Khóm trúc** là cây duy nhất mọc THẲNG ĐỨNG. Xương rồng có tay, chậu cây xoè, bonsai bẹt,
     anh đào tròn, cây quất hình nón — cả năm đều rộng hơn hoặc bằng chiều cao.
   - **Cổng torii** là vật duy nhất ở góc phải có LỖ THỦNG. Nấm, chó, mèo, hạc, hồ cá đều là
     khối đặc; nhìn xuyên qua được là một chiều chưa ai chiếm.
   - **Chuông gió** là món bay duy nhất dựng bằng NÉT DỌC. Bóng bay tròn, diều thoi, đèn lồng
     hộp, pháo hoa toả tia, khinh khí cầu có giỏ — cả năm đều là khối.
   - **Mái hiên sọc** là món treo cao duy nhất CỨNG. Dây cờ, dây đèn, tử đằng, vòm hồng đều
     rủ xuống theo trọng lực; một mái hiên thì chống lại nó, và cái riềm lượn sóng ở đáy là
     đường cong duy nhất của khe.
   - **Đỉnh núi tuyết** là món nền trời duy nhất có MỘT đỉnh thống trị. Dãy đồi có ba rặng
     thấp, cầu vồng là vành cung, cực quang là dải nghiêng, đường chân trời là bảy toà đều
     nhau — không món nào có một khối cao vượt hẳn phần còn lại.

   ## Chỗ đứng: hai cái trần cũ đã kiểm lại, một cái nới ra

   Khe LƠ LỬNG ghi trần 44px chiều cao ở lượt 21, và con số ấy đo theo đám mây kết ở y=26. Đo
   lại thì đám mây nằm ở x 272–308 còn món bay ở x 58–110 — chúng không bao giờ gặp nhau, nên
   cái trần thật là mép trên bầu trời chứ không phải đám mây. Chuông gió cao 52px: đáy ở y=74,
   đỉnh ở y=22, nhịp nổi nhấc lên còn y=17. Xem `.slot-air` trong `styles.css`.
*/

/**
 * Mũ cánh chuồn: chỏm vàng, HAI CÁNH chìa ngang hai bên, vành sẫm ở đáy.
 *
 * Bản đầu của lượt 22 là một cái mũ phi hành gia — vòm trắng với dải kính sẫm — và mở trang ra
 * thì nó không đọc thành mũ: rộng 48 cao 24 với một dải tối vắt ngang giữa, nó là một cái đĩa
 * bay. Chỗ hỏng là tỉ lệ, không phải màu; một vật đội đầu mà rộng gấp đôi chiều cao thì mắt
 * đọc nó thành vật NẰM chứ không thành vật ĐỘI.
 *
 * Cánh chuồn giải cả hai đầu. Nó cao 28 trên rộng 48 nên khối chính gần vuông, và hai cánh
 * chìa ngang là một chiều mà cả khe chưa ai chiếm — mũ len là vòm, nón chóp là ống, vương miện
 * là mấy chóp nhọn, vòng hoa là vành, hào quang là vành rỗng. Không món nào có cái gì CHÌA RA.
 *
 * Hai cánh lấy `rose` chứ không `gold`: cùng sắc với chỏm thì cả hàng thành một thanh ngang
 * đặc, và cái làm nên đôi cánh là chỗ chúng KHÁC phần giữa, không phải chỗ chúng dài ra.
 */
const HELM = [
  '....gggg....',
  '...gggggg...',
  '..gggggggg..',
  'rrrggggggrrr',
  '..gggggggg..',
  '..gggggggg..',
  '...oooooo...',
];

/** Khóm trúc: ba thân cao thấp khác nhau, đốt màu mộc, lá chìa so le. Ba thân chứ không một —
 *  một thân trúc đơn độc ở 4px là một cái cột, và cái làm nó thành khóm là mấy đốt lệch nhau. */
const BAMBOO = [
  '......ggg......',
  '......ggg......',
  '....ggggg......',
  '......bbbggg...',
  '.gg...ggg......',
  '.gg...ggg......',
  '.gggggbbb...gg.',
  '.bb...ggg...gg.',
  '.gg...ggggg.ggg',
  '.gg...bbb...bb.',
  '.bbgg.ggg...gg.',
  '.gg...ggg...gg.',
  '.gg...bbb.ggbb.',
  '.bb...ggg...gg.',
  '..###########..',
  '...#########...',
];

/** Cổng torii: xà trên TRÀN ra hai đầu, xà dưới thu vào, hai chân đá sẫm. Cái tràn ấy là chỗ
 *  duy nhất tách nó khỏi một khung cửa — thiếu nó thì nó đọc thành chữ H. */
const TORII = [
  'rrrrrrrrrrrrrrrrrrr',
  '.rrrrrrrrrrrrrrrrr.',
  '...rr.........rr...',
  '...rr.........rr...',
  '..rrrrrrrrrrrrrrr..',
  '...rr.........rr...',
  '...rr...rrr...rr...',
  '...rr...rrr...rr...',
  '...rr.........rr...',
  '...rr.........rr...',
  '...rr.........rr...',
  '...rr.........rr...',
  '..oooo.......oooo..',
  '..oooo.......oooo..',
];

/** Chuông gió: đĩa nóc, sáu thanh dài ngắn khác nhau, một tấm giấy treo dưới. Sáu thanh KHÁC
 *  chiều dài chứ không đều — đều nhau thì cả cụm đọc thành một cái lược. */
const CHIME = [
  '......g......',
  '......g......',
  '..ggggggggg..',
  '..ggggggggg..',
  '..g.g.g.g.g..',
  '..g.g.g.g.g..',
  '..g.g.g.g.g..',
  '..g.g.g.g.g..',
  '....g.g.g....',
  '....g.g.g....',
  '......g......',
  '....fffff....',
  '....fffff....',
  '....fffff....',
];

/** Mái hiên sọc: sọc dọc vàng-hồng, mép trên thu vào hai bậc, riềm dưới lượn sóng. */
const AWNING = [
  'ffffffffffffffffffffffffffffffffffffffffffffff',
  '..arrraaarrraaarrraaarrraaarrraaarrraaarrraa..',
  '.aarrraaarrraaarrraaarrraaarrraaarrraaarrraaa.',
  'aaarrraaarrraaarrraaarrraaarrraaarrraaarrraaar',
  'aaarrraaarrraaarrraaarrraaarrraaarrraaarrraaar',
  'aaarrraaarrraaarrraaarrraaarrraaarrraaarrraaar',
  'aaarrraaarrraaarrraaarrraaarrraaarrraaarrraaar',
  '.aarr..aarr..aarr..aarr..aarr..aarr..aarr..aar',
  '..ar....ar....ar....ar....ar....ar....ar....ar',
];

/** Đỉnh núi tuyết: một đỉnh chính lệch trái, một đỉnh phụ thấp hơn bên phải, cả hai đội tuyết.
 *  Hai đỉnh đều tránh cột giữa — đó là chỗ tấm thân 64px của quản gia che, cùng phép đo đã dời
 *  hai toà cao nhất của đường chân trời ra hai rìa ở lượt 20. */
const PEAK = [
  '............f.................................',
  '...........fff................................',
  '..........fffff...............................',
  '.........fffffff..............................',
  '........ddddddddd.............................',
  '.......ddddddddddd............................',
  '......ddddddddddddd................f..........',
  '.....ddddddddddddddd..............fff.........',
  '....ddddddddddddddddd............fffff........',
  '...ddddddddddddddddddd..........fffffff.......',
  '.ddddddddddddddddddddddd.......ddddddddd......',
  'ddddddddddddddddddddddddd.....ddddddddddd.....',
  'dddddddddddddddddddddddddd...ddddddddddddd....',
  'ddddddddddddddddddddddddddd.ddddddddddddddd...',
  'dddddddddddddddddddddddddddddddddddddddddddd..',
  'ddddddddddddddddddddddddddddddddddddddddddddd.',
];

/**
 * ## `life` — nhịp sống của một món, khai ngay cạnh cái hình nó tả
 *
 * Người dùng, lượt 23: *"Nói tóm lại cho các đồ vật trang trí có sinh khí một chút"*.
 *
 * Cách dễ nhất là gắn một nhịp lắc chung cho mọi `.pet-slot` trong CSS, và nó sai ở đúng chỗ
 * làm nó dễ: cái cây với cái cổng đá sẽ lắc cùng biên độ. Một cái cổng torii đung đưa thì nó
 * không "có sinh khí", nó là một cái cổng sắp đổ. Nhịp phải tới từ VẬT — nên nó khai ở đây,
 * cạnh cái hình, chứ không ở CSS, nơi chỉ còn biết `.slot-right` chứ không biết trong đó là
 * con mèo hay cái cổng.
 *
 * Bảy nhịp, và mỗi nhịp là một câu trả lời cho "vật này động vì cái gì":
 *
 *     sway     cây cối        — GIÓ thổi, nên nghiêng, gốc đứng yên
 *     swing    vật TREO       — trọng lực, nên đưa võng quanh chỗ buộc ở ĐỈNH
 *     drift    vật BAY        — không khí đỡ, nên trôi lên xuống, không nghiêng
 *     wave     dây vắt ngang  — hai đầu buộc chặt, nên chỉ võng xuống rồi lên
 *     glow     vật PHÁT SÁNG  — không động, mà sáng tối theo nhịp
 *     breathe  vật SỐNG mà không có bộ phận nào cử động được ở cỡ này
 *     (hai khung) con vật     — xem `CAT_B`; nhịp riêng: blink / peck / swim
 *
 * `null` là một câu trả lời hợp lệ và có SÁU món dùng nó: cái nón, cái mũ, cổng đá, mái hiên,
 * dãy đồi, đỉnh núi. Chúng đứng yên vì chúng vốn đứng yên, và một bảng mà mọi dòng đều có
 * nhịp là một bảng chưa ai đọc lại. Khai `null` tường minh chứ không bỏ trống: bỏ trống thì
 * không phân biệt được "đã cân nhắc và quyết là đứng yên" với "quên mất món này".
 *
 * ## Trần biên độ: 2 độ và 3px
 *
 * Đây là một popover trạng thái, mở ba giây để liếc một con số. Cái gì động mạnh hơn cái đó
 * thì nó không còn là sinh khí — nó là thứ mắt không rời ra được, và nó cướp chỗ của đúng cái
 * con số người ta mở popover ra để xem. Chu kỳ vì thế đều từ 3,4 giây trở lên, không món nào
 * dưới đó.
 */
export const ART = {
  coffee: { rows: COFFEE, chars: { o: 'ink', s: 'steam' }, fill: 'os' },
  socola: { rows: SOCOLA, chars: { o: 'ink', b: 'broth', f: 'foam' } },
  tea: { rows: TEA, chars: { g: 'leaf', s: 'steam' }, fill: 'gs' },
  kem: { rows: KEM, chars: { p: 'plum', b: 'broth' } },
  che: { rows: CHE, chars: { p: 'plum', g: 'leaf' }, fill: 'pg' },
  beer: { rows: BEER, chars: { o: 'gold', f: 'foam' }, fill: 'of' },
  banhmi: { rows: BANHMI, chars: { o: 'ink' } },
  xoi: { rows: XOI, chars: { f: 'foam', g: 'leaf' } },
  // Bát phở đi cùng đường với mấy cái cốc dù nó là món ĂN: sợi phở trước, nước dùng sau,
  // và cái bát còn lại. Đó đúng là thứ tự người ta ăn một bát phở.
  pho: { rows: PHO, chars: { o: 'broth', n: 'foam', s: 'steam' }, fill: 'ons' },

  // Năm món ĐỘI ĐẦU không khai nhịp, và đó không phải là chúng đứng yên: khe này nằm TRONG
  // `.mb-sprite`, nên chúng đã thở theo lồng ngực quản gia sẵn rồi (`mb-breathe`). Thêm một
  // nhịp thứ hai lên trên là hai chu kỳ lệch nhau chồng lên nhau — cái nón sẽ trôi khỏi đầu
  // rồi bắt lại, mỗi vòng một kiểu.
  beanie: { rows: BEANIE, chars: { p: 'plum', f: 'foam' }, life: null },
  hat: { rows: HAT, chars: { b: 'gold' }, life: null },
  crown: { rows: CROWN, chars: { g: 'gold', p: 'plum' }, life: null },
  wreath: { rows: WREATH, chars: { r: 'rose', L: 'leaf' }, life: null },
  // Ngoại lệ DUY NHẤT của khe đội đầu, và nó là ngoại lệ vì cái hình: vòng hào quang không
  // ĐẬU lên đầu, nó lơ lửng bên trên. Một vật lơ lửng mà đứng chết cứng so với cái đầu bên
  // dưới thì nó đọc thành một cái vòng bị hàn vào tóc.
  halo: { rows: HALO, chars: { g: 'gold' }, life: 'shimmer' },
  helm: { rows: HELM, chars: { g: 'gold', r: 'rose', o: 'ink' }, life: null },

  // Cả sáu món khe TRÁI đều là cây, nên cả sáu cùng một nhịp — chỗ khác nhau nằm ở chu kỳ,
  // và chu kỳ suy từ chính cái hình: cây càng cao thì càng đưa chậm. Xem `.life-sway`.
  cactus: { rows: CACTUS, chars: { g: 'leaf' }, life: 'sway' },
  plant: { rows: PLANT, chars: { g: 'leaf' }, life: 'sway' },
  bonsai: { rows: BONSAI, chars: { g: 'leaf', b: 'broth' }, life: 'sway' },
  sakura: { rows: SAKURA, chars: { r: 'rose', b: 'broth' }, life: 'sway' },
  kumquat: { rows: KUMQUAT, chars: { g: 'leaf', G: 'gold', b: 'broth' }, life: 'sway' },
  bamboo: { rows: BAMBOO, chars: { g: 'leaf', b: 'broth' }, life: 'sway' },

  // Cây nấm là vật SỐNG, nhưng ở cỡ 36px nó không có bộ phận nào cử động được — không mắt,
  // không tai, không cổ. Nên nó thở: phình lên xẹp xuống theo chiều dọc, gốc đứng yên. Đó
  // cũng là ranh giới giữa `breathe` và `sway`: cái nấm không nghiêng vì cái chân nó mập và
  // ngắn, còn cái cây thì nghiêng vì cái thân nó mảnh và cao.
  mushroom: { rows: MUSHROOM, chars: { r: 'rose', f: 'foam' }, life: 'breathe' },
  dog: { rows: DOG, alt: DOG_B, chars: { b: 'broth', o: 'ink' }, life: 'blink' },
  cat: { rows: CAT, alt: CAT_B, chars: { o: 'gold' }, life: 'blink' },
  crane: { rows: CRANE, alt: CRANE_B, chars: { f: 'foam', r: 'rose', o: 'ink' }, life: 'peck' },
  // Vành đá lấy `dim` chứ không để `#` trơn như chậu cây: `#` không tên rơi về sắc kem của bát
  // đĩa, mà một cái vành kem bọc một mặt nước lam thì đọc thành cái bát đựng nước.
  // Con cá lấy `rose` chứ không `gold`: bản đầu dùng vàng, và mở trang ra thì hai con cá lẫn
  // hẳn vào vành đá — `gold` (#f0b429) với `dim` (#bd9d75) là hai sắc ấm cùng độ sáng, mà cả
  // hai lại ở cạnh nhau. Hồng thì lệch hẳn tông so với cả vành lẫn nước, và cá koi vốn đỏ cam.
  koipond: { rows: KOI, alt: KOI_B, chars: { s: 'dim', w: 'sky', r: 'rose', f: 'foam', L: 'leaf' }, life: 'swim' },
  // Chân đá lấy `ink` chứ không `dim`: cái cổng đã đỏ toàn thân, mà `dim` là nâu nhạt —
  // hai sắc ấm cạnh nhau thì chỗ nối cột-với-chân biến mất và cả vật đọc thành một khối đỏ.
  // Cổng đá đứng YÊN, và nó là món đắt nhất khe — nên đây là chỗ luật "nhịp tới từ vật" trả
  // giá đắt nhất và vẫn đúng: 1180 xu mà không động đậy gì. Một cái cổng torii lắc lư là một
  // cái cổng sắp đổ, và bức tranh sẽ nói ra một câu không ai muốn nghe.
  torii: { rows: TORII, chars: { r: 'rose', o: 'ink' }, life: null },

  balloon: { rows: BALLOON, chars: { p: 'plum', s: 'steam' }, life: 'drift' },
  // Đuôi diều lấy `foam` chứ không lấy `steam` như dây bóng bay: `steam` là trắng 45% và
  // ba ô rời rạc ở độ mờ ấy thì biến mất trên nền trời đêm — mà cái đuôi so le mới là thứ
  // nói đây là con diều chứ không phải một viên kim cương.
  // Diều ĐƯA VÕNG chứ không trôi: nó là vật bay duy nhất ở khe này có một sợi dây nối xuống
  // đất, và một sợi dây thì biến chuyển động thành một cung tròn quanh chỗ buộc.
  kite: { rows: KITE, chars: { k: 'sky', s: 'foam' }, life: 'swing' },
  lantern: { rows: LANTERN, chars: { r: 'rose', g: 'gold' }, life: 'swing' },
  // Pháo hoa `glow` chứ không `swing`: nó không phải một vật treo, nó là một vụ nổ đang xảy
  // ra. Thứ động của một vụ nổ là ĐỘ SÁNG, không phải chỗ đứng.
  firework: { rows: FIREWORK, chars: { g: 'gold', r: 'rose', p: 'plum' }, life: 'shimmer' },
  // Dây treo lấy `ink`, giỏ lấy `broth`: hai sắc, vì một sợi dây mảnh và một cái hộp đặc mà
  // cùng sắc thì ở 20px chúng dính thành một khối. Bản đầu dùng `steam` (trắng 45%) như dây
  // bóng bay và hai ô ấy biến mất hẳn trên nền trời đêm.
  airship: { rows: AIRSHIP, chars: { g: 'gold', r: 'rose', s: 'ink', b: 'broth' }, life: 'drift' },
  // Chuông GIÓ — món duy nhất trong cả chợ mà cái tên đã hứa một chuyển động. Đứng yên thì nó
  // không phải "một món chưa được làm cho sinh động", nó là một cái tên nói dối.
  chime: { rows: CHIME, chars: { g: 'gold', f: 'foam' }, life: 'swing' },

  // Khe TREO CAO: dây buộc CẢ HAI đầu, nên chúng không đưa võng như đèn lồng — chúng võng
  // xuống rồi nâng lên. `swing` ở đây là sai về vật lý và nhìn ra ngay: một sợi dây 184px
  // xoay quanh tâm thì hai đầu rời khỏi hai chỗ buộc.
  bunting: { rows: BUNTING, chars: { a: 'gold', b: 'leaf', c: 'plum' }, life: 'wave' },
  // Dây đèn `glow`, không `wave`: nó cùng chỗ treo với dây cờ nhưng thứ nó bán là ÁNH SÁNG.
  // Và cái nháy chỉ chạm mấy bóng đèn chứ không chạm sợi dây — xem `.life-glow .px.gold`.
  lights: { rows: LIGHTS, chars: { g: 'gold', p: 'rose' }, life: 'glow' },
  wisteria: { rows: WISTERIA, chars: { L: 'leaf', p: 'plum' }, life: 'wave' },
  roses: { rows: ROSES, chars: { L: 'leaf', r: 'rose' }, life: 'wave' },
  // Mái hiên là tấm CỨNG, không phải dây — nó căng trên khung. Cùng chỗ treo với bốn món
  // kia mà đứng yên, và đó chính là thứ 900 xu mua được: sự chắc chắn.
  awning: { rows: AWNING, chars: { a: 'gold', r: 'rose', f: 'foam' }, life: null },

  hills: { rows: HILLS, chars: { g: 'leaf' }, life: null },
  rainbow: { rows: RAINBOW, chars: { a: 'gold', b: 'leaf', c: 'plum' }, life: 'shimmer' },
  // `sky` chứ không `deep` cho dải giữa: cả ba dải phải đọc được trên CẢ nền trời ngày lẫn
  // nền trời đêm, mà `deep` là lam tối — trên trời đêm nó biến mất, và một món 520 xu biến
  // mất sau 18h là đúng cái lỗi đã ghi cho dãy đồi.
  aurora: { rows: AURORA, chars: { L: 'leaf', c: 'sky', p: 'plum' }, life: 'shimmer' },
  // Thân tháp lấy `deep` (lam #2f6ca8), không lấy `ink` và cũng không lấy `dim`.
  // `ink` là nâu gần đen: một khối đen tuyền trên trời đêm là một mảng thủng. `dim` là nâu
  // NHẠT, và bản đầu dùng nó — mở trang ra thì cả dãy tháp đọc thành một biểu đồ cột màu cát,
  // vì cửa sổ `gold` (#f0b429) và thân `dim` (#bd9d75) chênh nhau quá ít để mắt tách ra được.
  // `deep` giải cả hai đầu: nó sáng hơn hẳn trời đêm (#101736) nên khối vẫn nổi, mà tối hơn
  // hẳn trời ngày (#5d97cd) nên đường bao vẫn rõ — và nó lệch tông so với `gold`, nên mấy ô
  // cửa sổ mới đọc ra là cửa sổ. Cùng phép chọn đã dựng ba dải cực quang.
  // Đường chân trời `glow` vì cái ĐỘNG của nó cũng chỉ chạm mấy ô `gold`: đó là cửa sổ có
  // người thức. Thân tháp `deep` đứng im — một dãy nhà mà cả khối cùng sáng lên tối đi thì
  // đọc thành đèn sân khấu, không đọc thành thành phố về đêm.
  skyline: { rows: SKYLINE, chars: { d: 'deep', g: 'gold' }, life: 'glow' },
  // Thân núi lấy `deep` như đường chân trời, và vì đúng cái lý lẽ đã ghi ở đó: nó sáng hơn
  // trời đêm nên khối vẫn nổi, tối hơn trời ngày nên đường bao vẫn rõ. Tuyết lấy `foam`.
  peak: { rows: PEAK, chars: { d: 'deep', f: 'foam' }, life: null },
};


/**
 * Vẽ một món.
 *
 * `shaded: false` cho mọi món — phép chấm sắc độ `shadeOf` giả định nguồn sáng trên-trái
 * và một khối ĐẶC. Mấy món này phần lớn là viền rỗng (cái ly, cái bát, vòng cầu vồng),
 * nên chấm bóng lên chúng ra một mớ lốm đốm chứ không ra khối.
 */
/**
 * Vẽ một vật, và (tuỳ chọn) cho nó VƠI DẦN trong lúc đang được dùng.
 *
 * ## Vơi bằng CSS chứ không bằng cách vẽ lại
 *
 * `eat` là `{ ms, leftMs }` của việc đang làm. Chỗ này KHÔNG cắt bớt hàng pixel theo phần
 * trăm rồi vẽ lại: làm thế thì cái hình chỉ vơi mỗi lần cả màn hình được dựng lại, mà nhịp
 * ấy là 30 giây — trên một món ăn hết trong 60 giây thì nó vơi đúng hai lần, tức là nó
 * không vơi, nó nhảy.
 *
 * Nên cái vơi là một hoạt hình CSS, còn chỗ này chỉ khai mấy con số cho nó. `--eat-lag`
 * ÂM là toàn bộ mẹo: mỗi lượt vẽ lại dựng một thẻ mới và hoạt hình trên thẻ mới luôn bắt
 * đầu từ 0, nên phải nói cho nó biết nó đã chạy được bao lâu rồi. Thiếu dòng ấy thì mỗi
 * nhịp đếm ngược (1 giây) là bát phở lại đầy lại như mới. Nó đi qua một BIẾN chứ không qua
 * `animation-delay` thẳng, vì lớp ruột nằm trong một thẻ con — mà biến CSS thì di truyền
 * xuống, còn `animation-delay` thì không.
 *
 * ## Hai kiểu vơi, và cái quyết định là HÌNH VẼ chứ không phải loại món
 *
 * Vật nào khai `fill` thì nó có một cái RUỘT đựng trong một cái VỎ — cốc cà phê, ly chè,
 * bát phở, cốc nước. Ở mấy vật ấy cái vơi là mực nước tụt xuống, còn cái vỏ đứng nguyên
 * tới lúc xong mới tan. Đó là điều mắt trông đợi ở một cái cốc; một cái cốc bị gặm mất dần
 * từ miệng xuống thì đọc thành lỗi render chứ không đọc thành đang uống.
 *
 * Vật không khai `fill` thì nó nằm trên tay — thanh sô-cô-la, ổ bánh mì, nắm xôi, que kem
 * — và ở đấy cái đúng lại là cả vật ngắn dần đi. Luật vì thế treo vào CÁCH VẼ chứ không
 * treo vào chuyện món ấy là đồ ăn hay đồ uống: câu hỏi là "hình này có vẽ ra một cái vỏ
 * không". Bát phở vì thế đi cùng đường với cốc cà phê dù nó là món ăn — cái bát vẫn là
 * một cái bát, và ăn xong thì còn lại cái bát.
 *
 * Số bậc bằng đúng số HÀNG đang vơi, gửi sang bằng `--eat-step`. Trước là `steps(8)` cứng
 * cho mọi món, và trên một cái ruột cao bốn hàng thì tám bậc là hai bậc cho một hàng pixel
 * — tức nửa hàng, thứ không tồn tại trên lưới này, nên một nửa số bậc không đổi gì cả.
 * Bằng số hàng thì mỗi bậc gạt đi đúng một ô.
 */
/**
 * Tách một sprite làm hai lớp: cái VỎ và cái RUỘT.
 *
 * Trả kèm chỗ đứng của ruột (`top`, đếm bằng hàng) vì lớp ruột được cắt rời khỏi lưới
 * chung. Để nó nằm trong một khung cao bằng cả sprite thì `clip-path` đo phần trăm trên
 * khung ấy, và một cốc nước chỉ chiếm bốn hàng giữa sẽ đứng yên suốt nửa đầu quãng uống
 * rồi mới cạn vụt trong nửa sau. Khung ôm sát ruột thì mỗi phần trăm của hoạt hình là một
 * phần trăm của đúng cái mực nước ấy.
 */
function split(rows, fill) {
  const has = (c) => fill.includes(c);
  const shell = rows.map((r) => [...r].map((c) => (has(c) ? '.' : c)).join(''));
  const inner = rows.map((r) => [...r].map((c) => (has(c) ? c : '.')).join(''));
  const lit = inner.map((r, i) => ([...r].some((c) => c !== '.') ? i : -1)).filter((i) => i >= 0);
  const top = lit[0] ?? 0;
  return { shell, inner: inner.slice(top, (lit[lit.length - 1] ?? -1) + 1), top };
}

function drawArt(a, cls, eat) {
  if (!a) return '';
  // Kích thước khai từ CHÍNH cái lưới, không chép tay vào CSS. Mấy ô pixel đều nằm tuyệt
  // đối nên thẻ bọc không có bề rộng tự nhiên nào; thiếu con số này thì nó rộng 0 và mọi
  // phép căn giữa — ô hàng trong cửa hàng, `translateX(-50%)` của mấy chỗ đứng trong khung
  // trời — đều căn vào hư không. Sửa một dòng sprite là kích thước tự đi theo, còn bản
  // chép tay thì lần sửa thứ hai đã lệch (cùng lý lẽ với `shadeOf`).
  const w = Math.max(...a.rows.map((r) => r.length)) * 4;
  const box = `width:${w}px;height:${a.rows.length * 4}px`;
  // Nhịp sống — xem khối luật ở đầu bảng `ART`. Chỉ một cái tên lớp đi qua ranh giới sang
  // CSS; biên độ, chu kỳ và chỗ xoay thì sống bên ấy, vì cả ba là chuyện của cái nhìn chứ
  // không phải chuyện của cái hình.
  const life = a.life ? ` life-${a.life}` : '';
  if (!eat) {
    // Con vật có khung THỨ HAI — xem `CAT_B`. Hai lớp chồng khít, hoán opacity cho nhau; đó
    // là đúng cơ chế đã dựng nhịp đi của quản gia và của người qua đường, chỉ khác là ở đây
    // hai khung tới từ bảng chứ không từ hai hàm vẽ riêng.
    //
    // Bọc bằng `.pet-frame` chứ không nhét thẳng hai mớ `.px` vào: mỗi ô pixel đặt TUYỆT ĐỐI
    // theo thẻ có `position` gần nhất, nên không có lớp bọc thì cả hai khung cùng neo vào
    // `.pet-art` và chồng lên nhau đúng chỗ — nhưng lúc ấy không còn thẻ nào để hoán opacity
    // ngoài từng ô một.
    if (a.alt) {
      return html`<span class="pet-art ${cls}${life}" style="${box}"
        ><span class="pet-frame fa">${pixels(a.rows, a.chars, false)}</span
        ><span class="pet-frame fb">${pixels(a.alt, a.chars, false)}</span
      ></span>`;
    }
    return html`<span class="pet-art ${cls}${life}" style="${box}">${pixels(a.rows, a.chars, false)}</span>`;
  }
  const sip = a.fill ? split(a.rows, a.fill) : null;
  const steps = Math.max(1, sip ? sip.inner.length : a.rows.length);
  // `Math.max(0, …)` vì `leftMs` có thể lớn hơn `ms` khi hai đồng hồ lệch nhau, và một độ
  // trễ DƯƠNG ở đây là món ăn đứng nguyên vẹn mấy giây rồi mới bắt đầu vơi.
  const lag = Math.max(0, eat.ms - eat.leftMs);
  const run = `;--eat:${eat.ms}ms;--eat-lag:-${lag}ms;--eat-step:steps(${steps},end)`;
  if (!sip) {
    return html`<span class="pet-art ${cls} eating" style="${box}${run}"
      >${pixels(a.rows, a.chars, false)}</span
    >`;
  }
  // Chiều cao của lớp ruột phải khai TƯỜNG MINH. Mấy ô pixel đều nằm tuyệt đối nên thẻ ấy
  // cao 0 một cách tự nhiên, mà clip-path đo phần trăm trên chính hộp của thẻ — cao 0 thì
  // khung hình đầu tiên đã cắt sạch, và cái ruột biến mất ngay lúc vừa mua.
  return html`<span class="pet-art ${cls} eating sipping" style="${box}${run}"
    >${pixels(sip.shell, a.chars, false)}<span class="art-fill"
      style="top:${sip.top * 4}px;height:${sip.inner.length * 4}px"
      >${pixels(sip.inner, a.chars, false)}</span
    ></span
  >`;
}

/**
 * ## KHOÁ PHA hoạt hình vào đồng hồ tường — con số duy nhất làm việc ấy
 *
 * ### Chỗ hỏng, và nó là chỗ hỏng người dùng nhìn thấy
 *
 * Người dùng, lượt 23: *"đồ trang trí tôi mua bị nhấp nháy hoặc không hiển thị nữa"*.
 *
 * `mount()` vẽ bằng `innerHTML =`, tức là mỗi lượt vẽ VỨT ĐI cả cây DOM cũ rồi dựng lại từ
 * đầu. Một hoạt hình CSS trên một thẻ vừa dựng thì luôn bắt đầu ở 0% — không có cách nào để
 * nó biết vòng trước đã chạy tới đâu. Nên mỗi lượt vẽ là một lần cả bức tranh giật về vạch
 * xuất phát.
 *
 * Và popover vẽ lại nhiều hơn hẳn cái tên "không có nhịp vẽ lại" gợi ra. Đo trên máy này,
 * một lần mở nguội:
 *
 *     /api/state           72ms   → lượt vẽ 1
 *     /api/state?wait=1  1982ms   → lượt vẽ 2   (server luôn gửi `x-now-building: 1`)
 *     /api/pet           2232ms   → lượt vẽ 3
 *
 * Ba lần dựng lại trải trên 2,6 giây, cộng thêm một lần nữa cho mỗi cú bấm tab, đổi ngôn ngữ
 * hay bấm mặt trời. Đó là cái "nhấp nháy".
 *
 * ### Vì sao một con số chữa được cả lớp lỗi
 *
 * `animation-delay` ÂM nghĩa là "coi như nó đã chạy được ngần này rồi". Với hoạt hình
 * `infinite` thì trình duyệt lấy phần dư theo chu kỳ, nên một độ trễ âm bằng ĐỒNG HỒ TƯỜNG
 * đặt mọi thẻ vừa dựng vào đúng pha mà nó lẽ ra đang ở. Lượt vẽ lại thôi có mặt trên màn hình.
 *
 * Một biến cho TẤT CẢ, không phải mỗi hoạt hình một biến: hai lượt vẽ cách nhau `d` mili giây
 * thì `--now` cũng chênh đúng `d`, nên với chu kỳ `P` bất kỳ, pha chênh nhau đúng `d mod P` —
 * tức là đúng bằng cái nó phải chênh. Chu kỳ nào cũng thế, không cần biết trước.
 *
 * Lấy dư theo GIỜ chứ không dùng thẳng `Date.now()`: ranh giới giờ là lúc duy nhất phép trên
 * hụt, và đổi lại con số nằm trong 3,6 triệu thay vì 1,8 nghìn tỷ — `calc()` nhân số ấy với
 * `-1ms` thì vẫn là số nguyên chính xác, còn ở thang mili giây kỷ nguyên thì nó đã ra ngoài
 * dải số nguyên an toàn của float32 mà nhiều bản dựng CSS dùng. Popover sống vài giây, nên
 * xác suất một lần mở rơi trúng ranh giới giờ là chuyện của một lượt vẽ, không phải của một
 * phiên.
 *
 * Đo lại sau khi có nó: dựng lại giữa chừng làm opacity nhảy từ 0,304 sang 0,308 — 0,004.
 * Trước đó nó nhảy về 0,30 từ bất cứ đâu.
 */
export const lifeClock = () => `--now:${Date.now() % 3600000}`;

export function itemArt(id, eat = null) {
  // `Object.hasOwn` chứ không phải `ART[id]` trơn — cùng cái bẫy kế thừa `Object.prototype`
  // đã ghi ở `buy()` trong `src/pet.js`: `ART['constructor']` là một hàm, và `.rows` của
  // nó là `undefined`, nên `pixels` ném giữa lượt vẽ và cả trang trắng.
  return drawArt(Object.hasOwn(ART, id) ? ART[id] : null, `art-${id}`, eat);
}

/** Đồ nghề của một động tác nghỉ. Cùng cửa `Object.hasOwn`, cùng cái bẫy. */
export function moveArt(id, eat = null) {
  return drawArt(Object.hasOwn(MOVE_ART, id) ? MOVE_ART[id] : null, `art-mv-${id}`, eat);
}

/**
 * Khung của một sprite, tính bằng pixel — đọc từ CHÍNH lưới, cùng phép mà `drawArt` dùng.
 *
 * Có để cho chỗ khác đo được một món TRƯỚC khi vẽ nó. Ca duy nhất cần tới điều đó là cái bệ
 * đặt món trong cửa hàng, và nó cần thật — xem `artFit` ngay dưới.
 */
export const artBox = (id) => {
  const a = Object.hasOwn(ART, id) ? ART[id] : null;
  if (!a) return null;
  return { w: Math.max(...a.rows.map((r) => r.length)) * 4, h: a.rows.length * 4 };
};

/**
 * HỆ SỐ CO để một món vừa một cái bệ — 1 nếu nó đã vừa, nhỏ hơn 1 nếu không.
 *
 * ## Vì sao phải có, và vì sao mãi tới lượt 21
 *
 * Cửa hàng bày mỗi món trong một ô lưới `auto-fill minmax(112px, 1fr)`. Trừ đệm và viền thì
 * chỗ thật hẹp nhất của một ô là chừng 92px — mà từ lượt 16 đã có ba món rộng 104px (dãy đồi,
 * cực quang, đường chân trời). Tức chúng bị xén ở mọi cửa sổ hẹp, im lặng, vì `overflow:
 * hidden` cắt gọn tới mức trông như cố ý. Cùng một lớp lỗi với việc cực quang bị xén tám pixel
 * chiều cao suốt bốn lượt.
 *
 * Chỗ ấy chịu được tới lượt 21 vì mọi sprite còn nhỏ. Lượt này người dùng xin món đắt phải to
 * hơn hẳn, mà bức tranh thì rộng 326px — nên khoảng cách giữa "chỗ bày trong tranh" và "chỗ
 * bày trong cửa hàng" mở rộng ra tới mức không giấu được nữa. Hoặc là trần bề rộng của mọi
 * sprite bị cái ô lưới quyết, hoặc là cái ô biết tự co hình lại. Cái sau đúng hơn: bức tranh
 * mới là chỗ món đồ sống, còn cửa hàng chỉ là chỗ xem trước.
 *
 * ## Vì sao là một con số gửi sang CSS, không phải một phép chia trong CSS
 *
 * CSS không chia được hai độ dài ra một con số trần, mà `scale` thì cần đúng một con số trần.
 * Kích thước sprite lại đã biết ở đây rồi — nên chỗ rẻ nhất để tính là chỗ này, và cái đi qua
 * ranh giới chỉ là một biến.
 *
 * Trần là 1: không phóng TO món nhỏ lên cho đầy bệ. Cái khay này bày sáu bảy món cạnh nhau, và
 * một quy tắc "cái nào cũng lấp đầy ô" thì xoá mất chính thứ người dùng đang hỏi — món nào to,
 * món nào nhỏ.
 *
 * ## Và nó BÁM BẬC, không lấy con số vừa khít
 *
 * Cả bộ hình này là lưới 4px. Co xuống 0,885 thì mỗi ô thành 3,54px — trình duyệt vẽ được,
 * nhưng mọi cạnh rơi vào giữa hai pixel màn hình và cả món đọc thành một bức ảnh chụp lại chứ
 * không thành tranh pixel. Ba bậc dưới đây giữ ô ở 4 / 3 / 2px, tức vẫn là số nguyên.
 *
 * Bám xuống chứ không lên: bậc dưới thì chắc chắn vừa, bậc trên thì tràn. Cái phải trả là mấy
 * pixel chỗ trống — một món rộng 104px ở bậc 0,75 chỉ chiếm 78 trong 92px chỗ thật. Rẻ hơn hẳn
 * việc cả cửa hàng đọc thành mờ.
 */
const FIT_STEPS = [1, 0.75, 0.5];

export const artFit = (id, roomW, roomH) => {
  const box = artBox(id);
  if (!box) return 1;
  const need = Math.min(roomW / box.w, roomH / box.h);
  // Bậc cuối là sàn: hình to hơn thế thì nó vẫn bị `overflow: hidden` xén, và đó là chủ ý —
  // một cái sàn nói ra được thì có phép kiểm canh được (xem test "không sprite nào vượt bệ").
  return FIT_STEPS.find((f) => f <= need) ?? FIT_STEPS[FIT_STEPS.length - 1];
};

/** Hình của việc ĐANG LÀM — một cửa cho cả hai bảng, vì chỗ gọi chỉ có `doing.kind`. */
export const doingArt = (doing) =>
  doing ? (doing.kind === 'move' ? moveArt(doing.id, doing) : itemArt(doing.id, doing)) : '';

/* ── Vòng đếm ngược ────────────────────────────────────────────────────────────

   Người dùng xin: "lúc uống nước hay consume đồ gì đó có thể có một cái vòng progress giảm
   dần trên đầu nhân vật hoặc đếm ngược thời gian, cả ở popover và trong giao diện web".

   ## Chỗ trống nó lấp

   Cái vơi của MÓN ĐỒ đã nói "còn bao lâu" rồi (xem `drawArt`), nhưng nó nói bằng một kênh
   chỉ đọc được nếu người ta biết món ấy lúc đầy trông ra sao — mà cả bộ có mười ba món khác
   hình. Và trên popover thì không có chữ nào cả: màn Cửa hàng có đồng hồ `mm:ss` ở dải "đang
   làm", popover thì không có dải ấy. Một cái vòng thì đọc được mà không phải nhớ gì.

   ## Vì sao mỗi ô một hoạt hình RIÊNG chứ không một `clip-path` quét

   Vòng là hình duy nhất mà phép quét không dùng được: `clip-path` cắt theo nửa mặt phẳng
   hoặc theo một đa giác, mà cái phải cắt ở đây là một CUNG. Đổi lại, chia cho từng ô thì mỗi
   ô chỉ cần biết đúng một con số — thời điểm nó tắt — và nó tự tắt đúng lúc ấy, không cần ai
   vẽ lại.

   Đó là điều kiện sống của cả cái vòng: popover KHÔNG có nhịp vẽ lại nào (nó tải một lần mỗi
   lần mở), và bản đồ thì vẽ lại mỗi giây — hai nhịp khác hẳn nhau. Một cái vòng tính bằng
   JavaScript sẽ đứng im ở popover và nhảy từng giây ở bản đồ. Một cái vòng mà mỗi ô mang một
   `animation-delay` ÂM thì chạy y như nhau ở cả hai, cùng cái mẹo đã ghi ở `drawArt`.

   ## Vì sao 12 ô 5×5 chứ không dùng lại vành 16 ô của mặt đồng hồ

   Hai vành cùng cỡ cùng số ô đứng trên một màn hình là mời người đọc nghĩ chúng đo cùng một
   thứ — mà một cái đo nhịp 90 phút còn cái kia đo một phút uống nước. Nói thẳng chỗ chưa
   sạch: chúng vẫn CÙNG DÁNG, và đó là cái giá của việc chiều đúng thứ người dùng xin. Ba
   chỗ tách chúng ra: cỡ (20px với 28px), số ô (12 với 16), và chỗ đứng — cái này bay cạnh
   đầu nhân vật trong bức tranh, cái kia nằm trong dải thông số ngoài bức tranh.

   12 ô cũng là con số của một mặt đồng hồ thật, nên "còn một phần tư" đọc được mà không phải
   đếm. */
const RING = [
  [2, 0], [3, 0], [4, 1], [4, 2], [4, 3], [3, 4],
  [2, 4], [1, 4], [0, 3], [0, 2], [0, 1], [1, 0],
];
const RING_W = 5;

/**
 * Vòng đếm ngược của việc đang làm. Rỗng khi rảnh — chỗ gọi không phải rẽ nhánh.
 *
 * Ô thứ `i` tắt ở mốc `(i+1)/12` của cả quãng. Độ trễ ÂM bằng đúng phần đã trôi, nên một ô
 * lẽ ra đã tắt thì hoạt hình của nó đã chạy hết ngay từ khung hình đầu và `forwards` giữ nó
 * ở trạng thái tắt — không có ô nào sáng lại lúc vẽ lại.
 *
 * `Math.max(1, …)` cho `ms`: một quãng dài 0 thì mọi mốc bằng 0, và `animation-duration: 0s`
 * là một hoạt hình KHÔNG BAO GIỜ chạy tới đích ở vài trình duyệt — cả vòng đứng sáng nguyên.
 */
export function doingRing(doing) {
  if (!doing) return '';
  const ms = Math.max(1, doing.ms ?? 0);
  const gone = Math.max(0, ms - (doing.leftMs ?? 0));
  return html`<span class="pet-ring" aria-hidden="true"
    style="width:${RING_W * 4}px;height:${RING_W * 4}px"
    >${RING.map(
      ([x, y], i) => html`<i class="px"
        style="left:${x * 4}px;top:${y * 4}px;animation:ring-out ${Math.round(((i + 1) / RING.length) * ms)}ms steps(1, end) ${-gone}ms forwards"></i>`,
    )}</span
  >`;
}

/**
 * BỨC TRANH THỬ ĐỒ — quản gia mặc đúng bộ `worn` đưa vào, không mua gì cả.
 *
 * ## Vì sao nó là chính khung popover chứ không phải một khung mới
 *
 * Câu hỏi mà tiệm trang trí phải trả lời là "mua cái này về thì nó trông thế nào", và chỗ
 * duy nhất nó sẽ trông-thế-nào là bầu trời popover. Một khung xem trước tự vẽ lấy — nền
 * khác, cỡ khác, chỗ đứng khác — trả lời một câu hỏi gần giống nhưng không phải câu ấy, và
 * người ta chỉ phát hiện ra sau khi trả 320 xu: cầu vồng ở khung xem trước nằm gọn sau lưng,
 * còn ở popover thì nó bị mép tranh cắt mất một phần ba.
 *
 * Nên nó dùng lại đúng bộ class `.mb-scene` / `.mb-sky` / `.pet-slot`, và mọi toạ độ chỗ
 * đứng là toạ độ thật. Chỗ duy nhất phải khai thêm ở `styles.css` là BỀ RỘNG — sky trong
 * popover rộng theo cửa sổ 360px, mà màn Cửa hàng thì rộng gấp đôi, và một bầu trời kéo dài
 * ra là mọi món trang trí trôi về hai mép.
 *
 * Bầu trời lấy bảng màu MẶC ĐỊNH (buổi chiều), không theo giờ máy. Đây là một tấm gương thử
 * đồ, không phải một cái đồng hồ; và giữ nó đứng một màu là điều kiện để hai lần mở tiệm
 * cách nhau nửa ngày còn so được với nhau.
 *
 * `aria-hidden` vì mọi thứ nó nói đã có bằng chữ ngay cạnh: tên món, khe đang bày, giá.
 */
export function dressArt(worn = {}) {
  const deco = (slot) =>
    worn[slot] ? html`<div class="pet-slot slot-${slot}">${itemArt(worn[slot])}</div>` : '';
  return html`<div class="mb-scene shop-scene" aria-hidden="true">
    <div class="mb-sky">
      ${deco('back')}${deco('top')}
      <div class="mb-sprite">${pixels(butlerRows('stand'), BUTLER_CHARS)}${deco('head')}</div>
      ${deco('left')}${deco('right')}${deco('air')}
    </div>
  </div>`;
}

/**
 * Viết một số xu ra chữ.
 *
 * Số nguyên thì không có phần lẻ, còn lại thì ĐÚNG hai chữ số — không phải "trim số 0 cuối
 * cho gọn". Ví thì gần như không bao giờ tròn (nó là tổng của mấy khoản token lẻ), nên nếu
 * cắt số 0 cuối thì bề rộng con số nhảy qua nhảy lại giữa "68,4" và "68,42" mỗi lượt quét,
 * và một con số tự co giãn ngay cạnh một cái thanh thì đọc thành hỏng chứ không đọc thành
 * đang chạy. Giá thì phần lớn là số nguyên (60, 260) và ở đó "260,00 xu" chỉ là nhiễu.
 *
 * Dấu chấm chứ không dấu phẩy, kể cả ở bản tiếng Việt — cùng cách `usd()` trong
 * `views/shared.js` viết tiền. Xu ĐỌC RA đô-la theo đúng nghĩa đen (`RATE` = 1), nên nó
 * phải viết giống chỗ đang in đô-la, không giống chỗ đang in số lượng.
 */
export const coinNum = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

/**
 * Ví — đồng xu và con số, KHÔNG kèm chữ "xu".
 *
 * Bản trước viết cả hình lẫn chữ ("🪙 1002 xu") vì lo cái sprite không nói được với trình
 * đọc màn hình. Nhìn thật thì hai thứ chồng nghĩa nhau ngay cạnh nhau đọc rất rối — đã có
 * đồng tiền vàng chình ình thì chữ "xu" chỉ là chú thích cho một bức tranh không cần chú
 * thích.
 *
 * Trình đọc màn hình vẫn nghe đủ: cả cụm mang `role="img"` với nhãn có đơn vị, nên nó đọc
 * "1002 xu" chứ không đọc trần "1002". Đây cũng là lý do con số nằm trong một thẻ riêng —
 * `aria-label` thay thế TOÀN BỘ nội dung của cụm, nên nhãn phải tự nó đủ nghĩa.
 *
 * Chữ "xu" vẫn còn ở giá từng món trong cửa hàng: chỗ ấy không có đồng tiền nào đứng cạnh,
 * và "6" trơn dưới một cái ly thì đọc thành số thứ tự.
 *
 * ## `bump` — phần vừa vào ví, và nó chỉ được nảy khi mắt vừa thấy con số cũ
 *
 * Truyền vào một hiệu số dương thì con số nảy một cái và một dòng `+0,42` bay lên rồi tan.
 * Đây là chỗ duy nhất trong cả popover nói ra rằng ví ĐANG CHẢY chứ không phải một con số
 * tĩnh — mà nó chảy theo đúng số token vừa tiêu, nên cái nảy ấy là câu "vừa rồi bạn tiêu
 * chừng này" viết bằng chuyển động.
 *
 * Chỗ gọi có một nghĩa vụ đi kèm: **chỉ đưa `bump` khi bản cũ đã kịp lên màn hình.** Popover
 * vẽ bản nhớ trước rồi mới đè bản mạng lên (xem `menubar.js`), và nếu lượt mạng về trước cả
 * lượt vẽ đầu thì cái nảy đang diễn lại một thay đổi chưa ai nhìn thấy — một hoạt hình nói
 * dối. Vì thế hàm này không tự nhớ gì cả: nó không có cách nào biết mình đã được vẽ hay
 * chưa, còn chỗ gọi thì có.
 */
export function wallet(pet, bump = 0) {
  const up = Number(bump) > 0;
  return html`<span class="pet-wallet ${up ? 'bumped' : ''}" role="img" aria-label="${t('pet.coins', { n: coinNum(pet.coins) })}"
    >${coinArt()}<b>${coinNum(pet.coins)}</b
    >${up ? html`<i class="pet-bump" aria-hidden="true">+${coinNum(bump)}</i>` : ''}</span
  >`;
}

/**
 * NĂM cái đĩa, và một đĩa = một phần NĂM của thanh no.
 *
 * ## Chiều suy đã ĐẢO ở lượt 22, và đó là chỗ đáng đọc kỹ
 *
 * Đời trước: `DISHES = FULL_MS / một giờ`, tức số đĩa là hệ quả của nhịp đói, và cái tính
 * chất nó mua về là *"còn ba đĩa" đọc thẳng thành "còn ba giờ"* — không phải nhân chia gì.
 *
 * Lượt 21 nhấc `FULL_MS` lên 8 giờ nên cái khay tự thành TÁM đĩa, rộng 156px. Người dùng:
 * *"Độ no trên web đang tốn quá nhiều thanh để hiển thị rút bớt xuống 5 thanh cho tôi"*.
 * Đúng, và đó là cái giá mà công thức cũ giấu: nó để một hằng số của MÔ HÌNH quyết bề rộng
 * một vật trong GIAO DIỆN. Hai thứ ấy không có lý do gì phải cùng nhau, và cái thứ hai thì có
 * trần thật — dải thông số còn phải nuôi mặt đồng hồ tập trung và cái ví trên cùng một hàng.
 *
 * Nên giờ **số đĩa là hằng, còn giá trị một đĩa mới là thứ suy ra**: một đĩa đáng
 * `FULL_MS / DISHES`, tức 96 phút ở nhịp 8 giờ hôm nay. Không cất con số ấy vào một hằng số
 * nào — không chỗ nào cần tới nó, và một hằng số không ai đọc là một hằng số sẽ trôi.
 *
 * ## Cái MẤT, viết ra chứ không giấu
 *
 * *"Còn ba đĩa = còn ba giờ"* chết ở đây. Một đĩa không còn là một đơn vị thời gian tròn nào
 * cả, nên cái khay từ lượt này chỉ còn trả lời **"còn bao nhiêu trên bao nhiêu"** — một phân
 * số, không phải một khoảng thời gian.
 *
 * Con số giờ không mất, nó chỉ dọn chỗ: `hungerText` in ra *"còn N giờ nữa thì đói"* ngay
 * bên phải cái khay trong cùng một ô, và `pet.full` chưa làm tròn vẫn nằm trong `aria-label`
 * lẫn `title`. Tức là kênh CHỮ chở con số, kênh HÌNH chở phân số — mỗi kênh một việc, thay vì
 * bắt cái hình chở cả hai rồi phải rộng ra theo nhịp đói.
 *
 * ## Vì sao năm, ngoài chuyện người dùng xin đúng con số ấy
 *
 * Năm là số ô lớn nhất mà mắt còn **đếm được mà không phải đếm** — quá đó thì một cái khay
 * đọc thành một cái thanh, và một cái thanh thì đã có ở đời trước rồi (xem ba đời hình ngay
 * dưới). Nó cũng là con số mà mọi thang đánh giá quen thuộc dùng, nên "ba trên năm" không
 * cần học.
 */
export const DISHES = 5;

/**
 * Số ô SÁNG của một chỉ số 0–1.
 *
 * Còn một chút thì LUÔN sáng ít nhất một ô. Làm tròn trơn thì 4% ra 0 ô, tức một cái thang
 * rỗng trơn trong khi con vật chưa cạn — và đó đúng là lúc người ta cần thấy nó còn thoi
 * thóp nhất. Cạn hẳn mới được tối hết.
 */
const litOf = (value, cells) => (value <= 0 ? 0 : Math.max(1, Math.round(value * cells)));

/**
 * ĐỘ NO — một cái KHAY MÓN ĂN. Ba đời hình, và mỗi lần đổi là một lỗi khác nhau.
 *
 * ## Đời 1 · viên thuốc bo tròn
 *
 * Cao 6px, phần lấp trượt mượt theo phần trăm. Nó đứng ngay dưới một bức tranh dựng toàn ô
 * 4px và là vật DUY NHẤT trong khung có cạnh cong. Khác biệt ấy không đọc thành "thanh này
 * quan trọng hơn"; nó đọc thành "thanh này dán từ chỗ khác vào".
 *
 * ## Đời 2 · mười ô vuông rời
 *
 * Sửa được cạnh cong, và ở cỡ 8–9px thì nó đếm được thật. Hai chỗ nó vẫn hụt:
 *
 * - **Mẫu số sống bằng một sắc xám mờ.** Ô chưa sáng là `--text-3` ở 24%. Rộng 9px thì thấy;
 *   trên popover ở 7px, trên theme sáng, nó gần như tàng hình — mà không có mẫu số thì không
 *   có giá trị nào cả, chỉ còn một vệt lục dài ngắn tuỳ lúc. Đúng cái lỗi này đã bắt cả
 *   đồng hồ cát phải bỏ lớp lót ở lượt sáu.
 * - **Đơn vị không đọc thành câu.** Ba ô trên mười là 30%, mà thứ người ta cần biết là "còn
 *   mấy tiếng nữa" — vẫn phải nhân chia thêm một bước.
 *
 * ## Đời 3 · năm cái đĩa, mỗi đĩa một giờ
 *
 * Mẫu số thôi làm một sắc xám và trở thành một VẬT: cái đĩa rỗng rộng đúng bằng cái đĩa đầy
 * và nằm nguyên chỗ cũ, nên "còn ba trên năm" đọc được ở mọi theme, mọi cỡ, kể cả khi in đen
 * trắng. Đơn vị thành câu: còn ba món là còn ba giờ.
 *
 * Cái phải trả là độ phân giải — 30 phút lên 60 phút. Xem `DISHES` để biết vì sao đó là một
 * trao đổi chứ không phải một mất mát trơn, và vì sao con số 30 phút vẫn không mất.
 *
 * ## Những thứ KHÔNG đổi qua cả ba đời
 *
 * Nó vẫn KHÔNG mượn `quotaBar`: thanh hạn mức chở một luật đọc rất riêng — "đã tiêu" là số
 * dẫn, kênh màu đo đúng một đại lượng là phần bỏ phí (luật 1 trong CLAUDE.md) — nên cho một
 * hình trò chơi mượn dáng ấy là mời người đọc áp cùng luật lên một thứ không có luật đó.
 *
 * Vẫn MỘT sắc cố định cho phần đo được, không đổi màu theo tâm trạng. Cái đĩa là cấu trúc,
 * không phải giá trị — nó đúng vai ô tối của đời trước, và một sắc thứ hai chở cấu trúc thì
 * không phá luật một-sắc, cùng lẽ với giá và bấc của `.pet-dial`.
 *
 * Tên trạng thái ("Ổn", "Đói lả") vẫn ở trong `title` chứ không lên trang: **tooltip chỉ
 * được chở thứ suy ra được từ chính cái hình nó dán vào**. Tên trạng thái tính thẳng từ
 * `pet.full` — ai đọc được cái khay thì đã biết nó. Còn "còn 2 giờ nữa thì đói" thì KHÔNG
 * suy ra được từ năm cái đĩa, nên nó ở lại trên trang.
 */
/**
 * MỘT món trên MỘT cái đĩa, 4×4 ô. Ăn rồi thì món biến mất, cái đĩa ở lại.
 *
 * Hai lưới này là ký tự gõ tay chứ không dựng bằng hàm, cùng ngoại lệ đã áp cho `POSE`,
 * `HEAD` và mấy cái nét trạng thái: ở 4×4 ô thì không còn hình học nào để dựng — bốn hàng
 * là bốn hàng, và một hàm sinh ra chúng chỉ là cùng ngần ấy chữ viết vòng vo hơn. Cái DỰNG
 * bằng hàm là cả cái khay (xem `trayRows`), vì chỗ đó mới có thứ lặp lại.
 *
 * `f` món · `p` cái bát. Cái BÁT vẽ y hệt nhau ở cả hai lưới — hai vách với một cái đáy,
 * đúng sáu ô, đúng chỗ ấy — và đó là toàn bộ phép giữ mẫu số. Hai trạng thái rộng bằng nhau,
 * cao bằng nhau, chỉ khác đúng cái phần đo được.
 *
 * Bản đầu của lượt này để bát rỗng chỉ còn MỘT hàng đáy. Mở trang thật ở theme sáng thì ba
 * cái bát đầy đọc thành ba khối lục còn hai cái rỗng đọc thành hai cái gạch — cùng bề rộng
 * thật đấy, nhưng khối lượng thị giác chênh nhau cả chục lần, nên mắt đếm được 3 chứ không
 * đếm được 3/5. Hai cái vách trả lại cho nó hình một cái BÁT, và mẫu số đọc được ở cả hai
 * theme. Cùng bài học đã ghi cho lớp lót của đồng hồ cát ở lượt sáu, chỉ ở hình khác.
 */
const DISH_FULL = ['.ff.', 'ffff', 'pffp', 'pppp'];
const DISH_DONE = ['....', '....', 'p..p', 'pppp'];

/**
 * Lưới ký tự của cái khay ở mức `left` món còn lại.
 *
 * Một ô trống giữa hai đĩa, không hơn: đây là lưới 4px, và hai ô hở thì năm cái đĩa rộng
 * thêm 16px mà không đọc rõ hơn một chút nào. Bề rộng suy ra chứ không khai: `dishes*4 +
 * (dishes-1)` ô = 24 ô = 96px ở năm món, hẹp hơn cái thanh mười ô cũ 10px.
 */
export function trayRows(left, dishes = DISHES) {
  return DISH_FULL.map((_, y) =>
    Array.from({ length: dishes }, (_, i) => (i < left ? DISH_FULL : DISH_DONE)[y]).join('.'),
  );
}

export function hungerTray(pet) {
  const aria = t('pet.fullAria', { pct: Math.round(pet.full * 100) });
  const rows = trayRows(litOf(pet.full, DISHES));
  return html`<span class="pet-tray mood-${pet.mood} ${rising(pet, 'fedFrom') ? 'rising' : ''}"
    role="img" aria-label="${aria}" title="${t(`pet.mood.${pet.mood}`)} · ${aria}"
    style="width:${rows[0].length * 4}px;height:${rows.length * 4}px"
    >${pixels(rows, { f: 'food', p: 'plate' }, false)}</span
  >`;
}

/**
 * Thanh này có đang HỒI không — và cái nó bật lên là một cái nhãn, không phải một phép đo.
 *
 * Con số đã tự đúng rồi: giữa quãng ăn, `pet.full` chính là chỗ cái thanh đã bò tới (xem
 * `ramped` trong `petmath.js`), nên số ô sáng vốn đã tăng dần trước mắt. Cái class này chỉ
 * trả lời một câu khác: **vì sao** nó đang nhích. Không có nó thì một cái thanh tự dài ra
 * trông y hệt một cái thanh vừa được nạp một phát rồi vẽ lại — mà hai chuyện ấy khác nhau
 * ở chỗ người dùng có cần bấm gì nữa không.
 *
 * Đọc `ramp` chứ không đọc `doing`: một quãng nghỉ vừa chốt thì `doing` đã tắt mà thanh
 * tập trung mới bắt đầu bò lên (xem `REST_RAMP_MS`) — hai thứ ấy không trùng khung giờ.
 */
const rising = (pet, mark) => Boolean(pet?.ramp?.[mark]) && rampAt(pet.ramp, Date.now()) < 1;

/**
 * TẬP TRUNG — một MẶT ĐỒNG HỒ tròn. Năm đời hình, và năm lỗi khác nhau.
 *
 * ## Đời 1 · một cái thanh hẹp hơn thanh đói vài pixel
 *
 * Hai đại lượng khác LOẠI mà vẽ cùng một hình: hỏng ngay ở tầng đọc, không phải ở tầng đẹp.
 *
 * ## Đời 2 · mặt đồng hồ chín chấm
 *
 * Sập vì hình học: chín chấm 4px rời nhau 2,8 ô không hợp thành một VẬT.
 *
 * ## Đời 3 · đồng hồ cát
 *
 * Khối liền, nhưng **bão hoà**: ngồi 91 phút và 300 phút cho ra cùng một cái bầu rỗng.
 *
 * ## Đời 4 · cây nến
 *
 * Thêm được kênh **ngọn lửa** — cháy/tắt, nhị phân, đọc ở tầm mắt ngoại vi — nên `spent` có
 * hình riêng chứ không còn là "cái bầu trên rỗng".
 *
 * ## Đời 5 · mặt đồng hồ tròn (lượt này, người dùng chọn)
 *
 * Cây nến không hỏng. Nó chỉ nói sai một chữ: **một chu kỳ 90 phút không cạn đi, nó QUAY
 * LẠI.** Sáp cháy hết là hết, còn nhịp thì nghỉ xong là đầy lại từ đầu — mà cái hình thì
 * đang kể chuyện tiêu hao một chiều. Một vòng tròn nói đúng chữ ấy mà không cần một câu chú
 * thích nào: nó là hình duy nhất trong bảng mà đi hết một vòng là về đúng chỗ xuất phát.
 *
 * Ba thứ đo được đi kèm:
 *
 * - **Mịn gần gấp đôi.** Vành 7×7 có 16 ô, tức `FOCUS_MS / 16 ≈ 5,6 phút` một ô, thay cho 9
 *   ô × 10 phút. Và đây là chỗ ĐỔI CHIỀU một luật: đời trước số ô do `FOCUS_CELL_MS` đặt
 *   rồi hình phải chiều theo; giờ HÌNH HỌC đặt số ô và đơn vị thời gian suy ra từ nó. Đổi
 *   được vì `FOCUS_CELL_MS` chưa bao giờ có người dùng thứ hai — nó chỉ tồn tại để chia ô.
 * - **Thấp hơn 8px.** 28×28 thay cho 20×36, nên dải HUD còn chỗ cho hai ô chữ.
 * - **Vẫn khác LOẠI hẳn cái khay.** Khay là một hàng vật rời nằm ngang; đồng hồ là một
 *   đường KHÉP KÍN. Không có cỡ nào làm hai thứ ấy lẫn vào nhau.
 *
 * Cái giá phải trả, nói thẳng: đường tròn trên lưới 4px là đường tròn có góc — ở 28px nó là
 * một hình bát giác, và ai nhìn kỹ sẽ thấy. Chấp nhận vì cả bức tranh đã là lưới 4px, nên
 * một vòng tròn có góc đứng cùng ngôn ngữ nét với mọi thứ quanh nó.
 *
 * Cái nó KHÔNG chữa: vẫn bão hoà. `focus` bị kẹp về 0 nên 91 phút và 300 phút vẫn cho cùng
 * một vành xám. Kênh chữa việc ấy là cái CHẤM GIỮA (tắt = hết nhịp) và câu "đã ngồi N phút
 * liền" bên cạnh — đúng như cây nến, không hơn.
 */

/**
 * Vành đồng hồ 7×7 ô, khai theo CHIỀU KIM tính từ 12 giờ.
 *
 * Viết ra thành bảng toạ độ chứ không dựng bằng lượng giác, và đó là lựa chọn chứ không
 * phải lười: `cos`/`sin` trên một vành 16 ô cho ra mấy ô rơi vào giữa hai ô lưới, và làm
 * tròn chúng thì thứ tự quanh vành không còn là một vòng liền — hai ô cùng rơi vào một chỗ,
 * một chỗ khác bỏ trống. Ở 16 ô thì bảng NGẮN HƠN cả cái hàm dựng nó, mà lại đúng.
 *
 * Thứ tự là phần chở nghĩa, không phải tập hợp: `dialRows` cắt mảng này thành "đã tiêu" và
 * "còn lại" theo đúng thứ tự ấy, nên đảo hai phần tử là kim đồng hồ chạy ngược.
 */
const DIAL_RING = [
  [3, 0], [4, 0], [5, 1], [6, 2], [6, 3], [6, 4], [5, 5], [4, 6],
  [3, 6], [2, 6], [1, 5], [0, 4], [0, 3], [0, 2], [1, 1], [2, 0],
];
const DIAL_W = 7;
const DIAL_MID = (DIAL_W - 1) / 2;
const FOCUS_CELLS = DIAL_RING.length;

/**
 * Lưới ký tự của mặt đồng hồ ở mức `lit` ô CÒN LẠI.
 *
 * `w` phần còn lại · `d` phần đã tiêu · `l` chấm giữa còn cháy · `s` khói.
 *
 * Phần đã tiêu là `cells - lit` ô ĐẦU TIÊN tính từ 12 giờ theo chiều kim, nên ranh giới
 * giữa hai phần quét đúng như kim một cái đồng hồ đếm ngược, còn phần còn lại thì luôn KẾT
 * THÚC ở 12 giờ. Vẽ ngược lại — phần còn lại bắt đầu từ 12 — thì cái ranh giới chạy ngược
 * chiều kim, và một mặt đồng hồ quay ngược là thứ mắt bắt ra trước cả khi kịp gọi tên.
 *
 * Chấm giữa là kênh nhị phân mà cây nến để lại: cháy nghĩa là đồng hồ đang chạy, TẮT nghĩa
 * là hết nhịp. Ở `lit === 0` nó tắt và có hai ô khói bay lên phía 12 giờ — một ca theo
 * TRẠNG THÁI chứ không theo mức, và nó phải thế: `lit === 0` là biên của cả hai.
 */
export function dialRows(lit, ring = DIAL_RING, w = DIAL_W) {
  const g = Array.from({ length: w }, () => Array.from({ length: w }, () => '.'));
  const burnt = ring.length - lit;
  ring.forEach(([x, y], i) => { g[y][x] = i < burnt ? 'd' : 'w'; });
  g[DIAL_MID][DIAL_MID] = lit > 0 ? 'l' : 'd';
  if (lit === 0) { g[DIAL_MID - 1][DIAL_MID] = 's'; g[DIAL_MID - 2][DIAL_MID - 1] = 's'; }
  return g.map((r) => r.join(''));
}

/**
 * Sổ đời cũ chưa có trường này thì `pet.focus` là `undefined`; trả chuỗi rỗng chứ không vẽ
 * một mặt đồng hồ rỗng, cùng luật với nhánh "trò chơi đang tắt" ở khung cảnh — một chỗ trống
 * đang chờ dữ liệu thì tệ hơn hẳn một chỗ không có gì.
 */
export function focusDial(pet) {
  if (typeof pet.focus !== 'number') return '';
  const aria = t('pet.focusAria', { pct: Math.round(pet.focus * 100) });
  const rows = dialRows(litOf(pet.focus, FOCUS_CELLS));
  return html`<span class="pet-dial mood-${pet.focusMood} ${rising(pet, 'restedFrom') ? 'rising' : ''}"
    role="img" aria-label="${aria}" title="${t(`pet.focusMood.${pet.focusMood}`)} · ${aria}"
    style="width:${rows[0].length * 4}px;height:${rows.length * 4}px"
    >${pixels(rows, { w: 'wax', l: 'flame', d: 'spent', s: 'smoke' }, false)}</span
  >`;
}

/**
 * Câu nhắc sức khoẻ — chỉ hiện khi đã ngồi quá pha tỉnh của một chu kỳ.
 *
 * Cửa duy nhất: `focusMood === 'sharp'` thì im. Một lời nhắc hiện thường trực là một dòng
 * chữ người ta học cách không nhìn trong ba ngày; nó chỉ còn nghĩa nếu nó hiếm.
 *
 * Chọn câu theo GIỜ chứ không theo lượt, và có hai ca đặc biệt vì chúng có nền:
 *
 * - **13–16h**: cú trũng đầu chiều. Nó không phải do ăn no — thí nghiệm tách bữa ăn ra
 *   vẫn thấy nó, nó là hoạ ba bậc hai của đồng hồ sinh học. Thứ có bằng chứng chống lại
 *   nó là chợp mắt ngắn và ÁNH SÁNG MẠNH, nên câu này đẩy ra chỗ có nắng chứ không đẩy
 *   thêm một ly cà phê.
 * - **≥22h**: lúc này không có mẹo nào cả, chỉ có đi ngủ.
 *
 * Không random: popover tải lại mỗi lần mở, nên bốc ngẫu nhiên là mỗi lần mở một câu
 * khác cho cùng một tình trạng — đọc thành cái máy nói nhảm, không đọc thành lời nhắc.
 */
/**
 * Hai BẬC to nhỏ của lời nhắc, và ranh giới giữa chúng KHÔNG do khẩu vị đặt.
 *
 * `stateOf` bên `petmath.js` đã xếp hạng sáu trạng thái, và trong sáu cái ấy có đúng HAI cái
 * mà bức tranh vẽ ra một người **ngừng làm việc**: đói lả thì gục xuống, quá nhịp thì ngủ
 * gật — cả hai đều tắt màn hình và rời tay khỏi bàn phím (xem `butlerArt` trong `town.js`).
 * Bốn cái còn lại thì anh ta vẫn ngồi gõ.
 *
 * Đó là ranh giới, và nó tự có sẵn: dải báo động kêu to đúng ở hai chỗ mà công việc đã dừng
 * rồi. Cho `hungry` hay `dip` cũng kêu to là dạy người đọc rằng cái dải ấy lúc nào cũng đỏ —
 * và một cái đỏ thường trực thì sau ba hôm nó thành một dòng chữ không ai nhìn nữa, đúng lý
 * lẽ đã ghi cho `.mb-nudge` và cho cửa `sharp` ngay dưới đây.
 */
const URGENT = new Set(['starving', 'spent']);

export function nudgeOf(pet, now = new Date()) {
  if (!pet) return null;
  // ĐÓI LẢ thắng mọi câu khác, và nó phải thắng vì hai lý do khác nhau chồng lên nhau:
  // `stateOf` đã xếp nó trên `spent` (một người đói lả thì việc cần làm là ăn, không phải
  // đứng dậy đi lại), và cái cửa nó mở ra là một cửa KHÁC — quán ăn, không phải công viên.
  //
  // Chỉ `starving` chứ không `hungry`: `hungry` là ngưỡng 35%, tức hơn một phần ba thời
  // gian trong ngày, mà một lời nhắc thường trực là một dòng chữ người ta học cách không
  // nhìn trong ba ngày. `starving` là 12% cuối — khoảng 36 phút của một chu kỳ 5 giờ.
  const loud = URGENT.has(stateOf(pet));
  const level = loud ? 'urge' : 'hint';
  if (pet.mood === 'starving') return { say: t('pet.nudge.starving'), go: 'food', level };
  if (pet.focusMood == null || pet.focusMood === 'sharp') return null;
  const h = now.getHours();
  const n = pet.satMin;
  const go = 'park';
  if (h >= 22 || h < 5) return { say: t('pet.nudge.night', { n }), go, level };
  if (h >= 13 && h < 16) return { say: t('pet.nudge.afternoon', { n }), go, level };
  return { say: t(pet.focusMood === 'spent' ? 'pet.nudge.spent' : 'pet.nudge.dip', { n }), go, level };
}

/**
 * Câu quản gia tự nói về mình — cho bong bóng thoại ở popover.
 *
 * Ngôi THỨ NHẤT, và đó là toàn bộ lý do nó không phải một bản chép của dải thông số ngay
 * dưới: dải ấy in số ("còn no 42%", "đã ngồi 82 phút liền"), còn cái này nói cùng một trạng
 * thái bằng giọng của kẻ đang ở trong nó. Một bong bóng đọc lại mấy con số là một cú bấm
 * không trả về gì.
 *
 * Đọc CHÍNH `butlerLook` chứ không tự xếp hạng lại: bức tranh và câu nói phải cùng một
 * nguồn, nếu không thì có lúc anh ta gục xuống mà lại bảo "đang ổn".
 */
export const butlerSays = (pet, { cheer = false } = {}) =>
  t(pet?.on ? `pet.says.${butlerLook(pet, { cheer }).state}` : 'pet.says.off');

/* Có một `nudgeText` ở đây — bản chỉ-trả-câu-chữ cho popover — và nó đã bị GỠ: từ lượt này
   popover cũng cần cái BẬC to nhỏ, nên nó đọc thẳng `nudgeOf` như màn Cửa hàng. Một cửa xuất
   chỉ chở một phần ba của cái mà cả hai người dùng đều cần là một cửa mời người ta quên hai
   phần còn lại. */

/* ── NÓI và NGHĨ ───────────────────────────────────────────────────────────────

   Quản gia có hai giọng, và ranh giới giữa chúng KHÔNG do khẩu vị đặt — nó là đúng cái
   ranh giới `URGENT` ngay trên: hai trạng thái mà bức tranh vẽ ra một người **ngừng làm
   việc** (đói lả thì gục xuống, quá nhịp thì ngủ gật). Bốn trạng thái còn lại anh ta vẫn
   ngồi gõ, và một người đang gõ thì không quay sang nói.

   - **NÓI** — bong bóng đặc, có đuôi nhọn chỉ vào người. Chỉ hai trạng thái ấy, và lúc ấy
     nó hiện LIÊN TỤC, không đợi bấm, không xoay vòng: một câu, lặp lại tới lúc được sửa.
   - **NGHĨ** — bong bóng mây, nhạt hơn, thỉnh thoảng nổi lên rồi tan. Mọi lúc còn lại.

   Vì sao phải là hai HÌNH khác nhau chứ không phải một hình đổi màu: theme daltonized
   không được dựa vào mỗi một khác biệt sắc — cùng hàng rào đã ghi cho cặp mắt mở/nhắm.

   ## Vì sao cái pool xoay vòng, và vì sao nó bắt đầu từ ĐỒNG HỒ

   Popover mở rồi đóng trong vài giây. Một câu nghĩ "thỉnh thoảng mới hiện" theo nghĩa đen
   — chờ 4 giây rồi mới nổi lên — là một câu gần như không ai gặp. Nên câu đầu phải có mặt
   NGAY, và cái "thỉnh thoảng" nằm ở chỗ khác: mỗi lần mở là một câu khác.

   Chọn bằng `Math.floor(nowMs / THINK_MS)` chứ không bằng `Math.random`. Ngẫu nhiên thì
   một lượt vẽ lại giữa chừng (popover có hai lượt: bản nhớ rồi bản mạng — xem `menubar.js`)
   sẽ đổi câu ngay trước mắt người đang đọc dở. Chia theo đồng hồ thì hai lượt vẽ cách nhau
   vài trăm mili giây luôn rơi vào cùng một ô, còn hai lần MỞ cách nhau nửa phút thì không.

   `THINK_MS` là ô CHỌN CÂU ĐẦU, không phải nhịp xoay trên màn hình — nhịp ấy là
   `--think-cycle` bên `styles.css` và nó dài gấp hơn hai lần. Hai con số cho hai việc: một
   cái quyết "mở popover lần này thấy câu nào trước", cái kia quyết "một câu nằm lại bao lâu".
   Người dùng báo nhịp thứ hai chạy quá dày và quá nhanh (lượt 18); chỗ sửa nằm ở CSS. */
const THINK_MS = 20000;

/** Đang ở bậc NÓI hay không — một cửa cho cả chỗ chọn hình lẫn chỗ chọn câu. */
export const speaking = (pet) => Boolean(pet?.on) && URGENT.has(stateOf(pet));

/**
 * Câu nghĩ — và từ lượt này, luật một dòng: **chỉ nghĩ khi có tin.**
 *
 * Bản trước lúc nào cũng trả bộ ba: câu trạng thái cộng hai câu theo BUỔI ("Sáng sớm yên
 * thật…"), tức mở popover ra là chắc chắn có một bong bóng nổi lên. Người dùng gọi đúng
 * tên: "không nhất thiết phát nào mở ra cũng nói một câu". Mà hai câu theo buổi thì tự
 * khai trong luật của chính chúng ở i18n.js rằng chúng KHÔNG chở tin nào — một dòng chữ
 * thường trực không chở tin là đúng thứ mà lý lẽ của cửa `sharp` bên `nudgeOf` đã cấm,
 * chỉ là lần này nó lách qua bằng lối bong bóng thay vì lối câu nhắc.
 *
 * Ba ca, cắt theo "có gì để nói không":
 *
 * - **Đang yên (`well`, không việc)** → KHÔNG CÓ GÌ. Trả mảng rỗng, bầu trời sạch.
 * - **Có chuyện chưa gấp (`hungry`/`dip`)** → đúng MỘT câu trạng thái, đứng yên chứ không
 *   xoay: một câu đơn độc chạy vòng 42 giây là 36 giây trống cho đúng cái câu đang cần
 *   đọc (CSS bắt ca này bằng only-child, không cần cờ nào từ đây).
 * - **Đang làm (ăn / một động tác nghỉ)** → giữ nguyên bộ ba xoay vòng như cũ. Nó là lời
 *   kể của chính hành động người dùng vừa bấm, sống đúng một phút, và hai câu bối cảnh
 *   ở ca này nói về VIỆC chứ không về buổi trời.
 *
 * (Gấp thật — đói lả, kiệt nhịp — thì đã có bong bóng NÓI của `speaking`, không qua đây.)
 *
 * Trả `{ say, face }` chứ không trả chuỗi trần, từ lượt 18: mỗi câu mang theo vẻ mặt của
 * chính nó (xem `FACES`). Câu trạng thái lấy mặt của TRẠNG THÁI, hai câu bối cảnh lấy mặt
 * của BỐI CẢNH — một người vừa kiệt nhịp vừa đang ăn thì hai câu ấy mang hai vẻ mặt khác
 * nhau, đúng như thật.
 *
 * Mã lạ trong sổ (sổ chép tay, sổ của bản cũ hơn) rơi về câu trạng thái đơn — `t()` im
 * lặng trả lại khoá khi thiếu, nên chỗ duy nhất chặn được là ở đây.
 */
export function butlerThinks(pet, nowMs = Date.now()) {
  if (!pet?.on || speaking(pet)) return [];
  const d = pet.doing;
  const key = d?.kind === 'food' ? 'eat' : d?.kind === 'move' && Object.hasOwn(MOVES, d.id) ? d.id : null;
  if (!key) return stateOf(pet) === 'well' ? [] : [{ say: butlerSays(pet), face: butlerFace(pet) }];
  const ctx = FACE_OF_CTX[key] ?? 'flat';
  const pool = [
    { say: butlerSays(pet), face: butlerFace(pet) },
    { say: t(`pet.think.${key}.1`), face: ctx },
    { say: t(`pet.think.${key}.2`), face: ctx },
  ];
  const off = Math.floor(nowMs / THINK_MS) % pool.length;
  return [...pool.slice(off), ...pool.slice(0, off)];
}

/* ── MẸO DÙNG CLAUDE ──────────────────────────────────────────────────────────

   Người dùng, lượt 19: *"Quản gia có thể nhắc nhở user các tip sử dụng claude hiệu quả +
   skill mặc định nào hay"*.

   ## Vì sao mẹo đi vào bong bóng NÓI chứ không vào bộ ba câu nghĩ

   Chỗ hiển nhiên là thêm mẹo làm câu thứ tư của `butlerThinks`. Không được, và lý do là một
   phép đo của chính lượt trước: vòng nghĩ dài 42 giây, mỗi câu nằm lại 5,9 giây — bốn câu là
   23,6 giây có chữ trên 42, tức 56%. Lượt 18 vừa hạ con số ấy từ 75% xuống 42% vì người dùng
   báo *"tần suất nói khi làm việc hơi nhiều và nhanh"*. Thêm một câu vào đó là đi ngược lại
   đúng cái vừa sửa xong.

   Bong bóng NÓI thì không có bài toán ấy: nó chỉ hiện khi được BẤM (xem `mb-who` bên
   `menubar-view.js`). Một câu không tự nổi lên thì không có tần suất nào để mà nhiều.

   Và nó hợp nghĩa hơn hẳn. Ranh giới hai giọng vốn là "nói về mình / nói với người":

   - **NGHĨ** — về chính anh ta: đang đói, đang ăn, trời đang tối.
   - **NÓI** — có chuyện cho NGƯỜI ĐỌC. Tới lượt này chỉ có hai câu ấy là hai bậc gấp
     (`URGENT`), tức "tôi ngừng làm việc rồi". Mẹo là cái thứ hai thuộc loại đó, và nó lấp
     đúng chỗ trống: bấm vào quản gia lúc mọi thứ đang yên thì trước đây anh ta không có gì
     để nói.

   Nên luật một dòng: **gấp thì nói trạng thái, còn lại thì mách một mẹo.**

   ## Chọn mẹo bằng ĐỒNG HỒ, cùng phép với câu nghĩ

   `Math.floor(nowMs / TIP_MS)` chứ không `Math.random`, cùng lý lẽ đã ghi ở `THINK_MS`: một
   lượt vẽ lại giữa chừng (đổi tab, đổi ngôn ngữ, sổ vừa về) sẽ đổi mẹo ngay trước mắt người
   đang đọc dở. Ô 25 giây thì hai lượt vẽ cách nhau vài trăm mili giây luôn rơi vào cùng một
   ô, còn hai lần MỞ popover cách nhau nửa phút thì không.

   Dài hơn `THINK_MS` (20s) một chút, và cố ý: một câu mẹo cần đọc lâu hơn một câu bâng quơ,
   mà cửa sổ này thì mở rồi đóng trong vài giây — nên ô phải đủ rộng để một lần bấm không
   trúng vào đúng chỗ giao hai ô.

   ## Nội dung: chỉ nhận thứ KIỂM ĐƯỢC

   Mười sáu mẹo từ lượt 20 (tám ở lượt 19), và không mẹo nào gọi tên một skill của bên thứ ba.
   Skill đi kèm được gọi tên chỉ có `/now` — nó nằm ngay trong `plugin/skills/` của chính kho
   này, nên ai cài dashboard là có nó. Mấy cái tên bundle mà bản này không kiểm chứng được thì
   thà không nhắc: một mẹo bảo người ta gõ một lệnh không tồn tại tệ hơn hẳn một mẹo thiếu.

   Cùng luật ấy loại luôn mấy phím tắt nhiều bậc và mấy cờ dòng lệnh: bảng này chỉ nhận thứ
   nào cả hai bên đều kiểm được — `/compact`, `/clear`, `/now`, `CLAUDE.md`, phím `Esc`, và
   mấy lời khuyên không gọi tên lệnh nào cả.

   ## Bốn LOẠI, và vì sao huy hiệu đi theo loại chứ không theo mẹo

   Người dùng, lượt 20: *"Bổ sung thêm tip claude code (hiển thị emoji khác thay vì mặt trạng
   thái)"*. Hai việc, và việc thứ hai đúng: bản lượt 19 mượn một VẺ MẶT (`tip`, nháy mắt) làm
   huy hiệu cho mẹo, tức dùng bảng chữ của "quản gia đang thế nào" để nói một câu không hề nói
   về quản gia. Nên mẹo có bộ hình RIÊNG, và bộ ấy khác vẻ mặt ở đường bao trước khi khác ở
   chi tiết: vẻ mặt nào cũng là một cái đĩa tròn 7×7, còn bốn huy hiệu này thì không cái nào tròn.

   Mười sáu huy hiệu cho mười sáu mẹo là mười sáu hình mà mắt không bao giờ so được: mỗi mẹo
   nằm 25 giây rồi đi, nên hai huy hiệu không bao giờ cùng trên màn hình. Một hình chỉ học được
   khi nó QUAY LẠI. Bốn loại thì mỗi huy hiệu quay lại trung bình bốn lần một vòng, và tới đó
   nó thôi là trang trí — nó nói trước cho người đọc biết câu sắp tới thuộc loại gì.

   Bốn loại chia theo thứ người ta phải LÀM GÌ với mẹo ấy, không theo chủ đề:

   - `ctx`  — dọn ngữ cảnh. Việc làm ngay, trong phiên đang chạy.
   - `rule` — viết một luật xuống. Việc làm một lần, sống mãi.
   - `flow` — đổi cách gõ một lượt. Thói quen.
   - `tool` — có một công cụ sẵn cho việc này. Thứ phải biết là nó tồn tại. */
const TIP_MS = 25000;

/* ── Huy hiệu của bốn loại mẹo ────────────────────────────────────────────────

   Bảy hàng, 28px — đúng khung của một vẻ mặt, vì chúng thay nhau ở cùng một chỗ trong tấm
   bảng NÓI. Khác khung là tấm bảng đổi bề rộng giữa hai câu, và cái nhảy ấy nói to hơn cả
   hai câu cộng lại.

   Bốn ĐƯỜNG BAO khác hẳn nhau, và đó là điều kiện chứ không phải khẩu vị — cùng luật đã tách
   sáu món trang trí cùng khe: đối xứng dọc / hình chữ L / một nét chéo / một cái hộp có quai.
   Ở 28px thì đường bao là thứ đọc được trước, và với bốn hình thì nó là thứ duy nhất cần đọc. */

/** Dọn ngữ cảnh: hai khối nhọn ép vào một sợi kẻ. Đối xứng cả hai trục — hình duy nhất trong
 *  bộ có tính chất ấy, nên nó nhận ra được cả khi mắt chỉ liếc qua. */
const TIP_CTX = ['.aaaaa.', '..aaa..', '...a...', '#######', '...a...', '..aaa..', '.aaaaa.'];

/** Viết luật xuống: một lá cờ cắm trên cột. Chữ L là đường bao — cột chạy hết chiều cao còn
 *  lá cờ chỉ chiếm nửa trên, nên nó lệch hẳn khỏi ba hình kia, cả ba đều cân theo chiều dọc. */
const TIP_RULE = ['.#####.', '.#aaa#.', '.#aaa#.', '.#####.', '.#.....', '.#.....', '.#.....'];

/**
 * Đổi cách gõ: một dấu tích. Nét CHÉO, và nó là nét chéo duy nhất của cả bộ — ba hình kia chỉ
 * có cạnh ngang với cạnh đứng.
 *
 * Mỗi hàng dịch ĐÚNG một cột, không hàng nào giữ nguyên cột. Bản đầu để hai hàng liền nhau
 * cùng cột — chỉ hai hàng — và mở ra thì cả dấu tích đọc thành một tia chớp: một đoạn thẳng
 * đứng dài 8px cắt giữa một nét chéo là đủ để mắt gãy đường đi thành hai hướng. Luật rút ra
 * cho mọi nét chéo ở lưới 4px: **một hàng, một cột, không có ngoại lệ.**
 *
 * Hàng đầu để trống, và đó là cố ý: dấu tích có một đường chân: nó tì lên đáy ô chứ không lơ
 * lửng giữa ô như ba hình kia, vốn đều cân theo chiều dọc.
 */
const TIP_FLOW = ['.......', '......a', '.....aa', 'a...aa.', 'aa.aa..', '.aaaa..', '..aa...'];

/** Có công cụ sẵn: một hộp đồ nghề, quai vòng lên trên. Cái quai là chi tiết quyết định —
 *  không có nó thì cái hộp là một khung chữ nhật, mà lá cờ trên kia cũng bắt đầu bằng một
 *  khung chữ nhật. */
const TIP_TOOL = ['..###..', '.#...#.', '#######', '#aaaaa#', '#aa#aa#', '#aaaaa#', '#######'];

const TIP_ART = { ctx: TIP_CTX, rule: TIP_RULE, flow: TIP_FLOW, tool: TIP_TOOL };

/** Tên bốn loại, XUẤT RA cho bài test — cùng lý do với `FACE_NAMES` và `TIP_KEYS`: `tipArt`
 *  rơi về `TIP_CTX` khi gặp tên lạ, nên một loại gõ sai không kêu lên, nó chỉ lặng lẽ đeo huy
 *  hiệu của loại khác. */
export const TIP_KINDS = Object.keys(TIP_ART);

/**
 * Vẽ huy hiệu của một loại mẹo. Cùng khuôn với `faceArt` — kể cả `aria-hidden`, và ở đây lý
 * do còn mạnh hơn: một cái nhãn "hộp đồ nghề" đọc lên giữa một câu mẹo là một câu bị cắt đôi
 * bởi đúng thứ không chở tin nào.
 *
 * Tên class riêng `pet-tip`, không mượn `pet-face`: hai bộ có bảng màu khác nhau (huy hiệu
 * không có cái đĩa vàng), và mượn class thì luật màu của mặt sẽ sơn cả huy hiệu.
 */
export const tipArt = (kind) => html`<span class="pet-tip tip-${kind}" aria-hidden="true"
  style="width:${FACE_W}px;height:${FACE_W}px"
  >${pixels(TIP_ART[kind] ?? TIP_CTX, { a: 'lit' }, false)}</span
>`;

/**
 * Bảng mẹo: khoá → loại. Thứ tự trong bảng LÀ thứ tự xoay vòng, và nó xen kẽ bốn loại chứ
 * không gom từng cụm — gom cụm thì bốn mẹo `flow` liên tiếp đi cùng một huy hiệu, và ở đó cái
 * huy hiệu thôi báo hiệu gì, nó thành một vật đứng yên trong khi câu chữ đổi.
 */
const TIPS = {
  claudeMd: 'rule',
  compact: 'ctx',
  plan: 'flow',
  skill: 'tool',
  clear: 'ctx',
  diff: 'flow',
  now: 'tool',
  scope: 'rule',
  small: 'ctx',
  look: 'flow',
  agent: 'tool',
  esc: 'flow',
  paste: 'flow',
  verify: 'tool',
  file: 'flow',
  shot: 'flow',
};

/** Khoá của mười sáu mẹo, XUẤT RA cho bài test — cùng lý do với `FACE_NAMES`: `t()` im lặng
 *  trả lại khoá khi thiếu, nên một khoá gõ sai sẽ hiện nguyên chữ `pet.tip.…` trong bong bóng
 *  mà không có gì kêu lên. */
export const TIP_KEYS = Object.keys(TIPS);

/** Mẹo của lúc này — câu và loại. Không đọc sổ: nó không nói về con vật. */
export function butlerTip(nowMs = Date.now()) {
  const key = TIP_KEYS[Math.floor(nowMs / TIP_MS) % TIP_KEYS.length];
  return { say: t(`pet.tip.${key}`), tip: TIPS[key] };
}

/**
 * Câu quản gia NÓI RA — một cửa, hai nhánh, và cái rẽ nhánh là `speaking`.
 *
 * Cùng hình dạng với `butlerThinks`: trả một object chứ không trả chuỗi trần, để chỗ vẽ không
 * phải tra bảng hình lần thứ hai (có HAI chỗ vẽ — popover và, sau này, bất cứ bề mặt nào muốn
 * cùng câu ấy).
 *
 * Hai nhánh trả hai KHOÁ khác nhau — `face` với `tip` — chứ không cùng một khoá `art`. Đó là
 * chỗ để `talkArt` chọn bảng hình mà không phải đoán, và nó cũng là chỗ một lần thêm nhánh
 * thứ ba sau này sẽ tự lộ ra: quên khai khoá thì hình rơi về mặc định thấy ngay, còn dùng
 * chung một khoá thì nhánh mới im lặng mượn bảng của nhánh cũ.
 */
export const butlerTalk = (pet, nowMs = Date.now()) =>
  speaking(pet) ? { say: butlerSays(pet), face: butlerFace(pet) } : butlerTip(nowMs);

/** Hình đi kèm một câu NÓI — mặt khi gấp, huy hiệu khi mách mẹo. Một cửa, để chỗ vẽ không
 *  phải chép lại câu rẽ nhánh này lần thứ hai. */
export const talkArt = (talk) => (talk.tip ? tipArt(talk.tip) : faceArt(talk.face));

/** Còn bao lâu thì đói hẳn — nói bằng giờ, vì đó là thứ quyết định "có phải cho ăn trước
 *  khi đi ngủ không". Dưới một giờ thì nói bằng phút. */
export function hungerText(pet, short = false) {
  const left = pet.full * pet.fullMs;
  if (left <= 0) return t(short ? 'pet.starvedShort' : 'pet.starved');
  const mins = Math.round(left / 60000);
  return mins < 60
    ? t(short ? 'pet.leftMinShort' : 'pet.leftMin', { n: mins })
    : t(short ? 'pet.leftHourShort' : 'pet.leftHour', { n: Math.round(mins / 60) });
}

/** Đã ngồi liền bao lâu. Cùng cặp dài/ngắn với `hungerText`, và cùng lý do. */
export const satText = (pet, short = false) =>
  pet.satMin > 0
    ? t(short ? 'pet.satMinShort' : 'pet.satMin', { n: pet.satMin })
    : t(short ? 'pet.satRestedShort' : 'pet.satRested');

/**
 * DẢI THÔNG SỐ — ba ô, và từ lượt này CẢ HAI bề mặt vẽ nó bằng đúng hàm này.
 *
 * ## Chỗ hỏng, và nó nhìn thấy được trên ảnh người dùng gửi
 *
 * Popover bày ba mảnh — thanh đói, đồng hồ cát, ví — **không nhãn và không một con số nào**
 * ngoài số xu. Ba hệ quả, và cả ba đều đo được chứ không phải cảm giác:
 *
 * 1. **Không có bậc.** Ba vật cùng một trọng lượng thị giác, trong khi chúng trả lời ba câu
 *    hỏi khác hẳn nhau. Mắt không có chỗ để bắt đầu.
 * 2. **Con số xu là CHỮ DUY NHẤT trong dải**, nên nó hút mắt trước — mà nó lại là thứ ít
 *    gấp nhất trong ba thứ. Cái gấp nhất (sắp hết nhịp ngồi) thì câm.
 * 3. **Hai câu quan trọng nhất bị mất.** "còn 2 giờ nữa thì đói" và "đã ngồi 42 phút liền"
 *    là hai điều **không suy ra được** từ mười cái ô và cái bầu cát — chính là loại chữ mà
 *    luật tooltip (lượt sáu §3) bắt phải ở lại trên trang. Màn Cửa hàng có chúng; popover
 *    thì không, và không ai viết ra vì sao.
 *
 * ## Phép sửa, và vì sao nó KHÔNG tốn thêm một pixel chiều cao
 *
 * Chiều cao của dải do cái đồng hồ cát đặt (36px) và nó không đổi được — hạ bán kính là đổi
 * hình học, xem `focusDial`. Nhưng chữ cao 11px thì nằm gọn trong 36px ấy, **nếu nó đứng
 * CẠNH hình chứ không đứng dưới**. Còn chỗ nằm ngang thì đang thừa: trên popover, khoảng
 * giữa cái đồng hồ cát và cái ví là đất trống, vì cái ví bị đẩy sang phải bằng `margin-left:
 * auto`. Hai câu chữ dọn vào đúng chỗ trống ấy.
 *
 * ## Trên popover chỉ MỘT câu chữ, không phải hai — và đây là chỗ đo bắt phải nghĩ lại
 *
 * Bản đầu của lượt này cho cả hai chỉ số một câu ngắn. Đo trên popover thật ở bề rộng nhỏ
 * nhất: ba ô cần **363px** trong một dải rộng **326px**, nên `flex-wrap` cứu bằng cách đẩy
 * cái ví xuống dòng hai và cửa sổ cao từ 47px lên **80px** — đúng thứ mà C9 cấm. Cắt chữ
 * cho vừa thì được, nhưng cắt cái nào là một quyết định, không phải một phép đo.
 *
 * Luật đã có sẵn để quyết: **tooltip chỉ được chở thứ suy ra được từ cái hình nó dán vào**
 * (lượt sáu §3) — nói ngược lại thì thứ KHÔNG suy ra được mới có quyền chiếm chỗ trên trang.
 * Áp vào hai chỉ số này thì chúng không đối xứng, và chỗ lệch nằm ở chỗ BÃO HOÀ:
 *
 * - **Thanh đói không bão hoà theo hướng đáng hỏi.** Mười ô, mỗi ô 30 phút; hết ô là đói
 *   lả, và "đói lả sâu tới đâu" thì không phải một câu hỏi có nghĩa — không có việc gì để
 *   làm khác đi. Cái hình đã nói đủ.
 * - **Đồng hồ cát BÃO HOÀ, và nó bão hoà đúng ở chỗ gấp nhất.** Chín hạt, mỗi hạt 10 phút.
 *   Ngồi 91 phút và ngồi 300 phút cho ra **cùng một cái bầu rỗng** — mà đó chính là quãng
 *   lời nhắc đang kêu, và chính là con số quyết định nghỉ 3 phút hay nghỉ 10 phút.
 *
 * Nên popover giữ đúng một câu: quãng đã ngồi liền. Con số độ no vẫn còn nguyên trong
 * `aria-label` và `title` của chính cái thanh, và bản đầy đủ của cả hai thì ở màn Cửa hàng.
 * Đo lại sau khi cắt: **292px**, dải về lại một dòng.
 *
 * Bản ngắn cũng không phải bản đầy đủ: "82 phút liền" thay cho "đã ngồi 82 phút liền".
 *
 * ## Thứ tự: no · nhịp · ví, giống nhau ở cả hai bề mặt
 *
 * Màn Cửa hàng trước lượt này mở bằng cái Ví, popover thì kết bằng nó. Không có lý lẽ nào
 * cho hai thứ tự, chỉ có hai lần viết. Giờ là một: hai chỉ số TRẠNG THÁI đứng trước, cái ví
 * đẩy sang phải cùng một kiểu ở cả hai chỗ. Ví đứng cuối vì nó là thứ người ta tra lúc sắp
 * mua, không phải thứ người ta liếc để biết mình đang thế nào — và cùng một lý do khiến nó
 * là ô duy nhất được canh phải: một cột số dóng thẳng mép phải thì đọc nhanh hơn.
 *
 * ## MỘT bề mặt, từ lượt 18 — và hai công tắc đã đi theo
 *
 * Hàm này từng nhận `compact` (bỏ nhãn) và `coin` (bỏ ô ví) để popover dùng chung. Lượt 18
 * đổi cái sổ trên popover sang chữ có màu (xem `statWords`), nên chỗ gọi thứ hai biến mất và
 * hai công tắc ấy thành hai nhánh không ai đi qua. Gỡ chứ không để lại: một tham số chỉ có
 * một giá trị được dùng là một tham số mời người sửa sau tin rằng nó còn có nghĩa.
 *
 * Luật thì không đổi và vẫn phải giữ: **cái ví không được lọt vào bức tranh popover**. Nó là
 * một CỬA — thứ duy nhất trong dải bấm vào thì đi đâu đó — nên nó ở hàng riêng có tên bên
 * dưới. Ở màn Cửa hàng thì nó không còn là cửa nữa: người dùng đã đứng trong tiệm rồi. Có
 * bài test canh cả hai chiều.
 */
/* ── SỔ TRẠNG THÁI BẰNG CHỮ ───────────────────────────────────────────────────

   Người dùng, lượt 18: *"bấm vào quản gia chỉ cần hiển thị trạng thái là No,…, Rất Đói.
   Nói chung là dùng chữ màu để hiển thị thay vì như hiện tại."*

   Cái sổ đang chở khay năm đĩa cộng mặt đồng hồ 28px — hai vật vẽ bằng pixel, cùng ngôn ngữ
   nét với bức tranh phía sau chúng. Đó chính là chỗ hỏng: chúng ĐỨNG TRÊN bức tranh và cãi
   nhau với nó bằng đúng thứ ngôn ngữ ấy. Chữ thì không cãi — nó thuộc lớp giao diện, và nó
   trả lời thẳng cái câu người ta bấm vào để hỏi ("tôi đang thế nào") thay vì bắt đếm ô.

   ## Ba kênh, xếp theo thứ tự đọc được

   1. **CHỮ** — kênh chính, và là kênh duy nhất không hỏng ở bất cứ theme nào.
   2. **SẮC** — kênh hai. Nó KHÔNG mượn băng hạn mức (`--crit`/`--warn`/`--ok`), cùng hàng
      rào đã ghi cho khay và cho mặt đồng hồ: mượn là mời người đọc áp thang "bỏ phí bao
      nhiêu" lên một cái bụng đói.
   3. **HÌNH** — kênh ba, và nó là điều kiện để kênh hai được phép tồn tại: thang no chạy từ
      lục sang đỏ, tức đúng cặp mà theme daltonized làm hết phân biệt. Nên bậc phải đọc được
      cả khi hai màu ấy trùng nhau — ở đây kênh hình là chính cái vạch mức dưới mỗi chữ.

   ## Lượt 19: MỘT lối vẽ, và màu thôi đọc theo TÊN

   Lượt 18 dựng ba lối (A chữ trơn, B thêm cột chấm, C chữ to trên một vạch mức) để người dùng
   nhìn thật rồi chọn. Chốt: **C**. Hai lối kia gỡ hẳn — một tham số chỉ còn một giá trị được
   dùng là một tham số mời người sửa sau tin rằng nó còn có nghĩa, đúng câu đã ghi khi gỡ
   `compact`/`coin` của `statCells`.

   Cùng lượt, người dùng chỉ ra chỗ hỏng thứ hai: *"có nhiều trạng thái cho từng loại no, hay
   tập trung quy về cùng màu xanh gần full → vàng → đỏ"*. Bản trước gán màu theo TÊN TRẠNG
   THÁI, và bảng ấy có hai lỗi đo được:

   1. **Bảy cái tên, bốn màu, hai thang.** `stuffed` và `sharp` chung một sắc lục, nhưng
      `stuffed` là ≥85% độ no còn `sharp` là bất cứ đâu trên 22% nhịp — cùng một màu lục đứng
      cạnh nhau trong một cái sổ hai dòng, nói hai chuyện khác hẳn nhau.
   2. **`fine` rơi ra ngoài thang.** Nó là kem (`#d9cfbe`), tức KHÔNG nằm trên đường lục → vàng
      → đỏ. Nên dải màu không đọc thành một thang; nó đọc thành bốn cái nhãn.

   Sửa: màu suy từ chính PHÂN SỐ mà cái vạch đang vẽ, không suy từ cái tên. Một thang liên tục,
   dùng chung cho cả hai dòng, và nó tự đúng ở mọi số bậc — bốn bậc no với ba bậc nhịp không
   còn phải khớp nhau nữa vì không còn bậc nào để khớp. Phép trộn nằm ở `styles.css` (xem
   `.mb-line`), chỗ này chỉ gửi sang con số.

   Chữ thì VẪN theo tên, và đó là chỗ hai kênh chia việc: tên nói *"đang ở nấc nào"*, màu nói
   *"còn bao nhiêu"*. Trước đây cả hai cùng nói câu thứ nhất, nên kênh màu không chở gì thêm.
*/

/**
 * Hai hàng của cái sổ, dựng một lần rồi ba lối vẽ cùng đọc. Nhịp tập trung vắng mặt ở sổ
 * đời cũ (`pet.focus` là `undefined`), và lúc ấy sổ còn đúng một hàng chứ không bày một
 * hàng rỗng — cùng luật với `focusDial`.
 *
 * ## Con số "đã ngồi bao lâu" KHÔNG vào đây, và nó không bị mất
 *
 * `statCells` có một luận điểm phải trả lời: mặt đồng hồ nhịp BÃO HOÀ — ngồi 91 phút và ngồi
 * 300 phút cho ra cùng một cái vành rỗng — nên con số phút phải ở lại trên trang. Chữ "Quá
 * nhịp rồi" bão hoà y hệt, nên đổi hình lấy chữ không tự nó giải quyết được gì.
 *
 * Nhưng con số ấy ĐÃ ở trên trang rồi, ngay dưới bức tranh: `nudgeOf` dựng câu nhắc bằng
 * chính `pet.satMin` ("Đã 82 phút ngồi liền…"), và nó hiện đúng ở quãng chỉ số bão hoà — cửa
 * duy nhất của nó là `focusMood === 'sharp'` thì im. Tức là hai thứ nói cùng một điều, ở hai
 * chỗ cách nhau 40px, và cái ở trong sổ là cái đến sau.
 *
 * Bỏ nó đi còn giải một chỗ đo được: sổ chỉ có 119px chữ trước khi chạm nét vẽ của quản gia
 * (mép trái tranh 6px + đệm 18px, thân người bắt đầu ở x=143). "Sắp hết nhịp" cộng "61 phút
 * liền" cần 132px, nên chúng xuống dòng và cái sổ cao thêm 15px để in lại một câu đã có.
 */
const clamp01 = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

const wordRows = (pet) => [
  { k: 'mood', word: t(`pet.mood.${pet.mood}`), frac: clamp01(pet.full) },
  ...(typeof pet.focus === 'number'
    ? [{ k: 'focus', word: t(`pet.focusMood.${pet.focusMood}`), frac: clamp01(pet.focus) }]
    : []),
];

/**
 * Sổ trạng thái bằng chữ — chữ làm tít, dưới nó một vạch mức 3px.
 *
 * `--f` là một SỐ TRẦN 0–1, không phải phần trăm, và đó là điều kiện chứ không phải khẩu vị:
 * cùng một biến vừa phải nhân ra bề rộng vạch (`calc(var(--f) * 100%)`) vừa phải chạy vào
 * `color-mix` để trộn ra sắc của thang. Một trị mang sẵn `%` thì phép trộn không nhân được
 * nữa, và lúc ấy màu với vạch phải đọc hai con số — tức hai bản của một phép đo.
 *
 * Ba chữ số lẻ: đủ mịn để một cái vạch 112px không nhảy bậc thấy được (0,001 × 112 = 0,1px),
 * và đủ ngắn để không rải một chuỗi 17 ký tự vào thuộc tính `style` của mỗi dòng.
 */
export function statWords(pet) {
  return html`${wordRows(pet).map(
    (r) => html`<span class="mb-line" style="--f:${r.frac.toFixed(3)}">
      <b class="mb-word">${r.word}</b>
      <i class="mb-lvl" aria-hidden="true"></i>
    </span>`,
  )}`;
}

export function statCells(pet, { bump = 0 } = {}) {
  const k = (key) => html`<b class="hud-k">${t(key)}</b>`;
  const say = (s) => html`<span class="hud-say">${s}</span>`;
  return html`<span class="hud-cell">
      ${k('pet.hunger')}${hungerTray(pet)}
      ${say(html`<b>${t(`pet.mood.${pet.mood}`)}</b> ${hungerText(pet)}`)}
    </span>
    ${typeof pet.focus === 'number'
      ? html`<span class="hud-cell">
          ${k('pet.focus')}${focusDial(pet)}
          ${say(html`<b>${t(`pet.focusMood.${pet.focusMood}`)}</b> ${satText(pet)}`)}
        </span>`
      : ''}
    <span class="hud-cell hud-coin">${k('pet.wallet')}${wallet(pet, bump)}</span>`;
}
