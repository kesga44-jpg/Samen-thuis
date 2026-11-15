-- Manual rollback only before DB-1. Re-enables the unsafe client import RPC.
drop trigger if exists household_state_reject_sportcoach on public.household_state;
drop function if exists public.reject_sportcoach_household_state();
grant execute on function public.import_legacy_household_data(uuid, text)
  to authenticated;
