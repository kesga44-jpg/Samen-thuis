const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./budget-ledger-core.js');
const F = require('./finance-plan-core.js');
const Sync = require('./household-sync-core.js');

const MONTH = '2026-11';
const people = (a = 300000, b = 200000, ac = true, bc = true) => [
  { key: 'A', label: 'Kees', netCents: a, entered: true, confirmed: ac },
  { key: 'B', label: 'Daphne', netCents: b, entered: true, confirmed: bc }
];
const budget = (extra = {}) => ({ contributionPct: 75, houseBudget: 0, investing: 0, fixed: [], goals: [], finPots: [], ...extra });
const pot = (id, monthly, extra = {}) => ({ id, name: id, kind: 'fixed', scope: 'joint', monthlyCents: monthly, ...extra });
const evaluate = (b, p = people(), distribution = null, bp = F.shareBp(b.contributionPct)) =>
  F.evaluateMonth({ month: MONTH, shareBp: bp, people: p, lines: F.allocationLines(b, MONTH, null), distribution });

test('1/3 één percentage voor beiden, verschillende inkomens, herberekening na wijziging', () => {
  const b = budget({ finPots: [pot('boodschappen', 50000)] });
  const first = evaluate(b);
  assert.deepEqual(first.persons.map(x => x.contributionCents), [225000, 150000]);
  assert.deepEqual(first.persons.map(x => x.personalCents), [75000, 50000]);
  assert.equal(first.totalContributionCents, 375000);
  b.contributionPct = 60; // het percentage wordt één keer aangepast
  const second = evaluate(b);
  assert.deepEqual(second.persons.map(x => x.contributionCents), [180000, 120000]);
  assert.deepEqual(second.persons.map(x => x.personalCents), [120000, 80000]);
  assert.equal(second.totalContributionCents, 300000);
  assert.throws(() => F.shareBp(101));
});

test('2 percentage-wijziging voert nooit automatisch een verdeling uit en maakt bevestigde verdeling ongeldig', () => {
  const b = budget({ finPots: [pot('a', 10000)] });
  const e1 = evaluate(b);
  const confirmed = { revision: 1, inputHash: e1.inputHash };
  assert.equal(evaluate(b, people(), confirmed).status, 'green');
  b.contributionPct = 80;
  const e2 = evaluate(b, people(), confirmed);
  assert.equal(e2.distributionState, 'stale');
  assert.equal(e2.status, 'orange');
  assert.equal(e2.canConfirm, true); // pas na expliciete bevestiging, evaluate boekt niets
});

test('5 ontbrekende inkomensbevestiging geeft oranje en blokkeert bevestigen', () => {
  const e = evaluate(budget({ finPots: [pot('a', 1000)] }), people(300000, 200000, true, false));
  assert.equal(e.status, 'orange');
  assert.equal(e.canConfirm, false);
  assert.match(e.reasons.join(' '), /Daphne moet het inkomen nog bevestigen/);
});

test('6 wijziging na bevestiging laat bevestiging vervallen en wijst andere persoon niet toe', () => {
  let rows = F.incomeAction({}, 'A', 'set', MONTH, 300000);
  rows = F.incomeAction(rows, 'A', 'confirm', MONTH, 300000);
  assert.equal(rows.A.confirmed, true);
  assert.equal(rows.A.confirmedBy, 'A');
  rows = F.incomeAction(rows, 'A', 'set', MONTH, 310000);
  assert.equal(rows.A.confirmed, false);
  assert.equal(rows.A.confirmedAt, '');
  assert.ok(rows.A.enteredAt);
  assert.throws(() => F.incomeAction(rows, 'A', 'confirm', MONTH, 300000), /gewijzigd/);
  // B kan nooit de rij van A bevestigen: de actor bepaalt de rij
  const afterB = F.incomeAction(rows, 'B', 'set', MONTH, 100000);
  assert.equal(afterB.A.confirmed, false);
  assert.throws(() => F.incomeAction(afterB, 'B', 'confirm', MONTH, 5), /gewijzigd/);
});

test('7 beide bevestigd en sluitend: bevestigbaar, na bevestiging groen', () => {
  const b = budget({ finPots: [pot('a', 100000)] });
  const e = evaluate(b);
  assert.equal(e.calculationOk, true);
  assert.equal(e.canConfirm, true);
  assert.equal(e.status, 'orange'); // nog niet definitief bevestigd
  assert.equal(evaluate(b, people(), { revision: 1, inputHash: e.inputHash }).status, 'green');
});

