
-- Enable pgcrypto for token encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- updated_at trigger function (reused)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- INTEGRATIONS (per-user, per-provider)
-- =========================================================
CREATE TYPE public.integration_provider AS ENUM ('github', 'jira', 'slack');

CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  encrypted_token TEXT,            -- pgp_sym_encrypt of access token / PAT
  account_login TEXT,              -- gh username / jira email / slack user
  account_id TEXT,                 -- provider-side id
  site_url TEXT,                   -- jira site, slack team url
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret TEXT,             -- for inbound webhook signature verification
  last_synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Users can see their own integration metadata, but the encrypted_token column
-- is selected only by server functions through the service role.
CREATE POLICY "Users view own integrations"
  ON public.integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own integrations"
  ON public.integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own integrations"
  ON public.integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own integrations"
  ON public.integrations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_integrations_user ON public.integrations(user_id);

-- =========================================================
-- GITHUB CACHE
-- =========================================================
CREATE TABLE public.repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  github_id BIGINT NOT NULL,
  full_name TEXT NOT NULL,         -- owner/repo
  description TEXT,
  default_branch TEXT,
  html_url TEXT NOT NULL,
  language TEXT,
  stars INT DEFAULT 0,
  pushed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, github_id)
);
ALTER TABLE public.repos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own repos" ON public.repos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own repos" ON public.repos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_repos_updated_at BEFORE UPDATE ON public.repos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_repos_user ON public.repos(user_id);

CREATE TABLE public.pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  number INT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  state TEXT NOT NULL,             -- open / closed / merged
  author_login TEXT,
  html_url TEXT NOT NULL,
  additions INT,
  deletions INT,
  changed_files INT,
  merged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, repo_full_name, number)
);
ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own PRs" ON public.pull_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own PRs" ON public.pull_requests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_prs_updated_at BEFORE UPDATE ON public.pull_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_prs_user ON public.pull_requests(user_id);

CREATE TABLE public.commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  sha TEXT NOT NULL,
  message TEXT,
  author_login TEXT,
  html_url TEXT NOT NULL,
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, repo_full_name, sha)
);
ALTER TABLE public.commits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own commits" ON public.commits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own commits" ON public.commits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_commits_user ON public.commits(user_id);

-- =========================================================
-- JIRA CACHE
-- =========================================================
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jira_key TEXT NOT NULL,          -- ABC-123
  summary TEXT NOT NULL,
  description TEXT,
  status TEXT,
  issue_type TEXT,
  priority TEXT,
  assignee TEXT,
  reporter TEXT,
  project_key TEXT,
  html_url TEXT NOT NULL,
  jira_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, jira_key)
);
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own issues" ON public.issues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own issues" ON public.issues FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_issues_user ON public.issues(user_id);

-- =========================================================
-- SLACK CACHE
-- =========================================================
CREATE TABLE public.slack_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_tracked BOOLEAN NOT NULL DEFAULT false,
  team_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_id)
);
ALTER TABLE public.slack_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own channels" ON public.slack_channels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own channels" ON public.slack_channels FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.slack_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  ts TEXT NOT NULL,                 -- slack message ts
  author TEXT,
  text TEXT,
  permalink TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_id, ts)
);
ALTER TABLE public.slack_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own messages" ON public.slack_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own messages" ON public.slack_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_slack_msgs_user ON public.slack_messages(user_id);

-- =========================================================
-- KNOWLEDGE GRAPH ANSWERS + CITATIONS
-- =========================================================
CREATE TABLE public.kg_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kg_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own kg" ON public.kg_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own kg" ON public.kg_answers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.kg_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES public.kg_answers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,        -- pr | commit | issue | slack | file
  source_ref TEXT NOT NULL,         -- e.g. owner/repo#123 or ABC-45
  title TEXT,
  url TEXT NOT NULL,
  position INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kg_citations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own citations" ON public.kg_citations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own citations" ON public.kg_citations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- NOTIFICATIONS (for realtime bell)
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,             -- github | jira | slack | system
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
