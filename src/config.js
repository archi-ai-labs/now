import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HOME = os.homedir();
export const CLAUDE_DIR = path.join(HOME, '.claude');

/** Nơi quét dự án. Sửa bằng biến môi trường NOW_ROOTS (ngăn cách bằng dấu phẩy). */
export const PROJECT_ROOTS = (process.env.NOW_ROOTS || path.join(HOME, 'Projects'))
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

export const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
export const TRANSCRIPTS_DIR = path.join(CLAUDE_DIR, 'projects');

/**
 * Sổ phiên RIÊNG của Claude Code desktop — không dùng chung với `SESSIONS_DIR`.
 * Đây là nơi duy nhất nối được id archive (`local_<uuid>`) với UUID transcript;
 * xem `collect/ccd.js`. Đường dẫn theo quy ước macOS, máy khác thì không có và
 * dashboard chỉ đơn giản là không hiện nút archive.
 */
export const CCD_SESSIONS_DIR = path.join(HOME, 'Library', 'Application Support', 'Claude', 'claude-code-sessions');
export const TASKS_DIR = path.join(CLAUDE_DIR, 'tasks');

/**
 * Đường cũ tới `now.schema.json`, hồi skill `now` còn là skill cá nhân chép tay.
 * Giữ lại làm lưới đỡ cho máy chưa chuyển sang plugin — xem `findNowSchema()`.
 */
export const NOW_SCHEMA_LEGACY = path.join(CLAUDE_DIR, 'skills', 'now', 'now.schema.json');

const PLUGIN_CACHE = path.join(CLAUDE_DIR, 'plugins', 'cache');

/** So hai chuỗi phiên bản theo SỐ, không theo chữ: "0.10.0" phải lớn hơn "0.9.0". */
function newerVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

/**
 * Tìm `now.schema.json` — hợp đồng của `NOW.json`, do skill `now` sở hữu chứ không
 * phải dashboard. Trả về đường dẫn, hoặc `null` khi máy chưa cài skill.
 *
 * KHÔNG hardcode được nữa. Skill nay đóng gói thành plugin `now-board@archi-ai-labs`,
 * mà plugin thì được CHÉP vào `~/.claude/plugins/cache/<marketplace>/<plugin>/<VERSION>/`
 * — số phiên bản nằm ngay giữa đường dẫn, nên nó đổi sau mỗi lần plugin lên đời. Dò
 * theo cây thư mục là cách duy nhất không phải sửa hằng số theo từng bản phát hành.
 *
 * Lấy bản mới nhất khi có nhiều version cùng nằm đó: cache giữ lại bản cũ (đo trên máy
 * này: trim-kit còn đủ 0.1.0 → 0.5.0), nên "cái đầu tiên đọc được" sẽ là một bản cũ tuỳ ý.
 *
 * Đọc đồng bộ và chỉ chạy lúc gọi, không lúc import: đây là đường dùng cho test, không
 * nằm trên vòng quét 30 giây.
 */
export function findNowSchema() {
  const rel = path.join('skills', 'now', 'now.schema.json');
  let best = null;

  for (const market of readDirs(PLUGIN_CACHE)) {
    const pluginDir = path.join(PLUGIN_CACHE, market, 'now-board');
    for (const version of readDirs(pluginDir)) {
      const file = path.join(pluginDir, version, rel);
      if (!fs.existsSync(file)) continue;
      if (!best || newerVersion(version, best.version)) best = { version, file };
    }
  }
  if (best) return best.file;

  return fs.existsSync(NOW_SCHEMA_LEGACY) ? NOW_SCHEMA_LEGACY : null;
}

function readDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Nơi dashboard tự cất dữ liệu của mình. KHÔNG ghi vào `~/.claude` — thư mục đó
 * là của Claude Code, và chính nó là thứ đang tự dọn dẹp (xem `USAGE_ROLLUP`).
 */
