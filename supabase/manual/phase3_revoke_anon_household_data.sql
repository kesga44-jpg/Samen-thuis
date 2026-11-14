-- Superseded by phase3_v2_close_legacy_sync.sql.
-- This legacy script is intentionally fail-closed and never restores or revokes
-- access independently of the transactional Phase-3-v2 guard.
do $$
begin
  raise exception 'Oud Phase-3-script geblokkeerd; gebruik uitsluitend phase3_v2_close_legacy_sync.sql';
end
$$;
