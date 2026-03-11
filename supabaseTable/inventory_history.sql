-- Inventory adjustment history for armadillo_inventory schema.
-- Tracks when quantity is added or removed (manual, manufacturer order, scan, etc.).

create table if not exists armadillo_inventory.inventory_history (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  quantity_change int not null,
  quantity_after int not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  user_id text,
  user_email text
);

comment on table armadillo_inventory.inventory_history is 'Log of inventory quantity adjustments (add/remove)';
comment on column armadillo_inventory.inventory_history.quantity_change is 'Delta: positive = added, negative = removed';
comment on column armadillo_inventory.inventory_history.quantity_after is 'Stock quantity after this adjustment';
comment on column armadillo_inventory.inventory_history.source is 'Origin: manual, manufacturer_order, scan';

create index if not exists idx_inventory_history_sku on armadillo_inventory.inventory_history (sku);
create index if not exists idx_inventory_history_created_at on armadillo_inventory.inventory_history (created_at desc);

grant all on armadillo_inventory.inventory_history to anon, authenticated;
