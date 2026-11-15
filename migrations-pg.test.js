// Draait de echte SQL-bestanden op een LOKALE tijdelijke PostgreSQL met nagebootste Supabase-rollen/auth.
// Bewijst SQL-logica (RLS, RPC's, limiet, versies) lokaal; bewijst NIET dat live Supabase hetzelfde doet.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const candidates = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin'];
const BIN = process.env.PG_BIN ? path.resolve(process.env.PG_BIN) : candidates.find(d => fs.existsSync(d + '/initdb'));
const skip = !process.env.PG_BIN && !BIN ? 'PostgreSQL niet beschikbaar: SQL-semantiektests overgeslagen' : false;
const root = __dirname + '/supabase/';
const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c', D = '00000000-0000-4000-8000-00000000000d';
const E = '00000000-0000-4000-8000-00000000000e', F = '00000000-0000-4000-8000-00000000000f', G = '00000000-0000-4000-8000-000000000010', H = '00000000-0000-4000-8000-000000000011';
let dir, port = 54000 + Math.floor(Math.random() * 900);
const run = (args, o = {}) => cp.spawnSync(BIN + '/' + args[0], args.slice(1), { encoding: 'utf8', ...o });
function psql(sql, user) {
  const pre = user !== undefined ? `set role authenticated; set request.jwt.claim.sub = '${user}';\n` : '';
  const r = run(['psql', '-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', pre + sql]);
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
function psqlOwner(sql, user) {
  const pre = `set role migration_owner; set request.jwt.claim.sub = '${user}';\n`;
  const r = run(['psql', '-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', pre + sql]);
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
function psqlAsync(sql, user) {
  const pre = user !== undefined ? `set role authenticated; set request.jwt.claim.sub = '${user}';\n` : '';
  return new Promise(resolve => {
    const child = cp.spawn(BIN + '/psql', [
      '-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app',
      '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', pre + sql
    ]);
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('close', status => resolve({ ok: status === 0, out: out.trim(), err: err.trim() }));
  });
}
const file = f => {
  const asOwner = f.endsWith('/test-support/stub_supabase.sql') ? '' : 'set role migration_owner;\n';
  const sql = asOwner + fs.readFileSync(f, 'utf8');
  const r = run(['psql', '-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app', '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql]);
  return { ok: r.status === 0, err: r.stderr };
};
const ok = (r, m) => assert.ok(r.ok, (m || '') + ' ' + r.err);
const bad = (r, re) => { assert.ok(!r.ok, 'had moeten falen'); if (re) assert.match(r.err, re); };

test.before(() => {
  if (process.env.PG_BIN) assert.ok(fs.existsSync(path.join(BIN, 'initdb')), `PG_BIN bevat geen initdb: ${BIN}`);
  if (skip) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stpg-'));
  let r = run(['initdb', '-D', dir + '/d', '-U', 'postgres', '--auth=trust']); assert.equal(r.status, 0, r.stderr);
  r = run(['pg_ctl', '-D', dir + '/d', '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-l', dir + '/log', '-w', 'start']); assert.equal(r.status, 0, r.stderr);
  r = run(['createdb', '-h', dir, '-p', String(port), '-U', 'postgres', 'app']); assert.equal(r.status, 0, r.stderr);
  ok(file(root + 'test-support/stub_supabase.sql'));
  ok(file(__dirname + '/supabase/schema.sql'), 'household_data');
  ok(psql(`grant select, insert, update on public.household_data to anon`), 'legacy R1-rechten zijn expliciet');
  for (const f of fs.readdirSync(root + 'migrations').filter(n => n.endsWith('.sql') && !n.includes('rollback')).sort()) ok(file(root + 'migrations/' + f), f);
  ok(psql(`insert into auth.users values ('${A}'),('${B}'),('${C}'),('${D}'),('${E}'),('${F}'),('${G}'),('${H}');`));
});
test.after(() => { if (!skip && dir) run(['pg_ctl', '-D', dir + '/d', '-m', 'immediate', 'stop']); });

let hhAB, hhC, hhDamaged, code;
test('twee accounts in één huishouden; vreemd huishouden is onzichtbaar en onbeschrijfbaar', { skip }, () => {
  let r = psql(`select id||'|'||join_code from create_household('AB')`, A); ok(r); [hhAB, code] = r.out.split('|');
  assert.equal(psql(`select public.join_household('${code}') is not null`, B).out, 't');
  r = psql(`select id from create_household('C')`, C); ok(r); hhC = r.out.split('\n')[0];
  r = psql(`select id from create_household('Damaged')`, A); ok(r); hhDamaged = r.out.split('\n')[0];
  assert.equal(psql(`select count(*) from household_members where household_id='${hhAB}'`, A).out, '2');
  assert.equal(psql(`select count(*) from household_members where household_id='${hhAB}'`, C).out, '0');
  ok(psql(`select put_household_state('${hhAB}','tasks','{"x":1}'::jsonb,0)`, A));
  assert.equal(psql(`select count(*) from household_state where household_id='${hhAB}'`, B).out, '1');
  assert.equal(psql(`select count(*) from household_state`, C).out, '0');
  bad(psql(`select put_household_state('${hhAB}','tasks','{}'::jsonb,1)`, C), /Geen toegang/);
  bad(psql(`select import_legacy_household_data('${hhAB}','${'a'.repeat(64)}')`, C), /permission denied/);
  assert.equal(psql(`select has_function_privilege('authenticated','public.import_legacy_household_data(uuid,text)','EXECUTE')`).out, 'f');
  bad(psql(`insert into household_state(household_id,section,payload) values ('${hhC}','x','{}')`, C), /permission denied/);
  bad(psql(`update household_state set payload='{}'`, A), /permission denied/);
  bad(psql(`delete from household_state`, A), /permission denied/);
});
test('migratiestub laat alleen expliciete privileges toe en gebruikt een niet-superuser-eigenaar', { skip }, () => {
  assert.equal(psql(`select rolsuper from pg_roles where rolname='migration_owner'`).out, 'f');
  assert.equal(psql(`select rolbypassrls from pg_roles where rolname='migration_owner'`).out, 't');
  assert.equal(psql(`select rolbypassrls from pg_roles where rolname='service_role'`).out, 't');
  for (const privilege of ['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
    assert.equal(psql(`select has_table_privilege('authenticated','public.personal_preferences','${privilege}')`).out, 'f', privilege);
  }
  for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) {
    assert.equal(psql(`select has_table_privilege('authenticated','public.personal_preferences','${privilege}')`).out, 't', privilege);
  }
  assert.equal(psql(`select has_table_privilege('anon','public.household_data','SELECT')`).out, 't');
  assert.equal(psql(`select has_table_privilege('anon','public.household_data','TRUNCATE')`).out, 'f');
  assert.equal(psql(`select count(*) from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a where d.defaclrole='migration_owner'::regrole and d.defaclnamespace='public'::regnamespace and a.grantee in ('anon'::regrole,'authenticated'::regrole,0)`).out, '0');
  assert.equal(psql(`select relrowsecurity and not relforcerowsecurity from pg_class where oid='public.personal_preferences'::regclass`).out, 't');
  for (const table of ['households', 'household_members', 'chalkboard_messages', 'household_state', 'household_legacy_imports', 'personal_preferences', 'finance_income_months', 'finance_income_history', 'finance_distributions', 'household_rpc_rate_limit_config', 'household_rpc_rate_limits']) {
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        assert.equal(psql(`select has_table_privilege('${role}','public.${table}','${privilege}')`).out, 'f', `${role} ${privilege} ${table}`);
      }
    }
  }
  assert.equal(psql(`select has_table_privilege('anon','public.household_data','DELETE')`).out, 'f');
  assert.equal(psql(`select has_table_privilege('authenticated','public.personal_preferences','DELETE')`).out, 'f');
  assert.equal(psql(`select has_column_privilege('authenticated','public.household_state','payload','UPDATE')`).out, 'f');
  assert.equal(psql(`select has_column_privilege('anon','public.household_data','payload','SELECT')`).out, 't');
  assert.equal(psql(`select has_sequence_privilege('anon', c.oid, 'USAGE') from pg_class c where c.relkind='S' and c.relnamespace='public'::regnamespace limit 1`).out, 'f');
  assert.equal(psql(`select has_function_privilege('authenticated','public.consume_household_rpc_rate_limit(text)','EXECUTE')`).out, 'f');
  assert.equal(psql(`select has_function_privilege('authenticated','public.cleanup_household_rpc_rate_limits(integer)','EXECUTE')`).out, 'f');
  assert.equal(psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not coalesce(p.proconfig, '{}') @> array['search_path=""']`).out, '0');
  assert.equal(psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where n.nspname='public' and a.grantee=0 and a.privilege_type='EXECUTE'`).out, '0');
  assert.equal(psql(`select pg_has_role('authenticated','service_role','USAGE')`).out, 'f');
});
test('default privileges gelden ook voor nieuwe tabellen en functies', { skip }, () => {
  ok(psql(`
    set role migration_owner;
    create table public._migration_default_table_probe (id integer);
    create function public._migration_default_function_probe() returns integer language sql as $$ select 1 $$;
    reset role;
  `));
  assert.equal(psql(`select has_table_privilege('anon','public._migration_default_table_probe','SELECT')`).out, 'f');
  assert.equal(psql(`select has_table_privilege('authenticated','public._migration_default_table_probe','TRUNCATE')`).out, 'f');
  assert.equal(psql(`select has_function_privilege('anon','public._migration_default_function_probe()','EXECUTE')`).out, 'f');
  assert.equal(psql(`select has_function_privilege('authenticated','public._migration_default_function_probe()','EXECUTE')`).out, 'f');
  assert.equal(psql(`select count(*) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid='public._migration_default_function_probe()'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'`).out, '0');
  ok(psql(`drop function public._migration_default_function_probe(); drop table public._migration_default_table_probe;`));
});
test('niet-aangemeld (zonder uid) krijgt geen toegang', { skip }, () => {
  bad(psql(`select put_household_state('${hhAB}','tasks','{}'::jsonb,1)`, ''), /Geen toegang/);
  const r = run(['psql', '-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app', '-At', '-c', `set role anon; select * from household_state`]);
  assert.notEqual(r.status, 0); assert.match(r.stderr, /permission denied/);
});
test('versiecontrole: verouderde versie wordt geweigerd, ander onderdeel blijft ongemoeid', { skip }, () => {
  ok(psql(`select put_household_state('${hhAB}','notes','{"n":1}'::jsonb,0)`, A));
  assert.equal(psql(`select put_household_state('${hhAB}','tasks','{"x":2}'::jsonb,1)`, A).out, '2');
  bad(psql(`select put_household_state('${hhAB}','tasks','{"x":3}'::jsonb,1)`, B), /Versieconflict/);
  bad(psql(`select put_household_state('${hhAB}','newsec','{}'::jsonb,5)`, B), /Versieconflict/);
  assert.equal(psql(`select payload->>'x' from household_state where section='tasks' and household_id='${hhAB}'`, B).out, '2');
  assert.equal(psql(`select version from household_state where section='notes' and household_id='${hhAB}'`, B).out, '1');
});
test('gereserveerde/ongeldige onderdeelnamen en te grote payloads worden geweigerd', { skip }, () => {
  for (const s of ['settings', 'meta', 'legacy_full', '__proto__', 'a b', '']) bad(psql(`select put_household_state('${hhAB}','${s}','{}'::jsonb,0)`, A), /Ongeldig onderdeel/);
  bad(psql(`select put_household_state('${hhAB}','big',jsonb_build_object('a',repeat('x',8100000)),0)`, A), /Ongeldige gegevens/);
});
test('PR E weigert nieuwe SportCoach-writes en laat bestaande rows ongemoeid', { skip }, () => {
  const legacySport = `insert into household_state(household_id,section,payload) values ('${hhAB}','sportCoach','{"old":true}')`;
  ok(psql(`set session_replication_role = replica; ${legacySport}; set session_replication_role = origin;`));
  assert.equal(psql(`select payload->>'old' from household_state where household_id='${hhAB}' and section='sportCoach'`, B).out, 'true');
  bad(psql(`select put_household_state('${hhAB}','sportCoach','{"new":true}'::jsonb,1)`, A), /SportCoach is local-only/);
  bad(psqlOwner(`update public.household_state set payload='{"changed":true}' where household_id='${hhAB}' and section='sportCoach'`, A), /SportCoach is local-only/);
  assert.equal(psql(`select payload->>'old' from household_state where household_id='${hhAB}' and section='sportCoach'`, B).out, 'true');
  assert.equal(psql(`select count(*) from household_state where household_id='${hhAB}' and section='sportCoach'`, A).out, '1');
});
test('ledenlimiet: derde account geweigerd; bestaand lid opnieuw joinen is no-op', { skip }, () => {
  assert.equal(psql(`select public.join_household('${code}') is not null`, D).out, 'f');
  assert.equal(psql(`select public.join_household('${code}') is not null`, B).out, 't');
  assert.equal(psql(`select count(*) from household_members where household_id='${hhAB}'`, A).out, '2');
});
test('ledenlimiet bij gelijktijdige uitnodigingen (echte parallelle sessies)', { skip }, () => {
  ok(psql(`select id||'|'||join_code from create_household('Race')`, C));
  const r0 = psql(`select id||'|'||join_code from household_members m join households h on h.id=m.household_id where h.name='Race' limit 1`, C);
  const [rid, rcode] = r0.out.split('|');
  const extra = [A, B, D];
  const procs = extra.map(u => cp.spawn(BIN + '/psql', ['-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app', '-At', '-c', `set role authenticated; set request.jwt.claim.sub = '${u}'; select pg_sleep(0.2); select 1 from join_household('${rcode}')`]));
  return Promise.all(procs.map(p => new Promise(res => p.on('close', c => res(c))))).then(() => {
    assert.equal(psql(`select count(*) from household_members where household_id='${rid}'`, C).out, '2', 'nooit meer dan 2 leden');
  });
});
test('create- en join-limieten zijn per gebruiker; ongeldige join-pogingen delen dezelfde bucket', { skip }, () => {
  const created = [];
  for (let i = 1; i <= 3; i++) {
    const r = psql(`select id||'|'||join_code from create_household('Limit-E-${i}')`, E);
    ok(r);
    created.push(r.out.split('|'));
  }
  bad(psql(`select create_household('Limit-E-blocked')`, E), /Te veel aanvragen/);
  const other = psql(`select id||'|'||join_code from create_household('Limit-F')`, F);
  ok(other, 'een andere gebruiker wordt niet beperkt');

  for (let i = 0; i < 5; i++) {
    assert.equal(psql(`select public.join_household('NOT-A-CODE') is not null`, E).out, 'f');
  }
  assert.equal(psql(`select public.join_household('${other.out.split('|')[1]}') is not null`, E).out, 'f');
  assert.equal(psql(`select count(*) from household_members where household_id='${other.out.split('|')[0]}'`).out, '1');
  assert.equal(psql(`select public.join_household('${other.out.split('|')[1]}') is not null`, G).out, 't');
  assert.equal(psql(`select count(*) from household_members where household_id='${other.out.split('|')[0]}'`).out, '2');

  assert.equal(psql(`select count(*) from household_rpc_rate_limits where user_id='${E}' and action='join_household'`).out, '1');
  assert.equal(psql(`select count(*) from household_rpc_rate_limits where user_id='${E}' and action='create_household'`).out, '1');
});
test('gelijktijdige join-RPC-aanroepen uit meerdere sessies delen atomair dezelfde user-bucket', { skip }, async () => {
  const owner = psql(`select id||'|'||join_code from create_household('Concurrent-join')`, F);
  ok(owner);
  const joinCode = owner.out.split('|')[1];
  const attempts = await Promise.all(Array.from({ length: 10 }, () =>
    psqlAsync(`select public.join_household('${joinCode}') is not null`, H)));
  assert.equal(attempts.filter(r => r.ok && r.out === 't').length, 5, JSON.stringify(attempts));
  assert.equal(attempts.filter(r => r.ok && r.out === 'f').length, 5, JSON.stringify(attempts));
  assert.equal(attempts.filter(r => !r.ok).length, 0, JSON.stringify(attempts));
  assert.equal(psql(`select count(*) from household_members where household_id='${owner.out.split('|')[0]}'`).out, '2');
  assert.equal(psql(`select count(*) from household_rpc_rate_limits where user_id='${H}' and action='join_household'`).out, '1');
});
test('legacy-import telt onbekende ids, blokkeert claims na de limiet en houdt registratie compact', { skip }, () => {
  const legacyId = '7'.repeat(64);
  const hid = createdForUser(E, 'Limit-E-1');
  for (let i = 0; i < 5; i++) {
    assert.equal(psqlOwner(`select import_legacy_household_data('${hid}','${'8'.repeat(64)}')`, E).out, 'f');
  }
  ok(psql(`insert into household_data(id,payload) values ('${legacyId}','{"synthetic":true}')`));
  bad(psqlOwner(`select import_legacy_household_data('${hid}','${legacyId}')`, E), /Te veel aanvragen/);
  assert.equal(psql(`select count(*) from household_legacy_imports where legacy_id='${legacyId}'`).out, '0');
  assert.equal(psql(`select count(*) from household_rpc_rate_limits where user_id='${E}' and action='import_legacy_household_data'`).out, '1');
});
test('rate-limitregistraties verlopen veilig en worden in begrensde batches opgeschoond', { skip }, () => {
  ok(psql(`update household_rpc_rate_limits set expires_at=now()-interval '1 second' where user_id='${H}' and action='join_household'`));
  assert.equal(psql(`select cleanup_household_rpc_rate_limits(1)`).out, '1');
  assert.equal(psql(`select count(*) from household_rpc_rate_limits where user_id='${H}' and action='join_household'`).out, '0');
  assert.equal(psql(`select count(*) from household_rpc_rate_limits where user_id='${G}' and action='join_household'`).out, '1');
});
test('put_household_state laat normale sync en herstel toe maar begrenst excessieve succesvolle writes', { skip }, () => {
  const hid = createdForUser(F, 'Limit-F');
  ok(psql(`update household_rpc_rate_limit_config set refill_seconds=1000000 where action='put_household_state'`));
  ok(psql(`select put_household_state('${hid}','sync-baseline','{"v":1}'::jsonb,0)`, F));
  bad(psql(`select put_household_state('${hid}','sync-baseline','{"v":2}'::jsonb,0)`, F), /Versieconflict/);
  for (let i = 0; i < 59; i++) {
    ok(psql(`select put_household_state('${hid}','sync-${i}','{"v":1}'::jsonb,0)`, F));
  }
  bad(psql(`select put_household_state('${hid}','sync-blocked','{"v":1}'::jsonb,0)`, F), /Te veel aanvragen/);
  assert.equal(psql(`select count(*) from household_state where household_id='${hid}' and section like 'sync-%'`, F).out, '60');
  assert.equal(psql(`select version from household_state where household_id='${hid}' and section='sync-baseline'`, F).out, '1');
  ok(psql(`update household_rpc_rate_limit_config set refill_seconds=1 where action='put_household_state'`));
});
function createdForUser(user, name) {
  const result = psql(`select id from households where name='${name}' order by created_at limit 1`, user);
  ok(result, 'verwacht huishouden ontbreekt');
  return result.out;
}
test('gelijktijdige state-writes met dezelfde versie accepteren precies één schrijver', { skip }, async () => {
  ok(psql(`select put_household_state('${hhAB}','race','{"writer":"initial"}'::jsonb,0)`, A));
  const writes = await Promise.all([
    psqlAsync(`select put_household_state('${hhAB}','race','{"writer":"A"}'::jsonb,1)`, A),
    psqlAsync(`select put_household_state('${hhAB}','race','{"writer":"B"}'::jsonb,1)`, B)
  ]);
  assert.equal(writes.filter(r => r.ok).length, 1, JSON.stringify(writes));
  assert.equal(writes.filter(r => !r.ok && /Versieconflict/.test(r.err)).length, 1, JSON.stringify(writes));
  assert.equal(psql(`select version from household_state where household_id='${hhAB}' and section='race'`, A).out, '2');
});
test('legacy-import: kopieert, nooit dubbel, nooit overschrijven, één huishouden per oude rij', { skip }, () => {
  const lid = 'b'.repeat(64);
  const foreign = 'd'.repeat(64), damaged = 'e'.repeat(64);
  ok(psql(`insert into household_data(id,payload) values
    ('${lid}','{"v":1}'),
    ('${'c'.repeat(64)}','{"excluded":true}'),
    ('${foreign}','{"v":"foreign"}'),
    ('${damaged}','{"ciphertext":"%%%broken","iv":"not-base64"}')`));
  // Orphaned and explicitly excluded rows stay untouched and unclaimed.
  const orphan = 'f'.repeat(64);
  ok(psql(`insert into household_data(id,payload) values ('${orphan}','{"orphan":true}')`));
  assert.equal(psqlOwner(`select import_legacy_household_data('${hhAB}','kort')`, A).out, 'f');
  assert.equal(psqlOwner(`select import_legacy_household_data('${hhAB}','${'0'.repeat(64)}')`, A).out, 'f'); // onbekend
  assert.equal(psqlOwner(`select import_legacy_household_data('${hhAB}','${lid}')`, A).out, 't');
  ok(psql(`update household_data set payload='{"v":2}' where id='${lid}'`));
  assert.equal(psqlOwner(`select import_legacy_household_data('${hhAB}','${lid}')`, B).out, 'f'); // dubbel
  assert.equal(psql(`select payload->>'v' from household_state where section='legacy_full' and household_id='${hhAB}'`, A).out, '1');
  assert.equal(psqlOwner(`select import_legacy_household_data('${hhC}','${foreign}')`, C).out, 't');
  assert.equal(psqlOwner(`select import_legacy_household_data('${hhAB}','${foreign}')`, A).out, 'f');
  assert.equal(psql(`select payload->>'v' from household_data where id='${lid}'`).out, '2', 'oude rij onaangetast');
  bad(psql(`select count(*) from household_data`, A), /permission denied/);
  assert.equal(psqlOwner(`select import_legacy_household_data('${hhDamaged}','${damaged}')`, A).out, 't');
  assert.equal(psql(`select payload->>'ciphertext' from household_state where section='legacy_full' and household_id='${hhDamaged}'`, A).out, '%%%broken');
  assert.equal(psql(`select count(*) from household_legacy_imports where legacy_id in ('${orphan}','${'c'.repeat(64)}')`).out, '0');
});
test('import faalt expliciet wanneer de seed-table ontbreekt', { skip }, () => {
  const missing = psql(`select id from create_household('MissingSeed')`, D);
  ok(missing);
  const sql = `
    begin;
    alter table public.household_data rename to household_data_temporarily_unavailable;
    do $$
    begin
      begin
        perform public.import_legacy_household_data('${missing.out}', '${'0'.repeat(64)}');
        raise exception 'import had moeten falen';
      exception when undefined_table then null;
      end;
    end $$;
    rollback;
  `;
  ok(psqlOwner(sql, D), 'import zonder seeded legacy table hoort 42P01 te geven');
});
test('rollback-bestand verwijdert alleen de nieuwe objecten en laat household_data intact', { skip }, () => {
  const legacyRows = psql(`select count(*) from household_data`).out;
  ok(file(root + 'rollbacks/20261014000000_household_state_sync.rollback.sql'));
  assert.equal(psql(`select to_regclass('public.household_state') is null`).out, 't');
  assert.equal(psql(`select count(*) from household_data`).out, legacyRows);
  assert.equal(psql(`select to_regclass('public.household_members') is not null`).out, 't');
  ok(file(root + 'migrations/20261014000000_household_state_sync.sql'), 'opnieuw toepassen na rollback');
});

// ---- Financieel systeem (20261104) ----
const snap = (contribs, lines, remainder) => JSON.stringify({
  contributions: contribs, totalContributionCents: Object.values(contribs).reduce((a, b) => a + b, 0),
  lines, remainder: { id: 'leuke-dingen', cents: remainder }
}).replace(/'/g, "''");
test('financiën: inkomen alleen eigen rij; wijziging laat bevestiging vervallen; ander kan niet bevestigen', { skip }, () => {
  ok(file(root + 'migrations/20261104000000_finance_confirmations.sql'), 'migratie');
  ok(file(root + 'migrations/20261104000000_finance_confirmations.sql'), 'herhaalbaar');
  assert.equal(psql(`select count(*) from household_members where household_id='${hhAB}'`, A).out, '2');
  ok(psql(`select finance_set_income('${hhAB}','2026-11',300000)`, A));
  ok(psql(`select finance_set_income('${hhAB}','2026-11',200000)`, B));
  // B ziet het inkomen van A (transparante verdeling), C (ander huishouden) niet
  assert.equal(psql(`select count(*) from finance_income_months where household_id='${hhAB}'`, B).out, '2');
  assert.equal(psql(`select count(*) from finance_income_months`, C).out, '0');
  bad(psql(`select finance_set_income('${hhAB}','2026-11',5)`, C), /Geen toegang/);
  bad(psql(`insert into finance_income_months(household_id,month,user_id,net_cents,entered_by) values ('${hhAB}','2026-12','${A}',1,'${B}')`, B), /permission denied/);
  bad(psql(`update finance_income_months set net_cents=1`, B), /permission denied/);
  // bevestigen gebeurt altijd voor de eigen rij: B kan het bedrag van A niet bevestigen
  bad(psql(`select finance_confirm_income('${hhAB}','2026-11',300000)`, B), /Versieconflict/);
  assert.equal(psql(`select count(*) from finance_income_months where confirmed_at is not null`, A).out, '0');
  ok(psql(`select finance_confirm_income('${hhAB}','2026-11',300000)`, A));
  assert.equal(psql(`select confirmed_by='${A}' from finance_income_months where user_id='${A}'`, A).out, 't');
  ok(psql(`select finance_set_income('${hhAB}','2026-11',310000)`, A));
  assert.equal(psql(`select confirmed_at is null from finance_income_months where user_id='${A}'`, A).out, 't');
  bad(psql(`select finance_confirm_income('${hhAB}','2026-11',300000)`, A), /Versieconflict/);
  ok(psql(`select finance_confirm_income('${hhAB}','2026-11',310000)`, A));
  assert.equal(psql(`select count(*) from finance_income_history where user_id='${A}'`, A).out, '4');
  bad(psql(`update finance_income_history set net_cents=1`, A), /permission denied/);
});
test('financiën: verdeling pas na beide bevestigingen, exact één keer, tekort geblokkeerd, correcties als nieuwe revisie', { skip }, () => {
  const confirm = (user, expected, hash, s, reason = '') =>
    psql(`select finance_confirm_distribution('${hhAB}','2026-11',${expected},7500,'${hash}','${s}'::jsonb,'${reason}')`, user);
  // totaal = 75% van 310000 + 75% van 200000 = 232500 + 150000 = 382500
  const good = snap({ [A]: 232500, [B]: 150000 }, [{ id: 'pot:a', cents: 100000 }], 282500);
  bad(confirm(A, 0, 'h1', good), /Beide inkomens/);
  ok(psql(`select finance_confirm_income('${hhAB}','2026-11',200000)`, B));
  bad(confirm(C, 0, 'h1', good), /Geen toegang/);
  bad(confirm(A, 0, 'h1', snap({ [A]: 300000, [B]: 150000 }, [], 450000)), /percentage/);
  const short = snap({ [A]: 232500, [B]: 150000 }, [{ id: 'x', cents: 400000 }], 0);
  bad(confirm(A, 0, 'h1', short), /sluiten niet/);
  bad(confirm(A, 0, 'h1', snap({ [A]: 232500, [B]: 150000 }, [{ id: 'x', cents: -5 }], 0)), /Ongeldige verdeling/);
  assert.equal(psql(`select count(*) from finance_distributions`, A).out, '0');
  assert.deepEqual(JSON.parse(confirm(A, 0, 'h1', good).out), { revision: 1, duplicate: false });
  // dubbelklik / tweede apparaat / opnieuw laden: zelfde invoer, geen tweede verwerking
  assert.deepEqual(JSON.parse(confirm(A, 0, 'h1', good).out), { revision: 1, duplicate: true });
  assert.deepEqual(JSON.parse(confirm(B, 0, 'h1', good).out), { revision: 1, duplicate: true });
  assert.equal(psql(`select count(*) from finance_distributions`, B).out, '1');
  assert.equal(psql(`select confirmed_by='${A}' and kind='original' from finance_distributions`, B).out, 't');
  // wijziging achteraf = nieuwe revisie met reden, verwachte revisie moet kloppen
  const fix = snap({ [A]: 232500, [B]: 150000 }, [{ id: 'pot:a', cents: 150000 }], 232500);
  bad(confirm(B, 1, 'h2', fix), /reden/);
  bad(confirm(B, 0, 'h2', fix, 'x'), /Versieconflict/);
  assert.deepEqual(JSON.parse(confirm(B, 1, 'h2', fix, 'Potje verhoogd').out), { revision: 2, duplicate: false });
  assert.equal(psql(`select count(*) from finance_distributions`, A).out, '2');
  assert.equal(psql(`select snapshot->'lines'->0->>'cents' from finance_distributions where revision=1`, A).out, '100000');
  bad(psql(`update finance_distributions set share_bp=1`, A), /permission denied/);
  bad(psql(`delete from finance_distributions`, A), /permission denied/);
  bad(psql(`update finance_distributions set share_bp=1`), /onveranderlijk/);
  assert.equal(psql(`select count(*) from finance_distributions`, C).out, '0');
});
test('financiën: privé-gegevens in personal_preferences blijven eigen rij; rollback laat gebruikersgegevens staan', { skip }, () => {
  ok(psql(`insert into personal_preferences(user_id, finance_config) values ('${A}', '{"pots":[{"name":"privé"}]}')`, A));
  assert.equal(psql(`select count(*) from personal_preferences where finance_config <> '{}'`, B).out, '0');
  assert.equal(psql(`select finance_config->'pots'->0->>'name' from personal_preferences`, A).out, 'privé');
  ok(file(root + 'rollbacks/20261104000000_finance_confirmations.rollback.sql'), 'rollback');
  assert.equal(psql(`select to_regclass('public.finance_distributions') is null`).out, 't');
  assert.equal(psql(`select count(*) from personal_preferences where finance_config <> '{}'`).out, '1');
  ok(file(root + 'migrations/20261104000000_finance_confirmations.sql'), 'opnieuw toepassen');
});
