// Opdracht 2: tabbladen, wijzigingen tijdens een lopende ronde en duurzame syncmetadata (IndexedDB).
// Alles met nagebootste opslag/cloud; geen netwerk, geen Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const HS = require('./household-sync-core.js');
const TS = require('./tab-sync-core.js');
const SM = require('./sync-meta-store.js');

// ---------- Hulpmiddelen ----------
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

// Nabootsing van één apparaat met dezelfde stappen als account-sync.js (momentopname → ronde → uitgestelde pulls →
// toepassen → commitRound: basiswaarden → versie-administratie → conflicten → inflight).
function device(cloud, meta, slot = 'user-a:hh-1', { writeBases } = {}) {
  const dev = { data: {}, bases: {}, sessionBases: null, meta, slot, warnings: [] };
  dev.readBases = () => dev.sessionBases || dev.bases;
  dev.sync = async ({ duringRound, resolutions = {} } = {}) => {
    const prevBase = dev.readBases();
    const prevBaseValues = await meta.loadBaseValues(slot, prevBase);
    const snapshot = structuredClone(dev.data);
    const tracked = SM.trackUploads(cloud, meta, slot, HS.classifyError, step => dev.warnings.push(step));
    const wrapped = duringRound ? { ...tracked, async readState(h) { const r = await tracked.readState(h); duringRound(dev); return r; } } : tracked;
    const raw = await HS.runAccountSync({ cloud: wrapped, householdId: 'hh-1', local: snapshot, base: prevBase, baseValues: prevBaseValues, resolutions, encrypt: async v => v, decrypt: async p => p });
    const result = HS.deferChangedPulls({ snapshot, current: dev.data, result: raw, prevBase, prevBaseValues });
    dev.data = { ...dev.data, ...result.pulls };
    const commit = await SM.commitRound({
      store: meta, slot, base: result.base, baseValues: result.baseValues, conflicts: result.conflicts, roundOk: result.status === 'ok',
      writeBases: async (b, opts) => {
        if (writeBases) await writeBases(b, opts);
        if (opts.durable) { dev.bases = b; dev.sessionBases = null; } else dev.sessionBases = b;
      }
    });
    if (!commit.committed) return { ...result, status: 'partial', commit };
    commit.warnings.forEach(w => dev.warnings.push(w.step));
    return { ...result, commit };
  };
  return dev;
}
const g = (id, title, extra = {}) => ({ id, title, done: false, ...extra });
const newMeta = (idb = fakeIndexedDB(), storage = memoryStorage()) => SM.createSyncMetaStore({ indexedDB: idb, storage, hashValue: HS.hashValue });

// ---------- 1. Twee tabbladen ----------
const writeTab = (storage, tab, value) => { const text = tab.serialize(value); storage.setItem('k', text); tab.commit(text); return text; };
const ids = v => v.groceries.map(x => x.id).sort();

test('1. twee tabbladen met gelijktijdige wijzigingen: beide blijven, geen stille overschrijving', () => {
  const storage = memoryStorage();
  storage.setItem('k', JSON.stringify({ meta: {}, groceries: [g('a', 'Melk')] }));
  const tabA = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  const tabB = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  let dataA = JSON.parse(storage.getItem('k')), dataB = JSON.parse(storage.getItem('k'));
  dataA.groceries.push(g('x', 'Brood'));
  let w = tabA.prepareWrite(dataA); assert.equal(w.external, false);
  const textA = writeTab(storage, tabA, w.value);
  // Tab B heeft het storage-event (nog) niet verwerkt en slaat een eigen wijziging op.
  dataB.groceries.push(g('y', 'Kaas'));
  w = tabB.prepareWrite(dataB);
  assert.equal(w.external, true);
  assert.deepEqual(ids(w.value), ['a', 'x', 'y']);
  const textB = writeTab(storage, tabB, w.value);
  // Tab A verwerkt de events: krijgt Kaas erbij zonder eigen data te verliezen; niets terug te schrijven.
  const absorbed = tabA.absorb(textB, dataA);
  assert.deepEqual(ids(absorbed.value), ['a', 'x', 'y']);
  assert.equal(absorbed.needsWrite, false);
  assert.equal(tabA.prepareWrite(absorbed.value).external, false, 'na overnemen is de opgeslagen tekst weer bekend');
  assert.ok(textA !== textB);
});

test('1a. vertraagde localStorage tussen tabbladen: tabblad dat schreef zonder de ander te zien wordt hersteld', () => {
  // Chromium: B leest nog de oude waarde en overschrijft A's toevoeging. A merkt dat via het storage-event.
  const storage = memoryStorage();
  storage.setItem('k', JSON.stringify({ meta: {}, groceries: [g('a', 'Melk')] }));
  const tabA = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  const tabB = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  const dataA = JSON.parse(storage.getItem('k')), dataB = JSON.parse(storage.getItem('k'));
  dataA.groceries.push(g('kaas', 'Kaas'));
  const textA = writeTab(storage, tabA, tabA.prepareWrite(dataA).value);
  dataB.groceries.push(g('ei', 'Eieren'));
  // B ziet de oude tekst (vertraging): schrijft zonder samenvoegen.
  const staleGuardWrite = tabB.serialize(dataB); storage.setItem('k', staleGuardWrite); tabB.commit(staleGuardWrite);
  // A krijgt het event van B: B bouwde voort op de oude versie, A's Kaas ontbreekt → samenvoegen en terugschrijven.
  const atA = tabA.absorb(staleGuardWrite, dataA);
  assert.deepEqual(ids(atA.value), ['a', 'ei', 'kaas']);
  assert.equal(atA.needsWrite, true);
  const merged = writeTab(storage, tabA, atA.value);
  // B krijgt (laat) het event van A's eerste schrijfactie en daarna van het samengevoegde resultaat.
  const late = tabB.absorb(textA, dataB);
  assert.deepEqual(ids(late.value), ['a', 'ei', 'kaas'], 'late oude melding verwijdert niets');
  const final = tabB.absorb(merged, late.value);
  assert.deepEqual(ids(final.value), ['a', 'ei', 'kaas']);
  assert.equal(final.needsWrite, false, 'convergeert zonder heen-en-weer schrijven');
  assert.deepEqual(ids(JSON.parse(storage.getItem('k'))), ['a', 'ei', 'kaas']);
});

