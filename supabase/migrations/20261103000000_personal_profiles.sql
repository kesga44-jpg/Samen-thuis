alter table public.personal_preferences
  add column if not exists profile_config jsonb not null default '{}'::jsonb;

create or replace function public.household_profile_list()
returns table (user_id uuid, profile_config jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, jsonb_build_object(
    'firstName', left(coalesce(p.profile_config ->> 'firstName', ''), 80),
    'lastName', left(coalesce(p.profile_config ->> 'lastName', ''), 80),
    'nickname', left(coalesce(p.profile_config ->> 'nickname', ''), 80),
    'personKey', case
      when p.profile_config ->> 'personKey' in ('Kees', 'Daphne') then p.profile_config ->> 'personKey'
      else ''
    end,
    'avatarPath', case
      when coalesce(p.profile_config ->> 'avatarPath', '') ~ '^[0-9a-fA-F-]{36}/profile[.]jpg$'
        then p.profile_config ->> 'avatarPath'
      else ''
    end
  )
  from public.personal_preferences p
  join public.household_members mine on mine.user_id = auth.uid()
    and mine.household_id = (
      select own.household_id
      from public.household_members own
      where own.user_id = auth.uid()
      order by own.joined_at asc
      limit 1
    )
  join public.household_members member on member.household_id = mine.household_id
    and member.user_id = p.user_id
  where auth.uid() is not null
    and p.user_id <> auth.uid()
  limit 1
$$;

revoke all on function public.household_profile_list() from public, anon;
grant execute on function public.household_profile_list() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile photos household read" on storage.objects;
create policy "profile photos household read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.household_members mine
        join public.household_members member on member.household_id = mine.household_id
        where mine.user_id = auth.uid()
          and member.user_id::text = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists "profile photos owner insert" on storage.objects;
create policy "profile photos owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name = auth.uid()::text || '/profile.jpg'
  );

drop policy if exists "profile photos owner update" on storage.objects;
create policy "profile photos owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name = auth.uid()::text || '/profile.jpg'
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name = auth.uid()::text || '/profile.jpg'
  );

drop policy if exists "profile photos owner delete" on storage.objects;
create policy "profile photos owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name = auth.uid()::text || '/profile.jpg'
  );
