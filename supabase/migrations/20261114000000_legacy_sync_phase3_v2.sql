-- Phase 3 v2: account for every legacy row, prove account-sync activity,
-- then close the legacy API route atomically. This migration does not close it.

alter table public.household_legacy_imports
  add column if not exists payload_sha256 text
    check (payload_sha256 is null or payload_sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists initial_import_version bigint
    check (initial_import_version is null or initial_import_version > 0);

create table if not exists public.legacy_row_disposition (
  legacy_id text primary key check (legacy_id ~ '^(?:[0-9a-f]{64}|sha256:[0-9a-f]{64})$'),
  disposition text,
  household_id uuid references public.households(id) on delete restrict,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete restrict,
  exclusion_reason text,
  payload_sha256 text,
  initial_import_version bigint,
  audit_version smallint not null default 1 check (audit_version = 1),
  check (disposition is null or disposition in ('migrated', 'excluded')),
  check (payload_sha256 is null or payload_sha256 ~ '^[0-9a-f]{64}$'),
  check (
    (disposition is null and household_id is null and decided_at is null
      and decided_by is null and exclusion_reason is null
      and payload_sha256 is null and initial_import_version is null)
    or (disposition = 'migrated' and household_id is not null
      and decided_at is not null and decided_by is not null
      and exclusion_reason is null and payload_sha256 is not null
      and payload_sha256 ~ '^[0-9a-f]{64}$'
      and initial_import_version is not null and initial_import_version > 0)
    or (disposition = 'excluded' and household_id is null
      and decided_at is not null and decided_by is not null
      and exclusion_reason is not null
      and char_length(btrim(exclusion_reason)) between 10 and 500
      and payload_sha256 is not null and payload_sha256 ~ '^[0-9a-f]{64}$'
      and initial_import_version is null)
  )
);

create or replace function public.legacy_disposition_id(p_source_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_source_id ~ '^[0-9a-f]{64}$' then p_source_id
    else 'sha256:' || pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(p_source_id, 'UTF8')), 'hex'
    )
  end
$$;

revoke all on function public.legacy_disposition_id(text) from public, anon, authenticated, service_role;

create table if not exists public.household_state_write_audit (
  household_id uuid not null references public.households(id) on delete cascade,
  section text not null,
  version bigint not null check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  written_at timestamptz not null,
  primary key (household_id, section, version)
);

create table if not exists public.legacy_local_verifications (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  comparison_id uuid not null,
  report_sha256 text not null check (report_sha256 ~ '^[0-9a-f]{64}$'),
  conflicts_resolved boolean not null,
  verified_at timestamptz not null,
  primary key (household_id, user_id)
);

create table if not exists public.legacy_sync_phase3_state (
  singleton boolean primary key default true check (singleton),
  closed_at timestamptz,
  closed_by text,
  check ((closed_at is null) = (closed_by is null))
);

