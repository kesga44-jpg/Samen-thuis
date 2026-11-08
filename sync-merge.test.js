// Synchronisatie tussen huisgenoten: gelijktijdige toevoegingen worden automatisch samengevoegd; echte conflicten
// (hetzelfde veld aan beide kanten anders) worden nooit stil overschreven.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const HS = require('./household-sync-core.js');

const g = (id, title, extra = {}) => ({ id, title, category: 'Overig', done: false, ...extra });

test('merge3: allebei een boodschap toegevoegd → beide blijven', () => {
  const base = [g('a', 'Melk')];
  const m = HS.mergeSection(base, [...base, g('k', 'Brood')], [...base, g('d', 'Kaas')]);
  assert.equal(m.ok, true);
  assert.deepEqual(m.value.map(x => x.id).sort(), ['a', 'd', 'k']);
});

test('merge3: verschillende velden van hetzelfde item → beide wijzigingen; zelfde veld anders → conflict', () => {
  const base = [g('a', 'Melk')];
  let m = HS.mergeSection(base, [g('a', 'Melk', { done: true })], [g('a', 'Havermelk')]);
  assert.equal(m.ok, true); assert.deepEqual(m.value[0], g('a', 'Havermelk', { done: true }));
  m = HS.mergeSection(base, [g('a', 'Volle melk')], [g('a', 'Havermelk')]);
  assert.equal(m.ok, false); assert.deepEqual(m.conflicts, ['[a].title']);
  assert.equal(m.value[0].title, 'Volle melk', 'zonder keuze blijft de lokale waarde staan (niets stil overschreven)');
  m = HS.mergeSection(base, [g('a', 'Volle melk')], [g('a', 'Havermelk')], { onConflict: 'remote' });
  assert.equal(m.ok, true); assert.equal(m.value[0].title, 'Havermelk', 'expliciet samenvoegen: cloudversie wint bij echt conflict');
});

test('merge3: verwijderen aan één kant wordt gerespecteerd; wijzigen versus verwijderen houdt het item', () => {
  const base = [g('a', 'Melk'), g('b', 'Brood')];
  let m = HS.mergeSection(base, [g('a', 'Melk')], [...base, g('c', 'Eieren')]);
  assert.deepEqual(m.value.map(x => x.id), ['a', 'c'], 'b lokaal verwijderd, c op afstand toegevoegd');
  m = HS.mergeSection(base, [g('a', 'Melk'), g('b', 'Brood', { done: true })], [g('a', 'Melk')]);
  assert.equal(m.ok, true); assert.deepEqual(m.value.map(x => x.id), ['a', 'b'], 'gewijzigd item gaat niet verloren');
});

test('merge3: lijsten met tekst (bijv. afgevinkte datums) als verzameling; geneste objecten per sleutel', () => {
  const base = { chores: [{ id: 'c1', title: 'Keuken', completedDates: ['2026-11-01'] }], budget: { pots: { food: 100 }, note: 'x' } };
  const local = { chores: [{ id: 'c1', title: 'Keuken', completedDates: ['2026-11-01', '2026-11-07'] }], budget: { pots: { food: 120 }, note: 'x' } };
  const remote = { chores: [{ id: 'c1', title: 'Keuken', completedDates: ['2026-11-08'] }], budget: { pots: { food: 100, fun: 30 }, note: 'x' } };
  const m = HS.mergeSection(base, local, remote);
  assert.equal(m.ok, true);
  assert.deepEqual(m.value.chores[0].completedDates.sort(), ['2026-11-07', '2026-11-08'], '01 op afstand verwijderd, 07 en 08 toegevoegd');
  assert.deepEqual(m.value.budget.pots, { food: 120, fun: 30 });
});

