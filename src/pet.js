/**
 * Quản gia nuôi được — sổ xu, cơn đói, và cái cửa hàng.
 *
 * ## Vì sao lớp này được phép tồn tại, sau khi `d-game` đã gỡ đúng một lớp như thế
 *
 * Chốt `d-game` (xem `design/README.vi.md`) đã bỏ XP và hạng D→S, vì chúng phạm nguyên
 * tắc lớn nhất của dự án — *mọi con số phải có thật*. XP cũ = `việc×25 + chuỗi×30 +
 * board×10`: ba đầu vào thật, ba **trọng số bịa**, rồi quy thành một hạng chữ cái đứng
 * ngay cạnh mấy con số đo được và trông cũng y như một phép đo.
 *
 * Lớp này khác ở ba chỗ, và cả ba đều là điều kiện để nó ở lại:
 *
 * 1. **Không có trọng số nào để bịa.** Tỉ giá là `1 xu = $1` — xem `RATE`. Không phải
 *    một hệ số chọn cho "cảm giác đúng"; nó là chính con số đô-la, chỉ đổi tên. Muốn
 *    biết mình có bao nhiêu xu thì cứ đọc hoá đơn ước tính, không cần học phép quy đổi.
 * 2. **Đồng xu không giả vờ đo cái gì.** Hạng `S` nói với người đọc rằng họ đã được
 *    ĐÁNH GIÁ. Một con thú ăn hết bát phở thì không ai nhầm là số liệu.
 * 3. **Nó không đứng trên mặt số liệu.** Ví xu và cửa hàng ở màn riêng, nhân vật ở
 *    popover. Không một con số thật nào bị dán nhãn mới, không một thẻ hạn mức nào mọc
 *    thêm huy hiệu.
 *
 * Và nó THUẬN với luận điểm gốc chứ không cãi lại: luật 1 trong `CLAUDE.md` — *tiêu hết
 * là ĐÍCH*. Hạn mức trả trước không cộng dồn, phần chưa dùng lúc reset là mất trắng. Nên
 * thưởng theo tiền đã tiêu là thưởng đúng cái hành vi dự án này vẫn cổ vũ; nó không đẻ
 * ra một động cơ mới nào ngoài cái đã có.
 *
 * ## Cơn đói cũng là một số đo được
 *
 * Nó là **khoảng thời gian kể từ lần cho ăn cuối** — một hiệu số hai mốc đồng hồ, đọc ra
 * từ sổ, không phải một thanh tự tụt theo luật chơi nào. Chỗ duy nhất do người đặt là
 * `FULL_MS` (bao lâu thì hết no), và nó là một hằng số công khai chứ không phải trọng số
 * ẩn trong một tổng.
 *
 * ## Sổ nằm ở đâu, và vì sao không nằm trong localStorage
 *
 * `~/.now-dashboard/pet.json`, cạnh `usage-rollup.json`. Hai lý do:
 * - Nguồn tiền là số do SERVER tính (`collect/usage.js` đọc transcript). Để trình duyệt
 *   giữ sổ thì trình duyệt cũng phải tự cộng tiền, tức là tự đặt giá cho chính mình.
 * - Popover và dashboard là hai trang. Chúng chung origin nên chung được `localStorage`
 *   thật, nhưng xoá dữ liệu duyệt web một lần là mất sạch xu — mà xu thì đổi từ một
 *   khoản chi có thật.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './config.js';
import {
  BREAK_MS, EAT_MS, FOCUS_MS, FULL_MS, MOVES, MOVE_IDS, REST_RAMP_MS,
  clamp01, doingOf, focusAt, focusMoodOf, fullnessAt, moodOf, satMinAt,
} from '../public/lib/petmath.js';

/**
 * Hằng số và phép suy của mô hình sống ở `public/lib/petmath.js`, không ở đây.
 *
 * Chiều nhập ngược đời (server nhập từ thư mục của trình duyệt) là CỐ Ý: trình duyệt
 * không nạp được `src/`, còn cả hai bên thì phải dùng ĐÚNG một công thức — từ lúc popover
 * vẽ từ bản nhớ trong `localStorage`, trình duyệt buộc phải tự tính lại độ no và độ tập
 * trung theo đồng hồ của nó. Xem khối đầu của `petmath.js`.
 *
 * Bày lại ra đây để mọi chỗ đang nhập từ `src/pet.js` không phải đổi, và để file này vẫn
 * là một cửa duy nhất cho phía server.
 */
export { BREAK_MS, EAT_MS, FOCUS_MS, FULL_MS, MOVES, MOVE_IDS, REST_RAMP_MS, doingOf, focusMoodOf, moodOf };

export const PET_FILE = path.join(DATA_DIR, 'pet.json');

/**
 * Tỉ giá: **1 xu cho mỗi $1 tiêu ước tính**.
 *
 * Cố ý là 1, không phải 10 hay 0,5. Hễ tỉ giá khác 1 là lập tức có một con số phải giải
 * thích ("sao $50 lại ra 500 xu?"), và cái phép nhân ấy đúng là loại trọng số mà `d-game`
 * đã gỡ. Để nó bằng 1 thì ví xu ĐỌC RA CHÍNH hoá đơn: 213 xu nghĩa là $213 đã tiêu kể từ
 * ngày mở sổ. Không có gì để học thuộc.
 *
 * Giá hàng hoá vì thế phải neo theo nhịp tiêu thật, không neo theo cảm giác. Đo trên máy
 * này 5/8: $50/ngày, $963/tuần — nên một món ăn 0,3–1,4 xu là chuyện trong buổi, còn một
 * món trang trí 60–320 xu là chuyện vài ngày tới vài tuần. Xem `COIN_PER_HOUR` để biết
 * bên đồ ăn con số ấy suy ra từ đâu.
 */
export const RATE = 1;

/**
 * Làm tròn tới hai chữ số thập phân — cùng độ mịn mà màn hình bày ra.
 *
 * Đi vòng qua `toFixed(6)` chứ không nhân-làm tròn-chia thẳng, vì phép nhân 100 tự nó đã
 * lệch: `0.29 * 100` ra `28.999999999999996`, và `Math.floor` của số đó là 28 — một xu bốc
 * hơi mỗi lần bày ra màn hình. Cắt phần đuôi rác ở chữ số thứ sáu rồi mới làm tròn thì
 * không còn ca nào như thế.
 */
const at2 = (n, round) => round(Number((n * 100).toFixed(6))) / 100;
export const round2 = (n) => at2(n, Math.round);
/**
 * Làm tròn XUỐNG, và chiều làm tròn ở đây là một quyết định chứ không phải sở thích.
 *
 * Ví bày ra màn hình phải KHÔNG BAO GIỜ lớn hơn ví thật. Làm tròn gần nhất thì một sổ có
 * 11,996 xu hiện thành "12,00" ngay cạnh một món giá 12 — người ta bấm, `buy()` so số thật
 * và từ chối, còn màn hình thì vẫn đang nói họ có vừa đủ. Làm tròn xuống thì phía trình
 * duyệt luôn khắt khe hơn hoặc bằng server, và ca "nhìn thấy đủ mà bấm không được" không
 * tồn tại.
 */
export const floor2 = (n) => at2(n, Math.floor);

