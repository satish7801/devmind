import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptToken, decryptToken } from "./crypto.server";

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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub ${path} failed [${res.status}]: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function getToken(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("integrations")
    .select("encrypted_token")
    .eq("user_id", userId)
    .eq("provider", "github")
    .maybeSingle();
  if (error) throw error;
  if (!data?.encrypted_token) throw new Error("GitHub not connected");
  return decryptToken(data.encrypted_token);
}

export const connectGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(20).max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const me = await gh(data.token, "/user");
    const enc = encryptToken(data.token);
    const { error } = await supabase.from("integrations").upsert(
      {
        user_id: userId,
        provider: "github",
        status: "active",
        encrypted_token: enc,
        account_login: me.login,
        account_id: String(me.id),
        site_url: me.html_url,
        last_synced_at: null,
      },
      { onConflict: "user_id,provider" },
    );
    if (error) throw error;
    return { login: me.login };
  });

export const disconnectGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("integrations").delete().eq("user_id", userId).eq("provider", "github");
    return { ok: true };
  });

export const syncGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const token = await getToken(supabase, userId);

    // 1. Repos (owned + collaborator, sorted by recent push)
    const repos: any[] = await gh(token, "/user/repos?per_page=30&sort=pushed&affiliation=owner,collaborator");
    if (repos.length) {
      const repoRows = repos.map((r) => ({
        user_id: userId,
        github_id: r.id,
        full_name: r.full_name,
        html_url: r.html_url,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count ?? 0,
        default_branch: r.default_branch,
        pushed_at: r.pushed_at,
      }));
      const { error } = await supabase
        .from("repos")
        .upsert(repoRows, { onConflict: "user_id,github_id" });
      if (error) throw error;
    }

    // 2. PRs + commits for the top 5 most-recently-pushed repos
    let prCount = 0;
    let commitCount = 0;
    for (const r of repos.slice(0, 5)) {
      try {
        const prs: any[] = await gh(
          token,
          `/repos/${r.full_name}/pulls?state=all&per_page=15&sort=updated&direction=desc`,
        );
        const prRows = prs.map((p) => ({
          user_id: userId,
          repo_full_name: r.full_name,
          number: p.number,
          title: p.title,
          body: (p.body || "").slice(0, 4000),
          state: p.merged_at ? "merged" : p.state,
          author_login: p.user?.login,
          html_url: p.html_url,
          additions: p.additions ?? null,
          deletions: p.deletions ?? null,
          changed_files: p.changed_files ?? null,
          merged_at: p.merged_at,
          updated_at: p.updated_at,
        }));
        if (prRows.length) {
          await supabase
            .from("pull_requests")
            .upsert(prRows, { onConflict: "user_id,repo_full_name,number" });
          prCount += prRows.length;
        }

        const commits: any[] = await gh(
          token,
          `/repos/${r.full_name}/commits?per_page=15`,
        );
        const commitRows = commits.map((c) => ({
          user_id: userId,
          repo_full_name: r.full_name,
          sha: c.sha,
          message: (c.commit?.message || "").slice(0, 1000),
          author_login: c.author?.login || c.commit?.author?.name,
          html_url: c.html_url,
          committed_at: c.commit?.author?.date,
        }));
        if (commitRows.length) {
          await supabase
            .from("commits")
            .upsert(commitRows, { onConflict: "user_id,repo_full_name,sha" });
          commitCount += commitRows.length;
        }
      } catch (e) {
        console.error("github repo sync error", r.full_name, e);
      }
    }

    await supabase
      .from("integrations")
      .update({ last_synced_at: new Date().toISOString(), status: "active" })
      .eq("user_id", userId)
      .eq("provider", "github");

    return { repos: repos.length, prs: prCount, commits: commitCount };
  });

export const listGithubData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: repos }, { data: prs }, { data: commits }] = await Promise.all([
      supabase
        .from("repos")
        .select("full_name,html_url,language,stars,pushed_at,description")
        .eq("user_id", userId)
        .order("pushed_at", { ascending: false })
        .limit(20),
      supabase
        .from("pull_requests")
        .select("repo_full_name,number,title,state,author_login,html_url,additions,deletions,changed_files,updated_at,merged_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("commits")
        .select("repo_full_name,sha,message,author_login,html_url,committed_at")
        .eq("user_id", userId)
        .order("committed_at", { ascending: false })
        .limit(20),
    ]);
    return { repos: repos ?? [], prs: prs ?? [], commits: commits ?? [] };
  });