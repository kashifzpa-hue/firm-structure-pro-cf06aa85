
-- ============================================
-- CRITICAL FIX 1: Signatures storage isolation
-- ============================================

-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Users can view processed signatures" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update signatures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete signatures" ON storage.objects;

-- SELECT: only processed folder, only own workspace
CREATE POLICY "Workspace members can view their processed signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[1] = 'processed'
  AND (storage.foldername(name))[2] = (public.get_user_workspace_id())::text
);

-- INSERT: only own workspace folder
CREATE POLICY "Workspace members can upload their signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[2] = (public.get_user_workspace_id())::text
);

-- UPDATE: only own workspace
CREATE POLICY "Workspace members can update their signatures"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[2] = (public.get_user_workspace_id())::text
);

-- DELETE: only own workspace
CREATE POLICY "Workspace members can delete their signatures"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[2] = (public.get_user_workspace_id())::text
);

-- ============================================
-- CRITICAL FIX 2: public → authenticated
-- ============================================

-- documents: SELECT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can view documents in their workspace" ON public.documents;
CREATE POLICY "Users can view documents in their workspace"
ON public.documents FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Users can update documents in their workspace" ON public.documents;
CREATE POLICY "Users can update documents in their workspace"
ON public.documents FOR UPDATE TO authenticated
USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Users can delete documents in their workspace" ON public.documents;
CREATE POLICY "Users can delete documents in their workspace"
ON public.documents FOR DELETE TO authenticated
USING (workspace_id = public.get_user_workspace_id());

-- entities: SELECT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can view entities in their workspace" ON public.entities;
CREATE POLICY "Users can view entities in their workspace"
ON public.entities FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Users can update entities in their workspace" ON public.entities;
CREATE POLICY "Users can update entities in their workspace"
ON public.entities FOR UPDATE TO authenticated
USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Admins can delete entities in their workspace" ON public.entities;
CREATE POLICY "Admins can delete entities in their workspace"
ON public.entities FOR DELETE TO authenticated
USING (workspace_id = public.get_user_workspace_id());

-- profiles: SELECT, UPDATE
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON public.profiles;
CREATE POLICY "Users can view profiles in their workspace"
ON public.profiles FOR SELECT TO authenticated
USING ((workspace_id = public.get_user_workspace_id()) OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- user_roles: SELECT, DELETE
DROP POLICY IF EXISTS "Users can view roles in their workspace" ON public.user_roles;
CREATE POLICY "Users can view roles in their workspace"
ON public.user_roles FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Admins can manage roles in their workspace" ON public.user_roles;
CREATE POLICY "Admins can manage roles in their workspace"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'::public.app_role));

-- workspaces: SELECT, UPDATE
DROP POLICY IF EXISTS "Users can view their own workspace" ON public.workspaces;
CREATE POLICY "Users can view their own workspace"
ON public.workspaces FOR SELECT TO authenticated
USING (id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Users can update their own workspace" ON public.workspaces;
CREATE POLICY "Users can update their own workspace"
ON public.workspaces FOR UPDATE TO authenticated
USING ((id = public.get_user_workspace_id()) AND public.has_workspace_role(auth.uid(), id, 'admin'::public.app_role));

-- documents storage bucket: fix SELECT and DELETE if public
DROP POLICY IF EXISTS "Users can view documents in their workspace bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents in their workspace bucket" ON storage.objects;
