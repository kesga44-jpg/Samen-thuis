// Opt-in database integration checks for the named local Supabase stack only.
const test = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const container = 'supabase_db_samen-thuis-staging';
const probe = cp.spawnSync('docker', ['inspect', '--format', '{{.State.Running}}', container], { encoding: 'utf8' });
const skip = probe.status === 0 && probe.stdout.trim() === 'true'
  ? false
  : /permission denied/i.test(probe.stderr || '')
    ? 'Huidige gebruiker heeft geen toegang tot Docker'
    : probe.error
      ? 'Docker CLI is niet beschikbaar'
      : 'Lokale Supabase-container is niet gestart; zie docs/LOCAL_STAGING.md';

test('lokale Supabase PostgreSQL 15: grants, RLS, RPCs en synthetische fixtures', { skip }, t => {
  const sqlPath = path.join(__dirname, 'supabase', 'test-support', 'local_security.sql');
  const result = cp.spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'],
    { encoding: 'utf8', input: fs.readFileSync(sqlPath, 'utf8') }
  );
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'));
  for (const warning of (result.stderr.match(/WARNING: .+/g) || [])) t.diagnostic(warning);
});

test('supabase_admin-defaults zijn expliciet geobserveerd, niet door app-migraties beheersbaar', { skip }, t => {
  const sql = `
    begin;
    create table public._local_admin_default_acl_probe (id integer);
    create function public._local_admin_default_acl_probe() returns integer
      language sql as $$ select 1 $$;
    select has_table_privilege('anon', 'public._local_admin_default_acl_probe', 'SELECT')
      || '|' || has_table_privilege('authenticated', 'public._local_admin_default_acl_probe', 'TRUNCATE')
      || '|' || has_function_privilege('anon', 'public._local_admin_default_acl_probe()', 'EXECUTE')
      || '|' || has_function_privilege('public', 'public._local_admin_default_acl_probe()', 'EXECUTE');
    rollback;
  `;
  const result = cp.spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt', '-f', '-'],
    { encoding: 'utf8', input: sql }
  );
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'));
  const grants = result.stdout.trim().split('\n').at(-1);
  assert.match(grants, /^(true|false)\|(true|false)\|(true|false)\|(true|false)$/);
  if (grants.includes('true')) {
    t.diagnostic(`supabase_admin-created object probe reports API/PUBLIC access: ${grants}`);
  }
});

test('Phase 3 v2 blokkeert onvolledige migratie en test gecontroleerd noodherstel', { skip }, () => {
  const phase3 = fs.readFileSync(path.join(__dirname, 'supabase', 'test-support', 'phase3_v2.sql'), 'utf8');
  const killSwitch = fs.readFileSync(path.join(__dirname, 'supabase', 'rollbacks', '20261114000000_legacy_sync_phase3_v2.rollback.sql'), 'utf8');
  const finish = `
    do $$
    begin
      if exists (select 1 from public.legacy_recovery_allow where closed_at is null) then
        raise exception 'Emergency rollback did not close every recovery window';
      end if;
      if has_table_privilege('anon', 'public.household_data', 'SELECT')
         or has_table_privilege('authenticated', 'public.household_data', 'SELECT')
         or has_table_privilege('service_role', 'public.household_data', 'SELECT') then
        raise exception 'Emergency rollback reopened legacy table access';
      end if;
    end
    $$;
    rollback;
  `;
  const result = cp.spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'],
    { encoding: 'utf8', input: `${phase3}\n${killSwitch}\n${finish}` }
  );
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'));
});