/**
 * Giá đồ ăn = **số GIỜ nó mua cho bạn**, ở tỉ giá 1 xu một giờ.
 *
 * ## Vì sao có công thức thay vì chín con số chọn tay
 *
 * Bảng cũ là chín con số đặt bằng cảm giác (6, 7, 9, 9, 10, 12, 14, 16, 26), và một bảng
 * như thế thì không kiểm được: nó đã lọt hai ca một món ĐÈ BẸP món khác — cà phê 6 xu vừa
 * rẻ hơn vừa hơn sô-cô-la 7 xu ở cả no lẫn tỉnh táo, còn trà xanh 9 xu thì hơn hẳn kem 9
 * xu mà cùng giá. Không ai phát hiện ra vì chẳng có luật nào để đối chiếu.
 *
 * Suy từ công thức thì hai ca ấy không dựng lên được: trả nhiều hơn là nhận nhiều hơn,
 * theo đúng nghĩa đen. Và nó hợp luật lớn nhất của dự án hơn hẳn — giá không còn là chín
 * trọng số bịa, nó là một phép đổi đơn vị.
 *
 * ## Tỉ giá
 *
 * **0,2 xu một giờ no.** Một thanh no đầy (16 giờ) giá 3,2 xu; ghép với `RATE` (1 xu = $1)
 * thì cả cửa hàng vẫn rút về một câu: *20 cent token đổi được một giờ no.* Vẫn chỉ có một
 * con số phải nhớ — nó chỉ không còn là 1.
 *
 * Vì giá một món là số GIỜ nó mua, đổi `FULL_MS` không đụng tới ví (món đắt hơn thì no lâu
 * hơn đúng cùng tỉ lệ — bằng chứng cho luật lượt 15, không cơ chế nào được chạm vào ví),
 * còn đổi HỆ SỐ này là đổi ví một cách công khai, ở đúng một chỗ.
 *
 * Tập trung tính cùng tỉ giá ấy trên `FOCUS_MS` — một nhịp 60 phút là một giờ, nên phần
 * tỉnh táo của một món cộng thêm tối đa 0,2 xu. Nó RẺ HƠN thanh no và đúng là phải thế: thứ
 * đắt tiền là cái bụng, còn sự tỉnh táo thì có một đường miễn phí về đầy (xem `MOVES`), nên
 * không món bán nào được định giá như thể nó là đường duy nhất.
 *
 * ## Sử ký: 1 → 0,2, ngày 9/8
 *
 * Bảng đầu tiên đặt hồi `FULL_MS` còn 20 giờ; đồng hồ đói sau đó nhanh lên gấp bốn mà giá
 * đứng yên, nên một ngày 10 tiếng tốn 50–60 xu — TRỌN thu nhập một ngày nhẹ (đo trên máy
 * này: $50/ngày nhẹ, $120/ngày nặng). Bậc 1 xu/giờ sửa ca đó: còn 10 xu một ngày, 20% của
 * ngày nhẹ.
 *
 * Người dùng vẫn thấy đắt — *"giá tiền mua thức ăn đang hơi đắt → giảm 80%"* — và họ đúng
 * ở một chỗ đo được: cho ăn là việc BẮT BUỘC vài lần một ngày (đói lả là trạng thái chặn
 * mọi thứ khác), mà một khoản chi bắt buộc ăn 20% ngân sách ngày thì cửa hàng trang trí —
 * thứ tự chọn duy nhất trong tiệm — chỉ còn nhận phần thừa. Ở 0,2: một ngày 10 tiếng ăn
 * hết 2 xu, 4% của ngày nhẹ; phần còn lại của ví dồn cho cái đích dài hạn. Đồ trang trí
 * giữ nguyên giá và đó là chủ ý — chúng không mua thứ gì đo được nên không có công thức
 * nào cho chúng, và hạ cả hai đầu thì phép giảm không đổi được cán cân nào.
 */
export const COIN_PER_HOUR = 0.2;
const priceOf = ({ fill = 0, wake = 0 }) =>
  round2(((fill * FULL_MS + wake * FOCUS_MS) / 3600000) * COIN_PER_HOUR);

/**
 * Món ăn — khai bằng thứ chúng CHO, giá tự suy ra.
 *
 * `fill` = phần thanh đói được lấp lại, 0..1.
 *
 * ## `wake` — và cái trần cố ý của nó
 *
 * `wake` = phần TẬP TRUNG lấy lại. Caffeine chẹn thụ thể adenosine nên nó hoãn cảm giác
 * mệt thật — hoãn, không xoá. Vì thế cà phê là 0,4 chứ không phải 1: một ly kéo lại chừng
 * 35 phút của chu kỳ 90 phút, còn muốn về đầy thì phải đứng dậy. Cho nó bằng 1 là dựng
 * một cái nút "bấm để hết mệt", tức là dạy đúng thói quen mà cả lớp chỉ số này sinh ra để
 * cản.
 *
 * Từ lúc có nhiều món tỉnh táo thì cái trần ấy thành một LUẬT, không còn là một ca lẻ:
 * **không món bán nào được `wake` quá 0,5.** Ba món hiện có là 0,40 / 0,25 / 0,15, và
 * chúng cộng dồn được — nhưng chúng cũng lấp thanh đói cùng lúc, nên uống ba ly liên tiếp
 * là no căng chứ không phải tỉnh táo. Đường duy nhất về đầy 100% là đứng dậy (xem `MOVES`
 * trong `petmath.js`), và đường ấy miễn phí. Cửa hàng phải nói được điều đó bằng chính
 * bảng giá của nó, không phải bằng một câu khẩu hiệu ở chân trang.
 *
 * Cả ba đều có nền, không phải chọn cho vui:
 * - **Cà phê 0,40** — caffeine, tác dụng rõ nhất và cũng ngắn nhất.
 * - **Trà xanh 0,25** — L-theanine đi cùng caffeine, tỉnh êm hơn, ít trồi sụt hơn.
 * - **Sô-cô-la 0,15** — theobromine cộng một ít caffeine; nhẹ, và trung thực là nhẹ.
 */
const FOOD_SPEC = {
  coffee: { fill: 0.25, wake: 0.4 }, //  0,52 xu
  socola: { fill: 0.15, wake: 0.15 }, // 0,29
  tea: { fill: 0.2, wake: 0.25 }, //     0,40
  kem: { fill: 0.2 }, //                 0,32
  che: { fill: 0.35 }, //                0,56
  beer: { fill: 0.3 }, //                0,48
  banhmi: { fill: 0.5 }, //              0,80
  xoi: { fill: 0.6 }, //                 0,96
  pho: { fill: 0.9 }, //                 1,44
};

/**
 * Bảng hàng hoá — **giá sống ở server**, không sống ở trình duyệt.
 *
 * Trình duyệt chỉ gửi lên một mã món. Nếu giá đi kèm theo request thì mọi người mở
 * DevTools đều mua được cái mũ 320 xu với giá 0, và lúc ấy cửa hàng không còn là cửa
 * hàng. Đây cũng là lý do `buy()` tra giá từ bảng này chứ không tin gì từ đầu vào.
 *
 * `slot` (đồ trang trí) = CHỖ ĐỨNG trong khung trời của popover.
 */
