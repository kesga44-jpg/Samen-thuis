// Opdracht 5: financiële conflicten zijn geïsoleerd per identiteit (account + huishouden).
// Eén apparaat (gedeelde IndexedDB, localStorage en applicatiegegevens) waarop wordt gewisseld van account of huishouden.
// Elk huishouden heeft een eigen nagebootste Supabase-tabel. Nagebootste opslag en cloud; niets naar echte Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const HS = require('./household-sync-core.js');
const SM = require('./sync-meta-store.js');
const FC = require('./finance-conflict-core.js');
const { memoryStorage, fakeIndexedDB, fakeCloud, cloudAs } = require('./test-fixtures/sync-fakes.js');

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const H1 = '11111111-1111-4111-8111-111111111111', H2 = '22222222-2222-4222-8222-222222222222';

// Zelfde volgorde als account-sync.js, met scope = '<account>:<huishouden>' van de actieve identiteit.
function phone(clouds, shared = { idb: fakeIndexedDB(), storage: memoryStorage(), data: {}, basesBySlot: {} }) {
  const meta = SM.createSyncMetaStore({ indexedDB: shared.idb, storage: shared.storage, hashValue: HS.hashValue });
  const core = FC.createFinanceConflicts({ store: meta, merge3: HS.merge3, hashValue: HS.hashValue });
  const ph = { shared, meta, core, user: null, hh: null };
  Object.defineProperty(ph, 'data', { get: () => shared.data, set: v => { shared.data = v; } });
  ph.login = (user, hh) => { ph.user = user; ph.hh = hh; return ph; };
  ph.scope = () => FC.scopeFor(ph.user, ph.hh);
  ph.fin = () => core.scoped(ph.scope());
  ph.bases = () => shared.basesBySlot[ph.scope()] || {};
  ph.sync = async () => {
    const scope = ph.scope(), FS = ph.fin(), cloud = cloudAs(clouds[ph.hh], ph.user);
    const prevBase = ph.bases();
    const prevBaseValues = await meta.loadBaseValues(scope, prevBase);
    const pre = await FS.beforeRound({ data: ph.data, prevBase, prevBaseValues, actor: ph.user, householdId: ph.hh });
    if (pre.fixes.length) ph.data = { ...ph.data, ...Object.fromEntries(pre.fixes.map(f => [f.section, f.value])) };
    const snapshot = structuredClone(ph.data);
    const tracked = SM.trackUploads(cloud, meta, scope, HS.classifyError);
    const raw = await HS.runAccountSync({ cloud: tracked, householdId: ph.hh, local: snapshot, base: prevBase, baseValues: prevBaseValues, encrypt: async v => v, decrypt: async p => p, frozen: pre.frozen, protectedSections: [...FC.FINANCIAL_SECTIONS] });
    const fr = await FS.afterRound({ raw, records: pre.records, snapshot, prevBase, prevBaseValues, cloud: tracked, householdId: ph.hh, encrypt: async v => v, classify: HS.classifyError, actor: ph.user });
    const result = HS.deferChangedPulls({ snapshot, current: ph.data, result: fr.result, prevBase, prevBaseValues });
    ph.data = { ...ph.data, ...result.pulls };
    const commit = await SM.commitRound({ store: meta, slot: scope, base: result.base, baseValues: result.baseValues, conflicts: result.conflicts, roundOk: result.status === 'ok', writeBases: async b => { shared.basesBySlot[scope] = b; } });
    if (commit.committed) await FS.afterCommit({ outcomes: fr.outcomes, actor: ph.user });
    return { ...result, pre, outcomes: fr.outcomes };
  };
  ph.resolve = async (section, choices) => {
    const bases = ph.bases();
    const pushBase = bases[section] ? { version: bases[section].version, value: (await meta.loadBaseValues(ph.scope(), bases))[section] } : null;
    const r = await ph.fin().resolve({ section, choices, currentLocal: ph.data[section], actor: ph.user, pushBase });
    if (r.ok) ph.data[section] = structuredClone(r.value);
    return r;
  };
  ph.restart = () => phone(clouds, shared).login(ph.user, ph.hh);
  return ph;
}
const budget = (pct = 50) => ({ pct, pots: { vaste: 100000 } });
const g = (id, title) => ({ id, title, done: false });

