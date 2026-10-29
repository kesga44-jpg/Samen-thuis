-- FASE 3 - NIET automatisch uitvoeren. Eerst verse export van household_data en coach_data maken.
-- Dit script weigert te draaien (en wijzigt dan niets) tenzij de migratie aantoonbaar is toegepast en gebruikt:
--  * household_state, household_legacy_imports, put_household_state en import_legacy_household_data bestaan;
--  * minstens één huishouden heeft 2 leden en gesynchroniseerde onderdelen (anders dan legacy_full).
-- De nieuwe sync gebruikt household_data alleen via de security-definer-functie import_legacy_household_data
-- (draait als eigenaar, dus blijft werken na intrekken van anon-rechten). coach_data wordt niet aangeraakt.
-- Controle én wijziging staan bewust in ÉÉN enkel DO-blok (= één statement = atomair): faalt de controle, dan wordt
-- niets uitgevoerd, ongeacht of de SQL-runner na een fout doorgaat (psql zonder ON_ERROR_STOP, SQL-editor, enz.).
-- Voeg hier GEEN losse statements buiten het blok toe.
do $$
begin
  if to_regclass('public.household_state') is null or to_regclass('public.household_legacy_imports') is null
     or to_regprocedure('public.put_household_state(uuid,text,jsonb,bigint)') is null
     or to_regprocedure('public.import_legacy_household_data(uuid,text)') is null then
    raise exception 'Fase 3 geweigerd: migratie 20261014000000 is niet (volledig) toegepast';
  end if;
  if not exists (
    select 1 from public.household_state s
    where s.section <> 'legacy_full'
      and (select count(*) from public.household_members m where m.household_id = s.household_id) = 2
  ) then
    raise exception 'Fase 3 geweigerd: nog geen huishouden met 2 leden en gesynchroniseerde onderdelen in household_state';
  end if;

  drop policy if exists "encrypted household read" on public.household_data;
  drop policy if exists "encrypted household insert" on public.household_data;
  drop policy if exists "encrypted household update" on public.household_data;
  revoke select, insert, update on public.household_data from anon;
end $$;
-- Rollback (handmatig):
-- grant select, insert, update on public.household_data to anon;
-- create policy "encrypted household read" on public.household_data for select to anon using (true);
-- create policy "encrypted household insert" on public.household_data for insert to anon with check (true);
-- create policy "encrypted household update" on public.household_data for update to anon using (true) with check (true);