test('merge3 zonder basis: alleen samenvoegen op verzoek; toevoegingen blijven, echte verschillen naar keuze', () => {
  const m = HS.mergeSection(undefined, [g('k', 'Brood')], [g('d', 'Kaas')]);
  assert.equal(m.ok, true); assert.equal(m.value.length, 2);
  const c = HS.mergeSection(undefined, { name: 'A' }, { name: 'B' });
  assert.equal(c.ok, false);
});

function fakeCloud() {
  const rows = {}; let puts = 0; let failNext = false;
  return {
    rows, get puts() { return puts; }, failNextPut() { failNext = true; },
    async readState() { return Object.entries(rows).map(([section, r]) => ({ section, payload: r.payload, version: r.version })); },
    async putState(hid, section, payload, expected) {
      const cur = rows[section] ? rows[section].version : 0;
      if (failNext || cur !== expected) { failNext = false; throw new HS.CloudError(409, { code: '40001', message: 'Versieconflict' }); }
      rows[section] = { payload, version: cur + 1 }; puts++; return cur + 1;
    }
  };
}
const enc = async v => JSON.parse(JSON.stringify(v));
// Eén "apparaat": lokale data + opgeslagen basis (hash + waarde), zoals account-sync.js dat bijhoudt.
function device(data) {
  return { data, base: {}, baseValues: {},
    async sync(cloud, extra = {}) {
      const r = await HS.runAccountSync({ cloud, householdId: 'h', local: this.data, base: this.base, baseValues: this.baseValues, encrypt: enc, decrypt: enc, ...extra });
      this.data = { ...this.data, ...r.pulls }; this.base = r.base; this.baseValues = { ...this.baseValues, ...r.baseValues };
      return r;
    } };
}

test('scenario: Kees en Daphne voegen tegelijk boodschappen toe → beiden zien beide toevoegingen zonder keuze', async () => {
  const cloud = fakeCloud();
  const kees = device({ groceries: [g('a', 'Melk')], meals: [] });
  assert.equal((await kees.sync(cloud)).status, 'ok');
  const daphne = device({ groceries: [], meals: [] });
  assert.equal((await daphne.sync(cloud)).status, 'ok');
  assert.deepEqual(daphne.data.groceries.map(x => x.id), ['a']);
  // Beide voegen iets toe zonder tussendoor te synchroniseren.
  kees.data = { ...kees.data, groceries: [...kees.data.groceries, g('k', 'Brood')] };
  daphne.data = { ...daphne.data, groceries: [...daphne.data.groceries, g('d', 'Kaas')], meals: [{ id: 'm1', title: 'Curry', date: '2026-11-09' }] };
  assert.equal((await daphne.sync(cloud)).status, 'ok');
  const r = await kees.sync(cloud);
  assert.equal(r.status, 'ok', 'geen conflict');
  assert.deepEqual(r.merged, ['groceries']);
  assert.deepEqual(kees.data.groceries.map(x => x.id).sort(), ['a', 'd', 'k']);
  assert.equal(kees.data.meals[0].title, 'Curry', 'ander onderdeel gewoon binnengehaald');
  await daphne.sync(cloud);
  assert.deepEqual(daphne.data.groceries.map(x => x.id).sort(), ['a', 'd', 'k'], 'Daphne ziet Kees’ toevoeging bij de volgende ronde');
});

test('scenario: zonder opgeslagen basis blijft het oude, veilige gedrag (conflict → kiezen); "Beide samenvoegen" lost het op', async () => {
  const cloud = fakeCloud();
  const kees = device({ groceries: [g('a', 'Melk')] }); await kees.sync(cloud);
  const daphne = device({ groceries: [] }); await daphne.sync(cloud);
  kees.data = { groceries: [...kees.data.groceries, g('k', 'Brood')] };
  daphne.data = { groceries: [...daphne.data.groceries, g('d', 'Kaas')] };
  await daphne.sync(cloud);
  kees.baseValues = {}; // bijv. oude app-versie of opslag vol
  const r = await kees.sync(cloud);
  assert.equal(r.status, 'conflict'); assert.equal(r.conflicts[0].section, 'groceries');
  const fix = await kees.sync(cloud, { resolutions: { groceries: 'merge' } });
  assert.equal(fix.status, 'ok');
  assert.deepEqual(kees.data.groceries.map(x => x.id).sort(), ['a', 'd', 'k']);
});