// Huishouden H1: account A heeft op de telefoon een open budgetconflict met huisgenoot OTHER. Huishouden H2 bestaat los.
async function setup() {
  const clouds = { [H1]: fakeCloud(), [H2]: fakeCloud() };
  clouds[H2].rows.set('budgetV23', { payload: budget(70), version: 1, updatedBy: B });
  clouds[H2].rows.set('groceries', { payload: [g('h2', 'H2-item')], version: 1, updatedBy: B });
  const ph = phone(clouds).login(A, H1);
  ph.data = { budgetV23: budget(50), groceries: [g('a', 'Melk')] };
  await ph.sync();
  const other = phone(clouds).login(OTHER, H1); await other.sync();
  other.data.budgetV23.pct = 40; await other.sync();        // huisgenoot wijzigt het percentage
  ph.data.budgetV23.pct = 60;                                // A wijzigt hetzelfde veld
  await ph.sync();
  const [rec] = await ph.fin().list();
  assert.equal(rec.status, 'open'); assert.equal(rec.scope, `${A}:${H1}`);
  return { clouds, ph, other };
}

test('S1. account A heeft een open budgetconflict; account B logt in op hetzelfde apparaat → B ziet en verwerkt het niet', async () => {
  const { clouds, ph } = await setup();
  const h2Budget = structuredClone(clouds[H2].rows.get('budgetV23'));
  ph.login(B, H2);
  assert.deepEqual(await ph.fin().list(), [], 'B ziet het conflict van A niet');
  const r = await ph.sync();
  assert.deepEqual(r.pre.records, [], 'beforeRound geeft B geen records van A');
  assert.ok(!r.outcomes.length, 'niets van A verwerkt');
  assert.deepEqual(clouds[H2].rows.get('budgetV23'), h2Budget, 'A\'s budgetwaarde niet naar huishouden B gestuurd');
  assert.ok(r.pre.foreign.includes('budgetV23'), 'lokale budgetwaarde van A herkend als niet van B');
  const [recA] = await ph.core.list(`${A}:${H1}`);
  assert.equal(recA.status, 'open'); assert.equal(recA.local.pct, 60, 'record van A onaangetast');
});

test('S2. huishouden A heeft een open conflict; hetzelfde account wisselt naar huishouden B → geïsoleerd', async () => {
  const { clouds, ph } = await setup();
  const putsBefore = clouds[H2].rows.get('budgetV23').version;
  ph.login(A, H2);
  assert.deepEqual(await ph.fin().list(), []);
  await ph.sync();
  assert.equal(clouds[H2].rows.get('budgetV23').version, putsBefore, 'geen upload van het H1-budget naar H2');
  assert.equal((await ph.core.list(`${A}:${H1}`)).length, 1);
  assert.deepEqual(await ph.core.list(`${A}:${H2}`), []);
});

test('S3. een opgelost conflict van A (wacht op server) uploadt nooit een waarde naar B', async () => {
  const { clouds, ph } = await setup();
  clouds[H1].failNextPut('before-commit');
  await ph.resolve('budgetV23', { pct: 'local' });
  await ph.sync();                                                     // upload naar H1 mislukt → wachtend
  assert.equal((await ph.fin().list())[0].status, 'resolved-pending');
  const h2 = structuredClone(clouds[H2].rows.get('budgetV23'));
  ph.login(B, H2); await ph.sync(); await ph.sync();
  assert.deepEqual(clouds[H2].rows.get('budgetV23'), h2, 'gekozen waarde van A staat niet in H2');
  // Ook als de records van A expliciet aan B's verwerking worden aangeboden, slaat de kern ze over.
  const recA = await ph.core.list(`${A}:${H1}`);
  const outcomes = await ph.core.processRound({ scope: `${B}:${H2}`, records: recA, remoteState: {}, cloud: { putState: () => { throw new Error('mag niet'); } }, householdId: H2, encrypt: async v => v, data: ph.data });
  assert.deepEqual(outcomes, []);
  assert.equal(await ph.core.afterCommit({ scope: `${B}:${H2}`, outcomes: [{ key: recA[0].key, scope: `${A}:${H1}`, kind: 'confirmed', resolutionId: recA[0].resolution.id }] }), 0);
  assert.equal((await ph.core.list(`${A}:${H1}`))[0].status, 'resolved-pending', 'niet door B afgerond of verwijderd');
});

