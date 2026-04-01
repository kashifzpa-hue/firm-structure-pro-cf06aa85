
DROP POLICY "Authenticated users can create workspaces" ON public.workspaces;

CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND workspace_id IS NOT NULL)
  );
