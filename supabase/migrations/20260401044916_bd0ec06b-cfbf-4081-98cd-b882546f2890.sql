
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');

-- Create enum for entity type
CREATE TYPE public.entity_type AS ENUM ('person', 'company');

-- Create workspaces table
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  UNIQUE(user_id, workspace_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create entities table
CREATE TABLE public.entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type entity_type NOT NULL,
  name TEXT NOT NULL,
  nationality_or_jurisdiction TEXT,
  date_of_birth_or_incorporation DATE,
  email TEXT,
  phone TEXT,
  company_type TEXT,
  registration_number TEXT,
  registered_address TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Helper function to get workspace_id for current user (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Helper function to check role
CREATE OR REPLACE FUNCTION public.has_workspace_role(_user_id UUID, _workspace_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role = _role
  )
$$;

-- RLS policies for workspaces
CREATE POLICY "Users can view their own workspace"
  ON public.workspaces FOR SELECT
  USING (id = public.get_user_workspace_id());

CREATE POLICY "Users can update their own workspace"
  ON public.workspaces FOR UPDATE
  USING (id = public.get_user_workspace_id() AND public.has_workspace_role(auth.uid(), id, 'admin'));

CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS policies for profiles
CREATE POLICY "Users can view profiles in their workspace"
  ON public.profiles FOR SELECT
  USING (workspace_id = public.get_user_workspace_id() OR user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

-- RLS policies for user_roles
CREATE POLICY "Users can view roles in their workspace"
  ON public.user_roles FOR SELECT
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Users can insert their own role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage roles in their workspace"
  ON public.user_roles FOR DELETE
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- RLS policies for entities
CREATE POLICY "Users can view entities in their workspace"
  ON public.entities FOR SELECT
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Users can create entities in their workspace"
  ON public.entities FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Users can update entities in their workspace"
  ON public.entities FOR UPDATE
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Admins can delete entities in their workspace"
  ON public.entities FOR DELETE
  USING (workspace_id = public.get_user_workspace_id());

-- RLS policies for documents
CREATE POLICY "Users can view documents in their workspace"
  ON public.documents FOR SELECT
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Users can create documents in their workspace"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Users can update documents in their workspace"
  ON public.documents FOR UPDATE
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Users can delete documents in their workspace"
  ON public.documents FOR DELETE
  USING (workspace_id = public.get_user_workspace_id());

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies
CREATE POLICY "Workspace members can view documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_workspace_id()::text);

CREATE POLICY "Workspace members can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_workspace_id()::text);

CREATE POLICY "Workspace members can delete documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_workspace_id()::text);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
