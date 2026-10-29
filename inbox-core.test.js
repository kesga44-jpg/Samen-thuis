const test = require('node:test'), assert = require('node:assert/strict');
const I = require('./inbox-core.js'), F = require('./freezer-core.js');
const T = '2026-10-20';
const data = { chores: [{ id: 'a', title: 'Afwas', due: T, person: 'Kees', completedDates: [] }, { id: 'b', title: 'Klaar', due: T, completedDates: [T] }, { id: 'c', title: 'Oud', due: '2026-10-18' }],
  planning: [{ id: 'p', title: 'Tandarts', date: T, time: '09:00' }], freezer: [{ id: 'f', title: 'Soep', portions: 2, bestBefore: '2026-10-21' }], stock: [{ id: 's', title: 'Pasta', amount: 1, min: 2, unit: 'pakken' }] };
test('meldingen worden afgeleid en afgeronde taken overgeslagen', () => {
  const g = I.generate(data, T, {}, F);
  assert.deepEqual(g.map(x => x.category).sort(), ['agenda', 'chores', 'chores', 'freezer', 'stock']);
  assert.ok(!g.some(x => /Klaar/.test(x.body)));
});
test('persoonlijke voorkeuren schakelen categorieën uit', () => {
  const g = I.generate(data, T, { chores: false, stock: false }, F);
  assert.deepEqual(g.map(x => x.category).sort(), ['agenda', 'freezer']);
  assert.equal(I.normalizePrefs({ push: 'ja' }).push, false);
});
test('merge dedupliceert en bewaart gelezen-status', () => {
  let r = I.merge([], I.generate(data, T, {}, F), 'now');
  r = { items: I.markRead(r.items, r.items[0].key) };
  const again = I.merge(r.items, I.generate(data, T, {}, F), 'later');
  assert.equal(again.added, 0); assert.equal(I.unread(again.items), r.items.length - 1);
  assert.equal(I.unread(I.markAllRead(again.items)), 0);
  assert.equal(I.merge(again.items, I.generate(data, '2026-10-21', {}, F), 'x').added, 0, 'zelfde situatie op een andere dag geeft geen dubbele melding');
  const changed = { ...data, stock: [{ id: 's', title: 'Pasta', amount: 0, min: 2, unit: 'pakken' }] };
  assert.equal(I.merge(again.items, I.generate(changed, T, {}, F), 'x').added, 1, 'nieuwe toestand geeft wel een nieuwe melding');
});
test('beschadigde opslag wordt genormaliseerd', () => assert.deepEqual(I.normalizeItems([null, { key: 1 }, 'x']), []));
