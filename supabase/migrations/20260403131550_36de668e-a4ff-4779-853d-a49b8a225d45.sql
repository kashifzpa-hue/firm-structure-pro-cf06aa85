
CREATE TABLE IF NOT EXISTS public.workspace_encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  encryption_version integer NOT NULL DEFAULT 1
);

ALTER TABLE public.workspace_encryption_keys ENABLE ROW LEVEL SECURITY;