test('1b. storage-event zonder lokale wijziging neemt de andere versie volledig over (incl. verwijderingen)', () => {
  const storage = memoryStorage();
  storage.setItem('k', JSON.stringify({ meta: {}, groceries: [g('a', 'Melk'), g('b', 'Brood')] }));
  const tab = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  const other = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  const mine = JSON.parse(storage.getItem('k'));
  const text = writeTab(storage, other, { meta: {}, groceries: [g('a', 'Melk', { done: true })] });
  const r = tab.absorb(text, mine);
  assert.deepEqual(r.value.groceries, [g('a', 'Melk', { done: true })]);
  assert.equal(r.needsWrite, false);
  assert.deepEqual(r.conflicts, [], 'meta (updatedAt, herkomst) geeft geen conflict');
  assert.equal(tab.known(), text);
});

test('1c. onleesbare gegevens van een ander tabblad worden niet samengevoegd en niet als basis overgenomen', () => {
  const storage = memoryStorage();
  storage.setItem('k', JSON.stringify({ a: 1 }));
  const tab = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  const r = tab.absorb('{kapot', { a: 2 });
  assert.equal(r.unreadable, true); assert.deepEqual(r.value, { a: 2 });
  assert.equal(tab.known(), JSON.stringify({ a: 1 }));
});

// ---------- 2. Lokale wijziging tijdens een lopende ronde ----------
test('2. lokale wijziging tijdens een ronde: oudere cloudrespons overschrijft hem niet; volgende ronde voegt samen', async () => {
  const cloud = fakeCloud();
  const meta = newMeta();
  const kees = device(cloud, meta, 'kees:hh-1'), daphne = device(cloud, newMeta(), 'daphne:hh-1');
  kees.data = { groceries: [g('a', 'Melk')] };
  assert.equal((await kees.sync()).status, 'ok');
  assert.equal((await daphne.sync()).status, 'ok');
  daphne.data.groceries.push(g('d', 'Kaas'));
  await daphne.sync();
  // Kees' ronde haalt Kaas op, terwijl Kees tijdens de ronde Brood toevoegt.
  const r = await kees.sync({ duringRound: dev => dev.data.groceries.push(g('k', 'Brood')) });
  assert.deepEqual(r.deferred, ['groceries']);
  assert.deepEqual(kees.data.groceries.map(x => x.id).sort(), ['a', 'k'], 'Brood staat er nog; Kaas komt in de volgende ronde');
  const r2 = await kees.sync();
  assert.equal(r2.status, 'ok');
  assert.deepEqual(kees.data.groceries.map(x => x.id).sort(), ['a', 'd', 'k']);
  await daphne.sync();
  assert.deepEqual(daphne.data.groceries.map(x => x.id).sort(), ['a', 'd', 'k']);
});

test('2b. deferChangedPulls: ongewijzigde onderdelen worden wel toegepast; basis van uitgestelde blijft de oude', () => {
  const snapshot = { groceries: [g('a', 'Melk')], meals: [] };
  const current = { groceries: [g('a', 'Melk'), g('k', 'Brood')], meals: [] };
  const result = { status: 'ok', pulls: { groceries: [g('a', 'Melk'), g('d', 'Kaas')], meals: [{ id: 'm', title: 'Soep' }] },
    base: { groceries: { version: 3, hash: 'nieuw' }, meals: { version: 2, hash: 'm2' } }, baseValues: { groceries: ['nieuw'], meals: ['m2'] } };
  const out = HS.deferChangedPulls({ snapshot, current, result, prevBase: { groceries: { version: 2, hash: 'oud' } }, prevBaseValues: { groceries: ['oud'] } });
  assert.deepEqual(Object.keys(out.pulls), ['meals']);
  assert.deepEqual(out.base.groceries, { version: 2, hash: 'oud' });
  assert.deepEqual(out.baseValues.groceries, ['oud']);
  assert.deepEqual(out.deferred, ['groceries']);
});

// ---------- 3. Netwerkverlies tijdens upload ----------
test('3. netwerkverlies ná commit: inflight blijft duurzaam; volgende ronde adopteert zonder tweede mutatie', async () => {
  const cloud = fakeCloud();
  const meta = newMeta();
  const kees = device(cloud, meta);
  kees.data = { groceries: [g('a', 'Melk')] };
  cloud.failNextPut('after-commit');
  const r = await kees.sync();
  assert.equal(r.status, 'partial');
  assert.equal(cloud.rows.get('groceries').version, 1, 'server heeft de wijziging wel');
  assert.equal(kees.bases.groceries, undefined, 'niet als gesynchroniseerd beschouwd zonder bevestiging');
  assert.deepEqual((await meta.listInflight(kees.slot)).map(x => x.section), ['groceries']);
  const r2 = await kees.sync();
  assert.equal(r2.status, 'ok');
  assert.deepEqual(r2.pushed, [], 'geen tweede upload');
  assert.equal(cloud.rows.get('groceries').version, 1, 'versie niet opnieuw opgehoogd');
  assert.equal(kees.bases.groceries.version, 1);
  assert.deepEqual(await meta.listInflight(kees.slot), []);
});

