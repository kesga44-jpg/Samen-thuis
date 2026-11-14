-- Samen Thuis Beta gebruikt dezelfde household_data-tabel als productie,
-- maar een ander gehashte record-id. Hierdoor blijven de datasets gescheiden.

create table if not exists public.household_data (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

revoke all on public.household_data from public, anon, authenticated, service_role;
grant select, insert, update on public.household_data to anon;

alter table public.household_data enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='household_data' and policyname='encrypted household read') then
    create policy "encrypted household read" on public.household_data for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='household_data' and policyname='encrypted household insert') then
    create policy "encrypted household insert" on public.household_data for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='household_data' and policyname='encrypted household update') then
    create policy "encrypted household update" on public.household_data for update to anon using (true) with check (true);
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.guard_household_data_write()') is not null
     and not exists (
       select 1 from pg_trigger
       where tgrelid = 'public.household_data'::regclass
         and tgname = 'household_data_disposition_guard'
         and not tgisinternal
     ) then
    create trigger household_data_disposition_guard
      before insert or update on public.household_data
      for each row execute function public.guard_household_data_write();
  end if;
end $$;
