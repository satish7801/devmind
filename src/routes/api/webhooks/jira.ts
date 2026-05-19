import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyJiraSecret, recordWebhookEvent, insertNotification } from "@/lib/webhook.server";

export const Route = createFileRoute("/api/webhooks/jira")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const uid = url.searchParams.get("uid");
          const secretParam = url.searchParams.get("secret");

          if (!uid || !secretParam) {
            return new Response("Missing uid or secret in query string", { status: 400 });
          }

          let payload: any;
          try {
            payload = await request.json();
          } catch (e) {
            return new Response("Invalid JSON payload", { status: 400 });
          }

          const { data: intData } = await supabaseAdmin
            .from("integrations")
            .select("webhook_secret, site_url")
            .eq("user_id", uid)
            .eq("provider", "jira")
            .maybeSingle();

          const storedSecret = intData?.webhook_secret;
          if (!storedSecret) {
            return Response.json({ ok: false, msg: "Webhook secret not configured" }, { status: 403 });
          }

          if (!verifyJiraSecret(storedSecret, secretParam)) {
            return Response.json({ ok: false, msg: "Invalid secret" }, { status: 401 });
          }

          const eventType = payload.webhookEvent;
          await recordWebhookEvent("jira", eventType || "unknown", payload, uid);

          if (!eventType) {
              return Response.json({ ok: true, msg: "No webhookEvent field" });
          }

          const siteUrl = intData.site_url;

          if (eventType.startsWith("jira:issue_")) {
              const i = payload.issue;
              if (i && i.key) {
                  if (eventType === "jira:issue_deleted") {
                      await supabaseAdmin
                        .from("issues")
                        .delete()
                        .eq("user_id", uid)
                        .eq("jira_key", i.key);
                      
                      await insertNotification(
                        uid,
                        "jira",
                        `Issue ${i.key} Deleted`,
                        null,
                        null
                      );
                  } else {
                     // created or updated
                     const row = {
                        user_id: uid,
                        jira_key: i.key,
                        summary: (i.fields?.summary || "").slice(0, 500),
                        description: null, // Keep it simple or parse if needed
                        status: i.fields?.status?.name ?? null,
                        priority: i.fields?.priority?.name ?? null,
                        issue_type: i.fields?.issuetype?.name ?? null,
                        assignee: i.fields?.assignee?.displayName ?? null,
                        reporter: i.fields?.reporter?.displayName ?? null,
                        project_key: i.fields?.project?.key ?? null,
                        html_url: siteUrl ? `${siteUrl.replace(/\/$/, "")}/browse/${i.key}` : "",
                        jira_updated_at: i.fields?.updated ?? null,
                     };
                     
                     const { error } = await supabaseAdmin
                        .from("issues")
                        .upsert([row], { onConflict: "user_id,jira_key" });
                     
                     if (!error) {
                        const action = eventType === "jira:issue_created" ? "Created" : "Updated";
                        await insertNotification(
                            uid,
                            "jira",
                            `Issue ${i.key} ${action}`,
                            row.summary,
                            row.html_url
                        );
                     } else {
                        console.error("Error upserting issue", error);
                     }
                  }
              }
          }

          // Update last_synced_at
          await supabaseAdmin
            .from("integrations")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("user_id", uid)
            .eq("provider", "jira");

          return Response.json({ ok: true });
        } catch (error) {
          console.error("Jira webhook error:", error);
          return Response.json({ error: "Internal Server Error" }, { status: 500 });
        }
      },
    },
  },
});
