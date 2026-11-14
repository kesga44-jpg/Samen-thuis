alter table public.legacy_row_disposition
  add column if not exists decision_actor text;

alter table public.legacy_row_disposition
  drop constraint if exists legacy_row_disposition_check;

alter table public.legacy_row_disposition
  add constraint legacy_row_disposition_check check (
    (disposition is null and household_id is null and decided_at is null
      and decided_by is null and decision_actor is null and exclusion_reason is null
      and payload_sha256 is null and initial_import_version is null)
    or (disposition = 'migrated' and household_id is not null
      and decided_at is not null and decided_by is not null and decision_actor is null
      and exclusion_reason is null and payload_sha256 is not null
      and payload_sha256 ~ '^[0-9a-f]{64}$'
      and initial_import_version is not null and initial_import_version > 0)
    or (disposition = 'excluded' and household_id is null
      and decided_at is not null and exclusion_reason is not null
      and char_length(btrim(exclusion_reason)) between 10 and 500
      and payload_sha256 is not null and payload_sha256 ~ '^[0-9a-f]{64}$'
      and initial_import_version is null
      and (
        (decided_by is not null and decision_actor is null)
        or (decided_by is null and nullif(btrim(decision_actor), '') is not null)
      ))
  );

alter table public.legacy_local_verifications
  add column if not exists comparison_sha256 text;

-- Old attestations did not include a shared canonical comparison hash.
update public.legacy_local_verifications
set conflicts_resolved = false
where comparison_sha256 is null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.legacy_local_verifications'::regclass
      and conname = 'legacy_local_verifications_comparison_sha256_check'
  ) then
    alter table public.legacy_local_verifications
      add constraint legacy_local_verifications_comparison_sha256_check check (
        (comparison_sha256 is null
          or comparison_sha256 ~ '^[0-9a-f]{64}$')
        and (not conflicts_resolved
          or (comparison_sha256 is not null
            and comparison_sha256 ~ '^[0-9a-f]{64}$'))
      );
  end if;
end
$$;

alter table public.legacy_sync_phase3_state
  add column if not exists recovery_disabled_at timestamptz;

drop function if exists public.exclude_legacy_household_row(text, text, uuid);

create or replace function public.exclude_legacy_household_row(
  p_legacy_id text, p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare legacy jsonb; recorded integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(741140, 3);
  if exists (
    select 1 from public.legacy_sync_phase3_state
    where singleton and closed_at is not null
  ) then
    raise exception 'Legacy-synchronisatie is definitief afgesloten';
  end if;
  if p_legacy_id is null or pg_catalog.char_length(p_legacy_id) not between 1 and 4096
     or p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 10 and 500 then
    raise exception 'Ongeldige uitsluitingsregistratie' using errcode = '22023';
  end if;
  select payload into legacy
  from public.household_data where id = p_legacy_id for update;
  if not found then
    raise exception 'Legacy-rij bestaat niet' using errcode = '22023';
  end if;
  insert into public.legacy_row_disposition (legacy_id)
  values (public.legacy_disposition_id(p_legacy_id))
  on conflict (legacy_id) do nothing;
  update public.legacy_row_disposition
  set disposition = 'excluded',
      decided_at = pg_catalog.clock_timestamp(),
      decided_by = null,
      decision_actor = session_user,
      exclusion_reason = pg_catalog.btrim(p_reason),
      payload_sha256 = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(legacy::text, 'UTF8')), 'hex'
      )
  where legacy_id = public.legacy_disposition_id(p_legacy_id) and disposition is null;
  get diagnostics recorded = row_count;
  if recorded <> 1 then
    raise exception 'Legacy-rij heeft al een definitieve status' using errcode = '40001';
  end if;
  return true;
end
$$;

comment on function public.exclude_legacy_household_row(text, text) is
  'Database-owner-only exclusion operation. The database login is recorded as decision_actor; it is not callable by API users.';

revoke all on function public.exclude_legacy_household_row(text, text)
  from public, anon, authenticated, service_role;

drop function if exists public.submit_legacy_local_verification(uuid, uuid, text, boolean);

