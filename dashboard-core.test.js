const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./dashboard-core.js');

const widgets = ['weather', 'overview', 'agenda'];

test('dashboard layout restores valid settings and fills newly available widgets', () => {
  assert.deepEqual(D.normalize({ order: ['agenda', 'unknown', 'agenda'], visible: { agenda: false } }, widgets), {
    order: ['agenda', 'weather', 'overview'],
    visible: { weather: true, overview: true, agenda: false }
  });
});

test('legacy overview preference is preserved by the renamed household setting', () => {
  const layout = D.normalize({ order: ['overview'], visible: { overview: false } }, D.CATALOG.map(([id]) => id));
  assert.deepEqual(layout.order.slice(0, 1), ['household']);
  assert.equal(layout.visible.household, false);
});

test('dashboard widgets can be hidden, restored, and reordered without invalid ids', () => {
  const initial = D.defaults(widgets);
  const hidden = D.setVisible(initial, 'agenda', false, widgets);
  const moved = D.move(D.move(hidden, 'agenda', -1, widgets), 'agenda', -1, widgets);
  assert.equal(hidden.visible.agenda, false);
  assert.deepEqual(moved.order, ['agenda', 'weather', 'overview']);
  assert.deepEqual(D.move(moved, 'agenda', -1, widgets).order, moved.order);
  assert.deepEqual(D.setVisible(moved, 'missing', true, widgets), moved);
});

test('new optional dashboard widgets stay hidden until selected', () => {
  const initial = D.normalize({ order: ['agenda'], visible: { agenda: false } },
    ['weather', 'agenda', 'tab-budget'], ['weather', 'agenda']);
  assert.deepEqual(initial.visible, { weather: true, agenda: false, 'tab-budget': false });
  const selected = D.setVisible(initial, 'tab-budget', true,
    ['weather', 'agenda', 'tab-budget'], ['weather', 'agenda']);
  assert.equal(selected.visible['tab-budget'], true);
});

test('the catalogue covers the fixed dashboard sections as independent controls', () => {
  const ids = D.CATALOG.map(([id]) => id);
  for (const id of ['travelActions', 'dailyQuestion', 'todayChores', 'todayAgenda',
    'todayGroceries', 'lowStock', 'upcomingChores', 'todayStats', 'household', 'weather', 'budget', 'car',
    'quote', 'tasks', 'savings', 'chalkboard']) {
    assert.ok(ids.includes(id), `${id} should have a dashboard setting`);
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('turning every dashboard section off yields a normalized all-hidden layout', () => {
  const ids = D.CATALOG.map(([id]) => id);
  const defaults = D.CATALOG.filter(([, , visible]) => visible).map(([id]) => id);
  const hidden = D.normalize({ visible: Object.fromEntries(ids.map(id => [id, false])) }, ids, defaults);
  assert.equal(Object.values(hidden.visible).every(visible => !visible), true);
});
