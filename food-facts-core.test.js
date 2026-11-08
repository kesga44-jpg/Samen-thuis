// Open Food Facts: normalisatie, onderscheid onbekend/0, kwaliteit, limieten, cache en foutafhandeling.
const test = require('node:test');
const assert = require('node:assert/strict');
const FF = require('./food-facts-core.js');
// Maakt een geldige GTIN (controlecijfer) van een basisreeks.
const gtin = base => { const d = base.split('').map(Number).reverse(); const t = d.reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0); return base + ((10 - (t % 10)) % 10); };

const OFF_PRODUCT = {
  status: 1, code: '8710400000006',
  product: {
    code: '8710400000006', product_name: 'Volle yoghurt', product_name_nl: 'Volle yoghurt', brands: 'Huismerk, Iets', quantity: '1 l',
    serving_size: '150 g', serving_quantity: 150,
    nutriments: { 'energy-kcal_100g': 61, fat_100g: 3.3, 'saturated-fat_100g': 2.2, carbohydrates_100g: 4.2, sugars_100g: 4.2, fiber_100g: 0, proteins_100g: 3.7, salt_100g: 0.13 },
    ingredients_text_nl: 'volle melk, melkzuurbacteriën', allergens_tags: ['en:milk'], traces_tags: [], nutriscore_grade: 'b', nova_group: 1,
    states_tags: ['en:complete'], last_modified_t: 1760000000
  }
};

test('barcode: opschonen en GTIN-controlecijfer', () => {
  assert.equal(FF.cleanBarcode(' 87-10400 '), '8710400');
  assert.equal(FF.cleanBarcode('12'), '');
  assert.deepEqual(FF.barcodeCheck('4006381333931'), { valid: true, checked: true });
  assert.deepEqual(FF.barcodeCheck('4006381333932'), { valid: false, checked: true });
  assert.deepEqual(FF.barcodeCheck('1234567'), { valid: true, checked: false });
});

test('num: onbekend → null, expliciete 0 blijft 0, komma als decimaal, negatief ongeldig', () => {
  assert.equal(FF.num(undefined), null); assert.equal(FF.num(''), null); assert.equal(FF.num(null), null);
  assert.equal(FF.num(0), 0); assert.equal(FF.num('0'), 0); assert.equal(FF.num('1,5'), 1.5); assert.equal(FF.num(-1), null); assert.equal(FF.num('abc'), null);
});

test('normalizeProduct: per 100 g, per portie (afgeleid), allergenen in het Nederlands, bron en licentie', () => {
  const p = FF.normalizeProduct(OFF_PRODUCT, '2026-11-08T10:00:00.000Z');
  assert.equal(p.id, 'off-8710400000006');
  assert.equal(p.name, 'Volle yoghurt'); assert.equal(p.brand, 'Huismerk');
  assert.equal(p.per100g.energyKcal, 61); assert.equal(p.per100g.fiber, 0, 'expliciete 0 blijft 0');
  assert.equal(p.servingGrams, 150);
  assert.equal(p.perServing.energyKcal, 91.5); assert.equal(p.perServing.proteins, 5.6);
  assert.ok(p.derived.includes('perServing'));
  assert.deepEqual(p.allergens, ['Melk']); assert.equal(p.allergensStatus, 'declared');
  assert.equal(p.nutriscore, 'b'); assert.equal(p.nova, 1);
  assert.equal(p.sourceUrl, 'https://world.openfoodfacts.org/product/8710400000006');
  assert.match(p.license, /ODbL/);
  assert.equal(p.quality.level, 'goed'); assert.equal(p.quality.knownNutrients, 8);
});

test('ontbrekende gegevens blijven null en worden als kwaliteitsprobleem gemeld; allergenen "onbekend" ≠ "geen"', () => {
  const p = FF.normalizeProduct({ status: 1, product: { code: '12345670', product_name: 'Iets', nutriments: { 'energy-kj_100g': 418.4, sodium_100g: 0.4 } } });
  assert.equal(p.per100g.fat, null); assert.equal(p.per100g.proteins, null);
  assert.equal(p.per100g.energyKcal, 100, 'kJ omgerekend'); assert.equal(p.per100g.salt, 1, 'zout uit natrium');
  assert.deepEqual(p.derived.sort(), ['energyKcal', 'salt']);
  assert.equal(p.allergensStatus, 'unknown');
  assert.equal(p.servingGrams, null);
  assert.equal(FF.knownCount(p.perServing), 0, 'zonder portiegewicht geen per-portiewaarden verzinnen');
  assert.ok(p.quality.issues.some(i => /6 van 8/.test(i)));
  assert.ok(p.quality.issues.some(i => /Allergenen onbekend/.test(i)));
  assert.equal(p.quality.level, 'beperkt');
});

test('no_nutrition_data en lege payload', () => {
  const p = FF.normalizeProduct({ product: { code: '12345670', product_name: 'Thee', no_nutrition_data: 'on' } });
  assert.equal(p.noNutritionData, true);
  assert.ok(p.quality.issues.includes('Fabrikant geeft geen voedingswaarden op'));
  assert.equal(FF.normalizeProduct({ status: 0 }), null);
  assert.equal(FF.normalizeProduct(null), null);
});

