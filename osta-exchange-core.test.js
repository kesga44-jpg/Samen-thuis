// Osta ↔ Samen Thuis: gecontroleerde import/export zonder dubbele recepten en zonder verlies van voedingsinformatie.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const X = require('./osta-exchange-core.js');
const N = require('./nutrition-core.js');

const fixture = f => fs.readFileSync(__dirname + '/test-fixtures/recipes/' + f, 'utf8');

test('Osta-tekst: receptblokken met porties, ingrediënten, stappen, opgegeven voedingswaarden en bron', () => {
  const parsed = X.parseAny(fixture('osta-gedeeld.txt'));
  assert.equal(parsed.format, 'osta-tekst'); assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.recipes.length, 2);
  const [pasta, curry] = parsed.recipes;
  assert.equal(pasta.title, 'Pasta pesto'); assert.equal(pasta.servings, 4);
  assert.deepEqual(pasta.ingredients.map(i => i.text), ['400 g pasta', '1 potje pesto', '100 g Parmezaanse kaas']);
  assert.deepEqual(pasta.steps, ['Kook de pasta.', 'Meng met pesto.']);
  assert.equal(pasta.declaredPerServing.energyKcal, 610); assert.equal(pasta.declaredPerServing.salt, 1.4);
  assert.equal(pasta.declaredPerServing.fiber, null, 'niet opgegeven blijft onbekend');
  assert.equal(pasta.sourceUrl, 'https://example.org/pasta-pesto');
  assert.equal(curry.ingredients.length, 2, '“# Grocery List” sluit het recept af');
});

test('schema.org/Recipe JSON-LD in @graph: titel, porties, stappen (secties), tags, voedingswaarden (natrium → zout)', () => {
  const parsed = X.parseAny(fixture('schema-org.json'));
  assert.equal(parsed.format, 'schema.org');
  const r = parsed.recipes[0];
  assert.equal(r.title, 'Tomatensoep'); assert.equal(r.servings, 4);
  assert.deepEqual(r.steps, ['Snijd alles.', 'Kook 20 minuten.']);
  assert.ok(r.tags.includes('Soep') && r.tags.includes('vega'));
  assert.equal(r.declaredPerServing.energyKcal, 180); assert.equal(r.declaredPerServing.salt, 1.5);
  assert.equal(r.externalRef, 'https://example.org/r/soep#recipe');
});

test('onbekende of te nieuwe formaten geven een duidelijke fout en importeren niets', () => {
  assert.match(X.parseAny('').errors[0], /Geen inhoud/);
  assert.match(X.parseAny('{kapot').errors[0], /Ongeldige JSON/);
  assert.match(X.parseAny('{"a":1}').errors[0], /Geen recepten/);
  assert.match(X.parseAny(JSON.stringify({ format: X.FORMAT, version: 99, recipes: [] })).errors[0], /versie 99/);
  assert.match(X.parseAny('Maandag: soep').errors[0], /Geen receptblokken/);
  assert.match(X.parseAny('x'.repeat(500001)).errors[0], /te groot/);
});

test('planImport wijzigt niets; applyImport voegt toe na bevestiging', () => {
  const store = N.normalizeStore({});
  const plan = X.planImport(store, X.parseAny(fixture('osta-gedeeld.txt')));
  assert.deepEqual(plan.counts, { add: 2, merge: 0, same: 0, skip: 0 });
  assert.equal(store.recipes.length, 0, 'voorbeeld schrijft niets');
  const { store: next, result } = X.applyImport(store, plan);
  assert.equal(result.added, 2); assert.equal(next.recipes.length, 2);
  assert.equal(next.recipes[0].source, 'osta');
});

