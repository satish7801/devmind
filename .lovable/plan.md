# DevMind: Real Integrations + KG Citations

Scope is large enough that I'll ship in phases. Each phase leaves DevMind in a working state. I'll do Phase 1 + 2 in this turn, then check in before Phase 3.

## Phase 1 — Auth foundation (this turn)
- Add Lovable Cloud auth: email/password + Google sign-in (via the managed broker).
- Create `/login` route, wrap DevMind UI in `_authenticated` layout with `beforeLoad` redirect.
- Add `profiles` table + auto-create trigger (display name, avatar from Google).
- Wire `onAuthStateChange` in `__root.tsx` so router invalidates on sign-in/out.
- Sign-out button in DevMind header.

## Phase 2 — Integrations data model + Slack (this turn)
- Tables (all RLS-scoped to `auth.uid()`):
  - `integrations` — one row per (user, provider). Stores encrypted token, metadata (jira site URL, github username, slack team).
  - `repos`, `pull_requests`, `commits`, `issues` (Jira), `slack_messages` — synced cache used by every DevMind module.
  - `kg_citations` — links any KG answer to source rows with deep URLs.
- Slack via the **managed Lovable Slack connector** (`standard_connectors--connect`) — fastest path. Server fns under `/lib/slack.functions.ts` fetch channels + recent messages through the gateway. Channel selector in Settings.

## Phase 3 — GitHub + Jira PAT flow (next turn, after Phase 2 lands)
- Settings page: "Connect GitHub" / "Connect Jira" forms → POSTs to server fn that validates the token (calls `/user` for GH, `/myself` for Jira) and stores encrypted in `integrations`.
- Sync server fns: pull repos/PRs/commits, projects/issues/sprints. Manual "Sync now" button + initial backfill on connect.
- Replace all hardcoded demo data in `DevMindApp.tsx` modules with real queries. Loading + empty states for each module when nothing is connected yet.

## Phase 4 — Webhooks (next turn)
- Public routes under `src/routes/api/public/webhooks/`:
  - `github` — verify `X-Hub-Signature-256` against per-integration secret, upsert PR/commit rows.
  - `jira` — verify shared secret in query string, upsert issue rows.
  - `slack` — Events API; verify Slack signing secret, upsert messages.
- Each handler emits a `notifications` row so the in-app bell updates in real time (Supabase Realtime subscription).
- Settings page shows the 3 webhook URLs to paste into GitHub repo settings / Jira automation / Slack app config.

## Phase 5 — Knowledge Graph citations (next turn)
- `/api/chat` becomes RAG-style: server fn pulls top-k relevant rows from `repos/prs/issues/messages` for the user's org, embeds them as context, asks the model to answer **and** return citations as JSON `[{type, id, title, url}]`.
- KG answer panel renders the answer with inline `[1]` `[2]` markers linking to:
  - GitHub: `https://github.com/{repo}/pull/{n}` or `/commit/{sha}` or `/blob/{sha}/{path}`
  - Jira: `https://{site}/browse/{key}`
  - Slack: `https://{team}.slack.com/archives/{channel}/p{ts}`
- Persist citations to `kg_citations` so users can revisit past answers.

## Technical notes
- All tokens stored encrypted in `integrations.encrypted_token` using `pgp_sym_encrypt` with a key from `secrets.INTEGRATION_ENC_KEY`. Never returned to the client; server fns decrypt at use-time.
- All sync + webhook + AI calls go through `createServerFn` (or server routes for webhooks). No data-fetching from the browser other than via server fns.
- RLS everywhere; `has_role`-style helper not needed since data is per-user.
- DevMindApp keeps `// @ts-nocheck` for now; new integration code is fully typed.

## What I need from you after Phase 2
- Confirm webhook approach (vs polling) is still right once you see the Settings UI.
- For Phase 3, you'll be prompted to paste a GitHub PAT (with `repo` scope) and a Jira API token + site URL, in the Settings page once it's live — no need to gather them now.

Reply "go" to start Phase 1+2, or tell me to adjust scope first.