\set ON_ERROR_STOP on
\set QUIET 1

begin;

do $$
begin
  if current_setting('server_version_num')::integer / 10000 <> 15 then
    raise exception 'Phase 3 v2 integration test requires PostgreSQL 15';
  end if;
end
$$;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'phase3-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'phase3-b@example.invalid'),
  ('00000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'phase3-c@example.invalid'),
  ('00000000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'phase3-d@example.invalid'),
  ('00000000-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'phase3-e@example.invalid');

insert into public.households (id, name, join_code, created_by) values
  ('10000000-0000-4000-8000-000000000001', 'PHASE3-AB', 'PHASE3-AB-CODE', '00000000-0000-4000-8000-00000000000a'),
  ('10000000-0000-4000-8000-000000000002', 'PHASE3-OTHER-C', 'PHASE3-C-CODE', '00000000-0000-4000-8000-00000000000c'),
  ('10000000-0000-4000-8000-000000000003', 'PHASE3-OTHER-D', 'PHASE3-D-CODE', '00000000-0000-4000-8000-00000000000d');

insert into public.household_members (household_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'owner'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b', 'member'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000c', 'owner'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000d', 'owner');

insert into public.household_data (id, payload) values
  (repeat('a', 64), '{"ciphertext":"PHASE3-IMPORTED","iv":"SYNTHETIC-IV"}'::jsonb),
  (repeat('b', 64), '{"ciphertext":"PHASE3-EXCLUDED"}'::jsonb),
  (repeat('c', 64), '{"ciphertext":"PHASE3-ONE-MEMBER"}'::jsonb),
  ('synthetic-raw-row-id-never-copied', '{"ciphertext":"PHASE3-REDACTED-ID"}'::jsonb);

do $$
declare failed boolean := false;
begin
  if to_regprocedure('public.exclude_legacy_household_row(text,text,uuid)') is not null
     or has_function_privilege('authenticated', 'public.exclude_legacy_household_row(text,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.exclude_legacy_household_row(text,text)', 'EXECUTE')
     or not has_function_privilege('postgres', 'public.exclude_legacy_household_row(text,text)', 'EXECUTE') then
    raise exception 'Exclusion is not restricted to the database owner';
  end if;
  if to_regprocedure('public.submit_legacy_local_verification(uuid,uuid,text,boolean)') is not null
     or (
       select p.proargnames @> array['p_user_id']
       from pg_catalog.pg_proc p
       where p.oid = 'public.submit_legacy_local_verification(uuid,uuid,text,text,boolean)'::regprocedure
     ) then
    raise exception 'A verification caller can select the attesting user';
  end if;
  set local role authenticated;
  begin
    perform public.exclude_legacy_household_row(
      repeat('b', 64), 'Unauthorized synthetic exclusion attempt'
    );
  exception when insufficient_privilege then
    failed := true;
  end;
  reset role;
  if not failed then raise exception 'An API user excluded a legacy row'; end if;
end
$$;

do $$
declare
  report jsonb;
  hash text;
  failed boolean;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
  if not public.import_legacy_household_data(
    '10000000-0000-4000-8000-000000000001', repeat('a', 64)
  ) then
    raise exception 'Synthetic valid import failed';
  end if;
  hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    (select payload::text from public.household_data where id = repeat('a', 64)), 'UTF8'
  )), 'hex');
  if (select payload_sha256 from public.household_legacy_imports where legacy_id = repeat('a', 64)) <> hash
     or (select payload_sha256 from public.legacy_row_disposition where legacy_id = repeat('a', 64)) <> hash then
    raise exception 'Import did not record the same server-side source hash in both records';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);
  if public.import_legacy_household_data(
    '10000000-0000-4000-8000-000000000001', repeat('a', 64)
  ) then
    raise exception 'Duplicate import was accepted';
  end if;
  if public.import_legacy_household_data(
    '10000000-0000-4000-8000-000000000001', 'synthetic-raw-row-id-never-copied'
  ) then
    raise exception 'An unrecognized legacy ID format was imported';
  end if;

  alter table public.legacy_row_disposition disable trigger legacy_row_disposition_immutable;
  failed := false;
  begin
    update public.legacy_row_disposition set payload_sha256 = null
    where legacy_id = repeat('a', 64);
  exception when check_violation then
    failed := true;
  end;
  if not failed then
    raise exception 'A missing finalized ledger hash was accepted';
  end if;

  update public.legacy_row_disposition
  set payload_sha256 = repeat('0', 64)
  where legacy_id = repeat('a', 64);
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'payload_integrity') then
    raise exception 'An incorrect ledger payload hash passed integrity validation';
  end if;
  update public.legacy_row_disposition
  set payload_sha256 = hash
  where legacy_id = repeat('a', 64);
  alter table public.legacy_row_disposition enable trigger legacy_row_disposition_immutable;

  report := public.check_legacy_sync_phase3_v2();
  if not exists (
    select 1 from jsonb_array_elements(report->'checks') c
    where c->>'id' = 'inventory_present' and (c->>'passed')::boolean
  ) or (report->>'passed')::boolean then
    raise exception 'Unresolved legacy rows or missing local evidence did not block Phase 3';
  end if;

  failed := false;
  begin
    update public.legacy_row_disposition set disposition = 'unknown'
    where legacy_id = repeat('b', 64);
  exception when check_violation then
    failed := true;
  end;
  if not failed then
    raise exception 'Invalid ledger status was accepted';
  end if;

  failed := false;
  begin
    perform public.exclude_legacy_household_row(
      repeat('b', 64), 'short'
    );
  exception when sqlstate '22023' then
    failed := true;
  end;
  if not failed then
    raise exception 'An invalid exclusion reason was accepted';
  end if;

  update public.household_legacy_imports set payload_sha256 = null
  where legacy_id = repeat('a', 64);
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'import_consistency') then
    raise exception 'Missing import payload hash did not block Phase 3';
  end if;
  update public.household_legacy_imports set payload_sha256 = hash
  where legacy_id = repeat('a', 64);

  update public.household_data
  set payload = '{"ciphertext":"PHASE3-MUTATED"}'::jsonb
  where id = repeat('a', 64);
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'payload_integrity') then
    raise exception 'A changed source payload hash did not block Phase 3';
  end if;
  update public.household_data
  set payload = '{"ciphertext":"PHASE3-IMPORTED","iv":"SYNTHETIC-IV"}'::jsonb
  where id = repeat('a', 64);

  update public.household_legacy_imports
  set household_id = '10000000-0000-4000-8000-000000000002'
  where legacy_id = repeat('a', 64);
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'import_consistency') then
    raise exception 'A wrong household association did not block Phase 3';
  end if;
  update public.household_legacy_imports
  set household_id = '10000000-0000-4000-8000-000000000001'
  where legacy_id = repeat('a', 64);

  insert into public.household_state (household_id, section, payload, updated_by)
  values ('10000000-0000-4000-8000-000000000003', 'legacy_full',
    '{"ciphertext":"PHASE3-ORPHAN-LEGACY-FULL"}'::jsonb,
    '00000000-0000-4000-8000-00000000000d');
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'import_consistency') then
    raise exception 'An orphan legacy_full state passed import consistency';
  end if;
  delete from public.household_state
  where household_id = '10000000-0000-4000-8000-000000000003'
    and section = 'legacy_full';

  failed := false;
  begin
    perform public.close_legacy_sync_phase3_v2();
  exception when sqlstate 'P0001' then
    failed := true;
  end;
  if not failed or (select closed_at from public.legacy_sync_phase3_state where singleton) is not null
     or not has_table_privilege('anon', 'public.household_data', 'SELECT')
     or (select count(*) from pg_policy where polrelid = 'public.household_data'::regclass) <> 3 then
    raise exception 'Failed Phase 3 changed legacy access or was not rejected';
  end if;
