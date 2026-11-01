const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('./import-core.js');

const FX = path.join(__dirname, 'test-fixtures', 'import');
const TODAY = '2026-10-01';
const run = (text, opts = {}) => Core.analyse([Core.textRead(text)], { today: TODAY, ...opts });
const csvEntries = (name, opts = {}) => {
  const text = Core.decodeBytes(fs.readFileSync(path.join(FX, name))).text;
  return Core.analyse([{ name, type: 'CSV', status: 'ok', warnings: [], segments: Core.textToSegments(text, name, 'CSV') }], { today: TODAY, ...opts });
};

test('getalnotaties: Nederlands en internationaal', () => {
  assert.equal(Core.parseNumber('1.234,56'), 1234.56);
  assert.equal(Core.parseNumber('1,234.56'), 1234.56);
  assert.equal(Core.parseNumber('€ 4,99'), 4.99);
  assert.equal(Core.parseNumber('3.490,00'), 3490);
  assert.equal(Core.parseNumber('12,5'), 12.5);
});

test('scheidingsteken wordt automatisch herkend', () => {
  assert.equal(Core.detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.equal(Core.detectDelimiter('a;b;c\n1;2,5;3'), ';');
  assert.equal(Core.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
});

test('CSV met komma: kolommen blijven bij hun rij', () => {
  const { entries, reports } = csvEntries('taken.csv');
  assert.equal(reports[0].status, 'ok');
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(e => e.target), ['chores', 'chores']);
  assert.equal(entries[0].rec.title, 'Badkamer schoonmaken');
  assert.equal(entries[0].rec.person, 'Kees');
  assert.equal(entries[1].rec.title, 'Ramen, zemen');
  assert.equal(entries[1].rec.person, 'Daphne');
});

test('CSV met puntkomma en Nederlandse getallen', () => {
  const { entries } = csvEntries('boodschappen.csv');
  assert.equal(entries.length, 3);
  assert.equal(entries[1].rec.title, 'Appels');
  assert.equal(entries[1].rec.amount, 1.5);
  assert.match(entries[1].rec.note, /3\.490,00/);
  assert.equal(entries[2].rec.amount, 500);
});

test('TXT met alinea’s wordt over de juiste bestemmingen verdeeld', () => {
  const text = Core.decodeBytes(fs.readFileSync(path.join(FX, 'notities.txt'))).text;
  const { entries } = run(text);
  const by = t => entries.filter(e => e.target === t).map(e => e.rec.title);
  assert.ok(by('groceries').includes('aardappelen'));
  assert.ok(by('chores').some(t => /tandarts/i.test(t)));
  assert.equal(by('meals').length, 2);
});

test('andere tekencodering (windows-1252) blijft leesbaar', () => {
  const d = Core.decodeBytes(fs.readFileSync(path.join(FX, 'latin1.txt')));
  assert.match(d.text, /Café/);
});

test('eigen tekst: opsommingen onder een kop', () => {
  const { entries } = run('Boodschappen\n- 2 kg aardappelen\n- melk\n\nBel de tandarts');
  assert.deepEqual(entries.map(e => e.target), ['groceries', 'groceries', 'chores']);
  assert.equal(entries[0].rec.amount, 2);
  assert.equal(entries[0].rec.unit, 'kg');
});

test('eigen tekst: bestaand pipe-formaat blijft werken', () => {
  const { entries } = run('Agenda | Tandarts | 2026-10-02 | 09:30 | | 10:00 | | Utrecht');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].target, 'planning');
  assert.equal(entries[0].rec.startDate, '2026-10-02');
  assert.equal(entries[0].rec.startTime, '09:30');
  assert.equal(entries[0].rec.location, 'Utrecht');
});