test('S4. een conflict van A blokkeert B niet: B\'s eigen budgetwijziging en andere onderdelen synchroniseren', async () => {
  const { clouds, ph } = await setup();
  ph.login(B, H2);
  // B werkt met de gegevens van huishouden B (eerste ronde neemt de cloudstand over als basis).
  ph.data = { budgetV23: budget(70), groceries: [g('h2', 'H2-item')] };
  const first = await ph.sync();
  assert.equal(first.status, 'ok');
  ph.data.budgetV23.pct = 75;                                         // B wijzigt het budget zelf
  ph.data.groceries.push(g('b', 'Brood'));
  const r = await ph.sync();
  assert.deepEqual(r.pre.foreign, [], 'eigen waarde van B is niet "vreemd"');
  assert.deepEqual(r.pre.frozen, [], 'niets van B bevroren door A');
  assert.equal(clouds[H2].rows.get('budgetV23').payload.pct, 75);
  assert.deepEqual(clouds[H2].rows.get('groceries').payload.map(x => x.id), ['h2', 'b']);
  // B's eigen conflictadministratie werkt: conflict in H2 → eigen record onder B:H2.
  clouds[H2].rows.set('budgetV23', { payload: budget(80), version: clouds[H2].rows.get('budgetV23').version + 1, updatedBy: OTHER });
  ph.data.budgetV23.pct = 77;
  await ph.sync();
  const own = await ph.fin().list();
  assert.equal(own.length, 1); assert.equal(own[0].scope, `${B}:${H2}`);
  assert.equal((await ph.core.list(`${A}:${H1}`)).length, 1, 'A\'s record staat er nog, apart');
});

test('S5. na terugkeer naar A is het oorspronkelijke conflict correct beschikbaar en op te lossen in huishouden A', async () => {
  const { clouds, ph } = await setup();
  ph.login(B, H2); await ph.sync();
  ph.login(A, H1);
  const [rec] = await ph.fin().list();
  assert.equal(rec.status, 'open'); assert.equal(rec.local.pct, 60); assert.equal(rec.remote.pct, 40);
  await ph.resolve('budgetV23', { pct: 'local' });
  await ph.sync();
  assert.equal(clouds[H1].rows.get('budgetV23').payload.pct, 60);
  assert.deepEqual(await ph.fin().list(), []);
  assert.equal(clouds[H2].rows.get('budgetV23').payload.pct, 70, 'H2 onaangetast');
});

test('S6. twee accounts in hetzelfde huishouden op één apparaat houden elk hun eigen conflictadministratie', async () => {
  const { clouds, ph } = await setup();
  ph.login(OTHER, H1);                                                 // huisgenoot op hetzelfde apparaat
  assert.deepEqual(await ph.fin().list(), [], 'ziet het record van A niet');
  ph.data.budgetV23 = { ...budget(40), pots: { vaste: 100000, extra: 5 } };
  const r = await ph.sync();
  assert.ok(!r.outcomes.length);
  assert.equal((await ph.core.list(`${A}:${H1}`)).length, 1);
  // Nieuw conflict voor OTHER: eigen record, andere key.
  clouds[H1].rows.set('budgetV23', { payload: { ...budget(45), pots: { vaste: 100000, extra: 9 } }, version: clouds[H1].rows.get('budgetV23').version + 1, updatedBy: A });
  ph.data.budgetV23.pots.extra = 7;
  await ph.sync();
  const mine = await ph.fin().list(), aRecs = await ph.core.list(`${A}:${H1}`);
  assert.equal(mine.length, 1); assert.equal(aRecs.length, 1);
  assert.notEqual(mine[0].key, aRecs[0].key);
  assert.equal(aRecs[0].local.pct, 60, 'record van A ongewijzigd');
});

test('S7. browserherstart verandert de isolatie niet', async () => {
  const { ph } = await setup();
  ph.login(B, H2); await ph.sync();
  const again = ph.restart();
  assert.deepEqual(await again.fin().list(), []);
  again.login(A, H1);
  const [rec] = await again.fin().list();
  assert.equal(rec.status, 'open'); assert.equal(rec.scope, `${A}:${H1}`);
});

