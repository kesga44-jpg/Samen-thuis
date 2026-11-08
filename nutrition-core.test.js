// Voedingsplanning: hoeveelheden, recepten, berekening met dekking (onbekend ≠ 0), weekmenu, boodschappen, opslag.
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('./nutrition-core.js');
const FF = require('./food-facts-core.js');

const yoghurt = FF.manualProduct({ id: 'p-yog', name: 'Yoghurt', per100g: { energyKcal: 60, fat: 3, saturatedFat: 2, carbohydrates: 4, sugars: 4, fiber: 0, proteins: 4, salt: 0.1 } });
const muesli = FF.manualProduct({ id: 'p-mue', name: 'Muesli', per100g: { energyKcal: 370, fat: 6, saturatedFat: 1, carbohydrates: 60, sugars: 15, fiber: 8, proteins: 10, salt: null } });

test('parseAmount: gram, kilo, komma, breuken, lepels (benaderd), stuks zonder gewicht', () => {
  assert.deepEqual(N.parseAmount('250 g spinazie'), { quantity: 250, unit: 'g', name: 'spinazie', grams: 250, approx: false });
  assert.equal(N.parseAmount('1,5 kg aardappelen').grams, 1500);
  assert.equal(N.parseAmount('250g kwark').grams, 250);
  assert.equal(N.parseAmount('½ l melk').grams, 500);
  assert.equal(N.parseAmount('½ l melk').approx, true);
  assert.equal(N.parseAmount('2 el olijfolie').grams, 30);
  assert.equal(N.parseAmount('1/2 ui').quantity, 0.5);
  const eggs = N.parseAmount('3 eieren'); assert.equal(eggs.quantity, 3); assert.equal(eggs.grams, null); assert.equal(eggs.name, 'eieren');
  assert.equal(N.parseAmount('Zout naar smaak').grams, null);
});

test('normalizeRecipe: veilige standaarden, opschonen, ongeldige invoer genegeerd', () => {
  assert.equal(N.normalizeRecipe(null), null);
  assert.equal(N.normalizeRecipe({ title: '   ' }), null);
  const r = N.normalizeRecipe({ title: 'Ontbijt\u0000', servings: '0', ingredients: ['200 g yoghurt', { name: 'muesli', grams: 50 }, null, 7], sourceUrl: 'javascript:alert(1)' });
  assert.equal(r.title, 'Ontbijt'); assert.equal(r.servings, 1);
  assert.equal(r.ingredients.length, 2, 'null en getallen worden genegeerd');
  assert.equal(r.ingredients[0].grams, 200); assert.equal(r.ingredients[1].grams, 50);
  assert.equal(r.sourceUrl, '', 'alleen https-bronnen');
  assert.equal(r.source, 'import', 'nieuwe receptkopieën komen altijd uit een import');
});

test('recipeNutrition: volledig wanneer alle ingrediënten gekoppeld zijn met gewicht', () => {
  const r = N.normalizeRecipe({ title: 'Bakje', servings: 2, ingredients: [{ name: 'yoghurt', grams: 300, productId: 'p-yog' }, { name: 'muesli', grams: 100, productId: 'p-yog' }] });
  const n = N.recipeNutrition(r, [yoghurt]);
  assert.equal(n.status, 'volledig'); assert.equal(n.fullyComplete, true);
  assert.equal(n.total.energyKcal, 240); assert.equal(n.perServing.energyKcal, 120);
  assert.equal(n.perServing.fiber, 0, 'bekende 0 blijft 0 en telt als volledig');
});

test('recipeNutrition: ontbrekende waarde wordt nooit als 0 geteld; status onvolledig met redenen', () => {
  const r = N.normalizeRecipe({ title: 'Ontbijt', servings: 1, ingredients: [
    { name: 'yoghurt', grams: 200, productId: 'p-yog' }, { name: 'muesli', grams: 50, productId: 'p-mue' }, { name: 'banaan' }, '3 walnoten'] });
  const n = N.recipeNutrition(r, [yoghurt, muesli]);
  assert.equal(n.status, 'onvolledig');
  assert.equal(n.total.energyKcal, 305, 'ondergrens uit bekende ingrediënten');
  assert.equal(n.complete.energyKcal, false);
  assert.equal(n.coverage.salt.known, 1, 'muesli zout onbekend telt niet mee'); assert.equal(n.coverage.salt.missing, 3);
  assert.equal(n.total.salt, 0.2);
  assert.deepEqual(n.missingReasons.map(m => m.reason), ['geen product gekoppeld', 'geen product gekoppeld']);
  assert.equal(N.formatValue(n.perServing.energyKcal, 'kcal', n.complete.energyKcal), '≥ 305 kcal');
  assert.equal(N.formatValue(null, 'g', false), 'onbekend');
  assert.equal(N.formatValue(0, 'g', true), '0 g');
});