end
$$;

-- A migrated household with one member and activity in a different household
-- must not satisfy the two-member or writer checks.
savepoint one_member_case;
insert into public.household_state (household_id, section, payload, updated_by)
select '10000000-0000-4000-8000-000000000002', 'legacy_full',
  payload, '00000000-0000-4000-8000-00000000000c'
from public.household_data where id = repeat('c', 64);
insert into public.household_legacy_imports
  (legacy_id, household_id, imported_by, payload_sha256, initial_import_version)
values (
  repeat('c', 64), '10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-00000000000c',
  pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    (select payload::text from public.household_data where id = repeat('c', 64)), 'UTF8'
  )), 'hex'),
  1
);
update public.legacy_row_disposition
set disposition = 'migrated',
    household_id = '10000000-0000-4000-8000-000000000002',
    decided_at = pg_catalog.clock_timestamp(),
    decided_by = '00000000-0000-4000-8000-00000000000c',
    payload_sha256 = (select payload_sha256 from public.household_legacy_imports where legacy_id = repeat('c', 64)),
    initial_import_version = 1
where legacy_id = repeat('c', 64);
insert into public.household_state_write_audit
  (household_id, section, version, updated_by, written_at)
values ('10000000-0000-4000-8000-000000000003', 'tasks', 2,
  '00000000-0000-4000-8000-00000000000d', pg_catalog.clock_timestamp());
