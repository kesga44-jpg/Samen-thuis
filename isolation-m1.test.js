// M1 (opdracht 7, vervolg): oude financiële apparaatconflicten (zonder localKey) mogen door een identiteitsmigratie nooit
// verdwijnen of hun beschermende werking verliezen. Nagebootste IndexedDB/localStorage en nagebootste cloud (zelfde
// volgorde als account-sync.js); de echte browser staat in e2e/isolation-v7.mjs (M1-browsercontroles).
const test = require('node:test');
const assert = require('node:assert/strict');
const IS = require('./identity-store-core.js');
const HS = require('./household-sync-core.js');
const FC = require('./finance-conflict-core.js');
const SM = require('./sync-meta-store.js');
const { memoryStorage, fakeIndexedDB, fakeCloud, cloudAs } = require('./test-fixtures/sync-fakes.js');

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const H1 = '11111111-1111-4111-8111-111111111111', H2 = '22222222-2222-4222-8222-222222222222';
const MIGRATED_AT = '2026-11-10T12:00:00.000Z', BEFORE = '2026-11-09T08:00:00.000Z', AFTER = '2026-11-11T08:00:00.000Z';

// Oud record zoals opdracht 5 het schreef: device-scope, geen localKey, open, met waarden.
function oldDeviceRecord(section = 'budgetV23', detectedAt = BEFORE) {
  const r = FC.newRecord({ scope: FC.DEVICE_SCOPE, section, origin: 'tab', base: { pct: 50 }, local: { pct: 61 }, remote: { pct: 39 }, forcedPaths: ['pct'], now: () => detectedAt });
  delete r.localKey;
  return r;
}
function setup({ journal = { v2: 'bound', target: IS.accountKey(A, H1), at: MIGRATED_AT }, records = [oldDeviceRecord()] } = {}) {
  const storage = memoryStorage();
  if (journal) storage.setItem(IS.JOURNAL_KEY, JSON.stringify(journal));
  const meta = SM.createSyncMetaStore({ indexedDB: fakeIndexedDB(), storage, hashValue: HS.hashValue });
  const core = FC.createFinanceConflicts({ store: meta, merge3: HS.merge3, hashValue: HS.hashValue });
  return { storage, meta, core, ready: Promise.all(records.map(r => meta.putRecord(r))) };
}
const classify = (core, storage) => core.classifyUntaggedDevice(r => IS.legacyRecordOwner(storage, r.detectedAt));

// Eén accountronde, in dezelfde volgorde als account-sync.js.
async function round({ core, meta }, user, hh, cloud, data) {
  const scope = FC.scopeFor(user, hh), FS = core.scoped(scope);
  const pre = await FS.beforeRound({ data, actor: user, householdId: hh });
  const snapshot = structuredClone(data);
  const tracked = SM.trackUploads(cloudAs(cloud, user), meta, scope, HS.classifyError);
  const raw = await HS.runAccountSync({ cloud: tracked, householdId: hh, local: snapshot, encrypt: async v => v, decrypt: async p => p, frozen: pre.frozen, protectedSections: [...FC.FINANCIAL_SECTIONS] });
  const fr = await FS.afterRound({ raw, records: pre.records, snapshot, cloud: tracked, householdId: hh, encrypt: async v => v, classify: HS.classifyError, actor: user });
  return { pre, result: fr.result };
}

test('M1-1. oud conflict zonder localKey blokkeert de upload in elke accountronde zolang het niet is gekoppeld', async () => {
  const ctx = setup({ journal: null });
  await ctx.ready;
  for (const [u, h] of [[A, H1], [B, H2]]) {
    const pre = await ctx.core.scoped(FC.scopeFor(u, h)).beforeRound({ data: { budgetV23: { pct: 61 } } });
    assert.deepEqual(pre.frozen, ['budgetV23'], `${u}: geblokkeerd`);
    assert.deepEqual(pre.records, [], 'niet zichtbaar als eigen conflict');
    assert.deepEqual(pre.fixes, [], 'geen waarde toegepast');
  }
  const [rec] = await ctx.core.list(FC.DEVICE_SCOPE);
  assert.equal(rec.status, 'open'); assert.equal(rec.local.pct, 61, 'waarden behouden');
});

