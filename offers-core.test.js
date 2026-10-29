const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('./offers-core.js');

const api = core.KNOWN_CATEGORIES.map((c, i) => ({ ...c, count: 10 + i }));

test('25 known categories are grouped into five groups from the API group field', () => {
  assert.equal(api.length, 25);
  const groups = core.buildCategoryGroups(api);
  assert.deepEqual(groups.map(g => g.id), ['vers', 'houdbaar', 'dranken', 'verzorging', 'overig']);
  assert.deepEqual(groups.map(g => g.categories.length), [7, 4, 3, 7, 4]);
  assert.equal(core.categoryBySlug(groups, 'kaas').name, 'Kaas & Vleeswaren');
  assert.equal(core.categoryBySlug(groups, 'kaas').count, 13);
  assert.deepEqual(core.buildCategoryGroups([{ slug: 'enkel', name: 'Enkel', group: 'vers' }]).map(g => g.id), ['vers', 'houdbaar', 'dranken', 'verzorging', 'overig']);
});

test('new and unknown-group categories are kept in the five official groups', () => {
  const groups = core.buildCategoryGroups([...api, { slug: 'nieuw', name: 'Nieuw', group: 'vers' }, { slug: 'x', name: 'X', group: 'extra' }, { slug: 'kaas', name: 'dup', group: 'vers' }, { slug: 'nogroup', name: 'Zonder' }]);
  assert.equal(groups.find(g => g.id === 'vers').categories.at(-1).slug, 'nieuw');
  assert.equal(groups.find(g => g.id === 'vers').categories.filter(c => c.slug === 'kaas').length, 1);
  assert.deepEqual(groups.map(g => g.id), ['vers', 'houdbaar', 'dranken', 'verzorging', 'overig']);
  assert.ok(groups.find(g => g.id === 'overig').categories.some(c => c.slug === 'x'));
  assert.ok(groups.find(g => g.id === 'overig').categories.some(c => c.slug === 'nogroup'));
  assert.deepEqual(core.buildCategoryGroups(null), []);
});

test('offers are linked via the official slug, not product name', () => {
  const groups = core.buildCategoryGroups(api);
  const choc = core.applyOfficialCategory({ name: 'Melk chocolade', unifiedCategory: 'snoep-koek-chips' }, groups);
  assert.equal(choc.category, 'Snoep, Koek & Chips');
  assert.equal(choc.categoryGroup, 'houdbaar');
  const unknown = core.applyOfficialCategory({ name: 'Melk', unifiedCategory: 'bestaat-niet' }, groups);
  assert.equal(unknown.categoryGroup, '');
  assert.equal(core.applyOfficialCategory({ name: 'Melk' }, groups).category, 'Onbekend');
});

test('category selection and store filters combine', () => {
  const groups = core.buildCategoryGroups(api);
  const offers = [
    { name: 'a', store: 'Jumbo', unifiedCategory: 'zuivel-eieren' },
    { name: 'b', store: 'Lidl', unifiedCategory: 'zuivel-eieren' },
    { name: 'c', store: 'Jumbo', unifiedCategory: 'snoep-koek-chips' }
  ].map(o => core.applyOfficialCategory(o, groups));
  const out = offers.filter(o => core.matchesOfferFilters(o, { stores: ['Jumbo'] }) && core.matchesCategorySelection(o, { categorySlug: 'zuivel-eieren' }));
  assert.deepEqual(out.map(o => o.name), ['a']);
  assert.equal(offers.filter(o => core.matchesCategorySelection(o, { group: 'vers' })).length, 2);
});

