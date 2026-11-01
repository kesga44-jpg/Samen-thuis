// Echte-bestandstests. Bibliotheken (pdfjs-dist, mammoth, xlsx) zijn geen projectafhankelijkheid:
// ze worden gezocht via IMPORT_TEST_LIBS (map met node_modules) en de tests worden anders overgeslagen.
// OCR-tests lopen alleen met IMPORT_TEST_OCR_LANGPATH (map met nld/eng traineddata.gz) en tesseract.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const Core = require('./import-core.js');
const Readers = require('./import-readers.js');

const FX = path.join(__dirname, 'test-fixtures', 'import');
const libReq = process.env.IMPORT_TEST_LIBS ? createRequire(path.join(process.env.IMPORT_TEST_LIBS, 'x.js')) : require;
const tryReq = name => { try { return libReq(name); } catch (e) { return null; } };
const mammoth = tryReq('mammoth'), xlsx = tryReq('xlsx');
let pdfjsPath = null;
try { pdfjsPath = libReq.resolve('pdfjs-dist/legacy/build/pdf.mjs'); } catch (e) { /* niet beschikbaar */ }
const tesseract = process.env.IMPORT_TEST_OCR_LANGPATH ? tryReq('tesseract.js') : null;

const env = {
  loadPdfjs: () => import(require('node:url').pathToFileURL(pdfjsPath).href),
  loadMammoth: async () => mammoth,
  loadXlsx: async () => xlsx,
  ocrImage: tesseract ? async (f, bytes) => {
    const w = await tesseract.createWorker('nld+eng', 1, { langPath: process.env.IMPORT_TEST_OCR_LANGPATH, gzip: true });
    const r = await w.recognize(Buffer.from(bytes)); await w.terminate();
    return { text: r.data.text, confidence: r.data.confidence };
  } : undefined
};
const mk = (name, buf) => {
  const b = buf || fs.readFileSync(path.join(FX, name));
  return { name, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
};
const analyse = async (...reads) => Core.analyse(reads, { today: '2026-10-01' });

test('CSV en TXT worden gelezen zonder externe bibliotheken', async () => {
  const csv = await Readers.readFile(mk('boodschappen.csv'), {});
  const txt = await Readers.readFile(mk('notities.txt'), {});
  assert.equal(csv.status, 'ok');
  assert.equal(txt.status, 'ok');
  const { entries } = await analyse(csv, txt);
  assert.ok(entries.some(e => e.rec.title === 'Appels' && e.rec.amount === 1.5));
});

test('JSON en RTF worden gelezen', async () => {
  assert.equal((await Readers.readFile(mk('data.json'), {})).status, 'ok');
  assert.equal((await Readers.readFile(mk('brief.rtf'), {})).status, 'ok');
});

test('ongeldige JSON is niet leesbaar, niet "succesvol"', async () => {
  const r = await Readers.readFile(mk('kapot.json', Buffer.from('{"a": ')), {});
  assert.equal(r.status, 'unreadable');
});

test('leeg bestand is niet leesbaar', async () => {
  const r = await Readers.readFile(mk('leeg.txt', Buffer.alloc(0)), {});
  assert.equal(r.status, 'unreadable');
});

test('niet-ondersteund type en .doc worden als zodanig gemeld', async () => {
  const exe = await Readers.readFile(mk('programma.exe', Buffer.from('MZ-onzin')), {});
  assert.equal(exe.status, 'unsupported');
  const doc = await Readers.readFile(mk('oud.doc', Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 1, 2, 3])), {});
  assert.equal(doc.status, 'unsupported');
});

test('afbeelding zonder OCR wordt niet als gelezen gemarkeerd', async () => {
  const r = await Readers.readFile(mk('boodschappen.png'), {});
  assert.equal(r.status, 'unreadable');
});

test('PDF met meerdere pagina’s: volgorde, opsommingen en tabel', { skip: !pdfjsPath && 'pdfjs-dist niet beschikbaar' }, async () => {
  const r = await Readers.readFile(mk('reisplan.pdf'), env);
  assert.equal(r.status, 'ok');
  assert.equal(r.stats.pages, 3);
  const { entries } = await analyse(r);
  const pages = entries.map(e => Number((e.source.where.match(/pagina (\d)/) || [])[1]));
  assert.deepEqual([...pages].sort(), pages, 'paginavolgorde blijft behouden');
  assert.ok(entries.some(e => /Vlucht Schiphol/.test(e.rec.title) && e.rec.startDate === '2027-01-11'));
  const budget = entries.filter(e => e.rec.section === 'Budget');
  assert.deepEqual(budget.map(e => e.rec.cost), [1250, 890.5]);
});

test('gescande PDF zonder OCR wordt gemeld als niet leesbaar', { skip: !pdfjsPath && 'pdfjs-dist niet beschikbaar' }, async () => {
  const r = await Readers.readFile(mk('scan.pdf'), { ...env, ocrPdfPage: undefined });
  assert.notEqual(r.status, 'ok');
  assert.ok(r.message);
});

test('XLSX en XLS met meerdere werkbladen', { skip: !xlsx && 'xlsx niet beschikbaar' }, async () => {
  for (const name of ['multi.xlsx', 'multi.xls']) {
    const r = await Readers.readFile(mk(name), env);
    assert.equal(r.status, 'ok', name);
    const { entries } = await analyse(r);
    assert.deepEqual([...new Set(entries.map(e => e.target))].sort(), ['groceries', 'planning', 'stock'], name);
    const tandarts = entries.find(e => e.rec.title === 'Tandarts');
    assert.equal(tandarts.rec.startDate, '2026-10-02');
    assert.equal(tandarts.rec.startTime, '09:30');
    assert.match(tandarts.source.where, /werkblad 'Agenda'/);
    assert.equal(entries.find(e => e.rec.title === 'Pasta').rec.bestBefore, '2027-05-01');
  }
});

test('DOCX met koppen, opsommingen en tabel', { skip: !mammoth && 'mammoth niet beschikbaar' }, async () => {
  const r = await Readers.readFile(mk('klus.docx'), env);
  assert.equal(r.status, 'ok');
  const { entries } = await analyse(r);
  assert.ok(entries.some(e => e.rec.title === 'Rookmelder controleren'));
  const row = entries.find(e => e.rec.title === 'Overleg school');
  assert.equal(row.rec.startDate, '2026-10-05');
  assert.match(row.source.where, /tabel 1, rij 2/);
});

test('afbeelding met tekst via OCR', { skip: !tesseract && 'OCR niet beschikbaar (IMPORT_TEST_OCR_LANGPATH)' }, async () => {
  const r = await Readers.readFile(mk('boodschappen.png'), env);
  assert.ok(['ok', 'partial'].includes(r.status));
  const { entries } = await analyse(r);
  assert.ok(entries.some(e => /appels/i.test(e.rec.title)));
});

test('meerdere verschillende bestanden in één import; een fout blokkeert de rest niet', { skip: !pdfjsPath && 'bibliotheken niet beschikbaar' }, async () => {
  const reads = [];
  for (const n of ['reisplan.pdf', 'boodschappen.csv', 'notities.txt']) reads.push(await Readers.readFile(mk(n), env));
  reads.push(await Readers.readFile(mk('kapot.json', Buffer.from('{')), env));
  const { entries, reports } = await analyse(...reads);
  assert.deepEqual(reports.map(r => r.status), ['ok', 'ok', 'ok', 'unreadable']);
  assert.ok(new Set(entries.map(e => e.source.file)).size >= 3);
});
