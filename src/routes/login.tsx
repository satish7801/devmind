import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — DevMind" },
      { name: "description", content: "Sign in to DevMind to connect GitHub, Jira, and Slack." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        setErr("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e?.message ?? "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (r.error) throw r.error;
    } catch (e: any) {
      setErr(e?.message ?? "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060a14", color: "#c8d8f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#0d111c", border: "1px solid #1e2637", borderRadius: 12, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#6ee7f7,#a78bfa)", borderRadius: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: "#e8f0ff" }}>DevMind</span>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "#e8f0ff", margin: "16px 0 4px" }}>
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p style={{ fontSize: 13, color: "#5a6a8a", marginBottom: 20 }}>
          Connect your repos, tickets, and Slack to bring DevMind to life.
        </p>

        <button onClick={google} disabled={busy}
          style={{ width: "100%", padding: "10px", background: "#fff", color: "#222", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: busy ? "wait" : "pointer", marginBottom: 14, fontFamily: "inherit" }}>
          Continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 14px", color: "#2a3a55", fontSize: 11 }}>
          <div style={{ flex: 1, height: 1, background: "#1e2637" }} /> OR <div style={{ flex: 1, height: 1, background: "#1e2637" }} />
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "signup" && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required maxLength={120}
              style={{ padding: "10px 12px", background: "#080c17", border: "1px solid #1e2637", borderRadius: 6, color: "#c8d8f0", fontSize: 13, fontFamily: "inherit" }} />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required maxLength={255}
            style={{ padding: "10px 12px", background: "#080c17", border: "1px solid #1e2637", borderRadius: 6, color: "#c8d8f0", fontSize: 13, fontFamily: "inherit" }} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required minLength={6} maxLength={72}
            style={{ padding: "10px 12px", background: "#080c17", border: "1px solid #1e2637", borderRadius: 6, color: "#c8d8f0", fontSize: 13, fontFamily: "inherit" }} />
          <button type="submit" disabled={busy}
            style={{ padding: "10px", background: "#6ee7f7", color: "#060a14", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: busy ? "wait" : "pointer", fontFamily: "inherit", marginTop: 4 }}>
            {busy ? "..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {err && <div style={{ marginTop: 12, fontSize: 12, color: "#ff9a9a" }}>{err}</div>}

        <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); }}
          style={{ background: "none", border: "none", color: "#6ee7f7", cursor: "pointer", fontSize: 12, marginTop: 16, padding: 0 }}>
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
