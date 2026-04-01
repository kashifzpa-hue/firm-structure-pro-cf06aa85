
-- Create share_classes table
CREATE TABLE public.share_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  company_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  total_shares_issued INTEGER NOT NULL CHECK (total_shares_issued >= 1),
  par_value_per_share NUMERIC(18, 4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AED',
  voting_rights BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.share_classes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view share classes in their workspace"
ON public.share_classes FOR SELECT TO authenticated
USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can create share classes in their workspace"
ON public.share_classes FOR INSERT TO authenticated
WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can update share classes in their workspace"
ON public.share_classes FOR UPDATE TO authenticated
USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can delete share classes in their workspace"
ON public.share_classes FOR DELETE TO authenticated
USING (workspace_id = get_user_workspace_id());

-- Add columns to equity_links
ALTER TABLE public.equity_links
  ADD COLUMN share_class_id UUID REFERENCES public.share_classes(id) ON DELETE SET NULL,
  ADD COLUMN shares_owned INTEGER;
