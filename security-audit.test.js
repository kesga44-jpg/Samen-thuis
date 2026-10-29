// Auditproeven (alleen lezen): leggen de huidige beveiligingseigenschappen vast zonder werking te wijzigen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { planSync } = require('./data-core.js');

const appSrc = fs.readFileSync(__dirname + '/app.js', 'utf8');

function extract(name) {
  const start = appSrc.search(new RegExp(`(async )?function ${name}\\(`));
  assert.notEqual(start, -1, `${name} niet gevonden`);
  let depth = 0, i = appSrc.indexOf('{', start);
  for (let j = i; j < appSrc.length; j++) {
    if (appSrc[j] === '{') depth++;
    if (appSrc[j] === '}' && --depth === 0) return appSrc.slice(start, j + 1);
  }
  throw new Error('onvolledige functie');
}

function loadCrypto() {
  const ctx = vm.createContext({ crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, Uint8Array });
  vm.runInContext(['bytesToBase64', 'base64ToBytes', 'sha256', 'deriveKey', 'encryptData', 'decryptData'].map(extract).join('\n')
    + '\nthis.api = { sha256, encryptData, decryptData };', ctx);
  return ctx.api;
}

test('AUDIT household_data: schema.sql geeft anon onbeperkt lezen, invoegen en bijwerken (bevestigd in repo-SQL)', () => {
  const sql = fs.readFileSync(__dirname + '/supabase/schema.sql', 'utf8');
  for (const op of ['select', 'insert', 'update']) {
    assert.match(sql, new RegExp(`for ${op} to anon`), `anon-${op}-policy ontbreekt`);
  }
  assert.match(sql, /using \(true\)/);
  assert.doesNotMatch(sql, /for delete/, 'geen delete-policy: verwijderen via anon is niet toegestaan');
});

test('AUDIT clientcode bevat geen service-role key', () => {
  for (const f of ['app.js', 'sync.js', 'js/sync.js', 'index.html', 'sw.js']) {
    assert.doesNotMatch(fs.readFileSync(__dirname + '/' + f, 'utf8'), /service_role/i, f);
  }
});

test('AUDIT versleuteling: de huishoudcode bepaalt record-id én sleutel; wie de code kent leest alles', async () => {
  const api = loadCrypto();
  const code = 'een-geheime-code-123';
  const payload = await api.encryptData({ secret: 'boodschappen' }, code);
  assert.deepEqual(Object.keys(payload).sort(), ['ciphertext', 'iv', 'salt', 'version']);
  assert.equal((await api.decryptData(payload, code)).secret, 'boodschappen');
  await assert.rejects(api.decryptData(payload, 'een-andere-code-123'));
  // Het record-id is een snelle SHA-256 van dezelfde code: een aanvaller met de anon key kan hiermee offline raden.
  assert.match(await api.sha256(code), /^[0-9a-f]{64}$/);
  // Geen integriteit tegen vervanging: een andere payload onder hetzelfde id is door anon te schrijven (zie RLS-test).
  const other = await api.encryptData({ secret: 'x' }, code);
  assert.notEqual(other.ciphertext, payload.ciphertext, 'verse salt/iv per versleuteling');
});

test('B4 opgelost: importBackup herstelt via restoreBackupText met hold en zonder updatedAt-aanraking', () => {
  const body = extract('importBackup');
  assert.match(body, /restoreBackupText\(localStorage, \{ \.\.\.recoveryOptions\(\), holdKey: RESTORE_HOLD_KEY \}/);
  assert.match(body, /save\(\{ touch: false, sync: false \}\)/);
  assert.doesNotMatch(body, /save\(\)/);
  // Een geïmporteerde back-up met nieuwere updatedAt leidt met hold niet meer tot upload.
  const cloud = { a: 'cloud', meta: { updatedAt: '2026-10-01T00:00:00Z' } };
  const restored = { a: 'oud-bestand', meta: { updatedAt: '2026-10-19T00:00:00Z' } };
  assert.equal(planSync({ local: restored, remote: cloud, hold: true, lastSyncedAt: '2026-10-19T00:00:00Z' }), 'conflict');
});

test('AUDIT sessie en huishoudcode staan onversleuteld in localStorage (bevestigd in code)', () => {
  assert.match(appSrc, /householdCode: String\(stored\.householdCode/);
  assert.match(appSrc, /localStorage\.setItem\(SYNC_KEY, JSON\.stringify\(syncConfig\)\)/);
  assert.match(appSrc, /localStorage\.getItem\(AUTH_KEY25\)/);
});
