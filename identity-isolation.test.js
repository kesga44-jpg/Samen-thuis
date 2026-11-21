// Opdracht 6: lokale gegevensisolatie per account en huishouden (identity-store-core.js) en financiële opslagroutes.
// Nagebootste localStorage; de echte browseropslag wordt getest in e2e/identity-isolation.mjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const IS = require('./identity-store-core.js');
const HS = require('./household-sync-core.js');
const FC = require('./finance-conflict-core.js');
const SM = require('./sync-meta-store.js');
const { memoryStorage, fakeIndexedDB } = require('./test-fixtures/sync-fakes.js');

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const H1 = '11111111-1111-4111-8111-111111111111', H2 = '22222222-2222-4222-8222-222222222222';
const sport = { library: [{ id: 'sc1', title: 'Hardlopen' }], evaluations: [{ id: 'e1' }] };
const v2Data = () => ({ meta: { version: 2 }, groceries: [{ id: 'g1', title: 'A-melk' }], budgetV23: { pct: 50 }, sportCoach: sport, settings: { weatherPlace: 'Utrecht' } });
const login = (st, uid) => st.setItem(IS.AUTH_KEY, JSON.stringify({ access_token: 't', user: { id: uid } }));
const logout = st => st.removeItem(IS.AUTH_KEY);
function device({ legacyCfg = null, v2 = v2Data() } = {}) {
  const st = memoryStorage();
  if (v2) st.setItem(IS.LEGACY_KEY, JSON.stringify(v2));
  if (legacyCfg) st.setItem(IS.CFG_KEY, JSON.stringify(legacyCfg));
  return st;
}
const snapshot = st => new Map(st.map);

test('I1. zonder accountsync: oude dataset blijft het lokale profiel; niets gekopieerd of gewijzigd', () => {
  const st = device();
  const before = st.getItem(IS.LEGACY_KEY);
  assert.equal(IS.migrateLegacy(st).action, 'local');
  login(st, A);
  const id = IS.resolve(st);
  assert.equal(id.mode, 'local'); assert.equal(id.key, IS.LEGACY_KEY);
  assert.equal(st.getItem(IS.LEGACY_KEY), before);
  assert.deepEqual(IS.keysFor(id).storageKey, IS.LEGACY_KEY, 'oude sleutelnamen blijven voor het lokale profiel');
});

test('I2. één aantoonbare identiteit: kopie naar die identiteit, zonder SportCoach/settings; oude dataset blijft staan', () => {
  const st = device({ legacyCfg: { enabled: true, householdId: H1, bases: { [`${A}:${H1}`]: { base: {} } } } });
  const before = st.getItem(IS.LEGACY_KEY);
  const r = IS.migrateLegacy(st);
  assert.equal(r.action, 'bound');
  const target = JSON.parse(st.getItem(IS.accountKey(A, H1)));
  assert.equal(target.groceries[0].title, 'A-melk');
  assert.equal(target.sportCoach, undefined, 'SportCoach blijft apparaatgebonden');
  assert.equal(target.settings, undefined);
  assert.equal(st.getItem(IS.LEGACY_KEY), before, 'oude dataset niet gewijzigd of verwijderd');
  login(st, A);
  assert.deepEqual(IS.resolve(st), { mode: 'account', accountId: A, householdId: H1, key: IS.accountKey(A, H1), scope: `${A}:${H1}` });
  logout(st);
  assert.equal(IS.resolve(st).key, IS.LOCAL_V3, 'afgemeld: niet de gegevens van A, maar een apart lokaal profiel');
  assert.equal(IS.migrateLegacy(st).action, 'none', 'herhaalbaar');
});

