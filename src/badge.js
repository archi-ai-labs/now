// Chữ cho mục trên thanh menu — tính xong xuôi ở phía server, app Swift chỉ in lại.
//
// Ở file riêng chứ không nằm trong `server.js` vì một lý do đo được: `server.js` gọi
// `listen` ngay lúc import, nên mọi thứ sống trong đó đều không test được — muốn thử
// đường "hạn mức hỏng thì huy hiệu nói gì" là phải dựng cả server rồi bịa cho endpoint
// của Anthropic hỏng, tức là không ai thử. Và đúng nhánh không ai thử ấy là nhánh chỉ
// chạy vào ngày mọi thứ đang hỏng.
//
// Server import một module của TRÌNH DUYỆT, cố ý — xem đầu `server.js`.
import { bindingOf, degradedKey, wasteOf, usedText } from '../public/lib/quota.js';
import { restStageOf } from '../public/lib/petmath.js';
import { t } from '../public/lib/i18n.js';

// Ký hiệu dẫn đứng trước số, và nó KHÔNG trang trí: theme của máy này là daltonized,
// nên bậc bỏ phí không được để màu làm kênh phân biệt duy nhất. Hình đi theo nghĩa —
// mũi nhọn xuống là tiêu quá ít so với cửa sổ, tròn đầy là đúng nhịp, mũi nhọn lên là
// nhịp đòi nhiều hơn cả cửa sổ có.
const BADGE_MARK = { cold: '▽', slack: '◇', full: '●', over: '▲', unknown: '·', rolled: '·' };

/**
 * Thanh menu rộng chừng mười ký tự trước khi thành nhiễu, nên ba kênh chia nhau bốn
 * con số: chữ mang phần ĐÃ TIÊU của hai cửa sổ, còn màu và ký hiệu mang phần BỎ PHÍ
 * của cửa sổ ràng buộc. Đúng luật 1 và luật 2 của `public/lib/quota.js` — số dẫn là đã
 * tiêu, màu đo bỏ phí.
 */
