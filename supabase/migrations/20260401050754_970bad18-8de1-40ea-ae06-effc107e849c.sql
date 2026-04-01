
-- Create workspace_invitations table
CREATE TABLE public.workspace_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(workspace_id, email)
);

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view invitations in their workspace
CREATE POLICY "Admins can view invitations"
  ON public.workspace_invitations FOR SELECT
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON public.workspace_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id = public.get_user_workspace_id()
    AND public.has_workspace_role(auth.uid(), workspace_id, 'admin')
  );

-- Admins can delete invitations
CREATE POLICY "Admins can delete invitations"
  ON public.workspace_invitations FOR DELETE
  TO authenticated
  USING (
    workspace_id = public.get_user_workspace_id()
    AND public.has_workspace_role(auth.uid(), workspace_id, 'admin')
  );

-- Function to accept an invitation (called after signup by invited users)
CREATE OR REPLACE FUNCTION public.accept_invitation(_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation RECORD;
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a workspace
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND workspace_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a workspace';
  END IF;

  -- Find pending invitation
  SELECT * INTO _invitation
  FROM public.workspace_invitations
  WHERE email = lower(_email) AND accepted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Link user to workspace
  UPDATE public.profiles SET workspace_id = _invitation.workspace_id WHERE user_id = _user_id;

  -- Assign role
  INSERT INTO public.user_roles (user_id, workspace_id, role)
  VALUES (_user_id, _invitation.workspace_id, _invitation.role);

  -- Mark invitation as accepted
  UPDATE public.workspace_invitations SET accepted_at = now() WHERE id = _invitation.id;

  RETURN _invitation.workspace_id;
END;
$$;
