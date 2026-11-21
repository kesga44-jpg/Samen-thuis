// Opdracht 4: financiële conflictbeveiliging. Twee gebruikers (Kees, Daphne) met eigen apparaten, een gedeelde
// geheugen-Supabase met versiecontrole en nagebootste IndexedDB. Het apparaatmodel volgt exact de volgorde in
// account-sync.js: beforeRound → momentopname → runAccountSync (frozen/protected) → afterRound → deferChangedPulls →
// toepassen → commitRound → afterCommit.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const HS = require('./household-sync-core.js');
const SM = require('./sync-meta-store.js');
const FC = require('./finance-conflict-core.js');
const { memoryStorage, fakeIndexedDB, fakeCloud, cloudAs } = require('./test-fixtures/sync-fakes.js');

const KEES = '11111111-1111-4111-8111-aaaaaaaaaaaa', DAPHNE = '22222222-2222-4222-8222-bbbbbbbbbbbb';

function device(cloud, user, { idb = fakeIndexedDB(), storage = memoryStorage(), failWriteBases = 0 } = {}) {
  const meta = SM.createSyncMetaStore({ indexedDB: idb, storage, hashValue: HS.hashValue });
  const slot = user + ':hh';
  const fin = FC.createFinanceConflicts({ store: meta, merge3: HS.merge3, hashValue: HS.hashValue }).scoped(slot);
  const dev = { user, idb, storage, meta, fin, data: {}, bases: {}, slot, failWriteBases };
  const mine = cloudAs(cloud, user);
  dev.sync = async ({ resolutions = {} } = {}) => {
    const prevBase = dev.bases;
    const prevBaseValues = await meta.loadBaseValues(dev.slot, prevBase);
    const pre = await fin.beforeRound({ data: dev.data, prevBase, prevBaseValues, actor: user, householdId: 'hh' });
    if (pre.fixes.length) dev.data = { ...dev.data, ...Object.fromEntries(pre.fixes.map(f => [f.section, f.value])) };
    const snapshot = structuredClone(dev.data);
    const tracked = SM.trackUploads(mine, meta, dev.slot, HS.classifyError);
    const general = Object.fromEntries(Object.entries(resolutions).filter(([s]) => !FC.isFinancialSection(s)));
    const rawRound = await HS.runAccountSync({ cloud: tracked, householdId: 'hh', local: snapshot, base: prevBase, baseValues: prevBaseValues, resolutions: general, encrypt: async v => v, decrypt: async p => p, frozen: pre.frozen, protectedSections: [...FC.FINANCIAL_SECTIONS] });
    const fr = await fin.afterRound({ raw: rawRound, records: pre.records, snapshot, prevBase, prevBaseValues, cloud: tracked, householdId: 'hh', encrypt: async v => v, classify: HS.classifyError, actor: user });
    const result = HS.deferChangedPulls({ snapshot, current: dev.data, result: fr.result, prevBase, prevBaseValues });
    dev.data = { ...dev.data, ...result.pulls };
    const commit = await SM.commitRound({ store: meta, slot: dev.slot, base: result.base, baseValues: result.baseValues, conflicts: result.conflicts, roundOk: result.status === 'ok',
      writeBases: async b => { if (dev.failWriteBases > 0) { dev.failWriteBases--; throw new Error('crash vóór administratie'); } dev.bases = b; } });
    if (commit.committed && commit.durability !== 'session') await fin.afterCommit({ outcomes: fr.outcomes, actor: user });
    return { ...result, outcomes: fr.outcomes, commit };
  };
  // Zelfde stappen als resolveFinance in account-sync.js.
  dev.resolve = async (section, choices, { skipLocalSave = false } = {}) => {
    const pushBase = dev.bases[section] ? { version: dev.bases[section].version, value: (await meta.loadBaseValues(dev.slot, dev.bases))[section] } : null;
    const r = await fin.resolve({ section, choices, currentLocal: dev.data[section], actor: user, pushBase });
    if (r.ok && !skipLocalSave) dev.data[section] = structuredClone(r.value);
    return r;
  };
  dev.restart = () => device(cloud, user, { idb: dev.idb, storage: dev.storage }).adopt(dev);
  dev.adopt = old => { dev.data = old.data; dev.bases = old.bases; return dev; };
  return dev;
}
const budget = (extra = {}) => ({ pct: 50, pots: { boodschappen: 40000, vakantie: 10000 }, ...extra });
const g = (id, title) => ({ id, title, done: false });

