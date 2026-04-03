
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

  SELECT name INTO v_company_name
  FROM entities
  WHERE id = p_company_entity_id
    AND workspace_id = v_ws
    AND type = 'company';

  IF NOT FOUND THEN RAISE EXCEPTION 'Company not found'; END IF;

  DELETE FROM ubo_snapshots
  WHERE company_entity_id = p_company_entity_id
    AND workspace_id = v_ws
    AND snapshot_type = 'live';

  CREATE TEMP TABLE IF NOT EXISTS _ubo_direct_links (
    owner_entity_id UUID,
    owner_name TEXT,
    owner_type TEXT,
    owned_entity_id UUID,
    owned_name TEXT,
    owned_type TEXT,
    economic_pct NUMERIC,
    voting_pct NUMERIC,
    has_circular_exception BOOLEAN
  ) ON COMMIT DROP;

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
    is_circular BOOLEAN,
    circular_has_exception BOOLEAN
  ) ON COMMIT DROP;

  TRUNCATE _ubo_direct_links;
  TRUNCATE _ubo_tree;

  INSERT INTO _ubo_direct_links
  WITH company_totals AS (
    SELECT
      sc.company_entity_id,
      SUM(sc.total_shares_issued)::NUMERIC AS total_economic_shares,
      SUM(CASE WHEN sc.voting_rights THEN sc.total_shares_issued ELSE 0 END)::NUMERIC AS total_voting_shares
    FROM public.share_classes sc
    WHERE sc.workspace_id = v_ws
    GROUP BY sc.company_entity_id
  ),
  share_based_links AS (
    SELECT
      el.owner_entity_id,
      owner.name AS owner_name,
      owner.type::TEXT AS owner_type,
      el.owned_entity_id,
      owned.name AS owned_name,
      owned.type::TEXT AS owned_type,
      ROUND((SUM(el.shares_owned)::NUMERIC / NULLIF(ct.total_economic_shares, 0)) * 100, 6) AS economic_pct,
      CASE
        WHEN COALESCE(ct.total_voting_shares, 0) > 0
          THEN ROUND((SUM(CASE WHEN sc.voting_rights THEN el.shares_owned ELSE 0 END)::NUMERIC / ct.total_voting_shares) * 100, 6)
        ELSE 0::NUMERIC
      END AS voting_pct,
      bool_or(el.circular_ownership_type IS NOT NULL) AS has_circular_exception
    FROM public.equity_links el
    JOIN public.entities owner ON owner.id = el.owner_entity_id
    JOIN public.entities owned ON owned.id = el.owned_entity_id
    JOIN public.share_classes sc ON sc.id = el.share_class_id
    JOIN company_totals ct ON ct.company_entity_id = el.owned_entity_id
    WHERE el.workspace_id = v_ws
      AND el.end_date IS NULL
      AND el.share_class_id IS NOT NULL
      AND COALESCE(el.shares_owned, 0) > 0
    GROUP BY
      el.owner_entity_id, owner.name, owner.type,
      el.owned_entity_id, owned.name, owned.type,
      ct.total_economic_shares, ct.total_voting_shares
  ),
  legacy_links AS (
    SELECT
      el.owner_entity_id,
      owner.name AS owner_name,
      owner.type::TEXT AS owner_type,
      el.owned_entity_id,
      owned.name AS owned_name,
      owned.type::TEXT AS owned_type,
      ROUND(SUM(el.percentage), 6) AS economic_pct,
      ROUND(SUM(el.percentage), 6) AS voting_pct,
      bool_or(el.circular_ownership_type IS NOT NULL) AS has_circular_exception
    FROM public.equity_links el
    JOIN public.entities owner ON owner.id = el.owner_entity_id
    JOIN public.entities owned ON owned.id = el.owned_entity_id
    WHERE el.workspace_id = v_ws
      AND el.end_date IS NULL
      AND el.share_class_id IS NULL
      AND COALESCE(el.percentage, 0) > 0
    GROUP BY
      el.owner_entity_id, owner.name, owner.type,
      el.owned_entity_id, owned.name, owned.type
  ),
  combined_links AS (
    SELECT * FROM share_based_links
    UNION ALL
    SELECT * FROM legacy_links
  )
  SELECT
    owner_entity_id, owner_name, owner_type,
    owned_entity_id, owned_name, owned_type,
    ROUND(SUM(economic_pct), 6) AS economic_pct,
    ROUND(SUM(voting_pct), 6) AS voting_pct,
    bool_or(has_circular_exception) AS has_circular_exception
  FROM combined_links
  GROUP BY owner_entity_id, owner_name, owner_type, owned_entity_id, owned_name, owned_type
  HAVING SUM(economic_pct) > 0 OR SUM(voting_pct) > 0;

  INSERT INTO _ubo_tree
  WITH RECURSIVE ownership_tree AS (
    SELECT
      dl.owner_entity_id,
      dl.owner_name,
      dl.owner_type,
      dl.owned_entity_id,
      dl.owned_name,
      dl.economic_pct,
      dl.voting_pct,
      dl.economic_pct AS cumulative_econ,
      dl.voting_pct AS cumulative_vote,
      ARRAY[dl.owner_entity_id] AS visited,
      jsonb_build_array(
        jsonb_build_object(
          'entity_id', dl.owner_entity_id,
          'entity_name', dl.owner_name,
          'entity_type', dl.owner_type,
          'owns_pct_in_next', ROUND(dl.economic_pct, 6),
          'cumulative_pct', ROUND(dl.economic_pct, 6)
        ),
        jsonb_build_object(
          'entity_id', dl.owned_entity_id,
          'entity_name', dl.owned_name,
          'entity_type', dl.owned_type,
          'owns_pct_in_next', NULL,
          'cumulative_pct', ROUND(dl.economic_pct, 6)
        )
      ) AS chain,
      1 AS depth,
      FALSE AS is_circular,
      FALSE AS circular_has_exception
    FROM _ubo_direct_links dl
    WHERE dl.owned_entity_id = p_company_entity_id

    UNION ALL

    SELECT
      dl.owner_entity_id,
      dl.owner_name,
      dl.owner_type,
      ot.owner_entity_id AS owned_entity_id,
      ot.owner_name AS owned_name,
      dl.economic_pct,
      dl.voting_pct,
      ot.cumulative_econ * dl.economic_pct / 100,
      ot.cumulative_vote * dl.voting_pct / 100,
      ot.visited || dl.owner_entity_id,
      jsonb_build_array(
        jsonb_build_object(
          'entity_id', dl.owner_entity_id,
          'entity_name', dl.owner_name,
          'entity_type', dl.owner_type,
          'owns_pct_in_next', ROUND(dl.economic_pct, 6),
          'cumulative_pct', ROUND(ot.cumulative_econ * dl.economic_pct / 100, 6)
        )
      ) || ot.chain,
      ot.depth + 1,
      dl.owner_entity_id = ANY(ot.visited),
      CASE WHEN dl.owner_entity_id = ANY(ot.visited) THEN dl.has_circular_exception ELSE FALSE END
    FROM _ubo_direct_links dl
    JOIN ownership_tree ot ON ot.owner_entity_id = dl.owned_entity_id
    WHERE ot.owner_type = 'company'
      AND ot.depth < 10
      AND NOT ot.is_circular
  )
  SELECT * FROM ownership_tree;

  -- Insert person UBO snapshots (non-circular paths)
  INSERT INTO ubo_snapshots (
    workspace_id, company_entity_id, person_entity_id,
    effective_economic_pct, effective_voting_pct, ownership_chain,
    is_above_threshold, circular_detected, snapshot_type,
    unresolved_chain, terminal_entity_id, calculation_error, error_reason,
    circular_type
  )
  SELECT
    v_ws, p_company_entity_id, ot.owner_entity_id,
    ROUND(SUM(ot.cumulative_econ), 6),
    ROUND(SUM(ot.cumulative_vote), 6),
    (SELECT ot2.chain FROM _ubo_tree ot2
     WHERE ot2.owner_entity_id = ot.owner_entity_id
       AND ot2.owner_type = 'person' AND NOT ot2.is_circular
     ORDER BY ot2.cumulative_econ DESC LIMIT 1),
    CASE
      WHEN ROUND(SUM(ot.cumulative_econ), 6) > 100 OR ROUND(SUM(ot.cumulative_vote), 6) > 100 THEN FALSE
      ELSE ROUND(SUM(ot.cumulative_econ), 6) >= 25.0 OR ROUND(SUM(ot.cumulative_vote), 6) >= 25.0
    END,
    FALSE, 'live', FALSE, NULL,
    CASE
      WHEN ROUND(SUM(ot.cumulative_econ), 6) > 100 OR ROUND(SUM(ot.cumulative_vote), 6) > 100 THEN TRUE
      ELSE FALSE
    END,
    CASE
      WHEN ROUND(SUM(ot.cumulative_econ), 6) > 100 OR ROUND(SUM(ot.cumulative_vote), 6) > 100
        THEN 'Input data error — total ownership exceeds 100%. Check equity links for ' || v_company_name || '.'
      ELSE NULL
    END,
    NULL
  FROM _ubo_tree ot
  WHERE ot.owner_type = 'person' AND NOT ot.is_circular
  GROUP BY ot.owner_entity_id
  HAVING SUM(ot.cumulative_econ) > 0 OR SUM(ot.cumulative_vote) > 0;

  -- Insert circular ownership snapshots with proper circular_type
  INSERT INTO ubo_snapshots (
    workspace_id, company_entity_id, person_entity_id,
    effective_economic_pct, effective_voting_pct, ownership_chain,
    is_above_threshold, circular_detected, snapshot_type,
    unresolved_chain, terminal_entity_id, calculation_error, error_reason,
    circular_type
  )
  SELECT DISTINCT ON (owner_entity_id)
    v_ws, p_company_entity_id, owner_entity_id,
    0, 0, chain, FALSE, TRUE, 'live', FALSE, NULL,
    CASE WHEN NOT circular_has_exception THEN TRUE ELSE FALSE END,
    CASE WHEN NOT circular_has_exception
      THEN 'Illegal circular ownership detected — no legal exception recorded.'
      ELSE NULL
    END,
    CASE WHEN circular_has_exception THEN 'legal_exception'::circular_type
         ELSE 'illegal'::circular_type
    END
  FROM _ubo_tree
  WHERE is_circular = TRUE;

  -- Insert unresolved chain snapshots
  FOR v_terminal IN
    SELECT DISTINCT
      ot.owner_entity_id AS terminal_id,
      ot.owner_name AS terminal_name,
      ot.chain
    FROM _ubo_tree ot
    WHERE ot.owner_type = 'company'
      AND NOT ot.is_circular
      AND NOT EXISTS (
        SELECT 1 FROM _ubo_direct_links dl2
        WHERE dl2.owned_entity_id = ot.owner_entity_id
      )
  LOOP
    INSERT INTO ubo_snapshots (
      workspace_id, company_entity_id, person_entity_id,
      effective_economic_pct, effective_voting_pct, ownership_chain,
      is_above_threshold, circular_detected, snapshot_type,
      unresolved_chain, terminal_entity_id, calculation_error, error_reason,
      circular_type
    )
    SELECT v_ws, p_company_entity_id, NULL,
      0, 0, v_terminal.chain, FALSE, FALSE, 'live',
      TRUE, v_terminal.terminal_id, FALSE, NULL, NULL
    WHERE NOT EXISTS (
      SELECT 1 FROM ubo_snapshots us
      WHERE us.workspace_id = v_ws AND us.snapshot_type = 'live'
        AND us.company_entity_id = p_company_entity_id
        AND us.unresolved_chain = TRUE AND us.terminal_entity_id = v_terminal.terminal_id
    );

    FOR v_downstream IN
      WITH RECURSIVE downstream AS (
        SELECT DISTINCT dl.owned_entity_id AS company_id
        FROM _ubo_direct_links dl
        WHERE dl.owner_entity_id = v_terminal.terminal_id
        UNION
        SELECT DISTINCT dl.owned_entity_id
        FROM _ubo_direct_links dl
        JOIN downstream d ON d.company_id = dl.owner_entity_id
      )
      SELECT company_id FROM downstream
      WHERE company_id <> p_company_entity_id
    LOOP
      INSERT INTO ubo_snapshots (
        workspace_id, company_entity_id, person_entity_id,
        effective_economic_pct, effective_voting_pct, ownership_chain,
        is_above_threshold, circular_detected, snapshot_type,
        unresolved_chain, terminal_entity_id, calculation_error, error_reason,
        circular_type
      )
      SELECT v_ws, v_downstream, NULL,
        0, 0,
        jsonb_build_array(jsonb_build_object(
          'entity_id', v_terminal.terminal_id,
          'entity_name', v_terminal.terminal_name,
          'entity_type', 'company',
          'owns_pct_in_next', NULL, 'cumulative_pct', 0
        )),
        FALSE, FALSE, 'live', TRUE, v_terminal.terminal_id, FALSE, NULL, NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM ubo_snapshots us
        WHERE us.company_entity_id = v_downstream
          AND us.terminal_entity_id = v_terminal.terminal_id
          AND us.unresolved_chain = TRUE AND us.snapshot_type = 'live'
          AND us.workspace_id = v_ws
      );
    END LOOP;
  END LOOP;

  SELECT jsonb_agg(row_to_json(s)) INTO v_result
  FROM ubo_snapshots s
  WHERE s.company_entity_id = p_company_entity_id
    AND s.workspace_id = v_ws AND s.snapshot_type = 'live';

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;
