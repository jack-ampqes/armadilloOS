-- QuickBooks OAuth connections for armadilloOS
-- Stores realm (company) and tokens after "Connect QuickBooks".
-- access_token expires in ~1 hour; use refresh_token to get a new one.

create table if not exists public.quickbooks_connections (
  id uuid primary key default gen_random_uuid(),
  realm_id text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz,
  connected_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(realm_id)
);

create index if not exists quickbooks_connections_updated_at_idx
  on public.quickbooks_connections (updated_at desc);