test('handmatig product: lege velden null, naam verplicht, per portie alleen met portiegewicht', () => {
  const p = FF.manualProduct({ name: 'Zelfgemaakte saus', per100g: { energyKcal: '120', fat: '' }, servingGrams: 50, allergens: 'selderij, mosterd' });
  assert.equal(p.per100g.energyKcal, 120); assert.equal(p.per100g.fat, null);
  assert.equal(p.perServing.energyKcal, 60); assert.equal(p.perServing.fat, null);
  assert.deepEqual(p.allergens, ['selderij', 'mosterd']); assert.equal(p.source, 'manual');
  assert.throws(() => FF.manualProduct({ name: ' ' }), /naam/);
});

test('zoekresultaten: alleen bruikbare producten, maximaal 20', () => {
  const r = FF.normalizeSearch({ products: [{ code: '12345670', product_name: 'A' }, { code: '', product_name: 'B' }, { code: '87654321' }] });
  assert.deepEqual(r, [{ barcode: '12345670', name: 'A', brand: '', quantity: '' }]);
  assert.deepEqual(FF.normalizeSearch(null), []);
});

function memoryStorage() { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m }; }
const okResponse = body => ({ ok: true, status: 200, json: async () => body });

test('client: haalt product op, cachet per barcode en vraagt het tweede keer niet opnieuw op', async () => {
  let calls = 0; const urls = [];
  const client = FF.createClient({ storage: memoryStorage(), fetchImpl: async (url) => { calls++; urls.push(url); return okResponse(OFF_PRODUCT); } });
  const a = await client.product('8710400000006');
  assert.equal(a.fromCache, false); assert.equal(a.product.name, 'Volle yoghurt');
  const b = await client.product('8710400000006');
  assert.equal(b.fromCache, true); assert.equal(calls, 1);
  assert.match(urls[0], /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/8710400000006\.json\?fields=/);
  assert.match(urls[0], /nutriments/);
});

test('client: limiet van 10 productopvragingen per minuut; daarna duidelijke melding of cache', async () => {
  let t = 0; const storage = memoryStorage();
  const client = FF.createClient({ storage, now: () => t, fetchImpl: async (url) => okResponse({ status: 1, product: { code: /product\/(\d+)/.exec(url)[1], product_name: 'P' } }) });
  for (let i = 0; i < 10; i++) await client.product(gtin(String(1000000 + i)), { force: true });
  await assert.rejects(client.product(gtin('2000000'), { force: true }), e => e.kind === 'rate-limit' && e.retryInSeconds > 0);
  t = 61000;
  assert.equal((await client.product(gtin('2000000'), { force: true })).fromCache, false);
});

test('client: zoeken vereist ≥3 tekens, gebruikt eigen limiet (6/min)', async () => {
  const client = FF.createClient({ storage: memoryStorage(), fetchImpl: async () => okResponse({ products: [{ code: '12345670', product_name: 'Hagelslag' }] }) });
  await assert.rejects(client.search('ha'), e => e.kind === 'invalid');
  for (let i = 0; i < 6; i++) assert.equal((await client.search('hagelslag')).length, 1);
  await assert.rejects(client.search('hagelslag'), e => e.kind === 'rate-limit');
});

test('client: foutsoorten — ongeldige barcode, niet gevonden, 429, 5xx, netwerk, time-out, kapotte JSON', async () => {
  const mk = impl => FF.createClient({ storage: memoryStorage(), fetchImpl: impl, timeoutMs: 20 });
  await assert.rejects(mk(async () => okResponse({})).product('4006381333932'), e => e.kind === 'invalid' && /controlecijfer/.test(e.message));
  await assert.rejects(mk(async () => okResponse({ status: 0 })).product('12345670'), e => e.kind === 'not-found');
  await assert.rejects(mk(async () => ({ ok: false, status: 404 })).product('12345670'), e => e.kind === 'not-found');
  await assert.rejects(mk(async () => ({ ok: false, status: 429 })).product('12345670'), e => e.kind === 'rate-limit');
  await assert.rejects(mk(async () => ({ ok: false, status: 503 })).product('12345670'), e => e.kind === 'server');
  await assert.rejects(mk(async () => { throw new TypeError('Failed to fetch'); }).product('12345670'), e => e.kind === 'network');
  await assert.rejects(mk((url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' }))))).product('12345670'), e => e.kind === 'timeout');
  await assert.rejects(mk(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } })).product('12345670'), e => e.kind === 'server');
});

test('offline: verlopen cache wordt gebruikt als het netwerk faalt (met waarschuwing)', async () => {
  let t = 0; let online = true; const storage = memoryStorage();
  const client = FF.createClient({ storage, now: () => t, fetchImpl: async () => { if (!online) throw new TypeError('offline'); return okResponse(OFF_PRODUCT); } });
  await client.product('8710400000006');
  t = FF.CACHE_TTL_MS + 1; online = false;
  const r = await client.product('8710400000006');
  assert.equal(r.stale, true); assert.equal(r.fromCache, true); assert.match(r.warning, /Geen verbinding/);
});

test('cache: begrensd tot maximum, oudste eerst weg; volle opslag breekt niets', () => {
  let t = 0; const storage = memoryStorage();
  const cache = FF.createCache({ storage, now: () => t++, max: 3 });
  ['a', 'b', 'c', 'd'].forEach(k => cache.set(k, { k }));
  assert.equal(cache.size(), 3); assert.equal(cache.get('a'), null); assert.ok(cache.get('d'));
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  const c2 = FF.createCache({ storage: full }); assert.doesNotThrow(() => c2.set('x', {}));
});