export function badgeOf(s, now = Date.now(), pet = null) {
  const q = s?.quota;
  const bind = q?.ok ? bindingOf(q) : null;
  const verdict = bind?.verdict ?? 'unknown';
  const awake = s?.stats?.awake ?? 0;
  const hot = s?.stats?.hotDecisions ?? 0;
  const why = degradedKey(q);

  // Một bậc ngồi-lâu, dùng chung cho cả `rest` lẫn `alert` bên dưới. Tính một lần ở đây vì
  // hai trường ấy từng hỏi `doing` theo hai luật khác nhau: `rest` chỉ im khi người dùng
  // đang đi bộ, `alert` im với mọi việc đang chạy. Cùng một payload cho ra "đã ngồi quá một
  // chu kỳ" ở trường này và "không có gì để nhắc" ở trường kia, mà một câu hỏi có hai luật
  // thì lần sửa sau chỉ sửa được một nửa.
  //
  // Luật giữ lại là luật hẹp hơn, của `rest`: chỉ động tác NGHỈ (`kind: 'move'`) mới bịt
  // lời nhắc, vì đó đúng là việc người dùng vừa bấm để chữa cơn ngồi lâu. Bát phở chữa cơn
  // đói chứ không cắt mạch ngồi, và từ lượt gỡ `starving` khỏi thang đèn thì đèn do một
  // mình số phút ngồi bật. Bịt lời nhắc trong lúc ăn chỉ khiến icon tắt đi một phút mỗi lần
  // cho ăn, và một kênh nhấp nháy là kênh dạy mắt bỏ qua nó.
  const restStage = pet?.on && pet.doing?.kind !== 'move' ? restStageOf(pet.satMin) : null;

  return {
    ok: true,
    at: now,
    quota: {
      // Hạn mức đọc trượt thì để dấu gạch, đừng để "0%·0%" — số không có thật mà trông
      // y hệt số thật là cách nhanh nhất để mất lòng tin vào cả hai mục. `usedText` áp
      // đúng luật ấy cho từng cửa sổ một: cửa sổ đã qua mốc reset cũng là số không có
      // thật, và nó trượt LẺ — hôm 3/8 khung 5 giờ kẹt ở "6%" suốt sáu tiếng trong khi
      // khung tuần bên cạnh vẫn tươi, nên cả huy hiệu trông vẫn bình thường.
      //
      // Dấu ngăn là "·" chứ không phải "-": dấu gạch nối đứng cạnh dấu gạch ngang của
      // `usedText` ra "—-37%", một cụm không đọc được thành gì.
      text: q?.ok ? `${usedText(q.fiveHour)}·${usedText(q.sevenDay)}` : '—',
      tone: bind?.tone ?? 'mute',
      verdict,
      mark: BADGE_MARK[verdict] ?? '·',
      waste: bind ? Math.round(wasteOf(bind.w)) : null,
      binding: bind?.short ?? null,
      stale: q?.stale ?? true,
      // Lý do phải kèm CÁCH CHỮA, và phải đi được tới thanh menu. Không có trường này
      // thì server là chỗ duy nhất biết token đã hết hạn, còn thứ người dùng nhìn cả
      // ngày chỉ nói được "chưa đọc được nhịp tiêu" — đúng cái đã ngốn trọn một phiên
      // đi dò, trong khi câu trả lời nằm sẵn ở `/api/state`. `null` khi không hỏng gì:
      // tooltip lúc bình thường không phải chỗ nhét thêm chữ.
      note: why ? t(why) : null,
    },
    // Không có mục thứ hai trên thanh menu nữa (bản trước có, và hai mục cùng mở một
    // popover thì chỉ là hai cái nút giống hệt nhau). Hai con số này vẫn đi kèm để
    // tooltip và popover khỏi phải hỏi thêm một lượt /api/state.
    work: { awake, hot },
    // ── Ngồi lâu — kênh duy nhất của lời nhắc nghỉ đi được RA NGOÀI popover ──
    //
    // Trước trường này, toàn bộ hệ nhắc nghỉ (thanh tập trung, câu nhắc, năm động tác có
    // kiểm) nằm SAU cú bấm mở popover — tức nó chỉ nhắc được người đã chủ động hỏi, mà
    // người cắm mặt ba tiếng không mở gì mới là người nó sinh ra để nhắc. Đây đúng là ca
    // "câm đúng lúc cần lên tiếng nhất" đã ghi ở chú thích PET_MS bên server.js: mốc nghỉ
    // được ĐO đều đặn rồi, nhưng chưa có đường BÁO nào.
    //
    // `stage` là quyết định đã tính xong (thang ở restStageOf — ba bậc SUY từ FOCUS_MS, hạ
    // nhịp là ba mốc tự đi theo), app Swift chỉ in lại, đúng ranh giới "app không biết luật
    // nào" đã khai ở đầu NowMenuBar.swift. Bậc ấy là `restStage` khai phía trên, dùng chung
    // với `alert`: đang giữa một động tác nghỉ thì nó về null, vì người vừa bấm "đi bộ" mà
    // icon vẫn giục là cái huy hiệu cãi lại chính cú bấm nó vừa xin. Trò chơi tắt
    // (`on: false`) thì cả trường về null — tắt trò chơi là tắt mọi bề mặt của nó, không
    // riêng gì popover.
    rest: pet?.on ? { satMin: pet.satMin, stage: restStage } : null,
    // ── Huy hiệu trên icon — server chốt HÌNH, app chỉ vẽ ─────────────────────
    //
    // Ra đời một ngày sau `rest`, khi người dùng ngồi trước một icon câm và hỏi đúng câu
    // phải hỏi: *"Tôi đã đói + mệt rồi mà vẫn chưa có thông báo gì"* (9/8, kèm ảnh). Vế
    // trả lời được của câu ấy là vế MỆT: thang `rest` đã đo số phút ngồi từ hôm trước,
    // nhưng chưa có đường nào đưa nó ra khỏi popover.
    //
    // `level` là HÌNH, không phải nguyên nhân: `dot` chấm vàng 7pt · `bang` đĩa đỏ 11pt
    // mang dấu chấm than · `flood` đĩa đỏ cộng nhuộm đỏ cả chữ. Nguyên nhân nằm trọn
    // trong `say` (câu cho tooltip, server soạn bằng i18n), nên app Swift vẫn không biết
    // một luật nào, đúng ranh giới đã khai ở đầu NowMenuBar.swift, và thêm nguồn báo thứ
    // ba sau này không phải dựng lại app.
    //
    // Chỉ thang `rest` được bật đèn, còn cơn đói thì không. Bản 9/8 từng cho `starving`
    // đứng ngang `spent`, và phép đo ngày 10/9 cho thấy cái giá của nó: `fedAt` trong sổ
    // pet đứng từ 7/9, tức icon mang đĩa đỏ hơn hai ngày liền vì một trạng thái trò chơi
    // mà chủ máy vẫn không cho ăn. `bang` là kênh mà hạn mức token và thang ngồi-lâu dùng
    // để nói "cần làm gì đó thật", nên một mục đỏ bị lờ đi hai ngày dạy mắt bỏ qua cả
    // kênh ấy. Hàng rào 4 của brief 6/8 (briefs/brief-quan-gia-cua-hang-game-feel.md) đã
    // chốt luật cho ca này: trò chơi không đứng trên mặt số liệu.
    //
    // Cơn đói vẫn được NÓI, chỉ là không tự bật được đèn. Khi đã có một bậc `rest` thật
    // thì `say` kèm thêm câu `badge.starve`, nên người mở tooltip vẫn biết quản gia đang
    // đói. Trò chơi tắt hay đang giữa một động tác nghỉ thì `restStage` đã là null từ trên
    // kia, và đó là cửa duy nhất bịt được trường này — xem lý do ở chỗ khai `restStage`.
    alert: (() => {
      const level =
        restStage === 'over' ? 'flood' : restStage === 'spent' ? 'bang' : restStage === 'dip' ? 'dot' : null;
      if (!level) return null;
      // Tới dòng này thì chắc chắn có bậc ngồi-lâu, nên câu ngồi-lâu đứng TRƯỚC vì nó là thứ
      // vừa bật đèn, còn câu đói đi sau ở vai một tin kèm. Thứ tự ấy là quyết định chứ không
      // phải tình cờ: tooltip đọc từ trên xuống, và dòng đầu phải trả lời được "vì sao icon
      // đang sáng". `test/badge.test.js` khoá lại đúng thứ tự này.
      const say = [t('badge.sat', { n: pet.satMin }), pet.mood === 'starving' ? t('badge.starve') : null]
        .filter(Boolean)
        .join('\n');
      return { level, say };
    })(),
  };
}
