
-- Enum for circular ownership exception types
CREATE TYPE public.circular_ownership_exception_type AS ENUM (
  'legal_representative',
  'trustee',
  'pre_existing',
  'other'
);

-- Enum for circular type on UBO snapshots
CREATE TYPE public.circular_type AS ENUM (
  'illegal',
  'legal_exception'
);

-- Add circular ownership columns to equity_links
ALTER TABLE public.equity_links
  ADD COLUMN circular_ownership_type public.circular_ownership_exception_type DEFAULT NULL,
  ADD COLUMN circular_ownership_notes text DEFAULT NULL,
  ADD COLUMN circular_ownership_doc_url text DEFAULT NULL,
  ADD COLUMN disposal_required boolean NOT NULL DEFAULT false,
  ADD COLUMN disposal_deadline date DEFAULT NULL,
  ADD COLUMN disposal_jurisdiction text DEFAULT NULL;

-- Add circular_type to ubo_snapshots
ALTER TABLE public.ubo_snapshots
  ADD COLUMN circular_type public.circular_type DEFAULT NULL;

-- Function to detect circular ownership via full recursive traversal
CREATE OR REPLACE FUNCTION public.check_circular_ownership(
  p_company_entity_id uuid,
  p_potential_owner_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    -- Start: who owns the company?
    SELECT el.owner_entity_id, 1 AS depth
    FROM equity_links el
    WHERE el.owned_entity_id = p_company_entity_id
      AND el.end_date IS NULL
      AND el.workspace_id = get_user_workspace_id()
    UNION ALL
    -- Traverse upward: who owns the owners?
    SELECT el.owner_entity_id, c.depth + 1
    FROM equity_links el
    JOIN chain c ON c.owner_entity_id = el.owned_entity_id
    WHERE el.end_date IS NULL
      AND el.workspace_id = get_user_workspace_id()
      AND c.depth < 10
  )
  SELECT EXISTS (
    SELECT 1 FROM chain WHERE owner_entity_id = p_potential_owner_id
  );
$$;
