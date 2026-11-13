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

-- PostgreSQL/Supabase defaults after the additively hardened defaults migration.
do $$
declare
  default_table_grants integer;
  default_function_grants integer;
  admin_api_defaults integer;
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
    and acl.grantee = 'service_role'::regrole
    and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
  if default_table_grants <> 7 then
    raise exception 'Expected only trusted service_role table defaults, found %', default_table_grants;
  end if;

  select count(distinct (acl.grantee, acl.privilege_type))
  into default_function_grants
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) acl
  where d.defaclrole = 'postgres'::regrole
    and d.defaclnamespace = 'public'::regnamespace
    and d.defaclobjtype = 'f'
    and acl.grantee = 'service_role'::regrole
    and acl.privilege_type = 'EXECUTE';
  if default_function_grants <> 1 then
    raise exception 'Expected only trusted service_role function default, found %', default_function_grants;
  end if;
  if exists (
    select 1
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) acl
    where d.defaclrole = 'postgres'::regrole
      and d.defaclobjtype = 'f'
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC must not receive default EXECUTE on new functions';
  end if;
  if exists (
    select 1
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) acl
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and acl.grantee in ('anon'::regrole, 'authenticated'::regrole)
  ) then
    raise exception 'API users must not receive default privileges on future public objects';
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
  if pg_has_role('postgres', 'supabase_admin', 'MEMBER') then
    raise exception 'Expected the migration owner to be unable to alter platform-admin defaults';
  end if;
  select count(distinct (d.oid, acl.grantee, acl.privilege_type))
  into admin_api_defaults
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) acl
  where d.defaclrole = 'supabase_admin'::regrole
    and d.defaclnamespace = 'public'::regnamespace
    and acl.grantee in ('anon'::regrole, 'authenticated'::regrole);
  if admin_api_defaults > 0 then
    raise warning 'Platform residual: supabase_admin retains % default API grants; postgres cannot alter these defaults, including PUBLIC EXECUTE on new functions', admin_api_defaults;
  end if;
end
$$;

-- Probe the resulting defaults on future objects, then roll them back with this test.
create table public._local_default_acl_probe (id integer);
create function public._local_default_acl_probe() returns integer
language sql as $$ select 1 $$;
do $$
begin
  if has_table_privilege('anon', 'public._local_default_acl_probe', 'SELECT')
     or has_table_privilege('authenticated', 'public._local_default_acl_probe', 'DELETE')
     or not has_table_privilege('service_role', 'public._local_default_acl_probe', 'TRUNCATE')
     or has_function_privilege('anon', 'public._local_default_acl_probe()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public._local_default_acl_probe()', 'EXECUTE')
     or exists (
       select 1 from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where p.oid = 'public._local_default_acl_probe()'::regprocedure
         and a.grantee = 0 and a.privilege_type = 'EXECUTE'
     ) then
    raise exception 'A new public object received unintended API-role or PUBLIC defaults';
  end if;
end
$$;

-- Effective table, column, sequence, and function grants after all migrations.
do $$
declare
  role_name text;
  table_name text;
  privilege_name text;
  column_name text;
  tables text[] := array[
    'household_data', 'households', 'household_members', 'chalkboard_messages',
    'household_state', 'household_legacy_imports', 'personal_preferences',
    'finance_income_months', 'finance_income_history', 'finance_distributions',
    'household_rpc_rate_limit_config', 'household_rpc_rate_limits'
  ];