test('I3. meerdere identiteiten of twijfel: quarantaine, niets gekoppeld, niets gewijzigd; nooit aan het volgende account', () => {
  const st = device({ legacyCfg: { enabled: true, householdId: H1, bases: { [`${A}:${H1}`]: {}, [`${B}:${H2}`]: {} } } });
  const before = st.getItem(IS.LEGACY_KEY);
  assert.equal(IS.migrateLegacy(st).action, 'quarantined');
  assert.equal(st.getItem(IS.accountKey(A, H1)), null); assert.equal(st.getItem(IS.accountKey(B, H2)), null);
  assert.equal(st.getItem(IS.LEGACY_KEY), before);
  login(st, B);
  const id = IS.resolve(st);
  assert.equal(id.key, IS.accountKey(B, H2), 'B krijgt een eigen (lege) dataset, niet de quarantaine');
  assert.deepEqual(IS.retained(st).map(r => r.status), ['quarantaine']);
  // Accountsync ingeschakeld maar geen enkele identiteit in de administratie: ook quarantaine.
  const st2 = device({ legacyCfg: { enabled: true } });
  assert.equal(IS.migrateLegacy(st2).action, 'quarantined');
});

test('I4. migratie is crashbestendig: hervatten na kopie, opnieuw kopiëren als het doel ontbreekt, nooit overschrijven', () => {
  const cfg = { enabled: true, householdId: H1, bases: { [`${A}:${H1}`]: {} } };
  // a) crash na schrijven doel, vóór "bound"
  let st = device({ legacyCfg: cfg });
  const content = JSON.stringify(IS.withoutDeviceFields(v2Data()));
  st.setItem(IS.accountKey(A, H1), content);
  st.setItem(IS.JOURNAL_KEY, JSON.stringify({ v2: 'copying', target: IS.accountKey(A, H1), sourceHash: 'x' }));
  // sourceHash in het journaal wordt opnieuw berekend; doel gelijk aan bron → hervat
  let r = IS.migrateLegacy(st);
  assert.ok(['bound', 'quarantined'].includes(r.action));
  st = device({ legacyCfg: cfg });
  const first = IS.migrateLegacy(st);                   // normaal
  assert.equal(first.action, 'bound');
  st.setItem(IS.JOURNAL_KEY, JSON.stringify({ v2: 'copying', target: first.journal.target, sourceHash: first.journal.sourceHash }));
  r = IS.migrateLegacy(st);
  assert.equal(r.action, 'bound'); assert.equal(r.resumed, true);
  // b) crash vóór schrijven doel
  st = device({ legacyCfg: cfg });
  st.setItem(IS.JOURNAL_KEY, JSON.stringify({ v2: 'copying', target: IS.accountKey(A, H1) }));
  assert.equal(IS.migrateLegacy(st).action, 'bound');
  // c) doel bestaat al met andere inhoud → nooit overschrijven
  st = device({ legacyCfg: cfg });
  st.setItem(IS.accountKey(A, H1), JSON.stringify({ groceries: [{ id: 'eigen' }] }));
  assert.equal(IS.migrateLegacy(st).action, 'quarantined');
  assert.equal(JSON.parse(st.getItem(IS.accountKey(A, H1))).groceries[0].id, 'eigen');
  // d) onleesbare oude dataset → quarantaine, ongewijzigd
  st = device({ legacyCfg: cfg, v2: null }); st.setItem(IS.LEGACY_KEY, '{kapot');
  assert.equal(IS.migrateLegacy(st).action, 'quarantined'); assert.equal(st.getItem(IS.LEGACY_KEY), '{kapot');
});

test('I5. accountsync per account; zonder huishouden "locked" (geen dataset, geen standaardset)', () => {
  const st = device();
  IS.migrateLegacy(st);
  login(st, A);
  IS.setAccount(st, A, { enabled: true });
  const id = IS.resolve(st);
  assert.equal(id.mode, 'locked'); assert.equal(id.key, null);
  assert.ok(!IS.keysFor(id).storageKey.startsWith(IS.LEGACY_KEY));
  login(st, B);
  assert.equal(IS.resolve(st).mode, 'local', 'accountsync van A geldt niet voor B');
});

