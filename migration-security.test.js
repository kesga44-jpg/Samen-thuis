const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs');
const d = __dirname + '/supabase/';
const up = fs.readFileSync(d + 'migrations/20261014000000_household_state_sync.sql', 'utf8').replace(/--.*$/gm, '');
const profile = fs.readFileSync(d + 'migrations/20261103000000_personal_profiles.sql', 'utf8').replace(/--.*$/gm, '');
const hardening = fs.readFileSync(d + 'migrations/20261113000000_database_rate_limits_and_privileges.sql', 'utf8').replace(/--.*$/gm, '');
const rateRows = hardening.slice(hardening.indexOf('create table if not exists public.household_rpc_rate_limits'), hardening.indexOf('create index if not exists household_rpc_rate_limits_expiry_idx'));
test('household_state: RLS aan, geen anon, geen directe schrijfrechten', () => {
  assert.match(up, /enable row level security/);
  assert.match(up, /revoke all on public\.household_state from anon, authenticated/);
  assert.match(up, /grant select on public\.household_state to authenticated/);
  assert.doesNotMatch(up, /grant[^;]*(insert|update|delete)[^;]*household_state/i);
  assert.doesNotMatch(up, /to anon/);
});
test('migratie is niet destructief en raakt household_data/coach_data niet aan', () => {
  assert.doesNotMatch(up, /\b(truncate|delete from)\b/i);
  assert.doesNotMatch(up, /drop table/i);
  assert.doesNotMatch(up, /coach_data/);
  assert.doesNotMatch(up, /(insert into|update|alter table) public\.household_data/i);
});
test('schrijffunctie controleert lidmaatschap en versie', () => {
  assert.match(up, /is_household_member\(p_household\)/);
  assert.match(up, /40001/);
});
test('anon-revoke staat buiten migrations (handmatige fase 3)', () => {
  assert.ok(fs.existsSync(d + 'manual/phase3_revoke_anon_household_data.sql'));
  for (const f of fs.readdirSync(d + 'migrations').filter(n => !n.includes('rollback') && n !== '20261113000000_database_rate_limits_and_privileges.sql')) assert.doesNotMatch(fs.readFileSync(d + 'migrations/' + f, 'utf8').replace(/--.*$/gm, ''), /revoke[^;]*public\.household_data\b/i, f);
  assert.match(hardening, /grant select, insert, update on public\.household_data to anon/i);
  assert.match(fs.readFileSync(d + 'schema.sql', 'utf8'), /grant select, insert, update on public\.household_data to anon/i);
  assert.ok(fs.existsSync(d + 'rollbacks/20261014000000_household_state_sync.rollback.sql'));
});
test('fase 3 is bewaakt, trekt niets in binnen migrations en raakt coach_data niet aan', () => {
  const p3 = fs.readFileSync(d + 'manual/phase3_revoke_anon_household_data.sql', 'utf8');
  assert.match(p3, /Fase 3 geweigerd/); assert.match(p3, /to_regprocedure\('public\.put_household_state/); assert.doesNotMatch(p3.replace(/--.*$/gm, ''), /coach_data/);
  assert.match(p3.split('\n').find(l => /^\s*drop policy/.test(l)) || '', /household_data/);
  const code = p3.replace(/--.*$/gm, ''), end = code.lastIndexOf('end $$;');
  assert.ok(end > code.indexOf('Fase 3 geweigerd') && !/\b(drop|revoke|grant|create|alter)\b/i.test(code.slice(end + 7)), 'geen wijzigende statements buiten het DO-blok');
  assert.ok(code.indexOf('revoke') < end && code.indexOf('drop policy') < end);
});
test('import_legacy: lidmaatschapscontrole, id-formaat, claim-tabel en geen overschrijving in SQL', () => {
  const sql = up.slice(up.indexOf('function public.import_legacy_household_data'));
  assert.match(sql, /is_household_member\(p_household\)/); assert.match(sql, /\^\[0-9a-f\]\{64\}\$/);
  assert.match(sql, /household_legacy_imports/); assert.match(sql, /on conflict do nothing/); assert.doesNotMatch(sql, /update public\.household_data|delete from/i);
});
test('ledenlimiet gebruikt een advisory lock', () => assert.match(up, /pg_advisory_xact_lock/));
test('profiel-RPC deelt alleen begrensde profielvelden met een huisgenoot', () => {
  assert.match(profile, /add column if not exists profile_config jsonb/);
  assert.match(profile, /security definer[\s\S]*set search_path = public/i);
  assert.match(profile, /join public\.household_members mine on mine\.user_id = auth\.uid\(\)/i);
  assert.match(profile, /jsonb_build_object\([\s\S]*'firstName'[\s\S]*'lastName'[\s\S]*'nickname'[\s\S]*'personKey'[\s\S]*'avatarPath'/i);
  assert.doesNotMatch(profile.slice(profile.indexOf('create or replace function'), profile.indexOf('$$;')), /ui_config|dashboard_config/i);
  assert.match(profile, /revoke all on function public\.household_profile_list\(\) from public, anon/i);
});
test('profielfotoopslag is privé, beperkt tot JPG en schrijft alleen binnen eigen accountmap', () => {
  assert.match(profile, /values \('profile-photos', 'profile-photos', false, 5242880, array\['image\/jpeg'\]\)/i);
  assert.match(profile, /member\.user_id::text = \(storage\.foldername\(name\)\)\[1\]/i);
  assert.match(profile, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i);
  assert.match(profile, /name = auth\.uid\(\)::text \|\| '\/profile\.jpg'/i);
});

const fin = fs.readFileSync(d + 'migrations/20261104000000_finance_confirmations.sql', 'utf8').replace(/--.*$/gm, '');
test('financiële migratie: RLS, geen directe schrijfrechten, append-only en rollback aanwezig', () => {
  ['finance_income_months', 'finance_income_history', 'finance_distributions'].forEach(table => {
    assert.match(fin, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(fin, new RegExp(`revoke all on [^;]*public\\.${table}[^;]* from anon, authenticated`, 'i'));
  });
  assert.match(fin, /finance_block_update/);
  assert.match(fin, /add column if not exists finance_config jsonb/i);
  assert.doesNotMatch(fin, /drop table|delete from|truncate/i);
  assert.ok(fs.existsSync(d + 'rollbacks/20261104000000_finance_confirmations.rollback.sql'));
});

test('database-rate-limits zijn user/action-gebonden, transactioneel en compact', () => {
  assert.match(hardening, /primary key \(user_id, action\)/i);
  assert.match(hardening, /for update/i);
  assert.match(hardening, /where expires_at <= clock_timestamp\(\)/i);
  assert.match(hardening, /limit batch_size\s+for update skip locked/i);
  assert.match(hardening, /references auth\.users\(id\) on delete cascade/i);
  assert.match(hardening, /'join_household', 5, 1, 180/i);
  assert.match(hardening, /'create_household', 3, 1, 28800/i);
  assert.match(hardening, /'import_legacy_household_data', 5, 1, 180/i);
  assert.match(hardening, /'put_household_state', 60, 1, 1/i);
  assert.doesNotMatch(rateRows, /join_code|p_code|p_legacy_id|payload/i);
});
test('nieuwe database-defaults beperken API-rechten en SECURITY DEFINER search_path', () => {
  assert.match(hardening, /alter default privileges in schema public\s+revoke all on tables from public, anon, authenticated/i);
  assert.match(hardening, /alter default privileges in schema public\s+revoke all on sequences from public, anon, authenticated/i);
  assert.match(hardening, /alter default privileges\s+revoke execute on functions from public/i);
  assert.match(hardening, /revoke create on schema public from public, anon, authenticated/i);
  assert.match(hardening, /alter function public\.household_profile_list\(\) set search_path = ''/i);
  assert.match(hardening, /revoke all on function[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(hardening, /grant execute on function[\s\S]*to authenticated/i);
  assert.doesNotMatch(hardening, /grant\s+all\b/i);
});
test('geautoriseerde frontendcallers behandelen een ongeldige join als generieke fout', () => {
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  const accountSync = fs.readFileSync(__dirname + '/account-sync.js', 'utf8');
  assert.match(app, /if \(!joined\) throw new Error\('De code is ongeldig of aanmelden is nu niet mogelijk/);
  assert.match(accountSync, /else if \(!await c\.joinHousehold\(value\)\)/);
});

test('migratieversies zijn uniek en rollbacks staan buiten supabase/migrations (anders dubbele schema_migrations-versie)', () => {
  const files = fs.readdirSync(d + 'migrations');
  assert.ok(files.every(f => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)), files.join(', '));
  const versions = files.map(f => f.slice(0, 14));
  assert.equal(new Set(versions).size, versions.length);
  assert.ok(versions.includes('20261014000000'));
  assert.equal(files.filter(f => f.startsWith('20261014000000')).length, 1);
  assert.ok(fs.readdirSync(d + 'rollbacks').every(f => f.endsWith('.rollback.sql')));
});