// ---------- 4. Browser opnieuw openen ----------
test('4. browser opnieuw openen met pending wijzigingen: basis en inflight overleven; wijziging gaat alsnog mee', async () => {
  const idb = fakeIndexedDB(), storage = memoryStorage(), cloud = fakeCloud();
  const meta1 = newMeta(idb, storage);
  const kees = device(cloud, meta1);
  kees.data = { groceries: [g('a', 'Melk')] };
  await kees.sync();
  kees.data.groceries.push(g('b', 'Brood'));
  cloud.failNextPut('before-commit');
  assert.equal((await kees.sync()).status, 'partial');
  // "Crash": nieuwe metastore op dezelfde IndexedDB, zelfde lokale gegevens en versie-administratie.
  const meta2 = newMeta(idb, storage);
  assert.equal(await meta2.mode(), 'indexeddb');
  assert.deepEqual((await meta2.listInflight(kees.slot)).map(x => x.section), ['groceries'], 'onzekere upload blijft zichtbaar');
  const base = await meta2.loadBaseValues(kees.slot, kees.bases);
  assert.deepEqual(base.groceries, [g('a', 'Melk')], 'basis voor samenvoegen is bewaard');
  const reopened = device(cloud, meta2);
  reopened.data = kees.data; reopened.bases = kees.bases;
  assert.equal((await reopened.sync()).status, 'ok');
  assert.deepEqual(cloud.rows.get('groceries').payload.map(x => x.id), ['a', 'b']);
  assert.deepEqual(await meta2.listInflight(kees.slot), []);
});

test('4b. crash tussen basiswaarde opslaan en versie-administratie bijwerken: vorige basis blijft vindbaar', async () => {
  const meta = newMeta();
  await meta.saveBaseValues('s', { groceries: ['v1'] });
  const oldBases = { groceries: { version: 1, hash: HS.hashValue(['v1']) } };
  await meta.saveBaseValues('s', { groceries: ['v2'] }); // daarna "crash": versie-administratie niet bijgewerkt
  assert.deepEqual((await meta.loadBaseValues('s', oldBases)).groceries, ['v1']);
  assert.deepEqual((await meta.loadBaseValues('s', { groceries: { version: 2, hash: HS.hashValue(['v2']) } })).groceries, ['v2']);
});

// ---------- 5. Herstel na mislukte synchronisatie ----------
test('5. herstel na mislukte ronde (netwerk vóór commit): niets bevestigd, volgende ronde verstuurt alsnog', async () => {
  const cloud = fakeCloud(), meta = newMeta();
  const kees = device(cloud, meta);
  kees.data = { tasks: [g('t', 'Belasting')] };
  cloud.failNextPut('before-commit');
  const r = await kees.sync();
  assert.equal(r.status, 'partial'); assert.equal(cloud.rows.size, 0);
  assert.deepEqual(kees.data.tasks, [g('t', 'Belasting')], 'lokale gegevens onaangetast');
  const r2 = await kees.sync();
  assert.equal(r2.status, 'ok'); assert.deepEqual(r2.pushed, ['tasks']);
  assert.equal(cloud.rows.get('tasks').version, 1);
});

// ---------- 6 en 7. Verschillende en dezelfde velden ----------
test('6. twee wijzigingen aan verschillende velden (twee apparaten) worden automatisch samengevoegd', async () => {
  const cloud = fakeCloud();
  const kees = device(cloud, newMeta(), 'kees:hh'), daphne = device(cloud, newMeta(), 'daphne:hh');
  kees.data = { groceries: [g('a', 'Melk')] };
  await kees.sync(); await daphne.sync();
  kees.data.groceries[0].done = true;
  daphne.data.groceries[0].title = 'Havermelk';
  await kees.sync();
  const r = await daphne.sync();
  assert.equal(r.status, 'ok'); assert.deepEqual(r.merged, ['groceries']);
  await kees.sync();
  assert.deepEqual(kees.data.groceries[0], g('a', 'Havermelk', { done: true }));
  assert.deepEqual(daphne.data.groceries[0], g('a', 'Havermelk', { done: true }));
});

test('7. twee wijzigingen aan hetzelfde veld: conflict gemeld, niets overschreven, metadata duurzaam', async () => {
  const cloud = fakeCloud(), metaD = newMeta();
  const kees = device(cloud, newMeta(), 'kees:hh'), daphne = device(cloud, metaD, 'daphne:hh');
  kees.data = { budgetV23: { incomes: { Kees: 3000 } } };
  await kees.sync(); await daphne.sync();
  kees.data.budgetV23.incomes.Kees = 3100;
  daphne.data.budgetV23.incomes.Kees = 3200;
  await kees.sync();
  const r = await daphne.sync();
  assert.equal(r.status, 'conflict');
  assert.deepEqual(r.conflicts[0].fields, ['incomes.Kees']);
  assert.equal(daphne.data.budgetV23.incomes.Kees, 3200, 'lokale waarde niet stil overschreven');
  assert.equal(cloud.rows.get('budgetV23').payload.incomes.Kees, 3100, 'cloudwaarde niet stil overschreven');
  await metaD.saveConflicts(daphne.slot, r.conflicts);
  assert.deepEqual((await metaD.loadConflicts(daphne.slot)).map(c => c.fields), [['incomes.Kees']]);
});

