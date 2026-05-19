import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  verifyGithubSignature,
  lookupUserByGithubLogin,
  recordWebhookEvent,
  insertNotification,
} from "@/lib/webhook.server";

export const Route = createFileRoute("/api/webhooks/github")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const rawBody = await request.text();
          const signature = request.headers.get("x-hub-signature-256");
          const eventType = request.headers.get("x-github-event");

          if (!eventType || !signature) {
            return new Response("Missing GitHub headers", { status: 400 });
          }

          let payload: any;
          try {
            payload = JSON.parse(rawBody);
          } catch (e) {
            return new Response("Invalid JSON payload", { status: 400 });
          }

          if (eventType === "ping") {
            return Response.json({ ok: true, msg: "pong" });
          }

          const login = payload.sender?.login;
          if (!login) {
            return new Response("Missing sender.login in payload", { status: 400 });
          }

          const userId = await lookupUserByGithubLogin(login);
          if (!userId) {
            // We record it without user_id if we don't know who it is
            await recordWebhookEvent("github", eventType, payload, null);
            return Response.json({ ok: true, msg: "Ignored: unknown user" });
          }

          // Verify signature (we need the webhook secret for this user)
          const { data: intData } = await supabaseAdmin
            .from("integrations")
            .select("webhook_secret")
            .eq("user_id", userId)
            .eq("provider", "github")
            .maybeSingle();

          const secret = intData?.webhook_secret;
          if (!secret) {
            return Response.json({ ok: false, msg: "Webhook secret not configured" }, { status: 403 });
          }

          if (!verifyGithubSignature(secret, rawBody, signature)) {
            return Response.json({ ok: false, msg: "Invalid signature" }, { status: 401 });
          }

          // Record event
          await recordWebhookEvent("github", eventType, payload, userId);

          // Process supported events
          if (eventType === "push") {
            const commits = payload.commits || [];
            if (commits.length > 0 && payload.repository) {
              const repoFullName = payload.repository.full_name;
              const commitRows = commits.map((c: any) => ({
                user_id: userId,
                repo_full_name: repoFullName,
                sha: c.id,
                message: c.message?.slice(0, 1000) || "",
                author_login: c.author?.username || c.author?.name,
                html_url: c.url,
                committed_at: c.timestamp,
              }));

              const { error } = await supabaseAdmin
                .from("commits")
                .upsert(commitRows, { onConflict: "user_id,repo_full_name,sha" });

              if (!error) {
                await insertNotification(
                  userId,
                  "github",
                  `Push to ${repoFullName}`,
                  `${commits.length} new commit(s) by ${login}`,
                  payload.repository.html_url
                );
              } else {
                 console.error("Error upserting commits", error);
              }
            }
          } else if (eventType === "pull_request") {
             const pr = payload.pull_request;
             if (pr && payload.repository) {
                const prRow = {
                  user_id: userId,
                  repo_full_name: payload.repository.full_name,
                  number: pr.number,
                  title: pr.title,
                  body: (pr.body || "").slice(0, 4000),
                  state: pr.merged_at ? "merged" : pr.state,
                  author_login: pr.user?.login,
                  html_url: pr.html_url,
                  additions: pr.additions ?? null,
                  deletions: pr.deletions ?? null,
                  changed_files: pr.changed_files ?? null,
                  merged_at: pr.merged_at,
                  updated_at: pr.updated_at,
                };

                const { error } = await supabaseAdmin
                  .from("pull_requests")
                  .upsert([prRow], { onConflict: "user_id,repo_full_name,number" });

                if (!error) {
                  await insertNotification(
                    userId,
                    "github",
                    `PR #${pr.number} ${payload.action}`,
                    pr.title,
                    pr.html_url
                  );
                } else {
                  console.error("Error upserting PR", error);
                }
             }
          }

          // Update last_synced_at
          await supabaseAdmin
            .from("integrations")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("provider", "github");

          return Response.json({ ok: true });
        } catch (error) {
          console.error("GitHub webhook error:", error);
          return Response.json({ error: "Internal Server Error" }, { status: 500 });
        }
      },
    },
  },
});
