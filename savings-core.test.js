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
        { name: 'Thee', price: 2, validFrom: '2026-10-12T00:00:00Z', validTo: '2026-10-31' },
        { name: 'Kapot', price: 1, validFrom: '2026-02-31', validTo: '2026-99-99' }
      ]
    }) })
  });
  assert.equal(result.offers[0].validFrom, '2026-10-12');
  assert.equal(result.offers[0].validTo, '2026-10-31');
  assert.equal(result.offers[1].validFrom, '');
  assert.equal(result.offers[1].validTo, '');
});
