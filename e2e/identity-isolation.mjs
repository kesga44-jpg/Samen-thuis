// Opdracht 6 — browsertest met echte localStorage, IndexedDB, storage-events en herlaadbeurten.
// Eén apparaat (browsercontext) wisselt tussen accounts A, B, C en huishoudens H1, H2. Supabase is nagebootst per huishouden
// (geheugentabel household_state + put_household_state); er gaat niets naar een echt project.
// Gebruik: node e2e/identity-isolation.mjs   (slaat over als Playwright ontbreekt)
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

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const H1 = '11111111-1111-4111-8111-111111111111', H2 = '22222222-2222-4222-8222-222222222222';
const MEMBER = { [A]: H1, [B]: H2, [C]: H1 };
const CODE = 'test-huishouden-123';
const cloud = { [H1]: new Map(), [H2]: new Map() };
const ctl = { readDelayMs: 0, unauthorized: new Set(), puts: [] };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function supabase(route) {
  const req = route.request(); const url = new URL(req.url());
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  const user = String(req.headers()['authorization'] || '').replace(/^Bearer tok-/, '');
  if (url.pathname.endsWith('/auth/v1/token')) return json(400, { message: 'refresh niet nagebootst' });
  if (ctl.unauthorized.has(user)) return json(401, { code: 'PGRST301', message: 'JWT expired' });
  if (url.pathname.endsWith('/rest/v1/household_members')) return json(200, MEMBER[user] ? [{ role: 'member', households: { id: MEMBER[user], name: 'Huis', join_code: 'X' } }] : []);
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
    return json(200, v + 1);
  }
  if (req.method() === 'GET') return json(200, []);
  return json(200, {});
}

const results = []; let failed = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'OK  ' : 'FOUT'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const errors = [];
const browser = await chromium.launch();

async function device() {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await context.route(/supabase\.co/, supabase);
  await context.route(u => !u.href.startsWith(base) && !/supabase\.co/.test(u.href), r => r.abort());
  return context;
}
async function openPage(context) {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(700);
  return page;
}
const waitIdle = page => page.waitForFunction(() => typeof syncing === 'undefined' || !syncing, null, { timeout: 15000 });
const sync = async page => { await waitIdle(page); await page.evaluate(() => window.SamenThuisAccountSync?.sync()); await waitIdle(page); };
const identity = page => page.evaluate(() => SamenThuisIdentity.current());
const titles = page => page.evaluate(() => data.groceries.map(g => g.title).sort());
const auth = uid => ({ access_token: 'tok-' + uid, refresh_token: 'ref-' + uid, expires_at: Date.now() + 36e5, user: { id: uid, email: uid.slice(0, 1) + '@example.test' } });
// Wissel van account zoals authenticate25/signOut25 dat doen: sessie in localStorage, daarna reevaluate (→ herladen).
async function switchTo(page, uid, { enable = null } = {}) {
  await page.evaluate(({ a, enable }) => {
    if (a) localStorage.setItem('samenThuisPersonalAuthV1', JSON.stringify(a)); else localStorage.removeItem('samenThuisPersonalAuthV1');
    if (enable) SamenThuisIdentityStore.setAccount(localStorage, enable.uid, { enabled: true, householdId: enable.hid });
    return SamenThuisIdentity.reevaluate();
  }, { a: uid ? auth(uid) : null, enable });
  await page.waitForLoadState('load'); await page.waitForTimeout(900);
}
const groceriesOf = (page, hid) => page.evaluate(async ({ payload }) => payload ? (await decryptData(payload, 'test-huishouden-123')).map(g => g.title).sort() : [], { payload: cloud[hid].get('groceries')?.payload });

