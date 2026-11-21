// Opdracht 7 — browsertest (echte Chromium: localStorage, IndexedDB, storage-events, herlaadbeurten, browserherstart).
// Supabase is nagebootst (household_state, put_household_state, personal_preferences met voorwaardelijke PATCH en RLS per
// token). Er gaat niets naar een echt project. Vertraagde verzoeken worden in de nagebootste server vastgehouden.
// Gebruik: node e2e/isolation-v7.mjs   (slaat over als Playwright ontbreekt)
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

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const H1 = '11111111-1111-4111-8111-111111111111', H2 = '22222222-2222-4222-8222-222222222222';
const MEMBER = { [A]: H1, [B]: H2 };
const CODE1 = 'code-van-huishouden-1', CODE2 = 'code-van-huishouden-2';
const cloud = { [H1]: new Map(), [H2]: new Map() };
const prefs = new Map(); // user → { finance_config, updated_at }
const ctl = { puts: [], prefReqs: [], hold: null, readDelayMs: 0 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Verzoek vasthouden tot de test het vrijgeeft (gesimuleerde trage verbinding). De server verwerkt een PATCH direct bij
// ontvangst (zoals een echte server), alleen het antwoord wordt vertraagd.
const gate = () => { let open; const p = new Promise(r => { open = r; }); return { p, open }; };

async function supabase(route) {
  const req = route.request(); const url = new URL(req.url());
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  const user = String(req.headers()['authorization'] || '').replace(/^Bearer tok-/, '');
  if (url.pathname.endsWith('/auth/v1/token')) return json(400, { message: 'refresh niet nagebootst' });
  if (url.pathname.endsWith('/rest/v1/household_members')) {
    if (url.searchParams.get('select') === 'household_id') return json(200, MEMBER[user] ? [{ household_id: MEMBER[user] }] : []);
    if (url.searchParams.get('select') === 'user_id') return json(200, Object.entries(MEMBER).filter(([, h]) => `eq.${h}` === url.searchParams.get('household_id')).map(([u]) => ({ user_id: u })));
    return json(200, MEMBER[user] ? [{ role: 'member', households: { id: MEMBER[user], name: 'Huis', join_code: 'X' } }] : []);
  }
  if (url.pathname.endsWith('/rest/v1/household_state') && req.method() === 'GET') {
    const hid = (url.searchParams.get('household_id') || '').replace(/^eq\./, '');
    if (ctl.readDelayMs) await sleep(ctl.readDelayMs);
    if (MEMBER[user] !== hid) return json(200, []);
    return json(200, [...cloud[hid]].map(([section, r]) => ({ section, payload: r.payload, version: r.version, updated_at: null, updated_by: r.by })));
  }
  if (url.pathname.endsWith('/rest/v1/rpc/put_household_state')) {
    const b = JSON.parse(req.postData() || '{}');
    if (MEMBER[user] !== b.p_household) return json(403, { code: '42501', message: 'Geen toegang' });
    const t = cloud[b.p_household], cur = t.get(b.p_section), v = cur ? cur.version : 0;
    if (v !== b.p_expected_version) return json(409, { code: '40001', message: 'Versieconflict' });
    t.set(b.p_section, { payload: b.p_payload, version: v + 1, by: user }); ctl.puts.push({ hid: b.p_household, section: b.p_section, user });
    if (ctl.holdPut) { const g = ctl.holdPut; ctl.holdPut = null; g.arrived(); await g.p; }
    return json(200, v + 1);
  }
  if (url.pathname.endsWith('/rest/v1/personal_preferences')) {
    // RLS: uitsluitend de eigen rij (auth.uid() uit het token), ongeacht wat er in de query of payload staat.
    const target = (url.searchParams.get('user_id') || '').replace(/^eq\./, '');
    const entry = { method: req.method(), user, target, at: Date.now() };
    ctl.prefReqs.push(entry);
    let result;
    if (req.method() === 'GET') result = [200, target === user && prefs.has(user) ? [prefs.get(user)] : []];
    else if (req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}');
      const row = prefs.get(user), expected = (url.searchParams.get('updated_at') || '').replace(/^eq\./, '');
      if (target === user && row && 'finance_config' in body && row.updated_at === expected) { prefs.set(user, { finance_config: body.finance_config, updated_at: body.updated_at }); entry.applied = true; result = [200, [prefs.get(user)]]; }
      else if (target === user && row && !('finance_config' in body)) { prefs.set(user, { ...row, updated_at: body.updated_at }); result = [200, []]; }
      else result = [200, []];
    } else if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (body.user_id !== user) result = [403, { code: '42501', message: 'RLS' }];
      else if (!prefs.has(user) && 'finance_config' in body) { prefs.set(user, { finance_config: body.finance_config, updated_at: new Date().toISOString() }); entry.applied = true; result = [201, [prefs.get(user)]]; }
      else result = [201, []];
    }
    if (ctl.hold && ctl.hold.method === req.method()) { const g = ctl.hold; ctl.hold = null; g.arrived(); await g.p; }
    return json(...result);
  }
  if (req.method() === 'GET') return json(200, []);
  return json(200, {});
}