test('7b. hetzelfde veld in twee tabbladen: waarde van het schrijvende tabblad blijft, conflict wordt gemeld', () => {
  const storage = memoryStorage();
  storage.setItem('k', JSON.stringify({ meta: {}, budgetV23: { pct: 50 } }));
  const tabA = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  const tabB = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  writeTab(storage, tabA, { meta: {}, budgetV23: { pct: 60 } });
  const w = tabB.prepareWrite({ meta: {}, budgetV23: { pct: 40 } });
  assert.deepEqual(w.conflicts, ['budgetV23.pct']);
  assert.equal(w.value.budgetV23.pct, 40);
  assert.equal(w.remote.budgetV23.pct, 60, 'de andere waarde komt mee voor het conflictlogboek');
});

// ---------- 8. Meerdere synchronisatieverzoeken tegelijk ----------
test('8. meerdere verzoeken tegelijk: lease-lock laat er één door (ook over tabbladen heen)', async () => {
  const storage = memoryStorage();
  const timers = { setInterval: () => 0, clearInterval: () => {} };
  const tab1 = TS.createSyncLock({ storage, tabId: 't1', timers }), tab2 = TS.createSyncLock({ storage, tabId: 't2', timers });
  let release; const gate = new Promise(r => { release = r; });
  let runs = 0;
  const first = tab1.run(async () => { runs++; await gate; return 'klaar'; });
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(await tab1.run(async () => { runs++; }), { acquired: false }, 'zelfde tabblad: geen tweede ronde');
  assert.deepEqual(await tab2.run(async () => { runs++; }), { acquired: false }, 'ander tabblad: geen tweede ronde');
  release();
  assert.deepEqual(await first, { acquired: true, value: 'klaar' });
  assert.equal(runs, 1);
  assert.equal(storage.getItem('samenThuisSyncLeaseV1'), null, 'lease opgeruimd');
  assert.equal((await tab2.run(async () => 'nu wel')).value, 'nu wel');
});

test('8b. verlopen lease van een gecrasht tabblad blokkeert niet; fout in de ronde ruimt de lease op', async () => {
  let t = 1000;
  const storage = memoryStorage();
  const timers = { setInterval: () => 0, clearInterval: () => {} };
  storage.setItem('samenThuisSyncLeaseV1', JSON.stringify({ owner: 'dood', expires: 500 }));
  const lock = TS.createSyncLock({ storage, tabId: 't1', now: () => t, timers });
  await assert.rejects(lock.run(async () => { throw new Error('mislukt'); }), /mislukt/);
  assert.equal(storage.getItem('samenThuisSyncLeaseV1'), null);
  assert.equal((await lock.run(async () => 1)).acquired, true);
});

test('8c. Web Locks: ifAvailable wordt gebruikt; bezet → niet uitgevoerd; fout wordt doorgegeven', async () => {
  const heldNames = new Set();
  const locks = { async request(name, opts, cb) {
    assert.equal(opts.ifAvailable, true);
    if (heldNames.has(name)) return cb(null);
    heldNames.add(name);
    try { return await cb({ name }); } finally { heldNames.delete(name); }
  } };
  const a = TS.createSyncLock({ locks, tabId: 'a' }), b = TS.createSyncLock({ locks, tabId: 'b' });
  let release; const gate = new Promise(r => { release = r; });
  const first = a.run(() => gate.then(() => 'a'));
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(await b.run(async () => 'b'), { acquired: false });
  release();
  assert.equal((await first).value, 'a');
  await assert.rejects(b.run(async () => { throw new Error('ronde faalt'); }), /ronde faalt/);
  assert.equal(a.kind, 'web-locks');
});

test('8d. kanaal: berichten van het eigen tabblad worden genegeerd; zonder BroadcastChannel een no-op', () => {
  const bus = new Set();
  class FakeBC { constructor() { bus.add(this); } postMessage(m) { bus.forEach(c => c !== this && c.onmessage && c.onmessage({ data: m })); } close() { bus.delete(this); } }
  const a = TS.createChannel({ BroadcastChannelImpl: FakeBC, tabId: 'a' }), b = TS.createChannel({ BroadcastChannelImpl: FakeBC, tabId: 'b' });
  const got = []; b.on(m => got.push(m.type)); a.on(() => got.push('eigen'));
  a.post('sync-finished');
  assert.deepEqual(got, ['sync-finished']);
  a.close(); b.close(); assert.equal(bus.size, 0);
  const none = TS.createChannel({ BroadcastChannelImpl: null });
  assert.equal(none.available, false); none.post('x'); none.close();
});

// ---------- 9. IndexedDB niet beschikbaar ----------
test('9. IndexedDB ontbreekt of opent niet: terugval op localStorage, daarna geheugen bij volle opslag', async () => {
  const storage = memoryStorage();
  const noIdb = SM.createSyncMetaStore({ indexedDB: undefined, storage, hashValue: HS.hashValue });
  assert.equal(await noIdb.mode(), 'localStorage');
  await noIdb.saveBaseValues('s', { groceries: [1] });
  assert.deepEqual(await noIdb.loadBaseValues('s'), { groceries: [1] });
  assert.ok(noIdb.warning());

  const broken = SM.createSyncMetaStore({ indexedDB: fakeIndexedDB({ failOpen: true }), storage: memoryStorage(), hashValue: HS.hashValue });
  assert.equal(await broken.mode(), 'localStorage');

  const full = SM.createSyncMetaStore({ indexedDB: undefined, storage: memoryStorage(new Map(), { quotaAt: 10 }), hashValue: HS.hashValue });
  await full.saveBaseValues('s', { groceries: ['een lange waarde die niet past'] });
  assert.equal(await full.mode(), 'memory');
  assert.deepEqual(await full.loadBaseValues('s'), { groceries: ['een lange waarde die niet past'] }, 'blijft bruikbaar in deze sessie');

  const nothing = SM.createSyncMetaStore({ hashValue: HS.hashValue });
  assert.equal(await nothing.mode(), 'memory');
});

