const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

test('Sport & Training blijft onderdeel van de bestaande versleutelde huishoudsync en JSON-back-up', () => {
  const sync = read('household-sync-core.js');
  const app = read('app.js');
  assert.match(sync, /const SKIP_KEYS = \['settings', 'meta'\]/);
  assert.match(sync, /function sectionsOf\(data\)/);
  assert.match(app, /preserveUnknownFields\(raw, migrated, clone\)/);
  assert.match(app, /if\(k==='sportCoach'/);
  for (const key of ['programs', 'sessions', 'library', 'plans', 'exercises']) {
    assert.match(app, new RegExp(`merged\\[key\\]=mergeArray246`));
    assert.match(app, new RegExp(`'${key}'`));
  }
  assert.match(app, /JSON\.stringify\(data, null, 2\)/);
  assert.match(app, /gezondheidsinformatie staat wel leesbaar in de JSON-back-up/);
});

test('Storage-migratie is privaat en beperkt iedere objectactie tot huishoudleden', () => {
  const migration = read('supabase/migrations/20261015000000_sport_training_storage.sql');
  const rollback = read('supabase/migrations/20261015000000_sport_training_storage.rollback.sql');
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
  for (const asset of ['sportcoach.css?v=2', 'sportcoach-core.js?v=2', 'sportcoach.js?v=3', 'account-sync.js?v=2']) {
    assert.ok(html.includes(asset), `${asset} ontbreekt in index`);
    assert.ok(sw.includes(asset), `${asset} ontbreekt in service worker`);
  }
  assert.match(accountSync, /uploadSportFile/);
  assert.match(accountSync, /signedSportFileUrl/);
  assert.match(accountSync, /storagePathForHousehold/);
  assert.match(accountSync, /accountMode\(\)/);
});
