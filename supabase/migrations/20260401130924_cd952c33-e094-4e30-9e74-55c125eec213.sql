
-- Enum for snapshot type
CREATE TYPE public.ubo_snapshot_type AS ENUM ('live', 'historical');

-- UBO Snapshots table
CREATE TABLE public.ubo_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  company_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  person_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  effective_economic_pct NUMERIC(10,6) NOT NULL DEFAULT 0,
  effective_voting_pct NUMERIC(10,6) NOT NULL DEFAULT 0,
  ownership_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_above_threshold BOOLEAN NOT NULL DEFAULT false,
  circular_detected BOOLEAN NOT NULL DEFAULT false,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot_type public.ubo_snapshot_type NOT NULL DEFAULT 'live',
  snapshot_date DATE
);

ALTER TABLE public.ubo_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view UBO snapshots in their workspace"
  ON public.ubo_snapshots FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can create UBO snapshots in their workspace"
  ON public.ubo_snapshots FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can update UBO snapshots in their workspace"
  ON public.ubo_snapshots FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can delete UBO snapshots in their workspace"
  ON public.ubo_snapshots FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE INDEX idx_ubo_snapshots_company ON public.ubo_snapshots(company_entity_id);
CREATE INDEX idx_ubo_snapshots_person ON public.ubo_snapshots(person_entity_id);
CREATE INDEX idx_ubo_snapshots_workspace ON public.ubo_snapshots(workspace_id);

