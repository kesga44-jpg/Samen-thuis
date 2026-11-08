// PWA/offline: de service worker cachet exact wat index.html laadt, met een nieuwe cacheversie.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const sw = fs.readFileSync(__dirname + '/sw.js', 'utf8');

function swContext() {
  const listeners = {};
  const ctx = { self: { addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting: () => {}, clients: { claim: () => {} } }, location: { origin: 'https://app.example' }, URL, Response, caches: null, fetch: null };
  vm.runInNewContext(sw + '\nthis.__ASSETS=ASSETS;this.__CACHE=CACHE;', ctx);
  return { ctx, listeners };
}

test('elke lokale stylesheet en elk script uit index.html staat in de precache (incl. versie)', () => {
  const { ctx } = swContext();
  const assets = new Set(ctx.__ASSETS);
  const refs = [...html.matchAll(/<link rel="stylesheet" href="(?!https?:)([^"]+)"/g), ...html.matchAll(/<script src="(?!https?:)([^"]+)"/g)].map(m => './' + m[1]);
  assert.ok(refs.length > 30);
  for (const ref of refs) assert.ok(assets.has(ref), 'ontbreekt in sw.js: ' + ref);
  for (const a of ['./', './index.html', './manifest.webmanifest', './icon.svg']) assert.ok(assets.has(a), a);
  assert.ok(assets.has('./rewards-core.js?v=1'), 'eerder ontbrekende rewards-core.js nu offline beschikbaar');
});

test('precache bevat alleen bestanden die bestaan; cacheversie is verhoogd', () => {
  const { ctx } = swContext();
  for (const a of ctx.__ASSETS) {
    if (a === './') continue;
    assert.ok(fs.existsSync(__dirname + '/' + a.replace(/^\.\//, '').replace(/\?.*$/, '')), 'bestaat niet: ' + a);
  }
  assert.notEqual(ctx.__CACHE, 'samen-thuis-v36-finance');
  assert.match(ctx.__CACHE, /^samen-thuis-v\d+-/);
});

test('offline: bij netwerkfout komt het antwoord uit de cache; navigatie valt terug op index.html', async () => {
  const { ctx, listeners } = swContext();
  const store = new Map([['https://app.example/app.js', 'cached-app'], ['./index.html', 'cached-index']]);
  ctx.caches = { open: async () => ({ put: async () => {} }), match: async req => store.get(typeof req === 'string' ? req : req.url) || undefined };
  ctx.fetch = async () => { throw new TypeError('offline'); };
  const respond = async (url, mode = 'no-cors') => {
    let p; listeners.fetch({ request: { method: 'GET', url, mode }, respondWith: x => { p = x; }, waitUntil: () => {} });
    return p;
  };
  assert.equal(await respond('https://app.example/app.js'), 'cached-app');
  assert.equal(await respond('https://app.example/onbekend', 'navigate'), 'cached-index');
  let called = false;
  listeners.fetch({ request: { method: 'POST', url: 'https://app.example/x' }, respondWith: () => { called = true; } });
  assert.equal(called, false, 'POST wordt nooit door de service worker afgehandeld');
});

test('activate verwijdert oude caches (geen verouderde bestanden na update)', async () => {
  const { ctx, listeners } = swContext();
  const deleted = [];
  ctx.caches = { keys: async () => ['samen-thuis-v36-finance', ctx.__CACHE], delete: async k => { deleted.push(k); return true; } };
  let p; listeners.activate({ waitUntil: x => { p = x; } }); await p;
  assert.deepEqual(deleted, ['samen-thuis-v36-finance']);
});
