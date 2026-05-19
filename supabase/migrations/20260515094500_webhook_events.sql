-- =========================================================
-- WEBHOOK EVENTS (raw inbound event audit log)
-- =========================================================
CREATE TABLE public.webhook_events (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT         NOT NULL,          -- 'github' | 'jira'
  event_type    TEXT         NOT NULL,          -- 'push', 'pull_request', 'jira:issue_updated', …
  payload       JSONB        NOT NULL,
  user_id       UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own webhook events"
  ON public.webhook_events FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_webhook_events_user
  ON public.webhook_events(user_id, processed_at DESC);

-- Subscribe to realtime so the frontend can react immediately
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_events;