insert into public.legacy_sync_phase3_state (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.legacy_recovery_allow (
  recovery_id uuid not null,
  legacy_id text not null references public.legacy_row_disposition(legacy_id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  opened_by text not null,
  opened_at timestamptz not null,
  expires_at timestamptz not null,
  closed_at timestamptz,
  closed_by text,
  primary key (recovery_id, legacy_id),
  check (expires_at > opened_at),
  check ((closed_at is null) = (closed_by is null))
);

create table if not exists public.legacy_recovery_audit (
  recovery_id uuid not null,
  action text not null check (action in ('opened', 'read', 'closed')),
  actor text not null,
  occurred_at timestamptz not null,
  row_count integer not null check (row_count >= 0),
  reason text
);

alter table public.legacy_row_disposition enable row level security;
alter table public.legacy_row_disposition force row level security;
alter table public.household_state_write_audit enable row level security;
alter table public.household_state_write_audit force row level security;
alter table public.legacy_local_verifications enable row level security;
alter table public.legacy_local_verifications force row level security;
alter table public.legacy_sync_phase3_state enable row level security;
alter table public.legacy_sync_phase3_state force row level security;
alter table public.legacy_recovery_allow enable row level security;
alter table public.legacy_recovery_allow force row level security;
alter table public.legacy_recovery_audit enable row level security;
alter table public.legacy_recovery_audit force row level security;

revoke all on public.legacy_row_disposition, public.household_state_write_audit,
  public.legacy_local_verifications, public.legacy_sync_phase3_state,
  public.legacy_recovery_allow, public.legacy_recovery_audit
from public, anon, authenticated, service_role;

-- Existing imported rows are accepted only when the still-available source
-- exactly matches the opaque copy in household_state. Otherwise they stay open.
do $$
begin
  if to_regclass('public.household_data') is not null then
    insert into public.legacy_row_disposition (legacy_id)
    select public.legacy_disposition_id(id) from public.household_data
    on conflict (legacy_id) do nothing;

    update public.household_legacy_imports i
    set payload_sha256 = pg_catalog.encode(
          pg_catalog.sha256(pg_catalog.convert_to(d.payload::text, 'UTF8')), 'hex'
        ),
        initial_import_version = s.version
    from public.household_data d, public.household_state s
    where d.id = i.legacy_id
      and s.household_id = i.household_id
      and s.section = 'legacy_full'
      and s.payload = d.payload
      and i.payload_sha256 is null
      and i.imported_by is not null
      and s.version > 0
      and s.updated_by = i.imported_by;

    insert into public.legacy_row_disposition (
      legacy_id, disposition, household_id, decided_at, decided_by,
      payload_sha256, initial_import_version
    )
    select i.legacy_id, 'migrated', i.household_id, i.imported_at, i.imported_by,
      i.payload_sha256, i.initial_import_version
    from public.household_legacy_imports i
    where i.payload_sha256 ~ '^[0-9a-f]{64}$'
      and i.initial_import_version > 0
      and i.imported_by is not null
    on conflict (legacy_id) do nothing;
  end if;
end
$$;

create or replace function public.guard_household_data_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(741140, 3);
  if exists (
    select 1 from public.legacy_sync_phase3_state where singleton and closed_at is not null
  ) then
    raise exception 'Legacy synchronisatie is definitief afgesloten' using errcode = '42501';
  end if;
  insert into public.legacy_row_disposition (legacy_id)
  values (public.legacy_disposition_id(new.id))
  on conflict (legacy_id) do nothing;
  return new;
end
$$;

revoke all on function public.guard_household_data_write() from public, anon, authenticated, service_role;

do $$
declare legacy_table regclass := to_regclass('public.household_data');
begin
  if legacy_table is not null
     and not exists (
       select 1 from pg_trigger
       where tgrelid = legacy_table
         and tgname = 'household_data_disposition_guard'
         and not tgisinternal
     ) then
    create trigger household_data_disposition_guard
      before insert or update on public.household_data
      for each row execute function public.guard_household_data_write();
  end if;
end
$$;

create or replace function public.protect_legacy_row_disposition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Legacy-disposities zijn onveranderlijk' using errcode = '42501';
  end if;
  if old.disposition is not null then
    raise exception 'Een definitieve legacy-dispositie kan niet worden gewijzigd' using errcode = '42501';
  end if;
  if new.legacy_id is distinct from old.legacy_id or old.audit_version <> new.audit_version then
    raise exception 'Legacy-dispositie-auditvelden zijn onveranderlijk' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger legacy_row_disposition_immutable
  before update or delete on public.legacy_row_disposition
  for each row execute function public.protect_legacy_row_disposition();

revoke all on function public.protect_legacy_row_disposition() from public, anon, authenticated, service_role;

create or replace function public.put_household_state(
  p_household uuid, p_section text, p_payload jsonb, p_expected_version bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare current_version bigint;
begin
  if auth.uid() is null or not public.is_household_member(p_household) then
    raise exception 'Geen toegang tot dit huishouden' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(741140, 3);
  if p_section is null or p_section !~ '^[A-Za-z0-9_.-]{1,60}$'
     or p_section in ('meta', 'settings', 'legacy_full', '__proto__', 'constructor', 'prototype') then
    raise exception 'Ongeldig onderdeel' using errcode = '22023';
  end if;
  if p_payload is null or p_expected_version is null or p_expected_version < 0
     or pg_catalog.octet_length(p_payload::text) > 8000000 then
    raise exception 'Ongeldige gegevens' using errcode = '22023';
  end if;
  if not public.consume_household_rpc_rate_limit('put_household_state') then
    raise exception 'Te veel aanvragen; probeer later opnieuw' using errcode = 'P0001';
  end if;

  select version into current_version from public.household_state
    where household_id = p_household and section = p_section for update;
  if current_version is null then
    if p_expected_version <> 0 then
      raise exception 'Versieconflict' using errcode = '40001';
    end if;
    begin
      insert into public.household_state (household_id, section, payload, updated_by)
      values (p_household, p_section, p_payload, auth.uid());
    exception when unique_violation then
      raise exception 'Versieconflict' using errcode = '40001';
    end;
    insert into public.household_state_write_audit
      (household_id, section, version, updated_by, written_at)
    values (p_household, p_section, 1, auth.uid(), pg_catalog.clock_timestamp());
    return 1;
  end if;
  if current_version <> p_expected_version then
    raise exception 'Versieconflict' using errcode = '40001';
  end if;
  update public.household_state
  set payload = p_payload, version = current_version + 1,
      updated_by = auth.uid(), updated_at = pg_catalog.clock_timestamp()
  where household_id = p_household and section = p_section;
  insert into public.household_state_write_audit
    (household_id, section, version, updated_by, written_at)
  values (p_household, p_section, current_version + 1, auth.uid(), pg_catalog.clock_timestamp());
  return current_version + 1;
end
$$;

create or replace function public.import_legacy_household_data(p_household uuid, p_legacy_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  legacy jsonb;
  payload_hash text;
  claimed integer;
  inserted integer;
  recorded integer;
begin
  if auth.uid() is null or not public.is_household_member(p_household) then
    raise exception 'Geen toegang tot dit huishouden' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(741140, 3);
  if exists (
    select 1 from public.legacy_sync_phase3_state where singleton and closed_at is not null
  ) then
    return false;
  end if;
  if not public.consume_household_rpc_rate_limit('import_legacy_household_data') then
    raise exception 'Te veel aanvragen; probeer later opnieuw' using errcode = 'P0001';
  end if;
  if p_legacy_id is null or p_legacy_id !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select payload into legacy
  from public.household_data
  where id = p_legacy_id
  for update;
  if not found then
    return false;
  end if;
  if exists (
    select 1 from public.legacy_row_disposition
    where legacy_id = p_legacy_id and disposition is not null
  ) or exists (
    select 1 from public.household_state
    where household_id = p_household and section = 'legacy_full'
  ) then
    return false;
  end if;

  payload_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(legacy::text, 'UTF8')), 'hex'
  );
  insert into public.legacy_row_disposition (legacy_id)
  values (p_legacy_id)
  on conflict (legacy_id) do nothing;

  insert into public.household_legacy_imports
    (legacy_id, household_id, imported_by, payload_sha256, initial_import_version)
  values (p_legacy_id, p_household, auth.uid(), payload_hash, 1)
  on conflict (legacy_id) do nothing;
  get diagnostics claimed = row_count;
  if claimed = 0 then
    return false;
  end if;

  insert into public.household_state (household_id, section, payload, updated_by)
  values (p_household, 'legacy_full', legacy, auth.uid())
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted <> 1 then
    raise exception 'Legacy-import en state kwamen niet overeen' using errcode = '40001';
  end if;

  update public.legacy_row_disposition
  set disposition = 'migrated',
      household_id = p_household,
      decided_at = pg_catalog.clock_timestamp(),
      decided_by = auth.uid(),
      payload_sha256 = payload_hash,
      initial_import_version = 1
  where legacy_id = p_legacy_id and disposition is null;
  get diagnostics recorded = row_count;
  if recorded <> 1 then
    raise exception 'Legacy-ledgerregistratie is niet gelukt' using errcode = '40001';
  end if;
  return true;
end
$$;

create or replace function public.exclude_legacy_household_row(
  p_legacy_id text, p_reason text, p_decided_by uuid
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
    select 1 from public.legacy_sync_phase3_state where singleton and closed_at is not null
  ) then
    raise exception 'Legacy-synchronisatie is definitief afgesloten';
  end if;
  if p_legacy_id is null or pg_catalog.char_length(p_legacy_id) not between 1 and 4096
     or p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 10 and 500
     or p_decided_by is null or not exists (select 1 from auth.users where id = p_decided_by) then
    raise exception 'Ongeldige uitsluitingsregistratie' using errcode = '22023';
  end if;
  select payload into legacy from public.household_data where id = p_legacy_id for update;
  if not found then
    raise exception 'Legacy-rij bestaat niet' using errcode = '22023';
  end if;
  insert into public.legacy_row_disposition (legacy_id)
  values (public.legacy_disposition_id(p_legacy_id))
  on conflict (legacy_id) do nothing;
  update public.legacy_row_disposition
  set disposition = 'excluded',
      decided_at = pg_catalog.clock_timestamp(),
      decided_by = p_decided_by,
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

create or replace function public.submit_legacy_local_verification(
  p_household uuid, p_comparison_id uuid, p_report_sha256 text, p_conflicts_resolved boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_household_member(p_household) then
    raise exception 'Geen toegang tot dit huishouden' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(741140, 3);
  if exists (
    select 1 from public.legacy_sync_phase3_state where singleton and closed_at is not null
  ) then
    raise exception 'Lokale verificatie is al afgesloten' using errcode = '42501';
  end if;
  if p_comparison_id is null or p_report_sha256 is null
     or p_report_sha256 !~ '^[0-9a-f]{64}$' or p_conflicts_resolved is null then
    raise exception 'Ongeldig lokaal migratierapport' using errcode = '22023';
  end if;
  insert into public.legacy_local_verifications
    (household_id, user_id, comparison_id, report_sha256, conflicts_resolved, verified_at)
  values
    (p_household, auth.uid(), p_comparison_id, p_report_sha256,
      p_conflicts_resolved, pg_catalog.clock_timestamp())
  on conflict (household_id, user_id) do update
  set comparison_id = excluded.comparison_id,
      report_sha256 = excluded.report_sha256,
      conflicts_resolved = excluded.conflicts_resolved,
      verified_at = excluded.verified_at;
  return true;
end
$$;

create or replace function public.legacy_phase3_v2_report()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  with checks as (
    select 'ledger_coverage'::text as id,
      not exists (
        select 1
        from public.household_data d
        left join public.legacy_row_disposition l
          on l.legacy_id = public.legacy_disposition_id(d.id)
        where l.legacy_id is null or l.disposition is null
      ) and not exists (
        select 1 from public.legacy_row_disposition where disposition is null
      ) as passed,
      jsonb_build_object(
        'source_rows', (select count(*) from public.household_data),
        'unresolved_rows', (
          select count(*) from public.legacy_row_disposition where disposition is null
        ),
        'unledgered_rows', (
          select count(*) from public.household_data d
          left join public.legacy_row_disposition l
            on l.legacy_id = public.legacy_disposition_id(d.id)
          where l.legacy_id is null
        )
      ) as details
    union all
    select 'valid_dispositions',
      not exists (
        select 1 from public.legacy_row_disposition
        where (disposition not in ('migrated', 'excluded'))
           or (disposition = 'excluded' and
             (exclusion_reason is null
              or char_length(btrim(exclusion_reason)) not between 10 and 500
              or decided_by is null or decided_at is null
              or payload_sha256 is null or payload_sha256 !~ '^[0-9a-f]{64}$'))
           or (disposition = 'migrated' and
             (household_id is null or decided_by is null or decided_at is null
              or payload_sha256 is null or payload_sha256 !~ '^[0-9a-f]{64}$'
              or initial_import_version is null or initial_import_version < 1))
      ),
      jsonb_build_object(
        'excluded_rows', (select count(*) from public.legacy_row_disposition where disposition = 'excluded'),
        'migrated_rows', (select count(*) from public.legacy_row_disposition where disposition = 'migrated')
      )
    union all
    select 'inventory_present',
      exists (select 1 from public.legacy_row_disposition),
      jsonb_build_object(
        'ledger_rows', (select count(*) from public.legacy_row_disposition)
      )
    union all
    select 'import_consistency',
      not exists (
        select 1
        from public.household_legacy_imports i
        left join public.legacy_row_disposition l
          on l.legacy_id = public.legacy_disposition_id(i.legacy_id)
        left join public.household_state s
          on s.household_id = i.household_id and s.section = 'legacy_full'
        where l.disposition is distinct from 'migrated'
           or l.household_id is distinct from i.household_id
           or l.decided_by is distinct from i.imported_by
           or l.payload_sha256 is distinct from i.payload_sha256
           or l.initial_import_version is distinct from i.initial_import_version
           or i.imported_by is null
           or i.payload_sha256 !~ '^[0-9a-f]{64}$'
           or i.initial_import_version is null
           or s.household_id is null
           or s.version is distinct from i.initial_import_version
           or s.updated_by is distinct from i.imported_by
           or pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(s.payload::text, 'UTF8')), 'hex')
                is distinct from i.payload_sha256
      ) and not exists (
        select 1 from public.legacy_row_disposition l
        where l.disposition = 'migrated'
          and not exists (
            select 1 from public.household_legacy_imports i
            where i.legacy_id = l.legacy_id and i.household_id = l.household_id
          )
      ) and not exists (
        select 1
        from public.household_state s
        where s.section = 'legacy_full'
          and not exists (
            select 1
            from public.household_legacy_imports i
            where i.household_id = s.household_id
              and i.initial_import_version = s.version
              and i.imported_by = s.updated_by
          )
      ) and not exists (
        select 1 from public.household_legacy_imports
        group by household_id having count(*) > 1
      ),
      jsonb_build_object(
        'import_rows', (select count(*) from public.household_legacy_imports),
        'invalid_imports', (
          select count(*) from public.household_legacy_imports i
          left join public.legacy_row_disposition l
            on l.legacy_id = public.legacy_disposition_id(i.legacy_id)
          left join public.household_state s
            on s.household_id = i.household_id and s.section = 'legacy_full'
          where l.disposition is distinct from 'migrated'
             or l.household_id is distinct from i.household_id
             or l.decided_by is distinct from i.imported_by
             or l.payload_sha256 is distinct from i.payload_sha256
             or i.imported_by is null
             or i.payload_sha256 !~ '^[0-9a-f]{64}$'
             or s.household_id is null
             or pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(s.payload::text, 'UTF8')), 'hex')
                  is distinct from i.payload_sha256
        )
      )
    union all
    select 'payload_integrity',
      not exists (
        select 1 from public.legacy_row_disposition l
        join public.household_data d
          on public.legacy_disposition_id(d.id) = l.legacy_id
        where l.disposition is not null
          and (l.payload_sha256 !~ '^[0-9a-f]{64}$'
            or l.payload_sha256 is distinct from
              pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(d.payload::text, 'UTF8')), 'hex'))
      ) and not exists (
        select 1 from public.legacy_row_disposition
        where disposition is not null and payload_sha256 !~ '^[0-9a-f]{64}$'
      ),
      jsonb_build_object(
        'final_rows_without_hash', (
          select count(*) from public.legacy_row_disposition
          where disposition is not null and payload_sha256 !~ '^[0-9a-f]{64}$'
        ),
        'source_hash_mismatches', (
          select count(*) from public.legacy_row_disposition l
          join public.household_data d
            on public.legacy_disposition_id(d.id) = l.legacy_id
          where l.disposition is not null
            and l.payload_sha256 is distinct from
              pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(d.payload::text, 'UTF8')), 'hex')
        )
      )
    union all
    select 'two_active_members',
      not exists (
        select 1
        from (
          select distinct household_id
          from public.legacy_row_disposition where disposition = 'migrated'
        ) h
        left join lateral (
          select count(*) as member_count,
            count(distinct m.user_id) as distinct_users,
            count(*) filter (where m.role = 'owner') as owners,
            count(*) filter (where m.role in ('member', 'admin')) as other_members
          from public.household_members m where m.household_id = h.household_id
        ) m on true
        where not exists (select 1 from public.households x where x.id = h.household_id)
           or m.member_count <> 2 or m.distinct_users <> 2
           or m.owners <> 1 or m.other_members <> 1
      ),
      jsonb_build_object(
        'migrated_households', (
          select count(distinct household_id)
          from public.legacy_row_disposition where disposition = 'migrated'
        )
      )
    union all
    select 'both_members_wrote',
      not exists (
        select 1
        from (
          select distinct household_id
          from public.legacy_row_disposition where disposition = 'migrated'
        ) h
        where (
          select count(distinct a.updated_by)
          from public.household_state_write_audit a
          join public.household_members m
            on m.household_id = a.household_id and m.user_id = a.updated_by
          where a.household_id = h.household_id
            and a.section <> 'legacy_full'
            and exists (
              select 1 from public.legacy_row_disposition l
              where l.household_id = h.household_id and l.disposition = 'migrated'
                and a.version > l.initial_import_version
            )
        ) <> 2
      ),
      jsonb_build_object(
        'server_audit', true,
        'qualifying_section', 'not legacy_full',
        'version_rule', 'write version must exceed the recorded initial import version'
      )
    union all
    select 'local_verification',
      not exists (
        select 1
        from (
          select distinct household_id
          from public.legacy_row_disposition where disposition = 'migrated'
        ) h
        where (select count(*) from public.household_members m
          join public.legacy_local_verifications v
            on v.household_id = m.household_id and v.user_id = m.user_id
          where m.household_id = h.household_id
            and v.conflicts_resolved
            and v.report_sha256 ~ '^[0-9a-f]{64}$') <> 2
          or (select count(distinct v.comparison_id)
          from public.legacy_local_verifications v
          where v.household_id = h.household_id) <> 1
          or exists (
            select 1 from public.legacy_local_verifications v
            where v.household_id = h.household_id
              and not exists (
                select 1 from public.household_members m
                where m.household_id = v.household_id and m.user_id = v.user_id
              )
          )
      ),
      jsonb_build_object(
        'required', 'PR E local reports from both active members with one shared comparison id',
        'plaintext_equality', 'not independently verifiable by the database'
      )
    union all
    select 'no_open_recovery',
      not exists (
        select 1 from public.legacy_recovery_allow
        where closed_at is null and expires_at > pg_catalog.clock_timestamp()
      ),
      jsonb_build_object(
        'active_recovery_rows', (
          select count(*) from public.legacy_recovery_allow
          where closed_at is null and expires_at > pg_catalog.clock_timestamp()
        )
      )
    union all
    select 'no_alternate_user_path',
      not exists (
        select 1
        from pg_catalog.pg_rewrite r
        join pg_catalog.pg_class v on v.oid = r.ev_class
        join pg_catalog.pg_depend d on d.classid = 'pg_catalog.pg_rewrite'::regclass
          and d.objid = r.oid and d.refclassid = 'pg_catalog.pg_class'::regclass
          and d.refobjid = 'public.household_data'::regclass
        where v.relkind in ('v', 'm')
          and (has_table_privilege('anon', v.oid, 'SELECT')
            or has_table_privilege('authenticated', v.oid, 'SELECT'))
      ) and not exists (
        select 1 from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where p.prosrc ilike '%household_data%'
          and p.oid not in (
            'public.import_legacy_household_data(uuid,text)'::regprocedure
          )
          and (has_function_privilege('anon', p.oid, 'EXEC' || 'UTE')
            or has_function_privilege('authenticated', p.oid, 'EXEC' || 'UTE'))
      ),
      jsonb_build_object(
        'visible_views', (
          select count(*)
          from pg_catalog.pg_rewrite r
          join pg_catalog.pg_class v on v.oid = r.ev_class
          join pg_catalog.pg_depend d on d.classid = 'pg_catalog.pg_rewrite'::regclass
            and d.objid = r.oid and d.refclassid = 'pg_catalog.pg_class'::regclass
            and d.refobjid = 'public.household_data'::regclass
          where v.relkind in ('v', 'm')
            and (has_table_privilege('anon', v.oid, 'SELECT')
              or has_table_privilege('authenticated', v.oid, 'SELECT'))
        )
      )
  )
  select jsonb_build_object(
    'phase', 'legacy-sync-phase3-v2',
    'passed', coalesce(bool_and(passed), false),
    'checks', jsonb_agg(jsonb_build_object('id', id, 'passed', passed, 'details', details) order by id),
    'database_limit', 'Encrypted plaintext equality is outside database observability; both local reports are required attestations.'
  )
  into result
  from checks;
  return result;
