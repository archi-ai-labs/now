import test from 'node:test';
import assert from 'node:assert/strict';
import { doneByDay, coverage, MAX_DAYS } from '../public/views/stats.js';

/**
 * Màn Thống kê là chỗ nguyên tắc "mọi con số phải có thật" dễ vỡ nhất, nên đây là
 * file test đầu tiên của dự án.
 *
 * Ngày trong `recentlyDone` do người gõ tay. Trước khi có trần cửa sổ, một chữ số sai
 * (`2016` thay vì `2026`) kéo khoảng vẽ ra 3.653 ngày → 3.653 cột + 3.653 hàng bảng số,
 * và một dự án gõ sai là hỏng màn Thống kê của MỌI dự án.
 */

const iso = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Dựng state tối thiểu đúng hình dạng `buildState()` trả về, timeline mới → cũ. */
function stateWith(dates) {
  const sorted = [...dates].sort((a, b) => b.localeCompare(a));
  return {
    timeline: sorted.map((date) => ({ date, ageDays: 0, items: [{ title: 'x', project: 'p' }] })),
    projects: [{ now: { recentlyDone: sorted.map((date) => ({ date, title: 'x' })) } }],
  };
}

test('ngày liên tiếp bình thường thì vẽ đúng số ngày, không cắt gì', () => {
  const d = doneByDay(stateWith([iso(0), iso(1), iso(2)]));
  assert.equal(d.days.length, 3);
  assert.equal(d.dropped, 0);
  assert.equal(d.days.at(-1).iso, iso(0), 'cột cuối là hôm nay');
  assert.equal(d.days[0].iso, iso(2), 'cột đầu là ngày cũ nhất');
});

test('lấp ngày trống ở giữa, nhưng không bịa ra ngày trước mốc sớm nhất', () => {
  const d = doneByDay(stateWith([iso(0), iso(3)]));
  assert.equal(d.days.length, 4, 'iso(3) → iso(0) là 4 cột, hai ngày giữa được lấp');
  assert.deepEqual(
    d.days.map((x) => x.v),
    [1, 0, 0, 1],
  );
});

test('B2 — một ngày gõ sai năm KHÔNG được đẻ ra hàng nghìn cột', () => {
  const d = doneByDay(stateWith([iso(0), iso(1), '2016-07-23']));
  assert.ok(d.days.length <= MAX_DAYS, `phải kẹp ở ${MAX_DAYS} ngày, đang là ${d.days.length}`);
  assert.equal(d.dropped, 1, 'ngày 2016 bị bỏ');
  assert.equal(d.droppedItems, 1, 'và số việc bị bỏ phải đếm được để nói ra');
});

test('B2 — ngày ở TƯƠNG LAI bị kẹp về hôm nay, không kéo cửa sổ đi trước', () => {
  const future = new Date();
  future.setFullYear(future.getFullYear() + 36);
  const futureIso = `${future.getFullYear()}-01-01`;

  const d = doneByDay(stateWith([iso(0), futureIso]));
  assert.ok(d.days.length <= MAX_DAYS, `đang là ${d.days.length} cột`);
  assert.equal(d.end, iso(0), 'mốc cuối phải là hôm nay chứ không phải năm 2062');
  assert.equal(d.dropped, 1);
});

test('cắt bớt thì phải đếm được để còn nói ra — không lặng lẽ bỏ', () => {
  const dates = Array.from({ length: MAX_DAYS + 10 }, (_, i) => iso(i));
  const d = doneByDay(stateWith(dates));
  assert.equal(d.days.length, MAX_DAYS);
  assert.equal(d.dropped, 10, 'đúng 10 ngày rơi ra ngoài cửa sổ');
  assert.equal(d.droppedItems, 10);
});

test('timeline rỗng trả null chứ không ném', () => {
  assert.equal(doneByDay({ timeline: [], projects: [] }), null);
});

test('coverage đếm số board còn lưu lùi tới từng ngày', () => {
  const projects = [
    { now: { recentlyDone: [{ date: '2026-07-20' }, { date: '2026-07-23' }] } },
    { now: { recentlyDone: [{ date: '2026-07-22' }] } },
    { now: {} },
  ];
  const c = coverage(projects);
  assert.equal(c.total, 2, 'board không có recentlyDone thì không tính vào mẫu số');
  assert.deepEqual(c.earliest.sort(), ['2026-07-20', '2026-07-22']);
});

test('cột được đánh dấu mờ đúng những ngày không đủ board phủ', () => {
  const s = {
    timeline: [
      { date: iso(0), items: [{ title: 'a' }] },
      { date: iso(1), items: [{ title: 'b' }] },
    ],
    projects: [
      { now: { recentlyDone: [{ date: iso(1) }] } },
      { now: { recentlyDone: [{ date: iso(0) }] } },
    ],
  };
  const d = doneByDay(s);
  assert.equal(d.total, 2);
  assert.equal(d.days[0].partial, true, 'ngày cũ chỉ 1/2 board lưu lùi tới → phải mờ');
  assert.equal(d.days[1].partial, false, 'hôm nay đủ 2/2 board');
  assert.match(d.days[0].tip, /số thật cao hơn/);
});