const results = []; let failed = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'OK  ' : 'FOUT'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const errors = [];
const browser = await chromium.launch();

async function device({ noIndexedDB = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  if (noIndexedDB) await context.addInitScript(() => { try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (_) {} });
  await context.route(/supabase\.co/, supabase);
  await context.route(u => !u.href.startsWith(base) && !/supabase\.co/.test(u.href), r => r.abort());
  return context;
}
async function openPage(context) {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(700);
  return page;
}
const waitIdle = page => page.waitForFunction(() => typeof syncing === 'undefined' || !syncing, null, { timeout: 15000 });
const sync = async page => { await waitIdle(page); const r = await page.evaluate(() => window.SamenThuisAccountSync?.sync()); await waitIdle(page); return r; };
const identity = page => page.evaluate(() => SamenThuisIdentity.current());
const titles = page => page.evaluate(() => data.groceries.map(g => g.title).sort());
const auth = uid => ({ access_token: 'tok-' + uid, refresh_token: 'ref-' + uid, expires_at: Date.now() + 36e5, user: { id: uid, email: uid.slice(0, 1) + '@example.test' } });
async function switchTo(page, uid, { enable = null } = {}) {
  await page.evaluate(({ a, enable }) => {
    if (a) localStorage.setItem('samenThuisPersonalAuthV1', JSON.stringify(a)); else localStorage.removeItem('samenThuisPersonalAuthV1');
    if (enable) SamenThuisIdentityStore.setAccount(localStorage, enable.uid, { enabled: true, householdId: enable.hid });
    return SamenThuisIdentity.reevaluate();
  }, { a: uid ? auth(uid) : null, enable });
  await page.waitForLoadState('load'); await page.waitForTimeout(900);
}
async function enterCode(page, code) {
  await page.evaluate(() => { location.hash = '#/settings/synchronisatie'; });
  const input = await page.waitForSelector('#syncHouseholdCode', { state: 'visible', timeout: 8000 });
  await input.fill(code);
  await page.click('#syncForm button[type=submit]');
  await page.waitForTimeout(300); await waitIdle(page);
}
const importText = (page, text) => page.evaluate(t => importBackup(new File([t], 'b.json', { type: 'application/json' })), text).then(() => page.waitForTimeout(300));
// Samenvoegen van een volledige back-up via de echte importpagina (Importeren → Volledige back-up).
async function mergeViaUi(page, text) {
  await page.evaluate(() => { current = 'imports243'; render(); });
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.import243Jump = 'backup'; document.body.appendChild(b); b.click(); b.remove(); });
  const input = await page.waitForSelector('[data-import243-file]', { state: 'attached', timeout: 5000 });
  await input.setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.waitForTimeout(200);
  await page.click('[data-import243-run]'); await page.waitForTimeout(400);
  const t = await page.evaluate(() => document.querySelector('#toast')?.textContent || '');
  await page.evaluate(() => { current = 'today'; render(); });
  return t;
}
const toastText = page => page.evaluate(() => document.querySelector('#toast')?.textContent || '');
const decryptWith = (page, payload, code) => page.evaluate(async ({ p, c }) => { try { return await decryptData(p, c); } catch { return null; } }, { p: payload, c: code });

