
-- Create enum for cap table status
CREATE TYPE public.captable_status AS ENUM ('setup', 'live');

-- Add column to entities table with default 'setup'
ALTER TABLE public.entities 
ADD COLUMN captable_status public.captable_status NOT NULL DEFAULT 'setup';