export const ITEMS = {
  // ── Ăn uống: mua là ăn luôn, không có kho. Giá SUY RA, xem `priceOf` ─────
  ...Object.fromEntries(
    Object.entries(FOOD_SPEC).map(([id, spec]) => [id, { kind: 'food', price: priceOf(spec), ...spec }]),
  ),

  // ── Trang trí: mua một lần, ở lại vĩnh viễn ──────────────────────────────
  // Giá đặt TAY, và đó là chỗ khác đồ ăn một cách có chủ ý: mấy món này không cho lại
  // thứ gì đo được, nên không có đại lượng nào để đổi ra xu. Một công thức bịa cho chúng
  // còn tệ hơn một con số thừa nhận mình là do người chọn.
  //
  // Nhiều món CHUNG một chỗ đứng, và đó là điểm đổi so với bản đầu: chỗ đứng giờ là một
  // cái khe thay được, không phải một ô cố định của đúng một món. Xem `SLOTS`.
  //
  // Mỗi khe có thêm MỘT món ở bậc cao kể từ lượt này, và giá của chúng đặt theo một luật chứ
  // không theo cảm giác: **đắt hơn món đắt nhất cùng khe ít nhất một nửa.** Dưới mức ấy thì
  // món mới không mở ra một cái đích mới, nó chỉ chen vào giữa hai món cũ — mà cửa hàng này
  // vốn đã có mười sáu món và chỗ hụt của nó không phải là số lượng.
  //
  // Lượt 19 thêm một tầng thứ BA, theo đúng luật ấy: mỗi món xa xỉ đắt hơn món đắt nhất cùng
  // khe từ 55% tới 70%. Cùng một luật cho cả hai tầng là điều kiện để tầng sau còn so được với
  // tầng trước — hai luật khác nhau thì "đắt hơn" thôi không còn nghĩa gì ngoài một con số lớn.
  //
  // Lượt 22 thêm tầng thứ TƯ, cùng luật ấy lần thứ ba: mỗi món đắt hơn món đắt nhất cùng khe
  // 59–65%. Từ lượt này cỡ hình cũng phải đi theo giá và có phép kiểm canh — xem khối chú thích
  // của tầng thứ tư trong `public/lib/pet.js`.
  //
  // Trần mới là 1420 xu, tức 1420 giờ no, tức chừng ba tháng làm việc ở mức thu nhập đo được
  // trên máy này ($50–120 một ngày) — dài hơn trần cũ (880 xu, chừng tám tuần) đúng một nửa.
  // Đó là chủ ý và nó là con số đáng nói thẳng: đồ trang trí không mua thứ gì đo được, nên thứ
  // duy nhất chúng có thể là — cái đích dài hạn. Một cái đích với tới trong hai tuần thì hai
  // tuần sau nó lại trống.
  beanie: { kind: 'decor', price: 60, slot: 'head' },
  hat: { kind: 'decor', price: 70, slot: 'head' },
  crown: { kind: 'decor', price: 260, slot: 'head' },
  wreath: { kind: 'decor', price: 400, slot: 'head' },
  halo: { kind: 'decor', price: 700, slot: 'head' },
  helm: { kind: 'decor', price: 1150, slot: 'head' },

  cactus: { kind: 'decor', price: 80, slot: 'left' },
  plant: { kind: 'decor', price: 90, slot: 'left' },
  bonsai: { kind: 'decor', price: 200, slot: 'left' },
  sakura: { kind: 'decor', price: 380, slot: 'left' },
  kumquat: { kind: 'decor', price: 640, slot: 'left' },
  bamboo: { kind: 'decor', price: 1020, slot: 'left' },

  mushroom: { kind: 'decor', price: 110, slot: 'right' },
  dog: { kind: 'decor', price: 220, slot: 'right' },
  cat: { kind: 'decor', price: 240, slot: 'right' },
  crane: { kind: 'decor', price: 420, slot: 'right' },
  koipond: { kind: 'decor', price: 720, slot: 'right' },
  torii: { kind: 'decor', price: 1180, slot: 'right' },

  balloon: { kind: 'decor', price: 130, slot: 'air' },
  kite: { kind: 'decor', price: 140, slot: 'air' },
  lantern: { kind: 'decor', price: 150, slot: 'air' },
  firework: { kind: 'decor', price: 300, slot: 'air' },
  airship: { kind: 'decor', price: 480, slot: 'air' },
  chime: { kind: 'decor', price: 790, slot: 'air' },

  bunting: { kind: 'decor', price: 170, slot: 'top' },
  lights: { kind: 'decor', price: 190, slot: 'top' },
  wisteria: { kind: 'decor', price: 340, slot: 'top' },
  roses: { kind: 'decor', price: 560, slot: 'top' },
  awning: { kind: 'decor', price: 900, slot: 'top' },

  hills: { kind: 'decor', price: 210, slot: 'back' },
  rainbow: { kind: 'decor', price: 320, slot: 'back' },
  aurora: { kind: 'decor', price: 520, slot: 'back' },
  skyline: { kind: 'decor', price: 880, slot: 'back' },
  peak: { kind: 'decor', price: 1420, slot: 'back' },

  // ── Mặt đồng hồ: cùng bảng, nhưng KHÔNG cùng loại vật ────────────────────
  //
  // Sáu khe trên bán một VẬT đứng trong bức tranh, có sprite, có nhịp thở. Khe này bán cái
  // VỎ của con số phút đã ngồi — nó không có sprite và không bao giờ có, vì thứ nó bọc là
  // một con số do trình duyệt dựng bằng CSS. `face: true` khai ra chỗ khác ấy ngay trong
  // bảng, và mọi phép kiểm về hình vẽ đọc trường này để biết món nào chúng có quyền hỏi.
  // Giấu chỗ khác ấy đi thì phép kiểm "món đắt hơn không được vẽ nhỏ hơn" phải nới lỏng cho
  // sáu món không có hình — tức là một luật đang giữ chất lượng bị đục một lỗ để chiều một
  // ca ngoại lệ. Khai thẳng thì luật cũ giữ nguyên độ chặt và khe này có luật riêng của nó.
  //
  // Luật riêng ấy: **món đắt hơn phải đổi THÊM MỘT KÊNH, không phải đổi màu đậm hơn.** Đo
  // được, vì mỗi mặt là một luật CSS khai lại một số biến — đếm số biến ấy ra một bậc thang
  // không được đi lùi theo giá (phép kiểm trong `test/pet.test.js`). Cụ thể: hai mặt đầu đổi
  // VẬT LIỆU (màu nền, viền, mực); `slate` đổi thêm ĐỘ DÀY viền; `ticket` đổi thêm KIỂU viền
  // và cắt góc vuông lại, đọc thành một cái vé; `neon` thêm QUẦNG SÁNG; `pulse` — đắt nhất —
  // thêm một VẠCH NHỊP chạy dưới chân con số, tức nó chở thêm một tin mà năm mặt kia không có.
  //
  // Giá theo đúng luật bậc thang của các khe trên (mỗi tầng đắt hơn tầng trước 55–70%), nên
  // khe này so được với năm khe kia thay vì đứng riêng một thang.
  brass: { kind: 'decor', price: 90, slot: 'clock', face: true },
  wood: { kind: 'decor', price: 100, slot: 'clock', face: true },
  slate: { kind: 'decor', price: 240, slot: 'clock', face: true },
  ticket: { kind: 'decor', price: 400, slot: 'clock', face: true },
  neon: { kind: 'decor', price: 680, slot: 'clock', face: true },
  pulse: { kind: 'decor', price: 1120, slot: 'clock', face: true },
};

/**
 * Bảy chỗ đứng trong khung trời, theo THỨ TỰ ĐỌC của cửa hàng — gắn vào người trước, nền
 * trời sau cùng.
 *
 * Tên chỗ là tên VỊ TRÍ chứ không phải tên loại đồ ("head", không phải "hat"). Đặt theo
 * loại thì cái khe bên trái vĩnh viễn chỉ nhận được cây, và ngày muốn đặt một cái đèn bàn
 * xuống đấy là phải đổi cả bảng. Vị trí thì đúng với thứ người xem thấy: mỗi khe là một
 * CHỖ trong bức tranh, ai đứng vào cũng được.
 *
 * `clock` đứng thứ hai vì thứ tự này là thứ tự trong BỨC TRANH: hai khe đầu bám vào người
 * (trên đầu, bên vai), bốn khe sau là cảnh vật quanh người. Nó cũng là khe duy nhất bán vỏ
 * chứ không bán vật — xem khối chú thích ở cuối `ITEMS`.
 */
export const SLOTS = ['head', 'clock', 'left', 'right', 'air', 'top', 'back'];

export const FOODS = Object.keys(ITEMS).filter((k) => ITEMS[k].kind === 'food');
export const DECORS = Object.keys(ITEMS).filter((k) => ITEMS[k].kind === 'decor');
/** Món trang trí có SPRITE — tức mọi món trừ mấy cái mặt đồng hồ. Nhiều phép kiểm và cả
 *  chỗ vẽ ô hàng chỉ có nghĩa với nhóm này. */
export const DRAWN = DECORS.filter((id) => !ITEMS[id].face);

/*
 * `MEAL_SHOW_MS` đã bỏ. Trước 5/8 nó là 45 phút và chỉ để nhìn — món ăn nằm cạnh nhân vật
 * lâu hơn hẳn quãng ăn. Hai con số tách nhau ra là ngay lập tức có một bát phở nằm trên
 * bàn 44 phút sau khi ăn xong, và cái hình thôi không còn nói "đang ăn" nữa, nó chỉ còn
 * nói "có một bát phở ở đây". Giờ chỉ còn `EAT_MS`: món ăn vơi dần rồi biến mất đúng lúc
 * quán mở cửa lại, nên chính nó là cái đồng hồ đếm ngược. Một con số, một cái tên.
 */