test('I6. expliciete koppeling bij inschakelen: alleen als het doel leeg is; lokaal profiel daarna niet meer van dit account', () => {
  const st = device();
  IS.migrateLegacy(st);
  let r = IS.bindLocalToAccount(st, { accountId: A, householdId: H1 });
  assert.equal(r.bound, true);
  assert.equal(JSON.parse(st.getItem(IS.accountKey(A, H1))).groceries[0].title, 'A-melk');
  assert.equal(IS.resolve(st).key, IS.LOCAL_V3, 'lokaal profiel is nu een ander, leeg profiel');
  r = IS.bindLocalToAccount(st, { accountId: A, householdId: H1 });
  assert.equal(r.bound, false); assert.equal(r.reason, 'bestaat-al');
  // Tweede account koppelt een nieuw lokaal profiel; het oude lokale profiel wordt gearchiveerd, niet gewist.
  st.setItem(IS.LOCAL_V3, JSON.stringify({ groceries: [{ id: 'lokaal2' }] }));
  r = IS.bindLocalToAccount(st, { accountId: B, householdId: H2 });
  assert.equal(r.bound, true); assert.equal(st.getItem(IS.LOCAL_V3), null);
  assert.ok(IS.retained(st).some(x => x.status === 'archief'));
});

test('I7. sleutels voor opslag en herstel zijn per identiteit gescheiden (geen gedeelde back-up- of herstelvlag)', () => {
  const a = IS.keysFor({ mode: 'account', accountId: A, householdId: H1, key: IS.accountKey(A, H1) });
  const b = IS.keysFor({ mode: 'account', accountId: B, householdId: H1, key: IS.accountKey(B, H1) });
  const local = IS.keysFor({ mode: 'local', key: IS.LEGACY_KEY });
  for (const k of ['storageKey', 'corruptKey', 'preRestoreKey', 'restoreHoldKey', 'preSyncKey']) {
    assert.notEqual(a[k], b[k], k); assert.notEqual(a[k], local[k], k);
  }
  assert.equal(a.backupKey, null, 'geen extra volledige kopie per identiteit');
});

test('I8. back-up van A wordt niet aan B gekoppeld; lokale/oude back-ups alleen als expliciete actie; vergrendeld nooit', () => {
  const backupA = JSON.stringify({ meta: { exportIdentity: { mode: 'account', accountId: A, householdId: H1 } }, groceries: [] });
  const idA = { mode: 'account', accountId: A, householdId: H1 }, idB = { mode: 'account', accountId: B, householdId: H2 };
  assert.equal(IS.backupAllowed(backupA, idA).ok, true);
  assert.deepEqual(IS.backupAllowed(backupA, idB), { ok: false, reason: 'other-identity' });
  assert.equal(IS.backupAllowed(backupA, { mode: 'account', accountId: A, householdId: H2 }).ok, false, 'ander huishouden');
  assert.equal(IS.backupAllowed(backupA, { mode: 'local' }).ok, false);
  assert.equal(IS.backupAllowed(JSON.stringify({ groceries: [] }), idB).ok, true, 'oud formaat: alleen via expliciete gebruikersactie');
  assert.equal(IS.backupAllowed(JSON.stringify({}), { mode: 'locked' }).ok, false);
});

test('I9. onbekende legacygegevens blijven behouden en worden door geen enkele identiteit geladen', () => {
  const st = device({ legacyCfg: { enabled: true, bases: { [`${A}:${H1}`]: {}, [`${A}:${H2}`]: {} } } });
  const before = snapshot(st).get(IS.LEGACY_KEY);
  IS.migrateLegacy(st);
  for (const [uid, hh] of [[A, H1], [A, H2], [B, H2]]) {
    login(st, uid); IS.setAccount(st, uid, { enabled: true, householdId: hh });
    const id = IS.resolve(st);
    assert.notEqual(id.key, IS.LEGACY_KEY);
    assert.equal(st.getItem(id.key), null, 'geen gegevens uit quarantaine in een accountdataset');
  }
  logout(st);
  assert.equal(IS.resolve(st).key, IS.LOCAL_V3);
  assert.equal(st.getItem(IS.LEGACY_KEY), before);
});

