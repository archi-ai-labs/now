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
import { FOCUS_CELL_MS, FOCUS_MS, rampAt } from './petmath.js';

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
 * ## Luật của chỗ ĐỘI ĐẦU: sáu ô ngang, bốn hàng dọc, không hơn
 *
 * Nón SÁU ô, không phải tám. Đỉnh đầu quản gia chỉ rộng hai ô (`.......##.......`), nên
 * một cái nón tám ô ngồi lên đó trông như cái nón đang rơi qua người.
 *
 * Bốn hàng là TRẦN CỨNG, và nó là trần vật lý chứ không phải thẩm mỹ: thân quản gia dùng
 * trọn 16 hàng của khung 64px, khung ấy ngồi ở `bottom: 3px` trong một bầu trời cao 74px
 * có `overflow: hidden`, nên đỉnh đầu đã sát mép trên. Mũ cao hơn bốn hàng là mũ bị CẮT —
 * đã mất trắng một lần ở bản đầu, mua 70 xu xong không thấy gì. Xem `.slot-head` trong
 * `styles.css`.
 *
 * Ba món đội đầu vì thế chỉ khác nhau ở MÀU và ở đường viền trên, không khác ở chiều cao.
 */
const HAT = ['.####.', '.####.', '.bbbb.', '######'];

/** Mũ len: quả bông trên đỉnh và một vành gập ở dưới. Hai chi tiết ấy là toàn bộ chỗ để
 *  phân biệt nó với nón chóp trong bốn hàng chung. */
const BEANIE = ['..ff..', '.pppp.', 'pppppp', 'ffffff'];

/** Vương miện: ba chóp ở hàng đầu và hai viên đá. Nó là món đội đầu đắt nhất nên nó phải
 *  đọc ra "đắt" ngay từ silhouette, không đợi người ta so giá. */
const CROWN = ['g.gg.g', 'gggggg', 'gpggpg', 'gggggg'];

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
  '.ggggg.',
  'ggggggg',
  '.ggggg.',
  '...b...',
  '..bbb..',
  '.#####.',
  '..###..',
];

/** Bầu bóng phải CÓ MÀU. Bản đầu để nó lấy sắc gốc trắng ngà và đứng cạnh đám mây —
 *  một khối tròn trắng có cuống thì đọc thành cây kẹo mút, không đọc thành bóng bay. */
const BALLOON = ['.ppp.', 'ppppp', 'ppppp', 'ppppp', '.ppp.', '..p..', '..s..', '..s..'];

/** Cả ba món LƠ LỬNG chung khung 5×8, vì chúng chung một chỗ đứng có `animation: mb-float`
 *  — một vật cao 8 hàng và một vật cao 5 hàng bay cùng biên độ thì cái thấp trông như bị
 *  giật. Khác nhau ở dáng: bóng tròn, diều thoi, đèn lồng hộp. */
const KITE = ['..k..', '.kkk.', 'kkkkk', '.kkk.', '..k..', '..s..', '.s...', '..s..'];

/** Đèn lồng: nắp và tua đều bằng vàng, thân đỏ hồng. Cái tua thẳng đứng dưới đáy là chỗ
 *  duy nhất tách nó khỏi quả bóng bay ở cỡ 20px — nên nó dài hai ô, không phải một. */
const LANTERN = ['..g..', '.rrr.', 'rrrrr', 'rrrrr', 'rrrrr', '.rrr.', '..g..', '..g..'];

/** Dây cờ: một sợi kẻ rồi năm lá cờ tam giác treo dưới. Ba màu xoay vòng chứ không phải
 *  năm — năm màu trên một dải 76px thì mắt đọc thành nhiễu, không đọc thành dây cờ. */
const BUNTING = ['###################', 'aaa.bbb.ccc.aaa.bbb', '.a...b...c...a...b.'];

/** Dây đèn nháy: cùng sợi kẻ với dây cờ, nhưng thứ treo dưới là mấy bóng RỜI cao hai ô
 *  thay vì mấy tam giác liền. Hai màu xen kẽ, không ba — ít hơn dây cờ một bậc để hai món
 *  treo cùng chỗ vẫn khác nhau ở mật độ chứ không chỉ ở hình. */
