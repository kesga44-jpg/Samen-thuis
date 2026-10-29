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

  function sameData(left, right) {
    return stableStringify(left) === stableStringify(right);
  }

  function remoteChangedSinceChoice(expectedRemote, currentRemote) {
    return Boolean(expectedRemote && currentRemote && !sameData(expectedRemote, currentRemote));
  }

  function conditionalUpdateSucceeded(rows) {
    return Array.isArray(rows) && rows.length > 0;
  }

  function hasConcurrentChanges(localUpdatedAt, remoteUpdatedAt, lastSyncedAt, localData, remoteData) {
    const local = Date.parse(localUpdatedAt || '');
    const remote = Date.parse(remoteUpdatedAt || '');
    const baseline = Date.parse(lastSyncedAt || '');
    if (!Number.isFinite(baseline) || !Number.isFinite(local) || !Number.isFinite(remote)
      || local <= baseline || remote <= baseline) return false;
    if (localData !== undefined) return !sameData(localData, remoteData);
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
    if (choice === 'local') {
      selected.meta ||= {};
      selected.meta.updatedAt = now;
    }
    return { choice, data: selected };
  }

  function createConflictStore(storage, key) {
    let memory = null;
    return {
      get() {
        try { return JSON.parse(storage.getItem(key) || 'null') || memory; }
        catch { return memory; }
      },
      store(conflict) {
        memory = conflict;
        try {
          storage.setItem(key, JSON.stringify(conflict));
          return true;
        } catch {
          return false;
        }
      },
      clear() {
        try { storage.removeItem(key); }
        catch { return false; }
        memory = null;
        return true;
      }
    };
  }

  function nextDue(lastDone, initialDue, repeat) {
    const normalized = String(repeat || '').toLocaleLowerCase('nl-NL').replace(/(\d)x/g, '$1×');
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

  // Bewaar onleesbare opslag onder een eigen sleutel (eenmalig per inhoud) voordat save() deze kan overschrijven.
  function preserveCorruptData(storage, raw, key, now) {
    if (!raw) return false;
    try {
      const existing = JSON.parse(storage.getItem(key) || 'null');
      if (existing && existing.raw === raw) return true;
      const list = Array.isArray(existing?.items) ? existing.items : [];
      const items = list.concat({ raw, at: now }).slice(-3);
      storage.setItem(key, JSON.stringify({ raw, at: now, items }));
      return true;
    } catch { return false; }
  }

  function parseStoredData(raw, migrate) {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Geen geldige Samen Thuis-gegevens');
    return migrate(parsed);
  }

  // Laadt lokale gegevens; beschadigde brondata blijft bewaard en wordt nooit stil weggegooid.
  function loadWithRecovery(storage, o) {
    let stored = null;
    try {
      stored = storage.getItem(o.storageKey) || (o.legacyKey ? storage.getItem(o.legacyKey) : null);
      if (!stored) return { data: o.fresh(), status: 'empty' };
      const data = parseStoredData(stored, o.migrate);
      try {
        if (!storage.getItem(o.backupKey)) {
          storage.setItem(o.backupKey, stored);
          storage.setItem(o.backupAtKey, o.now());
        }
      } catch {}
      return { data, status: 'ok' };
    } catch {
      const preserved = preserveCorruptData(storage, stored, o.corruptKey, o.now());
      try {
        const backup = storage.getItem(o.backupKey);
        if (backup && backup !== stored) return { data: parseStoredData(backup, o.migrate), status: 'recovered', preserved };
      } catch {}
      return { data: o.fresh(), status: 'fresh', preserved };
    }
  }

  function listCorruptBackups(storage, key, migrate) {
    let items = [];
    try { items = JSON.parse(storage.getItem(key) || 'null')?.items || []; } catch { return []; }
    return items.map((item, index) => {
      let valid = true;
      try { parseStoredData(item.raw, migrate); } catch { valid = false; }
      return { index, at: item.at || '', size: String(item.raw || '').length, valid };
    });
  }

  // Schrijft herstelde gegevens: eerst de herstelvlag, dan de herstelkopie, dan pas de gegevens.
  // Bij een fout blijven de oorspronkelijke gegevens intact en wordt de vlag weer verwijderd.
  function writeRestored(storage, o, data, sourceRaw) {
    const current = storage.getItem(o.storageKey);
    if (o.holdKey) storage.setItem(o.holdKey, '1');
    try {
      if (current && current !== sourceRaw) storage.setItem(o.preRestoreKey, current);
      storage.setItem(o.storageKey, JSON.stringify(data));
    } catch (error) {
      if (o.holdKey) { try { storage.removeItem(o.holdKey); } catch {} }
      throw error;
    }
    return data;
  }

  // Valideert vóór herstel; de huidige gegevens gaan eerst naar een aparte kopie.
  function restoreCorruptBackup(storage, o, index) {
    const items = JSON.parse(storage.getItem(o.corruptKey) || 'null')?.items || [];
    const item = items[index];
    if (!item) throw new Error('Back-up niet gevonden');
    const data = parseStoredData(item.raw, o.migrate);
    return writeRestored(storage, o, data, item.raw);
  }

  // Herstel vanuit een back-upbestand: zelfde bescherming als restoreCorruptBackup.
  // De updatedAt van de back-up blijft ongewijzigd, zodat de eerstvolgende sync via de hold een conflictkeuze vraagt.
  function restoreBackupText(storage, o, text) {
    const data = parseStoredData(text, o.migrate);
    return writeRestored(storage, o, data, null);
  }

  // Bepaalt de synchronisatiestap. Een herstelde kopie die afwijkt van de cloud wordt nooit automatisch geüpload.
  function planSync({ local, remote, hold, resolution, lastSyncedAt }) {
    if (!remote) return 'upload';
    if (!resolution && ((hold && !sameData(local, remote))
      || hasConcurrentChanges(local.meta?.updatedAt, remote.meta?.updatedAt, lastSyncedAt, local, remote))) return 'conflict';
    if (resolution === 'remote') return 'remote';
    if (resolution === 'local') return 'upload';
    const l = new Date(local.meta?.updatedAt || 0).getTime();
    const r = new Date(remote.meta?.updatedAt || 0).getTime();
    if (r > l) return 'remote';
    if (l > r) return 'upload';
    return 'none';
  }

  return { restoreBackupText, planSync, loadWithRecovery, listCorruptBackups, restoreCorruptBackup, preserveCorruptData, hasConcurrentChanges, mergeUnique, nextDue, normalizeFuelMateFill, preserveUnknownFields, resolveSyncConflict, createConflictStore, sameData, remoteChangedSinceChoice, conditionalUpdateSucceeded };
});
