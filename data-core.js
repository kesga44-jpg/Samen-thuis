(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisCore = core;
})(globalThis, function () {
  function hasConcurrentChanges(localUpdatedAt, remoteUpdatedAt, lastSyncedAt) {
    const local = Date.parse(localUpdatedAt || '');
    const remote = Date.parse(remoteUpdatedAt || '');
    const baseline = Date.parse(lastSyncedAt || '');
    if (!Number.isFinite(baseline) || !Number.isFinite(local) || !Number.isFinite(remote)
      || local <= baseline || remote <= baseline) return false;
    if (arguments.length > 3) return JSON.stringify(arguments[3]) !== JSON.stringify(arguments[4]);
    return local !== remote;
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

  function nextDue(lastDone, initialDue, repeat) {
    const normalized = String(repeat || '').toLocaleLowerCase('nl-NL').replaceAll('x', '×');
    if (['na elke was', 'wanneer nodig'].includes(normalized)) return '';
    if (normalized === 'eenmalig') return lastDone ? '' : (initialDue || '');
    if (!lastDone) return initialDue || '';

    const date = new Date(`${lastDone}T12:00:00`);
    const monthIntervals = {
      'maandelijks': 1,
      'elke 2 maanden': 2,
      'elke 3 maanden': 3,
      'elke 6 maanden': 6,
      'halfjaarlijks': 6,
      'jaarlijks': 12
    };
    if (monthIntervals[normalized]) {
      const day = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + monthIntervals[normalized]);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).getDate();
      date.setDate(Math.min(day, lastDay));
    } else {
      const days = {
        'dagelijks': 1,
        'om de dag': 2,
        '2× per week': 4,
        '2 per week': 4,
        '3× per week': 3,
        '3 per week': 3,
        'wekelijks': 7,
        'elke 2 weken': 14,
        'om de week': 14,
        'elke 4 weken': 28
      }[normalized] || 7;
      date.setDate(date.getDate() + days);
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  return { hasConcurrentChanges, mergeUnique, nextDue };
});
