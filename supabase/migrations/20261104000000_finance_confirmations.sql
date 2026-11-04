-- Financieel systeem: maandelijkse inkomensbevestiging per persoon en definitieve, onveranderlijke maandverdelingen.
-- Additief en herhaalbaar (if not exists / create or replace). Raakt bestaande tabellen en gegevens niet aan,
-- behalve het toevoegen van één kolom aan personal_preferences. Volgorde: na 20261103 personal_profiles.
-- Gezamenlijke instellingen (percentage, potjes, terugkerende uitgaven) blijven in de bestaande, gesynchroniseerde
-- huishoudstate (budgetV23). Hier staat alleen wat door de database afgedwongen moet worden: wie wat bevestigt en
-- dat een verdeling precies één keer wordt vastgelegd.

alter table public.personal_preferences
  add column if not exists finance_config jsonb not null default '{}'::jsonb;
-- Privé-potjes en privé-uitgaven staan alleen in deze eigen rij (bestaande RLS: alleen de eigenaar). household_profile_list() geeft ze niet vrij.

create table if not exists public.finance_income_months (
  household_id uuid not null references public.households(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  net_cents bigint not null check (net_cents >= 0 and net_cents <= 100000000000),
  entered_by uuid not null references auth.users(id) on delete cascade,
  entered_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  primary key (household_id, month, user_id),
  check ((confirmed_at is null) = (confirmed_by is null)),
  check (confirmed_by is null or confirmed_by = user_id)
);

create table if not exists public.finance_income_history (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  month text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('entered', 'confirmed')),
  net_cents bigint not null,
  actor uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);

create table if not exists public.finance_distributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  revision integer not null check (revision >= 1),
  kind text not null check (kind in ('original', 'correction')),
  share_bp integer not null check (share_bp between 0 and 10000),
  input_hash text not null check (char_length(input_hash) between 1 and 80),
  incomes jsonb not null,
  snapshot jsonb not null,
  reason text not null default '',
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  unique (household_id, month, revision),
  check ((revision = 1) = (kind = 'original'))
);

alter table public.finance_income_months enable row level security;
alter table public.finance_income_history enable row level security;
alter table public.finance_distributions enable row level security;
revoke all on public.finance_income_months, public.finance_income_history, public.finance_distributions from anon, authenticated;
grant select on public.finance_income_months, public.finance_income_history, public.finance_distributions to authenticated;

-- Beide leden zien beide netto-inkomens (nodig voor de transparante verdeling). Schrijven loopt uitsluitend via de RPC's.
drop policy if exists "members read finance incomes" on public.finance_income_months;
create policy "members read finance incomes" on public.finance_income_months
  for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "members read finance income history" on public.finance_income_history;
create policy "members read finance income history" on public.finance_income_history
  for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "members read finance distributions" on public.finance_distributions;
create policy "members read finance distributions" on public.finance_distributions
  for select to authenticated using (public.is_household_member(household_id));

-- Verdelingen en historie zijn onveranderlijk: nooit overschrijven, alleen nieuwe revisies toevoegen.
create or replace function public.finance_block_update() returns trigger language plpgsql as $$
begin
  raise exception 'Financiële historie is onveranderlijk; registreer een correctie' using errcode = '42501';
end $$;
drop trigger if exists finance_distributions_immutable on public.finance_distributions;
create trigger finance_distributions_immutable before update on public.finance_distributions
  for each row execute function public.finance_block_update();
drop trigger if exists finance_income_history_immutable on public.finance_income_history;
create trigger finance_income_history_immutable before update on public.finance_income_history
  for each row execute function public.finance_block_update();

