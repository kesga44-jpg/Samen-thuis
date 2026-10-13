const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./chalkboard-core.js');
const D = require('./dashboard-core.js');

test('chalkboard validates empty, long and emoji messages', () => {
  assert.equal(C.validateMessage('   ').ok, false);
  assert.equal(C.validateMessage('x'.repeat(C.MAX_LENGTH + 1)).ok, false);
  assert.equal(C.validateMessage('❤️'.repeat(100)).ok, true);
  assert.equal(C.validateMessage('😀'.repeat(C.MAX_LENGTH)).ok, true);
  assert.equal(C.validateMessage('  Ik hou van je ❤️ ').value, 'Ik hou van je ❤️');
});

test('only the author or an owner can delete a message', () => {
  const message = { id: 1, user_id: 'a' };
  assert.equal(C.canDelete(message, 'a', 'member'), true);
  assert.equal(C.canDelete(message, 'b', 'member'), false);
  assert.equal(C.canDelete(message, 'b', 'owner'), true);
  assert.equal(C.canDelete(message, '', 'owner'), false);
});

test('messages are sorted newest first and author name falls back to email', () => {
  const sorted = C.sortMessages([{ created_at: '2026-01-01T10:00:00Z' }, { created_at: '2026-01-02T10:00:00Z' }]);
  assert.equal(sorted[0].created_at, '2026-01-02T10:00:00Z');
  assert.equal(C.authorName({ email: 'daphne@example.com' }), 'Daphne');
});

test('dashboard catalogue: no quick-links, quote and chalkboard are switchable with defaults', () => {
  const ids = D.CATALOG.map(([id]) => id);
  assert.equal(ids.some(id => id.startsWith('tab-')), false);
  for (const id of ['quote', 'chalkboard', 'weather', 'budget', 'savings', 'car', 'tasks', 'groceries']) assert.ok(ids.includes(id));
  const defaults = D.CATALOG.filter(([, , on]) => on).map(([id]) => id);
  const layout = D.normalize({ visible: { quote: false } }, ids, defaults);
  assert.equal(layout.visible.quote, false);
  assert.equal(layout.visible.chalkboard, true);
  assert.equal(layout.visible.budget, false);
  assert.equal(D.setVisible(layout, 'quote', true, ids, defaults).visible.quote, true);
});