end
$$;

create or replace function public.check_legacy_sync_phase3_v2()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.legacy_phase3_v2_report()
$$;

create or replace function public.close_legacy_sync_phase3_v2()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(741140, 3);
  result := public.legacy_phase3_v2_report();
  if not coalesce((result ->> 'passed')::boolean, false) then
    raise exception 'Phase 3 v2 geweigerd: %', result using errcode = 'P0001';
  end if;

  update public.legacy_sync_phase3_state
  set closed_at = pg_catalog.clock_timestamp(), closed_by = session_user
  where singleton and closed_at is null;

  revoke all on public.household_data from public, anon, authenticated, service_role;
  revoke all (id, payload, updated_at) on public.household_data from public, anon, authenticated, service_role;
  drop policy if exists "encrypted household read" on public.household_data;
  drop policy if exists "encrypted household insert" on public.household_data;
  drop policy if exists "encrypted household update" on public.household_data;

  if has_table_privilege('anon', 'public.household_data', 'SELECT')
     or has_table_privilege('anon', 'public.household_data', 'INSERT')
     or has_table_privilege('anon', 'public.household_data', 'UPDATE')
     or has_table_privilege('anon', 'public.household_data', 'DELETE')
     or has_table_privilege('anon', 'public.household_data', 'TRUNCATE')
     or has_table_privilege('anon', 'public.household_data', 'REFERENCES')
     or has_table_privilege('anon', 'public.household_data', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.household_data', 'SELECT')
     or has_table_privilege('authenticated', 'public.household_data', 'INSERT')
     or has_table_privilege('authenticated', 'public.household_data', 'UPDATE')
     or has_table_privilege('authenticated', 'public.household_data', 'DELETE')
     or has_table_privilege('authenticated', 'public.household_data', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.household_data', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.household_data', 'TRIGGER')
     or has_table_privilege('service_role', 'public.household_data', 'SELECT')
     or has_table_privilege('service_role', 'public.household_data', 'INSERT')
     or has_table_privilege('service_role', 'public.household_data', 'UPDATE')
     or has_table_privilege('service_role', 'public.household_data', 'DELETE')
     or has_table_privilege('service_role', 'public.household_data', 'TRUNCATE')
     or exists (
       select 1 from pg_catalog.pg_attribute a
       where a.attrelid = 'public.household_data'::regclass
         and a.attnum > 0 and not a.attisdropped
         and (
           has_column_privilege('anon', a.attrelid, a.attname, 'SELECT')
           or has_column_privilege('anon', a.attrelid, a.attname, 'INSERT')
           or has_column_privilege('anon', a.attrelid, a.attname, 'UPDATE')
           or has_column_privilege('anon', a.attrelid, a.attname, 'REFERENCES')
           or has_column_privilege('authenticated', a.attrelid, a.attname, 'SELECT')
           or has_column_privilege('authenticated', a.attrelid, a.attname, 'INSERT')
           or has_column_privilege('authenticated', a.attrelid, a.attname, 'UPDATE')
           or has_column_privilege('authenticated', a.attrelid, a.attname, 'REFERENCES')
           or has_column_privilege('service_role', a.attrelid, a.attname, 'SELECT')
           or has_column_privilege('service_role', a.attrelid, a.attname, 'INSERT')
           or has_column_privilege('service_role', a.attrelid, a.attname, 'UPDATE')
           or has_column_privilege('service_role', a.attrelid, a.attname, 'REFERENCES')
         )
     )
     or exists (select 1 from pg_catalog.pg_policy where polrelid = 'public.household_data'::regclass) then
    raise exception 'Phase 3 v2 geweigerd: legacy-rechten of policies konden niet volledig worden ingetrokken';
  end if;
  revoke all on function public.import_legacy_household_data(uuid, text)
    from public, anon, authenticated, service_role;
  if has_function_privilege('anon', 'public.import_legacy_household_data(uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.import_legacy_household_data(uuid,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.import_legacy_household_data(uuid,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.read_legacy_row_recovery(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.read_legacy_row_recovery(uuid)', 'EXECUTE') then
    raise exception 'Phase 3 v2 geweigerd: een legacy-import- of leesfunctie blijft beschikbaar';
  end if;
  return result || jsonb_build_object('closed', true);
end
$$;

create or replace function public.open_legacy_recovery(
  p_legacy_ids text[], p_reason text, p_ttl_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare recovery uuid := pg_catalog.gen_random_uuid(); actor text;
begin
  perform pg_catalog.pg_advisory_xact_lock(741140, 3);
  if p_legacy_ids is null or pg_catalog.cardinality(p_legacy_ids) not between 1 and 20
     or p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 10 and 500
     or p_ttl_minutes is null or p_ttl_minutes not between 1 and 60 then
    raise exception 'Ongeldige noodherstel-aanvraag' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.legacy_sync_phase3_state where singleton and closed_at is not null
  ) then
    raise exception 'Noodherstel is alleen beschikbaar na Phase 3 v2' using errcode = '42501';
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
    raise exception 'Noodherstel accepteert alleen vooraf bekende legacy-rijen' using errcode = '22023';
  end if;
  actor := coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), 'service_role');
  insert into public.legacy_recovery_allow
    (recovery_id, legacy_id, reason, opened_by, opened_at, expires_at)
  select recovery, requested.id, pg_catalog.btrim(p_reason), actor,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp() + pg_catalog.make_interval(mins => p_ttl_minutes)
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
declare expected integer; actor text;
begin
  perform 1
  from public.legacy_recovery_allow a
  where a.recovery_id = p_recovery_id
    and a.closed_at is null and a.expires_at > pg_catalog.clock_timestamp()
  for update;
  get diagnostics expected = row_count;
  if expected = 0 then
    raise exception 'Noodherstel ontbreekt, is verlopen of is afgesloten' using errcode = '42501';
  end if;
  actor := coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), 'service_role');
  insert into public.legacy_recovery_audit
    (recovery_id, action, actor, occurred_at, row_count)
  values (p_recovery_id, 'read', actor, pg_catalog.clock_timestamp(), expected);
  return query
  select a.legacy_id, d.payload,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(d.payload::text, 'UTF8')), 'hex')
  from public.legacy_recovery_allow a
  join public.household_data d
    on public.legacy_disposition_id(d.id) = a.legacy_id
  where a.recovery_id = p_recovery_id
    and a.closed_at is null and a.expires_at > pg_catalog.clock_timestamp();
  if not found then
    raise exception 'Toegestane legacy-rij ontbreekt; noodherstel geweigerd' using errcode = '42501';
  end if;