test('opnieuw importeren maakt geen dubbelen ("same") en dubbel in hetzelfde bestand wordt overgeslagen', () => {
  let store = X.applyImport({}, X.planImport({}, X.parseAny(fixture('osta-gedeeld.txt')))).store;
  const again = X.planImport(store, X.parseAny(fixture('osta-gedeeld.txt')));
  assert.deepEqual(again.counts, { add: 0, merge: 0, same: 2, skip: 0 });
  const twice = fixture('osta-gedeeld.txt').replace('# Grocery List', '# Recept: Curry\nIngredients:\n- 1 ui\n- 400 ml kokosmelk\n\n# Grocery List');
  const p = X.planImport({}, X.parseAny(twice));
  assert.equal(p.counts.skip, 1); assert.equal(p.counts.add, 2);
});

test('herimport uit Osta: bron wint voor receptinhoud, annotaties van Samen Thuis blijven, niets verdwijnt ongemerkt', () => {
  let store = X.applyImport({}, X.planImport({}, X.parseAny(fixture('osta-gedeeld.txt')))).store;
  // Samen Thuis-annotaties: product gekoppeld en gewicht ingevuld bij een ingrediënt zonder gewicht in de bron.
  const pasta = store.recipes.find(r => r.title === 'Pasta pesto');
  pasta.ingredients[1].productId = 'p-pesto'; pasta.ingredients[1].grams = 190;
  pasta.ingredients[2].productId = 'p-kaas';
  pasta.servingsOverride = 3;
  const changed = fixture('osta-gedeeld.txt')
    .replace('Voedingswaarde per portie: 610 kcal, eiwit 22 g, vet 24 g, koolhydraten 75 g, zout 1,4 g', 'Voedingswaarde per portie: 650 kcal, vezels 4 g')
    .replace('- 100 g Parmezaanse kaas', '- 50 g pijnboompitten')
    .replace('2. Meng met pesto.', '2. Meng met pesto en pijnboompitten.');
  const plan = X.planImport(store, X.parseAny(changed));
  const item = plan.items.find(i => i.title === 'Pasta pesto');
  assert.equal(item.action, 'merge');
  assert.equal(item.addedIngredients, 1);
  assert.deepEqual(item.removedIngredients, ['Parmezaanse kaas']);
  assert.deepEqual(item.lostAnnotations, ['Parmezaanse kaas'], 'vervallen koppeling wordt gemeld');
  assert.ok(item.changes.some(c => c.field === 'energyKcal' && c.from === 610 && c.to === 650));
  assert.ok(item.kept.some(k => /voedingswaarde/.test(k)));
  store = X.applyImport(store, plan).store;
  const merged = store.recipes.find(r => r.title === 'Pasta pesto');
  assert.equal(merged.declaredPerServing.energyKcal, 650, 'waarde uit Osta wint');
  assert.equal(merged.declaredPerServing.fiber, 4, 'nieuwe waarde uit Osta');
  assert.equal(merged.declaredPerServing.proteins, 22, 'niet meer opgegeven waarde blijft behouden');
  assert.deepEqual(merged.ingredients.map(i => i.name), ['pasta', 'potje pesto', 'pijnboompitten'], 'ingrediëntenlijst volgt de bron');
  assert.equal(merged.ingredients[1].productId, 'p-pesto'); assert.equal(merged.ingredients[1].grams, 190, 'eigen gewicht blijft bij bron zonder gewicht');
  assert.equal(merged.steps[1], 'Meng met pesto en pijnboompitten.');
  assert.equal(merged.servings, 4); assert.equal(merged.servingsOverride, 3, 'planningsporties blijven');
  assert.equal(store.recipes.length, 2, 'geen dubbel recept');
});

test('bron zonder porties of ingrediënten wist bestaande waarden niet', () => {
  let store = X.applyImport({}, X.planImport({}, X.parseAny(fixture('osta-gedeeld.txt')))).store;
  const plan = X.planImport(store, X.parseAny('# Recept: Pasta pesto\nBereiding:\n1. Nieuwe stap.'));
  store = X.applyImport(store, plan).store;
  const r = store.recipes.find(x => x.title === 'Pasta pesto');
  assert.equal(r.servings, 4); assert.equal(r.ingredients.length, 3); assert.deepEqual(r.steps, ['Nieuwe stap.']);
  assert.ok(plan.items[0].kept.includes('porties') && plan.items[0].kept.includes('ingrediënten'));
});

