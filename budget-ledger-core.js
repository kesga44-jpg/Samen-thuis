(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisBudgetLedger = core;
})(globalThis, function () {
  const round = value => Math.round(Number(value) || 0);
  const cents = value => {
    const text = String(value ?? '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Vul een geldig bedrag in met maximaal twee decimalen.');
    const result = Math.round(Number(text) * 100);
    if (!Number.isSafeInteger(result)) throw new Error('Het bedrag is te groot.');
    return result;
  };
  const validDate = value => {
    const date = String(value || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T12:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  };
  const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''));
  const monthOf = date => String(date || '').slice(0, 7);
  const id = () => globalThis.crypto?.randomUUID?.() || `ledger-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const clone = value => JSON.parse(JSON.stringify(value));
  const empty = () => ({ incomes: [], expenses: [], transfers: [], openingBalances: {}, goalSnapshots: {}, potSnapshots: {} });

  function normalize(value) {
    const ledger = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      ...ledger,
      incomes: Array.isArray(ledger.incomes) ? ledger.incomes.filter(item => item && typeof item === 'object') : [],
      expenses: Array.isArray(ledger.expenses) ? ledger.expenses.filter(item => item && typeof item === 'object') : [],
      transfers: Array.isArray(ledger.transfers) ? ledger.transfers.filter(item => item && typeof item === 'object') : [],
      openingBalances: ledger.openingBalances && typeof ledger.openingBalances === 'object' && !Array.isArray(ledger.openingBalances) ? ledger.openingBalances : {},
      goalSnapshots: ledger.goalSnapshots && typeof ledger.goalSnapshots === 'object' && !Array.isArray(ledger.goalSnapshots) ? ledger.goalSnapshots : {},
      potSnapshots: ledger.potSnapshots && typeof ledger.potSnapshots === 'object' && !Array.isArray(ledger.potSnapshots) ? ledger.potSnapshots : {}
    };
  }

  function potMap(pots) {
    return new Map((Array.isArray(pots) ? pots : []).filter(pot => pot?.id).map(pot => [String(pot.id), pot]));
  }
  function requirePot(pots, potId) {
    if (!potMap(pots).has(String(potId || ''))) throw new Error('Kies een bestaand potje.');
    return String(potId);
  }
  function requireDate(date) {
    if (!validDate(date)) throw new Error('Vul een geldige datum in.');
  }
  function positiveCents(amount) {
    const value = cents(amount);
    if (value <= 0) throw new Error('Het bedrag moet groter zijn dan € 0,00.');
    return value;
  }
  function incomeAllocations(income) {
    return Array.isArray(income?.allocations) ? income.allocations : [];
  }
  function allocatedToIncome(income) {
    return incomeAllocations(income).reduce((sum, allocation) => sum + Math.max(0, round(allocation.amountCents)), 0);
  }

  function addIncome(ledger, input, pots) {
    const target = normalize(ledger);
    const amountCents = positiveCents(input.amount);
    const date = String(input.date || '');
    requireDate(date);
    const type = ['salary', 'benefit', 'other'].includes(input.type) ? input.type : '';
    if (!type) throw new Error('Kies een geldig type inkomsten.');
    const source = String(input.source || '').trim().slice(0, 80);
    const description = String(input.description || '').trim().slice(0, 160);
    if (!source) throw new Error('Vul de persoon of bron van de inkomsten in.');
    const month = String(input.month || monthOf(date));
    if (!validMonth(month)) throw new Error('Kies een geldige maand voor de boeking.');
    const externalId = String(input.externalId || '').trim();
    const sourceKey = source.toLocaleLowerCase('nl-NL');
    const duplicate = target.incomes.some(item =>
      (externalId && item.externalId === externalId)
      || (type === 'salary' && item.type === 'salary' && item.month === month
        && String(item.source || '').trim().toLocaleLowerCase('nl-NL') === sourceKey)
    );
    if (duplicate) throw new Error('Deze inkomstenboeking lijkt al geregistreerd.');
    const allocations = Array.isArray(input.allocations) ? input.allocations : [];
    const prepared = allocations.filter(item => cents(item.amount) > 0).map(item => ({
      id: item.id || id(),
      potId: requirePot(pots, item.potId),
      amountCents: positiveCents(item.amount)
    }));
    if (prepared.reduce((sum, item) => sum + item.amountCents, 0) > amountCents) {
      throw new Error('De verdeling kan niet hoger zijn dan de inkomstenboeking.');
    }
    const entry = {
      id: input.id || id(), amountCents, date, month, type, source, description, externalId,
      allocations: prepared
    };
    target.incomes.unshift(entry);
    Object.assign(ledger, target);
    return entry;
  }

  function allocateIncome(ledger, input, pots) {
    const target = normalize(ledger);
    const income = target.incomes.find(item => item.id === input.incomeId);
    if (!income) throw new Error('Deze inkomstenboeking bestaat niet meer.');
    const potId = requirePot(pots, input.potId);
    const amountCents = positiveCents(input.amount);
    if (allocatedToIncome(income) + amountCents > round(income.amountCents)) {
      throw new Error('De verdeling kan niet hoger zijn dan het nog niet verdeelde bedrag.');
    }
    const allocation = { id: input.id || id(), potId, amountCents };
    income.allocations = [...incomeAllocations(income), allocation];
    Object.assign(ledger, target);
    return allocation;
  }

  function allPotBalances(ledger, pots) {
    const target = normalize(ledger);
    const balances = {};
    const add = (potId, value) => {
      if (!potId) return;
      balances[potId] = (balances[potId] || 0) + round(value);
    };
    Object.entries(target.openingBalances).forEach(([potId, value]) => add(potId, value));
    target.incomes.forEach(income => incomeAllocations(income).forEach(allocation => add(allocation.potId, allocation.amountCents)));
    target.expenses.forEach(expense => add(expense.potId, -round(expense.amountCents)));
    target.transfers.forEach(transfer => {
      add(transfer.fromPotId, -round(transfer.amountCents));
      add(transfer.toPotId, round(transfer.amountCents));
    });
    potMap(pots).forEach((_pot, potId) => { balances[potId] ||= 0; });
    return balances;
  }

  function availableCashCents(ledger) {
    const target = normalize(ledger);
    const opening = Object.values(target.openingBalances).reduce((sum, value) => sum + round(value), 0);
    const income = target.incomes.reduce((sum, item) => sum + round(item.amountCents), 0);
    const expenses = target.expenses.reduce((sum, item) => sum + round(item.amountCents), 0);
    return opening + income - expenses;
  }

  function addExpense(ledger, input, pots, options = {}) {
    const target = normalize(ledger);
    const amountCents = positiveCents(input.amount);
    const date = String(input.date || '');
    requireDate(date);
    const potId = requirePot(pots, input.potId);
    const category = String(input.category || '').trim().slice(0, 80);
    const description = String(input.description || '').trim().slice(0, 160);
    if (!category || !description) throw new Error('Vul een categorie en omschrijving in.');
    const source = String(input.person || '').trim().slice(0, 80);
    const externalId = String(input.externalId || '').trim();
    if (externalId && target.expenses.some(item => item.externalId === externalId)) throw new Error('Deze uitgave lijkt al geregistreerd.');
    const balance = allPotBalances(target, pots)[potId] || 0;
    if (balance < amountCents && !options.allowOverdraw) {
      const error = new Error('Deze uitgave is hoger dan het beschikbare saldo van dit potje.');
      error.code = 'INSUFFICIENT_FUNDS';
      throw error;
    }
    const entry = {
      id: input.id || id(), amountCents, date, month: monthOf(date), category, potId,
      description, person: source, externalId
    };
    target.expenses.unshift(entry);
    Object.assign(ledger, target);
    return entry;
  }

  function addTransfer(ledger, input, pots, options = {}) {
    const target = normalize(ledger);
    const amountCents = positiveCents(input.amount);
    const date = String(input.date || '');
    requireDate(date);
    const fromPotId = requirePot(pots, input.fromPotId);
    const toPotId = requirePot(pots, input.toPotId);
    if (fromPotId === toPotId) throw new Error('Kies twee verschillende potjes.');
    const fromBalance = allPotBalances(target, pots)[fromPotId] || 0;
    if (fromBalance < amountCents && !options.allowOverdraw) {
      const error = new Error('Deze verschuiving is hoger dan het beschikbare saldo van het bronpotje.');
      error.code = 'INSUFFICIENT_FUNDS';
      throw error;
    }
    const entry = {
      id: input.id || id(), amountCents, date, month: monthOf(date), fromPotId, toPotId,
      description: String(input.description || '').trim().slice(0, 160)
    };
    target.transfers.unshift(entry);
    Object.assign(ledger, target);
    return entry;
  }

  function removeAllocation(ledger, incomeId, allocationId) {
    const target = normalize(ledger);
    const income = target.incomes.find(item => item.id === incomeId);
    if (!income) return false;
    const allocations = incomeAllocations(income);
    const next = allocations.filter(item => item.id !== allocationId);
    if (next.length === allocations.length) return false;
    income.allocations = next;
    Object.assign(ledger, target);
    return true;
  }

  function removeEntry(ledger, kind, entryId) {
    const target = normalize(ledger);
    if (!['incomes', 'expenses', 'transfers'].includes(kind)) return false;
    const next = target[kind].filter(item => item.id !== entryId);
    if (next.length === target[kind].length) return false;
    target[kind] = next;
    Object.assign(ledger, target);
    return true;
  }

  function updateEntry(ledger, kind, entryId, changes, pots, options = {}) {
    const target = normalize(ledger);
    if (!['incomes', 'expenses', 'transfers'].includes(kind)) throw new Error('Onbekend type boeking.');
    const index = target[kind].findIndex(item => item.id === entryId);
    if (index < 0) throw new Error('Deze boeking bestaat niet meer.');
    const existing = target[kind][index];
    if (kind === 'incomes') {
      const amountCents = positiveCents(changes.amount);
      const date = String(changes.date || '');
      requireDate(date);
      const month = String(changes.month || monthOf(date));
      if (!validMonth(month)) throw new Error('Kies een geldige maand voor de boeking.');
      const source = String(changes.source || '').trim().slice(0, 80);
      if (!source) throw new Error('Vul de persoon of bron van de inkomsten in.');
      if (allocatedToIncome(existing) > amountCents) throw new Error('Verwijder eerst een deel van de verdeling voordat je het bedrag verlaagt.');
      if (existing.type === 'salary' && target.incomes.some(item => item.id !== entryId && item.type === 'salary'
        && item.month === month && String(item.source || '').trim().toLocaleLowerCase('nl-NL') === source.toLocaleLowerCase('nl-NL'))) {
        throw new Error('Deze inkomstenboeking lijkt al geregistreerd.');
      }
      target.incomes[index] = { ...existing, amountCents, date, month, source, description: String(changes.description || '').trim().slice(0, 160) };
    } else if (kind === 'expenses') {
      target.expenses.splice(index, 1);
      addExpense(target, { ...existing, ...changes, id: entryId }, pots, options);
    } else {
      target.transfers.splice(index, 1);
      addTransfer(target, { ...existing, ...changes, id: entryId }, pots, options);
    }
    Object.assign(ledger, target);
    return target[kind].find(item => item.id === entryId);
  }

  function monthSummary(ledger, month, pots) {
    const target = normalize(ledger);
    if (!validMonth(month)) throw new Error('Kies een geldige maand.');
    const incomes = target.incomes.filter(item => (item.month || monthOf(item.date)) === month);
    const expenses = target.expenses.filter(item => (item.month || monthOf(item.date)) === month);
    const transfers = target.transfers.filter(item => (item.month || monthOf(item.date)) === month);
    return {
      month,
      incomeCents: incomes.reduce((sum, item) => sum + round(item.amountCents), 0),
      allocatedCents: incomes.reduce((sum, item) => sum + allocatedToIncome(item), 0),
      expenseCents: expenses.reduce((sum, item) => sum + round(item.amountCents), 0),
      transferCents: transfers.reduce((sum, item) => sum + round(item.amountCents), 0),
      incomes, expenses, transfers,
      cashBalanceCents: availableCashCents(target),
      potBalances: allPotBalances(target, pots)
    };
  }

  return {
    addExpense, addIncome, addTransfer, allocateIncome, allPotBalances, availableCashCents,
    cents, empty, monthOf, monthSummary, normalize, removeAllocation, removeEntry, round,
    updateEntry, validDate, validMonth
  };
});
