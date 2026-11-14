-- Database-side request limits and least-privilege defaults for Samen Thuis.
-- The bucket is keyed by authenticated user and action, never by IP or request secret.

create table if not exists public.household_rpc_rate_limit_config (
  action text primary key check (action in ('create_household', 'join_household', 'import_legacy_household_data', 'put_household_state')),
  capacity numeric(12, 6) not null check (capacity >= 1),
  refill_tokens numeric(12, 6) not null check (refill_tokens > 0),
  refill_seconds integer not null check (refill_seconds > 0)
);

insert into public.household_rpc_rate_limit_config (action, capacity, refill_tokens, refill_seconds)
values
  ('create_household', 3, 1, 28800),
  ('join_household', 5, 1, 180),
  ('import_legacy_household_data', 5, 1, 180),
  ('put_household_state', 60, 1, 1)
on conflict (action) do update
set capacity = excluded.capacity,
    refill_tokens = excluded.refill_tokens,
    refill_seconds = excluded.refill_seconds;

create table if not exists public.household_rpc_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null references public.household_rpc_rate_limit_config(action) on delete cascade,
  tokens numeric(12, 6) not null check (tokens >= 0),
  updated_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (user_id, action)
);

create index if not exists household_rpc_rate_limits_expiry_idx
  on public.household_rpc_rate_limits (expires_at);

alter table public.household_rpc_rate_limit_config enable row level security;
alter table public.household_rpc_rate_limit_config force row level security;
alter table public.household_rpc_rate_limits enable row level security;
alter table public.household_rpc_rate_limits force row level security;

revoke all on public.household_rpc_rate_limit_config, public.household_rpc_rate_limits
  from public, anon, authenticated, service_role;

create or replace function public.consume_household_rpc_rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  limits public.household_rpc_rate_limit_config;
  bucket public.household_rpc_rate_limits;
  now_at timestamptz := clock_timestamp();
  remaining numeric(12, 6);
  allowed boolean;
begin
  if caller is null then
    return false;
  end if;

  select * into limits
    from public.household_rpc_rate_limit_config
    where action = p_action;
  if not found then
    raise exception 'Ongeldige rate-limitactie' using errcode = '22023';
  end if;

  loop
    insert into public.household_rpc_rate_limits (user_id, action, tokens, updated_at, expires_at)
    values (
      caller,
      p_action,
      limits.capacity,
      now_at,
      now_at + make_interval(secs => (limits.refill_seconds * limits.capacity / limits.refill_tokens)::double precision)
    )
    on conflict (user_id, action) do nothing;

    select * into bucket
      from public.household_rpc_rate_limits
      where user_id = caller and action = p_action
      for update;
    exit when found;
  end loop;

  now_at := clock_timestamp();
  remaining := least(
    limits.capacity,
    bucket.tokens
      + greatest(0::numeric, extract(epoch from (now_at - bucket.updated_at)))
        / limits.refill_seconds * limits.refill_tokens
  );
  allowed := remaining >= 1;
  if allowed then
    remaining := remaining - 1;
  end if;

  update public.household_rpc_rate_limits
  set tokens = remaining,
      updated_at = now_at,
      expires_at = now_at + make_interval(
        secs => ((limits.capacity - remaining) * limits.refill_seconds / limits.refill_tokens)::double precision
      )
  where user_id = caller and action = p_action;

  return allowed;
end
$$;

create or replace function public.cleanup_household_rpc_rate_limits(p_max_rows integer default 1000)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
  batch_size integer := least(10000, greatest(1, coalesce(p_max_rows, 1000)));
begin
  with expired as (
    select user_id, action
      from public.household_rpc_rate_limits
      where expires_at <= clock_timestamp()
      order by expires_at
      limit batch_size
      for update skip locked
  )
  delete from public.household_rpc_rate_limits limits
    using expired
    where limits.user_id = expired.user_id and limits.action = expired.action;

  get diagnostics deleted = row_count;
  return deleted;
end
$$;

-- A failed join must return normally so its bucket update commits. NULL covers both
-- invalid codes and exhausted limits, avoiding an existence/full-household oracle.
create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare found public.households;
begin
  if auth.uid() is null then
    raise exception 'Niet aangemeld' using errcode = '42501';
  end if;
  if not public.consume_household_rpc_rate_limit('join_household') then
    return null;
  end if;

  select * into found
    from public.households
    where join_code = upper(btrim(p_code));
  if found.id is null then
    return null;
  end if;

  begin
    insert into public.household_members (household_id, user_id, role)
    values (found.id, auth.uid(), 'member')
    on conflict do nothing;
  exception
    when raise_exception then
      return null;
  end;
  return found;
end
$$;

create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare created public.households;
begin
  if auth.uid() is null then
    raise exception 'Niet aangemeld' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Ongeldige naam' using errcode = '22023';
  end if;
  if not public.consume_household_rpc_rate_limit('create_household') then
    raise exception 'Te veel aanvragen; probeer later opnieuw' using errcode = 'P0001';
  end if;

  insert into public.households (name, created_by)
  values (btrim(p_name), auth.uid())
  returning * into created;
  insert into public.household_members (household_id, user_id, role)
  values (created.id, auth.uid(), 'owner');
  return created;
