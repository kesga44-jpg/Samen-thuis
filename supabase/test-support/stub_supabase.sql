-- Alleen voor de losse PostgreSQL-migratietests; Supabase-defaultprivileges
-- worden bewust niet nagebootst. De lokale-stacktest controleert die apart.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role migration_owner nologin bypassrls;

revoke all on schema public from public;
grant usage on schema public to anon, authenticated, service_role;
grant usage, create on schema public to migration_owner;
alter default privileges for role migration_owner
  revoke execute on functions from public;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role, migration_owner;
grant select, references on auth.users to migration_owner;
grant execute on function auth.uid() to anon, authenticated, service_role, migration_owner;

-- Minimale nabootsing van Supabase Storage (alleen de objecten die de migraties aanspreken).
create schema storage;
create table storage.buckets (
  id text primary key,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);
alter table storage.buckets owner to migration_owner;
alter table storage.objects owner to migration_owner;
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
alter function storage.foldername(text) owner to migration_owner;
grant usage on schema storage to anon, authenticated, service_role, migration_owner;
grant execute on function storage.foldername(text) to authenticated, service_role, migration_owner;
