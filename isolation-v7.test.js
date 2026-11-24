// Opdracht 7: resterende isolatielekken (back-up/herstel, bewaarde gegevens, conflictlogboek, financiële apparaat-
// conflicten, huishoudcode per account + huishouden). Unit-niveau met nagebootste localStorage en IndexedDB; de echte
// browseropslag en vertraagde verzoeken worden getest in e2e/isolation-v7.mjs, echte PostgreSQL in migrations-pg.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const IS = require('./identity-store-core.js');
const HS = require('./household-sync-core.js');
const FC = require('./finance-conflict-core.js');
const SM = require('./sync-meta-store.js');
const DC = require('./data-core.js');
const { memoryStorage, fakeIndexedDB } = require('./test-fixtures/sync-fakes.js');

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const H1 = '11111111-1111-4111-8111-111111111111', H2 = '22222222-2222-4222-8222-222222222222';
const acct = (accountId, householdId) => ({ mode: 'account', accountId, householdId, key: IS.accountKey(accountId, householdId), scope: `${accountId}:${householdId}` });
const LOCAL = { mode: 'local', key: IS.LEGACY_KEY }, LOCAL_V3 = { mode: 'local', key: IS.LOCAL_V3 };
const backup = (meta, extra = {}) => JSON.stringify({ meta: { version: 2, ...meta }, groceries: [{ id: 'g', title: 'x' }], ...extra });

// ---------- 1. Back-up en herstel ----------
test('V1. herkomstmatrix: A→B, H1→H2, ander account zelfde huishouden geweigerd; zelfde identiteit toegestaan', () => {
  const fromA1 = backup({ exportIdentity: { mode: 'account', accountId: A, householdId: H1 } });
  assert.equal(IS.backupAllowed(fromA1, acct(A, H1)).ok, true);
  assert.equal(IS.backupAllowed(fromA1, acct(B, H2)).reason, 'other-identity', 'A → B');
  assert.equal(IS.backupAllowed(fromA1, acct(A, H2)).reason, 'other-identity', 'huishouden H1 → H2, zelfde account');
  assert.equal(IS.backupAllowed(fromA1, acct(B, H1)).reason, 'other-identity', 'ander account, zelfde huishouden');
  assert.equal(IS.backupAllowed(fromA1, LOCAL).reason, 'other-identity', 'account-back-up niet in het lokale profiel');
  assert.equal(IS.backupAllowed(fromA1, { mode: 'locked', accountId: A }).reason, 'locked');
});

test('V2. regressie: back-up zonder betrouwbare identiteit wordt nooit in een account teruggezet (alleen lokaal profiel)', () => {
  for (const text of [backup({}), backup({ exportIdentity: { mode: 'local' } }), JSON.stringify({ groceries: [] }),
    backup({ exportIdentity: { mode: 'retained', key: IS.LEGACY_KEY } }), backup({ exportIdentity: { mode: 'retained', key: IS.LEGACY_KEY, status: 'quarantaine', target: null } })]) {
    assert.deepEqual(IS.backupAllowed(text, acct(B, H2)), { ok: false, reason: 'unverified' }, text);
    assert.equal(IS.backupAllowed(text, acct(A, H1)).ok, false, 'ook niet in het account dat ze toevallig gebruikte');
    assert.equal(IS.backupAllowed(text, LOCAL).ok, true, 'lokaal profiel: expliciete lokale herstelactie');
    assert.equal(IS.backupAllowed(text, LOCAL_V3).ok, true);
  }
});

test('V3. regressie: bewaarde (gekoppelde) kopie alleen terug in de identiteit waaraan ze gekoppeld is', () => {
  const bound = backup({ exportIdentity: { mode: 'retained', key: IS.LEGACY_KEY, status: 'gekoppeld', target: IS.accountKey(A, H1) } });
  assert.equal(IS.backupAllowed(bound, acct(A, H1)).ok, true);
  assert.equal(IS.backupAllowed(bound, acct(B, H2)).reason, 'other-identity');
  assert.equal(IS.backupAllowed(bound, acct(A, H2)).reason, 'other-identity');
  assert.equal(IS.backupAllowed(bound, LOCAL).reason, 'other-identity', 'gegevens van A niet in het lokale profiel');
});

test('V4. schema- en versiecontrole: nieuwere versie, verkeerde typen en gereserveerde namen geweigerd; onbekend geldig blijft', () => {
  const id = acct(A, H1), origin = { exportIdentity: { mode: 'account', accountId: A, householdId: H1 } };
  assert.equal(IS.backupAllowed(backup({ ...origin, version: 3 }), id).reason, 'version');
  assert.equal(IS.backupAllowed(backup({ ...origin, version: '2' }), id).reason, 'version');
  assert.equal(IS.backupAllowed(backup(origin, { groceries: { a: 1 } }), id).reason, 'schema');
  assert.equal(IS.backupAllowed(backup(origin, { budgetV23: [1, 2] }), id).reason, 'schema');
  assert.equal(IS.backupAllowed(backup(origin, { legacy_full: {} }), id).reason, 'schema');
  assert.equal(IS.backupAllowed('{"meta":{"version":2},"__proto__":{"x":1}}', id).reason, 'schema');
  assert.equal(IS.backupAllowed(backup(origin, { 'bad key!': 1 }), id).reason, 'schema');
  assert.equal(IS.backupAllowed('[1,2]', LOCAL).reason, 'schema');
  assert.equal(IS.backupAllowed(JSON.stringify({ meta: [] }), LOCAL).reason, 'schema');
  assert.equal(IS.backupAllowed(backup(origin, { nutrition: { days: [] } }), id).ok, true, 'onbekend onderdeel met geldige naam: bewaard (gegevensbehoud)');
  assert.equal(IS.backupAllowed(backup({ ...origin, version: 1 }), id).ok, true);
});