/** Kết quả quãng nghỉ vừa chốt còn được bày ra bao lâu. Hai phút — đủ để quay lại bàn và
 *  đọc nó, ngắn hơn hẳn quãng nghỉ ngắn nhất nên không bao giờ có hai câu trả lời chồng
 *  nhau trên màn hình. */
export const BREAK_RESULT_MS = 2 * 60 * 1000;

/** Giữ lại ngần này ngày trong `credited`. Lớn hơn cửa sổ sổ token (45) để một ngày còn
 *  trong `series` không bao giờ bị dọn khỏi đây rồi được cộng tiền lần hai. */
const KEEP_DAYS = 120;

/**
 * Sổ mới — và đây là chỗ dễ sai nhất của cả file.
 *
 * Máy này đã tiêu $6.813 trước khi trò chơi tồn tại. Cộng hết chỗ đó vào là ngay giây
 * đầu tiên đã mua sạch cửa hàng, và cái đang định làm — một lý do nhỏ để quay lại — chết
 * ngay lúc sinh ra. Nên sổ mới **đánh dấu mọi ngày CŨ là đã cộng rồi**, không phải cộng
 * chúng.
 *
 * Riêng HÔM NAY thì để nguyên 0. Mở trò chơi lúc 3 giờ chiều mà ví rỗng tới tận nửa đêm
 * thì lần mở đầu tiên chẳng có gì để làm; lấy trọn ngày hôm nay là đủ vốn mua bữa đầu
 * ngay, mà vẫn không đụng vào lịch sử.
 */
export function emptyLedger(series = [], today = null, nowMs = Date.now()) {
  const credited = {};
  for (const d of series) {
    if (today && d.day >= today) continue;
    credited[d.day] = d.cost;
  }
  return {
    v: 1,
    on: true,
    since: today,
    coins: 0,
    earned: 0,
    spent: 0,
    credited,
    fedAt: new Date(nowMs).toISOString(),
    // Sổ mới bắt đầu ở trạng thái ĐÃ NGHỈ, không phải đã ngồi 90 phút. Bật trò chơi lên
    // mà lời nhắc sức khoẻ nổ ngay giây đầu thì nó là một cái pop-up quảng cáo, không
    // phải một quan sát.
    restedAt: new Date(nowMs).toISOString(),
    owned: [],
    // Món đang ĐEO ở từng chỗ đứng: `{ head: 'hat', left: 'plant', … }`. Tách khỏi `owned`
    // vì từ lúc nhiều món chung một chỗ, "đã mua" và "đang bày" là hai câu hỏi khác nhau —
    // suy cái sau từ cái trước thì mua cái nón thứ hai là mất cái thứ nhất khỏi màn hình
    // vĩnh viễn, không có đường quay lại.
    worn: {},
    lastMeal: null,
    lastMealAt: null,
    meals: 0,
    // Đoạn hồi đang chạy — xem `ramped` trong `petmath.js`. `null` là "không hồi gì", và
    // mọi phép tính rơi thẳng về đường tụt thường khi gặp nó.
    ramp: null,
    // Quãng nghỉ đang chạy (`null` khi không có) và sổ đếm. Xem `startBreak`.
    breakKind: null,
    breakAt: null,
    breakMs: null,
    lastBreak: null,
    breaks: 0,
  };
}

/**
 * Cộng xu cho phần tiền chưa được cộng — **theo NGÀY, không theo tổng**.
 *
 * Cách hiển nhiên là nhớ một con số `đã cộng tới $X` rồi so với `usage.all.cost`. Nó hỏng
 * đúng ở đặc điểm đã ghi trong `config.js`: Claude Code tự xoá transcript cũ, nên tổng
 * lịch sử **tụt xuống** theo thời gian. Tổng tụt thì hiệu số âm, và ví đứng hình vĩnh
 * viễn cho tới khi tiêu bù lại đúng chỗ vừa mất — trên máy này là hàng nghìn đô.
 *
 * Khoá theo ngày thì mỗi ngày tự chốt sổ của nó. Ngày rơi khỏi `series` chỉ có nghĩa là
 * không cộng thêm gì cho ngày đó nữa, không kéo theo ai cả.
 *
 * Hàm THUẦN: trả sổ mới, không ghi đĩa. Gọi bao nhiêu lần với cùng đầu vào cũng ra cùng
 * một kết quả — đó chính là thứ làm "bấm F5 mười lần" không đẻ ra xu nào.
 */
export function accrue(ledger, series, today) {
  const credited = { ...ledger.credited };
  let minted = 0;
  for (const d of series) {
    const before = credited[d.day] ?? 0;
    // `cost` chỉ tăng trong ngày, nhưng một lượt quét lỗi có thể trả về ít hơn. Lấy phần
    // dương thôi, và KHÔNG hạ `credited` xuống — hạ xuống là mở đường cộng tiền hai lần.
    if (d.cost > before) {
      minted += (d.cost - before) * RATE;
      credited[d.day] = d.cost;
    }
  }
  // Dọn ngày đã rơi khỏi sổ token. An toàn vì chúng không bao giờ quay lại: sổ chỉ mất
  // ngày ở phía CŨ, và mốc cắt ở đây còn lùi hơn cửa sổ của sổ token.
  const cut = dayBefore(today, KEEP_DAYS);
  for (const day of Object.keys(credited)) if (cut && day < cut) delete credited[day];

  if (!minted) return { ...ledger, credited };
  return { ...ledger, credited, coins: ledger.coins + minted, earned: ledger.earned + minted };
}

/** `YYYY-MM-DD` lùi `n` ngày. Tính trên UTC vì cả hai đầu chỉ là chuỗi ngày để so sánh. */
function dayBefore(today, n) {
  const ms = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms - n * 86400000).toISOString().slice(0, 10);
}

/**
 * Độ no và độ tập trung — hai lớp vỏ mỏng bọc quanh cùng một phép trong `petmath.js`.
 *
 * Phần "0 khi thiếu mốc ăn, 1 khi thiếu mốc nghỉ" nằm ở đây chứ không ở trong hạt nhân,
 * vì nó là quy ước của SỔ NÀY: sổ chưa từng cho ăn thì đói là đúng, còn sổ đời cũ chưa có
 * mốc nghỉ thì chưa đo được, mà chưa đo được thì im — một lời nhắc sức khoẻ dựng trên một
 * con số chưa từng tồn tại còn tệ hơn không nhắc.
 */
export const fullnessOf = (ledger, nowMs = Date.now()) =>
  fullnessAt(ledger.fedAt, nowMs, FULL_MS, ledger.ramp);
export const focusOf = (ledger, nowMs = Date.now()) =>
  focusAt(ledger.restedAt, nowMs, FOCUS_MS, ledger.ramp);

/**
 * Đoạn hồi hiện tại còn hiệu lực không — dùng để dọn, không dùng để tính.
 *
 * Phép tính đã tự rơi về đúng giá trị đích khi hết đoạn (xem `ramped`), nên hàm này chỉ
 * phục vụ việc bỏ một `ramp` chết ra khỏi sổ trên đĩa. Giữ nguyên rác trong một file người
 * ta mở ra đọc là một cách rẻ tiền để làm nó khó đọc.
 */
const liveRamp = (ramp, nowMs) => {
  const at = Date.parse(ramp?.at ?? '');
  return !Number.isNaN(at) && nowMs < at + (Number(ramp.ms) || 0) ? ramp : null;
};

/** Việc đang làm, đọc từ chính sổ này. Vỏ mỏng để phía server khỏi nhớ tên trường nào. */
export const doingIn = (ledger, nowMs = Date.now()) => doingOf(ledger, nowMs, EAT_MS);

/** Nghỉ liên tục thì bao lâu mới chịu ghi lại sổ một lần. Xem `observeRest`. */
const REST_WRITE_MS = 60 * 1000;

