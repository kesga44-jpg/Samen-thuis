const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./supabase/functions/_shared/price-history-core.js');

function observation(price, overrides = {}) {
  return {
    date: '2026-11-01',
    price,
    source: 'PrijsProfeet',
    retailer: 'Jumbo',
    name: 'Voorbeeldproduct',
    productId: 'product-1',
    baseProductId: 'base-1',
    ean: '8712345678901',
    packaging: '500 g',
    matchReliable: true,
    ...overrides
  };
}

test('learned thresholds need four distinct prices for the same verified product and package', () => {
  const history = [1, 2, 3].map(price => observation(price));
  assert.deepEqual(core.learnedThresholds({ latest: observation(4), history }), { floor: null, good: null, count: 3 });
  const learned = core.learnedThresholds({ latest: observation(4), history: [...history, observation(4)] });
  assert.deepEqual(learned, { floor: 1.45, good: 2.05, count: 4 });
});

test('invalid, duplicate, legacy, fuzzy, and mismatched observations do not train thresholds', () => {
  const latest = observation(4);
  const history = [
    observation(1), observation(1, { date: '2026-11-02' }), observation(2), observation(3),
    observation(null), observation(''), observation('NaN'),
    observation(5, { packaging: '1 kg' }),
    observation(6, { productId: 'product-2', baseProductId: 'base-2', ean: '8712345678902' }),
    observation(7, { source: '' }),
    observation(8, { matchReliable: false }),
    { date: '2026-11-03', price: 9, name: latest.name }
  ];
  assert.deepEqual(core.learnedThresholds({ latest, history }), { floor: null, good: null, count: 3 });
  assert.equal(core.sameProductAndPackage(latest, observation(2, { source: 'Andere bron' })), false);
  assert.equal(core.sameProductAndPackage(latest, observation(2, { packaging: '1 kg' })), false);
});

test('legacy history remains intact but cannot be used without source, package, and match evidence', () => {
  const legacy = [
    { date: '2026-10-01', price: 1, name: 'Voorbeeldproduct' },
    { date: '2026-10-02', price: 2, productId: 'product-1', baseProductId: 'base-1' },
    { date: '2026-10-03', price: 3, source: 'PrijsProfeet', productId: 'product-1', baseProductId: 'base-1' }
  ];
  const before = structuredClone(legacy);
  assert.deepEqual(core.learnedThresholds({ latest: observation(4), history: legacy }), { floor: null, good: null, count: 0 });
  assert.deepEqual(legacy, before);
});

test('discount percentage alone never marks an offer as a good or strong deal', () => {
  assert.equal(core.priceStatus({
    latest: observation(5, { savingsPercentage: 80 }),
    history: []
  }).code, 'deal');
});

test('manual thresholds take precedence, while unverified matches never receive an automatic label', () => {
  const track = {
    latest: observation(2, { savingsPercentage: 90 }),
    history: [1, 2, 3, 4].map(price => observation(price)),
    manualFloor: 2.5,
    manualGood: 3
  };
  assert.equal(core.priceStatus(track).code, 'floor');
  track.latest = observation(2, { matchReliable: false, savingsPercentage: 90 });
  assert.equal(core.priceStatus(track).code, 'floor');
  track.manualFloor = null;
  track.manualGood = null;
  assert.equal(core.priceStatus(track).code, 'unverified');
});

test('PrijsProfeet search reliability and response normalization use documented fields', () => {
  const exact = { approximate: false, unmatched_terms: [] };
  assert.equal(core.isReliableSearchResponse(exact), true);
  assert.equal(core.isReliableSearchResponse({ approximate: true, unmatched_terms: [] }), false);
  assert.equal(core.isReliableSearchResponse({ approximate: false, unmatched_terms: ['melk'] }), false);
  assert.equal(core.isReliableSearchResponse({ results: [] }), false);

  const product = core.normalizeProviderProduct({
    product_id: 'p-123',
    base_product_id: 'bp-123',
    name: 'Melk',
    brand: 'Merk',
    retailer: 'Jumbo',
    price: '1.29',
    ean: '8712345678901',
    quantity: '1 liter',
    unit_price: 1.29,
    unit: 'l'
  }, exact);
  assert.deepEqual(product, {
    productId: 'p-123',
    baseProductId: 'bp-123',
    name: 'Melk',
    brand: 'Merk',
    retailer: 'Jumbo',
    price: 1.29,
    originalPrice: null,
    savingsPercentage: null,
    ean: '8712345678901',
    packaging: '1 liter',
    quantity: '1 liter',
    unitPriceValue: 1.29,
    unitPriceUnit: 'l',
    source: 'PrijsProfeet',
    matchReliable: true
  });
  assert.equal(core.normalizeProviderProduct({ product_id: 'p-2' }, { approximate: true }).matchReliable, false);
});