test('V5. regressie: herstel neemt apparaatinstellingen en SportCoach niet over (huidige blijven staan)', () => {
  const st = memoryStorage();
  const current = { meta: { version: 2 }, groceries: [], settings: { weatherPlace: 'Utrecht' }, sportCoach: { library: [{ id: 'mine' }] } };
  st.setItem('k', JSON.stringify(current));
  const o = { storageKey: 'k', preRestoreKey: 'pre', holdKey: 'hold', migrate: v => v, preserveLocal: () => ({ sportCoach: current.sportCoach, settings: current.settings }) };
  const restored = DC.restoreBackupText(st, o, JSON.stringify({ meta: { version: 2 }, groceries: [{ id: 'b' }], settings: { weatherPlace: 'Maastricht' }, sportCoach: { library: [] } }));
  assert.deepEqual(restored.settings, { weatherPlace: 'Utrecht' });
  assert.deepEqual(restored.sportCoach, current.sportCoach);
  const noSettings = DC.restoreBackupText(st, { ...o, preserveLocal: () => ({ settings: undefined }) }, JSON.stringify({ meta: { version: 2 }, settings: { weatherPlace: 'X' } }));
  assert.equal('settings' in noSettings, false, 'zonder huidige instellingen: ook geen instellingen uit de back-up');
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  assert.match(app, /preserveLocal: \(\) => \(\{ sportCoach: clone\(data\?\.sportCoach\), settings: clone\(data\?\.settings\) \}\)/);
  assert.match(app, /delete backupData\.settings;/, 'nieuwe back-ups bevatten geen apparaatinstellingen');
});

// ---------- 2. Bewaarde gegevens en conflictlogboek ----------
function boundDevice() {
  const st = memoryStorage();
  st.setItem(IS.LEGACY_KEY, JSON.stringify({ meta: { version: 2 }, groceries: [{ id: 'g-a', title: 'A-melk' }], budgetV23: { incomes: { Kees: 3456 } }, sportCoach: {}, settings: {} }));
  st.setItem(IS.CFG_KEY, JSON.stringify({ enabled: true, householdId: H1, bases: { [`${A}:${H1}`]: { base: {} } } }));
  IS.migrateLegacy(st);
  return st;
}

test('V6. regressie: gekoppelde bewaarde gegevens van A zijn voor B (en het lokale profiel) onzichtbaar', () => {
  const st = boundDevice();
  assert.deepEqual(IS.retained(st).map(r => [r.status, r.target]), [['gekoppeld', IS.accountKey(A, H1)]]);
  assert.equal(IS.retainedFor(st, acct(A, H1)).length, 1, 'A ziet zijn eigen gekoppelde kopie');
  assert.deepEqual(IS.retainedFor(st, acct(B, H2)), [], 'B ziet niets');
  assert.deepEqual(IS.retainedFor(st, acct(A, H2)), [], 'A in een ander huishouden ziet niets');
  assert.deepEqual(IS.retainedFor(st, LOCAL_V3, { recovery: true }), [], 'lokaal profiel ziet gegevens van A niet, ook niet in herstelmodus');
  assert.deepEqual(IS.retainedFor(st, { mode: 'locked', accountId: B }, { recovery: true }), []);
});

test('V7. quarantaine alleen in het lokale profiel én de expliciete herstelmodus; nooit in een account', () => {
  const st = memoryStorage();
  st.setItem(IS.LEGACY_KEY, JSON.stringify({ meta: { version: 2 }, groceries: [{ id: 'q' }] }));
  st.setItem(IS.CFG_KEY, JSON.stringify({ enabled: true, bases: { [`${A}:${H1}`]: {}, [`${B}:${H2}`]: {} } }));
  assert.equal(IS.migrateLegacy(st).action, 'quarantined');
  assert.deepEqual(IS.retainedFor(st, LOCAL_V3), [], 'zonder herstelmodus niet zichtbaar');
  assert.deepEqual(IS.retainedFor(st, LOCAL_V3, { recovery: true }).map(r => r.status), ['quarantaine']);
  for (const id of [acct(A, H1), acct(B, H2)]) assert.deepEqual(IS.retainedFor(st, id, { recovery: true }), [], 'account: nooit, ook niet met herstelvlag');
  assert.ok(st.getItem(IS.LEGACY_KEY), 'gegevens blijven ongewijzigd bewaard');
});

test('V8. archief na expliciete koppeling krijgt een doel; een oud archief zonder doel is quarantaine', () => {
  const st = memoryStorage();
  st.setItem(IS.JOURNAL_KEY, JSON.stringify({ v2: 'bound', target: IS.accountKey(A, H1) }));
  st.setItem(IS.LOCAL_V3, JSON.stringify({ meta: { version: 2 }, groceries: [{ id: 'local-b' }] }));
  st.setItem(`${IS.V3}|local-archive|1`, JSON.stringify({ groceries: [{ id: 'oud' }] })); // van vóór opdracht 7
  const r = IS.bindLocalToAccount(st, { accountId: B, householdId: H2 });
  assert.equal(r.bound, true);
  const archives = IS.retained(st).filter(x => x.status === 'archief');
  assert.equal(archives.length, 2);
  const tagged = archives.find(x => x.target), untagged = archives.find(x => !x.target);
  assert.equal(tagged.target, IS.accountKey(B, H2));
  assert.equal(untagged.key, `${IS.V3}|local-archive|1`);
  assert.deepEqual(IS.retainedFor(st, acct(B, H2)).map(x => x.key), [tagged.key], 'B ziet alleen zijn eigen archief');
  assert.deepEqual(IS.retainedFor(st, acct(A, H1)).map(x => x.key), [IS.LEGACY_KEY], 'A ziet alleen de eigen gekoppelde kopie');
  assert.deepEqual(IS.retainedFor(st, LOCAL_V3, { recovery: true }).map(x => x.key), [untagged.key]);
  const backupB = backup({ exportIdentity: { mode: 'retained', key: tagged.key, status: 'archief', target: tagged.target } });
  assert.equal(IS.backupAllowed(backupB, acct(B, H2)).ok, true);
  assert.equal(IS.backupAllowed(backupB, acct(A, H1)).ok, false);
});

