-- Private Sport & Training files. Object names are household-id/item-id/file-name.
-- Metadata remains in the existing encrypted household_state payload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sport-training',
  'sport-training',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sport training household read" on storage.objects;
create policy "sport training household read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'sport-training'
    and exists (
      select 1 from public.household_members m
      where m.user_id = auth.uid()
        and m.household_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "sport training household upload" on storage.objects;
create policy "sport training household upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sport-training'
    and exists (
      select 1 from public.household_members m
      where m.user_id = auth.uid()
        and m.household_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "sport training household update" on storage.objects;
create policy "sport training household update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'sport-training'
    and exists (
      select 1 from public.household_members m
      where m.user_id = auth.uid()
        and m.household_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'sport-training'
    and exists (
      select 1 from public.household_members m
      where m.user_id = auth.uid()
        and m.household_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "sport training household delete" on storage.objects;
create policy "sport training household delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'sport-training'
    and exists (
      select 1 from public.household_members m
      where m.user_id = auth.uid()
        and m.household_id::text = (storage.foldername(name))[1]
    )
  );
