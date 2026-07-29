import fs from 'node:fs/promises';
import { CLAUDE_PROFILE } from '../config.js';

/**
 * Ba công cụ đang trả tiền hằng tháng đứng ở BẬC GÓI nào.
 *
 * Hạn mức trả lời "đã tiêu bao nhiêu phần"; chỗ này trả lời "bao nhiêu phần CỦA CÁI GÌ".
 * Hai câu khác nhau, và câu thứ hai không suy ra được từ câu thứ nhất: cả ba nguồn đều
 * gửi phần trăm, không nguồn nào gửi mẫu số. 58% của Max 20x và 58% của Pro là hai lượng
 * token lệch nhau cả bậc, nên thiếu bậc gói thì mọi con số ở màn Token đều không so được
 * qua thời gian — nâng gói xong là cả lịch sử lệch chuẩn mà không có gì báo.
 *
 * ## Ba nguồn, ba mức tin cậy KHÁC NHAU — và phải nói ra
 *
 * | Công cụ | Đọc ở đâu | Server có tự khai tên gói? |
 * |---|---|---|
 * | Claude | `~/.claude.json` → `oauthAccount` | có (`organizationRateLimitTier`) |
 * | Antigravity | RPC `GetUserStatus` ở localhost | có (`planInfo.planName`) |
 * | Cursor | suy từ `planUsage.includedSpend` | **KHÔNG** |
 *
 * Hai dòng đầu là lời của bên bán. Dòng thứ ba là phép đoán của dashboard: Cursor không
 * gửi tên gói ở bất kỳ trường nào, chỉ gửi số tiền đã bao gồm trong gói ($20/tháng), và
 * dashboard tra ngược bảng giá. Đúng hôm nay, nhưng nó hỏng ÂM THẦM vào ngày Anysphere
 * đổi giá hoặc thêm bậc — nên `derived: true` đi kèm để giao diện nói rõ đây là suy ra,
 * không phải đọc được.
 *
 * ## Vì sao không đọc Keychain cho Claude
 *
 * `claudeAiOauth.rateLimitTier` trong Keychain CÓ tên bậc, và nó SAI: máy này đọc ra
 * `default_claude_max_5x` trong khi tài khoản đang là Max 20x. Trường đó được ghi lúc
 * đăng nhập rồi nằm im — nâng gói không viết lại nó. Đây là loại sai tệ nhất có thể có
 * ở chỗ này: một chuỗi đúng định dạng, đúng kiểu, chỉ sai nội dung, nên không có phép
 * kiểm tra nào bắt được ngoài việc đối chiếu bằng mắt với app. Xem `config.js`.
 */

