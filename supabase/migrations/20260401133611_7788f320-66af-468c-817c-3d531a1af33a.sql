
-- 1a. Schema changes to ubo_snapshots
ALTER TABLE public.ubo_snapshots
  ADD COLUMN unresolved_chain BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN terminal_entity_id UUID REFERENCES public.entities(id);

ALTER TABLE public.ubo_snapshots
  ALTER COLUMN person_entity_id DROP NOT NULL;

-- 1b. Replace calculate_ubo RPC with unresolved chain detection
CREATE OR REPLACE FUNCTION public.calculate_ubo(p_company_entity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ws UUID;
  v_result JSONB := '[]'::jsonb;
  v_company_name TEXT;
  v_terminal RECORD;
  v_downstream UUID;
BEGIN
  v_ws := get_user_workspace_id();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT name INTO v_company_name FROM entities
  WHERE id = p_company_entity_id AND workspace_id = v_ws AND type = 'company';
  IF NOT FOUND THEN RAISE EXCEPTION 'Company not found'; END IF;

  -- Delete existing live snapshots for this company
  DELETE FROM ubo_snapshots
  WHERE company_entity_id = p_company_entity_id AND workspace_id = v_ws AND snapshot_type = 'live';

  -- Recursive CTE to traverse ownership chains
  WITH RECURSIVE ownership_tree AS (
    -- Base: direct owners of target company
    SELECT
      el.owner_entity_id,
      e.name AS owner_name,
      e.type AS owner_type,
      el.owned_entity_id,
      oe.name AS owned_name,
      CASE WHEN sc.total_shares_issued > 0
        THEN (el.shares_owned::numeric / sc.total_shares_issued) * 100
        ELSE el.percentage
      END AS economic_pct,
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
  -- Insert person UBO records (aggregated)
  INSERT INTO ubo_snapshots (workspace_id, company_entity_id, person_entity_id,
    effective_economic_pct, effective_voting_pct, ownership_chain,
    is_above_threshold, circular_detected, snapshot_type, unresolved_chain)
  SELECT
    v_ws,
    p_company_entity_id,
    owner_entity_id,
    ROUND(SUM(cumulative_econ), 6),
    ROUND(SUM(cumulative_vote), 6),
    (SELECT ot2.chain FROM ownership_tree ot2
     WHERE ot2.owner_entity_id = ot.owner_entity_id
       AND ot2.owner_type = 'person'
       AND NOT ot2.is_circular
     ORDER BY ot2.cumulative_econ DESC LIMIT 1),
    ROUND(SUM(cumulative_econ), 6) >= 25.0 OR ROUND(SUM(cumulative_vote), 6) >= 25.0,
    bool_or(is_circular),
    'live',
    false
  FROM ownership_tree ot
  WHERE owner_type = 'person' AND NOT is_circular
  GROUP BY owner_entity_id
  HAVING SUM(cumulative_econ) > 0 OR SUM(cumulative_vote) > 0;

  -- Insert circular detection records
  INSERT INTO ubo_snapshots (workspace_id, company_entity_id, person_entity_id,
    effective_economic_pct, effective_voting_pct, ownership_chain,
    is_above_threshold, circular_detected, snapshot_type, unresolved_chain)
  SELECT DISTINCT ON (owner_entity_id)
    v_ws,
    p_company_entity_id,
    owner_entity_id,
    0, 0, chain, false, true, 'live', false
  FROM ownership_tree
  WHERE is_circular = true
  ON CONFLICT DO NOTHING;

  -- UNRESOLVED CHAIN DETECTION
  -- Find terminal company nodes: companies in the chain that have NO owners themselves
  FOR v_terminal IN
    SELECT DISTINCT ot.owner_entity_id AS terminal_id, ot.owner_name AS terminal_name, ot.chain
    FROM ownership_tree ot
    WHERE ot.owner_type = 'company'
      AND NOT ot.is_circular
      AND NOT EXISTS (
        SELECT 1 FROM equity_links el2
        WHERE el2.owned_entity_id = ot.owner_entity_id
          AND el2.end_date IS NULL
          AND el2.workspace_id = v_ws
          AND (el2.shares_owned > 0 OR el2.percentage > 0)
      )
  LOOP
    -- Insert unresolved record for this company
    INSERT INTO ubo_snapshots (workspace_id, company_entity_id, person_entity_id,
      effective_economic_pct, effective_voting_pct, ownership_chain,
      is_above_threshold, circular_detected, snapshot_type,
      unresolved_chain, terminal_entity_id)
    VALUES (
      v_ws, p_company_entity_id, NULL,
      0, 0, v_terminal.chain,
      false, false, 'live',
      true, v_terminal.terminal_id
    );

    -- Workspace-wide propagation: find all OTHER companies whose chains pass through this terminal company
    -- Traverse downward from terminal company through equity_links
    FOR v_downstream IN
      WITH RECURSIVE downstream AS (
        SELECT DISTINCT el.owned_entity_id AS company_id
        FROM equity_links el
        WHERE el.owner_entity_id = v_terminal.terminal_id
          AND el.end_date IS NULL
          AND el.workspace_id = v_ws
        UNION
        SELECT DISTINCT el.owned_entity_id
        FROM equity_links el
        JOIN downstream d ON d.company_id = el.owner_entity_id
        WHERE el.end_date IS NULL AND el.workspace_id = v_ws
      )
      SELECT company_id FROM downstream
      WHERE company_id <> p_company_entity_id
    LOOP
      -- Insert unresolved record for downstream company if not already present
      INSERT INTO ubo_snapshots (workspace_id, company_entity_id, person_entity_id,
        effective_economic_pct, effective_voting_pct, ownership_chain,
        is_above_threshold, circular_detected, snapshot_type,
        unresolved_chain, terminal_entity_id)
      SELECT v_ws, v_downstream, NULL, 0, 0,
        jsonb_build_array(
          jsonb_build_object('entity_id', v_terminal.terminal_id, 'entity_name', v_terminal.terminal_name, 'entity_type', 'company', 'owns_pct_in_next', null, 'cumulative_pct', 0)
        ),
        false, false, 'live', true, v_terminal.terminal_id
      WHERE NOT EXISTS (
        SELECT 1 FROM ubo_snapshots us
        WHERE us.company_entity_id = v_downstream
          AND us.terminal_entity_id = v_terminal.terminal_id
          AND us.unresolved_chain = true
          AND us.snapshot_type = 'live'
          AND us.workspace_id = v_ws
      );
    END LOOP;
  END LOOP;

  -- Build return value
  SELECT jsonb_agg(row_to_json(s)) INTO v_result
  FROM ubo_snapshots s
  WHERE s.company_entity_id = p_company_entity_id
    AND s.workspace_id = v_ws
    AND s.snapshot_type = 'live';

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

-- 1c. Auto-recalculation trigger functions

-- Helper: recalculate UBO for a company (used by triggers, runs as service role)
CREATE OR REPLACE FUNCTION public.trigger_ubo_recalculate_for_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Call calculate_ubo; errors are caught so triggers don't fail
  PERFORM calculate_ubo(p_company_id);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'UBO recalculation failed for company %: %', p_company_id, SQLERRM;
END;
$$;

-- Trigger function for equity_links changes
CREATE OR REPLACE FUNCTION public.trigger_ubo_on_equity_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_downstream UUID;
BEGIN
  -- Get the affected company
  IF TG_OP = 'DELETE' THEN
    v_company_id := OLD.owned_entity_id;
  ELSE
    v_company_id := NEW.owned_entity_id;
  END IF;

  -- Recalculate for the directly affected company
  PERFORM trigger_ubo_recalculate_for_company(v_company_id);

  -- Also recalculate for downstream companies (where this company is an owner)
  FOR v_downstream IN
    WITH RECURSIVE downstream AS (
      SELECT DISTINCT el.owned_entity_id AS cid
      FROM equity_links el
      WHERE el.owner_entity_id = v_company_id
        AND el.end_date IS NULL
        AND el.workspace_id = COALESCE(NEW.workspace_id, OLD.workspace_id)
      UNION
      SELECT DISTINCT el.owned_entity_id
      FROM equity_links el
      JOIN downstream d ON d.cid = el.owner_entity_id
      WHERE el.end_date IS NULL
        AND el.workspace_id = COALESCE(NEW.workspace_id, OLD.workspace_id)
    )
    SELECT cid FROM downstream
  LOOP
    PERFORM trigger_ubo_recalculate_for_company(v_downstream);
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Trigger function for movements (confirm/void)
CREATE OR REPLACE FUNCTION public.trigger_ubo_on_movement_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_downstream UUID;
BEGIN
  -- Only fire when confirmed_at or voided_at transitions from NULL to non-NULL
  IF (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
     OR (OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL) THEN

    PERFORM trigger_ubo_recalculate_for_company(NEW.company_entity_id);

    -- Downstream subsidiaries
    FOR v_downstream IN
      WITH RECURSIVE downstream AS (
        SELECT DISTINCT el.owned_entity_id AS cid
        FROM equity_links el
        WHERE el.owner_entity_id = NEW.company_entity_id
          AND el.end_date IS NULL AND el.workspace_id = NEW.workspace_id
        UNION
        SELECT DISTINCT el.owned_entity_id
        FROM equity_links el
        JOIN downstream d ON d.cid = el.owner_entity_id
        WHERE el.end_date IS NULL AND el.workspace_id = NEW.workspace_id
      )
      SELECT cid FROM downstream
    LOOP
      PERFORM trigger_ubo_recalculate_for_company(v_downstream);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger function for share_classes voting_rights change
CREATE OR REPLACE FUNCTION public.trigger_ubo_on_voting_rights()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.voting_rights IS DISTINCT FROM NEW.voting_rights THEN
    PERFORM trigger_ubo_recalculate_for_company(NEW.company_entity_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Attach triggers
CREATE TRIGGER ubo_recalc_equity_links
  AFTER INSERT OR UPDATE OR DELETE ON public.equity_links
  FOR EACH ROW EXECUTE FUNCTION public.trigger_ubo_on_equity_links();

CREATE TRIGGER ubo_recalc_movement_status
  AFTER UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.trigger_ubo_on_movement_status();

CREATE TRIGGER ubo_recalc_voting_rights
  AFTER UPDATE ON public.share_classes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_ubo_on_voting_rights();
