-- Handmatige rollback van uitsluitend de rate-limitlaag.
-- Dit herstelt de vorige RPC-antwoorden en schakelt rate-limiting uit.
-- De ingetrokken rechten, default privileges en lege search_path blijven bewust gehard.
-- Uitvoeren op lokale/staging alleen na expliciete beoordeling; nooit op productie.

create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare created public.households;
begin
  if auth.uid() is null then raise exception 'Niet aangemeld'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Ongeldige naam';
  end if;
  insert into public.households (name, created_by)
  values (btrim(p_name), auth.uid())
  returning * into created;
  insert into public.household_members (household_id, user_id, role)
  values (created.id, auth.uid(), 'owner');
  return created;
end
$$;

create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare found public.households;
begin
  if auth.uid() is null then raise exception 'Niet aangemeld'; end if;
  select * into found
  from public.households
  where join_code = upper(btrim(p_code));
  if found.id is null then raise exception 'Onbekende huishoudcode'; end if;
  insert into public.household_members (household_id, user_id, role)
  values (found.id, auth.uid(), 'member')
  on conflict do nothing;
  return found;
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
  select version into current_version
  from public.household_state
  where household_id = p_household and section = p_section
  for update;
  if current_version is null then
    if p_expected_version <> 0 then raise exception 'Versieconflict' using errcode = '40001'; end if;
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
  if p_legacy_id is null or p_legacy_id !~ '^[0-9a-f]{64}$' then
    raise exception 'Ongeldig oud huishoud-ID' using errcode = '22023';
  end if;
  select payload into legacy from public.household_data where id = p_legacy_id;
  if legacy is null then return false; end if;
  insert into public.household_legacy_imports (legacy_id, household_id, imported_by)
  values (p_legacy_id, p_household, auth.uid())
  on conflict do nothing;
  get diagnostics claimed = row_count;
  if claimed = 0 then
    if exists (
      select 1 from public.household_legacy_imports
      where legacy_id = p_legacy_id and household_id <> p_household
    ) then
      raise exception 'Deze oude gegevens zijn al aan een ander huishouden gekoppeld' using errcode = '42501';
    end if;
    return false;
  end if;
  insert into public.household_state (household_id, section, payload, updated_by)
  values (p_household, 'legacy_full', legacy, auth.uid())
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end
$$;

drop function public.consume_household_rpc_rate_limit(text);
drop function public.cleanup_household_rpc_rate_limits(integer);
drop table public.household_rpc_rate_limits;
drop table public.household_rpc_rate_limit_config;
