
-- Create equity_links table
CREATE TABLE public.equity_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  owned_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  percentage NUMERIC(7,4) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  share_count INTEGER,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT no_self_ownership CHECK (owner_entity_id != owned_entity_id)
);

-- Enable RLS
ALTER TABLE public.equity_links ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view equity links in their workspace"
  ON public.equity_links FOR SELECT
  TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can create equity links in their workspace"
  ON public.equity_links FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can update equity links in their workspace"
  ON public.equity_links FOR UPDATE
  TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can delete equity links in their workspace"
  ON public.equity_links FOR DELETE
  TO authenticated
  USING (workspace_id = get_user_workspace_id());
