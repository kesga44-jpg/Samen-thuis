const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rewards-core.js');

const initial = (balance = 0) => R.normalize({ balance, challenges: [], rewards: [], ledger: [] }, () => []);

test('legacy balance is migrated once to an auditable ledger entry', () => {
  const state = initial(75);
  assert.equal(R.balance(state), 75);
  assert.equal(state.ledger[0].points, 75);
  assert.equal(R.balance(R.normalize(state, () => [])), 75);
});

test('challenge proposals require participant approval and check-ins pay once after confirmation', () => {
  const state = initial();
  const challenge = R.addChallenge(state, {
    title: 'Keuken netjes houden', creator: 'Kees', participants: ['Kees', 'Daphne'],
    kind: 'competition', target: 1, points: 10
  }, 'c1');
  assert.equal(R.addCheckin(state, 'c1', 'Kees', '2026-10-13'), false);
  assert.equal(R.respondChallenge(state, 'c1', 'Daphne', true), true);
  assert.equal(challenge.status, 'active');
  assert.equal(R.addCheckin(state, 'c1', 'Kees', '2026-10-13'), true);
  const checkin = challenge.checkins[0];
  assert.equal(R.confirmCheckin(state, 'c1', checkin.id, 'Kees', true), false);
  assert.equal(R.confirmCheckin(state, 'c1', checkin.id, 'Daphne', true), true);
  assert.equal(R.confirmCheckin(state, 'c1', checkin.id, 'Daphne', true), false);
  assert.equal(R.balance(state), 10);
});

test('collaborative activity only earns its shared reward after every participant confirms', () => {
  const state = initial();
  const activity = R.addActivity(state, {
    title: 'Filmavond', creator: 'Kees', participants: ['Kees', 'Daphne'], points: 20
  }, 'a1');
  assert.equal(R.respondActivity(state, 'a1', 'Daphne', true), true);
  assert.equal(R.confirmActivity(state, 'a1', 'Kees'), true);
  assert.equal(R.balance(state), 0);
  assert.equal(R.confirmActivity(state, 'a1', 'Daphne'), true);
  assert.equal(R.confirmActivity(state, 'a1', 'Daphne'), false);
  assert.equal(R.balance(state), 20);
});

test('redemptions validate balance, are idempotent, and refund a rejected request once', () => {
  const state = initial(40);
  const reward = R.addReward(state, { title: 'Film kiezen', cost: 25 }, 'r1');
  const redeemed = R.redeem(state, reward.id, 'Kees', 'x1');
  assert.equal(R.balance(state), 15);
  assert.equal(R.redeem(state, reward.id, 'Kees', 'x1').id, 'x1');
  assert.equal(R.respondRedemption(state, 'x1', false), true);
  assert.equal(R.respondRedemption(state, 'x1', false), false);
  assert.equal(R.balance(state), 40);
  reward.cost = 45;
  assert.throws(() => R.redeem(state, reward.id, 'Kees', 'x2'), /onvoldoende/);
});

test('joint rewards charge each confirmed contribution once and complete after scheduling', () => {
  const state = initial(50);
  const reward = R.addReward(state, { title: 'Samen uit eten', cost: 30, joint: true }, 'joint');
  const redemption = R.redeem(state, reward.id, 'Kees', 'joint-request');
  assert.equal(state.balance, 50);
  assert.equal(R.contribute(state, redemption.id, 'Kees', 15), true);
  assert.equal(R.contribute(state, redemption.id, 'Kees', 15), false);
  assert.equal(R.contribute(state, redemption.id, 'Daphne', 15), true);
  assert.equal(redemption.status, 'paid');
  assert.equal(state.balance, 20);
  assert.equal(R.scheduleJointRedemption(state, redemption.id, '2026-10-20'), true);
  assert.equal(R.completeJointRedemption(state, redemption.id, 'Kees'), true);
  assert.equal(redemption.status, 'scheduled');
  assert.equal(R.completeJointRedemption(state, redemption.id, 'Daphne'), true);
  assert.equal(redemption.status, 'completed');
  assert.equal(state.balance, 20);
});

test('declining a joint reward refunds only confirmed contributions once', () => {
  const state = initial(25);
  const reward = R.addReward(state, { title: 'Weekendje weg', cost: 20, joint: true }, 'joint2');
  const redemption = R.redeem(state, reward.id, 'Kees', 'joint-request2');
  R.contribute(state, redemption.id, 'Kees', 10);
  assert.equal(R.rejectJointRedemption(state, redemption.id, 'Daphne'), true);
  assert.equal(R.rejectJointRedemption(state, redemption.id, 'Daphne'), false);
  assert.equal(R.balance(state), 25);
});

test('ledger rejects duplicate operations and never allows negative balances', () => {
  const state = initial(5);
  assert.throws(() => R.post(state, { id: 'spend', kind: 'spent', title: 'x', points: -6 }), /onvoldoende/);
  R.post(state, { id: 'earn', kind: 'earned', title: 'x', points: 2 });
  assert.equal(R.post(state, { id: 'earn', kind: 'earned', title: 'x', points: 2 }), false);
  assert.equal(R.balance(state), 7);
});