/**
 * Ghi nhận một quãng nghỉ — hàm THUẦN, trả sổ mới, không ghi đĩa.
 *
 * `idleMs` là khoảng lặng của phiên Claude Code hoạt động gần nhất (`null` khi không có
 * phiên nào sống — cũng tính là nghỉ: máy không thấy bạn làm gì với Claude Code thì nó
 * không có cơ sở nào để nói bạn đang cắm mặt).
 *
 * Đang LÀM thì hàm này không đụng vào sổ, nên suốt một mạch làm việc dài không có lượt
 * ghi đĩa nào. Đang NGHỈ thì `restedAt` phải bám theo hiện tại — tập trung mới đầy — mà
 * bám sát từng lượt quét là ghi lại một file y hệt 2880 lần mỗi ngày. Vì thế có mốc
 * `REST_WRITE_MS`: trong lúc nghỉ, `restedAt` chỉ cũ tối đa một phút, tức lệch dưới 1,2%
 * của chu kỳ 90 phút — không đủ để đổi lấy dù chỉ một ô trên thanh mười ô.
 *
 * Trả về CHÍNH sổ cũ khi không có gì đổi, để chỗ gọi so tham chiếu mà biết có cần ghi
 * đĩa hay không.
 */
export function observeRest(ledger, idleMs, nowMs = Date.now()) {
  const prev = Date.parse(ledger.restedAt ?? '');
  // Sổ đời cũ chưa có mốc nào: GIEO NGAY, kể cả khi đang làm. Không có nhánh này thì hàm
  // chỉ chạm vào sổ lúc nghỉ, mà một máy dùng liên tục cả ngày có thể mất nhiều giờ mới
  // tới quãng nghỉ đầu tiên — suốt quãng ấy thanh đứng đầy, tức là câm đúng lúc cần nói.
  // Gieo bằng `nowMs` chứ không lùi về quá khứ: không ai biết mạch đang chạy bắt đầu từ
  // đâu, và đoán một mốc cũ là bịa ra một con số để bắn một lời nhắc.
  if (Number.isNaN(prev)) return { ...ledger, restedAt: new Date(nowMs).toISOString(), ramp: noRest(ledger.ramp) };
  if (idleMs != null && idleMs < BREAK_MS) return ledger;
  if (nowMs - prev < REST_WRITE_MS) return ledger;
  return { ...ledger, restedAt: new Date(nowMs).toISOString(), ramp: noRest(ledger.ramp) };
}

/**
 * Gỡ phần TẬP TRUNG ra khỏi đoạn hồi, giữ nguyên phần độ no.
 *
 * Mọi chỗ tự tay dời `restedAt` phải gọi nó. Đoạn hồi trộn từ `restedFrom` tới `restedAt`
 * (xem `ramped`), nên một mốc mới ghi đè giữa chừng biến cái đích thành một chỗ khác hẳn
 * chỗ lúc đoạn hồi bắt đầu — và cái thanh sẽ bò tới một con số chưa ai hứa. Bỏ mốc gốc đi
 * thì phép trộn tắt và chỉ số nhảy thẳng về giá trị thật, đúng cái đã xảy ra: bạn vừa
 * đứng dậy thật, không cần một đoạn hồi nào cả.
 *
 * Chỉ gỡ nửa mình, không xoá cả `ramp`: một lượt quét bắt được khoảng lặng trong lúc đang
 * ăn dở là chuyện thường (làm gì có ai gọi Claude Code lúc đang húp phở), và xoá cả cụm ở
 * đó là bát phở đang ăn dở bỗng no đủ ngay lập tức.
 */
const noRest = (ramp) => (ramp?.restedFrom ? { ...ramp, restedFrom: null } : (ramp ?? null));

/* ── Quãng nghỉ khai trước ─────────────────────────────────────────────────── */

/**
 * Bắt đầu một quãng nghỉ. Hàm THUẦN — trả `{ ledger, error }`.
 *
 * Không tốn xu và không thu xu: nguồn tiền duy nhất là hoá đơn token đã tiêu (xem `RATE`),
 * và mở một nguồn thứ hai — kể cả một nguồn "lành mạnh" — là đúng chỗ mà mọi trò chơi hoá
 * bắt đầu nói dối. Phần thưởng của việc đứng dậy là thanh tập trung đầy lại, hết.
 *
 * Đang có một quãng chạy dở thì từ chối chứ không lặng lẽ khởi động lại: bấm hai lần rồi
 * đi mất, quay lại thấy đồng hồ nhảy về đầu là mất trắng ba phút vừa nghỉ thật.
 */
export function startBreak(ledger, kind, nowMs = Date.now()) {
  const move = Object.hasOwn(MOVES, kind) ? MOVES[kind] : null;
  if (!move) return { ledger, error: 'không có động tác này' };
  if (ledger.breakAt) return { ledger, error: 'đang nghỉ rồi' };
  // MỘT việc một lúc, cùng cửa với `buy`. Xem khối chú thích ở đó — cửa này là nửa còn
  // lại của cùng một luật, và thiếu nó thì "một lúc một việc" chỉ đúng theo một chiều.
  if (doingIn(ledger, nowMs)) return { ledger, error: 'đang ăn dở' };
  return {
    ledger: { ...ledger, breakKind: kind, breakAt: new Date(nowMs).toISOString(), breakMs: move.ms },
    error: null,
  };
}

/** Bỏ dở. Không phạt gì — bỏ dở một quãng nghỉ chỉ có nghĩa là nó không được tính. */
export function cancelBreak(ledger) {
  if (!ledger.breakAt) return { ledger, error: null };
  return { ledger: { ...ledger, breakKind: null, breakAt: null, breakMs: null }, error: null };
}

/**
 * Chốt một quãng nghỉ đã hết giờ — **chỗ duy nhất của cả file này thực sự KIỂM** thay vì
 * tin lời khai. Hàm THUẦN; trả chính sổ cũ khi chưa tới giờ, để chỗ gọi so tham chiếu.
 *
 * Phép kiểm chỉ có một dòng và nó là toàn bộ luận điểm: `awayMs >= breakMs` nghĩa là suốt
 * trọn quãng vừa khai, bạn không gõ gì cho Claude Code cả. `null` (không đọc được) cũng
 * đạt — máy không thấy gì thì nó không có cơ sở nói bạn đang ngồi.
 *
 * ## `awayMs` đo BẠN, không đo cái máy — và đây là chỗ sửa 5/8
 *
 * Bản trước nhận `idleMs`: khoảng lặng của Claude Code, tức mtime transcript, tức lượt
 * GHI cuối cùng của máy. Sai ngay ở ca thường gặp nhất: một lượt chạy dài ghi liên tục
 * suốt vài phút, mà đúng quãng ấy mới là quãng người ta rảnh để đứng dậy. Đi bộ thật một
 * phút trong lúc Claude đang chạy thì `idleMs` quanh 0 và quãng nghỉ bị huỷ — càng làm
 * đúng càng chắc chắn trượt. Người dùng báo đúng lỗi này, và đúng ở động tác đắt nhất:
 * đi dạo ngoài công viên.
 *
 * Giờ nó nhận `awayMs` — khoảng lặng tính từ lượt GÕ cuối của người (xem `awayOf` bên
 * `server.js`). Phép kiểm không đổi một chữ; chỉ có câu hỏi là đổi, từ "máy có bận
 * không" sang "bạn có ở đây không".
 *
 * Ca sai còn lại, và nó lệch về phía RỘNG RÃI chứ không còn về phía từ chối oan: ngồi
 * yên nhìn Claude chạy đúng một phút mà không gõ gì thì quãng nghỉ ấy vẫn được tính.
 * Chấp nhận, vì cái giá của "gian" bằng đúng cái giá của thật — một phút ngồi không —
 * còn cái mất của chiều kia là huỷ oan một việc người ta vừa làm thật.
 *
 * Lúc trượt thì không phạt gì cả — không trừ xu, không đụng vào `restedAt`, chỉ nói "lần
 * này không tính" và mời bấm lại. Một phép kiểm biết mình có thể sai thì không được phép
 * ra hình phạt.
 *
 * Phần thưởng thì VẶN NGƯỢC đồng hồ ngồi chứ không đặt nó về hiện tại — xem `back` trong
 * `MOVES`, nơi mỗi động tác khai ra mình gỡ được bao nhiêu phút.
 */