try {
  const ctx = await device();
  let page = await openPage(ctx);
  // Bestaand apparaat van vóór de scheiding: A gebruikte accountsync in H1; oude enkele dataset met SportCoach.
  const sport = { library: [{ id: 'sc1', title: 'Hardlopen' }], evaluations: [{ id: 'ev1', score: 7 }] };
  await page.evaluate(({ A, H1, sport, a }) => {
    localStorage.clear();
    localStorage.setItem('samenThuisDataV2', JSON.stringify({ meta: { version: 2, updatedAt: new Date().toISOString() }, groceries: [{ id: 'g-a', title: 'A-melk', category: 'Overig', done: false }], sportCoach: sport, settings: { weatherPlace: 'Utrecht' } }));
    localStorage.setItem('samenThuisAccountSyncV1', JSON.stringify({ enabled: true, householdId: H1, bases: { [`${A}:${H1}`]: { base: {} } } }));
    localStorage.setItem('samenThuisSyncV1', JSON.stringify({ householdCode: 'test-huishouden-123' }));
    localStorage.setItem('samenThuisPersonalAuthV1', JSON.stringify(a));
  }, { A, H1, sport, a: auth(A) });
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(900);
  const v2Before = await page.evaluate(() => localStorage.getItem('samenThuisDataV2'));
  let id = await identity(page);
  check('migratie: aantoonbaar van A → A-dataset; oude dataset ongewijzigd bewaard', id.mode === 'account' && id.accountId === A && (await titles(page)).includes('A-melk')
    && (await page.evaluate(() => JSON.parse(localStorage.getItem('samenThuisDataMigrationV1')).v2)) === 'bound', JSON.stringify(id));
  await sync(page);
  check('A synchroniseert naar H1', (await groceriesOf(page, H1)).includes('A-melk'));

  // 1. A meldt af (echte knop), B meldt aan.
  await page.evaluate(() => { location.hash = '#/settings/account'; }); await page.waitForTimeout(500);
  const signOutButton = await page.waitForSelector('[data-personal-sign-out]', { state: 'visible', timeout: 5000 }).catch(() => null);
  if (signOutButton) { await Promise.all([page.waitForEvent('load', { timeout: 10000 }).catch(() => null), signOutButton.click()]); await page.waitForTimeout(1200); }
  else await switchTo(page, null);
  id = await identity(page);
  check('1. A afgemeld: lokaal profiel zonder gegevens van A (geen voorbeelddata)', id.mode === 'local' && id.key === 'samenThuisDataV3|local' && !(await titles(page)).includes('A-melk') && (await titles(page)).length === 0, JSON.stringify({ id, t: await titles(page), knop: !!signOutButton }));
  await switchTo(page, B);
  check('1b. B aangemeld zonder accountsync: lokaal profiel, niet de gegevens van A', (await identity(page)).mode === 'local' && !(await titles(page)).includes('A-melk'));

  // 2/3/4. B schakelt accountsync in voor H2 (ander huishouden).
  cloud[H2].set('groceries', { payload: await page.evaluate(v => encryptData(v, 'test-huishouden-123'), [{ id: 'g-b', title: 'H2-brood', category: 'Overig', done: false }]), version: 1, by: B });
  await switchTo(page, B, { enable: { uid: B, hid: H2 } });
  id = await identity(page);
  await sync(page);
  check('2. huishouden H2 geopend: eigen dataset, gegevens van H2 opgehaald', id.mode === 'account' && id.householdId === H2 && JSON.stringify(await titles(page)) === JSON.stringify(['H2-brood']), JSON.stringify(await titles(page)));
  check('3. B heeft geen gegevens van A naar H2 gestuurd', !(await groceriesOf(page, H2)).includes('A-melk') && !ctl.puts.some(p => p.hid === H2 && p.user !== B));
  const aDatasetBefore = await page.evaluate(k => localStorage.getItem(k), `samenThuisDataV3|${A}|${H1}`);
  await page.evaluate(() => { data.groceries.push({ id: 'g-b2', title: 'B-ei', category: 'Overig', done: false }); save({ sync: false }); });
  await sync(page);
  check('4. B kan de lokale gegevens van A niet overschrijven', (await page.evaluate(k => localStorage.getItem(k), `samenThuisDataV3|${A}|${H1}`)) === aDatasetBefore);

  // 8. Oude netwerkrespons na accountwissel.
  ctl.readDelayMs = 1500;
  const putsBefore = ctl.puts.length;
  await page.evaluate(() => { data.groceries.push({ id: 'g-b3', title: 'B-laat', category: 'Overig', done: false }); save({ sync: false }); window.SamenThuisAccountSync.sync(); });
  await page.waitForTimeout(200);
  await switchTo(page, A);
  ctl.readDelayMs = 0;
  await page.waitForTimeout(1800);
  const aNow = await page.evaluate(k => localStorage.getItem(k), `samenThuisDataV3|${A}|${H1}`);
  check('8. oude respons van B na wissel naar A schrijft niets (geen upload, A-dataset onaangetast)', !aNow.includes('B-laat') && !aNow.includes('H2-brood') && ctl.puts.slice(putsBefore).every(p => p.user === A), JSON.stringify(ctl.puts.slice(putsBefore)));
  // 5. Terug naar A: juiste dataset.
  check('5. terug naar A: dataset van A (A-melk), niets van B', (await identity(page)).accountId === A && (await titles(page)).includes('A-melk') && !(await titles(page)).some(t => t.startsWith('B-') || t === 'H2-brood'), JSON.stringify(await titles(page)));

  // 6. Browsercrash tijdens accountwissel (sessie al gewijzigd, pagina weg vóór herladen).
  await page.evaluate(a => localStorage.setItem('samenThuisPersonalAuthV1', JSON.stringify(a)), auth(B));
  await page.close({ runBeforeUnload: false });
  page = await openPage(ctx);
  id = await identity(page);
  check('6. crash tijdens wissel: na heropenen de dataset van B, gegevens van A en B intact', id.accountId === B && (await titles(page)).includes('B-ei') && (await titles(page)).includes('B-laat')
    && (await page.evaluate(k => localStorage.getItem(k), `samenThuisDataV3|${A}|${H1}`)).includes('A-melk'));

  // 7. Verlopen sessie tijdens een synchronisatieronde.
  ctl.unauthorized.add(B);
  await page.evaluate(() => { data.groceries.push({ id: 'g-b4', title: 'B-offline', category: 'Overig', done: false }); save({ sync: false }); });
  const putsB = ctl.puts.length;
  await sync(page);
  const after401 = await page.evaluate(() => ({ t: data.groceries.map(g => g.title), msg: document.querySelector('#syncState')?.textContent || '' }));
  check('7. verlopen sessie: niets verstuurd, lokale wijziging bewaard, geen andere dataset geraakt', ctl.puts.length === putsB && after401.t.includes('B-offline'), JSON.stringify(after401));
  ctl.unauthorized.delete(B);
  await sync(page);
  check('7b. na herstel van de sessie alsnog verstuurd naar H2', (await groceriesOf(page, H2)).includes('B-offline'));

  // 9. Back-up van A wordt niet aan B gekoppeld.
  const before9 = await page.evaluate(() => JSON.stringify(data.groceries));
  const backupA = JSON.stringify({ meta: { version: 2, exportIdentity: { mode: 'account', accountId: A, householdId: H1 } }, groceries: [{ id: 'x', title: 'Uit back-up A', category: 'Overig', done: false }] });
  await page.evaluate(text => importBackup(new File([text], 'a.json', { type: 'application/json' })), backupA);
  await page.waitForTimeout(300);
  const r9 = await page.evaluate(() => ({ g: JSON.stringify(data.groceries), toast: document.querySelector('#toast')?.textContent || '' }));
  check('9. back-up van A in account B geweigerd; gegevens van B ongewijzigd', r9.g === before9 && /ander account/.test(r9.toast), r9.toast);

  // 11. Twee accounts in hetzelfde huishouden (A en C in H1) op dit apparaat.
  await switchTo(page, C, { enable: { uid: C, hid: H1 } });
  await sync(page);
  const cTitles = await titles(page);
  await page.evaluate(() => { data.groceries.push({ id: 'g-c', title: 'C-appel', category: 'Overig', done: false }); save({ sync: false }); });
  await sync(page);
  await switchTo(page, A); await sync(page);
  check('11. A en C in H1: eigen datasets, beide synchroniseren via H1', cTitles.includes('A-melk') && (await titles(page)).includes('C-appel') && (await identity(page)).accountId === A, JSON.stringify({ cTitles, a: await titles(page) }));

  // 12. fuelEntries: hetzelfde tankbedrag door A en C → financieel conflict, niet stil overschreven.
  await page.evaluate(() => { data.fuelEntries = [{ id: 'f1', total: 60, liters: 30, date: '2026-11-01' }]; save({ sync: false }); });
  await sync(page);
  const row = cloud[H1].get('fuelEntries');
  const remote = await page.evaluate(p => decryptData(p, 'test-huishouden-123'), row.payload); remote[0].total = 65;
  cloud[H1].set('fuelEntries', { payload: await page.evaluate(v => encryptData(v, 'test-huishouden-123'), remote), version: row.version + 1, by: C });
  await page.evaluate(() => { data.fuelEntries[0].total = 61; save({ sync: false }); });
  const putsFuel = ctl.puts.length;
  await sync(page);
  const fin = await page.evaluate(async () => (await SamenThuisFinanceSync.list()).map(r => [r.section, r.status]));
  const cloudTotal = (await page.evaluate(p => decryptData(p, 'test-huishouden-123'), cloud[H1].get('fuelEntries').payload))[0].total;
  check('12. fuelEntries: zelfde tankbedrag gelijktijdig → financieel conflict, cloud niet overschreven, niet geüpload', JSON.stringify(fin) === JSON.stringify([['fuelEntries', 'open']]) && cloudTotal === 65 && !ctl.puts.slice(putsFuel).some(p => p.section === 'fuelEntries'), JSON.stringify({ fin, cloudTotal }));

  // 13. SportCoach volledig onaangetast na alle wissels.
  const sportNow = await page.evaluate(() => ({ stored: JSON.parse(localStorage.getItem('samenThuisDataV2')).sportCoach, mem: data.sportCoach }));
  const v2Now = await page.evaluate(() => JSON.parse(localStorage.getItem('samenThuisDataV2')));
  const v2Was = JSON.parse(v2Before);
  check('13. SportCoach onaangetast (opslag en geheugen); overige inhoud oude dataset ongewijzigd', JSON.stringify(sportNow.stored) === JSON.stringify(sport) && sportNow.mem && sportNow.mem.library?.[0]?.title === 'Hardlopen'
    && JSON.stringify(v2Now.groceries) === JSON.stringify(v2Was.groceries), JSON.stringify(sportNow.stored));
  const v3Keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('samenThuisDataV3')).map(k => [k, localStorage.getItem(k).includes('Hardlopen')]));
  check('13b. SportCoach staat in geen enkele account- of lokale dataset', v3Keys.length >= 4 && v3Keys.every(([, has]) => !has), JSON.stringify(v3Keys));
  // 2b. Hetzelfde account verlaat H1 en komt in H2 (lidmaatschap verandert op de server).
  const aH1 = await page.evaluate(k => localStorage.getItem(k), `samenThuisDataV3|${A}|${H1}`);
  MEMBER[A] = H2;
  await page.evaluate(() => window.SamenThuisAccountSync.sync()); await page.waitForLoadState('load'); await page.waitForTimeout(1200);
  await sync(page);
  id = await identity(page);
  const t2b = await titles(page);
  check('2b. huishoudwissel van A (H1 → H2): nieuwe dataset met H2-gegevens; H1-dataset onaangetast; niets van H1 naar H2', id.accountId === A && id.householdId === H2 && t2b.includes('H2-brood') && !t2b.includes('A-melk')
    && (await page.evaluate(k => localStorage.getItem(k), `samenThuisDataV3|${A}|${H1}`)) === aH1 && !(await groceriesOf(page, H2)).includes('A-melk'), JSON.stringify({ id, t2b }));
  MEMBER[A] = H1;
  await ctx.close();

  // 10. Ander apparaat: onbekende legacygegevens (twee identiteiten) → quarantaine, behouden, niet gesynchroniseerd.
  const ctx2 = await device();
  let p2 = await openPage(ctx2);
  await p2.evaluate(({ A, B, H1, H2, a }) => {
    localStorage.clear();
    localStorage.setItem('samenThuisDataV2', JSON.stringify({ meta: { version: 2 }, groceries: [{ id: 'q', title: 'Q-legacy', category: 'Overig', done: false }], sportCoach: { library: [] } }));
    localStorage.setItem('samenThuisAccountSyncV1', JSON.stringify({ enabled: true, bases: { [`${A}:${H1}`]: {}, [`${B}:${H2}`]: {} } }));
    localStorage.setItem('samenThuisSyncV1', JSON.stringify({ householdCode: 'test-huishouden-123' }));
    localStorage.setItem('samenThuisPersonalAuthV1', JSON.stringify(a));
  }, { A, B, H1, H2, a: auth(A) });
  await p2.reload({ waitUntil: 'load' }); await p2.waitForTimeout(900);
  const putsQ = ctl.puts.length;
  await sync(p2);
  const q = await p2.evaluate(() => ({ id: SamenThuisIdentity.current(), t: data.groceries.map(g => g.title), retained: SamenThuisIdentity.retained().map(r => r.status), v2: JSON.parse(localStorage.getItem('samenThuisDataV2')).groceries[0].title }));
  await p2.evaluate(() => { location.hash = '#/settings/back-ups'; }); await p2.waitForTimeout(500);
  const card = await p2.$('[data-retained-data]');
  check('10. onbekende legacygegevens: quarantaine, behouden, niet geladen, niet gesynchroniseerd; zichtbaar met download', q.id.accountId === A && !q.t.includes('Q-legacy') && q.t.includes('A-melk') && q.retained.includes('quarantaine') && q.v2 === 'Q-legacy'
    && !(await groceriesOf(p2, H1)).includes('Q-legacy') && ctl.puts.slice(putsQ).every(p => p.section !== 'groceries' || p.user === A) && !!card, JSON.stringify({ ...q, card: !!card }));
  await ctx2.close();
} finally {
  await browser.close(); server.close();
}
check('geen JavaScript-fouten', !errors.length, errors.slice(0, 3).join(' | '));
console.log(results.join('\n'));
console.log(failed ? `\n${failed} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(failed ? 1 : 0);