test('recipeNutrition: zonder ingrediënten of zonder bekende waarden', () => {
  assert.equal(N.recipeNutrition(N.normalizeRecipe({ title: 'Leeg' }), []).status, 'geen-ingredienten');
  const n = N.recipeNutrition(N.normalizeRecipe({ title: 'X', ingredients: ['1 ui'] }), []);
  assert.equal(n.status, 'onbekend'); assert.equal(n.perServing.energyKcal, null);
});

test('benaderde grammen (ml/lepels) worden gemarkeerd', () => {
  const r = N.normalizeRecipe({ title: 'Saus', ingredients: [{ text: '2 el yoghurt', productId: 'p-yog' }] });
  assert.equal(N.recipeNutrition(r, [yoghurt]).approx, true);
});

test('opgegeven waarden van de bron blijven apart van de berekening', () => {
  const r = N.normalizeRecipe({ title: 'Osta-gerecht', declaredPerServing: { energyKcal: 520, proteins: 25 }, ingredients: ['1 ui'] });
  const n = N.recipeNutrition(r, []);
  assert.equal(n.declaredPerServing.energyKcal, 520); assert.equal(n.declaredPerServing.fat, null);
  assert.equal(n.perServing.energyKcal, null);
});

test('weekmenu: koppeling via recipeId, anders voorstel op titel; samenvatting per dag', () => {
  const store = N.normalizeStore({ products: [yoghurt], recipes: [{ id: 'r1', title: 'Yoghurt-bowl', ingredients: [{ name: 'yoghurt', grams: 200, productId: 'p-yog' }] }, { id: 'r2', title: 'Pasta pesto' }] });
  const meals = [{ id: 'm1', date: '2026-11-09', title: 'yoghurt bowl', type: 'Ontbijt' }, { id: 'm2', date: '2026-11-09', title: 'Iets anders', recipeId: 'r2' }, { id: 'm3', date: '2026-11-10', title: 'Pizza' }];
  const week = N.weekSummary(meals, store, ['2026-11-09', '2026-11-10', '2026-11-11']);
  assert.equal(week[0].total, 2); assert.equal(week[0].withRecipe, 2);
  assert.equal(week[0].items[0].linked, false); assert.equal(week[0].items[0].nutrition.perServing.energyKcal, 120);
  assert.equal(week[0].items[1].linked, true);
  assert.equal(week[1].items[0].recipe, null);
  const checks = N.weekChecks(week);
  assert.equal(checks.method, 'regelgebaseerd');
  assert.ok(checks.notes.some(n => /zonder gekoppeld recept/.test(n.text)));
  assert.ok(checks.notes.some(n => /dag\(en\) zonder/.test(n.text)));
});

test('boodschappen uit recepten: samengevoegd op naam', () => {
  const items = N.groceryItemsFor([N.normalizeRecipe({ title: 'A', ingredients: ['250 g spinazie', '1 ui'] }), N.normalizeRecipe({ title: 'B', ingredients: ['1 ui'] })]);
  assert.equal(items.length, 2);
  assert.deepEqual(items.find(i => /ui/.test(i.title)).recipes, ['A', 'B']);
});

test('upsertProduct: nieuw toevoegen; bijwerken verliest nooit bekende waarden', () => {
  let { store, action } = N.upsertProduct({}, muesli);
  assert.equal(action, 'added');
  const update = { ...muesli, per100g: { ...N.emptyNutrients(), salt: 0.05 }, ingredientsText: '' };
  ({ store, action } = N.upsertProduct(store, update));
  assert.equal(action, 'updated');
  const p = store.products[0];
  assert.equal(p.per100g.energyKcal, 370, 'bekende waarde blijft'); assert.equal(p.per100g.salt, 0.05, 'onbekende waarde aangevuld');
  assert.equal(store.products.length, 1);
});

test('normalizeStore: behoudt onbekende velden, schoont kapotte items op, begrenst aantallen', () => {
  const s = N.normalizeStore({ futureField: { a: 1 }, products: [{ id: 'x', name: 'X', per100g: { fat: '2' } }, { name: 'zonder id' }, 5], recipes: [{ title: 'R' }, { nope: 1 }] });
  assert.deepEqual(s.futureField, { a: 1 });
  assert.equal(s.products.length, 1); assert.equal(s.products[0].per100g.fat, 2); assert.equal(s.products[0].per100g.proteins, null);
  assert.equal(s.recipes.length, 1); assert.equal(s.version, 1);
  assert.deepEqual(N.normalizeStore(undefined), { version: 1, products: [], recipes: [] });
  assert.equal(N.productUsage(N.normalizeStore({ recipes: [{ title: 'R', ingredients: [{ name: 'x', productId: 'x' }] }] }), 'x')[0], 'R');
});
