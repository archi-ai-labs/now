import fs from 'node:fs/promises';
import path from 'node:path';
import { HOME, TRANSCRIPTS_DIR, USAGE_ROLLUP, USAGE_DAYS } from '../config.js';
import { mapLimit } from '../lib/sh.js';
import { efficiencyOf } from './efficiency.js';

/**
 * Đọc lượng token đã tiêu của Claude Code, từ chính transcript trên máy.
 *
 * Nguồn duy nhất là `~/.claude/projects/<cwd-mã-hoá>/<sessionId>.jsonl`. Mỗi dòng
 * `type:"assistant"` mang một khối `message.usage` đầy đủ — input, output, cache
 * đọc, cache ghi tách theo TTL 5 phút và 1 giờ — kèm model, cwd, entrypoint, và
 * cả nhãn quy trách nhiệm cho MCP / skill / plugin đã gọi ra lượt đó.
 *
 * Ba chuyện cần biết trước khi tin bất kỳ con số nào ở đây:
 *
 * 1. **Phải khử trùng lặp.** Đo trên máy này: 46.844 dòng thô chỉ là 21.426 lượt
 *    gọi thật. `--resume` và fork chép NGUYÊN transcript cũ sang file mới, nên
 *    cộng thô là thổi phồng hơn gấp đôi. Khoá là `requestId` (đã kiểm: ánh xạ 1:1
 *    với `message.id`, không có ca một request sinh nhiều message).
 * 2. **Không có tiền trên đĩa.** Không dòng nào mang `costUSD`, và
 *    `additionalModelCostsCache` trong `~/.claude.json` rỗng. Số đô ở đây là ƯỚC
 *    LƯỢNG dựng từ bảng giá API dán cứng bên dưới — gói thuê bao không tính tiền
 *    theo đó. Xem `PRICES`.
 * 3. **Không có hạn mức.** Trạng thái giới hạn 5 giờ / theo tuần nằm ở server,
 *    đĩa không giữ bản sao nào. Dashboard không dựng lại được thanh "còn bao nhiêu".
 */

/**
 * Bảng giá API công khai, đô-la trên MỘT TRIỆU token.
 *
 * Chỉ có `in` và `out`; ba mức còn lại là hệ số cố định của cơ chế cache nên suy
 * ra được (xem `costOf`) thay vì chép tay năm con số cho mỗi model rồi lệch nhau.
 *
 * Đây là thứ SẼ lỗi thời — Anthropic đổi giá thì bảng này sai mà không có gì báo.
 * Nó nằm riêng một chỗ, xuất khẩu ra ngoài, và mọi chỗ hiện tiền đều phải nói rõ
 * là ước lượng.
 */
export const PRICES = {
  'claude-fable-5': { in: 10, out: 50 },
  'claude-mythos-5': { in: 10, out: 50 },
  'claude-opus-5': { in: 5, out: 25, fast: { in: 10, out: 50 } },
  'claude-opus-4-8': { in: 5, out: 25, fast: { in: 10, out: 50 } },
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-opus-4-6': { in: 5, out: 25 },
  'claude-opus-4-5': { in: 5, out: 25 },
  // Giá giới thiệu chạy tới hết 2026-08-31; áp theo NGÀY của lượt gọi chứ không
  // theo hôm nay, nếu không thì sang tháng 9 mọi ngày cũ bỗng đắt lên 50%.
  'claude-sonnet-5': { in: 3, out: 15, intro: { in: 2, out: 10, until: '2026-08-31' } },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

/** Hệ số so với giá input: cache ghi TTL 5 phút, cache ghi TTL 1 giờ, cache đọc. */
const CACHE_RATE = { write5m: 1.25, write1h: 2, read: 0.1 };

/**
 * Chuẩn hoá tên model về khoá của `PRICES`.
 *
 * Transcript ghi cả `claude-haiku-4-5-20251001` (có hậu tố ngày) lẫn
 * `claude-fable-5` (không). Cấu hình còn có dạng `claude-fable-5[1m]` cho cửa sổ
 * 1M. Cả hai biến thể vẫn là một model một giá.
 */
export function normalizeModel(model) {
  return String(model || '?')
    .replace(/\[[^\]]*\]$/, '')
    .replace(/-\d{8}$/, '');
}

