(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisCore = core;
})(globalThis, function () {
  const MONTH_INTERVALS = {
    maandelijks: 1,
    'elke 2 maanden': 2,
    'elke 3 maanden': 3,
    'elke 6 maanden': 6,
    halfjaarlijks: 6,
    jaarlijks: 12
  };
  // Multiple-times-weekly schedules use the same flexible gaps as the household planner.
  const DAY_INTERVALS = {
    dagelijks: 1,
    'om de dag': 2,
    '2× per week': 4,
    '2 per week': 4,
    '3× per week': 3,
    '3 per week': 3,
    wekelijks: 7,
    'elke 2 weken': 14,
    'om de week': 14,
    'elke 4 weken': 28
  };

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function hasConcurrentChanges(localUpdatedAt, remoteUpdatedAt, lastSyncedAt, localData, remoteData) {
    const local = Date.parse(localUpdatedAt || '');
    const remote = Date.parse(remoteUpdatedAt || '');
    const baseline = Date.parse(lastSyncedAt || '');
    if (!Number.isFinite(baseline) || !Number.isFinite(local) || !Number.isFinite(remote)
      || local <= baseline || remote <= baseline) return false;
    if (localData !== undefined) return stableStringify(localData) !== stableStringify(remoteData);
    return local !== remote;
  }

  function preserveUnknownFields(raw, target, cloneValue) {
    Object.keys(raw || {}).forEach(key => {
      if (key in target) return;
      try { target[key] = cloneValue(raw[key]); }
      catch { target[key] = raw[key]; }
    });
    return target;
  }

  function mergeUnique(existing, incoming, signature) {
    const result = Array.isArray(existing) ? existing.slice() : [];
    const seen = new Set(result.map(signature));
    (Array.isArray(incoming) ? incoming : []).forEach(item => {
      const key = signature(item);
      if (!seen.has(key)) {
        result.push(item);
        seen.add(key);
      }
    });
    return result;
  }

  function normalizeFuelMateFill(fill, carId, id) {
    const number = value => Number(String(value ?? 0).replace(',', '.')) || 0;
    const flag = value => ['1', 'true', 'ja', 'yes', 'x', '✓'].includes(String(value || '').trim().toLowerCase());
    const liters = number(fill.volume ?? fill.liters ?? fill.litres ?? fill.amountLiters ?? fill.hoeveelheid);
    const total = number(fill.totalCost ?? fill.total ?? fill.cost ?? fill.amount ?? fill.bedrag);
    const pricePerLiter = number(fill.pricePerLiter ?? fill.price_per_liter ?? fill.unitPrice ?? fill.literPrice)
      || (liters ? total / liters : 0);
    return {
      id,
      carId,
      date: String(fill.date ?? fill.datetime ?? fill.createdAt ?? fill.datum ?? '').slice(0, 10),
      odometer: number(fill.odometer ?? fill.mileage ?? fill.kilometerstand),
      liters,
      total,
      pricePerLiter,
      fuelGrade: String(fill.grade ?? fill.fuelGrade ?? fill.fuelType ?? fill.brandstof ?? ''),
      station: fill.station ?? fill.gasStation ?? fill.tankstation ?? '',
      partialFill: flag(fill.partial ?? fill.partialFill ?? fill.isPartial),
      missedPrevious: flag(fill.missedFill ?? fill.missedPrevious ?? fill.missed),
      note: fill.note ?? fill.notes ?? fill.notitie ?? ''
    };
  }

  function resolveSyncConflict(conflict, choice, cloneValue, now) {
    if (!['local', 'remote'].includes(choice)) throw new Error('Kies een geldige synchronisatieversie');
    const selected = cloneValue(choice === 'local' ? conflict.localData : conflict.remoteData);
    if (choice === 'local') selected.meta.updatedAt = now;
    return { choice, data: selected };
  }

  function nextDue(lastDone, initialDue, repeat) {
    const normalized = String(repeat || '').toLocaleLowerCase('nl-NL').replaceAll('x', '×');
    if (['na elke was', 'wanneer nodig'].includes(normalized)) return '';
    if (normalized === 'eenmalig') return lastDone ? '' : (initialDue || '');
    if (!lastDone) return initialDue || '';

    const date = new Date(`${lastDone}T12:00:00`);
    if (MONTH_INTERVALS[normalized]) {
      const day = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + MONTH_INTERVALS[normalized]);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).getDate();
      date.setDate(Math.min(day, lastDay));
    } else {
      const days = DAY_INTERVALS[normalized] || 7; // Unknown repeat values retain the legacy weekly default.
      date.setDate(date.getDate() + days);
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  return { hasConcurrentChanges, mergeUnique, nextDue, normalizeFuelMateFill, preserveUnknownFields, resolveSyncConflict };
});
