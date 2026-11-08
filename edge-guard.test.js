// PR-8 / R7: Edge Functions alleen met gebruikers-JWT, beperkte CORS, groottelimiet en limiet per gebruiker.
// guard.ts gebruikt alleen Web-API's en wordt hier direct geïmporteerd (Node ≥ 22.18 strip types).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = () => import(path.join(__dirname, 'supabase/functions/_shared/guard.ts'));
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.c2lnbmF0dXJlLXZhbHVl';
const ORIGIN = 'https://kesga44-jpg.github.io';
const env = { url: 'https://example.supabase.co', apikey: 'sb_publishable_test', allowedOrigins: '' };
const authOk = async (url, init) => {
  assert.equal(url, 'https://example.supabase.co/auth/v1/user');
  assert.equal(init.headers.Authorization, 'Bearer ' + JWT);
  return { ok: true, json: async () => ({ id: 'user-1' }) };
};
const req = (opts = {}) => new Request('https://example.supabase.co/functions/v1/x', {
  method: opts.method || 'POST',
  headers: { 'content-type': 'application/json', ...(opts.origin === null ? {} : { origin: opts.origin || ORIGIN }), ...(opts.token === null ? {} : { authorization: 'Bearer ' + (opts.token || JWT) }) },
  body: (opts.method || 'POST') === 'POST' ? (opts.body ?? '{"search":"melk"}') : undefined
});

test('origins: standaard GitHub Pages; ALLOWED_ORIGINS overschrijft; ongeldige waarden genegeerd', async () => {
  const g = await load();
  assert.deepEqual(g.parseAllowedOrigins(''), [ORIGIN]);
  assert.deepEqual(g.parseAllowedOrigins('https://a.example, http://localhost:8080/ , javascript:alert(1), *'), ['https://a.example', 'http://localhost:8080']);
  assert.equal(g.corsHeaders('https://evil.example', [ORIGIN])['Access-Control-Allow-Origin'], undefined);
  assert.equal(g.corsHeaders(ORIGIN, [ORIGIN])['Access-Control-Allow-Origin'], ORIGIN);
});

test('alleen echte JWT\'s; publishable key en lege token zijn geen sessie', async () => {
  const g = await load();
  assert.equal(g.looksLikeJwt(JWT), true);
  assert.equal(g.looksLikeJwt('sb_publishable_Xa1oLeM64F-jog1vVjJbkQ_BE3UV6mR'), false);
  assert.equal(g.looksLikeJwt(''), false);
});

test('guard: geldige gebruiker en origin → door, met CORS voor die origin', async () => {
  const g = await load();
  const out = await g.guard(req(), { env, limiter: () => true, fetchImpl: authOk });
  assert.equal(out.userId, 'user-1');
  assert.deepEqual(out.body, { search: 'melk' });
  assert.equal(out.headers['Access-Control-Allow-Origin'], ORIGIN);
});

test('guard: weigert zonder token (401), met publishable key (401), met ongeldige sessie (401)', async () => {
  const g = await load();
  let out = await g.guard(req({ token: null }), { env, limiter: () => true, fetchImpl: authOk });
  assert.equal(out.response.status, 401);
  out = await g.guard(req({ token: 'sb_publishable_Xa1oLeM64F-jog1vVjJbkQ_BE3UV6mR' }), { env, limiter: () => true, fetchImpl: authOk });
  assert.equal(out.response.status, 401);
  out = await g.guard(req(), { env, limiter: () => true, fetchImpl: async () => ({ ok: false, status: 401 }) });
  assert.equal(out.response.status, 401);
  assert.match((await out.response.json()).error, /opnieuw in/);
});

test('guard: vreemde origin 403, preflight alleen voor toegestane origin, GET 405', async () => {
  const g = await load();
  let out = await g.guard(req({ origin: 'https://evil.example' }), { env, limiter: () => true, fetchImpl: authOk });
  assert.equal(out.response.status, 403);
  out = await g.guard(req({ method: 'OPTIONS' }), { env, limiter: () => true });
  assert.equal(out.response.status, 200);
  assert.equal(out.response.headers.get('access-control-allow-origin'), ORIGIN);
  out = await g.guard(req({ method: 'OPTIONS', origin: 'https://evil.example' }), { env, limiter: () => true });
  assert.equal(out.response.status, 403);
  out = await g.guard(req({ method: 'GET' }), { env, limiter: () => true });
  assert.equal(out.response.status, 405);
});

test('guard: te groot of geen object → 413; Auth onbereikbaar → 503; limiet → 429', async () => {
  const g = await load();
  let out = await g.guard(req({ body: JSON.stringify({ search: 'x'.repeat(9000) }) }), { env, limiter: () => true, fetchImpl: authOk });
  assert.equal(out.response.status, 413);
  out = await g.guard(req({ body: '[1,2]' }), { env, limiter: () => true, fetchImpl: authOk });
  assert.equal(out.response.status, 413);
  out = await g.guard(req(), { env, limiter: () => true, fetchImpl: async () => { throw new TypeError('net'); } });
  assert.equal(out.response.status, 503);
  out = await g.guard(req(), { env, limiter: () => false, fetchImpl: authOk });
  assert.equal(out.response.status, 429);
});

test('rate limiter: max per venster per gebruiker, los per gebruiker, herstelt na venster', async () => {
  const g = await load();
  const allow = g.createRateLimiter(2, 1000);
  assert.equal(allow('a', 0), true); assert.equal(allow('a', 10), true); assert.equal(allow('a', 20), false);
  assert.equal(allow('b', 20), true);
  assert.equal(allow('a', 1500), true);
});

test('cleanText verwijdert stuurtekens en kort in', async () => {
  const g = await load();
  assert.equal(g.cleanText('  melk\u0000\n ', 100), 'melk');
  assert.equal(g.cleanText('x'.repeat(200), 10).length, 10);
});

test('beide externe-API-functies gebruiken guard; geen open CORS; app stuurt sessietoken mee', () => {
  for (const f of ['data-sources', 'grocery-prices']) {
    const src = fs.readFileSync(path.join(__dirname, 'supabase/functions', f, 'index.ts'), 'utf8');
    assert.match(src, /from "\.\.\/_shared\/guard\.ts"/, f);
    assert.match(src, /await guard\(req/, f);
    assert.doesNotMatch(src, /Allow-Origin"\s*:\s*"\*"/, f);
  }
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  assert.doesNotMatch(app, /Authorization: 'Bearer ' \+ DEFAULT_PUBLISHABLE_KEY \}/);
  assert.match(app, /async function edgeFunctionHeaders\(\)/);
  for (const doc of ['OPEN_DATA_BRONNEN.md', 'INSTALLATIE_BETA.md']) assert.doesNotMatch(fs.readFileSync(path.join(__dirname, doc), 'utf8'), /^\s*npx supabase functions deploy \S+ --no-verify-jwt/m, doc);
});
