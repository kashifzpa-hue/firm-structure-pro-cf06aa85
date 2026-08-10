-- 1. CIF / bank relationship
CREATE TABLE public.bank_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  company_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  bank_name_custom TEXT,
  cif_number TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  opening_date DATE,
  relationship_manager TEXT,
  rm_email TEXT,
  rm_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_relationships TO authenticated;
GRANT ALL ON public.bank_relationships TO service_role;
ALTER TABLE public.bank_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view bank relationships"
  ON public.bank_relationships FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());
CREATE POLICY "Admins can insert bank relationships"
  ON public.bank_relationships FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "Admins can update bank relationships"
  ON public.bank_relationships FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "Admins can delete bank relationships"
  ON public.bank_relationships FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());

CREATE TRIGGER trg_bank_relationships_updated_at
  BEFORE UPDATE ON public.bank_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_alert_rules_timestamp();

CREATE INDEX idx_bank_relationships_workspace ON public.bank_relationships(workspace_id);
CREATE INDEX idx_bank_relationships_company ON public.bank_relationships(company_entity_id);

-- 2. Link bank accounts to a CIF
ALTER TABLE public.bank_accounts
  ADD COLUMN cif_id UUID REFERENCES public.bank_relationships(id) ON DELETE SET NULL;

INSERT INTO public.bank_relationships (workspace_id, company_entity_id, bank_name, bank_name_custom, relationship_manager, rm_email, rm_phone, opening_date)
SELECT DISTINCT ON (ba.workspace_id, ba.company_entity_id, ba.bank_name)
  ba.workspace_id, ba.company_entity_id, ba.bank_name, ba.bank_name_custom,
  ba.relationship_manager, ba.rm_email, ba.rm_phone, MIN(ba.opening_date) OVER (PARTITION BY ba.workspace_id, ba.company_entity_id, ba.bank_name)
FROM public.bank_accounts ba;

UPDATE public.bank_accounts ba
SET cif_id = br.id
FROM public.bank_relationships br
WHERE br.workspace_id = ba.workspace_id
  AND br.company_entity_id = ba.company_entity_id
  AND br.bank_name = ba.bank_name
  AND ba.cif_id IS NULL;

CREATE INDEX idx_bank_accounts_cif ON public.bank_accounts(cif_id);

-- 3. Re-scope facilities / limits / requests to the CIF
ALTER TABLE public.bank_facilities
  ADD COLUMN cif_id UUID REFERENCES public.bank_relationships(id) ON DELETE CASCADE,
  ALTER COLUMN bank_account_id DROP NOT NULL;

ALTER TABLE public.bank_credit_limits
  ADD COLUMN cif_id UUID REFERENCES public.bank_relationships(id) ON DELETE CASCADE,
  ALTER COLUMN bank_account_id DROP NOT NULL;

ALTER TABLE public.bank_service_requests
  ADD COLUMN cif_id UUID REFERENCES public.bank_relationships(id) ON DELETE CASCADE,
  ALTER COLUMN bank_account_id DROP NOT NULL;

UPDATE public.bank_facilities f SET cif_id = ba.cif_id FROM public.bank_accounts ba WHERE ba.id = f.bank_account_id AND f.cif_id IS NULL;
UPDATE public.bank_credit_limits l SET cif_id = ba.cif_id FROM public.bank_accounts ba WHERE ba.id = l.bank_account_id AND l.cif_id IS NULL;
UPDATE public.bank_service_requests r SET cif_id = ba.cif_id FROM public.bank_accounts ba WHERE ba.id = r.bank_account_id AND r.cif_id IS NULL;

CREATE INDEX idx_bank_facilities_cif ON public.bank_facilities(cif_id);
CREATE INDEX idx_bank_credit_limits_cif ON public.bank_credit_limits(cif_id);
CREATE INDEX idx_bank_service_requests_cif ON public.bank_service_requests(cif_id);

-- 4. Allow CIF-level activity log entries
ALTER TABLE public.banking_activity_log
  ADD COLUMN cif_id UUID REFERENCES public.bank_relationships(id) ON DELETE CASCADE,
  ALTER COLUMN bank_account_id DROP NOT NULL;
