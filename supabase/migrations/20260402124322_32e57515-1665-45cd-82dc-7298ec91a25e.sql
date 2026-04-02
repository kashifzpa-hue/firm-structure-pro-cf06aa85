
-- 1. Update confirm_movement to handle CAPITAL_DECREASE with NULL from_entity_id
CREATE OR REPLACE FUNCTION public.confirm_movement(p_movement_id uuid)
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
  v_allocated INTEGER;
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

    -- Also reduce total_shares_issued for cancellation
    UPDATE share_classes
      SET total_shares_issued = total_shares_issued - v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

  ELSIF v_mov.movement_type = 'CAPITAL_INCREASE' THEN
    UPDATE share_classes
      SET total_shares_issued = total_shares_issued + v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

    IF v_mov.to_entity_id IS NOT NULL THEN
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
    END IF;

  ELSIF v_mov.movement_type = 'CAPITAL_DECREASE' THEN
    IF v_mov.from_entity_id IS NULL THEN
      -- Reducing unallocated shares only
      SELECT COALESCE(SUM(el.shares_owned), 0) INTO v_allocated
      FROM equity_links el
      WHERE el.workspace_id = v_ws
        AND el.owned_entity_id = v_mov.company_entity_id
        AND el.share_class_id = v_mov.share_class_id
        AND el.end_date IS NULL;

      SELECT total_shares_issued INTO v_total_issued
      FROM share_classes WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

      IF (v_total_issued - v_mov.shares_transferred) < v_allocated THEN
        RAISE EXCEPTION 'Cannot reduce total below % shares — % shares are currently allocated to active shareholders', v_allocated, v_allocated;
      END IF;

      UPDATE share_classes
        SET total_shares_issued = total_shares_issued - v_mov.shares_transferred
      WHERE id = v_mov.share_class_id AND workspace_id = v_ws;
    ELSE
      -- Cancel from specific holder
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

  UPDATE movements SET status = 'confirmed', confirmed_at = now()
  WHERE id = p_movement_id;
END;
$function$;

-- 2. Update void_movement to handle CAPITAL_DECREASE with NULL from_entity_id
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

  -- Check for subsequent movements
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

  -- Reverse the changes
  IF v_mov.movement_type IN ('TRANSFER', 'INHERITANCE', 'GIFT', 'COURT_ORDER') THEN
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
    -- Reverse: restore shares to holder and increase total
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

    UPDATE share_classes
      SET total_shares_issued = total_shares_issued + v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

  ELSIF v_mov.movement_type = 'CAPITAL_INCREASE' THEN
    UPDATE share_classes
      SET total_shares_issued = total_shares_issued - v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

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

  ELSIF v_mov.movement_type = 'CAPITAL_DECREASE' THEN
    IF v_mov.from_entity_id IS NULL THEN
      -- Was unallocated decrease — just add shares back
      UPDATE share_classes
        SET total_shares_issued = total_shares_issued + v_mov.shares_transferred
      WHERE id = v_mov.share_class_id AND workspace_id = v_ws;
    ELSE
      -- Was holder decrease — restore holder shares and increase total
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

-- 3. Update validate_share_class_total_shares error message
CREATE OR REPLACE FUNCTION public.validate_share_class_total_shares()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    RAISE EXCEPTION 'Cannot reduce total below % shares — % shares are currently allocated to active shareholders', v_allocated, v_allocated;
  END IF;

  RETURN NEW;
END;
$function$;
