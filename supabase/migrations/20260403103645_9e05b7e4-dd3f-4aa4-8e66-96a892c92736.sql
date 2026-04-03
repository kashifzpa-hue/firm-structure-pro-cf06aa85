
-- Add person profile columns to entities
ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS profile_photo_thumb text,
  ADD COLUMN IF NOT EXISTS professional_bio text,
  ADD COLUMN IF NOT EXISTS qualifications text,
  ADD COLUMN IF NOT EXISTS languages_spoken text[];

-- Create previous_positions table
CREATE TABLE public.previous_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  role_title text NOT NULL,
  from_date date,
  to_date date,
  is_current boolean NOT NULL DEFAULT false,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.previous_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view previous positions in their workspace"
  ON public.previous_positions FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can create previous positions in their workspace"
  ON public.previous_positions FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can update previous positions in their workspace"
  ON public.previous_positions FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can delete previous positions in their workspace"
  ON public.previous_positions FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id());

-- Validation trigger for professional_bio length
CREATE OR REPLACE FUNCTION public.validate_professional_bio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.professional_bio IS NOT NULL AND length(NEW.professional_bio) > 1000 THEN
    RAISE EXCEPTION 'Professional bio must not exceed 1000 characters';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_entities_bio
  BEFORE INSERT OR UPDATE ON public.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_professional_bio();

-- Create profile-photos storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for profile-photos bucket
CREATE POLICY "Workspace members can upload profile photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = get_user_workspace_id()::text
  );

CREATE POLICY "Workspace members can view profile photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = get_user_workspace_id()::text
  );

CREATE POLICY "Workspace members can update profile photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = get_user_workspace_id()::text
  );

CREATE POLICY "Workspace members can delete profile photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = get_user_workspace_id()::text
  );
