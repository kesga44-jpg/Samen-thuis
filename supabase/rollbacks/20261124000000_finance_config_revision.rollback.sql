-- Handmatige rollback van 20261124000000_finance_config_revision.sql.
-- De app valt daarna vanzelf terug op de voorwaardelijke PATCH op updated_at. finance_config blijft ongewijzigd;
-- alleen de revisieteller verdwijnt.
drop function if exists public.save_finance_config(bigint, jsonb);
drop trigger if exists personal_preferences_finance_revision on public.personal_preferences;
drop function if exists public.personal_preferences_bump_finance_revision();
alter table public.personal_preferences drop column if exists finance_revision;
