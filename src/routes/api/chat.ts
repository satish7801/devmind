import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type Body = { messages: ChatMessage[]; system?: string };

// Simple keyword extractor for basic full-text-like search
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate user
          const authHeader = request.headers.get("authorization");
          let userId: string | null = null;
          if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.replace("Bearer ", "");
            const { data, error } = await supabaseAdmin.auth.getUser(token);
            if (!error && data?.user) {
              userId = data.user.id;
            }
          }

          if (!userId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { messages, system } = (await request.json()) as Body;
          if (!Array.isArray(messages)) {
            return new Response("messages required", { status: 400 });
          }

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return new Response(
              JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          // 2. Perform Retrieval (RAG)
          const lastUserMessage = messages.filter((m) => m.role === "user").pop()?.content || "";
          const keywords = extractKeywords(lastUserMessage);

          let ragContext = "";

          try {
            let prQuery = supabaseAdmin.from("pull_requests").select("number, title, state, html_url").eq("user_id", userId);
            let issueQuery = supabaseAdmin.from("issues").select("jira_key, summary, status, html_url").eq("user_id", userId);
            let commitQuery = supabaseAdmin.from("commits").select("sha, message, html_url").eq("user_id", userId);
            let slackQuery = supabaseAdmin.from("slack_messages").select("text, channel_name, permalink").eq("user_id", userId);

            if (keywords.length > 0) {
              const prOrs = keywords.map(k => `title.ilike.%${k}%`).join(",");
              prQuery = prQuery.or(prOrs);
              
              const issueOrs = keywords.map(k => `summary.ilike.%${k}%`).join(",");
              issueQuery = issueQuery.or(issueOrs);
              
              const commitOrs = keywords.map(k => `message.ilike.%${k}%`).join(",");
              commitQuery = commitQuery.or(commitOrs);
              
              const slackOrs = keywords.map(k => `text.ilike.%${k}%`).join(",");
              slackQuery = slackQuery.or(slackOrs);
            }

            const [
              { data: prs },
              { data: issues },
              { data: commits },
              { data: slackMsgs }
            ] = await Promise.all([
              prQuery.order("updated_at", { ascending: false }).limit(5),
              issueQuery.order("jira_updated_at", { ascending: false }).limit(5),
              commitQuery.order("committed_at", { ascending: false }).limit(5),
              slackQuery.order("created_at", { ascending: false }).limit(5),
            ]);

            if ((prs && prs.length > 0) || (issues && issues.length > 0) || (commits && commits.length > 0) || (slackMsgs && slackMsgs.length > 0)) {
              ragContext += "=== KNOWLEDGE BASE CONTEXT ===\n";
              ragContext += "Use the following context to answer the user's question. If the answer is not contained in the context, say so.\n\n";

              if (prs && prs.length > 0) {
                ragContext += "RECENT PULL REQUESTS:\n";
                prs.forEach(pr => {
                  ragContext += `- [PR #${pr.number}: ${pr.title}](${pr.html_url}) (State: ${pr.state})\n`;
                });
                ragContext += "\n";
              }

              if (issues && issues.length > 0) {
                ragContext += "RECENT JIRA ISSUES:\n";
                issues.forEach(iss => {
                  ragContext += `- [Issue ${iss.jira_key}: ${iss.summary}](${iss.html_url}) (Status: ${iss.status})\n`;
                });
                ragContext += "\n";
              }

              if (commits && commits.length > 0) {
                ragContext += "RECENT COMMITS:\n";
                commits.forEach(c => {
                  ragContext += `- [Commit ${c.sha.slice(0, 7)}: ${c.message?.split('\\n')[0] || ''}](${c.html_url})\n`;
                });
                ragContext += "\n";
              }

              if (slackMsgs && slackMsgs.length > 0) {
                ragContext += "RECENT SLACK MESSAGES:\n";
                slackMsgs.forEach(s => {
                  ragContext += `- [Message in #${s.channel_name}](${s.permalink || ''}): ${s.text}\n`;
                });
                ragContext += "\n";
              }
            }
          } catch (dbError) {
            console.error("RAG Retrieval error:", dbError);
            // Non-fatal, continue without context
          }

          // 3. Build Final Prompt
          const baseSystemPrompt = system || "You are an AI assistant.";
          const finalSystemPrompt = ragContext
            ? `${baseSystemPrompt}\n\n${ragContext}\n\nIMPORTANT: When referencing any of the pull requests, issues, or commits from the context above, you MUST use the provided markdown link to create a citation deep link.`
            : baseSystemPrompt;

          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-3-flash-preview");
          const { text } = await generateText({
            model,
            system: finalSystemPrompt,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          });
          
          return Response.json({ text });
        } catch (e) {
          console.error("AI chat error:", e);
          const msg = e instanceof Error ? e.message : "AI error";
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});