const LIGHTS = ['###################', '.g...p...g...p...g.', '.g...p...g...p...g.'];

const CAT = ['#.....#', '##...##', '#######', '#o###o#', '##ooo##', '.#####.', '.##.##.'];

/** Chó: tai VUÔNG cụp hai bên, thân nâu, mắt tối. Mèo bên cạnh là tai nhọn loe ra, thân
 *  trắng ngà, mắt vàng — ba kênh khác nhau, vì hai con vật cùng khung 7×7 mà chỉ khác
 *  đúng cái tai thì ở 28px chúng là một. */
const DOG = ['bb...bb', 'bbbbbbb', 'bobbbob', 'bbbbbbb', 'bbbobbb', '.bbbbb.', '.b...b.'];

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
  '...aaaaaaaa...',
  '..a........a..',
  '..a.bbbbbb.a..',
  '.a..b....b..a.',
  '.a..b.cc.b..a.',
  '.a..b.cc.b..a.',
];

/**
 * Dãy đồi: khối ĐẶC, hai đỉnh, và rộng 104px — **rộng hơn hẳn thân quản gia**.
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
  '...ggggg.........ggggg....',
  '.gggggggggg....gggggggggg.',
  'gggggggggggggggggggggggggg',
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

  beanie: { rows: BEANIE, chars: { p: 'plum', f: 'foam' } },
  hat: { rows: HAT, chars: { b: 'gold' } },
  crown: { rows: CROWN, chars: { g: 'gold', p: 'plum' } },

  cactus: { rows: CACTUS, chars: { g: 'leaf' } },
  plant: { rows: PLANT, chars: { g: 'leaf' } },
  bonsai: { rows: BONSAI, chars: { g: 'leaf', b: 'broth' } },

  mushroom: { rows: MUSHROOM, chars: { r: 'rose', f: 'foam' } },
  dog: { rows: DOG, chars: { b: 'broth', o: 'ink' } },
  cat: { rows: CAT, chars: { o: 'gold' } },

  balloon: { rows: BALLOON, chars: { p: 'plum', s: 'steam' } },
  // Đuôi diều lấy `foam` chứ không lấy `steam` như dây bóng bay: `steam` là trắng 45% và
  // ba ô rời rạc ở độ mờ ấy thì biến mất trên nền trời đêm — mà cái đuôi so le mới là thứ
  // nói đây là con diều chứ không phải một viên kim cương.
  kite: { rows: KITE, chars: { k: 'sky', s: 'foam' } },
  lantern: { rows: LANTERN, chars: { r: 'rose', g: 'gold' } },

  bunting: { rows: BUNTING, chars: { a: 'gold', b: 'leaf', c: 'plum' } },
  lights: { rows: LIGHTS, chars: { g: 'gold', p: 'rose' } },

  hills: { rows: HILLS, chars: { g: 'leaf' } },
  rainbow: { rows: RAINBOW, chars: { a: 'gold', b: 'leaf', c: 'plum' } },
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
  if (!eat) {
    return html`<span class="pet-art ${cls}" style="${box}">${pixels(a.rows, a.chars, false)}</span>`;
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

/** Hình của việc ĐANG LÀM — một cửa cho cả hai bảng, vì chỗ gọi chỉ có `doing.kind`. */
export const doingArt = (doing) =>
  doing ? (doing.kind === 'move' ? moveArt(doing.id, doing) : itemArt(doing.id, doing)) : '';

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
 * Số ô của thanh ĐÓI. Mười, vì mười là số duy nhất mà một phần trăm đọc thẳng ra số ô mà
 * không phải tính: ba ô sáng là 30%, không cần biết gì thêm. Một ô = 30 phút của 5 giờ.
 */
const FULL_CELLS = 10;

/**
 * Số ô của thanh TẬP TRUNG — chín, một ô một mười phút (xem `FOCUS_CELL_MS`).
 *
 * Suy ra chứ không gõ: đổi `FOCUS_MS` là số ô đi theo, và không có lần nào cái thanh còn
 * chia 90 phút thành 10 ô 9 phút — một đơn vị không ai đọc ra.
 */
const FOCUS_CELLS = Math.round(FOCUS_MS / FOCUS_CELL_MS);

