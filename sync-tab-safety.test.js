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

// Minimale IndexedDB: open/onupgradeneeded, transacties met getAll/put/delete; schrijfacties worden pas bij `complete`
// zichtbaar (zoals echte transacties). Dezelfde instantie hergebruiken = browser opnieuw openen.
function fakeIndexedDB({ failOpen = false } = {}) {
  const dbs = new Map();
  const later = fn => setTimeout(fn, 0);
  const copy = v => JSON.parse(JSON.stringify(v));
  return {
    dbs,
    open(name, version) {
      const req = {};
      later(() => {
        if (failOpen) { req.error = new Error('InvalidStateError'); req.onerror && req.onerror(); return; }
        let db = dbs.get(name), upgrade = false;
        if (!db) { db = { version, stores: new Map() }; dbs.set(name, db); upgrade = true; }
        const conn = {
          objectStoreNames: { contains: n => db.stores.has(n) },
          createObjectStore: n => { db.stores.set(n, new Map()); },
          close() {},
          transaction(storeName) {
            const t = {}, ops = [];
            let aborted = false, outstanding = 0;
            const data = db.stores.get(storeName);
            const finish = () => later(() => {
              if (aborted) return;
              if (outstanding) return finish();
              ops.forEach(op => op());
              t.oncomplete && t.oncomplete();
            });
            t.abort = () => { aborted = true; t.onabort && t.onabort(); };
            t.objectStore = () => ({
              getAll() { const r = {}; outstanding++; later(() => { outstanding--; r.result = [...data.values()].map(copy); r.onsuccess && r.onsuccess(); }); return r; },
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
      });
      return req;
    }
  };
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
// toepassen → basiswaarden in de metastore → versie-administratie).
function device(cloud, meta, slot = 'user-a:hh-1') {
  const dev = { data: {}, bases: {}, meta, slot };
  dev.sync = async ({ duringRound, resolutions = {} } = {}) => {
    const prevBase = dev.bases;
    const prevBaseValues = await meta.loadBaseValues(slot, prevBase);
    const snapshot = structuredClone(dev.data);
    const tracked = SM.trackUploads(cloud, meta, slot, HS.classifyError);
    const wrapped = duringRound ? { ...tracked, async readState(h) { const r = await tracked.readState(h); duringRound(dev); return r; } } : tracked;
    const raw = await HS.runAccountSync({ cloud: wrapped, householdId: 'hh-1', local: snapshot, base: prevBase, baseValues: prevBaseValues, resolutions, encrypt: async v => v, decrypt: async p => p });
    const result = HS.deferChangedPulls({ snapshot, current: dev.data, result: raw, prevBase, prevBaseValues });
    dev.data = { ...dev.data, ...result.pulls };
    await meta.saveBaseValues(slot, result.baseValues);
    dev.bases = result.base;
    if (result.status === 'ok') await meta.clearInflight(slot);
    return result;
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

test('7c. tabbladconflict wordt bewaard (begrensd tot 20)', async () => {
  const meta = newMeta();
  for (let i = 0; i < 23; i++) await meta.recordTabConflict({ fields: ['x'], discarded: { i } });
  const list = await meta.listTabConflicts();
  assert.equal(list.length, 20);
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
