-- Shopify OAuth connections for armadilloOS
-- This table stores per-shop Admin API tokens after "Connect Shopify".
--
-- Notes:
-- - `access_token` is sensitive. Restrict access with RLS (recommended) and/or only access via service role key.
-- - If you only have one store, you’ll typically have 1 row.

create table if not exists public.shopify_connections (
  id uuid primary key default gen_random_uuid(),
  shop text not null unique,
  access_token text not null,
  scope text,
  connected_by_email text,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopify_connections_updated_at_idx
  on public.shopify_connections (updated_at desc);

