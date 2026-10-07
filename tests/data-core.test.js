const test = require('node:test');
const assert = require('node:assert/strict');
const { hasConcurrentChanges, mergeUnique, nextDue } = require('../data-core.js');

test('concurrent sync edits are detected after a shared baseline', () => {
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T10:01:00Z', '2026-10-07T09:00:00Z'), true);
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T10:00:00Z', '2026-10-07T09:00:00Z', { value: 'local' }, { value: 'remote' }), true);
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T10:00:00Z', '2026-10-07T09:00:00Z', { value: 'same' }, { value: 'same' }), false);
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T09:00:00Z', '2026-10-07T09:00:00Z'), false);
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T10:00:00Z', ''), false);
});

test('mergeUnique preserves existing rows and skips duplicate incoming rows', () => {
  const rows = mergeUnique([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }, { id: 'b' }], row => row.id);
  assert.deepEqual(rows, [{ id: 'a' }, { id: 'b' }]);
});

test('smart recurrence uses the actual completion date and clamps month ends', () => {
  assert.equal(nextDue('2026-01-31', '', 'Maandelijks'), '2026-02-28');
  assert.equal(nextDue('2026-10-01', '2026-09-20', 'Wekelijks'), '2026-10-08');
  assert.equal(nextDue('', '2026-10-07', 'Eenmalig'), '2026-10-07');
  assert.equal(nextDue('2026-10-01', '', 'Eenmalig'), '');
  assert.equal(nextDue('2026-10-01', '', 'Wanneer nodig'), '');
});