test('fetchOffers sends the slug as category and categories request is parsed', async () => {
  let body;
  const ok = payload => async (url, init) => { body = JSON.parse(init.body); return { ok: true, json: async () => payload }; };
  const r = await core.fetchOffers({ query: 'melk', category: 'zuivel-eieren', page: 2, url: 'x', fetchImpl: ok({ offers: [{ name: 'M', store: 'Jumbo', price: 1, unifiedCategory: 'zuivel-eieren' }], hasMore: true }) });
  assert.deepEqual(body, { search: 'melk', category: 'zuivel-eieren', page: 2 });
  assert.equal(r.hasMore, true);
  assert.equal(r.offers[0].categorySlug, 'zuivel-eieren');
  const c = await core.fetchCategories({ url: 'x', fetchImpl: ok({ categories: api }) });
  assert.deepEqual(body, { categories: true });
  assert.equal(c.categories.length, 25);
  await assert.rejects(core.fetchCategories({ url: 'x', fetchImpl: ok({ categories: [] }) }));
  await assert.rejects(core.fetchCategories({ url: 'x', fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) }));
});

test('merging pages does not create duplicates', () => {
  const o = { name: 'M', brand: 'B', size: '1l', store: 'Jumbo', price: 1 };
  assert.equal(core.mergeOffers([o], [{ ...o }, { ...o, name: 'N' }]).length, 2);
});

test('formatUnitPrice toont Nederlandse notatie met eenheid zonder te verzinnen', () => {
  const core = require('./offers-core.js');
  assert.equal(core.formatUnitPrice({ unitPrice: '5', unitPriceValue: 5, unitPriceUnit: 'kg' }), '€ 5,00/kg');
  assert.equal(core.formatUnitPrice({ unitPrice: '0.99', unitPriceUnit: 'L' }), '€ 0,99/L');
  assert.equal(core.formatUnitPrice({ unitPrice: '0.99' }), '');
  assert.equal(core.formatUnitPrice({ unitPriceValue: 33.57, unitPriceUnit: 'g' }), '');
  assert.equal(core.formatUnitPrice({ unitPriceValue: 33.57, unitPriceUnit: 'kg', currency: 'EUR' }), '€ 33,57/kg');
  assert.equal(core.formatUnitPrice({}), '');
});

test('fetchCategories weigert lege of foutieve responses en accepteert geldige', async () => {
  const core = require('./offers-core.js');
  const mk = (ok, body) => async () => ({ ok, status: ok ? 200 : 502, json: async () => body });
  await assert.rejects(core.fetchCategories({ url: 'x', fetchImpl: mk(true, { results: [] }) }));
  await assert.rejects(core.fetchCategories({ url: 'x', fetchImpl: mk(false, { error: 'PrijsProfeet 502' }) }));
  const r = await core.fetchCategories({ url: 'x', fetchImpl: mk(true, { categories: [{ slug: 'zuivel-eieren', name: 'Zuivel & Eieren', count: 3, group: 'vers' }] }) });
  assert.equal(r.categories[0].name, 'Zuivel & Eieren');
  assert.equal(core.applyOfficialCategory({ unifiedCategory: 'snoep-koek-chips' }, []).category, 'Snoep, Koek & Chips');
});

test('only the seven supported retailers and their API identifiers are accepted', () => {
  const retailers = [
    ['lidl', 'Lidl'], ['plus', 'PLUS'], ['jumbo', 'Jumbo'], ['dirk', 'Dirk'], ['aldi', 'Aldi'],
    ['albert_heijn', 'Albert Heijn (AH)'], ['ah', 'Albert Heijn (AH)'], ['spar', 'SPAR']
  ];
  for (const [source, expected] of retailers) assert.equal(core.normalizeStore(source), expected);
  for (const source of ['Hoogvliet', 'hoogvliet', 'ekoplaza', 'albert_heijn_be', 'onbekend']) {
    assert.equal(core.normalizeStore(source), '');
  }
  const filtered = core.filterSupportedOffers([
    ...core.SUPPORTED_STORES.map(store => ({ store, name: store })),
    { store: 'Hoogvliet', name: 'Niet tonen' }
  ]);
  assert.equal(filtered.length, 7);
  assert.deepEqual(filtered.map(offer => offer.store), core.SUPPORTED_STORES);
  assert.equal(core.matchesOfferFilters({ store: 'Hoogvliet' }), false);
  assert.equal(core.matchesOfferFilters({ store: 'Lidl' }, { stores: [] }), false);
});

