create table if not exists public.personal_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ui_config jsonb not null default '{}'::jsonb,
  dashboard_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.personal_preferences enable row level security;
revoke all on public.personal_preferences from anon;
grant select, insert, update on public.personal_preferences to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'personal_preferences'
      and policyname = 'users read own preferences'
  ) then
    create policy "users read own preferences" on public.personal_preferences
      for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'personal_preferences'
      and policyname = 'users create own preferences'
  ) then
    create policy "users create own preferences" on public.personal_preferences
      for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'personal_preferences'
      and policyname = 'users update own preferences'
  ) then
    create policy "users update own preferences" on public.personal_preferences
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