async function tabConflictsAcrossIdentities(meta) {
  const keyA = IS.accountKey(A, H1), keyB = IS.accountKey(B, H2);
  await meta.recordTabConflict({ scope: keyA, path: 'groceries[g-a].title', section: 'groceries', kept: 'A-melk', other: 'A-geheim', base: 'x' });
  await meta.recordTabConflict({ path: 'groceries[g-0].title', section: 'groceries', kept: 'oud', other: 'oud-geheim', base: 'x' }); // van vóór opdracht 7
  const forA = await meta.listTabConflicts({ scope: keyA });
  assert.deepEqual(forA.map(r => r.other), ['A-geheim']);
  assert.deepEqual(await meta.listTabConflicts({ scope: keyB }), [], 'B ziet het conflict van A niet');
  assert.deepEqual(await meta.listTabConflicts({ scope: IS.accountKey(A, H2) }), [], 'ander huishouden van A ook niet');
  assert.deepEqual(await meta.listTabConflicts({ scope: IS.LEGACY_KEY }), [], 'oude records zonder identiteit zijn met een scope niet op te vragen');
  assert.equal(await meta.getTabConflict(forA[0].key, { scope: keyB }), null, 'B kan het record niet ophalen');
  assert.equal(await meta.resolveTabConflict(forA[0].key, 'other', { scope: keyB }), false, 'B kan het record niet afhandelen');
  assert.ok(await meta.getTabConflict(forA[0].key, { scope: keyA }));
  assert.equal(await meta.resolveTabConflict(forA[0].key, 'other', { scope: keyA }), true);
  assert.equal((await meta.listTabConflicts()).length, 1, 'oud record blijft bewaard (niet verwijderd)');
  // Dezelfde botsing in twee identiteiten: twee aparte records, geen gedeelde sleutel.
  await meta.recordTabConflict({ scope: keyB, path: 'groceries[g-a].title', section: 'groceries', kept: 'A-melk', other: 'A-geheim', base: 'x' });
  assert.equal((await meta.listTabConflicts({ scope: keyB })).length, 1);
  assert.equal((await meta.listTabConflicts({ scope: keyA }))[0].resolved.resolution, 'other');
}
test('V9. regressie: tabbladconflicten per identiteit (IndexedDB)', async () => {
  await tabConflictsAcrossIdentities(SM.createSyncMetaStore({ indexedDB: fakeIndexedDB(), storage: memoryStorage(), hashValue: HS.hashValue }));
});
test('V9b. tabbladconflicten per identiteit (zonder IndexedDB: localStorage-fallback)', async () => {
  const meta = SM.createSyncMetaStore({ indexedDB: undefined, storage: memoryStorage(), hashValue: HS.hashValue });
  await tabConflictsAcrossIdentities(meta);
  assert.notEqual((await meta.status()).durability, 'durable');
});
test('V9c. tabbladconflicten per identiteit (IndexedDB onbruikbaar)', async () => {
  await tabConflictsAcrossIdentities(SM.createSyncMetaStore({ indexedDB: fakeIndexedDB({ failOpen: true }), storage: memoryStorage(), hashValue: HS.hashValue }));
});

