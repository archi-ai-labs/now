/**
 * Quản gia — nhân vật chính của trang.
 *
 * Nói HAI câu, và đưa luôn NÚT để làm việc mỗi câu vừa nói. Cả dashboard đọc trong 30
 * giây, nhưng khối này đọc trong 3 giây: liếc một cái rồi đi thì đây là thứ sếp mang
 * theo — nên nó phải to nhất trang và phải hành động được ngay.
 *
 * ## Vì sao HAI câu chứ không phải một
 *
 * Bản trước có đúng một chỗ nói, nên hai loại việc phải tranh nhau nó: hạn mức thắng khi
 * sắp bị chặn, quyết định thắng những lúc còn lại. Cách sắp ấy sai ở chỗ **chúng không so
 * được với nhau**. Một quyết định treo ba ngày và một cửa sổ sắp bỏ phí 82% không nằm
 * trên cùng một thang gấp; ép chúng vào một thang thì thứ thua cuộc biến mất hoàn toàn
 * khỏi trang, mà nó có biến mất đâu — nó vẫn đang chờ đúng ở đó.
 *
 * Nên giờ có hai ô cố định, mỗi ô một loại việc:
 *
 * 1. **Việc đáng làm** — quyết định nóng → board hết hạn → worktree sắp mất → chờ người
 *    khác quá lâu → không gì chặn thì chỉ thẳng việc kế tiếp. Thứ tự này là thứ tự "cái
 *    gì thực sự khoá tay sếp lại".
 * 2. **Hạn mức token** — LUÔN nói, kể cả ngày đẹp trời. Đây là chỗ đổi lớn nhất: hạn mức
 *    không cộng dồn, nên tiêu không hết là mất trắng, mà "mất trắng" thì không có mốc
 *    nào để tự kêu lên — nó chỉ lặng lẽ xảy ra lúc reset. Im lặng cho tới lúc sắp chặn
 *    là báo cáo đúng cái nửa ít tốn kém hơn của vấn đề.
 *
 * Ô hai vì thế nhắc CHĂM hơn khi đang bỏ phí, và nhẹ giọng đi khi nhịp đã đúng đích —
 * ngược hẳn với một cái đồng hồ đo xăng.
 *
 * Từ ngữ cố ý dùng **đúng thuật ngữ** sếp sẽ nói lại với Claude (`chốt <mã>`,
 * `/now update`, worktree, phiên) — quản gia phải củng cố vốn từ đó chứ không
 * được dạy sếp một bộ từ riêng rồi lúc mở terminal lại quên mất từ thật.
 */

import { t } from './i18n.js';
import { ago } from './dom.js';
import { bindingOf, forecastText, forecastTip, idleMsOf, paceText, pctText, periodText, proseText, toneOf, verdictOf, windowsOf } from './quota.js';

const hour = () => new Date().getHours();

function greet() {
  const h = hour();
  if (h < 5) return t('butler.greet.late');
  if (h < 11) return t('butler.greet.morning');
  if (h < 14) return t('butler.greet.noon');
  if (h < 18) return t('butler.greet.afternoon');
  if (h < 22) return t('butler.greet.evening');
  return t('butler.greet.late');
}

const shortName = (p) => (p?.name ?? '').replace(/\s*\(.*\)$/, '');

/**
 * Cắt một câu dài về vừa một dòng tiêu đề, cắt ở ranh giới từ.
 *
 * Chỉ dùng cho chữ do NGƯỜI viết trong NOW board — `what` của mục chờ người khác là một
 * ô tự do, và trên máy này nó đang dài 130 ký tự. Nguyên văn nó ở cỡ chữ 21px chiếm ba
 * dòng và đẩy nút xuống dưới tầm mắt, tức là một câu dài làm hỏng chỗ đứng của cái nút
 * mà cả ô này sinh ra để đưa. Toàn văn không mất: nó nằm nguyên ở màn Quyết định, chỗ
 * `goto` của chính slide này chỉ tới.
 */
