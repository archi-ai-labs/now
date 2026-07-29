import test from 'node:test';
import assert from 'node:assert/strict';
import { agPlan, cursorPlan, parseClaudeTier } from '../src/collect/plans.js';
import { pickAgPlan } from '../src/collect/agquota.js';

/**
 * Bậc gói là MẪU SỐ của mọi phần trăm ở màn Token, và ba nguồn tin được ở ba mức khác
 * nhau. Mấy test dưới đây canh đúng chỗ đó: cái gì là lời của server, cái gì là phép
 * đoán của dashboard, và phép đoán ấy im lặng thế nào khi nó không đoán nổi.
 */

test('bậc gói Claude: chuỗi endpoint → nhãn đọc được', () => {
  assert.equal(parseClaudeTier('default_claude_max_20x').label, 'Max 20x');
  assert.equal(parseClaudeTier('default_claude_max_5x').label, 'Max 5x');
  assert.equal(parseClaudeTier('default_claude_pro').label, 'Pro');
  // Bội số giữ chữ thường vì app viết như thế, và đây là con số người dùng đối chiếu
  // bằng mắt với app.
  assert.equal(parseClaudeTier('default_claude_max_20X').label, 'Max 20x');
});

test('bậc gói Claude lạ hoắc vẫn ra được một cái nhãn, không rơi mất', () => {
  // Anthropic đặt thêm bậc mới là chuyện sẽ xảy ra. Mất hẳn cái nhãn thì màn Token im
  // lặng về mẫu số của chính nó — tệ hơn là in ra một cái tên chưa từng thấy.
  assert.equal(parseClaudeTier('default_claude_wombat').label, 'Wombat');
  assert.equal(parseClaudeTier('team_seat_3x').label, 'Team Seat 3x');
  assert.equal(parseClaudeTier(''), null);
  assert.equal(parseClaudeTier(null), null);
});

test('bậc gói Cursor là SUY RA, và tự khai đúng như thế', () => {
  const p = cursorPlan({ ok: true, planCents: 2000 });
  assert.equal(p.label, 'Pro');
  assert.equal(p.derived, true, 'Cursor không gửi tên gói — cờ này là thứ giao diện dựa vào để vẽ viền chấm');
  assert.equal(p.cents, 2000);
});

test('giá Cursor lạ thì giữ SỐ, không bịa TÊN', () => {
  // Anysphere đổi bảng giá hoặc thêm bậc là ca này. "$25/tháng" vẫn đúng; một cái tên
  // đoán sai thì người đọc mang đi đối chiếu hoá đơn rồi kết luận dashboard hỏng.
  const p = cursorPlan({ ok: true, planCents: 2500 });
  assert.equal(p.ok, true);
  assert.equal(p.label, null);
  assert.equal(p.cents, 2500);
});

test('không đọc được Cursor thì không có bậc gói, không phải bậc gói $0', () => {
  assert.equal(cursorPlan({ ok: false }).ok, false);
  assert.equal(cursorPlan({ ok: true, planCents: 0 }).ok, false);
  assert.equal(cursorPlan(null).ok, false);
});

test('bậc gói Antigravity moi đúng hai chuỗi, bỏ hết phần còn lại', () => {
  // Phản hồi thật ~12KB và có cả tên lẫn email tài khoản. Chỉ hai chuỗi này được giữ:
  // phần còn lại mà lọt vào ảnh chụp trên đĩa là mỗi lượt ghi đệm lại chép thêm một bản
  // danh tính người dùng ra chỗ không ai cần tới nó.
  const body = {
    userStatus: {
      name: 'Ai Đó',
      email: 'ai-do@example.com',
      planStatus: { planInfo: { teamsTier: 'TEAMS_TIER_PRO', planName: 'Pro', monthlyPromptCredits: 50000 } },
    },
  };
  assert.deepEqual(pickAgPlan(body), { label: 'Pro', raw: 'TEAMS_TIER_PRO' });
  assert.equal(pickAgPlan({}), null);
  assert.equal(pickAgPlan(null), null);
});

test('Antigravity đóng thì bậc gói nói LÝ DO, không nói "chưa có gói"', () => {
  // `empty` (gọi được mà không có pool nào) và `not-running` (app đang tắt) là hai
  // chuyện khác hẳn nhau, và giao diện phải nói khác đi ở mỗi ca.
  assert.equal(agPlan({ ok: false, reason: 'not-running' }).reason, 'not-running');
  assert.equal(agPlan({ ok: true, plan: null }).reason, 'empty');
  assert.equal(agPlan({ ok: true, plan: { label: 'Pro', raw: 'TEAMS_TIER_PRO' } }).label, 'Pro');
  assert.equal(agPlan({ ok: true, plan: { label: 'Pro' } }).derived, false, 'server tự khai — không phải suy ra');
});