async function household() {
  const cloud = fakeCloud();
  const kees = device(cloud, KEES), daphne = device(cloud, DAPHNE);
  kees.data = { budgetV23: budget(), groceries: [g('a', 'Melk')] };
  await kees.sync(); await daphne.sync();
  return { cloud, kees, daphne };
}
// Gelijktijdig hetzelfde bedrag: Kees 40, Daphne 60. Kees synchroniseert eerst.
async function conflictOnPct() {
  const h = await household();
  h.kees.data.budgetV23.pct = 40; h.daphne.data.budgetV23.pct = 60;
  await h.kees.sync();
  h.r = await h.daphne.sync();
  return h;
}

test('F0. financieel = uitsluitend de expliciete centrale lijst (geen zoekwoordherkenning)', () => {
  assert.deepEqual([...FC.FINANCIAL_SECTIONS], ['budget', 'budget19', 'budget219', 'budgetV22', 'budgetV23', 'fuelEntries']);
  assert.equal(FC.isFinancialPath('budgetV23.pots.vakantie'), true);
  assert.equal(FC.isFinancialPath('budgetPlanner.x'), false);
  assert.equal(FC.isFinancialPath('financeNotes'), false);
  assert.equal(FC.isFinancialPath('groceries[a].price'), false);
  assert.equal(require('./tab-sync-core.js').isFinancialPath('budgetX.y'), false, 'tabbladbewaking gebruikt dezelfde definitie');
});

test('F1. twee gelijktijdige wijzigingen aan hetzelfde budget: record met alle velden, upload geblokkeerd, niets stil overschreven', async () => {
  const { cloud, daphne, r } = await conflictOnPct();
  assert.equal(r.status, 'conflict');
  assert.equal(r.conflicts.some(c => c.section === 'budgetV23'), false, 'niet in de algemene keuzelijst (geen "Cloudversie"-knop)');
  const [rec] = await daphne.fin.list();
  assert.equal(rec.section, 'budgetV23'); assert.equal(rec.status, 'open'); assert.equal(rec.origin, 'sync');
  assert.equal(rec.base.pct, 50); assert.equal(rec.local.pct, 60); assert.equal(rec.remote.pct, 40);
  assert.equal(rec.localUser, DAPHNE); assert.equal(rec.remoteUpdatedBy, KEES);
  assert.ok(rec.detectedAt && rec.remoteUpdatedAt, 'tijdstippen');
  assert.equal(cloud.rows.get('budgetV23').payload.pct, 40, 'cloud niet overschreven');
  assert.equal(daphne.data.budgetV23.pct, 60, 'lokaal niet overschreven');
  assert.deepEqual(daphne.fin.view(rec, daphne.data.budgetV23).map(p => [p.path, p.base, p.local, p.remote]), [['pct', 50, 60, 40]]);
  // Volgende rondes: blijft geblokkeerd.
  const v = cloud.rows.get('budgetV23').version;
  await daphne.sync(); await daphne.sync();
  assert.equal(cloud.rows.get('budgetV23').version, v);
});

test('F1b. andere onderdelen synchroniseren door terwijl het financiële onderdeel geblokkeerd is', async () => {
  const { cloud, kees, daphne } = await conflictOnPct();
  daphne.data.groceries.push(g('d', 'Kaas'));
  const r = await daphne.sync();
  assert.deepEqual(r.pushed, ['groceries']);
  await kees.sync();
  assert.deepEqual(kees.data.groceries.map(x => x.id), ['a', 'd']);
  // Kees wijzigt een ander budgetveld: Daphnes record ziet de nieuwe cloudstand; de keuze blijft over hetzelfde veld.
  kees.data.budgetV23.pots.vakantie = 12000; await kees.sync();
  await daphne.sync();
  const [rec] = await daphne.fin.list();
  assert.equal(rec.remote.pots.vakantie, 12000); assert.equal(rec.remoteVersion, cloud.rows.get('budgetV23').version);
  assert.deepEqual(daphne.fin.view(rec, daphne.data.budgetV23).map(p => p.path), ['pct']);
});