test('8 onvoldoende budget: rood, exact tekort, oorzakelijke potjes, bevestigen geblokkeerd, niets automatisch gekort', () => {
  const b = budget({ finPots: [pot('huur', 300000), pot('auto', 100000), pot('sport', 20000)] });
  const e = evaluate(b); // totaal 375.000 beschikbaar, 420.000 nodig
  assert.equal(e.status, 'red');
  assert.equal(e.shortfallCents, 45000);
  assert.equal(e.canConfirm, false);
  assert.equal(e.remainderCents, 0);
  assert.deepEqual(e.shortfallItems.map(x => [x.id, x.uncoveredCents]), [['pot:auto', 25000], ['pot:sport', 20000]]);
  assert.deepEqual(e.lines.map(x => x.cents), [300000, 100000, 20000]); // bedragen onaangetast
  // alleen het percentage verhogen maakt het niet groen zolang de berekening niet klopt
  b.contributionPct = 80;
  assert.equal(evaluate(b).status, 'red');
  b.contributionPct = 100;
  assert.notEqual(evaluate(b).status, 'red');
});

test('9/10 aanpassing van een vast potje en restbedrag naar Leuke dingen', () => {
  const b = budget({ houseBudget: 500, investing: 400, goals: [{ id: 'g1', title: 'Vakantie', monthly: 300 }], finPots: [pot('boodschappen', 60000)] });
  let e = evaluate(b);
  assert.equal(e.fixedTotalCents, 60000 + 50000 + 40000 + 30000);
  assert.equal(e.remainderCents, 375000 - 180000);
  assert.equal(e.remainderName, 'Leuke dingen');
  b.finPots[0].monthlyCents = 70000;
  e = evaluate(b);
  assert.equal(e.remainderCents, 375000 - 190000);
  const total = e.lines.reduce((s, l) => s + l.cents, 0) + e.remainderCents;
  assert.equal(total, e.totalContributionCents); // restbedrag verdwijnt nergens en wordt niet verdeeld
});

test('potjes: één restbedrag-potje, start/einddatum en gepauzeerd', () => {
  assert.equal(F.validatePots([{ id: 'a', name: 'A', kind: 'remainder' }, { id: 'b', name: 'B', kind: 'remainder' }]).ok, false);
  assert.equal(F.ensureRemainderPot([]).filter(p => p.kind === 'remainder').length, 1);
  assert.equal(F.ensureRemainderPot(F.ensureRemainderPot([])).length, 1);
  const b = budget({ finPots: [pot('p', 1000, { startDate: '2026-12-01' }), pot('q', 2000, { endDate: '2026-10-31' }), pot('r', 3000, { active: false }), pot('s', 4000)] });
  assert.deepEqual(F.allocationLines(b, MONTH, null).map(l => l.id), ['pot:s']);
  assert.equal(F.allocationLines(b, '2026-12', null).length, 2);
});

function processed() {
  const ledger = L.empty();
  const pots = [{ id: 'pot:a' }, { id: 'pot:leuke-dingen' }];
  const b = budget({ finPots: [pot('a', 100000)] });
  const e = evaluate(b);
  const row = { month: MONTH, revision: 1, confirmed_at: '2026-11-26T10:00:00Z', snapshot: F.distributionSnapshot(e) };
  return { ledger, pots, row, e };
}

test('11 maandverdeling kan niet dubbel worden verwerkt (herladen, sync, dubbelklik)', () => {
  const { ledger, pots, row } = processed();
  assert.equal(F.applyDistribution(ledger, row, pots).applied, true);
  assert.equal(F.applyDistribution(ledger, row, pots).duplicate, true);
  assert.equal(F.applyDistribution(ledger, row, pots).duplicate, true);
  assert.equal(ledger.incomes.length, 1);
  const balances = L.allPotBalances(ledger, pots);
  assert.equal(balances['pot:a'], 100000);
  assert.equal(balances['pot:leuke-dingen'], 275000);
  assert.equal(L.availableCashCents(ledger), 375000);
});