do $$
declare report jsonb;
begin
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'two_active_members')
     or (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'both_members_wrote') then
    raise exception 'One member plus a writer from another household passed';
  end if;
end
$$;
rollback to savepoint one_member_case;
release savepoint one_member_case;

-- A disabled membership-limit trigger simulates an invalid >2-member row set.
alter table public.household_members disable trigger household_members_limit;
insert into public.household_members (household_id, user_id, role)
values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000e', 'member');
do $$
declare report jsonb;
begin
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'two_active_members') then
    raise exception 'A household with more than two members passed';
  end if;
end
$$;
delete from public.household_members
where household_id = '10000000-0000-4000-8000-000000000001'
  and user_id = '00000000-0000-4000-8000-00000000000e';
alter table public.household_members enable trigger household_members_limit;

do $$
declare report jsonb; version bigint; failed boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
  version := public.put_household_state(
    '10000000-0000-4000-8000-000000000001', 'tasks',
    '{"ciphertext":"PHASE3-A-V1"}'::jsonb, 0
  );
  if version <> 1 then raise exception 'Unexpected initial state version'; end if;
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'both_members_wrote') then
    raise exception 'Version 1 was counted as a post-import write';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);
  version := public.put_household_state(
    '10000000-0000-4000-8000-000000000001', 'tasks',
    '{"ciphertext":"PHASE3-B-V2"}'::jsonb, 1
  );
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
  version := public.put_household_state(
    '10000000-0000-4000-8000-000000000001', 'tasks',
    '{"ciphertext":"PHASE3-A-V3"}'::jsonb, 2
  );
  if version <> 3 then raise exception 'Post-import state version did not advance'; end if;
  report := public.check_legacy_sync_phase3_v2();
  if not (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'both_members_wrote') then
    raise exception 'Two active members with audited post-import writes were not accepted: %', report;
  end if;

  set local role authenticated;
  perform public.submit_legacy_local_verification(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    repeat('c', 64), repeat('a', 64), true
  );
  reset role;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);
  set local role authenticated;
  perform public.submit_legacy_local_verification(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    repeat('c', 64), repeat('b', 64), true
  );
  reset role;
  report := public.check_legacy_sync_phase3_v2();
  if not (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'local_verification')
     or not (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'shared_comparison_hash') then
    raise exception 'Two members with one comparison id and hash were rejected';
  end if;
  failed := false;
  begin
    update public.legacy_local_verifications
    set comparison_sha256 = null
    where household_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-00000000000a';
  exception when check_violation then
    failed := true;
  end;
  if not failed then raise exception 'A resolved verification without a canonical hash was stored'; end if;
  failed := false;
  begin
    set local role authenticated;
    perform public.submit_legacy_local_verification(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      repeat('z', 64), repeat('a', 64), true
    );
  exception when sqlstate '22023' then
    failed := true;
  end;
  reset role;
  if not failed then raise exception 'An invalid canonical hash was accepted'; end if;

  delete from public.legacy_local_verifications
  where household_id = '10000000-0000-4000-8000-000000000001'
    and user_id = '00000000-0000-4000-8000-00000000000b';
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'shared_comparison_hash') then
    raise exception 'A missing member verification passed';
  end if;
  set local role authenticated;
  perform public.submit_legacy_local_verification(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    repeat('c', 64), repeat('b', 64), true
  );
  reset role;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
  set local role authenticated;
  perform public.submit_legacy_local_verification(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    repeat('d', 64), repeat('b', 64), true
  );
  reset role;
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'local_verification')
     or (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'shared_comparison_hash') then
    raise exception 'Different canonical hashes passed for one comparison id';
  end if;

  set local role authenticated;
  perform public.submit_legacy_local_verification(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    repeat('c', 64), repeat('b', 64), true
  );
  reset role;
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'local_verification')
     or (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'shared_comparison_hash') then
    raise exception 'Different comparison ids passed';
  end if;

  set local role authenticated;
  perform public.submit_legacy_local_verification(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    repeat('c', 64), repeat('b', 64), false
  );
  reset role;
  report := public.check_legacy_sync_phase3_v2();
  if (select (c->>'passed')::boolean from jsonb_array_elements(report->'checks') c
      where c->>'id' = 'local_verification') then
    raise exception 'A member with unresolved conflicts passed';
  end if;
  set local role authenticated;
  perform public.submit_legacy_local_verification(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    repeat('c', 64), repeat('b', 64), true
  );
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', true);
  failed := false;
  begin
    set local role authenticated;
    perform public.submit_legacy_local_verification(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      repeat('c', 64), repeat('c', 64), true
    );
  exception when insufficient_privilege then
    failed := true;
  end;
  reset role;
  if not failed then raise exception 'A non-member verified on behalf of another member'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', true);
  perform public.exclude_legacy_household_row(
    repeat('b', 64), 'Intentionally excluded synthetic legacy fixture after review'
  );
  perform public.exclude_legacy_household_row(
    repeat('c', 64), 'One-member synthetic fixture excluded after guard rejection'
  );
  perform public.exclude_legacy_household_row(
    'synthetic-raw-row-id-never-copied',
    'Malformed synthetic row excluded after identifier review'
  );
  if exists (
    select 1 from public.legacy_row_disposition
    where legacy_id in (repeat('b', 64), repeat('c', 64),
      'sha256:' || pg_catalog.encode(pg_catalog.sha256(
        pg_catalog.convert_to('synthetic-raw-row-id-never-copied', 'UTF8')
      ), 'hex'))
      and (decided_by is not null or decision_actor is distinct from session_user)
  ) then
    raise exception 'Exclusion identity came from a request claim rather than the database login';
  end if;
  if exists (
    select 1 from public.legacy_row_disposition
    where legacy_id = 'synthetic-raw-row-id-never-copied'
  ) or not exists (
    select 1 from public.legacy_row_disposition
    where legacy_id = 'sha256:' || pg_catalog.encode(pg_catalog.sha256(
      pg_catalog.convert_to('synthetic-raw-row-id-never-copied', 'UTF8')
    ), 'hex') and disposition = 'excluded'
  ) then
    raise exception 'A non-SHA legacy ID was not stored as a redacted digest';
  end if;

  report := public.check_legacy_sync_phase3_v2();
  if not (report->>'passed')::boolean then
    raise exception 'Valid synthetic Phase-3-v2 fixture was rejected: %', report;
  end if;
  if report->>'database_limit' not like '%outside database observability%' then
    raise exception 'Database plaintext-verification limitation was not reported';
  end if;