test('9b. IndexedDB die nooit antwoordt: time-out en terugval', async () => {
  const hanging = { open() { return {}; } };
  const timers = { setTimeout: (fn) => setTimeout(fn, 5), clearTimeout: id => clearTimeout(id) };
  const meta = SM.createSyncMetaStore({ indexedDB: hanging, storage: memoryStorage(), hashValue: HS.hashValue, timers });
  assert.equal(await meta.mode(), 'localStorage');
});

// ---------- 10. Bestaande lokale gegevens blijven behouden ----------
test('10. migratie: oude basiswaarden uit localStorage gaan naar IndexedDB; applicatiegegevens blijven onaangeroerd', async () => {
  const storage = memoryStorage();
  const appData = JSON.stringify({ groceries: [g('a', 'Melk')], sportCoach: { x: 1 } });
  storage.setItem('samenThuisDataV2', appData);
  storage.setItem(SM.LEGACY_BASE_KEY, JSON.stringify({ 'kees:hh': { groceries: [g('a', 'Melk')], meals: [] } }));
  const idb = fakeIndexedDB();
  const meta = newMeta(idb, storage);
  assert.equal(await meta.mode(), 'indexeddb');
  assert.deepEqual(await meta.loadBaseValues('kees:hh'), { groceries: [g('a', 'Melk')], meals: [] });
  assert.equal(storage.getItem(SM.LEGACY_BASE_KEY), null, 'oude sleutel pas na bevestigde overname verwijderd');
  assert.equal(storage.getItem('samenThuisDataV2'), appData, 'applicatiegegevens ongewijzigd');
  // Opnieuw openen: geen dubbele of overschreven records.
  const again = newMeta(idb, storage);
  assert.deepEqual(await again.loadBaseValues('kees:hh'), { groceries: [g('a', 'Melk')], meals: [] });
});

test('10b. onleesbare oude basissleutel blijft staan; bestaande IndexedDB-basis wordt niet door oude waarde overschreven', async () => {
  const storage = memoryStorage();
  storage.setItem(SM.LEGACY_BASE_KEY, '{kapot');
  const meta = newMeta(fakeIndexedDB(), storage);
  assert.equal(await meta.mode(), 'indexeddb');
  assert.equal(storage.getItem(SM.LEGACY_BASE_KEY), '{kapot');

  const idb = fakeIndexedDB(), s2 = memoryStorage();
  const first = newMeta(idb, s2);
  await first.saveBaseValues('slot', { groceries: ['nieuw'] });
  s2.setItem(SM.LEGACY_BASE_KEY, JSON.stringify({ slot: { groceries: ['oud'], meals: ['m'] } }));
  const second = newMeta(idb, s2);
  assert.deepEqual(await second.loadBaseValues('slot'), { groceries: ['nieuw'], meals: ['m'] });
});

