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
  const empty = () => ({
    incomes: [], expenses: [], transfers: [], openingBalances: {}, goalSnapshots: {}, potSnapshots: {},
    incomeSources: [], allocationRules: [], recurringBills: [], pendingDistributions: [], distributionMode: 'approval'
  });

  function normalize(value) {
    const ledger = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      ...ledger,
      incomes: Array.isArray(ledger.incomes) ? ledger.incomes.filter(item => item && typeof item === 'object') : [],
      expenses: Array.isArray(ledger.expenses) ? ledger.expenses.filter(item => item && typeof item === 'object') : [],
      transfers: Array.isArray(ledger.transfers) ? ledger.transfers.filter(item => item && typeof item === 'object') : [],
      openingBalances: ledger.openingBalances && typeof ledger.openingBalances === 'object' && !Array.isArray(ledger.openingBalances) ? ledger.openingBalances : {},
      goalSnapshots: ledger.goalSnapshots && typeof ledger.goalSnapshots === 'object' && !Array.isArray(ledger.goalSnapshots) ? ledger.goalSnapshots : {},
      potSnapshots: ledger.potSnapshots && typeof ledger.potSnapshots === 'object' && !Array.isArray(ledger.potSnapshots) ? ledger.potSnapshots : {},
      incomeSources: Array.isArray(ledger.incomeSources) ? ledger.incomeSources.filter(item => item && typeof item === 'object') : [],
      allocationRules: Array.isArray(ledger.allocationRules) ? ledger.allocationRules.filter(item => item && typeof item === 'object') : [],
      recurringBills: Array.isArray(ledger.recurringBills) ? ledger.recurringBills.filter(item => item && typeof item === 'object') : [],
      pendingDistributions: Array.isArray(ledger.pendingDistributions) ? ledger.pendingDistributions.filter(item => item && typeof item === 'object') : [],
      distributionMode: ledger.distributionMode === 'automatic' ? 'automatic' : 'approval'
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
      || (input.sourceId && item.sourceId === String(input.sourceId) && item.date === date)
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
      allocations: prepared, ...(input.sourceId ? { sourceId: String(input.sourceId) } : {})
    };
    target.incomes.unshift(entry);
    Object.assign(ledger, target);
    return entry;
  }

  const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'semiannual', 'yearly', 'once'];
  const BILL_FREQUENCIES = FREQUENCIES.filter(value => value !== 'once');
  const cleanLabel = (value, limit = 100) => String(value || '').trim().slice(0, limit);

    function addIncomeSource(ledger, input, pots, sourceId = id()) {
      const target = normalize(ledger);
      const name = cleanLabel(input.name);
      const receiver = cleanLabel(input.receiver, 80);
      const amountCents = positiveCents(input.amount);
      const frequency = String(input.frequency || '');
      const expectedDate = String(input.expectedDate || '');
      if (!name || !receiver) throw new Error('Vul de naam en ontvanger van de inkomstenbron in.');
      if (!FREQUENCIES.includes(frequency)) throw new Error('Kies een geldige frequentie.');
      requireDate(expectedDate);
      const potId = input.potId ? requirePot(pots, input.potId) : '';
      const source = {
        id: sourceId, name, receiver, amountCents, frequency, expectedDate,
        active: input.active !== false, potId
      };
      target.incomeSources.push(source);
      Object.assign(ledger, target);
      return source;
    }

    function updateIncomeSource(ledger, sourceId, input, pots) {
      const target = normalize(ledger);
      const index = target.incomeSources.findIndex(item => item.id === sourceId);
      if (index < 0) throw new Error('Deze inkomstenbron bestaat niet meer.');
      const candidate = clone(target);
      candidate.incomeSources.splice(index, 1);
      addIncomeSource(candidate, input, pots, sourceId);
      target.incomeSources = candidate.incomeSources;
      Object.assign(ledger, target);
      return target.incomeSources.find(item => item.id === sourceId);
    }

    function setDistributionMode(ledger, mode) {
      if (!['approval', 'automatic'].includes(mode)) throw new Error('Kies een geldige verdelingsmodus.');
      ledger.distributionMode = mode;
      return mode;
    }

    function addAllocationRule(ledger, input, pots, ruleId = id()) {
      const target = normalize(ledger);
      const potId = requirePot(pots, input.potId);
      const kind = String(input.kind || '');
      if (!['fixed', 'percent'].includes(kind)) throw new Error('Kies een vast bedrag of percentage.');
      const value = kind === 'fixed' ? positiveCents(input.amount) : Math.trunc(Number(input.basisPoints));
      if (kind === 'percent' && (!Number.isInteger(value) || value < 1 || value > 10000)) {
        throw new Error('Het percentage moet tussen 0,01% en 100% liggen.');
      }
      const priority = input.priority === undefined || input.priority === '' || !Number.isInteger(Number(input.priority))
        ? target.allocationRules.length : Number(input.priority);
      const rule = { id: ruleId, potId, kind, value, priority, active: input.active !== false };
      target.allocationRules.push(rule);
      Object.assign(ledger, target);
      return rule;
    }

    function updateAllocationRule(ledger, ruleId, input, pots) {
      const target = normalize(ledger);
      const index = target.allocationRules.findIndex(item => item.id === ruleId);
      if (index < 0) throw new Error('Deze verdelingsregel bestaat niet meer.');
      const candidate = clone(target);
      candidate.allocationRules.splice(index, 1);
      addAllocationRule(candidate, input, pots, ruleId);
      target.allocationRules = candidate.allocationRules;
      Object.assign(ledger, target);
      return target.allocationRules.find(item => item.id === ruleId);
    }

    function proposeIncomeDistribution(ledger, incomeId, pots, options = {}) {
      const target = normalize(ledger);
      const existing = target.pendingDistributions.find(item => item.incomeId === incomeId);
      if (existing) return existing;
      const income = target.incomes.find(item => item.id === incomeId);
      if (!income) throw new Error('Deze inkomstenboeking bestaat niet meer.');
      const remaining = Math.max(0, round(income.amountCents) - allocatedToIncome(income));
      if (!remaining) throw new Error('Deze inkomstenboeking is al volledig verdeeld.');
      const rules = target.allocationRules.filter(rule => rule.active !== false)
        .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
      let available = remaining;
      const allocations = [];
      for (const rule of rules) {
        if (available <= 0) break;
        const amountCents = rule.kind === 'percent'
          ? Math.min(available, Math.floor(remaining * Number(rule.value) / 10000))
          : Math.min(available, Math.max(0, round(rule.value)));
        if (!amountCents) continue;
        const potId = requirePot(pots, rule.potId);
        allocations.push({ ruleId: rule.id, potId, amountCents });
        available -= amountCents;
      }
      const proposal = {
        id: `distribution:${incomeId}`, incomeId, allocations, unallocatedCents: available,
        status: options.automatic ? 'approved' : 'proposed', createdAt: new Date().toISOString()
      };
      if (options.automatic) {
        allocations.forEach(allocation => allocateIncome(target, {
          incomeId, potId: allocation.potId, amount: allocation.amountCents / 100,
          id: `${proposal.id}:${allocation.ruleId}`
        }, pots));
      }
      target.pendingDistributions.push(proposal);
      Object.assign(ledger, target);
      return proposal;
    }

    function approveIncomeDistribution(ledger, proposalId, pots) {
      const target = normalize(ledger);
      const proposal = target.pendingDistributions.find(item => item.id === proposalId);
      if (!proposal || proposal.status !== 'proposed') return false;
      const income = target.incomes.find(item => item.id === proposal.incomeId);
      if (!income) throw new Error('Deze inkomstenboeking bestaat niet meer.');
      const amount = proposal.allocations.reduce((sum, item) => sum + round(item.amountCents), 0);
      if (allocatedToIncome(income) + amount > round(income.amountCents)) {
        throw new Error('De inkomsten zijn gewijzigd; maak een nieuwe verdelingssuggestie.');
      }
      proposal.allocations.forEach(allocation => allocateIncome(target, {
        incomeId: proposal.incomeId, potId: allocation.potId,
        amount: allocation.amountCents / 100, id: `${proposal.id}:${allocation.ruleId}`
      }, pots));
      const savedProposal = target.pendingDistributions.find(item => item.id === proposalId);
      savedProposal.status = 'approved';
      savedProposal.approvedAt = new Date().toISOString();
      Object.assign(ledger, target);
      return true;
    }

    function addRecurringBill(ledger, input, pots, billId = id()) {
      const target = normalize(ledger);
      const name = cleanLabel(input.name);
      const potId = requirePot(pots, input.potId);
      const frequency = String(input.frequency || '');
      const startDate = String(input.startDate || '');
      const endDate = String(input.endDate || '');
      const expectedDate = String(input.expectedDate || startDate);
      const amountCents = positiveCents(input.amount);
      if (!name) throw new Error('Vul de naam van de vaste last in.');
      if (!BILL_FREQUENCIES.includes(frequency)) throw new Error('Kies een geldige frequentie voor de vaste last.');
      requireDate(startDate);
      requireDate(expectedDate);
      if (endDate) {
        requireDate(endDate);
        if (endDate < startDate) throw new Error('De einddatum kan niet voor de startdatum liggen.');
      }
      const bill = {
        id: billId, name, amountCents, potId, frequency, expectedDate, startDate, endDate,
        variable: Boolean(input.variable), active: input.active !== false,
        note: cleanLabel(input.note, 240)
      };
      target.recurringBills.push(bill);
      Object.assign(ledger, target);
      return bill;
    }

    function updateRecurringBill(ledger, billId, input, pots) {
      const target = normalize(ledger);
      const index = target.recurringBills.findIndex(item => item.id === billId);
      if (index < 0) throw new Error('Deze vaste last bestaat niet meer.');
      const candidate = clone(target);
      candidate.recurringBills.splice(index, 1);
      addRecurringBill(candidate, input, pots, billId);
      target.recurringBills = candidate.recurringBills;
      Object.assign(ledger, target);
      return target.recurringBills.find(item => item.id === billId);
    }

    function addMonths(date, amount) {
      const [year, month, day] = date.split('-').map(Number);
      const first = new Date(Date.UTC(year, month - 1 + amount, 1));
      const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
    }

    function occurrencesInMonth(anchor, frequency, month) {
      if (!validDate(anchor) || !validMonth(month)) return [];
      const first = `${month}-01`, last = addMonths(first, 1);
      if (frequency === 'weekly') {
        const startMs = Date.parse(`${anchor}T00:00:00Z`);
        const firstMs = Date.parse(`${first}T00:00:00Z`);
        const offset = Math.max(0, Math.ceil((firstMs - startMs) / 604800000));
        const dates = [];
        let date = new Date(startMs + offset * 604800000).toISOString().slice(0, 10);
        while (date < last) {
          dates.push(date);
          date = new Date(Date.parse(`${date}T00:00:00Z`) + 604800000).toISOString().slice(0, 10);
        }
        return dates;
      }
      const step = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }[frequency];
      if (!step) return [];
      const [anchorYear, anchorMonth] = anchor.slice(0, 7).split('-').map(Number);
      const [targetYear, targetMonth] = month.split('-').map(Number);
      const monthDifference = (targetYear - anchorYear) * 12 + targetMonth - anchorMonth;
      let occurrence = Math.max(0, Math.ceil(monthDifference / step));
      let date = addMonths(anchor, occurrence * step);
      while (date < first) {
        occurrence += 1;
        date = addMonths(anchor, occurrence * step);
      }
      const dates = [];
      while (date < last) {
        dates.push(date);
        occurrence += 1;
        date = addMonths(anchor, occurrence * step);
      }
      return dates;
    }

    function billOccurrences(bill, month) {
      if (!validMonth(month) || bill.active === false) return [];
      const start = bill.startDate || bill.expectedDate;
      const end = bill.endDate || '9999-12-31';
      const anchor = bill.expectedDate || start;
      if (!validDate(start) || !validDate(anchor)) return [];
      return occurrencesInMonth(anchor, bill.frequency, month).filter(date => date >= start && date <= end);
    }

    function monthPlan(ledger, month, pots) {
      const target = normalize(ledger);
      if (!validMonth(month)) throw new Error('Kies een geldige maand.');
      const expectedIncome = target.incomeSources.flatMap(source => {
        if (source.active === false || !validDate(source.expectedDate)) return [];
        const frequency = source.frequency;
        if (frequency === 'once') return monthOf(source.expectedDate) === month
          ? [{ sourceId: source.id, name: source.name, receiver: source.receiver, date: source.expectedDate, amountCents: round(source.amountCents), received: false }]
          : [];
        if (['weekly', 'monthly', 'yearly', 'quarterly', 'semiannual'].includes(frequency)) {
          const dates = occurrencesInMonth(source.expectedDate, frequency, month);
          return dates.map(date => ({
            sourceId: source.id, name: source.name, receiver: source.receiver, date,
            amountCents: round(source.amountCents),
            received: target.incomes.some(income => (income.sourceId === source.id
              || String(income.source || '').trim().toLocaleLowerCase('nl-NL') === source.name.toLocaleLowerCase('nl-NL'))
              && income.date === date)
          }));
        }
        return [];
      });
      const bills = target.recurringBills.flatMap(bill => billOccurrences(bill, month).map(date => {
        const paid = target.expenses.find(expense => expense.fixedBillId === bill.id && expense.billOccurrenceDate === date);
        return {
          billId: bill.id, name: bill.name, potId: bill.potId, date,
          amountCents: paid ? 0 : round(bill.amountCents),
          expectedAmountCents: round(bill.amountCents),
          paidAmountCents: paid ? round(paid.amountCents) : 0,
          variable: Boolean(bill.variable), paid: Boolean(paid), expenseId: paid?.id || ''
        };
      }));
      const balances = allPotBalances(target, pots);
      const byPot = {};
      for (const pot of pots) {
        const due = bills.filter(item => item.potId === pot.id);
        const neededCents = due.reduce((sum, item) => sum + item.amountCents, 0);
        const balanceCents = round(balances[pot.id] || 0);
        const reservedCents = Math.min(Math.max(0, balanceCents), neededCents);
        byPot[pot.id] = {
          balanceCents, reservedCents, availableCents: balanceCents - reservedCents,
          stillNeededCents: Math.max(0, neededCents - reservedCents),
          dueCents: neededCents, paidCents: due.reduce((sum, item) => sum + item.paidAmountCents, 0)
        };
      }
      return {
        month, expectedIncome, bills: bills.sort((a, b) => a.date.localeCompare(b.date)),
        totalBillsCents: bills.reduce((sum, item) => sum + item.expectedAmountCents, 0),
        unpaidBillsCents: bills.reduce((sum, item) => sum + item.amountCents, 0), byPot
      };
    }

    function recordBillPayment(ledger, input, pots, options = {}) {
      const target = normalize(ledger);
      const bill = target.recurringBills.find(item => item.id === input.billId && item.active !== false);
      const occurrenceDate = String(input.occurrenceDate || '');
      const date = String(input.date || occurrenceDate);
      if (!bill || !billOccurrences(bill, monthOf(occurrenceDate)).includes(occurrenceDate)) {
        throw new Error('Deze verwachte betaling bestaat niet (meer).');
      }
      requireDate(date);
      if (target.expenses.some(item => item.fixedBillId === bill.id && item.billOccurrenceDate === occurrenceDate)) {
        throw new Error('Deze vaste last is al als betaald geregistreerd.');
      }
      const amount = input.amount === undefined || input.amount === ''
        ? bill.amountCents / 100 : input.amount;
      const entry = addExpense(target, {
        id: input.id || `${bill.id}:${occurrenceDate}`, amount, date,
        category: 'Vaste lasten', potId: bill.potId, description: bill.name,
        externalId: `fixed-bill:${bill.id}:${occurrenceDate}`, fixedBillId: bill.id,
        billOccurrenceDate: occurrenceDate
      }, pots, options);
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
      description, person: source, externalId,
      ...(input.fixedBillId ? { fixedBillId: String(input.fixedBillId) } : {}),
      ...(input.billOccurrenceDate ? { billOccurrenceDate: String(input.billOccurrenceDate) } : {})
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
    addAllocationRule, addExpense, addIncome, addIncomeSource, addRecurringBill, addTransfer,
    allocateIncome, allPotBalances, availableCashCents, approveIncomeDistribution,
    billOccurrences, monthPlan, proposeIncomeDistribution, recordBillPayment, setDistributionMode,
    cents, empty, monthOf, monthSummary, normalize, removeAllocation, removeEntry, round,
    updateAllocationRule, updateEntry, updateIncomeSource, updateRecurringBill, occurrencesInMonth, validDate, validMonth
  };
});
