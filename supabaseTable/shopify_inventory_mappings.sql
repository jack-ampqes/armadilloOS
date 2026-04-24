-- SKU -> Shopify inventory mapping cache for one-way stock sync
-- armadilloBase (local) is source of truth; Shopify reflects quantity.

create table if not exists public.shopify_inventory_mappings (
  sku text primary key,
  inventory_item_id bigint not null,
  location_id bigint,
  shopify_variant_id bigint,
  shopify_product_id bigint,
  updated_at timestamptz not null default now()
);

create index if not exists shopify_inventory_mappings_updated_at_idx
  on public.shopify_inventory_mappings (updated_at desc);