export function resolveBreak(ledger, awayMs, nowMs = Date.now()) {
  const at = Date.parse(ledger.breakAt ?? '');
  const span = Number(ledger.breakMs) || 0;
  if (Number.isNaN(at) || !span) return ledger;
  if (nowMs < at + span) return ledger;

  const kept = awayMs == null || awayMs >= span;
  const done = {
    ...ledger,
    breakKind: null,
    breakAt: null,
    breakMs: null,
    lastBreak: { kind: ledger.breakKind, at: new Date(nowMs).toISOString(), ok: kept },
  };
  if (!kept) return done;
  // Cộng dồn, có trần — không gán. Uống nước lúc còn tỉnh 80% mà đặt thẳng `restedAt = now`
  // thì đúng; uống nước lúc đã ngồi hai tiếng mà cũng đặt về `now` là trả về đầy, tức cái
  // bậc thang vừa dựng lên không tồn tại. `Math.min` là trần: không mốc nghỉ nào được rơi
  // vào tương lai, vì `satMinAt` sẽ đọc ra một số phút ÂM.
  //
  // `floor` là chỗ quan trọng thứ hai, và thiếu nó thì bậc trên cùng hỏng hẳn: `focusAt`
  // kẹp giá trị về 0, nên ngồi liền 3 giờ và ngồi liền 90 phút là CÙNG MỘT con số trên
  // thanh. Không kẹp ở đây thì người ngồi 3 giờ vặn ngược trọn 90 phút vẫn ra 0 — tức đi bộ
  // xong không được gì, trong khi cửa hàng vừa hứa "về đầy". Phần thưởng không được phép
  // phụ thuộc vào một món nợ mà cái thanh từ chối bày ra.
  const back = Number(MOVES[ledger.breakKind]?.back) || FOCUS_MS;
  const prev = Date.parse(ledger.restedAt ?? '');
  const from = Number.isNaN(prev) ? nowMs : Math.max(prev, nowMs - FOCUS_MS);
  const wound = Math.min(nowMs, from + back);
  return {
    ...done,
    restedAt: new Date(wound).toISOString(),
    breaks: (ledger.breaks ?? 0) + 1,
    // Đoạn hồi bắt đầu Ở ĐÂY, không phải lúc bấm — xem `REST_RAMP_MS`. Mốc gốc là chỗ
    // thanh tập trung đang đứng ngay trước khi quãng nghỉ được tính, nên hai mươi giây tới
    // nó bò từ đúng chỗ ấy lên chỗ mới — xa hay gần là tuỳ động tác, và đó chính là thứ
    // đoạn hồi này bày ra cho mắt thấy. Đè lên đoạn hồi cũ nếu có: không thể vừa ăn vừa nghỉ
    // (`startBreak` chặn), nên chỗ này không bao giờ giẫm lên một bữa đang dở.
    ramp: { at: new Date(nowMs).toISOString(), ms: REST_RAMP_MS, fedFrom: null, restedFrom: ledger.restedAt ?? null },
  };
}

/* ── Đeo đồ ───────────────────────────────────────────────────────────────── */

/**
 * Đổi món đang bày ở một chỗ đứng. `id` là `null` nghĩa là dọn trống chỗ đó.
 *
 * Kiểm cả BA điều kiện chứ không chỉ "có mã này không": món phải là đồ trang trí, phải
 * ĐÃ MUA, và phải đúng chỗ của nó. Điều kiện thứ hai là hàng rào tiền thật — thiếu nó thì
 * một request tay không mua gì cũng đeo được cái vương miện 260 xu. Điều kiện thứ ba giữ
 * cho bảng `ITEMS` là nguồn duy nhất nói món nào đứng đâu: cho trình duyệt chọn chỗ thì
 * cái nón rơi xuống chân và cái cầu vồng leo lên đầu.
 */
export function wear(ledger, slot, id) {
  if (!SLOTS.includes(slot)) return { ledger, error: 'không có chỗ này' };
  if (id == null) {
    if (!ledger.worn?.[slot]) return { ledger, error: null };
    const worn = { ...ledger.worn };
    delete worn[slot];
    return { ledger: { ...ledger, worn }, error: null };
  }
  const item = Object.hasOwn(ITEMS, id) ? ITEMS[id] : null;
  if (!item || item.kind !== 'decor') return { ledger, error: 'không có món này' };
  if (item.slot !== slot) return { ledger, error: 'món này không đứng chỗ đó' };
  if (!ledger.owned.includes(id)) return { ledger, error: 'chưa mua món này' };
  if (ledger.worn?.[slot] === id) return { ledger, error: null };
  return { ledger: { ...ledger, worn: { ...ledger.worn, [slot]: id } }, error: null };
}

/**
 * Dựng lại bảng đang đeo từ một sổ có thể đã cũ hoặc đã bị chép tay.
 *
 * Hai việc trong một hàm vì chúng là cùng một câu hỏi ("chỗ này đang bày gì cho hợp lệ"):
 * - **Sổ đời cũ** không có `worn` — bản đầu suy chỗ đứng thẳng từ `owned`. Dựng lại từ
 *   `owned` giữ nguyên màn hình cho người đã mua đồ từ trước; không có nhánh này thì bản
 *   mới lên là khung trời trống trơn dù ví đã tiêu 800 xu.
 * - **Sổ bị sửa tay** có thể trỏ vào món chưa mua, món không tồn tại, hay sai chỗ. Lọc ở
 *   cửa đọc chứ không ở chỗ vẽ, cùng lý do đã ghi cho `owned`: chỗ vẽ mà gặp mã lạ thì nó
 *   ném giữa lượt render và cả trang trắng.
 */
export function normWorn(raw, owned) {
  const out = {};
  for (const slot of SLOTS) {
    const id = raw?.[slot];
    if (typeof id === 'string' && owned.includes(id) && ITEMS[id]?.slot === slot) out[slot] = id;
  }
  // Chưa có bảng nào (sổ đời cũ): mỗi chỗ lấy món đã mua đầu tiên đứng được ở đó.
  if (raw == null || typeof raw !== 'object') {
    for (const id of owned) {
      const slot = ITEMS[id]?.slot;
      if (slot && !out[slot]) out[slot] = id;
    }
  }
  return out;
}

/**
 * Mua một món. Hàm THUẦN — trả `{ ledger, error }`, không ném và không ghi đĩa.
 *
 * Món ăn thì mua = ăn luôn, không có kho: một cái kho bắt người ta bấm hai lần cho một
 * việc, mà việc ấy vốn chỉ có một ý nghĩa duy nhất. Món trang trí thì mua một lần và ở
 * lại — mua lần hai bị từ chối chứ không lặng lẽ trừ tiền.
 */
