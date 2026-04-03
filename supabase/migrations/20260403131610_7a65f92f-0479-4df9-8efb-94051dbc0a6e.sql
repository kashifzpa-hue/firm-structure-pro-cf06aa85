
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_encrypted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS encryption_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS iv text;

ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS is_encrypted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS encryption_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS iv text;
