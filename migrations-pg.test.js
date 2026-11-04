// Draait de echte SQL-bestanden op een LOKALE tijdelijke PostgreSQL met nagebootste Supabase-rollen/auth.
// Bewijst SQL-logica (RLS, RPC's, limiet, versies) lokaal; bewijst NIET dat live Supabase hetzelfde doet.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const BIN = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin'].find(d => fs.existsSync(d + '/initdb'));
const skip = BIN ? false : 'PostgreSQL niet beschikbaar: SQL-semantiektests overgeslagen';
const root = __dirname + '/supabase/';
const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c', D = '00000000-0000-4000-8000-00000000000d';
let dir, port = 54000 + Math.floor(Math.random() * 900);
const run = (args, o = {}) => cp.spawnSync(BIN + '/' + args[0], args.slice(1), { encoding: 'utf8', ...o });
function psql(sql, user) {
  const pre = user !== undefined ? `set role authenticated; set request.jwt.claim.sub = '${user}';\n` : '';
  const r = run(['psql', '-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', pre + sql]);
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
const file = f => { const r = run(['psql', '-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app', '-v', 'ON_ERROR_STOP=1', '-q', '-f', f]); return { ok: r.status === 0, err: r.stderr }; };
const ok = (r, m) => assert.ok(r.ok, (m || '') + ' ' + r.err);
const bad = (r, re) => { assert.ok(!r.ok, 'had moeten falen'); if (re) assert.match(r.err, re); };

test.before(() => {
  if (skip) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stpg-'));
  let r = run(['initdb', '-D', dir + '/d', '-U', 'postgres', '--auth=trust']); assert.equal(r.status, 0, r.stderr);
  r = run(['pg_ctl', '-D', dir + '/d', '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-l', dir + '/log', '-w', 'start']); assert.equal(r.status, 0, r.stderr);
  r = run(['createdb', '-h', dir, '-p', String(port), '-U', 'postgres', 'app']); assert.equal(r.status, 0, r.stderr);
  ok(file(root + 'tests/stub_supabase.sql'));
  ok(file(__dirname + '/supabase/schema.sql'), 'household_data');
  for (const f of fs.readdirSync(root + 'migrations').filter(n => n.endsWith('.sql') && !n.includes('rollback')).sort()) ok(file(root + 'migrations/' + f), f);
  ok(psql(`insert into auth.users values ('${A}'),('${B}'),('${C}'),('${D}');`));
});
test.after(() => { if (!skip && dir) run(['pg_ctl', '-D', dir + '/d', '-m', 'immediate', 'stop']); });

let hhAB, hhC, code;
test('twee accounts in één huishouden; vreemd huishouden is onzichtbaar en onbeschrijfbaar', { skip }, () => {
  let r = psql(`select id||'|'||join_code from create_household('AB')`, A); ok(r); [hhAB, code] = r.out.split('|');
  ok(psql(`select 1 from join_household('${code}')`, B));
  r = psql(`select id from create_household('C')`, C); ok(r); hhC = r.out.split('\n')[0];
  assert.equal(psql(`select count(*) from household_members where household_id='${hhAB}'`, A).out, '2');
  assert.equal(psql(`select count(*) from household_members where household_id='${hhAB}'`, C).out, '0');
  ok(psql(`select put_household_state('${hhAB}','tasks','{"x":1}'::jsonb,0)`, A));
  assert.equal(psql(`select count(*) from household_state where household_id='${hhAB}'`, B).out, '1');
  assert.equal(psql(`select count(*) from household_state`, C).out, '0');
  bad(psql(`select put_household_state('${hhAB}','tasks','{}'::jsonb,1)`, C), /Geen toegang/);
  bad(psql(`select import_legacy_household_data('${hhAB}','${'a'.repeat(64)}')`, C), /Geen toegang/);
  bad(psql(`insert into household_state(household_id,section,payload) values ('${hhC}','x','{}')`, C), /permission denied/);
  bad(psql(`update household_state set payload='{}'`, A), /permission denied/);
  bad(psql(`delete from household_state`, A), /permission denied/);
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
test('ledenlimiet: derde account geweigerd; bestaand lid opnieuw joinen is no-op', { skip }, () => {
  bad(psql(`select 1 from join_household('${code}')`, D), /maximaal twee/);
  ok(psql(`select 1 from join_household('${code}')`, B));
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
test('legacy-import: kopieert, nooit dubbel, nooit overschrijven, één huishouden per oude rij', { skip }, () => {
  const lid = 'b'.repeat(64);
  ok(psql(`insert into household_data(id,payload) values ('${lid}','{"v":1}')`));
  bad(psql(`select import_legacy_household_data('${hhAB}','kort')`, A), /Ongeldig/);
  assert.equal(psql(`select import_legacy_household_data('${hhAB}','${'c'.repeat(64)}')`, A).out, 'f'); // bestaat niet
  assert.equal(psql(`select import_legacy_household_data('${hhAB}','${lid}')`, A).out, 't');
  ok(psql(`update household_data set payload='{"v":2}' where id='${lid}'`));
  assert.equal(psql(`select import_legacy_household_data('${hhAB}','${lid}')`, B).out, 'f'); // dubbel
  assert.equal(psql(`select payload->>'v' from household_state where section='legacy_full' and household_id='${hhAB}'`, A).out, '1');
  bad(psql(`select import_legacy_household_data('${hhC}','${lid}')`, C), /al aan een ander huishouden/);
  assert.equal(psql(`select payload->>'v' from household_data where id='${lid}'`).out, '2', 'oude rij onaangetast');
  assert.equal(psql(`select count(*) from household_data`, A).out, '0', 'ingelogde gebruiker ziet oude anon-rijen niet (RLS)');
});
test('fase-3-script weigert zonder bewezen migratie en past daarna toe zonder nieuwe sync te blokkeren', { skip }, () => {
  // Nog geen onderdeel naast legacy_full met 2 leden? hhAB heeft tasks+notes en 2 leden, dus eerst een lege situatie nabootsen:
  ok(psql(`create schema probe; create table probe.t(a int)`)); // probe-schema raakt niets aan
  const p3 = root + 'manual/phase3_revoke_anon_household_data.sql';
  ok(psql(`alter table household_state rename to household_state_x`));
  bad(file(p3), /Fase 3 geweigerd/);
  ok(psql(`alter table household_state_x rename to household_state`));
  ok(psql(`create temp table keep as select * from household_state; delete from household_state where household_id='${hhAB}' and section<>'legacy_full'`));
  bad(file(p3), /Fase 3 geweigerd/);
  ok(psql(`insert into household_state select * from (select household_id, section, payload, version, updated_by, updated_at from (values (null::uuid)) v(x) cross join lateral (select '${hhAB}'::uuid household_id,'tasks'::text section,'{"x":9}'::jsonb payload,1::bigint version,null::uuid updated_by,now() updated_at) q) z`));
  ok(file(p3));
  // na fase 3: nieuwe sync (authenticated) werkt nog, en import blijft werken via definer
  ok(psql(`select put_household_state('${hhAB}','tasks','{"x":10}'::jsonb,1)`, A));
  assert.equal(psql(`select import_legacy_household_data('${hhAB}','${'b'.repeat(64)}')`, A).out, 'f');
  const r = run(['psql', '-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app', '-At', '-c', `set role anon; select * from household_data`]);
  assert.notEqual(r.status, 0);
});
test('fase 3 regressie: bij falende controle blijven alle anon-policies en -rechten ongewijzigd, ook zonder ON_ERROR_STOP', { skip }, () => {
  const p3 = root + 'manual/phase3_revoke_anon_household_data.sql';
  const snap = () => psql(`select coalesce(string_agg(policyname||':'||cmd||':'||roles::text, ',' order by policyname),'') || '|' || (select coalesce(string_agg(privilege_type, ',' order by privilege_type),'') from information_schema.role_table_grants where grantee='anon' and table_name='household_data') from pg_policies where tablename='household_data'`).out;
  // Vorige test heeft fase 3 al toegepast: herstel eerst de oude anon-situatie (zoals de rollbackregels in het script).
  ok(psql(`grant select, insert, update on public.household_data to anon;
    create policy "encrypted household read" on public.household_data for select to anon using (true);
    create policy "encrypted household insert" on public.household_data for insert to anon with check (true);
    create policy "encrypted household update" on public.household_data for update to anon using (true) with check (true);`));
  const before = snap();
  assert.match(before, /encrypted household read/); assert.match(before, /\|.*INSERT.*SELECT.*UPDATE/);
  // Scenario 1: migratie-object ontbreekt. Scenario 2: te weinig leden. Beide via psql ZONDER ON_ERROR_STOP (loopt door na fouten)
  // en via één -c (zoals een editor die de hele tekst als één query verstuurt).
  const loose = () => run(['psql', '-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app', '-q', '-f', p3]);
  const oneShot = () => run(['psql', '-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'app', '-q', '-c', fs.readFileSync(p3, 'utf8')]);
  ok(psql(`alter table household_state rename to household_state_x`));
  for (const go of [loose, oneShot]) { const r = go(); assert.match(r.stderr, /Fase 3 geweigerd/); assert.equal(snap(), before, 'niets gewijzigd (ontbrekend object)'); }
  ok(psql(`alter table household_state_x rename to household_state`));
  ok(psql(`create table st_backup as select * from household_state; delete from household_state`));
  for (const go of [loose, oneShot]) { const r = go(); assert.match(r.stderr, /Fase 3 geweigerd/); assert.equal(snap(), before, 'niets gewijzigd (onvoldoende leden/onderdelen)'); }
  // Geldig scenario: alleen de bedoelde anon-rechten verdwijnen; overige policies/rechten blijven.
  ok(psql(`create policy "other anon keep" on household_data for select to anon using (false); insert into household_state select * from st_backup; drop table st_backup`));
  const r = oneShot(); assert.equal(r.status, 0, r.stderr);
  const after = psql(`select string_agg(policyname,',') from pg_policies where tablename='household_data'`).out;
  assert.equal(after, 'other anon keep', 'alleen de drie bedoelde policies zijn weg');
  assert.equal(psql(`select count(*) from information_schema.role_table_grants where grantee='anon' and table_name='household_data' and privilege_type in ('SELECT','INSERT','UPDATE')`).out, '0');
  ok(psql(`drop policy "other anon keep" on household_data`));
});
test('rollback-bestand verwijdert alleen de nieuwe objecten en laat household_data intact', { skip }, () => {
  ok(file(root + 'rollbacks/20261014000000_household_state_sync.rollback.sql'));
  assert.equal(psql(`select to_regclass('public.household_state') is null`).out, 't');
  assert.equal(psql(`select count(*) from household_data`).out, '1');
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