export function buy(ledger, id, nowMs = Date.now()) {
  // `Object.hasOwn`, KHÔNG phải `ITEMS[id]` trơn. `ITEMS` là object literal nên nó thừa
  // kế cả `Object.prototype`: `ITEMS['constructor']` trả về một HÀM — truthy — và lọt
  // thẳng qua cửa "không có món này". Sau đó `item.price` là `undefined`, phép so
  // `coins < undefined` ra `false`, nên nó đi tiếp vào nhánh ăn và `fill` undefined biến
  // `fedAt` thành `Invalid Date`. Sổ hỏng, không một dòng lỗi nào lúc ghi.
  //
  // Đã gặp thật: `test/pet.test.js` bắt được bằng đúng `constructor` và `__proto__`.
  const item = Object.hasOwn(ITEMS, id) ? ITEMS[id] : null;
  if (!item) return { ledger, error: 'không có món này' };
  if (item.kind === 'decor' && ledger.owned.includes(id)) return { ledger, error: 'đã có rồi' };
  /**
   * MỘT món một lúc — và cửa này phải đứng TRƯỚC phép trừ tiền.
   *
   * Nó chặn đúng hai ca, và cả hai đều là cùng một chuyện: quản gia chỉ có một cái miệng
   * và một cặp chân. Đang ăn dở thì không nhận món thứ hai (bản trước bấm bốn lần liên
   * tiếp là bốn món chồng lên nhau trong một giây, thanh no nhảy thẳng lên đầy, và chẳng
   * món nào kịp hiện ra); đang nghỉ giữa chừng thì cũng không, vì người đang đi bộ ngoài
   * sân thì không ngồi ăn phở được.
   *
   * Chỉ chặn ĐỒ ĂN. Đồ trang trí không phải một việc phải làm — nó là một món đồ đặt vào
   * khung trời — nên nó mua được bất cứ lúc nào, kể cả trong lúc chờ hết quãng nghỉ.
   */
  if (item.kind === 'food' && doingIn(ledger, nowMs)) return { ledger, error: 'đang bận' };
  /*
   * ĐÃ CÓ một cửa thứ ba ở đây và nó đã bị GỠ, cùng lượt với lượt dựng nó.
   *
   * Cửa ấy: đói lả thì không bán đồ trang trí. Nó ra đời để trả lời "cơn đói phải có hậu
   * quả", và nó tránh được mấy hình phạt bằng số (cắt tốc độ đúc xu, trừ thẳng xu, bắt món
   * đang đeo rơi ra) — mấy thứ ấy đều nhân ví với một hệ số bịa hoặc xoá một khoản tiền có
   * thật, nên chúng vẫn bị loại và vẫn nên bị loại.
   *
   * Nhưng nó vẫn còn phạm đúng cái luật ấy ở một bậc nhẹ hơn, và người dùng gọi tên ngay ở
   * lượt sau: **"đừng đánh vào kinh tế"**. Ví ở đây ĐỌC RA hoá đơn thật (`RATE` = 1), nên
   * mọi cửa treo vào ví — kể cả một cửa không đổi con số nào, chỉ khoá tạm chỗ tiêu — đều
   * dạy người đọc rằng số tiền trên màn hình có một cái van do trò chơi vặn. Một khi đã nghĩ
   * thế thì cái ví thôi không còn là bản đọc chi tiêu nữa.
   *
   * Hậu quả của cơn đói vì thế dọn hẳn sang chỗ nó không đụng vào tiền: BỨC TRANH (quản gia
   * gục xuống, màn hình tắt, bong bóng chỉ còn nghĩ đến đồ ăn) và DẢI BÁO ĐỘNG (xem
   * `nudgeOf` bên `lib/pet.js`). Cả hai đều ngắt lời to hơn một cái nút xám, mà không cái
   * nào chạm vào sổ.
   */
  if (ledger.coins < item.price) return { ledger, error: 'không đủ xu' };

  // `coins` giữ NGUYÊN phần lẻ sâu — nó là hiệu của một khoản tiền thật cộng theo từng
  // lượt quét, và cắt bớt ở đây là mỗi lần mua đánh rơi một ít tiền chưa tiêu. `spent` thì
  // ngược lại: nó chỉ cộng dồn mấy con số hai chữ số lẻ, nên làm tròn ngay lúc ghi giữ cho
  // sổ trên đĩa đọc được — không có `0.30000000000000004` nào nằm trong đó.
  const next = { ...ledger, coins: ledger.coins - item.price, spent: round2(ledger.spent + item.price) };
  // Mua đồ trang trí là ĐEO LUÔN, đè lên món cũ ở chỗ đó. Bắt bấm thêm một lần nữa để
  // thấy thứ mình vừa trả 260 xu là hai cú bấm cho một ý định — và cú thứ hai thì nằm ở
  // một khối khác trên màn hình, nên nó còn là một lượt đi tìm. Món cũ không mất: nó vẫn
  // trong `owned` và đổi lại được bằng một cú bấm ở đúng cái khe ấy.
  if (item.kind === 'decor') {
    return {
      ledger: { ...next, owned: [...ledger.owned, id], worn: { ...ledger.worn, [item.slot]: id } },
      error: null,
    };
  }

  // Ăn: đẩy mốc `fedAt` về phía trước sao cho độ no tăng đúng `fill`, và KHÔNG vượt quá
  // no căng. Tính ngược từ độ no mong muốn thay vì cộng thẳng vào `fedAt` — cộng thẳng
  // thì ăn lúc đang no sẽ đẩy mốc ra tương lai, và thanh đói đứng đầy nhiều giờ liền.
  const full = clamp01(fullnessOf(ledger, nowMs) + item.fill);
  // Cà phê kéo lại một phần tập trung, tính NGƯỢC từ mức mong muốn y như `fedAt` — cùng
  // cái bẫy: cộng thẳng vào `restedAt` thì uống lúc đang tỉnh sẽ đẩy mốc ra tương lai và
  // lời nhắc câm suốt hai tiếng sau đó.
  const wake = item.wake ? clamp01(focusOf(ledger, nowMs) + item.wake) : null;
  return {
    ledger: {
      ...next,
      fedAt: new Date(nowMs - (1 - full) * FULL_MS).toISOString(),
      ...(wake == null ? {} : { restedAt: new Date(nowMs - (1 - wake) * FOCUS_MS).toISOString() }),
      lastMeal: id,
      lastMealAt: new Date(nowMs).toISOString(),
      meals: ledger.meals + 1,
      // Sổ ghi ngay giá trị CUỐI, còn đoạn hồi giữ hai mốc GỐC để phép tính trộn dần từ
      // chỗ cũ sang chỗ mới trong đúng một phút (xem `ramped`). Ngược lại — ghi dần vào
      // `fedAt` theo từng lượt quét — thì phần thưởng của một cú bấm phụ thuộc vào việc có
      // ai mở trang trong phút đó hay không, và đó là hạng bug không ai dựng lại được.
      //
      // `restedFrom` chỉ có ở món CÓ `wake`: một bát phở không đụng gì tới tập trung, và
      // ghi mốc cũ vào đấy là dựng một đoạn hồi từ X về đúng X — vô hại, nhưng nó bật cờ
      // "đang hồi tập trung" lên cho một món không hồi gì cả.
      ramp: {
        at: new Date(nowMs).toISOString(),
        ms: EAT_MS,
        fedFrom: ledger.fedAt ?? null,
        restedFrom: wake == null ? null : (ledger.restedAt ?? null),
      },
    },
    error: null,
  };
}

/**
 * Bản gửi ra trình duyệt.
 *
 * ## Vì sao ví có HAI chữ số lẻ chứ không phải số nguyên
 *
 * Trong sổ nó vốn đã là số thực — tiền lẻ của một ngày đang chạy phải được giữ, nếu không
 * thì mỗi lượt quét lại đánh rơi phần thập phân. Cái đổi là chỗ CẮT: bản đầu cắt về số
 * nguyên, và ở nhịp thu thật (đo trên máy này ~$50–120 một ngày, tức 5–12 xu một giờ) thì
 * con số ấy đứng yên 5 tới 10 phút liền rồi nhảy một bậc. Một cái ví chỉ nhúc nhích mỗi
 * nửa tiếng thì không ai nối được nó với việc mình vừa làm.
 *
 * Hai chữ số lẻ thì mỗi lượt quét 30 giây đều thấy nó nhích, và cái nối "gõ lệnh → tiền
 * vào ví" hiện ra ngay trên màn hình thay vì phải suy. Đó cũng là điều kiện để popover
 * nảy được con số lúc mở (xem `wallet` trong `public/lib/pet.js`): không có phần lẻ thì
 * phần lớn lần mở, hiệu số là 0 và chẳng có gì để nảy.
 *
 * Cắt XUỐNG chứ không làm tròn gần nhất — xem `floor2`, chiều làm tròn ở đó là một
 * quyết định về hành vi, không phải chuyện thẩm mỹ.
 */