/**
 * Số ô SÁNG của một chỉ số 0–1.
 *
 * Còn một chút thì LUÔN sáng ít nhất một ô. Làm tròn trơn thì 4% ra 0 ô, tức một cái thang
 * rỗng trơn trong khi con vật chưa cạn — và đó đúng là lúc người ta cần thấy nó còn thoi
 * thóp nhất. Cạn hẳn mới được tối hết.
 */
const litOf = (value, cells) => (value <= 0 ? 0 : Math.max(1, Math.round(value * cells)));

/**
 * Hai chỉ số này TỪNG là một hàm, và lượt 5/8 tách chúng ra. Đây là lý do.
 *
 * Bản cũ vẽ cả hai bằng cùng một cái thanh ô vuông, khác nhau ba thứ: mười ô với chín, một
 * cái khe sau ô thứ hai, và ô hẹp hơn (4–5px thay vì 7–9px). Ba kênh ấy đọc được trên giấy.
 * Trên màn hình thì không, và đo ra thì rõ vì sao:
 *
 * - **Ô 5px, khe 2px.** Tỉ lệ ấy không đọc thành "ô đếm được", nó đọc thành GẠCH CHÉO —
 *   mắt thấy một mảng vân tím, không thấy chín phần. Ô no 9px cạnh khe 2px thì đếm được;
 *   thu nhỏ cùng một hình không giữ được cùng một cách đọc.
 * - **Mất ô tối là mất MẪU SỐ.** Ô chưa sáng là `--text-3` ở 24% — rộng 9px thì thấy, rộng
 *   5px thì gần như tàng hình trên `--panel`. Ở mức 79% chỉ còn hai ô tối, tức 12px trên
 *   75px: cái thanh trông như vừa hết chỗ chứ không như còn hai phần. Không có mẫu số thì
 *   không có giá trị nào cả — chỉ còn một vệt tím dài ngắn tuỳ lúc.
 * - **Chín ô hẹp cạnh mười ô bè vẫn là "thanh cạnh thanh".** Chênh một ô và chênh vài pixel
 *   bề rộng là khác biệt về CỠ, không phải về LOẠI. Mà thứ phải đọc ra ngay là hai đại
 *   lượng khác nhau, không phải cùng một đại lượng ở hai cỡ.
 *
 * Nên tập trung bỏ hẳn hình cái thanh. Bản kế là một MẶT ĐỒNG HỒ chín chấm, và nó sập vì
 * một lý do khác hẳn — xem `focusGlass`. Cái còn lại ở đây là thanh đói, giữ nguyên mọi
 * lý lẽ cũ của nó.
 *
 * ## Thanh đói — mười ô rời, không phải một vệt liền
 *
 * Nó vẫn KHÔNG mượn `quotaBar`, và lý do cũ còn nguyên: thanh hạn mức chở một luật đọc rất
 * riêng — "đã tiêu" là số dẫn, kênh màu đo đúng một đại lượng là phần bỏ phí (luật 1 trong
 * CLAUDE.md) — nên cho một thanh trò chơi mượn hình dáng ấy là mời người đọc áp cùng luật
 * lên một thứ không có luật đó.
 *
 * Bản trước nữa là một viên thuốc bo tròn cao 6px, phần lấp trượt mượt theo phần trăm. Nó
 * đứng ngay dưới một bức tranh dựng toàn ô 4px, và nó là vật DUY NHẤT trong khung ấy có
 * cạnh cong. Khác biệt đó không đọc thành "thanh này quan trọng hơn"; nó đọc thành "thanh
 * này dán từ chỗ khác vào".
 *
 * Chia mười ô là LÀM TRÒN, không phải nói dối: con số thật vẫn nằm nguyên trong
 * `aria-label` và trong tooltip, còn câu "còn N giờ nữa thì đói" ngay bên cạnh vẫn tính từ
 * `pet.full` chưa làm tròn.
 *
 * Tên trạng thái ("Ổn", "Đói lả") nằm trong `title` chứ không còn là chữ trên trang, và đó
 * là một ranh giới có luật chứ không phải một phép cắt cho gọn: **tooltip chỉ được chở thứ
 * suy ra được từ chính cái hình nó dán vào**. Tên trạng thái tính thẳng từ `pet.full` —
 * ai đọc được cái thang thì đã biết nó. Còn "còn 2 giờ nữa thì đói" thì KHÔNG suy ra được
 * từ mười cái ô, nên nó ở lại trên trang.
 */
