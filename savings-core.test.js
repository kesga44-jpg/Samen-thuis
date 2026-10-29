const test = require('node:test'), assert = require('node:assert');
const S = require('./savings-core.js'), O = require('./offers-core.js');

test('balance combines opening balance and deposits', () => {
  assert.equal(S.balance({ current: 100, deposits: [{ amount: 50 }, { amount: -20 }] }), 130);
  assert.equal(S.balance({ current: 100 }), 100);
});
test('required periodic deposit = remaining / moments', () => {
  const s = S.status({ target: 1200, current: 0, deadline: '2027-01-15', frequency: 'monthly', monthly: 100 }, '2026-01-15');
  assert.equal(s.moments, 12); assert.equal(s.required, 100); assert.ok(s.feasible);
});
test('weekly and month-end clamping', () => {
  assert.equal(S.remainingMoments('2026-01-01', '2026-01-29', 'weekly'), 4);
  assert.equal(S.addPeriod(new Date('2026-01-31T12:00:00'), 'monthly').getDate(), 28);
});
test('invalid deadline / past deadline / reached / paused', () => {
  assert.equal(S.status({ target: 100, deadline: 'nope' }, '2026-01-01').required, null);
  assert.equal(S.status({ target: 100, current: 0, deadline: '2025-01-01' }, '2026-01-01').state, 'expired');
  assert.equal(S.status({ target: 100, current: 100 }, '2026-01-01').state, 'reached');
  assert.equal(S.status({ target: 100, paused: true }, '2026-01-01').state, 'paused');
  assert.equal(S.status({ target: 100, current: 0, deadline: '2026-01-01' }, '2026-01-01').moments, 0);
});
test('arrears: 300 planned vs 220 registered = 80', () => {
  const s = S.status({ target: 600, current: 220, startDate: '2026-01-01', startAmount: 0, deadline: '2026-01-01'.replace('01-01', '12-31'), frequency: 'monthly', monthly: 50 }, '2026-07-02');
  assert.ok(s.behind > 0); assert.equal(s.state, 'behind');
  const g = { target: 600, current: 220, startDate: '2026-01-01', deadline: '2027-01-01', frequency: 'monthly', monthly: 50 };
  const exp = S.status(g, '2026-07-02').expected; assert.equal(S.status(g, '2026-07-02').behind, Math.round((exp - 220) * 100) / 100);
});
test('deposits are deduplicated and validated', () => {
  const g = { current: 0 };
  assert.ok(S.addDeposit(g, { amount: 50, date: '2026-02-01', externalId: 'tx1' }).added);
  assert.ok(!S.addDeposit(g, { amount: 50, date: '2026-02-01', externalId: 'tx1' }).added);
  assert.ok(!S.addDeposit(g, { amount: 50, date: '2026-02-01', note: 'a' }).added === false);
  assert.ok(!S.addDeposit(g, { amount: 50, date: '2026-02-01', note: 'a' }).added);
  assert.throws(() => S.addDeposit(g, { amount: 0, date: '2026-02-01' }));
  assert.throws(() => S.addDeposit(g, { amount: 5, date: 'x' }));
});
test('actual in period is separate from planned', () => {
  const g = { frequency: 'monthly', deposits: [{ date: '2026-02-03', amount: 40 }, { date: '2026-01-30', amount: 99 }] };
  assert.equal(S.actualInPeriod(g, '2026-02-20'), 40);
});
test('proposal respects priority and flags shortfall', () => {
  const goals = [
    { id: 'a', title: 'A', target: 1200, current: 0, deadline: '2027-01-15', priority: 2, monthly: 100 },
    { id: 'b', title: 'B', target: 1200, current: 0, deadline: '2027-01-15', priority: 1, monthly: 100 }];
  const p = S.propose(goals, 150, '2026-01-15');
  assert.equal(p.totalNeed, 200); assert.equal(p.shortfall, 50);
  assert.equal(p.rows.find(r => r.id === 'b').proposed, 100); assert.equal(p.rows.find(r => r.id === 'a').proposed, 50);
  assert.equal(S.propose(goals, 500, '2026-01-15').leftover, 300);
});
test('offers expire at end of validTo day in Amsterdam', () => {
  const o = { validTo: '2026-10-12' };
  assert.ok(O.isActive(o, new Date('2026-10-12T21:30:00Z'))); // 23:30 Amsterdam (CEST)
  assert.ok(!O.isActive(o, new Date('2026-10-12T22:00:00Z'))); // 00:00 next day
  const winterOffer = { validTo: '2026-11-30' };
  assert.ok(O.isActive(winterOffer, new Date('2026-11-30T22:59:59Z'))); // 23:59:59 Amsterdam (CET)
  assert.ok(!O.isActive(winterOffer, new Date('2026-11-30T23:00:00Z'))); // 00:00 next day
  assert.ok(O.isActive({ name: 'x' }, new Date()));
  assert.ok(!O.isActive({ validFrom: '2099-01-01' }, new Date()));
  assert.equal(O.partition([o, { validTo: '2099-01-01' }], new Date('2026-11-01T00:00:00Z')).archive.length, 1);
});
test('future offers remain scheduled rather than being archived', () => {
  const upcoming = { name: 'Koffie', validFrom: '2026-10-20', validTo: '2026-10-31' };
  const result = O.partition([upcoming], new Date('2026-10-12T12:00:00Z'));
  assert.equal(result.active.length, 0);
  assert.equal(result.archive.length, 0);
  assert.deepEqual(result.upcoming, [upcoming]);
});
test('offers dedupe across sources', () => {
  const a = { ean: '1', store: 'AH', price: 1.5, validTo: '2026-10-20', verified: false, checkedAt: '1' };
  const b = { ...a, verified: true, checkedAt: '0' };
  const r = O.dedupe([a, b, { ...a, store: 'Jumbo' }]);
  assert.equal(r.length, 2); assert.ok(r.find(x => x.store === 'AH').verified);
});
test('offers reject missing query or source configuration', async () => {
  await assert.rejects(O.fetchOffers({ query: '', url: '/offers', fetchImpl: async () => ({}) }), /productnaam/);
  await assert.rejects(O.fetchOffers({ query: 'koffie', fetchImpl: async () => ({}) }), /niet geconfigureerd/);
});
test('offers fetch maps live results, drops invalid rows, and reports provider errors', async () => {
  const result = await O.fetchOffers({
    query: ' koffie ',
    url: 'https://example.invalid/offers',
    fetchImpl: async (_url, options) => {
      assert.equal(JSON.parse(options.body).search, 'koffie');
      return { ok: true, json: async () => ({
        source: 'PrijsProfeet', checkedAt: '2026-10-12T12:00:00Z',
        offers: [
          { name: 'Koffie', store: 'AH', price: '4.5', validFrom: '2026-10-10', validTo: '2026-10-20' },
          { name: 'Ongeldig', price: null },
          { name: 'Koffie', store: 'AH', price: 4.5, validFrom: '2026-10-10', validTo: '2026-10-20' }
        ]
      }) };
    }
  });
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].price, 4.5);
  assert.equal(result.offers[0].source, 'PrijsProfeet');
  assert.equal(result.offers[0].discountPercent, null);
  await assert.rejects(O.fetchOffers({
    query: 'koffie', url: '/offers',
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: 'source unavailable' }) })
  }), /source unavailable/);
});
test('offers normalize timestamp validity dates and reject impossible dates', async () => {
  const result = await O.fetchOffers({
    query: 'thee', url: '/offers',
    fetchImpl: async () => ({ ok: true, json: async () => ({
      offers: [
        { name: 'Thee', store: 'Jumbo', price: 2, validFrom: '2026-10-12T00:00:00Z', validTo: '2026-10-31' },
        { name: 'Kapot', store: 'Jumbo', price: 1, validFrom: '2026-02-31', validTo: '2026-99-99' }
      ]
    }) })
  });
  assert.equal(result.offers[0].validFrom, '2026-10-12');
  assert.equal(result.offers[0].validTo, '2026-10-31');
  assert.equal(result.offers[1].validFrom, '');
  assert.equal(result.offers[1].validTo, '');
});
test('supported supermarket names and aliases normalize without partial-name matches', () => {
  const aliases = new Map([
    ['Lidl', ['Lidl', 'Lidl Nederland']], ['PLUS', ['PLUS', 'PLUS Supermarkt']],
    ['Jumbo', ['Jumbo']], ['Dirk', ['Dirk', 'Dirk van den Broek']],
    ['Aldi', ['Aldi']], ['Albert Heijn (AH)', ['AH', 'Albert Heijn', 'AH to go']],
    ['SPAR', ['SPAR', 'SPAR City', 'SPAR Express']]
  ]);
  assert.deepEqual(O.SUPPORTED_STORES, [...aliases.keys()]);
  for (const [store, names] of aliases) {
    for (const name of names) assert.equal(O.normalizeStore(name), store);
  }
  assert.equal(O.normalizeStore('Lidlard'), '');
  assert.equal(O.normalizeStore('Jumbo Supermarkt in Rotterdam'), '');
});
test('offers can be filtered by every supported store and combined with existing categories', () => {
  const offers = O.SUPPORTED_STORES.map((store, index) => ({
    name: `Product ${index}`, store, category: index % 2 ? 'Groente' : 'Voorraadkast'
  }));
  for (const store of O.SUPPORTED_STORES) {
    assert.equal(offers.filter(item => O.matchesOfferFilters(item, { stores: [store] })).length, 1);
  }
  const combined = offers.filter(item => O.matchesOfferFilters(item, {
    stores: ['Lidl', 'PLUS'], category: 'Voorraadkast',
    categories: ['Groente', 'Fruit', 'Brood & wraps', 'Zuivel & vega', 'Vlees & vis', 'Diepvries', 'Voorraadkast', 'Kruiden & sauzen', 'Drinken', 'Schoonmaak', 'Overig']
  }));
  assert.deepEqual(combined.map(item => item.store), ['Lidl']);
  assert.equal(O.matchesOfferFilters({ name: 'Onbekend', store: 'Onbekende winkel', category: 'Groente' }), false);
});
test('category counts use selected supported-store offers before category filtering', () => {
  const offers = [
    { ean: '1', name: 'Melk', store: 'AH', category: 'Vers' },
    { ean: '1', name: 'Melk', store: 'Jumbo', category: 'Vers' },
    { ean: '2', name: 'Koekjes', store: 'PLUS', category: 'Houdbaar' },
    { ean: '3', name: 'Onbekend', store: 'Onbekende winkel', category: 'Vers' }
  ];
  assert.deepEqual(O.offerCategoryCounts(offers, {
    stores: ['Albert Heijn (AH)', 'PLUS'],
    categories: ['Vers', 'Houdbaar']
  }), { Vers: 1, Houdbaar: 1 });
  assert.deepEqual(O.offerCategoryCounts(offers, {
    stores: O.SUPPORTED_STORES,
    category: 'Houdbaar',
    categories: ['Vers', 'Houdbaar']
  }), { Vers: 2, Houdbaar: 1 });
});
test('Knorr example derives about 50 percent discount and retains offer details', async () => {
  const result = await O.fetchOffers({
    query: 'Knorr Groente bouillonblokjes voordeelpak',
    url: '/offers',
    fetchImpl: async () => ({ ok: true, json: async () => ({
      source: 'PrijsProfeet',
      offers: [{
        name: 'Knorr Groente bouillonblokjes voordeelpak',
        brand: 'Knorr',
        size: '15 × 10 g',
        contents: '150 g',
        store: 'Albert Heijn',
        price: '0.90',
        originalPrice: '1.79',
        discountPercent: null,
        unitPrice: '€ 6,00/kg',
        promotionText: '1 + 1 gratis',
        promotionType: '1 + 1 gratis',
        validFrom: '2026-10-12',
        validTo: '2026-10-18',
        category: 'Houdbaar',
        sourceUrl: 'https://example.test/knorr'
      }]
    }) })
  });
  const [offer] = result.offers;
  assert.equal(offer.price, 0.9);
  assert.equal(offer.originalPrice, 1.79);
  assert.ok(Math.abs(offer.discountPercent - 49.72067039106145) < 0.0001);
  assert.equal(offer.brand, 'Knorr');
  assert.equal(offer.size, '15 × 10 g');
  assert.equal(offer.contents, '150 g');
  assert.equal(offer.unitPrice, '€ 6,00/kg');
  assert.equal(offer.promotionText, '1 + 1 gratis');
  assert.equal(offer.validFrom, '2026-10-12');
  assert.equal(offer.validTo, '2026-10-18');
  assert.equal(offer.category, 'Houdbaar');
});
test('invalid or missing source prices never produce a fabricated zero discount', async () => {
  const result = await O.fetchOffers({
    query: 'invalid',
    url: '/offers',
    fetchImpl: async () => ({ ok: true, json: async () => ({ offers: [
      { name: 'No original', store: 'Lidl', price: 1.2 },
      { name: 'Zero original', store: 'Lidl', price: 1, originalPrice: 0 },
      { name: 'Invalid price', price: 'not-a-price' },
      { name: 'Negative price', price: -2 }
    ] }) })
  });
  assert.equal(result.offers.length, 2);
  assert.equal(result.offers[0].discountPercent, null);
  assert.equal(result.offers[1].discountPercent, null);
  assert.ok(Math.abs(O.offerDiscountPercent({ price: 0.9, originalPrice: 1.79 }) - 49.72067039106145) < 0.0001);
  assert.equal(O.offerDiscountPercent({ price: 1, originalPrice: 0 }), null);
});
test('offer categories retain source classes and missing categories are explicit', () => {
  const categories = ['Groente', 'Fruit', 'Brood & wraps', 'Zuivel & vega', 'Vlees & vis', 'Diepvries', 'Voorraadkast', 'Kruiden & sauzen', 'Drinken', 'Schoonmaak', 'Overig'];
  assert.equal(O.normalizeOfferCategory('Groente', categories, 'Onbekend'), 'Groente');
  assert.equal(O.normalizeOfferCategory('Vers', categories, 'Onbekend'), 'Vers');
  assert.equal(O.normalizeOfferCategory('Houdbaar', categories, 'Onbekend'), 'Houdbaar');
  assert.equal(O.normalizeOfferCategory('', categories, 'Onbekend'), 'Onbekend');
  assert.equal(O.normalizeOfferCategory('Onbekend uit de API', categories, 'Overig'), 'Onbekend uit de API');
});
test('an offer becomes a compatible unchecked grocery item that survives save and reload', () => {
  const offer = {
    ean: '8710001', name: 'Koffie', brand: 'Merk', store: 'AH', size: '500 g', packaging: '1 pak', contents: '500 g',
    price: 4.5, originalPrice: 6, promotionText: '2e halve prijs', promotionType: 'Bonus',
    unitPrice: '€ 9,00/kg', unitPriceValue: 9, unitPriceUnit: 'kg', currency: 'EUR',
    category: 'Koffie & Thee', unifiedCategory: 'koffie-thee', validFrom: '2026-10-10',
    validTo: '2026-10-20', sourceUrl: 'https://example.test/offer', providerData: { category: 'Koffie & Thee', unified_category: 'koffie-thee' }
  };
  const item = O.groceryItemFromOffer(offer, () => 'grocery-unique', ['Groente', 'Voorraadkast', 'Overig']);
  assert.deepEqual({
    id: item.id, title: item.title, category: item.category, amount: item.amount,
    unit: item.unit, store: item.store, done: item.done, source: item.source,
    brand: item.brand, price: item.price, originalPrice: item.originalPrice,
    discountPercent: item.discountPercent, unitPrice: item.unitPrice,
    promotionText: item.promotionText, validFrom: item.validFrom, validTo: item.validTo
  }, {
    id: 'grocery-unique', title: 'Koffie', category: 'Koffie & Thee', amount: 1,
    unit: '500 g', store: 'Albert Heijn (AH)', done: false, source: 'offer',
    brand: 'Merk', price: 4.5, originalPrice: 6, discountPercent: 25,
    unitPrice: '€ 9,00/kg', promotionText: '2e halve prijs',
    validFrom: '2026-10-10', validTo: '2026-10-20'
  });
  assert.match(item.note, /4,50/);
  assert.match(item.note, /25% korting/);
  assert.match(item.note, /€ 9,00\/kg/);
  const restored = JSON.parse(JSON.stringify({ groceries: [item] }));
  assert.equal(restored.groceries[0].title, 'Koffie');
  assert.equal(restored.groceries[0].offerKey, O.key(offer));
  assert.equal(restored.groceries[0].providerData.category, 'Koffie & Thee');
  const unknownCategory = O.groceryItemFromOffer({ ...offer, category: 'Niet ingedeeld' }, () => 'grocery-other', ['Groente', 'Voorraadkast', 'Overig']);
  assert.equal(unknownCategory.category, 'Koffie & Thee');
});
test('offer duplicate detection ignores matching product names from different offers', () => {
  const first = { ean: '111', name: 'Melk', store: 'Lidl', price: 1, validTo: '2026-10-20' };
  const sameOffer = { ...first };
  const differentProduct = { ...first, ean: '222' };
  const item = O.groceryItemFromOffer(first, () => 'g1', ['Overig']);
  assert.equal(O.offerAlreadyInGroceries([item], sameOffer), true);
  assert.equal(O.offerAlreadyInGroceries([item], differentProduct), false);
});
test('latest search request guard prevents an older slow response from replacing newer results', async () => {
  const guard = O.createLatestRequestGuard();
  let releaseOld;
  const result = [];
  const oldToken = guard.begin();
  const oldResponse = new Promise(resolve => { releaseOld = resolve; }).then(value => {
    if (guard.isCurrent(oldToken)) result.push(value);
  });
  const newToken = guard.begin();
  if (guard.isCurrent(newToken)) result.push('new search');
  releaseOld('old search');
  await oldResponse;
  assert.deepEqual(result, ['new search']);
});
