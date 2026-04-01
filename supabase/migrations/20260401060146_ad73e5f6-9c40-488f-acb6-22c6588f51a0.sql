
-- Create role_category enum
CREATE TYPE public.appointment_role_category AS ENUM ('board', 'management');

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  company_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  person_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  role_category appointment_role_category NOT NULL,
  appointment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  resignation_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view appointments in their workspace"
  ON public.appointments FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can create appointments in their workspace"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can update appointments in their workspace"
  ON public.appointments FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can delete appointments in their workspace"
  ON public.appointments FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id());
