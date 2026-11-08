// Voeding in de bestaande app: opslag (samenThuisDataV2), back-up/herstel, accountsync, zoeken, XSS en PWA-registratie.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const DC = require('./data-core.js');
const HS = require('./household-sync-core.js');
const N = require('./nutrition-core.js');
const FF = require('./food-facts-core.js');
const X = require('./osta-exchange-core.js');

const read = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const sample = () => {
  const product = FF.manualProduct({ id: 'p1', name: 'Pasta', per100g: { energyKcal: 350 } });
  return { meta: { version: 2, updatedAt: '2026-11-08T10:00:00Z' }, meals: [{ id: 'm1', date: '2026-11-09', title: 'Pasta', type: 'Avondeten', recipeId: 'r1' }],
    nutrition: N.normalizeStore({ products: [product], recipes: [{ id: 'r1', title: 'Pasta', ingredients: [{ name: 'pasta', grams: 100, productId: 'p1' }] }] }) };
};

test('opslag: migrateData behoudt data.nutrition (onbekend veld) en meals ongewijzigd incl. recipeId', () => {
  const app = read('app.js');
  const body = app.slice(app.indexOf('function migrateData(raw)'), app.indexOf('const RECOVERY_KEYS'));
  assert.match(body, /preserveUnknownFields\(raw, migrated, clone\)/);
  assert.match(body, /\['planning', 'meals',/);
  const raw = sample(); const target = { meals: [] };
  DC.preserveUnknownFields(raw, target, v => JSON.parse(JSON.stringify(v)));
  assert.deepEqual(target.nutrition, raw.nutrition);
});

test('back-up en herstel: nutrition komt volledig terug; ongeldige back-up wijzigt niets', () => {
  const m = {}; const s = { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } };
  const o = { storageKey: 'd', legacyKey: 'l', backupKey: 'b', backupAtKey: 'ba', corruptKey: 'c', preRestoreKey: 'prr', holdKey: 'hold', migrate: d => d, fresh: () => ({}), now: () => 'nu' };
  const original = sample();
  const restored = DC.restoreBackupText(s, o, JSON.stringify(original));
  assert.deepEqual(restored.nutrition, JSON.parse(JSON.stringify(original.nutrition)));
  assert.equal(restored.meals[0].recipeId, 'r1');
  const before = m.d;
  assert.throws(() => DC.restoreBackupText(s, o, '{kapot'));
  assert.equal(m.d, before);
});

test('accountsync: nutrition is een eigen versleuteld onderdeel; conflicten worden niet stil overschreven', () => {
  const local = sample();
  assert.ok('nutrition' in HS.sectionsOf(local));
  assert.ok(!('meta' in HS.sectionsOf(local)));
  const push = HS.planSections({ local, remote: {} }).find(a => a.section === 'nutrition');
  assert.equal(push.action, 'push');
  const otherDevice = { ...local.nutrition, recipes: [...local.nutrition.recipes, N.normalizeRecipe({ title: 'Soep' })] };
  const base = { nutrition: { version: 1, hash: HS.hashValue({ ...local.nutrition, recipes: [] }) } };
  const plan = HS.planSections({ local, remote: { nutrition: { version: 2, value: otherDevice } }, base }).find(a => a.section === 'nutrition');
  assert.equal(plan.action, 'conflict', 'beide kanten gewijzigd → gebruiker kiest');
});

test('accountsync-ronde met nep-cloud: nutrition wordt versleuteld verstuurd met verwachte versie', async () => {
  const puts = [];
  const cloud = { readState: async () => [], putState: async (hid, section, payload, expected) => { puts.push({ section, payload, expected }); return 1; } };
  const r = await HS.runAccountSync({ cloud, householdId: 'h1', local: sample(), encrypt: async v => ({ enc: JSON.stringify(v).length }), decrypt: async v => v });
  assert.equal(r.status, 'ok');
  const n = puts.find(p => p.section === 'nutrition');
  assert.ok(n && n.payload.enc > 0 && n.expected === 0);
  assert.ok(!puts.some(p => p.section === 'meta' || p.section === 'settings'));
});