test('10c. bronbestanden: app.js schrijft samenThuisDataV2 alleen via de bewaakte functie; scripts in juiste volgorde', () => {
  const fs = require('node:fs');
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  assert.equal((app.match(/localStorage\.setItem\(STORAGE_KEY/g) || []).length, 1, 'één schrijfplek');
  assert.match(app, /function writeDataToStorage\(\)[\s\S]{0,200}dataGuard\.prepareWrite/);
  assert.match(app, /addEventListener\('storage'/);
  const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const pos = f => html.indexOf(`<script src="${f}`);
  assert.ok(pos('household-sync-core.js') < pos('tab-sync-core.js') && pos('tab-sync-core.js') < pos('sync-meta-store.js') && pos('sync-meta-store.js') < pos('app.js'));
  const acct = fs.readFileSync(__dirname + '/account-sync.js', 'utf8');
  assert.match(acct, /appliedHash/, 'basis voor toegepaste cloudwaarden wordt vóór het opslaan vastgelegd');
  assert.match(acct, /LOCK\.run\(/); assert.match(acct, /deferChangedPulls/); assert.match(acct, /trackUploads/);
  assert.doesNotMatch(acct, /localStorage\.setItem\(BASE_VALUES_KEY/, 'basiswaarden niet meer in localStorage');
});

// =====================================================================================================================
// Opdracht 3 — regressietests voor de review-bevindingen
// =====================================================================================================================

// Metastore met foutinjectie per methode (nagebootste opslag).
function failingMeta(failOn = {}) {
  const meta = newMeta();
  const wrap = name => async (...args) => { if (failOn[name] && failOn[name]-- > 0) throw new Error('injectie: ' + name); return meta[name](...args); };
  return { ...meta, ...Object.fromEntries(['saveBaseValues', 'saveConflicts', 'clearInflight', 'beginUpload', 'endUpload'].map(n => [n, wrap(n)])) };
}
async function twoRoundsAfterFailure(failOn, { writeBasesFails = 0 } = {}) {
  const cloud = fakeCloud(), meta = failingMeta(failOn);
  let wbFail = writeBasesFails;
  const kees = device(cloud, meta, 'kees:hh', { writeBases: async () => { if (wbFail-- > 0) throw new Error('injectie: writeBases'); } });
  kees.data = { groceries: [g('a', 'Melk')] };
  const r1 = await kees.sync();
  const r2 = await kees.sync();
  return { cloud, meta, kees, r1, r2 };
}

test('R1a. basiswaarde opslaan mislukt: geen versie als bevestigd; volgende ronde neemt over zonder tweede upload', async () => {
  const { cloud, kees, r1, r2 } = await twoRoundsAfterFailure({ saveBaseValues: 1 });
  assert.equal(r1.status, 'partial'); assert.equal(r1.commit.step, 'basiswaarden');
  assert.equal(cloud.rows.get('groceries').version, 1, 'server had de upload al');
  assert.equal(r2.status, 'ok'); assert.deepEqual(r2.pushed, [], 'geen dubbele mutatie');
  assert.equal(cloud.rows.get('groceries').version, 1);
  assert.equal(kees.bases.groceries.version, 1, 'na herstel wel bevestigd');
  assert.deepEqual(kees.data.groceries, [g('a', 'Melk')], 'lokale gegevens onaangetast');
});

test('R1b. versie-administratie schrijven mislukt: oude administratie vindt haar basis nog (vorige waarde)', async () => {
  const cloud = fakeCloud(), meta = newMeta();
  let fail = 0;
  const kees = device(cloud, meta, 'kees:hh', { writeBases: async () => { if (fail-- > 0) throw new Error('injectie: writeBases'); } });
  kees.data = { groceries: [g('a', 'Melk')] };
  await kees.sync();
  const oldBases = structuredClone(kees.bases);
  kees.data.groceries.push(g('b', 'Brood'));
  fail = 1;
  const r = await kees.sync();
  assert.equal(r.status, 'partial'); assert.equal(r.commit.step, 'versie-administratie');
  assert.deepEqual(kees.bases, oldBases, 'administratie niet bijgewerkt');
  assert.deepEqual((await meta.loadBaseValues(kees.slot, oldBases)).groceries, [g('a', 'Melk')], 'basis bij oude administratie nog aanwezig');
  const r2 = await kees.sync();
  assert.equal(r2.status, 'ok'); assert.deepEqual(r2.pushed, []);
  assert.equal(cloud.rows.get('groceries').version, 2);
  assert.equal(kees.bases.groceries.version, 2);
});

test('R1c. conflicten bewaren mislukt: ronde vastgelegd, waarschuwing zichtbaar (niet stil)', async () => {
  const { r1, kees } = await twoRoundsAfterFailure({ saveConflicts: 1 });
  assert.equal(r1.commit.committed, true);
  assert.ok(kees.warnings.includes('conflicten'));
});

test('R1d. inflight wissen mislukt: waarschuwing; volgende geslaagde ronde wist alsnog', async () => {
  const cloud = fakeCloud(), meta = failingMeta({ clearInflight: 1 });
  const kees = device(cloud, meta, 'kees:hh');
  kees.data = { groceries: [g('a', 'Melk')] };
  cloud.failNextPut('after-commit');
  await kees.sync();                       // inflight blijft (netwerk)
  const r = await kees.sync();             // ok, maar wissen faalt
  assert.equal(r.status, 'ok'); assert.ok(kees.warnings.includes('inflight'));
  assert.equal((await meta.listInflight(kees.slot)).length, 1);
  await kees.sync();
  assert.deepEqual(await meta.listInflight(kees.slot), []);
});

test('R1e. inflight registreren mislukt: upload gaat door (server-versiecontrole blijft), waarschuwing zichtbaar', async () => {
  const { cloud, r1, kees } = await twoRoundsAfterFailure({ beginUpload: 1, endUpload: 1 });
  assert.equal(r1.status, 'ok'); assert.equal(cloud.rows.get('groceries').version, 1);
  assert.ok(kees.warnings.includes('inflight-start') && kees.warnings.includes('inflight-einde'));
});

test('R1f. fout in de metastore wordt in status().lastError vastgelegd', async () => {
  const idb = fakeIndexedDB(); const meta = newMeta(idb);
  assert.equal((await meta.status()).durability, 'durable');
  idb.quotaOnWrite = true;
  await assert.rejects(meta.saveBaseValues('s', { groceries: [1] }), /QuotaExceeded/);
  const st = await meta.status();
  assert.equal(st.lastError.step, 'basiswaarden'); assert.match(st.lastError.message, /Quota/);
});

test('R2. alleen geheugen: commitRound meldt "session"; administratie blijft in geheugen (nooit als duurzaam bevestigd)', async () => {
  const cloud = fakeCloud();
  const meta = SM.createSyncMetaStore({ hashValue: HS.hashValue });
  assert.deepEqual((await meta.status()).durability, 'session');
  const kees = device(cloud, meta, 'kees:hh');
  kees.data = { groceries: [g('a', 'Melk')] };
  const r = await kees.sync();
  assert.equal(r.commit.durability, 'session');
  assert.deepEqual(kees.bases, {}, 'niets in de duurzame administratie');
  assert.equal(kees.sessionBases.groceries.version, 1, 'wel in het geheugen van deze sessie');
  // localStorage-terugval die vol raakt → geheugen → ook "session".
  const full = SM.createSyncMetaStore({ indexedDB: undefined, storage: memoryStorage(new Map(), { quotaAt: 10 }), hashValue: HS.hashValue });
  assert.equal((await full.status()).durability, 'limited');
  const saved = await full.saveBaseValues('s', { groceries: ['te groot voor de opslag'] });
  assert.equal(saved.durability, 'session');
});

test('R3. localStorage-lease is niet exclusief bij vertraagde zichtbaarheid; server-versiecontrole voorkomt verlies', async () => {
  // Twee tabbladen met elk een eigen (vertraagde) blik op localStorage: beide denken de lease te hebben.
  const viewA = memoryStorage(), viewB = memoryStorage();
  const timers = { setInterval: () => 0, clearInterval: () => {} };
  const tabA = TS.createSyncLock({ storage: viewA, tabId: 'A', timers }), tabB = TS.createSyncLock({ storage: viewB, tabId: 'B', timers });
  assert.equal(tabA.exclusive, false, 'lease claimt geen exclusiviteit');
  let release; const gate = new Promise(r => { release = r; });
  const a = tabA.run(() => gate.then(() => 'A'));
  const b = await tabB.run(async () => 'B');
  assert.equal(b.acquired, true, 'beide verkregen: geen garantie zonder Web Locks');
  release(); await a;
  // Laatste verdedigingslinie: twee gelijktijdige rondes van hetzelfde apparaat met dezelfde versie.
  const cloud = fakeCloud();
  const shared = { groceries: [g('a', 'Melk')] };
  const t1 = device(cloud, newMeta(), 'kees:hh'), t2 = device(cloud, newMeta(), 'kees:hh');
  t1.data = structuredClone(shared); t2.data = structuredClone(shared);
  const [r1, r2] = await Promise.all([t1.sync(), t2.sync()]);
  assert.equal(cloud.rows.get('groceries').version, 1, 'precies één schrijver geaccepteerd');
  assert.ok([r1.status, r2.status].includes('ok'));
  const loser = r1.status === 'ok' ? t2 : t1;
  assert.equal((await loser.sync()).status, 'ok', 'tweede tabblad herstelt in de volgende ronde (adopt)');
  assert.equal(cloud.rows.get('groceries').version, 1, 'geen extra versie');
  assert.equal(TS.createSyncLock({ locks: { request() {} } }).exclusive, true, 'alleen Web Locks zijn exclusief');
});

test('R4. hangend netwerkverzoek wordt afgebroken (time-out) en geldt als netwerkfout; lock komt vrij', async () => {
  const fetchImpl = (_url, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const cloud = HS.createCloud({ url: 'https://x.supabase.co', anonKey: 'k', getToken: async () => 't', fetchImpl, timeoutMs: 20 });
  const lock = TS.createSyncLock({ storage: memoryStorage(), tabId: 't', timers: { setInterval: () => 0, clearInterval: () => {} } });
  const out = await lock.run(() => cloud.readState('hh').then(() => 'ok', e => e));
  assert.equal(out.value.name, 'TimeoutError');
  assert.equal(HS.classifyError(out.value).kind, 'network');
  assert.equal((await lock.run(async () => 'vrij')).value, 'vrij');
});

test('R5a. tabbladconflict: beide waarden per pad, financieel gemarkeerd, dubbele melding → één record', async () => {
  const kept = { budgetV23: { pct: 40 }, groceries: [g('a', 'Volle melk')] };
  const other = { budgetV23: { pct: 60 }, groceries: [g('a', 'Havermelk')] };
  const base = { budgetV23: { pct: 50 }, groceries: [g('a', 'Melk')] };
  const details = TS.describeConflicts({ paths: ['budgetV23.pct', 'groceries[a].title'], kept, other, base });
  assert.deepEqual(details.map(d => [d.path, d.financial, d.kept, d.other, d.base]), [
    ['budgetV23.pct', true, 40, 60, 50], ['groceries[a].title', false, 'Volle melk', 'Havermelk', 'Melk']]);
  const meta = newMeta();
  const first = await meta.recordTabConflict(details[0]);
  // Het andere tabblad meldt dezelfde botsing (waarden omgedraaid).
  const second = await meta.recordTabConflict({ ...details[0], kept: 60, other: 40 });
  assert.equal(second.duplicate, true); assert.equal(first.key, second.key);
  await meta.recordTabConflict(details[1]);
  const list = await meta.listTabConflicts();
  assert.equal(list.length, 2);
  const fin = list.find(r => r.financial);
  assert.equal(fin.count, 2); assert.equal(fin.kept, 40); assert.equal(fin.other, 60); assert.equal(fin.base, 50);
});

test('R5b. tabbladconflict later herstellen: andere waarde terugzetten op het pad; opgelost blijft in historie', async () => {
  const meta = newMeta();
  const data = { budgetV23: { pct: 40 }, groceries: [g('a', 'Volle melk')] };
  const { key } = await meta.recordTabConflict({ path: 'groceries[a].title', section: 'groceries', kept: 'Volle melk', other: 'Havermelk' });
  const rec = await meta.getTabConflict(key);
  assert.equal(TS.setAt(data, rec.path, rec.other), true);
  assert.equal(data.groceries[0].title, 'Havermelk');
  await meta.resolveTabConflict(key, 'other');
  assert.equal((await meta.listTabConflicts({ includeResolved: false })).length, 0);
  assert.equal((await meta.listTabConflicts()).length, 1, 'historie blijft');
  assert.equal(TS.setAt(data, 'onbekend[x].veld', 1), false, 'geen nieuwe structuur verzinnen');
});

test('R5c. opruimen: openstaande conflicten blijven; alleen opgeloste boven 50 verdwijnen', async () => {
  const meta = newMeta();
  for (let i = 0; i < 60; i++) { const { key } = await meta.recordTabConflict({ path: 'groceries[' + i + '].title', kept: 'a' + i, other: 'b' + i }); await meta.resolveTabConflict(key, 'kept'); }
  for (let i = 0; i < 5; i++) await meta.recordTabConflict({ path: 'budgetV23.p' + i, financial: true, kept: i, other: -i });
  const all = await meta.listTabConflicts();
  assert.equal(all.filter(r => !r.resolved).length, 5);
  assert.ok(all.filter(r => r.resolved).length <= 50);
});

test('R5d. app.js geeft tabbladconflicten door met beide waarden en een aparte financiële melding', () => {
  const app = require('node:fs').readFileSync(__dirname + '/app.js', 'utf8');
  assert.match(app, /describeConflicts\(\{ paths: result\.conflicts, kept: result\.value, other: result\.remote, base: result\.base \}\)/);
  assert.match(app, /financiële gegevens zijn in twee tabbladen verschillend gewijzigd/);
  assert.match(app, /window\.SamenThuisTabConflicts = \{/);
  assert.doesNotMatch(app, /discarded: result\.remote/, 'geen volledige gegevenskopie per conflict meer');
});

test('R6a. IndexedDB geblokkeerd door oud tabblad: wacht op vrijgave in plaats van direct terug te vallen', async () => {
  const idb = fakeIndexedDB({ blockedMs: 30 });
  const meta = newMeta(idb);
  assert.equal(await meta.mode(), 'indexeddb');
});

test('R6b. IndexedDB opent pas na de time-out: terugval, en de late verbinding wordt gesloten (geen lek)', async () => {
  const idb = fakeIndexedDB({ openDelayMs: 60 });
  const timers = { setTimeout: (fn) => setTimeout(fn, 10), clearTimeout: id => clearTimeout(id) };
  const meta = SM.createSyncMetaStore({ indexedDB: idb, storage: memoryStorage(), hashValue: HS.hashValue, timers });
  assert.equal(await meta.mode(), 'localStorage');
  await new Promise(r => setTimeout(r, 120));
  assert.equal(idb.closed, 1);
});

test('R6c. schrijftransacties vragen strikte duurzaamheid', async () => {
  const idb = fakeIndexedDB(); const meta = newMeta(idb);
  await meta.saveBaseValues('s', { groceries: [1] });
  const writes = idb.txOptions.filter(t => t.mode === 'readwrite');
  assert.ok(writes.length && writes.every(t => t.options && t.options.durability === 'strict'));
});

test('R6d. twee tabbladen migreren tegelijk; een intussen bewaarde nieuwere basis wordt niet overschreven', async () => {
  const idb = fakeIndexedDB(), storage = memoryStorage();
  storage.setItem(SM.LEGACY_BASE_KEY, JSON.stringify({ slot: { groceries: ['oud'] } }));
  const tab1 = newMeta(idb, storage);
  await tab1.mode();                                  // tab 1 migreert
  await tab1.saveBaseValues('slot', { groceries: ['nieuw'] });
  storage.setItem(SM.LEGACY_BASE_KEY, JSON.stringify({ slot: { groceries: ['oud'] } })); // oud tabblad (oude versie) schreef opnieuw
  const tab2 = newMeta(idb, storage);
  assert.deepEqual((await tab2.loadBaseValues('slot')).groceries, ['nieuw']);
  const [x, y] = await Promise.all([newMeta(idb, storage).mode(), newMeta(idb, storage).mode()]);
  assert.equal(x, 'indexeddb'); assert.equal(y, 'indexeddb');
  assert.deepEqual((await tab2.loadBaseValues('slot')).groceries, ['nieuw']);
});

test('R7. versiegeschiedenis in de tabbladbewaking houdt maximaal 8 volledige teksten vast', () => {
  const storage = memoryStorage();
  storage.setItem('k', JSON.stringify({ meta: {}, groceries: [] }));
  const tab = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  const other = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  let mine = JSON.parse(storage.getItem('k'));
  for (let i = 0; i < 40; i++) {
    const v = JSON.parse(storage.getItem('k')); v.groceries.push(g('x' + i, 'item ' + 'x'.repeat(1000)));
    const text = other.serialize(v); storage.setItem('k', text); other.commit(text);
    mine = tab.absorb(text, mine).value;
  }
  assert.equal(mine.groceries.length, 40);
  assert.ok(tab.stats().texts <= 8, 'teksten: ' + tab.stats().texts);
  assert.ok(tab.stats().versions >= 40, 'herkomstketen blijft bewaard');
  // Indirect: na 40 versies werkt samenvoegen met een oude voorganger zonder tekst nog veilig (zonder basis).
  const r = tab.absorb(JSON.stringify({ meta: { __tabRev: { id: 'vreemd', parent: 'onbekend' } }, groceries: [g('z', 'Z')] }), mine);
  assert.ok(r.value.groceries.length === 41, 'zonder bekende voorganger wordt niets verwijderd');
});

test('R8. twee tabbladen schrijven elk hetzelfde samenvoegresultaat; volgende wijziging geeft geen onterecht conflict', () => {
  const storage = memoryStorage();
  storage.setItem('k', JSON.stringify({ meta: {}, groceries: [g('a', 'Melk')] }));
  const A = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 }), B = TS.createDataGuard({ storage, key: 'k', merge3: HS.merge3 });
  let dA = JSON.parse(storage.getItem('k')), dB = JSON.parse(storage.getItem('k'));
  dA.groceries.push(g('kaas', 'Kaas')); const K = A.serialize(dA); storage.setItem('k', K); A.commit(K);
  dB.groceries.push(g('ei', 'Eieren')); const E = B.serialize(dB); storage.setItem('k', E); B.commit(E); // B zag K niet
  const ra = A.absorb(E, dA); dA = ra.value; const M = A.serialize(dA); storage.setItem('k', M); A.commit(M);
  const rb = B.absorb(K, dB); dB = rb.value; const M2 = B.serialize(dB); storage.setItem('k', M2); B.commit(M2);
  dB = B.absorb(M, dB).value; dA = A.absorb(M2, dA).value;           // late meldingen: zelfde inhoud
  assert.deepEqual(ids(dA), ids(dB));
  // Nu wijzigen beide (A in geheugen, B slaat op) hetzelfde item: één echt conflict, geen extra (onterechte) conflicten.
  dB.groceries.find(x => x.id === 'kaas').title = 'Oude kaas';
  const w = B.prepareWrite(dB); const T = B.serialize(w.value); storage.setItem('k', T); B.commit(T);
  assert.deepEqual(w.conflicts, [], 'B kent de laatste inhoud: geen conflict');
  dA.groceries.find(x => x.id === 'kaas').title = 'Geitenkaas';
  const r = A.absorb(T, dA);
  assert.deepEqual(r.conflicts, ['groceries[kaas].title'], 'alleen het echte conflict');
});
