/**
 * Báo cáo dán được — cả màn đang xem thành một khối Markdown, để gửi sang một AI
 * khác phân tích.
 *
 * ## Vì sao quét DOM chứ không dựng lại từ `state`
 *
 * Dựng báo cáo từ `s.usage` thì phải chép lại toàn bộ nhãn, thứ tự, `fmt`, và mọi
 * ngưỡng lọc của `views/usage.js` — hai bản mô tả cùng một màn, và bản thứ hai sẽ
 * lệch ngay ở lần thêm chart tiếp theo mà không có gì báo. Còn cái đã vẽ ra thì đã
 * mang sẵn đúng ba thứ báo cáo cần: nhãn theo NGÔN NGỮ đang bật, số theo đúng
 * `fmt` người dùng đang đọc, và **bảng số song sinh** — nơi `tableTwin` đã để dành
 * trị chính xác của từng chart.
 *
 * Nên báo cáo = cái người dùng đang thấy, không phải một cách kể khác về cùng dữ
 * liệu. Thêm chart mới có bảng số thì nó tự vào báo cáo, không cần sửa file này.
 *
 * ## Vì sao có khối "cách đọc" ở đầu
 *
 * Số ở màn Token đọc thẳng thì SAI: $4.535 không phải hoá đơn (tài khoản trả theo
 * gói thuê bao, bảng giá do dashboard tự dán), và cache đọc gấp hơn hai trăm lần
 * token sinh ra nên mọi tổng "token" đều bị nó nuốt. Một AI nhận bảng số trần sẽ
 * kết luận "bạn đang tiêu $4.535, hãy cắt giảm" — đúng phép tính, sai chuyện.
 * Cảnh báo ấy phải đi CÙNG số, trong cùng một lần dán.
 *
 * ## Tách hai tầng
 *
 * `scrapeView` chạm DOM; `renderReport` là hàm thuần đổi khối thành Markdown. Chỗ
 * dễ sai là tầng sau (thoát ký tự bảng, hàng thiếu ô, khối rỗng), nên tầng sau
 * test được ở Node mà không cần dựng cả một cái DOM giả.
 */

import { html } from './dom.js';
import { t } from './i18n.js';
import { flatTip } from './tip.js';

/**
 * Nút chép báo cáo. Đứng cạnh nút phong cách, và vì đúng lý do đó: phạm vi của nó
 * là MÀN NÀY, không phải cả trang — nhét lên thanh công cụ chung thì nó tự hứa một
 * tầm ảnh hưởng nó không có (xem `skinSwitch` trong `lib/chart.js`).
 *
 * Nút phong cách đổi hình mấy chart bên dưới, nút này chép số của mấy chart ấy —
 * hai dụng cụ của cùng một khối, nên chúng ở cùng một chỗ.
 *
 * ## Vì sao `data-tip` chứ không phải `title`
 *
 * `title` gốc của trình duyệt hiện sau ~1 giây, một dòng, không xuống hàng được, và
 * không style theo được. Nút này phải nói ba thứ trước khi người ta dám bấm — chép
 * CÁI GÌ, ra ĐỊNH DẠNG nào, rồi LÀM GÌ với nó — nên nó cần đúng cái tooltip có cấu
 * trúc mà mọi cột chart trong app đã dùng. `aria-label` mang bản một dòng của cùng
 * nội dung, nên lối đọc bằng trình đọc màn hình không mất gì.
 */
export function reportBtn(view) {
  const tip = t('report.tip');
  return html`<button type="button" class="skin-b rp" data-report="${view}" data-tip="${tip}" aria-label="${flatTip(tip)}">
    <i class="si" aria-hidden="true">⧉</i>${t('report.btn')}
  </button>`;
}

/** Khối "cách đọc" của từng màn. Màn không có mặt ở đây thì báo cáo không có khối này. */
const HOWTO = { usage: 'report.howUsage', stats: 'report.howStats', lookback: 'report.howLookback' };

