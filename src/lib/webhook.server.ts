import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// GitHub — HMAC-SHA256 signature verification
// Verifies the X-Hub-Signature-256 header that GitHub sends with every delivery.
// ---------------------------------------------------------------------------

/**
 * Returns true if the `X-Hub-Signature-256` header matches the expected HMAC
 * computed over `rawBody` using the integration's `webhookSecret`.
 */
export function verifyGithubSignature(
  webhookSecret: string,
  rawBody: string,
  sigHeader: string | null,
): boolean {
  if (!sigHeader?.startsWith("sha256=")) return false;
  const provided = Buffer.from(sigHeader.slice("sha256=".length), "hex");
  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest();
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Jira — simple constant-time secret comparison
// Users embed their webhook_secret as a query param in the Jira webhook URL.
// ---------------------------------------------------------------------------

/**
 * Returns true if the provided secret matches the stored secret.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyJiraSecret(stored: string, provided: string): boolean {
  try {
    const a = Buffer.from(stored, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// User lookup helpers (use service-role to bypass RLS)
// ---------------------------------------------------------------------------

/**
 * Look up the user_id of a connected GitHub integration by the GitHub account
 * login (e.g. "octocat"). Returns null if no matching integration is found.
 */
export async function lookupUserByGithubLogin(
  login: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select("user_id")
    .eq("provider", "github")
    .eq("account_login", login)
    .maybeSingle();
  if (error) {
    console.error("[webhook] github user lookup error", error);
    return null;
  }
  return data?.user_id ?? null;
}

/**
 * Fetch the stored webhook_secret for a specific provider + user.
 * Returns null if the integration is not found or has no secret.
 */
export async function getWebhookSecret(
  userId: string,
  provider: "github" | "jira",
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select("webhook_secret")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) {
    console.error(`[webhook] ${provider} secret lookup error`, error);
    return null;
  }
  return data?.webhook_secret ?? null;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Insert a raw webhook event row for auditing purposes. */
export async function recordWebhookEvent(
  provider: string,
  eventType: string,
  payload: unknown,
  userId: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin.from("webhook_events").insert({
    provider,
    event_type: eventType,
    payload: payload as any,
    user_id: userId ?? null,
  });
  if (error) console.error("[webhook] failed to record event", error);
}

/** Insert a notification row to trigger realtime UI updates. */
export async function insertNotification(
  userId: string,
  source: string,
  title: string,
  body: string | null,
  url: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    source,
    title,
    body,
    url,
    is_read: false,
  });
  if (error) console.error("[webhook] failed to insert notification", error);
}
