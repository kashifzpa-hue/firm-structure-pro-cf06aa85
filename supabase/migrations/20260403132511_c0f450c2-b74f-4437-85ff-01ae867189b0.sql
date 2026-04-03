
ALTER TABLE public.workspace_encryption_keys
  DROP COLUMN IF EXISTS key_reference,
  DROP COLUMN IF EXISTS rotated_at,
  DROP COLUMN IF EXISTS created_at,
  ADD COLUMN IF NOT EXISTS enabled_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS enabled_by uuid REFERENCES public.profiles(id);