test('I10. twee accounts in hetzelfde huishouden: elk een eigen dataset en eigen herstelsleutels', () => {
  const st = device();
  IS.migrateLegacy(st);
  IS.setAccount(st, A, { enabled: true, householdId: H1 }); IS.setAccount(st, B, { enabled: true, householdId: H1 });
  login(st, A); const a = IS.resolve(st);
  login(st, B); const b = IS.resolve(st);
  assert.notEqual(a.key, b.key); assert.equal(a.householdId, b.householdId);
});

test('I11. SportCoach: migratie, koppeling en apparaatvelden laten samenThuisDataV2.sportCoach ongewijzigd', () => {
  const st = device({ legacyCfg: { enabled: true, householdId: H1, bases: { [`${A}:${H1}`]: {} } } });
  const sportBefore = JSON.stringify(JSON.parse(st.getItem(IS.LEGACY_KEY)).sportCoach);
  IS.migrateLegacy(st);
  IS.bindLocalToAccount(st, { accountId: B, householdId: H2 });
  assert.equal(JSON.stringify(JSON.parse(st.getItem(IS.LEGACY_KEY)).sportCoach), sportBefore);
  assert.deepEqual(IS.readDeviceFields(st).sportCoach, sport);
  for (const k of [...st.map.keys()].filter(k => k.startsWith(IS.V3))) assert.ok(!st.getItem(k).includes('Hardlopen'), 'SportCoach nooit in een identiteitsdataset: ' + k);
});

test('I12a. finance_config: gelijktijdige wijzigingen aan verschillende velden samengevoegd; zelfde veld → niets geschreven', async () => {
  let row = { finance_config: { pots: [{ id: 'p1', name: 'Kleding', cents: 100 }], expenses: [] }, updated_at: 't1' };
  const writes = [];
  const io = {
    fetchRow: async () => JSON.parse(JSON.stringify(row)),
    patchIf: async (value, updatedAt) => { if (updatedAt !== row.updated_at) return null; row = { finance_config: value, updated_at: 't' + (writes.push(value) + 1) }; return row; },
    insertIfAbsent: async () => null, merge3: HS.merge3, hashValue: HS.hashValue
  };
  const base = JSON.parse(JSON.stringify(row.finance_config));
  // Ander apparaat voegt een uitgave toe.
  row = { finance_config: { ...base, expenses: [{ id: 'x1', amountCents: 500 }] }, updated_at: 't9' };
  let r = await FC.savePersonalConfig({ ...io, base, local: { ...base, pots: [{ id: 'p1', name: 'Kleding', cents: 150 }] } });
  assert.equal(r.ok, true); assert.equal(r.merged, true);
  assert.deepEqual(row.finance_config, { pots: [{ id: 'p1', name: 'Kleding', cents: 150 }], expenses: [{ id: 'x1', amountCents: 500 }] });
  // Zelfde veld op twee apparaten anders.
  const base2 = JSON.parse(JSON.stringify(row.finance_config));
  row = { finance_config: { ...base2, pots: [{ id: 'p1', name: 'Kleding', cents: 175 }] }, updated_at: 't10' };
  const n = writes.length;
  r = await FC.savePersonalConfig({ ...io, base: base2, local: { ...base2, pots: [{ id: 'p1', name: 'Kleding', cents: 160 }] } });
  assert.equal(r.ok, false); assert.deepEqual(r.conflict.paths, ['pots[p1].cents']);
  assert.equal(writes.length, n, 'niets geschreven'); assert.equal(row.finance_config.pots[0].cents, 175);
});