test('correcties worden afzonderlijk geboekt; de oorspronkelijke verdeling blijft intact', () => {
  const { ledger, pots, row } = processed();
  F.applyDistribution(ledger, row, pots);
  const original = JSON.stringify(ledger.incomes);
  const e2 = evaluate(budget({ finPots: [pot('a', 150000)] }));
  const row2 = { month: MONTH, revision: 2, confirmed_at: '2026-11-27T10:00:00Z', reason: 'Potje verhoogd', snapshot: F.distributionSnapshot(e2) };
  assert.equal(F.applyDistribution(ledger, row2, pots, row).applied, true);
  assert.equal(F.applyDistribution(ledger, row2, pots, row).duplicate, true);
  assert.equal(JSON.stringify(ledger.incomes), original);
  assert.equal(ledger.adjustments.length, 2);
  const balances = L.allPotBalances(ledger, pots);
  assert.equal(balances['pot:a'], 150000);
  assert.equal(balances['pot:leuke-dingen'], 225000);
  assert.equal(L.availableCashCents(ledger), 375000);
});

test('verdeling wordt alles-of-niets verwerkt wanneer een potje ontbreekt', () => {
  const { ledger, row } = processed();
  const result = F.applyDistribution(ledger, row, [{ id: 'pot:a' }]);
  assert.equal(result.applied, false);
  assert.equal(ledger.incomes.length, 0);
});

const bill = (extra = {}) => ({
  id: 'ins', name: 'Verzekering', amountCents: 60000, potId: 'pot:a', frequency: 'yearly', expectedDate: '2027-03-15',
  startDate: '2026-11-01', endDate: '', active: true, scope: 'joint', reserveMethod: 'monthly', ...extra
});

test('12 reservering: maandelijks, volledig in betaalmaand en eigen schema', () => {
  assert.equal(F.reservationForMonth(bill(), MONTH), 5000);
  assert.equal(F.reservationForMonth(bill({ reserveMethod: 'full' }), MONTH), 0);
  assert.equal(F.reservationForMonth(bill({ reserveMethod: 'full' }), '2027-03'), 60000);
  const schedule = bill({ reserveMethod: 'schedule', reserveSchedule: { startMonth: '2026-11', months: 6, amountCents: 10000 } });
  assert.equal(F.reservationForMonth(schedule, '2027-04'), 10000);
  assert.equal(F.reservationForMonth(schedule, '2027-05'), 0);
  assert.equal(F.reservationForMonth(bill({ frequency: 'custom', intervalMonths: 2, amountCents: 1000 }), MONTH), 500);
  assert.equal(F.reservationForMonth(bill({ active: false }), MONTH), 0);
  const lines = F.allocationLines(budget(), MONTH, { recurringBills: [bill(), bill({ id: 'p', scope: 'personal' })] });
  assert.deepEqual(lines.map(l => [l.id, l.cents]), [['bill:ins', 5000]]);
});

test('vervangt een bestaande vaste last zonder dubbele telling', () => {
  const b = budget({ fixed: [{ id: 'f1', title: 'Verzekering', amount: 600, period: 'jaar' }] });
  assert.equal(F.allocationLines(b, MONTH, null)[0].cents, 5000);
  const lines = F.allocationLines(b, MONTH, { recurringBills: [bill({ replacesFixedId: 'f1' })] });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].id, 'bill:ins');
});

test('13 betaling verbruikt reservering en telt één keer als uitgave; geen automatische incasso', () => {
  const ledger = L.empty();
  const pots = [{ id: 'pot:a' }];
  const b = bill({ reserveMethod: 'monthly', frequency: 'monthly', amountCents: 5000, expectedDate: '2026-11-15' });
  L.addAdjustment(ledger, { id: 'x', potId: 'pot:a', amount: '500', date: '2026-11-01' }, pots);
  ledger.recurringBills = [b];
  let overview = F.reservationOverview(ledger, [b], MONTH, '2026-11-20');
  assert.equal(overview.items[0].due[0].status, 'achterstallig'); // niet gedaan alsof betaald
  assert.equal(overview.spentCents, 0);
  assert.equal(overview.items[0].reservedBalanceCents, 5000);
  L.recordBillPayment(ledger, { billId: 'ins', occurrenceDate: '2026-11-15' }, pots);
  assert.throws(() => L.recordBillPayment(ledger, { billId: 'ins', occurrenceDate: '2026-11-15' }, pots), /al als betaald/);
  overview = F.reservationOverview(ledger, [b], MONTH, '2026-11-20');
  assert.equal(overview.spentCents, 5000);
  assert.equal(overview.items[0].consumedCents, 5000);
  assert.equal(overview.items[0].reservedBalanceCents, 0);
  assert.equal(overview.items[0].due[0].status, 'betaald');
  assert.equal(ledger.expenses.length, 1);
  assert.equal(L.allPotBalances(ledger, pots)['pot:a'], 45000);
});

