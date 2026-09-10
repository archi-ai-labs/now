import fs from 'node:fs/promises';
import path from 'node:path';
import { SESSION_HOST_FILE } from '../config.js';

/**
 * Sổ "phiên nào chạy trong app nào".
 *
 * ## Vì sao phải có sổ
 *
 * Transcript ghi `entrypoint: "claude-vscode"` cho CẢ VS Code, Cursor lẫn bất kỳ bản
 * fork nào khác — cả ba dùng chung một extension nên với Claude Code chúng là một.
 * Đo trên máy này: 22.897 bản ghi mang nhãn đó, tức là gần một phần ba lượng token,
 * gộp vào một cái tên không nói lên editor nào.
 *
 * Thứ duy nhất phân biệt được là cây tiến trình — mà cây tiến trình chết theo phiên.
 * Nên: mỗi lượt quét thấy một phiên còn SỐNG là chốt app chủ của nó ra đĩa. Về sau
 * phiên tắt, transcript vẫn còn, và sổ này là đường duy nhất để quy token về đúng chỗ.
 *
 * ## Ba tính chất phải giữ
 *
 * - **Chỉ ghi thêm, không sửa lại.** Một phiên đã chạy trong Cursor thì vĩnh viễn là
 *   Cursor; ghi đè bằng lần quan sát sau chỉ có thể làm sai đi.
 * - **Không biết thì không ghi.** `hostOf` trả `null` khi leo hết cây mà không gặp app
 *   nào (chạy từ launchd, ssh, tiến trình nền). Ghi `null` vào sổ là đóng băng một câu
 *   trả lời sai — để trống thì lần chạy sau còn cơ hội.
 * - **Cắt bớt phần đã chết.** Claude Code tự xoá transcript sau ~30 ngày, nên mục sổ
 *   cũ hơn thế không còn gì để quy trách nhiệm nữa. Giữ 120 ngày cho rộng tay rồi cắt.
 */

const PRUNE_MS = 120 * 86400_000;

/** `{ sessionId: { host, at } }`, nạp một lần rồi giữ trong bộ nhớ. */
let ledger = null;
let dirty = false;

/**
 * Hàng đợi ghi, và bộ đếm cho tên file tạm.
 *
 * Bản trước hỏng hai lớp, và lớp thứ hai là lớp thật. Lớp dễ thấy: tên tạm là
 * `${SESSION_HOST_FILE}.${process.pid}`, tức MỌI lượt ghi trong cùng tiến trình dùng chung
 * một tên, nên hai lượt chồng nhau thì lượt xong trước đổi tên file đi mất còn lượt sau
 * `rename` vào một đường đã trống và ném ENOENT. Bộ đếm dưới đây đóng lớp ấy, cùng lối đặt
 * tên mà `cyclesTmpPath` trong `collect/quotalog.js` dùng.
 *
 * Lớp thật nằm ở THỨ TỰ. Đặt tên tạm khác nhau thì không lượt nào ném nữa, nhưng hai lượt
 * vẫn có thể đáp xuống ngược thứ tự phát ra, và khi ấy nội dung CŨ đè lên nội dung MỚI mà
 * không ai ném gì cả. Đo được: ép hai lượt ghi sát nhau 15 lần, chỉ sửa tên tạm thôi thì
 * 2/15 lần sổ trên đĩa giữ lại lượt đầu và mất lượt sau.
 *
 * Nên các lượt ghi được nối thành một hàng: mỗi lượt chụp trạng thái NGAY lúc được gọi, rồi
 * xếp sau lượt trước. Thứ tự trên đĩa vì vậy đúng bằng thứ tự gọi, và lượt gọi sau cùng là
 * lượt thắng, đó mới là điều gọi `syncHosts` mong đợi.
 */
let tmpSeq = 0;
let writeChain = Promise.resolve();

async function load() {
  if (ledger) return ledger;
  ledger = new Map();
  try {
    const raw = JSON.parse(await fs.readFile(SESSION_HOST_FILE, 'utf8'));
    for (const [id, v] of Object.entries(raw?.sessions ?? {})) {
      if (v?.host) ledger.set(id, { host: v.host, at: Number(v.at) || 0 });
    }
  } catch {
    /* chưa có sổ — lượt quét này sẽ tạo */
  }
  return ledger;
}

/**
 * Xếp một lượt ghi vào hàng và trả về lời hứa của cả hàng tính tới lượt này.
 *
 * Trạng thái được chụp ngay tại đây chứ không phải lúc lượt ghi chạy, vì `ledger` còn đổi
 * tiếp trong lúc lượt trước đang nằm trên đĩa; chụp muộn thì hai lượt ghi ra cùng một nội
 * dung và thứ tự mất hết ý nghĩa.
 */
function flush(now) {
  if (!dirty) return writeChain;
  dirty = false;
  const sessions = {};
  for (const [id, v] of ledger) {
    if (now - v.at <= PRUNE_MS) sessions[id] = v;
  }
  writeChain = writeChain.then(() => writeOnce(sessions));
  return writeChain;
}

/** Ghi tạm rồi đổi tên: đọc trúng lúc đang ghi thì thấy bản cũ nguyên vẹn. */
async function writeOnce(sessions) {
  const tmp = `${SESSION_HOST_FILE}.${process.pid}.${(tmpSeq += 1)}`;
  try {
    await fs.mkdir(path.dirname(SESSION_HOST_FILE), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify({ version: 1, sessions }));
    await fs.rename(tmp, SESSION_HOST_FILE);
  } catch {
    await fs.rm(tmp, { force: true }).catch(() => {});
    // Mất sổ chỉ tốn độ chính xác của một biểu đồ; làm sập lượt quét thì mất cả trang.
    // Nuốt lỗi ở đây là cố ý: ném ra thì cả hàng đợi phía sau hỏng theo một lượt ghi lỗi.
    dirty = true;
  }
}

/**
 * Cập nhật sổ bằng những gì đang quan sát được, rồi trả về bảng tra đầy đủ.
 *
 * `seen` là `Map<sessionId, host>` của các phiên CÒN SỐNG lượt này.
 */
export async function syncHosts(seen, now = Date.now()) {
  const book = await load();
  for (const [id, host] of seen) {
    if (!host || book.has(id)) continue;
    book.set(id, { host, at: now });
    dirty = true;
  }
  // Không await: đĩa chậm không có lý do gì chặn lượt quét, và mất một lượt ghi chỉ
  // có nghĩa là lượt sau ghi lại.
  flush(now);
  return book;
}

/** Chỉ dùng cho test: quên hết để mỗi ca chạy trên sổ sạch. */
export function _reset() {
  ledger = null;
  dirty = false;
}

/**
 * Chỉ dùng cho test: chờ mọi lượt ghi đang bay đáp xuống.
 *
 * Vì `syncHosts` cố ý không await `flush`, một ca test kết thúc vẫn có thể để lại một lượt
 * ghi lơ lửng, và lượt ấy đáp xuống GIỮA ca sau. Đó là nguyên nhân thật của ca "mục quá cũ
 * bị cắt" đỏ khoảng một trên sáu lượt `npm test` khi máy đang tải nặng: nó chờ mục `xua`
 * xuất hiện, trong khi lượt ghi còn sót của ca trước đè lên đúng lúc. Hàng đợi ở trên đã
 * chốt thứ tự, cửa này chỉ còn lo phần CHỜ. Cùng cửa với `_flush` của `makeTracker` trong
 * `collect/cycletrack.js`, và cùng lý do.
 */
export const _flush = () => writeChain;
