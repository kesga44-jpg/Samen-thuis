\set ON_ERROR_STOP on
\set QUIET 1

begin;

do $$
declare pg_major integer := current_setting('server_version_num')::integer / 10000;
begin
  if pg_major <> 15 then
    raise exception 'Local Supabase integration tests require PostgreSQL 15, found %', pg_major;
  end if;
  if to_regclass('public.household_data') is null
     or to_regclass('public.household_state') is null
     or to_regclass('public.household_legacy_imports') is null then
    raise exception 'Expected migrations and the seeded legacy table after db reset';
  end if;
  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'household_data'
        and policyname in ('encrypted household read', 'encrypted household insert', 'encrypted household update')) <> 3 then
    raise exception 'The legacy seed did not install its three local policies';
  end if;
end
$$;

-- PostgreSQL/Supabase platform defaults, distinct from grants in the app migrations.
do $$
declare
  default_table_grants integer;
  default_function_grants integer;
begin
  if not has_schema_privilege('anon', 'public', 'USAGE')
     or has_schema_privilege('anon', 'public', 'CREATE')
     or not has_schema_privilege('authenticated', 'public', 'USAGE')
     or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception 'Unexpected Supabase public-schema privileges';
  end if;

  select count(distinct (acl.grantee, acl.privilege_type))
  into default_table_grants
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) acl
  where d.defaclrole = 'postgres'::regrole
    and d.defaclnamespace = 'public'::regnamespace
    and d.defaclobjtype = 'r'
    and acl.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
    and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
  if default_table_grants <> 21 then
    raise exception 'Expected seven default table privileges for each API role, found %', default_table_grants;
  end if;

  select count(distinct (acl.grantee, acl.privilege_type))
  into default_function_grants
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) acl
  where d.defaclrole = 'postgres'::regrole
    and d.defaclnamespace = 'public'::regnamespace
    and d.defaclobjtype = 'f'
    and acl.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
    and acl.privilege_type = 'EXECUTE';
  if default_function_grants <> 3 then
    raise exception 'Expected default function EXECUTE for each API role, found %', default_function_grants;
  end if;

  if not (select rolbypassrls and not rolsuper from pg_roles where rolname = 'postgres')
     or not (select rolbypassrls and not rolsuper from pg_roles where rolname = 'service_role')
     or (select rolbypassrls or rolsuper from pg_roles where rolname = 'authenticated')
     or (select rolbypassrls or rolsuper from pg_roles where rolname = 'anon') then
    raise exception 'Unexpected Supabase role BYPASSRLS/superuser attributes';
  end if;
  if not (select rolsuper and rolbypassrls from pg_roles where rolname = 'supabase_admin')
     or not exists (
       select 1 from pg_database
       where datname = current_database() and datdba = 'postgres'::regrole
     ) then
    raise exception 'Unexpected local database-owner/admin roles';
  end if;
end
$$;

-- Probe the Supabase defaults on newly-created objects, then roll them back with this test.
create table public._local_default_acl_probe (id integer);
create function public._local_default_acl_probe() returns integer
language sql as $$ select 1 $$;
do $$
begin
  if not has_table_privilege('anon', 'public._local_default_acl_probe', 'TRUNCATE')
     or not has_table_privilege('authenticated', 'public._local_default_acl_probe', 'DELETE')
     or not has_table_privilege('service_role', 'public._local_default_acl_probe', 'TRUNCATE')
     or not has_function_privilege('anon', 'public._local_default_acl_probe()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public._local_default_acl_probe()', 'EXECUTE') then
    raise exception 'A new public object did not receive the configured Supabase default privileges';
  end if;
end
$$;

-- Migration-specific grants must narrow these defaults on account data.
do $$
declare
  r text;
  expected_tables text[] := array[
    'households', 'household_members', 'household_state',
    'household_legacy_imports', 'personal_preferences',
    'finance_income_months', 'finance_income_history', 'finance_distributions'
  ];