create or replace function public.submit_legacy_local_verification(
  p_household uuid,
  p_comparison_id uuid,
  p_comparison_sha256 text,
  p_report_sha256 text,
  p_conflicts_resolved boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare effective_conflicts_resolved boolean;
begin
  if auth.uid() is null or not public.is_household_member(p_household) then
    raise exception 'Geen toegang tot dit huishouden' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(741140, 3);
  if exists (
    select 1 from public.legacy_sync_phase3_state
    where singleton and closed_at is not null
  ) then
    raise exception 'Lokale verificatie is al afgesloten' using errcode = '42501';
  end if;
  if p_comparison_id is null
     or p_comparison_sha256 is null
     or p_comparison_sha256 !~ '^[0-9a-f]{64}$'
     or p_report_sha256 is null
     or p_report_sha256 !~ '^[0-9a-f]{64}$'
     or p_conflicts_resolved is null then
    raise exception 'Ongeldig lokaal migratierapport' using errcode = '22023';
  end if;

  effective_conflicts_resolved := p_conflicts_resolved and not exists (
    select 1 from public.legacy_local_verifications v
    where v.household_id = p_household
      and v.user_id <> auth.uid()
      and v.comparison_sha256 is not null
      and (
        v.comparison_id is distinct from p_comparison_id
        or v.comparison_sha256 is distinct from p_comparison_sha256
      )
  );

  insert into public.legacy_local_verifications
    (household_id, user_id, comparison_id, comparison_sha256,
      report_sha256, conflicts_resolved, verified_at)
  values
    (p_household, auth.uid(), p_comparison_id, p_comparison_sha256,
      p_report_sha256, effective_conflicts_resolved, pg_catalog.clock_timestamp())
  on conflict (household_id, user_id) do update
  set comparison_id = excluded.comparison_id,
      comparison_sha256 = excluded.comparison_sha256,
      report_sha256 = excluded.report_sha256,
      conflicts_resolved = excluded.conflicts_resolved,
      verified_at = excluded.verified_at;
  return true;
end
$$;

revoke all on function public.submit_legacy_local_verification(uuid, uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_legacy_local_verification(uuid, uuid, text, text, boolean)
  to authenticated;

do $$
begin
  if to_regprocedure('public.legacy_phase3_v2_report()') is not null
     and to_regprocedure('public.legacy_phase3_v2_report_base()') is null then
    execute 'alter function public.legacy_phase3_v2_report() rename to legacy_phase3_v2_report_base';
  end if;
end
$$;

create or replace function public.legacy_phase3_v2_report()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  updated_checks jsonb;
  valid_dispositions boolean;
  shared_comparison boolean;
  final_passed boolean;
  comparison_details jsonb;
begin
  result := public.legacy_phase3_v2_report_base();

  select not exists (
    select 1 from public.legacy_row_disposition
    where (disposition not in ('migrated', 'excluded'))
      or (disposition = 'excluded' and (
        exclusion_reason is null
        or pg_catalog.char_length(pg_catalog.btrim(exclusion_reason)) not between 10 and 500
        or decided_at is null
        or (decided_by is null and nullif(pg_catalog.btrim(decision_actor), '') is null)
        or payload_sha256 is null or payload_sha256 !~ '^[0-9a-f]{64}$'
      ))
      or (disposition = 'migrated' and (
        household_id is null or decided_by is null or decided_at is null
        or decision_actor is not null
        or payload_sha256 is null or payload_sha256 !~ '^[0-9a-f]{64}$'
        or initial_import_version is null or initial_import_version < 1
      ))
  ) into valid_dispositions;

  select not exists (
    select 1
    from (
      select distinct household_id
      from public.legacy_row_disposition where disposition = 'migrated'
    ) h
    where (
      select count(*)
      from public.household_members m
      join public.legacy_local_verifications v
        on v.household_id = m.household_id and v.user_id = m.user_id
      where m.household_id = h.household_id
        and v.conflicts_resolved
        and v.comparison_sha256 ~ '^[0-9a-f]{64}$'
        and v.report_sha256 ~ '^[0-9a-f]{64}$'
    ) <> 2
      or (
        select count(distinct v.comparison_id)
        from public.legacy_local_verifications v
        where v.household_id = h.household_id
      ) <> 1
      or (
        select count(distinct v.comparison_sha256)
        from public.legacy_local_verifications v
        where v.household_id = h.household_id
          and v.comparison_sha256 ~ '^[0-9a-f]{64}$'
      ) <> 1
      or exists (
        select 1 from public.legacy_local_verifications v
        where v.household_id = h.household_id
          and not exists (
            select 1 from public.household_members m
            where m.household_id = v.household_id and m.user_id = v.user_id
          )
      )
  ) into shared_comparison;

  comparison_details := pg_catalog.jsonb_build_object(
    'required', 'Both active members must attest to one comparison_id and one shared canonical SHA-256; report hashes may differ',
    'canonical_hash', 'Lowercase SHA-256 of PR E versioned canonical comparison bytes',
    'plaintext_equality', 'Not independently verifiable by the database'
  );

  select pg_catalog.jsonb_agg(
    case when c.value->>'id' = 'valid_dispositions' then
      pg_catalog.jsonb_build_object(
        'id', 'valid_dispositions',
        'passed', valid_dispositions,
        'details', pg_catalog.jsonb_build_object(
          'excluded_rows', (
            select count(*) from public.legacy_row_disposition where disposition = 'excluded'
          ),
          'migrated_rows', (
            select count(*) from public.legacy_row_disposition where disposition = 'migrated'
          ),
          'excluded_actor', 'legacy authenticated actors remain recorded; new exclusions record session_user in decision_actor'
        )
      )
    else c.value end
    order by c.ordinality
  ) into updated_checks
  from pg_catalog.jsonb_array_elements(result->'checks') with ordinality as c(value, ordinality);

  updated_checks := updated_checks || pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'id', 'shared_comparison_hash',
      'passed', shared_comparison,
      'details', comparison_details
    )
  );
  select coalesce(bool_and((c.value->>'passed')::boolean), false)
  into final_passed
  from pg_catalog.jsonb_array_elements(updated_checks) as c(value);
  result := pg_catalog.jsonb_set(result, '{checks}', updated_checks, true);
  result := pg_catalog.jsonb_set(
    result,
    '{passed}',
    pg_catalog.to_jsonb(final_passed),
    true
  );
  return result;