/** Giữ nguyên vẹn nếu chuỗi lạ: `default_claude_wombat` → "Wombat", còn hơn là mất hẳn. */
function titleCase(s) {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * `default_claude_max_20x` → `Max 20x`.
 *
 * Bội số giữ nguyên chữ thường (`20x`, không phải `20X`): đó là cách Anthropic viết
 * trong app, và bậc gói là thứ người dùng sẽ đối chiếu bằng mắt với app — viết khác đi
 * một ký tự là đủ để họ dừng lại tự hỏi có phải hai chỗ đang nói về hai thứ khác nhau.
 */
export function parseClaudeTier(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const body = s.replace(/^default_/, '').replace(/^claude_/, '');
  const m = body.match(/^([a-z]+)(?:_(\d+x))?$/i);
  const label = m ? `${titleCase(m[1])}${m[2] ? ` ${m[2].toLowerCase()}` : ''}` : titleCase(body);
  return { label, raw: s };
}

/**
 * Bậc gói Claude, từ `~/.claude.json`.
 *
 * `userRateLimitTier` thắng `organizationRateLimitTier` khi có: tài khoản trong tổ chức
 * có thể được cấp bậc riêng đè lên bậc chung. Trên máy này `userRateLimitTier` là `null`
 * và bậc thật nằm ở trường tổ chức — nên thứ tự này KHÔNG kiểm tra được bằng dữ liệu ở
 * đây, nó đến từ nghĩa của hai cái tên. Đọc phòng thủ: hỏng thì trả `null`, không ném.
 */
export async function collectClaudePlan() {
  let acc;
  try {
    acc = JSON.parse(await fs.readFile(CLAUDE_PROFILE, 'utf8'))?.oauthAccount;
  } catch {
    // Chưa đăng nhập, hoặc file đang được Claude Code ghi dở. Cả hai đều là "chưa biết".
    return { ok: false, reason: 'missing' };
  }
  if (!acc || typeof acc !== 'object') return { ok: false, reason: 'empty' };

  const tier = parseClaudeTier(acc.userRateLimitTier ?? acc.organizationRateLimitTier);
  if (!tier) return { ok: false, reason: 'empty' };

  return {
    ok: true,
    label: tier.label,
    raw: tier.raw,
    // Lời của server, không phải suy luận — giao diện được phép nói chắc.
    derived: false,
    // Bậc riêng của người dùng hay bậc chung của tổ chức. Khác nhau lúc đi soát lại
    // vì sao con số không khớp với người ngồi cạnh trong cùng tổ chức.
    scope: acc.userRateLimitTier ? 'user' : 'org',
    // Khối này do Claude Code làm mới, không phải dashboard. Cũ tới mức nào là chuyện
    // dashboard không điều khiển được, nên nó phải NÓI RA thay vì im lặng tin.
    fetchedAt: Number.isFinite(acc.profileFetchedAt) ? acc.profileFetchedAt : null,
  };
}

/**
 * Bảng giá Cursor, đơn vị CENT — mẫu số duy nhất suy ngược được ra tên gói.
 *
 * `planUsage.includedSpend` là số tiền dùng model đã bao gồm trong gói, và mỗi bậc một
 * con số. Đây KHÔNG phải giá gói theo nghĩa hoá đơn, và cũng không phải trần hạn mức —
 * chỉ là một con số tình cờ đủ để phân biệt các bậc. Cursor đổi bảng giá là bảng này sai,
 * và không có gì báo, nên nó nằm một chỗ có tên và mọi thứ đọc nó đều mang cờ `derived`.
 */
const CURSOR_PLANS = new Map([
  [2000, 'Pro'],
  [6000, 'Pro+'],
  [20000, 'Ultra'],
]);

/**
 * Bậc gói Cursor, suy từ `includedSpend`.
 *
 * Không tra ra bảng thì KHÔNG bịa tên: trả về đúng số tiền và để giao diện in "$25/tháng".
 * Một con số không có tên vẫn đúng; một cái tên đoán sai thì người đọc mang nó đi đối
 * chiếu với hoá đơn rồi kết luận dashboard hỏng.
 */
export function cursorPlan(cursor) {
  const cents = cursor?.ok ? cursor.planCents : null;
  if (!Number.isFinite(cents) || cents <= 0) return { ok: false, reason: 'empty' };
  const label = CURSOR_PLANS.get(cents) ?? null;
  return { ok: true, label, cents, derived: true };
}

/** Bậc gói Antigravity — server tự khai, `agquota.js` đã moi sẵn (xem `AG_STATUS_METHOD`). */
export function agPlan(agQuota) {
  const p = agQuota?.plan;
  if (!p?.label) return { ok: false, reason: agQuota?.ok ? 'empty' : (agQuota?.reason ?? 'missing') };
  return { ok: true, label: p.label, raw: p.raw ?? null, derived: false };
}

/** Cả ba bậc gói, gom về một chỗ để giao diện không phải tự nhớ nguồn nào đọc kiểu gì. */
export async function collectPlans({ cursor, agQuota }) {
  return {
    claude: await collectClaudePlan().catch(() => ({ ok: false, reason: 'broken' })),
    cursor: cursorPlan(cursor),
    antigravity: agPlan(agQuota),
  };
}
