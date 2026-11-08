// Bewaakt de afspraken uit de ecosysteemarchitectuur (personal-ecosystem) voor externe integraties in Samen Thuis.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontend = fs.readdirSync(__dirname).filter(f => /\.(js|html)$/.test(f) && !/\.test\.js$/.test(f));
const src = Object.fromEntries(frontend.map(f => [f, fs.readFileSync(path.join(__dirname, f), 'utf8')]));
const all = Object.values(src).join('\n');

test('Open-Meteo: bronvermelding met link en CC BY 4.0 bij elke weergave (licentievoorwaarde)', () => {
  const n = (src['app.js'].match(/href="https:\/\/open-meteo\.com\/"[^>]*>Open-Meteo<\/a> \(CC BY 4\.0\)/g) || []).length;
  assert.ok(n >= 3, `dashboardweer, weerpagina en luchtkwaliteit (${n})`);
  assert.doesNotMatch(all, /open-meteo\.com[^'"`]*apikey/i, 'geen API-sleutel voor Open-Meteo');
});

test('geen secrets of service-role in frontend; alleen de publishable key', () => {
  assert.doesNotMatch(all, /service_role|sb_secret_|SUPABASE_SERVICE_ROLE/i);
  const keys = all.match(/sb_publishable_[A-Za-z0-9_-]+/g) || [];
  assert.ok(keys.every(k => k === 'sb_publishable_Xa1oLeM64F-jog1vVjJbkQ_BE3UV6mR'));
  assert.doesNotMatch(all, /NED_API_KEY\s*=|TANKERKOENIG_API_KEY\s*=|PRIJS_PROFEET_API_KEY\s*=/);
});

test('geen betaalde of externe AI-API\'s en geen automatische AI-aanroepen (ADR 0008)', () => {
  assert.doesNotMatch(all, /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.cohere/i);
  assert.doesNotMatch(all, /@mlc-ai\/web-llm|localhost:11434/i, 'WebLLM/Ollama nog niet goedgekeurd voor Samen Thuis');
  assert.match(src['nutrition-core.js'], /method: 'regelgebaseerd'/);
});

test('geen Web Push in Samen Thuis zolang I-4/I-9 niet zijn goedgekeurd (Hub-eigendom, ADR 0004/0018)', () => {
  assert.doesNotMatch(all, /pushManager\.subscribe|PushManager|applicationServerKey|showNotification\(/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8'), /addEventListener\('push'/);
});

test('geen nieuwe energie-/Socrata-koppelingen: alleen de bestaande RDW- en NED-aanroepen', () => {
  const rdw = (src['app.js'].match(/opendata\.rdw\.nl/g) || []).length;
  assert.equal(rdw, 1, 'bestaande RDW-kentekenopvraging ongewijzigd');
  assert.doesNotMatch(all, /evcc|api\.ned\.nl/i, 'NED alleen via de Edge Function, evcc niet in Samen Thuis');
});

test('Open Food Facts: alleen https, alleen lezen, geen schrijfacties of inlog', () => {
  const off = src['food-facts-core.js'];
  assert.match(off, /const BASE_URL = 'https:\/\/world\.openfoodfacts\.org'/);
  assert.doesNotMatch(off, /method:\s*'POST'|cgi\/product_jqm|user_id=|password=/);
  assert.match(off, /credentials: 'omit'/);
});

test('Osta: geen aangenomen Osta-API of -domein', () => {
  assert.doesNotMatch(all, /https?:\/\/[a-z0-9.-]*osta[a-z0-9.-]*\.(com|app|io|nl)/i);
});
