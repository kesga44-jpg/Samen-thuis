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
