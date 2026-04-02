
CREATE OR REPLACE FUNCTION public.void_movement(p_movement_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mov RECORD;
  v_ws UUID;
  v_total_issued INTEGER;
  v_existing_link_id UUID;
  v_existing_shares INTEGER;
  v_subsequent_count INTEGER;
BEGIN
  v_ws := get_user_workspace_id();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_mov FROM movements WHERE id = p_movement_id AND workspace_id = v_ws;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movement not found'; END IF;
  IF v_mov.status <> 'confirmed' THEN RAISE EXCEPTION 'Only confirmed movements can be voided'; END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN RAISE EXCEPTION 'Void reason is required'; END IF;

  SELECT COUNT(*) INTO v_subsequent_count
  FROM movements
  WHERE status = 'confirmed'
    AND company_entity_id = v_mov.company_entity_id
    AND share_class_id = v_mov.share_class_id
    AND from_entity_id = v_mov.to_entity_id
    AND movement_date > v_mov.movement_date
    AND workspace_id = v_ws;

  IF v_subsequent_count > 0 THEN
    RAISE EXCEPTION 'Cannot void: there are % subsequent confirmed movement(s) that depend on this transfer', v_subsequent_count;
  END IF;

  IF v_mov.movement_type IN ('TRANSFER', 'INHERITANCE', 'GIFT', 'COURT_ORDER') THEN
    -- FIRST: Reduce buyer (frees up allocation room)
    UPDATE equity_links
      SET shares_owned = shares_owned - v_mov.shares_transferred
    WHERE owner_entity_id = v_mov.to_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;

    -- Close buyer link if zero
    UPDATE equity_links
      SET end_date = v_mov.movement_date
    WHERE owner_entity_id = v_mov.to_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND shares_owned = 0
      AND workspace_id = v_ws;

    -- THEN: Restore seller
    SELECT id, shares_owned INTO v_existing_link_id, v_existing_shares
    FROM equity_links
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND workspace_id = v_ws
    ORDER BY end_date NULLS FIRST LIMIT 1;

    IF v_existing_link_id IS NOT NULL THEN
      UPDATE equity_links SET shares_owned = COALESCE(v_existing_shares, 0) + v_mov.shares_transferred, end_date = NULL
      WHERE id = v_existing_link_id;
    ELSE
      INSERT INTO equity_links (workspace_id, owner_entity_id, owned_entity_id, share_class_id, shares_owned, percentage, effective_date)
      VALUES (v_ws, v_mov.from_entity_id, v_mov.company_entity_id, v_mov.share_class_id, v_mov.shares_transferred, 0, v_mov.movement_date);
    END IF;

  ELSIF v_mov.movement_type = 'ISSUANCE' THEN
    UPDATE equity_links
      SET shares_owned = shares_owned - v_mov.shares_transferred
    WHERE owner_entity_id = v_mov.to_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;

    UPDATE equity_links
      SET end_date = v_mov.movement_date
    WHERE owner_entity_id = v_mov.to_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND shares_owned = 0
      AND workspace_id = v_ws;

  ELSIF v_mov.movement_type = 'CANCELLATION' THEN
    -- Reverse: increase total first, then restore holder shares
    UPDATE share_classes
      SET total_shares_issued = total_shares_issued + v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

    SELECT id, shares_owned INTO v_existing_link_id, v_existing_shares
    FROM equity_links
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND workspace_id = v_ws
    ORDER BY end_date NULLS FIRST LIMIT 1;

    IF v_existing_link_id IS NOT NULL THEN
      UPDATE equity_links SET shares_owned = COALESCE(v_existing_shares, 0) + v_mov.shares_transferred, end_date = NULL
      WHERE id = v_existing_link_id;
    ELSE
      INSERT INTO equity_links (workspace_id, owner_entity_id, owned_entity_id, share_class_id, shares_owned, percentage, effective_date)
      VALUES (v_ws, v_mov.from_entity_id, v_mov.company_entity_id, v_mov.share_class_id, v_mov.shares_transferred, 0, v_mov.movement_date);
    END IF;

  ELSIF v_mov.movement_type = 'CAPITAL_INCREASE' THEN
    -- Reduce recipient first, then decrease total
    IF v_mov.to_entity_id IS NOT NULL THEN
      UPDATE equity_links
        SET shares_owned = shares_owned - v_mov.shares_transferred
      WHERE owner_entity_id = v_mov.to_entity_id
        AND owned_entity_id = v_mov.company_entity_id
        AND share_class_id = v_mov.share_class_id
        AND end_date IS NULL
        AND workspace_id = v_ws;

      UPDATE equity_links
        SET end_date = v_mov.movement_date
      WHERE owner_entity_id = v_mov.to_entity_id
        AND owned_entity_id = v_mov.company_entity_id
        AND share_class_id = v_mov.share_class_id
        AND end_date IS NULL
        AND shares_owned = 0
        AND workspace_id = v_ws;
    END IF;

    UPDATE share_classes
      SET total_shares_issued = total_shares_issued - v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

  ELSIF v_mov.movement_type = 'CAPITAL_DECREASE' THEN
    IF v_mov.from_entity_id IS NULL THEN
      UPDATE share_classes
        SET total_shares_issued = total_shares_issued + v_mov.shares_transferred
      WHERE id = v_mov.share_class_id AND workspace_id = v_ws;
    ELSE
      -- Increase total first, then restore holder
      UPDATE share_classes
        SET total_shares_issued = total_shares_issued + v_mov.shares_transferred
      WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

      SELECT id, shares_owned INTO v_existing_link_id, v_existing_shares
      FROM equity_links
      WHERE owner_entity_id = v_mov.from_entity_id
        AND owned_entity_id = v_mov.company_entity_id
        AND share_class_id = v_mov.share_class_id
        AND workspace_id = v_ws
      ORDER BY end_date NULLS FIRST LIMIT 1;

      IF v_existing_link_id IS NOT NULL THEN
        UPDATE equity_links SET shares_owned = COALESCE(v_existing_shares, 0) + v_mov.shares_transferred, end_date = NULL
        WHERE id = v_existing_link_id;
      ELSE
        INSERT INTO equity_links (workspace_id, owner_entity_id, owned_entity_id, share_class_id, shares_owned, percentage, effective_date)
        VALUES (v_ws, v_mov.from_entity_id, v_mov.company_entity_id, v_mov.share_class_id, v_mov.shares_transferred, 0, v_mov.movement_date);
      END IF;
    END IF;
  END IF;

  -- Recalculate percentages
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

  UPDATE movements SET status = 'voided', voided_at = now(), void_reason = p_reason
  WHERE id = p_movement_id;
END;
$function$;
