-- PR E: preserve existing rows but prevent new account-sync copies of SportCoach
-- and stop client-side import of the opaque legacy full-payload.

create or replace function public.reject_sportcoach_household_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.section = 'sportCoach' or new.section like 'sportCoach.%' then
    raise exception 'SportCoach is local-only and cannot be written to household_state'
      using errcode = '42501';
  end if;
  return new;
end
$$;

revoke all on function public.reject_sportcoach_household_state()
  from public, anon, authenticated, service_role;

drop trigger if exists household_state_reject_sportcoach on public.household_state;
create trigger household_state_reject_sportcoach
  before insert or update on public.household_state
  for each row execute function public.reject_sportcoach_household_state();

-- This RPC copies the complete opaque legacy ciphertext into legacy_full. It
-- cannot remove SportCoach selectively, so new clients must not invoke it.
-- The original household_data route and all existing rows remain untouched.
revoke execute on function public.import_legacy_household_data(uuid, text)
  from authenticated;
