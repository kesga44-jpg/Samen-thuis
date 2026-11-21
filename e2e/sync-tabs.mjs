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
const ctl = { readDelayMs: 0, abortNextPut: false, reads: 0, activeReads: 0, maxActiveReads: 0, puts: 0, putSections: [] };
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
      return await json(200, [...state].map(([section, r]) => ({ section, payload: r.payload, version: r.version, updated_at: r.updatedAt || null, updated_by: r.updatedBy || USER })));
    } finally { ctl.activeReads--; }
  }
  if (url.pathname.endsWith('/rest/v1/rpc/put_household_state')) {
    const b = JSON.parse(req.postData() || '{}');
    const cur = state.get(b.p_section), v = cur ? cur.version : 0;
    if (v !== b.p_expected_version) return json(409, { code: '40001', message: 'Versieconflict' });
    state.set(b.p_section, { payload: b.p_payload, version: v + 1, updatedBy: USER, updatedAt: new Date().toISOString() }); ctl.puts++; ctl.putSections.push(b.p_section);
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
    // Opdracht 6: accountsync per account; de dataset van dit account+huishouden staat onder een eigen sleutel.
    localStorage.setItem('samenThuisAccountSyncV1', JSON.stringify({ accounts: { [USER]: { enabled: true, householdId: HH } }, accountsMigrated: true }));
    localStorage.setItem(`samenThuisDataV3|${USER}|${HH}`, JSON.stringify({ meta: { version: 2 }, groceries: ['Tomaten', 'Basilicum', 'Havermelk'].map((title, i) => ({ id: 'g' + (i + 1), title, category: 'Overig', done: false })) }));
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
    await a.page.waitForTimeout(300);
    const log = await a.page.evaluate(() => SamenThuisSyncMeta.shared().listTabConflicts());
    const rec = log.find(c => c.path === 'groceries[e2e-Kaas].title');
    check('zelfde veld in twee tabbladen: één conflictrecord met beide waarden', log.length === 1 && rec && [rec.kept, rec.other].sort().join('|') === 'Geitenkaas|Oude kaas' && rec.financial === false, JSON.stringify(log.map(c => [c.path, c.kept, c.other, c.count])));
    const restored = await a.page.evaluate(async key => { const ok = await SamenThuisTabConflicts.restore(key, 'other'); return { ok, title: data.groceries.find(g => g.id === 'e2e-Kaas').title }; }, rec && rec.key);
    check('conflict later herstellen: andere waarde teruggezet', restored.ok && restored.title === rec.other, JSON.stringify(restored));
    // Financieel veld in twee tabbladen.
    await a.page.evaluate(() => { data.budgetV23 = { ...(data.budgetV23 || {}), e2eShare: 50 }; save({ sync: false }); });
    await b.page.waitForTimeout(300);
    await a.page.evaluate(() => { data.budgetV23.e2eShare = 40; });
    await b.page.evaluate(() => { data.budgetV23.e2eShare = 60; save({ sync: false }); });
    await a.page.waitForTimeout(300);
    await a.page.waitForTimeout(300);
    const fin = await a.page.evaluate(async () => (await SamenThuisFinanceSync.list()).map(r => ({ section: r.section, origin: r.origin, status: r.status, base: r.base && r.base.e2eShare, local: r.local && r.local.e2eShare, remote: r.remote && r.remote.e2eShare })));
    const toastText = await a.page.evaluate(() => document.querySelector('#toast')?.textContent || '');
    const generalFin = await a.page.evaluate(async () => (await SamenThuisSyncMeta.shared().listTabConflicts()).filter(c => c.financial).length);
    check('financieel tabbladconflict: één financieel record (basis, deze, andere waarde), expliciete melding, niet in algemeen logboek',
      fin.length === 1 && fin[0].section === 'budgetV23' && fin[0].origin === 'tab' && fin[0].status === 'open' && fin[0].base === 50 && [fin[0].local, fin[0].remote].sort().join() === '40,60' && /financiële/.test(toastText) && generalFin === 0,
      JSON.stringify(fin) + ' ' + toastText + ' algemeen:' + generalFin);
    // Kiezen via de kaart in Instellingen (echte klik).
    await a.page.evaluate(() => { location.hash = '#/settings/synchronisatie'; }); await a.page.waitForTimeout(400);
    await a.page.waitForSelector('[data-fin-choose][data-fin-side="remote"]', { timeout: 5000 });
    const otherValue = fin[0].remote;
    await a.page.click('[data-fin-choose][data-fin-side="remote"]');
    await a.page.waitForTimeout(500);
    const after = await a.page.evaluate(async () => ({ value: data.budgetV23.e2eShare, recs: (await SamenThuisFinanceSync.list()).map(r => [r.scope, r.status, r.local === null && r.remote === null]) }));
    check('keuze via de kaart (niet aangemeld → apparaatscope): waarde lokaal opgeslagen, record lokaal afgerond zonder financiële waarden', after.value === otherValue && JSON.stringify(after.recs) === JSON.stringify([['device', 'resolved-local', true]]), JSON.stringify(after));
    check('geen JavaScript-fouten (tabbladen)', !a.errors.length && !b.errors.length, [...a.errors, ...b.errors].join(' | '));
    const st = await a.page.evaluate(() => SamenThuisSyncMeta.shared().status());
    check('metastore gebruikt echte IndexedDB en meldt "durable"', st.mode === 'indexeddb' && st.durability === 'durable', JSON.stringify(st));
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
    // Financieel conflict met een andere gebruiker: upload geblokkeerd, andere onderdelen door, kiezen via de kaart.
    await a.page.evaluate(() => { data.budgetV23 = { e2ePct: 50 }; save({ sync: false }); });
    await a.page.evaluate(() => SamenThuisAccountSync.sync()); await waitIdle(a.page);
    const bRow = state.get('budgetV23');
    const remoteBudget = await a.page.evaluate(p => decryptData(p, 'test-huishouden-123'), bRow.payload);
    remoteBudget.e2ePct = 40;
    state.set('budgetV23', { payload: await a.page.evaluate(v => encryptData(v, 'test-huishouden-123'), remoteBudget), version: bRow.version + 1, updatedBy: '33333333-3333-4333-8333-333333333333', updatedAt: new Date().toISOString() });
    await a.page.evaluate(() => { data.budgetV23.e2ePct = 60; data.groceries.push({ id: 'e2e-fin', title: 'Tijdens conflict', category: 'Overig', done: false }); save({ sync: false }); });
    ctl.putSections = [];
    await a.page.evaluate(() => SamenThuisAccountSync.sync()); await waitIdle(a.page);
    const finRec = await a.page.evaluate(async () => (await SamenThuisFinanceSync.list()).map(r => ({ s: r.section, st: r.status, by: r.remoteUpdatedBy, l: r.local.e2ePct, r: r.remote.e2ePct })));
    const badge = await a.page.evaluate(() => document.querySelector('#syncState')?.textContent || '');
    check('financieel conflict tussen gebruikers: record, upload budget geblokkeerd, boodschappen wel verstuurd, badge meldt het',
      finRec.length === 1 && finRec[0].st === 'open' && finRec[0].by === '33333333-3333-4333-8333-333333333333' && finRec[0].l === 60 && finRec[0].r === 40
      && !ctl.putSections.includes('budgetV23') && ctl.putSections.includes('groceries') && /Financieel conflict/.test(badge),
      JSON.stringify({ finRec, puts: ctl.putSections, badge }));
    // Accountwissel op hetzelfde apparaat (echte herlaadbeurt): ander account ziet en verwerkt het conflict niet.
    const OTHER_USER = '44444444-4444-4444-8444-444444444444';
    await a.page.evaluate(u => { const s = JSON.parse(localStorage.getItem('samenThuisPersonalAuthV1')); s.user.id = u; localStorage.setItem('samenThuisPersonalAuthV1', JSON.stringify(s)); }, OTHER_USER);
    await a.page.reload({ waitUntil: 'load' }); await a.page.waitForTimeout(600); await waitIdle(a.page);
    ctl.putSections = [];
    await a.page.evaluate(() => SamenThuisAccountSync.sync()); await waitIdle(a.page);
    const asOther = await a.page.evaluate(async () => ({ scope: SamenThuisFinanceSync.scope(), list: (await SamenThuisFinanceSync.list()).length, badge: document.querySelector('#syncState')?.textContent || '' }));
    check('ander account op hetzelfde apparaat: ziet het conflict niet, budget van het eerste account niet verstuurd', (asOther.scope === null || asOther.scope.startsWith(OTHER_USER + ':')) && asOther.list === 0 && !ctl.putSections.includes('budgetV23') && !/Financieel/.test(asOther.badge), JSON.stringify({ ...asOther, puts: ctl.putSections }));
    await a.page.evaluate(u => { const s = JSON.parse(localStorage.getItem('samenThuisPersonalAuthV1')); s.user.id = u; localStorage.setItem('samenThuisPersonalAuthV1', JSON.stringify(s)); }, USER);
    await a.page.reload({ waitUntil: 'load' }); await a.page.waitForTimeout(600); await waitIdle(a.page);
    const back = await a.page.evaluate(async () => (await SamenThuisFinanceSync.list()).map(r => [r.status, r.local.e2ePct, r.remote.e2ePct]));
    check('terug naar het eerste account (na herladen): conflict ongewijzigd beschikbaar', JSON.stringify(back) === JSON.stringify([['open', 60, 40]]), JSON.stringify(back));
    await a.page.evaluate(() => { location.hash = '#/settings/synchronisatie'; }); await a.page.waitForTimeout(400);
    await a.page.waitForSelector('[data-fin-choose][data-fin-side="local"]', { timeout: 5000 });
    await a.page.click('[data-fin-choose][data-fin-side="local"]');
    await a.page.waitForTimeout(800); await waitIdle(a.page);
    await a.page.evaluate(() => SamenThuisAccountSync.sync()); await waitIdle(a.page);
    const cloudPct = await a.page.evaluate(p => decryptData(p, 'test-huishouden-123').then(v => v.e2ePct), state.get('budgetV23').payload);
    const finAfter = await a.page.evaluate(async () => (await SamenThuisFinanceSync.list()).length);
    check('na expliciete keuze: gekozen waarde in de cloud, record pas na bevestiging verwijderd', cloudPct === 60 && finAfter === 0, JSON.stringify({ cloudPct, finAfter }));
    check('geen JavaScript-fouten (accountsync)', !a.errors.length, a.errors.join(' | '));
    await ctx.close();
  }

  // ---- 4. IndexedDB niet beschikbaar ----
  {
    const ctx = await newContext();
    await ctx.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { return undefined; }, configurable: true }); });
    const a = await open(ctx);
    const st = await a.page.evaluate(() => SamenThuisSyncMeta.shared().status());
    await add(a.page, 'Zonder IDB');
    check('zonder IndexedDB: terugval localStorage, status "limited" (niet duurzaam gemeld), app werkt', st.mode === 'localStorage' && st.durability === 'limited' && (await stored(a.page)).includes('Zonder IDB') && !a.errors.length, JSON.stringify(st) + ' ' + a.errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(results.join('\n'));
console.log(failed ? `\n${failed} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(failed ? 1 : 0);
