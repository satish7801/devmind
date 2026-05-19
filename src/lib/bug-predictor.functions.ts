import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { decryptToken } from "./crypto.server";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const GH = "https://api.github.com";

async function gh(token: string, path: string) {
  const res = await fetch(`${GH}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "DevMind",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export const getBugPredictions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Get GitHub token
    const { data: intData } = await supabase
      .from("integrations")
      .select("encrypted_token")
      .eq("user_id", userId)
      .eq("provider", "github")
      .maybeSingle();

    if (!intData?.encrypted_token) {
      return { hotspots: [], recommendations: [], notConnected: true };
    }

    const token = decryptToken(intData.encrypted_token);

    // 2. Get top repos from our DB
    const { data: repos } = await supabase
      .from("repos")
      .select("full_name")
      .eq("user_id", userId)
      .order("pushed_at", { ascending: false })
      .limit(5);

    if (!repos || repos.length === 0) {
      return { hotspots: [], recommendations: [], notSynced: true };
    }

    // 3. Aggregate file churn + bug signals from recent commits
    const filemap: Record<string, { changes: number; bugs: number }> = {};
    const bugKeywords = /\b(fix|bug|resolve|patch|revert|hotfix|error|crash|regression)\b/i;

    for (const repo of repos) {
      const commits: any[] = await gh(token, `/repos/${repo.full_name}/commits?per_page=15`) ?? [];
      for (const commit of commits.slice(0, 15)) {
        const detail: any = await gh(token, `/repos/${repo.full_name}/commits/${commit.sha}`);
        if (!detail?.files) continue;
        const isBugFix = bugKeywords.test(detail.commit?.message ?? "");
        for (const file of detail.files) {
          const key = file.filename;
          if (!filemap[key]) filemap[key] = { changes: 0, bugs: 0 };
          filemap[key].changes += (file.additions ?? 0) + (file.deletions ?? 0);
          if (isBugFix) filemap[key].bugs += 1;
        }
      }
    }

    // 4. Score and rank hotspots
    const hotspots = Object.entries(filemap)
      .map(([file, stats]) => {
        const churnScore = Math.min(60, Math.round(stats.changes / 8));
        const bugScore = Math.min(40, stats.bugs * 12);
        const risk = Math.min(99, churnScore + bugScore);
        return { file, ...stats, risk };
      })
      .filter(h => h.risk > 10)
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 8);

    // 5. AI Recommendations
    let recommendations: string[] = [];
    const key = process.env.LOVABLE_API_KEY;
    if (key && hotspots.length > 0) {
      const gateway = createLovableAiGatewayProvider(key);
      const model = gateway("google/gemini-3-flash-preview");
      const context = hotspots
        .slice(0, 5)
        .map(h => `${h.file}: ${h.changes} line changes, ${h.bugs} bug-related commits, risk score ${h.risk}`)
        .join("\n");

      try {
        const { text } = await generateText({
          model,
          system: "You are a senior software engineer advising on code quality. Based on file churn and bug history, give 3 concise, actionable recommendations (each under 25 words). Return ONLY a JSON array of 3 strings.",
          prompt: `Analyze these high-churn files and recommend improvements:\n${context}`,
        });
        const parsed = JSON.parse(text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, ""));
        if (Array.isArray(parsed)) recommendations = parsed.slice(0, 3);
      } catch {
        recommendations = [
          `Add unit tests to ${hotspots[0]?.file} — it has the highest churn and bug correlation.`,
          `Consider splitting high-coupling files to reduce blast radius of future bugs.`,
          `Freeze the top 2 risk files from non-critical changes before next release.`,
        ];
      }
    }

    return { hotspots, recommendations };
  });
