const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./quotes-core.js');

test('quote feed refreshes on first load and no more than daily afterward', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  assert.equal(Q.shouldRefresh('', now), true);
  assert.equal(Q.shouldRefresh('not-a-date', now), true);
  assert.equal(Q.shouldRefresh('2026-10-11T11:59:59Z', now), true);
  assert.equal(Q.shouldRefresh('2026-10-11T12:00:01Z', now), false);
  assert.equal(Q.shouldRefresh('2026-10-13T12:00:00Z', now), true);
});
