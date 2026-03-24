-- Customers table for CSV imports and app usage.
-- Handles:
-- - multiple emails/phones per customer (arrays)
-- - multiline addresses
-- - sparse/messy CSV rows
-- - backward compatibility with app fields (email, phone)

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),

  -- CSV core fields
  name text not null,
  company_name text,
  email text,                     -- legacy/single-email field used by app
  phone text,                     -- legacy/single-phone field used by app
  address text,                   -- may contain commas/newlines

  -- Expanded contact support
  emails text[] not null default '{}',
  phones text[] not null default '{}',

  -- Optional normalized address fields
  city text,
  state text,
  zip_code text,
  country text,

  -- Import/audit helpers
  source text,                    -- e.g. "customers_rows.csv"
  import_batch text,              -- optional batch tag/id
  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If table already exists, keep schema forward-compatible.
alter table public.customers add column if not exists company_name text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists emails text[] not null default '{}';
alter table public.customers add column if not exists phones text[] not null default '{}';
alter table public.customers add column if not exists city text;
alter table public.customers add column if not exists state text;
alter table public.customers add column if not exists zip_code text;
alter table public.customers add column if not exists country text;
alter table public.customers add column if not exists source text;
alter table public.customers add column if not exists import_batch text;
alter table public.customers add column if not exists notes text;
alter table public.customers add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.customers add column if not exists created_at timestamptz not null default now();
alter table public.customers add column if not exists updated_at timestamptz not null default now();

-- Keep arrays and single-value fields synchronized.
-- Single-value columns store the first array value for app compatibility.
create or replace function public.sync_customer_contact_fields()
returns trigger as $$
begin
  if new.emails is null then
    new.emails := '{}';
  end if;
  if new.phones is null then
    new.phones := '{}';
  end if;

  -- Trim empty entries from arrays
  new.emails := (
    select coalesce(array_agg(trim(v)), '{}')
    from unnest(new.emails) v
    where nullif(trim(v), '') is not null
  );
  new.phones := (
    select coalesce(array_agg(trim(v)), '{}')
    from unnest(new.phones) v
    where nullif(trim(v), '') is not null
  );

  -- Backfill arrays from single values when arrays are empty
  if coalesce(array_length(new.emails, 1), 0) = 0 and nullif(trim(new.email), '') is not null then
    new.emails := array[trim(new.email)];
  end if;
  if coalesce(array_length(new.phones, 1), 0) = 0 and nullif(trim(new.phone), '') is not null then
    new.phones := array[trim(new.phone)];
  end if;

  -- Keep legacy fields populated from arrays
  new.email := case when coalesce(array_length(new.emails, 1), 0) > 0 then new.emails[1] else null end;
  new.phone := case when coalesce(array_length(new.phones, 1), 0) > 0 then new.phones[1] else null end;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_customers_sync_contact_fields on public.customers;
create trigger trg_customers_sync_contact_fields
before insert or update on public.customers
for each row
execute function public.sync_customer_contact_fields();

-- One-time backfill for existing data.
update public.customers
set
  emails = case
    when coalesce(array_length(emails, 1), 0) > 0 then emails
    when nullif(trim(email), '') is not null then array[trim(email)]
    else '{}'
  end,
  phones = case
    when coalesce(array_length(phones, 1), 0) > 0 then phones
    when nullif(trim(phone), '') is not null then array[trim(phone)]
    else '{}'
  end,
  company_name = coalesce(nullif(company_name, ''), name),
  updated_at = now();

-- Helpful indexes for search/filtering.
create index if not exists idx_customers_name on public.customers (name);
create index if not exists idx_customers_company_name on public.customers (company_name);
create index if not exists idx_customers_email_lower on public.customers (lower(email));
create index if not exists idx_customers_phone on public.customers (phone);
create index if not exists idx_customers_country on public.customers (country);
create index if not exists idx_customers_created_at on public.customers (created_at desc);

-- GIN indexes support fast array containment queries.
create index if not exists idx_customers_emails_gin on public.customers using gin (emails);
create index if not exists idx_customers_phones_gin on public.customers using gin (phones);

