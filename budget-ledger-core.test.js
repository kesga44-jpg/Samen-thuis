const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./budget-ledger-core.js');

const pots = [{ id: 'groceries' }, { id: 'buffer' }];

test('money is represented as integer cents and rejects malformed values', () => {
  assert.equal(L.cents('12,34'), 1234);
  assert.equal(L.cents('0.1'), 10);
  assert.throws(() => L.cents('1.234'));
  assert.throws(() => L.cents('-2'));
});

test('income can be allocated once without increasing household cash twice', () => {
  const ledger = L.empty();
  const income = L.addIncome(ledger, {
    id: 'salary', amount: '2000.00', date: '2026-10-01', type: 'salary',
    source: 'Kees', allocations: [{ id: 'a1', potId: 'groceries', amount: '500' }]
  }, pots);
  assert.equal(income.allocations[0].amountCents, 50000);
  assert.equal(L.availableCashCents(ledger), 200000);
  assert.equal(L.allPotBalances(ledger, pots).groceries, 50000);
  assert.throws(() => L.addIncome(ledger, {
    amount: '1950', date: '2026-10-28', type: 'salary', source: 'kees'
  }, pots), /al geregistreerd/);
  assert.throws(() => L.allocateIncome(ledger, {
    incomeId: 'salary', potId: 'buffer', amount: '1500.01'
  }, pots), /nog niet verdeelde/);
});

test('expenses reduce household cash and the selected pot, and transfers preserve total cash', () => {
  const ledger = L.empty();
  L.addIncome(ledger, {
    id: 'salary', amount: '1000', date: '2026-10-01', type: 'salary', source: 'Daphne',
    allocations: [{ potId: 'groceries', amount: '300' }, { potId: 'buffer', amount: '200' }]
  }, pots);
  L.addExpense(ledger, {
    id: 'expense', amount: '50.25', date: '2026-10-05', category: 'Boodschappen',
    potId: 'groceries', description: 'Weekboodschappen'
  }, pots);
  assert.equal(L.availableCashCents(ledger), 94975);
  assert.equal(L.allPotBalances(ledger, pots).groceries, 24975);
  assert.throws(() => L.addExpense(ledger, {
    amount: '300', date: '2026-10-05', category: 'Boodschappen',
    potId: 'groceries', description: 'Te hoge uitgave'
  }, pots), error => error.code === 'INSUFFICIENT_FUNDS');
  const before = L.availableCashCents(ledger);
  L.addTransfer(ledger, {
    amount: '100', date: '2026-10-06', fromPotId: 'buffer', toPotId: 'groceries'
  }, pots);
  assert.equal(L.availableCashCents(ledger), before);
  assert.equal(L.allPotBalances(ledger, pots).buffer, 10000);
  assert.equal(L.allPotBalances(ledger, pots).groceries, 34975);
});

test('archived pot balances remain transferable without changing household cash', () => {
  const ledger = L.empty();
  ledger.potSnapshots['goal:removed'] = { label: 'Oud spaardoel', kind: 'goal', plannedCents: 2500, active: false };
  ledger.openingBalances['goal:removed'] = 25000;
  ledger.openingBalances.groceries = 0;
  const historicalPots = [
    { id: 'goal:removed', label: 'Oud spaardoel' },
    { id: 'groceries', label: 'Boodschappen' }
  ];
  const before = L.availableCashCents(ledger);
  L.addTransfer(ledger, {
    amount: '125', date: '2026-10-10', fromPotId: 'goal:removed', toPotId: 'groceries'
  }, historicalPots);
  const balances = L.allPotBalances(ledger, historicalPots);
  assert.equal(L.availableCashCents(ledger), before);
  assert.equal(balances['goal:removed'], 12500);
  assert.equal(balances.groceries, 12500);
  assert.deepEqual(L.normalize(ledger).potSnapshots['goal:removed'], {
    label: 'Oud spaardoel', kind: 'goal', plannedCents: 2500, active: false
  });
});

test('month summaries stay scoped to the recorded month and edits/removals recalculate', () => {
  const ledger = L.empty();
  ledger.openingBalances.groceries = 10000;
  L.addIncome(ledger, { id: 'income', amount: '800', date: '2026-09-30', month: '2026-10', type: 'other', source: 'Toeslag' }, pots);
  L.addIncome(ledger, { id: 'second', amount: '100', date: '2026-10-01', type: 'other', source: 'Overig' }, pots);
  L.addExpense(ledger, { id: 'expense', amount: '20', date: '2026-10-02', category: 'Overig', potId: 'groceries', description: 'Test' }, pots);
  assert.equal(L.monthSummary(ledger, '2026-10', pots).incomeCents, 90000);
  assert.equal(L.monthSummary(ledger, '2026-10', pots).expenseCents, 2000);
  L.updateEntry(ledger, 'expenses', 'expense', { amount: '35', date: '2026-10-03' }, pots);
  assert.equal(L.monthSummary(ledger, '2026-10', pots).expenseCents, 3500);
  L.removeEntry(ledger, 'incomes', 'second');
  assert.equal(L.monthSummary(ledger, '2026-10', pots).incomeCents, 80000);
  assert.equal(L.monthSummary(ledger, '2026-09', pots).incomeCents, 0);
});

test('invalid dates, months, pot references and transfers are rejected', () => {
  const ledger = L.empty();
  assert.throws(() => L.addIncome(ledger, {
    amount: '1', date: '2026-02-30', type: 'other', source: 'X'
  }, pots), /geldige datum/);
  assert.throws(() => L.addIncome(ledger, {
    amount: '1', date: '2026-10-01', month: '2026-13', type: 'other', source: 'X'
  }, pots), /geldige maand/);
  assert.throws(() => L.addTransfer(ledger, {
    amount: '1', date: '2026-10-01', fromPotId: 'groceries', toPotId: 'missing'
  }, pots), /bestaand potje/);
});
