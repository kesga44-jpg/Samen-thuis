const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs');
const d = __dirname + '/supabase/';
const up = fs.readFileSync(d + 'migrations/20261014000000_household_state_sync.sql', 'utf8').replace(/--.*$/gm, '');
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
  for (const f of fs.readdirSync(d + 'migrations').filter(n => !n.includes('rollback'))) assert.doesNotMatch(fs.readFileSync(d + 'migrations/' + f, 'utf8').replace(/--.*$/gm, ''), /revoke[^;]*public\.household_data\b/i, f);
  assert.ok(fs.existsSync(d + 'migrations/20261014000000_household_state_sync.rollback.sql'));
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