test('M1-2. automatische migratie: conflict van vóór de koppeling gaat aantoonbaar naar het gekoppelde account', async () => {
  const ctx = setup();
  await ctx.ready;
  assert.deepEqual(IS.legacyRecordOwner(ctx.storage, BEFORE), { kind: 'account', key: IS.accountKey(A, H1), accountId: A, householdId: H1 });
  const out = await classify(ctx.core, ctx.storage);
  assert.deepEqual(out, { local: [], adopted: ['budgetV23'], unknown: [] });
  const [mine] = await ctx.core.list(FC.scopeFor(A, H1));
  assert.deepEqual([mine.status, mine.local.pct, mine.remote.pct, mine.base.pct, mine.adoptedBy], ['open', 61, 39, 50, 'identiteitsmigratie'], 'behouden, niets gekozen');
  assert.deepEqual(await ctx.core.list(FC.DEVICE_SCOPE), [], 'oud record pas weg na overname');
  assert.deepEqual((await ctx.core.scoped(FC.scopeFor(A, H1)).beforeRound({ data: { budgetV23: { pct: 61 } } })).frozen, ['budgetV23'], 'A: blijft geblokkeerd tot keuze');
  assert.deepEqual((await ctx.core.scoped(FC.scopeFor(B, H2)).beforeRound({ data: { budgetV23: { pct: 1 } } })).frozen, [], 'B: niet langer geraakt');
  assert.ok((await ctx.core.audit(FC.scopeFor(A, H1))).some(a => a.action === 'adopted'));
  assert.deepEqual(await classify(ctx.core, ctx.storage), { local: [], adopted: [], unknown: [] }, 'idempotent');
});

test('M1-2b. koppeling bestaat al voor dat onderdeel: niets overschreven, oud record blijft blokkeren (onbekend)', async () => {
  const ctx = setup();
  await ctx.ready;
  await ctx.core.open({ scope: FC.scopeFor(A, H1), section: 'budgetV23', origin: 'sync', base: { pct: 1 }, local: { pct: 2 }, remote: { pct: 3 } });
  assert.deepEqual(await classify(ctx.core, ctx.storage), { local: [], adopted: [], unknown: ['budgetV23'] });
  assert.equal((await ctx.core.list(FC.scopeFor(A, H1)))[0].local.pct, 2, 'bestaand record onaangetast');
  const [dev] = await ctx.core.list(FC.DEVICE_SCOPE);
  assert.deepEqual([dev.ownerUnknown, dev.ownerReason, dev.local.pct], [true, 'doel-heeft-al-conflict', 61]);
  assert.deepEqual((await ctx.core.scoped(FC.scopeFor(B, H2)).beforeRound({ data: {} })).frozen, ['budgetV23']);
});

test('M1-3. identiteit niet betrouwbaar vast te stellen: record blijft bewaard en blijft blokkeren', async () => {
  const cases = [
    ['quarantaine', { v2: 'quarantined', reason: 'meerdere-identiteiten', at: MIGRATED_AT }, BEFORE],
    ['geen-tijdstip', { v2: 'bound', target: IS.accountKey(A, H1), at: MIGRATED_AT }, ''],
    ['migratie-niet-afgerond', { v2: 'copying', target: IS.accountKey(A, H1), at: MIGRATED_AT }, BEFORE],
    ['migratietijdstip-onbekend', { v2: 'bound', target: IS.accountKey(A, H1) }, BEFORE]
  ];
  for (const [reason, journal, detectedAt] of cases) {
    const ctx = setup({ journal, records: [oldDeviceRecord('budgetV23', detectedAt)] });
    await ctx.ready;
    assert.deepEqual(await classify(ctx.core, ctx.storage), { local: [], adopted: [], unknown: ['budgetV23'] }, reason);
    const [dev] = await ctx.core.list(FC.DEVICE_SCOPE);
    assert.deepEqual([dev.ownerUnknown, dev.ownerReason, dev.status, dev.local.pct], [true, reason, 'open', 61], reason);
    for (const [u, h] of [[A, H1], [B, H2]]) assert.deepEqual((await ctx.core.scoped(FC.scopeFor(u, h)).beforeRound({ data: {} })).frozen, ['budgetV23'], `${reason}: ${u}`);
  }
  // Ontstaan in een lokaal profiel dat later zonder vastgelegd doel is gearchiveerd: ook onbekend.
  const ctx = setup({ journal: { v2: 'bound', target: IS.accountKey(A, H1), at: MIGRATED_AT }, records: [oldDeviceRecord('budgetV23', AFTER)] });
  ctx.storage.setItem(`${IS.V3}|local-archive|${Date.parse(AFTER) + 1000}`, '{}');
  await ctx.ready;
  assert.equal(IS.legacyRecordOwner(ctx.storage, AFTER).reason, 'archief-zonder-doel');
  assert.deepEqual((await classify(ctx.core, ctx.storage)).unknown, ['budgetV23']);
});