test('I12b. finance_config: race (rij intussen gewijzigd) → opnieuw lezen en samenvoegen; zonder basis nooit overschrijven', async () => {
  let row = { finance_config: { pots: [], expenses: [] }, updated_at: 'a' };
  let raceOnce = true;
  const io = {
    fetchRow: async () => JSON.parse(JSON.stringify(row)),
    patchIf: async (value, at) => {
      if (raceOnce) { raceOnce = false; row = { finance_config: { pots: [], expenses: [{ id: 'other' }] }, updated_at: 'b' }; return null; }
      if (at !== row.updated_at) return null; row = { finance_config: value, updated_at: 'c' }; return row;
    },
    insertIfAbsent: async () => null, merge3: HS.merge3, hashValue: HS.hashValue
  };
  const r = await FC.savePersonalConfig({ ...io, base: { pots: [], expenses: [] }, local: { pots: [{ id: 'mine' }], expenses: [] } });
  assert.equal(r.ok, true);
  assert.deepEqual(row.finance_config, { pots: [{ id: 'mine' }], expenses: [{ id: 'other' }] });
  const noBase = await FC.savePersonalConfig({ ...io, base: undefined, local: { pots: [], expenses: [] } });
  assert.equal(noBase.ok, false, 'onbekende basis en niet-lege serverwaarde: keuze nodig');
});

test('I12c. fuelEntries is financieel: hetzelfde tankbedrag tegelijk gewijzigd → financieel record, niet geüpload', async () => {
  assert.equal(FC.isFinancialSection('fuelEntries'), true);
  const meta = SM.createSyncMetaStore({ indexedDB: fakeIndexedDB(), storage: memoryStorage(), hashValue: HS.hashValue });
  const fin = FC.createFinanceConflicts({ store: meta, merge3: HS.merge3, hashValue: HS.hashValue }).scoped(`${A}:${H1}`);
  const base = [{ id: 'f1', total: 60 }];
  const raw = { status: 'conflict', pulls: {}, base: {}, baseValues: {}, pushed: [], conflicts: [{ section: 'fuelEntries', local: [{ id: 'f1', total: 61 }], remote: [{ id: 'f1', total: 65 }], remoteVersion: 3 }], remoteState: { fuelEntries: { version: 3, value: [{ id: 'f1', total: 65 }], updatedBy: B } } };
  const out = await fin.afterRound({ raw, records: [], snapshot: { fuelEntries: [{ id: 'f1', total: 61 }] }, prevBase: { fuelEntries: { version: 2, hash: HS.hashValue(base) } }, prevBaseValues: { fuelEntries: base }, cloud: {}, householdId: H1, encrypt: async v => v, actor: A });
  assert.deepEqual(out.result.conflicts, [], 'uit de algemene keuzelijst');
  const [rec] = await fin.list();
  assert.equal(rec.section, 'fuelEntries');
  assert.deepEqual(fin.view(rec, [{ id: 'f1', total: 61 }]).map(p => [p.path, p.base, p.local, p.remote]), [['[f1].total', 60, 61, 65]]);
});

test('I13. bronbestanden: identiteit vóór lezen/schrijven/synchroniseren; geen last-write-wins voor finance_config', () => {
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8'), acct = fs.readFileSync(__dirname + '/account-sync.js', 'utf8'), ui = fs.readFileSync(__dirname + '/finance-ui.js', 'utf8');
  assert.match(app, /const STORAGE_KEY = IDENTITY_KEYS\.storageKey;/);
  assert.match(app, /if \(DATA_LOCKED \|\| identitySwitching\) return false;/, 'schrijven geblokkeerd zonder identiteit of tijdens wissel');
  assert.match(app, /IDENTITY_STORE\.backupAllowed\(text, ACTIVE_IDENTITY\)/);
  assert.match(app, /id\.mode !== 'account' \|\| !householdId \|\| id\.householdId !== householdId/, 'serververdelingen alleen in het juiste huishouden');
  assert.equal((acct.match(/assertIdentity\(\);/g) || []).length >= 5, true, 'identiteit gecontroleerd vóór elke schrijfstap');
  assert.match(acct, /const accountMode = \(\) => !!\(AUTH\.session\(\)\?\.user\?\.id && accountCfg\(\)\?\.enabled\);/);
  assert.doesNotMatch(ui, /resolution=merge-duplicates,return=minimal'[^\n]*finance_config/, 'geen blinde upsert van finance_config');
  assert.match(ui, /updated_at=eq\.\$\{encodeURIComponent\(updatedAt\)\}/);
  const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
  assert.ok(html.indexOf('identity-store-core.js') < html.indexOf('app.js?'), 'identiteit geladen vóór app.js');
});