export function petView(ledger, nowMs = Date.now()) {
  const full = fullnessOf(ledger, nowMs);
  const focus = focusOf(ledger, nowMs);
  const ramp = liveRamp(ledger.ramp, nowMs);
  return {
    on: ledger.on !== false,
    coins: floor2(ledger.coins),
    earned: floor2(ledger.earned),
    spent: round2(ledger.spent),
    since: ledger.since,
    full,
    mood: moodOf(full),
    focus,
    focusMood: focusMoodOf(focus),
    // Số PHÚT đã ngồi liền, gửi thẳng chứ không bắt trình duyệt tự trừ hai mốc. Câu nhắc
    // đọc chính con số này ("Đã 78 phút ngồi liền"), và một con số dựng lại ở đầu kia từ
    // `restedAt` cộng đồng hồ máy khách là một con số thứ hai sẽ lệch.
    satMin: satMinAt(ledger.restedAt, nowMs),
    fedAt: ledger.fedAt,
    lastMealAt: ledger.lastMealAt,
    // Gửi cả hai MỐC GỐC, không chỉ hai con số đã suy. Trình duyệt nhớ bản này trong
    // `localStorage` để vẽ ngay lúc mở (xem `lib/petcache.js`), mà `full` với `focus` thì
    // tụt theo đồng hồ — bày lại bản chép của chúng sau ba tiếng là bày một con số SAI,
    // không phải một con số cũ. Có mốc gốc thì bản nhớ tự tính lại được, bằng đúng phép
    // của server (`petmath.js`).
    restedAt: ledger.restedAt,
    owned: ledger.owned,
    worn: ledger.worn ?? {},
    slots: SLOTS,
    meals: ledger.meals,
    breaks: ledger.breaks ?? 0,
    /**
     * Việc đang làm — ăn hoặc nghỉ, gộp một trường. Xem `doingOf`.
     *
     * Gửi số mili giây CÒN LẠI chứ không gửi mốc bắt đầu. Đồng hồ máy khách lệch đồng hồ
     * server vài giây là chuyện thường, và một cái đếm ngược lệch vài giây thì lúc nó về 0
     * mà server bảo "chưa tới giờ" là một cú bấm trượt không giải thích được. Hiệu số thì
     * không phụ thuộc đồng hồ nào cả.
     */
    doing: doingIn(ledger, nowMs),
    // Kết quả quãng vừa chốt, và nó TỰ HẾT HẠN. Đây là một câu trả lời cho một cú bấm, nên
    // nó chỉ có nghĩa ngay sau cú bấm ấy; để nó nằm mãi thì mở cửa hàng sáng hôm sau vẫn
    // thấy "quãng nghỉ đã tính" của tối qua, và người đọc không biết nó đang nói về lúc nào.
    lastBreak:
      ledger.lastBreak && nowMs - Date.parse(ledger.lastBreak.at ?? '') < BREAK_RESULT_MS
        ? ledger.lastBreak
        : null,
    moves: Object.fromEntries(Object.entries(MOVES).map(([k, v]) => [k, { ...v }])),
    /**
     * Đoạn hồi đang chạy — mốc TUYỆT ĐỐI, khác hẳn `doing` ngay trên. Cố ý, và chỗ khác
     * nhau là chỗ có hay không có một CÁI VÁCH.
     *
     * Cái đếm ngược có vách: nó chạm 0 rồi người ta bấm, và lệch đồng hồ vài giây ở đúng
     * chỗ ấy là một cú bấm bị từ chối không giải thích được. Hai cái thanh thì không có
     * vách nào — lệch ba giây trên một đoạn hồi 60 giây là lệch 5% của một ô trên mười ô,
     * tức không ô nào đổi. Đổi lại, mốc tuyệt đối là thứ `lib/petcache.js` dựng lại được
     * bằng đúng phép của server, y như `fedAt` với `restedAt` vẫn thế từ đầu.
     */
    ramp,
    rate: RATE,
    // Ba khoảng của mô hình đi kèm bản gửi ra, không viết cứng ở trình duyệt. Bản nhớ
    // trong `localStorage` tự tính lại ba con số suy từ chúng lúc mở lại (xem
    // `lib/petcache.js`), và một hằng số chép sang bên kia là một hằng số sẽ lệch ở lần
    // sửa sau — đúng chỗ mà `petmath.js` sinh ra để khỏi có.
    fullMs: FULL_MS,
    focusMs: FOCUS_MS,
    eatMs: EAT_MS,
    // Tỉ giá của bảng giá đồ ăn, gửi kèm để khối "cách tính" dựng câu công thức từ CHÍNH
    // con số đang tính tiền — không phải từ một bản chép trong bảng chữ. Đổi nó ở đây là
    // cả cửa hàng lẫn dòng giải thích đi theo cùng lúc.
    coinPerHour: COIN_PER_HOUR,
    items: Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [k, { ...v }])),
  };
}

/* ── Đĩa ──────────────────────────────────────────────────────────────────── */

/**
 * Kẹp một đoạn hồi đọc từ đĩa. Sai một chỗ là `null` — không có đoạn hồi thì mọi phép
 * tính rơi về đường tụt thường, tức về đúng hành vi trước khi có nó.
 *
 * Kiểm cả hai mốc gốc chứ không chỉ kiểm `at`: `ramped` cắm chúng thẳng vào `Date.parse`,
 * và một chuỗi rác ở đó ra `NaN` — mà `NaN` thì trượt qua mọi phép so, nên chỉ số sẽ nhận
 * giá trị `fallback` (0 với độ no) rồi trộn dần lên. Tức một sổ chép tay làm con vật đói
 * lả trong một phút mà không có dòng lỗi nào.
 */
function normRamp(raw) {
  const ms = Number(raw?.ms);
  if (!(ms > 0) || Number.isNaN(Date.parse(raw?.at ?? ''))) return null;
  const stamp = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
  return { at: raw.at, ms, fedFrom: stamp(raw.fedFrom), restedFrom: stamp(raw.restedFrom) };
}

/** Đọc sổ. Không có, hỏng, hay sai phiên bản → `null`, để chỗ gọi tự dựng sổ mới. */
export async function readLedger() {
  try {
    const raw = JSON.parse(await fs.readFile(PET_FILE, 'utf8'));
    if (raw?.v !== 1) return null;
    // Vá mấy trường có thể thiếu ở sổ do bản cũ ghi — rẻ hơn một lớp migrate, và sổ này
    // hỏng thì chỉ mất xu chứ không mất số liệu nào.
    //
    // Cùng cái bẫy đã ghi ở `buy`: một sổ chép tay có `owned: ["constructor"]` sẽ lọt
    // qua phép lọc `ITEMS[id]` trơn rồi ném lúc vẽ.
    const owned = Array.isArray(raw.owned) ? raw.owned.filter((id) => Object.hasOwn(ITEMS, id)) : [];
    return {
      ...raw,
      credited: raw.credited ?? {},
      owned,
      worn: normWorn(raw.worn, owned),
      coins: Number(raw.coins) || 0,
      earned: Number(raw.earned) || 0,
      spent: Number(raw.spent) || 0,
      meals: Number(raw.meals) || 0,
      breaks: Number(raw.breaks) || 0,
      // Một quãng nghỉ khai dở mà server tắt giữa chừng thì `breakMs` có thể là bất cứ
      // thứ gì sau một lượt sửa tay. Kẹp ở cửa đọc: mốc không hợp lệ thì coi như không có
      // quãng nào, chứ không để `resolveBreak` nhận một con số rác rồi chốt bừa.
      breakMs: Number(raw.breakMs) > 0 ? Number(raw.breakMs) : null,
      breakKind: Object.hasOwn(MOVES, raw.breakKind) ? raw.breakKind : null,
      breakAt: Number(raw.breakMs) > 0 && Object.hasOwn(MOVES, raw.breakKind) ? (raw.breakAt ?? null) : null,
      ramp: normRamp(raw.ramp),
    };
  } catch {
    return null;
  }
}

/** Ghi sổ. Ghi tạm rồi đổi tên — cùng cách `collect/quotalog.js` làm, để một lần tắt
 *  máy giữa chừng không để lại một file JSON cụt. */
export async function writeLedger(ledger) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${PET_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(ledger, null, 1));
  await fs.rename(tmp, PET_FILE);
}