export const DATA_DIR = process.env.NOW_DATA_DIR || path.join(HOME, '.now-dashboard');

/**
 * Sổ cộng dồn token theo ngày.
 *
 * Claude Code tự xoá transcript cũ (`~/.claude/.last-cleanup`, mặc định 30 ngày).
 * Đo trên máy này: token đầu tiên ghi ngày 2026-07-03 mà transcript sớm nhất còn
 * lại là 2026-07-12 — chín ngày đã bốc hơi. Chỉ đọc live thì lịch sử cứ trôi mất
 * dần mà không ai báo, nên mỗi lượt quét chốt lại tổng theo ngày ra đây.
 */
export const USAGE_ROLLUP = path.join(DATA_DIR, 'usage-rollup.json');

/**
 * Hạn mức gói thuê bao. Đường chính là gọi thẳng endpoint; `statusline-quota.sh`
 * còn lại làm lưới đỡ. Lý do đổi ngôi nằm ở `collect/quota.js`.
 */
/**
 * Phải là `platform.claude.com`, KHÔNG phải `console.anthropic.com`.
 *
 * Tên cũ vẫn chạy, nhưng nó trả 301 sang đây — và `fetch` cắt header `Authorization`
 * mỗi khi redirect đổi origin (đúng spec, để token không rò sang host khác). Kết quả
 * là request tới nơi trong tình trạng trần trụi và server đáp "x-api-key header is
 * required", nghe hệt như sai kiểu xác thực chứ không hề giống lỗi redirect.
 *
 * `curl` và `urllib` của Python thì giữ header qua redirect, nên thử tay vẫn ra 200 —
 * đúng cái bẫy làm chuyện này khó lần ra.
 */
export const QUOTA_API_URL = 'https://platform.claude.com/api/oauth/usage';

/**
 * Mục Keychain chứa OAuth token của Claude Code. Dashboard đọc nó lúc gọi rồi thả,
 * không ghi ra đĩa và không log — xem `readToken()`.
 *
 * Đúng tên này, không phải `Claude Code` hay `claude-code`: `security` khớp chuỗi
 * tuyệt đối, sai một ký tự là trả về "không tìm thấy" y như chưa đăng nhập.
 */
export const KEYCHAIN_SERVICE = 'Claude Code-credentials';

/**
 * Sổ cấu hình của Claude Code, và là nơi DUY NHẤT nói đúng bậc gói.
 *
 * Có ba chỗ khai bậc gói, và hai trong ba nói sai:
 *
 * - `QUOTA_API_URL` — không có trường nào về gói. Đo trên máy này: phản hồi đủ
 *   `five_hour`, `seven_day`, `limits[]`, `extra_usage`, `spend`, không một chữ tier.
 * - **Keychain** (`claudeAiOauth.rateLimitTier`) — CÓ trường, và nó CŨ. Máy này đọc ra
 *   `default_claude_max_5x` trong khi tài khoản đang là Max 20x: giá trị được ghi lúc
 *   đăng nhập rồi nằm im, nâng gói không viết lại nó. Đừng đọc trường này.
 * - **`~/.claude.json`** → `oauthAccount.organizationRateLimitTier` = `default_claude_max_20x`,
 *   khớp đúng thứ app hiện. Kèm `profileFetchedAt` nên biết được số cũ tới mức nào —
 *   Claude Code tự làm mới khối này.
 *
 * Đọc đĩa, không đụng Keychain: không có hộp thoại xin quyền, không có credential nào
 * đi qua tay dashboard.
 */
export const CLAUDE_PROFILE = path.join(HOME, '.claude.json');

/** Ảnh chụp phản hồi endpoint gần nhất, để khởi động lại là có số ngay. */
export const QUOTA_API_CACHE = path.join(DATA_DIR, 'quota-api.json');

/** Ảnh chụp do `~/.claude/statusline-quota.sh` ghi ra — chỉ dùng khi endpoint chết. */
export const QUOTA_FILE = path.join(DATA_DIR, 'quota.json');

