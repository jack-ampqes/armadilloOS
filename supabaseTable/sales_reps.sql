-- Run this in Supabase SQL Editor (public schema) to create the sales_reps table.
-- If the table already exists, run only this to add the color column:
-- ALTER TABLE public.sales_reps ADD COLUMN IF NOT EXISTS color text;

CREATE TABLE IF NOT EXISTS public.sales_reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  territory text,
  commission_rate double precision,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_reps_name ON public.sales_reps (name);
CREATE INDEX IF NOT EXISTS idx_sales_reps_email ON public.sales_reps (email);

-- Optional: trigger to set updated_at on update
CREATE OR REPLACE FUNCTION public.set_sales_reps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sales_reps_updated_at ON public.sales_reps;
CREATE TRIGGER sales_reps_updated_at
  BEFORE UPDATE ON public.sales_reps
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_sales_reps_updated_at();

-- Seed sample reps with territories (FIPS state codes) so the map has data to show (only when table is empty)
INSERT INTO public.sales_reps (name, email, phone, territory, commission_rate)
SELECT v.name, v.email, v.phone, v.territory, v.commission_rate
FROM (VALUES
  ('West Region', 'west@example.com', NULL::text, '06,32,04,49,41', 5::double precision),
  ('Northeast Region', 'northeast@example.com', NULL::text, '36,34,09,25,44,23,50,33', 5::double precision),
  ('South Region', 'south@example.com', NULL::text, '12,13,01,22,28,47,45,37', 5::double precision)
) AS v(name, email, phone, territory, commission_rate)
WHERE NOT EXISTS (SELECT 1 FROM public.sales_reps LIMIT 1);