test('scenario: echt conflict op hetzelfde veld wordt gemeld met veldnaam, niet stil overschreven', async () => {
  const cloud = fakeCloud();
  const kees = device({ groceries: [g('a', 'Melk')] }); await kees.sync(cloud);
  const daphne = device({ groceries: [] }); await daphne.sync(cloud);
  kees.data = { groceries: [g('a', 'Volle melk')] };
  daphne.data = { groceries: [g('a', 'Havermelk')] };
  await daphne.sync(cloud);
  const r = await kees.sync(cloud);
  assert.equal(r.status, 'conflict'); assert.deepEqual(r.conflicts[0].fields, ['[a].title']);
  assert.equal(kees.data.groceries[0].title, 'Volle melk');
});

test('scenario: herstelde back-up (hold) wordt nooit automatisch samengevoegd; gelijktijdige schrijfactie → opnieuw', async () => {
  const cloud = fakeCloud();
  const kees = device({ groceries: [g('a', 'Melk')] }); await kees.sync(cloud);
  const daphne = device({ groceries: [] }); await daphne.sync(cloud);
  kees.data = { groceries: [...kees.data.groceries, g('k', 'Brood')] };
  daphne.data = { groceries: [...daphne.data.groceries, g('d', 'Kaas')] };
  await daphne.sync(cloud);
  assert.equal((await kees.sync(cloud, { hold: true })).status, 'conflict');
  cloud.failNextPut();
  const raced = await kees.sync(cloud);
  assert.equal(raced.status, 'conflict'); assert.equal(raced.conflicts[0].raced, true);
  assert.equal((await kees.sync(cloud)).status, 'ok', 'volgende ronde voegt alsnog samen');
});

test('oude code-sync: mergeData voegt alle onderdelen samen en laat meta/settings lokaal', () => {
  const base = { meta: { updatedAt: '1' }, settings: { x: 1 }, groceries: [g('a', 'Melk')], chores: [] };
  const local = { meta: { updatedAt: '2' }, settings: { x: 2 }, groceries: [g('a', 'Melk'), g('k', 'Brood')], chores: [] };
  const remote = { meta: { updatedAt: '3' }, settings: { x: 9 }, groceries: [g('a', 'Melk')], chores: [{ id: 'c', title: 'Bed' }] };
  const m = HS.mergeData(base, local, remote);
  assert.equal(m.ok, true);
  assert.deepEqual(m.value.groceries.map(x => x.id), ['a', 'k']); assert.equal(m.value.chores.length, 1);
  assert.deepEqual(m.value.settings, { x: 2 }); assert.equal(m.value.meta.updatedAt, '2');
});

test('app.js en account-sync.js gebruiken het samenvoegen; opslag vol breekt opslaan niet', () => {
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  const acct = fs.readFileSync(__dirname + '/account-sync.js', 'utf8');
  assert.match(app, /window\.SamenThuisHouseholdSync\.mergeData\(syncBase, data, remoteData\)/);
  assert.match(app, /storeLegacySyncBase\(householdId, data\)/);
  assert.match(app, /data-sync-conflict-choice="merge">Beide samenvoegen/);
  assert.match(app, /'samenThuisSyncBaseV1', 'samenThuisAccountSyncBaseValuesV1'/, 'save() ruimt basiskopieën op bij volle opslag');
  assert.match(acct, /baseValues: loadBaseValues\(\)/);
  assert.match(acct, /data-acct-resolve="\$\{esc2\(c\.section\)\}:merge"/);
  assert.match(app, /AUTO_SYNC_INTERVAL_MS = 30000/, 'app haalt elke 30 s nieuwe wijzigingen op als hij open staat');
});