const clean = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * Quét màn đang vẽ thành các khối trung gian.
 *
 * `querySelectorAll` trả về theo THỨ TỰ TÀI LIỆU, nên báo cáo giữ đúng mạch đọc của
 * màn — không cần biết trước màn có bao nhiêu khối hay chúng lồng nhau thế nào.
 */
export function scrapeView(root) {
  if (!root) return [];
  const blocks = [];
  for (const el of root.querySelectorAll('.tabs, .q-panel, .player-stats, .sec-h, section.ch, p.ch-note, .empty')) {
    // Thanh tab sinh ra một tiêu đề mang tên tấm ĐANG mở. Không có nó thì báo cáo của màn
    // Token im lặng về chuyện mình chỉ chứa một trong ba công cụ — bên nhận đọc mấy bảng
    // Cursor rồi kết luận về "toàn bộ chi phí AI", đúng cái phép cộng ba đơn vị mà cả màn
    // dựng lên để chống. Chỉ tấm đang mở có mặt trong DOM, nên đây cũng là chỗ duy nhất
    // còn biết tên nó.
    if (el.matches('.tabs')) {
      const on = clean(el.querySelector('[aria-selected="true"]'));
      if (on) blocks.push({ kind: 'sec', title: on });
      continue;
    }

    // Ghi chú nằm TRONG một chart được khối chart của nó nhận, không phải khối rời:
    // "trần trên" của chart hâm-lại-cache mà rơi xuống sau bảng số thì nó chú thích
    // cho cái bảng đứng trước nó, tức là chú thích sai chỗ.
    if (el.matches('p.ch-note') && el.closest('section.ch')) continue;

    if (el.matches('.q-panel')) {
      blocks.push({
        kind: 'list',
        // Tiêu đề lấy từ CHÍNH khối, không phải một chuỗi cứng: màn Công cụ có hai khối
        // hạn mức của hai nguồn khác nhau, và hai khối cùng đề "Hạn mức" thì báo cáo nói
        // rằng chúng là hai nửa của một thứ.
        title: clean(el.querySelector('.q-head .ulabel')) || t('report.quotaH'),
        rows: [...el.querySelectorAll('.q-card')].map((c) => {
          const label = clean(c.querySelector('.q-lbl'));
          // `aria-label` là bản một dòng của chính tooltip thẻ này (`flatTip`), tức là
          // đã có sẵn cả sáu con số: nhịp %/giờ, dự phóng, bỏ phí, mốc reset tuyệt đối.
          // Thẻ chỉ hiện % to; phần còn lại nằm ở đó, nên báo cáo lấy ở đó.
          //
          // Và lấy CHỈ ở đó. `.q-num` ("3% đã tiêu") đã nằm trong tooltip dưới dạng
          // "Đã tiêu: 3%", còn `flatTip` mở đầu bằng đúng cái nhãn vừa in — chép cả ba
          // vào là mỗi trị đọc hai lần ở hai lối viết, đúng cái lỗi mà thẻ hạn mức đã
          // bỏ công dẹp (xem `quotaCard` trong `views/usage.js`). Chỉ mốc reset TƯƠNG
          // ĐỐI là thứ tooltip không có — nó chỉ giữ giờ tuyệt đối.
          const detail = (c.getAttribute('aria-label') ?? '').replace(/^\s*/, '');
          return {
            label,
            val: clean(c.querySelector('.q-reset')),
            detail: detail.startsWith(`${label} — `) ? detail.slice(label.length + 3) : detail,
          };
        }),
        notes: [...el.querySelectorAll('.q-note')].map(clean).filter(Boolean),
      });
      const age = clean(el.querySelector('.q-age'));
      if (age) blocks.at(-1).notes.unshift(age);
      continue;
    }

    if (el.matches('.player-stats')) {
      blocks.push({
        kind: 'list',
        title: t('report.kpiH'),
        rows: [...el.querySelectorAll('.pstat')].map((p) => ({
          label: clean(p.querySelector('.ulabel')),
          val: clean(p.querySelector('.v')),
        })),
        notes: [],
      });
      continue;
    }

    if (el.matches('.sec-h')) {
      // `> .ulabel` chứ không phải `.ulabel`: nút phong cách và nút báo cáo cũng nằm
      // trong `.sec-h`, và tên của một dụng cụ không phải tên của khối.
      blocks.push({ kind: 'sec', title: clean(el.querySelector(':scope > .ulabel')) });
      continue;
    }

    if (el.matches('.empty')) {
      blocks.push({ kind: 'note', text: [clean(el.querySelector('.msg')), clean(el.querySelector('.hint'))].filter(Boolean).join(' — ') });
      continue;
    }

    if (el.matches('p.ch-note')) {
      blocks.push({ kind: 'note', text: clean(el) });
      continue;
    }

    const tbl = el.querySelector('details.ch-tw table');
    blocks.push({
      kind: 'chart',
      title: clean(el.querySelector('.ch-t')),
      sub: clean(el.querySelector('.ch-s')),
      notes: [...el.querySelectorAll('p.ch-note')].map(clean).filter(Boolean),
      cols: tbl ? [...tbl.querySelectorAll('thead th')].map(clean) : [],
      rows: tbl ? [...tbl.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td')].map(clean)) : [],
    });
  }
  return blocks;
}

/** Ô bảng Markdown: `|` trong nội dung sẽ cắt hàng thành thêm một cột nếu không thoát. */
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|');

function mdTable(cols, rows) {
  if (!cols.length || !rows.length) return [];
  const width = cols.length;
  return [
    `| ${cols.map(cell).join(' | ')} |`,
    `| ${cols.map(() => '---').join(' | ')} |`,
    // Hàng thiếu ô được đệm cho đủ: bảng Markdown lệch số cột thì bên nhận dồn cột
    // sai và mọi trị sau đó đọc thành nhãn của cột khác.
    ...rows.map((r) => `| ${Array.from({ length: width }, (_, i) => cell(r[i] ?? '')).join(' | ')} |`),
  ];
}

/**
 * Khối → Markdown. Hàm thuần, không chạm DOM.
 *
 * `at` là thời điểm của chính dữ liệu (`state.generatedAt`), không phải lúc bấm nút:
 * bảng số có thể đã đứng đó vài chục giây, và bên nhận cần biết số cũ cỡ nào.
 */
export function renderReport({ view, at, blocks = [] }) {
  const out = [`# NOW dashboard — ${t(`nav.${view}`)}`, '', t('report.stamp', { at }), ''];
  if (HOWTO[view]) out.push(t(HOWTO[view]), '');
  out.push(t('report.ask'), '');

  for (const b of blocks) {
    if (b.kind === 'sec') {
      out.push(`## ${b.title}`, '');
      continue;
    }
    if (b.kind === 'note') {
      if (b.text) out.push(b.text, '');
      continue;
    }
    if (b.kind === 'list') {
      out.push(`## ${b.title}`, '');
      // Ô rỗng bị bỏ thay vì in ra thành "**5 giờ**:  — …": cửa sổ chưa biết mốc reset
      // thì không có gì để nói ở đó, và một dấu gạch trống trông như đang hỏng.
      for (const r of b.rows) out.push(`- **${r.label}**: ${[r.val, r.detail].filter(Boolean).join(' — ')}`);
      out.push('');
      for (const n of b.notes ?? []) out.push(`> ${n}`, '');
      continue;
    }
    out.push(`### ${b.title}`, '');
    if (b.sub) out.push(`_${b.sub}_`, '');
    for (const n of b.notes ?? []) out.push(`> ${n}`, '');
    if (b.notes?.length) out.push('');
    const tbl = mdTable(b.cols ?? [], b.rows ?? []);
    if (tbl.length) out.push(...tbl, '');
  }

  // Nhiều dòng trống liền nhau là rác của việc ghép khối, không phải chủ ý — gộp lại
  // rồi cắt đuôi, để đoạn dán vào chỗ khác không mở đầu bằng một khoảng trắng dài.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