end
$$;

create or replace function public.close_legacy_recovery(p_recovery_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor text; affected integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(741140, 3);
  actor := coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), 'service_role');
  update public.legacy_recovery_allow
  set closed_at = pg_catalog.clock_timestamp(), closed_by = actor
  where recovery_id = p_recovery_id and closed_at is null;
  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'Noodherstelsessie ontbreekt of is al afgesloten' using errcode = '22023';
  end if;
  insert into public.legacy_recovery_audit
    (recovery_id, action, actor, occurred_at, row_count)
  values (p_recovery_id, 'closed', actor, pg_catalog.clock_timestamp(), affected);
  return true;
end
$$;

revoke all on function public.put_household_state(uuid, text, jsonb, bigint),
  public.import_legacy_household_data(uuid, text),
  public.exclude_legacy_household_row(text, text, uuid),
  public.submit_legacy_local_verification(uuid, uuid, text, boolean),
  public.legacy_phase3_v2_report(),
  public.check_legacy_sync_phase3_v2(),
  public.close_legacy_sync_phase3_v2(),
  public.open_legacy_recovery(text[], text, integer),
  public.read_legacy_row_recovery(uuid),
  public.close_legacy_recovery(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.put_household_state(uuid, text, jsonb, bigint),
  public.import_legacy_household_data(uuid, text),
  public.submit_legacy_local_verification(uuid, uuid, text, boolean)
to authenticated;
grant execute on function public.open_legacy_recovery(text[], text, integer),
  public.read_legacy_row_recovery(uuid),
  public.close_legacy_recovery(uuid)
to service_role;

-- On production the legacy table exists before migrations; local staging creates
-- it in the seed, which installs the same trigger in schema.sql.
do $$
begin
  if to_regclass('public.household_data') is not null then
    revoke all on public.household_data from service_role;
    revoke all (id, payload, updated_at) on public.household_data
      from service_role;
  end if;
end
$$;
