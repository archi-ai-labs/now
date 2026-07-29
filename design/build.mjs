/**
 * Dựng thư viện component để đẩy lên Claude Design.
 *
 * Đây là ĐỀ XUẤT thay ngôn ngữ thiết kế, không phải bản chụp cái đang có. Bản
 * HUD hiện tại bị bốn lỗi cùng lúc — ồn, chữ nhỏ, không rõ nhìn đâu trước, và
 * chất game không hợp — nên đẩy nguyên nó lên chỉ tốn một vòng qua lại.
 *
 * Bốn quyết định gốc, mọi thứ khác suy ra từ đây:
 *
 * 1. ỒN → **một màu nhấn duy nhất** (chàm, cho thứ bấm được). Trạng thái là
 *    chấm nhỏ + chữ, không phải mảng màu phát sáng. Bỏ hết `text-shadow`/glow,
 *    bỏ panel vát góc, bỏ nền kẻ ô. Phân tầng bằng nền chứ không bằng viền.
 * 2. CHỮ NHỎ → nền 14px/1.6, nhãn 12px **sans thường**, bỏ sạch kiểu nhãn
 *    9px mono IN HOA giãn chữ. Mono chỉ còn cho thứ THỰC SỰ là mã: đường dẫn,
 *    lệnh, nhánh, uuid, số trong bảng.
 * 3. KHÔNG BIẾT NHÌN ĐÂU → mỗi màn đúng MỘT khối chính. Dải XP đang tranh chỗ
 *    với khối tóm tắt nên bỏ; thẻ dự án hạ xuống tầng hai bằng nền và cỡ chữ.
 * 4. CHẤT GAME → bỏ hạng S/A/B/C, XP, chuỗi lửa, dấu `!!`/`~`. Trạng thái nói
 *    bằng tiếng Việt: "Đang chặn", "Cần cập nhật", "Ổn".
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'dist');

/* ── Token ────────────────────────────────────────────────────────────────── */

/**
 * Token đọc từ `tokens.json` — MỘT nguồn duy nhất.
 *
 * Trước đây khối `:root` được chép thẳng vào cả 8 preview. Sếp sửa một màu trên
 * claude.ai/design thì chỉ đúng file đó đổi, 7 file kia vẫn màu cũ, mà lượt dựng
 * sau lại ghi đè nốt cái vừa sửa. Vòng lặp qua lại kiểu đó không chạy được.
 */
const T = JSON.parse(await readFile(path.join(HERE, 'tokens.json'), 'utf8'));

/** Tương phản WCAG. Tính lúc dựng để con số trong preview không bao giờ nói dối:
 *  đổi màu trong tokens.json là tỉ lệ tự tính lại, không có chỗ cho số chép tay cũ. */
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Tỉ lệ đo trên nền THẺ của đúng nền đang xét. Cùng một mã hex cho hai con số
 *  khác nhau ở hai nền, nên mọi chỗ gọi phải nói rõ mình đang đo nền nào — mặc
 *  định `light` vì đó là nền của :root. */
const ratio = (hex, theme = 'light') => `${contrast(hex, T.surface[theme]).toFixed(1)}:1`;

/** Khai token cho MỘT nền. Thang đo (`scale`) chỉ đi kèm nền sáng: cỡ chữ, bo góc
 *  và khoảng cách không đổi theo nền, khai lại lần nữa chỉ tổ có hai chỗ để lệch. */
const declare = (theme) =>
  [
    ...T.color.map((c) => `  --${c.name}: ${c[theme]};`),
    ...Object.entries(T.derived[theme]).map(([k, v]) => `  --${k}: ${v};`),
    ...(theme === 'light' ? Object.entries(T.scale).map(([k, v]) => `  --${k}: ${v};`) : []),
    `  color-scheme: ${theme};`,
  ].join('\n');

/**
 * CHỈ khai báo token — đây là phần duy nhất app dán về.
 *
 * Tách khỏi phần nền bên dưới là chuyện bắt buộc, không phải cho gọn: `--css`
 * từng in ra cả hai, nên dán vào `public/styles.css` là kèm luôn `.btn`, `.card`,
 * `.st` của preview đè lên chính những class app đã có. App và preview chia nhau
 * BẢNG MÀU, không chia nhau component.
 */
const TOKEN_BLOCK = `/* Font nạp bằng <link> ở <head> (index.html cho app, khối page() cho preview),
   KHÔNG phải @import ở đây: @import bắt trình duyệt tải xong file CSS này rồi mới
   bắt đầu tải font — hai vòng nối tiếp trước khi trang vẽ được — và khi máy không
   có mạng thì nó treo cả trang cho tới lúc DNS bỏ cuộc, dù dữ liệu đều ở localhost. */

:root {
${declare('light')}
}

/* Nền tối. Cùng bộ tên biến — component đọc token nên tự lật theo, không một dòng
   CSS component nào biết mình đang ở nền nào. Lớp .theme-dark để preview lật được
   từng khối mà không phải đụng vào thẻ html. */
:root[data-theme="dark"], .theme-dark {
${declare('dark')}
}`;