test('F2. wijzigingen aan verschillende budgetvelden worden automatisch samengevoegd (geen record)', async () => {
  const { cloud, kees, daphne } = await household();
  kees.data.budgetV23.pots.boodschappen = 45000;
  daphne.data.budgetV23.pots.vakantie = 15000;
  await kees.sync();
  const r = await daphne.sync();
  assert.equal(r.status, 'ok'); assert.deepEqual(await daphne.fin.list(), []);
  assert.deepEqual(cloud.rows.get('budgetV23').payload.pots, { boodschappen: 45000, vakantie: 15000 });
});

test('F3. oplossen met netwerkuitval vóór de server: blijft wachtend en geblokkeerd; daarna één bevestigde versie', async () => {
  const { cloud, kees, daphne } = await conflictOnPct();
  const v0 = cloud.rows.get('budgetV23').version;
  const res = await daphne.resolve('budgetV23', { pct: 'local' });
  assert.equal(res.ok, true); assert.equal(daphne.data.budgetV23.pct, 60);
  cloud.failNextPut('before-commit');
  await daphne.sync();
  let [rec] = await daphne.fin.list();
  assert.equal(rec.status, 'resolved-pending', 'niet verwijderd zonder serverbevestiging');
  assert.equal(cloud.rows.get('budgetV23').version, v0);
  await daphne.sync();
  assert.deepEqual(await daphne.fin.list(), [], 'pas na bevestiging en vastgelegde administratie weg');
  assert.equal(cloud.rows.get('budgetV23').version, v0 + 1); assert.equal(cloud.rows.get('budgetV23').payload.pct, 60);
  assert.equal(daphne.bases.budgetV23.version, v0 + 1);
  await kees.sync(); assert.equal(kees.data.budgetV23.pct, 60, 'Kees ontvangt de gekozen waarde');
});

test('F3b. netwerkuitval ná de server (antwoord kwijt): volgende ronde bevestigt zonder tweede mutatie', async () => {
  const { cloud, daphne } = await conflictOnPct();
  const v0 = cloud.rows.get('budgetV23').version;
  await daphne.resolve('budgetV23', { pct: 'local' });
  cloud.failNextPut('after-commit');
  await daphne.sync();
  assert.equal(cloud.rows.get('budgetV23').version, v0 + 1);
  assert.equal((await daphne.fin.list())[0].status, 'resolved-pending');
  const r = await daphne.sync();
  assert.equal(cloud.rows.get('budgetV23').version, v0 + 1, 'geen tweede versie');
  assert.ok(!r.outcomes.some(o => o.pushed));
  assert.deepEqual(await daphne.fin.list(), []);
});

test('F4a. browsercrash na vastleggen van de keuze maar vóór lokaal opslaan: na herstart alsnog toegepast', async () => {
  const { cloud, daphne } = await conflictOnPct();
  await daphne.resolve('budgetV23', { pct: 'remote' }, { skipLocalSave: true });
  assert.equal(daphne.data.budgetV23.pct, 60, 'lokale waarde nog de oude (crash)');
  const restarted = daphne.restart();
  assert.equal((await restarted.fin.list())[0].status, 'resolved-pending', 'keuze overleeft herstart');
  await restarted.sync();
  assert.equal(restarted.data.budgetV23.pct, 40);
  assert.equal(cloud.rows.get('budgetV23').payload.pct, 40);
  assert.deepEqual(await restarted.fin.list(), []);
});

test('F4b. crash na serverbevestiging maar vóór vastleggen administratie: record blijft, daarna afgerond zonder extra versie', async () => {
  const { cloud, daphne } = await conflictOnPct();
  await daphne.resolve('budgetV23', { pct: 'local' });
  daphne.failWriteBases = 1;
  const r = await daphne.sync();
  assert.equal(r.commit.committed, false);
  const v = cloud.rows.get('budgetV23').version;
  const [rec] = await daphne.fin.list();
  assert.equal(rec.status, 'confirmed', 'server bevestigd, maar nog niet verwijderd');
  const restarted = daphne.restart();
  await restarted.sync(); await restarted.sync();
  assert.deepEqual(await restarted.fin.list(), []);
  assert.equal(cloud.rows.get('budgetV23').version, v, 'geen extra versie');
  assert.equal(restarted.bases.budgetV23.version, v);
});

