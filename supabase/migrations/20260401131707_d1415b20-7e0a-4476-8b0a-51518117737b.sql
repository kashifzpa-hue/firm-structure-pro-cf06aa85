
-- Entity status enum
CREATE TYPE public.entity_status AS ENUM ('active', 'inactive', 'archived');

-- Add lifecycle columns to entities
ALTER TABLE public.entities
  ADD COLUMN entity_status public.entity_status NOT NULL DEFAULT 'active',
  ADD COLUMN deactivated_at TIMESTAMPTZ,
  ADD COLUMN deactivated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN deactivation_reason TEXT;

-- Entity field history table
CREATE TABLE public.entity_field_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES public.profiles(id),
  change_reason TEXT
);

ALTER TABLE public.entity_field_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view field history in their workspace"
  ON public.entity_field_history FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can create field history in their workspace"
  ON public.entity_field_history FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE INDEX idx_entity_field_history_entity ON public.entity_field_history(entity_id);
CREATE INDEX idx_entity_field_history_workspace ON public.entity_field_history(workspace_id);
CREATE INDEX idx_entities_status ON public.entities(entity_status);
