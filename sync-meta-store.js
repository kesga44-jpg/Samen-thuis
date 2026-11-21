/* Duurzame synchronisatiemetadata (alleen op dit apparaat). De applicatiegegevens zelf blijven in samenThuisDataV2.
   Inhoud:
   - baseValues: per account+huishouden ("slot") en onderdeel de laatst door de server bevestigde waarde, de basis voor
     3-wegs samenvoegen. De vorige bevestigde waarde blijft ook bewaard (`prev`), zodat een crash tussen het opslaan van
     deze waarde en het bijwerken van de versie-administratie (localStorage) niet tot een verloren basis leidt.
   - inflight: verzonden maar (nog) niet bevestigde uploads. Na een crash of netwerkverlies blijft zichtbaar dat de uitkomst
     onzeker is; de volgende ronde stelt via versie + hash vast of de server de wijziging al had (dan geen tweede mutatie).
   - conflicts: conflictsamenvattingen per slot (sync) en tabbladconflicten (met de niet-gekozen waarde, om terug te halen).
   Opslag: IndexedDB (durable); valt terug op localStorage (limited) en daarna op geheugen (session, nooit als
   duurzaam gemeld; zie status()). Oude basiswaarden uit
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
  const sep = '\u0000';
  const keyOf = (...parts) => parts.map(String).join(sep);
  // Slot van tabbladconflicten per identiteit (opdracht 7). Zonder scope: het oude apparaatbrede slot 'local'.
  const tabSlot = scope => (scope ? 'tab|' + String(scope) : 'local');

  // ---------- Backends: getAll(store) → records, putMany(store, records), deleteMany(store, keys) ----------
  function memoryBackend() {
    const data = Object.fromEntries(STORES.map(s => [s, new Map()]));
    return {
      kind: 'memory',
      async getAll(store) { return [...data[store].values()].map(r => JSON.parse(JSON.stringify(r))); },
      async putMany(store, records) { records.forEach(r => data[store].set(r.key, JSON.parse(JSON.stringify(r)))); },
      async deleteMany(store, keys) { keys.forEach(k => data[store].delete(k)); },
      async putIfAbsent(store, records) { let n = 0; records.forEach(r => { if (!data[store].has(r.key)) { data[store].set(r.key, JSON.parse(JSON.stringify(r))); n++; } }); return n; },
      async update(store, key, fn) {
        const cur = data[store].has(key) ? JSON.parse(JSON.stringify(data[store].get(key))) : undefined;
        const next = fn(cur);
        if (next === undefined) return undefined;
        if (next === null) { data[store].delete(key); return null; }
        data[store].set(key, JSON.parse(JSON.stringify(next))); return JSON.parse(JSON.stringify(next));
      }
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
      },
      // Niet atomair tussen tabbladen (localStorage-terugval); binnen één tabblad wel zonder onderbreking.
      async update(store, key, fn) {
        if (memory) return memory.update(store, key, fn);
        const cur = (await backend.getAll(store)).find(r => r.key === key);
        const next = fn(cur === undefined ? undefined : JSON.parse(JSON.stringify(cur)));
        if (next === undefined) return undefined;
        if (next === null) { await backend.deleteMany(store, [key]); return null; }
        await backend.putMany(store, [next]); return next;
      },
      async putIfAbsent(store, records) {
        const existing = new Set((await backend.getAll(store)).map(r => r.key));
        const fresh = records.filter(r => !existing.has(r.key));
        if (fresh.length) await backend.putMany(store, fresh);
        return fresh.length;
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
      // Geblokkeerd (een ander tabblad houdt een oudere versie open): niet direct opgeven. Andere tabbladen sluiten hun
      // verbinding bij `versionchange`; lukt dat niet binnen de time-out, dan volgt de terugval.
      request.onblocked = () => {};
      request.onerror = () => done(reject, request.error || new Error('IndexedDB openen mislukt'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { try { db.close(); } catch (_) {} };
        if (settled) { try { db.close(); } catch (_) {} return; } // te laat (na time-out): verbinding niet laten lekken
        done(resolve, db);
      };
    }).then(db => {
      const tx = (store, mode, work) => new Promise((resolve, reject) => {
        let result;
        let t;
        // 'strict': `complete` pas na wegschrijven naar schijf (waar de browser dit ondersteunt).
        try { t = mode === 'readwrite' ? db.transaction(store, mode, { durability: 'strict' }) : db.transaction(store, mode); }
        catch (_) { t = db.transaction(store, mode); }
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
        // Lezen en schrijven in één transactie: twee tabbladen die tegelijk migreren overschrijven elkaar niet.
        putIfAbsent: (store, records) => tx(store, 'readwrite', os => new Promise((resolve, reject) => {
          let pending = records.length, added = 0;
          if (!pending) return resolve(0);
          records.forEach(r => {
            const req = os.get(r.key);
            req.onsuccess = () => { if (req.result === undefined) { os.put(r); added++; } if (--pending === 0) resolve(added); };
            req.onerror = () => reject(req.error);
          });
        })),
        // Lezen, beslissen en schrijven in één transactie: atomair tussen tabbladen (compare-and-set).
        update: (store, key, fn) => tx(store, 'readwrite', os => new Promise((resolve, reject) => {
          const req = os.get(key);
          req.onsuccess = () => {
            let next;
            try { next = fn(req.result === undefined ? undefined : req.result); } catch (error) { reject(error); return; }
            if (next === undefined) return resolve(undefined);
            if (next === null) { os.delete(key); return resolve(null); }
            os.put(next); resolve(next);
          };
          req.onerror = () => reject(req.error);
        })),
        close: () => { try { db.close(); } catch (_) {} }
      };
    });
  }

  // Duurzaamheid per opslagvorm. Alleen IndexedDB telt als duurzaam; geheugen geldt nooit als bevestigd bewaard.
  const DURABILITY = { indexeddb: 'durable', localStorage: 'limited', memory: 'session' };
  const MAX_TAB_CONFLICTS = 500;     // harde bovengrens; opgeloste conflicten worden eerst opgeruimd
  const KEEP_RESOLVED = 50;

  // ---------- Afscherming per identiteit (opdracht 7, vervolg) ----------
  // activeScope() → { tab: <dataset van de actieve identiteit> | null, slot: '<account>:<huishouden>' | null }.
  // Met afscherming geldt elke aanroep standaard voor de actieve identiteit; een parameter met een andere identiteit
  // levert niets op (lezen: leeg; schrijven: geweigerd). Tabbladconflicten zijn alleen via de tabblad-API bereikbaar.
  // Financiële records alleen voor de eigen identiteit, 'device' en 'legacy-unknown' (finance-conflict-core.js en
  // account-sync.js bepalen daarbinnen de zichtbaarheid). Er wordt niets verwijderd. Dit is lokale afscherming tegen
  // vergissingen, geen vervanging voor de serverbeveiliging: wie het browserprofiel kan openen, kan de opslag lezen.
  const FIN_SHARED_SCOPES = ['device', 'legacy-unknown'];
  function guardStore(store, activeScope) {
    const cur = () => { try { return activeScope() || {}; } catch (_) { return {}; } };
    const okSlot = slot => { const c = cur(); return !!c.slot && slot === c.slot; };
    const tabScope = scope => { const c = cur(); return c.tab && (scope == null || scope === c.tab) ? c.tab : null; };
    const denied = () => Object.assign(new Error('Deze synchronisatiegegevens horen bij een andere identiteit.'), { name: 'ScopeDenied' });
    const deny = () => Promise.reject(denied());
    const hidden = r => {
      if (!r) return false;
      const c = cur();
      if (r.kind === 'tab') return true;
      if (r.kind === 'sync') return !c.slot || r.slot !== c.slot;
      if (/^finance/.test(String(r.kind || '')) && r.scope) return !(FIN_SHARED_SCOPES.includes(r.scope) || (c.slot && r.scope === c.slot));
      return false;
    };
    return {
      ...store,
      guarded: true,
      loadBaseValues: (slot, bases) => (okSlot(slot) ? store.loadBaseValues(slot, bases) : Promise.resolve({})),
      saveBaseValues: (slot, values) => (okSlot(slot) ? store.saveBaseValues(slot, values) : deny()),
      beginUpload: (slot, section, info) => (okSlot(slot) ? store.beginUpload(slot, section, info) : deny()),
      endUpload: (slot, section) => (okSlot(slot) ? store.endUpload(slot, section) : deny()),
      listInflight: slot => (okSlot(slot) ? store.listInflight(slot) : Promise.resolve([])),
      clearInflight: (slot, sections) => (okSlot(slot) ? store.clearInflight(slot, sections) : deny()),
      saveConflicts: (slot, conflicts) => (okSlot(slot) ? store.saveConflicts(slot, conflicts) : deny()),
      loadConflicts: slot => (okSlot(slot) ? store.loadConflicts(slot) : Promise.resolve([])),
      recordTabConflict: (input = {}) => { const s = tabScope(input.scope); return s ? store.recordTabConflict({ ...input, scope: s }) : deny(); },
      listTabConflicts: (opts = {}) => { const s = tabScope(opts.scope); return s ? store.listTabConflicts({ ...opts, scope: s }) : Promise.resolve([]); },
      getTabConflict: (key, opts = {}) => { const s = tabScope(opts.scope); return s ? store.getTabConflict(key, { scope: s }) : Promise.resolve(null); },
      resolveTabConflict: (key, resolution, opts = {}) => { const s = tabScope(opts.scope); return s ? store.resolveTabConflict(key, resolution, { scope: s }) : Promise.resolve(false); },
      async getRecord(key) { const r = await store.getRecord(key); return hidden(r) ? null : r; },
      async listRecords(kind) { return (await store.listRecords(kind)).filter(r => !hidden(r)); },
      putRecord: record => (record && (record.kind === 'tab' || record.kind === 'sync') ? deny() : store.putRecord(record)),
      // Een bestaand record van een andere identiteit wordt nooit overschreven of als 'afwezig' behandeld.
      updateRecord: (key, fn) => store.updateRecord(key, value => (hidden(value) ? undefined : fn(value))),
      deleteRecord: (key, predicate) => store.deleteRecord(key, value => !!value && !hidden(value) && (!predicate || predicate(value)))
    };
  }

  function createSyncMetaStore({ indexedDB, storage, hashValue, now = () => new Date().toISOString(), timers, activeScope } = {}) {
    const store = createUnguardedStore({ indexedDB, storage, hashValue, now, timers });
    return typeof activeScope === 'function' ? guardStore(store, activeScope) : store;
  }
  function createUnguardedStore({ indexedDB, storage, hashValue, now = () => new Date().toISOString(), timers } = {}) {
    if (typeof hashValue !== 'function') throw new Error('createSyncMetaStore: hashValue is vereist');
    let backendPromise = null;
    let warning = '';
    let lastError = null;
    const fail = (step, error) => { lastError = { step, message: String(error && error.message || error), at: now() }; };

    async function migrateLegacy(backend) {
      if (!storage) return;
      let raw = null;
      try { raw = storage.getItem(LEGACY_BASE_KEY); } catch (_) { return; }
      if (!raw) return;
      let legacy;
      try { legacy = JSON.parse(raw); } catch (_) { return; } // onleesbaar: oude sleutel blijft onaangeroerd staan
      if (!legacy || typeof legacy !== 'object') return;
      const records = [];
      for (const [slot, values] of Object.entries(legacy)) {
        if (!values || typeof values !== 'object') continue;
        for (const [section, value] of Object.entries(values)) {
          records.push({ key: keyOf(slot, section), slot, section, hash: hashValue(value), value, prev: null, at: now() });
        }
      }
      // Nooit een nieuwere basis (bijv. door een ander tabblad intussen bewaard) overschrijven met de oude waarde.
      if (records.length) await backend.putIfAbsent('baseValues', records);
      // Alleen verwijderen als elke sleutel aantoonbaar aanwezig is (nieuw of al bestaand).
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
      try { await migrateLegacy(backend); } catch (error) { fail('migratie', error); /* oude sleutel blijft staan; geen verlies */ }
      return backend;
    }
    const backend = () => (backendPromise ||= init());
    const bySlot = async (store, slot) => (await (await backend()).getAll(store)).filter(r => r.slot === slot);
    // Schrijfacties: een fout wordt vastgelegd én doorgegeven (nooit stil als succes behandeld).
    async function write(step, fn) {
      try { return await fn(await backend()); }
      catch (error) { fail(step, error); throw error; }
    }
    async function status() {
      const mode = (await backend()).kind;
      return { mode, durability: DURABILITY[mode] || 'session', warning, lastError };
    }

    return {
      async mode() { return (await backend()).kind; },
      status,
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
      // Geeft { count, mode, durability } ná het schrijven (de localStorage-terugval kan tijdens het schrijven naar
      // geheugen overgaan; dat is dan zichtbaar in `durability`).
      async saveBaseValues(slot, values) {
        return write('basiswaarden', async b => {
          const current = new Map((await bySlot('baseValues', slot)).map(r => [r.section, r]));
          const records = [];
          for (const [section, value] of Object.entries(values || {})) {
            const hash = hashValue(value), old = current.get(section);
            if (old && old.hash === hash) continue;
            records.push({ key: keyOf(slot, section), slot, section, hash, value, prev: old ? { hash: old.hash, value: old.value } : null, at: now() });
          }
          if (records.length) await b.putMany('baseValues', records);
          return { count: records.length, mode: b.kind, durability: DURABILITY[b.kind] || 'session' };
        });
      },

      async beginUpload(slot, section, info = {}) {
        await write('inflight', b => b.putMany('inflight', [{ key: keyOf(slot, section), slot, section, expectedVersion: Number(info.expectedVersion) || 0, startedAt: now() }]));
      },
      async endUpload(slot, section) { await write('inflight', b => b.deleteMany('inflight', [keyOf(slot, section)])); },
      async listInflight(slot) { return bySlot('inflight', slot); },
      async clearInflight(slot, sections) {
        const keys = (await bySlot('inflight', slot)).filter(r => !sections || sections.includes(r.section)).map(r => r.key);
        if (keys.length) await write('inflight', b => b.deleteMany('inflight', keys));
      },

      // Conflictsamenvattingen van de laatste ronde (vervangt de vorige set voor dit slot).
      async saveConflicts(slot, conflicts) {
        await write('conflicten', async b => {
          const old = (await bySlot('conflicts', slot)).filter(r => r.kind === 'sync').map(r => r.key);
          if (old.length) await b.deleteMany('conflicts', old);
          const records = (conflicts || []).map(c => ({
            key: keyOf(slot, 'sync', c.section), slot, kind: 'sync', section: c.section,
            fields: Array.isArray(c.fields) ? c.fields.slice(0, 20) : [], remoteVersion: Number(c.remoteVersion) || 0, raced: !!c.raced, at: now()
          }));
          if (records.length) await b.putMany('conflicts', records);
        });
      },
      async loadConflicts(slot) {
        return (await bySlot('conflicts', slot)).filter(r => r.kind === 'sync')
          .map(r => ({ section: r.section, fields: r.fields, remoteVersion: r.remoteVersion, raced: r.raced, restored: true }));
      },

      // Tabbladconflict op één pad. Beide waarden blijven bewaard. Dezelfde botsing gemeld door twee tabbladen krijgt
      // dezelfde sleutel (pad + beide waarden), zodat er één record is met een teller in plaats van dubbele of verloren
      // historie. Openstaande conflicten worden nooit opgeruimd ten gunste van nieuwe, behalve bij de harde bovengrens.
      // Opdracht 7: scope = de dataset (identiteit) waarin het conflict ontstond. Elke scope heeft een eigen slot
      // ('tab|<scope>'); records van vóór opdracht 7 (slot 'local', zonder scope) blijven bewaard maar zijn met een
      // scope niet meer op te vragen. Zonder scope werkt de oude aanroep ongewijzigd (slot 'local').
      async recordTabConflict({ path, section, financial = false, kept, other, base, scope = null }) {
        const slot = tabSlot(scope);
        return write('tabbladconflict', async b => {
          const pair = [hashValue(kept === undefined ? null : kept), hashValue(other === undefined ? null : other)].sort();
          const key = keyOf(slot, 'tab', hashValue({ path: String(path), pair }));
          const all = (await b.getAll('conflicts')).filter(r => r.slot === slot && r.kind === 'tab');
          const existing = all.find(r => r.key === key);
          const at = now();
          const record = existing
            ? { ...existing, count: (existing.count || 1) + 1, lastAt: at }
            : { key, slot, scope: scope || null, kind: 'tab', path: String(path), section: section || String(path).split(/[.[]/)[0], financial: !!financial,
                kept: kept === undefined ? null : kept, other: other === undefined ? null : other, base: base === undefined ? null : base,
                at, lastAt: at, count: 1, resolved: null };
          await b.putMany('conflicts', [record]);
          const resolved = all.filter(r => r.resolved && r.key !== key).sort((x, y) => String(y.lastAt || y.at).localeCompare(String(x.lastAt || x.at)));
          const drop = resolved.slice(KEEP_RESOLVED).map(r => r.key);
          const remaining = all.length + (existing ? 0 : 1) - drop.length;
          if (remaining > MAX_TAB_CONFLICTS) {
            const open = all.filter(r => !r.resolved && r.key !== key).sort((x, y) => String(x.lastAt || x.at).localeCompare(String(y.lastAt || y.at)));
            drop.push(...open.slice(0, remaining - MAX_TAB_CONFLICTS).map(r => r.key));
          }
          if (drop.length) await b.deleteMany('conflicts', drop);
          return { key, duplicate: !!existing };
        });
      },
      // Algemene records in de conflicts-store (gebruikt door finance-conflict-core.js). updateRecord is atomair in IndexedDB.
      async getRecord(key) { return (await (await backend()).getAll('conflicts')).find(r => r.key === key) || null; },
      async listRecords(kind) { return (await (await backend()).getAll('conflicts')).filter(r => r.kind === kind); },
      async putRecord(record) { await write('record', b => b.putMany('conflicts', [record])); },
      async updateRecord(key, fn) { return write('record', b => b.update('conflicts', key, fn)); },
      async deleteRecord(key, predicate) {
        return write('record', b => b.update('conflicts', key, cur => (cur && (!predicate || predicate(cur))) ? null : undefined));
      },

      async listTabConflicts({ includeResolved = true, scope = null } = {}) {
        return (await bySlot('conflicts', tabSlot(scope))).filter(r => r.kind === 'tab' && (includeResolved || !r.resolved))
          .sort((x, y) => String(y.lastAt || y.at).localeCompare(String(x.lastAt || x.at)));
      },
      async getTabConflict(key, { scope = null } = {}) { return (await bySlot('conflicts', tabSlot(scope))).find(r => r.key === key && r.kind === 'tab') || null; },
      async resolveTabConflict(key, resolution, { scope = null } = {}) {
        const slot = tabSlot(scope);
        return write('tabbladconflict', async b => {
          const rec = (await b.getAll('conflicts')).find(r => r.key === key && r.slot === slot && r.kind === 'tab');
          if (!rec) return false;
          await b.putMany('conflicts', [{ ...rec, resolved: { resolution, at: now() } }]);
          return true;
        });
      }
    };
  }

  // Wikkelt cloud.putState: vóór verzenden een duurzame inflight-registratie, na een bevestiging of een definitieve
  // weigering (bijv. versieconflict) weer weg. Bij netwerkverlies blijft de registratie staan: uitkomst onzeker.
  // Lukt de registratie zelf niet, dan gaat de upload door (de server-versiecontrole blijft de beveiliging); de fout
  // staat dan in status().lastError en `onWarning` wordt aangeroepen.
  function trackUploads(cloud, store, slot, classify, onWarning = () => {}) {
    const note = step => error => { try { onWarning(step, error); } catch (_) {} };
    return {
      ...cloud,
      async putState(householdId, section, payload, expected) {
        try { await store.beginUpload(slot, section, { expectedVersion: expected }); } catch (error) { note('inflight-start')(error); }
        try {
          const version = await cloud.putState(householdId, section, payload, expected);
          try { await store.endUpload(slot, section); } catch (error) { note('inflight-einde')(error); }
          return version;
        } catch (error) {
          const kind = typeof classify === 'function' ? classify(error).kind : 'other';
          if (kind !== 'network') { try { await store.endUpload(slot, section); } catch (e) { note('inflight-einde')(e); } }
          throw error;
        }
      }
    };
  }

  // Legt na een ronde de metadata vast, in deze volgorde:
  //   1. basiswaarden (met vorige waarde)  → mislukt: STOP, versie-administratie blijft zoals vóór de ronde
  //   2. versie-administratie (writeBases)  → mislukt: STOP; stap 1 bewaarde de vorige waarde, dus de oude
  //      administratie vindt haar basis nog
  //   3. conflictsamenvattingen              → mislukt: waarschuwing (worden elke ronde opnieuw bepaald)
  //   4. inflight wissen (alleen bij 'ok')    → mislukt: waarschuwing (volgende geslaagde ronde wist alsnog)
  // Niet vastgelegde versies zijn herstelbaar: de volgende ronde ziet lokaal = cloud en neemt de versie over (adopt),
  // zonder tweede upload. writeBases(base, { durable }) schrijft de administratie; bij durability 'session' hoort die
  // alleen in het geheugen te staan, zodat na herladen nooit een versie als bevestigd geldt zonder duurzame basis.
  async function commitRound({ store, slot, base, baseValues, conflicts, roundOk, writeBases }) {
    const warnings = [];
    let saved;
    try { saved = await store.saveBaseValues(slot, baseValues); }
    catch (error) { return { committed: false, step: 'basiswaarden', error, warnings }; }
    try { await writeBases(base, { durable: saved.durability !== 'session', durability: saved.durability }); }
    catch (error) { return { committed: false, step: 'versie-administratie', error, warnings, durability: saved.durability }; }
    try { await store.saveConflicts(slot, conflicts); } catch (error) { warnings.push({ step: 'conflicten', error }); }
    if (roundOk) { try { await store.clearInflight(slot); } catch (error) { warnings.push({ step: 'inflight', error }); } }
    return { committed: true, durability: saved.durability, warnings };
  }

  // Eén gedeelde instantie per pagina (app.js en account-sync.js gebruiken dezelfde database-verbinding).
  let sharedStore = null;
  function shared() {
    if (sharedStore) return sharedStore;
    let storage = null, idb = null;
    try { storage = globalThis.localStorage || null; } catch (_) { storage = null; }
    try { idb = globalThis.indexedDB || null; } catch (_) { idb = null; }
    // In de app altijd afgeschermd op de identiteit van deze paginalading (app.js SamenThuisIdentity). Ontbreekt die of
    // wordt er gewisseld, dan geen toegang tot identiteitsgebonden gegevens.
    const activeScope = () => {
      const I = globalThis.SamenThuisIdentity;
      if (!I || typeof I.current !== 'function' || (typeof I.switching === 'function' && I.switching())) return null;
      const id = I.current() || {};
      return { tab: id.key || null, slot: id.mode === 'account' && id.accountId && id.householdId ? `${id.accountId}:${id.householdId}` : null };
    };
    sharedStore = createSyncMetaStore({ indexedDB: idb, storage, hashValue: globalThis.SamenThuisHouseholdSync.hashValue, activeScope });
    return sharedStore;
  }

  return { createSyncMetaStore, trackUploads, commitRound, shared, DURABILITY, LEGACY_BASE_KEY, FALLBACK_KEY, DB_NAME, _backends: { memoryBackend, storageBackend, openIndexedDb } };
});