/**
 * Ước lượng tiền cho một hàng, theo đô-la.
 *
 * Model lạ (model mới ra, hoặc `<synthetic>` — bản ghi nội bộ của Claude Code,
 * không phải lượt gọi API) trả `null` chứ không trả 0: 0 trông y hệt "miễn phí",
 * còn `null` thì chỗ hiển thị biết mà nói ra là không tính được.
 */
export function costOf(row) {
  const p = PRICES[normalizeModel(row.model)];
  if (!p) return null;

  const intro = p.intro && row.day && row.day <= p.intro.until ? p.intro : null;
  const rate = row.speed === 'fast' && p.fast ? p.fast : (intro ?? p);

  // Bản ghi đời cũ không tách `cache_creation` theo TTL. Dồn hết vào mức 5 phút:
  // đó là TTL mặc định, và đoán thấp còn hơn thổi phồng hoá đơn ước lượng.
  const split = row.cw5 + row.cw1;
  const cw5 = split ? row.cw5 : row.cw;
  const cw1 = split ? row.cw1 : 0;

  return (
    (row.inTok * rate.in +
      row.out * rate.out +
      cw5 * rate.in * CACHE_RATE.write5m +
      cw1 * rate.in * CACHE_RATE.write1h +
      row.cr * rate.in * CACHE_RATE.read) /
    1e6
  );
}

/**
 * Ngày ĐỊA PHƯƠNG của một mốc ISO.
 *
 * `timestamp` trong transcript là UTC. Cắt thẳng mười ký tự đầu là nhanh nhất và
 * cũng sai nhất ở đây: máy này ở UTC+7, nên mọi lượt gọi trước 07:00 sáng bị dồn
 * sang ngày hôm trước. Thẻ "hôm nay" mà thiếu cả buổi sáng thì tệ hơn không có.
 */
export function localDay(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Bóc một dòng transcript thành hàng token, hoặc `null` nếu dòng không mang usage.
 *
 * Tiền lọc bằng `includes` trước khi `JSON.parse`: bốn phần năm số dòng là lượt
 * user, tool result và meta — parse hết thì lượt quét nguội đắt lên nhiều lần cho
 * đúng cái kết quả đó.
 */
export function parseUsageLine(line) {
  if (!line.includes('"usage"')) return null;
  let d;
  try {
    d = JSON.parse(line);
  } catch {
    return null; // dòng cụt vì file đang được ghi dở — lượt quét sau sẽ thấy nó đủ
  }
  if (d.type !== 'assistant') return null;
  const u = d.message?.usage;
  if (!u) return null;

  const cc = u.cache_creation ?? {};
  return {
    // `requestId` vắng mặt ở 7 dòng đời cũ trên máy này; `uuid` luôn có và cũng
    // duy nhất, nên nó là đường lui thay vì bỏ mất hàng.
    id: d.requestId ?? d.uuid,
    ts: d.timestamp ?? null,
    day: localDay(d.timestamp),
    model: d.message.model ?? '?',
    speed: u.speed ?? 'standard',
    inTok: u.input_tokens ?? 0,
    out: u.output_tokens ?? 0,
    cw: u.cache_creation_input_tokens ?? 0,
    cw5: cc.ephemeral_5m_input_tokens ?? 0,
    cw1: cc.ephemeral_1h_input_tokens ?? 0,
    cr: u.cache_read_input_tokens ?? 0,
    cwd: d.cwd ?? null,
    entry: d.entrypoint ?? '?',
    session: d.sessionId ?? null,
    side: Boolean(d.isSidechain),
    mcp: d.attributionMcpServer ?? null,
    skill: d.attributionSkill ?? null,
    plugin: d.attributionPlugin ?? null,
  };
}

/* ── Quét tăng dần ────────────────────────────────────────────────────────── */

/**
 * Kết quả bóc của từng file, khoá theo đường dẫn.
 *
 * `.jsonl` chỉ được NỐI THÊM, không sửa giữa file — nên lượt quét sau chỉ cần đọc
 * phần đuôi mới. Không có cache này thì mỗi lượt dựng trạng thái phải nhai lại
 * 425MB (đo được 2,3 giây), mà server dựng lại mỗi 30 giây.
 *
 * Giữ nguyên từng HÀNG chứ không giữ tổng đã cộng, vì khử trùng lặp là việc xuyên
 * file: cùng một `requestId` nằm trong nhiều transcript sau mỗi lần `--resume`.
 */
const fileCache = new Map();

/** Đọc `[from, to)` rồi cắt ở dấu xuống dòng CUỐI nằm trong đoạn. */
async function readTail(file, from, to) {
  let fh;
  try {
    fh = await fs.open(file, 'r');
    const buf = Buffer.alloc(to - from);
    const { bytesRead } = await fh.read(buf, 0, buf.length, from);
    const chunk = buf.subarray(0, bytesRead);
    // Cắt theo BYTE chứ không theo ký tự: mốc đọc lần sau là một vị trí byte, mà
    // tiếng Việt trong transcript là UTF-8 nhiều byte — lệch một nhịp là hỏng
    // toàn bộ phần đuôi còn lại của file.
    const nl = chunk.lastIndexOf(0x0a);
    if (nl < 0) return { text: '', consumed: 0 };
    return { text: chunk.subarray(0, nl + 1).toString('utf8'), consumed: nl + 1 };
  } catch {
    return { text: '', consumed: 0 };
  } finally {
    await fh?.close();
  }
}

/** Mọi `*.jsonl` dưới thư mục transcript (một cấp con cho mỗi cwd). */
async function findTranscripts(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await findTranscripts(p)));
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

