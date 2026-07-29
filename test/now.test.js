import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { validateNow, healthOf, daysSince } from '../src/collect/now.js';
import { NOW_SCHEMA, HEALTH } from '../src/config.js';

/**
 * `validateNow` cố ý chép tay luật của `now.schema.json` để giữ zero-dep. Cái giá là
 * hai bên có thể lệch nhau mà không ai biết — nên test đầu tiên ở đây đọc file schema
 * THẬT và đối chiếu, thay vì tin vào trí nhớ của người viết.
 */

test('danh sách field bắt buộc phải khớp now.schema.json thật', async (t) => {
  let schema;
  try {
    schema = JSON.parse(await fs.readFile(NOW_SCHEMA, 'utf8'));
  } catch {
    t.skip('máy này chưa cài skill `now` — bỏ qua, không phải lỗi của dashboard');
    return;
  }

  for (const key of schema.required) {
    const thiếu = { ...hợpLệ() };
    delete thiếu[key];
    const errors = validateNow(thiếu);
    assert.ok(
      errors.some((e) => e.includes(key)),
      `schema bắt buộc \`${key}\` nhưng validateNow không kêu khi thiếu nó`,
    );
  }

  const focusReq = schema.properties.focus.required;
  for (const key of focusReq) {
    const board = hợpLệ();
    delete board.focus[key];
    assert.ok(
      validateNow(board).some((e) => e.includes(key)),
      `schema bắt buộc \`focus.${key}\` nhưng validateNow bỏ qua`,
    );
  }
});

function hợpLệ() {
  return {
    schemaVersion: 1,
    project: 'p',
    branch: 'main',
    updatedAt: '2026-07-23',
    updatedAtCommit: 'abc1234',
    updatedBy: 'test',
    focus: {
      title: 't',
      context: 'c',
      nextAction: 'n',
      resume: { workingState: 'w', howToContinue: 'h' },
      confidence: 'inferred',
    },
  };
}

test('board hợp lệ thì không có lỗi nào', () => {
  assert.deepEqual(validateNow(hợpLệ()), []);
});

test('bắt được các kiểu sai hay gặp thật', () => {
  const v = (patch) => validateNow({ ...hợpLệ(), ...patch });
  assert.ok(v({ schemaVersion: 2 }).some((e) => e.includes('schemaVersion')));
  assert.ok(v({ updatedAt: '23/07/2026' }).some((e) => e.includes('updatedAt')));
  assert.ok(v({ updatedAtCommit: 'xyz' }).some((e) => e.includes('updatedAtCommit')));

  const sai = hợpLệ();
  sai.focus.confidence = 'chắc chắn';
  assert.ok(validateNow(sai).some((e) => e.includes('confidence')));

  const heatLạ = hợpLệ();
  heatLạ.decisionsNeeded = [{ title: 'd', heat: 'gấp lắm', blocks: 'x' }];
  assert.ok(validateNow(heatLạ).some((e) => e.includes('heat')));
});

test('sentinel 0000000 cho repo chưa init git vẫn hợp lệ', () => {
  // NOW board của chính dashboard này đang dùng nó, nên nếu luật đổi thì phải biết ngay.
  assert.deepEqual(validateNow({ ...hợpLệ(), updatedAtCommit: '0000000' }), []);
});

test('healthOf: tuổi và độ lệch bắt hai kiểu cũ khác nhau', () => {
  assert.equal(healthOf({ ageDays: 0, driftCommits: 0 }), 'fresh');
  assert.equal(healthOf({ ageDays: HEALTH.driftDays, driftCommits: 0 }), 'drifting', 'cũ theo ngày');
  assert.equal(healthOf({ ageDays: 0, driftCommits: HEALTH.driftCommits }), 'drifting', 'cũ theo commit');
  assert.equal(healthOf({ ageDays: HEALTH.staleDays, driftCommits: 0 }), 'stale');
  assert.equal(healthOf({ ageDays: 0, driftCommits: HEALTH.staleCommits }), 'stale');
  assert.equal(
    healthOf({ ageDays: 0, driftCommits: 0, unknownCommit: true }),
    'unknown',
    'mất mốc thì phải là "không đo được", tuyệt đối không được rơi về fresh',
  );
});

test('daysSince chịu được ngày rác', () => {
  assert.equal(daysSince(null), null);
  assert.equal(daysSince('hôm qua'), null);
  assert.equal(daysSince(''), null);
  const hômNay = new Date();
  const iso = `${hômNay.getFullYear()}-${String(hômNay.getMonth() + 1).padStart(2, '0')}-${String(hômNay.getDate()).padStart(2, '0')}`;
  assert.equal(daysSince(iso), 0);
});