test('privacy: voedingsopslag bevat geen persoons-, lichaams- of gezondheidsvelden en export geen huishouddata', () => {
  const bundle = X.exportBundle(sample().nutrition);
  const text = JSON.stringify(bundle);
  for (const word of ['weight', 'gewicht_kg', 'bmi', 'astma', 'person', 'Kees', 'Daphne', 'householdCode', 'access_token']) assert.ok(!text.includes(word), word);
  assert.deepEqual(Object.keys(bundle).sort(), ['app', 'exportedAt', 'format', 'note', 'products', 'recipes', 'version']);
});

test('zoeken vindt recepten (ook op ingrediënt) en producten en leidt naar de juiste subpagina', () => {
  const S = require('./search-core.js');
  const groups = S.search(sample(), 'pasta');
  const rec = groups.find(g => g.key === 'voeding-recepten');
  assert.equal(rec.results[0].page, 'voeding'); assert.equal(rec.results[0].sub, 'recepten');
  assert.ok(groups.find(g => g.key === 'voeding-producten'));
  assert.ok(S.search({ nutrition: { recipes: [{ id: 'x', title: 'Curry', ingredients: [{ name: 'kokosmelk' }] }] } }, 'kokosmelk').length);
});

test('navigatie: Voeding als pagina onder Meer met vier subpagina\'s', () => {
  const NavCore = require('./nav-core.js');
  assert.equal(NavCore.sectionOf('voeding').key, 'meer');
  assert.deepEqual(NavCore.HUBS.voeding.subs.map(s => s.key), ['weekmenu', 'recepten', 'producten', 'uitwisselen']);
  assert.deepEqual(NavCore.parseRoute('#/voeding/producten'), { page: 'voeding', sub: 'producten' });
  assert.ok(NavCore.MORE_GROUPS.some(g => g.tiles.some(t => t[0] === 'voeding')));
});

function renderUi(state) {
  const listeners = {};
  const ctx = {
    window: {}, document: { addEventListener: (t, f) => { listeners[t] = f; }, querySelector: () => ({ innerHTML: '' }) },
    data: state, current: 'voeding', sections: {}, render: () => {}, save: () => true, toast: () => {}, confirm: () => true, addGroceries: () => ({ added: 0, updated: 0 }),
    esc: v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])),
    todayISO: () => '2026-11-08', startOfWeek: () => '2026-11-09', addDays: (d, n) => d, weekDates: s => [s, '2026-11-10'],
    fmtDate: d => d, URL, Blob: function () {}, Intl, setTimeout, console
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['food-facts-core.js', 'nutrition-core.js', 'osta-exchange-core.js', 'nutrition.js']) vm.runInContext(read(f), ctx, { filename: f });
  return { html: ctx.SamenThuisNutritionUi.render(), ctx, listeners };
}

test('UI: externe productgegevens en recepttitels worden altijd ge-escaped (XSS)', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const product = FF.normalizeProduct({ product: { code: '12345670', product_name: evil, brands: evil, ingredients_text: evil, allergens_tags: ['en:' + evil] } });
  const state = { meals: [{ id: 'm1', date: '2026-11-09', title: evil, type: evil }], nutrition: { products: [product], recipes: [{ id: 'r1', title: evil, ingredients: [evil], sourceUrl: 'https://x.example/"><script>alert(1)</script>' }] } };
  const { html, ctx } = renderUi(state);
  assert.ok(!html.includes('<img src=x'), 'geen ruwe HTML uit gegevens');
  assert.ok(!html.includes('<script>alert'), 'geen script uit bron-URL');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  ctx.SamenThuisNutritionUi.state.openRecipe = 'r1'; ctx.SamenThuisNutritionUi.state.openProduct = product.id;
  const open = ctx.SamenThuisNutritionUi.render();
  assert.ok(!open.includes('<img src=x') && !open.includes('<script>alert'));
});