begin
  foreach r in array expected_tables loop
    if has_table_privilege('anon', format('public.%I', r), 'SELECT')
       or has_table_privilege('anon', format('public.%I', r), 'INSERT')
       or has_table_privilege('anon', format('public.%I', r), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', r), 'DELETE') then
      raise exception 'anon has direct table access to public.%', r;
    end if;
  end loop;

  if not has_table_privilege('authenticated', 'public.household_state', 'SELECT')
     or has_table_privilege('authenticated', 'public.household_state', 'INSERT')
     or has_table_privilege('authenticated', 'public.household_state', 'UPDATE')
     or has_table_privilege('authenticated', 'public.household_state', 'DELETE')
     or has_table_privilege('authenticated', 'public.household_state', 'TRUNCATE') then
    raise exception 'household_state has broader effective privileges than its migration grants';
  end if;

  if not has_table_privilege('authenticated', 'public.personal_preferences', 'SELECT')
     or not has_table_privilege('authenticated', 'public.personal_preferences', 'INSERT')
     or not has_table_privilege('authenticated', 'public.personal_preferences', 'UPDATE') then
    raise exception 'personal_preferences is missing the migration grants';
  end if;
  if has_column_privilege('anon', 'public.personal_preferences', 'profile_config', 'SELECT')
     or has_column_privilege('anon', 'public.household_state', 'payload', 'SELECT')
     or has_column_privilege('authenticated', 'public.household_state', 'payload', 'UPDATE') then
    raise exception 'Unexpected column-level privilege on account data';
  end if;

  if not has_table_privilege('anon', 'public.household_data', 'SELECT')
     or not has_table_privilege('anon', 'public.household_data', 'INSERT')
     or not has_table_privilege('anon', 'public.household_data', 'UPDATE') then
    raise exception 'The explicitly seeded legacy anon route is not available locally';
  end if;
  if has_table_privilege('anon', 'public.household_data', 'DELETE')
     or has_table_privilege('anon', 'public.household_data', 'TRUNCATE')
     or has_table_privilege('anon', 'public.household_data', 'REFERENCES')
     or has_table_privilege('anon', 'public.household_data', 'TRIGGER') then
    raise warning 'Known default-ACL overgrant: anon has privileges beyond legacy SELECT/INSERT/UPDATE on household_data';
  end if;
  if has_table_privilege('authenticated', 'public.personal_preferences', 'DELETE')
     or has_table_privilege('authenticated', 'public.personal_preferences', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.personal_preferences', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.personal_preferences', 'TRIGGER') then
    raise warning 'Known default-ACL overgrant: authenticated has privileges beyond SELECT/INSERT/UPDATE on personal_preferences';
  end if;
  if has_function_privilege('anon', 'public.limit_household_members()', 'EXECUTE') then
    raise warning 'Known default-ACL overgrant: anon has EXECUTE on a trigger-only function';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid = 'public.household_data'::regclass
      and exists (select 1 from aclexplode(c.relacl) a where a.grantee = 0 and a.privilege_type = 'SELECT') is false
  ) then
    raise exception 'PUBLIC must not receive a direct grant on household_data';
  end if;