test('observations retain source, retailer, product identifiers, package, and unit price', () => {
  const result = core.createObservation({
    ...observation('1.50'),
    validFrom: '2026-11-05',
    validUntil: '2026-11-12',
    checkedAt: '2026-11-09T12:00:00Z',
    unitPriceValue: '3.00',
    unitPriceUnit: 'kg'
  });
  assert.deepEqual(result, {
    date: '2026-11-09',
    validFrom: '2026-11-05',
    validUntil: '2026-11-12',
    price: 1.5,
    source: 'PrijsProfeet',
    retailer: 'Jumbo',
    name: 'Voorbeeldproduct',
    productId: 'product-1',
    baseProductId: 'base-1',
    ean: '8712345678901',
    packaging: '500 g',
    unitPriceValue: 3,
    unitPriceUnit: 'kg',
    matchReliable: true
  });
  assert.equal(core.createObservation({ price: null }), null);
});

test('price refresh stores API provenance and retains last known data on a failed lookup', async () => {
  const { refreshPriceTracks, priceSummary } = await import('./js/prices.js');
  const latest = observation(2);
  const existingHistory = [observation(1)];
  const track = { id: 'track-1', query: 'Voorbeeldproduct', latest, history: existingHistory, error: '' };
  let saved = false;
  const store = {
    data: {
      settings: { autoPriceRefresh: true, priceRefreshHours: 12, supabaseUrl: 'https://example.test', supabaseAnonKey: '' },
      priceTracks: [track]
    },
    save() { saved = true; }
  };
  const result = observation('1.50', { validFrom: '2026-11-05', unitPriceValue: 3, unitPriceUnit: 'kg' });
  const response = payload => ({ ok: true, json: async () => payload });
  const calls = [];
  await refreshPriceTracks(store, {
    force: true,
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return response({ results: [{ id: 'track-1', result, error: '' }] });
    }
  });
  assert.equal(calls[0].body.queries[0].query, 'Voorbeeldproduct');
  assert.equal(track.history.at(-1).source, 'PrijsProfeet');
  assert.equal(track.history.at(-1).productId, 'product-1');
  assert.equal(track.history.at(-1).packaging, '500 g');
  assert.equal(track.history.at(-1).unitPriceValue, 3);
  assert.equal(track.latest.matchReliable, true);
  assert.equal(saved, true);

  const lastKnown = track.latest;
  const historyLength = track.history.length;
  await refreshPriceTracks(store, {
    force: true,
    fetchImpl: async () => response({ results: [{ id: 'track-1', result: null, error: 'PrijsProfeet 429' }] })
  });
  assert.equal(track.latest, lastKnown);
  assert.equal(track.history.length, historyLength);
  assert.equal(track.error, 'PrijsProfeet 429');
  assert.match(priceSummary(track), /laatst bekende prijs wordt getoond/);
});

test('price summary escapes untrusted API fields and labels unverified matches', async () => {
  const { priceSummary } = await import('./js/prices.js');
  const html = priceSummary({
    query: 'Product',
    latest: observation(1, { name: '<img src=x onerror=alert(1)>', retailer: '<script>bad</script>', matchReliable: false })
  });
  assert.match(html, /Match controleren/);
  assert.match(html, /Niet gebruikt voor automatische prijsgrenzen/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<img|<script>/);
  assert.match(priceSummary({ query: 'Product', latest: observation(1, { matchReliable: false }) }, { compact: true }), /Match controleren/);
});

test('both retained price modules use the shared reliability rules', async () => {
  const [beta, root] = await Promise.all([import('./js/prices.js'), import('./prices.js')]);
  const track = { latest: observation(1, { savingsPercentage: 80 }), history: [] };
  assert.equal(beta.priceStatus(track).code, 'deal');
  assert.equal(root.priceStatus(track).code, 'deal');
});