test('fetchOffers filters unsupported retailers before returning results and maps official category fields', async () => {
  const payload = {
    offers: [
      { name: 'Product A', retailer: 'Jumbo', price: 1, unified_category: 'zuivel-eieren' },
      { name: 'Product B', store: 'Hoogvliet', price: 2, unifiedCategory: 'zuivel-eieren' },
      { name: 'Product C', store: 'albert_heijn', price: 3, unifiedCategory: 'zuivel-eieren' }
    ]
  };
  const result = await core.fetchOffers({
    query: 'melk', url: 'x',
    fetchImpl: async () => ({ ok: true, json: async () => payload })
  });
  assert.deepEqual(result.offers.map(offer => offer.store), ['Jumbo', 'Albert Heijn (AH)']);
  assert.equal(result.offers[0].unifiedCategory, 'zuivel-eieren');
  const categorized = result.offers.map(offer => core.applyOfficialCategory(offer, core.buildCategoryGroups(api)));
  assert.deepEqual(categorized.map(offer => [offer.category, offer.categoryGroup]), [
    ['Zuivel & Eieren', 'vers'], ['Zuivel & Eieren', 'vers']
  ]);
});

test('unknown or missing unified categories remain unknown and never use product names', () => {
  const groups = core.buildCategoryGroups(api);
  assert.equal(core.applyOfficialCategory({ name: 'Snoep melk', unifiedCategory: 'not-official' }, groups).category, 'Onbekend');
  assert.equal(core.applyOfficialCategory({ name: 'Snoep melk' }, groups).category, 'Onbekend');
});

test('discount displays remain consistent with the current and original prices', () => {
  assert.ok(Math.abs(core.offerDiscountPercent({ price: 0.94, originalPrice: 1.89, discountPercent: 50 }) - (1 - 0.94 / 1.89) * 100) < 0.5);
  assert.equal(core.offerDiscountPercent({ price: 1.89, originalPrice: 0.94, discountPercent: 50 }), null);
  assert.ok(Math.abs(core.offerDiscountPercent({ price: 0.94, originalPrice: 1.89 }) - (1 - 0.94 / 1.89) * 100) < 0.000001);
});

test('grocery item preserves official category group and product offer details', () => {
  const groupList = core.buildCategoryGroups(api);
  const item = core.groceryItemFromOffer({
    name: 'Voorbeeld', ean: '1234567890123', store: 'jumbo', price: 0.94, originalPrice: 1.89,
    unifiedCategory: 'zuivel-eieren', category: 'Zuivel & Eieren', currency: 'EUR',
    unitPriceValue: 33.57, unitPriceUnit: 'kg', promotionType: 'multi_buy',
    promotionText: '2 voor €1,50', validFrom: '2026-10-12', validTo: '2026-10-18',
    providerData: { unified_category: 'zuivel-eieren', original_price: 1.89 }
  }, () => 'grocery-id', groupList);
  assert.equal(item.category, 'Zuivel & Eieren');
  assert.equal(item.categorySlug, 'zuivel-eieren');
  assert.equal(item.categoryGroup, 'vers');
  assert.equal(item.store, 'Jumbo');
  assert.equal(item.ean, '1234567890123');
  assert.equal(item.unitPriceUnit, 'kg');
  assert.equal(item.promotionType, 'multi_buy');
  assert.equal(item.validFrom, '2026-10-12');
  assert.equal(item.providerData.unified_category, 'zuivel-eieren');
  assert.match(item.note, /€ 33,57\/kg/);
});

test('search request guard prevents older query results from becoming current', () => {
  const guard = core.createLatestRequestGuard();
  const oldRequest = guard.begin();
  const newestRequest = guard.begin();
  assert.equal(guard.isCurrent(oldRequest), false);
  assert.equal(guard.isCurrent(newestRequest), true);
});

test('offers page has no unsupported-retailer section', () => {
  const app = fs.readFileSync(require.resolve('./app.js'), 'utf8');
  assert.doesNotMatch(app, /Niet-ondersteunde winkels|offer-unknown-stores25|unknownStores/);
});