end
$$;

revoke all on function public.legacy_phase3_v2_report_base(),
  public.legacy_phase3_v2_report()
  from public, anon, authenticated, service_role;

create or replace function public.open_legacy_recovery(
  p_legacy_ids text[], p_reason text, p_ttl_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovery uuid := pg_catalog.gen_random_uuid();
  actor text;
  opened_at timestamptz := pg_catalog.clock_timestamp();
begin
  perform pg_catalog.pg_advisory_xact_lock(741140, 3);
  if p_legacy_ids is null or pg_catalog.cardinality(p_legacy_ids) not between 1 and 20
     or p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 10 and 500
     or p_ttl_minutes is null or p_ttl_minutes not between 1 and 60 then
    raise exception 'Ongeldige noodherstel-aanvraag' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.legacy_sync_phase3_state
    where singleton and closed_at is not null and recovery_disabled_at is null
  ) then
    raise exception 'Noodherstel is niet beschikbaar of is definitief uitgeschakeld'
      using errcode = '42501';
  end if;
  if exists (
    select 1 from public.legacy_recovery_allow
    where closed_at is null and expires_at > pg_catalog.clock_timestamp()
  ) then
    raise exception 'Sluit de bestaande noodherstelsessie eerst af' using errcode = '55000';
  end if;
  if pg_catalog.cardinality(p_legacy_ids) <> (
    select count(distinct requested.id)
    from pg_catalog.unnest(p_legacy_ids) as requested(id)
    join public.legacy_row_disposition l on l.legacy_id = requested.id
    join public.household_data d
      on public.legacy_disposition_id(d.id) = requested.id
    where l.disposition is not null
  ) then
    raise exception 'Noodherstel accepteert alleen vooraf bekende legacy-rijen'
      using errcode = '22023';
  end if;
  actor := coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), 'service_role');
  insert into public.legacy_recovery_allow
    (recovery_id, legacy_id, reason, opened_by, opened_at, expires_at)
  select recovery, requested.id, pg_catalog.btrim(p_reason), actor,
    opened_at,
    opened_at + pg_catalog.make_interval(mins => p_ttl_minutes)
  from (select distinct id from pg_catalog.unnest(p_legacy_ids) as x(id)) requested;
  insert into public.legacy_recovery_audit
    (recovery_id, action, actor, occurred_at, row_count, reason)
  values (recovery, 'opened', actor, pg_catalog.clock_timestamp(),
    pg_catalog.cardinality(p_legacy_ids), pg_catalog.btrim(p_reason));
  return recovery;
