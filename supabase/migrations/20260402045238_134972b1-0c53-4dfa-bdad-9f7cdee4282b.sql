-- Create notification_type enum
CREATE TYPE public.notification_type AS ENUM (
  'DOCUMENT_EXPIRED',
  'DOCUMENT_EXPIRING_SOON',
  'MOVEMENT_DRAFT_PENDING',
  'UBO_THRESHOLD_BREACH',
  'SHAREHOLDING_GAP',
  'UNRESOLVED_UBO_CHAIN',
  'LIVE_MODE_ACTIVATED',
  'ENTITY_DEACTIVATED',
  'SYSTEM_ALERT'
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES public.profiles(id),
  notification_type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  movement_id UUID REFERENCES public.movements(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action_url TEXT
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notifications in their workspace"
  ON public.notifications FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can update notifications in their workspace"
  ON public.notifications FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Users can delete notifications in their workspace"
  ON public.notifications FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

-- Index for fast unread count queries
CREATE INDEX idx_notifications_workspace_unread
  ON public.notifications (workspace_id, is_read)
  WHERE is_read = false;

CREATE INDEX idx_notifications_dedup
  ON public.notifications (document_id, notification_type, created_at);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create alert_rules table
CREATE TABLE public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  rule_type public.notification_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  threshold_days INTEGER,
  notify_in_app BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  additional_emails TEXT[],
  sender_email TEXT DEFAULT 'noreply@corpsync.app',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alert rules in their workspace"
  ON public.alert_rules FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Admins can insert alert rules"
  ON public.alert_rules FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id() AND has_workspace_role(auth.uid(), workspace_id, 'admin'));

CREATE POLICY "Admins can update alert rules"
  ON public.alert_rules FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id() AND has_workspace_role(auth.uid(), workspace_id, 'admin'));

CREATE POLICY "Admins can delete alert rules"
  ON public.alert_rules FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id() AND has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- Trigger to create default alert rules when a workspace is created
CREATE OR REPLACE FUNCTION public.create_default_alert_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.alert_rules (workspace_id, rule_type, threshold_days, notify_in_app, notify_email) VALUES
    (NEW.id, 'DOCUMENT_EXPIRING_SOON', 60, true, false),
    (NEW.id, 'DOCUMENT_EXPIRING_SOON', 30, true, true),
    (NEW.id, 'DOCUMENT_EXPIRED', NULL, true, true),
    (NEW.id, 'MOVEMENT_DRAFT_PENDING', 7, true, true),
    (NEW.id, 'UBO_THRESHOLD_BREACH', NULL, true, true),
    (NEW.id, 'SYSTEM_ALERT', NULL, true, true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_alert_rules
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_alert_rules();

-- Update timestamp trigger for alert_rules
CREATE OR REPLACE FUNCTION public.update_alert_rules_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alert_rules_timestamp();