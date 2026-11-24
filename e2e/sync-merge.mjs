// Optionele browsertest: twee apparaten (Kees en Daphne) met de echte app-code en een nagebootste Supabase-tabel
// household_data (oude code-sync). Controleert dat de gepauzeerde oude route niets verstuurt of overschrijft.
// Geen echte Supabase: alle verzoeken naar *.supabase.co worden in deze test beantwoord door een geheugentabel.
// Gebruik: node e2e/sync-merge.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright niet geïnstalleerd'); process.exit(0); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = p.endsWith('/') ? path.join(p, 'index.html') : p;
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

// Geheugentabel household_data met voorwaardelijke update op updated_at (zoals PostgREST-filter).
const table = new Map();
async function supabase(route) {
  const req = route.request(); const url = new URL(req.url());
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (!url.pathname.endsWith('/rest/v1/household_data')) return json(404, { message: 'niet nagebootst' });
  const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
  if (req.method() === 'GET') return json(200, table.has(id) ? [table.get(id)] : []);
  const row = JSON.parse(req.postData() || '{}');
  if (req.method() === 'PATCH') {
    const cur = table.get(id); const expect = url.searchParams.get('updated_at');
    const ok = cur && (expect === 'is.null' ? !cur.updated_at : expect === 'eq.' + cur.updated_at);
    if (!ok) return json(200, []);
    table.set(id, { ...cur, ...row }); return json(200, [table.get(id)]);
  }
  if (req.method() === 'POST') { table.set(row.id, row); return json(201, {}); }
  return json(405, {});
}

const results = []; let failed = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'OK  ' : 'FOUT'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const browser = await chromium.launch();
async function deviceFor(name) {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await context.route(/supabase\.co/, supabase);
  await context.route(u => !u.href.startsWith(base) && !/supabase\.co/.test(u.href), r => r.abort());
  await context.addInitScript(() => {
    if (!localStorage.getItem('samenThuisSyncV1')) localStorage.setItem('samenThuisSyncV1', JSON.stringify({ householdCode: 'test-huishouden-123' }));
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(1500);
  return { name, page, context, errors };
}
// De oude code-sync (household_data) is in de app gepauzeerd (pauseLegacySync); accountsynchronisatie vervangt haar.
// Deze test controleert daarom dat de oude route niets meer verstuurt of overschrijft, in plaats van het samenvoegen
// via household_data (dat gedrag bestaat niet meer en liet deze test sinds de pauze falen).
let requests = 0;
const groceries = d => d.page.evaluate(() => data.groceries.map(g => g.title).sort());
const add = (d, title) => d.page.evaluate(t => { data.groceries.push({ id: 'e2e-' + t, title: t, category: 'Overig', done: false }); save({ sync: false }); }, title);
const syncNowIn = async d => { const r = await d.page.evaluate(() => syncNow({ manual: true })); await d.page.waitForTimeout(500); return r; };

const kees = await deviceFor('Kees');
kees.context.on('request', r => { if (/household_data/.test(r.url())) requests++; });
const daphne = await deviceFor('Daphne');
daphne.context.on('request', r => { if (/household_data/.test(r.url())) requests++; });
table.set('test-huishouden-123', { id: 'test-huishouden-123', data: { groceries: [{ id: 'cloud', title: 'Uit de oude cloud' }] }, updated_at: '2026-01-01T00:00:00Z' });
await add(kees, 'Brood'); await add(daphne, 'Kaas');
const rk = await syncNowIn(kees), rd = await syncNowIn(daphne);
await kees.page.evaluate(() => window.dispatchEvent(new Event('focus'))); await kees.page.waitForTimeout(700);
check('oude code-sync gepauzeerd: handmatig synchroniseren meldt de pauze', rk?.status === 'legacy-paused' && rd?.status === 'legacy-paused', JSON.stringify([rk, rd]));
check('geen enkel verzoek naar household_data (ook niet bij terugkeren naar de app)', requests === 0, String(requests));
const k = await groceries(kees), d = await groceries(daphne);
check('lokale gegevens blijven behouden en worden niet overschreven door de oude cloud', k.includes('Brood') && !k.includes('Uit de oude cloud') && d.includes('Kaas') && !d.includes('Brood'), k.join(', ') + ' | ' + d.join(', '));
check('oude cloudrij ongewijzigd', table.get('test-huishouden-123').data.groceries.length === 1);
check('geen JavaScript-fouten', !kees.errors.length && !daphne.errors.length, [...kees.errors, ...daphne.errors].slice(0, 2).join(' | '));
await browser.close(); server.close();
console.log(results.join('\n')); console.log(`\n${results.length - failed} geslaagd, ${failed} mislukt`);
process.exit(failed ? 1 : 0);
