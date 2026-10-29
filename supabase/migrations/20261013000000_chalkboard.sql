-- Digitaal krijtbord: huishoudens, leden en berichten met Row Level Security.
-- Additief en herhaalbaar: bestaande tabellen en gegevens worden niet aangepast.

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  join_code text not null unique default upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10)),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members (user_id);

create table if not exists public.chalkboard_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 40),
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists chalkboard_messages_household_idx on public.chalkboard_messages (household_id, created_at desc);

-- Security definer voorkomt recursieve RLS-controles op household_members.
create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members where household_id = hid and user_id = auth.uid());
$$;

create or replace function public.is_household_admin(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members
    where household_id = hid and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

create or replace function public.create_household(p_name text)
returns public.households language plpgsql security definer set search_path = public as $$
declare created public.households;
begin
  if auth.uid() is null then raise exception 'Niet aangemeld'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then raise exception 'Ongeldige naam'; end if;
  insert into public.households (name, created_by) values (btrim(p_name), auth.uid()) returning * into created;
  insert into public.household_members (household_id, user_id, role) values (created.id, auth.uid(), 'owner');
  return created;
end $$;

create or replace function public.join_household(p_code text)
returns public.households language plpgsql security definer set search_path = public as $$
declare found public.households;
begin
  if auth.uid() is null then raise exception 'Niet aangemeld'; end if;
  select * into found from public.households where join_code = upper(btrim(p_code));
  if found.id is null then raise exception 'Onbekende huishoudcode'; end if;
  insert into public.household_members (household_id, user_id, role)
    values (found.id, auth.uid(), 'member') on conflict do nothing;
  return found;
end $$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.chalkboard_messages enable row level security;

revoke all on public.households, public.household_members, public.chalkboard_messages from anon;
revoke all on public.households, public.household_members, public.chalkboard_messages from authenticated;
grant select on public.households, public.household_members to authenticated;
grant select, insert, delete on public.chalkboard_messages to authenticated;
revoke all on function public.create_household(text), public.join_household(text),
  public.is_household_member(uuid), public.is_household_admin(uuid) from public, anon;
grant execute on function public.create_household(text), public.join_household(text),
  public.is_household_member(uuid), public.is_household_admin(uuid) to authenticated;

drop policy if exists "members read household" on public.households;
create policy "members read household" on public.households
  for select to authenticated using (public.is_household_member(id));

drop policy if exists "members read members" on public.household_members;
create policy "members read members" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

drop policy if exists "members read chalkboard" on public.chalkboard_messages;
create policy "members read chalkboard" on public.chalkboard_messages
  for select to authenticated using (public.is_household_member(household_id));

drop policy if exists "members post chalkboard" on public.chalkboard_messages;
create policy "members post chalkboard" on public.chalkboard_messages
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists "author or admin delete chalkboard" on public.chalkboard_messages;
create policy "author or admin delete chalkboard" on public.chalkboard_messages
  for delete to authenticated
  using (public.is_household_member(household_id)
    and (user_id = auth.uid() or public.is_household_admin(household_id)));
