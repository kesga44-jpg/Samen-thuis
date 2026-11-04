-- Roll back access policies only. Keep the private bucket and its objects so a
-- rollback cannot silently destroy uploaded household files.
drop policy if exists "sport training household read" on storage.objects;
drop policy if exists "sport training household upload" on storage.objects;
drop policy if exists "sport training household update" on storage.objects;
drop policy if exists "sport training household delete" on storage.objects;