-- Eigen netto-inkomen invoeren. Alleen de eigen rij (auth.uid()); een wijziging laat de bevestiging vervallen.
create or replace function public.finance_set_income(p_household uuid, p_month text, p_net_cents bigint)
returns void language plpgsql security definer set search_path = public as $$
declare existing public.finance_income_months;
begin
  if auth.uid() is null or not public.is_household_member(p_household) then
    raise exception 'Geen toegang tot dit huishouden' using errcode = '42501';
  end if;
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_net_cents is null or p_net_cents < 0 or p_net_cents > 100000000000 then
    raise exception 'Ongeldige gegevens' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_household::text || p_month || auth.uid()::text));
  select * into existing from public.finance_income_months
    where household_id = p_household and month = p_month and user_id = auth.uid();
  if found and existing.net_cents = p_net_cents then return; end if;
  insert into public.finance_income_months (household_id, month, user_id, net_cents, entered_by, entered_at, confirmed_by, confirmed_at)
    values (p_household, p_month, auth.uid(), p_net_cents, auth.uid(), now(), null, null)
    on conflict (household_id, month, user_id) do update
      set net_cents = excluded.net_cents, entered_by = excluded.entered_by, entered_at = excluded.entered_at,
          confirmed_by = null, confirmed_at = null;
  insert into public.finance_income_history (household_id, month, user_id, action, net_cents, actor)
    values (p_household, p_month, auth.uid(), 'entered', p_net_cents, auth.uid());
end $$;

-- Eigen inkomen bevestigen. De verwachte waarde voorkomt bevestigen van een bedrag dat inmiddels is gewijzigd.
create or replace function public.finance_confirm_income(p_household uuid, p_month text, p_expected_net_cents bigint)
returns void language plpgsql security definer set search_path = public as $$
declare existing public.finance_income_months;
begin
  if auth.uid() is null or not public.is_household_member(p_household) then
    raise exception 'Geen toegang tot dit huishouden' using errcode = '42501';
  end if;
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_expected_net_cents is null then
    raise exception 'Ongeldige gegevens' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_household::text || p_month || auth.uid()::text));
  select * into existing from public.finance_income_months
    where household_id = p_household and month = p_month and user_id = auth.uid() for update;
  if not found then raise exception 'Voer eerst het eigen netto-inkomen in' using errcode = '22023'; end if;
  if existing.net_cents <> p_expected_net_cents then raise exception 'Versieconflict' using errcode = '40001'; end if;
  if existing.confirmed_at is not null then return; end if;
  update public.finance_income_months set confirmed_by = auth.uid(), confirmed_at = now()
    where household_id = p_household and month = p_month and user_id = auth.uid();
  insert into public.finance_income_history (household_id, month, user_id, action, net_cents, actor)
    values (p_household, p_month, auth.uid(), 'confirmed', existing.net_cents, auth.uid());
end $$;

