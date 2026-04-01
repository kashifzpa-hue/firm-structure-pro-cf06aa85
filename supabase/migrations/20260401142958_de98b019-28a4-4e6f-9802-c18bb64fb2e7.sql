ALTER TABLE public.ubo_snapshots
  ADD COLUMN IF NOT EXISTS calculation_error BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS error_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_ubo_snapshots_calculation_error
  ON public.ubo_snapshots (workspace_id, snapshot_type, calculation_error);

CREATE OR REPLACE FUNCTION public.validate_equity_link_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_issued INTEGER;
  v_allocated INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.shares_owned IS NOT NULL AND NEW.shares_owned < 0 THEN
    RAISE EXCEPTION 'Shares owned cannot be negative';
  END IF;

  IF NEW.share_class_id IS NULL OR NEW.shares_owned IS NULL OR NEW.end_date IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT total_shares_issued INTO v_total_issued
  FROM public.share_classes
  WHERE id = NEW.share_class_id
    AND company_entity_id = NEW.owned_entity_id
    AND workspace_id = NEW.workspace_id;

  IF v_total_issued IS NULL THEN
    RAISE EXCEPTION 'Selected share class does not belong to this company';
  END IF;

  SELECT COALESCE(SUM(el.shares_owned), 0) INTO v_allocated
  FROM public.equity_links el
  WHERE el.workspace_id = NEW.workspace_id
    AND el.owned_entity_id = NEW.owned_entity_id
    AND el.share_class_id = NEW.share_class_id
    AND el.end_date IS NULL
    AND (TG_OP <> 'UPDATE' OR el.id <> NEW.id);

  v_allocated := v_allocated + NEW.shares_owned;

  IF v_allocated > v_total_issued THEN
    RAISE EXCEPTION 'Total allocated shares (%) cannot exceed issued shares (%) for this share class', v_allocated, v_total_issued;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_equity_link_allocation_trigger ON public.equity_links;
CREATE TRIGGER validate_equity_link_allocation_trigger
BEFORE INSERT OR UPDATE OF owner_entity_id, owned_entity_id, share_class_id, shares_owned, end_date, workspace_id
ON public.equity_links
FOR EACH ROW
EXECUTE FUNCTION public.validate_equity_link_allocation();

CREATE OR REPLACE FUNCTION public.validate_share_class_total_shares()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_allocated INTEGER;
BEGIN
  SELECT COALESCE(SUM(el.shares_owned), 0) INTO v_allocated
  FROM public.equity_links el
  WHERE el.workspace_id = NEW.workspace_id
    AND el.owned_entity_id = NEW.company_entity_id
    AND el.share_class_id = NEW.id
    AND el.end_date IS NULL;

  IF NEW.total_shares_issued < v_allocated THEN
    RAISE EXCEPTION 'Issued shares (%) cannot be less than allocated shares (%) for this share class', NEW.total_shares_issued, v_allocated;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_share_class_total_shares_trigger ON public.share_classes;
CREATE TRIGGER validate_share_class_total_shares_trigger
BEFORE UPDATE OF total_shares_issued
ON public.share_classes
FOR EACH ROW
EXECUTE FUNCTION public.validate_share_class_total_shares();