test('S8. oude records zonder scope worden veilig gemigreerd of in quarantaine gezet, zonder dataverlies', async () => {
  const idb = fakeIndexedDB(), storage = memoryStorage();
  const meta = SM.createSyncMetaStore({ indexedDB: idb, storage, hashValue: HS.hashValue });
  const legacy = (section, extra) => ({ key: 'fin:' + section, slot: 'device', kind: 'finance', section, status: 'open', rev: 3, base: { pct: 50 }, local: { pct: 60 }, remote: { pct: 40 }, forcedPaths: [], resolution: null, ...extra });
  await meta.putRecord(legacy('budgetV23', { origin: 'sync', localUser: A, householdId: H1 }));       // identiteit bekend
  await meta.putRecord(legacy('budget19', { origin: 'tab', localUser: null, householdId: null }));    // tab, onbekend → device
  await meta.putRecord(legacy('budget', { origin: 'sync', localUser: null, householdId: null }));     // sync, onbekend → quarantaine
  await meta.putRecord({ key: 'fing:budgetV23', slot: 'device', kind: 'finance-guard', section: 'budgetV23', at: new Date().toISOString(), paths: [{ path: 'pct', rejectedHash: 'x' }] });
  const core = FC.createFinanceConflicts({ store: meta, merge3: HS.merge3, hashValue: HS.hashValue });
  const mine = await core.list(`${A}:${H1}`);
  assert.equal(mine.length, 1); assert.equal(mine[0].key, `fin|${A}:${H1}|budgetV23`); assert.equal(mine[0].local.pct, 60, 'waarden behouden');
  const device = await core.list(FC.DEVICE_SCOPE);
  assert.equal(device.length, 1); assert.equal(device[0].section, 'budget19');
  const quarantine = await core.list(FC.LEGACY_SCOPE);
  assert.equal(quarantine.length, 1); assert.equal(quarantine[0].section, 'budget'); assert.equal(quarantine[0].local.pct, 60);
  assert.deepEqual((await meta.listRecords('finance')).filter(r => !r.scope), [], 'geen record zonder scope meer');
  assert.equal(await meta.getRecord('fin:budgetV23'), null, 'oude key pas weg na overname');
  const guards = await meta.listRecords('finance-guard');
  assert.equal(guards.length, 1); assert.equal(guards[0].scope, FC.LEGACY_SCOPE, 'oude guard inert bewaard, niet verwijderd');
  assert.ok((await core.audit()).filter(a => a.action === 'migrated').length === 3);
  // Quarantaine wordt in geen enkele ronde verwerkt. Opdracht 7: een apparaatconflict hoort bij het lokale profiel en
  // heeft geen invloed op (en is niet zichtbaar in) de ronde van een account; het gaat alleen mee bij expliciete koppeling.
  const pre = await core.scoped(`${B}:${H2}`).beforeRound({ data: { budget: { pct: 60 }, budget19: { pct: 60 } } });
  assert.deepEqual(pre.records, []); assert.deepEqual(pre.frozen, []); assert.deepEqual(pre.fixes, []);
});

test('S8b. migratie overschrijft nooit een nieuwer record met dezelfde doelkey (oud record apart in quarantaine)', async () => {
  const meta = SM.createSyncMetaStore({ indexedDB: fakeIndexedDB(), storage: memoryStorage(), hashValue: HS.hashValue });
  const core = FC.createFinanceConflicts({ store: meta, merge3: HS.merge3, hashValue: HS.hashValue });
  await core.open({ scope: `${A}:${H1}`, section: 'budgetV23', origin: 'sync', base: { pct: 1 }, local: { pct: 2 }, remote: { pct: 3 } });
  const fresh = FC.createFinanceConflicts({ store: meta, merge3: HS.merge3, hashValue: HS.hashValue });
  await meta.putRecord({ key: 'fin:budgetV23', slot: 'device', kind: 'finance', section: 'budgetV23', origin: 'sync', localUser: A, householdId: H1, status: 'open', rev: 1, local: { pct: 9 }, remote: { pct: 8 }, base: null, forcedPaths: [] });
  const [kept] = await fresh.list(`${A}:${H1}`);
  assert.equal(kept.local.pct, 2, 'nieuwer record niet overschreven');
  const q = await fresh.list(FC.LEGACY_SCOPE);
  assert.equal(q.length, 1); assert.equal(q[0].local.pct, 9, 'oud record bewaard');
});

