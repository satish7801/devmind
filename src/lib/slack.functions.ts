import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/slack/api";

function authHeaders() {
  const lov = process.env.LOVABLE_API_KEY;
  const slack = process.env.SLACK_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY is not configured");
  if (!slack) throw new Error("SLACK_API_KEY is not configured (Slack connector not linked)");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": slack,
    "Content-Type": "application/json",
  };
}

async function slackCall<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${GATEWAY}/${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(`Slack ${path} failed: ${data.error || res.status}`);
  }
  return data;
}

/** Sync the workspace channel list into slack_channels for this user. */
export const syncSlackChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    let cursor = "";
    const channels: { channel_id: string; name: string; team_id: string | null }[] = [];
    do {
      const url = `conversations.list?limit=200&exclude_archived=true&types=public_channel,private_channel${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const data = await slackCall<any>(url);
      for (const c of data.channels ?? []) {
        channels.push({ channel_id: c.id, name: c.name, team_id: c.context_team_id ?? null });
      }
      cursor = data.response_metadata?.next_cursor ?? "";
    } while (cursor);

    // Upsert; preserve existing is_tracked flag
    if (channels.length) {
      const { data: existing } = await supabase
        .from("slack_channels")
        .select("channel_id,is_tracked")
        .eq("user_id", userId);
      const trackedMap = new Map(existing?.map((r) => [r.channel_id, r.is_tracked]) ?? []);
      const rows = channels.map((c) => ({
        user_id: userId,
        channel_id: c.channel_id,
        name: c.name,
        team_id: c.team_id,
        is_tracked: trackedMap.get(c.channel_id) ?? false,
      }));
      const { error } = await supabase
        .from("slack_channels")
        .upsert(rows, { onConflict: "user_id,channel_id" });
      if (error) throw error;
    }

    // Mark integration row
    await supabase
      .from("integrations")
      .upsert(
        { user_id: userId, provider: "slack", status: "active", last_synced_at: new Date().toISOString() },
        { onConflict: "user_id,provider" },
      );
    return { count: channels.length };
  });

export const listSlackChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("slack_channels")
      .select("channel_id,name,is_tracked")
      .eq("user_id", userId)
      .order("name", { ascending: true });
    if (error) throw error;
    return { channels: data ?? [] };
  });

export const setChannelTracked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().min(1).max(64), tracked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("slack_channels")
      .update({ is_tracked: data.tracked })
      .eq("user_id", userId)
      .eq("channel_id", data.channelId);
    if (error) throw error;
    return { ok: true };
  });

/** Pull recent messages from tracked channels, store + return them. */
export const syncTrackedMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: tracked } = await supabase
      .from("slack_channels")
      .select("channel_id,name")
      .eq("user_id", userId)
      .eq("is_tracked", true);
    let total = 0;
    for (const ch of tracked ?? []) {
      try {
        const data = await slackCall<any>(`conversations.history?channel=${ch.channel_id}&limit=20`);
        const rows = (data.messages ?? [])
          .filter((m: any) => m.type === "message" && m.text)
          .map((m: any) => ({
            user_id: userId,
            channel_id: ch.channel_id,
            channel_name: ch.name,
            ts: m.ts,
            author: m.user || m.bot_id || "unknown",
            text: m.text.slice(0, 4000),
            permalink: null,
            posted_at: new Date(Number(m.ts.split(".")[0]) * 1000).toISOString(),
          }));
        if (rows.length) {
          await supabase
            .from("slack_messages")
            .upsert(rows, { onConflict: "user_id,channel_id,ts" });
          total += rows.length;
        }
      } catch (e) {
        console.error("sync channel error", ch.name, e);
      }
    }
    return { count: total };
  });

export const listIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("integrations")
      .select("provider,status,last_synced_at,account_login,site_url")
      .eq("user_id", userId);
    if (error) throw error;
    return { integrations: data ?? [] };
  });
