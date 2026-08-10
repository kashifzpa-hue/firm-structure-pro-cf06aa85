-- Enums
CREATE TYPE public.bank_facility_type AS ENUM (
  'internet_banking','sweep','statement_delivery','cheque_book','card',
  'standing_instruction','trade_finance','payroll_wps','host_to_host','other'
);
CREATE TYPE public.bank_facility_status AS ENUM ('requested','active','suspended','cancelled');
CREATE TYPE public.ib_access_level AS ENUM ('view_only','initiator','approver','administrator');
CREATE TYPE public.bank_token_status AS ENUM ('none','issued','lost','replaced','returned');
CREATE TYPE public.statement_delivery_method AS ENUM ('email','post','portal');
CREATE TYPE public.statement_frequency AS ENUM ('daily','weekly','monthly','quarterly','annual');
CREATE TYPE public.credit_limit_type AS ENUM (
  'overdraft','term_loan','revolving_credit','working_capital','invoice_discounting',
  'lc_sight','lc_usance','bank_guarantee','trust_receipt','trade_loan',
  'equipment_finance','credit_card_limit','other'
);
CREATE TYPE public.credit_limit_status AS ENUM ('proposed','sanctioned','active','under_renewal','expired','cancelled');
CREATE TYPE public.bank_request_type AS ENUM (
  'new_facility','modify','suspend','reactivate','cancel','access_reset','limit_change',
  'limit_renewal','new_cheque_book','token_replacement','stop_payment','signatory_update','other'
);
CREATE TYPE public.bank_request_status AS ENUM ('draft','submitted','acknowledged','in_progress','completed','rejected','cancelled');

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'BANK_REQUEST_OVERDUE';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'CREDIT_LIMIT_REVIEW_DUE';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'CREDIT_LIMIT_EXPIRING';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'FACILITY_INACTIVE_PERSON';

-- Facilities
CREATE TABLE public.bank_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  facility_type public.bank_facility_type NOT NULL,
  status public.bank_facility_status NOT NULL DEFAULT 'active',
  person_entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  access_level public.ib_access_level,
  token_serial text,
  token_status public.bank_token_status NOT NULL DEFAULT 'none',
  token_issue_date date,
  transaction_limit numeric,
  daily_limit numeric,
  limit_currency text NOT NULL DEFAULT 'AED',
  sweep_target_account text,
  sweep_type text,
  sweep_threshold numeric,
  sweep_frequency text,
  statement_method public.statement_delivery_method,
  statement_frequency public.statement_frequency,
  statement_recipients text[] NOT NULL DEFAULT '{}',
  cheque_book_number text,
  leaf_range_start text,
  leaf_range_end text,
  leaves_issued_date date,
  annual_fee numeric,
  fee_currency text,
  fee_notes text,
  umbrella_ref text,
  effective_date date,
  end_date date,
  bank_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_facilities TO authenticated;
GRANT ALL ON public.bank_facilities TO service_role;
ALTER TABLE public.bank_facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_facilities_select" ON public.bank_facilities FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());
CREATE POLICY "bank_facilities_insert" ON public.bank_facilities FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "bank_facilities_update" ON public.bank_facilities FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin())
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "bank_facilities_delete" ON public.bank_facilities FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE INDEX idx_bank_facilities_account ON public.bank_facilities(bank_account_id);
CREATE INDEX idx_bank_facilities_person ON public.bank_facilities(person_entity_id);

-- Credit limits
CREATE TABLE public.bank_credit_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  limit_type public.credit_limit_type NOT NULL,
  status public.credit_limit_status NOT NULL DEFAULT 'active',
  is_funded boolean NOT NULL DEFAULT true,
  umbrella_ref text,
  parent_limit_id uuid REFERENCES public.bank_credit_limits(id) ON DELETE SET NULL,
  sanctioned_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  utilised_amount numeric,
  utilised_as_of date,
  pricing_basis text,
  fee_notes text,
  tenor text,
  security_summary text,
  guarantor_entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  covenant_notes text,
  sanction_date date,
  availability_start_date date,
  next_review_date date,
  expiry_date date,
  last_renewed_on date,
  offer_letter_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_credit_limits TO authenticated;
GRANT ALL ON public.bank_credit_limits TO service_role;
ALTER TABLE public.bank_credit_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_credit_limits_select" ON public.bank_credit_limits FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());
CREATE POLICY "bank_credit_limits_insert" ON public.bank_credit_limits FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "bank_credit_limits_update" ON public.bank_credit_limits FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin())
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "bank_credit_limits_delete" ON public.bank_credit_limits FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE INDEX idx_bank_credit_limits_account ON public.bank_credit_limits(bank_account_id);

-- Service requests
CREATE TABLE public.bank_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.bank_facilities(id) ON DELETE SET NULL,
  credit_limit_id uuid REFERENCES public.bank_credit_limits(id) ON DELETE SET NULL,
  signatory_id uuid REFERENCES public.signatories(id) ON DELETE SET NULL,
  request_type public.bank_request_type NOT NULL,
  status public.bank_request_status NOT NULL DEFAULT 'draft',
  subject text NOT NULL,
  description text,
  date_requested date NOT NULL DEFAULT CURRENT_DATE,
  date_submitted date,
  bank_ack_date date,
  expected_completion date,
  actual_completion date,
  bank_contact text,
  bank_reference text,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  outcome_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_service_requests TO authenticated;
GRANT ALL ON public.bank_service_requests TO service_role;
ALTER TABLE public.bank_service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_service_requests_select" ON public.bank_service_requests FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());
CREATE POLICY "bank_service_requests_insert" ON public.bank_service_requests FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "bank_service_requests_update" ON public.bank_service_requests FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin())
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "bank_service_requests_delete" ON public.bank_service_requests FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE INDEX idx_bank_service_requests_account ON public.bank_service_requests(bank_account_id);

-- Request documents
CREATE TABLE public.bank_service_request_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.bank_service_requests(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  description text,
  file_url text,
  notes text,
  is_encrypted boolean NOT NULL DEFAULT false,
  iv text,
  encryption_version integer NOT NULL DEFAULT 0,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_service_request_documents TO authenticated;
GRANT ALL ON public.bank_service_request_documents TO service_role;
ALTER TABLE public.bank_service_request_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_req_docs_select" ON public.bank_service_request_documents FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());
CREATE POLICY "bank_req_docs_insert" ON public.bank_service_request_documents FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "bank_req_docs_update" ON public.bank_service_request_documents FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin())
  WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "bank_req_docs_delete" ON public.bank_service_request_documents FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());
CREATE INDEX idx_bank_req_docs_request ON public.bank_service_request_documents(request_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_bank_facilities_updated BEFORE UPDATE ON public.bank_facilities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bank_credit_limits_updated BEFORE UPDATE ON public.bank_credit_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bank_service_requests_updated BEFORE UPDATE ON public.bank_service_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();