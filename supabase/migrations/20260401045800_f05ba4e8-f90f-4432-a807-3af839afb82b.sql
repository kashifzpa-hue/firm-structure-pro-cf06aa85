
-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;

-- Create a SECURITY DEFINER function to handle workspace creation
CREATE OR REPLACE FUNCTION public.create_workspace(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _workspace_id UUID;
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

  -- Create workspace
  INSERT INTO public.workspaces (name) VALUES (_name) RETURNING id INTO _workspace_id;

  -- Link profile to workspace
  UPDATE public.profiles SET workspace_id = _workspace_id WHERE user_id = _user_id;

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, workspace_id, role) VALUES (_user_id, _workspace_id, 'admin');

  RETURN _workspace_id;
END;
$$;
