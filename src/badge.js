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
export function badgeOf(s, now = Date.now()) {
  const q = s?.quota;
  const bind = q?.ok ? bindingOf(q) : null;
  const verdict = bind?.verdict ?? 'unknown';
  const awake = s?.stats?.awake ?? 0;
  const hot = s?.stats?.hotDecisions ?? 0;
  const why = degradedKey(q);

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
  };
}
