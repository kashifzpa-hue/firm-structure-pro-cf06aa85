
-- Enums
CREATE TYPE public.movement_type AS ENUM (
  'TRANSFER', 'ISSUANCE', 'CANCELLATION', 'INHERITANCE',
  'GIFT', 'COURT_ORDER', 'CAPITAL_INCREASE', 'CAPITAL_DECREASE'
);

CREATE TYPE public.movement_status AS ENUM ('draft', 'confirmed', 'voided');

CREATE TYPE public.movement_document_type AS ENUM (
  'Share Transfer Deed', 'Share Purchase Agreement', 'Board Resolution',
  'Shareholder Resolution', 'Share Certificate', 'Court Order',
  'Gift Deed', 'Inheritance Certificate', 'Other'
);

-- Movements table
CREATE TABLE public.movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  company_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  share_class_id UUID NOT NULL REFERENCES public.share_classes(id) ON DELETE CASCADE,
  movement_type public.movement_type NOT NULL,
  from_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  to_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  shares_transferred INTEGER NOT NULL CHECK (shares_transferred > 0),
  price_per_share NUMERIC,
  currency TEXT,
  total_consideration NUMERIC,
  movement_date DATE NOT NULL,
  reference_number TEXT,
  notes TEXT,
  status public.movement_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT
);

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view movements in their workspace"
  ON public.movements FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can create movements in their workspace"
  ON public.movements FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can update movements in their workspace"
  ON public.movements FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can delete movements in their workspace"
  ON public.movements FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id());

-- Movement documents table
CREATE TABLE public.movement_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movement_id UUID NOT NULL REFERENCES public.movements(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_type public.movement_document_type NOT NULL DEFAULT 'Other',
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.movement_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view movement documents in their workspace"
  ON public.movement_documents FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can create movement documents in their workspace"
  ON public.movement_documents FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can delete movement documents in their workspace"
  ON public.movement_documents FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id());

-- ============================================================
-- RPC: confirm_movement
-- ============================================================
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

  -- TRANSFER, INHERITANCE, GIFT, COURT_ORDER
  IF v_mov.movement_type IN ('TRANSFER', 'INHERITANCE', 'GIFT', 'COURT_ORDER') THEN
    -- Reduce seller
    UPDATE equity_links
      SET shares_owned = shares_owned - v_mov.shares_transferred
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;

    IF NOT FOUND THEN RAISE EXCEPTION 'Seller equity link not found'; END IF;

    -- Auto-close if 0
    UPDATE equity_links
      SET end_date = v_mov.movement_date
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND shares_owned = 0
      AND workspace_id = v_ws;

    -- Increase/create buyer
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

  -- ISSUANCE
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

  -- CANCELLATION
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

  -- CAPITAL_INCREASE
  ELSIF v_mov.movement_type = 'CAPITAL_INCREASE' THEN
    UPDATE share_classes
      SET total_shares_issued = total_shares_issued + v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

    -- Create/update link for recipient
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

  -- CAPITAL_DECREASE
  ELSIF v_mov.movement_type = 'CAPITAL_DECREASE' THEN
    UPDATE share_classes
      SET total_shares_issued = total_shares_issued - v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

    UPDATE equity_links
      SET shares_owned = shares_owned - v_mov.shares_transferred
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND workspace_id = v_ws;

    UPDATE equity_links
      SET end_date = v_mov.movement_date
    WHERE owner_entity_id = v_mov.from_entity_id
      AND owned_entity_id = v_mov.company_entity_id
      AND share_class_id = v_mov.share_class_id
      AND end_date IS NULL
      AND shares_owned = 0
      AND workspace_id = v_ws;
  END IF;

  -- Recalculate percentages for all active links of this company+share_class
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

  -- Mark confirmed
  UPDATE movements SET status = 'confirmed', confirmed_at = now()
  WHERE id = p_movement_id;
END;
$$;

-- ============================================================
-- RPC: void_movement
-- ============================================================
CREATE OR REPLACE FUNCTION public.void_movement(p_movement_id UUID, p_reason TEXT)
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

  -- Reverse the changes (opposite of confirm)
  IF v_mov.movement_type IN ('TRANSFER', 'INHERITANCE', 'GIFT', 'COURT_ORDER') THEN
    -- Re-open/increase seller
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

    -- Reduce buyer
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
    UPDATE share_classes
      SET total_shares_issued = total_shares_issued - v_mov.shares_transferred
    WHERE id = v_mov.share_class_id AND workspace_id = v_ws;

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

  ELSIF v_mov.movement_type = 'CAPITAL_DECREASE' THEN
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

  -- Mark voided
  UPDATE movements SET status = 'voided', voided_at = now(), void_reason = p_reason
  WHERE id = p_movement_id;
END;
$$;

-- ============================================================
-- RPC: activate_live_mode
-- ============================================================
CREATE OR REPLACE FUNCTION public.activate_live_mode(p_entity_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws UUID;
  v_profile_id UUID;
  v_user_name TEXT;
  v_link RECORD;
  v_today TEXT;
BEGIN
  v_ws := get_user_workspace_id();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Verify entity belongs to workspace and is a company in setup mode
  IF NOT EXISTS (
    SELECT 1 FROM entities
    WHERE id = p_entity_id AND workspace_id = v_ws AND type = 'company' AND captable_status = 'setup'
  ) THEN
    RAISE EXCEPTION 'Entity not found or not eligible for live mode activation';
  END IF;

  -- Get profile id and name for the notes
  SELECT id, full_name INTO v_profile_id, v_user_name
  FROM profiles WHERE user_id = auth.uid();

  v_today := to_char(now(), 'YYYY-MM-DD');

  -- Create opening balance movements for each active equity link
  FOR v_link IN
    SELECT el.*, sc.id as sc_id
    FROM equity_links el
    JOIN share_classes sc ON sc.id = el.share_class_id
    WHERE el.owned_entity_id = p_entity_id
      AND el.end_date IS NULL
      AND el.workspace_id = v_ws
      AND el.shares_owned IS NOT NULL
      AND el.shares_owned > 0
  LOOP
    INSERT INTO movements (
      workspace_id, company_entity_id, share_class_id, movement_type,
      to_entity_id, shares_transferred, movement_date, notes,
      status, created_by, confirmed_at
    ) VALUES (
      v_ws, p_entity_id, v_link.share_class_id, 'ISSUANCE',
      v_link.owner_entity_id, v_link.shares_owned, v_link.effective_date,
      'Opening balance — imported from Setup Mode on ' || v_today || ' by ' || COALESCE(v_user_name, 'Unknown'),
      'confirmed', v_profile_id, now()
    );
  END LOOP;

  -- Set to live mode
  UPDATE entities SET captable_status = 'live' WHERE id = p_entity_id AND workspace_id = v_ws;
END;
$$;
