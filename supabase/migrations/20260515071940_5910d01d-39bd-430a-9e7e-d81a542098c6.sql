
-- integrations
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_user_provider_uq UNIQUE (user_id, provider);

-- slack
ALTER TABLE public.slack_channels
  ADD CONSTRAINT slack_channels_user_channel_uq UNIQUE (user_id, channel_id);
ALTER TABLE public.slack_messages
  ADD CONSTRAINT slack_messages_user_channel_ts_uq UNIQUE (user_id, channel_id, ts);

-- github
ALTER TABLE public.repos
  ADD CONSTRAINT repos_user_github_id_uq UNIQUE (user_id, github_id);
ALTER TABLE public.pull_requests
  ADD CONSTRAINT pull_requests_user_repo_number_uq UNIQUE (user_id, repo_full_name, number);
ALTER TABLE public.commits
  ADD CONSTRAINT commits_user_repo_sha_uq UNIQUE (user_id, repo_full_name, sha);

-- jira
ALTER TABLE public.issues
  ADD CONSTRAINT issues_user_jira_key_uq UNIQUE (user_id, jira_key);