test('gelijktijdige legacy-claims zijn idempotent en account-writes delen de afsluitlock', { skip }, async () => {
  const userA = '00000000-0000-4000-8000-00000000001a';
  const userB = '00000000-0000-4000-8000-00000000001b';
  const household = '10000000-0000-4000-8000-00000000001a';
  const legacyId = 'e'.repeat(64);
  const runPsql = input => new Promise(resolve => {
    const child = cp.spawn('docker', [
      'exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres',
      '-v', 'ON_ERROR_STOP=1', '-qAt', '-f', '-'
    ]);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
    child.stdin.end(input);
  });
  const fixture = `
    begin;
    insert into auth.users (id, aud, role, email) values
      ('${userA}', 'authenticated', 'authenticated', 'phase3-race-a@example.invalid'),
      ('${userB}', 'authenticated', 'authenticated', 'phase3-race-b@example.invalid');
    insert into public.households (id, name, join_code, created_by)
    values ('${household}', 'PHASE3-RACE', 'PHASE3-RACE-CODE', '${userA}');
    insert into public.household_members (household_id, user_id, role) values
      ('${household}', '${userA}', 'owner'),
      ('${household}', '${userB}', 'member');
    insert into public.household_data (id, payload)
    values ('${legacyId}', '{"ciphertext":"PHASE3-CONCURRENT-IMPORT"}'::jsonb);
    commit;
  `;
  const cleanup = `
    begin;
    delete from public.household_legacy_imports where legacy_id = '${legacyId}';
    delete from public.household_data where id = '${legacyId}';
    alter table public.legacy_row_disposition disable trigger legacy_row_disposition_immutable;
    delete from public.legacy_row_disposition where legacy_id = '${legacyId}';
    alter table public.legacy_row_disposition enable trigger legacy_row_disposition_immutable;
    delete from public.households where id = '${household}';
    delete from auth.users where id in ('${userA}', '${userB}');
    commit;
  `;
  const setupResult = await runPsql(fixture);
  assert.equal(setupResult.status, 0, [setupResult.stdout, setupResult.stderr].filter(Boolean).join('\n'));
  try {
    const rowLock = runPsql(`
      begin;
      select id from public.household_data where id = '${legacyId}' for update;
      select pg_catalog.pg_sleep(1);
      commit;
    `);
    await new Promise(resolve => setTimeout(resolve, 100));
    const claim = (userId) => runPsql(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub', '${userId}', true);
      select public.import_legacy_household_data('${household}', '${legacyId}');
      commit;
    `);
    const [first, second] = await Promise.all([claim(userA), claim(userB)]);
    const lockResult = await rowLock;
    assert.equal(lockResult.status, 0, [lockResult.stdout, lockResult.stderr].filter(Boolean).join('\n'));
    for (const result of [first, second]) {
      assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'));
    }
    const outcomes = [first, second].flatMap(result => result.stdout.match(/^(?:f|t)$/gm) || []).sort();
    assert.deepEqual(outcomes, ['f', 't'],
      `Concurrent claim outputs: ${JSON.stringify([first.stdout, second.stdout])}`);

    const exclusiveLock = runPsql(`
      begin;
      select pg_catalog.pg_advisory_xact_lock(741140, 3);
      select pg_catalog.pg_sleep(1);
      commit;
    `);
    await new Promise(resolve => setTimeout(resolve, 100));
    const writeStarted = Date.now();
    const accountWrite = await runPsql(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub', '${userA}', true);
      select public.put_household_state('${household}', 'tasks', '{"ciphertext":"PHASE3-RACE-WRITE"}'::jsonb, 0);
      commit;
    `);
    const exclusiveResult = await exclusiveLock;
    assert.equal(exclusiveResult.status, 0, [exclusiveResult.stdout, exclusiveResult.stderr].filter(Boolean).join('\n'));
    assert.equal(accountWrite.status, 0, [accountWrite.stdout, accountWrite.stderr].filter(Boolean).join('\n'));
    assert.match(accountWrite.stdout, /^1$/m);
    assert.ok(Date.now() - writeStarted >= 600, 'Account write did not wait for the exclusive migration lock');
  } finally {
    const cleanupResult = await runPsql(cleanup);
    assert.equal(cleanupResult.status, 0, [cleanupResult.stdout, cleanupResult.stderr].filter(Boolean).join('\n'));
  }
});
