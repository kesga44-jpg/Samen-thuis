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

test('income distribution previews first, respects priority and applies only once', () => {
  const ledger = L.empty();
  L.addIncome(ledger, {
    id: 'salary', amount: '1000', date: '2026-10-25', type: 'salary', source: 'Kees'
  }, pots);
  L.addAllocationRule(ledger, { potId: 'groceries', kind: 'fixed', amount: '300', priority: 1 }, pots, 'fixed-rule');
  L.addAllocationRule(ledger, { potId: 'buffer', kind: 'percent', basisPoints: 5000, priority: 2 }, pots, 'percent-rule');
  const proposal = L.proposeIncomeDistribution(ledger, 'salary', pots);
  assert.equal(proposal.status, 'proposed');
  assert.deepEqual(proposal.allocations.map(item => item.amountCents), [30000, 50000]);
  assert.equal(proposal.unallocatedCents, 20000);
  assert.equal(L.allPotBalances(ledger, pots).groceries, 0);
  assert.equal(L.proposeIncomeDistribution(ledger, 'salary', pots).id, proposal.id);
  assert.equal(L.approveIncomeDistribution(ledger, proposal.id, pots), true);
  assert.equal(L.approveIncomeDistribution(ledger, proposal.id, pots), false);
  assert.equal(ledger.pendingDistributions[0].status, 'approved');
  assert.equal(L.allPotBalances(ledger, pots).groceries, 30000);
  assert.equal(L.allPotBalances(ledger, pots).buffer, 50000);
  assert.equal(L.availableCashCents(ledger), 100000);
});

test('automatic distribution caps to received income and keeps deterministic allocation ids', () => {
  const ledger = L.empty();
  L.addIncome(ledger, {
    id: 'bonus', amount: '50', date: '2026-10-26', type: 'other', source: 'Bonus'
  }, pots);
  L.addAllocationRule(ledger, { potId: 'groceries', kind: 'fixed', amount: '100', priority: 0 }, pots, 'rule');
  L.setDistributionMode(ledger, 'automatic');
  const proposal = L.proposeIncomeDistribution(ledger, 'bonus', pots, { automatic: true });
  assert.equal(proposal.status, 'approved');
  assert.equal(proposal.allocations[0].amountCents, 5000);
  assert.equal(proposal.unallocatedCents, 0);
  assert.equal(L.proposeIncomeDistribution(ledger, 'bonus', pots, { automatic: true }).id, proposal.id);
  assert.equal(ledger.incomes[0].allocations.length, 1);
});

test('monthly plan shows different income dates, reserves upcoming bills and updates after payment', () => {
  const ledger = L.empty();
  ledger.openingBalances.groceries = 100000;
  L.addIncomeSource(ledger, {
    name: 'Salaris Kees', receiver: 'Kees', amount: '3000', frequency: 'monthly',
    expectedDate: '2026-10-25'
  }, pots, 'kees');
  L.addIncomeSource(ledger, {
    name: 'Salaris Daphne', receiver: 'Daphne', amount: '2500', frequency: 'monthly',
    expectedDate: '2026-10-28'
  }, pots, 'daphne');
  L.addRecurringBill(ledger, {
    name: 'Huur', amount: '700', potId: 'groceries', frequency: 'monthly',
    startDate: '2026-10-01', expectedDate: '2026-10-01'
  }, pots, 'rent');
  L.addRecurringBill(ledger, {
    name: 'Internet', amount: '50', potId: 'groceries', frequency: 'monthly',
    startDate: '2026-10-12', expectedDate: '2026-10-12'
  }, pots, 'internet');
  let plan = L.monthPlan(ledger, '2026-10', pots);
  assert.deepEqual(plan.expectedIncome.map(item => item.date), ['2026-10-25', '2026-10-28']);
  assert.equal(plan.totalBillsCents, 75000);
  assert.equal(plan.byPot.groceries.reservedCents, 75000);
  assert.equal(plan.byPot.groceries.availableCents, 25000);
  assert.equal(plan.byPot.groceries.stillNeededCents, 0);

  L.recordBillPayment(ledger, { billId: 'rent', occurrenceDate: '2026-10-01' }, pots);
  plan = L.monthPlan(ledger, '2026-10', pots);
  assert.equal(plan.byPot.groceries.paidCents, 70000);
  assert.equal(plan.byPot.groceries.dueCents, 5000);
  assert.equal(plan.byPot.groceries.balanceCents, 30000);
  assert.equal(plan.byPot.groceries.reservedCents, 5000);
  assert.equal(plan.byPot.groceries.availableCents, 25000);
  assert.throws(() => L.recordBillPayment(ledger, {
    billId: 'rent', occurrenceDate: '2026-10-01'
  }, pots), /al als betaald/);
});

