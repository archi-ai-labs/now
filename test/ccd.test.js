import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoreHead } from '../src/collect/ccd.js';

/**
 * Bẫy hai không gian tên. Sổ của Claude Code desktop và `~/.claude/sessions`
 * đánh số khác nhau hoàn toàn — không UUID nào trùng. Bóc nhầm trường thì nút
 * archive vẫn hiện, vẫn chép được, mà chép ra id không tồn tại: hỏng IM LẶNG,
 * chỉ lộ ra lúc dán vào Claude.
 */

const HEAD = `{"sessionId":"local_8451e587-458f-4835-81df-354d3e915e68",
  "cliSessionId":"0e1a124b-c0b5-4ae1-998e-6c99cac5c621",
  "cwd":"/Users/hoanluu/Projects/local/now_dashboard","isArchived":false,"title":"Now update"`;

test('bóc đúng cặp id, không lẫn hai không gian tên', () => {
  const r = parseStoreHead(HEAD);
  assert.equal(r.ccdId, 'local_8451e587-458f-4835-81df-354d3e915e68', 'id archive phải có tiền tố local_');
  assert.equal(r.cliSessionId, '0e1a124b-c0b5-4ae1-998e-6c99cac5c621', 'khoá tra là UUID transcript, KHÔNG có tiền tố');
  assert.equal(r.archived, false);
});

test('`sessionId` không có tiền tố local_ thì không nhận — tránh bắt nhầm UUID transcript', () => {
  const lẫn = '{"sessionId":"0e1a124b-c0b5-4ae1-998e-6c99cac5c621","cliSessionId":"x"}';
  assert.equal(parseStoreHead(lẫn), null);
});

test('thiếu cliSessionId thì trả null — không có cầu nối thì không suy ra được gì', () => {
  assert.equal(parseStoreHead('{"sessionId":"local_abc"}'), null);
});

test('mẩu đầu file bị cắt giữa chừng vẫn bóc được (đây là cách module đọc file)', () => {
  const cắt = HEAD.slice(0, HEAD.indexOf('"cwd"'));
  const r = parseStoreHead(cắt);
  assert.equal(r.ccdId, 'local_8451e587-458f-4835-81df-354d3e915e68');
  assert.equal(r.archived, false, 'chưa thấy isArchived thì coi như chưa archive');
});

test('phiên đã archive được nhận ra để không mọc nút lần hai', () => {
  assert.equal(parseStoreHead(HEAD.replace('"isArchived":false', '"isArchived":true')).archived, true);
});

test('rác không làm ném lỗi', () => {
  assert.equal(parseStoreHead(''), null);
  assert.equal(parseStoreHead('không phải json'), null);
});
