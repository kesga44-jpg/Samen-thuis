// Gedeelde nabootsingen voor synctests: localStorage, IndexedDB (subset) en een geheugen-Supabase met versiecontrole.
// Geen testbestand (wordt niet door `node --test *.test.js` opgepikt).
const HS = require('../household-sync-core.js');

function memoryStorage(shared = new Map(), { quotaAt = Infinity } = {}) {
  return {
    map: shared,
    getItem: k => (shared.has(k) ? shared.get(k) : null),
    setItem: (k, v) => { if (String(v).length > quotaAt) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } shared.set(k, String(v)); },
    removeItem: k => { shared.delete(k); }
  };
}

// Minimale IndexedDB: open/onupgradeneeded/onblocked, transacties met get/getAll/put/delete; schrijfacties worden pas
// bij `complete` zichtbaar (zoals echte transacties). Dezelfde instantie hergebruiken = browser opnieuw openen.
// Opties: failOpen, blockedMs (eerst onblocked, daarna success), quotaOnWrite (schrijftransacties breken af).
function fakeIndexedDB({ failOpen = false, blockedMs = 0, openDelayMs = 0 } = {}) {
  const dbs = new Map();
  const later = (fn, ms = 0) => setTimeout(fn, ms);
  const copy = v => JSON.parse(JSON.stringify(v));
  const api = {
    dbs, txOptions: [], quotaOnWrite: false, closed: 0,
    open(name, version) {
      const req = {};
      const go = () => {
        if (failOpen) { req.error = new Error('InvalidStateError'); req.onerror && req.onerror(); return; }
        let db = dbs.get(name), upgrade = false;
        if (!db) { db = { version, stores: new Map() }; dbs.set(name, db); upgrade = true; }
        const conn = {
          objectStoreNames: { contains: n => db.stores.has(n) },
          createObjectStore: n => { db.stores.set(n, new Map()); },
          close() { api.closed++; },
          transaction(storeName, mode, options) {
            api.txOptions.push({ mode, options });
            const t = {}, ops = [];
            let aborted = false, outstanding = 0;
            const data = db.stores.get(storeName);
            const finish = () => later(() => {
              if (aborted) return;
              if (outstanding) return finish();
              if (mode === 'readwrite' && api.quotaOnWrite && ops.length) {
                aborted = true; t.error = Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
                return t.onabort && t.onabort();
              }
              ops.forEach(op => op());
              t.oncomplete && t.oncomplete();
            });
            t.abort = () => { aborted = true; t.onabort && t.onabort(); };
            const request = fn => { const r = {}; outstanding++; later(() => { outstanding--; r.result = fn(); r.onsuccess && r.onsuccess(); }); return r; };
            t.objectStore = () => ({
              getAll: () => request(() => [...data.values()].map(copy)),
              get: key => request(() => (data.has(key) ? copy(data.get(key)) : undefined)),
              put(rec) { const c = copy(rec); ops.push(() => data.set(c.key, c)); },
              delete(key) { ops.push(() => data.delete(key)); }
            });
            finish();
            return t;
          }
        };
        req.result = conn;
        if (upgrade && req.onupgradeneeded) req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      };
      later(() => {
        if (blockedMs) { req.onblocked && req.onblocked(); later(go, blockedMs); }
        else later(go, openDelayMs);
      });
      return req;
    }
  };
  return api;
}

function fakeCloud() {
  const rows = new Map();
  let failNextPut = null;
  return {
    rows,
    failNextPut(kind) { failNextPut = kind; },
    async readState() { return [...rows].map(([section, r]) => ({ section, payload: JSON.parse(JSON.stringify(r.payload)), version: r.version })); },
    async putState(_h, section, payload, expected) {
      const cur = rows.get(section), v = cur ? cur.version : 0;
      if (failNextPut === 'before-commit') { failNextPut = null; throw new TypeError('Failed to fetch'); }
      if (v !== expected) throw new HS.CloudError(409, { code: '40001', message: 'Versieconflict' });
      rows.set(section, { payload: JSON.parse(JSON.stringify(payload)), version: v + 1 });
      if (failNextPut === 'after-commit') { failNextPut = null; throw new TypeError('Failed to fetch'); }
      return v + 1;
    }
  };
}


// Cloud per gebruiker: dezelfde tabel, maar updated_by = deze gebruiker (zoals Supabase via auth.uid()).
function cloudAs(cloud, userId) {
  return {
    async readState(h) { return (await cloud.readState(h)).map(r => ({ ...r, updated_by: cloud.rows.get(r.section).updatedBy || null, updated_at: cloud.rows.get(r.section).updatedAt || null })); },
    async putState(h, section, payload, expected) {
      const before = cloud.rows.get(section) ? cloud.rows.get(section).version : 0;
      try { return await cloud.putState(h, section, payload, expected); }
      finally { const row = cloud.rows.get(section); if (row && row.version !== before) { row.updatedBy = userId; row.updatedAt = new Date().toISOString(); } }
    }
  };
}

module.exports = { memoryStorage, fakeIndexedDB, fakeCloud, cloudAs };