test('F5. opnieuw synchroniseren na herstel: beide gebruikers gelijk; volgende wijzigingen lopen weer normaal', async () => {
  const { cloud, kees, daphne } = await conflictOnPct();
  await daphne.resolve('budgetV23', { pct: 'local' });
  await daphne.sync(); await kees.sync();
  assert.deepEqual(kees.data.budgetV23, daphne.data.budgetV23);
  kees.data.budgetV23.pots.vakantie = 20000; await kees.sync();
  const r = await daphne.sync();
  assert.equal(r.status, 'ok'); assert.equal(daphne.data.budgetV23.pots.vakantie, 20000);
  assert.deepEqual(await daphne.fin.list(), []);
  assert.equal(cloud.rows.get('budgetV23').payload.pct, 60);
});

test('F5b. oude offline kopie van een ander apparaat introduceert het opgeloste conflict niet stil opnieuw', async () => {
  const { cloud, kees, daphne } = await household();
  const laptop = device(cloud, KEES); await laptop.sync();            // Kees' laptop, daarna offline
  kees.data.budgetV23.pct = 40; daphne.data.budgetV23.pct = 60;
  await kees.sync(); await daphne.sync();
  await daphne.resolve('budgetV23', { pct: 'local' }); await daphne.sync();
  laptop.data.budgetV23.pct = 40;                                       // offline dezelfde (afgewezen) wijziging
  const r = await laptop.sync();
  assert.equal(r.status, 'conflict');
  assert.equal(cloud.rows.get('budgetV23').payload.pct, 60, 'opgeloste waarde blijft staan');
  const [rec] = await laptop.fin.list();
  assert.equal(rec.local.pct, 40); assert.equal(rec.remote.pct, 60);
});

test('F5c. oude kopie op hetzelfde apparaat (afgewezen waarde komt terug) → geblokkeerd met nieuw conflict', async () => {
  const { cloud, daphne } = await conflictOnPct();
  await daphne.resolve('budgetV23', { pct: 'local' }); await daphne.sync();     // gekozen 60, afgewezen 40
  const v = cloud.rows.get('budgetV23').version;
  daphne.data.budgetV23.pct = 40;                                                // bijv. oud tabblad of teruggezette back-up
  await daphne.sync();
  const [rec] = await daphne.fin.list();
  assert.equal(rec.origin, 'reintroduction'); assert.deepEqual(rec.forcedPaths, ['pct']);
  assert.equal(cloud.rows.get('budgetV23').version, v, 'niet geüpload');
  // Bewust bevestigen kan: kies expliciet de lokale waarde.
  await daphne.resolve('budgetV23', { pct: 'local' }); await daphne.sync();
  assert.equal(cloud.rows.get('budgetV23').payload.pct, 40);
});

test('F6. twee tabbladen lossen hetzelfde conflict op: atomair; zelfde keuze idempotent, andere keuze geweigerd', async () => {
  const { daphne } = await conflictOnPct();
  const tab2 = device(fakeCloud(), DAPHNE, { idb: daphne.idb, storage: daphne.storage });
  const local = daphne.data.budgetV23;
  const [a, b] = await Promise.all([
    daphne.fin.resolve({ section: 'budgetV23', choices: { pct: 'remote' }, currentLocal: local, actor: DAPHNE }),
    tab2.fin.resolve({ section: 'budgetV23', choices: { pct: 'remote' }, currentLocal: local, actor: DAPHNE })
  ]);
  assert.ok(a.ok && b.ok); assert.equal([a, b].filter(x => x.idempotent).length, 1, 'één echte oplossing');
  assert.equal(a.record.resolution.id, b.record.resolution.id);
  const c = await tab2.fin.resolve({ section: 'budgetV23', choices: { pct: 'local' }, currentLocal: local, actor: DAPHNE });
  assert.equal(c.ok, false); assert.equal(c.reason, 'already-resolved');
  assert.equal((await daphne.fin.audit()).filter(x => x.action === 'resolved').length, 1);
});

