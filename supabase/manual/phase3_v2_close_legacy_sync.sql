-- Alleen lokale/staging-testdatabase. Nooit uitvoeren op productie of echte huishouddata.
-- Bekijk vooraf check_legacy_sync_phase3_v2(); close_legacy_sync_phase3_v2()
-- herhaalt alle controles onder een exclusieve transactie-lock.
-- Een fout breekt de statement af en rolt alle wijzigingen terug.
select public.close_legacy_sync_phase3_v2();
