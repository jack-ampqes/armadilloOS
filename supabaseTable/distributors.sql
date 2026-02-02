-- Run this in Supabase SQL Editor (public schema).
-- Single address field; longitude/latitude from geocoding for map pins.
-- API routes write to: public.distributors.longitude, public.distributors.latitude
CREATE TABLE IF NOT EXISTS public.distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  email text NOT NULL,
  phone text,
  address text,
  longitude double precision,
  latitude double precision,
  discount_rate double precision,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- If table exists, add columns:
-- ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS longitude double precision;
-- ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS latitude double precision;

CREATE INDEX IF NOT EXISTS idx_distributors_name ON public.distributors (name);
CREATE INDEX IF NOT EXISTS idx_distributors_email ON public.distributors (email);

-- Optional: trigger to set updated_at on update
CREATE OR REPLACE FUNCTION public.set_distributors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS distributors_updated_at ON public.distributors;
CREATE TRIGGER distributors_updated_at
  BEFORE UPDATE ON public.distributors
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_distributors_updated_at();
