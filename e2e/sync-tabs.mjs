// Optionele browsertest (Opdracht 2): echte app-code in Chromium met echte tabbladen, IndexedDB, storage-events en Web Locks.
// Supabase is nagebootst (geheugentabel household_state + RPC put_household_state); er gaat niets naar een echt project.
// Gebruik: node e2e/sync-tabs.mjs   (slaat over als Playwright ontbreekt)
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

const HH = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const state = new Map();                       // section -> { payload, version }
const ctl = { readDelayMs: 0, abortNextPut: false, reads: 0, activeReads: 0, maxActiveReads: 0, puts: 0 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function supabase(route) {
  const req = route.request(); const url = new URL(req.url());
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (url.pathname.endsWith('/rest/v1/household_members')) return json(200, [{ role: 'owner', households: { id: HH, name: 'Test', join_code: 'ABCDEF1234' } }]);
  if (url.pathname.endsWith('/rest/v1/household_state') && req.method() === 'GET') {
    ctl.reads++; ctl.activeReads++; ctl.maxActiveReads = Math.max(ctl.maxActiveReads, ctl.activeReads);
    try {
      if (ctl.readDelayMs) await sleep(ctl.readDelayMs);
      return await json(200, [...state].map(([section, r]) => ({ section, payload: r.payload, version: r.version, updated_at: null })));
    } finally { ctl.activeReads--; }
  }
  if (url.pathname.endsWith('/rest/v1/rpc/put_household_state')) {
    const b = JSON.parse(req.postData() || '{}');
    const cur = state.get(b.p_section), v = cur ? cur.version : 0;
    if (v !== b.p_expected_version) return json(409, { code: '40001', message: 'Versieconflict' });
    state.set(b.p_section, { payload: b.p_payload, version: v + 1 }); ctl.puts++;
    if (ctl.abortNextPut) { ctl.abortNextPut = false; return route.abort('connectionreset'); } // commit gelukt, antwoord kwijt
    return json(200, v + 1);
  }
  if (req.method() === 'GET') return json(200, []);
  return json(200, {});
}

const results = []; let failed = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'OK  ' : 'FOUT'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const browser = await chromium.launch();

async function newContext({ account = false, legacyBase = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await context.route(/supabase\.co/, supabase);
  await context.route(u => !u.href.startsWith(base) && !/supabase\.co/.test(u.href), r => r.abort());
  await context.addInitScript(({ account, legacyBase, HH, USER }) => {
    if (sessionStorage.getItem('e2e-init')) return;
    sessionStorage.setItem('e2e-init', '1');
    if (legacyBase && !localStorage.getItem('e2e-legacy-done')) {
      localStorage.setItem('samenThuisAccountSyncBaseValuesV1', JSON.stringify(legacyBase));
      localStorage.setItem('e2e-legacy-done', '1');
    }
    if (!account || localStorage.getItem('samenThuisAccountSyncV1')) return;
    localStorage.setItem('samenThuisSyncV1', JSON.stringify({ householdCode: 'test-huishouden-123' }));
    localStorage.setItem('samenThuisAccountSyncV1', JSON.stringify({ enabled: true, householdId: HH }));
    localStorage.setItem('samenThuisPersonalAuthV1', JSON.stringify({ access_token: 'tok', refresh_token: 'ref', expires_at: Date.now() + 36e5, user: { id: USER, email: 'kees@example.test' } }));
  }, { account, legacyBase, HH, USER });
  return context;
}
async function open(context) {
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(800);
  return { page, errors };
}
const titles = page => page.evaluate(() => data.groceries.map(g => g.title).sort());
const add = (page, title) => page.evaluate(t => { data.groceries.push({ id: 'e2e-' + t, title: t, category: 'Overig', done: false }); save({ sync: false }); }, title);
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('samenThuisDataV2')).groceries.map(g => g.title).sort());
const waitIdle = page => page.waitForFunction(() => !syncing, null, { timeout: 15000 });