CREATE OR REPLACE FUNCTION public.confirm_movement(p_movement_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov RECORD;
  v_ws UUID;
  v_total_issued INTEGER;
  v_existing_link_id UUID;
  v_existing_shares INTEGER;
BEGIN
  v_ws := get_user_workspace_id();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_mov FROM movements WHERE id = p_movement_id AND workspace_id = v_ws;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movement not found'; END IF;
  IF v_mov.status <> 'draft' THEN RAISE EXCEPTION 'Only draft movements can be confirmed'; END IF;

  IF v_mov.movement_type IN ('TRANSFER', 'INHERITANCE', 'GIFT', 'COURT_ORDER') THEN
    UPDATE equity_links
      SET shares_owned = shares_owned - v_mov.shares_transferred
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;

    IF NOT FOUND THEN RAISE EXCEPTION 'Seller equity link not found'; END IF;

    UPDATE equity_links
      SET end_date = v_mov.movement_date
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND shares_owned = 0
      AND workspace_id = v_ws;

    SELECT id, shares_owned INTO v_existing_link_id, v_existing_shares
    FROM equity_links
    WHERE owner_entity_id = v_mov.to_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;

    IF v_existing_link_id IS NOT NULL THEN
      UPDATE equity_links SET shares_owned = v_existing_shares + v_mov.shares_transferred
      WHERE id = v_existing_link_id;
    ELSE
      INSERT INTO equity_links (workspace_id, owner_entity_id, owned_entity_id, share_class_id, shares_owned, percentage, effective_date)
      VALUES (v_ws, v_mov.to_entity_id, v_mov.company_entity_id, v_mov.share_class_id, v_mov.shares_transferred, 0, v_mov.movement_date);
    END IF;

  ELSIF v_mov.movement_type = 'ISSUANCE' THEN
    SELECT id, shares_owned INTO v_existing_link_id, v_existing_shares
    FROM equity_links
    WHERE owner_entity_id = v_mov.to_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;

    IF v_existing_link_id IS NOT NULL THEN
      UPDATE equity_links SET shares_owned = v_existing_shares + v_mov.shares_transferred
      WHERE id = v_existing_link_id;
    ELSE
      INSERT INTO equity_links (workspace_id, owner_entity_id, owned_entity_id, share_class_id, shares_owned, percentage, effective_date)
      VALUES (v_ws, v_mov.to_entity_id, v_mov.company_entity_id, v_mov.share_class_id, v_mov.shares_transferred, 0, v_mov.movement_date);
    END IF;

  ELSIF v_mov.movement_type = 'CANCELLATION' THEN
    UPDATE equity_links
      SET shares_owned = shares_owned - v_mov.shares_transferred
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;

    IF NOT FOUND THEN RAISE EXCEPTION 'Holder equity link not found'; END IF;

    UPDATE equity_links
      SET end_date = v_mov.movement_date
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND shares_owned = 0
      AND workspace_id = v_ws;

  ELSIF v_mov.movement_type = 'CAPITAL_INCREASE' THEN
    UPDATE share_classes
      SET total_shares_issued = total_shares_issued + v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

    SELECT id, shares_owned INTO v_existing_link_id, v_existing_shares
    FROM equity_links
    WHERE owner_entity_id = v_mov.to_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;

    IF v_existing_link_id IS NOT NULL THEN
      UPDATE equity_links SET shares_owned = v_existing_shares + v_mov.shares_transferred
      WHERE id = v_existing_link_id;
    ELSE
      INSERT INTO equity_links (workspace_id, owner_entity_id, owned_entity_id, share_class_id, shares_owned, percentage, effective_date)
      VALUES (v_ws, v_mov.to_entity_id, v_mov.company_entity_id, v_mov.share_class_id, v_mov.shares_transferred, 0, v_mov.movement_date);
    END IF;

  ELSIF v_mov.movement_type = 'CAPITAL_DECREASE' THEN
    UPDATE equity_links
      SET shares_owned = shares_owned - v_mov.shares_transferred
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;

    IF NOT FOUND THEN RAISE EXCEPTION 'Holder equity link not found'; END IF;

    UPDATE equity_links
      SET end_date = v_mov.movement_date
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND shares_owned = 0
      AND workspace_id = v_ws;

    UPDATE share_classes
      SET total_shares_issued = total_shares_issued - v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;
  END IF;

  SELECT total_shares_issued INTO v_total_issued
  FROM share_classes WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

  IF v_total_issued > 0 THEN
    UPDATE equity_links
      SET percentage = (shares_owned::numeric / v_total_issued) * 100
    WHERE owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;
  END IF;

  UPDATE movements SET status = 'confirmed', confirmed_at = now()
  WHERE id = p_movement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_ubo(p_company_entity_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    voting_pct NUMERIC
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
    is_circular BOOLEAN
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
      END AS voting_pct
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
      el.owner_entity_id,
      owner.name,
      owner.type,
      el.owned_entity_id,
      owned.name,
      owned.type,
      ct.total_economic_shares,
      ct.total_voting_shares
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
      ROUND(SUM(el.percentage), 6) AS voting_pct
    FROM public.equity_links el
    JOIN public.entities owner ON owner.id = el.owner_entity_id
    JOIN public.entities owned ON owned.id = el.owned_entity_id
    WHERE el.workspace_id = v_ws
      AND el.end_date IS NULL
      AND el.share_class_id IS NULL
      AND COALESCE(el.percentage, 0) > 0
    GROUP BY
      el.owner_entity_id,
      owner.name,
      owner.type,
      el.owned_entity_id,
      owned.name,
      owned.type
  ),
  combined_links AS (
    SELECT * FROM share_based_links
    UNION ALL
    SELECT * FROM legacy_links
  )
  SELECT
    owner_entity_id,
    owner_name,
    owner_type,
    owned_entity_id,
    owned_name,
    owned_type,
    ROUND(SUM(economic_pct), 6) AS economic_pct,
    ROUND(SUM(voting_pct), 6) AS voting_pct
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
      FALSE AS is_circular
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
      dl.owner_entity_id = ANY(ot.visited)
    FROM _ubo_direct_links dl
    JOIN ownership_tree ot ON ot.owner_entity_id = dl.owned_entity_id
    WHERE ot.owner_type = 'company'
      AND ot.depth < 10
      AND NOT ot.is_circular
  )
  SELECT * FROM ownership_tree;

  INSERT INTO ubo_snapshots (
    workspace_id,
    company_entity_id,
    person_entity_id,
    effective_economic_pct,
    effective_voting_pct,
    ownership_chain,
    is_above_threshold,
    circular_detected,
    snapshot_type,
    unresolved_chain,
    terminal_entity_id,
    calculation_error,
    error_reason
  )
  SELECT
    v_ws,
    p_company_entity_id,
    ot.owner_entity_id,
    ROUND(SUM(ot.cumulative_econ), 6),
    ROUND(SUM(ot.cumulative_vote), 6),
    (
      SELECT ot2.chain
      FROM _ubo_tree ot2
      WHERE ot2.owner_entity_id = ot.owner_entity_id
        AND ot2.owner_type = 'person'
        AND NOT ot2.is_circular
      ORDER BY ot2.cumulative_econ DESC
      LIMIT 1
    ),
    CASE
      WHEN ROUND(SUM(ot.cumulative_econ), 6) > 100 OR ROUND(SUM(ot.cumulative_vote), 6) > 100 THEN FALSE
      ELSE ROUND(SUM(ot.cumulative_econ), 6) >= 25.0 OR ROUND(SUM(ot.cumulative_vote), 6) >= 25.0
    END,
    FALSE,
    'live',
    FALSE,
    NULL,
    CASE
      WHEN ROUND(SUM(ot.cumulative_econ), 6) > 100 OR ROUND(SUM(ot.cumulative_vote), 6) > 100 THEN TRUE
      ELSE FALSE
    END,
    CASE
      WHEN ROUND(SUM(ot.cumulative_econ), 6) > 100 OR ROUND(SUM(ot.cumulative_vote), 6) > 100
        THEN 'Input data error — total ownership exceeds 100%. Check equity links for ' || v_company_name || '.'
      ELSE NULL
    END
  FROM _ubo_tree ot
  WHERE ot.owner_type = 'person'
    AND NOT ot.is_circular
  GROUP BY ot.owner_entity_id
  HAVING SUM(ot.cumulative_econ) > 0 OR SUM(ot.cumulative_vote) > 0;

  INSERT INTO ubo_snapshots (
    workspace_id,
    company_entity_id,
    person_entity_id,
    effective_economic_pct,
    effective_voting_pct,
    ownership_chain,
    is_above_threshold,
    circular_detected,
    snapshot_type,
    unresolved_chain,
    terminal_entity_id,
    calculation_error,
    error_reason
  )
  SELECT DISTINCT ON (owner_entity_id)
    v_ws,
    p_company_entity_id,
    owner_entity_id,
    0,
    0,
    chain,
    FALSE,
    TRUE,
    'live',
    FALSE,
    NULL,
    FALSE,
    NULL
  FROM _ubo_tree
  WHERE is_circular = TRUE;

  FOR v_terminal IN
    SELECT DISTINCT
      ot.owner_entity_id AS terminal_id,
      ot.owner_name AS terminal_name,
      ot.chain
    FROM _ubo_tree ot
    WHERE ot.owner_type = 'company'
      AND NOT ot.is_circular
      AND NOT EXISTS (
        SELECT 1
        FROM _ubo_direct_links dl2
        WHERE dl2.owned_entity_id = ot.owner_entity_id
      )
  LOOP
    INSERT INTO ubo_snapshots (
      workspace_id,
      company_entity_id,
      person_entity_id,
      effective_economic_pct,
      effective_voting_pct,
      ownership_chain,
      is_above_threshold,
      circular_detected,
      snapshot_type,
      unresolved_chain,
      terminal_entity_id,
      calculation_error,
      error_reason
    )
    SELECT
      v_ws,
      p_company_entity_id,
      NULL,
      0,
      0,
      v_terminal.chain,
      FALSE,
      FALSE,
      'live',
      TRUE,
      v_terminal.terminal_id,
      FALSE,
      NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM ubo_snapshots us
      WHERE us.workspace_id = v_ws
        AND us.snapshot_type = 'live'
        AND us.company_entity_id = p_company_entity_id
        AND us.unresolved_chain = TRUE
        AND us.terminal_entity_id = v_terminal.terminal_id
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
      SELECT company_id
      FROM downstream
      WHERE company_id <> p_company_entity_id
    LOOP
      INSERT INTO ubo_snapshots (
        workspace_id,
        company_entity_id,
        person_entity_id,
        effective_economic_pct,
        effective_voting_pct,
        ownership_chain,
        is_above_threshold,
        circular_detected,
        snapshot_type,
        unresolved_chain,
        terminal_entity_id,
        calculation_error,
        error_reason
      )
      SELECT
        v_ws,
        v_downstream,
        NULL,
        0,
        0,
        jsonb_build_array(
          jsonb_build_object(
            'entity_id', v_terminal.terminal_id,
            'entity_name', v_terminal.terminal_name,
            'entity_type', 'company',
            'owns_pct_in_next', NULL,
            'cumulative_pct', 0
          )
        ),
        FALSE,
        FALSE,
        'live',
        TRUE,
        v_terminal.terminal_id,
        FALSE,
        NULL
      WHERE NOT EXISTS (
        SELECT 1
        FROM ubo_snapshots us
        WHERE us.company_entity_id = v_downstream
          AND us.terminal_entity_id = v_terminal.terminal_id
          AND us.unresolved_chain = TRUE
          AND us.snapshot_type = 'live'
          AND us.workspace_id = v_ws
      );
    END LOOP;
  END LOOP;

  SELECT jsonb_agg(row_to_json(s)) INTO v_result
  FROM ubo_snapshots s
  WHERE s.company_entity_id = p_company_entity_id
    AND s.workspace_id = v_ws
    AND s.snapshot_type = 'live';

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;