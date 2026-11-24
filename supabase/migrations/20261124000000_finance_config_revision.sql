-- Privé-potjes (personal_preferences.finance_config): versie door de server in plaats van een tijdstempel van het apparaat.
-- Additief en herhaalbaar. Wordt NIET automatisch toegepast; de app werkt met en zonder deze migratie (finance-ui.js valt
-- terug op de voorwaardelijke PATCH op updated_at zolang finance_revision ontbreekt).
--
-- Waarom: het oude versiekenmerk was updated_at, gezet door het apparaat. Schrijft een apparaat exact dezelfde waarde
-- terug (zelfde milliseconde of klokafwijking), dan slaagt een verouderde voorwaardelijke update (ABA). finance_revision
-- wordt alleen door de database opgehoogd en is daardoor strikt oplopend, ook voor oudere clients die finance_config nog
-- rechtstreeks bijwerken (trigger hieronder).
-- Raakt household_data, household_state en andere tabellen niet aan.

alter table public.personal_preferences
  add column if not exists finance_revision bigint not null default 0;

-- Elke wijziging van finance_config verhoogt de revisie, ongeacht de route (RPC, oude PATCH-route, beheer).
create or replace function public.personal_preferences_bump_finance_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.finance_config is distinct from old.finance_config then
    new.finance_revision := old.finance_revision + 1;
  else
    new.finance_revision := old.finance_revision; -- revisie is niet vrij te zetten
  end if;
  return new;
end;
$$;

drop trigger if exists personal_preferences_finance_revision on public.personal_preferences;
create trigger personal_preferences_finance_revision
  before update on public.personal_preferences
  for each row execute function public.personal_preferences_bump_finance_revision();

-- Atomaire voorwaardelijke opslag van de eigen privé-instellingen. Eén statement; geen user_id uit de payload
-- (altijd auth.uid()); RLS van personal_preferences blijft gelden (security invoker).
-- p_expected_revision = 0 en nog geen rij: aanmaken. Anders alleen bijwerken als de revisie nog gelijk is.
-- Geen rij terug = conflict (een ander apparaat was eerder); de client haalt dan opnieuw op en voegt samen.
create or replace function public.save_finance_config(p_expected_revision bigint, p_config jsonb)
returns table (out_config jsonb, out_revision bigint, out_updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Niet aangemeld' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Ongeldige revisie' using errcode = '22023';
  end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' or octet_length(p_config::text) > 262144 then
    raise exception 'Ongeldige configuratie' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.personal_preferences (user_id, finance_config, finance_revision, updated_at)
    values (caller, p_config, 1, now())
    on conflict (user_id) do nothing;
    if found then
      return query
        select p.finance_config, p.finance_revision, p.updated_at
          from public.personal_preferences p where p.user_id = caller;
      return;
    end if;
  end if;

  return query
    update public.personal_preferences p
       set finance_config = p_config, updated_at = now()
     where p.user_id = caller and p.finance_revision = p_expected_revision
    returning p.finance_config, p.finance_revision, p.updated_at;
end;
$$;

revoke all on function public.save_finance_config(bigint, jsonb) from public, anon;
grant execute on function public.save_finance_config(bigint, jsonb) to authenticated;
revoke all on function public.personal_preferences_bump_finance_revision() from public, anon, authenticated;