export function hungerBar(pet) {
  const aria = t('pet.fullAria', { pct: Math.round(pet.full * 100) });
  const lit = litOf(pet.full, FULL_CELLS);
  return html`<span class="pet-bar mood-${pet.mood} ${rising(pet, 'fedFrom') ? 'rising' : ''}"
    role="img" aria-label="${aria}" title="${t(`pet.mood.${pet.mood}`)} · ${aria}"
    >${Array.from({ length: FULL_CELLS }, (_, i) => html`<i class="${i < lit ? 'on' : ''}"></i>`)}</span
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
 * Bề rộng từng hàng của MỘT bầu đồng hồ cát, đếm từ CỔ ra: 1, 3, 5, …
 *
 * Sinh ra chứ không gõ tay, cùng luật với `diamond`/`box` bên `town.js`: số hạt là
 * `FOCUS_CELLS`, mà `FOCUS_CELLS` suy từ `FOCUS_MS / FOCUS_CELL_MS` — nên đổi chu kỳ là
 * cái bầu tự chia lại, không có bản chép nào lệch đi một hàng.
 *
 * Tổng k hàng đầu của dãy lẻ là đúng `k²`, nên số hạt vừa khít một bầu tam giác khi và chỉ
 * khi nó là số chính phương. Chín hạt = 3², vừa khít ba hàng. KHÔNG có nhánh nào xử lý ca
 * không vừa: hàng cuối sẽ hụt, cái bầu sẽ vẹt một góc, và có phép kiểm bắt đúng chuyện ấy
 * (xem `test/pet.test.js`). Đó là chỗ muốn nó gãy to — một cái bầu vẹt góc thì nhìn màn
 * hình là thấy, nhưng chỉ thấy nếu ai đó tình cờ mở đúng lúc.
 */
export function bulbRows(cells) {
  const rows = [];
  for (let w = 1, left = cells; left > 0; w += 2) {
    rows.push(Math.min(w, left));
    left -= w;
  }
  return rows;
}

/**
 * Lưới ký tự của cái đồng hồ cát ở mức `lit` hạt CÒN Ở BẦU TRÊN.
 *
 * `k` là khung (hai nắp, hai vách, cái cổ), `s` là cát CÒN LẠI ở bầu trên, `d` là cát ĐÃ
 * CHẢY xuống bầu dưới. Chỗ trống thì không vẽ gì cả.
 *
 * ## Cát BẢO TOÀN, và đó là chỗ sửa đời trước
 *
 * Luôn vẽ đủ `cells` hạt — cạn đi ở trên thì đầy lên ở dưới, không hạt nào biến mất. Cái
 * thanh đời đầu hỏng vì mất ô tối là mất mẫu số; mặt đồng hồ chín chấm sửa được chuyện ấy
 * nhưng phải trả bằng một vành chấm rời rạc mà nhìn màn hình thì đọc thành nhiễu. Ở đây
 * mẫu số không phải một cái vành mờ vẽ thêm cho đủ — nó CHÍNH LÀ đống cát ở bầu dưới, thứ
 * vốn đã phải vẽ. Một hình có nghĩa ở cả hai nửa thì không còn nửa nào là phần thừa.
 *
 * ## Hai loại cát, và đó là chỗ sửa của lượt này
 *
 * Người dùng báo: "đồng hồ cát khá khó nhìn để biết được tình trạng tập trung là thế nào".
 * Đo lại thì lỗi nằm ở đúng cái tính chất vừa khen ở trên. Bảo toàn thì đúng, nhưng bản
 * trước vẽ CẢ HAI đống cát bằng một sắc: ở mức 10% màn hình có một hạt tím trên và tám hạt
 * tím dưới, tức mắt phải so TỈ LỆ giữa hai đống trông y hệt nhau, trên một hình cao 36px.
 * Cái thanh đói ngay cạnh không bắt ai làm thế: ô sáng là xanh, ô tắt là xám, đọc một kênh
 * là xong.
 *
 * Nên bầu dưới đổi sang sắc "đã tắt", đúng vai ô tối của `.pet-bar`. Mẫu số vẫn còn nguyên
 * (đống xám vẫn đó, vẫn đếm được), mà câu hỏi "còn bao nhiêu" giờ chỉ cần nhìn phần CÓ MÀU.
 *
 * ## Vách kính, và vì sao chúng phải có kể từ lượt này
 *
 * Bản trước lấp lòng bầu bằng một sắc xám nhạt (`-`), nên hình cái bầu do chính lớp lót ấy
 * vẽ ra. Lớp lót đó giờ phải bỏ: nó là sắc xám thứ ba đứng cạnh đống cát đã tắt cũng xám,
 * và hai bậc xám cạnh nhau ở cỡ 4px thì đọc thành một (cùng lý lẽ đã ghi cho `--text-2` với
 * `--text-3` ở `.pet-glass`). Bỏ lớp lót thì một cái bầu rỗng chỉ còn hai cái nắp — hình
 * mất luôn.
 *
 * Vách trả lại cái hình ấy, và trả bằng thứ đúng hơn: đường viền của một cái bầu là VÁCH
 * KÍNH, không phải phần không khí bên trong. Vách nằm đúng hai cột mà nắp vẫn luôn nhô ra,
 * nên bề rộng không đổi — 7×9 ô, vẫn 28×36px.
 *
 * Bầu TRÊN đổ từ cổ lên (cát nằm dưới đáy bầu trên, đúng như trọng lực), bầu DƯỚI đổ từ
 * đáy lên (đống cát chất từ dưới). Hàng lẻ dở thì lấp từ giữa ra hai bên — cát rơi thành
 * đống chứ không thành một lớp phẳng.
 */
export function glassRows(lit, cells = FOCUS_CELLS) {
  const bulb = bulbRows(cells);
  const w = Math.max(...bulb) + 2;
  const mid = (w - 1) / 2;
  const grid = Array.from({ length: bulb.length * 2 + 3 }, () => Array(w).fill('.'));
  grid[0].fill('k');
  grid[grid.length - 1].fill('k');
  // Một hàng của lòng thuỷ tinh rộng `rw`: hai vách kính, rồi `n` hạt đổ từ giữa ra hai bên.
  const row = (y, rw, n, ch) => {
    grid[y][mid - (rw + 1) / 2] = 'k';
    grid[y][mid + (rw + 1) / 2] = 'k';
    for (let i = 0; i < n; i++) grid[y][mid + (i % 2 ? (i + 1) / 2 : -i / 2)] = ch;
  };
  // Cái eo: lòng rộng đúng một ô, và ô ấy là KHUNG chứ không phải cát — cát chảy QUA cổ, nó
  // không đọng ở đấy, nên một hạt nằm cổ là một hạt đếm hai lần.
  row(bulb.length + 1, 1, 1, 'k');
  let up = Math.max(0, Math.min(cells, lit));
  let down = cells - up;
  bulb.forEach((rw, d) => {
    row(bulb.length - d, rw, Math.min(rw, up), 's');
    up -= Math.min(rw, up);
  });
  for (let d = bulb.length - 1; d >= 0; d--) {
    row(bulb.length + 2 + d, bulb[d], Math.min(bulb[d], down), 'd');
    down -= Math.min(bulb[d], down);
  }
  return grid.map((r) => r.join(''));
}

/**
 * Tập trung — một ĐỒNG HỒ CÁT. Xem `hungerBar` để biết vì sao nó không còn là cái thanh.
 *
 * Độ no là chuyện của con vật và bạn vặn được nó bằng cách bấm mua. Cái này là chuyện của
 * NGƯỜI ĐANG NGỒI ĐÂY: nó cạn theo số phút bạn không rời máy, và thứ đổ đầy nó là bạn đứng
 * dậy — bao nhiêu thì tuỳ bạn đi tới đâu (xem `back` trong `MOVES`).
 *
 * ## Mặt đồng hồ chín chấm đã thử, và nó xấu — đây là lý do, không phải khẩu vị
 *
 * Bản trước xếp chín chấm 4px quanh một vành bán kính 4 ô. Nó sửa được đúng cái lỗi mẫu số
 * của thanh cũ, và nó vẫn hỏng, vì một chuyện khác: **chín chấm rời trên một vành không
 * hợp lại thành một VẬT.** Mọi hình khác trong màn này — quản gia, bát phở, đồng xu, năm
 * toà nhà — đều là khối liền có khung có bóng; giữa chúng, một chùm chấm cách nhau 2,8 ô
 * đọc thành mấy hạt bụi còn sót lại của một hình chưa vẽ xong. Lưới 4px không đủ mịn để
 * một đường tròn 9 điểm ra đường tròn: ba chấm trên cùng lệch nhau 1 ô theo phương đứng,
 * và ở cỡ 36px mắt đọc chỗ lệch ấy thành hình méo chứ không thành cung tròn.
 *
 * Đồng hồ cát thì ngược lại ở đúng ba chỗ đó: nó là một khối LIỀN có khung, nó vẽ được
 * bằng hàng ngang thẳng nên lưới 4px không phá được nó, và nó vẫn khác LOẠI so với cái
 * thanh — đứng, có eo, cát dồn về một đầu.
 *
 * Cái nó lấy lại được mà mặt đồng hồ không có: **nghĩa đúng.** Chỉ số này đo số phút đã
 * ngồi liền trong một chu kỳ 90 phút. Đồng hồ cát là cái người ta vẽ khi muốn nói "một
 * quãng thời gian đang chảy hết", và lúc nghỉ thì nó LẬT — cát về lại bầu trên, đúng nghĩa
 * "đồng hồ ngồi chạy lại từ đầu" mà `resolveBreak` đang làm với `restedAt`.
 *
 * ## Cỡ: MỘT, và vẫn không đổi theo bề mặt
 *
 * Lý do y như bản trước và nó không phụ thuộc vào hình: thanh đói đổi `--cell` theo bề mặt
 * nhưng đó là đổi BỀ DÀY — vẫn mười ô, vẫn đúng hình ấy. Đồng hồ cát thu nhỏ thì phải bớt
 * HÀNG, mà bớt hàng là đổi số hạt, tức đổi luôn đơn vị mười phút một hạt. 7×9 ô = 28×36px,
 * hẹp hơn mặt đồng hồ cũ 8px và cao đúng bằng.
 *
 * Sổ đời cũ chưa có trường này thì `pet.focus` là `undefined`; trả chuỗi rỗng chứ không vẽ
 * một cái đồng hồ rỗng, cùng luật với nhánh "trò chơi đang tắt" ở khung cảnh — một chỗ
 * trống đang chờ dữ liệu thì tệ hơn hẳn một chỗ không có gì.
 */
export function focusGlass(pet) {
  if (typeof pet.focus !== 'number') return '';
  const aria = t('pet.focusAria', { pct: Math.round(pet.focus * 100) });
  const rows = glassRows(litOf(pet.focus, FOCUS_CELLS));
  return html`<span class="pet-glass mood-${pet.focusMood} ${rising(pet, 'restedFrom') ? 'rising' : ''}"
    role="img" aria-label="${aria}" title="${t(`pet.focusMood.${pet.focusMood}`)} · ${aria}"
    style="width:${rows[0].length * 4}px;height:${rows.length * 4}px"
    >${pixels(rows, { k: 'frame', s: 'sand', d: 'spent' }, false)}</span
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
export function nudgeText(pet, now = new Date()) {
  if (!pet || pet.focusMood == null || pet.focusMood === 'sharp') return '';
  const h = now.getHours();
  const n = pet.satMin;
  if (h >= 22 || h < 5) return t('pet.nudge.night', { n });
  if (h >= 13 && h < 16) return t('pet.nudge.afternoon', { n });
  return t(pet.focusMood === 'spent' ? 'pet.nudge.spent' : 'pet.nudge.dip', { n });
}

/** Còn bao lâu thì đói hẳn — nói bằng giờ, vì đó là thứ quyết định "có phải cho ăn trước
 *  khi đi ngủ không". Dưới một giờ thì nói bằng phút. */
export function hungerText(pet) {
  const left = pet.full * pet.fullMs;
  if (left <= 0) return t('pet.starved');
  const mins = Math.round(left / 60000);
  return mins < 60 ? t('pet.leftMin', { n: mins }) : t('pet.leftHour', { n: Math.round(mins / 60) });
}
