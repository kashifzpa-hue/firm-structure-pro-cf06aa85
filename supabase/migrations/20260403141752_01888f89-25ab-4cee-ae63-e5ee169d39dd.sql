
-- 1. Create is_workspace_admin() helper
CREATE OR REPLACE FUNCTION public.is_workspace_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND workspace_id = get_user_workspace_id()
      AND role = 'admin'
  )
$$;

-- 2. ENTITIES — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create entities in their workspace" ON public.entities;
CREATE POLICY "Admins can create entities in their workspace"
ON public.entities FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update entities in their workspace" ON public.entities;
CREATE POLICY "Admins can update entities in their workspace"
ON public.entities FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Admins can delete entities in their workspace" ON public.entities;
CREATE POLICY "Admins can delete entities in their workspace"
ON public.entities FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 3. DOCUMENTS — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create documents in their workspace" ON public.documents;
CREATE POLICY "Admins can create documents in their workspace"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update documents in their workspace" ON public.documents;
CREATE POLICY "Admins can update documents in their workspace"
ON public.documents FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete documents in their workspace" ON public.documents;
CREATE POLICY "Admins can delete documents in their workspace"
ON public.documents FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 4. DOCUMENT_VERSIONS — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create document versions in their workspace" ON public.document_versions;
CREATE POLICY "Admins can create document versions in their workspace"
ON public.document_versions FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update document versions in their workspace" ON public.document_versions;
CREATE POLICY "Admins can update document versions in their workspace"
ON public.document_versions FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete document versions in their workspace" ON public.document_versions;
CREATE POLICY "Admins can delete document versions in their workspace"
ON public.document_versions FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 5. EQUITY_LINKS — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create equity links in their workspace" ON public.equity_links;
CREATE POLICY "Admins can create equity links in their workspace"
ON public.equity_links FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update equity links in their workspace" ON public.equity_links;
CREATE POLICY "Admins can update equity links in their workspace"
ON public.equity_links FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete equity links in their workspace" ON public.equity_links;
CREATE POLICY "Admins can delete equity links in their workspace"
ON public.equity_links FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 6. SHARE_CLASSES — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create share classes in their workspace" ON public.share_classes;
CREATE POLICY "Admins can create share classes in their workspace"
ON public.share_classes FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update share classes in their workspace" ON public.share_classes;
CREATE POLICY "Admins can update share classes in their workspace"
ON public.share_classes FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete share classes in their workspace" ON public.share_classes;
CREATE POLICY "Admins can delete share classes in their workspace"
ON public.share_classes FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 7. MOVEMENTS — tighten INSERT only (UPDATE stays for confirm/void which are RPCs)
DROP POLICY IF EXISTS "Users can create movements in their workspace" ON public.movements;
CREATE POLICY "Admins can create movements in their workspace"
ON public.movements FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update movements in their workspace" ON public.movements;
CREATE POLICY "Admins can update movements in their workspace"
ON public.movements FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete movements in their workspace" ON public.movements;
CREATE POLICY "Admins can delete movements in their workspace"
ON public.movements FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 8. APPOINTMENTS — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create appointments in their workspace" ON public.appointments;
CREATE POLICY "Admins can create appointments in their workspace"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update appointments in their workspace" ON public.appointments;
CREATE POLICY "Admins can update appointments in their workspace"
ON public.appointments FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete appointments in their workspace" ON public.appointments;
CREATE POLICY "Admins can delete appointments in their workspace"
ON public.appointments FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 9. PREVIOUS_POSITIONS — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create previous positions in their workspace" ON public.previous_positions;
CREATE POLICY "Admins can create previous positions in their workspace"
ON public.previous_positions FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update previous positions in their workspace" ON public.previous_positions;
CREATE POLICY "Admins can update previous positions in their workspace"
ON public.previous_positions FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete previous positions in their workspace" ON public.previous_positions;
CREATE POLICY "Admins can delete previous positions in their workspace"
ON public.previous_positions FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 10. BANK_ACCOUNTS — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create bank accounts in their workspace" ON public.bank_accounts;
CREATE POLICY "Admins can create bank accounts in their workspace"
ON public.bank_accounts FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update bank accounts in their workspace" ON public.bank_accounts;
CREATE POLICY "Admins can update bank accounts in their workspace"
ON public.bank_accounts FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete bank accounts in their workspace" ON public.bank_accounts;
CREATE POLICY "Admins can delete bank accounts in their workspace"
ON public.bank_accounts FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 11. BANK_ACCOUNT_DOCUMENTS — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create bank account documents in their workspace" ON public.bank_account_documents;
CREATE POLICY "Admins can create bank account documents in their workspace"
ON public.bank_account_documents FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update bank account documents in their workspace" ON public.bank_account_documents;
CREATE POLICY "Admins can update bank account documents in their workspace"
ON public.bank_account_documents FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete bank account documents in their workspace" ON public.bank_account_documents;
CREATE POLICY "Admins can delete bank account documents in their workspace"
ON public.bank_account_documents FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 12. SIGNATORIES — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create signatories in their workspace" ON public.signatories;
CREATE POLICY "Admins can create signatories in their workspace"
ON public.signatories FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update signatories in their workspace" ON public.signatories;
CREATE POLICY "Admins can update signatories in their workspace"
ON public.signatories FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete signatories in their workspace" ON public.signatories;
CREATE POLICY "Admins can delete signatories in their workspace"
ON public.signatories FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 13. SIGNATORY_GROUPS — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create signatory groups in their workspace" ON public.signatory_groups;
CREATE POLICY "Admins can create signatory groups in their workspace"
ON public.signatory_groups FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update signatory groups in their workspace" ON public.signatory_groups;
CREATE POLICY "Admins can update signatory groups in their workspace"
ON public.signatory_groups FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete signatory groups in their workspace" ON public.signatory_groups;
CREATE POLICY "Admins can delete signatory groups in their workspace"
ON public.signatory_groups FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 14. SIGNING_MATRIX_RULES — tighten INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create signing matrix rules in their workspace" ON public.signing_matrix_rules;
CREATE POLICY "Admins can create signing matrix rules in their workspace"
ON public.signing_matrix_rules FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can update signing matrix rules in their workspace" ON public.signing_matrix_rules;
CREATE POLICY "Admins can update signing matrix rules in their workspace"
ON public.signing_matrix_rules FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete signing matrix rules in their workspace" ON public.signing_matrix_rules;
CREATE POLICY "Admins can delete signing matrix rules in their workspace"
ON public.signing_matrix_rules FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 15. MOVEMENT_DOCUMENTS — tighten INSERT, DELETE
DROP POLICY IF EXISTS "Users can create movement documents in their workspace" ON public.movement_documents;
CREATE POLICY "Admins can create movement documents in their workspace"
ON public.movement_documents FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());

DROP POLICY IF EXISTS "Users can delete movement documents in their workspace" ON public.movement_documents;
CREATE POLICY "Admins can delete movement documents in their workspace"
ON public.movement_documents FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

-- 16. Update confirm_movement to require admin role
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
  IF NOT is_workspace_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

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

-- 17. Update void_movement to require admin role
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
  IF NOT is_workspace_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

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

-- 18. Update activate_live_mode to require admin role
CREATE OR REPLACE FUNCTION public.activate_live_mode(p_entity_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ws UUID;
  v_profile_id UUID;
  v_user_name TEXT;
  v_link RECORD;
  v_today TEXT;
BEGIN
  v_ws := get_user_workspace_id();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_workspace_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM entities
    WHERE id = p_entity_id AND workspace_id = v_ws AND type = 'company' AND captable_status = 'setup'
  ) THEN
    RAISE EXCEPTION 'Entity not found or not eligible for live mode activation';
  END IF;

  SELECT id, full_name INTO v_profile_id, v_user_name
  FROM profiles WHERE user_id = auth.uid();

  v_today := to_char(now(), 'YYYY-MM-DD');

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

  UPDATE entities SET captable_status = 'live' WHERE id = p_entity_id AND workspace_id = v_ws;
END;
$function$;