test('M1-3b. betrouwbaar lokaal: oorspronkelijk lokaal profiel of later lokaal profiel krijgt localKey en blokkeert accounts niet', async () => {
  let ctx = setup({ journal: { v2: 'local' } });
  await ctx.ready;
  assert.deepEqual((await classify(ctx.core, ctx.storage)).local, ['budgetV23']);
  assert.equal((await ctx.core.list(FC.DEVICE_SCOPE))[0].localKey, IS.LEGACY_KEY);
  assert.deepEqual((await ctx.core.scoped(FC.scopeFor(B, H2)).beforeRound({ data: {} })).frozen, []);
  ctx = setup({ records: [oldDeviceRecord('budgetV23', AFTER)] });
  await ctx.ready;
  assert.deepEqual(IS.legacyRecordOwner(ctx.storage, AFTER), { kind: 'local', key: IS.LOCAL_V3 });
  // Archief met vastgelegd doel ná het conflict: het conflict hoort bij dat doel.
  const archive = `${IS.V3}|local-archive|${Date.parse(AFTER) + 1000}`;
  ctx.storage.setItem(archive, '{}');
  ctx.storage.setItem(IS.JOURNAL_KEY, JSON.stringify({ v2: 'bound', target: IS.accountKey(A, H1), at: MIGRATED_AT, archives: { [archive]: IS.accountKey(B, H2) } }));
  assert.equal(IS.legacyRecordOwner(ctx.storage, AFTER).key, IS.accountKey(B, H2));
});

test('M1-4. poging tot upload terwijl het conflict openstaat: financieel onderdeel niet verstuurd, cloud ongewijzigd', async () => {
  for (const journal of [{ v2: 'bound', target: IS.accountKey(A, H1), at: MIGRATED_AT }, { v2: 'quarantined', at: MIGRATED_AT }]) {
    const ctx = setup({ journal });
    await ctx.ready;
    await classify(ctx.core, ctx.storage);
    const cloud = fakeCloud();
    cloud.rows.set('budgetV23', { payload: { pct: 39 }, version: 3 });
    const { pre, result } = await round(ctx, A, H1, cloud, { budgetV23: { pct: 61 }, groceries: [{ id: 'g', title: 'Melk' }] });
    assert.ok(pre.frozen.includes('budgetV23'), journal.v2);
    assert.deepEqual(cloud.rows.get('budgetV23').payload, { pct: 39 }, 'cloudwaarde ongewijzigd');
    assert.equal(cloud.rows.get('budgetV23').version, 3, 'geen upload');
    assert.ok(!result.pushed.includes('budgetV23') && result.pushed.includes('groceries'), 'overige onderdelen wel');
    assert.equal(result.pulls.budgetV23, undefined, 'ook geen cloudwaarde over de lokale waarde heen');
  }
});

test('M1-5. bewuste oplossing: gekoppeld conflict via keuze per veld; onbekend conflict alleen via vrijgave per identiteit', async () => {
  // a) Gekoppeld aan A: pas na een expliciete keuze wordt de gekozen waarde verstuurd.
  const ctx = setup();
  await ctx.ready;
  await classify(ctx.core, ctx.storage);
  const cloud = fakeCloud();
  cloud.rows.set('budgetV23', { payload: { pct: 39 }, version: 3 });
  const FS = ctx.core.scoped(FC.scopeFor(A, H1));
  assert.equal((await FS.resolve({ section: 'budgetV23', choices: {}, currentLocal: { pct: 61 } })).reason, 'missing-choices', 'nooit automatisch gekozen');
  const r = await FS.resolve({ section: 'budgetV23', choices: { pct: 'remote' }, currentLocal: { pct: 61 }, actor: A, pushBase: { version: 3, value: { pct: 39 } } });
  assert.equal(r.ok, true); assert.equal(r.value.pct, 39);
  await round(ctx, A, H1, cloud, { budgetV23: r.value });
  assert.deepEqual(cloud.rows.get('budgetV23').payload, { pct: 39 });
  // b) Onbekende herkomst: vrijgave door B geldt alleen voor B; geen waarde gekozen of gewijzigd; record blijft bewaard.
  const q = setup({ journal: { v2: 'quarantined', at: MIGRATED_AT } });
  await q.ready;
  await classify(q.core, q.storage);
  assert.equal((await q.core.releaseUnknown({ scope: FC.scopeFor(B, H2), section: 'budgetV23', actor: B })).ok, true);
  const cloudB = fakeCloud();
  const { pre } = await round(q, B, H2, cloudB, { budgetV23: { pct: 70 } });
  assert.deepEqual(pre.frozen, [], 'B: vrijgegeven');
  assert.deepEqual(cloudB.rows.get('budgetV23').payload, { pct: 70 }, 'de eigen waarde van B, niet die uit het conflict');
  assert.deepEqual((await q.core.scoped(FC.scopeFor(A, H1)).beforeRound({ data: {} })).frozen, ['budgetV23'], 'A: blijft geblokkeerd');
  const [dev] = await q.core.list(FC.DEVICE_SCOPE);
  assert.deepEqual([dev.status, dev.local.pct, dev.releasedFor], ['open', 61, [FC.scopeFor(B, H2)]]);
  assert.ok((await q.core.audit(FC.scopeFor(B, H2))).some(a => a.action === 'released'));
  assert.equal((await q.core.releaseUnknown({ scope: FC.scopeFor(B, H2), section: 'fuelEntries' })).ok, false);
  await assert.rejects(q.core.releaseUnknown({ scope: FC.DEVICE_SCOPE, section: 'budgetV23' }), /scope/, 'alleen een accountidentiteit kan vrijgeven');
});