end
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.create_household(text)',
    'public.join_household(text)',
    'public.put_household_state(uuid,text,jsonb,bigint)',
    'public.import_legacy_household_data(uuid,text)',
    'public.household_profile_list()',
    'public.finance_set_income(uuid,text,bigint)',
    'public.finance_confirm_income(uuid,text,bigint)',
    'public.finance_confirm_distribution(uuid,text,integer,integer,text,jsonb,text)'
  ] loop
    if has_function_privilege('anon', fn, 'EXECUTE') then
      raise exception 'anon can execute %', fn;
    end if;
    if exists (
      select 1 from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = fn::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception 'PUBLIC can execute %', fn;
    end if;
    if not exists (
      select 1 from pg_proc p
      join pg_roles owner_role on owner_role.oid = p.proowner
      where p.oid = fn::regprocedure
        and p.prosecdef
        and owner_role.rolname = 'postgres'
        and owner_role.rolbypassrls
        and p.proconfig @> array['search_path=public']
    ) then
      raise exception '% must be SECURITY DEFINER, owned by the migration role, with a fixed search_path', fn;
    end if;
  end loop;
end
$$;

do $$
declare bad_rls integer;
begin
  select count(*) into bad_rls
  from pg_class c
  where c.oid in (
    'public.household_data'::regclass,
    'public.households'::regclass,
    'public.household_members'::regclass,
    'public.chalkboard_messages'::regclass,
    'public.household_state'::regclass,
    'public.household_legacy_imports'::regclass,
    'public.personal_preferences'::regclass,
    'public.finance_income_months'::regclass,
    'public.finance_income_history'::regclass,
    'public.finance_distributions'::regclass
  )
    and (not c.relrowsecurity or c.relforcerowsecurity);
  if bad_rls <> 0 then
    raise exception 'Expected RLS enabled and FORCE RLS disabled on all 10 application tables; invalid count %', bad_rls;
  end if;
end
$$;

-- Legacy R1 is intentionally different from account data: anon can use this seeded route.
set local role anon;
insert into public.household_data (id, payload)
values (repeat('9', 64), '{"ciphertext":"SYNTHETIC-ANON-LEGACY"}'::jsonb);
update public.household_data
set payload = '{"ciphertext":"SYNTHETIC-ANON-LEGACY-UPDATED"}'::jsonb
where id = repeat('9', 64);
do $$
begin
  if (select payload ->> 'ciphertext' from public.household_data where id = repeat('9', 64))
       <> 'SYNTHETIC-ANON-LEGACY-UPDATED' then
    raise exception 'The seeded legacy anon policy did not allow its intended synthetic read/write path';
  end if;
end
$$;
reset role;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'synthetic-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'synthetic-b@example.invalid'),
  ('00000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'synthetic-c@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
select id as synthetic_ab_id from public.create_household('SYNTHETIC-AB') \gset
select set_config('test.synthetic_ab_id', :'synthetic_ab_id', true);
select public.put_household_state(
  (select id from public.households where name = 'SYNTHETIC-AB'),
  'tasks',
  '{"ciphertext":"SYNTHETIC-A-PAYLOAD","iv":"SYNTHETIC-IV"}'::jsonb,
  0
);
select public.put_household_state(
  (select id from public.households where name = 'SYNTHETIC-AB'),
  'chores',
  '{"ciphertext":"SYNTHETIC-A-SECOND-SECTION"}'::jsonb,
  0
);
do $$
begin
  if (select count(*) from public.household_members m
      join public.households h on h.id = m.household_id
      where h.name = 'SYNTHETIC-AB') <> 1 then
    raise exception 'Account A did not create its household';
  end if;
  if (select count(*) from public.household_state s
      join public.households h on h.id = s.household_id
      where h.name = 'SYNTHETIC-AB' and s.section = 'tasks') <> 1 then
    raise exception 'Account A cannot use its own household state';
  end if;
end
$$;
select join_code as synthetic_join_code
from public.households
where name = 'SYNTHETIC-AB'
\gset
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);
select public.join_household(:'synthetic_join_code');
do $$
begin
  if (select count(*) from public.household_members m
      join public.households h on h.id = m.household_id
      where h.name = 'SYNTHETIC-AB') <> 2 then
    raise exception 'Account B did not join as the second member';
  end if;
  if (select count(*) from public.household_state s
      join public.households h on h.id = s.household_id
      where h.name = 'SYNTHETIC-AB' and s.section = 'tasks') <> 1 then
    raise exception 'Account B cannot read the shared household state';
  end if;
end
$$;
select public.put_household_state(
  (select id from public.households where name = 'SYNTHETIC-AB'),
  'notes',
  '{"ciphertext":"SYNTHETIC-B-PAYLOAD"}'::jsonb,
  0
);
select public.put_household_state(
  (select id from public.households where name = 'SYNTHETIC-AB'),
  'tasks',
  '{"ciphertext":"SYNTHETIC-B-UPDATED-PAYLOAD"}'::jsonb,
  1
);
do $$
begin
  if (select count(distinct s.updated_by) from public.household_state s
      join public.households h on h.id = s.household_id
      where h.name = 'SYNTHETIC-AB' and s.section in ('chores', 'notes')) <> 2 then
    raise exception 'Both household members must be represented as state writers';
  end if;
  begin
    perform public.put_household_state(
      (select id from public.households where name = 'SYNTHETIC-AB'),
      'tasks', '{"ciphertext":"STALE"}'::jsonb, 1
    );
    raise exception 'Stale household state write was unexpectedly accepted';
  exception
    when serialization_failure then null;
  end;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', true);
select id from public.create_household('SYNTHETIC-C');
do $$
declare hid uuid;
begin
  select id into hid from public.households where name = 'SYNTHETIC-AB';
  if hid is not null then
    raise exception 'Account C can read account A/B household metadata';
  end if;
  if (select count(*) from public.household_state) <> 0 then
    raise exception 'Account C can read account A/B household state';
  end if;
  begin
    perform public.put_household_state(
      current_setting('test.synthetic_ab_id')::uuid,
      'tasks', '{"ciphertext":"UNAUTHORIZED"}'::jsonb, 1
    );
    raise exception 'Account C unexpectedly wrote account A/B state';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.household_state set payload = '{"ciphertext":"UNAUTHORIZED"}'::jsonb;
    raise exception 'Account C unexpectedly wrote household_state directly';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

set local role anon;
do $$
begin
  if has_table_privilege('anon', 'public.personal_preferences', 'SELECT')
     or has_table_privilege('anon', 'public.households', 'SELECT')
     or has_table_privilege('anon', 'public.household_state', 'SELECT')
     or has_table_privilege('anon', 'public.finance_income_months', 'SELECT') then
    raise exception 'anon has account-data table privileges';
  end if;
  if has_function_privilege('anon', 'public.create_household(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.put_household_state(uuid,text,jsonb,bigint)', 'EXECUTE') then
    raise exception 'anon can execute an account RPC';
  end if;
  begin
    perform * from public.household_state;
    raise exception 'anon unexpectedly read household_state';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.household_state (household_id, section, payload)
    values ('00000000-0000-4000-8000-00000000000a', 'unauthorized', '{}'::jsonb);
    raise exception 'anon unexpectedly wrote household_state';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Synthetic legacy rows: valid, orphaned, explicitly excluded, cross-household,
-- damaged opaque ciphertext, and a row imported before its source changes.
insert into public.household_data (id, payload) values
  (repeat('a', 64), '{"ciphertext":"SYNTHETIC-VALID-CIPHERTEXT","iv":"SYNTHETIC-IV"}'::jsonb),
  (repeat('b', 64), '{"ciphertext":"SYNTHETIC-ORPHAN"}'::jsonb),
  (repeat('c', 64), '{"ciphertext":"SYNTHETIC-EXCLUDED"}'::jsonb),
  (repeat('d', 64), '{"ciphertext":"SYNTHETIC-FOREIGN"}'::jsonb),
  (repeat('e', 64), '{"ciphertext":"%%%DAMAGED","iv":"not-base64","tag":null}'::jsonb),
  (repeat('f', 64), '{"ciphertext":"SYNTHETIC-IMPORTED-ORIGINAL"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
select id from public.create_household('SYNTHETIC-DAMAGED');
select id from public.create_household('SYNTHETIC-IMPORTED');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', true);
select public.import_legacy_household_data(
  (select id from public.households where name = 'SYNTHETIC-C'), repeat('d', 64)
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
do $$
declare hid uuid;
    damaged_hid uuid;
begin
  select id into hid from public.households where name = 'SYNTHETIC-AB';
  if public.import_legacy_household_data(hid, repeat('a', 64)) is not true then
    raise exception 'Valid synthetic legacy import failed';
  end if;
  if public.import_legacy_household_data(hid, repeat('a', 64)) is not false then
    raise exception 'Duplicate legacy import was not rejected';
  end if;
  if public.import_legacy_household_data(hid, repeat('0', 64)) is not false then
    raise exception 'Unknown legacy row did not return false';
  end if;
  select id into damaged_hid from public.households where name = 'SYNTHETIC-DAMAGED';
  if public.import_legacy_household_data(damaged_hid, repeat('e', 64)) is not true then
    raise exception 'Opaque damaged-payload fixture was not imported';
  end if;
  if (select payload from public.household_state
      where household_id = hid and section = 'legacy_full')
       <> '{"ciphertext":"SYNTHETIC-VALID-CIPHERTEXT","iv":"SYNTHETIC-IV"}'::jsonb then
    raise exception 'Valid import did not preserve the source payload';
  end if;
  if (select payload from public.household_state
      where household_id = hid and section = 'legacy_full') ->> 'ciphertext'
       <> 'SYNTHETIC-VALID-CIPHERTEXT' then
    raise exception 'Import overwrote the already-imported payload';
  end if;
  if (select payload from public.household_state
      where household_id = hid and section = 'legacy_full') is null then
    raise exception 'Imported legacy payload is missing';
  end if;
  if (select count(*) from public.household_state
      where household_id = damaged_hid and section = 'legacy_full'
        and payload = '{"ciphertext":"%%%DAMAGED","iv":"not-base64","tag":null}'::jsonb) <> 1 then
    raise exception 'Damaged encrypted payload was modified during opaque import';
  end if;
  begin
    perform public.import_legacy_household_data(hid, repeat('d', 64));
    raise exception 'Cross-household legacy row was unexpectedly claimed';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

do $$
begin
  if (select count(*) from public.household_legacy_imports
      where legacy_id in (repeat('b', 64), repeat('c', 64))) <> 0 then
    raise exception 'Orphaned or explicitly excluded synthetic row was claimed';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
do $$
declare hid uuid;
begin
  select id into hid from public.households where name = 'SYNTHETIC-IMPORTED';
  if hid is null then
    raise exception 'Synthetic imported-row household is missing';
  end if;
  if public.import_legacy_household_data(hid, repeat('f', 64)) is not true then
    raise exception 'Initial import of the synthetic changed-payload row failed';
  end if;
end
$$;
reset role;

update public.household_data
set payload = '{"ciphertext":"SYNTHETIC-IMPORTED-MUTATED"}'::jsonb
where id = repeat('f', 64);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
do $$
declare hid uuid;
begin
  select id into hid from public.households where name = 'SYNTHETIC-IMPORTED';
  if public.import_legacy_household_data(hid, repeat('f', 64)) is not false then
    raise exception 'Changed source payload triggered a duplicate import';
  end if;
  if (select payload ->> 'ciphertext' from public.household_state
      where household_id = hid and section = 'legacy_full')
       <> 'SYNTHETIC-IMPORTED-ORIGINAL' then
    raise exception 'Changed source payload overwrote imported state';
  end if;
end
$$;
reset role;

do $$
declare hid uuid;
begin
  select id into hid from public.households where name = 'SYNTHETIC-AB';
  alter table public.household_data rename to household_data_unavailable;
  begin
    perform public.import_legacy_household_data(hid, repeat('0', 64));
    raise exception 'Import unexpectedly succeeded without the seeded legacy table';
  exception
    when undefined_table then null;
  end;
  alter table public.household_data_unavailable rename to household_data;
end
$$;

rollback;