end
$$;

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
  if p_section is null or p_section !~ '^[A-Za-z0-9_.-]{1,60}$'
     or p_section in ('meta', 'settings', 'legacy_full', '__proto__', 'constructor', 'prototype') then
    raise exception 'Ongeldig onderdeel' using errcode = '22023';
  end if;
  if p_payload is null or p_expected_version is null or p_expected_version < 0
     or octet_length(p_payload::text) > 8000000 then
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
    return 1;
  end if;
  if current_version <> p_expected_version then
    raise exception 'Versieconflict' using errcode = '40001';
  end if;
  update public.household_state
  set payload = p_payload, version = current_version + 1,
      updated_by = auth.uid(), updated_at = now()
  where household_id = p_household and section = p_section;
  return current_version + 1;
end
$$;

create or replace function public.import_legacy_household_data(p_household uuid, p_legacy_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare legacy jsonb; claimed integer; inserted integer;
begin
  if auth.uid() is null or not public.is_household_member(p_household) then
    raise exception 'Geen toegang tot dit huishouden' using errcode = '42501';
  end if;
  if not public.consume_household_rpc_rate_limit('import_legacy_household_data') then
    raise exception 'Te veel aanvragen; probeer later opnieuw' using errcode = 'P0001';
  end if;
  if p_legacy_id is null or p_legacy_id !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select payload into legacy from public.household_data where id = p_legacy_id;
  if legacy is null then
    return false;
  end if;
  insert into public.household_legacy_imports (legacy_id, household_id, imported_by)
  values (p_legacy_id, p_household, auth.uid())
  on conflict do nothing;
  get diagnostics claimed = row_count;
  if claimed = 0 then
    return false; -- missing, already claimed, or claimed elsewhere are indistinguishable
  end if;

  insert into public.household_state (household_id, section, payload, updated_by)
  values (p_household, 'legacy_full', legacy, auth.uid())
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end
$$;

-- These functions intentionally remain SECURITY DEFINER; they enforce ownership
-- and membership before writing tables that have no direct user write grants.
alter function public.is_household_member(uuid) set search_path = '';
alter function public.is_household_admin(uuid) set search_path = '';
alter function public.household_profile_list() set search_path = '';
alter function public.finance_set_income(uuid, text, bigint) set search_path = '';
alter function public.finance_confirm_income(uuid, text, bigint) set search_path = '';
alter function public.finance_confirm_distribution(uuid, text, integer, integer, text, jsonb, text) set search_path = '';
alter function public.limit_household_members() set search_path = '';
alter function public.finance_block_update() set search_path = '';

-- Supabase's postgres-owned defaults grant API roles broad access to future public objects.
alter default privileges in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges
  revoke execute on functions from public;

-- Keep API schema lookup but prevent API roles from creating or owning objects.
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

-- Revoke table and column privileges together, then restore only the application paths.
revoke all on public.households, public.household_members,
  public.chalkboard_messages, public.household_state, public.household_legacy_imports,
  public.personal_preferences, public.finance_income_months, public.finance_income_history,
  public.finance_distributions
from public, anon, authenticated;

do $$
declare
  t record;
  c record;
  legacy_table regclass := to_regclass('public.household_data');
begin
  if legacy_table is not null then
    execute 'revoke all on table public.household_data from public, anon, authenticated';
  end if;

  for t in
    select n.nspname, r.relname
    from pg_class r
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public'
      and r.relname in (
        'household_data', 'households', 'household_members', 'chalkboard_messages',
        'household_state', 'household_legacy_imports', 'personal_preferences',
        'finance_income_months', 'finance_income_history', 'finance_distributions'
      )
      and r.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    for c in
      select a.attname
      from pg_attribute a
      where a.attrelid = format('%I.%I', t.nspname, t.relname)::regclass
        and a.attnum > 0 and not a.attisdropped
    loop
      execute format(
        'revoke all (%I) on table %I.%I from public, anon, authenticated',
        c.attname, t.nspname, t.relname
      );
    end loop;
  end loop;

  if legacy_table is not null then
    for c in
      select a.attname
      from pg_attribute a
      where a.attrelid = legacy_table and a.attnum > 0 and not a.attisdropped
    loop
      execute format(
        'revoke all (%I) on table public.household_data from public, anon, authenticated',
        c.attname
      );
    end loop;
    execute 'grant select, insert, update on public.household_data to anon';
  end if;
end
$$;

grant select on public.households, public.household_members, public.household_state to authenticated;
grant select, insert, delete on public.chalkboard_messages to authenticated;
grant select, insert, update on public.personal_preferences to authenticated;
grant select on public.finance_income_months, public.finance_income_history,
  public.finance_distributions to authenticated;

revoke all on all sequences in schema public from public, anon, authenticated;

revoke all on function public.create_household(text), public.join_household(text),
  public.is_household_member(uuid), public.is_household_admin(uuid),
  public.put_household_state(uuid, text, jsonb, bigint),
  public.import_legacy_household_data(uuid, text), public.household_profile_list(),
  public.finance_set_income(uuid, text, bigint),
  public.finance_confirm_income(uuid, text, bigint),
  public.finance_confirm_distribution(uuid, text, integer, integer, text, jsonb, text),
  public.limit_household_members(), public.finance_block_update(),
  public.consume_household_rpc_rate_limit(text),
  public.cleanup_household_rpc_rate_limits(integer)
from public, anon, authenticated, service_role;

grant execute on function public.create_household(text), public.join_household(text),
  public.is_household_member(uuid), public.is_household_admin(uuid),
  public.put_household_state(uuid, text, jsonb, bigint),
  public.import_legacy_household_data(uuid, text), public.household_profile_list(),
  public.finance_set_income(uuid, text, bigint),
  public.finance_confirm_income(uuid, text, bigint),
  public.finance_confirm_distribution(uuid, text, integer, integer, text, jsonb, text)
to authenticated;