-- calculate_ubo RPC
CREATE OR REPLACE FUNCTION public.calculate_ubo(p_company_entity_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ws UUID;
  v_result JSONB := '[]'::jsonb;
  v_company_name TEXT;
  v_person RECORD;
  v_chain JSONB;
  v_econ_pct NUMERIC;
  v_vote_pct NUMERIC;
  v_above BOOLEAN;
BEGIN
  v_ws := get_user_workspace_id();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Verify entity exists and is a company
  SELECT name INTO v_company_name FROM entities
  WHERE id = p_company_entity_id AND workspace_id = v_ws AND type = 'company';
  IF NOT FOUND THEN RAISE EXCEPTION 'Company not found'; END IF;

  -- Delete existing live snapshots for this company
  DELETE FROM ubo_snapshots
  WHERE company_entity_id = p_company_entity_id AND workspace_id = v_ws AND snapshot_type = 'live';

  -- Recursive CTE to traverse ownership chains
  -- We build all paths from target company up to natural persons
  WITH RECURSIVE ownership_tree AS (
    -- Base: direct owners of target company
    SELECT
      el.owner_entity_id,
      e.name AS owner_name,
      e.type AS owner_type,
      el.owned_entity_id,
      oe.name AS owned_name,
      -- Economic %: shares_owned / total_shares_issued for that share class
      CASE WHEN sc.total_shares_issued > 0
        THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
        ELSE el.percentage
      END AS economic_pct,
      -- Voting %: only if voting_rights = true
      CASE WHEN sc.voting_rights = true AND sc.total_shares_issued > 0
        THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
        WHEN sc.voting_rights = false THEN 0
        ELSE el.percentage
      END AS voting_pct,
      CASE WHEN sc.total_shares_issued > 0
        THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
        ELSE el.percentage
      END AS cumulative_econ,
      CASE WHEN sc.voting_rights = true AND sc.total_shares_issued > 0
        THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
        WHEN sc.voting_rights = false THEN 0
        ELSE el.percentage
      END AS cumulative_vote,
      ARRAY[el.owner_entity_id] AS visited,
      jsonb_build_array(
        jsonb_build_object(
          'entity_id', el.owner_entity_id,
          'entity_name', e.name,
          'entity_type', e.type::text,
          'owns_pct_in_next', ROUND(CASE WHEN sc.total_shares_issued > 0
            THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
            ELSE el.percentage END, 6),
          'cumulative_pct', ROUND(CASE WHEN sc.total_shares_issued > 0
            THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
            ELSE el.percentage END, 6)
        ),
        jsonb_build_object(
          'entity_id', el.owned_entity_id,
          'entity_name', oe.name,
          'entity_type', oe.type::text,
          'owns_pct_in_next', null,
          'cumulative_pct', ROUND(CASE WHEN sc.total_shares_issued > 0
            THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
            ELSE el.percentage END, 6)
        )
      ) AS chain,
      1 AS depth,
      false AS is_circular
    FROM equity_links el
    JOIN entities e ON e.id = el.owner_entity_id
    JOIN entities oe ON oe.id = el.owned_entity_id
    LEFT JOIN share_classes sc ON sc.id = el.share_class_id
    WHERE el.owned_entity_id = p_company_entity_id
      AND el.end_date IS NULL
      AND el.workspace_id = v_ws
      AND (el.shares_owned IS NOT NULL AND el.shares_owned > 0 OR el.percentage > 0)

    UNION ALL

    -- Recursive: traverse upward through company owners
    SELECT
      el.owner_entity_id,
      e.name AS owner_name,
      e.type AS owner_type,
      ot.owner_entity_id AS owned_entity_id,
      ot.owner_name AS owned_name,
      CASE WHEN sc.total_shares_issued > 0
        THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
        ELSE el.percentage
      END AS economic_pct,
      CASE WHEN sc.voting_rights = true AND sc.total_shares_issued > 0
        THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
        WHEN sc.voting_rights = false THEN 0
        ELSE el.percentage
      END AS voting_pct,
      ot.cumulative_econ * (CASE WHEN sc.total_shares_issued > 0
        THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
        ELSE el.percentage END) / 100 AS cumulative_econ,
      ot.cumulative_vote * (CASE WHEN sc.voting_rights = true AND sc.total_shares_issued > 0
        THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
        WHEN sc.voting_rights = false THEN 0
        ELSE el.percentage END) / 100 AS cumulative_vote,
      ot.visited || el.owner_entity_id,
      jsonb_build_array(
        jsonb_build_object(
          'entity_id', el.owner_entity_id,
          'entity_name', e.name,
          'entity_type', e.type::text,
          'owns_pct_in_next', ROUND(CASE WHEN sc.total_shares_issued > 0
            THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
            ELSE el.percentage END, 6),
          'cumulative_pct', ROUND(ot.cumulative_econ * (CASE WHEN sc.total_shares_issued > 0
            THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
            ELSE el.percentage END) / 100, 6)
        )
      ) || ot.chain AS chain,
      ot.depth + 1,
      el.owner_entity_id = ANY(ot.visited)
    FROM equity_links el
    JOIN entities e ON e.id = el.owner_entity_id
    JOIN ownership_tree ot ON ot.owner_entity_id = el.owned_entity_id
    LEFT JOIN share_classes sc ON sc.id = el.share_class_id
    WHERE ot.owner_type = 'company'
      AND ot.depth < 10
      AND NOT ot.is_circular
      AND el.end_date IS NULL
      AND el.workspace_id = v_ws
      AND (el.shares_owned IS NOT NULL AND el.shares_owned > 0 OR el.percentage > 0)
  )
  -- Now aggregate: for each person at the top of a chain, sum their paths
  -- First insert individual chain records
  INSERT INTO ubo_snapshots (workspace_id, company_entity_id, person_entity_id,
    effective_economic_pct, effective_voting_pct, ownership_chain,
    is_above_threshold, circular_detected, snapshot_type)
  SELECT
    v_ws,
    p_company_entity_id,
    owner_entity_id,
    ROUND(SUM(cumulative_econ), 6),
    ROUND(SUM(cumulative_vote), 6),
    -- Take the chain from the path with highest economic %
    (SELECT ot2.chain FROM ownership_tree ot2
     WHERE ot2.owner_entity_id = ot.owner_entity_id
       AND ot2.owner_type = 'person'
       AND NOT ot2.is_circular
     ORDER BY ot2.cumulative_econ DESC LIMIT 1),
    ROUND(SUM(cumulative_econ), 6) >= 25.0 OR ROUND(SUM(cumulative_vote), 6) >= 25.0,
    bool_or(is_circular)
  FROM ownership_tree ot
  WHERE owner_type = 'person' AND NOT is_circular
  GROUP BY owner_entity_id
  HAVING SUM(cumulative_econ) > 0 OR SUM(cumulative_vote) > 0;

  -- Also insert circular detection records
  INSERT INTO ubo_snapshots (workspace_id, company_entity_id, person_entity_id,
    effective_economic_pct, effective_voting_pct, ownership_chain,
    is_above_threshold, circular_detected, snapshot_type)
  SELECT DISTINCT ON (owner_entity_id)
    v_ws,
    p_company_entity_id,
    owner_entity_id,
    0,
    0,
    chain,
    false,
    true,
    'live'
  FROM ownership_tree
  WHERE is_circular = true
  ON CONFLICT DO NOTHING;

  -- Build return value
  SELECT jsonb_agg(row_to_json(s)) INTO v_result
  FROM ubo_snapshots s
  WHERE s.company_entity_id = p_company_entity_id
    AND s.workspace_id = v_ws
    AND s.snapshot_type = 'live';

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;
