CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  record_label text,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  actor_user_id uuid,
  actor_profile_id uuid,
  actor_name text,
  actor_email text,
  changed_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view audit log"
ON public.audit_log FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE INDEX idx_audit_log_ws_created ON public.audit_log (workspace_id, created_at DESC);
CREATE INDEX idx_audit_log_record ON public.audit_log (table_name, record_id);

CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ws uuid;
  v_record_id uuid;
  v_label text;
  v_changes jsonb := '{}'::jsonb;
  v_profile RECORD;
  v_old jsonb;
  v_new jsonb;
  v_key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ws := OLD.workspace_id;
    v_record_id := OLD.id;
  ELSE
    v_ws := NEW.workspace_id;
    v_record_id := NEW.id;
  END IF;

  IF TG_TABLE_NAME = 'entities' THEN
    v_label := CASE WHEN TG_OP = 'DELETE' THEN OLD.name ELSE NEW.name END;
  ELSE
    v_label := CASE WHEN TG_OP = 'DELETE' THEN OLD.document_type ELSE NEW.document_type END;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_old -> v_key IS DISTINCT FROM v_new -> v_key THEN
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key)
        );
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT id, full_name, email INTO v_profile
  FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.audit_log (
    workspace_id, table_name, record_id, record_label, action,
    actor_user_id, actor_profile_id, actor_name, actor_email, changed_fields
  ) VALUES (
    v_ws, TG_TABLE_NAME, v_record_id, v_label, TG_OP,
    auth.uid(), v_profile.id, v_profile.full_name, v_profile.email, v_changes
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_entities
AFTER INSERT OR UPDATE OR DELETE ON public.entities
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER audit_documents
AFTER INSERT OR UPDATE OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

REVOKE EXECUTE ON FUNCTION public.record_audit_log() FROM PUBLIC, anon, authenticated;