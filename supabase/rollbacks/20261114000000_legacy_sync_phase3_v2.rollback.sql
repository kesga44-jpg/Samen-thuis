-- Geen rollback die household_data-toegang heropent.
-- Dit noodscript sluit alle expliciet geopende herstelvensters; het laat de
-- ledger, audit en Phase-3-afsluiting intact.
select pg_catalog.pg_advisory_xact_lock(741140, 3);

update public.legacy_sync_phase3_state
set recovery_disabled_at = coalesce(recovery_disabled_at, pg_catalog.clock_timestamp())
where singleton;

with closed as (
  update public.legacy_recovery_allow
  set closed_at = pg_catalog.clock_timestamp(),
      closed_by = session_user
  where closed_at is null
  returning recovery_id
)
insert into public.legacy_recovery_audit
  (recovery_id, action, actor, occurred_at, row_count, reason)
select recovery_id, 'closed', session_user, pg_catalog.clock_timestamp(), count(*),
       'Emergency kill switch: all recovery windows closed'
from closed
group by recovery_id;
