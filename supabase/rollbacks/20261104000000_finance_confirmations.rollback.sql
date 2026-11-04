-- Rollback van 20261104000000. Handmatig uit te voeren.
-- LET OP: verwijdert alle inkomensbevestigingen en vastgelegde maandverdelingen. Bewaar eerst een export.
-- personal_preferences.finance_config wordt bewust NIET verwijderd (bevat persoonlijke gegevens van gebruikers).
drop function if exists public.finance_confirm_distribution(uuid, text, integer, integer, text, jsonb, text);
drop function if exists public.finance_confirm_income(uuid, text, bigint);
drop function if exists public.finance_set_income(uuid, text, bigint);
drop table if exists public.finance_distributions;
drop table if exists public.finance_income_history;
drop table if exists public.finance_income_months;
drop function if exists public.finance_block_update();
