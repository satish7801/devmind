import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { decryptToken } from "./crypto.server";
import { generateObject } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const GH = "https://api.github.com";

export const runAIReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        repo_full_name: z.string(),
        pr_number: z.number(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { repo_full_name, pr_number } = data;

    // 1. Get the user's GitHub token
    const { data: intData, error } = await supabase
      .from("integrations")
      .select("encrypted_token")
      .eq("user_id", userId)
      .eq("provider", "github")
      .maybeSingle();

    if (error) throw error;
    if (!intData?.encrypted_token) throw new Error("GitHub not connected");

    const token = decryptToken(intData.encrypted_token);

    // 2. Fetch the PR Diff
    const res = await fetch(`${GH}/repos/${repo_full_name}/pulls/${pr_number}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3.diff",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "DevMind",
      },
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GitHub Diff fetch failed [${res.status}]: ${t.slice(0, 200)}`);
    }

    const diffContent = await res.text();
    // Truncate diff if it's astronomically large to prevent context limits
    const safeDiff = diffContent.slice(0, 40000); 

    // 3. Run AI Code Review
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const { object } = await generateObject({
      model,
      schema: z.object({
        risk: z.number().min(0).max(100).describe("Overall risk score of the PR based on churn and complexity (0 is safe, 100 is highly risky)"),
        summary: z.string().describe("A concise 1-2 sentence summary of the AI's review"),
        issues: z.array(
          z.object({
            type: z.enum(["security", "perf", "style", "debt", "bug"]),
            msg: z.string().describe("Concise description of the finding"),
            line: z.number().describe("The approximate line number in the diff, or 0 if general"),
          })
        ).describe("List of up to 5 critical issues found in the PR diff"),
        tags: z.array(z.string()).describe("List of 2-4 short tags describing the context or patterns used (e.g., 'Auth module history', 'Security rules')"),
      }),
      system: "You are an expert Senior Staff Engineer conducting a rigorous code review. Analyze the provided Git diff. Identify security vulnerabilities, performance bottlenecks, style issues, technical debt, and logical bugs. Provide a realistic risk score (0-100) and actionable findings.",
      prompt: `Please review the following PR diff for ${repo_full_name}#${pr_number}:\n\n${safeDiff}`,
    });

    return object;
  });