begin
  foreach table_name in array tables loop
    foreach role_name in array array['anon', 'authenticated'] loop
      foreach privilege_name in array array['TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
        if has_table_privilege(role_name, format('public.%I', table_name), privilege_name) then
          raise exception '% has unexpected % on public.%', role_name, privilege_name, table_name;
        end if;
      end loop;
      foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
        for column_name in
          select a.attname from pg_attribute a
          where a.attrelid = format('public.%I', table_name)::regclass
            and a.attnum > 0 and not a.attisdropped
        loop
          if has_table_privilege(role_name, format('public.%I', table_name), privilege_name)
             is distinct from has_column_privilege(
               role_name, format('public.%I', table_name), column_name, privilege_name
             ) then
            raise exception 'Table/column % privilege mismatch for %.%.%', privilege_name, role_name, table_name, column_name;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;

  if has_table_privilege('anon', 'public.household_data', 'DELETE')
     or has_table_privilege('authenticated', 'public.household_data', 'SELECT')
     or has_table_privilege('authenticated', 'public.household_data', 'INSERT')
     or has_table_privilege('authenticated', 'public.household_data', 'UPDATE') then
    raise exception 'Legacy table grants exceed the anon compatibility route';
  end if;
  if has_table_privilege('anon', 'public.households', 'SELECT')
     or has_table_privilege('anon', 'public.household_members', 'SELECT')
     or has_table_privilege('anon', 'public.household_state', 'SELECT')
     or has_table_privilege('anon', 'public.personal_preferences', 'SELECT')
     or has_table_privilege('anon', 'public.finance_income_months', 'SELECT') then
    raise exception 'anon has direct access to account data';
  end if;
  if not has_table_privilege('authenticated', 'public.households', 'SELECT')
     or not has_table_privilege('authenticated', 'public.household_members', 'SELECT')
     or not has_table_privilege('authenticated', 'public.household_state', 'SELECT')
     or not has_table_privilege('authenticated', 'public.chalkboard_messages', 'SELECT')
     or not has_table_privilege('authenticated', 'public.chalkboard_messages', 'INSERT')
     or not has_table_privilege('authenticated', 'public.chalkboard_messages', 'DELETE') then
    raise exception 'A required household or chalkboard grant is missing';
  end if;
  if has_table_privilege('authenticated', 'public.household_state', 'INSERT')
     or has_table_privilege('authenticated', 'public.household_state', 'UPDATE')
     or has_table_privilege('authenticated', 'public.household_state', 'DELETE') then
    raise exception 'household_state has direct write privileges';
  end if;
  if not has_table_privilege('authenticated', 'public.personal_preferences', 'SELECT')
     or not has_table_privilege('authenticated', 'public.personal_preferences', 'INSERT')
     or not has_table_privilege('authenticated', 'public.personal_preferences', 'UPDATE')
     or has_table_privilege('authenticated', 'public.personal_preferences', 'DELETE') then
    raise exception 'personal_preferences grants do not match its own-row RLS policies';
  end if;
  if has_column_privilege('anon', 'public.personal_preferences', 'profile_config', 'SELECT')
     or has_column_privilege('anon', 'public.household_state', 'payload', 'SELECT')
     or has_column_privilege('authenticated', 'public.household_state', 'payload', 'UPDATE')
     or not has_column_privilege('anon', 'public.household_data', 'payload', 'SELECT')
     or not has_column_privilege('authenticated', 'public.personal_preferences', 'finance_config', 'UPDATE') then
    raise exception 'Unexpected table or column-level privilege';
  end if;
  if not has_table_privilege('anon', 'public.household_data', 'SELECT')
     or not has_table_privilege('anon', 'public.household_data', 'INSERT')
     or not has_table_privilege('anon', 'public.household_data', 'UPDATE') then
    raise exception 'The explicitly seeded legacy anon route is not available locally';
  end if;
  if exists (
    select 1
    from pg_class c
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    where c.relnamespace = 'public'::regnamespace
      and c.relname = any(tables)
      and a.grantee = 0
  ) then
    raise exception 'PUBLIC has direct privileges on an application table';
  end if;
  if exists (
    select 1 from pg_class c
    where c.relkind = 'S' and c.relnamespace = 'public'::regnamespace
      and (has_sequence_privilege('anon', c.oid, 'USAGE')
        or has_sequence_privilege('anon', c.oid, 'SELECT')
        or has_sequence_privilege('anon', c.oid, 'UPDATE')
        or has_sequence_privilege('authenticated', c.oid, 'USAGE')
        or has_sequence_privilege('authenticated', c.oid, 'SELECT')
        or has_sequence_privilege('authenticated', c.oid, 'UPDATE'))
  ) then
    raise exception 'anon or authenticated has direct sequence privileges';
  end if;
  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE')
     or exists (
       select 1 from pg_namespace n
       cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
       where n.oid = 'public'::regnamespace and a.grantee = 0 and a.privilege_type = 'CREATE'
     ) then
    raise exception 'API roles or PUBLIC can create objects in public';
  end if;
  if pg_has_role('anon', 'service_role', 'USAGE')
     or pg_has_role('authenticated', 'service_role', 'USAGE') then
    raise exception 'A normal API role inherits service_role privileges';
  end if;
  if has_table_privilege('service_role', 'public.household_rpc_rate_limit_config', 'SELECT')
     or has_table_privilege('service_role', 'public.household_rpc_rate_limits', 'SELECT')
     or has_function_privilege('service_role', 'public.consume_household_rpc_rate_limit(text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.cleanup_household_rpc_rate_limits(integer)', 'EXECUTE') then
    raise exception 'The privileged API role has direct access to private rate-limit objects';
  end if;
  if exists (
    select 1 from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relname = any(tables)
      and c.relowner in (
        'anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole,
        'supabase_admin'::regrole
      )
  ) then
    raise exception 'An API/service role owns an application table';
  end if;
end
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.create_household(text)',
    'public.join_household(text)',
    'public.is_household_member(uuid)',
    'public.is_household_admin(uuid)',
    'public.put_household_state(uuid,text,jsonb,bigint)',
    'public.import_legacy_household_data(uuid,text)',
    'public.household_profile_list()',
    'public.finance_set_income(uuid,text,bigint)',
    'public.finance_confirm_income(uuid,text,bigint)',
    'public.finance_confirm_distribution(uuid,text,integer,integer,text,jsonb,text)',
    'public.consume_household_rpc_rate_limit(text)',
    'public.cleanup_household_rpc_rate_limits(integer)'
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
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception '% must be SECURITY DEFINER, owned by the migration role, with an empty search_path', fn;
    end if;
  end loop;
  if has_function_privilege('authenticated', 'public.consume_household_rpc_rate_limit(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.cleanup_household_rpc_rate_limits(integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.limit_household_members()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.limit_household_members()', 'EXECUTE')
     or has_function_privilege('anon', 'public.finance_block_update()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.finance_block_update()', 'EXECUTE') then
    raise exception 'An internal or trigger-only function is executable by an API role';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and position('execute' in lower(p.prosrc)) > 0
  ) then
    raise exception 'A SECURITY DEFINER function contains dynamic SQL';
  end if;
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
    'public.finance_distributions'::regclass,
    'public.household_rpc_rate_limit_config'::regclass,
    'public.household_rpc_rate_limits'::regclass
  )
    and not c.relrowsecurity;
  if bad_rls <> 0 then
    raise exception 'Expected RLS enabled on all application tables; invalid count %', bad_rls;
  end if;
  if not (select relforcerowsecurity from pg_class where oid='public.household_rpc_rate_limit_config'::regclass)
     or not (select relforcerowsecurity from pg_class where oid='public.household_rpc_rate_limits'::regclass)
     or exists (
       select 1 from pg_class c
       where c.oid in (
         'public.household_data'::regclass, 'public.households'::regclass,
         'public.household_members'::regclass, 'public.chalkboard_messages'::regclass,
         'public.household_state'::regclass, 'public.household_legacy_imports'::regclass,
         'public.personal_preferences'::regclass, 'public.finance_income_months'::regclass,
         'public.finance_income_history'::regclass, 'public.finance_distributions'::regclass
       ) and c.relforcerowsecurity
     ) then
    raise exception 'Internal tables must FORCE RLS without changing existing app table behavior';
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
  ('00000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'synthetic-c@example.invalid'),
  ('00000000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'synthetic-d@example.invalid');

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
create temp table household_members (household_id uuid, user_id uuid);
insert into pg_temp.household_members (household_id, user_id)
values (
  (select id from public.households where name = 'SYNTHETIC-AB'),
  '00000000-0000-4000-8000-00000000000c'
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
do $$
begin
  if public.is_household_member(current_setting('test.synthetic_ab_id')::uuid) then
    raise exception 'A pg_temp household_members table overrode the SECURITY DEFINER membership check';
  end if;
end
$$;
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
select id from public.create_household('SYNTHETIC-IMPORTED');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000d', true);
select id from public.create_household('SYNTHETIC-DAMAGED-OWNER');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', true);
select public.import_legacy_household_data(
  (select id from public.households where name = 'SYNTHETIC-C'), repeat('d', 64)
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);
do $$
declare hid uuid;
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
  if public.import_legacy_household_data(hid, repeat('d', 64)) is not false then
    raise exception 'Cross-household legacy row was unexpectedly claimed';
  end if;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000d', true);
do $$
declare damaged_hid uuid;
begin
  select id into damaged_hid from public.households where name = 'SYNTHETIC-DAMAGED-OWNER';
  if public.import_legacy_household_data(damaged_hid, repeat('e', 64)) is not true then
    raise exception 'Opaque damaged-payload fixture was not imported';
  end if;
  if (select payload from public.household_state
      where household_id = damaged_hid and section = 'legacy_full')
       <> '{"ciphertext":"%%%DAMAGED","iv":"not-base64","tag":null}'::jsonb then
    raise exception 'Damaged encrypted payload was modified during opaque import';
  end if;
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
