import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  validateNow,
  validateNowDetail,
  healthOf,
  daysSince,
  LIST_RULES,
  FOCUS_LIST_RULES,
  ROOT_KEYS,
  SHA_RE,
  isBoardCommit,
} from '../src/collect/now.js';
import { brokenProject } from '../src/state.js';
import { integrity } from '../public/views/shared.js';
import { renderHealth } from '../public/views/health.js';
import { rawText } from '../public/lib/dom.js';
import { t } from '../public/lib/i18n.js';
import { findNowSchema, HEALTH } from '../src/config.js';

/**
 * `validateNow` cố ý chép tay luật của `now.schema.json` để giữ zero-dep. Cái giá là
 * hai bên có thể lệch nhau mà không ai biết — nên test đầu tiên ở đây đọc file schema
 * THẬT và đối chiếu, thay vì tin vào trí nhớ của người viết.
 */

test('danh sách field bắt buộc phải khớp now.schema.json thật', async (t) => {
  const file = findNowSchema();
  let schema;
  try {
    schema = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    t.skip('máy này chưa cài plugin `now-board` — bỏ qua, không phải lỗi của dashboard');
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

/** Đọc schema thật; máy chưa cài plugin `now-board` thì bỏ qua, không phải lỗi của dashboard. */
async function schemaOrSkip(t) {
  try {
    return JSON.parse(await fs.readFile(findNowSchema(), 'utf8'));
  } catch {
    t.skip('máy này chưa cài plugin `now-board` — bỏ qua, không phải lỗi của dashboard');
    return null;
  }
}

test('bảng luật mảng phải khớp now.schema.json thật', async (t) => {
  const schema = await schemaOrSkip(t);
  if (!schema) return;

  assert.deepEqual(
    [...ROOT_KEYS].sort(),
    Object.keys(schema.properties).sort(),
    'ROOT_KEYS lệch danh sách property của schema — key lạ sẽ bị bỏ sót hoặc bị kêu oan',
  );

  const đốiChiếu = (nhãn, rule, spec) => {
    assert.equal(rule.max, spec.maxItems, `${nhãn}: maxItems lệch schema`);
    if (rule.keys === null) {
      assert.equal(spec.items.type, 'string', `${nhãn}: schema không còn là mảng chuỗi`);
      return;
    }
    assert.deepEqual([...rule.required].sort(), [...(spec.items.required ?? [])].sort(), `${nhãn}: required lệch schema`);
    assert.deepEqual([...rule.keys].sort(), Object.keys(spec.items.properties).sort(), `${nhãn}: danh sách key lệch schema`);
  };

  for (const [k, rule] of Object.entries(LIST_RULES)) đốiChiếu(k, rule, schema.properties[k]);
  for (const [k, rule] of Object.entries(FOCUS_LIST_RULES)) {
    đốiChiếu(`focus.${k}`, rule, schema.properties.focus.properties[k]);
  }
});

test('luật SHA chỉ có MỘT bản, và bản ấy khớp now.schema.json thật', async (t) => {
  const schema = await schemaOrSkip(t);
  if (!schema) return;

  assert.equal(
    SHA_RE.source,
    schema.properties.updatedAtCommit.pattern,
    'luật SHA lệch schema — board hợp lệ sẽ bị kêu, hoặc mốc rác lọt xuống `git rev-list`',
  );

  // `src/state.js` từng giữ bản chép thứ hai của đúng luật này để quyết có hỏi `git rev-list`
  // hay không. Hai bản không có ai canh thì lệch nhau lúc nào không biết, nên chỗ nào cần
  // luật ấy phải đi qua `isBoardCommit`. Đọc thẳng file là cách duy nhất bắt được bản chép
  // mọc lại, vì một hằng chép tay thì chạy đúng y như hằng nhập về.
  const state = await fs.readFile(new URL('../src/state.js', import.meta.url), 'utf8');
  assert.match(state, /import \{[^}]*\bisBoardCommit\b[^}]*\} from '\.\/collect\/now\.js'/);
  assert.ok(
    !/\{\s*7\s*,\s*40\s*\}/.test(state),
    'src/state.js lại mọc một luật SHA chép tay — dùng `isBoardCommit` của collect/now.js',
  );
});

test('sentinel 0000000 hợp lệ với schema nhưng KHÔNG được đem hỏi git', () => {
  assert.equal(SHA_RE.test('0000000'), true, 'schema vẫn nhận nó, `validateNow` không được kêu');
  assert.equal(
    isBoardCommit('0000000'),
    false,
    'thư mục về sau thành repo mà board còn giữ sentinel thì `git rev-list 0000000..HEAD` ' +
      'thoát 128 ở mỗi lượt quét — một dòng rác cố định trong sổ lỗi',
  );
  assert.equal(isBoardCommit('0000000000000000000000000000000000000000'), false, 'bản 40 ký tự cũng vậy');
  assert.equal(isBoardCommit('abc1234'), true);
  assert.equal(isBoardCommit('7b8525e (nhánh docs/danh-gia-v3.44)'), false, 'mốc kèm chú thích: đo trên board thật');
});

test('NOW.json không phải object thì kêu MỘT dòng, không kêu một dòng mỗi phần tử', () => {
  const { errors, warnings } = validateNowDetail(['a', 'b']);
  assert.equal(errors.length, 1, `nhận: ${JSON.stringify(errors)}`);
  assert.deepEqual(warnings, [], 'chỉ số mảng không phải "key lạ ở cấp gốc"');
  assert.ok(errors[0].includes('object'));

  for (const rác of [null, 'chuỗi', 42]) {
    assert.equal(validateNow(rác).length, 1, `${JSON.stringify(rác)} cũng chỉ được kêu một dòng`);
  }
});

/**
 * `brokenProject` sống ở `src/state.js`, và repo chưa có file test riêng cho module đó. Ca
 * này đi cùng `readBoard` vì nó nói tiếp đúng câu chuyện ở đây: một NOW.json đọc được và
 * parse được vẫn có thể làm phép dựng thẻ dự án ném giữa chừng.
 */
test('board dựng hỏng: thông báo gốc nguyên văn, và một cờ để màn hình chọn đúng nhãn', () => {
  const p = brokenProject('/tmp/du-an/x', new TypeError('b.map is not a function'));

  assert.equal(
    p.parseError,
    'b.map is not a function',
    'đúng nguyên văn, không thêm chữ nào: một câu tự chế ở đây là chuỗi hiển thị không đi qua ' +
      'public/lib/i18n.js, và bản tiếng Anh của dashboard sẽ đọc ra tiếng Việt',
  );
  assert.equal(
    p.buildFailed,
    true,
    'thiếu cờ này thì hai màn kia gắn nhãn "NOW.json không đọc được" cho một file đọc được ' +
      'bình thường, tức đẩy người đọc đi sửa một JSON không có lỗi. Nhãn đúng là `health.buildFail`.',
  );
  assert.equal(p.health, 'broken');
  assert.equal(brokenProject('/tmp/du-an/x', 'lỗi thô không phải Error').parseError, 'lỗi thô không phải Error');

  // `integrity()` ở public/views/shared.js chấm 0 cho board có `parseError`, và chỉ dựa vào
  // ô ấy. Dời thông báo sang ô khác thì hàm ấy quay về tính bằng tuổi và độ lệch — hai số
  // đều rỗng ở đây — nên thẻ của một dự án dựng hỏng lập tức khoe 100% độ tươi.
  assert.equal(integrity(p, { staleDays: 7, staleCommits: 15 }), 0);

  // Đầu kia của dây chuyền: cờ đặt đúng mà màn hình vẫn tra nhãn cũ thì người đọc chẳng
  // được gì. Đây là chỗ khoá việc màn Sức khoẻ đọc `buildFailed` để chọn nhãn.
  const state = {
    projects: [{ ...p, counts: { ...p.counts, awake: 0, sessions: 0 } }],
    thresholds: { driftDays: 3, driftCommits: 5, staleDays: 7, staleCommits: 15 },
    orphans: [],
    stats: { projects: 1, orphans: 0 },
    buildMs: 1,
    runFailures: { sinceMs: 30_000, rows: [] },
  };
  const out = rawText(renderHealth(state, ''));
  assert.ok(out.includes(t('health.buildFail', { name: p.name })), 'màn Sức khoẻ phải gắn nhãn "dựng thẻ hỏng"');
  assert.ok(!out.includes(t('health.parseError', { name: p.name })), 'và tuyệt đối không gắn nhãn "NOW.json không đọc được"');
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

/**
 * Ba ca dưới đây đo trên hai board THẬT nằm ngoài repo này, trên máy người viết: cả hai
 * đều hiện xanh trên dashboard trong khi validate bằng Draft7 lại cho ra lỗi. Repo này
 * công khai nên tên hai board đó không được ghi ra đây, và hình dạng sai mới là thứ
 * đáng chép lại: một board để `focus.blockedBy` là chuỗi thay vì mảng, một board để
 * `decisionsNeeded[].id` trùng nhau. Mức nào là lỗi, mức nào chỉ là cảnh báo là quyết
 * định của chủ dự án, không phải của phép validate.
 */
test('mảng sai kiểu là LỖI — vì `state.js` gọi `.map()` lên `focus.blockedBy`', () => {
  const b = hợpLệ();
  b.focus.blockedBy = 'quyết-định-x';
  const { errors, warnings } = validateNowDetail(b);
  assert.ok(
    errors.some((e) => e.includes('focus.blockedBy') && e.includes('mảng')),
    `phải kêu sai kiểu, nhận: ${JSON.stringify(errors)}`,
  );
  assert.deepEqual(warnings, []);

  const c = hợpLệ();
  c.waitingOn = [{ what: 'review PR' }];
  assert.ok(
    validateNow(c).some((e) => e.includes('waitingOn[0]') && e.includes('who')),
    'thiếu field bắt buộc trong một mục danh sách vẫn là lỗi',
  );
});

test('vượt maxItems là CẢNH BÁO — board vẫn đọc được, chỉ lệch hợp đồng', () => {
  const b = hợpLệ();
  b.upNext = Array.from({ length: 6 }, (_, i) => ({ title: `việc ${i}` }));
  const { errors, warnings } = validateNowDetail(b);
  assert.deepEqual(errors, [], 'quá dài KHÔNG được chặn board hiện lên');
  assert.ok(
    warnings.some((w) => w.includes('upNext') && w.includes('6') && w.includes('5')),
    `cảnh báo phải nói rõ đang mấy mục trên tối đa mấy, nhận: ${JSON.stringify(warnings)}`,
  );
});

test('key lạ là CẢNH BÁO, ở cả cấp gốc lẫn trong mục danh sách', () => {
  const b = hợpLệ();
  b.ownerNote = 'ghi chú riêng';
  b.sideTracks = [{ title: 'mạch phụ', status: 'đang chạy' }];
  const { errors, warnings } = validateNowDetail(b);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes('ownerNote')), 'key lạ ở cấp gốc phải được đánh dấu');
  assert.ok(warnings.some((w) => w.includes('sideTracks[0]') && w.includes('status')), 'key lạ trong mục cũng vậy');
});

test('`validateNow` vẫn chỉ trả về mảng lỗi — `public/views/health.js` duyệt thẳng nó', () => {
  const b = hợpLệ();
  b.upNext = Array.from({ length: 9 }, (_, i) => ({ title: `việc ${i}` }));
  const errors = validateNow(b);
  assert.ok(Array.isArray(errors));
  assert.deepEqual(errors, [], 'cảnh báo lọt vào đây là màn Sức khoẻ kêu như lỗi');
});

test('decisionsNeeded là chuỗi thì kêu một dòng, không kêu một dòng mỗi ký tự', () => {
  const { errors } = validateNowDetail({ ...hợpLệ(), decisionsNeeded: 'chốt cái gì đó' });
  assert.equal(errors.length, 1, `nhận: ${JSON.stringify(errors)}`);
  assert.ok(errors[0].includes('decisionsNeeded'));
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
