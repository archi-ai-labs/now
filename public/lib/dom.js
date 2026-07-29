import { t, locale } from './i18n.js';

/** Đánh dấu chuỗi đã an toàn, được phép chèn thẳng làm HTML. */
const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: String(s) });

const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => escapeMap[c]);

function interpolate(v) {
  if (v == null || v === false) return '';
  if (v[RAW] !== undefined) return v[RAW];
  if (Array.isArray(v)) return v.map(interpolate).join('');
  return esc(v);
}

/**
 * Template HTML tự thoát ký tự. Nội dung NOW board do người dùng viết nên mọi
 * giá trị chèn vào đều được escape; muốn chèn HTML thật thì bọc bằng `raw()`.
 */
export function html(strings, ...vals) {
  return raw(strings.reduce((acc, s, i) => acc + s + (i < vals.length ? interpolate(vals[i]) : ''), ''));
}

/** Dựng DOM từ kết quả `html` và gắn vào một phần tử. */
export function mount(el, tpl) {
  el.innerHTML = tpl[RAW] ?? String(tpl);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

// ── Định dạng ────────────────────────────────────────────────────────────────

/** Khoảng thời gian đọc kiểu người: "vừa xong", "12 phút", "3 giờ", "2 ngày". */
/**
 * Dưới mốc này `ago()` trả về một MỆNH ĐỀ trọn vẹn ("vừa xong") chứ không phải một
 * khoảng thời gian, nên chỗ nào ghép thêm hậu tố kiểu "… trước" phải tự tránh ra —
 * không thì thành "vừa xong trước". Xuất ra để chỗ đó khỏi chép lại con số.
 */
export const JUST_NOW_MS = 45_000;

export function ago(ms) {
  if (ms == null) return '—';
  const s = Math.max(0, Math.round(ms / 1000));
  if (ms < JUST_NOW_MS) return t('fmt.justnow');
  const m = Math.round(s / 60);
  if (m < 60) return t('fmt.min', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('fmt.hour', { n: h });
  const d = Math.round(h / 24);
  if (d < 30) return t('fmt.day', { n: d });
  return t('fmt.month', { n: Math.round(d / 30) });
}

export const agoFrom = (ts) => (ts == null ? '—' : ago(Date.now() - ts));

export function clock(ts) {
  if (ts == null) return '—';
  return new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(dateStr) {
  const d = Date.parse(`${dateStr}T00:00:00`);
  if (Number.isNaN(d)) return dateStr;
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days === 0) return t('fmt.today');
  if (days === 1) return t('fmt.yesterday');
  if (days < 7) return t('fmt.daysAgo', { n: days });
  return new Date(d).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'numeric' });
}

/** Màu ổn định cho mỗi dự án, suy từ tên — để chip dự án luôn cùng màu ở mọi màn. */
export function hueOf(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return h;
}

/**
 * Chép vào clipboard rồi báo lại bằng chính nút vừa bấm.
 *
 * `navigator.clipboard` từ chối với `NotAllowedError` khi tài liệu không được
 * focus (rất hay gặp: cửa sổ dashboard nằm cạnh terminal đang gõ). Không có
 * đường lui thì nút bấm xong không xảy ra gì và cũng không báo gì — tệ hơn hẳn
 * so với báo hỏng. Nên: thử API mới, hỏng thì rơi về `execCommand`, hỏng nữa
 * thì hiện trạng thái lỗi để sếp biết mà bôi đen chép tay.
 *
 * Trả về việc có chép được hay không. Hầu hết chỗ gọi bỏ qua trị này — vệt ✓ trên
 * nút đã là câu trả lời đủ cho một dòng lệnh ngắn. Nút báo cáo thì cần biết, vì nó
 * còn phải nói tiếp "làm gì với 12 nghìn ký tự vừa chép", mà câu đó chỉ đúng khi
 * clipboard thật sự có nội dung.
 */
export async function copy(text, sourceEl) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    ok = legacyCopy(text);
  }
  flag(sourceEl, ok ? 'copied' : 'copyfail');
  return ok;
}

function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

function flag(el, cls) {
  if (!el) return;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 1400);
}