/** Nền cho preview: reset + vài helper để thẻ đứng một mình cũng xem được.
 *  KHÔNG bao giờ đi vào app. */
const TOKENS = `
${TOKEN_BLOCK}
* { box-sizing: border-box; }
body {
  margin: 0; padding: var(--s5);
  background: var(--bg); color: var(--text);
  font: 14px/1.6 var(--sans);
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { margin: 0; font-weight: 600; letter-spacing: -0.011em; }
code, .mono { font-family: var(--mono); font-size: 0.92em; }

/* Nhãn: sans thường, viết hoa đầu câu. Nhãn 9px MONO IN HOA GIÃN CHỮ là thứ
   làm cả trang vừa khó đọc vừa ra chất HUD — bỏ hẳn, không có ngoại lệ. */
.label { font-size: 12px; color: var(--text-3); }

.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--shadow-sm); }
.spec { margin-top: var(--s4); padding-top: var(--s3); border-top: 1px solid var(--border);
        font-size: 12.5px; line-height: 1.65; color: var(--text-3); }
.spec b { color: var(--text-2); font-weight: 600; }
.row { display: flex; gap: var(--s3); flex-wrap: wrap; align-items: center; }
.stack { display: grid; gap: var(--s4); }

/* Trạng thái = chấm + chữ. Chưa bao giờ là mảng màu, và không bao giờ chỉ màu. */
.st { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-2); }
.st::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--c, var(--text-3)); flex: none; }
.st.ok { --c: var(--ok); } .st.warn { --c: var(--warn); } .st.crit { --c: var(--crit); }

.btn { font: 500 13px var(--sans); padding: 7px 13px; border-radius: var(--r-sm); cursor: pointer;
       border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text); }
.btn:hover { background: var(--surface-3); }
.btn.primary { background: var(--accent-weak); border-color: var(--accent-line); color: var(--accent-ink); }
.btn.primary:hover { background: var(--accent-hover); }
.btn.quiet { background: none; border-color: transparent; color: var(--text-2); }
.btn.quiet:hover { background: var(--surface-2); color: var(--text); }
`;

const page = (title, group, name, subtitle, body, extra = '', bodyClass = '') => `<!-- @dsCard group="${group}" name="${name}" subtitle="${subtitle}" -->
<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${T.font.import}">
<style>${TOKENS}${extra}</style></head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${body}
</body></html>
`;

/* ── Foundations ──────────────────────────────────────────────────────────── */

const swatch = (theme) => (c) => `
  <div class="sw">
    <div class="chip" style="background:${c[theme]}"></div>
    <div>
      <div class="n">${c.name}</div>
      <div class="v mono">${c[theme]} · ${ratio(c[theme], theme)}</div>
      <div class="note">${c.note}</div>
    </div>
  </div>`;

// Nhóm theo `group` trong tokens.json — thêm một màu ở đó là thẻ này tự có, không
// phải nhớ sửa hai chỗ.
const byGroup = new Map();
for (const c of T.color) byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c]);

const SW_CSS = `.sws { display: grid; gap: var(--s3); grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
   .sw { display: flex; gap: var(--s3); align-items: center; }
   .chip { width: 40px; height: 40px; border-radius: var(--r-sm); border: 1px solid var(--border); flex: none; }
   .sw .n { font-size: 13px; font-weight: 500; }
   .sw .v { font-size: 11.5px; color: var(--text-3); }
   .sw .note { font-size: 11.5px; color: var(--text-3); }`;

/** Bảng màu, dựng một lần cho mỗi nền. Hai thẻ đọc CÙNG một mảng `T.color` — thêm
 *  một màu vào tokens.json là cả hai thẻ tự có, không có đường nào để hai nền lệch
 *  nhau một token. Con số tương phản đo trên nền thẻ của chính nền đó. */