test('V10. regressie: financiële apparaatconflicten tellen niet in een account en gaan alleen mee bij expliciete koppeling', async () => {
  const meta = SM.createSyncMetaStore({ indexedDB: fakeIndexedDB(), storage: memoryStorage(), hashValue: HS.hashValue });
  const core = FC.createFinanceConflicts({ store: meta, merge3: HS.merge3, hashValue: HS.hashValue });
  await core.open({ scope: FC.DEVICE_SCOPE, localKey: IS.LOCAL_V3, section: 'budgetV23', origin: 'tab', base: { pct: 50 }, local: { pct: 61 }, remote: { pct: 39 }, forcedPaths: ['pct'] });
  await core.open({ scope: FC.DEVICE_SCOPE, localKey: 'samenThuisDataV3|local-ander', section: 'budget19', origin: 'tab', base: { a: 1 }, local: { a: 2 }, remote: { a: 3 }, forcedPaths: ['a'] });
  const [rec] = (await core.list(FC.DEVICE_SCOPE)).filter(r => r.section === 'budgetV23');
  assert.equal(rec.localKey, IS.LOCAL_V3);
  const scopeB = FC.scopeFor(B, H2);
  const round = await core.scoped(scopeB).beforeRound({ data: { budgetV23: { pct: 61 } } });
  assert.deepEqual([round.frozen, round.fixes, round.records], [[], [], []], 'apparaatconflict beïnvloedt de ronde van B niet');
  // Expliciete koppeling van het lokale profiel LOCAL_V3 aan B/H2: alleen de records van precies die dataset gaan mee.
  assert.deepEqual(await core.adoptDevice({ localKey: IS.LOCAL_V3, scope: scopeB }), ['budgetV23']);
  assert.deepEqual((await core.list(scopeB)).map(r => [r.section, r.local.pct, r.status]), [['budgetV23', 61, 'open']], 'waarden behouden');
  assert.deepEqual((await core.list(FC.DEVICE_SCOPE)).map(r => r.section), ['budget19'], 'ander profiel blijft staan');
  assert.deepEqual((await core.scoped(scopeB).beforeRound({ data: { budgetV23: { pct: 61 } } })).frozen, ['budgetV23'], 'na koppeling: bevroren tot expliciete keuze');
  assert.ok((await core.audit(scopeB)).some(a => a.action === 'adopted'));
  // Bestaat er al een record in de doelscope, dan wordt niets overschreven en blijft het apparaatrecord staan.
  await core.open({ scope: FC.DEVICE_SCOPE, localKey: IS.LOCAL_V3, section: 'budgetV23', origin: 'tab', base: { pct: 1 }, local: { pct: 2 }, remote: { pct: 3 }, forcedPaths: ['pct'] });
  assert.deepEqual(await core.adoptDevice({ localKey: IS.LOCAL_V3, scope: scopeB }), []);
  assert.equal((await core.list(scopeB))[0].local.pct, 61);
  // Records van vóór opdracht 7 (zonder localKey) alleen mee als het gekoppelde profiel de oorspronkelijke dataset is.
  await meta.putRecord({ ...FC.newRecord({ scope: FC.DEVICE_SCOPE, section: 'fuelEntries', origin: 'tab', base: [], local: [1], remote: [2], now: () => 'x' }), localKey: undefined });
  assert.deepEqual(await core.adoptDevice({ localKey: 'samenThuisDataV3|local-ander-profiel', scope: FC.scopeFor(A, H1) }), [], 'zonder includeUntagged: niet mee');
  assert.deepEqual(await core.adoptDevice({ localKey: IS.LEGACY_KEY, scope: FC.scopeFor(A, H1), includeUntagged: true }), ['fuelEntries']);
});

test('V11. bronbestanden: apparaatconflicten alleen in de juiste lokale identiteit; geen apparaatbrede tabbladconflicten meer', () => {
  const acctSrc = fs.readFileSync(__dirname + '/account-sync.js', 'utf8');
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  assert.match(acctSrc, /if \(id\.mode !== 'local' \|\| IDENT\.switching\(\)\) return false;/);
  assert.doesNotMatch(acctSrc, /FIN\.list\(FINC\.DEVICE_SCOPE\)\)\]/, 'geen ongefilterde apparaatrecords in lijsten');
  assert.match(acctSrc, /FIN\.adoptDevice\(\{ localKey, scope: FINC\.scopeFor\(uid, st\.household\.id\)/);
  assert.match(app, /meta\.recordTabConflict\(\{ \.\.\.d, scope: tabConflictScope\(\) \}\)/);
  assert.match(app, /listTabConflicts\(\{ \.\.\.opts, scope \}\)/);
  assert.match(app, /getTabConflict\(key, \{ scope \}\)/);
  assert.match(app, /retainedFor\(localStorage, ACTIVE_IDENTITY, \{ recovery: localRecoveryMode \}\)/);
  assert.doesNotMatch(app, /IDENTITY_STORE\.retained\(localStorage\)\.some\(item => item\.key === key\)/, 'downloaden alleen uit de zichtbare lijst');
});

// ---------- 3. Identiteitsvergrendeling (bron; gedrag in de browser in e2e/isolation-v7.mjs) ----------
test('V12. finance-ui: één vergrendeling per handeling, token gecontroleerd vóór verzenden, oud antwoord weggegooid', () => {
  const ui = fs.readFileSync(__dirname + '/finance-ui.js', 'utf8');
  assert.match(ui, /if \(session\.user\?\.id !== lock\.uid\) throw staleIdentity\(\);/);
  assert.match(ui, /assertLock\(lock\); \/\/ laat antwoord van een vorige identiteit/);
  assert.match(ui, /fetchRow: \(\) => fetchPersonalRow\(lock\)/);
  assert.match(ui, /user_id=eq\.\$\{encodeURIComponent\(lock\.uid\)\}&updated_at=eq\.\$\{encodeURIComponent\(updatedAt\)\}/);
  assert.match(ui, /body: JSON\.stringify\(\{ user_id: lock\.uid, finance_config: value \}\)/);
  assert.match(ui, /assertLock\(lock\); \/\/ uitkomst van een vorige identiteit/);
  assert.match(ui, /if \(lock\.householdId && args && args\.p_household && args\.p_household !== lock\.householdId\)/);
  assert.doesNotMatch(ui.slice(ui.indexOf('async function savePersonal'), ui.indexOf('async function resolvePersonalConflict')), /uid\(\)/, 'geen nieuw gelezen uid tijdens het opslaan');
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  assert.match(app, /async function writePersonalPreferences25\(preferences, expectedUserId\)/);
  assert.equal((app.match(/writePersonalPreferences25\(saveLocalAccountPreferences25\((\w+|session\.user\.id)\), (\w+|session\.user\.id)\)/g) || []).length, 3, 'alle aanroepen geven het verwachte account mee');
});