test('S9. apparaatconflict (tabbladen, niet aangemeld): opgelost lokaal, daarna geen financiële waarden meer in het record', async () => {
  const meta = SM.createSyncMetaStore({ indexedDB: fakeIndexedDB(), storage: memoryStorage(), hashValue: HS.hashValue });
  const core = FC.createFinanceConflicts({ store: meta, merge3: HS.merge3, hashValue: HS.hashValue });
  await core.open({ scope: FC.DEVICE_SCOPE, section: 'budgetV23', origin: 'tab', base: { pct: 50 }, local: { pct: 61 }, remote: { pct: 39 }, forcedPaths: ['pct'] });
  const r = await core.resolve({ scope: FC.DEVICE_SCOPE, section: 'budgetV23', choices: { pct: 'remote' }, currentLocal: { pct: 61 } });
  assert.equal(r.ok, true); assert.equal(r.value.pct, 39); assert.equal(r.record.status, 'resolved-local');
  await core.completeLocal(FC.DEVICE_SCOPE, 'budgetV23', r.record.resolution.id);
  const [rec] = await core.list(FC.DEVICE_SCOPE);
  assert.equal(rec.base, null); assert.equal(rec.local, null); assert.equal(rec.remote, null); assert.equal(rec.resolution.value, null);
  assert.ok(rec.resolution.valueHash && rec.resolution.choices.pct === 'remote', 'keuze en hash blijven');
  const pre = await core.scoped(`${A}:${H1}`).beforeRound({ data: { budgetV23: { pct: 39 } } });
  assert.deepEqual(pre.frozen, [], 'opgelost apparaatconflict blokkeert niets meer');
  await assert.rejects(core.open({ scope: '', section: 'budgetV23', origin: 'sync' }), /scope/, 'zonder scope geen record');
  await assert.rejects(core.scoped(FC.DEVICE_SCOPE).beforeRound({ data: {} }), /scope/, 'syncronde vereist een identiteit');
});

test('S10. audit: geen bedragen, wel scope; audit van A niet zichtbaar in de scope van B', async () => {
  const { ph } = await setup();
  await ph.resolve('budgetV23', { pct: 'local' }); await ph.sync();
  const auditA = await ph.core.audit(`${A}:${H1}`);
  assert.deepEqual(auditA.map(a => a.action), ['detected', 'resolved', 'confirmed']);
  const text = JSON.stringify(auditA);
  for (const amount of ['100000', '"pct":60', '"pct":40']) assert.ok(!text.includes(amount), amount);
  assert.deepEqual(await ph.core.audit(`${B}:${H2}`), []);
});

test('S11. bronbestanden: account-sync en app.js gebruiken uitsluitend scoped records', () => {
  const acct = fs.readFileSync(__dirname + '/account-sync.js', 'utf8'), app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  const core = fs.readFileSync(__dirname + '/finance-conflict-core.js', 'utf8');
  assert.match(acct, /const FS = FIN && scope \? FIN\.scoped\(scope\) : null;/);
  assert.doesNotMatch(acct, /FIN\.(beforeRound|afterRound|afterCommit)\(/, 'rondes alleen via de gebonden scope');
  assert.doesNotMatch(acct, /FIN\.list\(\)/, 'nooit alle records zonder scope');
  assert.match(app, /FIN\.open\(\{\s*scope, localKey: [^,]+, section, origin: 'tab'/);
  assert.doesNotMatch(core, /'fin:' \+|'fing:' \+/, 'oude keys worden alleen nog gelezen (migratie)');
});

test('S12. centrale lijst omvat alle financiële onderdelen die app.js gebruikt (data.budget*)', () => {
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  const used = [...new Set([...app.matchAll(/data\.(budget\w*)/g)].map(m => m[1]))];
  assert.ok(used.length >= 4);
  for (const s of used) assert.ok(FC.isFinancialSection(s), s + ' ontbreekt in FINANCIAL_SECTIONS');
});