test('twijfelgeval (alleen gelijke titel) wordt standaard als aparte kopie toegevoegd; bijwerken alleen als gekozen', () => {
  const store = N.normalizeStore({ recipes: [{ title: 'Curry', ingredients: ['1 kip', '1 pot saus'] }] });
  const plan = X.planImport(store, X.parseAny('# Recept: Curry\nIngrediënten:\n- 1 bloemkool'));
  assert.equal(plan.items[0].action, 'merge'); assert.equal(plan.items[0].uncertain, true); assert.equal(plan.items[0].matchedBy, 'titel');
  const safe = X.applyImport(store, plan);
  assert.equal(safe.result.added, 1); assert.equal(safe.store.recipes.length, 2);
  assert.deepEqual(safe.store.recipes[0].ingredients.map(i => i.name), ['kip', 'pot saus'], 'bestaande kopie onaangetast');
  const upd = X.applyImport(store, plan, { updateUncertain: true });
  assert.equal(upd.result.merged, 1); assert.equal(upd.store.recipes.length, 1);
});

test('export → import van het eigen formaat is verliesvrij en herkent alles als bestaand', () => {
  const FFc = require('./food-facts-core.js');
  const product = FFc.manualProduct({ id: 'p1', name: 'Pasta', per100g: { energyKcal: 350 } });
  let store = N.normalizeStore({ products: [product], recipes: [{ id: 'r1', title: 'Pasta', servings: 2, ingredients: [{ name: 'pasta', grams: 200, productId: 'p1' }], declaredPerServing: { energyKcal: 400 } }] });
  const bundle = X.exportBundle(store, { now: '2026-11-08T00:00:00Z' });
  assert.equal(bundle.format, X.FORMAT); assert.equal(bundle.version, 1);
  assert.equal(bundle.products.length, 1, 'alleen gekoppelde producten');
  assert.match(bundle.recipes[0].checksum, /^[0-9a-f]{8}$/);
  const roundTrip = X.parseAny(JSON.stringify(bundle));
  const fresh = X.applyImport({}, X.planImport({}, roundTrip)).store;
  assert.equal(fresh.recipes[0].id, 'r1'); assert.equal(fresh.recipes[0].ingredients[0].productId, 'p1');
  assert.equal(fresh.recipes[0].declaredPerServing.energyKcal, 400);
  assert.equal(fresh.products[0].per100g.energyKcal, 350);
  assert.deepEqual(X.planImport(store, roundTrip).counts, { add: 0, merge: 0, same: 1, skip: 0 });
});

test('schema.org-export: alleen volledige berekende waarden of opgegeven waarden', () => {
  const FFc = require('./food-facts-core.js');
  const full = FFc.manualProduct({ id: 'p1', name: 'X', per100g: { energyKcal: 100, fat: 1, saturatedFat: 0, carbohydrates: 20, sugars: 1, fiber: 2, proteins: 3, salt: 0 } });
  const store = N.normalizeStore({ products: [full], recipes: [
    { title: 'Volledig', servings: 2, ingredients: [{ name: 'x', grams: 200, productId: 'p1' }] },
    { title: 'Onvolledig', ingredients: [{ name: 'x', grams: 100, productId: 'p1' }, '1 ui'] }] });
  const out = X.exportSchemaOrg(store);
  assert.equal(out[0]['@type'], 'Recipe'); assert.equal(out[0].nutrition.calories, '100 kcal');
  assert.equal(out[1].nutrition, undefined, 'onvolledige berekening wordt niet als feit geëxporteerd');
});
