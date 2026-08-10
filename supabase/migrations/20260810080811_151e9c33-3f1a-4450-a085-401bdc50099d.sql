CREATE TABLE public.banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_code TEXT,
  country TEXT NOT NULL DEFAULT 'UAE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banks TO authenticated;
GRANT ALL ON public.banks TO service_role;

ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view banks"
ON public.banks FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Admins can insert banks"
ON public.banks FOR INSERT TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());

CREATE POLICY "Admins can update banks"
ON public.banks FOR UPDATE TO authenticated
USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin())
WITH CHECK (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());

CREATE POLICY "Admins can delete banks"
ON public.banks FOR DELETE TO authenticated
USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());

CREATE TRIGGER trg_banks_updated_at
BEFORE UPDATE ON public.banks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed each workspace with the standard UAE banks
INSERT INTO public.banks (workspace_id, name, display_order)
SELECT w.id, b.name, b.ord
FROM public.workspaces w
CROSS JOIN (VALUES
  ('Emirates NBD', 1),
  ('Abu Dhabi Commercial Bank (ADCB)', 2),
  ('First Abu Dhabi Bank (FAB)', 3),
  ('Dubai Islamic Bank (DIB)', 4),
  ('Mashreq Bank', 5),
  ('Abu Dhabi Islamic Bank (ADIB)', 6),
  ('Sharjah Islamic Bank (SIB)', 7),
  ('Commercial Bank of Dubai (CBD)', 8),
  ('Citibank UAE', 9),
  ('HSBC UAE', 10),
  ('Standard Chartered UAE', 11),
  ('Barclays UAE', 12)
) AS b(name, ord)
ON CONFLICT (workspace_id, name) DO NOTHING;

-- Migrate any manually typed custom bank names into the list
INSERT INTO public.banks (workspace_id, name, display_order)
SELECT DISTINCT workspace_id, trim(bank_name_custom), 100
FROM public.bank_accounts
WHERE bank_name = 'Other' AND bank_name_custom IS NOT NULL AND trim(bank_name_custom) <> ''
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO public.banks (workspace_id, name, display_order)
SELECT DISTINCT workspace_id, trim(bank_name_custom), 100
FROM public.bank_relationships
WHERE bank_name = 'Other' AND bank_name_custom IS NOT NULL AND trim(bank_name_custom) <> ''
ON CONFLICT (workspace_id, name) DO NOTHING;