async function scanFile(file) {
  let st;
  try {
    st = await fs.stat(file);
  } catch {
    fileCache.delete(file);
    return [];
  }

  const hit = fileCache.get(file);
  // File co lại nghĩa là nó đã bị viết đè chứ không phải nối thêm — mốc đọc cũ
  // trỏ vào giữa một dòng khác hẳn, nên bỏ hết và đọc lại từ đầu.
  const resume = hit && st.size >= hit.offset ? hit : { offset: 0, rows: [] };
  if (hit === resume && st.size === hit.offset) return hit.rows;

  const { text, consumed } = await readTail(file, resume.offset, st.size);
  const rows = resume.rows.slice();
  for (const line of text.split('\n')) {
    const row = parseUsageLine(line);
    if (row?.id) rows.push(row);
  }

  fileCache.set(file, { offset: resume.offset + consumed, rows });
  return rows;
}

/* ── Sổ cộng dồn ──────────────────────────────────────────────────────────── */

/** Thứ tự cột trong file rollup — ghi thẳng vào file để nó tự mô tả được. */
const ROLLUP_COLS = ['msgs', 'in', 'out', 'cw5', 'cw1', 'cr'];
const rowToCols = (r) => [r.msgs, r.inTok, r.out, r.cw5, r.cw1, r.cr];
const colsToRow = (a) => ({ msgs: a[0], inTok: a[1], out: a[2], cw5: a[3], cw1: a[4], cr: a[5] });

export async function readRollup(file = USAGE_ROLLUP) {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    const out = new Map();
    for (const [day, models] of Object.entries(data.days ?? {})) {
      const m = new Map();
      for (const [model, cols] of Object.entries(models)) m.set(model, colsToRow(cols));
      out.set(day, m);
    }
    return out;
  } catch {
    return new Map(); // chưa có sổ, hoặc sổ hỏng — dựng lại từ transcript còn sống
  }
}

/**
 * Gộp lượt quét live vào sổ, lấy MAX từng ô.
 *
 * Không phải "live đè sổ": transcript bị xoá bớt giữa chừng thì lượt quét live
 * đếm hụt đúng ngày đó, và đè thẳng là tự tay xoá con số đã từng đúng. Token của
 * một ngày đã qua chỉ có thể tăng, nên `max` vừa đúng vừa chịu được mất mát.
 */
