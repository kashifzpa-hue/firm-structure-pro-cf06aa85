
-- Drop the trigger and function that can't access vault
DROP TRIGGER IF EXISTS trg_generate_encryption_key ON public.workspaces;
DROP FUNCTION IF EXISTS public.generate_workspace_encryption_key();