test('UI: vier panelen, disclaimer, bronvermelding OFF; onbekend wordt nooit als 0 getoond', () => {
  const product = FF.normalizeProduct({ product: { code: '12345670', product_name: 'Thee', nutriments: { 'energy-kcal_100g': 1 } } });
  const { html, ctx } = renderUi({ meals: [], nutrition: { products: [product], recipes: [] } });
  for (const p of ['weekmenu', 'recepten', 'producten', 'uitwisselen']) assert.match(html, new RegExp(`data-nut="${p}"`));
  assert.match(html, /nut-disclaimer/); assert.match(html, /Geen medisch of dieetadvies/);
  assert.match(html, /Open Food Facts \(ODbL\)/);
  ctx.SamenThuisNutritionUi.state.openProduct = product.id;
  const open = ctx.SamenThuisNutritionUi.render();
  assert.match(open, /<th scope="row">Vet<\/th><td class="nut-unknown">onbekend<\/td>/);
});

test('UI: geen netwerkverkeer bij openen of renderen; alleen na expliciete actie', () => {
  let calls = 0;
  const state = { meals: [], nutrition: {} };
  const listeners = {};
  const ctx = { window: {}, document: { addEventListener: (t, f) => { listeners[t] = f; }, querySelector: () => ({ innerHTML: '' }) }, data: state, current: 'voeding', sections: {}, render: () => {}, save: () => true, toast: () => {}, esc: String, todayISO: () => '2026-11-08', startOfWeek: () => '2026-11-09', addDays: d => d, weekDates: s => [s], fmtDate: d => d, Intl, setTimeout, fetch: () => { calls++; return Promise.reject(new Error('x')); }, localStorage: { getItem: () => null, setItem: () => {} } };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['food-facts-core.js', 'nutrition-core.js', 'osta-exchange-core.js', 'nutrition.js']) vm.runInContext(read(f), ctx);
  ctx.SamenThuisNutritionUi.render(); ctx.render();
  assert.equal(calls, 0);
  assert.doesNotMatch(read('nutrition.js'), /addEventListener\('input'/, 'geen zoeken-tijdens-typen (OFF-voorwaarde)');
});

test('architectuur (ADR 0001): geen zelfstandig receptenbeheer in Samen Thuis — geen formulier om recepten te maken of de inhoud te bewerken', () => {
  const ui = read('nutrition.js');
  assert.doesNotMatch(ui, /data-nut-form="recipe"/, 'geen formulier "recept toevoegen"');
  assert.doesNotMatch(ui, /kind === 'recipe'/);
  assert.doesNotMatch(ui, /name="(title|steps|ingredients)"/, 'receptinhoud niet bewerkbaar');
  assert.match(ui, /name="servingsOverride"/, 'alleen planningsporties als annotatie');
  assert.match(ui, /Wijzig het recept in Osta en importeer opnieuw/);
  // Bewaren van koppelingen wijzigt nooit titel, ingrediënttekst of bereiding.
  const product = FF.manualProduct({ id: 'p1', name: 'Pasta', per100g: { energyKcal: 350 } });
  const state = { meals: [], nutrition: { products: [product], recipes: [{ id: 'r1', title: 'Pasta', servings: 4, source: 'osta', ingredients: [{ id: 'i1', text: '1 pak pasta', name: 'pak pasta' }], steps: ['Koken'] }] } };
  const { ctx, listeners } = renderUi(state);
  const form = { closest: () => form, dataset: { nutForm: 'ingredients', recipe: 'r1' } };
  const values = { servingsOverride: '2', g_i1: '500', p_i1: 'p1' };
  ctx.FormData = function () { return { get: k => (k in values ? values[k] : null) }; };
  listeners.submit({ target: form, preventDefault: () => {} });
  const r = ctx.data.nutrition.recipes[0];
  assert.equal(r.title, 'Pasta'); assert.equal(r.servings, 4); assert.equal(r.servingsOverride, 2);
  assert.equal(r.ingredients[0].text, '1 pak pasta'); assert.deepEqual(r.steps, ['Koken']);
  assert.equal(r.ingredients[0].grams, 500); assert.equal(r.ingredients[0].productId, 'p1');
  assert.equal(N.recipeNutrition(r, [product]).perServing.energyKcal, 875, 'berekend met planningsporties');
});
