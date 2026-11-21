/* Duurzame synchronisatiemetadata (alleen op dit apparaat). De applicatiegegevens zelf blijven in samenThuisDataV2.
   Inhoud:
   - baseValues: per account+huishouden ("slot") en onderdeel de laatst door de server bevestigde waarde, de basis voor
     3-wegs samenvoegen. De vorige bevestigde waarde blijft ook bewaard (`prev`), zodat een crash tussen het opslaan van
     deze waarde en het bijwerken van de versie-administratie (localStorage) niet tot een verloren basis leidt.
   - inflight: verzonden maar (nog) niet bevestigde uploads. Na een crash of netwerkverlies blijft zichtbaar dat de uitkomst
     onzeker is; de volgende ronde stelt via versie + hash vast of de server de wijziging al had (dan geen tweede mutatie).
   - conflicts: conflictsamenvattingen per slot (sync) en tabbladconflicten (met de niet-gekozen waarde, om terug te halen).
   Opslag: IndexedDB; valt terug op localStorage en daarna op geheugen. Oude basiswaarden uit
   localStorage (samenThuisAccountSyncBaseValuesV1) worden eenmalig overgenomen en pas na bevestigde opslag verwijderd. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisSyncMeta = core;
})(globalThis, function () {
  'use strict';

  const DB_NAME = 'samenThuisSyncMetaV1';
  const DB_VERSION = 1;
  const STORES = ['baseValues', 'inflight', 'conflicts'];
  const LEGACY_BASE_KEY = 'samenThuisAccountSyncBaseValuesV1';
  const FALLBACK_KEY = 'samenThuisSyncMetaFallbackV1';
  const MAX_TAB_CONFLICTS = 20;
  const sep = '\u0000';
  const keyOf = (...parts) => parts.map(String).join(sep);

  // ---------- Backends: getAll(store) → records, putMany(store, records), deleteMany(store, keys) ----------
  function memoryBackend() {
    const data = Object.fromEntries(STORES.map(s => [s, new Map()]));
    return {
      kind: 'memory',
      async getAll(store) { return [...data[store].values()].map(r => JSON.parse(JSON.stringify(r))); },
      async putMany(store, records) { records.forEach(r => data[store].set(r.key, JSON.parse(JSON.stringify(r)))); },
      async deleteMany(store, keys) { keys.forEach(k => data[store].delete(k)); }
    };
  }

  // localStorage-fallback. Lukt schrijven niet (opslag vol), dan gaat de backend over op geheugen: de metadata is
  // herbouwbaar en mag de echte gegevens nooit verdringen.
  function storageBackend(storage) {
    let memory = null;
    const read = () => { try { const v = JSON.parse(storage.getItem(FALLBACK_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
    const write = all => { storage.setItem(FALLBACK_KEY, JSON.stringify(all)); };
    const backend = {
      kind: 'localStorage',
      async getAll(store) { if (memory) return memory.getAll(store); return Object.values(read()[store] || {}); },
      async putMany(store, records) {
        if (memory) return memory.putMany(store, records);
        const all = read(); all[store] = all[store] || {};
        records.forEach(r => { all[store][r.key] = r; });
        try { write(all); }
        catch (_) {
          memory = memoryBackend(); backend.kind = 'memory';
          for (const s of STORES) await memory.putMany(s, Object.values(all[s] || {}));
        }
      },
      async deleteMany(store, keys) {
        if (memory) return memory.deleteMany(store, keys);
        const all = read(); keys.forEach(k => { if (all[store]) delete all[store][k]; });
        try { write(all); } catch (_) {}
      }
    };
    return backend;
  }

  function idbRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB-verzoek mislukt'));
    });
  }

  // Elke schrijfactie wacht op `complete` van de transactie: pas dan staat de metadata duurzaam op schijf.
  function openIndexedDb(idb, { timeoutMs = 4000, timers = globalThis } = {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn, value) => { if (!settled) { settled = true; timers.clearTimeout(timer); fn(value); } };
      const timer = timers.setTimeout(() => done(reject, new Error('IndexedDB opent niet (time-out)')), timeoutMs);
      let request;
      try { request = idb.open(DB_NAME, DB_VERSION); } catch (error) { done(reject, error); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'key' }); });
      };
      request.onblocked = () => done(reject, new Error('IndexedDB geblokkeerd door een ander tabblad'));
      request.onerror = () => done(reject, request.error || new Error('IndexedDB openen mislukt'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { try { db.close(); } catch (_) {} };
        done(resolve, db);
      };
    }).then(db => {
      const tx = (store, mode, work) => new Promise((resolve, reject) => {
        let result;
        const t = db.transaction(store, mode);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error || new Error('IndexedDB-transactie mislukt'));
        t.onabort = () => reject(t.error || new Error('IndexedDB-transactie afgebroken'));
        Promise.resolve(work(t.objectStore(store))).then(r => { result = r; }, error => { try { t.abort(); } catch (_) {} reject(error); });
      });
      return {
        kind: 'indexeddb',
        getAll: store => tx(store, 'readonly', os => idbRequest(os.getAll())),
        putMany: (store, records) => tx(store, 'readwrite', os => { records.forEach(r => os.put(r)); }),
        deleteMany: (store, keys) => tx(store, 'readwrite', os => { keys.forEach(k => os.delete(k)); }),
        close: () => { try { db.close(); } catch (_) {} }
      };
    });
  }

  function createSyncMetaStore({ indexedDB, storage, hashValue, now = () => new Date().toISOString(), timers } = {}) {
    if (typeof hashValue !== 'function') throw new Error('createSyncMetaStore: hashValue is vereist');
    let backendPromise = null;
    let warning = '';

    async function migrateLegacy(backend) {
      if (!storage) return;
      let raw = null;
      try { raw = storage.getItem(LEGACY_BASE_KEY); } catch (_) { return; }
      if (!raw) return;
      let legacy;
      try { legacy = JSON.parse(raw); } catch (_) { return; } // onleesbaar: oude sleutel blijft onaangeroerd staan
      if (!legacy || typeof legacy !== 'object') return;
      const existing = new Set((await backend.getAll('baseValues')).map(r => r.key));
      const records = [];
      for (const [slot, values] of Object.entries(legacy)) {
        if (!values || typeof values !== 'object') continue;
        for (const [section, value] of Object.entries(values)) {
          const key = keyOf(slot, section);
          if (!existing.has(key)) records.push({ key, slot, section, hash: hashValue(value), value, prev: null, at: now() });
        }
      }
      if (records.length) await backend.putMany('baseValues', records);
      // Alleen verwijderen als alles aantoonbaar is overgenomen.
      const after = new Set((await backend.getAll('baseValues')).map(r => r.key));
      if (records.every(r => after.has(r.key))) { try { storage.removeItem(LEGACY_BASE_KEY); } catch (_) {} }
    }

    async function init() {
      let backend = null;
      if (indexedDB && typeof indexedDB.open === 'function') {
        try { backend = await openIndexedDb(indexedDB, { timers }); }
        catch (error) { warning = 'IndexedDB niet beschikbaar: ' + (error && error.message || error); backend = null; }
      } else warning = 'IndexedDB niet beschikbaar in deze browser';
      if (!backend) backend = storage ? storageBackend(storage) : memoryBackend();
      try { await migrateLegacy(backend); } catch (_) { /* oude sleutel blijft staan; geen verlies */ }
      return backend;
    }
    const backend = () => (backendPromise ||= init());
    const bySlot = async (store, slot) => (await (await backend()).getAll(store)).filter(r => r.slot === slot);

    return {
      async mode() { return (await backend()).kind; },
      warning: () => warning,

      // bases: {section: {version, hash}} uit de versie-administratie. Geeft de basiswaarde die bij die hash hoort.
      async loadBaseValues(slot, bases) {
        const out = {};
        for (const r of await bySlot('baseValues', slot)) {
          const want = bases && bases[r.section] ? bases[r.section].hash : null;
          if (!want || r.hash === want) out[r.section] = r.value;
          else if (r.prev && r.prev.hash === want) out[r.section] = r.prev.value;
        }
        return out;
      },
      async saveBaseValues(slot, values) {
        const b = await backend();
        const current = new Map((await bySlot('baseValues', slot)).map(r => [r.section, r]));
        const records = [];
        for (const [section, value] of Object.entries(values || {})) {
          const hash = hashValue(value), old = current.get(section);
          if (old && old.hash === hash) continue;
          records.push({ key: keyOf(slot, section), slot, section, hash, value, prev: old ? { hash: old.hash, value: old.value } : null, at: now() });
        }
        if (records.length) await b.putMany('baseValues', records);
        return records.length;
      },

      async beginUpload(slot, section, info = {}) {
        await (await backend()).putMany('inflight', [{ key: keyOf(slot, section), slot, section, expectedVersion: Number(info.expectedVersion) || 0, startedAt: now() }]);
      },
      async endUpload(slot, section) { await (await backend()).deleteMany('inflight', [keyOf(slot, section)]); },
      async listInflight(slot) { return bySlot('inflight', slot); },
      async clearInflight(slot, sections) {
        const keys = (await bySlot('inflight', slot)).filter(r => !sections || sections.includes(r.section)).map(r => r.key);
        if (keys.length) await (await backend()).deleteMany('inflight', keys);
      },

      // Conflictsamenvattingen van de laatste ronde (vervangt de vorige set voor dit slot).
      async saveConflicts(slot, conflicts) {
        const b = await backend();
        const old = (await bySlot('conflicts', slot)).filter(r => r.kind === 'sync').map(r => r.key);
        if (old.length) await b.deleteMany('conflicts', old);
        const records = (conflicts || []).map(c => ({
          key: keyOf(slot, 'sync', c.section), slot, kind: 'sync', section: c.section,
          fields: Array.isArray(c.fields) ? c.fields.slice(0, 20) : [], remoteVersion: Number(c.remoteVersion) || 0, raced: !!c.raced, at: now()
        }));
        if (records.length) await b.putMany('conflicts', records);
      },
      async loadConflicts(slot) {
        return (await bySlot('conflicts', slot)).filter(r => r.kind === 'sync')
          .map(r => ({ section: r.section, fields: r.fields, remoteVersion: r.remoteVersion, raced: r.raced, restored: true }));
      },

      // Tabbladconflict: dezelfde waarde in twee tabbladen anders gewijzigd. De niet-gekozen waarde blijft bewaard.
      async recordTabConflict({ fields, discarded }) {
        const b = await backend();
        const at = now();
        await b.putMany('conflicts', [{ key: keyOf('local', 'tab', at, Math.random().toString(36).slice(2, 8)), slot: 'local', kind: 'tab', fields: (fields || []).slice(0, 20), discarded, at }]);
        const tabs = (await bySlot('conflicts', 'local')).filter(r => r.kind === 'tab').sort((x, y) => String(y.at).localeCompare(String(x.at)));
        const excess = tabs.slice(MAX_TAB_CONFLICTS).map(r => r.key);
        if (excess.length) await b.deleteMany('conflicts', excess);
      },
      async listTabConflicts() { return (await bySlot('conflicts', 'local')).filter(r => r.kind === 'tab'); }
    };
  }

  // Wikkelt cloud.putState: vóór verzenden een duurzame inflight-registratie, na een bevestiging of een definitieve
  // weigering (bijv. versieconflict) weer weg. Bij netwerkverlies blijft de registratie staan: uitkomst onzeker.
  function trackUploads(cloud, store, slot, classify) {
    return {
      ...cloud,
      async putState(householdId, section, payload, expected) {
        await store.beginUpload(slot, section, { expectedVersion: expected });
        try {
          const version = await cloud.putState(householdId, section, payload, expected);
          await store.endUpload(slot, section);
          return version;
        } catch (error) {
          const kind = typeof classify === 'function' ? classify(error).kind : 'other';
          if (kind !== 'network') { try { await store.endUpload(slot, section); } catch (_) {} }
          throw error;
        }
      }
    };
  }

  // Eén gedeelde instantie per pagina (app.js en account-sync.js gebruiken dezelfde database-verbinding).
  let sharedStore = null;
  function shared() {
    if (sharedStore) return sharedStore;
    let storage = null, idb = null;
    try { storage = globalThis.localStorage || null; } catch (_) { storage = null; }
    try { idb = globalThis.indexedDB || null; } catch (_) { idb = null; }
    sharedStore = createSyncMetaStore({ indexedDB: idb, storage, hashValue: globalThis.SamenThuisHouseholdSync.hashValue });
    return sharedStore;
  }

  return { createSyncMetaStore, trackUploads, shared, LEGACY_BASE_KEY, FALLBACK_KEY, DB_NAME, _backends: { memoryBackend, storageBackend, openIndexedDb } };
});