try {
  // ======== Apparaat 1: A (H1, bestaande identiteit) en B (H2, nieuwe identiteit) ========
  const ctx = await device();
  let page = await openPage(ctx);
  await page.evaluate(({ A, H1 }) => {
    localStorage.clear();
    localStorage.setItem('samenThuisDataV2', JSON.stringify({ meta: { version: 2, updatedAt: new Date().toISOString() }, groceries: [{ id: 'g-a', title: 'A-melk', category: 'Overig', done: false }], budgetV23: { incomes: { Kees: 3456 } }, sportCoach: { library: [{ id: 'sc1', title: 'Hardlopen' }] }, settings: { weatherPlace: 'Utrecht' } }));
    localStorage.setItem('samenThuisAccountSyncV1', JSON.stringify({ enabled: true, householdId: H1, bases: { [`${A}:${H1}`]: { base: {} } } }));
    localStorage.setItem('samenThuisSyncV1', JSON.stringify({ householdCode: 'code-van-huishouden-1' }));
  }, { A, H1 });
  // H1 bevat al gegevens van A (versleuteld met de oude globale code).
  cloud[H1].set('ideas', { payload: await page.evaluate(v => encryptData(v, 'code-van-huishouden-1'), [{ id: 'i1', title: 'H1-idee' }]), version: 1, by: A });
  await switchTo(page, A);
  await sync(page);
  const codesA = await page.evaluate(() => JSON.parse(localStorage.getItem('samenThuisHouseholdCodesV1') || '{}'));
  check('C1. bestaande identiteit A: oude code pas overgenomen na ontsleutelen van H1-gegevens (bewijs)', codesA[`${A}|${H1}`]?.source === 'legacy-verified' && codesA[`${A}|${H1}`]?.verified === true && ctl.puts.some(p => p.user === A && p.hid === H1), JSON.stringify(codesA));

  // Tabbladconflict onder A vastleggen (echt IndexedDB).
  await page.evaluate(() => SamenThuisSyncMeta.shared().recordTabConflict({ scope: SamenThuisIdentity.current().key, path: 'groceries[g-a].title', section: 'groceries', kept: 'A-melk', other: 'A-geheim', base: 'x' }));
  const conflictA = await page.evaluate(async () => (await SamenThuisTabConflicts.list()).map(c => [c.key, c.other]));

  // ---- B: nieuwe identiteit in een leeg huishouden H2 ----
  await switchTo(page, B, { enable: { uid: B, hid: H2 } });
  const putsBefore = ctl.puts.length;
  const r0 = await sync(page);
  const b0 = await page.evaluate(() => ({ msg: document.querySelector('[data-acct-card] [role=status]')?.textContent || '', code: syncConfig.householdCode, field: document.querySelector('#syncHouseholdCode')?.value || '' }));
  check('C2. regressie P2: B zonder eigen code → geen eerste push naar leeg H2 (globale code van A niet gebruikt)', ctl.puts.length === putsBefore && !cloud[H2].size && !b0.code && !b0.field, JSON.stringify({ r0, b0 }));
  await enterCode(page, CODE2);
  await page.evaluate(() => { data.groceries.push({ id: 'g-b', title: 'B-ei', category: 'Overig', done: false }); save({ sync: false }); });
  await sync(page);
  const h2 = cloud[H2].get('groceries');
  check('C3. B met zelf ingevulde code: H2 versleuteld met de code van B, niet met die van A', !!h2 && !!(await decryptWith(page, h2.payload, CODE2)) && !(await decryptWith(page, h2.payload, CODE1)));

  // ---- Bewaarde gegevens, conflictlogboek en financiële apparaatconflicten voor B ----
  await page.evaluate(() => { location.hash = '#/settings/back-ups'; }); await page.waitForTimeout(500);
  const pb = await page.evaluate(async () => ({ retained: SamenThuisIdentity.retained().length, card: !!document.querySelector('[data-download-retained]'), conflicts: (await SamenThuisTabConflicts.list()).length, fin: (await SamenThuisFinanceSync.list()).length }));
  const forged = await page.evaluate(async key => {
    // Vervalste knop met de sleutel van de gekoppelde kopie van A: de klikafhandeling moet weigeren.
    let downloaded = false; const orig = window.downloadBackup; window.downloadBackup = () => { downloaded = true; };
    const b = document.createElement('button'); b.dataset.downloadRetained = 'samenThuisDataV2'; document.body.appendChild(b); b.click(); b.remove();
    window.downloadBackup = orig;
    const restored = await SamenThuisTabConflicts.restore(key, 'other');
    return { downloaded, restored, titles: data.groceries.map(g => g.title) };
  }, conflictA[0]?.[0]);
  check('C4. regressie P1/P5: B ziet geen bewaarde gegevens van A, geen tabbladconflict van A, geen financieel apparaatconflict', pb.retained === 0 && !pb.card && pb.conflicts === 0 && pb.fin === 0, JSON.stringify(pb));
  check('C5. regressie: B kan de kopie van A niet downloaden en het conflict van A niet terugzetten', !forged.downloaded && forged.restored === false && !forged.titles.includes('A-geheim'), JSON.stringify(forged));

  // ---- Back-ups in B ----
  const beforeB = await page.evaluate(() => ({ g: JSON.stringify(data.groceries), s: localStorage.getItem('samenThuisDataV2') }));
  await importText(page, JSON.stringify({ meta: { version: 2 }, groceries: [{ id: 'x1', title: 'Uit oude back-up', category: 'Overig', done: false }], settings: { weatherPlace: 'Maastricht' } }));
  const t1 = await toastText(page);
  await importText(page, JSON.stringify({ meta: { version: 2, exportIdentity: { mode: 'retained', key: 'samenThuisDataV2', status: 'gekoppeld', target: `samenThuisDataV3|${A}|${H1}` } }, groceries: [{ id: 'r', title: 'Kopie van A', category: 'Overig', done: false }] }));
  const t2 = await toastText(page);
  await importText(page, JSON.stringify({ meta: { version: 2, exportIdentity: { mode: 'account', accountId: A, householdId: H1 } }, groceries: [] }));
  await importText(page, JSON.stringify({ meta: { version: 9, exportIdentity: { mode: 'account', accountId: B, householdId: H2 } }, groceries: [] }));
  const t4 = await toastText(page);
  const afterB = await page.evaluate(() => ({ g: JSON.stringify(data.groceries), s: localStorage.getItem('samenThuisDataV2'), hold: !!localStorage.getItem(SamenThuisIdentity.keys().restoreHoldKey) }));
  check('C6. regressie P3: back-up zonder herkomst, kopie van A en back-up van A geweigerd in B; nieuwere versie geweigerd; niets gewijzigd', afterB.g === beforeB.g && afterB.s === beforeB.s && !afterB.hold && /niet vast/.test(t1) && /ander account/.test(t2) && /nieuwere/.test(t4), JSON.stringify({ t1, t2, t4 }));
  // Back-up van B zelf: wel terug, zonder apparaatinstellingen over te nemen.
  await importText(page, JSON.stringify({ meta: { version: 2, exportIdentity: { mode: 'account', accountId: B, householdId: H2 } }, groceries: [{ id: 'own', title: 'Eigen back-up B', category: 'Overig', done: false }], settings: { weatherPlace: 'Maastricht' }, sportCoach: { library: [] } }));
  const own = await page.evaluate(() => ({ t: data.groceries.map(g => g.title), settings: data.settings, stored: JSON.parse(localStorage.getItem('samenThuisDataV2')).settings, sport: JSON.parse(localStorage.getItem('samenThuisDataV2')).sportCoach }));
  check('C7. eigen back-up van B hersteld; apparaatinstellingen en SportCoach niet overgenomen', JSON.stringify(own.t) === '["Eigen back-up B"]' && own.settings?.weatherPlace === 'Utrecht' && own.stored?.weatherPlace === 'Utrecht' && own.sport?.library?.[0]?.title === 'Hardlopen', JSON.stringify(own));

  // ---- Vervolg: strikte allowlist (herstellen én samenvoegen) en afgeschermde opslag via de console ----
  const beforeAl = await page.evaluate(() => ({ g: JSON.stringify(data.groceries), s: JSON.stringify(data.settings) }));
  await importText(page, JSON.stringify({ meta: { version: 2, exportIdentity: { mode: 'account', accountId: B, householdId: H2 } }, groceries: [{ id: 'z', title: 'Met onbekend onderdeel', category: 'Overig', done: false }], evilSection: { x: 'A-data' } }));
  const tAl = await toastText(page);
  const mergeA = await mergeViaUi(page, JSON.stringify({ meta: { version: 2, exportIdentity: { mode: 'account', accountId: A, householdId: H1 } }, groceries: [{ id: 'm', title: 'Samengevoegd van A', category: 'Overig', done: false }] }));
  const mergeU = await mergeViaUi(page, JSON.stringify({ meta: { version: 2, exportIdentity: { mode: 'account', accountId: B, householdId: H2 } }, groceries: [], evilSection: {} }));
  const mergeOld = await mergeViaUi(page, JSON.stringify({ groceries: [{ id: 'o', title: 'Oude back-up', category: 'Overig', done: false }] }));
  const afterAl = await page.evaluate(() => ({ g: JSON.stringify(data.groceries), s: JSON.stringify(data.settings), q: Object.keys(localStorage).filter(k => k.startsWith('samenThuisDataV3|quarantine|')).length }));
  check('A1. allowlist in account: herstel en samenvoegen met onbekend onderdeel, van A of zonder herkomst geweigerd; niets gewijzigd', afterAl.g === beforeAl.g && afterAl.s === beforeAl.s && afterAl.q === 0 && /onderdelen/.test(tAl) && /ander account/.test(mergeA) && /onderdelen/.test(mergeU) && /niet vast/.test(mergeOld), JSON.stringify({ tAl, mergeA, mergeU, mergeOld }));
  const consoleProbe = await page.evaluate(async ({ A, H1, keyA }) => {
    const m = SamenThuisSyncMeta.shared();
    return { tab: (await m.listTabConflicts({ scope: keyA })).length, tabRecords: (await m.listRecords('tab')).length, base: Object.keys(await m.loadBaseValues(`${A}:${H1}`, {})).length, fin: (await SamenThuisFinanceConflicts.shared().list(`${A}:${H1}`)).length };
  }, { A, H1, keyA: `samenThuisDataV3|${A}|${H1}` });
  check('G1. console (gesimuleerde aanvaller in de pagina): conflicten, basiswaarden en financiële records van A niet op te vragen met een parameter', consoleProbe.tab === 0 && consoleProbe.tabRecords === 0 && consoleProbe.base === 0 && consoleProbe.fin === 0, JSON.stringify(consoleProbe));

  // ---- Twee huishoudens met eigen codes op één apparaat; terug naar A en browserherstart ----
  await switchTo(page, A); await sync(page);
  const aCode = await page.evaluate(() => syncConfig.householdCode);
  await page.close();
  page = await openPage(ctx); // browserherstart (zelfde opslag)
  const restartA = await page.evaluate(() => ({ id: SamenThuisIdentity.current().key, code: syncConfig.householdCode, t: data.groceries.map(g => g.title) }));
  await switchTo(page, B);
  const restartB = await page.evaluate(() => ({ code: syncConfig.householdCode, t: data.groceries.map(g => g.title) }));
  check('C8. twee huishoudens, twee codes op één apparaat; na herstart en wissel elk de eigen code en dataset', aCode === CODE1 && restartA.code === CODE1 && restartA.t.includes('A-melk') && restartB.code === CODE2 && restartB.t.includes('Eigen back-up B') && !restartB.t.includes('A-melk'), JSON.stringify({ aCode, restartA, restartB }));

  // ---- Verkeerde code bij bestaand huishouden: fail-closed ----
  await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('samenThuisHouseholdCodesV1')); m[`${SamenThuisIdentity.current().accountId}|${SamenThuisIdentity.current().householdId}`].code = 'verkeerde-code-123456'; localStorage.setItem('samenThuisHouseholdCodesV1', JSON.stringify(m)); });
  await page.waitForTimeout(100);
  await page.evaluate(() => { syncConfig = loadSyncConfig(); data.groceries.push({ id: 'w', title: 'Met verkeerde code', category: 'Overig', done: false }); save({ sync: false }); });
  const putsWrong = ctl.puts.length;
  await sync(page);
  check('C9. verkeerde code bij bestaand huishouden: niets verstuurd, cloud ongewijzigd', ctl.puts.length === putsWrong && !!(await decryptWith(page, cloud[H2].get('groceries').payload, CODE2)));
  await page.evaluate(code => { const m = JSON.parse(localStorage.getItem('samenThuisHouseholdCodesV1')); m[`${SamenThuisIdentity.current().accountId}|${SamenThuisIdentity.current().householdId}`].code = code; localStorage.setItem('samenThuisHouseholdCodesV1', JSON.stringify(m)); syncConfig = loadSyncConfig(); }, CODE2);

  // ---- Upload al verzonden vóór een accountwissel; antwoord komt pas na de wissel (pagina herlaadt intussen) ----
  await switchTo(page, A); await sync(page);
  await page.evaluate(() => { data.groceries.push({ id: 'g-inflight', title: 'A-onderweg', category: 'Overig', done: false }); save({ sync: false }); });
  let gp = gate(); let putArrived; const putArrival = new Promise(r => { putArrived = r; }); ctl.holdPut = { p: gp.p, arrived: putArrived };
  const putsIn = ctl.puts.length;
  page.evaluate(() => window.SamenThuisAccountSync.sync()).catch(() => {});
  await putArrival;
  await switchTo(page, B);
  gp.open(); await page.waitForTimeout(800);
  const inflight = ctl.puts.slice(putsIn);
  const bAfter = await page.evaluate(() => ({ id: SamenThuisIdentity.current().accountId, t: data.groceries.map(g => g.title) }));
  check('P1. upload vóór wissel: server verwerkt hem onder A in H1 (eigen huishouden), niets bij B of H2; dataset B onaangetast', inflight.some(p => p.user === A && p.hid === H1 && p.section === 'groceries') && inflight.filter(p => p.user === A).every(p => p.hid === H1) && inflight.filter(p => p.hid === H2).every(p => p.user === B)
    && bAfter.id === B && !bAfter.t.includes('A-onderweg') && !JSON.stringify(await decryptWith(page, cloud[H2].get('groceries').payload, CODE2)).includes('A-onderweg'), JSON.stringify({ inflight, bAfter }));
  await switchTo(page, A);
  const putsBack = ctl.puts.length;
  await sync(page);
  check('P2. terug bij A: de al verwerkte upload wordt herkend, geen dubbele upload van boodschappen', !ctl.puts.slice(putsBack).some(p => p.section === 'groceries') && (await titles(page)).includes('A-onderweg'), JSON.stringify(ctl.puts.slice(putsBack)));

  // ---- finance_config: vertraagde verzoeken tijdens een accountwissel (in dezelfde pagina, vóór herladen) ----
  await switchTo(page, A);
  prefs.set(A, { finance_config: { pots: [{ id: 'p', name: 'A-pot' }], expenses: [] }, updated_at: '2026-11-01T10:00:00.000Z' });
  prefs.set(B, { finance_config: { pots: [{ id: 'q', name: 'B-pot' }], expenses: [] }, updated_at: '2026-11-01T10:00:00.000Z' });
  const setupUi = () => page.evaluate(() => {
    const ui = SamenThuisFinanceUi; const realAuth = window.SamenThuisAuth25;
    ui.state.ctx = { auth: realAuth, render() {}, applyDistributions: () => false, names: () => ({ self: 'Ik', other: 'Ander' }) };
    ui.state.personal = { loaded: false, pots: [], expenses: [] }; ui.state.remote.status = 'idle'; ui.state.remote.loadedAt = 0;
  });
  // Wissel zoals tussen authenticate25 en de herlaadbeurt: de sessie in het geheugen is al van B.
  const sessionSwitch = uid => page.evaluate(a => { const real = window.SamenThuisAuth25; SamenThuisFinanceUi.state.ctx.auth = { ...real, session: () => a, ready: async () => a }; }, auth(uid));
  await setupUi();
  await page.evaluate(() => SamenThuisFinanceUi.refresh(true));
  const loadedA = await page.evaluate(() => SamenThuisFinanceUi.state.personal);
  // F1: lezen vastgehouden; wissel naar B; antwoord komt daarna.
  let g = gate(); let arrived; const arrival = new Promise(r => { arrived = r; }); ctl.hold = { method: 'GET', p: g.p, arrived };
  const reqs1 = ctl.prefReqs.length;
  const save1 = page.evaluate(async () => { const s = SamenThuisFinanceUi.state; s.personal.pots = [...s.personal.pots, { id: 'n', name: 'A-nieuw' }]; try { await SamenThuisFinanceUi.savePersonal(); return 'ok'; } catch (e) { return e.name + ': ' + e.message; } });
  await arrival; await sessionSwitch(B); g.open();
  const out1 = await save1;
  const sent1 = ctl.prefReqs.slice(reqs1);
  check('F1. lezen vóór wissel, antwoord erna: niets meer verzonden (geen PATCH voor A of B), opslag afgebroken', /StaleIdentity/.test(out1) && sent1.every(r => r.method === 'GET') && prefs.get(B).finance_config.pots[0].name === 'B-pot' && prefs.get(A).finance_config.pots.length === 1, JSON.stringify({ out1, sent1 }));
  // F2: PATCH al verzonden vóór de wissel; de server verwerkt hem onder het token van A; het late antwoord wordt verworpen.
  await setupUi(); await page.evaluate(() => SamenThuisFinanceUi.refresh(true));
  const baseBefore = await page.evaluate(() => JSON.stringify(SamenThuisFinanceUi.state.personal.base));
  g = gate(); const arrival2 = new Promise(r => { arrived = r; }); ctl.hold = { method: 'PATCH', p: g.p, arrived };
  const reqs2 = ctl.prefReqs.length;
  const save2 = page.evaluate(async () => { const s = SamenThuisFinanceUi.state; s.personal.pots = [...s.personal.pots, { id: 'n2', name: 'A-tweede' }]; try { await SamenThuisFinanceUi.savePersonal(); return 'ok'; } catch (e) { return e.name; } });
  await arrival2; await sessionSwitch(B); g.open();
  const out2 = await save2;
  const after2 = await page.evaluate(() => ({ base: JSON.stringify(SamenThuisFinanceUi.state.personal.base) }));
  const sent2 = ctl.prefReqs.slice(reqs2);
  check('F2. PATCH vóór wissel: server verwerkt hem als A (eigen rij); laat antwoord niet toegepast; B-rij onaangeroerd', out2 === 'StaleIdentity' && prefs.get(A).finance_config.pots.some(p => p.name === 'A-tweede') && prefs.get(B).finance_config.pots.length === 1
    && sent2.filter(r => r.method === 'PATCH').every(r => r.user === A && r.target === A) && after2.base === baseBefore, JSON.stringify({ out2, sent2, after2: after2.base === baseBefore }));
  // F3: laden (huishouden + privé) vastgehouden; wissel; antwoord van A niet in de staat van de pagina.
  await setupUi();
  g = gate(); const arrival3 = new Promise(r => { arrived = r; }); ctl.hold = { method: 'GET', p: g.p, arrived };
  const load3 = page.evaluate(() => SamenThuisFinanceUi.refresh(true));
  await arrival3; await sessionSwitch(B); g.open(); await load3;
  const st3 = await page.evaluate(() => ({ loaded: SamenThuisFinanceUi.state.personal.loaded, pots: SamenThuisFinanceUi.state.personal.pots.map(p => p.name), status: SamenThuisFinanceUi.state.remote.status }));
  check('F3. laden vóór wissel, antwoord erna: privé-potjes van A niet geladen in de pagina', !st3.loaded && !st3.pots.includes('A-pot'), JSON.stringify(st3));
  check('F0. vóór de wissel geladen: privé-potjes van A', loadedA.loaded && loadedA.pots.some(p => p.name === 'A-pot'));

  // ---- Vertraagde syncronde tijdens een huishoudwissel (storage-event uit een ander tabblad) ----
  await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(700);
  const other = await openPage(ctx);
  await page.evaluate(() => { data.groceries.push({ id: 'g-late', title: 'A-laat', category: 'Overig', done: false }); save({ sync: false }); });
  ctl.readDelayMs = 1500;
  const putsHh = ctl.puts.length;
  page.evaluate(() => window.SamenThuisAccountSync.sync()).catch(() => {});
  await sleep(300);
  MEMBER[A] = H2;
  await other.evaluate(({ A, H2 }) => SamenThuisIdentityStore.setAccount(localStorage, A, { enabled: true, householdId: H2 }), { A, H2 });
  await sleep(2500); ctl.readDelayMs = 0;
  const hhSwitch = await page.evaluate(() => SamenThuisIdentity.current());
  const aH1 = await page.evaluate(k => localStorage.getItem(k), `samenThuisDataV3|${A}|${H1}`);
  check('H1. huishoudwissel tijdens vertraagde ronde: ronde schrijft niets meer (geen uploads), nieuwe identiteit geladen, H1-dataset intact', ctl.puts.slice(putsHh).length === 0 && hhSwitch.householdId === H2 && aH1.includes('A-laat'), JSON.stringify({ puts: ctl.puts.slice(putsHh), hh: hhSwitch.householdId }));
  check('H2. A in H2: geen code van H1 hergebruikt (A heeft voor H2 geen eigen code)', await page.evaluate(() => !syncConfig.householdCode && !syncConfig.codeCandidate));
  MEMBER[A] = H1;
  await other.close();
  await ctx.close();

  // ======== Apparaat 3: M1 — oude financiële apparaatconflicten en automatische migratie (echte IndexedDB) ========
  const ctx3 = await device();
  let p3 = await openPage(ctx3);
  await p3.evaluate(({ A, H1 }) => {
    localStorage.clear();
    localStorage.setItem('samenThuisDataV2', JSON.stringify({ meta: { version: 2, updatedAt: new Date().toISOString() }, groceries: [{ id: 'm1', title: 'M1-melk', category: 'Overig', done: false }], budgetV23: { pct: 61 }, sportCoach: { library: [{ id: 'sc', title: 'Hardlopen' }] } }));
    localStorage.setItem('samenThuisSyncV1', JSON.stringify({ householdCode: 'code-van-huishouden-1' }));
    // Accountsync stond aan voor A in H1 (één aantoonbare identiteit): automatische migratie bij het laden.
    localStorage.setItem('samenThuisAccountSyncV1', JSON.stringify({ enabled: true, householdId: H1, bases: { [`${A}:${H1}`]: { base: {} } } }));
  }, { A, H1 });
  await p3.reload({ waitUntil: 'load' }); await p3.waitForTimeout(800);
  // Oud record zoals opdracht 5 het schreef (device, geen localKey). Het tijdstip ligt vóór de koppeling (journaal 'at'):
  // nagebootst door het record achteraf met een tijdstip van gisteren in de echte IndexedDB te zetten.
  const oldRec = (section, detectedAt) => ({ key: `fin|device|${section}`, slot: 'device', scope: 'device', kind: 'finance', section, origin: 'tab', status: 'open', rev: 1, base: { pct: 50 }, local: { pct: 61 }, remote: { pct: 39 }, forcedPaths: ['pct'], localUser: null, householdId: null, detectedAt, updatedAt: detectedAt, resolution: null });
  await p3.evaluate(r => SamenThuisSyncMeta.shared().putRecord(r), oldRec('budgetV23', new Date(Date.now() - 864e5).toISOString()));
  const putsM1 = ctl.puts.length;
  await switchTo(p3, A);
  const roundM1 = await sync(p3);
  const m1 = await p3.evaluate(async () => ({ id: SamenThuisIdentity.current().key, journal: JSON.parse(localStorage.getItem('samenThuisDataMigrationV1')).v2, fin: (await SamenThuisFinanceSync.list()).map(r => [r.scope, r.section, r.status, r.local?.pct]), card: !!document.querySelector('[data-fin-guard]') }));
  check('M1-a. automatische migratie: oud conflict gekoppeld aan A (behouden, open, waarden intact); budget niet verstuurd', m1.journal === 'bound' && JSON.stringify(m1.fin) === JSON.stringify([[`${A}:${H1}`, 'budgetV23', 'open', 61]]) && !ctl.puts.slice(putsM1).some(p => p.section === 'budgetV23') && ['ok', 'conflict', 'partial'].includes(roundM1?.status), JSON.stringify({ m1, roundM1, puts: ctl.puts.slice(putsM1) }));
  // Onbekende herkomst (geen tijdstip): blokkeert elke identiteit; B ziet geen waarden en kan bewust vrijgeven.
  await p3.evaluate(r => SamenThuisSyncMeta.shared().putRecord(r), oldRec('fuelEntries', ''));
  await switchTo(p3, B, { enable: { uid: B, hid: H2 } });
  await enterCode(p3, CODE2);
  await p3.evaluate(() => { data.fuelEntries = [{ id: 'f-b', total: 70 }]; save({ sync: false }); });
  const putsU = ctl.puts.length;
  await sync(p3);
  await p3.evaluate(() => { location.hash = '#/settings/synchronisatie'; }); await p3.waitForTimeout(500);
  const guardUi = await p3.evaluate(() => ({ row: document.querySelector('[data-fin-guard]')?.textContent || '', btn: !!document.querySelector('[data-fin-release="fuelEntries"]'), budgetForB: !!document.querySelector('[data-fin-row="budgetV23"]') }));
  check('M1-b. onbekende herkomst: upload van B geblokkeerd, waarschuwing zonder bedragen, conflict van A niet zichtbaar voor B', !ctl.puts.slice(putsU).some(p => p.section === 'fuelEntries') && guardUi.btn && !/61|39/.test(guardUi.row) && !guardUi.budgetForB, JSON.stringify({ guardUi, puts: ctl.puts.slice(putsU) }));
  await p3.click('[data-fin-release="fuelEntries"]'); await p3.waitForTimeout(500);
  const putsR = ctl.puts.length;
  await sync(p3);
  const kept = await p3.evaluate(async () => (await SamenThuisFinanceConflicts.shared().list('device')).map(r => [r.section, r.status, r.local?.pct, r.releasedFor?.length]));
  check('M1-c. bewuste vrijgave door B: daarna eigen waarde van B verstuurd (geen waarde uit het conflict gekozen); conflict bewaard', ctl.puts.slice(putsR).some(p => p.section === 'fuelEntries' && p.user === B) && JSON.stringify(kept) === JSON.stringify([['fuelEntries', 'open', 61, 1]]), JSON.stringify({ kept, puts: ctl.puts.slice(putsR) }));
  await switchTo(p3, A); await sync(p3);
  const aStill = await p3.evaluate(async () => ({ guard: !!(await SamenThuisFinanceSync.list()).length }));
  check('M1-d. vrijgave geldt alleen voor B: A blijft geblokkeerd (eigen gekoppeld conflict + niet vrijgegeven oud conflict)', !ctl.puts.slice(putsR).some(p => p.user === A && ['budgetV23', 'fuelEntries'].includes(p.section)) && aStill.guard);
  // Lokaal profiel: onbekende onderdelen uit een back-up gaan naar quarantaine, niet naar de dataset.
  await switchTo(p3, null);
  await importText(p3, JSON.stringify({ meta: { version: 2 }, groceries: [{ id: 'l', title: 'Lokaal hersteld', category: 'Overig', done: false }], evilSection: { geheim: 1 }, settings: { weatherPlace: 'Maastricht' } }));
  const local = await p3.evaluate(() => ({ t: data.groceries.map(g => g.title), evil: 'evilSection' in data, q: Object.keys(localStorage).filter(k => k.startsWith('samenThuisDataV3|quarantine|')).map(k => JSON.parse(localStorage.getItem(k)).evilSection), w: data.settings?.weatherPlace || null }));
  check('A2. lokaal profiel: bekende onderdelen hersteld, onbekend onderdeel apart in quarantaine (niet geladen), instellingen niet overgenomen', JSON.stringify(local.t) === '["Lokaal hersteld"]' && !local.evil && JSON.stringify(local.q) === '[{"geheim":1}]' && local.w !== 'Maastricht', JSON.stringify(local));
  await ctx3.close();

  // ======== Apparaat 2: zonder IndexedDB (localStorage-fallback) ========
  const ctx2 = await device({ noIndexedDB: true });
  const p2 = await openPage(ctx2);
  await p2.evaluate(() => localStorage.clear());
  await switchTo(p2, A, { enable: { uid: A, hid: H1 } });
  const durability = await p2.evaluate(async () => (await SamenThuisSyncMeta.shared().status()).durability);
  await p2.evaluate(() => SamenThuisSyncMeta.shared().recordTabConflict({ scope: SamenThuisIdentity.current().key, path: 'groceries[x].title', section: 'groceries', kept: 'a', other: 'A-fallback-geheim', base: 'x' }));
  const listA = await p2.evaluate(async () => (await SamenThuisTabConflicts.list()).map(c => c.other));
  await switchTo(p2, B, { enable: { uid: B, hid: H2 } });
  const listB = await p2.evaluate(async () => (await SamenThuisTabConflicts.list()).length);
  check('D1. zonder IndexedDB (fallback): conflict van A alleen voor A zichtbaar, niet voor B', durability !== 'durable' && JSON.stringify(listA) === '["A-fallback-geheim"]' && listB === 0, JSON.stringify({ durability, listA, listB }));
  await ctx2.close();
} finally {
  await browser.close(); server.close();
}
check('geen JavaScript-fouten', !errors.length, errors.slice(0, 3).join(' | '));
console.log(results.join('\n'));
console.log(failed ? `\n${failed} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(failed ? 1 : 0);
