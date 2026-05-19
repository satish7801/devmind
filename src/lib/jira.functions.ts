import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptToken, decryptToken } from "./crypto.server";

function basicAuth(email: string, token: string) {
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

async function jira(siteUrl: string, auth: string, path: string) {
  const res = await fetch(`${siteUrl.replace(/\/$/, "")}${path}`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Jira ${path} failed [${res.status}]: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function getCreds(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("integrations")
    .select("encrypted_token,site_url,account_login")
    .eq("user_id", userId)
    .eq("provider", "jira")
    .maybeSingle();
  if (error) throw error;
  if (!data?.encrypted_token || !data.site_url || !data.account_login)
    throw new Error("Jira not connected");
  return {
    siteUrl: data.site_url,
    auth: basicAuth(data.account_login, decryptToken(data.encrypted_token)),
  };
}

export const connectJira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        siteUrl: z.string().url().max(255),
        email: z.string().email().max(255),
        token: z.string().min(10).max(255),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = basicAuth(data.email, data.token);
    const me = await jira(data.siteUrl, auth, "/rest/api/3/myself");
    const { error } = await supabase.from("integrations").upsert(
      {
        user_id: userId,
        provider: "jira",
        status: "active",
        encrypted_token: encryptToken(data.token),
        account_login: data.email,
        account_id: me.accountId,
        site_url: data.siteUrl,
        last_synced_at: null,
      },
      { onConflict: "user_id,provider" },
    );
    if (error) throw error;
    return { displayName: me.displayName };
  });

export const disconnectJira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("integrations").delete().eq("user_id", userId).eq("provider", "jira");
    return { ok: true };
  });

export const syncJira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { siteUrl, auth } = await getCreds(supabase, userId);

    const jql = encodeURIComponent("updated >= -30d ORDER BY updated DESC");
    const fields = "summary,status,priority,issuetype,assignee,reporter,project,updated,description";
    const data = await jira(
      siteUrl,
      auth,
      `/rest/api/3/search?jql=${jql}&maxResults=50&fields=${fields}`,
    );

    const rows = (data.issues ?? []).map((i: any) => ({
      user_id: userId,
      jira_key: i.key,
      summary: (i.fields?.summary || "").slice(0, 500),
      description: null,
      status: i.fields?.status?.name ?? null,
      priority: i.fields?.priority?.name ?? null,
      issue_type: i.fields?.issuetype?.name ?? null,
      assignee: i.fields?.assignee?.displayName ?? null,
      reporter: i.fields?.reporter?.displayName ?? null,
      project_key: i.fields?.project?.key ?? null,
      html_url: `${siteUrl.replace(/\/$/, "")}/browse/${i.key}`,
      jira_updated_at: i.fields?.updated ?? null,
    }));
    if (rows.length) {
      const { error } = await supabase
        .from("issues")
        .upsert(rows, { onConflict: "user_id,jira_key" });
      if (error) throw error;
    }

    await supabase
      .from("integrations")
      .update({ last_synced_at: new Date().toISOString(), status: "active" })
      .eq("user_id", userId)
      .eq("provider", "jira");

    return { count: rows.length };
  });

export const listJiraIssues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("issues")
      .select("jira_key,summary,status,priority,issue_type,assignee,html_url,jira_updated_at,project_key")
      .eq("user_id", userId)
      .order("jira_updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return { issues: data ?? [] };
  });