const colorPage = (theme) => {
  const dark = theme === 'dark';
  return page(
    dark ? 'Màu — nền tối' : 'Màu',
    'Nền tảng',
    dark ? 'Màu — nền tối' : 'Màu',
    dark
      ? 'Cùng bộ tên biến, nhấn chàm sáng lên cho đủ tương phản trên nền tối'
      : 'Nền sáng, chữ ba bậc, một màu nhấn, ba màu trạng thái',
    `<h2>${dark ? 'Màu — nền tối' : 'Màu'}</h2>
<p class="spec" style="margin-top:var(--s2);border:0;padding:0">
  ${
    dark
      ? `<b>Cùng bộ tên biến với nền sáng.</b> Component đọc token nên không cái nào biết mình
  đang ở nền nào — lật nền không phải sửa một dòng CSS component. Nhấn chàm sáng lên
  (<code>#4f46e5</code> → <code>#8b83f7</code>) vì cùng một mã hex không thể vừa đủ tương phản
  trên giấy trắng vừa đủ trên nền <code>${T.surface.dark}</code>.`
      : `<b>Một màu nhấn duy nhất.</b> Bản cũ dùng amber + cyan + violet + đỏ + xanh lá cùng lúc,
  mỗi cái đều phát sáng — nên không cái nào còn nghĩa là "chú ý vào đây". Ở đây chàm là
  <b>thứ bấm được</b>, và chỉ thế. Ba màu trạng thái để dành riêng, luôn đi kèm chữ.`
  }
</p>
<p class="spec" style="border:0;padding:0;margin-top:var(--s2)">
  Tỉ lệ tương phản đo trên nền thẻ <code>${T.surface[theme]}</code> và <b>tính lúc dựng</b> —
  đổi màu trong <code>design/tokens.json</code> là con số tự cập nhật.
</p>
${[...byGroup]
  .map(
    ([g, list]) =>
      `<h3 style="margin:var(--s5) 0 var(--s3);font-size:13px;color:var(--text-2)">${g}</h3>
<div class="sws">${list.map(swatch(theme)).join('')}</div>`,
  )
  .join('\n')}
<div class="row" style="margin-top:var(--s5)">
  <span class="st ok">Ổn</span><span class="st warn">Cần cập nhật</span><span class="st crit">Đang chặn</span>
</div>
<p class="spec">
  <b>Bậc chữ mờ nhất vẫn đọc được.</b> Bản cũ dùng <code>--faint #4e5c6e</code> ở mức
  <b>${ratio('#4e5c6e', theme)}</b> cho hàng loạt nhãn 9–10px — dưới xa ngưỡng AA 4.5:1, và đó là
  một nửa lý do "chữ nhỏ khó đọc". Bậc mờ nhất ở đây là
  <b>${ratio(T.color.find((c) => c.name === 'text-3')[theme], theme)}</b>.<br>
  <b>Không glow.</b> Mọi <code>text-shadow</code> và <code>box-shadow</code> MÀU đã bỏ. Bóng còn
  lại là bóng xám trung tính để tách tầng — ánh sáng quanh chữ làm nét chữ nhoè và là thứ
  khiến bản cũ trông như giao diện game.
</p>`,
    SW_CSS,
    dark ? 'theme-dark' : '',
  );
};

const color = colorPage('light');
const colorDark = colorPage('dark');

const type = page(
  'Chữ', 'Nền tảng', 'Chữ', 'Sans để đọc, mono chỉ cho mã',
  `<h2>Chữ</h2>
<p class="spec" style="margin-top:var(--s2);border:0;padding:0">
  Bản cũ đặt nền 13.5px và rải nhãn <b>9–10px mono IN HOA giãn 0.15em</b> khắp nơi.
  Cỡ đó đọc lâu là mỏi, và chính kiểu nhãn đó tạo ra chất HUD. Ở đây nền lên 14px,
  nhãn là <b>sans 12px viết thường</b>, mono chỉ còn cho thứ thực sự là mã.
</p>
<div class="stack" style="margin-top:var(--s5)">
  <div><div class="label">Tiêu đề màn · 18px/600</div><div style="font-size:18px;font-weight:600">Dự án</div></div>
  <div><div class="label">Câu dẫn · 19px/1.5/500 — khối chính, cỡ lớn nhất trang</div>
       <div style="font-size:19px;line-height:1.5;font-weight:500;max-width:60ch">Có 1 quyết định đang chặn tronsave/services — treo 7 ngày.</div></div>
  <div><div class="label">Tiêu đề thẻ · 15px/600</div><div style="font-size:15px;font-weight:600">tronsave/services</div></div>
  <div><div class="label">Chữ đọc · 14px/1.6</div>
       <div style="max-width:62ch">Vận hành ADR 021 buy-dual-resource trên dev, sau đó tắt DRY_RUN cron-refund.</div></div>
  <div><div class="label">Chữ phụ · 12.5px</div><div style="font-size:12.5px;color:var(--text-2)">Cập nhật 4 giờ trước · 16 commit sau mốc</div></div>
  <div><div class="label">Nhãn · 12px, viết hoa đầu câu, KHÔNG in hoa toàn bộ</div><div class="label">Việc kế tiếp</div></div>
  <div><div class="label">Mono — chỉ cho đường dẫn, lệnh, nhánh, uuid, số trong bảng</div>
       <div class="mono" style="color:var(--text-2)">~/Projects/archimonde92/services · dev-ready · claude --resume dd5bb1f2</div></div>
</div>
<p class="spec"><b>Luật một dòng:</b> mono là để nói "cái này bạn sẽ gõ lại".
Dùng nó cho tiêu đề và nhãn thì mất luôn tín hiệu đó, và cả trang khó đọc thêm.</p>`,
);

/* ── Component ────────────────────────────────────────────────────────────── */

const summary = page(
  'Khối tóm tắt', 'Component', 'Khối tóm tắt', 'Khối chính — một câu + một hành động',
  `<h2 style="font-size:15px;margin-bottom:var(--s3)">Khối tóm tắt</h2>
<section class="lead">
  <div class="lead-top"><span class="st crit">Đang chặn</span><span class="lead-time">10:14</span></div>
  <p class="lead-say">Có 1 quyết định đang chặn tronsave/services — treo 7 ngày.</p>
  <p class="lead-why">ops_* soak đủ 7 ngày, còn mismatch không? Cho flip enforce theo runbook §5 chưa?</p>
  <div class="lead-act">
    <button class="btn primary">Chép “chốt enforce-flip”</button>
    <button class="btn quiet">Xem tất cả quyết định →</button>
  </div>
</section>
<section class="lead" style="margin-top:var(--s3)">
  <div class="lead-top"><span class="st ok">Không có gì chặn</span><span class="lead-time">10:14</span></div>
  <p class="lead-say">Việc kế tiếp ở longwavefinder.</p>
  <p class="lead-why">Sáng mai sau 7:20 mở data/daily.log kiểm tra release có chạy trong launchd không.</p>
  <div class="lead-act"><button class="btn primary">Chép câu làm tiếp</button></div>
</section>
<p class="spec">
  <b>Đây là khối duy nhất được to.</b> Bản cũ đặt ngay dưới nó một dải XP + hạng + chuỗi ngày
  cũng sáng và cũng rộng ngang — hai khối tranh nhau thì không khối nào là khối chính nữa.
  Dải đó đã bỏ.<br>
  <b>Không mặt, không vòng thở, không gõ chữ.</b> Trạng thái nói bằng chấm + chữ ở góc trên;
  giọng nằm ở câu chữ, không cần nhân vật hoá.
</p>`,
  `.lead { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--crit);
           border-radius: var(--r); padding: var(--s4) var(--s5) var(--s5); }
   .lead:nth-of-type(2) { border-left-color: var(--ok); }
   .lead-top { display: flex; align-items: center; margin-bottom: var(--s3); }
   .lead-time { margin-left: auto; font: 12px var(--mono); color: var(--text-3); }
   .lead-say { margin: 0; font-size: 19px; line-height: 1.5; font-weight: 500; max-width: 62ch; }
   .lead-why { margin: var(--s2) 0 0; font-size: 13.5px; color: var(--text-2); max-width: 70ch; }
   .lead-act { display: flex; gap: var(--s2); margin-top: var(--s4); flex-wrap: wrap; }`,
);

const projectCard = page(
  'Thẻ dự án', 'Component', 'Thẻ dự án', 'Ba trạng thái · hành động hiện khi rê chuột',
  `<h2 style="font-size:15px;margin-bottom:var(--s3)">Thẻ dự án</h2>
<div class="grid">
  <article class="pc">
    <header><h3>tronsave/services</h3><span class="st crit">Đang chặn</span></header>
    <div class="meta mono">dev-ready · 16 commit sau mốc · 3 file chưa commit</div>
    <div class="body">
      <div class="label">Đang làm</div>
      <p class="focus">Vận hành ADR 021 buy-dual-resource trên dev → tắt DRY_RUN cron-refund</p>
      <p class="next"><span class="ar">→</span>Chạy script Task 8 trong Compass shell, dán kết quả cho Claude</p>
    </div>
    <footer><span>1 quyết định · 6 hàng đợi</span><span class="sess">0/22 phiên thức</span></footer>
    <div class="act"><button class="btn primary">Chép câu làm tiếp</button><button class="btn quiet">Mở thư mục</button></div>
  </article>

  <article class="pc">
    <header><h3>longwavefinder</h3><span class="st ok">Ổn</span></header>
    <div class="meta mono">main · sạch</div>
    <div class="body">
      <div class="label">Đang làm</div>
      <p class="focus">Dashboard đã lên web — chờ buổi sáng tự động đầu tiên</p>
      <p class="next"><span class="ar">→</span>Sáng mai sau 7:20 mở data/daily.log kiểm tra release có chạy không</p>
    </div>
    <footer><span>4 hàng đợi</span><span class="sess">1/3 phiên thức</span></footer>
    <div class="act"><button class="btn primary">Chép câu làm tiếp</button><button class="btn quiet">Mở thư mục</button></div>
  </article>
</div>
<p class="spec">
  <b>Bỏ huy hiệu hạng.</b> Ô vát góc in <code>!!</code> / <code>~</code> / <code>✓</code> phải học mới hiểu,
  lại nằm cạnh hạng người chơi S/A/B/C nghĩa ngược nhau. Thay bằng chấm + chữ đọc được ngay.<br>
  <b>Bỏ thanh “độ tươi board”.</b> Một thanh đo trên mọi thẻ kể cả thẻ 100% là mực không mang tin.
  Board cũ thì nói thẳng "Cần cập nhật"; board ổn thì không cần nói gì.<br>
  <b>Bỏ ký hiệu repo dạng <code>Δ16 ✗3 ↑2 ⑂1</code></b> — viết thành chữ, một dòng, đọc được không cần chú giải.
</p>`,
  `.grid { display: grid; gap: var(--s3); grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); align-items: start; }
   .pc { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; }
   .pc:hover { border-color: var(--border-strong); }
   .pc header { display: flex; align-items: center; gap: var(--s3); padding: var(--s3) var(--s4) 0; }
   .pc h3 { font-size: 15px; flex: 1; min-width: 0; }
   .pc .meta { padding: 4px var(--s4) 0; font-size: 11.5px; color: var(--text-3); }
   .pc .body { padding: var(--s3) var(--s4) 0; }
   .pc .focus { margin: 4px 0 var(--s3); font-size: 14px; line-height: 1.5; }
   .pc .next { margin: 0; display: flex; gap: 8px; font-size: 13px; line-height: 1.55; color: var(--text-2);
               background: var(--surface-2); border-radius: var(--r-sm); padding: 9px 11px; }
   .pc .next .ar { color: var(--accent-ink); flex: none; }
   .pc footer { display: flex; gap: var(--s3); padding: var(--s3) var(--s4);
                font-size: 12.5px; color: var(--text-3); }
   .pc footer .sess { margin-left: auto; }
   .pc .act { display: flex; gap: var(--s2); padding: 0 var(--s4) var(--s4); }`,
);

const nav = page(
  'Thanh điều hướng', 'Điều hướng', 'Thanh điều hướng', 'Sáu màn · một chỉ báo cần chú ý',
  `<h2 style="font-size:15px;margin-bottom:var(--s3)">Thanh điều hướng</h2>
<nav class="rail">
  <div class="brand">NOW<span>sở chỉ huy</span></div>
  <a class="ni active">Dự án<b>5</b></a>
  <a class="ni">Phiên<b>5</b></a>
  <a class="ni">Quyết định<b class="crit">1</b></a>
  <a class="ni">Đã xong</a>
  <a class="ni">Thống kê</a>
  <a class="ni">Sức khoẻ<b class="warn">2</b></a>
  <div class="foot">Phím tắt <kbd>?</kbd></div>
</nav>
<p class="spec">
  <b>Chọn màn bằng nền, không bằng vạch phát sáng.</b> Bản cũ dùng vạch amber bên trái cộng
  chữ đổi màu cộng icon đổi màu — ba tín hiệu cho một chuyện.<br>
  <b>Chỉ số đếm chỉ đỏ khi thực sự chặn.</b> Số đếm bình thường là chữ xám; đỏ và vàng để dành
  cho việc cần làm. Bản cũ tô nền đỏ phát sáng cho cả số đếm thường.
</p>`,
  `.rail { width: 216px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r);
           padding: var(--s3); display: grid; gap: 2px; }
   .brand { padding: var(--s2) var(--s3) var(--s4); font-size: 14px; font-weight: 700; letter-spacing: 0.02em; }
   .brand span { display: block; font-size: 11.5px; font-weight: 400; color: var(--text-3); letter-spacing: 0; }
   .ni { display: flex; align-items: center; gap: var(--s2); padding: 8px var(--s3); border-radius: var(--r-sm);
         font-size: 13.5px; color: var(--text-2); cursor: pointer; }
   .ni:hover { background: var(--surface-2); color: var(--text); }
   .ni.active { background: var(--surface-3); color: var(--text); font-weight: 500; }
   .ni b { margin-left: auto; font: 500 12px var(--mono); color: var(--text-3); }
   .ni b.crit { color: var(--crit); } .ni b.warn { color: var(--warn); }
   .foot { margin-top: var(--s3); padding: var(--s3); border-top: 1px solid var(--border);
           font-size: 12px; color: var(--text-3); }
   kbd { font: 11px var(--mono); border: 1px solid var(--border-strong); border-radius: 3px; padding: 1px 5px; }`,
);

const table = page(
  'Bảng dữ liệu', 'Component', 'Bảng dữ liệu', 'Quyết định · số canh phải, mono',
  `<h2 style="font-size:15px;margin-bottom:var(--s3)">Bảng dữ liệu</h2>
<table class="t">
  <thead><tr><th>Độ gấp</th><th>Dự án</th><th>Quyết gì</th><th>Đang khoá</th><th>Treo</th></tr></thead>
  <tbody>
    <tr><td class="num crit">82</td><td>tronsave/services</td>
        <td><b>ADR 019: flip shadow → enforce sau soak</b><div class="q">ops_* soak đủ 7 ngày, còn mismatch không?</div></td>
        <td>Khép phần vận hành ADR 019</td><td class="num">7 ngày</td></tr>
    <tr><td class="num warn">44</td><td>tronsave/services</td>
        <td><b>MIN codegen api-service: PA1 pin cũ vs PA2 scalars</b></td>
        <td>Mọi lần npm run generate/compile</td><td class="num">4 ngày</td></tr>
    <tr><td class="num">32</td><td>savefee-be</td>
        <td><b>Owner-binding cho broadcast</b></td>
        <td>Attribution/billing broadcast</td><td class="num">2 ngày</td></tr>
  </tbody>
</table>
<p class="spec">
  <b>Bỏ cột lặp lại.</b> Bản cũ có cột "độ nóng" in lại đúng chữ đã có ở tiêu đề khối, sáu lần liền.<br>
  <b>Số canh phải, chữ số đều bề ngang</b> (<code>tabular-nums</code>) để rà dọc được. Chỉ số nào
  vượt ngưỡng mới đổi màu — tô màu cả cột thì màu hết nghĩa.
</p>`,
  `.t { width: 100%; border-collapse: collapse; font-size: 13.5px; }
   .t th { text-align: left; padding: 0 var(--s3) var(--s2); font-size: 12px; font-weight: 500;
           color: var(--text-3); border-bottom: 1px solid var(--border); }
   .t td { padding: var(--s3); border-bottom: 1px solid var(--border); vertical-align: top; line-height: 1.55; }
   .t tbody tr:hover { background: var(--surface); }
   .t .num { font: 500 13px var(--mono); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; color: var(--text-2); }
   .t .num.crit { color: var(--crit); } .t .num.warn { color: var(--warn); }
   .t .q { margin-top: 4px; font-size: 12.5px; color: var(--text-3); }`,
);

const charts = page(
  'Chart', 'Chart', 'Chart', 'Cột & thanh — một màu, nhãn chọn lọc',
  `<h2 style="font-size:15px;margin-bottom:var(--s3)">Chart</h2>
<div class="two">
  <div class="card p">
    <div class="ct">Việc xong theo ngày</div><div class="cs">4 ngày · 3 ngày bị đếm thiếu (cột mờ)</div>
    <div class="plot">
      <div class="y"><span style="--p:100%">15</span><span style="--p:66.6%">10</span><span style="--p:33.3%">5</span><span style="--p:0%">0</span></div>
      <div class="area">
        <i class="gl" style="--p:100%"></i><i class="gl" style="--p:66.6%"></i><i class="gl" style="--p:33.3%"></i><i class="gl" style="--p:0%"></i>
        <div class="cols">
          <div class="col dim"><i style="height:6.6%"></i><span class="x">20/7</span></div>
          <div class="col dim"><i style="height:33.3%"></i><span class="x">21/7</span></div>
          <div class="col dim"><i style="height:80%"></i><span class="x">22/7</span></div>
          <div class="col"><b class="pk" style="--p:93.3%">14</b><i style="height:93.3%"></i><span class="x">23/7</span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="card p">
    <div class="ct">Hàng đợi theo dự án</div><div class="cs">21 mục đang xếp hàng</div>
    <div class="rows">
      <div class="r"><span class="l">tronsave/services</span><span class="tr"><i style="width:100%"></i></span><b>6</b></div>
      <div class="r"><span class="l">savefee-be</span><span class="tr"><i style="width:83.3%"></i></span><b>5</b></div>
      <div class="r"><span class="l">longwavefinder</span><span class="tr"><i style="width:66.6%"></i></span><b>4</b></div>
      <div class="r"><span class="l">game-ai-evolution</span><span class="tr"><i style="width:66.6%"></i></span><b>4</b></div>
      <div class="r"><span class="l">Bé Chơi &amp; Học</span><span class="tr"><i style="width:33.3%"></i></span><b>2</b></div>
    </div>
  </div>
</div>
<p class="spec">
  <b>Chart giữ nguyên luật đã dựng</b> — một chart một màu, chỉ cột đỉnh được ghi số, cột/thanh
  dày tối đa 24px, bo 4px ở đầu dữ liệu và vuông ở chân, lưới nét tóc 1px liền, mỗi chart kèm
  bảng số. Chỉ đổi <b>màu</b>: bỏ amber/cyan/violet, dùng màu nhấn chàm.<br>
  <b>Cột mờ</b> = ngày board đã quên bớt nên đang bị đếm thiếu — giữ nguyên, đây là chỗ chart
  dễ nói dối nhất.
</p>`,
  `.two { display: grid; gap: var(--s3); grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
   .p { padding: var(--s4); }
   .ct { font-size: 14px; font-weight: 600; } .cs { font-size: 12.5px; color: var(--text-3); margin-top: 2px; }
   .plot { display: grid; grid-template-columns: 22px 1fr; gap: 9px; padding: var(--s4) 0 20px; --h: 130px; }
   .y { position: relative; height: var(--h); }
   .y span { position: absolute; right: 0; bottom: var(--p); translate: 0 50%; font: 11px var(--mono); color: var(--text-3); font-variant-numeric: tabular-nums; }
   .area { position: relative; height: var(--h); }
   .gl { position: absolute; left: 0; right: 0; bottom: var(--p); height: 1px; background: var(--border); }
   .cols { position: absolute; inset: 0; display: flex; align-items: flex-end; gap: 2px; }
   .col { position: relative; flex: 1; height: 100%; display: flex; align-items: flex-end; justify-content: center; }
   .col > i { width: min(24px, 100%); background: var(--accent); border-radius: 4px 4px 0 0; }
   .col.dim > i { opacity: 0.4; }
   .pk { position: absolute; left: 50%; bottom: var(--p); translate: -50% 0; margin-bottom: 5px; font: 600 12px var(--mono); }
   .x { position: absolute; top: 100%; left: 50%; translate: -50% 0; margin-top: 6px; font: 11px var(--mono); color: var(--text-3); }
   .rows { margin-top: var(--s4); display: grid; }
   .r { display: grid; grid-template-columns: minmax(0,120px) 1fr 26px; gap: 10px; align-items: center; padding: 6px 0; }
   .r .l { font-size: 12.5px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
   .r .tr { height: 12px; background: var(--surface-3); border-radius: 2px; display: flex; }
   .r .tr > i { background: var(--accent); border-radius: 0 4px 4px 0; }
   .r b { font: 600 12.5px var(--mono); text-align: right; font-variant-numeric: tabular-nums; }`,
);

const screen = page(
  'Màn Dự án', 'Màn', 'Màn Dự án', 'Toàn cảnh — thứ tự nhìn 1 → 2 → 3',
  `<div class="app">
  <nav class="rail">
    <div class="brand">NOW<span>sở chỉ huy</span></div>
    <a class="ni active">Dự án<b>5</b></a><a class="ni">Phiên<b>5</b></a>
    <a class="ni">Quyết định<b class="crit">1</b></a><a class="ni">Đã xong</a>
    <a class="ni">Thống kê</a><a class="ni">Sức khoẻ<b class="warn">2</b></a>
  </nav>
  <main>
    <header class="top">
      <div><h1>Dự án</h1><div class="sub">Cập nhật 10:14 · 5 dự án · 35 phiên</div></div>
      <input class="q" placeholder="Tìm dự án, phiên, quyết định">
      <span class="st ok">Trực tiếp</span>
    </header>
    <div class="scroll">
      <section class="lead">
        <div class="lead-top"><span class="st crit">Đang chặn</span><span class="lead-time">10:14</span></div>
        <p class="lead-say">Có 1 quyết định đang chặn tronsave/services — treo 7 ngày.</p>
        <p class="lead-why">ops_* soak đủ 7 ngày, còn mismatch không? Cho flip enforce theo runbook §5 chưa?</p>
        <div class="lead-act"><button class="btn primary">Chép “chốt enforce-flip”</button><button class="btn quiet">Xem tất cả quyết định →</button></div>
      </section>
      <div class="grid">
        <article class="pc"><header><h3>tronsave/services</h3><span class="st crit">Đang chặn</span></header>
          <div class="meta mono">dev-ready · 16 commit sau mốc</div>
          <div class="body"><div class="label">Đang làm</div>
            <p class="focus">Vận hành ADR 021 buy-dual-resource trên dev → tắt DRY_RUN</p>
            <p class="next"><span class="ar">→</span>Chạy script Task 8 trong Compass shell</p></div>
          <footer><span>1 quyết định · 6 hàng đợi</span><span class="sess">0/22 thức</span></footer></article>
        <article class="pc"><header><h3>longwavefinder</h3><span class="st ok">Ổn</span></header>
          <div class="meta mono">main · sạch</div>
          <div class="body"><div class="label">Đang làm</div>
            <p class="focus">Dashboard đã lên web — chờ buổi sáng tự động đầu tiên</p>
            <p class="next"><span class="ar">→</span>Sáng mai sau 7:20 mở data/daily.log</p></div>
          <footer><span>4 hàng đợi</span><span class="sess">1/3 thức</span></footer></article>
        <article class="pc"><header><h3>savefee-be</h3><span class="st warn">Cần cập nhật</span></header>
          <div class="meta mono">feat/adr011 · 8 ngày trước</div>
          <div class="body"><div class="label">Đang làm</div>
            <p class="focus">PR #91 — metrics &amp; observability ADR 011, chờ merge</p>
            <p class="next"><span class="ar">→</span>Review + merge PR #91</p></div>
          <footer><span>3 quyết định · 5 hàng đợi</span><span class="sess">0/5 thức</span></footer></article>
      </div>
    </div>
  </main>
</div>
<p class="spec" style="max-width:900px">
  <b>Thứ tự nhìn giờ chỉ có ba tầng.</b> ① Khối tóm tắt — nền sáng hơn, viền trái màu trạng thái,
  chữ 19px, là thứ duy nhất được to. ② Lưới thẻ dự án — cùng một cỡ, phân biệt nhau bằng chấm
  trạng thái. ③ Chữ phụ và mono — lùi hẳn về sau.<br>
  Bản cũ chen giữa ① và ② một dải XP + hạng + chuỗi ngày rộng ngang và cũng sáng, nên mắt
  không biết dừng ở đâu. Dải đó bỏ hẳn; số liệu thật đã có màn Thống kê.
</p>`,
  `.app { display: grid; grid-template-columns: 216px 1fr; gap: 0; height: 620px;
          background: var(--bg); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; }
   .rail { border-right: 1px solid var(--border); padding: var(--s3); display: grid; gap: 2px; align-content: start; }
   .brand { padding: var(--s2) var(--s3) var(--s4); font-size: 14px; font-weight: 700; }
   .brand span { display: block; font-size: 11.5px; font-weight: 400; color: var(--text-3); }
   .ni { display: flex; align-items: center; padding: 8px var(--s3); border-radius: var(--r-sm); font-size: 13.5px; color: var(--text-2); }
   .ni.active { background: var(--surface-3); color: var(--text); font-weight: 500; }
   .ni b { margin-left: auto; font: 500 12px var(--mono); color: var(--text-3); }
   .ni b.crit { color: var(--crit); } .ni b.warn { color: var(--warn); }
   main { display: flex; flex-direction: column; min-width: 0; }
   .top { display: flex; align-items: center; gap: var(--s4); padding: var(--s3) var(--s5); border-bottom: 1px solid var(--border); }
   .top h1 { font-size: 18px; } .sub { font-size: 12.5px; color: var(--text-3); margin-top: 2px; }
   .q { margin-left: auto; width: 250px; padding: 7px 11px; border-radius: var(--r-sm);
        background: var(--surface); border: 1px solid var(--border); color: var(--text); font: 13px var(--sans); outline: none; }
   .scroll { padding: var(--s4) var(--s5); overflow: hidden; }
   .lead { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--crit);
           border-radius: var(--r); padding: var(--s4) var(--s5) var(--s5); margin-bottom: var(--s4); }
   .lead-top { display: flex; align-items: center; margin-bottom: var(--s3); }
   .lead-time { margin-left: auto; font: 12px var(--mono); color: var(--text-3); }
   .lead-say { margin: 0; font-size: 19px; line-height: 1.5; font-weight: 500; max-width: 62ch; }
   .lead-why { margin: var(--s2) 0 0; font-size: 13.5px; color: var(--text-2); }
   .lead-act { display: flex; gap: var(--s2); margin-top: var(--s4); }
   .grid { display: grid; gap: var(--s3); grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); align-items: start; }
   .pc { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); }
   .pc header { display: flex; align-items: center; gap: var(--s2); padding: var(--s3) var(--s3) 0; }
   .pc h3 { font-size: 14.5px; flex: 1; min-width: 0; }
   .pc .meta { padding: 4px var(--s3) 0; font-size: 11.5px; color: var(--text-3); }
   .pc .body { padding: var(--s3) var(--s3) 0; }
   .pc .focus { margin: 4px 0 var(--s3); font-size: 13.5px; line-height: 1.5; }
   .pc .next { margin: 0; display: flex; gap: 8px; font-size: 12.5px; color: var(--text-2);
               background: var(--surface-2); border-radius: var(--r-sm); padding: 8px 10px; }
   .pc .next .ar { color: var(--accent-ink); flex: none; }
   .pc footer { display: flex; padding: var(--s3); font-size: 12px; color: var(--text-3); }
   .pc footer .sess { margin-left: auto; }`,
);

/* ── Ghi ──────────────────────────────────────────────────────────────────── */

const FILES = {
  'foundations/color.html': color,
  'foundations/color-dark.html': colorDark,
  'foundations/type.html': type,
  'components/summary.html': summary,
  'components/project-card.html': projectCard,
  'components/nav.html': nav,
  'components/table.html': table,
  'charts/charts.html': charts,
  'screens/overview.html': screen,
};

// `node design/build.mjs --css` in ra khối token sẵn để dán vào public/styles.css.
// Đây là cách token đi từ hệ thiết kế sang app mà không phải gõ lại từng hex.
if (process.argv.includes('--css')) {
  console.log(`/* Sinh từ design/tokens.json — đừng sửa tay, sửa ở đó rồi chạy lại. */`);
  console.log(TOKEN_BLOCK);
  process.exit(0);
}

for (const [rel, body] of Object.entries(FILES)) {
  const file = path.join(OUT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, 'utf8');
  console.log('  ✓', rel);
}

// Chữ dưới 4.5:1 là lỗi đọc được, không phải chuyện gu — chính nó là một nửa lý do
// bản cũ bị chê "chữ nhỏ khó đọc". Báo ngay lúc dựng, đừng để lọt vào preview.
// Hai nền phải kiểm riêng: một bậc chữ đạt trên nền sáng có thể trượt trên nền tối.
//
// Và phải kiểm trên MỌI tầng nền, không riêng nền thẻ. Bản trước chỉ đo với
// `--surface` nên `--text-3` lọt lưới: 4,8:1 trên thẻ trắng nhưng chỉ 4,3:1 trên
// nền trang — mà nhãn mờ nằm thẳng trên nền trang ở khắp các màn. Đo chỗ dễ nhất
// rồi tuyên bố đạt thì cái cổng này không chặn được gì.
const SURFACES = ['bg', 'surface', 'surface-2', 'surface-3'];
let failed = 0;
for (const theme of ['light', 'dark']) {
  for (const c of T.color.filter((x) => x.name.startsWith('text'))) {
    for (const s of SURFACES) {
      const bgv = T.color.find((x) => x.name === s)[theme];
      const r = contrast(c[theme], bgv);
      if (r < 4.5) {
        failed++;
        console.log(
          `  ⚠ --${c.name} chỉ ${r.toFixed(1)}:1 trên --${s} (${theme}) — dưới ngưỡng AA 4.5:1`,
        );
      }
    }
  }
}
if (!failed) console.log('  ✓ ba bậc chữ đạt AA 4.5:1 trên cả 4 tầng nền, ở cả hai nền');

console.log(`\n${Object.keys(FILES).length} file → ${OUT}`);
console.log(`Dán token vào app:  node design/build.mjs --css\n`);