test('recept: ingrediënten worden boodschappen met verwijzing naar het gerecht', () => {
  const { entries } = run('Recept: Pasta pesto\nIngrediënten:\n- 250 g pasta\n- 1 pot pesto\nBereiding:\nKook de pasta.');
  assert.equal(entries.filter(e => e.target === 'meals').length, 1);
  assert.equal(entries.filter(e => e.target === 'groceries').length, 2);
});

test('rtf wordt omgezet naar tekst', () => {
  const t = Core.rtfToText(fs.readFileSync(path.join(FX, 'brief.rtf'), 'latin1'));
  assert.equal(t, 'Afspraak tandarts 7 oktober 2026 om 08:45\nCafé bezoek');
});

test('JSON met lijsten per onderdeel', () => {
  const read = { name: 'data.json', status: 'ok', warnings: [], segments: Core.jsonToSegments(JSON.parse(fs.readFileSync(path.join(FX, 'data.json'), 'utf8')), 'data.json') };
  const { entries } = Core.analyse([read], { today: TODAY });
  assert.deepEqual(entries.map(e => e.target).sort(), ['chores', 'groceries']);
});

test('een onleesbaar bestand blokkeert de rest niet en wordt nooit als succes gemeld', () => {
  const bad = { name: 'kapot.pdf', status: 'unreadable', message: 'Niet leesbaar', warnings: [], segments: [] };
  const ok = Core.textRead('Boodschappen\n- melk');
  const { entries, reports } = Core.analyse([bad, ok], { today: TODAY });
  assert.equal(reports[0].status, 'unreadable');
  assert.equal(reports[1].status, 'ok');
  assert.equal(entries.length, 1);
});

test('gelezen tekst zonder herkende onderdelen telt niet als volledig succes', () => {
  const { reports } = Core.analyse([Core.textRead('...')], { today: TODAY });
  assert.notEqual(reports[0].status, 'ok');
});

test('dubbele items worden herkend en standaard uitgezet', () => {
  const existing = { groceries: [{ title: 'Melk', done: false }], planning: [], meals: [], chores: [], stock: [], ideas: [], home: [], trips: [], tripFolders: [] };
  const { entries } = run('Boodschappen\n- melk\n- brood\n- brood');
  Core.markDuplicates(entries, existing);
  assert.deepEqual(entries.map(e => [e.rec.title, e.duplicate, e.selected]), [['melk', true, false], ['brood', false, true], ['brood', true, false]]);
});

test('bestemming wijzigen behoudt titel en datum', () => {
  const { entries } = run('Agenda | Tandarts | 2026-10-02 | 09:30');
  const rec = Core.convertRecord(entries[0].rec, 'chores');
  assert.equal(rec.target, 'chores');
  assert.equal(rec.title, 'Tandarts');
  assert.equal(rec.startDate, '2026-10-02');
});

test('gekozen bestemming forceert de verdeling', () => {
  const { entries } = run('melk\nbrood', { target: 'groceries' });
  assert.deepEqual(entries.map(e => e.target), ['groceries', 'groceries']);
});

test('buildItem maakt gewone app-items zonder bronverwijzing', () => {
  const { entries } = run('Agenda | Tandarts | 2026-10-02 | 09:30');
  let n = 0;
  const item = Core.buildItem(entries[0].rec, { today: TODAY, id: () => `id${++n}`, calendarId: 'persoonlijk' });
  assert.equal(item.id, 'id1');
  assert.equal(item.date, '2026-10-02');
  assert.equal(item.time, '09:30');
  assert.equal(item.calendarId, 'persoonlijk');
  assert.ok(!JSON.stringify(item).includes('.csv'));
  assert.ok(!('source' in item));
});

test('reisgegevens met tabel krijgen reis, onderdeel en bedrag', () => {
  const { entries } = run('Reis: Vietnam 2027\nVervoer\n- Vlucht Schiphol naar Hanoi 11 januari 2027 10:30');
  assert.equal(entries[0].target, 'trips');
  assert.equal(entries[0].rec.trip, 'Vietnam 2027');
  assert.equal(entries[0].rec.section, 'Vervoer');
  assert.equal(entries[0].rec.startDate, '2027-01-11');
});