/**
 * Sổ hạn mức theo CHU KỲ — thứ duy nhất ở dashboard này không thể dựng lại được sau.
 *
 * Cùng lý do với `USAGE_ROLLUP` nhưng gắt hơn: token còn nằm trong transcript ba mươi
 * ngày, còn hạn mức thì endpoint chỉ trả về TRẠNG THÁI HIỆN TẠI — không có lịch sử, không
 * có tham số nào hỏi lại được chu kỳ trước. Chu kỳ 5 giờ nào không được ghi lúc nó đang
 * chạy thì mất vĩnh viễn. Nên sổ này ghi ngay từ lượt quét đầu tiên, kể cả khi chưa có
 * chart nào đọc nó.
 */
export const QUOTA_LOG = path.join(DATA_DIR, 'quota-cycles.json');

/**
 * Cùng loại sổ cho hai bề mặt còn lại — thêm 28/7 cho màn "Nhìn lại"
 * (docs/PROPOSAL-nhin-lai.md), và phải lên TRƯỚC màn đó: ảnh chụp AG (`AG_QUOTA_CACHE`)
 * bị ghi đè mỗi lượt, nên đỉnh của một tuần biến mất ngay lúc reset nếu không được gấp
 * vào sổ TRONG LÚC chu kỳ còn chạy — đúng luật của `QUOTA_LOG` ngay trên. Cursor thì mốc
 * chu kỳ billing nằm sẵn trong ảnh chụp, ghi kèm gần như miễn phí.
 */
export const AG_CYCLES_LOG = path.join(DATA_DIR, 'ag-cycles.json');
export const CURSOR_CYCLES_LOG = path.join(DATA_DIR, 'cursor-cycles.json');

/**
 * Giữ bao nhiêu chu kỳ ĐÃ CHỐT cho mỗi loại cửa sổ.
 *
 * Khung 5 giờ chốt ~4 lần một ngày, nên 120 phủ chừng một tháng — đủ để thấy nếp mà vẫn
 * dưới 20KB. Chu kỳ cũ hơn bị cắt khi ghi, không phải khi đọc: sổ này chỉ có một người
 * ghi và nó phải tự giới hạn được, không thì nó lớn mãi.
 */
export const QUOTA_CYCLES_KEEP = 120;

/**
 * Nhịp gọi endpoint. Dài hơn nhịp dựng lại trạng thái (30 giây) khá nhiều: hạn mức
 * nhích rất chậm, và đây là endpoint nội bộ không có tài liệu nên không có lý do gì
 * để gõ cửa 2880 lần một ngày.
 */
export const QUOTA_TTL_MS = 2 * 60 * 1000;

/** Quá ngần này mà số chưa được làm tươi thì coi là ảnh cũ — xem `collect/quota.js`. */
export const QUOTA_STALE_MS = 5 * 60 * 1000;

/**
 * Hạn mức gói Cursor — bề mặt thứ hai có hạn mức đọc được, sau Claude.
 *
 * Cursor cất token đăng nhập TRẦN (không mã hoá) trong SQLite `state.vscdb`, khoá
 * `cursorAuth/accessToken`, và **không cache một con số usage nào xuống đĩa** — nên
 * muốn biết đã tiêu bao nhiêu thì bắt buộc phải gọi endpoint, y như Claude.
 *
 * Mở bằng `mode=ro` chứ không copy file: `state.vscdb` ở đây nặng 124MB, chép mỗi
 * 30 giây là vô lý, mà SQLite ở chế độ WAL cho phép đọc song song trong lúc Cursor
 * đang ghi. `immutable=1` cũng đọc được nhưng nó BỎ QUA WAL, nghĩa là sẽ đọc phải
 * token cũ ngay sau khi Cursor làm mới đăng nhập.
 *
 * Cùng đánh đổi với endpoint hạn mức của Anthropic, và ở đây còn gắt hơn một bậc:
 * đây là RPC nội bộ của client Cursor, hoàn toàn không có tài liệu, dùng giao thức
 * Connect. Anysphere đổi là hỏng và không có gì báo trước — nên mọi trường đọc phòng
 * thủ, hỏng thì rơi xuống ảnh chụp cũ chứ không ném.
 */
