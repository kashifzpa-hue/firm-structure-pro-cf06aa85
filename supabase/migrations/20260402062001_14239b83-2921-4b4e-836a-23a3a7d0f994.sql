
-- Step 1: Add banking_enabled to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS banking_enabled BOOLEAN NOT NULL DEFAULT false;

-- Step 2: New enums
CREATE TYPE public.bank_account_type AS ENUM ('current', 'savings', 'call_deposit', 'trade_finance');
CREATE TYPE public.bank_account_status AS ENUM ('active', 'dormant', 'closed');
CREATE TYPE public.signatory_status AS ENUM ('active', 'suspended', 'revoked');
CREATE TYPE public.signing_rule_type AS ENUM ('solo', 'joint_same_group', 'joint_cross_group');

-- Add new notification types
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SIGNATORY_EXPIRING';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'BANK_ACK_PENDING';

-- Step 3: bank_accounts
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  company_entity_id UUID NOT NULL REFERENCES public.entities(id),
  bank_name TEXT NOT NULL,
  bank_name_custom TEXT,
  account_number TEXT NOT NULL,
  account_type public.bank_account_type NOT NULL DEFAULT 'current',
  currency TEXT NOT NULL DEFAULT 'AED',
  branch_name TEXT,
  branch_code TEXT,
  iban TEXT,
  swift_code TEXT,
  account_status public.bank_account_status NOT NULL DEFAULT 'active',
  opening_date DATE,
  closing_date DATE,
  relationship_manager TEXT,
  rm_email TEXT,
  rm_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bank accounts in their workspace" ON public.bank_accounts FOR SELECT TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can create bank accounts in their workspace" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can update bank accounts in their workspace" ON public.bank_accounts FOR UPDATE TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can delete bank accounts in their workspace" ON public.bank_accounts FOR DELETE TO authenticated USING (workspace_id = get_user_workspace_id());

-- Step 4: signatory_groups
CREATE TABLE public.signatory_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  group_label TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signatory_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signatory groups in their workspace" ON public.signatory_groups FOR SELECT TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can create signatory groups in their workspace" ON public.signatory_groups FOR INSERT TO authenticated WITH CHECK (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can update signatory groups in their workspace" ON public.signatory_groups FOR UPDATE TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can delete signatory groups in their workspace" ON public.signatory_groups FOR DELETE TO authenticated USING (workspace_id = get_user_workspace_id());

-- Step 5: signatories
CREATE TABLE public.signatories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  signatory_group_id UUID REFERENCES public.signatory_groups(id) ON DELETE SET NULL,
  person_entity_id UUID NOT NULL REFERENCES public.entities(id),
  title TEXT,
  designation TEXT NOT NULL,
  authorised_for TEXT[] NOT NULL DEFAULT '{}',
  individual_limit DECIMAL,
  individual_limit_currency TEXT,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  board_resolution_ref TEXT,
  board_resolution_doc TEXT,
  bank_acknowledged_date DATE,
  signature_image_url TEXT,
  signature_original_url TEXT,
  status public.signatory_status NOT NULL DEFAULT 'active',
  revocation_date DATE,
  revocation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signatories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signatories in their workspace" ON public.signatories FOR SELECT TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can create signatories in their workspace" ON public.signatories FOR INSERT TO authenticated WITH CHECK (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can update signatories in their workspace" ON public.signatories FOR UPDATE TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can delete signatories in their workspace" ON public.signatories FOR DELETE TO authenticated USING (workspace_id = get_user_workspace_id());

-- Step 6: signing_matrix_rules
CREATE TABLE public.signing_matrix_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type public.signing_rule_type NOT NULL,
  group_a_id UUID REFERENCES public.signatory_groups(id) ON DELETE SET NULL,
  min_signatories_from_a INTEGER NOT NULL DEFAULT 1,
  group_b_id UUID REFERENCES public.signatory_groups(id) ON DELETE SET NULL,
  min_signatories_from_b INTEGER,
  transaction_limit DECIMAL,
  daily_limit DECIMAL,
  limit_currency TEXT NOT NULL DEFAULT 'AED',
  applies_to TEXT[] NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signing_matrix_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signing matrix rules in their workspace" ON public.signing_matrix_rules FOR SELECT TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can create signing matrix rules in their workspace" ON public.signing_matrix_rules FOR INSERT TO authenticated WITH CHECK (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can update signing matrix rules in their workspace" ON public.signing_matrix_rules FOR UPDATE TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can delete signing matrix rules in their workspace" ON public.signing_matrix_rules FOR DELETE TO authenticated USING (workspace_id = get_user_workspace_id());

-- Step 7: bank_account_documents
CREATE TABLE public.bank_account_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_account_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bank account documents in their workspace" ON public.bank_account_documents FOR SELECT TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can create bank account documents in their workspace" ON public.bank_account_documents FOR INSERT TO authenticated WITH CHECK (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can update bank account documents in their workspace" ON public.bank_account_documents FOR UPDATE TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can delete bank account documents in their workspace" ON public.bank_account_documents FOR DELETE TO authenticated USING (workspace_id = get_user_workspace_id());

-- Step 8: banking_activity_log
CREATE TABLE public.banking_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  details TEXT NOT NULL,
  done_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banking_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view banking activity in their workspace" ON public.banking_activity_log FOR SELECT TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY "Users can create banking activity in their workspace" ON public.banking_activity_log FOR INSERT TO authenticated WITH CHECK (workspace_id = get_user_workspace_id());

-- Step 9: Storage bucket for signatures
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);

-- Storage RLS: only allow access to processed signatures
CREATE POLICY "Users can view processed signatures" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'signatures' AND (storage.foldername(name))[1] = 'processed');
CREATE POLICY "Users can upload signatures" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');
CREATE POLICY "Users can update signatures" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'signatures');
CREATE POLICY "Users can delete signatures" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'signatures');

-- Step 10: Update default alert rules to include new types
CREATE OR REPLACE FUNCTION public.create_default_alert_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.alert_rules (workspace_id, rule_type, threshold_days, notify_in_app, notify_email) VALUES
    (NEW.id, 'DOCUMENT_EXPIRING_SOON', 60, true, false),
    (NEW.id, 'DOCUMENT_EXPIRING_SOON', 30, true, true),
    (NEW.id, 'DOCUMENT_EXPIRED', NULL, true, true),
    (NEW.id, 'MOVEMENT_DRAFT_PENDING', 7, true, true),
    (NEW.id, 'UBO_THRESHOLD_BREACH', NULL, true, true),
    (NEW.id, 'SYSTEM_ALERT', NULL, true, true),
    (NEW.id, 'SIGNATORY_EXPIRING', 30, true, true),
    (NEW.id, 'BANK_ACK_PENDING', 14, true, false);
  RETURN NEW;
END;
$$;