-- Definitieve verdeling vastleggen (één van beide leden volstaat). De database controleert opnieuw dat beide inkomens
-- bevestigd zijn, dat de bijdragen kloppen met het gezamenlijke percentage en dat er geen tekort is.
-- Dezelfde invoer opnieuw insturen (dubbelklik, herladen, tweede apparaat) levert hetzelfde resultaat, nooit een tweede verwerking.
create or replace function public.finance_confirm_distribution(
  p_household uuid, p_month text, p_expected_revision integer, p_share_bp integer,
  p_input_hash text, p_snapshot jsonb, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  latest public.finance_distributions;
  member_count integer; confirmed_count integer;
  expected_total bigint := 0; lines_total bigint := 0; remainder bigint;
  m record; line jsonb; incomes jsonb := '{}'::jsonb; next_revision integer;
begin
  if auth.uid() is null or not public.is_household_member(p_household) then
    raise exception 'Geen toegang tot dit huishouden' using errcode = '42501';
  end if;
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_share_bp is null or p_share_bp < 0 or p_share_bp > 10000
     or p_input_hash is null or char_length(p_input_hash) not between 1 and 80 or p_expected_revision is null or p_expected_revision < 0
     or p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' or octet_length(p_snapshot::text) > 200000 then
    raise exception 'Ongeldige gegevens' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_household::text || p_month));
  select * into latest from public.finance_distributions
    where household_id = p_household and month = p_month order by revision desc limit 1;
  if found and latest.input_hash = p_input_hash then
    return jsonb_build_object('revision', latest.revision, 'duplicate', true);
  end if;
  if coalesce(latest.revision, 0) <> p_expected_revision then raise exception 'Versieconflict' using errcode = '40001'; end if;
  if latest.revision is not null and char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Geef een reden voor de correctie' using errcode = '22023';
  end if;

  select count(*) into member_count from public.household_members where household_id = p_household;
  select count(*) into confirmed_count from public.household_members hm
    join public.finance_income_months f on f.household_id = hm.household_id and f.user_id = hm.user_id and f.month = p_month
    where hm.household_id = p_household and f.confirmed_at is not null;
  if member_count <> 2 or confirmed_count <> 2 then
    raise exception 'Beide inkomens moeten eerst zijn ingevoerd en bevestigd' using errcode = '22023';
  end if;

  for m in select f.user_id, f.net_cents from public.finance_income_months f
    join public.household_members hm on hm.household_id = f.household_id and hm.user_id = f.user_id
    where f.household_id = p_household and f.month = p_month loop
    expected_total := expected_total + round(m.net_cents::numeric * p_share_bp / 10000)::bigint;
    if (p_snapshot -> 'contributions' ->> m.user_id::text) is distinct from round(m.net_cents::numeric * p_share_bp / 10000)::bigint::text then
      raise exception 'De bijdragen komen niet overeen met het gezamenlijke percentage' using errcode = '22023';
    end if;
    incomes := incomes || jsonb_build_object(m.user_id::text, m.net_cents);
  end loop;
  if (p_snapshot ->> 'totalContributionCents') is distinct from expected_total::text then
    raise exception 'Het totaal van de bijdragen klopt niet' using errcode = '22023';
  end if;

  if jsonb_typeof(p_snapshot -> 'lines') <> 'array' or jsonb_typeof(p_snapshot -> 'remainder') <> 'object' then
    raise exception 'Ongeldige verdeling' using errcode = '22023';
  end if;
  for line in select * from jsonb_array_elements(p_snapshot -> 'lines') loop
    if (line ->> 'cents') is null or (line ->> 'cents') !~ '^\d{1,12}$' then raise exception 'Ongeldige verdeling' using errcode = '22023'; end if;
    lines_total := lines_total + (line ->> 'cents')::bigint;
  end loop;
  if (p_snapshot -> 'remainder' ->> 'cents') is null then raise exception 'Ongeldige verdeling' using errcode = '22023'; end if;
  if (p_snapshot -> 'remainder' ->> 'cents') !~ '^\d{1,12}$' then
    raise exception 'Tekort: de definitieve verdeling is geblokkeerd' using errcode = '22023';
  end if;
  remainder := (p_snapshot -> 'remainder' ->> 'cents')::bigint;
  if lines_total + remainder <> expected_total then
    raise exception 'Tekort of afwijking: de vaste allocaties en het restbedrag sluiten niet op de bijdragen' using errcode = '22023';
  end if;

  next_revision := coalesce(latest.revision, 0) + 1;
  begin
    insert into public.finance_distributions (household_id, month, revision, kind, share_bp, input_hash, incomes, snapshot, reason, confirmed_by)
      values (p_household, p_month, next_revision, case when next_revision = 1 then 'original' else 'correction' end,
              p_share_bp, p_input_hash, incomes, p_snapshot, left(coalesce(p_reason, ''), 240), auth.uid());
  exception when unique_violation then
    raise exception 'Versieconflict' using errcode = '40001';
  end;
  return jsonb_build_object('revision', next_revision, 'duplicate', false);
end $$;

revoke all on function public.finance_block_update(), public.finance_set_income(uuid, text, bigint),
  public.finance_confirm_income(uuid, text, bigint),
  public.finance_confirm_distribution(uuid, text, integer, integer, text, jsonb, text) from public, anon;
grant execute on function public.finance_set_income(uuid, text, bigint),
  public.finance_confirm_income(uuid, text, bigint),
  public.finance_confirm_distribution(uuid, text, integer, integer, text, jsonb, text) to authenticated;
