(function (root, factory) {
  const ledger = typeof require === 'function' ? require('./budget-ledger-core.js') : root.SamenThuisBudgetLedger;
  const core = factory(ledger);
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisFinance = core;
})(globalThis, function (ledgerCore) {
  // Alle bedragen zijn gehele centen. Dit bestand bevat de centrale, pure berekeningen van het
  // huishoudelijke financiële systeem (afdracht, potjes, reserveringen, status). Geen DOM, geen netwerk.
  const KINDS = ['fixed', 'saving', 'investment', 'remainder'];
  const REMAINDER_ID = 'leuke-dingen';
  const REMAINDER_NAME = 'Leuke dingen';
  const clean = (value, limit = 100) => String(value || '').trim().slice(0, limit);
  const int = value => Math.round(Number(value) || 0);
  const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''));
  const eur = cents => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  const monthOfDate = date => String(date || '').slice(0, 7);

  function shareBp(percent) {
    const value = Number(String(percent ?? '').replace(',', '.'));
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Het afdraagpercentage moet tussen 0% en 100% liggen.');
    return Math.round(value * 100);
  }
  const contributionCents = (netCents, bp) => Math.round(Math.max(0, int(netCents)) * Number(bp) / 10000);

  // ---- Potjes -------------------------------------------------------------------------------
  function normalizePot(input) {
    const kind = KINDS.includes(input?.kind) ? input.kind : 'fixed';
    const scope = input?.scope === 'personal' && kind !== 'remainder' ? 'personal' : 'joint';
    return {
      id: clean(input?.id, 80), name: clean(input?.name, 80), kind, scope,
      monthlyCents: kind === 'remainder' ? 0 : Math.max(0, int(input?.monthlyCents)),
      active: input?.active !== false,
      startDate: clean(input?.startDate, 10), endDate: clean(input?.endDate, 10)
    };
  }

  function validatePots(pots) {
    const list = (Array.isArray(pots) ? pots : []).map(normalizePot);
    const errors = [];
    const ids = new Set();
    list.forEach(pot => {
      if (!pot.id) errors.push('Elk potje heeft een id nodig.');
      if (ids.has(pot.id)) errors.push(`Potje-id ${pot.id} komt dubbel voor.`);
      ids.add(pot.id);
      if (!pot.name) errors.push('Elk potje heeft een naam nodig.');
      if (pot.startDate && !ledgerCore.validDate(pot.startDate)) errors.push(`Ongeldige startdatum bij ${pot.name}.`);
      if (pot.endDate && !ledgerCore.validDate(pot.endDate)) errors.push(`Ongeldige einddatum bij ${pot.name}.`);
      if (pot.startDate && pot.endDate && pot.endDate < pot.startDate) errors.push(`De einddatum van ${pot.name} ligt voor de startdatum.`);
    });
    if (list.filter(pot => pot.kind === 'remainder').length > 1) errors.push('Er mag maximaal één restbedrag-potje bestaan.');
    return { ok: !errors.length, errors, pots: list };
  }

  function ensureRemainderPot(pots) {
    const list = Array.isArray(pots) ? pots : [];
    if (list.some(pot => pot.kind === 'remainder')) return list;
    return [...list, normalizePot({ id: REMAINDER_ID, name: REMAINDER_NAME, kind: 'remainder', scope: 'joint' })];
  }

  const monthStart = month => `${month}-01`;
  const monthEnd = month => `${month}-31`;
  function activeInMonth(item, month) {
    if (!item || item.active === false) return false;
    if (item.startDate && item.startDate > monthEnd(month)) return false;
    if (item.endDate && item.endDate < monthStart(month)) return false;
    return true;
  }

  // ---- Terugkerende uitgaven en reserveringen ----------------------------------------------------
  const PER_YEAR = { weekly: 52, monthly: 12, quarterly: 4, semiannual: 2, yearly: 1 };
  function perYear(bill) {
    if (bill.frequency === 'custom') return 12 / Math.max(1, Number(bill.intervalMonths) || 12);
    return PER_YEAR[bill.frequency] || 0;
  }
  const addMonthKey = (month, amount) => {
    const [year, number] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, number - 1 + amount, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  // Te reserveren bedrag voor één maand, afhankelijk van de gekozen reserveringsmethode.
  function reservationForMonth(bill, month) {
    if (!bill || bill.active === false || !validMonth(month)) return 0;
    const start = bill.startDate || bill.expectedDate || '';
    const startMonth = monthOfDate(start);
    if (startMonth && month < startMonth) return 0;
    if (bill.endDate && month > monthOfDate(bill.endDate)) return 0;
    const amount = int(bill.amountCents);
    const method = bill.reserveMethod || 'monthly';
    if (method === 'full') return amount * ledgerCore.billOccurrences({ ...bill, active: true }, month).length;
    if (method === 'schedule') {
      const schedule = bill.reserveSchedule;
      if (!schedule || !validMonth(schedule.startMonth)) return 0;
      return month >= schedule.startMonth && month < addMonthKey(schedule.startMonth, Number(schedule.months)) ? int(schedule.amountCents) : 0;
    }
    return Math.round(amount * perYear(bill) / 12);
  }

  function reservedToDate(bill, month) {
    const start = monthOfDate(bill.startDate || bill.expectedDate || '');
    if (!start || month < start) return 0;
    let total = 0, cursor = start, guard = 0;
    while (cursor <= month && guard++ < 600) {
      total += reservationForMonth(bill, cursor);
      cursor = addMonthKey(cursor, 1);
    }
    return total;
  }

  // Onderscheid tussen reserveren en uitgeven: een betaling (expense met fixedBillId) verbruikt de reservering
  // en telt als werkelijke uitgave; de reservering zelf is nooit een uitgave.
  function reservationOverview(ledger, bills, month, today = '') {
    const list = (Array.isArray(bills) ? bills : []).filter(bill => bill.active !== false);
    const expenses = Array.isArray(ledger?.expenses) ? ledger.expenses : [];
    const items = list.map(bill => {
      const payments = expenses.filter(expense => expense.fixedBillId === bill.id);
      const paidToDate = payments.filter(item => (item.month || monthOfDate(item.date)) <= month).reduce((sum, item) => sum + int(item.amountCents), 0);
      const spentCents = payments.filter(item => (item.month || monthOfDate(item.date)) === month).reduce((sum, item) => sum + int(item.amountCents), 0);
      const reserved = reservedToDate(bill, month);
      const consumed = Math.min(paidToDate, reserved);
      return {
        billId: bill.id, name: bill.name, potId: bill.potId, scope: bill.scope === 'personal' ? 'personal' : 'joint',
        reservedCents: reservationForMonth(bill, month), reservedToDateCents: reserved,
        consumedCents: consumed, reservedBalanceCents: reserved - consumed,
        spentCents, paidToDateCents: paidToDate,
        due: ledgerCore.billOccurrences(bill, month).map(date => {
          const paid = payments.some(item => item.billOccurrenceDate === date);
          return { date, paid, status: paid ? 'betaald' : (today && date < today ? 'achterstallig' : 'gepland') };
        })
      };
    });
    const joint = items.filter(item => item.scope === 'joint');
    return {
      items,
      reservedCents: joint.reduce((sum, item) => sum + item.reservedCents, 0),
      reservedBalanceCents: joint.reduce((sum, item) => sum + item.reservedBalanceCents, 0),
      spentCents: joint.reduce((sum, item) => sum + item.spentCents, 0)
    };
  }

  // ---- Allocatieregels ----------------------------------------------------------------------------
  const monthlyFixedCents = item => {
    const divisor = item.period === 'jaar' || item.period === 'yearly' ? 12 : item.period === 'kwartaal' || item.period === 'quarterly' ? 3 : 1;
    return Math.round((Number(item.amount) || 0) / divisor * 100);
  };

  // Eén lijst met vaste gezamenlijke allocaties, afgeleid van de bestaande budgetgegevens (vaste lasten, huisbudget,
  // spaardoelen, beleggen) plus de nieuwe potjes en terugkerende uitgaven. Niets wordt dubbel opgeslagen of dubbel geteld.
  function allocationLines(budget, month, ledgerState) {
    const lines = [];
    const b = budget || {};
    const bills = (ledgerState?.recurringBills || []).filter(bill => bill.scope !== 'personal' && bill.active !== false);
    const replaced = new Set(bills.map(bill => bill.replacesFixedId).filter(Boolean));
    (Array.isArray(b.finPots) ? b.finPots : []).map(normalizePot).forEach(pot => {
      if (pot.scope !== 'joint' || pot.kind === 'remainder' || !activeInMonth(pot, month) || !pot.monthlyCents) return;
      lines.push({ id: `pot:${pot.id}`, name: pot.name, kind: pot.kind, source: 'pot', potId: `pot:${pot.id}`, cents: pot.monthlyCents });
    });
    (Array.isArray(b.fixed) ? b.fixed : []).forEach((item, index) => {
      const key = String(item.id || index);
      const cents = monthlyFixedCents(item);
      if (replaced.has(String(item.id)) || !cents) return;
      lines.push({ id: `fixed:${key}`, name: item.title || 'Vaste last', kind: 'fixed', source: 'fixed', potId: `fixed:${item.id || String(item.title || `last-${index}`).toLocaleLowerCase('nl-NL')}`, cents });
    });
    const house = Math.round((Number(b.houseBudget) || 0) * 100);
    if (house > 0) lines.push({ id: 'house', name: 'Huisbudget', kind: 'fixed', source: 'house', potId: 'pot:house-budget', cents: house });
    (Array.isArray(b.goals) ? b.goals : []).forEach((goal, index) => {
      const cents = Math.round((Number(goal.monthly) || 0) * 100);
      if (goal.scope === 'personal' || cents <= 0) return;
      lines.push({ id: `goal:${goal.id || index}`, name: goal.title || 'Spaardoel', kind: 'saving', source: 'goal', potId: `goal:${goal.id || String(goal.title || `doel-${index}`).toLocaleLowerCase('nl-NL')}`, cents });
    });
    const investing = Math.round((Number(b.investing) || 0) * 100);
    if (investing > 0) lines.push({ id: 'investing', name: 'Beleggen', kind: 'investment', source: 'investing', potId: 'pot:investing', cents: investing });
    bills.forEach(bill => {
      const cents = reservationForMonth(bill, month);
      if (cents > 0) lines.push({ id: `bill:${bill.id}`, name: `${bill.name} (reservering)`, kind: 'reservation', source: 'recurring', potId: bill.potId, cents });
    });
    return lines;
  }

  // ---- Vingerafdruk van de invoer (om gewijzigde invoer na bevestiging te herkennen) ----------------
  function fingerprint(value) {
    const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]`
      : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
        : JSON.stringify(v ?? null);
    const text = stable(value);
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < text.length; i++) {
      h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619);
      h2 = Math.imul(h2 + text.charCodeAt(i), 2246822519) ^ (h2 >>> 13);
    }
    return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}:${text.length}`;
  }

  // ---- Centrale maandberekening en status ----------------------------------------------------------
  // people: [{ key, label, netCents, entered, confirmed }] — precies twee personen.
  // distribution: laatste definitieve (bevestigde) verdeling voor deze maand of null.
  function evaluateMonth({ month, shareBp: bp, people, lines, remainderName = REMAINDER_NAME, distribution = null, processed = false }) {
    if (!validMonth(month)) throw new Error('Kies een geldige maand.');
    const rate = Math.trunc(Number(bp));
    if (!Number.isInteger(rate) || rate < 0 || rate > 10000) throw new Error('Ongeldig afdraagpercentage.');
    const persons = (Array.isArray(people) ? people : []).map(person => {
      const netCents = Math.max(0, int(person.netCents));
      const contribution = contributionCents(netCents, rate);
      return {
        key: person.key, label: person.label || person.key, netCents,
        entered: Boolean(person.entered), confirmed: Boolean(person.entered && person.confirmed),
        contributionCents: contribution, personalCents: netCents - contribution
      };
    });
    const allLines = (Array.isArray(lines) ? lines : []).filter(line => int(line.cents) > 0);
    const totalContributionCents = persons.reduce((sum, person) => sum + person.contributionCents, 0);
    const fixedTotalCents = allLines.reduce((sum, line) => sum + int(line.cents), 0);
    const rawRemainder = totalContributionCents - fixedTotalCents;
    const shortfallCents = Math.max(0, -rawRemainder);
    let left = totalContributionCents;
    const shortfallItems = [];
    const covered = allLines.map(line => {
      const coveredCents = Math.max(0, Math.min(left, line.cents));
      left -= coveredCents;
      if (coveredCents < line.cents) shortfallItems.push({ id: line.id, name: line.name, cents: line.cents, coveredCents, uncoveredCents: line.cents - coveredCents });
      return { ...line, coveredCents };
    });
    const everyoneEntered = persons.length === 2 && persons.every(person => person.entered);
    const everyoneConfirmed = persons.length === 2 && persons.every(person => person.confirmed);
    const inputHash = fingerprint({
      month, bp: rate,
      nets: persons.map(person => [person.key, person.netCents]),
      lines: allLines.map(line => [line.id, line.potId, line.cents])
    });
    const distributionState = !distribution ? 'none' : distribution.inputHash === inputHash ? 'confirmed' : 'stale';
    const remainderCents = Math.max(0, rawRemainder);
    const reasons = [];
    // Financiële status: alleen de sluitendheid van de berekening, los van bevestigingen.
    let status;
    if (!everyoneEntered) status = 'orange';
    else status = shortfallCents > 0 ? 'red' : 'green';
    if (persons.length !== 2) reasons.push('Er zijn twee personen nodig voor de verdeling.');
    persons.forEach(person => {
      if (!person.entered) reasons.push(`${person.label} heeft nog geen netto-inkomen ingevoerd.`);
      else if (!person.confirmed) reasons.push(`${person.label} moet het inkomen nog bevestigen.`);
    });
    if (everyoneEntered && shortfallCents > 0) reasons.unshift(`Tekort van ${eur(shortfallCents)}: de gezamenlijke bijdrage dekt niet alle vaste allocaties.`);
    if (everyoneConfirmed && distributionState === 'stale') reasons.push('Er is iets gewijzigd: de verdeling moet opnieuw worden bevestigd.');
    if (everyoneConfirmed && distributionState === 'none') reasons.push('De verdeling is nog niet definitief bevestigd.');
    // Verwerkingsstatus: voortgang van bevestiging en verwerking, los van de financiële status.
    let processing;
    if (distributionState === 'confirmed') processing = processed ? 'processed' : 'confirmed';
    else if (!everyoneConfirmed) processing = 'waiting';
    else processing = shortfallCents === 0 ? 'ready' : 'incomes_confirmed';
    const calculationOk = everyoneConfirmed && shortfallCents === 0
      && covered.reduce((sum, line) => sum + line.coveredCents, 0) + remainderCents === totalContributionCents;
    return {
      month, shareBp: rate, persons, lines: covered, remainderName, remainderCents,
      totalContributionCents, fixedTotalCents, shortfallCents, shortfallItems,
      allConfirmed: everyoneConfirmed, calculationOk, status, processing, reasons, inputHash,
      distributionState, distributionRevision: distribution ? distribution.revision : 0,
      // Een tekort blokkeert de definitieve verdeling; er wordt nooit automatisch gekort of een buffer aangesproken.
      canConfirm: calculationOk && distributionState !== 'confirmed'
    };
  }

  const STATUS_TEXT = { green: 'Groen · berekening sluitend, alle vaste allocaties gedekt', orange: 'Oranje · berekening nog niet vast te stellen', red: 'Rood · tekort' };
  const PROCESSING_TEXT = { waiting: 'Wachten op inkomensbevestigingen', incomes_confirmed: 'Beide inkomens bevestigd', ready: 'Klaar om gezamenlijk te bevestigen', confirmed: 'Definitief bevestigd', processed: 'Verwerkt' };
  const STATUS_ICON = { green: '✔', orange: '!', red: '✖' };

  // Wat de database bewaart bij definitieve bevestiging; de RPC controleert dit opnieuw.
  function distributionSnapshot(evaluation) {
    const lines = evaluation.lines.map(line => ({ id: line.id, name: line.name, kind: line.kind, potId: line.potId, cents: line.cents }));
    return {
      remainder: { id: REMAINDER_ID, name: evaluation.remainderName, potId: `pot:${REMAINDER_ID}`, cents: evaluation.remainderCents },
      lines, totalContributionCents: evaluation.totalContributionCents,
      contributions: Object.fromEntries(evaluation.persons.map(person => [person.key, person.contributionCents])),
      personal: Object.fromEntries(evaluation.persons.map(person => [person.key, person.personalCents]))
    };
  }

  const snapshotLines = snapshot => [...(snapshot.lines || []), snapshot.remainder].filter(line => line && int(line.cents) > 0);

  // Verwerkt een definitieve verdeling precies één keer in het bestaande grootboek. Idempotent op basis van vaste id's:
  // herladen, synchroniseren of dubbelklikken levert nooit een tweede boeking. Revisies worden als correctie (delta) geboekt.
  function applyDistribution(ledger, row, pots, previousRow = null) {
    const month = row.month, revision = Number(row.revision);
    const date = String(row.confirmed_at || row.confirmedAt || '').slice(0, 10);
    const known = new Set((pots || []).map(pot => pot.id));
    const lines = snapshotLines(row.snapshot);
    const missing = lines.filter(line => !known.has(line.potId)).map(line => line.name);
    if (missing.length) return { applied: false, problems: [`Onbekend potje: ${missing.join(', ')}`] };
    const target = ledgerCore.normalize(ledger);
    if (revision === 1 || !previousRow) {
      const incomeId = `dist:${month}:r${revision}`;
      if (target.incomes.some(item => item.id === incomeId)) return { applied: false, duplicate: true, problems: [] };
      ledgerCore.addIncome(ledger, {
        id: incomeId, externalId: incomeId, month, date, type: 'contribution', source: 'Gezamenlijke bijdrage',
        description: `Maandverdeling ${month}`, amount: row.snapshot.totalContributionCents / 100,
        allocations: lines.map(line => ({ id: `${incomeId}:${line.id}`, potId: line.potId, amount: line.cents / 100 }))
      }, pots);
      return { applied: true, problems: [] };
    }
    const before = Object.fromEntries(snapshotLines(previousRow.snapshot).map(line => [line.potId, int(line.cents)]));
    const after = Object.fromEntries(lines.map(line => [line.potId, int(line.cents)]));
    let changed = false;
    for (const potId of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const delta = (after[potId] || 0) - (before[potId] || 0);
      const adjustmentId = `dist:${month}:r${revision}:${potId}`;
      if (!delta || target.adjustments.some(item => item.id === adjustmentId)) continue;
      ledgerCore.addAdjustment(ledger, {
        id: adjustmentId, potId, amount: `${delta < 0 ? '-' : ''}${(Math.abs(delta) / 100).toFixed(2)}`, date,
        reason: row.reason || 'Correctie maandverdeling', distributionId: `dist:${month}:r${revision}`
      }, pots);
      changed = true;
    }
    return { applied: changed, duplicate: !changed, problems: [] };
  }

  // ---- Inkomensbevestiging (spiegel van de databaseregels, voor UI en tests) ----------------------------
  // Eén persoon kan alleen het eigen inkomen invoeren en bevestigen; een wijziging laat de bevestiging vervallen.
  function incomeAction(rows, actorKey, action, month, netCents, now = new Date().toISOString()) {
    const next = { ...(rows || {}) };
    const own = next[actorKey] ? { ...next[actorKey] } : { netCents: 0, entered: false };
    if (action === 'set') {
      const value = Math.trunc(Number(netCents));
      if (!Number.isInteger(value) || value < 0) throw new Error('Vul een geldig netto-inkomen in.');
      next[actorKey] = { netCents: value, entered: true, enteredBy: actorKey, enteredAt: now, confirmed: false, confirmedBy: '', confirmedAt: '' };
    } else if (action === 'confirm') {
      if (!own.entered) throw new Error('Voer eerst het eigen netto-inkomen in.');
      if (Number.isInteger(netCents) && netCents !== own.netCents) throw new Error('Het bedrag is gewijzigd; controleer het opnieuw.');
      next[actorKey] = { ...own, confirmed: true, confirmedBy: actorKey, confirmedAt: now };
    } else throw new Error('Onbekende actie.');
    return next;
  }

  // ---- Persoonlijk overzicht, transacties en privacy -----------------------------------------------------
  // Alleen eigen persoonlijke transacties; die van de ander zijn nooit onderdeel van gedeelde of getoonde data.
  function visibleExpenses(expenses, viewerKey) {
    return (Array.isArray(expenses) ? expenses : []).filter(item =>
      item.scope !== 'personal' || (item.person && item.person === viewerKey));
  }

  function sharedExpenses(expenses) {
    return (Array.isArray(expenses) ? expenses : []).filter(item => item.scope !== 'personal');
  }

  // Sparen en beleggen blijven gescheiden; gepland ≠ gereserveerd ≠ daadwerkelijk ingelegd.
  function investmentOverview(ledger, pots, plannedCents, investedExpenses) {
    const balances = ledgerCore.allPotBalances(ledger, pots);
    const planned = int(plannedCents);
    const invested = (investedExpenses || []).reduce((sum, item) => sum + int(item.amountCents), 0);
    return {
      plannedCents: planned,
      reservedCents: Math.max(0, int(balances['pot:investing'])),
      investedCents: invested,
      confirmedDeposits: investedExpenses || []
    };
  }

  return {
    KINDS, REMAINDER_ID, REMAINDER_NAME, STATUS_TEXT, STATUS_ICON, PROCESSING_TEXT,
    shareBp, contributionCents, normalizePot, validatePots, ensureRemainderPot, activeInMonth,
    reservationForMonth, reservedToDate, reservationOverview, allocationLines, fingerprint,
    evaluateMonth, distributionSnapshot, applyDistribution, incomeAction, visibleExpenses, sharedExpenses,
    investmentOverview, monthlyFixedCents
  };
});
