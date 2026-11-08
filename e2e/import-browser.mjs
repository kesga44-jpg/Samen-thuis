// Browsertest documentimport en scanverwerking (vult de 4 in Node overgeslagen importtests aan).
// Draait de echte app-laders in Chromium: <script integrity> voor mammoth/SheetJS/tesseract en de geverifieerde
// blob-import van pdf.js. Twee standen:
//   E2E_LIVE_CDN=1 node e2e/import-browser.mjs           → echte jsDelivr (vereist internet; test ook de live SRI-hashes)
//   E2E_NPM_DIR=/pad node e2e/import-browser.mjs         → jsDelivr-URL's worden lokaal beantwoord uit uitgepakte npm-pakketten
//        (map met o.a. mammoth-1.12.2/package, xlsx-0.18.5/package, pdfjs-dist-4.10.38/package, tesseract.js-5.1.1/package,
//         tesseract.js-core-5.1.1/package, tesseract.js-data-nld-1.0.0/package, tesseract.js-data-eng-1.0.0/package)
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright niet geïnstalleerd'); process.exit(0); }
const live = process.env.E2E_LIVE_CDN === '1', npmDir = process.env.E2E_NPM_DIR || '';
if (!live && !npmDir) { console.log('SKIP: zet E2E_LIVE_CDN=1 of E2E_NPM_DIR'); process.exit(0); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = p.endsWith('/') ? path.join(p, 'index.html') : p;
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const served = [];
// https://cdn.jsdelivr.net/npm/<pakket>@<versie>/<pad> → <npmDir>/<pakket-zonder-scope>-<versie>/package/<pad>
function localFor(url) {
  // Ook zonder versie (tesseract-taaldata: /npm/@tesseract.js-data/nld/4.0.0_best_int/nld.traineddata.gz).
  const m = /^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/]+\/)?[^@/]+)(?:@v?([^/]+))?\/(.+)$/.exec(url.split('?')[0]);
  if (!m) return null;
  const name = m[1].replace(/^@/, '').replace('/', '-');
  const dirs = fs.readdirSync(npmDir).filter(d => d.startsWith(name + '-') && fs.existsSync(path.join(npmDir, d, 'package')));
  const exact = (m[2] && dirs.find(d => d === `${name}-${m[2]}`)) || dirs[0];
  const file = exact && path.join(npmDir, exact, 'package', m[3]);
  return file && fs.existsSync(file) ? file : null;
}

const results = []; let failed = 0;
const check = (name, ok, detail = '') => { console.error((ok ? 'OK  ' : 'FOUT') + ' ' + name + ' ' + detail); results.push(`${ok ? 'OK  ' : 'FOUT'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const browser = await chromium.launch();
const context = await browser.newContext();
await context.route(u => !u.href.startsWith(base), async route => {
  const url = route.request().url();
  if (/^https:\/\/cdn\.jsdelivr\.net\//.test(url)) {
    if (live) return route.continue();
    const file = localFor(url);
    if (!file) { console.error('niet lokaal beschikbaar: ' + url); return route.fulfill({ status: 404, body: 'niet lokaal: ' + url }); }
    served.push(url);
    return route.fulfill({ status: 200, path: file, headers: { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'access-control-allow-origin': '*' } });
  }
  return route.abort();
});
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(800);

async function read(name) {
  return page.evaluate(async n => {
    const buf = await (await fetch('test-fixtures/import/' + n)).arrayBuffer();
    const file = new File([buf], n);
    const r = await window.SamenThuisImportReaders.readFile(file, window.__samenThuisUniversalImport.env);
    const a = await window.SamenThuisImport.analyse([r], { today: '2026-10-01' });
    return { status: r.status, message: r.message, titles: a.entries.map(e => e.rec.title), where: a.entries.map(e => e.source.where), count: a.reports[0] && a.reports[0].count };
  }, name);
}

let r = await read('reisplan.pdf');
check('PDF via geverifieerde pdf.js-import (blob + SHA-384)', r.status === 'ok' && r.titles.length > 0, `${r.status}, ${r.titles.length} items ${r.message || ''}`);
r = await read('klus.docx');
check('DOCX via mammoth met integrity-attribuut', r.status === 'ok' && r.titles.includes('Rookmelder controleren'), `${r.status} ${r.message || ''}`);
r = await read('multi.xlsx');
const sheets = [...new Set(r.where.map(w => (w.match(/werkblad '([^']+)'/) || [])[1]).filter(Boolean))].sort();
check('XLSX via SheetJS: alle werkbladen in de bronvermelding', r.status === 'ok' && sheets.join(',') === 'Agenda,Boodschappen,Voorraad', `${r.status} ${sheets.join(',')}`);
r = await read('multi.xls');
check('XLS (oud Excel-formaat) via SheetJS', r.status === 'ok' && r.titles.length > 0, `${r.status} ${r.titles.length}`);
r = await read('boodschappen.png');
check('OCR van een afbeelding (tesseract.js 5.1.1, nld+eng)', ['ok', 'partial'].includes(r.status) && r.titles.some(t => /appel/i.test(t)), `${r.status} ${r.titles.slice(0, 4).join(', ')} ${r.message || ''}`);
r = await read('scan.pdf');
check('Gescande PDF via OCR', ['ok', 'partial'].includes(r.status) && r.titles.length > 0, `${r.status} ${r.titles.slice(0, 3).join(', ')} ${r.message || ''}`);

// Integriteit: een gemanipuleerd bestand moet worden geweigerd (alleen in lokale stand te simuleren).
if (!live) {
  const ctx2 = await browser.newContext();
  await ctx2.route(u => !u.href.startsWith(base), route => /mammoth/.test(route.request().url())
    ? route.fulfill({ status: 200, body: 'window.mammoth={extractRawText:()=>({value:"gemanipuleerd"})}', headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' } })
    : /pdf\.min\.mjs/.test(route.request().url()) ? route.fulfill({ status: 200, body: 'export const x=1', headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' } })
    : route.abort());
  const p2 = await ctx2.newPage(); await p2.goto(base, { waitUntil: 'load' }); await p2.waitForTimeout(500);
  const tamper = await p2.evaluate(async () => {
    const out = {};
    for (const n of ['klus.docx', 'reisplan.pdf']) {
      const file = new File([await (await fetch('test-fixtures/import/' + n)).arrayBuffer()], n);
      const r = await window.SamenThuisImportReaders.readFile(file, window.__samenThuisUniversalImport.env);
      out[n] = { status: r.status, message: r.message, mammoth: typeof window.mammoth };
    }
    return out;
  });
  check('gemanipuleerde mammoth wordt door de browser geweigerd (SRI)', tamper['klus.docx'].status === 'unreadable' && tamper['klus.docx'].mammoth === 'undefined', JSON.stringify(tamper['klus.docx']));
  check('gemanipuleerde pdf.js wordt geweigerd vóór uitvoering', tamper['reisplan.pdf'].status === 'unreadable', tamper['reisplan.pdf'].message);
  await ctx2.close();
}
check('geen JavaScript-fouten', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close(); server.close();
console.log(results.join('\n'));
console.log(`\nStand: ${live ? 'live jsDelivr' : 'lokale npm-bestanden (' + new Set(served.map(u => u.split('/npm/')[1].split('/')[0])).size + ' pakketten)'}`);
console.log(`${results.length - failed} geslaagd, ${failed} mislukt`);
process.exit(failed ? 1 : 0);
