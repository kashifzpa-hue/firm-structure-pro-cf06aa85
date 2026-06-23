
-- 1. Notifications: per-recipient access
DROP POLICY IF EXISTS "Users can view notifications in their workspace" ON public.notifications;
DROP POLICY IF EXISTS "Users can update notifications in their workspace" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete notifications in their workspace" ON public.notifications;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND (recipient_user_id = auth.uid() OR recipient_user_id IS NULL)
);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND (recipient_user_id = auth.uid() OR recipient_user_id IS NULL)
);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (
  workspace_id = public.get_user_workspace_id()
  AND (recipient_user_id = auth.uid() OR recipient_user_id IS NULL)
);

-- 2. user_roles: remove self-insert (privilege escalation). Role assignment is done via SECURITY DEFINER functions create_workspace / accept_invitation.
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

-- 3. Documents storage bucket: restrict to authenticated role
DROP POLICY IF EXISTS "Workspace members can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members can delete documents" ON storage.objects;

CREATE POLICY "Workspace members can view documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (public.get_user_workspace_id())::text
);

CREATE POLICY "Workspace members can delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (public.get_user_workspace_id())::text
);

-- 4. Revoke EXECUTE on SECURITY DEFINER functions from PUBLIC and anon.
--    Trigger/internal functions: also revoke from authenticated.
--    User-facing RPCs and RLS-helper functions: keep authenticated execute.

-- Revoke from PUBLIC and anon for all
REVOKE EXECUTE ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.activate_live_mode(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_ubo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_circular_ownership(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_movement(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_workspace(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.void_movement(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trigger_ubo_recalculate_for_company(uuid) FROM PUBLIC, anon;

-- Internal-only / trigger functions: revoke from authenticated as well
REVOKE EXECUTE ON FUNCTION public.create_default_alert_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ubo_on_equity_links() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ubo_on_movement_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ubo_on_voting_rights() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ubo_recalculate_for_company(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_equity_link_allocation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_share_class_total_shares() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_alert_rules_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_professional_bio() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_insert_secret(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_read_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_ubo(uuid) FROM authenticated;
