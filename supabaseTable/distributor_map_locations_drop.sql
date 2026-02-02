-- Run this in Supabase SQL Editor to drop distributor_map_locations.
-- Coordinates now live on public.distributors (longitude, latitude).
-- First add columns: ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS longitude double precision;
--                   ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS latitude double precision;

DROP TABLE IF EXISTS public.distributor_map_locations CASCADE;