// ---------- 4. Huishoudcode per account + huishouden ----------
test('V13. twee huishoudens met verschillende codes op één apparaat; een wissel gebruikt nooit de code van een ander', () => {
  const st = memoryStorage();
  IS.setCode(st, acct(A, H1), 'code-van-huishouden-1');
  IS.setCode(st, acct(A, H2), 'code-van-huishouden-2');
  IS.setCode(st, acct(B, H2), 'code-van-b-in-h2-xx');
  assert.equal(IS.readCode(st, acct(A, H1)).code, 'code-van-huishouden-1');
  assert.equal(IS.readCode(st, acct(A, H2)).code, 'code-van-huishouden-2');
  assert.equal(IS.readCode(st, acct(B, H2)).code, 'code-van-b-in-h2-xx', 'per account, ook binnen hetzelfde huishouden');
  assert.equal(IS.readCode(st, acct(B, H1)), null, 'account zonder eigen code: geen code (geen terugval op een ander)');
  assert.equal(IS.readCode(st, LOCAL), null, 'lokaal profiel heeft geen accountcode');
  assert.throws(() => IS.setCode(st, LOCAL, 'x'.repeat(20)), /account en huishouden/);
  assert.throws(() => IS.setCode(st, acct(A, H1), 'kort'), /minimaal 12/);
  assert.equal(st.getItem('samenThuisSyncV1'), null, 'globale code niet aangeraakt');
});

test('V14. fail-closed: eerste versie naar een leeg huishouden alleen met een zelf ingevulde of bewezen code', () => {
  const st = memoryStorage();
  st.setItem('samenThuisSyncV1', JSON.stringify({ householdCode: 'code-van-huishouden-A' }));
  assert.equal(IS.legacyCodeCandidate(st, acct(B, H2)), null, 'nieuwe identiteit: nooit de globale code');
  assert.equal(IS.legacyCodeCandidate(st, LOCAL), null);
  st.setItem(IS.CFG_KEY, JSON.stringify({ bases: { [`${A}:${H1}`]: { base: {} } } }));
  assert.equal(IS.legacyCodeCandidate(st, acct(A, H1)), 'code-van-huishouden-A', 'identiteit die al met de globale code synchroniseerde: alleen kandidaat');
  assert.equal(IS.legacyCodeCandidate(st, acct(A, H2)), null, 'zelfde account, ander huishouden: niet');
  st.setItem(IS.JOURNAL_KEY, JSON.stringify({ v2: 'bound', target: IS.accountKey(B, H1) }));
  assert.equal(IS.legacyCodeCandidate(st, acct(B, H1)), 'code-van-huishouden-A', 'doel van de migratie: kandidaat');
  assert.equal(IS.codeTrustedForEmpty(null), false, 'geen code');
  assert.equal(IS.codeTrustedForEmpty(IS.readCode(st, acct(B, H2))), false);
  IS.setCode(st, acct(B, H2), 'eigen-code-van-b-123');
  assert.equal(IS.codeTrustedForEmpty(IS.readCode(st, acct(B, H2))), true, 'zelf ingevuld voor dit huishouden');
  IS.setCode(st, acct(A, H1), 'code-van-huishouden-A', { source: 'legacy-verified', verified: true });
  assert.equal(IS.codeTrustedForEmpty(IS.readCode(st, acct(A, H1))), true, 'bewezen');
  IS.setCode(st, acct(A, H2), 'code-van-huishouden-A', { source: 'legacy-candidate', verified: false });
  assert.equal(IS.codeTrustedForEmpty(IS.readCode(st, acct(A, H2))), false, 'onbewezen kandidaat');
  assert.equal(IS.markCodeVerified(st, acct(A, H2), 'andere-code-xxxxxx').verified, false, 'alleen de opgeslagen code wordt bevestigd');
  assert.equal(IS.markCodeVerified(st, acct(A, H2), 'code-van-huishouden-A').verified, true);
  st.setItem('samenThuisSyncV1', JSON.stringify({ householdCode: 'te-kort' }));
  assert.equal(IS.legacyCodeCandidate(st, acct(A, H1)), null, 'te korte globale code: geen kandidaat');
});

