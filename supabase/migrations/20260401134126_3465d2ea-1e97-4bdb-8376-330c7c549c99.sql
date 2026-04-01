
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

  -- Create temp table for CTE results
  CREATE TEMP TABLE IF NOT EXISTS _ubo_tree (
    owner_entity_id UUID,
    owner_name TEXT,
    owner_type TEXT,
    owned_entity_id UUID,
    owned_name TEXT,
    economic_pct NUMERIC,
    voting_pct NUMERIC,
    cumulative_econ NUMERIC,
    cumulative_vote NUMERIC,
    visited UUID[],
    chain JSONB,
    depth INT,
    is_circular BOOLEAN
  ) ON COMMIT DROP;

  TRUNCATE _ubo_tree;

  -- Populate with recursive traversal
  INSERT INTO _ubo_tree
  WITH RECURSIVE ownership_tree AS (
    SELECT
      el.owner_entity_id,
      e.name AS owner_name,
      e.type::text AS owner_type,
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
      e.type::text AS owner_type,
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
  SELECT * FROM ownership_tree;

  -- Insert person UBO records (aggregated)
  INSERT INTO ubo_snapshots (workspace_id, company_entity_id, person_entity_id,
    effective_economic_pct, effective_voting_pct, ownership_chain,
    is_above_threshold, circular_detected, snapshot_type, unresolved_chain)
  SELECT
    v_ws,
    p_company_entity_id,
    ot.owner_entity_id,
    ROUND(SUM(ot.cumulative_econ), 6),
    ROUND(SUM(ot.cumulative_vote), 6),
    (SELECT ot2.chain FROM _ubo_tree ot2
     WHERE ot2.owner_entity_id = ot.owner_entity_id
       AND ot2.owner_type = 'person'
       AND NOT ot2.is_circular
     ORDER BY ot2.cumulative_econ DESC LIMIT 1),
    ROUND(SUM(ot.cumulative_econ), 6) >= 25.0 OR ROUND(SUM(ot.cumulative_vote), 6) >= 25.0,
    bool_or(ot.is_circular),
    'live',
    false
  FROM _ubo_tree ot
  WHERE ot.owner_type = 'person' AND NOT ot.is_circular
  GROUP BY ot.owner_entity_id
  HAVING SUM(ot.cumulative_econ) > 0 OR SUM(ot.cumulative_vote) > 0;

  -- Insert circular detection records
  INSERT INTO ubo_snapshots (workspace_id, company_entity_id, person_entity_id,
    effective_economic_pct, effective_voting_pct, ownership_chain,
    is_above_threshold, circular_detected, snapshot_type, unresolved_chain)
  SELECT DISTINCT ON (owner_entity_id)
    v_ws,
    p_company_entity_id,
    owner_entity_id,
    0, 0, chain, false, true, 'live', false
  FROM _ubo_tree
  WHERE is_circular = true
  ON CONFLICT DO NOTHING;

  -- UNRESOLVED CHAIN DETECTION
  FOR v_terminal IN
    SELECT DISTINCT ot.owner_entity_id AS terminal_id, ot.owner_name AS terminal_name, ot.chain
    FROM _ubo_tree ot
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

    -- Workspace-wide propagation
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
