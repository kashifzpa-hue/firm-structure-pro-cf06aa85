CREATE TYPE public.offboarding_status AS ENUM ('draft', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.offboarding_step_status AS ENUM ('pending', 'submitted', 'acknowledged', 'done', 'not_applicable');
CREATE TYPE public.offboarding_step_category AS ENUM ('approval', 'signatory', 'facility', 'appointment', 'guarantee', 'shareholding', 'document', 'closeout', 'other');

CREATE TABLE public.person_offboardings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  person_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  status public.offboarding_status NOT NULL DEFAULT 'draft',
  reason TEXT,
  effective_date DATE,
  resolution_ref TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_offboardings TO authenticated;
GRANT ALL ON public.person_offboardings TO service_role;
ALTER TABLE public.person_offboardings ENABLE ROW LEVEL SECURITY;

CREATE POLICY person_offboardings_select ON public.person_offboardings
  FOR SELECT TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY person_offboardings_insert ON public.person_offboardings
  FOR INSERT TO authenticated WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());
CREATE POLICY person_offboardings_update ON public.person_offboardings
  FOR UPDATE TO authenticated USING (workspace_id = get_user_workspace_id() AND is_workspace_admin())
  WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());
CREATE POLICY person_offboardings_delete ON public.person_offboardings
  FOR DELETE TO authenticated USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

CREATE INDEX idx_person_offboardings_person ON public.person_offboardings(workspace_id, person_entity_id);

CREATE TABLE public.person_offboarding_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  offboarding_id UUID NOT NULL REFERENCES public.person_offboardings(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  category public.offboarding_step_category NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  description TEXT,
  status public.offboarding_step_status NOT NULL DEFAULT 'pending',
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  cif_id UUID REFERENCES public.bank_relationships(id) ON DELETE SET NULL,
  signatory_id UUID REFERENCES public.signatories(id) ON DELETE SET NULL,
  facility_id UUID REFERENCES public.bank_facilities(id) ON DELETE SET NULL,
  credit_limit_id UUID REFERENCES public.bank_credit_limits(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_request_id UUID REFERENCES public.bank_service_requests(id) ON DELETE SET NULL,
  owner_profile_id UUID REFERENCES public.profiles(id),
  due_date DATE,
  submitted_date DATE,
  acknowledged_date DATE,
  completed_date DATE,
  bank_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_offboarding_steps TO authenticated;
GRANT ALL ON public.person_offboarding_steps TO service_role;
ALTER TABLE public.person_offboarding_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY person_offboarding_steps_select ON public.person_offboarding_steps
  FOR SELECT TO authenticated USING (workspace_id = get_user_workspace_id());
CREATE POLICY person_offboarding_steps_insert ON public.person_offboarding_steps
  FOR INSERT TO authenticated WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());
CREATE POLICY person_offboarding_steps_update ON public.person_offboarding_steps
  FOR UPDATE TO authenticated USING (workspace_id = get_user_workspace_id() AND is_workspace_admin())
  WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin());
CREATE POLICY person_offboarding_steps_delete ON public.person_offboarding_steps
  FOR DELETE TO authenticated USING (workspace_id = get_user_workspace_id() AND is_workspace_admin());

CREATE INDEX idx_offboarding_steps_offboarding ON public.person_offboarding_steps(offboarding_id, stage, display_order);

CREATE TRIGGER trg_person_offboardings_updated
  BEFORE UPDATE ON public.person_offboardings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_person_offboarding_steps_updated
  BEFORE UPDATE ON public.person_offboarding_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();