test('V15. bron: accountronde gebruikt de code van de identiteit, nooit ongecontroleerd de globale code', () => {
  const acctSrc = fs.readFileSync(__dirname + '/account-sync.js', 'utf8');
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  assert.doesNotMatch(acctSrc, /syncConfig\.householdCode \|\| ''\)\.trim\(\)/, 'geen globale code() meer');
  assert.match(acctSrc, /if \(!mayCreate\) throw codeError\('Dit huishouden heeft nog geen gegevens in de cloud/);
  assert.match(acctSrc, /const probe = own\.find\(r => r\.section === KEYCHECK\) \|\| own\[0\];\n\s*try \{ await decryptData\(probe\.payload, roundCode\); \}/);
  assert.match(acctSrc, /await c\.putState\(hid, KEYCHECK, await encrypt\(/, 'controlewaarde vóór de eerste gegevens');
  assert.match(acctSrc, /if \(candidate\) IDS\.setCode\(localStorage, ident, roundCode, \{ source: 'legacy-verified', verified: true \}\);/);
  assert.doesNotMatch(acctSrc, /localStorage\.setItem\(SYNC_KEY/, 'accountronde schrijft de globale sleutel niet');
  assert.match(app, /if \(ACTIVE_IDENTITY\.mode !== 'local'\) return;\n  localStorage\.setItem\(SYNC_KEY/, 'globale code alleen vanuit het lokale profiel');
});

// ---------- Vervolg: strikte allowlist en afgeschermd conflictlogboek ----------
test('V16. strikte allowlist: onbekend onderdeel in een account geweigerd, ook met (gewijzigde) eigen herkomst', () => {
  const id = acct(B, H2);
  const own = { exportIdentity: { mode: 'account', accountId: B, householdId: H2 } };
  assert.deepEqual(IS.backupAllowed(backup(own, { evilSection: { x: 1 } }), id), { ok: false, reason: 'unknown-sections', sections: ['evilSection'] });
  // Metadata van A gewijzigd naar B: herkomst niet te bewijzen, maar de allowlist blijft gelden.
  assert.equal(IS.backupAllowed(backup(own, { groceries: [], legacyModule: [] }), id).reason, 'unknown-sections');
  assert.equal(IS.backupAllowed(backup({ exportIdentity: { mode: 'retained', target: id.key } }, { x: 1 }), id).reason, 'unknown-sections', 'vervalst doel: allowlist geldt');
  const ok = IS.backupAllowed(backup(own, { budgetV23: {}, nutrition: {}, offers25: [], settings: { weatherPlace: 'X' }, sportCoach: {} }), id);
  assert.deepEqual([ok.ok, ok.unknown], [true, []], 'toegestane onderdelen; apparaatvelden worden genegeerd, niet geweigerd');
  for (const k of IS.ACCOUNT_SECTIONS) assert.equal(IS.backupAllowed(backup(own, { [k]: k === 'priceReferenceUpdatedAt' || k === 'priceReferenceSource' || k === 'offerCurrentQuery25' ? 'x' : ['budget', 'budget19', 'budget219', 'budgetV22', 'budgetV23', 'dailyAnswers'].includes(k) ? {} : [] }), id).ok, true, k);
  // Oude versies: versie 1 en zonder meta toegestaan (zelfde regels); te nieuw of ongeldig geweigerd.
  assert.equal(IS.backupAllowed(backup({ ...own, version: 1 }), id).ok, true);
  assert.equal(IS.backupAllowed(JSON.stringify({ groceries: [] }), LOCAL).ok, true);
  for (const v of [0, 3, 2.5, null]) assert.equal(IS.backupAllowed(backup({ ...own, version: v }), id).reason, 'version', String(v));
});

test('V17. lokaal profiel: onbekende onderdelen apart in quarantaine (niet geladen), alleen in de herstelmodus zichtbaar', () => {
  const st = memoryStorage();
  const value = { meta: { version: 2 }, groceries: [{ id: 'g' }], evilSection: { a: 1 }, other: [2], settings: { weatherPlace: 'X' }, sportCoach: { library: [] } };
  const allowed = IS.backupAllowed(JSON.stringify(value), LOCAL_V3);
  assert.deepEqual([allowed.ok, allowed.unknown], [true, ['evilSection', 'other']]);
  const { known, unknown } = IS.splitBackup(value);
  assert.deepEqual(Object.keys(known).sort(), ['groceries', 'meta'], 'zonder apparaatvelden en onbekende onderdelen');
  assert.deepEqual(unknown, { evilSection: { a: 1 }, other: [2] });
  const key = IS.quarantineUnknown(st, unknown, { source: 'test.json' });
  assert.ok(key.startsWith(`${IS.V3}|quarantine|`));
  assert.deepEqual(JSON.parse(st.getItem(key)).evilSection, { a: 1 }, 'bewaard, niet weggegooid');
  assert.equal(IS.quarantineUnknown(st, {}), null);
  assert.deepEqual(IS.retainedFor(st, LOCAL_V3), []);
  assert.deepEqual(IS.retainedFor(st, LOCAL_V3, { recovery: true }).map(r => [r.key, r.status]), [[key, 'quarantaine']]);
  assert.deepEqual(IS.retainedFor(st, acct(A, H1), { recovery: true }), [], 'nooit in een account');
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  assert.match(app, /restoreBackupText\(localStorage, \{ \.\.\.recoveryOptions\(\), holdKey: RESTORE_HOLD_KEY \}, JSON\.stringify\(known\)\)/);
  assert.match(app, /if\(importTarget243==='backup'\)\{[^}]*mergeBackupChecked\(text\);return\}/, 'samenvoegroute gebruikt dezelfde controle');
  assert.doesNotMatch(app, /mergeBackup246\(JSON\.parse\(text\)\)/, 'geen ongecontroleerd samenvoegen meer');
});

function guardedPair() {
  const idb = fakeIndexedDB(), storage = memoryStorage();
  let active = { tab: IS.accountKey(A, H1), slot: `${A}:${H1}` };
  const meta = SM.createSyncMetaStore({ indexedDB: idb, storage, hashValue: HS.hashValue, activeScope: () => active });
  const raw = SM.createSyncMetaStore({ indexedDB: idb, storage, hashValue: HS.hashValue });
  return { meta, raw, as: (u, h) => { active = u ? { tab: IS.accountKey(u, h), slot: `${u}:${h}` } : null; } };
}
test('V18. conflictlogboek: standaard de actieve identiteit; een andere identiteit via een parameter levert niets op', async () => {
  const { meta, raw, as } = guardedPair();
  await raw.recordTabConflict({ path: 'oud', section: 'groceries', kept: 1, other: 'oud-geheim' }); // van vóór opdracht 7
  await meta.recordTabConflict({ path: 'groceries[g].title', section: 'groceries', kept: 'a', other: 'A-geheim' });
  const [recA] = await meta.listTabConflicts();
  assert.equal(recA.other, 'A-geheim', 'zonder parameter: eigen identiteit');
  await assert.rejects(meta.recordTabConflict({ scope: IS.accountKey(B, H2), path: 'x', kept: 1, other: 2 }), /andere identiteit/);
  as(B, H2);
  assert.deepEqual(await meta.listTabConflicts(), []);
  assert.deepEqual(await meta.listTabConflicts({ scope: IS.accountKey(A, H1) }), [], 'parameter met A: niets');
  assert.deepEqual(await meta.listTabConflicts({ scope: null }), []);
  assert.equal(await meta.getTabConflict(recA.key, { scope: IS.accountKey(A, H1) }), null);
  assert.equal(await meta.resolveTabConflict(recA.key, 'other', { scope: IS.accountKey(A, H1) }), false);
  assert.equal(await meta.getRecord(recA.key), null, 'ook niet via de algemene records');
  assert.deepEqual(await meta.listRecords('tab'), []);
  await assert.rejects(meta.putRecord({ ...recA }), /andere identiteit/);
  assert.equal(await meta.updateRecord(recA.key, () => ({ ...recA, other: 'overschreven' })), undefined);
  await meta.deleteRecord(recA.key);
  as(null);
  assert.deepEqual(await meta.listTabConflicts(), [], 'tijdens een wissel of zonder identiteit: niets');
  as(A, H1);
  assert.deepEqual((await meta.listTabConflicts()).map(r => r.other), ['A-geheim'], 'record van A ongewijzigd en niet verwijderd');
  assert.equal((await raw.listTabConflicts()).length, 1, 'oud record bewaard');
  assert.equal((await meta.listTabConflicts({ scope: undefined })).length, 1);
});

test('V19. afgeschermde synchronisatiemetadata en financiële records van een andere identiteit', async () => {
  const { meta, raw, as } = guardedPair();
  await meta.saveBaseValues(`${A}:${H1}`, { groceries: [{ id: 'a', title: 'A-geheim' }] });
  await meta.saveConflicts(`${A}:${H1}`, [{ section: 'groceries', fields: ['x'] }]);
  const core = FC.createFinanceConflicts({ store: meta, merge3: HS.merge3, hashValue: HS.hashValue });
  await core.open({ scope: FC.scopeFor(A, H1), section: 'budgetV23', origin: 'sync', base: { pct: 1 }, local: { pct: 2 }, remote: { pct: 3 } });
  as(B, H2);
  assert.deepEqual(await meta.loadBaseValues(`${A}:${H1}`, {}), {}, 'basiswaarden van A niet leesbaar voor B');
  assert.deepEqual(await meta.loadConflicts(`${A}:${H1}`), []);
  await assert.rejects(meta.saveBaseValues(`${A}:${H1}`, { groceries: [] }), /andere identiteit/);
  assert.deepEqual(await core.list(FC.scopeFor(A, H1)), [], 'financieel conflict van A niet zichtbaar');
  assert.equal(await core.get(FC.scopeFor(A, H1), 'budgetV23'), null);
  assert.equal((await core.resolve({ scope: FC.scopeFor(A, H1), section: 'budgetV23', choices: { pct: 'local' }, currentLocal: { pct: 2 } })).reason, 'not-found');
  assert.ok((await meta.listRecords('finance-audit')).every(a => !a.scope || a.scope === FC.scopeFor(B, H2) || ['device', 'legacy-unknown'].includes(a.scope)));
  // Een nieuw record in de scope van A vanuit B (bijv. koppeling) overschrijft nooit het bestaande record van A.
  assert.equal(await meta.updateRecord(FC.recordKey(FC.scopeFor(A, H1), 'budgetV23'), () => ({ hacked: true })), undefined);
  as(A, H1);
  assert.equal((await core.list(FC.scopeFor(A, H1)))[0].local.pct, 2);
  assert.equal((await meta.loadBaseValues(`${A}:${H1}`, {})).groceries[0].title, 'A-geheim');
  assert.equal((await raw.listRecords('finance')).length, 1, 'niets verwijderd');
});

test('V20. bron: de app gebruikt de afgeschermde opslag en M1-koppeling', () => {
  const metaSrc = fs.readFileSync(__dirname + '/sync-meta-store.js', 'utf8');
  const acctSrc = fs.readFileSync(__dirname + '/account-sync.js', 'utf8');
  assert.match(metaSrc, /sharedStore = createSyncMetaStore\(\{ indexedDB: idb, storage, hashValue: globalThis\.SamenThuisHouseholdSync\.hashValue, activeScope \}\);/);
  assert.match(acctSrc, /await classifyLegacyDevice\(\); \/\/ idempotent/);
  assert.match(acctSrc, /return !!r\.localKey && r\.localKey === id\.key;/, 'oude records zonder profiel nergens met waarden zichtbaar');
});

// ---------- Opruimen (op verzoek; download en bevestiging zitten in app.js) ----------
test('V21. opruimen: alleen zichtbare items; SportCoach en instellingen blijven; grafsteen houdt eigenaarsbepaling gelijk', () => {
  const st = boundDevice();
  const v2 = JSON.parse(st.getItem(IS.LEGACY_KEY));
  assert.deepEqual(IS.discardRetained(st, acct(B, H2), IS.LEGACY_KEY), { ok: false, reason: 'not-visible' }, 'B kan de kopie van A niet opruimen');
  assert.deepEqual(IS.discardRetained(st, LOCAL_V3, IS.LEGACY_KEY, { recovery: true }), { ok: false, reason: 'not-visible' });
  const r = IS.discardRetained(st, acct(A, H1), IS.LEGACY_KEY);
  assert.deepEqual([r.ok, r.kept.sort()], [true, ['settings', 'sportCoach']]);
  const after = JSON.parse(st.getItem(IS.LEGACY_KEY));
  assert.equal(after.groceries, undefined); assert.equal(after.budgetV23, undefined);
  assert.deepEqual([after.sportCoach, after.settings], [v2.sportCoach, v2.settings]);
  assert.equal(JSON.parse(st.getItem(IS.JOURNAL_KEY)).v2, 'bound', 'migratiestatus ongewijzigd');
  assert.deepEqual(IS.retainedFor(st, acct(A, H1)), []);
  assert.ok(st.getItem(IS.accountKey(A, H1)), 'de eigen dataset van A blijft onaangetast');
  // Archief: verwijderd, grafsteen blijft meetellen voor M1.
  const st2 = memoryStorage();
  const at = '2026-11-10T12:00:00.000Z', archive = `${IS.V3}|local-archive|${Date.parse('2026-11-12T00:00:00.000Z')}`;
  st2.setItem(IS.JOURNAL_KEY, JSON.stringify({ v2: 'bound', target: IS.accountKey(A, H1), at, archives: { [archive]: IS.accountKey(B, H2) } }));
  st2.setItem(archive, JSON.stringify({ groceries: [{ id: 'arch' }] }));
  const ownerBefore = IS.legacyRecordOwner(st2, '2026-11-11T00:00:00.000Z');
  assert.equal(IS.discardRetained(st2, acct(A, H1), archive).ok, false, 'archief van B niet door A');
  assert.equal(IS.discardRetained(st2, acct(B, H2), archive).ok, true);
  assert.equal(st2.getItem(archive), null);
  assert.deepEqual(IS.legacyRecordOwner(st2, '2026-11-11T00:00:00.000Z'), ownerBefore, 'eigenaarsbepaling onveranderd na opruimen');
  // Quarantaine alleen in het lokale profiel met herstelmodus.
  const q = IS.quarantineUnknown(st2, { evil: 1 });
  assert.equal(IS.discardRetained(st2, LOCAL_V3, q).ok, false, 'zonder herstelmodus niet');
  assert.equal(IS.discardRetained(st2, acct(B, H2), q, { recovery: true }).ok, false, 'nooit vanuit een account');
  assert.equal(IS.discardRetained(st2, LOCAL_V3, q, { recovery: true }).ok, true);
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  const handler = app.slice(app.indexOf("const btn = event.target.closest('[data-discard-retained]')"), app.indexOf("const meta = window.SamenThuisSyncMeta?.shared();\n  if (!meta?.legacyConflicts"));
  assert.ok(handler.indexOf('downloadRetainedItem(item)') < handler.indexOf('confirm(') && handler.indexOf('confirm(') < handler.indexOf('discardRetained('), 'eerst download, dan bevestiging, dan pas verwijderen');
});

test('V22. oude conflictregistraties: alleen in een lokale identiteit op te vragen en op te ruimen; M1-blokkades niet', async () => {
  const { meta, raw, as } = guardedPair();
  await raw.recordTabConflict({ path: 'oud', section: 'groceries', kept: 1, other: 'oud-geheim' });
  await raw.putRecord({ key: 'fin|legacy-unknown|budget', slot: 'legacy-unknown', scope: 'legacy-unknown', kind: 'finance', section: 'budget', status: 'open', rev: 1 });
  await raw.putRecord({ key: 'fin|device|budgetV23', slot: 'device', scope: 'device', kind: 'finance', section: 'budgetV23', status: 'open', rev: 1, ownerUnknown: true });
  assert.deepEqual(await meta.legacyConflicts(), [], 'account: niets');
  assert.equal(await meta.discardLegacyConflicts(['fin|legacy-unknown|budget']), 0);
  as(null);
  assert.deepEqual(await meta.legacyConflicts(), []);
  const local = SM.createSyncMetaStore({ indexedDB: fakeIndexedDB(), storage: memoryStorage(), hashValue: HS.hashValue, activeScope: () => ({ tab: IS.LOCAL_V3, slot: null }) });
  await local.putRecord({ key: 'fin|legacy-unknown|budget', slot: 'legacy-unknown', scope: 'legacy-unknown', kind: 'finance', section: 'budget', status: 'open', rev: 1 });
  await local.putRecord({ key: 'fin|device|budgetV23', slot: 'device', scope: 'device', kind: 'finance', section: 'budgetV23', status: 'open', rev: 1, ownerUnknown: true });
  const found = await local.legacyConflicts();
  assert.deepEqual(found.map(r => r.key), ['fin|legacy-unknown|budget'], 'M1-blokkade niet in de opruimlijst');
  assert.equal(await local.discardLegacyConflicts([...found.map(r => r.key), 'fin|device|budgetV23']), 1);
  assert.ok(await local.getRecord('fin|device|budgetV23'), 'blokkerend apparaatconflict blijft staan');
  assert.equal((await raw.listRecords('finance')).length, 2, 'andere opslag ongewijzigd');
});

// ---------- Bewaking van de allowlist ----------
test('V23. allowlist dekt elk onderdeel dat de app zelf schrijft (nieuwe module → eerst ACCOUNT_SECTIONS bijwerken)', () => {
  const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const files = [...html.matchAll(/src="\.?\/?([^"?]+\.js)/g)].map(m => m[1]).filter(f => fs.existsSync(__dirname + '/' + f));
  assert.ok(files.includes('app.js') && files.length > 20, 'scripts uit index.html gevonden');
  const allowed = new Set([...IS.ACCOUNT_SECTIONS, 'meta', ...IS.DEVICE_FIELDS]);
  const missing = [];
  for (const f of files) {
    const src = fs.readFileSync(__dirname + '/' + f, 'utf8');
    for (const m of src.matchAll(/\bdata\.([A-Za-z_][A-Za-z0-9_]*)\s*(\|\|=|\?\?=|=(?!=|>))/g)) if (!allowed.has(m[1])) missing.push(`${m[1]} (${f})`);
  }
  // initialData (app.js) bevat de basisonderdelen.
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  const init = app.slice(app.indexOf('const initialData = {'), app.indexOf('\n};', app.indexOf('const initialData = {')));
  for (const m of init.matchAll(/^  ([A-Za-z_][A-Za-z0-9_]*):/gm)) if (!allowed.has(m[1])) missing.push(`${m[1]} (initialData)`);
  assert.deepEqual([...new Set(missing)], [], 'onderdelen die de app schrijft maar die een accountback-up zou weigeren');
});