export const CURSOR_STATE_DB = path.join(
  HOME,
  'Library',
  'Application Support',
  'Cursor',
  'User',
  'globalStorage',
  'state.vscdb',
);
export const CURSOR_API_BASE = 'https://api2.cursor.sh/aiserver.v1.DashboardService';
export const CURSOR_API_CACHE = path.join(DATA_DIR, 'cursor-usage.json');

/** Nhịp gọi Cursor. Dài hơn Claude: hạn mức tính theo chu kỳ THÁNG nên nó nhích còn chậm hơn. */
export const CURSOR_TTL_MS = 5 * 60 * 1000;
export const CURSOR_STALE_MS = 15 * 60 * 1000;

/**
 * Khoảng ngày xin ở `GetUserAnalytics`.
 *
 * Xin 90 ngày thì server trả về 80 — tức là chính nó cắt theo dữ liệu nó còn giữ, không
 * theo con số ta xin. Xin rộng hơn mức đó không tốn thêm gì (phản hồi vẫn ~20KB) và ngày
 * server thôi giữ nữa thì tự nó ngắn lại, không cần ai đi sửa hằng số này.
 */
export const CURSOR_ANALYTICS_DAYS = 90;

/**
 * Sổ sự kiện Cursor.
 *
 * `GetFilteredUsageEvents` trả về từng lượt gọi kèm mốc thời gian: 5.279 sự kiện trên máy
 * này trải 148 ngày, xếp mới→cũ, 1.000 sự kiện mỗi trang (~476KB, ~1,6 giây). Đây là trục
 * thời gian mà hai endpoint kia không có — chúng chỉ nói tổng cả chu kỳ.
 *
 * Sổ tồn tại vì CHI PHÍ, không vì sợ mất lịch sử: kéo trọn 6 trang mất ~10 giây và ~2,9MB,
 * quá đắt để nằm trong một lượt quét 30 giây. Xem `collect/cursorevents.js`.
 */
export const CURSOR_EVENTS_FILE = path.join(DATA_DIR, 'cursor-events.json');

/**
 * Nhịp kéo sự kiện, và bao nhiêu ngày cuối được dựng lại.
 *
 * Sự kiện là bất biến và xếp mới→cũ, nên đáng lẽ chỉ cần một cái mốc nước. Nhưng mốc nước
 * theo mili-giây thì hai sự kiện trùng mốc ở đúng ranh giới sẽ mất một cái, và phép sửa cho
 * ca đó đắt hơn hẳn phép tránh nó: kéo lại trọn **hai ngày cuối** rồi GHI ĐÈ đúng hai ngày
 * ấy trong sổ. Không cộng dồn thì không đếm hai lần, và ngày cũ hơn thì đóng băng.
 */
export const CURSOR_EVENTS_TTL_MS = 15 * 60 * 1000;
export const CURSOR_EVENTS_REDO_DAYS = 2;
/** Trần trang cho một lượt kéo. Chặn vòng lặp vô hạn nếu server ngừng tôn trọng `page`. */
export const CURSOR_EVENTS_MAX_PAGES = 12;
export const CURSOR_EVENTS_PAGE = 1000;

/**
 * Sổ nhớ "phiên nào chạy trong app nào".
 *
 * Transcript KHÔNG ghi lại app chủ: cả VS Code, Cursor lẫn Antigravity đều để
 * `entrypoint: "claude-vscode"` vì cả ba là bản fork của VS Code, dùng chung một
 * extension. Thứ duy nhất phân biệt được chúng là cây tiến trình — mà cây tiến trình
 * thì chết theo phiên. Nên mỗi lượt quét thấy một phiên còn sống là chốt luôn app chủ
 * của nó ra đây; sổ này là đường DUY NHẤT để sau đó quy token về đúng editor.
 */