end
$$;

create or replace function public.read_legacy_row_recovery(p_recovery_id uuid)
returns table (legacy_id text, payload jsonb, payload_sha256 text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected integer;
  active_rows integer;
  valid_rows integer;
  actor text;
  read_started_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(741140, 3);
  perform 1
  from public.legacy_recovery_allow a
  where a.recovery_id = p_recovery_id
  for update;

  read_started_at := pg_catalog.clock_timestamp();
  select count(*),
    count(*) filter (
      where a.closed_at is null and a.expires_at > read_started_at
    )
  into expected, active_rows
  from public.legacy_recovery_allow a
  where a.recovery_id = p_recovery_id;

  if expected = 0 or active_rows <> expected then
    raise exception 'Noodherstel ontbreekt, is verlopen of is afgesloten'
      using errcode = '42501';
  end if;

  perform 1
  from public.legacy_recovery_allow a
  join public.legacy_row_disposition l on l.legacy_id = a.legacy_id
  join public.household_data d
    on public.legacy_disposition_id(d.id) = a.legacy_id
  where a.recovery_id = p_recovery_id
  for share of l, d;

  read_started_at := pg_catalog.clock_timestamp();
  select count(*) filter (
    where a.closed_at is null and a.expires_at > read_started_at
  )
  into active_rows
  from public.legacy_recovery_allow a
  where a.recovery_id = p_recovery_id;
  if active_rows <> expected then
    raise exception 'Noodherstel is verlopen of afgesloten'
      using errcode = '42501';
  end if;

  select count(*) into valid_rows
  from public.legacy_recovery_allow a
  join public.legacy_row_disposition l on l.legacy_id = a.legacy_id
  join public.household_data d
    on public.legacy_disposition_id(d.id) = a.legacy_id
  where a.recovery_id = p_recovery_id
    and l.disposition in ('migrated', 'excluded')
    and l.payload_sha256 ~ '^[0-9a-f]{64}$'
    and l.payload_sha256 = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(d.payload::text, 'UTF8')), 'hex'
    );

  if valid_rows <> expected then
    raise exception 'Een toegestane legacy-rij ontbreekt of wijkt af van de ledgerhash; noodherstel geweigerd'
      using errcode = '42501';
  end if;

  actor := coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), 'service_role');
  insert into public.legacy_recovery_audit
    (recovery_id, action, actor, occurred_at, row_count)
  values (p_recovery_id, 'read', actor, pg_catalog.clock_timestamp(), expected);

  return query
  select a.legacy_id, d.payload, l.payload_sha256
  from public.legacy_recovery_allow a
  join public.legacy_row_disposition l on l.legacy_id = a.legacy_id
  join public.household_data d
    on public.legacy_disposition_id(d.id) = a.legacy_id
  where a.recovery_id = p_recovery_id
    and a.closed_at is null
    and a.expires_at > read_started_at
    and l.disposition in ('migrated', 'excluded')
    and l.payload_sha256 = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(d.payload::text, 'UTF8')), 'hex'
    );
end
$$;

revoke all on function public.read_legacy_row_recovery(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.open_legacy_recovery(text[], text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.open_legacy_recovery(text[], text, integer),
  public.read_legacy_row_recovery(uuid)
  to service_role;
