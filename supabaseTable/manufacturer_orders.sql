-- Manufacturer Orders tables for armadilloOS
-- Schema: armadillo_inventory
-- These tables track manufacturers and inventory orders placed with them

-- ============================================
-- MANUFACTURERS TABLE
-- ============================================
-- Stores manufacturer/supplier information

create table if not exists armadillo_inventory.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  address text,
  city text,
  state text,
  zip_code text,
  country text,
  lead_time text,                    -- e.g., "2-3 weeks", "6-8 weeks"
  payment_terms text,                -- e.g., "Net 30", "COD"
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manufacturers_name_idx
  on armadillo_inventory.manufacturers (name);

create index if not exists manufacturers_is_active_idx
  on armadillo_inventory.manufacturers (is_active);

-- ============================================
-- MANUFACTURER ORDERS TABLE
-- ============================================
-- Stores inventory orders placed with manufacturers

create table if not exists armadillo_inventory.manufacturer_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  manufacturer_id uuid not null references armadillo_inventory.manufacturers(id) on delete restrict,
  status text not null default 'pending',  -- pending, confirmed, shipped, delivered, cancelled
  
  -- Dates
  order_date timestamptz not null default now(),
  expected_delivery date,
  actual_delivery date,
  
  -- Shipping/Tracking
  tracking_number text,
  tracking_url text,
  carrier text,                      -- e.g., "UPS", "FedEx", "Freight"
  shipping_method text,              -- e.g., "Ground", "Express", "LTL"
  
  -- Financial
  subtotal numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) default 0,
  tax numeric(12,2) default 0,
  total_amount numeric(12,2) not null default 0,
  currency text default 'USD',
  
  -- Payment
  payment_status text default 'unpaid',  -- unpaid, partial, paid
  payment_method text,
  payment_reference text,            -- check number, wire ref, etc.
  paid_at timestamptz,
  
  -- Additional info
  po_number text,                    -- Purchase order number (if different from order_number)
  notes text,
  internal_notes text,               -- Internal-only notes not shared with manufacturer
  
  created_by text,                   -- User who created the order
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manufacturer_orders_manufacturer_id_idx
  on armadillo_inventory.manufacturer_orders (manufacturer_id);

create index if not exists manufacturer_orders_status_idx
  on armadillo_inventory.manufacturer_orders (status);

create index if not exists manufacturer_orders_order_date_idx
  on armadillo_inventory.manufacturer_orders (order_date desc);

create index if not exists manufacturer_orders_expected_delivery_idx
  on armadillo_inventory.manufacturer_orders (expected_delivery);

-- ============================================
-- MANUFACTURER ORDER ITEMS TABLE
-- ============================================
-- Line items for each manufacturer order

create table if not exists armadillo_inventory.manufacturer_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references armadillo_inventory.manufacturer_orders(id) on delete cascade,
  
  -- Product reference (links to inventory)
  sku text not null,
  product_name text not null,
  
  -- Quantities
  quantity_ordered int not null,
  quantity_received int default 0,   -- Track partial deliveries
  
  -- Pricing
  unit_cost numeric(12,2) not null,
  total_cost numeric(12,2) not null,
  
  -- Additional info
  manufacturer_sku text,             -- Manufacturer's own SKU if different
  notes text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manufacturer_order_items_order_id_idx
  on armadillo_inventory.manufacturer_order_items (order_id);

create index if not exists manufacturer_order_items_sku_idx
  on armadillo_inventory.manufacturer_order_items (sku);

-- ============================================
-- HELPER FUNCTION: Update timestamp trigger
-- ============================================

create or replace function armadillo_inventory.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to all tables
create trigger update_manufacturers_updated_at
  before update on armadillo_inventory.manufacturers
  for each row execute function armadillo_inventory.update_updated_at_column();

create trigger update_manufacturer_orders_updated_at
  before update on armadillo_inventory.manufacturer_orders
  for each row execute function armadillo_inventory.update_updated_at_column();

create trigger update_manufacturer_order_items_updated_at
  before update on armadillo_inventory.manufacturer_order_items
  for each row execute function armadillo_inventory.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (Optional - uncomment if needed)
-- ============================================

-- alter table armadillo_inventory.manufacturers enable row level security;
-- alter table armadillo_inventory.manufacturer_orders enable row level security;
-- alter table armadillo_inventory.manufacturer_order_items enable row level security;

-- Example policy: Allow authenticated users full access
-- create policy "Allow authenticated access to manufacturers"
--   on armadillo_inventory.manufacturers
--   for all
--   to authenticated
--   using (true)
--   with check (true);

-- ============================================
-- COMMENTS
-- ============================================

comment on table armadillo_inventory.manufacturers is 'Stores manufacturer/supplier information for inventory ordering';
comment on table armadillo_inventory.manufacturer_orders is 'Inventory orders placed with manufacturers';
comment on table armadillo_inventory.manufacturer_order_items is 'Line items for manufacturer orders';

comment on column armadillo_inventory.manufacturer_orders.status is 'Order status: pending, confirmed, shipped, delivered, cancelled';
comment on column armadillo_inventory.manufacturer_orders.payment_status is 'Payment status: unpaid, partial, paid';
comment on column armadillo_inventory.manufacturer_order_items.quantity_received is 'Tracks partial deliveries - may be less than quantity_ordered';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Grant access to anon and authenticated roles for Supabase

grant usage on schema armadillo_inventory to anon, authenticated;

grant all on armadillo_inventory.manufacturers to anon, authenticated;
grant all on armadillo_inventory.manufacturer_orders to anon, authenticated;
grant all on armadillo_inventory.manufacturer_order_items to anon, authenticated;