try {
  // ---- 1. Twee tabbladen, zonder accountsync ----
  {
    const ctx = await newContext();
    const a = await open(ctx), b = await open(ctx);
    await add(a.page, 'Brood');
    await b.page.waitForTimeout(300);
    check('tab B neemt wijziging van tab A over via storage-event', (await titles(b.page)).includes('Brood'));
    // Tab B wijzigt zonder het event (nog) te zien: simuleer door direct na A te schrijven.
    await Promise.all([add(a.page, 'Kaas'), add(b.page, 'Eieren')]);
    await a.page.waitForTimeout(300);
    const s = await stored(a.page);
    check('gelijktijdig in twee tabbladen: beide toevoegingen in de opslag', s.includes('Kaas') && s.includes('Eieren') && s.includes('Brood'), s.join(', '));
    const ta = await titles(a.page), tb = await titles(b.page);
    check('beide tabbladen hebben dezelfde stand', JSON.stringify(ta) === JSON.stringify(tb), `${ta} | ${tb}`);
    // Zelfde veld anders in twee tabbladen.
    await a.page.evaluate(() => { data.groceries.find(g => g.id === 'e2e-Kaas').title = 'Geitenkaas'; });
    await b.page.evaluate(() => { data.groceries.find(g => g.id === 'e2e-Kaas').title = 'Oude kaas'; save({ sync: false }); });
    await a.page.waitForTimeout(200);
    await a.page.evaluate(() => save({ sync: false }));
    const log = await a.page.evaluate(() => SamenThuisSyncMeta.shared().listTabConflicts());
    check('zelfde veld in twee tabbladen: conflict in logboek (IndexedDB) met de andere waarde', log.length >= 1, JSON.stringify(log.map(c => c.fields)));
    check('geen JavaScript-fouten (tabbladen)', !a.errors.length && !b.errors.length, [...a.errors, ...b.errors].join(' | '));
    check('metastore gebruikt echte IndexedDB', (await a.page.evaluate(() => SamenThuisSyncMeta.shared().mode())) === 'indexeddb');
    await ctx.close();
  }

  // ---- 2. Migratie van oude basiswaarden + bestaande gegevens behouden ----
  {
    const ctx = await newContext({ legacyBase: { 'x:y': { groceries: [{ id: 'g1', title: 'Tomaten' }] } } });
    const a = await open(ctx);
    const before = await a.page.evaluate(() => localStorage.getItem('samenThuisDataV2'));
    const moved = await a.page.evaluate(async () => (await SamenThuisSyncMeta.shared().loadBaseValues('x:y')).groceries?.[0]?.title);
    const legacy = await a.page.evaluate(() => localStorage.getItem('samenThuisAccountSyncBaseValuesV1'));
    check('oude basiswaarden overgezet naar IndexedDB en oude sleutel opgeruimd', moved === 'Tomaten' && legacy === null, `${moved} / ${legacy}`);
    await a.page.reload({ waitUntil: 'load' }); await a.page.waitForTimeout(500);
    const after = await a.page.evaluate(() => localStorage.getItem('samenThuisDataV2'));
    const again = await a.page.evaluate(async () => (await SamenThuisSyncMeta.shared().loadBaseValues('x:y')).groceries?.[0]?.title);
    check('na herladen: applicatiegegevens ongewijzigd, basis nog aanwezig', JSON.parse(after).groceries.length === JSON.parse(before).groceries.length && again === 'Tomaten');
    await ctx.close();
  }

  // ---- 3. Accountsync: wijziging tijdens ronde, gelijktijdige verzoeken, netwerkverlies, heropenen ----
  {
    const ctx = await newContext({ account: true });
    const a = await open(ctx);
    await waitIdle(a.page);
    await a.page.evaluate(() => SamenThuisAccountSync.sync()); await waitIdle(a.page);
    check('eerste ronde: groceries in de cloud', state.has('groceries'));

    // Gelijktijdige verzoeken in één tabblad: één leesactie tegelijk.
    ctl.readDelayMs = 400; ctl.maxActiveReads = 0;
    await a.page.evaluate(() => Promise.all([1, 2, 3, 4, 5].map(() => SamenThuisAccountSync.sync())));
    await waitIdle(a.page); await a.page.waitForTimeout(900); await waitIdle(a.page);
    check('vijf gelijktijdige syncverzoeken: nooit parallelle rondes', ctl.maxActiveReads === 1, 'max parallel ' + ctl.maxActiveReads);

    // Twee tabbladen met accountsync: Web Lock laat één ronde tegelijk toe.
    const b = await open(ctx); await waitIdle(b.page);
    ctl.maxActiveReads = 0;
    await Promise.all([a.page.evaluate(() => SamenThuisAccountSync.sync()), b.page.evaluate(() => SamenThuisAccountSync.sync())]);
    check('twee tabbladen tegelijk: één ronde per apparaat', ctl.maxActiveReads === 1, 'max parallel ' + ctl.maxActiveReads);
    await b.page.close();

    // Lokale wijziging tijdens een lopende ronde; intussen heeft "het andere apparaat" iets toegevoegd.
    const g = state.get('groceries');
    const remoteList = (await a.page.evaluate(p => decryptData(p, 'test-huishouden-123'), g.payload));
    remoteList.push({ id: 'remote-Appels', title: 'Appels', category: 'Overig', done: false });
    state.set('groceries', { payload: await a.page.evaluate(v => encryptData(v, 'test-huishouden-123'), remoteList), version: g.version + 1 });
    ctl.readDelayMs = 1500;
    const round = a.page.evaluate(() => SamenThuisAccountSync.sync());
    await a.page.waitForTimeout(400);
    await add(a.page, 'Peren');
    await round;
    const mid = await titles(a.page);
    check('wijziging tijdens ronde blijft staan (geen oudere cloudrespons eroverheen)', mid.includes('Peren'), mid.join(', '));
    ctl.readDelayMs = 0;
    await a.page.waitForTimeout(1200); await waitIdle(a.page);
    const merged = await titles(a.page);
    const cloudList = await a.page.evaluate(p => decryptData(p, 'test-huishouden-123').then(v => v.map(x => x.title).sort()), state.get('groceries').payload);
    check('vervolgronde voegt samen: Peren en Appels lokaal én in de cloud', merged.includes('Peren') && merged.includes('Appels') && cloudList.includes('Peren') && cloudList.includes('Appels'), `${merged} | ${cloudList}`);

    // Netwerkverlies tijdens upload (server commit, antwoord kwijt) → pending + inflight → herladen → afronden.
    await add(a.page, 'Melk-offline');
    ctl.abortNextPut = true;
    const putsBefore = ctl.puts;
    await a.page.evaluate(() => SamenThuisAccountSync.sync()); await waitIdle(a.page);
    const inflight = await a.page.evaluate(async () => (await SamenThuisAccountSync.inflight()).map(x => x.section));
    const pending = await a.page.evaluate(() => SamenThuisAccountSync.pending());
    check('netwerkverlies tijdens upload: niet als gesynchroniseerd gemarkeerd', inflight.includes('groceries') && pending.includes('groceries'), `inflight ${inflight} pending ${pending}`);
    await a.page.reload({ waitUntil: 'load' }); await a.page.waitForTimeout(500); await waitIdle(a.page);
    await a.page.evaluate(() => SamenThuisAccountSync.sync()); await waitIdle(a.page);
    const after = await a.page.evaluate(async () => ({ inflight: (await SamenThuisAccountSync.inflight()).length, pending: SamenThuisAccountSync.pending(), titles: data.groceries.map(g => g.title) }));
    check('na heropenen: wijziging bewaard, bevestigd zonder tweede upload', after.titles.includes('Melk-offline') && after.inflight === 0 && !after.pending.includes('groceries') && ctl.puts === putsBefore + 1, JSON.stringify({ ...after, puts: ctl.puts - putsBefore }));
    check('geen JavaScript-fouten (accountsync)', !a.errors.length, a.errors.join(' | '));
    await ctx.close();
  }

  // ---- 4. IndexedDB niet beschikbaar ----
  {
    const ctx = await newContext();
    await ctx.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { return undefined; }, configurable: true }); });
    const a = await open(ctx);
    const mode = await a.page.evaluate(() => SamenThuisSyncMeta.shared().mode());
    await add(a.page, 'Zonder IDB');
    check('zonder IndexedDB: terugval op localStorage, app werkt', mode === 'localStorage' && (await stored(a.page)).includes('Zonder IDB') && !a.errors.length, mode + ' ' + a.errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(results.join('\n'));
console.log(failed ? `\n${failed} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(failed ? 1 : 0);
