/**
 * Lớp đa ngôn ngữ (i18n) cho dashboard.
 *
 * Nguồn chân lý là bảng `DICT` bên dưới: mọi chuỗi hiển thị nằm ở đây, mã nguồn chỉ
 * còn KHOÁ. Tiếng Việt là ngôn ngữ gốc và cũng là mặc định; tiếng Anh là bản dịch.
 *
 * `t(key, params)`:
 *   - Trị là chuỗi   → nội suy `{tên}` từ `params`.
 *   - Trị là hàm     → gọi `fn(params)` (dùng cho số nhiều / ngữ pháp phụ thuộc dữ liệu).
 *   - Thiếu khoá     → rơi về bản tiếng Việt, cuối cùng trả nguyên khoá (để lộ chỗ sót).
 *
 * Đổi ngôn ngữ chỉ là đổi một biến rồi vẽ lại cả trang — đúng như đổi nền sáng/tối.
 * `app.js` đăng ký một callback qua `onLangChange` để chạy `render()` + cập nhật phần
 * HTML tĩnh trong `index.html`.
 */

/**
 * BỘ THUẬT NGỮ TRÊN MÀN — chốt 30/7/2026, sau một lần bị sửa lưng thật: chữ trên màn
 * dịch từng-chữ thuật ngữ tiếng Anh (target → "đích", manual → "khai tay", pool → nơi
 * gọi "túi" nơi gọi "hồ"). Một khái niệm một từ, dùng xuyên suốt cả hai ngôn ngữ;
 * gặp khái niệm mới thì chốt vào bảng này TRƯỚC khi viết chuỗi.
 *
 *   khái niệm                      | VI trên màn                         | EN trên màn
 *   pool hạn mức (AG)              | quỹ (quỹ Gemini, quỹ 5 giờ)         | pool
 *   partial coverage của tracker   | theo dõi hụt (+ chú giải 1 lần)     | under-watched
 *   lower / upper bound            | mức sàn / mức trần                  | lower / upper bound
 *   gán giá tiền                   | quy ra tiền                         | assign dollars
 *   dựng lại dữ liệu quá khứ       | dựng lại dữ liệu quá khứ (backfill) | backfill
 *   bảng số của chart (tableTwin)  | bảng số đi kèm                      | companion data table
 *   đồng hồ máy đang chạy app      | giờ hệ thống                        | system clock
 *   cấu hình bằng tay              | nhập tay (trong config)             | set by hand
 *   so được với nhau               | so sánh trực tiếp                   | compared side by side
 *   đủ dữ liệu để tin              | đáng tin                            | trustworthy
 *   sổ mở sau cùng (đặt nhịp cổng) | sổ mở muộn nhất                     | youngest ledger
 *   tiêu hết hạn mức               | tiêu hết là mục tiêu                | the GOAL, not an alarm
 *
 * "túi", "hồ", "song sinh", "cận dưới" vẫn còn trong code/docs/tên nội bộ (tableTwin,
 * bucketId) — đó là chữ cho dev, không lên màn. Luật văn phong đầy đủ: khối
 * "LUẬT CHỮ NGHĨA" giữa file này.
 */

// Tooltip là bảng nhãn ↔ trị, không phải một câu, nên chuỗi của nó được đóng gói chứ
// không nối tay. Xem `lib/tip.js` — module đó không import gì, nên không có vòng lặp.
import { tipOf } from './tip.js';

export const LANGS = ['vi', 'en'];
const LANG_KEY = 'now-lang';

/** Tên hiển thị của mỗi ngôn ngữ, dùng cho nút chuyển. */
export const LANG_LABEL = { vi: 'Tiếng Việt', en: 'English' };

function readLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (LANGS.includes(v)) return v;
  } catch {
    /* chế độ riêng tư chặn localStorage — dùng mặc định */
  }
  return 'vi';
}

let current = readLang();
const listeners = new Set();

export const getLang = () => current;

/** Ngôn ngữ sẽ chuyển sang khi bấm nút (chỉ có hai nên là cái còn lại). */
export const nextLang = () => (current === 'vi' ? 'en' : 'vi');

/** Locale cho `toLocaleTimeString` / `toLocaleDateString`. */
export const locale = () => (current === 'en' ? 'en-GB' : 'vi-VN');

export function setLang(l) {
  if (!LANGS.includes(l) || l === current) return;
  current = l;
  document.documentElement.lang = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* không nhớ được thì lần sau về mặc định, không sao */
  }
  for (const cb of listeners) cb(l);
}

export function onLangChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function t(key, params) {
  const table = DICT[current] || DICT.vi;
  let v = table[key];
  if (v === undefined) v = DICT.vi[key];
  if (v === undefined) return key;
  if (typeof v === 'function') return v(params || {});
  if (params) return v.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? params[k] : ''));
  return v;
}

/**
 * Dịch phần HTML tĩnh trong `index.html`. Đi theo thuộc tính đánh dấu chứ không tìm
 * từng phần tử bằng tay — thêm chuỗi tĩnh mới chỉ cần gắn `data-i18n*`, không phải
 * sờ vào hàm này.
 */
export function applyStaticI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  document.title = t('app.title');
}

// Đặt `lang` trên <html> ngay khi module nạp, trước lượt vẽ đầu. Có bọc `typeof` vì
// các file view cũng được `import` trong test chạy bằng Node — nơi không có `document`.
if (typeof document !== 'undefined') document.documentElement.lang = current;

/**
 * Bảng chuỗi thô của một ngôn ngữ. Chỉ có một chỗ dùng: test soát ngang VI ↔ EN.
 *
 * Cần một lối vào riêng vì `t()` **im lặng rơi về tiếng Việt** khi khoá EN vắng mặt.
 * Đó là hành vi đúng khi chạy thật — thiếu một chuỗi thì hiện tiếng Việt còn hơn hiện
 * mã khoá — nhưng nó cũng có nghĩa là một khoá EN quên viết sẽ **không báo gì cả**: màn
 * hình vẫn chạy, chỉ lẫn một câu tiếng Việt giữa tiếng Anh, và không ai thấy cho tới khi
 * người dùng tiếng Anh thấy. Nên chỗ báo động phải là test, và test cần đếm được khoá.
 */
export const tableOf = (lang) => DICT[lang] ?? {};

// ── Bảng chuỗi ────────────────────────────────────────────────────────────────
// `p(n, one, many)` — số nhiều tiếng Anh; tiếng Việt không dùng.
const p = (n, one, many) => (n === 1 ? one : many);