end
$$;

do $$
declare closed_report jsonb; failed boolean := false;
begin
  closed_report := public.close_legacy_sync_phase3_v2();
  if not (closed_report->>'closed')::boolean or not (closed_report->>'passed')::boolean then
    raise exception 'The fully verified synthetic closure did not succeed';
  end if;
  if has_table_privilege('anon', 'public.household_data', 'SELECT')
     or has_table_privilege('anon', 'public.household_data', 'INSERT')
     or has_table_privilege('anon', 'public.household_data', 'UPDATE')
     or has_table_privilege('anon', 'public.household_data', 'DELETE')
     or has_table_privilege('anon', 'public.household_data', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.household_data', 'SELECT')
     or has_table_privilege('authenticated', 'public.household_data', 'INSERT')
     or has_table_privilege('authenticated', 'public.household_data', 'UPDATE')
     or has_table_privilege('authenticated', 'public.household_data', 'DELETE')
     or has_table_privilege('authenticated', 'public.household_data', 'TRUNCATE')
     or has_table_privilege('service_role', 'public.household_data', 'SELECT')
     or (select count(*) from pg_policy where polrelid = 'public.household_data'::regclass) <> 0 then
    raise exception 'Legacy table grants or policies remained after closure';
  end if;
  if has_function_privilege('anon', 'public.import_legacy_household_data(uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.import_legacy_household_data(uuid,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.import_legacy_household_data(uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.close_legacy_sync_phase3_v2()', 'EXECUTE')
     or has_function_privilege('anon', 'public.open_legacy_recovery(text[],text,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.open_legacy_recovery(text[],text,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.open_legacy_recovery(text[],text,integer)', 'EXECUTE') then
    raise exception 'Import, guard or recovery function privileges are incorrect';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', true);
  failed := false;
  begin
    perform public.put_household_state(
      '10000000-0000-4000-8000-000000000001', 'tasks', '{}'::jsonb, 3
    );
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'An outsider wrote to the migrated household'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
  if public.put_household_state(
    '10000000-0000-4000-8000-000000000001', 'tasks',
    '{"ciphertext":"ACCOUNT-SYNC-AFTER-CLOSE"}'::jsonb, 3
  ) <> 4 then
    raise exception 'Account sync stopped working after legacy closure';
  end if;

end
$$;

set local role anon;
do $$
declare failed boolean;
begin
  if has_table_privilege('anon', 'public.household_data', 'SELECT')
     or has_table_privilege('anon', 'public.household_data', 'INSERT')
     or has_table_privilege('anon', 'public.household_data', 'UPDATE')
     or has_table_privilege('anon', 'public.household_data', 'DELETE')
     or has_table_privilege('anon', 'public.household_data', 'TRUNCATE') then
    raise exception 'anon retained a direct legacy privilege';
  end if;
  failed := false;
  begin
    perform payload from public.household_data;
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'anon read household_data'; end if;
  failed := false;
  begin
    insert into public.household_data (id, payload)
    values (repeat('f', 64), '{}'::jsonb);
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'anon inserted into household_data'; end if;
  failed := false;
  begin
    update public.household_data set payload = '{}'::jsonb where id = repeat('a', 64);
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'anon updated household_data'; end if;
  failed := false;
  begin
    delete from public.household_data where id = repeat('a', 64);
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'anon deleted household_data'; end if;
  failed := false;
  begin
    truncate table public.household_data;
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'anon truncated household_data'; end if;
end
$$;
reset role;
set local role authenticated;
do $$
declare failed boolean;
begin
  if has_table_privilege('authenticated', 'public.household_data', 'SELECT')
     or has_table_privilege('authenticated', 'public.household_data', 'INSERT')
     or has_table_privilege('authenticated', 'public.household_data', 'UPDATE')
     or has_table_privilege('authenticated', 'public.household_data', 'DELETE')
     or has_table_privilege('authenticated', 'public.household_data', 'TRUNCATE') then
    raise exception 'authenticated retained a direct legacy privilege';
  end if;
  failed := false;
  begin
    perform public.import_legacy_household_data(
      '10000000-0000-4000-8000-000000000001', repeat('a', 64)
    );
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'authenticated retained the import oracle'; end if;
end
$$;
reset role;

set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare
  recovery uuid;
  recovery2 uuid;
  actual integer;
  valid_hashes boolean;
  failed boolean;
  saved_disposition public.legacy_row_disposition%rowtype;
begin
  failed := false;
  begin
    perform public.open_legacy_recovery(
      array_fill(repeat('a', 64), array[21]),
      'The synthetic recovery row limit must remain enforced', 5
    );
  exception when sqlstate '22023' then
    failed := true;
  end;
  if not failed then raise exception 'Recovery accepted more than 20 rows'; end if;

  failed := false;
  begin
    perform public.open_legacy_recovery(array[repeat('a', 64)],
      'The synthetic recovery duration limit must remain enforced', 61);
  exception when sqlstate '22023' then
    failed := true;
  end;
  if not failed then raise exception 'Recovery accepted a window longer than 60 minutes'; end if;

  failed := false;
  begin
    perform public.open_legacy_recovery(array[repeat('f', 64)],
      'Unknown synthetic row must remain blocked', 5);
  exception when sqlstate '22023' then
    failed := true;
  end;
  if not failed then raise exception 'Unknown row was added to emergency recovery'; end if;

  recovery := public.open_legacy_recovery(array[repeat('a', 64), repeat('b', 64)],
    'Synthetic emergency recovery test', 5);
  select count(*), bool_and(
    r.payload_sha256 = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(r.payload::text, 'UTF8')), 'hex'
    )
  )
  into actual, valid_hashes
  from public.read_legacy_row_recovery(recovery) r;
  if actual <> 2 or not valid_hashes then
    raise exception 'Emergency recovery did not return every row with its ledger hash';
  end if;
  reset role;
  if not exists (
    select 1 from public.legacy_recovery_audit
    where recovery_id = recovery and action = 'read' and row_count = 2 and reason is null
  ) then
    raise exception 'Successful recovery read was not logged without payload data';
  end if;
  set local role service_role;
  if public.close_legacy_recovery(recovery) is not true then
    raise exception 'Emergency recovery could not be closed';
  end if;
  failed := false;
  begin
    perform * from public.read_legacy_row_recovery(recovery);
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'Closed emergency recovery still returned data'; end if;

  recovery := public.open_legacy_recovery(array[repeat('a', 64), repeat('b', 64)],
    'Synthetic missing-row recovery test', 5);
  reset role;
  alter table public.household_data disable trigger household_data_disposition_guard;
  delete from public.household_data where id = repeat('b', 64);
  set local role service_role;
  failed := false;
  begin
    perform * from public.read_legacy_row_recovery(recovery);
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'Recovery returned a partial dataset when a row was missing'; end if;
  reset role;
  insert into public.household_data (id, payload)
  values (repeat('b', 64), '{"ciphertext":"PHASE3-EXCLUDED"}'::jsonb);
  alter table public.household_data enable trigger household_data_disposition_guard;
  set local role service_role;
  perform public.close_legacy_recovery(recovery);

  recovery := public.open_legacy_recovery(array[repeat('a', 64), repeat('b', 64)],
    'Synthetic changed-payload recovery test', 5);
  reset role;
  alter table public.household_data disable trigger household_data_disposition_guard;
  update public.household_data
  set payload = '{"ciphertext":"PHASE3-CHANGED"}'::jsonb
  where id = repeat('b', 64);
  set local role service_role;
  failed := false;
  begin
    perform * from public.read_legacy_row_recovery(recovery);
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'Recovery accepted a changed source payload'; end if;
  reset role;
  update public.household_data
  set payload = '{"ciphertext":"PHASE3-EXCLUDED"}'::jsonb
  where id = repeat('b', 64);
  alter table public.household_data enable trigger household_data_disposition_guard;
  set local role service_role;
  perform public.close_legacy_recovery(recovery);

  recovery := public.open_legacy_recovery(array[repeat('a', 64), repeat('b', 64)],
    'Synthetic changed-ledger-hash recovery test', 5);
  reset role;
  select * into saved_disposition
  from public.legacy_row_disposition where legacy_id = repeat('b', 64);
  alter table public.legacy_row_disposition disable trigger legacy_row_disposition_immutable;
  update public.legacy_row_disposition
  set payload_sha256 = repeat('0', 64)
  where legacy_id = repeat('b', 64);
  set local role service_role;
  failed := false;
  begin
    perform * from public.read_legacy_row_recovery(recovery);
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'Recovery accepted a changed ledger hash'; end if;
  reset role;
  update public.legacy_row_disposition
  set disposition = null, household_id = null, decided_at = null, decided_by = null,
      decision_actor = null, exclusion_reason = null, payload_sha256 = null,
      initial_import_version = null
  where legacy_id = repeat('b', 64);
  alter table public.legacy_row_disposition enable trigger legacy_row_disposition_immutable;
  set local role service_role;
  failed := false;
  begin
    perform * from public.read_legacy_row_recovery(recovery);
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'Recovery accepted a missing ledger hash'; end if;
  reset role;
  alter table public.legacy_row_disposition disable trigger legacy_row_disposition_immutable;
  update public.legacy_row_disposition
  set disposition = saved_disposition.disposition,
      household_id = saved_disposition.household_id,
      decided_at = saved_disposition.decided_at,
      decided_by = saved_disposition.decided_by,
      decision_actor = saved_disposition.decision_actor,
      exclusion_reason = saved_disposition.exclusion_reason,
      payload_sha256 = saved_disposition.payload_sha256,
      initial_import_version = saved_disposition.initial_import_version
  where legacy_id = repeat('b', 64);
  alter table public.legacy_row_disposition enable trigger legacy_row_disposition_immutable;
  set local role service_role;
  perform public.close_legacy_recovery(recovery);

  recovery := public.open_legacy_recovery(array[repeat('a', 64)],
    'Synthetic expiry test for the bounded recovery window', 1);
  reset role;
  update public.legacy_recovery_allow
  set opened_at = pg_catalog.clock_timestamp() - interval '2 minutes',
      expires_at = pg_catalog.clock_timestamp() - interval '1 minute'
  where recovery_id = recovery;
  set local role service_role;
  failed := false;
  begin
    perform * from public.read_legacy_row_recovery(recovery);
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'Expired emergency recovery still returned data'; end if;
  perform public.close_legacy_recovery(recovery);

  recovery := public.open_legacy_recovery(array[repeat('a', 64)],
    'Synthetic rollback-file kill-switch test', 5);
  perform set_config('test.phase3_recovery_id', recovery::text, true);
  failed := false;
  begin
    perform public.open_legacy_recovery(array[repeat('b', 64)],
      'Second simultaneous recovery must remain blocked', 5);
  exception when sqlstate '55000' then
    failed := true;
  end;
  if not failed then raise exception 'A second active recovery window was opened'; end if;
  recovery2 := pg_catalog.gen_random_uuid();
  reset role;
  insert into public.legacy_recovery_allow
    (recovery_id, legacy_id, reason, opened_by, opened_at, expires_at)
  values (recovery2, repeat('b', 64), 'Synthetic second kill-switch fixture',
    session_user, pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp() + interval '5 minutes');
  perform set_config('test.phase3_recovery_id2', recovery2::text, true);
  set local role service_role;
end
$$;
reset role;
