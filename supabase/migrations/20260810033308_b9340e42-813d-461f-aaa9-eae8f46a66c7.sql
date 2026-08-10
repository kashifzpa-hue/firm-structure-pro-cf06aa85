CREATE TABLE public.ai_prompt_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.ai_threads(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  user_email text,
  model text NOT NULL,
  provider text NOT NULL DEFAULT 'lovable-ai-gateway',
  run_id text,
  system_prompt text,
  sent_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  available_tools text[] NOT NULL DEFAULT '{}',
  tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_text text,
  finish_reason text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  duration_ms integer,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_prompt_logs TO authenticated;
GRANT ALL ON public.ai_prompt_logs TO service_role;

ALTER TABLE public.ai_prompt_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace admins can view AI prompt logs"
ON public.ai_prompt_logs FOR SELECT TO authenticated
USING (workspace_id = public.get_user_workspace_id() AND public.is_workspace_admin());

CREATE INDEX idx_ai_prompt_logs_ws_created ON public.ai_prompt_logs (workspace_id, created_at DESC);