export function mergeRollup(saved, live) {
  const out = new Map(saved);
  for (const [day, models] of live) {
    const dst = new Map(out.get(day) ?? []);
    for (const [model, r] of models) {
      const p = dst.get(model);
      dst.set(
        model,
        p
          ? {
              msgs: Math.max(p.msgs, r.msgs),
              inTok: Math.max(p.inTok, r.inTok),
              out: Math.max(p.out, r.out),
              cw5: Math.max(p.cw5, r.cw5),
              cw1: Math.max(p.cw1, r.cw1),
              cr: Math.max(p.cr, r.cr),
            }
          : { ...r },
      );
    }
    out.set(day, dst);
  }
  return out;
}

async function writeRollup(merged, file = USAGE_ROLLUP) {
  const days = {};
  for (const day of [...merged.keys()].sort()) {
    const models = {};
    for (const [model, r] of merged.get(day)) models[model] = rowToCols(r);
    days[day] = models;
  }
  const body = JSON.stringify({ version: 1, cols: ROLLUP_COLS, updatedAt: Date.now(), days }, null, 1);
  await fs.mkdir(path.dirname(file), { recursive: true });
  // Ghi qua file tạm rồi đổi tên: dashboard bị đóng giữa lượt ghi thì sổ cũ vẫn
  // nguyên vẹn, thay vì còn lại một file JSON cụt không đọc được.
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, body);
  await fs.rename(tmp, file);
}

/* ── Tổng hợp ─────────────────────────────────────────────────────────────── */

const blank = () => ({ msgs: 0, inTok: 0, out: 0, cw5: 0, cw1: 0, cr: 0, cost: 0, unpriced: 0 });

/**
 * Cửa sổ hạn mức có ăn lượt gọi của model này không.
 *
 * Endpoint gửi `scope.model.display_name` ("Fable") với `scope.model.id` là `null`, nên
 * mối nối duy nhất còn lại là TÊN. Khớp theo từng từ chứ không so cả chuỗi: id thật là
 * `claude-fable-5`, `claude-opus-4-8` — dấu gạch và số đuôi không bao giờ khớp một tên
 * hiển thị. "Claude Opus" đòi cả hai từ nên nó ăn cả `claude-opus-5` lẫn `claude-opus-4-8`,
 * đúng ý một hạn mức theo dòng model.
 *
 * Đây là chỗ hỏng ÂM THẦM khi Anthropic đổi tên hiển thị — cùng loại với bảng giá Cursor.
 * Hỏng thì cửa sổ đó về $0, tức là im lặng chứ không sai số; vẫn phải nói ra ở đây.
 */
function modelInScope(model, display) {
  const id = model.toLowerCase();
  return String(display)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => id.includes(w));
}

/**
 * Phần cache ghi tính ở mức TTL 5 phút. Bản ghi đời cũ không có `cache_creation`
 * tách theo TTL, chỉ có một tổng — dồn hết vào mức 5 phút, cùng quy ước với
 * `costOf` để chart và hoá đơn ước lượng không nói hai con số khác nhau.
 */
const write5m = (row) => (row.cw5 + row.cw1 ? row.cw5 : row.cw);

function add(acc, row, cost) {
  acc.msgs += 1;
  acc.inTok += row.inTok;
  acc.out += row.out;
  acc.cw5 += write5m(row);
  acc.cw1 += row.cw1;
  acc.cr += row.cr;
  if (cost == null) acc.unpriced += 1;
  else acc.cost += cost;
  return acc;
}

function bucket(map, key, row, cost) {
  if (key == null) return;
  if (!map.has(key)) map.set(key, blank());
  add(map.get(key), row, cost);
}

const rank = (map, extra = () => ({})) =>
  [...map.entries()]
    .map(([key, v]) => ({ key, ...v, ...extra(key) }))
    .sort((a, b) => b.out - a.out);

