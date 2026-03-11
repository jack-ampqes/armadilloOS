-- Company profiles: admin-managed companies; users can be assigned to a company.
-- Company icon = small badge shown next to user mentions; company logo = shared profile photo for users in that company.

-- 1. Companies table
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_url text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table companies is 'Company profiles; users can be assigned to one company for badge and shared logo.';

-- 2. Add company_id to users
alter table users
  add column if not exists company_id uuid references companies(id) on delete set null;

create index if not exists idx_users_company_id on users (company_id);

-- 3. Storage bucket "companies" for icon and logo (create in Dashboard if needed; policies below)
-- Policies for storage.objects (run after bucket exists)
drop policy if exists "Allow company uploads" on storage.objects;
drop policy if exists "Allow company updates" on storage.objects;
drop policy if exists "Allow company select" on storage.objects;
drop policy if exists "Allow company delete" on storage.objects;

create policy "Allow company uploads"
on storage.objects for insert to service_role
with check (bucket_id = 'companies');

create policy "Allow company updates"
on storage.objects for update to service_role
using (bucket_id = 'companies');

create policy "Allow company select"
on storage.objects for select to service_role
using (bucket_id = 'companies');

create policy "Allow company delete"
on storage.objects for delete to service_role
using (bucket_id = 'companies');

-- anon fallback
create policy "Allow anon company uploads"
on storage.objects for insert to anon
with check (bucket_id = 'companies');

create policy "Allow anon company updates"
on storage.objects for update to anon
using (bucket_id = 'companies');

create policy "Allow anon company select"
on storage.objects for select to anon
using (bucket_id = 'companies');

create policy "Allow anon company delete"
on storage.objects for delete to anon
using (bucket_id = 'companies');
