
-- Create renewal frequency enum
CREATE TYPE public.document_renewal_frequency AS ENUM (
  'none', 'annual', 'biennial', 'triennial', 'quinquennial', 'decennial', 'custom'
);

-- Add columns to documents table
ALTER TABLE public.documents
  ADD COLUMN renewal_frequency public.document_renewal_frequency DEFAULT NULL,
  ADD COLUMN renewal_months integer DEFAULT NULL,
  ADD COLUMN auto_suggest_expiry boolean NOT NULL DEFAULT true;

-- Create document_versions table
CREATE TABLE public.document_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  version_number integer NOT NULL DEFAULT 1,
  issue_date date,
  expiry_date date,
  file_url text,
  uploaded_by uuid REFERENCES public.profiles(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(document_id, version_number)
);

-- Enable RLS
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view document versions in their workspace"
  ON public.document_versions FOR SELECT
  TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can create document versions in their workspace"
  ON public.document_versions FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can update document versions in their workspace"
  ON public.document_versions FOR UPDATE
  TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can delete document versions in their workspace"
  ON public.document_versions FOR DELETE
  TO authenticated
  USING (workspace_id = get_user_workspace_id());

-- Migrate existing documents with file_url to document_versions as version 1
INSERT INTO public.document_versions (document_id, workspace_id, version_number, issue_date, expiry_date, file_url, uploaded_at)
SELECT id, workspace_id, 1, issue_date, expiry_date, file_url, created_at
FROM public.documents
WHERE file_url IS NOT NULL;