const shiftDay = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Ngày Claude Code ghi token đầu tiên trên máy này. Nằm trong `~/.claude.json`,
 * file 60KB đọc một lần rồi thôi — nó gần như không đổi, và thứ ta cần chỉ là một
 * chuỗi ngày dùng để nói "sổ đang thiếu ngần này ngày".
 */
let firstTokenDate;
async function readFirstTokenDate(home = HOME) {
  if (firstTokenDate !== undefined) return firstTokenDate;
  try {
    const raw = JSON.parse(await fs.readFile(path.join(home, '.claude.json'), 'utf8'));
    firstTokenDate = localDay(raw.claudeCodeFirstTokenDate) ?? null;
  } catch {
    firstTokenDate = null;
  }
  return firstTokenDate;
}

let cache = null;

/**
 * Chữ ký của `cache`, giữ NGOÀI object trả về.
 *
 * Nó từng là một trường trong chính object ấy, và vì object ấy đi thẳng vào `state.usage`
 * nên chữ ký đi theo luôn ra SSE: đo trên máy này **118 KB, 22,7% cả payload**, gửi cho
 * mỗi tab mỗi lượt quét — trong khi client không có một dòng nào đọc tới nó. Chữ ký dài
 * vì nó liệt kê từng transcript kèm offset (`inputSignature`), tức nó lớn lên theo số
 * file trên đĩa; giữ nó trong payload là để một cuốn sổ nội bộ của server phình ra trên
 * đường truyền của người dùng.
 */
let cacheSig = null;

/**
 * Chữ ký của ĐẦU VÀO một lượt quét — thứ quyết định có phải cộng lại hay không.
 *
 * Trước đây chỗ này là một cái đồng hồ (`USAGE_TTL_MS = 15 s`), mà nhịp quét nền là 30
 * giây: 30 > 15 nên nhịp nền TRƯỢT memo ở mọi lượt, và cứ nửa phút một lần lại khử trùng
 * lặp ~28 nghìn hàng rồi dựng lại toàn bộ bảng ngày/model/dự án/entrypoint — kể cả khi
 * không transcript nào đổi một byte. Đo được 207–319 ms mỗi lượt, trả cho một kết quả y
 * hệt lượt trước.
 *
 * Chữ ký này KHÔNG làm dữ liệu cũ đi. `stat` vẫn chạy đủ cho từng file ở mọi lượt — thứ
 * bị bỏ là phép CỘNG LẠI khi đầu vào y nguyên. Bốn thành phần, mỗi cái ứng với một
 * đường mà kết quả đổi được:
 *
 * - `offset` từng file: số byte đã đọc. File dài thêm (hoặc mới, hoặc mất) là chữ ký đổi.
 *   Lấy ngay từ `fileCache` mà `scanFile` vừa cập nhật, không tốn thêm lượt `stat` nào.
 * - `today`: phần dựng chuỗi ngày ở dưới cắt theo ngày hôm nay, nên qua nửa đêm là kết
 *   quả phải khác dù đĩa đứng yên.
 * - số app chủ và chữ ký cửa sổ hạn mức: hai thứ đến từ ngoài, vốn đã nằm trong điều
 *   kiện cũ.
 *
 * Sắp xếp trước khi ghép vì `findTranscripts` trả theo thứ tự `readdir` — không hứa hẹn
 * gì giữa hai lượt. Danh sách đưa cho `mapLimit` thì giữ nguyên thứ tự gốc: đổi nó là
 * đổi luôn bản nào thắng khi khử trùng lặp.
 *
 * @param entries cặp `[đường dẫn, số byte đã đọc]` của từng transcript
 */
export function inputSignature(entries, today, hostCount, winSig) {
  const parts = entries.map(([file, offset]) => `${file}:${offset}`).sort();
  return `${today}|${hostCount}|${winSig}|${parts.join('\n')}`;
}

