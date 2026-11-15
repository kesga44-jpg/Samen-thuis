const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

test('SportCoach is uitgesloten van huishoudsync en generieke JSON-back-ups/restores', () => {
  const sync = read('household-sync-core.js');
  const app = read('app.js');
  assert.match(sync, /const SKIP_KEYS = \['settings', 'meta', 'sportCoach'\]/);
  assert.match(sync, /const RESERVED = \[\.\.\.SKIP_KEYS, LEGACY_SECTION/);
  assert.match(sync, /if \(row\.section === 'sportCoach'\) continue/);
  assert.match(sync, /function sectionsOf\(data\)/);
  assert.match(app, /preserveUnknownFields\(raw, migrated, clone\)/);
  assert.match(app, /preserveUnknownFields\(raw\.meta, migrated\.meta, clone\)/);
  assert.match(app, /delete backupData\.sportCoach/);
  assert.match(app, /k==='sportCoach'\|\|v==null/);
  assert.match(app, /preserveLocal: \(\) => \(\{ sportCoach: clone\(data\?\.sportCoach\) \}\)/);
  assert.match(app, /Een afzonderlijke veilige SportCoach-export is nog niet beschikbaar/);
  const conflictCard = app.slice(app.indexOf('function renderSyncConflictCard'), app.indexOf('// Basis voor automatisch samenvoegen'));
  assert.doesNotMatch(conflictCard, /data-sync-conflict-choice=/);
  const conflictStart = app.indexOf("document.addEventListener('click', event => {", app.indexOf('async function uploadSyncData'));
  const conflictListener = app.slice(conflictStart, app.indexOf('/* v25', conflictStart));
  assert.match(conflictListener, /bewaarde conflict is niet gewijzigd of toegepast/);
  assert.doesNotMatch(conflictListener, /data = selection\.data|save\(\{ touch: false/);
});

test('Storage-migratie is privaat en beperkt iedere objectactie tot huishoudleden', () => {
  const migration = read('supabase/migrations/20261015000000_sport_training_storage.sql');
  const rollback = read('supabase/rollbacks/20261015000000_sport_training_storage.rollback.sql');
  assert.match(migration, /'sport-training',\s*'sport-training',\s*false/);
  assert.match(migration, /file_size_limit[\s\S]*10485760/);
  assert.match(migration, /array\['application\/pdf', 'image\/jpeg', 'image\/png', 'image\/webp'\]/);
  assert.equal((migration.match(/public\.household_members/g) || []).length, 5);
  assert.equal((migration.match(/for (select|insert|update|delete) to authenticated/gi) || []).length, 4);
  assert.doesNotMatch(migration, /to anon|public\s*=\s*true/i);
  assert.doesNotMatch(rollback, /drop bucket|delete from storage\.objects/i);
});

test('AI-functie controleert auth en input en meldt eerlijk dat geen provider is geconfigureerd', () => {
  const fn = read('supabase/functions/sport-training/index.ts');
  const ui = read('sportcoach.js');
  assert.match(fn, /auth\/v1\/user/);
  assert.match(fn, /function validRequest/);
  assert.match(fn, /AI_PROVIDER_NOT_CONFIGURED/);
  assert.match(fn, /Er is geen AI-schema gegenereerd/);
  assert.doesNotMatch(fn, /OPENAI_API_KEY|ANTHROPIC_API_KEY|fetch\(['"]https?:\/\//);
  assert.match(ui, /De lokale generator maakt een transparant trainingsvoorstel, maar is geen AI/);
  assert.match(ui, /gezondheids- en medicatiegegevens zijn uitgesloten/);
  assert.doesNotMatch(ui, /OPENAI_API_KEY|ANTHROPIC_API_KEY/);
});

test('sport-assets en de nieuwe account-syncbestandsinterface worden geladen en gecachet', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const accountSync = read('account-sync.js');
  for (const asset of ['sportcoach.css?v=2', 'sportcoach-core.js?v=2', 'data-core.js?v=250', 'household-sync-core.js?v=3', 'account-sync.js?v=5']) {
    assert.ok(html.includes(asset), `${asset} ontbreekt in index`);
    assert.ok(sw.includes(asset), `${asset} ontbreekt in service worker`);
  }
  assert.match(html, /sportcoach\.js\?v=\d+/);
  assert.match(sw, /sportcoach\.js\?v=\d+/);
  assert.match(accountSync, /uploadSportFile/);
  assert.match(accountSync, /signedSportFileUrl/);
  assert.match(accountSync, /storagePathForHousehold/);
  assert.match(accountSync, /accountMode\(\)/);
});
