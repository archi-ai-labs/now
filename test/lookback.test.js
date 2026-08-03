import test from 'node:test';
import assert from 'node:assert/strict';
import { lastDaysAxis, localDayOf, weeksOf } from '../public/views/lookback.js';

/**
 * Hai phép gấp phía client của màn "Nhìn lại" — khối B (nhịp 14 ngày) và khối C (tuần).
 *
 * Chúng nằm ở view chứ không ở server vì dữ liệu nguồn (usage.series,
 * cursorEvents.series, agTurns.series) đã có sẵn trong payload — nhưng phép gấp thì
 * vẫn phải khoá bằng test, nhất là ca B17 đã từng cắn: "hôm nay" là đầu vào ẩn.
 */

test('lastDaysAxis — trục chốt ở HÔM NAY, không chốt ở ngày cuối của series', () => {
  // Sổ sự kiện Cursor kết thúc ở ngày có lượt gọi cuối — nghỉ ba ngày là series hụt ba
  // ngày. Trục mà đi theo series thì dải "14 ngày qua" lặng lẽ kết thúc ở tuần trước.
  const series = [
    { day: '2026-07-25', events: 4 },
    { day: '2026-07-27', events: 9 },
  ];
  const axis = lastDaysAxis(series, 14, '2026-07-30');

  assert.equal(axis.length, 14);
  assert.equal(axis[0].day, '2026-07-17');
  assert.equal(axis.at(-1).day, '2026-07-30');
  // Ba ngày nghỉ cuối vẫn ĐỨNG TRÊN TRỤC dưới dạng hàng rỗng — ngày không dùng là một
  // cột trống nhìn thấy được, không phải một ngày biến mất.
  assert.deepEqual(axis.at(-1), { day: '2026-07-30' });
  assert.equal(axis.find((d) => d.day === '2026-07-27').events, 9);
});

test('lastDaysAxis — vắt qua ranh tháng không rơi ngày nào', () => {
  const axis = lastDaysAxis([], 14, '2026-08-03');
  assert.equal(axis[0].day, '2026-07-21');
  assert.deepEqual(
    axis.slice(10).map((d) => d.day),
    ['2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03'],
  );
});

test('lastDaysAxis — đổi "hôm nay" là trục trượt theo, không cần series đổi', () => {
  // Chính là ca 00:00 của B17: qua nửa đêm mà trục vẫn đứng ở hôm qua là chart nói dối.
  const series = [{ day: '2026-07-29', out: 5 }];
  const before = lastDaysAxis(series, 3, '2026-07-29');
  const after = lastDaysAxis(series, 3, '2026-07-30');
  assert.equal(before.at(-1).day, '2026-07-29');
  assert.equal(after.at(-1).day, '2026-07-30');
  assert.equal(after[0].day, '2026-07-28');
});

test('weeksOf — tuần mở THỨ HAI, ngày chủ nhật về đúng tuần của nó', () => {
  // 2026-07-27 là thứ hai; 2026-07-26 (chủ nhật) phải thuộc tuần MỞ 20/7, không phải 27/7.
  const series = [
    { day: '2026-07-26', v: 1 },
    { day: '2026-07-27', v: 10 },
    { day: '2026-07-30', v: 5 },
  ];
  const weeks = weeksOf(series, (d) => d.v);
  assert.deepEqual(weeks, [
    { week: '2026-07-20', v: 1 },
    { week: '2026-07-27', v: 15 },
  ]);
});

test('weeksOf — vắt qua ranh tháng và cắt về đúng số tuần xin', () => {
  const series = [];
  // 10 tuần liên tiếp, mỗi tuần một ngày thứ tư có số.
  for (let i = 0; i < 10; i++) {
    const d = new Date(2026, 4, 6 + i * 7); // 6/5/2026 là thứ tư
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    series.push({ day: iso, v: i + 1 });
  }
  const weeks = weeksOf(series, (d) => d.v, 8);
  assert.equal(weeks.length, 8);
  // Cắt là cắt tuần CŨ: tuần cuối cùng phải là tuần mới nhất.
  assert.equal(weeks.at(-1).v, 10);
  // Mọi khoá tuần đều là một ngày thứ hai.
  for (const w of weeks) {
    const [y, m, d] = w.week.split('-').map(Number);
    assert.equal(new Date(y, m - 1, d).getDay(), 1, `${w.week} không phải thứ hai`);
  }
});

test('localDayOf — ngày ĐỊA PHƯƠNG, cùng lịch với khoá day của sổ server', () => {
  // 30/7 lúc 01:13 giờ máy: UTC đang là 29/7, mà sổ server khoá theo ngày địa phương —
  // trục lấy theo UTC là mọi cột lệch một ngày trong suốt buổi sáng.
  const ts = new Date(2026, 6, 30, 1, 13).getTime();
  assert.equal(localDayOf(ts), '2026-07-30');
});