/**
 * Toàn cảnh token: theo ngày, theo model, theo dự án, theo entrypoint, và theo
 * thứ đã gọi ra nó (MCP / skill / plugin).
 *
 * `byProject` khoá theo `cwd` thô — collector không biết gì về danh sách dự án;
 * việc gán tên là của `state.js`, nơi đã có sẵn bảng tra worktree.
 */
export async function collectUsage({ force = false, hosts = null, windows = [] } = {}) {
  // Chữ ký cửa sổ nằm trong điều kiện dùng lại cache vì `spentIn` được tính TRONG lượt
  // quét: mốc mở cửa sổ đứng yên suốt cả cửa sổ, nên chữ ký chỉ đổi đúng lúc hạn mức
  // reset — và đúng lúc đó tổng cũ phải bị vứt, không thì thẻ 5 giờ mang số của cửa sổ
  // TRƯỚC cho tới khi có transcript nào đó dài thêm.
  const winSig = windows.map((w) => `${w.key}:${w.startMs}:${w.model ?? ''}`).join('|');

  const t0 = Date.now();
  const files = await findTranscripts(TRANSCRIPTS_DIR);
  const perFile = await mapLimit(files, 8, scanFile);

  // Transcript bị Claude Code dọn thì không còn nằm trong danh sách quét nữa, nên
  // `scanFile` không bao giờ được gọi cho nó — hàng của nó sẽ nằm lại trong cache
  // vĩnh viễn. Không sai kết quả (cache chỉ được đọc qua danh sách trên), nhưng
  // dashboard chạy nền hàng tuần thì đó là bộ nhớ chỉ có tăng.
  const alive = new Set(files);
  for (const key of fileCache.keys()) if (!alive.has(key)) fileCache.delete(key);

  // Ngày hôm nay theo giờ máy — cột mốc của cả phần dựng chuỗi ngày ở dưới, nên nó
  // phải nằm TRONG chữ ký: đứng yên qua nửa đêm là chart treo ở ngày hôm qua cho tới
  // lúc có transcript nào đó động vào.
  const today = localDay(new Date().toISOString());
  const inSig = inputSignature(
    files.map((f) => [f, fileCache.get(f)?.offset ?? -1]),
    today,
    hosts?.size ?? 0,
    winSig,
  );
  if (!force && cache && cacheSig === inSig) return cache;

  // Khử trùng lặp XUYÊN file: mỗi lần `--resume` là một bản sao đầy đủ của lịch
  // sử cũ nằm dưới một sessionId mới.
  const seen = new Set();
  const rows = [];
  for (const list of perFile) {
    if (!list) continue; // `mapLimit` trả null cho file làm `scanFile` ném
    for (const r of list) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push(r);
    }
  }

  const byDayModel = new Map(); // ngày → model → tổng thô (để ghi sổ)
  const days = new Map();
  const models = new Map();
  const projects = new Map();
  const entrypoints = new Map();
  const mcp = new Map();
  const skills = new Map();
  const plugins = new Map();

  // Một ô cho mỗi cửa sổ hạn mức đang mở. `oldestTs` là mốc sớm nhất còn đọc được trên
  // đĩa: cửa sổ nào mở TRƯỚC mốc đó thì phần đầu của nó đã bị Claude Code dọn mất, và
  // tổng ra thiếu — sổ theo ngày không cứu được vì nó không phân giải nổi trong ngày.
  // Ca đó phải ra "≥" chứ không phải "≈" (xem `partial`).
  const win = windows.map((w) => ({ ...w, cost: 0, out: 0, msgs: 0, unpriced: 0 }));
  let oldestTs = null;

  for (const r of rows) {
    const model = normalizeModel(r.model);
    const cost = costOf(r);

    if (win.length && r.ts) {
      const at = Date.parse(r.ts);
      if (!Number.isNaN(at)) {
        if (oldestTs === null || at < oldestTs) oldestTs = at;
        for (const a of win) {
          if (at < a.startMs) continue;
          if (a.model && !modelInScope(model, a.model)) continue;
          a.msgs += 1;
          a.out += r.out;
          if (cost == null) a.unpriced += 1;
          else a.cost += cost;
        }
      }
    }

    bucket(days, r.day, r, cost);
    bucket(models, model, r, cost);
    bucket(projects, r.cwd, r, cost);
    // Nơi mở Claude, ưu tiên APP CHỦ đã chốt trong sổ (`collect/hosts.js`).
    //
    // `entrypoint` của transcript ghi `claude-vscode` cho cả VS Code lẫn Cursor lẫn mọi
    // bản fork khác — một cái tên cho ba cái editor, và trên máy này đó là gần một phần
    // ba lượng token. Sổ biết phiên nào chạy ở đâu thì dùng sổ; không biết thì giữ
    // nguyên nhãn thô, vì đoán bừa còn tệ hơn gộp.
    bucket(entrypoints, hosts?.get(r.session)?.host ?? r.entry, r, cost);
    bucket(mcp, r.mcp, r, cost);
    bucket(skills, r.skill, r, cost);
    bucket(plugins, r.plugin, r, cost);

    if (r.day) {
      if (!byDayModel.has(r.day)) byDayModel.set(r.day, new Map());
      const m = byDayModel.get(r.day);
      if (!m.has(model)) m.set(model, { msgs: 0, inTok: 0, out: 0, cw5: 0, cw1: 0, cr: 0 });
      const acc = m.get(model);
      acc.msgs += 1;
      acc.inTok += r.inTok;
      acc.out += r.out;
      acc.cw5 += write5m(r);
      acc.cw1 += r.cw1;
      acc.cr += r.cr;
    }
  }

  const merged = mergeRollup(await readRollup(), byDayModel);
  let rollupError = null;
  try {
    await writeRollup(merged);
  } catch (err) {
    // Không ghi được sổ thì vẫn còn dữ liệu live để xem; nhưng phải NÓI RA, vì
    // im lặng ở đây nghĩa là lịch sử đang bị mất dần mà không ai biết.
    rollupError = err.message;
  }

  // Chart vẽ từ SỔ chứ không từ lượt quét live: sổ mới là thứ còn giữ được những
  // ngày mà transcript đã bị dọn.
  const allDays = [...merged.keys()].sort();
  const end = allDays.length ? (allDays.at(-1) > today ? today : allDays.at(-1)) : today;
  const floor = shiftDay(end, -(USAGE_DAYS - 1));
  const start = allDays.length && allDays[0] > floor ? allDays[0] : floor;
  const dropped = allDays.filter((d) => d < start).length;

  const series = [];
  for (let iso = start; iso <= end; iso = shiftDay(iso, 1)) {
    const perModel = merged.get(iso) ?? new Map();
    const acc = { day: iso, msgs: 0, inTok: 0, out: 0, cw5: 0, cw1: 0, cr: 0, cost: 0, byModel: {} };
    for (const [model, r] of perModel) {
      const cost = costOf({ ...r, model, day: iso, speed: 'standard', cw: 0 });
      acc.msgs += r.msgs;
      acc.inTok += r.inTok;
      acc.out += r.out;
      acc.cw5 += r.cw5;
      acc.cw1 += r.cw1;
      acc.cr += r.cr;
      acc.cost += cost ?? 0;
      acc.byModel[model] = { ...r, cost };
    }
    series.push(acc);
  }

  const sinceDay = (n) => shiftDay(today, -(n - 1));
  const window = (n) => {
    const from = sinceDay(n);
    const acc = blank();
    for (const d of series) {
      if (d.day < from) continue;
      acc.msgs += d.msgs;
      acc.inTok += d.inTok;
      acc.out += d.out;
      acc.cw5 += d.cw5;
      acc.cw1 += d.cw1;
      acc.cr += d.cr;
      acc.cost += d.cost;
    }
    return acc;
  };

  const all = blank();
  for (const d of series) {
    all.msgs += d.msgs;
    all.inTok += d.inTok;
    all.out += d.out;
    all.cw5 += d.cw5;
    all.cw1 += d.cw1;
    all.cr += d.cr;
    all.cost += d.cost;
  }

  const first = await readFirstTokenDate();
  const onDisk = rows.reduce((min, r) => (r.day && (min === null || r.day < min) ? r.day : min), null);

  // Đầu vào của chính lượt này — lượt sau so với nó để biết có phải cộng lại không.
  // Để ngoài `cache`, xem chú thích ở `cacheSig`.
  cacheSig = inSig;

  cache = {
    ok: true,
    scannedAt: Date.now(),
    /** Sổ app chủ lớn lên thì bảng "nơi mở Claude" đổi theo — cache phải biết mà bỏ đi. */
    hostCount: hosts?.size ?? 0,
    winSig,
    /**
     * Tiền và token đã tiêu KỂ TỪ mốc mở của từng cửa sổ hạn mức, khoá theo `key` mà
     * `state.js` gửi vào.
     *
     * Đây là số duy nhất trên dashboard nối được hai thứ vốn không nói chuyện với nhau:
     * phần trăm hạn mức (server Anthropic đếm, không kèm mẫu số) và tiền (bảng giá API
     * × token đọc từ transcript). Nối được vì transcript ghi mốc thời gian TỪNG lượt, nên
     * cắt theo giờ là chính xác — không cần sổ mới, và sổ theo ngày hiện có thì không làm
     * nổi việc này.
     *
     * Hai chỗ nó KHÔNG bằng nhau với phần trăm, và giao diện phải nói ra:
     * - phần trăm là của cả TÀI KHOẢN, tiền là của MÁY NÀY. Chạy Claude Code ở máy khác
     *   thì phần trăm biết còn tiền không.
     * - `partial` = cửa sổ mở trước lượt gọi sớm nhất còn trên đĩa, tức tổng ra thiếu.
     */
    spentIn: Object.fromEntries(
      win.map((a) => [
        a.key,
        {
          cost: a.cost,
          out: a.out,
          msgs: a.msgs,
          unpriced: a.unpriced,
          partial: oldestTs != null && oldestTs > a.startMs,
        },
      ]),
    ),
    scanMs: Date.now() - t0,
    files: files.length,
    requests: rows.length,
    duplicates: perFile.reduce((n, l) => n + (l?.length ?? 0), 0) - rows.length,
    series,
    droppedDays: dropped,
    windowDays: USAGE_DAYS,
    // Cả bốn mốc đều đọc từ `series` (tức là từ sổ), không lấy `days` của lượt
    // quét live — hai nguồn lệch nhau đúng ở những ngày transcript đã bị dọn, và
    // hai con số cùng một màn hình mà không khớp thì không con nào đáng tin.
    today: window(1),
    d7: window(7),
    d30: window(30),
    all,
    models: rank(models),
    projects: rank(projects),
    entrypoints: rank(entrypoints),
    mcp: rank(mcp),
    skills: rank(skills),
    plugins: rank(plugins),
    // Cache đọc so với TOÀN BỘ token đầu vào — chỉ số hiệu quả thật sự: 0,9 nghĩa
    // là chín phần mười ngữ cảnh mỗi lượt được phục vụ ở giá một phần mười.
    cacheHit: all.inTok + all.cw5 + all.cw1 + all.cr > 0 ? all.cr / (all.inTok + all.cw5 + all.cw1 + all.cr) : 0,
    // Bốn phép đo hiệu quả — tính từ HÀNG SỐNG, không từ sổ. Sổ khoá theo `ngày × model`
    // nên không tái dựng được phiên, thứ tự lượt hay khoảng nghỉ; xem `efficiency.js`.
    // Vì vậy khối này phủ hẹp hơn các chart theo ngày, và nó tự mang theo `from`/`to`
    // để chỗ vẽ nói ra chênh lệch đó thay vì để hai khối trông như cùng một tầm nhìn.
    eff: efficiencyOf(rows),
    retention: { firstToken: first, oldestOnDisk: onDisk, oldestInRollup: allDays[0] ?? null },
    rollupPath: USAGE_ROLLUP,
    rollupError,
  };
  return cache;
}