test('transactie is één keer geregistreerd en zichtbaar vanuit andere modules', () => {
  const ledger = L.empty();
  const pots = [{ id: 'pot:a' }];
  L.addAdjustment(ledger, { potId: 'pot:a', amount: '500', date: '2026-11-01' }, pots);
  const expense = L.addExpense(ledger, { amount: '120', date: '2026-11-05', category: 'Reizen', potId: 'pot:a', description: 'Hotel', link: { module: 'trip', id: 'trip-vietnam' } }, pots);
  L.linkExpense(ledger, expense.id, { module: 'trip', id: 'trip-vietnam' });
  L.linkExpense(ledger, expense.id, { module: 'auto', id: 'c1' });
  assert.equal(ledger.expenses.length, 1);
  assert.deepEqual(L.expensesForLink(ledger, 'trip', 'trip-vietnam').map(e => e.id), [expense.id]);
  assert.equal(L.expensesForLink(ledger, 'trip', 'trip-vietnam')[0].links.length, 2);
});

test('14 persoonlijke transacties zijn niet zichtbaar voor de andere persoon', () => {
  const expenses = [
    { id: '1', scope: 'joint', person: 'Kees' },
    { id: '2', scope: 'personal', person: 'Kees' },
    { id: '3', scope: 'personal', person: 'Daphne' }
  ];
  assert.deepEqual(F.visibleExpenses(expenses, 'Kees').map(x => x.id), ['1', '2']);
  assert.deepEqual(F.visibleExpenses(expenses, 'Daphne').map(x => x.id), ['1', '3']);
  assert.deepEqual(F.sharedExpenses(expenses).map(x => x.id), ['1']);
  assert.deepEqual(F.visibleExpenses(expenses, '').map(x => x.id), ['1']);
});

test('sparen en beleggen gescheiden: gepland, gereserveerd en ingelegd', () => {
  const ledger = L.empty();
  const pots = [{ id: 'pot:investing' }];
  L.addIncome(ledger, { id: 'i', amount: '400', date: '2026-11-26', type: 'contribution', source: 'x', allocations: [{ potId: 'pot:investing', amount: '400' }] }, pots);
  let overview = F.investmentOverview(ledger, pots, 40000, []);
  assert.deepEqual([overview.plannedCents, overview.reservedCents, overview.investedCents], [40000, 40000, 0]);
  const dep = L.addExpense(ledger, { amount: '400', date: '2026-11-27', category: 'Beleggen', potId: 'pot:investing', description: 'Inleg bevestigd' }, pots);
  overview = F.investmentOverview(ledger, pots, 40000, [dep]);
  assert.deepEqual([overview.reservedCents, overview.investedCents], [0, 40000]);
});

test('15 twee apparaten verwerken dezelfde verdeling identiek: sync ziet geen conflict', () => {
  const a = processed(), b = processed();
  F.applyDistribution(a.ledger, a.row, a.pots);
  F.applyDistribution(b.ledger, b.row, b.pots);
  const actions = Sync.planSections({
    local: { budgetV23: { financialLedger: a.ledger } },
    remote: { budgetV23: { version: 3, value: { financialLedger: b.ledger } } }, base: {}
  });
  assert.equal(actions[0].action, 'adopt');
});

test('16 bestaande budgetgegevens blijven ongewijzigd en worden niet gemuteerd', () => {
  const b = budget({ houseBudget: 500, fixed: [{ id: 'f', title: 'Huur', amount: 1000, period: 'maand' }], goals: [{ id: 'g', title: 'Buffer', monthly: 100, deposits: [] }] });
  const before = JSON.stringify(b);
  F.allocationLines(b, MONTH, { recurringBills: [] });
  evaluate(b);
  assert.equal(JSON.stringify(b), before);
  const legacy = L.normalize({ incomes: [{ id: 'old', amountCents: 100 }], expenses: [], transfers: [] });
  assert.equal(legacy.adjustments.length, 0);
  assert.equal(legacy.incomes[0].id, 'old');
});