const DICT = {
  vi: {
    // ── Khung app / index.html ──
    'app.title': 'NOW — sở chỉ huy',
    'skip': 'Tới nội dung',
    'brand.sub': 'sở chỉ huy',
    'foot.switch': 'đổi màn',
    'foot.find': 'tìm',
    'foot.copy': 'chép việc',
    'foot.allkeys': 'tất cả phím tắt',
    'butler.label': 'Các việc đáng làm lúc này',
    // Xoay vòng ô một. `pos` là "2/3" — chỗ đang đứng, không phải số việc còn lại.
    'butler.slidePos': (o) => `${o.i}/${o.n}`,
    'butler.slidePrev': 'việc trước',
    'butler.slideNext': 'việc tiếp',
    'butler.slideAria': (o) => `Việc ${o.i} trên ${o.n}`,

    // ── Popover trên thanh menu (menubar.html) ──
    // Chỗ hẹp nhất của cả sản phẩm: 360pt và ba giây. Nhãn ở đây là nhãn NGẮN NHẤT còn
    // giữ đúng thuật ngữ — "phiên", "dự án", "Màn Token" đã có nghĩa cố định ở bảng đầu
    // file, không được rút thành từ khác chỉ vì hẹp.
    'mb.scan': (o) => `quét ${o.ago}`,
    'mb.tabWork': 'Việc',
    'mb.tabToken': 'Token',
    // Vắng mặt vì "đang yên" và vắng mặt vì "hỏng thu thập" phải khác nhau ở tab này —
    // đây là chỗ người ta mở ra để đối chiếu ba công cụ.
    'mb.noSource': (o) => `chưa đọc được sổ ${o.name}`,
    // Gọi tên công cụ, không chỉ "hạn mức": tab Việc chỉ trưng sổ Claude, mà tab Token
    // ngay cạnh thì có cả ba — một chữ "hạn mức" trơ giữa hai tab ấy là câu hỏi bỏ ngỏ.
    // Giữ tiếng Việt: bộ thuật ngữ ở đầu file chốt quota = hạn mức, và một nhãn nửa Anh
    // nửa Việt đứng cạnh "Việc"/"Token" thì đọc thành hai người viết.
    'mb.secQuota': 'hạn mức Claude',
    'mb.awake': (o) => `${o.n} phiên thức`,
    // Hai chuỗi này nay là TOOLTIP của chữ NOW, không phải nhãn nút — nhãn hiện ra là
    // "NOW", nên chỗ duy nhất còn gọi tên đích là đây. Phải mở bằng động từ.
    'mb.open': 'Mở dashboard',
    'mb.openUsage': 'Mở màn Token',
    'mb.noQuota': 'chưa đọc được hạn mức',
    'mb.offline': 'không nối được tới server',

    // ── Thanh trên ──
    'top.connecting': 'đang nối…',
    'top.filterLabel': 'Lọc trong màn đang xem',
    'top.filterPh': 'lọc trong màn đang xem',
    'top.live': 'trực tiếp',
    'top.lost': 'mất kết nối',
    'top.scanning': 'đang quét',
    'top.connect': 'nối',
    'top.pulseTitle': 'Bấm để quét lại (r)',
    'top.sub': (o) =>
      `cập nhật ${o.time} · ${o.projects} dự án · ${o.sessions} phiên` +
      `${o.needsUpdate ? ` · ${o.needsUpdate} board cần cập nhật` : ''} · quét ${o.buildMs}ms`,

    // Nền sáng / tối
    'theme.light': 'sáng',
    'theme.dark': 'tối',
    'theme.toLight': 'Chuyển nền sáng (t)',
    'theme.toDark': 'Chuyển nền tối (t)',

    // Icon thanh menu macOS. Tooltip phải nói ra CẢ HAI thì — bây giờ và những lần đăng
    // nhập sau — vì đó đúng là chỗ bản cũ để hở: "Thoát" chỉ tắt bây giờ, "Mở lúc đăng
    // nhập" chỉ đặt lần sau, và không nút nào làm cả hai.
    'menubar.label': 'thanh menu',
    'menubar.toOff': 'Icon NOW đang hiện trên thanh menu — bấm để tắt hẳn, cả những lần đăng nhập sau',
    'menubar.toOn': 'Icon NOW đang tắt — bấm để hiện lại ngay và ở mọi lần đăng nhập sau',
    'menubar.busy': 'đang đổi…',
    'menubar.err': (o) => `Không đổi được: ${o.msg}`,

    // Ngôn ngữ
    'lang.title': (o) => `Ngôn ngữ: Tiếng Việt — bấm để đổi sang ${o.next} (l)`,
    'skin.title': (o) => `Phong cách chart — bấm để đổi sang ${o.next} (s)`,
    'skin.reroll': 'Gieo lại — bốc bộ hình khác',
    'skin.plain': 'Chuẩn',
    'skin.curve': 'Mềm',
    'skin.block': 'Khối',
    'skin.random': 'Ngẫu nhiên',

    // Mất kết nối
    'off.pre': 'Mất kết nối tới server — đang xem ảnh chụp lúc',
    'off.post': ', không còn tự cập nhật.',
    'off.retry': 'Thử lại',

    // Lần nạp đầu — CHƯA TỪNG có dữ liệu, khác hẳn "mất kết nối" (còn số cũ trên màn).
    // Nói ra là đang quét, và quét cái gì, để mấy giây trống không đọc ra thành trang hỏng.
    'boot.scanning': 'Đang quét lần đầu',
    'boot.scanningHint': 'Đọc board, phiên Claude và transcript của mọi dự án. Thường 4–6 giây.',
    'boot.scanningSub': 'đang quét lần đầu…',
    'boot.wait': 'Đang chờ số từ server',
    'boot.waitHint': 'Server đã quét xong nhưng tab này chưa nhận được. Quá vài giây thì tải lại trang.',
    'boot.waitSub': 'đang chờ số từ server…',
    'boot.down': 'Chưa nối được tới server',
    'boot.downHint': 'Dashboard chưa chạy. Mở terminal và gõ ./bin/now-dash — trang tự hiện ra khi server lên.',
    'boot.downSub': 'chưa nối được tới server',

    // Ngăn kéo + phím tắt (index.html)
    'drawer.prev': 'Dự án trước (←)',
    'drawer.prevAria': 'Dự án trước',
    'drawer.next': 'Dự án sau (→)',
    'drawer.nextAria': 'Dự án sau',
    'drawer.close': 'Đóng (esc)',
    'drawer.closeAria': 'Đóng bảng chi tiết',
    'help.title': 'Phím tắt',
    'help.close': 'Đóng bảng phím tắt',
    'help.switch': 'đổi màn',
    'help.copy': 'chép việc quản gia đang đề xuất',
    'help.open': 'mở board dự án đầu danh sách',
    'help.find': 'tìm trong màn đang xem',
    'help.refresh': 'quét lại ngay',
    'help.theme': 'đổi nền sáng / tối',
    'help.lang': 'đổi ngôn ngữ',
    'help.skin': 'đổi phong cách chart',
    'help.step': 'lật dự án khi bảng chi tiết đang mở',
    'help.esc': 'đóng bảng · xoá ô tìm',
    'help.self': 'bảng này',

    // ── Điều hướng + tiêu đề màn ──
    'nav.overview': 'Dự án',
    'nav.sessions': 'Phiên',
    'nav.decisions': 'Quyết định',
    'nav.timeline': 'Đã xong',
    'nav.stats': 'Thống kê',
    'nav.usage': 'Token',
    'nav.health': 'Sức khoẻ',
    'title.overview': 'Dự án',
    'title.sessions': 'Phiên đang chạy',
    'title.decisions': 'Chờ bạn quyết',
    'title.timeline': 'Việc đã xong',
    'title.stats': 'Thống kê',
    'title.usage': 'Token và hạn mức ba công cụ',
    'title.health': 'Sức khoẻ board',
    'nav.pipAria': (o) => `${o.n} mục cần chú ý`,
    'viewname.decisions': 'quyết định',
    'viewname.health': 'sức khoẻ',
    'viewname.sessions': 'phiên',
    'viewname.timeline': 'việc đã xong',
    'viewname.usage': 'token',

    // ── NOW.md ──
    'md.loading': 'đang đọc…',
    'md.error': (o) => `Không đọc được NOW.md — ${o.msg}`,
    'common.retry': 'thử lại',
    'common.copyAria': (o) => `Chép “${o.text}”`,

    // ── Quản gia (butler) ──
    'butler.greet.late': 'Khuya rồi, sếp',
    'butler.greet.morning': 'Chào buổi sáng, sếp',
    'butler.greet.noon': 'Chào buổi trưa, sếp',
    'butler.greet.afternoon': 'Chào buổi chiều, sếp',
    'butler.greet.evening': 'Chào buổi tối, sếp',
    // Mấy câu dưới KHÔNG mang lời chào nữa. Ô một giờ trưng tối đa ba việc xoay vòng,
    // mà lời chào thì chào một lần lúc sếp tới chứ không phải một phần của câu "có 2
    // quyết định chờ sếp" — `butler.js` ghép nó vào đúng slide đầu.
    'butler.hot': (o) => {
      const treo = o.ageDays > 0 ? ` treo ${o.ageDays} ngày và` : '';
      return o.n === 1
        ? `Có 1 quyết định chờ sếp — ${o.id}${treo} đang khoá ${o.project}.`
        : `Có ${o.n} quyết định chờ sếp — gấp nhất là ${o.id}${treo} đang khoá ${o.project}.`;
    },
    'butler.sayAtProject': 'nói câu này với Claude ở dự án đó',
    'butler.stale': (o) =>
      o.n === 1
        ? `Board của ${o.names} đã cũ — đừng tin nó trước khi cập nhật.`
        : `${o.n} board đã cũ (${o.names}) — đừng tin chúng trước khi cập nhật.`,
    'butler.staleWhy': (o) => `Cập nhật ${o.ageDays} ngày trước, đã có ${o.drift} commit sau mốc.`,
    'butler.runAt': (o) => `chạy ở ${o.name}`,
    'butler.tmp': (o) => `Worktree ${o.wname} của ${o.name} đang nằm trong /tmp — khởi động lại máy là mất.`,
    'butler.tmpWhy': (o) => `Nhánh ${o.branch}${o.dirty ? `, còn ${o.dirty} file chưa commit` : ''}.`,
    'butler.moveSafe': 'chuyển ra chỗ an toàn',
    // `soon` nói "sắp phải quyết", `hot` nói "đang khoá" — hai câu phải khác nhau ngay ở
    // động từ, vì có ngày cả hai cùng đứng trong ô và hai câu cùng mở bằng một con số
    // đếm quyết định thì đọc ra thành mâu thuẫn.
    'butler.soon': (o) => {
      const age = o.ageDays > 0 ? ` chờ ${o.ageDays} ngày` : '';
      return o.n === 1
        ? `1 quyết định sắp phải quyết — ${o.id}${age} ở ${o.project}.`
        : `${o.n} quyết định sắp phải quyết — cũ nhất là ${o.id}${age} ở ${o.project}.`;
    },
    // Hai giọng cho cùng một mục chờ. Ngưỡng `nudge` (7 ngày) chọn giữa chúng chứ không
    // còn quyết định mục ấy có được lên trang hay không.
    'butler.nudge': (o) => `${o.who} đã giữ “${o.what}” ${o.ageDays} ngày — nhắc được rồi.`,
    'butler.waiting': (o) => `${o.who} đang giữ “${o.what}” ${o.ageDays} ngày rồi.`,
    'butler.nudgeWhy': (o) => `Ở dự án ${o.project}.`,
    'butler.waitCopy': 'chép nguyên văn',
    'butler.waitCopyHint': 'bản đầy đủ — câu trên đã bị cắt cho vừa dòng',
    'butler.lead': (o) => {
      const head = o.late
        ? `${o.awake ? `${o.awake} phiên vẫn mở, tôi vẫn trông.` : 'Không phiên nào còn chạy.'}`
        : 'Không có gì chặn sếp.';
      return `${head} Việc kế tiếp ở ${o.name}.`;
    },
    'butler.leadAction': 'làm tiếp đi',
    'butler.openClaudeAt': (o) => `mở Claude ở ${o.name}`,
    'butler.noboard': 'Chưa dự án nào có NOW board.',
    'butler.noboardWhy': 'Mở Claude ở một dự án rồi chạy /now update — tôi sẽ theo dõi từ đó.',
    'butler.runAnywhere': 'chạy ở dự án bất kỳ',
    'butler.seeAll': (o) => `xem tất cả ${o.name} →`,
    'butler.sayToClaude': 'nói câu này với Claude',
    // Nhãn hai ô. Ngắn tới mức gần như một cái tên, vì chúng đứng trên mọi câu và không
    // được đọc thành một câu nữa.
    'butler.slot.work': 'Việc đáng làm',
    'butler.slot.burn': 'Hạn mức token',

    // ── Ô hai: hạn mức ──
    //
    // Mọi câu ở đây mở bằng TÊN CỬA SỔ, không bằng lời chào: lời chào đã nằm ở ô một,
    // và chào hai lần trong một khối thì lần thứ hai đọc thành một khối khác lạc vào.
    //
    // Hai câu bỏ phí nói ra CẢ BA con số (đã tiêu, dự phóng, mốc reset) vì đó là ba thứ
    // quyết định còn kịp cứu hay không. Hai câu tin tốt thì cụt hơn hẳn — tin tốt kể dài
    // là cách nhanh nhất dạy người đọc bỏ qua cả ô này.
    // Chủ ngữ là kỳ hạn, do `burnSubject` dựng — xem `lib/butler.js`.
    'butler.burnOfModel': (o) => `${o.period} của ${o.model}`,
    'butler.burnCold': (o) => `${o.subject} sẽ bỏ phí ${o.waste} — mới tiêu ${o.used}, dự phóng ${o.projected}.`,
    'butler.burnSlack': (o) => `${o.subject} còn bỏ phí ${o.waste} — đã tiêu ${o.used}, dự phóng ${o.projected}.`,
    'butler.burnOnTarget': (o) => `${o.subject} đang đúng nhịp — đã tiêu ${o.used}, dự phóng ${o.projected}. Giữ nguyên.`,
    'butler.burnFull': (o) => `${o.subject} sẽ dùng hết mức — đã tiêu ${o.used}, dự phóng ${o.projected}.`,
    // Ở đây mốc cạn đứng trước, khác với câu rút trên thẻ: quản gia nói để sếp còn kịp
    // làm gì đó, mà "còn bao lâu nữa" mới là thứ quyết định làm được gì.
    'butler.burnIdle': (o) => `${o.subject} cạn sau ${o.in} — rồi ngồi không ${o.stuck} tới lúc reset, đã tiêu ${o.used}.`,
    'butler.burnBlind': (o) => `${o.subject} đã tiêu ${o.used} — chưa đủ để đọc nhịp.`,
    'butler.burnNone': 'Chưa đọc được hạn mức Claude.',
    'butler.burnNoneWhy': 'Mở màn Token để xem mắt xích nào đứt — hết phiên đăng nhập, hay endpoint không trả lời.',
    // Chỉ còn nhịp tiêu và mốc reset — hai thứ DUY NHẤT câu chính không có. Bản trước
    // nhắc lại nguyên mệnh đề dự phóng của câu chính, hai dòng liền nhau chép của nhau.
    'butler.quotaWhy': (o) => `Đang tiêu ${o.pace}, reset sau ${o.reset}.`,
    'butler.quotaSwap': 'model rẻ hơn tiêu chậm hơn — cửa sổ dài ra',
    'butler.burnSpendMore': 'model mạnh hơn tiêu nhiều hơn mỗi lượt — đỡ bỏ phí',
    'butler.burnNoLever': 'Đang ở model đắt nhất rồi, không còn nấc nào để lên — muốn tiêu hết thì phải giao thêm việc, hoặc mở thêm một phiên chạy song song.',
    // Cảnh báo Cursor/Antigravity: `line` là nguyên câu dự báo của `forecastText`
    // ("dự phóng tuần này X — bỏ phí Y" / "cạn sau X, rồi ngồi không Y"), nên khoá này
    // chỉ chêm tên nguồn và mức đã tiêu vào trước — không kể lại chuyện bằng từ khác.
    // "đã tiêu" chứ không "mới tiêu": câu này dùng cho CẢ hai kết cục, mà "mới" thì
    // nghiêng sẵn về phía bỏ phí — ca sắp chạm trần đọc thành ngược nghĩa. Nối bằng
    // PHẨY vì `line` đã mang sẵn một gạch dài — hai gạch trong một câu là hai lần ngắt.
    'butler.toolLine': (o) => `${o.name} đã tiêu ${o.used}, ${o.line}.`,

    // ── shared: độ nóng / sức khoẻ ──
    'heat.now': 'Quyết ngay',
    'heat.soon': 'Sắp chặn',
    'heat.later': 'Không gấp',
    'hstatus.fresh': 'tươi',
    'hstatus.drifting': 'đang lệch',
    'hstatus.stale': 'cần cập nhật',
    'hstatus.broken': 'hỏng file',
    'hstatus.unknown': 'không đo được',

    // ── game: trạng thái dự án / lớp phiên ──
    'pstate.blocked': 'Đang chặn',
    'pstate.stale': 'Cần cập nhật',
    'pstate.pending': 'Có việc chờ quyết',
    'pstate.ok': 'Ổn',
    'unit.editor': 'Editor',
    'unit.desktop': 'Desktop',
    'unit.other': 'khác',

    // ── Định dạng thời gian ──
    'fmt.justnow': 'vừa xong',
    'fmt.min': (o) => `${o.n} phút`,
    'fmt.hour': (o) => `${o.n} giờ`,
    'fmt.day': (o) => `${o.n} ngày`,
    'fmt.month': (o) => `${o.n} tháng`,
    'fmt.today': 'Hôm nay',
    'fmt.yesterday': 'Hôm qua',
    'fmt.daysAgo': (o) => `${o.n} ngày trước`,

    // ── Màn Dự án (overview) ──
    'overview.streakTitle': 'số ngày liên tiếp có ít nhất một việc xong',
    'overview.streakDays': 'ngày liên tiếp',
    'overview.done7': 'việc xong / 7 ngày',
    'overview.awakeSessions': 'phiên thức',
    'overview.hotBlocking': 'quyết định đang khoá việc',
    'overview.freshBoards': 'board còn tươi',
    'repo.nestedIn': (o) => `Gốc repo là ${o.nestedIn} — số git ở đây sẽ là của repo mẹ, nên không hiện`,
    'repo.nestedShort': 'nằm trong repo khác',
    'repo.notRepo': 'chưa phải repo git',
    'repo.unknownCommitTitle': 'Commit mốc của board không còn trong lịch sử',
    'repo.unknownCommit': 'mốc board mất',
    'repo.driftTitle': 'commit sau mốc board',
    'repo.dirtyTitle': (o) => `${o.n} file chưa commit`,
    'repo.aheadTitle': 'chưa push',
    'repo.behindTitle': 'chưa kéo về',
    'repo.worktreeTitle': 'worktree phụ',
    'quest.hot': 'Quyết định đang khoá việc',
    'quest.decisions': 'Quyết định khác chờ bạn',
    'quest.waiting': 'Chờ người khác',
    'quest.queue': 'Hàng đợi',
    'quest.inferred': 'suy ra',
    'quest.inferredTitle': 'Claude tự suy ra việc đang làm từ phiên gần nhất — board không tự khai',
    'quest.doing': 'Đang làm',
    'quest.noFocus': 'Board không có mục Đang làm',
    'quest.clean': 'sạch việc',
    'quest.partyTitle': 'phiên đang thức / tổng',
    'quest.hpTitle': (o) => `Độ tươi board — ${o.hp}% · ${o.label}`,
    'quest.copyResume': '⧉ chép câu làm tiếp',
    'quest.copyResumeAria': (o) => `Chép câu làm tiếp của ${o.name}: ${o.resume}`,
    'quest.noResumeTitle': 'Board chưa ghi cách làm tiếp',
    'quest.noResumeAria': (o) => `Board của ${o.name} chưa ghi cách làm tiếp — chép /now update`,
    'quest.openDir': '↗ mở thư mục',
    'quest.openDirAria': (o) => `Mở thư mục ${o.name}`,
    'quest.openBoard': 'xem board đầy đủ →',
    'quest.openBoardAria': (o) => `Xem board đầy đủ của ${o.name}`,
    'overview.noMatch': 'Không dự án nào khớp',
    'overview.noMatchHint': (o) => `Bỏ bộ lọc “${o.q}” để xem lại tất cả.`,
    'overview.noBoard': 'Chưa dự án nào có NOW board',
    'overview.noBoardHint': (o) => `Đã quét ${o.roots}. Mở Claude ở một dự án rồi chạy /now update — tôi sẽ theo dõi từ đó.`,
    'overview.orphans': (o) => `${o.n} repo còn hoạt động nhưng chưa có NOW board`,
    'overview.orphansPre': 'Mở Claude ở đó rồi chạy',
    'overview.orphansPost': '— không có board thì dự án đó vô hình ở mọi màn.',

    // Ngăn kéo overview
    'drawer.freshness': 'Độ tươi board',
    'drawer.updatedToday': 'cập nhật hôm nay',
    'drawer.updatedAgo': (o) => `cập nhật ${o.n} ngày trước`,
    'drawer.driftBadge': (o) => `Δ${o.n} commit sau mốc`,
    'drawer.openDir': 'Mở thư mục',
    'drawer.parseError': 'NOW.json không đọc được',
    'drawer.schemaError': 'Sai schema',
    'drawer.doing': '◎ Đang làm',
    'focus.none': 'Board không có mục Đang làm.',
    'focus.context': 'Bối cảnh',
    'focus.now': 'Làm ngay',
    'focus.later': 'Còn lại',
    'focus.blockedBy': 'Bị chặn bởi',
    'focus.repoState': 'Hiện trạng repo',
    'focus.continue': 'Làm tiếp với Claude',
    'focus.refs': 'Tham chiếu',
    'drawer.sideTracks': 'Ngoài lề · phiên khác đang cầm',
    'drawer.decisions': 'Chờ bạn quyết',
    'drawer.dHeat': 'Độ nóng',
    'drawer.dWhat': 'Quyết gì',
    'drawer.dClose': 'Chốt bằng',
    'drawer.locks': (o) => `khoá: ${o.blocks}`,
    'drawer.waiting': 'Chờ người khác',
    'drawer.since': (o) => `từ ${o.since}`,
    'drawer.queue': 'Hàng đợi',
    'drawer.worktrees': 'Worktree phụ',
    'wt.inTmp': 'Nằm trong /tmp — mất khi khởi động lại máy. ',
    'wt.dirty': (o) => `${o.n} file chưa commit. `,
    'wt.clean': 'Sạch.',
    'wt.detached': 'detached',
    'drawer.sessions': (o) => `Phiên gắn với dự án này · ${o.n}`,
    'drawer.asleep': (o) => `ngủ ${o.ago}`,
    'drawer.recentlyDone': 'Vừa xong',
    'drawer.mdFull': 'NOW.md — bản đầy đủ',
    'drawer.mdRead': 'Đọc NOW.md tại đây',
    'drawer.commands': 'Lệnh',
    'drawer.openClaudeHere': 'mở Claude ở đây',
    'drawer.updateBoard': 'cập nhật board',

    // ── Màn Phiên (sessions) ──
    'sessions.next': (o) => `tiếp: ${o.subject}`,
    'sessions.asleep': (o) => `ngủ ${o.ago}`,
    'sessions.awakeState': (o) => `● thức · ${o.ago}`,
    'sessions.opened': (o) => `mở ${o.time}`,
    'sessions.tasks': (o) => `${o.done}/${o.total} việc`,
    'sessions.statAwake': 'Đang thức',
    'sessions.statProjects': 'Dự án',
    'sessions.statHasTodos': 'Có việc giao',
    'sessions.statGhost': 'File phiên chết',
    'sessions.noMatch': 'Không phiên nào khớp',
    'sessions.empty': 'Không có phiên Claude nào đang sống',
    'sessions.unassigned': 'Ngoài các dự án có board',
    'sessions.awakeCount': (o) => `${o.awake} thức / ${o.total}`,
    'sessions.moreAsleep': (o) => `còn ${o.n} cái đang ngủ`,
    'sessions.foot': 'Panel trong Cursor/VS Code tìm phiên theo <b>tên</b>, còn terminal cần UUID đủ 36 ký tự — nút <b>resume</b> chép sẵn',
    'sessions.footEnd': 'cho sếp.',
    /** Prompt DÁN VÀO CLAUDE, không phải lệnh shell — nút archive nói rõ chỗ dán ở `sessions.footArchive`. */
    'sessions.archivePrompt': (o) => `Archive phiên Claude Code ${o.id}`,
    'sessions.footArchive':
      'Nút <b>archive</b> chép một câu để <b>dán vào Claude</b> (không phải terminal); Claude sẽ hỏi xác nhận rồi mới tắt. Phiên mở từ VS Code hoặc terminal không có nút này vì chúng không nằm trong sổ của app.',

    // ── Màn Quyết định (decisions) ──
    'decisions.blocksFocus': '◆ chặn việc đang làm',
    'decisions.pending': (o) => `⧗ treo ${o.n} ngày`,
    'decisions.noId': 'chưa có mã',
    'decisions.noMatch': 'Không có gì khớp',
    'decisions.empty': 'Không có quyết định nào chờ bạn',
    'decisions.emptyHint': 'Mọi thứ đang nằm ở tay người khác hoặc trong hàng đợi.',
    'decisions.section': (o) => `${o.icon} ${o.label} · ${o.n}`,
    'decisions.hUrg': 'Độ gấp',
    'decisions.hProject': 'Dự án',
    'decisions.hWhat': 'Quyết gì',
    'decisions.hLocks': 'Đang khoá',
    'decisions.hClose': 'Chốt bằng cách nói',
    'decisions.waiting': 'Chờ người khác · không phải việc của sếp',
    'decisions.wProject': 'Dự án',
    'decisions.wWho': 'Ai',
    'decisions.wWhat': 'Chờ gì',
    'decisions.wSince': 'Từ bao giờ',
    'decisions.nudge': (o) => `⚠ quá ${o.n} ngày — nhắc được rồi`,
    'decisions.footPre': 'Độ gấp = độ nóng + số ngày treo, cộng thêm nếu nó chặn đúng việc đang làm. Chốt bằng cách mở Claude ở dự án đó và nói',
    'decisions.footMid': '— mục sẽ biến khỏi board sau lượt',
    'decisions.footEnd': '.',

    // ── Màn Đã xong (timeline) ──
    'timeline.noMatch': 'Không việc nào khớp',
    'timeline.empty': 'Chưa có việc nào được ghi là vừa xong',
    'timeline.streak': 'Chuỗi ngày',
    'timeline.done7': 'Việc xong 7 ngày',
    'timeline.best': 'Ngày nhiều nhất',
    'timeline.total': 'Tổng ghi nhận',
    'timeline.tasks': (o) => `${o.n} việc`,
    'unit.daysShort': 'ngày',

    // ── Màn Sức khoẻ (health) ──
    'health.parseError': (o) => `${o.name} — NOW.json không đọc được`,
    'health.schemaError': (o) => `${o.name} — sai schema`,
    'health.nested': (o) => `${o.name} — board nằm bên trong một repo khác`,
    'health.nestedDesc': (o) =>
      `Gốc repo là ${o.nestedIn}, không phải thư mục board. Mọi số git (nhánh, file bẩn, độ lệch) sẽ là của repo mẹ chứ không phải của dự án này, nên tôi bỏ trống chúng thay vì hiện số sai.`,
    'health.splitRepo': 'tách repo riêng',
    'health.unknownCommit': (o) => `${o.name} — mốc board không còn trong lịch sử git`,
    'health.unknownCommitDesc': (o) =>
      `Board ghi commit ${o.commit} nhưng commit đó không còn (rebase/amend). Không đo được độ lệch, nên board có thể đang cũ mà vẫn trông tươi.`,
    'health.stale': (o) => `${o.name} — board cần cập nhật`,
    'health.staleDesc': (o) =>
      `Cập nhật ${o.ageDays} ngày trước, đã có ${o.drift} commit sau mốc. Đọc board này lúc quay lại sẽ dễ đi nhầm hướng.`,
    'health.drifting': (o) => `${o.name} — board bắt đầu lệch`,
    'health.driftingDesc': (o) =>
      `${o.ageDays} ngày · ${o.drift} commit sau mốc. Chưa gấp, nhưng nên cập nhật trước khi rời dự án.`,
    'health.noMd': (o) => `${o.name} — chưa có NOW.md`,
    'health.noMdDesc': 'Có NOW.json nhưng thiếu bản render để đọc bằng mắt.',
    'health.wtInTmp': 'nằm trong /tmp nên sẽ mất khi khởi động lại máy',
    'health.wtDirty': (o) => `còn ${o.n} file chưa commit`,
    'health.wtPrunable': 'thư mục không còn tồn tại',
    'health.wt': (o) => `${o.name} — worktree ${o.wname}`,
    'health.wtDesc': (o) => `Nhánh ${o.branch}, ${o.why}.`,
    'health.wtMove': 'worktree move',
    'health.wtPrune': 'prune',
    'health.statChores': 'Cần dọn',
    'health.statFresh': 'Board tươi',
    'health.statOrphans': 'Chưa có board',
    'health.statScan': 'Quét',
    'health.clean': 'Không có gì cần dọn',
    'health.cleanHint': 'Board tươi, worktree sạch, không repo nào bị bỏ quên.',
    'health.orphans': (o) => `${o.n} repo còn hoạt động, chưa có NOW board`,
    'health.orphanTitle': (o) => `Commit cuối trên nhánh ${o.branch} — chép lệnh mở Claude ở đây`,
    'health.orphanAria': (o) => `Chép lệnh mở Claude ở ${o.name} — commit cuối ${o.ago} trước, nhánh ${o.branch}`,
    'health.orphansPre': 'Không có board thì các dự án này vô hình ở mọi màn khác. Bấm để chép lệnh mở Claude, rồi chạy',
    'health.boardTable': 'Bảng board',
    'health.tProject': 'Dự án',
    'health.tFresh': 'Độ tươi',
    'health.tBranch': 'Nhánh',
    'health.tAge': 'Tuổi',
    'health.tDrift': 'Lệch',
    'health.tDirty': 'Bẩn',
    'health.tSessions': 'Phiên',
    'health.today': 'hôm nay',
    'health.ageShort': (o) => `${o.n}n`,
    'health.thresholds': 'Ngưỡng đang dùng',
    'health.thState': 'Trạng thái',
    'health.thCond': 'Điều kiện',
    'health.thMean': 'Nghĩa là',
    'health.thFreshCond': (o) => `< ${o.days} ngày và < ${o.commits} commit`,
    'health.thFreshMean': 'Đọc board là quay lại việc được ngay.',
    'health.thDriftCond': (o) => `≥ ${o.days} ngày hoặc ≥ ${o.commits} commit`,
    'health.thDriftMean': 'Còn dùng được, nhưng đã thiếu vài diễn biến mới.',
    'health.thStaleCond': (o) => `≥ ${o.days} ngày hoặc ≥ ${o.commits} commit`,
    'health.thStaleMean': 'Đừng tin — chạy /now update trước khi đọc.',
    'health.footPre': 'Tôi chỉ <b>đọc</b> — không bao giờ tự ghi vào NOW.json. Nguồn sự thật vẫn là',
    'health.footEnd': 'chạy trong chính dự án đó.',
    // Mục tích hợp NOW bằng prompt chat — cho bề mặt KHÔNG có skill /now (Cursor,
    // Antigravity). Prompt phải tự đứng được: người nhận nó là một agent chưa từng
    // nghe về dashboard này.
    'health.integrate': 'Tích hợp NOW vào dự án',
    'health.integrateDesc':
      'Dán prompt này vào chat của agent đang làm việc trong repo (Cursor, Antigravity, hay bất kỳ agent nào) — agent sẽ tạo NOW.json + NOW.md đúng schema và dashboard tự thấy board ở lượt quét sau. Trong Claude Code thì không cần: nói /now update là đủ.',
    'health.integrateCopy': 'chép prompt tích hợp',
    'health.integrateCopyAria': 'Chép prompt tích hợp NOW board để dán vào chat của agent',
    'health.integrateShow': 'xem nội dung prompt',
    'health.nowPrompt': `Tích hợp NOW board vào repo này để dashboard NOW theo dõi được:

1. Đọc schema (JSON Schema draft-07, schemaVersion: 1). Tìm nó bằng lệnh: ls ~/.claude/plugins/cache/*/now-board/*/skills/now/now.schema.json ~/.claude/skills/now/now.schema.json — có nhiều kết quả thì lấy bản phiên bản cao nhất. Không thấy file nào thì dừng lại hỏi tôi, đừng tự chế schema.
2. Tạo NOW.json ở gốc repo đúng schema. Nội dung suy từ git log, git status và tài liệu trong repo: focus (title, context, nextAction dưới 30 phút, laterSteps, resume.workingState, resume.howToContinue, confidence), decisionsNeeded (id, title, heat: now/soon/later, question, blocks, since), waitingOn, upNext, recentlyDone. Mục nào phải đoán thì đánh confidence "inferred"; không rõ thì hỏi tôi, đừng bịa.
3. Render NOW.md từ NOW.json — bản cho người đọc, cùng nội dung, cập nhật cùng lượt.
4. Thêm NOW.json và NOW.md vào .gitignore — trạng thái local mỗi máy, không bao giờ commit.
5. Từ nay, khi kết thúc một mạch việc hoặc khi tôi nói "/now update": cập nhật NOW.json rồi render lại NOW.md.`,

    // ── Màn Thống kê (stats) ──
    'stats.empty': 'Chưa có dữ liệu để thống kê',
    'stats.emptyHint': 'Chạy /now update ở một dự án — mọi con số ở đây đều lấy từ NOW board.',
    'stats.qNote': (o) =>
      `Ô tìm “${o.q}” không áp dụng ở màn Thống kê — lọc một phần thì mọi tỉ lệ ở đây đổi nghĩa. Tìm ở màn Dự án, Phiên hoặc Quyết định.`,
    'stats.kStreak': 'Chuỗi ngày',
    'stats.kRecorded': 'Việc còn ghi',
    'stats.kDecisions': 'Quyết định chờ',
    'stats.kHot': (o) => `·${o.n} nóng`,
    'stats.kQueue': 'Hàng đợi',
    'stats.kAwake': 'Phiên thức',
    'stats.doneSection': 'Việc đã xong · phần board còn nhớ',
    'stats.doneByDay': 'Việc xong theo ngày',
    'stats.doneByDaySubPartial': (o) => `${o.days} ngày · ${o.partial} ngày bị đếm thiếu (cột mờ) vì board đã quên bớt`,
    'stats.doneByDaySubFull': (o) => `${o.days} ngày · đủ ${o.total} board`,
    'stats.doneByDayCut': (o) =>
      ` · bỏ ${o.dropped} ngày ngoài cửa sổ ${o.max} ngày (${o.items} việc) — ngày quá xa thường là gõ sai năm trong NOW.json`,
    'stats.doneByProject': 'Việc xong theo dự án',
    'stats.doneByProjectSub': 'đếm trên phần board còn lưu, không phải toàn bộ lịch sử',
    'stats.decisionsChart': 'Quyết định chờ bạn, theo dự án',
    'stats.decisionsChartSub': 'ảnh chụp hiện tại — đếm đủ, không phụ thuộc trần lưu của board',
    'stats.queueChart': 'Hàng đợi theo dự án',
    'stats.queueChartSub': (o) => `${o.n} mục đang xếp hàng — ảnh chụp hiện tại`,
    'stats.hoursChart': 'Giờ mở phiên',
    'stats.hoursChartSub': (o) =>
      `${o.n} phiên đang sống — file phiên đã chết được dọn nên đây là hiện trạng, không phải lịch sử`,
    'stats.backlogSection': 'Đang tồn đọng · ảnh chụp hiện tại',
    'stats.rhythmSection': 'Nhịp phiên',
    'stats.tipDoneDay': (o) =>
      tipOf({
        head: o.iso,
        rows: [
          ['Việc còn ghi', o.v],
          ['Board phủ tới đây', `${o.covered}/${o.total}`],
        ],
        note: o.partial ? 'Chỉ chừng ấy board lưu lùi tới ngày này, nên số thật cao hơn.' : '',
      }),
    'stats.tipDoneProject': (o) => tipOf({ head: o.label, rows: [['Việc còn ghi', o.v]] }),
    'stats.tipDecision': (o) => tipOf({ head: o.label, rows: [[o.heat, o.v]] }),
    'stats.tipQueue': (o) => tipOf({ head: o.label, rows: [['Trong hàng đợi', o.v]] }),
    'stats.tipHour': (o) => tipOf({ head: `${o.h}:00–${o.h}:59`, rows: [['Phiên', o.v]] }),
    'stats.total': 'Tổng',
    'stats.cDate': 'Ngày',
    'stats.cRecorded': 'Việc còn ghi',
    'stats.cCovered': 'Board phủ',
    'stats.cProject': 'Dự án',
    'stats.cPending': 'Mục chờ',
    'stats.cHour': 'Giờ',
    'stats.cSessions': 'Phiên',
    'stats.note': (o) =>
      `<b>Đọc con số này cho đúng:</b> NOW board chỉ giữ vài mục <code>recentlyDone</code> gần nhất mỗi dự án. Dự án nào chạm trần thì việc cũ hơn biến mất khỏi board — nên ngày càng lùi về trước càng trông “ít việc”, và đó là trần lưu chứ không phải nhịp làm việc. Cột mờ là ngày đang bị đếm thiếu. Đây là <b>sàn</b> của khối lượng đã làm, không phải tổng.`,

    // ── Bề mặt làm việc (Claude Desktop · Cursor · Antigravity · Terminal) ──
    'surface.someEditor': 'Editor chưa rõ',
    'surface.cli': 'Dòng lệnh',
    'surface.other': 'Khác',
    'surface.running': 'đang chạy',
    'surface.sessions': (o) => `${o.n} phiên`,
    'surface.convos': (o) => `${o.n} hội thoại`,
    'surface.folders': (o) => `${o.n} thư mục đang mở`,
    'surface.foldersActive': (o) => `${o.n} thư mục đang có việc chạy`,
    'surface.idle': 'đang mở, chưa có gì chạy',
    'surface.off': 'không chạy',
    'surface.note':
      'Antigravity không chạy Claude Code — nó có agent riêng, nên hội thoại của nó không nằm trong số token ở màn Token. Cursor và VS Code thì có: phiên Claude Code chạy trong chúng vẫn tính vào hạn mức của bạn.',
    'convo.untitled': 'Hội thoại chưa đặt tên',
    'convo.steps': (o) => `${o.n} bước`,
    'convo.openIn': 'mở trong Antigravity',
    'quest.openInTitle': (o) => `Mở thư mục này trong ${o.name}`,
    'quest.openInAria': (o) => `Mở ${o.project} trong ${o.name}`,
    'sessions.statConvos': 'Antigravity',
    'quest.surfaceTitle': (o) => `Đang mở trong ${o.names}`,
    'quest.convoTitle': (o) => `${o.n} hội thoại Antigravity ở thư mục này`,

    // ── Hạn mức gói thuê bao ──
    // Mang tên "Claude" từ lượt gộp màn Công cụ: giờ có ba khối hạn mức đứng cạnh nhau,
    // nên một khối đề trống "Hạn mức đã tiêu" đọc thành hạn mức của cả ba.
    'quota.title': 'Claude · hạn mức đã tiêu',
    // Phần đuôi dùng chung cho cả ba khối; tên nguồn do `srcLabel` chêm vào và in đậm.
    // `quota.title` ở trên chỉ còn sống cho `aria-label` của dải quản gia, chỗ không
    // nhận HTML nên phải là một chuỗi phẳng.
    'quota.titleTail': 'hạn mức đã tiêu',

    // ── Bậc gói ──
    // Nhãn cạnh tên nguồn. Nó là MẪU SỐ của mọi phần trăm trong khối: "58%" một mình
    // không so được qua thời gian, vì 58% của Max 20x và 58% của Pro lệch nhau cả bậc
    // token. Tooltip mỗi nguồn nói ĐÚNG MỘT việc — số này đọc được ở đâu — vì ba nguồn
    // tin được ở ba mức khác nhau và người đọc phải biết mức nào trước khi tin.
    'plan.perMonth': (o) => `${o.money}/tháng`,
    'plan.tip.claude': (o) =>
      `Đọc từ ~/.claude.json, do Claude Code tự làm mới — lần cuối ${o.when} trước. Mọi phần trăm ở khối này là phần trăm CỦA bậc gói này.`,
    'plan.tip.cursor': (o) =>
      `Cursor không gửi tên gói ở bất kỳ trường nào. Dashboard tra ngược từ ${o.money}/tháng đã bao gồm trong gói — Cursor đổi bảng giá là chỗ này sai mà không có gì báo.`,
    'plan.tip.ag': (o) => `Antigravity tự khai bậc gói này${o.raw ? ` (${o.raw})` : ''}.`,

    'quota.fiveHour': 'Khung 5 giờ',
    'quota.sevenDay': 'Khung 7 ngày',
    'quota.scoped': (o) => `7 ngày · ${o.model}`,
    'quota.at': (o) => `đọc lúc ${o.time} · ${o.age} trước`,
    'quota.atFresh': (o) => `đọc lúc ${o.time} · vừa xong`,
    'quota.resetIn': (o) => `reset sau ${o.d}`,
    'quota.resetPassed': 'đã sang chu kỳ mới',
    'quota.conservative': 'Đây là ảnh chụp gần nhất, chưa làm tươi lại được. Lúc bạn không dùng Claude thì quota không tăng mà cửa sổ vẫn trôi, nên phần trăm thật chỉ có thấp hơn — không bao giờ cao hơn.',
    'quota.allExpired': 'Mọi cửa sổ đã qua mốc reset, nên số trên là của chu kỳ cũ.',
    'quota.missing': 'Chưa có dữ liệu hạn mức. Số này không nằm trên đĩa — dashboard đọc nó bằng OAuth token trong Keychain, nên cần đăng nhập Claude Code ít nhất một lần.',
    'quota.warming': 'Gọi được endpoint nhưng chưa cửa sổ nào có số.',
    'quota.broken': 'Phản hồi hạn mức đọc không ra — endpoint nội bộ này không có tài liệu, hình dạng có thể đã đổi.',
    'quota.noAuth': 'Không đọc được OAuth token từ Keychain — thường là do macOS bị từ chối quyền, hoặc bạn đã đăng xuất Claude Code.',
    'quota.tokenExpired': 'OAuth token đã hết hạn. Chạy Claude Code một lượt là nó tự làm mới rồi ghi lại vào Keychain.',
    'quota.httpFail': 'Endpoint hạn mức trả về lỗi.',
    'quota.offline': 'Không gọi được endpoint hạn mức — mạng hỏng hoặc quá hạn chờ.',
    'quota.stripTitle': 'Hạn mức đã tiêu',
    'quota.usedUnit': 'đã tiêu',
    'quota.fiveHourShort': '5 giờ',
    'quota.sevenDayShort': '7 ngày',
    'quota.forecastHelp': 'Cách đọc thanh',

    // ── Chú thích cách đọc thanh ──
    // Mỗi dòng ĐI KÈM một ô mẫu cắt ra từ chính cái thanh, nên chữ không phải tự gọi tên
    // hình nữa: bản trước viết "mảng gạch chéo" rồi bắt người đọc đi tìm nó trên thanh,
    // và bốn phép ghép ấy là toàn bộ chỗ khó của việc đọc chú thích.
    // Mỗi dòng MỘT câu, và câu ngắn nhất nói đủ. Bản trước dài gấp ba: nó giải thích cả
    // lý do thiết kế ("lúc đó không còn mức nào để ghi, chỉ còn mốc đụng trần") ngay giữa
    // chú thích, mà chú thích thì người ta đọc lúc đang bí — không phải lúc muốn nghe
    // luận. Phần lý do đã nằm trong chú thích code (`lib/quota.js`), đúng chỗ của nó.
    'qlg.goal': '<b>Đích là tiêu hết.</b> Hạn mức không cộng dồn — phần chưa dùng lúc reset là mất trắng.',
    'qlg.sample': 'Thanh mẫu',
    // Tên của mảng gạch chéo. Không có nhãn cột nào tái dùng được ở đây: `quota.cProjected`
    // ("Dự phóng") là MÉP PHẢI của mảng, không phải cả mảng.
    'qlg.hatchName': 'Nhịp này tiêu thêm',
    'qlg.solid': 'Đã dùng thật. Con số đã đo.',
    'qlg.hatch': 'Phần duy nhất dashboard đoán — nên có vân. Nhãn trong mảng là chỗ nhịp dừng, hoặc <b>cạn sau …</b> nếu nhịp đòi quá trần.',
    'qlg.waste': 'Nhịp này không kịp dùng. Mất lúc reset.',
    'qlg.mark': 'Chỗ phải đứng nếu tiêu đều theo đồng hồ.',
    // Bốn màu này là bốn BĂNG của một thang duy nhất (bỏ phí), nên nhãn của chúng phải
    // đọc được thành một dãy có chiều. Nhãn cũ trộn hai đại lượng — "cạn sớm rồi ngồi
    // không lâu" nói về thời gian, ba nhãn kia nói về tiền — nên dãy không có chiều nào.
    'qlg.toneTitle': 'Màu nói mức BỎ PHÍ, không nói độ đầy:',
    'qlg.toneCrit': 'bỏ phí quá nửa',
    'qlg.toneWarn': 'còn bỏ phí',
    'qlg.toneOk': 'đúng đích',
    'qlg.toneCheer': 'dùng hết mức',
    'qlg.caveat':
      'Dự phóng là ngoại suy từ nhịp tính tới giờ — “nếu cứ như lúc này”, không phải lời tiên tri. <b>Đỏ</b> chỉ có một nghĩa: quá nửa hạn mức sẽ mất trắng lúc reset. Cạn trước reset không bao giờ đỏ — đó là mục tiêu.',
    // Đứng ở chú thích gập lại, không ở thẻ: đây là ba câu học một lần rồi thôi, mà thẻ thì
    // đọc lại mỗi lượt. Câu thứ hai là chỗ dễ mất niềm tin nhất — phần trăm và số $ đếm trên
    // hai phạm vi khác nhau, nên chúng LỆCH được mà không có bên nào sai.
    'qlg.money':
      '<b>≈$248</b> cạnh phần trăm là tiền tính riêng cho <b>cửa sổ này</b>: token trong cửa sổ nhân bảng giá API. Không phải hoá đơn — tài khoản trả theo gói, nên đọc nó như câu “gói này đang khai thác được bao nhiêu”. Phần trăm do server đếm cho <b>cả tài khoản</b>, còn số $ đọc từ transcript của <b>máy này</b>, nên chạy Claude Code ở máy khác thì phần trăm vẫn tính đúng, còn số $ thì không. Dấu <b>≥</b> thay cho <b>≈</b> nghĩa là cửa sổ mở trước lượt gọi sớm nhất còn trên đĩa — transcript đã bị dọn, tổng chắc chắn thiếu.',

    // ── Dự báo hạn mức ──
    'qf.perHour': (o) => `${o.v}/giờ`,
    'qf.perDay': (o) => `${o.v}/ngày`,
    'qf.now': 'ngay bây giờ',
    // Băng `over`: mốc cạn ĐƯỢC đứng trước. Bản trước đẩy mệnh đề "ngồi không" lên đầu
    // vì cả dòng đang màu đỏ và chữ phải khớp với màu. Giờ dòng mang sắc `cheer` — cạn
    // trước reset là đích — nên phần đúng đích mở câu, còn cái giá (ngồi không bao lâu)
    // đi sau như một mệnh đề nhượng bộ, đúng thứ nó là.
    'qf.over': (o) => `dùng hết mức — cạn sau ${o.in}`,
    'qf.overIdle': (o) => `cạn sau ${o.in}, rồi ngồi không ${o.stuck} tới lúc reset`,
    // Bản rút cho THẺ: ở đó mốc cạn đã nằm trên thanh rồi (`qf.hitsIn`), nên câu chỉ còn
    // giữ phần thanh không vẽ được. Chỗ vẽ thanh không nhãn vẫn dùng bản đầy đủ ở trên.
    'qf.idleTail': (o) => `ngồi không ${o.stuck} trước lúc reset`,
    'qf.outNow': (o) => `đã cạn — còn ${o.stuck} nữa mới tới reset`,
    // Nhãn mảng gạch khi nhịp này đụng trần: mép phải của mảng là CÁI TƯỜNG, nên nó ghi
    // bao giờ tới tường, không ghi một con số vượt trần mà thanh không vẽ nổi.
    'qf.hitsIn': (o) => `cạn sau ${o.in}`,
    'qf.overCap': (o) => `${o.p} (quá trần)`,
    'qf.landsFull': 'dùng trọn, cạn sát lúc reset',
    // Câu dự phóng mở bằng KỲ HẠN, không bằng "nhịp này". "Nhịp này chỉ tới 52%" thiếu
    // đúng cái làm con số dùng được — 52% *lúc nào*. Nhãn bên cạnh ghi "5 giờ" là tên
    // của cửa sổ, không phải một mốc, nên phép ghép vẫn nằm ngoài câu. Tên kỳ hạn do
    // `periodText` suy từ `windowMs` — xem `lib/quota.js`.
    'qf.landsNear': (o) => `dự phóng ${o.period} ${o.p} — coi như dùng trọn`,
    'qf.slack': (o) => `dự phóng ${o.period} ${o.p} — bỏ phí ${o.w}`,
    // Bản rút cho mấy dòng văn xuôi không có thanh đi kèm (`proseText`): bỏ con số dự
    // phóng, giữ phần bỏ phí. Cạnh một cái thanh thì hai vế ấy trỏ hai chỗ khác nhau
    // trên thanh; đứng lẻ trong câu thì chúng là một sự thật nói hai lần.
    // "dự phóng {kỳ hạn}" giữ nguyên cụm đã dùng ở `qf.slack` — cùng một phép ngoại suy
    // thì phải cùng một chữ, chỉ đổi cái được ngoại suy.
    'qf.slackShort': (o) => `dự phóng ${o.period} bỏ phí ${o.w}`,
    'qf.pdShort': (o) => `phiên ${o.h}h này`,
    'qf.pdWeek': 'tuần này',
    'qf.pdMonth': 'tháng này',
    'qf.pdWindow': 'cửa sổ này',
    // Cụt vì luôn đứng ngay sau "mốc đều 47%" — nhắc lại chủ ngữ là đọc hai lần.
    'qf.onPace': 'đúng mức',
    'qf.behind': (o) => `chậm ${o.gap}`,
    'qf.ahead': (o) => `vượt ${o.gap}`,
    // Vạch này là chỗ bạn sẽ đứng NẾU tiêu đều theo đồng hồ — không phải trung bình của
    // cái gì cả. Bản trước ghi "trung bình" ở tiếng Việt nhưng "expected" ở tiếng Anh:
    // hai thứ tiếng nói hai chuyện khác nhau về cùng một cái vạch. Giờ cả hai cùng gọi
    // đúng tên nó — nhịp đều.
    'qf.avgMark': (o) => `mốc đều ${o.p}`,
    'qf.early': 'cửa sổ vừa mở, chưa đủ để đọc nhịp',
    'qf.rolled': 'cửa sổ đã sang chu kỳ mới',
    'qf.unknown': 'không có mốc reset nên không đoán được',
    // Nhãn của đuôi thanh. Hai bản: bản đủ chữ cho mảng rộng, bản trơ số cho mảng hẹp —
    // `@container` chọn hộ. Phải là hai chuỗi rời chứ không phải "cắt chữ đi", vì trật tự
    // từ hai thứ tiếng ngược nhau ("bỏ phí 49%" / "49% wasted").
    'qf.wasteSeg': (o) => `bỏ phí ${o.w}`,
    // Nhãn cột của tooltip. Dùng lại nhãn của bảng số ở chỗ nào có sẵn (`quota.cUsed`,
    // `quota.cPace`…) — hai chỗ cùng nói về một con số thì phải cùng một cái tên.
    'qf.rowAvg': 'Mốc đều',
    'qf.rowIdle': 'Ngồi không',
    'quota.cUsed': 'Đã tiêu',
    'quota.cWaste': 'Bỏ phí',
    'quota.cPace': 'Nhịp',
    // "Lúc reset" là nhãn sai ngay khi dự phóng vượt 100: lúc reset không thể có 104%.
    // Nhãn phải nói đây là NHỊP NÀY ĐÒI bao nhiêu, không phải mức sẽ đứng.
    'quota.cProjected': 'Dự phóng',
    // Hai hàng chỉ khối Claude có: tiền và token đã tiêu KỂ TỪ mốc mở cửa sổ này. Nhãn nói
    // rõ "ước tính" vì con số là bảng giá API × token đọc từ transcript, còn tài khoản thì
    // trả theo gói — đọc nó như hoá đơn là sai. Dấu ≈ trên màn nhắc lại đúng điều đó.
    'quota.cSpent': 'Tiền ước tính',
    'quota.cSpentOut': 'Token viết ra',
    'quota.cReset': 'Reset lúc',

    // ── Màn Token ──
    //
    // LUẬT CHỮ NGHĨA CỦA CẢ MÀN NÀY, đặt ra sau khi người dùng đọc phụ đề rồi hỏi thẳng
    // "phần việc làm ra là gì???" và "có đáng không là cái gì đáng không?":
    //
    // 1. Không có danh từ trừu tượng nào mà người đọc phải tự đoán ra vật thật đứng sau.
    //    "phần việc làm ra", "dòng chảy", "ngữ cảnh" đều là tên của một PHÉP TÍNH trong
    //    đầu người viết code, không phải tên của thứ người dùng nhìn thấy. Gọi đúng vật:
    //    token Claude VIẾT RA, phần Claude ĐỌC LẠI.
    // 2. Phụ đề nói NHÌN VÀO ĐÂY ĐỂ BIẾT GÌ, không nói chart được tính thế nào. "chi phí
    //    chia cho phần việc làm ra" là công thức; "cùng một lượng việc, ngày nào tốn hơn"
    //    mới là thứ người ta tới xem.
    // 3. Tiêu đề mục phải có ĐỦ CHỦ NGỮ. "Có đáng không" thiếu mất chữ quan trọng nhất —
    //    đáng cái gì — nên nó không nói được gì cho tới khi người đọc đã hiểu cả mục.
    // 4. Chữ nào không tự giải thích được trong một dòng thì vào bảng thuật ngữ ở khối
    //    "cách đọc màn này", chứ không giải thích rải rác giữa các chart.
    'usage.kToday': 'Claude viết hôm nay',
    'usage.k7d': 'Claude viết 7 ngày qua',
    'usage.kCacheHit': 'Lấy được từ bộ đệm',
    'usage.kCost7d': 'Ước tính 7 ngày',
    'usage.kRequests': 'Lượt gọi hôm nay',
    'usage.outShort': ' tok',

    // "Dòng chảy" là ẩn dụ, "có đáng không" thiếu chủ ngữ, "ai gọi ra" thì cái gọi ra lại
    // toàn là MCP với skill chứ không phải "ai". Mỗi tiêu đề giờ là một câu hỏi trả lời
    // được bằng đúng mấy chart nằm dưới nó.
    // Tên tab = tên CÔNG CỤ, không phải tên chủ đề. Chúng là ba nguồn dữ liệu rời nhau đo
    // bằng ba đơn vị không quy đổi được, và cái tên phải nói ra điều đó ngay.
    'usage.tabClaude': 'Claude Code',
    'usage.tabCursor': 'Cursor',
    'usage.tabAg': 'Antigravity',
    // Dòng độ tươi dưới khối số của từng tab — hai khoá vì dưới 45 giây `ago()` trả
    // "vừa xong", một mệnh đề trọn vẹn không ghép được với "trước". Xem `dataAt` ở shared.
    'usage.dataAt': (o) => `Dữ liệu cập nhật lúc ${o.time} · ${o.age} trước.`,
    'usage.dataAtFresh': (o) => `Dữ liệu cập nhật lúc ${o.time} · vừa xong.`,
    'usage.tabsAria': 'Chọn công cụ để xem chi tiết',
    'usage.flowSection': 'Mỗi ngày tiêu bao nhiêu',
    'usage.effSection': 'Đắt hơn, hay chỉ là làm nhiều hơn',
    'usage.cycleSection': 'Hạn mức các kỳ đã qua',
    'usage.splitSection': 'Tiêu vào đâu',
    'usage.blameSection': 'Cái gì ngốn token',

    'usage.costByDay': 'Chi phí ước tính theo ngày',
    'usage.costByDaySub': (o) => `Tiền ước tính mỗi ngày, ${o.days} ngày gần nhất — tổng ${o.total}. Đã tính đúng giá riêng của cả bốn loại token.`,
    'usage.tipCostDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Ước tính', o.cost],
          ['Lượt gọi', o.msgs],
        ],
      }),
    'usage.outByDay': 'Claude viết ra bao nhiêu mỗi ngày',
    'usage.outByDaySub': (o) => `Tổng ${o.total}. Đây là chữ Claude thật sự viết ra cho bạn — không tính phần nó phải đọc lại.`,
    'usage.tipOutDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Claude viết ra', o.out],
          ['Tổng token luân chuyển', o.total],
        ],
      }),

    // ── Đắt hơn, hay chỉ là làm nhiều hơn ──
    // Mọi con số ở mục này là TỈ SỐ, nên nhãn phải mang theo mẫu số. "Giá đơn vị" trơ một
    // mình đọc thành giá của cái gì cũng được; "mỗi 1M token Claude viết ra" thì không.
    'usage.unitByDay': 'Giá cho mỗi 1M token Claude viết ra',
    // Trị trung vị KHÔNG có ở đây: `refLine` đã in nó ngay trên vạch, và vạch nói thêm
    // được thứ phụ đề không nói nổi — nó nằm ở đâu so với từng cột.
    'usage.unitByDaySub': 'Cùng một lượng token Claude viết ra thì ngày nào tốn hơn. Cột vượt mức giữa = hôm đó đắt hơn mức thường của bạn.',
    // Ngày bị bỏ phải ĐẾM RA, không lặng lẽ: trục X hụt một ngày mà không nói vì sao thì
    // người đọc tưởng hôm đó không dùng Claude. Và phải nói ra VÌ SAO bỏ — "ngày quá mỏng
    // để chia" là tiếng lóng của người viết code, người đọc không có cách nào đoán ra.
    'usage.unitByDaySubThin': (o) =>
      `Cùng một lượng token Claude viết ra thì ngày nào tốn hơn. Cột vượt mức giữa = hôm đó đắt hơn mức thường của bạn. Đã bỏ ${o.thin} ngày dùng quá ít (dưới 10 lượt gọi hoặc ${o.min} token viết ra) — chia trên vài lượt lẻ thì tỉ số chỉ là nhiễu.`,
    'usage.refMedian': 'mức giữa',
    'usage.tipUnitDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Giá mỗi 1M viết ra', o.unit],
          ['Ước tính', o.cost],
          ['Claude viết ra', o.out],
        ],
      }),

    // Tiêu đề nói thẳng PHÁT HIỆN, không nói tên phép đo. Đây là chart khó nhất màn và
    // cũng là chart dẫn tới hành động rõ nhất, nên nó được phép chiếm một câu khẳng định.
    'usage.ctxByTurn': 'Chat càng dài, mỗi lượt càng phải đọc lại nhiều',
    'usage.ctxByTurnSub': (o) =>
      `Mỗi lượt hỏi, Claude đọc lại cả phiên từ đầu — cột là lượng phải đọc lại ở lượt thứ mấy. Cuối phiên đắt gấp ${o.x} lần đầu phiên: ${o.a} lên ${o.b} cho mỗi 1M token viết ra. (${o.sessions} phiên dài từ ${o.min} lượt trở lên.)`,
    'usage.ctxByTurnPlain': (o) =>
      `Mỗi lượt hỏi, Claude đọc lại cả phiên từ đầu — cột là lượng phải đọc lại ở lượt thứ mấy. (${o.sessions} phiên dài từ ${o.min} lượt trở lên.)`,
    'usage.tipTurnBand': (o) =>
      tipOf({
        head: `Lượt ${o.band}`,
        rows: [
          ['Phải đọc lại (mức giữa)', o.ctx],
          ['Giá mỗi 1M viết ra', o.unit],
          ['Ước tính', o.cost],
          ['Lượt gọi', o.msgs],
        ],
      }),

    'usage.bySession': 'Chi phí từng phiên',
    'usage.bySessionSub': (o) =>
      `Mỗi cột một phiên, mới nhất bên phải. Phần lớn phiên tốn khoảng ${o.mid}, nhưng 10 phiên đắt nhất đã chiếm ${o.share} tổng tiền. (${o.shown} phiên gần nhất trong ${o.n}.)`,
    'usage.tipSession': (o) =>
      tipOf({
        head: `${o.project} · ${o.at}`,
        rows: [
          ['Ước tính', o.cost],
          ['Lượt gọi', o.msgs],
          ['Claude viết ra', o.out],
          ['Đọc lại / viết ra', o.ratio],
          ['Kéo dài', o.dur],
        ],
      }),

    // "Phân bố" + "băng" là chữ của người làm thống kê. Tiêu đề giờ nói ra thứ người đọc
    // đi tìm; phụ đề dịch luôn nhãn trục cho họ, vì "150–300×" tự nó không nói được nó là
    // tỉ số của cái gì trên cái gì.
    'usage.ratioDist': 'Phiên nào đọc lại nhiều mà viết ra ít',
    'usage.ratioDistSub': (o) =>
      `Xếp phiên theo tỉ lệ đọc-lại: “150–300×” nghĩa là Claude phải đọc gấp 150–300 lần lượng token nó viết ra. Phiên điển hình của bạn ở mức ${o.mid}×. Nhóm nặng nhất ngốn ${o.share} tiền.`,
    'usage.ratioDistSubThin': (o) =>
      `Xếp phiên theo tỉ lệ đọc-lại: “150–300×” nghĩa là Claude phải đọc gấp 150–300 lần lượng token nó viết ra. Phiên điển hình của bạn ở mức ${o.mid}×. Nhóm nặng nhất ngốn ${o.share} tiền. (Đã bỏ ${o.thin} phiên Claude viết ra dưới ${o.min}.)`,
    // Đúng MỘT câu, và là câu chart này không tự nói được: thanh đo TIỀN nên nhóm đông
    // phiên hơn thì thanh dài hơn. Phần "tỉ số cao chưa chắc là lãng phí" và việc phải làm
    // gì với nó đã về khối hướng dẫn — để ở cả hai chỗ là kể hai lần bằng hai lối viết.
    'usage.ratioDistCap': 'Thanh đo <b>tiền</b>, không đo số phiên — nhóm đông phiên thì thanh dài hơn. Số phiên xem ở tooltip.',
    'usage.tipRatioBand': (o) =>
      tipOf({
        head: `Đọc lại gấp ${o.band} lượng viết ra`,
        rows: [
          ['Phiên', o.sessions],
          ['Ước tính', o.cost],
          ['Tỉ lệ tiền', o.share],
          ['Claude viết ra', o.out],
        ],
      }),

    // "cache nguội" và "ghi lại tiền tố" là hai chữ không ai ngoài người viết code đoán
    // được. Nói bằng thứ người dùng thật sự làm: nghỉ lâu rồi quay lại.
    'usage.rewarm': 'Nghỉ lâu rồi quay lại, phải trả tiền nạp lại',
    'usage.rewarmSub': (o) =>
      `Nghỉ đủ lâu thì bộ nhớ đệm hết hạn, lượt sau Claude nạp lại toàn bộ nội dung cũ và bạn trả tiền lần nữa cho đúng thứ đó. Nhiều nhất là ${o.extra} (${o.share}) ở ${o.calls} lượt.`,
    // Phải nói ra TRẦN TRÊN ngay dưới chart, không giấu trong tooltip: đây là con số duy
    // nhất ở màn này dựa trên một giả định về NGUYÊN NHÂN, và giả định đó có thể sai.
    // `ttl1` ĐO từ dữ liệu máy đang chạy. Trước đây nó là "95%" chép tay trong chuỗi này —
    // đúng vào ngày viết, và không có gì báo khi thôi đúng.
    'usage.rewarmCap': (o) =>
      `Đây là mức <b>nhiều nhất có thể</b>, không phải chắc chắn: sửa file hay <code>/compact</code> cũng buộc nạp lại, mà nhìn mốc thời gian thì không tách ra được. Máy bạn ${o.ttl1} bộ nhớ đệm giữ trong 1 giờ.`,
    'usage.gap5-15m': 'nghỉ 5–15 phút',
    'usage.gap15-60m': 'nghỉ 15–60 phút',
    'usage.gap1-6h': 'nghỉ 1–6 giờ',
    'usage.gap6h+': 'nghỉ trên 6 giờ',
    'usage.tipRewarm': (o) =>
      tipOf({
        head: o.band,
        rows: [
          ['Trả thêm', o.cost],
          ['Lượt ghi lại', o.calls],
          ['Token ghi lại', o.tokens],
        ],
      }),

    // ── Cách đọc màn này ──
    // Khối DUY NHẤT trên màn làm việc dạy. Mỗi dòng nói hai thứ và chỉ hai thứ: chart này
    // đo GÌ, và thấy số xấu thì LÀM GÌ. Con số cụ thể cố tình không nhắc — chúng đã ở phụ
    // đề và bảng số, mà chép chúng vào đây là nhận nuôi một bản sao sẽ lệch ngay lượt quét
    // sau. Bản trước vi phạm đúng luật đó ba lần: "$1.369", "95% cache ghi ở TTL 1 giờ" và
    // "trung vị nằm ở băng giữa" đều là quan sát về MỘT máy, đóng băng trong chuỗi dịch.
    //
    // Năm nhãn `effhUnit/effhCtx/effhSession/effhRatio/effhRewarm` đã bị xoá: chúng trùng
    // từng ký tự với năm tiêu đề chart, tức mười chuỗi cho năm cái tên qua hai ngôn ngữ.
    // `howToRead` giờ lấy thẳng khoá tiêu đề.
    'usage.effHelp': 'Cách đọc màn này',

    // Bảng thuật ngữ, và nó phải đứng ĐẦU khối. Bốn chữ dưới đây có mặt ở gần như mọi phụ
    // đề, mọi tooltip và mọi cột bảng của màn — không định nghĩa chúng ở một chỗ thì hoặc
    // là mỗi chart tự giải thích lại một lần (chính là cái làm màn này dài), hoặc là không
    // chỗ nào giải thích và người đọc tự đoán. "Lượt gọi" được kể ra vì con số đó bị hiểu
    // sai nhiều nhất: nó KHÔNG phải số câu người dùng gõ.
    'usage.glossTitle': 'Bốn chữ hay gặp ở màn này',
    'usage.glossOut': 'Token Claude viết ra',
    'usage.glossOutBody':
      'Token Claude thật sự viết ra cho bạn: câu trả lời, đoạn code, nội dung nó ghi vào file. Đây là thước đo <b>làm được bao nhiêu việc</b>, và là mẫu số của mọi tỉ số ở màn này.',
    'usage.glossCtx': 'Phải đọc lại',
    'usage.glossCtxBody':
      'Trước khi viết được một chữ, mỗi lượt Claude phải đọc lại toàn bộ cuộc trò chuyện từ đầu, cộng với file và kết quả lệnh đã nạp vào. Phần này thường lớn gấp <b>hàng trăm lần</b> phần nó viết ra — nên mọi con số “tổng token” gần như chỉ là nó, và chỉ nói lên bạn ngồi máy bao lâu.',
    'usage.glossCall': 'Lượt gọi',
    'usage.glossCallBody':
      'Một câu bạn hỏi thường thành <b>nhiều</b> lượt gọi: mỗi lần Claude đọc file, chạy lệnh hay gọi công cụ là thêm một lượt. Nên “3.700 lượt hôm nay” không có nghĩa bạn đã gõ 3.700 câu.',
    'usage.glossSession': 'Phiên',
    'usage.glossSessionBody':
      'Một lần mở Claude Code rồi làm liên tục. Đóng đi mở lại, hoặc <code>/clear</code>, là sang phiên mới — và phần phải đọc lại bắt đầu lại từ nhỏ.',

    'usage.effHelpIntro':
      'Ba mục <b>mỗi ngày tiêu bao nhiêu</b>, <b>tiêu vào đâu</b> và <b>cái gì ngốn token</b> trả lời câu <i>bao nhiêu</i>. Mục <b>đắt hơn, hay chỉ là làm nhiều hơn</b> trả lời câu khác hẳn, và đó là lý do nó có mặt: một ngày tốn nhiều tiền tự nó không nói được là bạn làm được nhiều việc hơn hay chỉ là trả đắt hơn cho cùng chừng ấy việc. Muốn biết thì phải lấy tiền chia cho lượng token Claude viết ra — mục đó chia sẵn cho bạn.',
    'usage.effhUnitBody':
      'Lấy tiền của một ngày chia cho lượng token Claude viết ra trong ngày đó. Vạch mốc là <b>mức giữa của chính máy bạn</b>, không phải chuẩn lấy từ đâu về — không có “giá đúng” cho một token, chỉ có “hôm nay đắt hơn thường lệ của bạn hay không”. Cột nhấp nhô quanh vạch là bình thường. <em>Nên làm gì:</em> chỉ đáng đi soi khi một ngày vọt lên <i>trong khi</i> cột ở chart “Claude viết ra bao nhiêu mỗi ngày” không giảm — lúc đó mới là làm bằng nhau mà tốn hơn.',
    'usage.effhCtxBody':
      'Chart duy nhất chỉ ra <b>nguyên nhân</b> chứ không chỉ kết quả. Cuộc trò chuyện chỉ dài thêm chứ không ngắn đi, nên lượt thứ 120 phải đọc lại nhiều hơn hẳn lượt thứ 5 — cùng một Claude, cùng loại việc, mà cuối phiên vẫn tốn hơn đầu phiên. Cột đo lượng phải đọc lại; giá tiền nằm ở tooltip. <em>Nên làm gì:</em> đây là đòn mạnh nhất màn — xong một việc thì <b>mở phiên mới</b>, đừng làm tiếp việc sau trong phiên cũ. Nhưng đừng cắt giữa chừng: kể lại từ đầu còn tốn hơn.',
    'usage.effhSessionBody':
      'Hầu hết phiên rẻ, thỉnh thoảng một phiên vọt lên — phụ đề cho biết mười phiên đắt nhất chiếm bao nhiêu phần tổng. <em>Nên làm gì:</em> rê chuột vào cột cao rồi đọc dòng <i>đọc lại / viết ra</i>. Đó là chỗ phân biệt hai loại phiên đắt trông y hệt nhau trên cột: tỉ số <b>thấp</b> nghĩa là phiên đó làm được nhiều việc (đắt xứng đáng), tỉ số <b>cao</b> nghĩa là phiên đó đọc lại quá nhiều mà làm ra ít. Chỉ loại sau đáng sửa.',
    'usage.effhRatioBody':
      'Cùng tỉ số với chart bên cạnh, nhưng <b>đếm sẵn</b> thay vì bắt bạn rê từng phiên: có bao nhiêu phiên đã ì ạch, và chúng ngốn bao nhiêu phần tiền. Tỉ số cao không mặc nhiên là lãng phí — phiên đọc cả kho code để sửa đúng một dòng vẫn có thể là phiên đáng giá nhất trong ngày; nó chỉ nói <i>chỗ nào đáng đi soi</i>. <em>Nên làm gì:</em> nhìn <b>tỉ lệ tiền</b> của nhóm nặng nhất, đừng nhìn số phiên. Ít phiên mà ngốn phần tiền lớn hơn hẳn tỉ lệ đầu người của chúng thì đó là chỗ đáng soi; hai con số xấp xỉ nhau thì không có gì bất thường.',
    'usage.effhRewarmBody':
      'Claude giữ sẵn nội dung đã đọc trong bộ nhớ đệm để lượt sau khỏi trả tiền đọc lại. Nghỉ đủ lâu thì bộ đệm hết hạn, lượt sau nạp lại từ đầu và bạn trả tiền lần nữa cho đúng nội dung cũ. Nạp vào tính 1,25–2× giá đọc thường, đọc từ đệm chỉ tính 0,1×. Hàng <b>$0</b> là kết luận hữu ích nhất bảng, không phải chỗ trống. <em>Nên làm gì:</em> nghỉ ngắn hơn thời gian đệm còn sống thì cứ nghỉ thoải mái, gần như không tốn. Quay lại sau nhiều giờ thì <b>mở phiên mới</b> — đằng nào cũng phải trả tiền nạp lại, mà phiên mới còn được cái lợi là bắt đầu với ít nội dung; nối tiếp phiên cũ là chịu cả hai giá cùng lúc.',
    // "Khác khoảng phủ" từng nằm ở CẢ đây lẫn `effNote` ngay dưới mục, hai bản còn trỏ
    // sang nhau. `effNote` giữ nó, vì nó mang theo khoảng ngày ĐO ĐƯỢC; ở đây chỉ còn
    // lời dặn, không lặp lại lý do.
    'usage.effHelpDont':
      '<b>Ba thứ đừng làm:</b> đừng lấy số của mục “đắt hơn hay làm nhiều hơn” trừ cho số của hai chart theo ngày — hai bên đọc từ hai nguồn phủ khác khoảng thời gian; đừng đọc <code>$</code> như hoá đơn — ràng buộc thật là hạn mức, mà hạn mức không cộng dồn; đừng chỉnh gì dựa trên một ngày dùng quá ít — chia trên vài lượt lẻ thì ra tỉ số nào cũng vô nghĩa, và chart đã bỏ chúng ra khỏi hình rồi.',

    'usage.sideNote': (o) =>
      `Subagent: ${o.calls} lượt · ${o.cost} (${o.share} tổng tiền) — nhưng tính theo giá mỗi 1M token viết ra thì là ${o.unit}, đắt gấp ${o.x} lần lượt gọi chính (${o.main}). Subagent phải đọc cả một đống rồi trả về một đoạn ngắn; đó là bản chất của nó, không phải lỗi.`,
    'usage.effNote': (o) =>
      `Mấy khối trên đọc từ transcript CÒN SỐNG (${o.from} → ${o.to}, ${o.n} lượt), không từ sổ cộng dồn — sổ khoá theo ngày × model nên không tái dựng được phiên, thứ tự lượt hay khoảng nghỉ. Vì vậy khoảng phủ ở đây có thể hẹp hơn hai chart theo ngày phía trên.`,

    // ── Hạn mức từng chu kỳ ──
    // Cột đo BỎ PHÍ chứ không đo đã tiêu, nên mọi chuỗi ở đây phải nói cùng chiều đó: số
    // lớn là xấu. Viết "đã tiêu 22%" ở tiêu đề trong khi cột vẽ 78% là bắt người đọc tự
    // lật ngược mỗi lần liếc.
    'usage.cycleWaste': 'Bỏ phí hạn mức, theo chu kỳ',
    // Trung vị chỉ in ở vạch mốc, không in lại ở đây — cùng luật với `unitByDaySub`.
    'usage.cycleWasteSub': (o) => `${o.kind} · ${o.n} chu kỳ đã chốt`,
    'usage.cycleWasteSubThin': (o) => `${o.kind} · ${o.n} chu kỳ đã chốt · bỏ ${o.dropped} chu kỳ theo dõi chưa đủ`,
    'usage.cycleWarmingSub': 'sổ hạn mức vừa bắt đầu ghi',
    'usage.cycleWarming': (o) =>
      `Hạn mức <b>không có lịch sử</b>: endpoint chỉ trả trạng thái lúc này, không có tham số nào hỏi lại chu kỳ đã qua. Nên chu kỳ nào không được ghi trong lúc nó đang chạy thì mất vĩnh viễn — sổ bắt đầu ghi từ bản này, và tới giờ có <b>${o.closed}</b> chu kỳ đã chốt. Khung 5 giờ chốt khoảng bốn lần một ngày, nên sau chừng một ngày mở dashboard là đủ cột để so.`,
    // Sổ còn trống trơn: cả mục thu thành dòng này. Câu đầy đủ ở trên chỉ có nghĩa khi đã
    // có chu kỳ để đếm — chưa có cái nào thì bốn dòng giải thích chỉ là bốn dòng chờ.
    'usage.cycleWarmingLine':
      'Chưa dựng được <b>bỏ phí hạn mức theo chu kỳ</b>: endpoint không trả lịch sử, nên sổ phải tự ghi trong lúc chu kỳ đang chạy. Khung 5 giờ chốt khoảng bốn lần một ngày — mở dashboard chừng một ngày là đủ cột để so.',
    'usage.cycleCap': (o) =>
      `Đỉnh ghi được chỉ là <b>mức sàn</b> — số thật có thể cao hơn — nên "bỏ phí" suy từ đó là <b>mức trần</b>. Chu kỳ được theo tới dưới ${o.watched} cửa sổ bị bỏ khỏi hình, vẫn giữ trong bảng số với dấu ⚠.`,
    'usage.tipCycle': (o) =>
      tipOf({
        head: `${o.kind} · chốt ${o.end}`,
        rows: [
          ['Bỏ phí', o.waste, 'warn'],
          ['Đã tiêu', o.used],
          ['Theo dõi tới', o.watched],
          ['Lượt đọc', o.samples],
        ],
      }),
    'usage.cCycle': 'Cửa sổ',
    'usage.cCycleEnd': 'Chốt lúc',
    'usage.cUsedPct': 'Đã tiêu',
    'usage.cWastePct': 'Bỏ phí',
    'usage.cWatched': 'Theo dõi tới',
    'usage.cRatioBand': 'Đọc lại / viết ra',
    'usage.cSessions': 'Phiên',
    'usage.cShare': 'Tỉ lệ tiền',

    'usage.costByModel': 'Tiền đi đâu, theo model',
    'usage.costByModelSub': 'Chia theo TIỀN chứ không theo số token. Nhờ vậy phần đọc từ bộ đệm được tính đúng theo trọng số thật của nó — nó rẻ hơn đọc mới mười lần, nên đếm theo token thì nó nuốt trọn thanh và che mất phần còn lại.',
    'usage.partOut': 'Claude viết ra',
    'usage.partCacheWrite': 'Nạp vào bộ đệm',
    'usage.partCacheRead': 'Đọc từ bộ đệm',
    'usage.partInput': 'Đọc mới',
    'usage.tipModelPart': (o) => tipOf({ head: o.model, rows: [[o.kind, `${o.cost} ước tính`]] }),

    'usage.byProject': 'Dự án nào ngốn nhiều nhất',
    'usage.byProjectSub': 'Lượng token Claude viết ra cho từng dự án. Worktree phụ gộp về dự án mẹ.',
    'usage.byProjectSubOrphan': (o) => `Lượng token Claude viết ra cho từng dự án · ${o.n} thư mục không khớp dự án nào (đã xoá, hoặc nằm ngoài NOW_ROOTS)`,
    'usage.tipProject': (o) =>
      tipOf({
        head: o.name,
        rows: [
          ['Claude viết ra', o.out],
          ['Lượt gọi', o.msgs],
          ['Ước tính', o.cost],
        ],
      }),

    'usage.byMcp': 'Theo MCP server',
    'usage.byMcpSub': (o) => `${o.n} server có nhãn — chiếm ${o.share} lượng token Claude viết ra`,
    'usage.bySkill': 'Theo skill',
    // "tên trước dấu hai chấm là plugin" thay cho cả một chart "theo plugin" đã bị gỡ:
    // chart đó gộp đúng mấy hàng ở đây, không thêm một token nào. Xem `renderUsage`.
    'usage.bySkillSub': (o) => `${o.n} skill có nhãn — chiếm ${o.share} lượng token Claude viết ra · tên trước dấu hai chấm là plugin`,
    'usage.tipAttribution': (o) =>
      tipOf({
        head: o.name,
        rows: [
          ['Claude viết ra', o.out],
          ['Lượt gọi', o.msgs],
          ['Ước tính', o.cost],
        ],
      }),
    'usage.byEntrypoint': 'Theo nơi mở Claude',
    // Hai chuỗi này gộp lại từng dài năm dòng trong một cột 381px — dài nhất màn sau khi
    // gỡ chart plugin, và phần lớn là GIẢI THÍCH chứ không phải số. Giữ lại đúng cái chart
    // không tự nói được: nhãn thô gộp mấy editor làm một, và bao nhiêu phần chưa gỡ ra được.
    'usage.byEntrypointSub': 'VS Code, Cursor và mọi bản fork đều dùng chung một nhãn',
    'usage.byEntrypointVague': (o) => `${o.share} chưa quy được về editor nào — chỉ chốt được khi dashboard thấy phiên lúc còn sống, nên phần này giảm dần.`,
    'usage.tipEntry': (o) =>
      tipOf({
        head: o.name,
        rows: [
          ['Claude viết ra', o.out],
          ['Ước tính', o.cost],
        ],
      }),

    'usage.cDate': 'Ngày',
    'usage.cCost': 'Ước tính',
    'usage.cRequests': 'Lượt gọi',
    'usage.cOut': 'Claude viết ra',
    'usage.cCacheRead': 'Đọc từ bộ đệm',
    'usage.cModel': 'Model',
    'usage.cProject': 'Dự án',
    'usage.cName': 'Tên',
    'usage.cEntry': 'Nơi mở',
    'usage.cUnit': 'Giá mỗi 1M viết ra',
    'usage.cTurnBand': 'Lượt',
    'usage.cCtxMedian': 'Phải đọc lại (mức giữa)',
    'usage.cStart': 'Bắt đầu',
    'usage.cRatio': 'Đọc lại / viết ra',
    'usage.cGap': 'Nghỉ',
    'usage.cExtra': 'Trả thêm',
    'usage.cTokens': 'Token',

    // Câu cuối từng là "hạn mức 5 giờ / theo tuần nằm ở server, đĩa không giữ nên dashboard
    // không dựng lại được" — viết từ hồi chưa đọc được qua Keychain, và bị chính khối hạn
    // mức ở ĐẦU màn này bác bỏ. Phần còn đúng của nó là: đĩa không giữ, nên lịch sử phải
    // tự ghi lấy; nói đúng chỗ đó và trỏ sang mục chu kỳ.
    'usage.note': () =>
      `<b>Đọc con số $ cho đúng:</b> đĩa <b>không</b> lưu tiền — không dòng transcript nào có <code>costUSD</code>. Mọi số $ ở đây do dashboard tự nhân ra từ bảng giá API dán trong <code>collect/usage.js</code>, trong khi tài khoản này trả theo <b>gói thuê bao</b>. Dùng nó để so ngày này với ngày kia, dự án này với dự án kia — đừng đọc như hoá đơn. Anthropic đổi giá thì bảng đó sai mà không có gì báo. Ràng buộc thật là <b>hạn mức</b> ở đầu màn: số đó đọc thẳng từ server, nhưng server không trả lịch sử, nên phần theo chu kỳ chỉ có những gì dashboard tự ghi lại được lúc đang chạy.`,
    'usage.gap': (o) =>
      `Thiếu ${o.lost} ngày đầu: token đầu tiên ghi ngày ${o.first} nhưng dữ liệu sớm nhất còn lại là ${o.oldest} — Claude Code đã dọn transcript cũ trước khi dashboard kịp chốt sổ.`,
    'usage.scan': (o) => `quét ${o.files} transcript trong ${o.ms}ms · bỏ ${o.dups} dòng trùng do resume/fork chép lại lịch sử cũ`,
    'usage.rollupAt': (o) => `· sổ theo ngày ở ${o.path} — đây là thứ giữ lại lịch sử sau khi Claude Code dọn transcript`,
    'usage.rollupFail': (o) => `· KHÔNG ghi được sổ theo ngày (${o.err}) — lịch sử sẽ mất dần khi transcript bị dọn`,
    'usage.qNote': (o) => `Ô tìm (“${o.q}”) không áp dụng ở màn này — lọc một phần thì mọi tổng đổi nghĩa mà không nói ra.`,
    'usage.empty': 'Chưa có dữ liệu token',
    'usage.emptyHint': 'Chưa có transcript nào trong ~/.claude/projects — hoặc Claude Code chưa từng chạy trên máy này.',
    'usage.broken': 'Không đọc được dữ liệu token',
    'usage.brokenHint': 'Không quét được ~/.claude/projects.',

    // ── Cursor & Antigravity (hai tab ngoài-Claude của màn Token) ──
    // Cùng bộ luật từ vựng của tab Claude (xem khối luật ở đầu mục ấy), thêm một luật
    // riêng: **không bao giờ để một con số gộp ba đơn vị**. Ba công cụ đo bằng phần trăm,
    // đô và hội thoại; một cái tổng ở đây trông như số nhưng không nói về cái gì cả.
    'tools.cursorNone': 'Chưa có số Cursor để vẽ',
    'tools.noneHint': 'Lý do nằm ở khối hạn mức Cursor phía trên — nó nói rõ mắt xích nào đứt.',

    'tools.bTotal': 'Cả chu kỳ',
    'tools.bAuto': 'Model Cursor tự chọn',
    'tools.bNamed': 'Model bạn gọi tên',
    'tools.spentOf': (o) => `${o.spent} trên ${o.cap}`,
    'tools.rowSpent': 'Quy ra đô',
    'tools.rowOver': 'vượt phần đã trả',
    'tools.bonus': (o) =>
      `Gói bạn mua là ${o.plan}/tháng; Cursor cộng thêm ${o.bonus} miễn phí trong chu kỳ này. Đó là lý do tiêu quá ${o.plan} mà vẫn chưa chạm trần.`,
    'tools.capHelp': 'Trần đô này ở đâu ra',
    'tools.capNote':
      'Cursor <b>không gửi mức trần sử dụng</b> trong phản hồi — dashboard suy ngược ra từ phần trăm: <b>trần = đã tiêu ÷ phần trăm</b>. Trường <b>limit</b> mà Cursor gửi kèm là <b>giá gói ($20/tháng)</b>, không phải trần: lấy nó chia thì ra 244% trong khi Cursor tự báo 14%. Nên phần trăm là số gốc và luôn được hiện to; cặp đô chỉ là cách viết lại nó, và biến mất khi chưa tiêu đủ để chia.',
    'tools.cNoAuth':
      'Không đọc được token đăng nhập Cursor. Dashboard lấy nó từ SQLite của Cursor (~/Library/Application Support/Cursor), nên cần đăng nhập Cursor ít nhất một lần.',
    'tools.cHttp': 'Endpoint hạn mức của Cursor trả về lỗi. Đây là RPC nội bộ không có tài liệu — hình dạng có thể đã đổi.',
    'tools.cOffline': 'Không gọi được endpoint hạn mức của Cursor — mạng hỏng hoặc quá hạn chờ.',
    'tools.cEmpty': 'Gọi được endpoint nhưng phản hồi không có số hạn mức nào.',
    'tools.cBroken': 'Phản hồi hạn mức Cursor đọc không ra — RPC nội bộ này không có tài liệu, hình dạng có thể đã đổi.',

    'tools.cursorCost': 'Tiền đi đâu, theo model',
    'tools.cursorCostSub': 'đô thật Cursor tính, không phải ước lượng',
    'tools.cursorTok': 'Token theo model',
    // `usage.partOut` viết là "Claude viết ra" — đúng ở màn Token, sai ở đây: mấy model này
    // là grok và composer, Claude không dính gì. Ba loại còn lại không gọi tên ai nên dùng
    // chung được.
    'tools.partOut': 'Model viết ra',
    'tools.cursorTokSub': 'bốn loại token, số Cursor trả về nguyên trạng',
    'tools.cModel': 'Model',
    'tools.cBucket': 'Nhóm hạn mức',
    'tools.cCost': 'Tiền',
    'tools.tipModel': (o) => tipOf({ head: o.model, rows: [['Tiền', o.cost], ['Nhóm', o.bucket], ['Token viết ra', o.out]] }),
    'tools.tipTokPart': (o) => tipOf({ head: o.model, rows: [[o.kind, o.n]] }),

    // ── Cursor theo thời gian (sổ sự kiện) ──
    // Tiền ở khối này là tiền THẬT Cursor đã tính, khác hẳn cột đô ước lượng của tab Claude.
    // Mọi chuỗi ở đây phải giữ được sự phân biệt ấy — hai loại đô không so với nhau được.
    'tools.curTimeSection': 'Theo thời gian — từng lượt gọi, có mốc thời gian',
    'tools.curCostByDay': 'Tiền mỗi ngày',
    'tools.curCostByDaySub': (o) => `${o.total} tổng cộng · ${o.from} → ${o.to}`,
    'tools.curCallsByDay': 'Lượt gọi mỗi ngày, và bao nhiêu lượt hỏng',
    'tools.curCallsByDaySub': (o) => `${o.n.toLocaleString('vi-VN')} lượt · ${o.err} lượt lỗi (${o.share}) — lỗi không bị tính tiền, chỉ tốn thời gian chờ`,
    'tools.axCalls': 'Lượt gọi · trục trái',
    'tools.axErr': 'Lượt hỏng · trục phải',
    'tools.partErrored': 'Lỗi, không tính tiền',
    'tools.curByConvo': 'Chi phí theo hội thoại',
    // Đuôi "· 10 tốn nhất" chỉ hiện khi danh sách THẬT SỰ bị cắt — 7 hội thoại mà vẫn
    // ghi "10 tốn nhất" là hứa một phép cắt không xảy ra (cùng luật với đuôi "/97" ở agRow).
    'tools.curByConvoSub': (o) => `${o.n.toLocaleString('vi-VN')} hội thoại trong ${o.d} ngày qua${o.n > 10 ? ' · 10 tốn nhất' : ''}`,
    'tools.cEvents': 'Lượt gọi',
    'tools.cConvoId': 'Mã hội thoại',
    'tools.cFirstDay': 'Lần đầu',
    'tools.cLastDay': 'Lần cuối',
    'tools.tipCurDay': (o) =>
      tipOf({ head: o.day, rows: [['Tiền', o.cost], ['Lượt gọi', o.events], ['Token viết ra', o.out]] }),
    'tools.tipCurCalls': (o) =>
      tipOf({ head: o.day, rows: [['Lượt gọi', o.n], ['Lượt hỏng', o.err, o.err ? 'warn' : ''], ['Tiền', o.cost]] }),
    'tools.tipCurConvo': (o) =>
      tipOf({ head: o.id, rows: [['Tiền', o.cost], ['Lượt gọi', o.events], ['Lần đầu', o.from], ['Lần cuối', o.to]] }),
    'tools.curEventsNote': (o) =>
      `Đọc từ <b>GetFilteredUsageEvents</b>: ${o.n.toLocaleString('vi-VN')} lượt gọi trải ${o.days} ngày (${o.from} → ${o.to}), chốt vào sổ ở <b>~/.now-dashboard/cursor-events.json</b>. <b>Tiền ở khối này là tiền THẬT Cursor đã tính</b> — không phải ước lượng như cột đô của tab Claude, nên hai bên không cộng hay trừ cho nhau được. Sổ làm mới 15 phút một lần, mỗi lượt kéo lại trọn hai ngày cuối rồi ghi đè.`,
    'tools.curEventsWarming': 'Đang kéo sổ sự kiện Cursor lần đầu — mất khoảng mười giây, lượt quét sau sẽ có chart.',
    'tools.curEventsNone': 'Chưa đọc được sự kiện Cursor nào. Lý do nằm ở khối hạn mức phía trên.',

    // ── Cursor: nhịp trong editor (GetUserAnalytics) ──
    'tools.curEditorSection': 'Nhịp trong editor — thứ thật sự vào file',
    'tools.curLines': 'Dòng code được nhận, mỗi ngày',
    'tools.curLinesSub': (o) => `${o.accepted} dòng được nhận trên ${o.days} ngày có hoạt động`,
    'tools.curTabRate': 'Tỉ lệ gợi ý Tab được nhận',
    'tools.curTabRateSub': (o) => `trên ${o.shown} lần gợi ý hiện ra`,
    'tools.curTabRateSubThin': (o) => `trên ${o.shown} lần gợi ý · bỏ ${o.thin} ngày dưới ${o.min} gợi ý khỏi hình, tỉ lệ ở đó là nhiễu`,
    'tools.curExts': 'Làm việc trên loại file nào',
    'tools.curExtsSub': (o) => `${o.n} đuôi file, xếp theo số lần sửa`,
    'tools.cAccepted': 'Dòng được nhận',
    'tools.cAdded': 'Dòng gợi ý',
    'tools.cApplies': 'Lần áp dụng',
    'tools.cAccepts': 'Lần nhận',
    'tools.cTabRate': 'Tỉ lệ nhận',
    'tools.cTabsShown': 'Gợi ý hiện ra',
    'tools.cTabsAccepted': 'Gợi ý được nhận',
    'tools.cExt': 'Đuôi file',
    'tools.cEdits': 'Lần sửa',
    'tools.tipCurLines': (o) =>
      tipOf({ head: o.day, rows: [['Dòng được nhận', o.accepted], ['Dòng gợi ý', o.added], ['Lần áp dụng', o.applies], ['Lần nhận', o.accepts]] }),
    'tools.tipCurTab': (o) => tipOf({ head: o.day, rows: [['Tỉ lệ nhận', o.rate], ['Gợi ý hiện ra', o.shown], ['Được nhận', o.accepted]] }),
    'tools.tipCurExt': (o) => tipOf({ head: o.name, rows: [['Lần sửa', o.count], ['Tỉ trọng', o.share]] }),
    'tools.curEditorNote':
      'Khối này đo thứ <b>được nhận vào file</b>, không đo thứ model sinh ra — trục duy nhất trong cả màn Token nói về chất chứ không về khối lượng. Gợi ý nhiều mà bị bỏ nhiều thì không phải là làm được nhiều. Số do <b>GetUserAnalytics</b> trả về, xin 90 ngày và server cho bao nhiêu thì lấy bấy nhiêu.',
    'tools.curCycleSection': 'Chu kỳ đang chạy — do chính Cursor cộng',

    // Hoạt động Antigravity đọc từ ĐĨA, khác nguồn với hạn mức của nó — nên câu chỉ đường
    // ở đây không trỏ lên khối hạn mức như bên Cursor: hai thứ hỏng độc lập nhau.
    'tools.agNone': 'Chưa đọc được hội thoại Antigravity nào',
    'tools.agNoneHint': 'Cần mở Antigravity ít nhất một lần trên máy này; sổ hội thoại nằm ở ~/.gemini.',

    'tools.agConvos': 'Hội thoại',
    'tools.agAwake': 'Đang thức',
    'tools.agSteps': 'Bước',
    'tools.agTurns': 'Lượt gọi model',
    'tools.agCtxMed': 'Ngữ cảnh mỗi lượt',
    'tools.agBytes': 'Dung lượng',
    'tools.agNoFolder': 'không rõ thư mục',
    'tools.agConvoSection': 'Hội thoại — đọc từ sổ mục lục',
    'tools.agByProject': 'Hội thoại theo dự án',
    'tools.agByProjectSub': 'xếp theo số bước đã chạy',
    'tools.cProject': 'Dự án',
    'tools.cConvos': 'Hội thoại',
    'tools.cSteps': 'Bước',
    'tools.cSize': 'Dung lượng',
    'tools.tipAg': (o) =>
      tipOf({ head: o.name, rows: [['Bước', o.steps], ['Hội thoại', o.convos], ['Dung lượng', o.size]] }),
    'tools.tipAgFull': (o) =>
      tipOf({
        head: o.name,
        rows: [['Bước', o.steps], ['Lượt gọi model', o.turns], ['Hội thoại', o.convos], ['Ngữ cảnh đã đọc', o.ctx], ['Dung lượng', o.size]],
      }),

    // ── Lượt gọi model Antigravity (đọc từ gen_metadata) ──
    // Luật riêng của khối này: **mức chắc chắn phải đi kèm con số**. Ngữ cảnh và số lượt đọc
    // thẳng từ bản ghi; token viết ra thì suy ra từ độ lớn và tỉ số, nên mọi chỗ gọi tên nó
    // đều mang chữ "suy ra" và nó không bao giờ được lên cột.
    'tools.agCallSection': 'Lượt gọi model — đọc từ sổ của từng hội thoại',
    'tools.agTurnsByDay': 'Lượt gọi model mỗi ngày',
    'tools.agTurnsByDaySub': (o) => `${o.n.toLocaleString('vi-VN')} lượt trên ${o.days} ngày có dữ liệu`,
    'tools.agCtxByDay': 'Một lượt điển hình phải đọc lại bao nhiêu',
    'tools.agCtxByDaySub': 'trung vị ngữ cảnh của một lượt — chia rồi, nên cao lên nghĩa là mỗi lượt nặng hơn chứ không phải làm nhiều hơn',
    'tools.agByModel': 'Lượt gọi theo model',
    'tools.agByModelSub': (o) => `${o.n} model, xếp theo số lượt`,
    'tools.agCtxFill': 'Ngữ cảnh đầy tới đâu',
    'tools.agCtxFillSub': (o) => `${o.n.toLocaleString('vi-VN')} lượt biết cả trần · ${o.tail} lượt (${o.share}) chạy trên 90% trần`,
    'tools.agCtxFillCap':
      'Gần đầy trần là lúc Antigravity bắt đầu phải cắt bớt lịch sử hội thoại. Cách xử lý duy nhất là tách hội thoại mới — nên băng cuối là băng đáng nhìn.',
    'tools.agTurnsNote': (o) =>
      `Đọc từ bảng <b>gen_metadata</b> trong ${o.convos} file hội thoại: ${o.turns.toLocaleString('vi-VN')} lượt, ${o.from} → ${o.to}. <b>Số lượt và ngữ cảnh là trị ghi thẳng trong bản ghi.</b> Cột <i>token viết ra</i> ở bảng số là <b>suy ra</b> — bản ghi không đặt tên trường, con số này được chọn vì độ lớn và vì tỉ số so với ngữ cảnh (82×) khớp dải của Claude Code. Hai trường token còn lại chưa tách được input với cache nên không hiện ở đâu cả.`,
    'tools.agUnreadable': (o) => `${o.n} file hội thoại không đọc được — mấy con số trên đang thiếu phần của chúng.`,
    'tools.cTurns': 'Lượt gọi',
    'tools.cCtxMedian': 'Ngữ cảnh mỗi lượt',
    'tools.cCtxRead': 'Ngữ cảnh đã đọc',
    'tools.cCtxBand': 'Độ đầy ngữ cảnh',
    'tools.cOutGuess': 'Token viết ra (suy ra)',
    'tools.tipAgDay': (o) =>
      tipOf({ head: o.day, rows: [['Lượt gọi', o.turns], ['Ngữ cảnh mỗi lượt', o.ctx], ['Token viết ra (suy ra)', o.out]] }),
    'tools.tipAgCtxDay': (o) =>
      tipOf({ head: o.day, rows: [['Ngữ cảnh mỗi lượt', o.ctx], ['Lượt gọi', o.turns], ['Cộng cả ngày', o.total]] }),
    'tools.tipAgModel': (o) =>
      tipOf({ head: o.name, rows: [['Lượt gọi', o.turns], ['Ngữ cảnh mỗi lượt', o.ctx], ['Token viết ra (suy ra)', o.out]] }),
    'tools.tipAgBand': (o) => tipOf({ head: `Ngữ cảnh ${o.band} trần`, rows: [['Lượt gọi', o.turns], ['Tỉ trọng', o.share]] }),
    'tools.rowLeft': 'Còn lại',
    'tools.agQClosed': 'Antigravity đang đóng. Hạn mức của nó chỉ hỏi được qua tiến trình đang chạy, nên lúc app tắt thì không có số mới — khác với số hội thoại bên dưới, thứ đọc thẳng từ đĩa lúc nào cũng được.',
    'tools.agQNoPort': 'Antigravity đang chạy nhưng không tìm ra cổng nội bộ của nó. Thường là app vừa mở và chưa dựng xong máy chủ; lượt quét sau sẽ có.',
    'tools.agQHttp': 'Máy chủ nội bộ của Antigravity từ chối lượt hỏi. Số dưới đây là ảnh chụp lần đọc gần nhất.',
    'tools.agQOffline': 'Không hỏi được máy chủ nội bộ của Antigravity. Số dưới đây là ảnh chụp lần đọc gần nhất.',
    'tools.agQBroken': 'Chưa đọc được hạn mức Antigravity.',
    'tools.agQEmpty': 'Antigravity trả lời nhưng không có quỹ hạn mức nào — thường là tài khoản chưa gắn gói.',
    'tools.agQHelp': 'vì sao số ở đây khác số trong app Antigravity?',
    'tools.agQNote':
      'Cùng một sự thật, hai cách nói: app Antigravity hiện phần <b>còn lại</b>, dashboard này hiện phần <b>đã tiêu</b> — giống Claude và Cursor ở hai khối trên. Thấy app ghi 71% mà đây ghi 29% thì không có gì lệch: 29 + 71 = 100. Phần còn lại vẫn in ngay dưới mỗi thanh.<br><br>Hai quỹ hạn mức tiêu <b>độc lập</b>: Gemini một quỹ, Claude+GPT một quỹ, mỗi quỹ có khung 5 giờ và khung tuần riêng. Cạn quỹ này không đụng gì tới quỹ kia, nên bốn con số không cộng lại được.<br><br>Quota tiêu theo <b>chi phí</b> token chứ không theo số lượt, nên số bước ở khối dưới không quy đổi ra được phần trăm ở đây — hai thứ nằm cạnh nhau, không nói cùng một chuyện.',
    'tools.agKeep': (o) => `Chỉ đếm hội thoại có ghi trong ${o.d} ngày gần nhất.`,

    // ── chart ──
    'chart.table': 'bảng số',
    'chart.total': 'tổng',
    'chart.others': (o) => `${o.n} mục còn lại`,
    'chart.share': 'Tỉ lệ',
    'chart.value': 'Giá trị',

    // ── Báo cáo dán được ──
    // Khối "cách đọc" phải đi CÙNG số trong một lần dán: bảng số trần thì bên nhận
    // đọc $4.535 thành hoá đơn và đọc mọi tổng token thành khối lượng công việc — cả
    // hai đều sai, và sai theo hướng dẫn tới lời khuyên ngược.
    'report.btn': 'báo cáo',
    'report.tip': tipOf({
      head: 'Báo cáo cả màn',
      rows: [
        ['Gồm', 'mọi bảng số + phụ đề'],
        ['Định dạng', 'Markdown'],
        ['Kèm', 'cách đọc + câu hỏi sẵn'],
      ],
      note: 'Bấm để chép, rồi dán vào Claude hoặc ChatGPT. Số chỉ rời máy lúc bạn dán.',
    }),
    'report.tipDone': (o) =>
      tipOf({
        head: 'Đã chép ✓',
        rows: [
          ['Độ dài', `${o.chars} ký tự`],
          ['Bảng số', o.tables],
        ],
        note: 'Dán vào Claude hoặc ChatGPT rồi gửi — báo cáo đã tự mang câu hỏi. Muốn hỏi khác thì sửa dòng “Nhiệm vụ:” ở đầu.',
      }),
    'report.tipFail': tipOf({
      head: 'Chưa chép được',
      note: 'Trình duyệt chặn clipboard khi cửa sổ chưa được chọn. Bấm vào cửa sổ dashboard một lần rồi bấm lại nút này.',
    }),
    'report.stamp': (o) => `Số chốt lúc ${o.at} (giờ hệ thống). Mỗi bảng dưới đây là bảng số đi kèm của chart tương ứng.`,
    'report.ask':
      'Nhiệm vụ: đọc các bảng dưới đây, chỉ ra chỗ bất thường và chỗ cải thiện được, kèm hành động cụ thể. Mỗi kết luận phải chỉ rõ con số nào dẫn tới nó. Không đủ dữ kiện thì nói là không đủ, đừng suy diễn.',
    'report.quotaH': 'Hạn mức',
    'report.kpiH': 'Tóm tắt',
    'report.howUsage': `**Cách đọc bộ số này — đọc trước khi kết luận gì:**

1. **Tiền là ƯỚC TÍNH, không phải hoá đơn.** Đĩa không lưu tiền; mọi số \`$\` do dashboard nhân ra từ một bảng giá API dán trong mã, còn tài khoản này trả theo **gói thuê bao** — tiêu nhiều hay ít không đổi số tiền phải trả. Dùng số \`$\` để so ngày với ngày, dự án với dự án, phiên với phiên. Đừng khuyên "cắt giảm để tiết kiệm tiền".
2. **Phần Claude phải ĐỌC LẠI lớn gấp hơn hai trăm lần phần nó VIẾT RA.** Mỗi lượt, Claude đọc lại cả cuộc trò chuyện từ đầu trước khi viết thêm được một chữ. Nên mọi tổng "token" gần như chỉ là phần đọc lại, và nó chỉ nói lên đã ngồi máy bao lâu. Khối lượng công việc thật nằm ở cột *Claude viết ra*.
3. **Cái đáng đọc là TỈ SỐ, không phải khối lượng.** Mục "đắt hơn, hay chỉ là làm nhiều hơn" là chỗ đã chia sẵn: giá mỗi 1M token Claude viết ra, lượng phải đọc lại ở mỗi lượt, tiền trả thêm khi nghỉ lâu rồi quay lại. Một ngày đắt hơn chỉ vì làm nhiều hơn thì không phải vấn đề; đắt hơn trong khi làm bằng nhau thì mới là.
4. **Ràng buộc thật là hạn mức, không phải tiền.** Hạn mức 5 giờ / 7 ngày không cộng dồn: phần chưa dùng khi reset là mất, không phải để dành. Đúng với cả ba công cụ: "mới tiêu 14% mà đã qua 75% chu kỳ" là một khoản lỗ, không phải một tin tốt.
5. **Khoảng phủ hẹp dần về quá khứ.** Claude Code tự dọn transcript cũ, nên "ít dữ liệu ở ngày xa" là cơ chế dọn dẹp, không phải "hồi đó dùng ít".
6. **Ba công cụ đo bằng ba đơn vị KHÁC NHAU. Đừng cộng, đừng trừ.** Claude đo bằng phần trăm của hai cửa sổ trượt, Cursor bằng đô theo tháng dương lịch, Antigravity bằng phần trăm của hai quỹ tách rời. Khối hạn mức đầu bản báo cáo có cả ba; phần bảng số bên dưới chỉ là của **một** công cụ — tên nó nằm ở tiêu đề mục ngay trước bảng đầu tiên.
7. **Tiền của Cursor là tiền THẬT, tiền của Claude là ước tính.** Số \`$\` của Cursor do chính Cursor tính; số \`$\` của Claude do dashboard nhân ra như ở điểm 1. Hai cột đô này không so với nhau được. Và trần đô của Cursor là số **suy ra** (\`đã tiêu ÷ phần trăm\`), không phải số Cursor gửi — trường \`limit\` trong phản hồi là giá gói, chia theo nó ra 244% trong khi Cursor tự báo 14%. Phần trăm là số gốc.`,
    'report.howStats': `**Cách đọc bộ số này:** mọi con số ở đây đến từ NOW board do người tự viết, nên nó đo **việc đã được GHI LẠI**, không đo việc đã làm. Ngày trống có thể là ngày không cập nhật board, không phải ngày không làm gì — chỗ nào chart đã tự trừ ra thì phụ đề của chart nói rõ.`,

    // ── Màn Nhìn lại (phím 8) ──
    //
    // Màn duy nhất đọc LỊCH SỬ — sổ chu kỳ của ba công cụ. Chữ theo đúng luật của màn
    // Token: số ngoại suy mang chân trời ("hết cửa sổ này", "tuần này"), không danh từ
    // trừu tượng, và chu kỳ theo dõi hụt thì nói thẳng "không quy ra tiền" thay vì im lặng.
    'nav.lookback': 'Nhìn lại',
    'title.lookback': 'Ba gói trả tháng, theo từng chu kỳ đã qua',
    // Bàn chỉnh: chỉ TÊN MÀN đi qua i18n. Ba chục nhãn công tắc bên trong nó ở lại
    // tiếng Việt trần trong `views/bench.js` — chúng gọi tên thứ chỉ có nghĩa với người
    // đang sửa repo, nên chúng bám theo mã nguồn chứ không bám theo người đọc.
    'nav.bench': 'Bàn chỉnh',
    'title.bench': 'Vặn thử popover thanh menu, rồi chép giá trị vào code',
    'lookback.broken': 'Chưa dựng được phần nhìn lại',
    'lookback.noLive': 'không đọc được hạn mức lúc này — thẻ chỉ còn phần lịch sử',
    'lookback.buySection': 'Gói có đáng tiền không',
    'lookback.buyQ':
      'Mỗi thẻ chạy trên chu kỳ của chính công cụ đó — ba thẻ không so sánh trực tiếp với nhau được; chỉ dòng cuối khối quy cả ba về tuần, và nói rõ là quy đổi.',
    'lookback.capRun': 'đang chạy',
    'lookback.wasteTail': (o) => `bỏ phí quy ra tiền ≈ ${o.usd}`,

    // Thẻ Claude — cửa sổ 7 ngày mang tiền, dãy 5 giờ trung tính.
    'lookback.planClaude': (o) => `${o.tier} · $${o.plan}/tháng nhập tay trong config ≈ ${o.cycle} / cửa sổ 7 ngày`,
    'lookback.leadClaude': (o) => `đã tiêu của cửa sổ 7 ngày, reset ${o.at}`,
    'lookback.scopedShare': (o) => `Riêng hạn mức ${o.model} đã tiêu ${o.pct} trần riêng của nó.`,
    'lookback.capWindow': (o) => `cửa sổ 7 ngày, ${o.from} →`,
    'lookback.sevenCapNote': 'vàng = bỏ phí 10–50% · xanh = ±10%',
    'lookback.fivesCap': (o) => `đỉnh từng chu kỳ 5h, ${o.from} →`,
    'lookback.fiveNever': (o) => `Trần 5h chưa bao giờ là ràng buộc — đỉnh cao nhất từ khi sổ mở: ${o.max}.`,
    'lookback.fiveHit': (o) => `Trần 5h đã có lần chạm ${o.max} — khung ngắn cũng từng chặn tay.`,
    'lookback.sevenYoung': (o) =>
      `Sổ chu kỳ mở ${o.opened} — chưa cửa sổ 7 ngày nào đóng. Dãy cột 7 ngày kèm tiền đầy dần từ ${o.first}.`,
    'lookback.sevenMoney': (o) => `${o.n} cửa sổ đóng: bỏ phí ${o.waste} trên ${o.paid} đã trả`,
    'lookback.sevenWorst': (o) => `tệ nhất là cửa sổ chốt ${o.week}: để phí ${o.usd}`,
    'lookback.partialSkip': (o) => `${o.n} chu kỳ theo dõi hụt (cột xám) không quy ra tiền`,
    'lookback.fiveStill': (o) => `trần 5h: đỉnh của ${o.n} chu kỳ vẫn chỉ ${o.max}`,
    'lookback.tipSeven': (o) =>
      tipOf({
        head: `Cửa sổ 7 ngày → ${o.end}`,
        rows: [
          ['Đã tiêu', o.used],
          ['Bỏ phí', o.usd ? `${o.waste} · ${o.usd}` : o.waste],
          ['Theo dõi tới', o.watched],
        ],
        note: o.partial ? 'Theo dõi hụt: đỉnh ghi được chỉ là mức sàn, bỏ phí suy ra là mức trần — không quy ra tiền.' : '',
      }),
    'lookback.tipFive': (o) =>
      tipOf({
        head: `Chu kỳ 5 giờ → ${o.end}`,
        rows: [['Đỉnh', o.used]],
        note: 'Dãy 5 giờ trung tính — phần lớn chu kỳ rơi vào lúc ngủ, không quy ra tiền.',
      }),

    // Thẻ Cursor — cents thật, vượt gói là quà.
    'lookback.planCursor': (o) => `${o.tier} · $${o.plan}/chu kỳ billing ${o.from} → ${o.to}`,
    'lookback.leadCursorOver': (o) => `đã dùng trên gói $${o.plan} — vượt ${o.x}×`,
    'lookback.leadCursorUnder': (o) => `đã dùng trên gói $${o.plan}`,
    'lookback.cursorOverLine': (o) =>
      `Included $${o.plan} tiêu hết + nhà cung cấp bù ${o.bonus} · ${o.elapsed} thời gian chu kỳ đã trôi`,
    'lookback.cursorUnderLine': (o) => `Còn ${o.left} của gói chưa dùng · ${o.elapsed} thời gian chu kỳ đã trôi`,
    'lookback.cursorMoneyOverRun': 'Bỏ phí chu kỳ này: $0 — phần đã trả dùng sạch, phần vượt là quà nhà cung cấp, ăn màu "vượt mức".',
    'lookback.cursorMoneyProj': (o) => `Dự phóng hết chu kỳ (${o.to}): ~${o.proj} — bỏ phí ≈ ${o.waste}`,
    'lookback.cursorCycles': (o) => `${o.n} chu kỳ đóng: bỏ phí ${o.waste}`,
    'lookback.cursorAllOver': (o) => ` — $${o.plan} nào cũng dùng sạch, phần vượt là bonus nhà cung cấp`,
    'lookback.cursorCap': (o) => `chu kỳ ${o.from}→${o.to}`,
    'lookback.cursorCapNote': 'tím = vượt phần đã trả',
    'lookback.tipBilling': (o) =>
      tipOf({
        head: `Chu kỳ billing → ${o.end}`,
        rows: [
          ['Đã dùng', o.cents],
          ['Gói', o.plan],
          ['Bonus', o.bonus],
          ['Bỏ phí', o.waste],
        ],
        note: o.partial ? 'Theo dõi hụt — không quy ra tiền.' : '',
      }),
    'lookback.tipCursorRun': (o) =>
      tipOf({
        head: 'Chu kỳ đang chạy',
        rows: [
          ['Đã dùng', o.cents],
          ['Gói', o.plan],
          ['Thời gian đã trôi', o.elapsed],
          ['Reset', o.reset],
        ],
      }),

    // Thẻ Antigravity — tiền neo vào quỹ Gemini, quỹ Claude/GPT chỉ ra chữ.
    'lookback.planAg': (o) => `${o.tier} · $${o.plan}/tháng ≈ ${o.cycle} / tuần — tiền neo vào quỹ Gemini`,
    'lookback.leadAg': (o) => `đã tiêu quỹ Gemini tuần này, reset ${o.at}`,
    'lookback.agWeekCap': (o) => `tuần ${o.from} → ${o.to}`,
    'lookback.threepLine': (o) => `Quỹ Claude/GPT cùng gói: đã tiêu ${o.used} khi tuần mới trôi ${o.elapsed}`,
    'lookback.threepPace': (o) => ` — nhịp này đòi ~${o.x} tuần mới đủ`,
    'lookback.threepCapped': (o) => `Quỹ Claude/GPT cùng gói đã chạm trần tuần — reset ${o.at}.`,
    'lookback.threep5h': 'quỹ 5 giờ của nó đang chạm trần lúc này',
    'lookback.threepNoMoney': (o) => `Không quy ra tiền: một gói $${o.plan} mua cả hai quỹ, tách giá là bịa ra một phép chia.`,
    'lookback.agMoney': (o) => `${o.n} tuần đóng: bỏ phí ${o.waste} trên ${o.paid} đã trả`,
    'lookback.agYoung': (o) => `Sổ chu kỳ AG mở ${o.opened} — tuần đầu tiên đóng lúc reset ${o.first}.`,
    'lookback.tipGemini': (o) =>
      tipOf({
        head: `Tuần Gemini → ${o.end}`,
        rows: [
          ['Đã tiêu', o.used],
          ['Bỏ phí', o.usd ? `${o.waste} · ${o.usd}` : o.waste],
          ['Theo dõi tới', o.watched],
        ],
        note: o.partial ? 'Theo dõi hụt: đỉnh ghi được chỉ là mức sàn, bỏ phí suy ra là mức trần — không quy ra tiền.' : '',
      }),

    // Dòng cộng ngang duy nhất của khối A.
    'lookback.weekTotal': (o) => `Quy cùng về tuần để cộng được: ba gói ≈ ${o.sum}/tuần — tuần này dự phóng bỏ phí ≈ ${o.waste}. `,
    'lookback.weekTight': 'Hạn mức đang được vắt gần kiệt — đúng đích.',
    'lookback.weekLoose': (o) => `Phần bỏ phí lớn nhất đang nằm ở ${o.tool}.`,

    // Khối B — nhịp 14 ngày.
    'lookback.rhythmSection': 'Nhịp 14 ngày',
    'lookback.rhythmQ': 'Mỗi công cụ một dải, đơn vị riêng — ba đơn vị không cộng vào nhau được nên không vẽ chung một cột.',
    'lookback.stripClaude': 'Claude — token viết ra mỗi ngày',
    'lookback.stripClaudeSrc': (o) => `nguồn: sổ usage-rollup, sâu ${o.days} ngày`,
    'lookback.stripCursor': 'Cursor — lượt gọi mỗi ngày',
    'lookback.stripCursorSrc': (o) => `nguồn: sổ cursor-events, sâu ${o.days} ngày`,
    'lookback.stripAg': 'Antigravity — lượt agent mỗi ngày',
    'lookback.stripAgSrc': (o) => `nguồn: bảng gen_metadata, sâu ${o.days} ngày`,
    'lookback.agNoDaily':
      'Antigravity chưa có lượt agent nào đọc được trong 14 ngày qua — dải này chỉ hiện khi bảng gen_metadata còn hội thoại mới.',
    'lookback.peakAt': (o) => `đỉnh ${o.day}: ${o.v}`,
    'lookback.zeroDays': (o) => `trống ${o.days} — ngày không mở ${o.tool}`,
    'lookback.zeroMany': (o) => `${o.n} ngày không mở ${o.tool}`,
    'lookback.tipClaudeDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Claude viết ra', o.out],
          ['Lượt gọi', o.msgs],
        ],
      }),
    'lookback.tipCursorDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Lượt gọi', o.events],
          ['Tiền thật', o.cost],
        ],
      }),
    'lookback.tipAgDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Lượt agent', o.turns],
          ['Token sinh ra', o.out],
        ],
      }),

    // Khối C — xu hướng tuần, sau cổng 3 tuần.
    'lookback.trendSection': 'Xu hướng tuần',
    'lookback.trendQ': 'So tuần với tuần — chỉ đáng tin khi có ít nhất 3 tuần sổ chu kỳ.',
    'lookback.trendWait': (o) =>
      `Khối này tự mở khi sổ chu kỳ mở muộn nhất đủ 3 tuần tuổi — khoảng ${o.opens} (sổ đó mở ${o.opened}). Trong lúc chờ, khối "Nhịp 14 ngày" ở trên đã nhìn lại được nửa tháng.`,
    'lookback.trendNoLedger': 'Chưa sổ chu kỳ nào mở — khối này chờ sổ đủ 3 tuần kể từ lượt quét đầu.',
    'lookback.trendThin': 'Sổ đã đủ 3 tuần nhưng chưa nguồn nào gom đủ 2 tuần có số — thêm vài ngày nữa là có cột.',
    'lookback.trendClaude': 'Claude — token viết ra mỗi tuần',
    'lookback.trendCursor': 'Cursor — tiền thật mỗi tuần',
    'lookback.trendAg': 'Antigravity — đỉnh quỹ Gemini mỗi tuần',
    'lookback.trendWeeks': (o) => `${o.n} tuần, tuần mở thứ hai`,
    'lookback.tipWeek': (o) =>
      tipOf({
        head: `Tuần ${o.week}`,
        rows: [['Tổng', o.v]],
      }),

    'lookback.note':
      'Giá gói đọc từ PLANS trong src/config.js — đổi gói thì sửa ở đó, tiền ba thẻ trên đổi theo. Sổ chu kỳ nằm ở ~/.now-dashboard, ghi từ 25–28/7/2026; ngày trước đó không có số — đã chốt không dựng lại dữ liệu quá khứ (backfill).',
    'report.howLookback': `**Cách đọc bộ số này:** mỗi công cụ đo trên chu kỳ CỦA CHÍNH NÓ (Claude: cửa sổ 7 ngày · Cursor: chu kỳ billing ~tháng · Antigravity: tuần của quỹ Gemini) — ba thẻ không so sánh trực tiếp với nhau được, chỉ dòng "quy cùng về tuần" là được cộng và nó nói rõ là quy đổi. Bỏ phí = phần đã trả tiền mà không dùng tới lúc reset; hạn mức không cộng dồn nên tiêu hết là mục tiêu, không phải báo động. Tiền Claude/AG là giá gói chia theo chu kỳ (giá nhập tay trong config); tiền Cursor là cents thật do Cursor tính. Chu kỳ ghi "theo dõi hụt" — tracker bỏ theo dõi một quãng — có đỉnh chỉ là mức sàn, số thật có thể cao hơn, nên không quy ra tiền; bảng đã ghi rõ từng chu kỳ như vậy.`,
  },

  en: {
    // ── App shell / index.html ──
    'app.title': 'NOW — command center',
    'skip': 'Skip to content',
    'brand.sub': 'command center',
    'foot.switch': 'switch view',
    'foot.find': 'find',
    'foot.copy': 'copy task',
    'foot.allkeys': 'all shortcuts',
    'butler.label': 'Things worth doing right now',
    'butler.slidePos': (o) => `${o.i}/${o.n}`,
    'butler.slidePrev': 'previous item',
    'butler.slideNext': 'next item',
    'butler.slideAria': (o) => `Item ${o.i} of ${o.n}`,

    // ── Menu bar popover (menubar.html) ──
    'mb.scan': (o) => `scanned ${o.ago}`,
    'mb.tabWork': 'Work',
    'mb.tabToken': 'Tokens',
    'mb.noSource': (o) => `no readable ledger for ${o.name}`,
    'mb.secQuota': 'Claude quota',
    'mb.awake': (o) => `${o.n} ${p(o.n, 'session', 'sessions')} awake`,
    'mb.open': 'Open dashboard',
    'mb.openUsage': 'Open the Tokens screen',
    'mb.noQuota': 'quota unreadable',
    'mb.offline': 'cannot reach the server',

    // ── Top bar ──
    'top.connecting': 'connecting…',
    'top.filterLabel': 'Filter within the current view',
    'top.filterPh': 'filter this view',
    'top.live': 'live',
    'top.lost': 'disconnected',
    'top.scanning': 'scanning',
    'top.connect': 'connect',
    'top.pulseTitle': 'Click to rescan (r)',
    'top.sub': (o) =>
      `updated ${o.time} · ${o.projects} ${p(o.projects, 'project', 'projects')} · ${o.sessions} ${p(o.sessions, 'session', 'sessions')}` +
      `${o.needsUpdate ? ` · ${o.needsUpdate} ${p(o.needsUpdate, 'board needs', 'boards need')} updating` : ''} · scan ${o.buildMs}ms`,

    // Light / dark
    'theme.light': 'light',
    'theme.dark': 'dark',
    'theme.toLight': 'Switch to light (t)',
    'theme.toDark': 'Switch to dark (t)',

    'menubar.label': 'menu bar',
    'menubar.toOff': 'The NOW icon is showing in the menu bar — click to turn it off for good, future logins included',
    'menubar.toOn': 'The NOW icon is off — click to bring it back now and at every login from here on',
    'menubar.busy': 'switching…',
    'menubar.err': (o) => `Could not switch: ${o.msg}`,

    // Language
    'lang.title': (o) => `Language: English — click to switch to ${o.next} (l)`,
    'skin.title': (o) => `Chart style — click to switch to ${o.next} (s)`,
    'skin.reroll': 'Reroll — draw a different set of shapes',
    'skin.plain': 'Plain',
    'skin.curve': 'Curve',
    'skin.block': 'Block',
    'skin.random': 'Random',

    // Disconnected
    'off.pre': 'Lost connection to server — showing a snapshot from',
    'off.post': ', no longer updating.',
    'off.retry': 'Retry',

    // First load — no data has EVER arrived, unlike "disconnected" where stale numbers
    // are still on screen. Say what is being scanned, so the empty seconds do not read
    // as a broken page.
    'boot.scanning': 'First scan running',
    'boot.scanningHint': 'Reading boards, Claude sessions and transcripts across every project. Usually 4–6 seconds.',
    'boot.scanningSub': 'first scan running…',
    'boot.wait': 'Waiting for numbers from the server',
    'boot.waitHint': 'The server has finished scanning but this tab has not received anything. Reload the page if this lasts more than a few seconds.',
    'boot.waitSub': 'waiting for numbers…',
    'boot.down': 'Cannot reach the server',
    'boot.downHint': 'The dashboard is not running. Open a terminal and run ./bin/now-dash — this page appears on its own once the server is up.',
    'boot.downSub': 'cannot reach the server',

    // Drawer + shortcuts (index.html)
    'drawer.prev': 'Previous project (←)',
    'drawer.prevAria': 'Previous project',
    'drawer.next': 'Next project (→)',
    'drawer.nextAria': 'Next project',
    'drawer.close': 'Close (esc)',
    'drawer.closeAria': 'Close detail panel',
    'help.title': 'Shortcuts',
    'help.close': 'Close shortcuts panel',
    'help.switch': 'switch view',
    'help.copy': "copy the butler's suggested task",
    'help.open': 'open the first project board',
    'help.find': 'find within the current view',
    'help.refresh': 'rescan now',
    'help.theme': 'toggle light / dark',
    'help.lang': 'switch language',
    'help.skin': 'change chart style',
    'help.step': 'flip projects while the detail panel is open',
    'help.esc': 'close panel · clear the filter',
    'help.self': 'this panel',

    // ── Navigation + view titles ──
    'nav.overview': 'Projects',
    'nav.sessions': 'Sessions',
    'nav.decisions': 'Decisions',
    'nav.timeline': 'Done',
    'nav.stats': 'Stats',
    'nav.usage': 'Tokens',
    'nav.health': 'Health',
    'title.overview': 'Projects',
    'title.sessions': 'Running sessions',
    'title.decisions': 'Waiting on your call',
    'title.timeline': 'Completed work',
    'title.stats': 'Stats',
    'title.usage': 'Tokens and limits across three tools',
    'title.health': 'Board health',
    'nav.pipAria': (o) => `${o.n} items needing attention`,
    'viewname.decisions': 'decisions',
    'viewname.health': 'health',
    'viewname.sessions': 'sessions',
    'viewname.timeline': 'completed work',
    'viewname.usage': 'tokens',

    // ── NOW.md ──
    'md.loading': 'reading…',
    'md.error': (o) => `Couldn't read NOW.md — ${o.msg}`,
    'common.retry': 'retry',
    'common.copyAria': (o) => `Copy “${o.text}”`,

    // ── Butler ──
    'butler.greet.late': 'Late night',
    'butler.greet.morning': 'Good morning',
    'butler.greet.noon': 'Good afternoon',
    'butler.greet.afternoon': 'Good afternoon',
    'butler.greet.evening': 'Good evening',
    // No greeting inside these sentences any more — the slot cycles through up to three
    // of them, and a greeting belongs to arriving, not to "2 decisions need you".
    // `butler.js` prepends it to the first slide only.
    'butler.hot': (o) => {
      const treo = o.ageDays > 0 ? ` pending ${o.ageDays}d and` : '';
      return o.n === 1
        ? `1 decision needs you — ${o.id}${treo} blocking ${o.project}.`
        : `${o.n} decisions need you — the most urgent is ${o.id}${treo} blocking ${o.project}.`;
    },
    'butler.sayAtProject': 'say this to Claude in that project',
    'butler.stale': (o) =>
      o.n === 1
        ? `The ${o.names} board is stale — don't trust it before updating.`
        : `${o.n} boards are stale (${o.names}) — don't trust them before updating.`,
    'butler.staleWhy': (o) => `Updated ${o.ageDays}d ago, ${o.drift} commits since the mark.`,
    'butler.runAt': (o) => `run in ${o.name}`,
    'butler.tmp': (o) => `Worktree ${o.wname} of ${o.name} is inside /tmp — a reboot wipes it.`,
    'butler.tmpWhy': (o) => `Branch ${o.branch}${o.dirty ? `, ${o.dirty} files uncommitted` : ''}.`,
    'butler.moveSafe': 'move it somewhere safe',
    // `soon` says "coming due", `hot` says "blocking" — the verbs have to differ, because
    // on some days both sentences sit in the slot and two decision counts opening the
    // same way read as a contradiction.
    'butler.soon': (o) => {
      const age = o.ageDays > 0 ? ` waiting ${o.ageDays}d` : '';
      return o.n === 1
        ? `1 decision is coming due — ${o.id}${age} in ${o.project}.`
        : `${o.n} decisions are coming due — the oldest is ${o.id}${age} in ${o.project}.`;
    },
    // Two voices for the same waiting item. The nudge threshold (7 days) now picks between
    // them instead of deciding whether the item reaches the page at all.
    'butler.nudge': (o) => `${o.who} has held “${o.what}” for ${o.ageDays}d — time to nudge.`,
    'butler.waiting': (o) => `${o.who} has been holding “${o.what}” for ${o.ageDays}d.`,
    'butler.nudgeWhy': (o) => `In project ${o.project}.`,
    'butler.waitCopy': 'copy in full',
    'butler.waitCopyHint': 'the full text — the line above was clipped to fit',
    'butler.lead': (o) => {
      const head = o.late
        ? `${o.awake ? `${o.awake} sessions still open, I'm watching.` : 'No sessions still running.'}`
        : 'Nothing is blocking you.';
      return `${head} Next up in ${o.name}.`;
    },
    'butler.leadAction': 'keep going',
    'butler.openClaudeAt': (o) => `open Claude in ${o.name}`,
    'butler.noboard': 'No project has a NOW board yet.',
    'butler.noboardWhy': "Open Claude in a project and run /now update — I'll track it from there.",
    'butler.runAnywhere': 'run in any project',
    'butler.seeAll': (o) => `see all ${o.name} →`,
    'butler.sayToClaude': 'say this to Claude',
    // Slot captions. Almost names rather than phrases — they sit above every sentence and
    // must stop reading as sentences themselves.
    'butler.slot.work': 'Worth doing',
    'butler.slot.burn': 'Token budget',

    // ── Slot two: the limit ──
    //
    // Every line here opens with the WINDOW NAME, never a greeting: the greeting lives in
    // slot one, and greeting twice in one block reads as a second block wandering in.
    //
    // The two waste lines carry all three figures (spent, projected, reset mark) because
    // those are what decide whether it can still be saved. The two good-news lines are far
    // shorter — belabouring good news is the fastest way to teach someone to skip the slot.
    // The subject is the horizon, built by `burnSubject` — see `lib/butler.js`.
    'butler.burnOfModel': (o) => `${o.period} for ${o.model}`,
    'butler.burnCold': (o) => `${o.subject} will waste ${o.waste} — only ${o.used} spent, projecting to just ${o.projected}.`,
    'butler.burnSlack': (o) => `${o.subject} still wastes ${o.waste} — ${o.used} spent, projecting to ${o.projected}.`,
    'butler.burnOnTarget': (o) => `${o.subject} is on pace — ${o.used} spent, projecting to ${o.projected}. Keep it up.`,
    'butler.burnFull': (o) => `${o.subject} will spend every bit — ${o.used} spent, projecting to ${o.projected}.`,
    // Here the run-out mark leads, unlike the clipped card line: the butler speaks so you
    // can still act, and "how long until then" is what decides what you can still do.
    'butler.burnIdle': (o) => `${o.subject} runs out in ${o.in} — then ${o.stuck} idle until reset, ${o.used} spent.`,
    'butler.burnBlind': (o) => `${o.subject} is at ${o.used} — too early to read a pace.`,
    'butler.burnNone': 'No Claude limit readable yet.',
    'butler.burnNoneWhy': 'Open the Token view to see which link broke — an expired session, or an endpoint not answering.',
    // Only the burn rate and the reset mark — the two things the lead sentence does not
    // carry. The previous copy repeated its whole projection clause: two adjacent lines
    // copying each other means the second one never gets read.
    'butler.quotaWhy': (o) => `Burning ${o.pace}, resets in ${o.reset}.`,
    'butler.quotaSwap': 'a cheaper model burns slower — the window stretches',
    'butler.burnSpendMore': 'a stronger model spends more per turn — less waste',
    'butler.burnNoLever': 'Already on the priciest model, no rung left to climb — spending it all now means handing over more work, or opening a second session alongside.',
    // Cursor/Antigravity notice: `line` is the full forecast sentence from `forecastText`
    // ("this week projects to X — Y wasted" / "runs out in X, then Y idle"), so this key only
    // prefixes the source name and spend level — it does not retell the story in new words.
    // Neutral "at", not "only at": the same key serves BOTH verdicts, and "only" leans
    // toward the waste case — the about-to-block case would read backwards. Joined with
    // a COMMA because `line` already carries a dash — two dashes in one sentence is two cuts.
    'butler.toolLine': (o) => `${o.name} at ${o.used}, ${o.line}.`,

    // ── shared: heat / health ──
    'heat.now': 'Decide now',
    'heat.soon': 'Blocking soon',
    'heat.later': 'Not urgent',
    'hstatus.fresh': 'fresh',
    'hstatus.drifting': 'drifting',
    'hstatus.stale': 'needs update',
    'hstatus.broken': 'broken file',
    'hstatus.unknown': 'unmeasured',

    // ── game: project state / session class ──
    'pstate.blocked': 'Blocked',
    'pstate.stale': 'Needs update',
    'pstate.pending': 'Decisions pending',
    'pstate.ok': 'OK',
    'unit.editor': 'Editor',
    'unit.desktop': 'Desktop',
    'unit.other': 'other',

    // ── Time formatting ──
    'fmt.justnow': 'just now',
    'fmt.min': (o) => `${o.n} min`,
    'fmt.hour': (o) => `${o.n} hr`,
    'fmt.day': (o) => `${o.n}d`,
    'fmt.month': (o) => `${o.n}mo`,
    'fmt.today': 'Today',
    'fmt.yesterday': 'Yesterday',
    'fmt.daysAgo': (o) => `${o.n}d ago`,

    // ── Projects view (overview) ──
    'overview.streakTitle': 'consecutive days with at least one task done',
    'overview.streakDays': 'day streak',
    'overview.done7': 'done / 7 days',
    'overview.awakeSessions': 'sessions awake',
    'overview.hotBlocking': 'decisions blocking work',
    'overview.freshBoards': 'boards still fresh',
    'repo.nestedIn': (o) => `Repo root is ${o.nestedIn} — git numbers here would be the parent's, so they're hidden`,
    'repo.nestedShort': 'inside another repo',
    'repo.notRepo': 'not a git repo yet',
    'repo.unknownCommitTitle': "The board's mark commit is no longer in history",
    'repo.unknownCommit': 'board mark lost',
    'repo.driftTitle': 'commits since the board mark',
    'repo.dirtyTitle': (o) => `${o.n} files uncommitted`,
    'repo.aheadTitle': 'not pushed',
    'repo.behindTitle': 'not pulled',
    'repo.worktreeTitle': 'extra worktrees',
    'quest.hot': 'Decision blocking work',
    'quest.decisions': 'Other decisions waiting on you',
    'quest.waiting': 'Waiting on others',
    'quest.queue': 'Queue',
    'quest.inferred': 'inferred',
    'quest.inferredTitle': 'Claude worked out the current task from the latest session — the board does not declare it',
    'quest.doing': 'Doing',
    'quest.noFocus': 'Board has no Doing entry',
    'quest.clean': 'all clear',
    'quest.partyTitle': 'sessions awake / total',
    'quest.hpTitle': (o) => `Board freshness — ${o.hp}% · ${o.label}`,
    'quest.copyResume': '⧉ copy resume line',
    'quest.copyResumeAria': (o) => `Copy the resume line for ${o.name}: ${o.resume}`,
    'quest.noResumeTitle': 'Board has no resume note',
    'quest.noResumeAria': (o) => `${o.name}'s board has no resume note — copy /now update`,
    'quest.openDir': '↗ open folder',
    'quest.openDirAria': (o) => `Open folder ${o.name}`,
    'quest.openBoard': 'view full board →',
    'quest.openBoardAria': (o) => `View the full board for ${o.name}`,
    'overview.noMatch': 'No projects match',
    'overview.noMatchHint': (o) => `Clear the filter “${o.q}” to see them all again.`,
    'overview.noBoard': 'No project has a NOW board yet',
    'overview.noBoardHint': (o) => `Scanned ${o.roots}. Open Claude in a project and run /now update — I'll track it from there.`,
    'overview.orphans': (o) => `${o.n} active repos with no NOW board yet`,
    'overview.orphansPre': 'Open Claude there and run',
    'overview.orphansPost': '— with no board the project is invisible on every view.',

    // Overview drawer
    'drawer.freshness': 'Board freshness',
    'drawer.updatedToday': 'updated today',
    'drawer.updatedAgo': (o) => `updated ${o.n}d ago`,
    'drawer.driftBadge': (o) => `Δ${o.n} commits since mark`,
    'drawer.openDir': 'Open folder',
    'drawer.parseError': "NOW.json couldn't be read",
    'drawer.schemaError': 'Schema error',
    'drawer.doing': '◎ Doing',
    'focus.none': 'Board has no Doing entry.',
    'focus.context': 'Context',
    'focus.now': 'Do now',
    'focus.later': 'Remaining',
    'focus.blockedBy': 'Blocked by',
    'focus.repoState': 'Repo state',
    'focus.continue': 'Continue with Claude',
    'focus.refs': 'References',
    'drawer.sideTracks': 'Side tracks · held by other sessions',
    'drawer.decisions': 'Waiting on your call',
    'drawer.dHeat': 'Heat',
    'drawer.dWhat': 'Decide what',
    'drawer.dClose': 'Close by',
    'drawer.locks': (o) => `blocks: ${o.blocks}`,
    'drawer.waiting': 'Waiting on others',
    'drawer.since': (o) => `since ${o.since}`,
    'drawer.queue': 'Queue',
    'drawer.worktrees': 'Extra worktrees',
    'wt.inTmp': 'Inside /tmp — lost on reboot. ',
    'wt.dirty': (o) => `${o.n} files uncommitted. `,
    'wt.clean': 'Clean.',
    'wt.detached': 'detached',
    'drawer.sessions': (o) => `Sessions tied to this project · ${o.n}`,
    'drawer.asleep': (o) => `asleep ${o.ago}`,
    'drawer.recentlyDone': 'Just done',
    'drawer.mdFull': 'NOW.md — full render',
    'drawer.mdRead': 'Read NOW.md here',
    'drawer.commands': 'Commands',
    'drawer.openClaudeHere': 'open Claude here',
    'drawer.updateBoard': 'update board',

    // ── Sessions view ──
    'sessions.next': (o) => `next: ${o.subject}`,
    'sessions.asleep': (o) => `asleep ${o.ago}`,
    'sessions.awakeState': (o) => `● awake · ${o.ago}`,
    'sessions.opened': (o) => `opened ${o.time}`,
    'sessions.tasks': (o) => `${o.done}/${o.total} tasks`,
    'sessions.statAwake': 'Awake',
    'sessions.statProjects': 'Projects',
    'sessions.statHasTodos': 'With todos',
    'sessions.statGhost': 'Dead session files',
    'sessions.noMatch': 'No sessions match',
    'sessions.empty': 'No Claude session is alive',
    'sessions.unassigned': 'Outside boarded projects',
    'sessions.awakeCount': (o) => `${o.awake} awake / ${o.total}`,
    'sessions.moreAsleep': (o) => `${o.n} more asleep`,
    'sessions.foot': 'Cursor/VS Code panels find sessions by <b>name</b>, while the terminal needs the full 36-char UUID — the <b>resume</b> button pre-copies',
    'sessions.footEnd': 'for you.',
    'sessions.archivePrompt': (o) => `Archive Claude Code session ${o.id}`,
    'sessions.footArchive':
      'The <b>archive</b> button copies a line to <b>paste into Claude</b> (not a terminal); Claude asks for confirmation before shutting the session down. Sessions opened from VS Code or a terminal have no button — they are absent from the app’s own registry.',

    // ── Decisions view ──
    'decisions.blocksFocus': '◆ blocks current work',
    'decisions.pending': (o) => `⧗ pending ${o.n}d`,
    'decisions.noId': 'no id yet',
    'decisions.noMatch': 'Nothing matches',
    'decisions.empty': 'No decisions waiting on you',
    'decisions.emptyHint': "Everything is in someone else's hands or in the queue.",
    'decisions.section': (o) => `${o.icon} ${o.label} · ${o.n}`,
    'decisions.hUrg': 'Urgency',
    'decisions.hProject': 'Project',
    'decisions.hWhat': 'Decide what',
    'decisions.hLocks': 'Blocking',
    'decisions.hClose': 'Close by saying',
    'decisions.waiting': "Waiting on others · not your job",
    'decisions.wProject': 'Project',
    'decisions.wWho': 'Who',
    'decisions.wWhat': 'Waiting for',
    'decisions.wSince': 'Since',
    'decisions.nudge': (o) => `⚠ over ${o.n}d — time to nudge`,
    'decisions.footPre': 'Urgency = heat + days pending, plus a bump if it blocks the current task. Close it by opening Claude in that project and saying',
    'decisions.footMid': '— the item leaves the board after the next',
    'decisions.footEnd': '.',

    // ── Timeline view ──
    'timeline.noMatch': 'No tasks match',
    'timeline.empty': 'Nothing has been recorded as done yet',
    'timeline.streak': 'Day streak',
    'timeline.done7': 'Done in 7 days',
    'timeline.best': 'Best day',
    'timeline.total': 'Total recorded',
    'timeline.tasks': (o) => `${o.n} tasks`,
    'unit.daysShort': 'days',

    // ── Health view ──
    'health.parseError': (o) => `${o.name} — NOW.json couldn't be read`,
    'health.schemaError': (o) => `${o.name} — schema error`,
    'health.nested': (o) => `${o.name} — board sits inside another repo`,
    'health.nestedDesc': (o) =>
      `Repo root is ${o.nestedIn}, not the board folder. Every git number (branch, dirty files, drift) would be the parent's, not this project's, so I leave them blank instead of showing wrong ones.`,
    'health.splitRepo': 'split into its own repo',
    'health.unknownCommit': (o) => `${o.name} — board mark no longer in git history`,
    'health.unknownCommitDesc': (o) =>
      `The board records commit ${o.commit} but it's gone (rebase/amend). Drift can't be measured, so the board may be stale while still looking fresh.`,
    'health.stale': (o) => `${o.name} — board needs updating`,
    'health.staleDesc': (o) =>
      `Updated ${o.ageDays}d ago, ${o.drift} commits since the mark. Reading this board on return can send you the wrong way.`,
    'health.drifting': (o) => `${o.name} — board is starting to drift`,
    'health.driftingDesc': (o) =>
      `${o.ageDays}d · ${o.drift} commits since the mark. Not urgent, but update it before leaving the project.`,
    'health.noMd': (o) => `${o.name} — no NOW.md yet`,
    'health.noMdDesc': 'Has NOW.json but no rendered version to read by eye.',
    'health.wtInTmp': 'inside /tmp so it will be lost on reboot',
    'health.wtDirty': (o) => `${o.n} files still uncommitted`,
    'health.wtPrunable': 'the folder no longer exists',
    'health.wt': (o) => `${o.name} — worktree ${o.wname}`,
    'health.wtDesc': (o) => `Branch ${o.branch}, ${o.why}.`,
    'health.wtMove': 'worktree move',
    'health.wtPrune': 'prune',
    'health.statChores': 'To tidy',
    'health.statFresh': 'Fresh boards',
    'health.statOrphans': 'No board yet',
    'health.statScan': 'Scan',
    'health.clean': 'Nothing to tidy',
    'health.cleanHint': 'Boards fresh, worktrees clean, no repo forgotten.',
    'health.orphans': (o) => `${o.n} active repos with no NOW board`,
    'health.orphanTitle': (o) => `Last commit on branch ${o.branch} — copy the command to open Claude here`,
    'health.orphanAria': (o) => `Copy the command to open Claude in ${o.name} — last commit ${o.ago} ago, branch ${o.branch}`,
    'health.orphansPre': 'With no board these projects are invisible on every other view. Click to copy the open-Claude command, then run',
    'health.boardTable': 'Board table',
    'health.tProject': 'Project',
    'health.tFresh': 'Freshness',
    'health.tBranch': 'Branch',
    'health.tAge': 'Age',
    'health.tDrift': 'Drift',
    'health.tDirty': 'Dirty',
    'health.tSessions': 'Sessions',
    'health.today': 'today',
    'health.ageShort': (o) => `${o.n}d`,
    'health.thresholds': 'Thresholds in use',
    'health.thState': 'State',
    'health.thCond': 'Condition',
    'health.thMean': 'Means',
    'health.thFreshCond': (o) => `< ${o.days} days and < ${o.commits} commits`,
    'health.thFreshMean': 'Reading the board gets you back to work right away.',
    'health.thDriftCond': (o) => `≥ ${o.days} days or ≥ ${o.commits} commits`,
    'health.thDriftMean': 'Still usable, but missing a few recent developments.',
    'health.thStaleCond': (o) => `≥ ${o.days} days or ≥ ${o.commits} commits`,
    'health.thStaleMean': "Don't trust it — run /now update before reading.",
    'health.footPre': 'I only <b>read</b> — I never write to NOW.json myself. The source of truth is still',
    'health.footEnd': 'run inside the project itself.',
    'health.integrate': 'Bring NOW into a project',
    'health.integrateDesc':
      'Paste this prompt into the chat of whatever agent is working in the repo (Cursor, Antigravity, or any other agent) — it creates NOW.json + NOW.md to schema, and the dashboard picks the board up on the next sweep. Inside Claude Code you don’t need it: just say /now update.',
    'health.integrateCopy': 'copy the setup prompt',
    'health.integrateCopyAria': 'Copy the NOW board setup prompt to paste into an agent chat',
    'health.integrateShow': 'read the prompt',
    'health.nowPrompt': `Set up a NOW board in this repo so the NOW dashboard can track it:

1. Read the schema (JSON Schema draft-07, schemaVersion: 1). Find it with: ls ~/.claude/plugins/cache/*/now-board/*/skills/now/now.schema.json ~/.claude/skills/now/now.schema.json — if several match, take the highest version. If nothing matches, stop and ask me — do not invent a schema.
2. Create NOW.json at the repo root, valid against the schema. Derive content from git log, git status and the repo's docs: focus (title, context, nextAction under 30 minutes, laterSteps, resume.workingState, resume.howToContinue, confidence), decisionsNeeded (id, title, heat: now/soon/later, question, blocks, since), waitingOn, upNext, recentlyDone. Mark anything you had to infer with confidence "inferred"; when unsure, ask me — never make things up.
3. Render NOW.md from NOW.json — the human-readable view, same content, updated in the same pass.
4. Add NOW.json and NOW.md to .gitignore — per-machine local state, never committed.
5. From now on, at the end of each work thread or whenever I say "/now update": update NOW.json, then re-render NOW.md.`,

    // ── Stats view ──
    'stats.empty': 'No data to chart yet',
    'stats.emptyHint': 'Run /now update in a project — every number here comes from the NOW board.',
    'stats.qNote': (o) =>
      `The filter “${o.q}” doesn't apply on the Stats view — filtering part of it changes what every ratio means. Search on the Projects, Sessions or Decisions view.`,
    'stats.kStreak': 'Day streak',
    'stats.kRecorded': 'Tasks recorded',
    'stats.kDecisions': 'Decisions waiting',
    'stats.kHot': (o) => `·${o.n} hot`,
    'stats.kQueue': 'Queue',
    'stats.kAwake': 'Sessions awake',
    'stats.doneSection': 'Completed work · what the board still remembers',
    'stats.doneByDay': 'Done per day',
    'stats.doneByDaySubPartial': (o) =>
      `${o.days} ${p(o.days, 'day', 'days')} · ${o.partial} ${p(o.partial, 'day', 'days')} undercounted (faded bars) because boards forgot some`,
    'stats.doneByDaySubFull': (o) => `${o.days} ${p(o.days, 'day', 'days')} · all ${o.total} boards`,
    'stats.doneByDayCut': (o) =>
      ` · dropped ${o.dropped} ${p(o.dropped, 'day', 'days')} outside the ${o.max}-day window (${o.items} ${p(o.items, 'task', 'tasks')}) — dates that far off are usually a wrong year in NOW.json`,
    'stats.doneByProject': 'Done per project',
    'stats.doneByProjectSub': "counted on the board's remaining window, not the full history",
    'stats.decisionsChart': 'Decisions waiting on you, per project',
    'stats.decisionsChartSub': "current snapshot — fully counted, independent of the board's storage cap",
    'stats.queueChart': 'Queue per project',
    'stats.queueChartSub': (o) => `${o.n} ${p(o.n, 'item', 'items')} queued — current snapshot`,
    'stats.hoursChart': 'Session start hours',
    'stats.hoursChartSub': (o) =>
      `${o.n} live ${p(o.n, 'session', 'sessions')} — dead session files are cleaned up so this is the present, not history`,
    'stats.backlogSection': 'Backlog · current snapshot',
    'stats.rhythmSection': 'Session rhythm',
    'stats.tipDoneDay': (o) =>
      tipOf({
        head: o.iso,
        rows: [
          ['Tasks recorded', o.v],
          ['Boards reaching back', `${o.covered}/${o.total}`],
        ],
        note: o.partial ? 'Only that many boards reach back this far, so the real figure is higher.' : '',
      }),
    'stats.tipDoneProject': (o) => tipOf({ head: o.label, rows: [['Tasks recorded', o.v]] }),
    'stats.tipDecision': (o) => tipOf({ head: o.label, rows: [[o.heat, o.v]] }),
    'stats.tipQueue': (o) => tipOf({ head: o.label, rows: [['In the queue', o.v]] }),
    'stats.tipHour': (o) => tipOf({ head: `${o.h}:00–${o.h}:59`, rows: [['Sessions', o.v]] }),
    'stats.total': 'Total',
    'stats.cDate': 'Date',
    'stats.cRecorded': 'Tasks recorded',
    'stats.cCovered': 'Boards covering',
    'stats.cProject': 'Project',
    'stats.cPending': 'Pending',
    'stats.cHour': 'Hour',
    'stats.cSessions': 'Sessions',
    'stats.note': (o) =>
      `<b>Read these numbers right:</b> a NOW board only keeps the few most recent <code>recentlyDone</code> items per project. Once a project hits the cap, older tasks vanish from the board — so the further back you go the "fewer tasks" it looks, and that's the storage cap, not your work rhythm. Faded bars are days being undercounted. This is a <b>floor</b> on the work done, not the total.`,

    // ── Work surfaces (Claude Desktop · Cursor · Antigravity · Terminal) ──
    'surface.someEditor': 'Editor not identified',
    'surface.cli': 'Command line',
    'surface.other': 'Other',
    'surface.running': 'running',
    'surface.sessions': (o) => `${o.n} session${o.n === 1 ? '' : 's'}`,
    'surface.convos': (o) => `${o.n} conversation${o.n === 1 ? '' : 's'}`,
    'surface.folders': (o) => `${o.n} folder${o.n === 1 ? '' : 's'} open`,
    'surface.foldersActive': (o) => `${o.n} folder${o.n === 1 ? '' : 's'} with work running`,
    'surface.idle': 'open, nothing running',
    'surface.off': 'not running',
    'surface.note':
      "Antigravity does not run Claude Code — it has its own agent, so its conversations are not part of the token figures on the Tokens view. Cursor and VS Code are: Claude Code sessions running inside them do count against your limit.",
    'convo.untitled': 'Untitled conversation',
    'convo.steps': (o) => `${o.n} step${o.n === 1 ? '' : 's'}`,
    'convo.openIn': 'open in Antigravity',
    'quest.openInTitle': (o) => `Open this folder in ${o.name}`,
    'quest.openInAria': (o) => `Open ${o.project} in ${o.name}`,
    'sessions.statConvos': 'Antigravity',
    'quest.surfaceTitle': (o) => `Open in ${o.names}`,
    'quest.convoTitle': (o) => `${o.n} Antigravity conversation${o.n === 1 ? '' : 's'} in this folder`,

    // ── Subscription limits ──
    'quota.title': 'Claude · limit spent',
    'quota.titleTail': 'limit spent',

    // ── Plan tier ──
    'plan.perMonth': (o) => `${o.money}/month`,
    'plan.tip.claude': (o) =>
      `Read from ~/.claude.json, which Claude Code refreshes itself — last ${o.when} ago. Every percentage in this panel is a percentage OF this plan.`,
    'plan.tip.cursor': (o) =>
      `Cursor sends no plan name in any field. The dashboard works it back out of the ${o.money}/month included in the plan — if Cursor changes its pricing, this goes wrong with nothing to warn you.`,
    'plan.tip.ag': (o) => `Antigravity declares this plan itself${o.raw ? ` (${o.raw})` : ''}.`,

    'quota.fiveHour': '5-hour window',
    'quota.sevenDay': '7-day window',
    'quota.scoped': (o) => `7 days · ${o.model}`,
    'quota.at': (o) => `read at ${o.time} · ${o.age} ago`,
    'quota.atFresh': (o) => `read at ${o.time} · just now`,
    'quota.resetIn': (o) => `resets in ${o.d}`,
    'quota.resetPassed': 'window already rolled',
    'quota.conservative': "This is the most recent snapshot — it couldn't be refreshed. While you're away the quota doesn't grow but the window keeps sliding, so the real percentage can only be lower — never higher.",
    'quota.allExpired': 'Every window is past its reset mark, so the figures above belong to the previous cycle.',
    'quota.missing': 'No limit data yet. This number is not stored on disk — the dashboard reads it with the OAuth token in your Keychain, so Claude Code has to be signed in at least once.',
    'quota.warming': 'The endpoint answered but no window carries a figure yet.',
    'quota.broken': "Couldn't parse the limit response — this internal endpoint is undocumented and its shape may have changed.",
    'quota.noAuth': "Couldn't read the OAuth token from the Keychain — usually macOS access was denied, or Claude Code is signed out.",
    'quota.tokenExpired': 'The OAuth token has expired. Running Claude Code once refreshes it and writes it back to the Keychain.',
    'quota.httpFail': 'The limit endpoint returned an error.',
    'quota.offline': "Couldn't reach the limit endpoint — network failure or timeout.",
    'quota.stripTitle': 'Limit spent',
    'quota.usedUnit': 'spent',
    'quota.fiveHourShort': '5 hours',
    'quota.sevenDayShort': '7 days',
    'quota.forecastHelp': 'How to read the bar',

    // ── Bar legend ──
    'qlg.goal': '<b>The target is spending it all.</b> Limits do not roll over — whatever is unspent at reset is gone.',
    'qlg.sample': 'Sample bar',
    'qlg.hatchName': 'This pace still adds',
    'qlg.solid': 'Actually spent. A measured figure.',
    'qlg.hatch': 'The only part the dashboard guesses — hence the hatching. The label is where the pace stops, or <b>runs out in …</b> if it asks for more than the cap.',
    'qlg.waste': 'This pace will not reach it. Gone at reset.',
    'qlg.mark': 'Where you would stand spending evenly against the clock.',
    'qlg.toneTitle': 'Colour is how much is WASTED, not how full:',
    'qlg.toneCrit': 'over half wasted',
    'qlg.toneWarn': 'still wasting some',
    'qlg.toneOk': 'right on target',
    'qlg.toneCheer': 'spends every bit',
    'qlg.caveat':
      'The projection extrapolates the rate so far — "if it stays like now", not a prophecy. <b>Red</b> means one thing only: over half the limit will be gone unspent at reset. Running dry before reset is never red — that is the target.',
    'qlg.money':
      'The <b>≈$248</b> beside the percentage is the cost of <b>this window alone</b>: the tokens inside it times the API price list. Not a bill — this account pays by subscription, so read it as "how much is the plan giving back". The percentage is counted by the server for <b>the whole account</b>, while the dollars are read from <b>this machine\'s</b> transcripts, so Claude Code running elsewhere shows up in the percentage and not in the dollars. A <b>≥</b> instead of <b>≈</b> means the window opened before the earliest call still on disk — transcripts were pruned, so the total is certainly short.',

    // ── Limit forecast ──
    'qf.perHour': (o) => `${o.v}/hour`,
    'qf.perDay': (o) => `${o.v}/day`,
    'qf.now': 'right now',
    // The `over` band: the exhaust mark leads. The previous copy pushed the idle clause
    // first because the line was red and the words had to match the colour. The line now
    // carries the `cheer` tone — running dry before reset is the target — so the sentence
    // opens on that, and the price (how long you idle) trails as the concession it is.
    'qf.over': (o) => `spends every bit — runs out in ${o.in}`,
    'qf.overIdle': (o) => `runs out in ${o.in}, then ${o.stuck} idle before reset`,
    'qf.idleTail': (o) => `${o.stuck} idle before reset`,
    'qf.outNow': (o) => `already out — ${o.stuck} still to go before reset`,
    'qf.hitsIn': (o) => `runs out in ${o.in}`,
    'qf.overCap': (o) => `${o.p} (over cap)`,
    'qf.landsFull': 'spends it all, running out right at reset',
    // The projection sentence leads with the HORIZON, not with "this pace". "This pace
    // only reaches 52%" is missing the one thing that makes the number usable — 52% *by
    // when*. The label beside it says "5 hours", but that names the window, not a mark,
    // so the joining is still left to the reader. `periodText` derives it from `windowMs`.
    'qf.landsNear': (o) => `${o.period} projects to ${o.p} — effectively all of it`,
    'qf.slack': (o) => `${o.period} projects to ${o.p} — ${o.w} wasted`,
    // Short form for the prose lines that carry no bar (`proseText`): the projection
    // number goes, the waste stays. Next to a bar those two clauses point at two
    // different places on it; alone in a sentence they are one fact stated twice.
    'qf.slackShort': (o) => `${o.period} projects to ${o.w} wasted`,
    'qf.pdShort': (o) => `this ${o.h}h session`,
    'qf.pdWeek': 'this week',
    'qf.pdMonth': 'this month',
    'qf.pdWindow': 'this window',
    // Clipped because it always follows "even pace 47%" — repeating the subject reads twice.
    'qf.onPace': 'right on it',
    'qf.behind': (o) => `${o.gap} behind`,
    'qf.ahead': (o) => `${o.gap} ahead`,
    'qf.avgMark': (o) => `even pace ${o.p}`,
    'qf.early': 'window just opened — too early to read a pace',
    'qf.rolled': 'window has rolled into a new cycle',
    'qf.unknown': 'no reset mark, so no pace to read',
    'qf.wasteSeg': (o) => `${o.w} wasted`,
    'qf.rowAvg': 'Even pace',
    'qf.rowIdle': 'Idle',
    'quota.cUsed': 'Spent',
    'quota.cWaste': 'Wasted',
    'quota.cPace': 'Pace',
    'quota.cProjected': 'Projected',
    'quota.cSpent': 'Estimated cost',
    'quota.cSpentOut': 'Output tokens',
    'quota.cReset': 'Resets at',

    // ── Usage view ──
    'usage.kToday': 'Claude wrote today',
    'usage.k7d': 'Claude wrote in 7d',
    'usage.kCacheHit': 'Served from cache',
    'usage.kCost7d': '7-day estimate',
    'usage.kRequests': 'Calls today',
    'usage.outShort': ' tok',

    'usage.tabClaude': 'Claude Code',
    'usage.tabCursor': 'Cursor',
    'usage.tabAg': 'Antigravity',
    'usage.dataAt': (o) => `Data updated at ${o.time} · ${o.age} ago.`,
    'usage.dataAtFresh': (o) => `Data updated at ${o.time} · just now.`,
    'usage.tabsAria': 'Pick a tool to see its detail',
    'usage.flowSection': 'What each day costs',
    'usage.effSection': 'Pricier, or just more work',
    'usage.cycleSection': 'Past quota cycles',
    'usage.splitSection': 'Where it goes',
    'usage.blameSection': 'What eats the tokens',

    'usage.costByDay': 'Estimated cost per day',
    'usage.costByDaySub': (o) => `Estimated cost per day, last ${o.days} days — ${o.total} total. All four token kinds priced at their own rate.`,
    'usage.tipCostDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Estimated', o.cost],
          ['Calls', o.msgs],
        ],
      }),
    'usage.outByDay': 'How much Claude wrote each day',
    'usage.outByDaySub': (o) => `${o.total} in total. This is what Claude actually wrote for you — it excludes everything it had to re-read.`,
    'usage.tipOutDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Claude wrote', o.out],
          ['Total tokens moved', o.total],
        ],
      }),

    // ── Efficiency block ──
    'usage.unitByDay': 'Cost per 1M tokens Claude writes',
    // No median value here — `refLine` already prints it on the line itself, where it also
    // shows where it sits relative to each column. Same rule as the quota cards.
    'usage.unitByDaySub': 'For the same amount of tokens written, which days cost more. A bar above the line ran dearer than your own normal.',
    'usage.unitByDaySubThin': (o) =>
      `For the same amount of tokens written, which days cost more. A bar above the line ran dearer than your own normal. Left out ${o.thin} ${p(o.thin, 'day', 'days')} with too little use (under 10 calls or ${o.min} written) — a ratio built on a couple of calls is just noise.`,
    'usage.refMedian': 'your normal',
    'usage.tipUnitDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Per 1M generated', o.unit],
          ['Estimated', o.cost],
          ['Claude wrote', o.out],
        ],
      }),

    'usage.ctxByTurn': 'The longer the chat, the more each turn re-reads',
    'usage.ctxByTurnSub': (o) =>
      `median per turn · ${o.sessions} sessions of ${o.min}+ turns. Per 1M generated goes ${o.a}→${o.b}: the tail costs ${o.x}× the opening`,
    'usage.ctxByTurnPlain': (o) => `Every turn, Claude re-reads the whole session from the top — bars show how much it re-reads at each turn number. (${o.sessions} sessions of ${o.min}+ turns.)`,
    'usage.tipTurnBand': (o) =>
      tipOf({
        head: `Turns ${o.band}`,
        rows: [
          ['Context (median)', o.ctx],
          ['Per 1M generated', o.unit],
          ['Estimated', o.cost],
          ['Calls', o.msgs],
        ],
      }),

    'usage.bySession': 'Cost per session',
    'usage.bySessionSub': (o) => `One bar per session, newest on the right. Most sessions cost around ${o.mid}, but the 10 dearest already take ${o.share} of the total. (${o.shown} most recent of ${o.n}.)`,
    'usage.tipSession': (o) =>
      tipOf({
        head: `${o.project} · ${o.at}`,
        rows: [
          ['Estimated', o.cost],
          ['Calls', o.msgs],
          ['Claude wrote', o.out],
          ['Re-read / written', o.ratio],
          ['Ran for', o.dur],
        ],
      }),

    'usage.ratioDist': 'Sessions that re-read a lot but wrote little',
    'usage.ratioDistSub': (o) => `Sessions grouped by re-read ratio: “150–300×” means Claude had to read 150–300 times as much as it wrote. Your typical session sits at ${o.mid}×. The heaviest group eats ${o.share} of the money.`,
    'usage.ratioDistSubThin': (o) =>
      `Sessions grouped by re-read ratio: “150–300×” means Claude had to read 150–300 times as much as it wrote. Your typical session sits at ${o.mid}×. The heaviest group eats ${o.share} of the money. (Dropped ${o.thin} sessions where Claude wrote under ${o.min}.)`,
    // Exactly one sentence, and one this chart cannot make on its own. The rest moved to
    // the how-to-read block — keeping it in both places told it twice, two ways.
    'usage.ratioDistCap': 'Bars measure <b>money</b>, not session count — a group with more sessions gets a longer bar. Counts are in the tooltip.',
    'usage.tipRatioBand': (o) =>
      tipOf({
        head: `Re-read ${o.band} what it wrote`,
        rows: [
          ['Sessions', o.sessions],
          ['Estimated', o.cost],
          ['Share of money', o.share],
          ['Claude wrote', o.out],
        ],
      }),

    'usage.rewarm': 'Come back after a break, pay to reload',
    'usage.rewarmSub': (o) => `After a long enough break the cache expires, the next call reloads all the old content, and you pay for it a second time. At most ${o.extra} (${o.share}) across ${o.calls} calls.`,
    // `ttl1` is MEASURED from the running machine. It used to be a hand-copied "95%" in
    // this string — true the day it was written, with nothing to flag it when it stopped.
    'usage.rewarmCap': (o) =>
      `This is the <b>most it could be</b>, not a certainty: editing a file or <code>/compact</code> forces a reload too, and a timestamp cannot tell them apart. On your machine ${o.ttl1} of cache writes hold for 1 hour.`,
    'usage.gap5-15m': '5–15 min break',
    'usage.gap15-60m': '15–60 min break',
    'usage.gap1-6h': '1–6 hour break',
    'usage.gap6h+': 'over 6 hours',
    'usage.tipRewarm': (o) =>
      tipOf({
        head: o.band,
        rows: [
          ['Paid again', o.cost],
          ['Rewrites', o.calls],
          ['Tokens rewritten', o.tokens],
        ],
      }),

    // ── How to read this view ──
    // The ONLY block on the view whose job is teaching. Concrete figures are deliberately
    // absent — they live in subtitles and data tables, and copying them here adopts a
    // duplicate that goes stale on the next scan. The previous version broke that rule
    // three times: "$1,369", "95% of writes at the 1-hour TTL" and "the median sits in the
    // middle band" were all observations about ONE machine, frozen into a translation.
    //
    // The five `effh*` labels are gone: they matched five chart titles character for
    // character — ten strings for five names across two languages. `howToRead` now reads
    // the title keys directly.
    'usage.effHelp': 'How to read this view',

    // Glossary, and it goes FIRST. These four words appear in nearly every subtitle,
    // tooltip and column on the view. Without one definition in one place, either each
    // chart re-explains them (which is what made the view long) or nobody explains them
    // and the reader guesses. "Call" is here because it is the most misread number on the
    // view: it is NOT how many times the user typed something.
    'usage.glossTitle': 'Four words you will keep seeing',
    'usage.glossOut': 'Tokens Claude writes',
    'usage.glossOutBody':
      'What Claude actually wrote for you: the answer, the code, the contents it saved to a file. This is the measure of <b>how much work got done</b>, and it is the denominator of every ratio on this view.',
    'usage.glossCtx': 'Re-read',
    'usage.glossCtxBody':
      'Before it can write a single word, every turn Claude re-reads the entire conversation from the top, plus every file and command result loaded into it. This is usually <b>hundreds of times larger</b> than what it writes — so any "total tokens" figure is essentially just this, and it only tells you how long you sat at the machine.',
    'usage.glossCall': 'Call',
    'usage.glossCallBody':
      'One question from you usually becomes <b>many</b> calls: every file Claude reads, command it runs, or tool it invokes adds one. So "3,700 calls today" does not mean you typed 3,700 messages.',
    'usage.glossSession': 'Session',
    'usage.glossSessionBody':
      'One stretch of work from opening Claude Code. Quitting and reopening, or <code>/clear</code>, starts a new session — and the re-read pile starts small again.',

    'usage.effHelpIntro':
      'The <b>what each day costs</b>, <b>where it goes</b> and <b>what eats the tokens</b> blocks answer <i>how much</i>. The <b>pricier, or just more work</b> block answers something else entirely, and that is why it exists: an expensive day cannot tell you on its own whether you got more done or simply paid more for the same amount. Finding out means dividing the money by what Claude wrote — that block does the division for you.',
    'usage.effhUnitBody':
      'The day’s money divided by how much Claude wrote that day. The reference line is <b>your own machine’s typical level</b>, not a threshold imported from anywhere — there is no “correct price” for a token, only “is today more expensive than usual for you”. Bouncing around the line is normal. <em>Action:</em> only worth digging into when a day spikes <i>while</i> the bars in “how much Claude wrote each day” hold steady — that is the same work costing more.',
    'usage.effhCtxBody':
      'The only chart here that shows a <b>cause</b> rather than a result. A conversation only gets longer, never shorter, so turn 120 re-reads far more than turn 5 — same Claude, same kind of work, yet the end of a session still costs more than the start. Bars measure how much gets re-read; the price is in the tooltip. <em>What to do:</em> this is the biggest lever on the view — when a task is done, <b>start a new session</b> rather than running the next one in the old chat. But do not cut mid-task: re-explaining costs more.',
    'usage.effhSessionBody':
      'A long-tailed distribution: most sessions are cheap, occasionally one spikes — the subtitle says what share the ten most expensive take. <em>Action:</em> hover a tall bar and read the <i>re-read / written</i> row. That separates two kinds of expensive session that look identical as bars: a <b>low</b> ratio means that session got a lot done (fairly expensive), a <b>high</b> ratio means it re-read far too much for what it produced. Only the second is worth fixing.',
    'usage.effhRatioBody':
      'The same ratio as the chart beside it, but COUNTED instead of shown one session at a time: how many sessions ran long, and what share of the money they took. A high ratio is not automatically waste — a session that read a whole codebase to fix one line can still be the best-spent session of the day; it only says <i>where to look</i>. <em>Action:</em> read the <b>share of money</b> in the heaviest group, not the session count. Few sessions taking a share well above their head-count share is where to look; the two being equal means the tail is just a tail.',
    'usage.effhRewarmBody':
      'Claude keeps what it has already read in a cache so the next turn does not pay to read it again. After a long enough gap the cache expires, the next call reloads it from scratch, and you pay a second time for the exact same content. Loading in costs 1.25–2× a normal read; reading from cache costs 0.1×. The $0 rows are the most useful finding in the table, not a blank. <em>Action:</em> breaks shorter than the cache lifetime are effectively free, so take them. Coming back after several hours, <b>start a new session</b> — you pay to rewrite the prefix either way, and a new session also gets the small context of an early turn; resuming the old one pays both prices at once.',
    // "different coverage" used to sit BOTH here and in `effNote` right below the block,
    // with the two cross-referencing each other. `effNote` keeps it, because it carries the
    // measured date range; this line keeps only the instruction.
    'usage.effHelpDont':
      '<b>Three things not to do:</b> do not subtract the “pricier, or just more work” numbers from the two per-day charts — the two read from sources covering different date ranges; do not read <code>$</code> as a bill — the real constraint is the quota, and quotas do not roll over; do not change anything based on a day with too little use — a ratio built on a couple of calls means nothing, which is why the chart already drops them.',

    'usage.sideNote': (o) =>
      `Subagents: ${o.calls} calls · ${o.cost} (${o.share} of the total) — but priced per 1M tokens written that is ${o.unit}, ${o.x}× a main-thread call (${o.main}). A subagent reads a pile and returns a short answer; that is what it is for, not a fault.`,
    'usage.effNote': (o) =>
      `The blocks above read from LIVE transcripts (${o.from} → ${o.to}, ${o.n} calls), not from the rollup — the rollup is keyed by day × model, so it cannot reconstruct sessions, turn order, or the gaps between calls. Their coverage may therefore be narrower than the two daily charts above.`,

    // ── Quota, cycle by cycle ──
    'usage.cycleWaste': 'Quota left on the table, per cycle',
    // Median lives on the reference line only, not here — same rule as `unitByDaySub`.
    'usage.cycleWasteSub': (o) => `${o.kind} · ${o.n} closed cycles`,
    'usage.cycleWasteSubThin': (o) => `${o.kind} · ${o.n} closed cycles · dropped ${o.dropped} that were not watched long enough`,
    'usage.cycleWarmingSub': 'the quota log just started recording',
    'usage.cycleWarming': (o) =>
      `Quota has <b>no history</b>: the endpoint only returns the current state, with no parameter to ask about a past cycle. So any cycle not recorded while it was running is gone for good — the log starts with this build, and so far holds <b>${o.closed}</b> closed cycles. The 5-hour window closes about four times a day, so roughly one day of having the dashboard open gives enough bars to compare.`,
    // Log still empty: the whole section shrinks to this line. The full paragraph above
    // only means something once there are cycles to count.
    'usage.cycleWarmingLine':
      'No <b>quota waste per cycle</b> yet: the endpoint returns no history, so the log has to record each cycle while it runs. The 5-hour window closes about four times a day — roughly one day with the dashboard open gives enough bars to compare.',
    'usage.cycleCap': (o) =>
      `The recorded peak is a <b>lower bound</b>, which makes the waste derived from it an <b>upper bound</b>. Cycles watched to less than ${o.watched} of the window are dropped from the chart, and kept in the data table with a ⚠.`,
    'usage.tipCycle': (o) =>
      tipOf({
        head: `${o.kind} · closed ${o.end}`,
        rows: [
          ['Wasted', o.waste, 'warn'],
          ['Used', o.used],
          ['Watched to', o.watched],
          ['Readings', o.samples],
        ],
      }),
    'usage.cCycle': 'Window',
    'usage.cCycleEnd': 'Closed at',
    'usage.cUsedPct': 'Used',
    'usage.cWastePct': 'Wasted',
    'usage.cWatched': 'Watched to',
    'usage.cRatioBand': 'Re-read / written',
    'usage.cSessions': 'Sessions',
    'usage.cShare': 'Share of money',

    'usage.costByModel': 'Where the money goes, by model',
    'usage.costByModelSub': 'Split by MONEY, not token count. That shrinks cache reads to their real weight — they cost a tenth of a fresh read, so counting tokens lets them swallow the whole bar.',
    'usage.partOut': 'Claude wrote',
    'usage.partCacheWrite': 'Loaded into cache',
    'usage.partCacheRead': 'Read from cache',
    'usage.partInput': 'Fresh read',
    'usage.tipModelPart': (o) => tipOf({ head: o.model, rows: [[o.kind, `${o.cost} est.`]] }),

    'usage.byProject': 'Which project eats the most',
    'usage.byProjectSub': 'How much Claude wrote for each project. Side worktrees fold into the parent.',
    'usage.byProjectSubOrphan': (o) => `How much Claude wrote for each project · ${o.n} ${p(o.n, 'directory matches', 'directories match')} no project (deleted, or outside NOW_ROOTS)`,
    'usage.tipProject': (o) =>
      tipOf({
        head: o.name,
        rows: [
          ['Claude wrote', o.out],
          ['Calls', o.msgs],
          ['Estimated', o.cost],
        ],
      }),

    'usage.byMcp': 'By MCP server',
    'usage.byMcpSub': (o) => `${o.n} ${p(o.n, 'server', 'servers')} tagged — ${o.share} of what Claude wrote`,
    'usage.bySkill': 'By skill',
    // "the name before the colon is the plugin" replaces a whole "By plugin" chart that was
    // removed: it rolled up exactly these rows and added not one token. See `renderUsage`.
    'usage.bySkillSub': (o) => `${o.n} ${p(o.n, 'skill', 'skills')} tagged — ${o.share} of what Claude wrote · the name before the colon is the plugin`,
    'usage.tipAttribution': (o) =>
      tipOf({
        head: o.name,
        rows: [
          ['Claude wrote', o.out],
          ['Calls', o.msgs],
          ['Estimated', o.cost],
        ],
      }),
    'usage.byEntrypoint': 'By where Claude was opened',
    // Together these ran five lines inside a 381px column — the longest prose on the view
    // once the plugin chart went. Keep only what the chart cannot say for itself.
    'usage.byEntrypointSub': 'VS Code, Cursor and every fork all record the same label',
    'usage.byEntrypointVague': (o) =>
      `${o.share} not yet pinned to an editor — that only happens while the dashboard sees a session alive, so this share shrinks from here.`,
    'usage.tipEntry': (o) =>
      tipOf({
        head: o.name,
        rows: [
          ['Claude wrote', o.out],
          ['Estimated', o.cost],
        ],
      }),

    'usage.cDate': 'Date',
    'usage.cCost': 'Estimate',
    'usage.cRequests': 'Calls',
    'usage.cOut': 'Claude wrote',
    'usage.cCacheRead': 'Read from cache',
    'usage.cModel': 'Model',
    'usage.cProject': 'Project',
    'usage.cName': 'Name',
    'usage.cEntry': 'Opened from',
    'usage.cUnit': 'Cost per 1M written',
    'usage.cTurnBand': 'Turns',
    'usage.cCtxMedian': 'Re-read (typical)',
    'usage.cStart': 'Started',
    'usage.cRatio': 'Re-read / written',
    'usage.cGap': 'Break',
    'usage.cExtra': 'Paid again',
    'usage.cTokens': 'Tokens',

    // The last sentence used to read "the 5-hour and weekly quotas live on the server; the
    // disk keeps no copy, so the dashboard can't rebuild them" — written before Keychain
    // access existed, and contradicted by the quota block at the TOP of this very view.
    // The part that is still true: the disk keeps no copy, so history has to be logged.
    'usage.note': () =>
      `<b>Read the $ figures right:</b> the disk stores <b>no</b> cost — not one transcript line carries <code>costUSD</code>. Every $ here is multiplied out by the dashboard from the API price table hardcoded in <code>collect/usage.js</code>, while this account bills on a <b>subscription</b>. Use it to compare one day or project against another — don't read it as an invoice. If Anthropic changes prices, that table goes stale with nothing to warn you. The real constraint is the <b>quota</b> at the top of this view: that number is read straight from the server, but the server returns no history, so the per-cycle block holds only what the dashboard logged while running.`,
    'usage.gap': (o) =>
      `First ${o.lost} days missing: the first token was recorded on ${o.first} but the earliest surviving data is ${o.oldest} — Claude Code swept the old transcripts before the dashboard could snapshot them.`,
    'usage.scan': (o) => `scanned ${o.files} transcripts in ${o.ms}ms · dropped ${o.dups} duplicate lines where resume/fork recopied old history`,
    'usage.rollupAt': (o) => `· daily ledger at ${o.path} — this is what keeps history after Claude Code sweeps transcripts`,
    'usage.rollupFail': (o) => `· could NOT write the daily ledger (${o.err}) — history will erode as transcripts get swept`,
    'usage.qNote': (o) => `The filter (“${o.q}”) doesn't apply here — filtering part of it silently changes what every total means.`,
    'usage.empty': 'No token data yet',
    'usage.emptyHint': 'No transcripts under ~/.claude/projects — or Claude Code has never run on this machine.',
    'usage.broken': "Couldn't read token data",
    'usage.brokenHint': 'Scanning ~/.claude/projects failed.',

    // ── Cursor & Antigravity (the two non-Claude tabs of the Tokens view) ──
    'tools.cursorNone': 'No Cursor numbers to chart yet',
    'tools.noneHint': "The reason is in the Cursor limit block above — it names the exact link that's broken.",

    'tools.bTotal': 'Whole cycle',
    'tools.bAuto': 'Cursor-picked models',
    'tools.bNamed': 'Models you named',
    'tools.spentOf': (o) => `${o.spent} of ${o.cap}`,
    'tools.rowSpent': 'In dollars',
    'tools.rowOver': 'past what you paid for',
    'tools.bonus': (o) =>
      `Your plan is ${o.plan}/month; Cursor added ${o.bonus} free this cycle. That's why you're past ${o.plan} and still nowhere near the cap.`,
    'tools.capHelp': 'Where this dollar cap comes from',
    'tools.capNote':
      "Cursor <b>doesn't send a usage cap</b> in its response — the dashboard works it back out of the percentage: <b>cap = spent ÷ percent</b>. The <b>limit</b> field Cursor does send is the <b>plan price ($20/month)</b>, not the cap: divide by it and you get 244% while Cursor itself reports 14%. So the percentage is the real number and always leads; the dollar pair is just a restatement, and it disappears when too little has been spent to divide by.",
    'tools.cNoAuth':
      "Couldn't read the Cursor login token. The dashboard reads it from Cursor's own SQLite (~/Library/Application Support/Cursor), so you need to have signed in to Cursor at least once.",
    'tools.cHttp': "Cursor's usage endpoint returned an error. This is an undocumented internal RPC — its shape may have changed.",
    'tools.cOffline': "Couldn't reach Cursor's usage endpoint — network failure or timeout.",
    'tools.cEmpty': 'The endpoint answered, but the response carried no usage numbers.',
    'tools.cBroken': "Cursor's usage response was unreadable — this internal RPC is undocumented and its shape may have changed.",

    'tools.cursorCost': 'Where the money went, by model',
    'tools.cursorCostSub': 'real dollars Cursor charged, not an estimate',
    'tools.cursorTok': 'Tokens by model',
    'tools.partOut': 'Model wrote',
    'tools.cursorTokSub': 'four token kinds, exactly as Cursor reports them',
    'tools.cModel': 'Model',
    'tools.cBucket': 'Limit bucket',
    'tools.cCost': 'Cost',
    'tools.tipModel': (o) => tipOf({ head: o.model, rows: [['Cost', o.cost], ['Bucket', o.bucket], ['Tokens written', o.out]] }),
    'tools.tipTokPart': (o) => tipOf({ head: o.model, rows: [[o.kind, o.n]] }),

    // ── Cursor over time (event log) ──
    'tools.curTimeSection': 'Over time — individual calls, with timestamps',
    'tools.curCostByDay': 'Cost per day',
    'tools.curCostByDaySub': (o) => `${o.total} in total · ${o.from} → ${o.to}`,
    'tools.curCallsByDay': 'Calls per day, and how many failed',
    'tools.curCallsByDaySub': (o) => `${o.n.toLocaleString('en-US')} calls · ${o.err} errored (${o.share}) — errors are not charged, they only cost waiting`,
    'tools.axCalls': 'Calls · left axis',
    'tools.axErr': 'Failed · right axis',
    'tools.partErrored': 'Errored, not charged',
    'tools.curByConvo': 'Cost by conversation',
    // "· 10 priciest shown" only appears when the list was actually cut — same rule as
    // the "/97" suffix in agRow: never promise a cut that did not happen.
    'tools.curByConvoSub': (o) => `${o.n.toLocaleString('en-US')} conversations in the last ${o.d} days${o.n > 10 ? ' · 10 priciest shown' : ''}`,
    'tools.cEvents': 'Calls',
    'tools.cConvoId': 'Conversation id',
    'tools.cFirstDay': 'First seen',
    'tools.cLastDay': 'Last seen',
    'tools.tipCurDay': (o) => tipOf({ head: o.day, rows: [['Cost', o.cost], ['Calls', o.events], ['Tokens written', o.out]] }),
    'tools.tipCurCalls': (o) =>
      tipOf({ head: o.day, rows: [['Calls', o.n], ['Failed', o.err, o.err ? 'warn' : ''], ['Cost', o.cost]] }),
    'tools.tipCurConvo': (o) =>
      tipOf({ head: o.id, rows: [['Cost', o.cost], ['Calls', o.events], ['First seen', o.from], ['Last seen', o.to]] }),
    'tools.curEventsNote': (o) =>
      `Read from <b>GetFilteredUsageEvents</b>: ${o.n.toLocaleString('en-US')} calls across ${o.days} days (${o.from} → ${o.to}), kept in <b>~/.now-dashboard/cursor-events.json</b>. <b>The money here is what Cursor actually charged</b> — not an estimate like the dollar column on the Claude tab, so the two cannot be added or subtracted. The log refreshes every 15 minutes, re-pulling and overwriting the last two days each time.`,
    'tools.curEventsWarming': 'Pulling the Cursor event log for the first time — takes about ten seconds; the next scan will have charts.',
    'tools.curEventsNone': 'No Cursor events could be read. The reason is in the limit block above.',

    // ── Cursor: editor rhythm (GetUserAnalytics) ──
    'tools.curEditorSection': 'Editor rhythm — what actually lands in files',
    'tools.curLines': 'Lines accepted per day',
    'tools.curLinesSub': (o) => `${o.accepted} lines accepted across ${o.days} active days`,
    'tools.curTabRate': 'Tab suggestion accept rate',
    'tools.curTabRateSub': (o) => `out of ${o.shown} suggestions shown`,
    'tools.curTabRateSubThin': (o) => `out of ${o.shown} suggestions · ${o.thin} days under ${o.min} suggestions dropped from the chart, the rate there is noise`,
    'tools.curExts': 'Which file types you work in',
    'tools.curExtsSub': (o) => `${o.n} extensions, ranked by edits`,
    'tools.cAccepted': 'Lines accepted',
    'tools.cAdded': 'Lines suggested',
    'tools.cApplies': 'Applies',
    'tools.cAccepts': 'Accepts',
    'tools.cTabRate': 'Accept rate',
    'tools.cTabsShown': 'Suggestions shown',
    'tools.cTabsAccepted': 'Suggestions accepted',
    'tools.cExt': 'Extension',
    'tools.cEdits': 'Edits',
    'tools.tipCurLines': (o) =>
      tipOf({ head: o.day, rows: [['Lines accepted', o.accepted], ['Lines suggested', o.added], ['Applies', o.applies], ['Accepts', o.accepts]] }),
    'tools.tipCurTab': (o) => tipOf({ head: o.day, rows: [['Accept rate', o.rate], ['Shown', o.shown], ['Accepted', o.accepted]] }),
    'tools.tipCurExt': (o) => tipOf({ head: o.name, rows: [['Edits', o.count], ['Share', o.share]] }),
    'tools.curEditorNote':
      'This block measures what <b>lands in files</b>, not what the model produced — the only axis on the whole Tokens view that speaks to quality rather than volume. Plenty of suggestions that mostly get rejected is not the same as getting a lot done. Numbers come from <b>GetUserAnalytics</b>; we ask for 90 days and take whatever the server returns.',
    'tools.curCycleSection': 'Current cycle — as Cursor totals it',

    'tools.agNone': 'No Antigravity conversations could be read',
    'tools.agNoneHint': 'Open Antigravity at least once on this machine; its conversation log lives under ~/.gemini.',

    'tools.agConvos': 'Conversations',
    'tools.agAwake': 'Awake',
    'tools.agSteps': 'Steps',
    'tools.agTurns': 'Model calls',
    'tools.agCtxMed': 'Context per call',
    'tools.agBytes': 'On disk',
    'tools.agNoFolder': 'folder unknown',
    'tools.agConvoSection': 'Conversations — from the index file',
    'tools.agByProject': 'Conversations by project',
    'tools.agByProjectSub': 'ranked by steps run',
    'tools.cProject': 'Project',
    'tools.cConvos': 'Conversations',
    'tools.cSteps': 'Steps',
    'tools.cSize': 'On disk',
    'tools.tipAg': (o) =>
      tipOf({ head: o.name, rows: [['Steps', o.steps], ['Conversations', o.convos], ['On disk', o.size]] }),
    'tools.tipAgFull': (o) =>
      tipOf({
        head: o.name,
        rows: [['Steps', o.steps], ['Model calls', o.turns], ['Conversations', o.convos], ['Context read', o.ctx], ['On disk', o.size]],
      }),

    // ── Antigravity model calls (read from gen_metadata) ──
    'tools.agCallSection': "Model calls — from each conversation's own store",
    'tools.agTurnsByDay': 'Model calls per day',
    'tools.agTurnsByDaySub': (o) => `${o.n.toLocaleString('en-US')} calls across ${o.days} days with data`,
    'tools.agCtxByDay': 'How much a typical call re-reads',
    'tools.agCtxByDaySub': 'median context per call — already divided, so a rise means heavier calls, not more of them',
    'tools.agByModel': 'Calls by model',
    'tools.agByModelSub': (o) => `${o.n} models, ranked by call count`,
    'tools.agCtxFill': 'How full the context gets',
    'tools.agCtxFillSub': (o) => `${o.n.toLocaleString('en-US')} calls with a known cap · ${o.tail} (${o.share}) ran above 90% of it`,
    'tools.agCtxFillCap':
      'Near the cap is where Antigravity starts trimming conversation history. The only fix is starting a fresh conversation — which makes the last band the one to watch.',
    'tools.agTurnsNote': (o) =>
      `Read from the <b>gen_metadata</b> table in ${o.convos} conversation files: ${o.turns.toLocaleString('en-US')} calls, ${o.from} → ${o.to}. <b>Call counts and context are values recorded directly in each record.</b> The <i>tokens written</i> column in the data tables is <b>inferred</b> — the records carry no field names, and this number was picked because its magnitude and its ratio to context (82×) match the band Claude Code produces. The two other token-shaped fields could not be split into input vs cache, so they appear nowhere.`,
    'tools.agUnreadable': (o) => `${o.n} conversation files could not be read — the numbers above are missing their share.`,
    'tools.cTurns': 'Calls',
    'tools.cCtxMedian': 'Context per call',
    'tools.cCtxRead': 'Context read',
    'tools.cCtxBand': 'Context fill',
    'tools.cOutGuess': 'Tokens written (inferred)',
    'tools.tipAgDay': (o) =>
      tipOf({ head: o.day, rows: [['Calls', o.turns], ['Context per call', o.ctx], ['Tokens written (inferred)', o.out]] }),
    'tools.tipAgCtxDay': (o) =>
      tipOf({ head: o.day, rows: [['Context per call', o.ctx], ['Calls', o.turns], ['Whole day', o.total]] }),
    'tools.tipAgModel': (o) =>
      tipOf({ head: o.name, rows: [['Calls', o.turns], ['Context per call', o.ctx], ['Tokens written (inferred)', o.out]] }),
    'tools.tipAgBand': (o) => tipOf({ head: `Context at ${o.band} of cap`, rows: [['Calls', o.turns], ['Share', o.share]] }),
    'tools.rowLeft': 'Left',
    'tools.agQClosed': 'Antigravity is closed. Its limits can only be asked of the running process, so no fresh number while the app is down — unlike the conversation counts below, which are read straight off disk at any time.',
    'tools.agQNoPort': "Antigravity is running but its internal port could not be found. Usually the app has just started and its server is not up yet; the next scan will have it.",
    'tools.agQHttp': "Antigravity's internal server refused the request. The numbers below are the last successful read.",
    'tools.agQOffline': "Antigravity's internal server could not be reached. The numbers below are the last successful read.",
    'tools.agQBroken': 'Antigravity limits could not be read.',
    'tools.agQEmpty': 'Antigravity answered but reported no limit pools — usually an account with no plan attached.',
    'tools.agQHelp': 'why does this differ from the number inside Antigravity?',
    'tools.agQNote':
      'Same truth, stated two ways: the Antigravity app shows what is <b>left</b>, this dashboard shows what is <b>spent</b> — matching Claude and Cursor in the two blocks above. Seeing 71% there and 29% here is not a discrepancy: 29 + 71 = 100. The remainder is printed under every bar.<br><br>The two pools drain <b>independently</b>: one for Gemini, one for Claude+GPT, each with its own 5-hour and weekly window. Draining one does not touch the other, so the four numbers do not add up to anything.<br><br>Quota is consumed in proportion to token <b>cost</b>, not request count, so the step counts in the block below cannot be converted into the percentages here — they sit side by side, telling different stories.',
    'tools.agKeep': (o) => `Only conversations written in the last ${o.d} days are counted.`,

    // ── chart ──
    'chart.table': 'data table',
    'chart.total': 'total',
    'chart.others': (o) => `${o.n} more`,
    'chart.share': 'Share',
    'chart.value': 'Value',

    // ── Pasteable report ──
    'report.btn': 'report',
    'report.tip': tipOf({
      head: 'Report on this view',
      rows: [
        ['Includes', 'every data table + subtitle'],
        ['Format', 'Markdown'],
        ['Ships with', 'how to read it + a question'],
      ],
      note: 'Click to copy, then paste into Claude or ChatGPT. The numbers leave this machine only when you paste.',
    }),
    'report.tipDone': (o) =>
      tipOf({
        head: 'Copied ✓',
        rows: [
          ['Length', `${o.chars} chars`],
          ['Data tables', o.tables],
        ],
        note: 'Paste into Claude or ChatGPT and send — the report carries its own question. Want a different one? Edit the "Task:" line at the top.',
      }),
    'report.tipFail': tipOf({
      head: 'Not copied',
      note: 'The browser blocks the clipboard while the window is unfocused. Click the dashboard window once, then click this button again.',
    }),
    'report.stamp': (o) => `Numbers as of ${o.at} (system clock). Every table below is the companion data table of its chart.`,
    'report.ask':
      'Task: read the tables below, point out what looks off and what can be improved, with concrete actions. Every conclusion must name the number it came from. If the data is not enough, say so instead of guessing.',
    'report.quotaH': 'Quota',
    'report.kpiH': 'Summary',
    'report.howUsage': `**How to read these numbers — read this before concluding anything:**

1. **Money here is an ESTIMATE, not a bill.** Nothing on disk records cost; every \`$\` is derived from an API price table pasted into the code, while this account is on a **subscription** — using more or less does not change what is paid. Use \`$\` to compare day to day, project to project, session to session. Do not advise "cut spend to save money".
2. **What Claude RE-READS is over two hundred times larger than what it WRITES.** Every turn it re-reads the whole conversation from the top before writing a word. So any "total tokens" figure is essentially the re-read pile, and that only tells you how long the machine was in use. Real work done is the *Claude wrote* column.
3. **What matters is RATIOS, not volume.** The "pricier, or just more work" block is where the division is already done: cost per 1M tokens written, how much gets re-read per turn, extra paid after coming back from a break. A day that costs more because more got done is not a problem; costing more for the same output is.
4. **The real constraint is the quota, not the money.** The 5-hour and 7-day windows do not roll over: whatever is unused at reset is gone, not saved. True for all three tools: "only 14% spent at 75% through the cycle" is a loss, not good news.
5. **Coverage thins out going back in time.** Claude Code prunes old transcripts, so "little data on older days" is the cleanup mechanism, not "less usage back then".
6. **Three tools, three DIFFERENT units. Do not add them, do not subtract them.** Claude is percent of two rolling windows, Cursor is dollars per calendar month, Antigravity is percent of two separate pools. The limit block at the top of this report covers all three; every data table below belongs to **one** tool — named in the section heading right before the first table.
7. **Cursor's dollars are REAL; Claude's are estimated.** Cursor's \`$\` is what Cursor charged; Claude's \`$\` is the dashboard's own multiplication, per point 1. These two dollar columns are not comparable. And Cursor's dollar cap is **derived** (\`spent ÷ percent\`), not reported — the \`limit\` field in the response is the plan price, and dividing by that gives 244% while Cursor itself reports 14%. The percentage is the real number.`,
    'report.howStats': `**How to read these numbers:** everything here comes from hand-written NOW boards, so it measures **what was RECORDED**, not what was done. An empty day may be a day the board went un-updated, not a day with no work — where a chart already excludes such days, its subtitle says so.`,

    // ── Lookback view (key 8) ──
    'nav.lookback': 'Lookback',
    'title.lookback': 'Three monthly plans, cycle by cycle',
    // The bench itself stays in Vietnamese — see the note on the VI side. Only the
    // screen's own name is translated, because it sits on the rail next to seven others.
    'nav.bench': 'Bench',
    'title.bench': 'Turn the menu-bar popover knobs, then paste the values into code',
    'lookback.broken': 'Could not build the lookback data',
    'lookback.noLive': 'quota unreadable right now — this card shows history only',
    'lookback.buySection': 'Are the plans earning their keep',
    'lookback.buyQ':
      'Each card runs on its own tool’s cycle — the three cards cannot be compared side by side; only the last line of this block converts all three to weeks, and says so.',
    'lookback.capRun': 'running',
    'lookback.wasteTail': (o) => `waste in dollars ≈ ${o.usd}`,

    'lookback.planClaude': (o) => `${o.tier} · $${o.plan}/month as declared in config ≈ ${o.cycle} / 7-day window`,
    'lookback.leadClaude': (o) => `of the 7-day window spent, resets ${o.at}`,
    'lookback.scopedShare': (o) => `The ${o.model} model quota alone has spent ${o.pct} of its own cap.`,
    'lookback.capWindow': (o) => `7-day windows, ${o.from} →`,
    'lookback.sevenCapNote': 'amber = 10–50% wasted · green = ±10%',
    'lookback.fivesCap': (o) => `peak of each 5h cycle, ${o.from} →`,
    'lookback.fiveNever': (o) => `The 5h cap has never been the constraint — highest peak since the ledger opened: ${o.max}.`,
    'lookback.fiveHit': (o) => `The 5h cap has been hit (${o.max}) — the short window has blocked work before.`,
    'lookback.sevenYoung': (o) =>
      `Cycle ledger opened ${o.opened} — no 7-day window has closed yet. The priced 7-day columns fill in from ${o.first}.`,
    'lookback.sevenMoney': (o) => `${o.n} ${p(o.n, 'window', 'windows')} closed: ${o.waste} wasted of ${o.paid} paid`,
    'lookback.sevenWorst': (o) => `worst was the window ending ${o.week}: ${o.usd} left unused`,
    'lookback.partialSkip': (o) => `${o.n} under-watched ${p(o.n, 'cycle', 'cycles')} (grey) ${p(o.n, 'carries', 'carry')} no dollars`,
    'lookback.fiveStill': (o) => `5h cap: peak across ${o.n} cycles still only ${o.max}`,
    'lookback.tipSeven': (o) =>
      tipOf({
        head: `7-day window → ${o.end}`,
        rows: [
          ['Spent', o.used],
          ['Wasted', o.usd ? `${o.waste} · ${o.usd}` : o.waste],
          ['Watched to', o.watched],
        ],
        note: o.partial ? 'Under-watched: the peak is a lower bound, waste an upper bound — no dollars assigned.' : '',
      }),
    'lookback.tipFive': (o) =>
      tipOf({
        head: `5-hour cycle → ${o.end}`,
        rows: [['Peak', o.used]],
        note: 'The 5h series is neutral — most cycles land while asleep, no dollars assigned.',
      }),

    'lookback.planCursor': (o) => `${o.tier} · $${o.plan}/billing cycle ${o.from} → ${o.to}`,
    'lookback.leadCursorOver': (o) => `used on the $${o.plan} plan — ${o.x}× over`,
    'lookback.leadCursorUnder': (o) => `used on the $${o.plan} plan`,
    'lookback.cursorOverLine': (o) =>
      `The included $${o.plan} is fully used + provider bonus ${o.bonus} · ${o.elapsed} of the cycle elapsed`,
    'lookback.cursorUnderLine': (o) => `${o.left} of the plan still unused · ${o.elapsed} of the cycle elapsed`,
    'lookback.cursorMoneyOverRun': 'Waste this cycle: $0 — the paid part is fully used; the overshoot is a provider gift, shown in the "beyond target" colour.',
    'lookback.cursorMoneyProj': (o) => `Projected by cycle end (${o.to}): ~${o.proj} — waste ≈ ${o.waste}`,
    'lookback.cursorCycles': (o) => `${o.n} ${p(o.n, 'cycle', 'cycles')} closed: ${o.waste} wasted`,
    'lookback.cursorAllOver': (o) => ` — every $${o.plan} was fully used; the overshoot is provider bonus`,
    'lookback.cursorCap': (o) => `cycle ${o.from}→${o.to}`,
    'lookback.cursorCapNote': 'purple = beyond the paid part',
    'lookback.tipBilling': (o) =>
      tipOf({
        head: `Billing cycle → ${o.end}`,
        rows: [
          ['Used', o.cents],
          ['Plan', o.plan],
          ['Bonus', o.bonus],
          ['Wasted', o.waste],
        ],
        note: o.partial ? 'Under-watched — no dollars assigned.' : '',
      }),
    'lookback.tipCursorRun': (o) =>
      tipOf({
        head: 'Running cycle',
        rows: [
          ['Used', o.cents],
          ['Plan', o.plan],
          ['Elapsed', o.elapsed],
          ['Resets', o.reset],
        ],
      }),

    'lookback.planAg': (o) => `${o.tier} · $${o.plan}/month ≈ ${o.cycle} / week — dollars anchored to the Gemini pool`,
    'lookback.leadAg': (o) => `of this week’s Gemini pool spent, resets ${o.at}`,
    'lookback.agWeekCap': (o) => `week ${o.from} → ${o.to}`,
    'lookback.threepLine': (o) => `The Claude/GPT pool on the same plan: ${o.used} spent with only ${o.elapsed} of the week elapsed`,
    'lookback.threepPace': (o) => ` — this pace asks for ~${o.x} weeks`,
    'lookback.threepCapped': (o) => `The Claude/GPT pool on the same plan has hit its weekly cap — resets ${o.at}.`,
    'lookback.threep5h': 'its 5h pool is at its cap right now',
    'lookback.threepNoMoney': (o) => `No dollars assigned: one $${o.plan} plan buys both pools; splitting the price would invent a division.`,
    'lookback.agMoney': (o) => `${o.n} ${p(o.n, 'week', 'weeks')} closed: ${o.waste} wasted of ${o.paid} paid`,
    'lookback.agYoung': (o) => `The AG cycle ledger opened ${o.opened} — the first week closes at the ${o.first} reset.`,
    'lookback.tipGemini': (o) =>
      tipOf({
        head: `Gemini week → ${o.end}`,
        rows: [
          ['Spent', o.used],
          ['Wasted', o.usd ? `${o.waste} · ${o.usd}` : o.waste],
          ['Watched to', o.watched],
        ],
        note: o.partial ? 'Under-watched: the peak is a lower bound, waste an upper bound — no dollars assigned.' : '',
      }),

    'lookback.weekTotal': (o) => `Converted to weeks so they can be added: the three plans ≈ ${o.sum}/week — projected waste this week ≈ ${o.waste}. `,
    'lookback.weekTight': 'The quotas are being squeezed nearly dry — exactly the goal.',
    'lookback.weekLoose': (o) => `The largest share of the waste sits with ${o.tool}.`,

    'lookback.rhythmSection': '14-day rhythm',
    'lookback.rhythmQ': 'One strip per tool, each in its own unit — the units cannot be added, so they are never drawn as one column.',
    'lookback.stripClaude': 'Claude — tokens written per day',
    'lookback.stripClaudeSrc': (o) => `source: usage-rollup ledger, ${o.days} days deep`,
    'lookback.stripCursor': 'Cursor — calls per day',
    'lookback.stripCursorSrc': (o) => `source: cursor-events ledger, ${o.days} days deep`,
    'lookback.stripAg': 'Antigravity — agent turns per day',
    'lookback.stripAgSrc': (o) => `source: gen_metadata table, ${o.days} days deep`,
    'lookback.agNoDaily':
      'No Antigravity agent turns readable in the last 14 days — this strip appears only while the gen_metadata table still has recent conversations.',
    'lookback.peakAt': (o) => `peak ${o.day}: ${o.v}`,
    'lookback.zeroDays': (o) => `empty ${o.days} — days ${o.tool} was not opened`,
    'lookback.zeroMany': (o) => `${o.n} ${p(o.n, 'day', 'days')} without opening ${o.tool}`,
    'lookback.tipClaudeDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Claude wrote', o.out],
          ['Requests', o.msgs],
        ],
      }),
    'lookback.tipCursorDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Calls', o.events],
          ['Real dollars', o.cost],
        ],
      }),
    'lookback.tipAgDay': (o) =>
      tipOf({
        head: o.day,
        rows: [
          ['Agent turns', o.turns],
          ['Tokens generated', o.out],
        ],
      }),

    'lookback.trendSection': 'Weekly trend',
    'lookback.trendQ': 'Week against week — only stands once the cycle ledgers are at least 3 weeks old.',
    'lookback.trendWait': (o) =>
      `This block opens itself once the youngest cycle ledger is 3 weeks old — around ${o.opens} (youngest ledger opened ${o.opened}). Meanwhile the "14-day rhythm" block above already looks back half a month.`,
    'lookback.trendNoLedger': 'No cycle ledger has opened yet — this block waits for 3 weeks of ledger from the first scan.',
    'lookback.trendThin': 'The ledgers are 3 weeks old but no source has 2 weeks with numbers yet — a few more days and the columns appear.',
    'lookback.trendClaude': 'Claude — tokens written per week',
    'lookback.trendCursor': 'Cursor — real dollars per week',
    'lookback.trendAg': 'Antigravity — Gemini pool peak per week',
    'lookback.trendWeeks': (o) => `${o.n} ${p(o.n, 'week', 'weeks')}, weeks start Monday`,
    'lookback.tipWeek': (o) =>
      tipOf({
        head: `Week of ${o.week}`,
        rows: [['Total', o.v]],
      }),

    'lookback.note':
      'Plan prices come from PLANS in src/config.js — change plans there and the three cards follow. The cycle ledgers live in ~/.now-dashboard, recording since 25–28 Jul 2026; earlier days cannot be rebuilt (decided: no backfill).',
    'report.howLookback': `**How to read these numbers:** each tool is measured on ITS OWN cycle (Claude: 7-day window · Cursor: ~monthly billing cycle · Antigravity: Gemini pool week) — the three cards cannot be compared side by side; only the "converted to weeks" line may be added, and it says it is a conversion. Waste = the paid part left unused at reset; quotas do not roll over, so spending them fully is the GOAL, not an alarm. Claude/AG dollars are the plan price split per cycle (price set by hand in config); Cursor dollars are real cents charged by Cursor. Cycles marked "under-watched" — the tracker missed part of the cycle — have lower-bound peaks, so the real number may be higher; they carry no dollars, and the table marks each one.`,
  },
};