export const SESSION_HOST_FILE = path.join(DATA_DIR, 'session-hosts.json');

/**
 * Antigravity (Google). Không phải bản fork VS Code chuẩn: nó bỏ hẳn `User/` của
 * VS Code và tự cất trạng thái ở `~/.gemini/antigravity`, mỗi hội thoại một file
 * SQLite trong `conversations/`, còn `agyhub_summaries_proto.pb` là sổ mục lục
 * (protobuf, không có tài liệu — xem `collect/antigravity.js`).
 */
export const ANTIGRAVITY_DIR = path.join(HOME, '.gemini', 'antigravity');
export const ANTIGRAVITY_SUMMARIES = path.join(ANTIGRAVITY_DIR, 'agyhub_summaries_proto.pb');
export const ANTIGRAVITY_CONVOS = path.join(ANTIGRAVITY_DIR, 'conversations');

/**
 * Hạn mức Antigravity — bề mặt thứ ba có hạn mức đọc được.
 *
 * Không gọi thẳng Google: `language_server` của Antigravity **tự phơi đúng RPC ấy ở
 * localhost** và tự xác thực với backend hộ. Nên dashboard không đụng vào token của
 * người dùng, chỉ hỏi một tiến trình đang chạy sẵn trên máy.
 *
 * Ba mắt xích, không cái nào đoán được:
 *
 * 1. **Cổng đổi mỗi lần khởi động.** `language_server` nghe hàng chục cổng loopback;
 *    cổng API là cổng duy nhất mà `GET /` trả về trang có `window.__APP_CONFIG__`.
 * 2. **Token chống CSRF nằm ngay trong trang đó** (`__APP_CONFIG__.csrfToken`) — cùng
 *    một request vừa nhận diện đúng cổng vừa lấy được token. Đây là token của server
 *    nội bộ, không phải credential của người dùng.
 * 3. **Tên header là `x-codeium-csrf-token`.** Không suy ra được: `Csrf-Token`,
 *    `X-Csrf-Token`, `X-Api-Key` đều bị 401 dù binary có đủ cả ba chuỗi đó. Chỉ đọc
 *    `main.js` của giao diện mới thấy.
 */
export const AG_RPC_METHOD = '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary';

/**
 * Tên gói Antigravity. RPC RIÊNG, không nằm chung với hạn mức.
 *
 * `RetrieveUserQuotaSummary` chỉ trả `remainingFraction` — không một chữ nào về bậc gói,
 * dù chính lời mô tả của nó nói "weekly limit is tied directly to your individual tier".
 * Bậc gói nằm ở `GetUserStatus`, dưới `userStatus.planStatus.planInfo`: `planName` ("Pro")
 * và `teamsTier` ("TEAMS_TIER_PRO").
 *
 * Đi cùng cổng, cùng token, cùng nhịp với hạn mức — nên nó không tốn thêm lần dò cổng nào.
 * Phản hồi ~12KB mà chỗ cần chưa tới 100 byte, nên chỉ đúng khối `planStatus` được giữ lại.
 */
export const AG_STATUS_METHOD = '/exa.language_server_pb.LanguageServerService/GetUserStatus';
export const AG_QUOTA_CACHE = path.join(DATA_DIR, 'ag-quota.json');

/**
 * Nhịp gọi. Chậm hơn Claude (2 phút) vì đây là backend của người khác và ta đang đi
 * nhờ client của họ — không có lý do gì gõ cửa dày hơn mức cần để thấy kim nhích.
 */
export const AG_QUOTA_TTL_MS = 5 * 60 * 1000;
export const AG_QUOTA_STALE_MS = 15 * 60 * 1000;