/* ===== Eindcontrole PR #5: regressietests ===== */
const baseData = () => ({
  meta: { updatedAt: 'x' }, settings: { thema: 'donker' },
  budget: { incomes: { Kees: 3000 }, fixed: [{ name: 'Huur', amount: 1234.56 }], houseBudget: 1000 },
  planning: [{ id: 'p1', title: 'Bestaand', date: '2026-10-01', time: '10:00' }],
  meals: [], groceries: [{ id: 'g1', title: 'Melk', done: false }, { id: 'g0', title: 'Brood', done: true }],
  chores: [{ id: 'c1', title: 'Afwassen' }], stock: [], ideas: [], home: [], trips: [], tripFolders: [], tripSections: []
});
let seq = 0;
const ctxFor = () => ({ today: TODAY, id: () => `n${++seq}`, calendarId: 'persoonlijk' });

test('Nederlandse notaties: datum 01-11-2026, € 1.234,56, decimalen en puntkomma', () => {
  const { entries } = run('Agenda | Ouderavond | 01-11-2026 | 19:30\nHuur betalen € 1.234,56 op 1-12-2026\nTandarts 3 november 2026 om 14.30 uur');
  assert.equal(entries[0].rec.startDate, '2026-11-01');
  assert.equal(entries[1].rec.startDate, '2026-12-01');
  assert.match(entries[1].rec.description, /1234,56/);
  assert.equal(entries[2].rec.startDate, '2026-11-03');
  assert.equal(entries[2].rec.startTime, '14:30');
  const csv = 'Datum;Omschrijving;Bedrag\n01-11-2026;Huur;€ 1.234,56\n';
  const r = Core.analyse([{ name: 'b.csv', status: 'ok', warnings: [], segments: Core.textToSegments(csv, 'b.csv', 'CSV') }], { today: TODAY });
  assert.equal(r.entries[0].rec.startDate, '2026-11-01');
  assert.match(r.entries[0].rec.description, /1\.234,56/);
  assert.equal(r.entries[0].rec.title, 'Huur');
  assert.ok(!/^Huur\n/.test(r.entries[0].rec.description), 'titel wordt niet dubbel in de omschrijving gezet');
});

test('"à" en prijs blijven buiten de productnaam', () => {
  const { entries } = run('Boodschappen\n- 2 pakken melk à € 1,29\n- 3 blikken tomaten a 0,89');
  assert.deepEqual(entries.map(e => [e.rec.title, e.rec.amount, e.rec.unit]), [['melk', 2, 'pakken'], ['tomaten', 3, 'blikken']]);
});

test('applyEntries raakt budget, instellingen en bestaande items niet aan', () => {
  const data = baseData();
  const before = JSON.parse(JSON.stringify(data));
  const { entries } = run('Boodschappen\n- kaas\nAgenda | Tandarts | 02-11-2026 | 09:30');
  const res = Core.applyEntries(data, entries, ctxFor());
  assert.equal(res.failed.length, 0);
  assert.deepEqual(data.budget, before.budget);
  assert.deepEqual(data.settings, before.settings);
  assert.deepEqual(data.meta, before.meta);
  assert.deepEqual(data.chores, before.chores);
  assert.deepEqual(data.planning.slice(0, 1), before.planning);
  assert.equal(data.planning.length, 2);
  assert.equal(data.groceries.length, 3);
});

test('geïmporteerde items zijn gewone items en na JSON-opslag (herladen) ongewijzigd', () => {
  const data = baseData();
  const { entries } = run('Reis: Vietnam 2027\nVervoer\n- Vlucht 11 januari 2027');
  Core.applyEntries(data, entries, ctxFor());
  const reloaded = JSON.parse(JSON.stringify(data));
  assert.deepEqual(reloaded, data);
  const t = reloaded.trips[0];
  assert.equal(reloaded.tripFolders.find(f => f.id === t.tripFolderId).name, 'Vietnam 2027');
  assert.equal(reloaded.tripSections.find(s => s.id === t.tripSectionId).name, 'Vervoer');
  assert.ok(!('source' in t) && !('file' in t));
});