test('recurring bills respect frequency, start/end dates, variable payments and insufficient pot balances', () => {
  const ledger = L.empty();
  ledger.openingBalances.groceries = 2500;
  L.addRecurringBill(ledger, {
    name: 'Verzekering', amount: '40', potId: 'groceries', frequency: 'quarterly',
    startDate: '2026-01-05', expectedDate: '2026-01-05', endDate: '2026-10-05', variable: true
  }, pots, 'insurance');
  const plan = L.monthPlan(ledger, '2026-10', pots);
  assert.deepEqual(plan.bills.map(item => item.date), ['2026-10-05']);
  assert.equal(plan.byPot.groceries.stillNeededCents, 1500);
  assert.throws(() => L.recordBillPayment(ledger, {
    billId: 'insurance', occurrenceDate: '2026-10-05', amount: '30'
  }, pots), error => error.code === 'INSUFFICIENT_FUNDS');
  L.recordBillPayment(ledger, {
    billId: 'insurance', occurrenceDate: '2026-10-05', amount: '20'
  }, pots, { allowOverdraw: true });
  assert.equal(L.monthPlan(ledger, '2026-10', pots).byPot.groceries.balanceCents, 500);
});

test('recurrences keep their original month-end date and configuration edits retain identity', () => {
  const ledger = L.empty();
  L.addIncomeSource(ledger, {
    name: 'Salaris', receiver: 'Kees', amount: '3000', frequency: 'monthly', expectedDate: '2026-01-31'
  }, pots, 'monthly-salary');
  L.addRecurringBill(ledger, {
    name: 'Hypotheek', amount: '1200', potId: 'buffer', frequency: 'monthly',
    expectedDate: '2026-01-31', startDate: '2026-01-31'
  }, pots, 'mortgage');
  assert.equal(L.monthPlan(ledger, '2026-02', pots).expectedIncome[0].date, '2026-02-28');
  assert.equal(L.monthPlan(ledger, '2026-03', pots).expectedIncome[0].date, '2026-03-31');
  assert.equal(L.monthPlan(ledger, '2026-02', pots).bills[0].date, '2026-02-28');
  L.updateRecurringBill(ledger, 'mortgage', {
    name: 'Hypotheek', amount: '1250', potId: 'buffer', frequency: 'monthly',
    expectedDate: '2026-01-31', startDate: '2026-01-31'
  }, pots);
  assert.equal(ledger.recurringBills[0].id, 'mortgage');
  assert.equal(ledger.recurringBills[0].amountCents, 125000);
});

test('normalization preserves old ledger records and initializes planner settings safely', () => {
  const legacy = { incomes: [{ id: 'legacy' }], expenses: [], transfers: [], openingBalances: {} };
  const normalized = L.normalize(legacy);
  assert.equal(normalized.incomes[0].id, 'legacy');
  assert.deepEqual(normalized.incomeSources, []);
  assert.deepEqual(normalized.recurringBills, []);
  assert.equal(normalized.distributionMode, 'approval');
  assert.deepEqual(legacy.incomes, normalized.incomes);
});
