const test = require('node:test'), assert = require('node:assert');
const F = require('./freezer-core.js');
const T = '2026-10-19';
test('add merges identical batches and validates', () => {
  const l = [];
  assert.equal(F.add(l, { title: '', portions: 2 }, T).ok, false);
  F.add(l, { title: 'Chili', portions: 2, frozen: T }, T);
  assert.ok(F.add(l, { title: 'chili', portions: 3, frozen: T }, T).merged);
  assert.equal(l.length, 1); assert.equal(l[0].portions, 5); assert.equal(l[0].batchPortions, 5);
});
test('consume is idempotent per ref and bounded', () => {
  const l = []; const i = F.add(l, { title: 'Soep', portions: 3 }, T).item;
  assert.ok(F.consume(i, 'eaten', 1, 'meal:1').ok); assert.ok(F.consume(i, 'eaten', 1, 'meal:1').skipped);
  assert.equal(i.portions, 2); assert.equal(i.batchPortions, 3); assert.equal(F.consume(i, 'discarded', 5).ok, false);
});
test('move splits batch', () => {
  const l = []; const i = F.add(l, { title: 'Soep', portions: 4 }, T).item;
  F.move(l, i, 'Koelkast', 1); assert.equal(i.portions, 3); assert.equal(l.length, 2); assert.equal(l[1].batchPortions, 1);
});
test('sort first-to-use and summary', () => {
  const l = []; F.add(l, { title: 'B', portions: 1, bestBefore: '2026-12-01' }, T); F.add(l, { title: 'A', portions: 1, bestBefore: '2026-10-25' }, T);
  assert.equal(F.sortFilter(l, {}, T)[0].title, 'A'); assert.equal(F.summary(l, T).urgent, 1);
});
test('missing ingredients', () => {
  assert.deepEqual(F.missingIngredients('250 g rijst, ui, ui', [{ title: 'Rijst', amount: 1 }], []), ['ui']);
  assert.deepEqual(F.missingIngredients('ui, paprika, ui', [], [{ title: 'Paprika', done: false }]), ['ui']);
  assert.deepEqual(F.missingIngredients('', [], []), []);
});
test('legacy freezer stock migrates once and retains the complete source data', () => {
  const oldFreezer = {
    id: 'stock-1', title: 'Soep', category: 'Vriezer', amount: 4, unit: 'bakjes',
    min: 1, bestBefore: '2026-12-01', note: 'Met peterselie', custom: { source: 'import' }
  };
  const oldPantry = { id: 'stock-2', title: 'Rijst', category: 'Voorraadkast', amount: 2, unit: 'pakken' };
  const fractional = { id: 'stock-3', title: 'Bouillon', category: 'Vriezer', amount: 0.5, unit: 'liter' };
  const first = F.migrateLegacyStock([oldFreezer, { ...oldFreezer }, oldPantry, fractional], [], T);
  assert.deepEqual(first.stock, [oldPantry, fractional]);
  assert.equal(first.freezer.length, 1);
  assert.equal(first.freezer[0].portions, 4);
  assert.equal(first.freezer[0].batchPortions, 4);
  assert.equal(first.freezer[0].note, oldFreezer.note);
  assert.equal(first.freezer[0].bestBefore, oldFreezer.bestBefore);
  assert.deepEqual(first.freezer[0].legacyStock, oldFreezer);
  assert.equal(first.migrated, 1);

  const repeated = F.migrateLegacyStock([oldFreezer], first.freezer, T);
  assert.deepEqual(repeated.stock, []);
  assert.equal(repeated.freezer.length, 1);
  assert.equal(repeated.migrated, 0);
  const changed = { ...oldFreezer, amount: 5 };
  const guarded = F.migrateLegacyStock([changed], first.freezer, T);
  assert.deepEqual(guarded.stock, [changed]);
  assert.equal(guarded.freezer.length, 1);
});
test('meal planning reserves portions, cancellation releases them, and eating deducts once', () => {
  const item = F.normalize({ id: 'batch-1', title: 'Curry', portions: 3 }, T);
  const meals = [];
  const planned = { id: 'meal-1', date: T, title: 'Curry', type: 'Avondeten', persons: 2 };
  assert.equal(F.planMeal(meals, item, planned, T).ok, true);
  assert.equal(item.portions, 3);
  assert.equal(F.planMeal(meals, item, { id: 'meal-2', date: T, persons: 2 }, T).ok, false);
  assert.equal(F.planMeal(meals, item, planned, T).skipped, true);

  const cancelled = F.cancelMeal(meals, 'meal-1');
  assert.equal(cancelled.meal.id, 'meal-1');
  assert.equal(item.portions, 3);
  assert.equal(F.planMeal(cancelled.meals, item, { id: 'meal-3', date: T, persons: 2 }, T).ok, true);
  const meal = cancelled.meals[0];
  assert.equal(F.bookMeal(item, meal).ok, true);
  assert.equal(F.bookMeal(item, meal).skipped, true);
  assert.equal(item.portions, 1);
  assert.equal(item.batchPortions, 3);
});
test('existing meal titles can be referenced without copying recipe ingredients', () => {
  const recipeMeal = { id: 'meal-recipe', title: 'Chili', ingredients: 'bonen, tomaat' };
  assert.equal(F.matchMealTitle(' chili ', [recipeMeal]), recipeMeal);
  assert.equal(F.matchMealTitle('Onbekend', [recipeMeal]), null);
});
test('weekmenu ingredients add to groceries once across meals and repeated runs', () => {
  const meals = [{ ingredients: 'paprika, ui' }, { ingredients: 'ui, tomaat' }];
  const stock = [];
  const groceries = [];
  const addMissing = () => meals.forEach(meal => F.missingIngredients(meal.ingredients, stock, groceries)
    .forEach(title => groceries.push({ title, done: false })));
  addMissing();
  assert.deepEqual(groceries.map(item => item.title), ['paprika', 'ui', 'tomaat']);
  addMissing();
  assert.deepEqual(groceries.map(item => item.title), ['paprika', 'ui', 'tomaat']);
});
test('meal idempotency survives bounded history log rotation', () => {
  const item = F.normalize({ id: 'batch-long', title: 'Soep', portions: 60 }, T);
  for (let index = 0; index < 51; index += 1) {
    assert.equal(F.consume(item, 'eaten', 1, `meal:${index}`).ok, true);
  }
  assert.equal(item.log.length, 50);
  assert.equal(F.wasProcessed(item, 'meal:0'), true);
  assert.equal(F.consume(item, 'eaten', 1, 'meal:0').skipped, true);
  assert.equal(item.portions, 9);
});