/**
 * Nơi họ nhà VS Code ghi lại cửa sổ đang mở.
 *
 * Đọc `backupWorkspaces` chứ không đọc `windowsState`: `windowsState` chỉ được ghi
 * lúc THOÁT, nên lúc app đang chạy nó là ảnh của phiên trước. `backupWorkspaces` thì
 * tồn tại đúng bằng thời gian cửa sổ mở (nó phục vụ hot-exit), nên nó mới là "đang mở".
 */
export const EDITOR_STORAGE = {
  cursor: path.join(HOME, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'storage.json'),
  vscode: path.join(HOME, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'storage.json'),
};

/** Hội thoại Antigravity im lặng quá lâu thì coi như đang ngủ — cùng luật với phiên Claude. */
export const CONVO_IDLE_MS = 30 * 60 * 1000;

/** Hội thoại cũ hơn ngần này ngày thì không kể nữa: sổ giữ tất, màn hình thì không. */
export const CONVO_KEEP_DAYS = 14;

/** Cửa sổ tối đa của chart token theo ngày. */
export const USAGE_DAYS = 45;

/**
 * Giá ba gói đang trả, USD/THÁNG — config tay, sửa ở đây khi đổi gói.
 *
 * Con số phỏng vấn chốt 28/7 (docs/PROPOSAL-nhin-lai.md, câu 9–12): Claude Max 20x $200,
 * Cursor Pro $20, Google AI Pro (Antigravity) $20. Không đọc được từ nguồn nào — Cursor
 * chỉ khai `includedSpend` (trùng giá gói là tình cờ của bậc Pro), hai nguồn kia không
 * khai gì. Cái giá của config tay: đổi gói mà quên sửa thì mọi con số tiền của màn
 * "Nhìn lại" sai — nên màn in giá đang khai NGAY CẠNH số, để mắt bắt được, không cần nhớ.
 */
export const PLANS = { claude: 200, cursor: 20, antigravity: 20 };

/*
 * `USAGE_TTL_MS` từng đứng ở đây: trần tuổi 15 giây cho một lượt quét token. Bỏ đi vì
 * nó ngắn hơn chính nhịp quét nền 30 giây, nên nhịp nền trượt memo ở MỌI lượt — cái
 * trần dựng ra để đỡ CPU lại chưa từng đỡ được lượt nào. Nay điều kiện dùng lại cache
 * là chữ ký đầu vào, không phải đồng hồ: xem `inputSignature` trong `collect/usage.js`.
 */

/**
 * `NOW_PORT` là biến của riêng dự án; `PORT` là cái mà công cụ chạy dev server ngoài
 * (preview của Claude Code, và hầu hết PaaS) tự gán khi cổng mặc định đã bận. Không
 * đọc `PORT` thì bản thứ hai cứ nhè 4400 mà đâm vào bản đang chạy rồi chết.
 */
export const PORT = Number(process.env.NOW_PORT || process.env.PORT || 4400);

/** Độ sâu tối đa khi tìm NOW.json / repo git dưới mỗi root. */
export const SCAN_DEPTH = 3;

/** Ngưỡng sức khoẻ của một NOW board. */
export const HEALTH = {
  /** Quá số commit này kể từ stamp → board bắt đầu lệch. */
  driftCommits: 5,
  /** Quá số ngày này kể từ updatedAt → board bắt đầu cũ. */
  driftDays: 3,
  /** Quá mức này → coi như hết hạn, cần chạy /now update. */
  staleCommits: 15,
  staleDays: 7,
};

/** Phiên sống nhưng không có hoạt động quá lâu thì gắn cờ "đang ngủ". */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** Chờ người khác quá số ngày này thì nhắc được rồi (khớp skill `now`). */
export const WAITING_NUDGE_DAYS = 7;

/** Repo không có NOW board nhưng có commit trong ngần này ngày → gợi ý seed. */
export const ORPHAN_ACTIVE_DAYS = 14;