test('tweede import in dezelfde reis hergebruikt map en onderdeel', () => {
  const data = baseData();
  Core.applyEntries(data, run('Reis: Vietnam 2027\nVervoer\n- Vlucht 11 januari 2027').entries, ctxFor());
  Core.applyEntries(data, run('Reis: vietnam 2027\nVervoer\n- Trein 12 januari 2027').entries, ctxFor());
  assert.equal(data.tripFolders.length, 1);
  assert.equal(data.tripSections.length, 1);
  assert.equal(data.trips.length, 2);
});

test('item zonder titel wordt niet geïmporteerd en blijft als fout gemeld', () => {
  const data = baseData();
  const e = Core.makeEntry(Core.emptyRecord('chores'), { file: 'Handmatig', where: '' });
  const res = Core.applyEntries(data, [e], ctxFor());
  assert.equal(res.failed.length, 1);
  assert.match(res.failed[0], /titel ontbreekt/);
  assert.equal(data.chores.length, 1);
  assert.ok(!e.imported);
});

test('dubbelen: bestaand (ook na bewerken in voorbeeld) herkend; nieuwe gegevens niet geblokkeerd', () => {
  const data = baseData();
  const { entries } = run('Agenda | Bestaand | 01-10-2026 | 10:00\nAgenda | Bestaand | 02-10-2026 | 10:00\nBoodschappen\n- brood\n- melk');
  Core.markDuplicates(entries, data);
  assert.deepEqual(entries.map(e => e.duplicate), [true, false, false, true]);
  assert.equal(entries[2].selected, true, 'afgevinkt "brood" in de app telt niet als dubbel');
  // gebruiker corrigeert de datum van het eerste item: niet meer dubbel
  entries[0].rec.startDate = '2026-10-05';
  Core.markDuplicates(entries, data);
  assert.equal(entries[0].duplicate, false);
  // een dubbel blijft handmatig te selecteren
  entries[3].selected = true; entries[3].userTouchedSelection = true;
  Core.markDuplicates(entries, data);
  assert.equal(entries[3].selected, true);
});

test('synchronisatie: alleen gewijzigde secties worden gepusht, budget en instellingen niet', () => {
  const Sync = require('./household-sync-core.js');
  const data = baseData();
  const hash = v => Sync.hashValue ? Sync.hashValue(v) : null;
  assert.ok(Sync.planSections, 'planSections beschikbaar');
  const remote = {}, base = {};
  Object.entries(data).filter(([k]) => Sync.validSection(k)).forEach(([k, v]) => { remote[k] = { version: 1, value: JSON.parse(JSON.stringify(v)) }; });
  const plan0 = Sync.planSections({ local: data, remote, base: Object.fromEntries(Object.entries(remote).map(([k, r]) => [k, { version: 1, hash: Sync.hashValue ? Sync.hashValue(r.value) : '' }])) });
  Core.applyEntries(data, run('Boodschappen\n- kaas').entries, ctxFor());
  const plan = Sync.planSections({ local: data, remote, base: Object.fromEntries(Object.entries(remote).map(([k, r]) => [k, { version: 1, hash: Sync.hashValue ? Sync.hashValue(r.value) : '' }])) });
  const act = Object.fromEntries(plan.map(a => [a.section, a.action]));
  if (Sync.hashValue) {
    assert.equal(act.groceries, 'push');
    assert.ok(!('meta' in act) && !('settings' in act), 'meta/settings worden niet gesynchroniseerd als sectie');
    ['budget', 'planning', 'chores'].forEach(k => assert.notEqual(act[k], 'push', k));
  } else assert.ok(plan0.length > 0);
});
