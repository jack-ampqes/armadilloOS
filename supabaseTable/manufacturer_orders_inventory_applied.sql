-- Add column to track when a manufacturer order's quantities have been applied to inventory.
-- Run this migration so receive/apply-to-inventory can avoid double-counting.

alter table armadillo_inventory.manufacturer_orders
  add column if not exists inventory_applied_at timestamptz;

comment on column armadillo_inventory.manufacturer_orders.inventory_applied_at is
  'When non-null, this order''s item quantities have been added to inventory (e.g. when FedEx reports delivered).';