test('F7. conflict tussen twee echte gebruikers: gebruikers-id\'s en volgorde vastgelegd; beide kanten zien hetzelfde eindresultaat', async () => {
  const { kees, daphne, cloud } = await household();
  kees.data.budgetV23.pots.boodschappen = 41000; daphne.data.budgetV23.pots.boodschappen = 43000;
  await daphne.sync(); await kees.sync();                                // nu Daphne eerst
  const [rec] = await kees.fin.list();
  assert.equal(rec.localUser, KEES); assert.equal(rec.remoteUpdatedBy, DAPHNE);
  assert.deepEqual(await daphne.fin.list(), [], 'de eerste schrijver heeft geen conflict');
  await kees.resolve('budgetV23', { 'pots.boodschappen': 'remote' }); await kees.sync(); await daphne.sync();
  assert.equal(kees.data.budgetV23.pots.boodschappen, 43000); assert.equal(daphne.data.budgetV23.pots.boodschappen, 43000);
  assert.equal(cloud.rows.get('budgetV23').payload.pots.boodschappen, 43000);
});

test('F8. financieel conflict wordt nooit ongemerkt overschreven (ook niet via "samenvoegen" of keuzeknoppen)', async () => {
  // a) runAccountSync: geforceerd samenvoegen laat bij een beschermd onderdeel de cloud niet winnen.
  const cloud = fakeCloud();
  cloud.rows.set('budgetV23', { payload: { pct: 40 }, version: 2 });
  const out = await HS.runAccountSync({ cloud, householdId: 'h', local: { budgetV23: { pct: 60 } }, base: { budgetV23: { version: 1, hash: HS.hashValue({ pct: 50 }) } }, baseValues: { budgetV23: { pct: 50 } },
    resolutions: { budgetV23: 'merge' }, encrypt: async v => v, decrypt: async p => p, protectedSections: ['budgetV23'] });
  assert.equal(out.status, 'conflict'); assert.equal(cloud.rows.get('budgetV23').payload.pct, 40);
  // b) apparaat: "Cloudversie"/"Mijn versie" via de algemene keuze wordt voor financieel genegeerd.
  const h = await conflictOnPct();
  await h.daphne.sync({ resolutions: { budgetV23: 'local' } });
  assert.equal(h.cloud.rows.get('budgetV23').payload.pct, 40);
  await h.daphne.sync({ resolutions: { budgetV23: 'remote' } });
  assert.equal(h.daphne.data.budgetV23.pct, 60);
  // c) onvolledige keuze wordt geweigerd.
  h.kees.data.budgetV23.pots.vakantie = 1; h.daphne.data.budgetV23.pots.vakantie = 2;
  const r = await h.daphne.resolve('budgetV23', {});
  assert.equal(r.ok, false); assert.equal(r.reason, 'missing-choices');
  // d) broncode: account-sync en app.js routeren financieel via de expliciete keuze.
  const acct = fs.readFileSync(__dirname + '/account-sync.js', 'utf8'), app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  assert.match(acct, /generalResolutions = Object\.fromEntries\(Object\.entries\(resolutions \|\| \{\}\)\.filter\(\(\[s\]\) => !isFinancialSection\(s\)\)\)/);
  assert.match(acct, /frozen: fin\.frozen, protectedSections:/);
  assert.match(acct, /commit\.committed && commit\.durability !== 'session'/, 'afronden alleen na duurzame vastlegging');
  assert.match(app, /FIN\.open\(\{\s*scope, section, origin: 'tab'/);
});

test('F9. conflicten blijven na browserherstart behouden en blijven blokkeren', async () => {
  const { cloud, daphne } = await conflictOnPct();
  const restarted = daphne.restart();
  const [rec] = await restarted.fin.list();
  assert.equal(rec.status, 'open'); assert.equal(rec.local.pct, 60);
  const v = cloud.rows.get('budgetV23').version;
  await restarted.sync();
  assert.equal(cloud.rows.get('budgetV23').version, v);
});

test('F10. audit bevat geen bedragen; na afronding staan er geen financiële waarden meer in de conflictopslag', async () => {
  const { daphne } = await household();
  const cloud2 = fakeCloud();
  const k = device(cloud2, KEES), d = device(cloud2, DAPHNE);
  k.data = { budgetV23: { pots: { geheim: 987654 } } }; await k.sync(); await d.sync();
  k.data.budgetV23.pots.geheim = 123457; d.data.budgetV23.pots.geheim = 765433;
  await k.sync(); await d.sync();
  await d.resolve('budgetV23', { 'pots.geheim': 'local' }); await d.sync();
  const audit = await d.fin.audit();
  assert.deepEqual(audit.map(a => a.action), ['detected', 'resolved', 'confirmed']);
  const text = JSON.stringify(audit);
  for (const amount of ['987654', '123457', '765433']) assert.ok(!text.includes(amount), 'bedrag in audit: ' + amount);
  assert.ok(audit.every(a => a.paths.includes('pots.geheim') && a.actor === DAPHNE));
  assert.deepEqual(await d.fin.list(), []);
  const rest = JSON.stringify([...(await d.meta.listRecords('finance-guard')), ...(await d.meta.listRecords('finance'))]);
  for (const amount of ['987654', '123457', '765433']) assert.ok(!rest.includes(amount));
  void daphne;
});

test('F11. cloud wijzigt opnieuw tussen keuze en upload: ander veld → samengevoegd verstuurd; zelfde veld → opnieuw open', async () => {
  let h = await conflictOnPct();
  await h.daphne.resolve('budgetV23', { pct: 'local' });
  h.kees.data.budgetV23.pots.vakantie = 30000; await h.kees.sync();
  await h.daphne.sync();
  assert.deepEqual(await h.daphne.fin.list(), []);
  assert.deepEqual(h.cloud.rows.get('budgetV23').payload, { pct: 60, pots: { boodschappen: 40000, vakantie: 30000 } });

  h = await conflictOnPct();
  await h.daphne.resolve('budgetV23', { pct: 'local' });
  h.kees.data.budgetV23.pct = 45; await h.kees.sync();
  await h.daphne.sync();
  const [rec] = await h.daphne.fin.list();
  assert.equal(rec.status, 'open', 'opnieuw een expliciete keuze nodig');
  assert.equal(rec.local.pct, 60); assert.equal(rec.remote.pct, 45);
  assert.equal(h.cloud.rows.get('budgetV23').payload.pct, 45);
  assert.ok((await h.daphne.fin.audit()).some(a => a.action === 'reopened'));
});

test('F12. hetzelfde conflict twee keer gemeld → één record en één detectie in de audit (idempotent)', async () => {
  const { daphne } = await conflictOnPct();
  const [rec] = await daphne.fin.list();
  const again = await daphne.fin.open({ section: 'budgetV23', origin: 'sync', base: rec.base, local: rec.local, remote: rec.remote, remoteVersion: rec.remoteVersion });
  assert.equal(again.created, false);
  assert.equal((await daphne.fin.list()).length, 1);
  assert.equal((await daphne.fin.audit()).filter(a => a.action === 'detected').length, 1);
});

test('F13. tabbladconflict op financieel veld: record (origin tab), upload geblokkeerd, oplossen via keuze en serverbevestiging', async () => {
  const { cloud, daphne } = await household();
  const v = cloud.rows.get('budgetV23').version;
  // Zoals app.js bij een tabbladconflict: basis, deze en de andere waarde.
  daphne.data.budgetV23.pct = 70;
  await daphne.fin.open({ section: 'budgetV23', origin: 'tab', base: budget(), local: daphne.data.budgetV23, remote: budget({ pct: 30 }), localUser: DAPHNE, forcedPaths: ['pct'] });
  await daphne.sync();
  assert.equal(cloud.rows.get('budgetV23').version, v, 'geblokkeerd');
  await daphne.resolve('budgetV23', { pct: 'remote' });
  assert.equal(daphne.data.budgetV23.pct, 30);
  await daphne.sync();
  assert.equal(cloud.rows.get('budgetV23').payload.pct, 30);
  assert.deepEqual(await daphne.fin.list(), []);
});

test('F3c. cloudwaarde gekozen: die staat al op de server → bevestigd zonder upload, record afgerond', async () => {
  const { cloud, daphne } = await conflictOnPct();
  const v0 = cloud.rows.get('budgetV23').version;
  await daphne.resolve('budgetV23', { pct: 'remote' });
  const r = await daphne.sync();
  assert.ok(!r.outcomes.some(o => o.pushed)); assert.equal(cloud.rows.get('budgetV23').version, v0);
  assert.deepEqual(await daphne.fin.list(), []); assert.equal(daphne.bases.budgetV23.version, v0);
});
