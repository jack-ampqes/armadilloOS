-- Run this in Supabase SQL Editor (public schema) to create quotes, quote_items, and alerts tables.

-- quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  customer_address text,
  customer_city text,
  customer_state text,
  customer_zip text,
  customer_country text,
  subtotal double precision NOT NULL,
  discount_type text,
  discount_value double precision,
  discount_amount double precision NOT NULL DEFAULT 0,
  total double precision NOT NULL,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  quickbooks_estimate_id text,
  quickbooks_synced_at timestamptz
);

-- quote_items
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id text,
  product_name text NOT NULL,
  sku text,
  quantity integer NOT NULL,
  unit_price double precision NOT NULL,
  total_price double precision NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.quote_items(quote_id);

-- alerts
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id text,
  read boolean NOT NULL DEFAULT false,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Optional: trigger to set quotes.updated_at on update
CREATE OR REPLACE FUNCTION public.set_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quotes_updated_at ON public.quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_quotes_updated_at();