function clip(s, max = 72) {
  const one = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:—-]+$/, '')}…`;
}

/* ── Ô hai: hạn mức ───────────────────────────────────────────────────────────
   Quản gia báo hạn mức ở HAI tầng, và hai tầng đó trả lời hai câu khác nhau:

   - **Dải bên phải** — "đã tiêu bao nhiêu, nhịp này sẽ đi tới đâu" cho TỪNG cửa sổ. Đây
     là bảng số để liếc, không phải một lời nhắc.
   - **Ô hai** — một cửa sổ duy nhất, cửa sổ đáng nói nhất, kèm việc làm được với nó. */

/**
 * Model rẻ hơn một bậc — hành động DUY NHẤT thực sự kéo dài được cửa sổ đang cạn.
 *
 * Trả `null` ở bậc thấp nhất thay vì bịa ra một lệnh vô nghĩa: lúc đó câu trung thực
 * là "nghỉ tới lúc reset", và quản gia nói đúng câu đó.
 */
function cheaperThan(name) {
  const k = String(name ?? '').toLowerCase();
  if (/haiku/.test(k)) return null;
  if (/sonnet/.test(k)) return 'haiku';
  return 'sonnet';
}

/**
 * Model ĐẮT hơn một bậc — chiều ngược lại, và nó cũng là một hành động thật.
 *
 * Bỏ phí không sửa được bằng cách ngồi mong; nó sửa được bằng cách để mỗi lượt tiêu
 * nhiều hơn. Ở bậc đắt nhất thì không còn nấc nào để lên, và câu trung thực lúc đó là
 * "giao thêm việc", không phải một lệnh — nên trả `null` chứ không bịa.
 */
function richerThan(name) {
  const k = String(name ?? '').toLowerCase();
  if (/opus/.test(k)) return null;
  if (/haiku/.test(k)) return 'sonnet';
  return 'opus';
}

/** Model đang tiêu nhiều nhất — dùng khi cửa sổ nói tới là khung chung, không gắn model nào. */
const topModel = (state) => (state.usage?.ok ? (state.usage.models?.[0]?.key ?? null) : null);

/**
 * Chủ ngữ của câu hạn mức là KỲ HẠN, không phải tên cửa sổ.
 *
 * "Khung 5 giờ … dự phóng phiên 5h này 58%" nói đúng một thứ hai lần trong một câu, vì
 * `entry.short` của hai khung chung CHÍNH LÀ chiều dài cửa sổ. Nhưng bỏ kỳ hạn đi thì
 * khung theo model lại hụt: "Khung Fable" không nói được nó dài bao lâu, mà đó lại là
 * thứ duy nhất làm con số dự phóng có nghĩa.
 *
 * Nên đảo lại: kỳ hạn làm chủ ngữ ở MỌI ca, còn tên model — thứ kỳ hạn không chở được —
 * chỉ chêm vào khi có. Ra "Phiên 5h này…" và "Tuần này của Fable…", không ca nào lặp.
 */
function burnSubject(entry) {
  const period = periodText(entry.w);
  const s = entry.w.model ? t('butler.burnOfModel', { period, model: entry.w.model }) : period;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Ô HAI — hạn mức token, và nó nói mọi lượt.
 *
 * Một câu cho mỗi băng của thang bỏ phí (xem `verdictOf` trong `quota.js`), và giọng đi
 * theo đúng băng ấy. Hai băng bỏ phí được nói dài hơn hai băng còn lại, có chủ đích:
 * `full` và `over` là tin tốt, mà tin tốt chỉ cần một dòng xác nhận rồi thôi — kể dài về
 * chúng là dạy sếp bỏ qua cả ô này.
 *
 * Việc làm được cũng đảo chiều theo băng, vì hai đầu thang hỏng theo hai kiểu ngược nhau:
 * đang bỏ phí thì đề xuất model ĐẮT hơn (mỗi lượt tiêu nhiều hơn), đang cạn sớm rồi ngồi
 * không thì đề xuất model RẺ hơn (kéo dài cửa sổ). Ở giữa thì không có gì để làm, và im
 * lặng đúng chỗ đó là cách giữ cho hai đầu còn đáng tin.
 */
function burnLead(state) {
  const entry = bindingOf(state.quota);
  if (!entry) {
    return { tone: 'mute', text: t('butler.burnNone'), why: t('butler.burnNoneWhy'), action: null, goto: 'usage' };
  }

  const w = entry.w;
  const f = w.forecast;
  const subject = burnSubject(entry);
  const used = pctText(w.used);
  const tone = toneOf(w);
  const goto = 'usage';
  // Dòng lý do KHÔNG được nhắc lại dự phóng: bốn câu chính dưới đây đều đã mang con số
  // ấy, và bản trước để cả hai cùng nói "giữ nhịp thì lúc reset (3 ngày nữa) là 71%" —
  // hai dòng liền nhau chép nguyên một mệnh đề của nhau thì dòng thứ hai không được đọc.
  // Nó giữ đúng hai thứ câu chính không có: nhịp tiêu, và mốc reset tuyệt đối.
  const why = f?.known ? t('butler.quotaWhy', { pace: paceText(w), reset: ago(w.resetsInMs) }) : forecastText(w);

  if (!f?.known) {
    return { tone: 'mute', text: t('butler.burnBlind', { subject, used }), why, action: null, goto };
  }

  const verdict = verdictOf(w);

  if (verdict === 'over') {
    const idle = idleMsOf(w);
    const swap = cheaperThan(w.model ?? topModel(state));
    return {
      tone,
      text: idle
        ? t('butler.burnIdle', {
            subject,
            used,
            in: f.exhaustInMs < 60_000 ? t('qf.now') : ago(f.exhaustInMs),
            stuck: ago(idle),
          })
        : t('butler.burnFull', { subject, used, projected: pctText(f.projected) }),
      why,
      // Nút chỉ có mặt ở ca ngồi không. Cạn sát reset là hạ cánh đẹp — gợi ý đổi model
      // ở đó là bảo sếp sửa một thứ đang chạy đúng.
      action: idle && swap ? { label: `/model ${swap}`, copy: `/model ${swap}`, hint: t('butler.quotaSwap') } : null,
      goto,
    };
  }

  if (verdict === 'full') {
    return { tone, text: t('butler.burnOnTarget', { subject, used, projected: pctText(f.projected) }), why, action: null, goto };
  }

  const up = richerThan(w.model ?? topModel(state));
  return {
    tone,
    text: t(verdict === 'cold' ? 'butler.burnCold' : 'butler.burnSlack', {
      subject,
      used,
      waste: pctText(100 - f.projected),
      projected: pctText(f.projected),
    }),
    // Hết nấc model để lên thì ô này KHÔNG được im. Không có nút không có nghĩa là không
    // có việc phải làm — nó chỉ có nghĩa việc phải làm không gói được vào một lệnh dán
    // được. Bỏ trống chỗ đó là để một ô đang báo "sắp mất nửa hạn mức" kết thúc bằng
    // đúng một dấu chấm.
    why: up ? why : `${why} ${t('butler.burnNoLever')}`,
    action: up ? { label: `/model ${up}`, copy: `/model ${up}`, hint: t('butler.burnSpendMore') } : null,
    goto,
  };
}

/**
 * Cảnh báo Cursor và Antigravity — mấy CÂU CHỮ đứng dưới câu chính, KHÔNG phải hàng
 * trong dải bên phải. Dải là chỗ của thứ liếc mỗi ngày, và đó là hạn mức Claude; hai
 * nguồn này đổi chậm hơn cả chục lần, nên chen thanh của chúng vào dải là bắt mắt học
 * thêm hai cái thanh cho một chuyện mỗi tuần mới nói một lần. Một câu văn xuôi nói đủ:
 * tên, đã tiêu, và kết cục — số chi tiết vẫn nằm trong tooltip của chính câu đó.
 *
 * Luật CHEN VÀO: chỉ xuất hiện khi có BỎ PHÍ, và không bao giờ là câu chính — bỏ phí
 * không gấp.
 *
 * Với Antigravity chỉ lấy khung TUẦN, bỏ khung 5 giờ: một buổi không mở Antigravity
 * thì khung 5 giờ của nó đương nhiên trống — báo "bỏ phí" mỗi 5 tiếng cho một app
 * không dùng thường xuyên là biến cảnh báo thành tiếng ồn, còn khung tuần mới là thứ
 * đã trả tiền mà có thể cứu kịp. Cursor thì cả chu kỳ (tháng) là một cửa sổ duy nhất.
 */
export function toolLines(state) {
  return (
    toolWindows(state)
      // CHỈ hai băng bỏ phí. Băng `cheer` — nhịp đòi nhiều hơn cả cửa sổ có — từng được
      // nói ở đây, và bị gỡ ngày 4/8 vì nó là câu duy nhất trên popover báo một tai hoạ
      // ("cạn sau 12 giờ, rồi ngồi không 6 ngày") dựa trên mảnh bằng chứng mỏng nhất:
      // với khung TUẦN của Antigravity, mười hai tiếng đầu đã đủ qua cửa `qf.early`, nên
      // một buổi làm mạnh là ngoại suy ra cả tuần cháy sạch. Nói sai về phía hoảng loạn,
      // mỗi ngày một lần, thì lần thứ ba người đọc bỏ qua cả khối chữ này.
      //
      // Con số ấy KHÔNG mất: màn/tab Token vẫn bày cả ba công cụ không lọc băng nào
      // (`toolWindows` ngay dưới), và tooltip của chính dòng này vẫn có đủ.
      .filter((r) => r.tone === 'crit' || r.tone === 'warn')
      .map((r) => ({
        key: r.key,
        tone: r.tone,
        // `proseText`, không phải `forecastText`: dòng này đứng MỘT MÌNH, không có thanh
        // nào bên cạnh để hai vế "dự phóng X" và "bỏ phí Y" trỏ vào hai chỗ khác nhau.
        text: t('butler.toolLine', { name: r.short, used: pctText(r.w.used), line: proseText(r.w) }),
        tip: forecastTip(r),
      }))
  );
}

/**
 * Cửa sổ hạn mức của Cursor và Antigravity — CHƯA lọc, còn nguyên `w` để vẽ thanh.
 *
 * Tách khỏi `toolLines` vì hai chỗ dùng cần hai thứ khác nhau. Quản gia cần mấy CÂU và
 * chỉ khi có chuyện — im lặng là đúng ở đó. Còn màn/tab Token thì ngược lại: mở nó ra là
 * để đối chiếu ba công cụ, mà một công cụ vắng mặt vì "đang yên" thì người đọc không
 * phân biệt được với "không đọc được sổ của nó".
 */
export function toolWindows(state) {
  const rows = [];
  const c = state.cursor;
  if (c?.ok && c.total?.used != null && !c.total.expired) {
    // `short` mang tên công cụ vì quản gia nói một câu đứng lẻ ("Cursor đã tiêu 82%…").
    // `win` thì bỏ tên ấy đi, dành cho chỗ đã có tiêu đề công cụ ở trên — dưới một cái
    // đầu đề "CURSOR" mà mỗi hàng lại mở bằng "Cursor" thì cái tên chiếm chỗ hai lần.
    // Tên viết ĐỦ, không viết tắt: xem chú thích ở nhánh Antigravity ngay dưới.
    rows.push({ key: 'cursor', label: `Cursor · ${t('tools.bTotal')}`, short: 'Cursor', win: t('tools.bTotal'), w: c.total, overLabel: 'tools.rowOver' });
  }
  const ag = state.agQuota;
  if (ag?.ok) {
    for (const g of ag.groups ?? []) {
      for (const b of g.buckets ?? []) {
        if (b.window !== 'weekly' || b.expired) continue;
        rows.push({
          key: `ag-${b.key}`,
          label: `Antigravity · ${g.name ?? b.label}`,
          // "Antigravity", không phải "AG". Câu này đứng lẻ trong ô quản gia và trong
          // tab Việc của popover — hai chỗ KHÔNG có tiêu đề công cụ nào ở trên để suy ra
          // chữ tắt là gì. Mà tên nhóm đi kèm lại là "Gemini Models", tức là "AG · Gemini
          // Models" mời người đọc hiểu AG là một thứ gì đó của Google. Chín ký tự đổi lấy
          // việc câu không cần chú giải là một món hời.
          short: g.name ? `Antigravity · ${g.name}` : 'Antigravity',
          win: g.name ?? b.label,
          w: b,
        });
      }
    }
  }
  return rows.map((r) => ({ ...r, verdict: verdictOf(r.w), tone: toneOf(r.w) }));
}

/**
 * Ô một trưng tối đa ngần này việc, tự xoay vòng — xem `scheduleSpin` trong `app.js`.
 *
 * Ba, không phải tất cả. Ô này là thứ đọc trong 3 giây; một danh sách dài bằng số việc
 * đang chờ thì nó thôi là một câu và thành cái danh sách mà cả bốn màn bên dưới đã làm
 * kỹ hơn. Ba là đủ để loại việc thứ hai và thứ ba thôi biến mất khỏi trang — đúng chỗ
 * hỏng của bản chỉ-một-câu — mà vẫn chưa phải cuộn.
 *
 * Và ba là trần, KHÔNG phải chỉ tiêu: hết thứ đang chặn thì ô này nói một việc rồi thôi.
 * Kéo thêm việc kế tiếp với mục hàng đợi vào cho đủ ba thì ngày nào ô cũng đầy, mà một ô
 * ngày nào cũng đầy thì dòng thứ ba thành thứ mắt tự bỏ qua — và nó kéo theo cả hai dòng
 * trên cùng mất giá.
 */
const WORK_SLIDES = 3;

/**
 * Hai ô, cộng dải hạn mức và mấy câu nguồn ngoài.
 *
 * `works` và `burn` KHÔNG bao giờ tranh nhau chỗ nữa, nên hàm này không còn phép so nào
 * giữa hai loại việc — đó chính là điều nó vừa thôi làm.
 */
export function briefing(state, { greet: withGreet = true } = {}) {
  const rows = windowsOf(state.quota);
  const binding = bindingOf(state.quota);
  return {
    works: pickLeads(state, withGreet),
    burn: burnLead(state),
    quota: { rows, binding, tone: binding?.tone ?? 'mute' },
    tools: toolLines(state),
  };
}

/**
 * Việc đáng làm, xếp theo "cái gì thực sự khoá tay sếp lại" — nay trả về NHIỀU việc.
 *
 * Bản trước dừng ở việc đầu tiên khớp. Cách ấy sai đúng cái kiểu mà lỗi số 3 ở đầu file
 * đã sửa cho hai LOẠI việc, chỉ là lần này ở bên trong một loại: board cũ và worktree
 * trong /tmp không so được với một quyết định treo bốn ngày, nhưng chúng cũng không biến
 * mất chỉ vì có quyết định treo — chúng vẫn đang hỏng đúng ở đó. Xếp hạng rồi vứt phần
 * còn lại là báo cáo mỗi hạng nhất.
 *
 * Mỗi hạng mục vẫn gói vào MỘT câu như cũ, không nở ra một slide cho từng board cũ: câu
 * "3 board đã cũ (a, b)" đã tự chở con số, và nút của nó (`/now update`) là một lệnh chạy
 * ở đâu cũng được. Chỉ hạng mục nào có nút RIÊNG cho từng món mới đáng tách ra, mà hiện
 * chưa hạng mục nào như thế.
 *
 * Hai hạng cuối — việc kế tiếp, và chưa có board nào — vẫn là ĐƯỜNG LUI, không phải một
 * slide xếp cùng hàng: câu của chúng mở bằng "Không có gì chặn sếp", nói cạnh một quyết
 * định đang treo thì thành nói dối. Có việc chặn thì chúng im.
 */
function pickLeads(state, withGreet) {
  const s = state.stats;
  const out = [];

  // 1. Quyết định nóng — thứ duy nhất khoá tay sếp lại.
  const hot = state.decisions.filter((d) => d.heat === 'now');
  if (hot.length) {
    const top = hot.reduce((a, b) => ((b.ageDays ?? 0) > (a.ageDays ?? 0) ? b : a));
    const id = top.id ? `“${top.id}”` : `“${top.title}”`;
    out.push({
      key: 'hot',
      tone: 'alert',
      text: t('butler.hot', { n: hot.length, id, ageDays: top.ageDays ?? 0, project: top.project }),
      why: top.question || top.title,
      action: top.id ? { label: `chốt ${top.id}`, copy: `chốt ${top.id}: `, hint: t('butler.sayAtProject') } : null,
      goto: 'decisions',
      subject: top,
    });
  }

  // 2. Board hết hạn — sếp đọc nó lúc quay lại thì sẽ đi nhầm hướng.
  const stale = state.projects.filter((p) => p.health === 'stale' || p.health === 'broken');
  if (stale.length) {
    const names = stale.slice(0, 2).map(shortName).join(', ');
    out.push({
      key: 'stale',
      tone: 'warn',
      text: t('butler.stale', { n: stale.length, names }),
      why: t('butler.staleWhy', { ageDays: stale[0].ageDays, drift: stale[0].git.driftCommits ?? 0 }),
      action: { label: '/now update', copy: '/now update', hint: t('butler.runAt', { name: shortName(stale[0]) }) },
      goto: 'health',
    });
  }

  // 3. Worktree trong /tmp — reboot một cái là mất công.
  const tmp = state.projects.flatMap((p) => (p.git.worktrees ?? []).filter((w) => w.inTmp).map((w) => ({ w, p })));
  if (tmp.length) {
    const { w, p } = tmp[0];
    out.push({
      key: 'tmp',
      tone: 'warn',
      text: t('butler.tmp', { wname: w.name, name: shortName(p) }),
      why: t('butler.tmpWhy', { branch: w.branch ?? t('wt.detached'), dirty: w.dirty ?? 0 }),
      action: { label: 'git worktree move', copy: `git -C ${p.path} worktree move ${w.path} `, hint: t('butler.moveSafe') },
      goto: 'health',
    });
  }

  // 4. Quyết định sắp phải quyết — `soon`, không phải `now`.
  //
  // Trước đây chỉ `now` được lên đây, và trên máy này ra đúng cái kết cục mà cách đó
  // phải ra: 24 quyết định đang treo, KHÔNG cái nào `now`, nên quản gia im hoàn toàn về
  // quyết định. `soon` không khoá tay sếp lại như `now` — nên nó đứng SAU board cũ và
  // worktree, hai thứ hỏng ngay hôm nay — nhưng im lặng về nó là báo cáo thiếu, không
  // phải báo cáo gọn.
  //
  // Không đặt ngưỡng tuổi: xếp theo tuổi rồi lấy cái đầu. Mọi con số ranh giới ở đây đều
  // là trị bịa ra, và trị bịa ra thì sẽ phải chỉnh mãi — trong khi "cũ nhất" thì luôn
  // đúng, và số đếm đi kèm đã tự nói cả đống còn lại.
  const soon = state.decisions.filter((d) => d.heat === 'soon');
  if (soon.length) {
    const top = soon.reduce((a, b) => ((b.ageDays ?? 0) > (a.ageDays ?? 0) ? b : a));
    const id = top.id ? `“${top.id}”` : `“${clip(top.title, 48)}”`;
    out.push({
      key: 'soon',
      tone: 'warn',
      text: t('butler.soon', { n: soon.length, id, ageDays: top.ageDays ?? 0, project: top.project }),
      why: clip(top.question || top.title, 120),
      action: top.id ? { label: `chốt ${top.id}`, copy: `chốt ${top.id}: `, hint: t('butler.sayAtProject') } : null,
      goto: 'decisions',
      subject: top,
    });
  }

  // 5. Chờ người khác — xếp theo tuổi, không lọc theo ngưỡng.
  //
  // Ngưỡng `nudge` (7 ngày, `WAITING_NUDGE_DAYS`) không biến mất, nó chỉ thôi làm cái
  // cửa: hai mục QA trên máy này đứng 6 ngày, hụt đúng một ngày, và biến mất khỏi trang
  // vì đúng một ngày ấy. Giờ ngưỡng chỉ còn quyết định GIỌNG — quá hạn thì nói thẳng
  // "nhắc được rồi", chưa quá thì chỉ thuật lại sự việc. Một câu khuyên nhắc người khác
  // lúc mới ngày thứ hai là một câu sai, còn giấu luôn cái mục ấy đi cũng là một câu sai.
  const waits = [...state.waiting].sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));
  if (waits.length) {
    const w = waits[0];
    out.push({
      key: 'nudge',
      tone: w.nudge ? 'warn' : 'calm',
      text: t(w.nudge ? 'butler.nudge' : 'butler.waiting', {
        who: w.who,
        what: clip(w.what),
        ageDays: w.ageDays ?? 0,
      }),
      why: t('butler.nudgeWhy', { project: w.project }),
      // Ô này KHÔNG có lệnh nào để chép — skill `now` không có động từ cho mục chờ, khác
      // hẳn `chốt <mã>` và `/now update`. Nhưng "không có lệnh" không phải là "không có
      // gì để đưa": câu trên vừa bị `clip` cắt mất đuôi, nên thứ đáng đưa chính là bản
      // đầy đủ, dán thẳng được vào tin nhắn cho người đang giữ.
      //
      // Định dạng bám đúng dòng mà `/now update` render ra trong NOW.md (`{who} — {what}
      // · từ {since}`), để chép ở đây với chép từ file ra cùng một chuỗi.
      action: {
        label: t('butler.waitCopy'),
        copy: `${w.who} — ${String(w.what ?? '').replace(/\s+/g, ' ').trim()}${w.since ? ` · từ ${w.since}` : ''}`,
        hint: t('butler.waitCopyHint'),
      },
      goto: 'decisions',
    });
  }

  // 6. Không gì chặn — chỉ thẳng việc kế tiếp thay vì khen "mọi thứ ổn".
  if (!out.length) {
    const lead = state.projects.find((p) => p.now?.focus?.nextAction);
    const late = hour() >= 22 || hour() < 5;
    out.push(
      lead
        ? {
            key: 'lead',
            tone: late ? 'night' : 'calm',
            text: t('butler.lead', { late, awake: s.awake, name: shortName(lead) }),
            why: lead.now.focus.nextAction,
            action: {
              label: t('butler.leadAction'),
              copy: lead.now.focus.resume?.howToContinue || t('butler.leadAction'),
              hint: t('butler.openClaudeAt', { name: shortName(lead) }),
            },
            goto: null,
          }
        : {
            key: 'noboard',
            tone: 'calm',
            text: t('butler.noboard'),
            why: t('butler.noboardWhy'),
            action: { label: '/now update', copy: '/now update', hint: t('butler.runAnywhere') },
            goto: 'health',
          },
    );
  }

  // Lời chào đứng ở slide ĐẦU và chỉ ở đó. Nó chào một lần lúc sếp tới, không phải một
  // phần của câu "có 2 quyết định chờ sếp" — bấm sang slide hai mà bị chào lại lần nữa
  // thì lời chào thành tiếng ồn, và nó còn ăn mất chỗ của chữ đang phải nói việc.
  //
  // Popover thanh menu tắt hẳn nó (`greet: false`): ở đó câu bị kẹp còn hai dòng, mà
  // "Chào buổi tối, sếp." chiếm gần trọn dòng đầu — lời chào là nghi thức của một trang
  // sếp MỞ RA, không phải của một ô sếp LIẾC QUA.
  if (!withGreet) return out.slice(0, WORK_SLIDES);
  const g = greet();
  return out.slice(0, WORK_SLIDES).map((x, i) => (i === 0 ? { ...x, text: `${g}. ${x.text}` } : x));
}

