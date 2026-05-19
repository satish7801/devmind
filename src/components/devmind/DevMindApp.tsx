// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listSlackChannels, syncSlackChannels, setChannelTracked, syncTrackedMessages, listIntegrationStatus } from "@/lib/slack.functions";
import { connectGithub, disconnectGithub, syncGithub, listGithubData } from "@/lib/github.functions";
import { connectJira, disconnectJira, syncJira, listJiraIssues } from "@/lib/jira.functions";
import { runAIReview } from "@/lib/review.functions";
import { getBugPredictions } from "@/lib/bug-predictor.functions";
import { useRealtimeNotifications } from "@/hooks/use-realtime-events";

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    dashboard:       <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    code:            <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    bug:             <><circle cx="12" cy="13" r="4"/><line x1="12" y1="9" x2="12" y2="3"/><line x1="5" y1="6" x2="8.5" y2="9.5"/><line x1="19" y1="6" x2="15.5" y2="9.5"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="18" y1="14" x2="22" y2="14"/><line x1="5" y1="20" x2="8.5" y2="16.5"/><line x1="19" y1="20" x2="15.5" y2="16.5"/></>,
    graph:           <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
    sprint:          <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    onboard:         <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    architecture:    <><polyline points="3 6 12 3 21 6"/><line x1="12" y1="3" x2="12" y2="21"/><path d="M3 6v12l9 3 9-3V6"/></>,
    settings:        <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    alert:           <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    check:           <><polyline points="20 6 9 17 4 12"/></>,
    bell:            <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    brain:           <><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.66A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.66A2.5 2.5 0 0 0 14.5 2z"/></>,
    chat:            <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    docs:            <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    upload:          <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    link:            <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    refresh:         <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    download:        <><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></>,
    eye:             <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    sparkle:         <><path d="M12 3v1m0 16v1M4.22 4.22l.7.7m12.16 12.16.7.7M3 12h1m16 0h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7"/><circle cx="12" cy="12" r="4"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || null}
    </svg>
  );
};

// ── Shared Components ─────────────────────────────────────────────────────────
const RiskBadge = ({ level }) => {
  const map = { high: ["#ff3b3b","#2a0a0a"], med: ["#f59e0b","#1f1500"], low: ["#22c55e","#0a1f0a"] };
  const [color, bg] = map[level] || map.low;
  return <span style={{ background: bg, color, border: `1px solid ${color}33`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "monospace" }}>{level}</span>;
};

const RiskMeter = ({ value }) => {
  const color = value > 70 ? "#ff3b3b" : value > 45 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "#1e2130", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 12, color, fontFamily: "monospace", fontWeight: 700, minWidth: 28 }}>{value}</span>
    </div>
  );
};

const StatCard = ({ label, value, color, sub }) => (
  <div style={{ background: "#0d111c", border: "1px solid #1e2637", borderRadius: 8, padding: "16px 20px" }}>
    <div style={{ fontSize: 26, fontWeight: 700, color: color || "#e8f0ff", fontFamily: "monospace", letterSpacing: -1 }}>{value}</div>
    <div style={{ fontSize: 12, color: "#c8d8f0", marginTop: 2 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: "#445566", marginTop: 4 }}>{sub}</div>}
  </div>
);

const Card = ({ title, children, style }) => (
  <div style={{ background: "#0d111c", border: "1px solid #1e2637", borderRadius: 8, padding: 16, ...style }}>
    {title && <div style={{ fontSize: 13, color: "#8899bb", marginBottom: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</div>}
    {children}
  </div>
);

const AIRec = ({ text, color = "#a78bfa" }) => (
  <div style={{ display: "flex", gap: 10, padding: "10px 12px", background: "#080c17", borderRadius: 6, borderLeft: `3px solid ${color}` }}>
    <span style={{ color, marginTop: 1, flexShrink: 0 }}><Icon name="brain" size={14}/></span>
    <span style={{ fontSize: 13, color: "#a8b8d0", lineHeight: 1.6 }}>{text}</span>
  </div>
);

// ── Data ──────────────────────────────────────────────────────────────────────
// Static data removed — all PR data loaded from Supabase via listGithubData
// Chart data will be built dynamically from live PR/commit data
const kgNodes = [
  { id: "AuthService", type: "service", x: 50, y: 30, links: ["JWTUtil","UserDB","SessionCache"] },
  { id: "JWTUtil", type: "util", x: 20, y: 60, links: ["AuthService"] },
  { id: "UserDB", type: "db", x: 75, y: 55, links: ["AuthService","UserService"] },
  { id: "SessionCache", type: "cache", x: 30, y: 80, links: ["AuthService"] },
  { id: "UserService", type: "service", x: 80, y: 20, links: ["UserDB","PaymentService"] },
  { id: "PaymentService", type: "service", x: 60, y: 70, links: ["UserService","StripeClient"] },
  { id: "StripeClient", type: "util", x: 88, y: 80, links: ["PaymentService"] },
];
const nodeAnswers = {
  AuthService: "Handles all authentication logic. Created Sprint 8 (Mar 2024). JWT over sessions decided in ADR-001. Owned by Riya M.",
  JWTUtil: "Wraps jsonwebtoken. Expiry set to 15m after SEC-42 incident (Nov 2024). See PR #289.",
  UserDB: "Primary Postgres user store. Schema v2 migration pending (PR #339). See Jira DB-88.",
  StripeClient: "Wraps Stripe SDK v14. Retry logic added Sprint 21 after 3 payment failures. Owned by Dev T.",
  PaymentService: "Orchestrates payment flows. High-risk — freeze before releases.",
  SessionCache: "Redis session store. TTL mirrors JWT expiry (15m). Managed by DevOps.",
  UserService: "CRUD + business logic for users. 44 commits last quarter.",
};
// All static mock data removed. See Phase 3 for Architecture Advisor implementation.
const adrDetail = {
  "ADR-001": "Short-lived JWTs over sessions for horizontal scaling without shared session storage. Reduces blast radius of token leakage. Reviewed in SEC-42.",
  "ADR-002": "Redis selected for low-latency session lookup. Evaluated Memcached and in-memory — Redis won on persistence and pub/sub support.",
  "ADR-003": "Under discussion: monorepo simplifies atomic cross-service changes but increases CI complexity. Nx and Turborepo being evaluated.",
  "ADR-004": "GraphQL gateway rejected after performance benchmarks showed 40% latency overhead at scale. REST + BFF pattern selected instead.",
  "ADR-005": "PG 16 offers logical replication improvements and query parallelism gains. Migration plan drafted — staging tests in progress. Estimated risk: medium.",
};
const notifications = [
  { type: "high", title: "PR #341 — High Risk", body: "JWT expiry refactor scored 87/100. 4 issues flagged.", time: "2m ago", unread: true },
  { type: "alert", title: "Sprint 23 Risk Alert", body: "AI predicts 6–8 point shortfall. Review recommended.", time: "1h ago", unread: true },
  { type: "drift", title: "Architecture Drift Detected", body: "session.ts contradicts ADR-001. Review needed.", time: "3h ago", unread: true },
  { type: "info", title: "Karan M. — First PR Merged", body: "Onboarding milestone: Day 12, 92% path complete.", time: "5h ago", unread: false },
  { type: "info", title: "Knowledge Graph Updated", body: "284,000 lines re-indexed. 12 new connections found.", time: "1d ago", unread: false },
];

// ── KG Viz ────────────────────────────────────────────────────────────────────
const KnowledgeGraph = ({ selected, onSelect }) => {
  const typeColor = { service:"#6ee7f7", util:"#a78bfa", db:"#f59e0b", cache:"#22c55e" };
  return (
    <svg viewBox="0 0 100 100" style={{ width:"100%", height:"100%", minHeight:240 }}>
      <defs><filter id="glow2"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {kgNodes.map(node => node.links.map(link => {
        const target = kgNodes.find(n => n.id === link);
        return target ? <line key={`${node.id}-${link}`} x1={node.x} y1={node.y} x2={target.x} y2={target.y}
          stroke={selected===node.id||selected===link?"#6ee7f766":"#ffffff14"}
          strokeWidth={selected===node.id||selected===link?0.8:0.4}/> : null;
      }))}
      {kgNodes.map(node => (
        <g key={node.id} onClick={()=>onSelect(node.id===selected?null:node.id)} style={{cursor:"pointer"}}>
          <circle cx={node.x} cy={node.y} r={selected===node.id?5:3.5}
            fill={typeColor[node.type]} opacity={selected&&selected!==node.id?0.3:1}
            filter={selected===node.id?"url(#glow2)":""}/>
          <text x={node.x} y={node.y-6} textAnchor="middle" fontSize="3.5"
            fill={selected===node.id?typeColor[node.type]:"#8899aa"} fontFamily="monospace">{node.id}</text>
        </g>
      ))}
    </svg>
  );
};

// ── SCREENS ───────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const loadGh = useServerFn(listGithubData);
  const [livePrs, setLivePrs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadGh().then(r => { setLivePrs(r.prs || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const highRisk = livePrs.filter((p:any) => { const r = Math.min(99, Math.round(((p.additions||0)+(p.deletions||0))/10)+(p.changed_files||0)*2); return r > 70; });
  const thisWeek = livePrs.filter((p:any) => p.updated_at && new Date(p.updated_at) > new Date(Date.now()-7*86400000));

  const prFeed = livePrs.slice(0,3).map((p:any) => {
    const risk = Math.min(99, Math.round(((p.additions||0)+(p.deletions||0))/10)+(p.changed_files||0)*2);
    return { id:`PR #${p.number}`, title:p.title, author:p.author_login||"—", risk, status:risk>70?"high":risk>45?"med":"low", time:p.updated_at?new Date(p.updated_at).toLocaleDateString():"" };
  });

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:12}}>
        <StatCard label="PRs This Week" value={loading?"…":String(thisWeek.length)} color="#6ee7f7"/>
        <StatCard label="Total PRs" value={loading?"…":String(livePrs.length)} color="#a78bfa"/>
        <StatCard label="High Risk PRs" value={loading?"…":String(highRisk.length)} color="#ff3b3b"/>
        <StatCard label="Merged" value={loading?"…":String(livePrs.filter((p:any)=>p.state==="merged").length)} color="#22c55e"/>
      </div>
      <Card title="Live PR Risk Feed">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {loading && <div style={{color:"#445566",fontSize:13,padding:"20px 0",textAlign:"center"}}>Loading live pull requests…</div>}
          {!loading && prFeed.length===0 && <div style={{color:"#5a6a8a",fontSize:13,padding:"20px 0",textAlign:"center"}}>No pull requests yet — connect GitHub from Settings to see live PRs.</div>}
          {prFeed.map(pr=>(
            <div key={pr.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:"#080c17",borderRadius:6,border:"1px solid #12192a"}}>
              <RiskBadge level={pr.status}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"#c8d8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pr.title}</div>
                <div style={{fontSize:11,color:"#445566"}}>{pr.id} · {pr.author} · {pr.time}</div>
              </div>
              <div style={{width:100}}><RiskMeter value={pr.risk}/></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const CodeReview = () => {
  const loadGh = useServerFn(listGithubData);
  const runReview = useServerFn(runAIReview);
  const [livePrs, setLivePrs] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResults, setReviewResults] = useState<Record<string, any>>({});
  
  useEffect(() => { loadGh().then(r => setLivePrs(r.prs || [])).catch(() => {}); }, []);
  const list = livePrs.map((p:any) => {
        const churn = (p.additions || 0) + (p.deletions || 0);
        const risk = Math.min(99, Math.round(churn / 10) + (p.changed_files || 0) * 2);
        const status = risk > 70 ? "high" : risk > 45 ? "med" : "low";
        return {
          id: `PR #${p.number}`,
          author: p.author_login || "—",
          risk,
          title: p.title,
          status,
          issues: 0,
          time: p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "",
          url: p.html_url,
          repo: p.repo_full_name,
        };
      });
  const [selected, setSelected] = useState(list[0]);
  useEffect(() => { setSelected(list[0]); }, [livePrs.length]);
  if (!list.length) return <div style={{ color: "#5a6a8a", fontSize: 13 }}>No pull requests yet — connect GitHub from Settings to see live PRs.</div>;
  const typeColor = {security:"#ff3b3b",perf:"#f59e0b",style:"#6ee7f7",debt:"#a78bfa",bug:"#f97316"};
  const currentReview = reviewResults[selected.id];
  const displayRisk = currentReview ? currentReview.risk : selected.risk;
  const displayIssues = currentReview ? currentReview.issues : (selected.issues > 0 ? issues.slice(0, selected.issues) : []);
  const displayTags = currentReview ? currentReview.tags : ["Your coding standards v2.1", "SEC-42 precedent", "Auth module history", "Codebase patterns"];

  const handleRunReview = async () => {
    if (!selected || !selected.repo) return;
    const prNumber = parseInt(selected.id.replace("PR #", ""), 10);
    if (isNaN(prNumber)) return;
    
    setReviewLoading(true);
    try {
      const result = await runReview({ data: { repo_full_name: selected.repo, pr_number: prNumber } });
      setReviewResults(prev => ({ ...prev, [selected.id]: result }));
    } catch (e) {
      console.error("Review failed", e);
      alert("Failed to run AI review: " + (e as Error).message);
    }
    setReviewLoading(false);
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:12}}>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {list.map(pr=>(
          <div key={pr.id} onClick={()=>setSelected(pr)}
            style={{padding:"12px 14px",borderRadius:8,border:`1px solid ${selected.id===pr.id?"#6ee7f744":"#1e2637"}`,background:selected.id===pr.id?"#0a1520":"#0d111c",cursor:"pointer",transition:"all 0.15s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:11,color:"#6ee7f7",fontFamily:"monospace"}}>{pr.id}</span>
              <RiskBadge level={pr.status}/>
            </div>
            <div style={{fontSize:12,color:"#c8d8f0",marginBottom:4,lineHeight:1.4}}>{pr.title}</div>
            <div style={{fontSize:11,color:"#445566"}}>{pr.author} · {pr.time}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#0d111c",border:"1px solid #1e2637",borderRadius:8,padding:20,overflow:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{fontSize:16,color:"#e8f0ff",fontWeight:600,marginBottom:4}}>
              {selected.url ? <a href={selected.url} target="_blank" rel="noreferrer" style={{color:"inherit",textDecoration:"none"}}>{selected.title} ↗</a> : selected.title}
            </div>
            <div style={{fontSize:12,color:"#445566"}}>{selected.repo ? `${selected.repo} · ` : ""}{selected.id} · {selected.author}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {selected.repo && (
              <button 
                onClick={handleRunReview} 
                disabled={reviewLoading}
                style={{marginRight: 16, background: reviewLoading ? "#1e2637" : "#6ee7f722", border: `1px solid ${reviewLoading ? "#1e2637" : "#6ee7f744"}`, borderRadius: 6, padding: "6px 12px", color: reviewLoading ? "#8899bb" : "#6ee7f7", fontSize: 12, cursor: reviewLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s"}}
              >
                {reviewLoading ? (
                  <>
                    <div style={{width:10,height:10,borderRadius:"50%",background:"#6ee7f7",animation:`dm-pulse 1s ease-in-out infinite`}}/> Analyzing Diff...
                  </>
                ) : (
                  <>▶ Run AI Review</>
                )}
              </button>
            )}
            <span style={{fontSize:12,color:"#8899bb"}}>Risk Score</span>
            <div style={{fontSize:22,fontWeight:700,fontFamily:"monospace",color:displayRisk>70?"#ff3b3b":displayRisk>45?"#f59e0b":"#22c55e"}}>{displayRisk}</div>
          </div>
        </div>
        <div style={{marginBottom:20}}><RiskMeter value={displayRisk}/></div>
        <div style={{fontSize:12,color:"#8899bb",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>
          {currentReview ? "Real AI Review Findings" : "AI Review Findings"}
        </div>
        
        {currentReview && currentReview.summary && (
          <div style={{marginBottom: 16, padding: "10px 14px", background: "#0a1525", borderRadius: 6, border: "1px solid #12192a", fontSize: 13, color: "#c8d8f0", lineHeight: 1.5}}>
            <strong>Summary:</strong> {currentReview.summary}
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {displayIssues.length > 0 ? displayIssues.map((issue: any, i: number)=>(
            <div key={i} style={{padding:"12px 14px",background:"#080c17",borderRadius:6,borderLeft:`3px solid ${typeColor[issue.type] || "#6ee7f7"}`}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:10,color:typeColor[issue.type] || "#6ee7f7",fontWeight:700,textTransform:"uppercase",fontFamily:"monospace"}}>{issue.type}</span>
                <span style={{fontSize:11,color:"#445566",fontFamily:"monospace"}}>line {issue.line}</span>
              </div>
              <div style={{fontSize:13,color:"#a8b8d0",lineHeight:1.5}}>{issue.msg}</div>
            </div>
          )) : <div style={{padding:20,textAlign:"center",color:"#22c55e",fontSize:14}}><div style={{fontSize:28,marginBottom:8}}>✓</div>No issues found — PR looks clean</div>}
        </div>
        <div style={{marginTop:16,padding:"12px 14px",background:"#080c17",borderRadius:6,border:"1px solid #1e2637"}}>
          <div style={{fontSize:12,color:"#8899bb",fontWeight:600,marginBottom:8}}>Org Context Used</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {displayTags.map((tag: string)=>(
              <span key={tag} style={{fontSize:11,background:"#1e2637",color:"#6ee7f7",padding:"3px 10px",borderRadius:20}}>{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const BugPredictor = () => {
  const fetchPredictions = useServerFn(getBugPredictions);
  const [data, setData] = useState<{hotspots:any[],recommendations:any[],notConnected?:boolean,notSynced?:boolean}|null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    fetchPredictions().then(r => { setData(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{color:"#445566",fontSize:13,padding:"40px 0",textAlign:"center"}}>Analyzing commit history…</div>;
  if (data?.notConnected) return <div style={{color:"#5a6a8a",fontSize:13,padding:"40px 0",textAlign:"center"}}>Connect GitHub from Settings to enable Bug Predictor.</div>;
  if (data?.notSynced) return <div style={{color:"#5a6a8a",fontSize:13,padding:"40px 0",textAlign:"center"}}>Sync GitHub from Settings first, then return here.</div>;

  const hotspots = data?.hotspots ?? [];
  const recs = data?.recommendations ?? [];
  const highCount = hotspots.filter(h => h.risk > 70).length;
  const medCount = hotspots.filter(h => h.risk > 45 && h.risk <= 70).length;
  const bugTotal = hotspots.reduce((s,h) => s + h.bugs, 0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        <StatCard label="High-Risk Files" value={String(highCount)} color="#ff3b3b"/>
        <StatCard label="Med-Risk Files" value={String(medCount)} color="#f59e0b"/>
        <StatCard label="Bug-linked Commits" value={String(bugTotal)} color="#a78bfa"/>
      </div>
      <Card title="File Risk Heatmap">
        {hotspots.length === 0
          ? <div style={{color:"#5a6a8a",fontSize:13,padding:"20px 0",textAlign:"center"}}>No file churn data found — sync GitHub first.</div>
          : <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {hotspots.map((h,i) => (
              <div key={i} onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}
                style={{padding:"12px 14px",borderRadius:6,background:hovered===i?"#0a1520":"#080c17",border:`1px solid ${hovered===i?"#1e3050":"#12192a"}`,transition:"all 0.15s",cursor:"default"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:13,color:"#c8d8f0",fontFamily:"monospace",maxWidth:"70%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.file}</span>
                  <div style={{display:"flex",gap:12,fontSize:12,color:"#445566"}}><span>{h.bugs} bug commits</span><span>{h.changes} lines changed</span></div>
                </div>
                <RiskMeter value={h.risk}/>
              </div>
            ))}
          </div>
        }
      </Card>
      <Card title="AI Recommendations">
        {recs.length === 0
          ? <div style={{color:"#5a6a8a",fontSize:13,padding:"12px 0"}}>No recommendations yet.</div>
          : <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {recs.map((r,i) => <AIRec key={i} text={r}/>)}
          </div>
        }
      </Card>
    </div>
  );
};

const KnowledgePage = () => {
  const [selectedNode,setSelectedNode] = useState(null);
  const [query,setQuery] = useState("");
  const [chatMsgs,setChatMsgs] = useState([
    {role:"ai",text:"Hi! I'm the DevMind Org Brain. Ask me anything about your codebase — decisions, history, patterns."},
    {role:"user",text:"Why was the JWT expiry set to 15 minutes?"},
    {role:"ai",text:"Based on PR #289 and Slack #security-review: the team reduced it after a session hijacking incident in staging (Nov 2024). Linked to Jira ticket SEC-42. Short-lived tokens reduce blast radius if leaked."},
  ]);
  const [loading,setLoading] = useState(false);
  const bottomRef = useRef(null);
  const node = kgNodes.find(n=>n.id===selectedNode);
  const typeColor = {service:"#6ee7f7",util:"#a78bfa",db:"#f59e0b",cache:"#22c55e"};

  const sendKG = async () => {
    if(!query.trim()||loading) return;
    const userMsg = query.trim();
    setQuery("");
    setChatMsgs(prev=>[...prev,{role:"user",text:userMsg}]);
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const res = await fetch("/api/chat",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body:JSON.stringify({
          system:"You are DevMind's Org Brain — an AI that answers questions about the acme-engineering codebase. Key facts: Node.js/TypeScript/PostgreSQL/Redis stack, 47 devs, JWT auth (15m expiry per SEC-42), payments via Stripe, Redis session cache. Answer concisely in 2-3 sentences, referencing specific files, tickets, or team members when relevant.",
          messages:[...chatMsgs.filter(m=>m.role!=="ai"||chatMsgs.indexOf(m)>0).map(m=>({role:m.role==="ai"?"assistant":"user",content:m.text})),{role:"user",content:userMsg}]
        })
      });
      const data = await res.json();
      const reply = data.text||data.error||"Could not fetch response.";
      setChatMsgs(prev=>[...prev,{role:"ai",text:reply}]);
    } catch { setChatMsgs(prev=>[...prev,{role:"ai",text:"Connection error. Try again."}]); }
    setLoading(false);
  };

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[chatMsgs,loading]);

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:12}}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Card title="Codebase Knowledge Graph">
          <div style={{fontSize:12,color:"#445566",marginBottom:10}}>Click a node to explore its history and relationships</div>
          <KnowledgeGraph selected={selectedNode} onSelect={setSelectedNode}/>
          <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
            {Object.entries(typeColor).map(([type,color])=>(
              <div key={type} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#5a6a8a"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>{type}
              </div>
            ))}
          </div>
        </Card>
        <Card title="Ask the Org Brain">
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12,maxHeight:220,overflowY:"auto"}}>
            {chatMsgs.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:m.role==="ai"?"linear-gradient(135deg,#6ee7f7,#a78bfa)":"#1e2637",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>
                  <span style={{fontSize:9,color:m.role==="ai"?"#060a14":"#8899bb",fontWeight:700}}>{m.role==="ai"?"DM":"U"}</span>
                </div>
                <div style={{fontSize:13,color:m.role==="ai"?"#c8d8f0":"#8899bb",background:m.role==="ai"?"#080c17":"transparent",borderRadius:6,padding:m.role==="ai"?"10px 12px":"2px 0",lineHeight:1.6,flex:1}}>{m.text}</div>
              </div>
            ))}
            {loading && <div style={{display:"flex",gap:8}}><div style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,#6ee7f7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#060a14",fontWeight:700}}>DM</div><div style={{padding:"10px 12px",background:"#080c17",borderRadius:6,color:"#445566",fontSize:13}}>Thinking…</div></div>}
            <div ref={bottomRef}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendKG()} placeholder="Ask about your codebase..."
              style={{flex:1,background:"#080c17",border:"1px solid #1e2637",borderRadius:6,padding:"8px 12px",fontSize:13,color:"#c8d8f0",outline:"none",fontFamily:"inherit"}}/>
            <button onClick={sendKG} disabled={loading||!query.trim()} style={{background:"#6ee7f722",border:"1px solid #6ee7f744",borderRadius:6,padding:"8px 14px",color:"#6ee7f7",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Ask</button>
          </div>
        </Card>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <Card title="Node Details">
          {node ? (
            <>
              <div style={{fontSize:15,color:typeColor[node.type],fontWeight:700,fontFamily:"monospace",marginBottom:8}}>{node.id}</div>
              <div style={{fontSize:11,color:"#445566",marginBottom:10}}>Type: {node.type} · {node.links.length} connections</div>
              <div style={{fontSize:13,color:"#a8b8d0",lineHeight:1.6,marginBottom:12}}>{nodeAnswers[node.id]}</div>
              <div style={{fontSize:12,color:"#5a6a8a",marginBottom:6}}>Linked to:</div>
              {node.links.map(l=><div key={l} onClick={()=>setSelectedNode(l)} style={{fontSize:12,color:"#6ee7f7",padding:"4px 0",cursor:"pointer",borderBottom:"1px solid #12192a"}}>{l}</div>)}
            </>
          ) : <div style={{fontSize:13,color:"#2a3a55",textAlign:"center",padding:"30px 0"}}>Select a node from the graph</div>}
        </Card>
        <Card title="Stale Docs Alert">
          {[{file:"AUTH.md",age:"8 months"},{file:"PAYMENTS.md",age:"5 months"}].map(d=>(
            <div key={d.file} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"8px 0",borderBottom:"1px solid #12192a",color:"#5a6a8a"}}>
              <span style={{color:"#f59e0b",fontFamily:"monospace"}}>{d.file}</span><span>{d.age} old</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

const SprintPage = () => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 0",gap:16}}>
    <div style={{fontSize:36}}>🚀</div>
    <div style={{fontSize:16,color:"#e8f0ff",fontWeight:600}}>Sprint Intelligence</div>
    <div style={{fontSize:13,color:"#5a6a8a",maxWidth:360,textAlign:"center",lineHeight:1.6}}>Connect Jira from Settings and sync your issues to enable sprint velocity tracking, risk scoring, and AI completion forecasts.</div>
  </div>
);

const OnboardingPage = () => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 0",gap:16}}>
    <div style={{fontSize:36}}>🎓</div>
    <div style={{fontSize:16,color:"#e8f0ff",fontWeight:600}}>Dev Onboarding</div>
    <div style={{fontSize:13,color:"#5a6a8a",maxWidth:380,textAlign:"center",lineHeight:1.6}}>The onboarding module generates personalised learning paths from your real codebase. Connect GitHub and sync to get started.</div>
  </div>
);

const ArchitecturePage = () => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 0",gap:16}}>
    <div style={{fontSize:36}}>🏗</div>
    <div style={{fontSize:16,color:"#e8f0ff",fontWeight:600}}>Architecture Advisor</div>
    <div style={{fontSize:13,color:"#5a6a8a",maxWidth:400,textAlign:"center",lineHeight:1.6}}>ADR management, coupling scores, and drift detection are coming in Phase 3. Connect GitHub to begin codebase indexing.</div>
  </div>
);


const SettingsPage = () => {
  const listChans = useServerFn(listSlackChannels);
  const syncChans = useServerFn(syncSlackChannels);
  const toggleChan = useServerFn(setChannelTracked);
  const syncMsgs = useServerFn(syncTrackedMessages);
  const listStatus = useServerFn(listIntegrationStatus);
  const ghConnect = useServerFn(connectGithub);
  const ghDisconnect = useServerFn(disconnectGithub);
  const ghSync = useServerFn(syncGithub);
  const jrConnect = useServerFn(connectJira);
  const jrDisconnect = useServerFn(disconnectJira);
  const jrSync = useServerFn(syncJira);

  const [channels, setChannels] = useState([]);
  const [status, setStatus] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ghToken, setGhToken] = useState("");
  const [jrSite, setJrSite] = useState("");
  const [jrEmail, setJrEmail] = useState("");
  const [jrToken, setJrToken] = useState("");

  const refresh = async () => {
    try {
      const [{ channels: ch }, { integrations: ints }] = await Promise.all([listChans(), listStatus()]);
      setChannels(ch);
      setStatus(ints);
    } catch (e) { setMsg(String(e?.message || e)); }
  };
  useEffect(() => { refresh(); }, []);

  const doSync = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await syncChans();
      setMsg(`Synced ${r.count} Slack channels.`);
      await refresh();
    } catch (e) { setMsg(`Slack sync failed: ${e?.message || e}`); }
    finally { setBusy(false); }
  };
  const doSyncMsgs = async () => {
    setBusy(true); setMsg(null);
    try { const r = await syncMsgs(); setMsg(`Pulled ${r.count} messages from tracked channels.`); }
    catch (e) { setMsg(`Message sync failed: ${e?.message || e}`); }
    finally { setBusy(false); }
  };
  const onToggle = async (channelId, tracked) => {
    setChannels(prev => prev.map(c => c.channel_id === channelId ? { ...c, is_tracked: tracked } : c));
    try { await toggleChan({ data: { channelId, tracked } }); }
    catch (e) { setMsg(`Update failed: ${e?.message || e}`); refresh(); }
  };

  const slackStatus = status.find(s => s.provider === "slack");
  const githubStatus = status.find(s => s.provider === "github");
  const jiraStatus = status.find(s => s.provider === "jira");

  const StatusPill = ({ s }) => (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: s ? "#22c55e22" : "#1e2637", color: s ? "#22c55e" : "#5a6a8a", fontWeight: 600 }}>
      {s ? "Connected" : "Not connected"}
    </span>
  );

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 12 }}>
      <Card title="Integrations">
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid #12192a" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#c8d8f0", fontWeight: 500, display: "flex", gap: 8, alignItems: "center" }}>Slack <StatusPill s={!!slackStatus} /></div>
            <div style={{ fontSize: 12, color: "#445566", marginTop: 2 }}>
              {slackStatus?.last_synced_at ? `Last synced ${new Date(slackStatus.last_synced_at).toLocaleString()}` : "Pull channels and messages into DevMind."}
            </div>
          </div>
          <button onClick={doSync} disabled={busy} style={{ padding: "6px 12px", background: "#6ee7f722", border: "1px solid #6ee7f744", borderRadius: 6, color: "#6ee7f7", fontSize: 12, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
            {busy ? "..." : "Sync channels"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid #12192a" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#c8d8f0", fontWeight: 500, display: "flex", gap: 8, alignItems: "center" }}>GitHub <StatusPill s={!!githubStatus} /></div>
            <div style={{ fontSize: 12, color: "#445566", marginTop: 2 }}>Connect with a personal access token (coming next).</div>
          </div>
          {githubStatus ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={async () => { setBusy(true); setMsg(null); try { const r = await ghSync(); setMsg(`GitHub: synced ${r.repos} repos, ${r.prs} PRs, ${r.commits} commits.`); await refresh(); } catch (e) { setMsg(`GitHub sync failed: ${e?.message || e}`); } finally { setBusy(false); } }} disabled={busy} style={{ padding: "6px 12px", background: "#6ee7f722", border: "1px solid #6ee7f744", borderRadius: 6, color: "#6ee7f7", fontSize: 12, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>{busy ? "..." : "Sync"}</button>
              <button onClick={async () => { await ghDisconnect(); refresh(); }} style={{ padding: "6px 12px", background: "transparent", border: "1px solid #2a3a55", borderRadius: 6, color: "#5a6a8a", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Disconnect</button>
            </div>
          ) : null}
        </div>
        {!githubStatus && (
          <div style={{ display: "flex", gap: 8, padding: "0 0 14px", borderBottom: "1px solid #12192a" }}>
            <input value={ghToken} onChange={e => setGhToken(e.target.value)} placeholder="ghp_xxx (PAT with repo scope)" type="password" style={{ flex: 1, padding: "6px 10px", background: "#080c17", border: "1px solid #1e2637", borderRadius: 6, color: "#c8d8f0", fontSize: 12, fontFamily: "monospace" }} />
            <button onClick={async () => { setBusy(true); setMsg(null); try { const r = await ghConnect({ data: { token: ghToken } }); setMsg(`GitHub connected as @${r.login}.`); setGhToken(""); await refresh(); } catch (e) { setMsg(`GitHub connect failed: ${e?.message || e}`); } finally { setBusy(false); } }} disabled={busy || ghToken.length < 20} style={{ padding: "6px 12px", background: "#6ee7f722", border: "1px solid #6ee7f744", borderRadius: 6, color: "#6ee7f7", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Connect</button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#c8d8f0", fontWeight: 500, display: "flex", gap: 8, alignItems: "center" }}>Jira <StatusPill s={!!jiraStatus} /></div>
            <div style={{ fontSize: 12, color: "#445566", marginTop: 2 }}>
              {jiraStatus?.last_synced_at ? `Last synced ${new Date(jiraStatus.last_synced_at).toLocaleString()}` : "Atlassian site URL + email + API token (id.atlassian.com/manage-profile/security/api-tokens)."}
            </div>
          </div>
          {jiraStatus ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={async () => { setBusy(true); setMsg(null); try { const r = await jrSync(); setMsg(`Jira: synced ${r.count} issues.`); await refresh(); } catch (e) { setMsg(`Jira sync failed: ${e?.message || e}`); } finally { setBusy(false); } }} disabled={busy} style={{ padding: "6px 12px", background: "#6ee7f722", border: "1px solid #6ee7f744", borderRadius: 6, color: "#6ee7f7", fontSize: 12, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>{busy ? "..." : "Sync"}</button>
              <button onClick={async () => { await jrDisconnect(); refresh(); }} style={{ padding: "6px 12px", background: "transparent", border: "1px solid #2a3a55", borderRadius: 6, color: "#5a6a8a", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Disconnect</button>
            </div>
          ) : null}
        </div>
        {!jiraStatus && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingBottom: 6 }}>
            <input value={jrSite} onChange={e => setJrSite(e.target.value)} placeholder="https://your-org.atlassian.net" style={{ padding: "6px 10px", background: "#080c17", border: "1px solid #1e2637", borderRadius: 6, color: "#c8d8f0", fontSize: 12, fontFamily: "monospace" }} />
            <input value={jrEmail} onChange={e => setJrEmail(e.target.value)} placeholder="you@company.com" style={{ padding: "6px 10px", background: "#080c17", border: "1px solid #1e2637", borderRadius: 6, color: "#c8d8f0", fontSize: 12, fontFamily: "monospace" }} />
            <input value={jrToken} onChange={e => setJrToken(e.target.value)} placeholder="API token" type="password" style={{ padding: "6px 10px", background: "#080c17", border: "1px solid #1e2637", borderRadius: 6, color: "#c8d8f0", fontSize: 12, fontFamily: "monospace" }} />
            <button onClick={async () => { setBusy(true); setMsg(null); try { const r = await jrConnect({ data: { siteUrl: jrSite, email: jrEmail, token: jrToken } }); setMsg(`Jira connected as ${r.displayName}.`); setJrToken(""); await refresh(); } catch (e) { setMsg(`Jira connect failed: ${e?.message || e}`); } finally { setBusy(false); } }} disabled={busy || !jrSite || !jrEmail || jrToken.length < 10} style={{ padding: "6px 12px", background: "#6ee7f722", border: "1px solid #6ee7f744", borderRadius: 6, color: "#6ee7f7", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Connect</button>
          </div>
        )}
        {msg && <div style={{ fontSize: 12, color: "#a78bfa", marginTop: 8 }}>{msg}</div>}
      </Card>

      <Card title={`Tracked Slack channels (${channels.filter(c => c.is_tracked).length}/${channels.length})`}>
        {channels.length === 0 && (
          <div style={{ fontSize: 13, color: "#5a6a8a", padding: "12px 0" }}>
            No channels yet — click <span style={{ color: "#6ee7f7" }}>Sync channels</span> above to pull them from Slack.
          </div>
        )}
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {channels.map(c => (
            <div key={c.channel_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #12192a" }}>
              <div style={{ flex: 1, fontSize: 13, color: "#c8d8f0", fontFamily: "monospace" }}>#{c.name}</div>
              <div onClick={() => onToggle(c.channel_id, !c.is_tracked)} style={{ width: 36, height: 20, borderRadius: 10, background: c.is_tracked ? "#6ee7f722" : "#1e2637", border: `1px solid ${c.is_tracked ? "#6ee7f7" : "#2a3a55"}`, position: "relative", cursor: "pointer" }}>
                <div style={{ position: "absolute", top: 2, left: c.is_tracked ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: c.is_tracked ? "#6ee7f7" : "#2a3a55", transition: "left 0.2s" }} />
              </div>
            </div>
          ))}
        </div>
        {channels.some(c => c.is_tracked) && (
          <button onClick={doSyncMsgs} disabled={busy} style={{ marginTop: 12, padding: "8px 14px", background: "#a78bfa22", border: "1px solid #a78bfa44", borderRadius: 6, color: "#a78bfa", fontSize: 12, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
            {busy ? "..." : "Pull recent messages from tracked channels"}
          </button>
        )}
      </Card>
    </div>
  );
};

// ── Notifications Panel ────────────────────────────────────────────────────────
const NotificationsPanel = ({ onClose }) => {
  const typeColor = {high:"#ff3b3b",alert:"#f59e0b",drift:"#a78bfa",info:"#6ee7f7"};
  const typeLabel = {high:"HIGH RISK",alert:"SPRINT",drift:"DRIFT",info:"INFO"};
  return (
    <div style={{position:"fixed",top:0,right:0,width:340,height:"100vh",background:"#080c17",borderLeft:"1px solid #1e2637",display:"flex",flexDirection:"column",zIndex:500,boxShadow:"-12px 0 40px #000a"}}>
      <div style={{padding:"18px 18px 14px",borderBottom:"1px solid #12192a",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:"#e8f0ff"}}>Notifications</div>
          <div style={{fontSize:12,color:"#2a3a55",marginTop:2}}>3 unread</div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#445566",cursor:"pointer",fontSize:20,lineHeight:1,padding:0}}>×</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
        {notifications.map((n,i)=>(
          <div key={i} style={{padding:"12px 14px",borderRadius:8,background:n.unread?"#0a1520":"#080c17",border:`1px solid ${n.unread?"#1e3050":"#12192a"}`,borderLeft:`3px solid ${typeColor[n.type]}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:10,color:typeColor[n.type],fontWeight:700,fontFamily:"monospace"}}>{typeLabel[n.type]}</span>
              <span style={{fontSize:11,color:"#2a3a55"}}>{n.time}</span>
            </div>
            <div style={{fontSize:13,color:n.unread?"#c8d8f0":"#5a6a8a",fontWeight:n.unread?500:400,marginBottom:4}}>{n.title}</div>
            <div style={{fontSize:12,color:"#445566",lineHeight:1.5}}>{n.body}</div>
          </div>
        ))}
      </div>
      <div style={{padding:"12px 14px",borderTop:"1px solid #12192a"}}>
        <button style={{width:"100%",padding:"8px",background:"transparent",border:"1px solid #1e2637",borderRadius:6,color:"#5a6a8a",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Mark all as read</button>
      </div>
    </div>
  );
};

// ── Global AI Assistant ────────────────────────────────────────────────────────
const AIAssistant = ({ onClose }) => {
  const [messages,setMessages] = useState([{role:"ai",text:"Hi! I'm DevMind AI — powered by Claude. Ask me anything about your codebase, team, or sprint."}]);
  const [input,setInput] = useState("");
  const [loading,setLoading] = useState(false);
  const bottomRef = useRef(null);

  const send = async () => {
    if(!input.trim()||loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev=>[...prev,{role:"user",text:userMsg}]);
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/chat",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body:JSON.stringify({
          system:"You are DevMind AI, an intelligent assistant embedded in a software development platform for acme-engineering. Stack: Node.js/TypeScript/PostgreSQL/Redis. 47 devs, active v3.2 release, JWT auth (15m expiry per SEC-42), Stripe payments, ongoing Sprint 23. Answer concisely (2-4 sentences) and be specific to this org context.",
          messages:messages.map(m=>({role:m.role==="ai"?"assistant":"user",content:m.text})).concat([{role:"user",content:userMsg}])
        })
      });
      const data = await res.json();
      const reply = data.text||data.error||"Could not get a response.";
      setMessages(prev=>[...prev,{role:"ai",text:reply}]);
    } catch { setMessages(prev=>[...prev,{role:"ai",text:"Connection error. Please try again."}]); }
    setLoading(false);
  };

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[messages,loading]);

  const suggestions = ["Which files are riskiest before v3.2?","Why is Auth v2 flagged as high risk?","Summarize Sprint 23 status","Who owns the payment module?"];

  return (
    <div style={{position:"fixed",bottom:24,right:24,width:360,background:"#080c17",border:"1px solid #1e3050",borderRadius:14,boxShadow:"0 24px 60px #000c",display:"flex",flexDirection:"column",zIndex:1000,overflow:"hidden",maxHeight:"80vh"}}>
      <div style={{padding:"14px 16px",background:"#0a1525",borderBottom:"1px solid #12192a",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 6px #22c55e"}}/>
          <span style={{fontSize:13,fontWeight:600,color:"#e8f0ff"}}>DevMind AI</span>
          <span style={{fontSize:11,color:"#2a3a55"}}>· org context active</span>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#445566",cursor:"pointer",fontSize:20,lineHeight:1,padding:0}}>×</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 14px 8px",display:"flex",flexDirection:"column",gap:10}}>
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",flexDirection:m.role==="user"?"row-reverse":"row"}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:m.role==="ai"?"linear-gradient(135deg,#6ee7f7,#a78bfa)":"#1e2637",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:m.role==="ai"?"#060a14":"#8899bb",fontWeight:700,flexShrink:0,marginTop:2}}>
              {m.role==="ai"?"DM":"U"}
            </div>
            <div style={{maxWidth:"82%",fontSize:13,color:m.role==="ai"?"#c8d8f0":"#8899bb",background:m.role==="ai"?"#0d1525":"#080c17",border:`1px solid ${m.role==="ai"?"#1e2637":"#12192a"}`,borderRadius:8,padding:"8px 12px",lineHeight:1.6}}>{m.text}</div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,#6ee7f7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#060a14",fontWeight:700}}>DM</div>
            <div style={{padding:"10px 14px",background:"#0d1525",border:"1px solid #1e2637",borderRadius:8,display:"flex",gap:4}}>
              {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:"#6ee7f7",animation:`dm-pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {messages.length<=1&&(
        <div style={{padding:"0 12px 8px",display:"flex",flexWrap:"wrap",gap:6}}>
          {suggestions.map(s=>(
            <button key={s} onClick={()=>setInput(s)}
              style={{fontSize:11,background:"#0d1525",border:"1px solid #1e2637",borderRadius:20,padding:"4px 10px",color:"#6ee7f7",cursor:"pointer",fontFamily:"inherit"}}>{s}</button>
          ))}
        </div>
      )}
      <div style={{padding:"10px 12px",borderTop:"1px solid #12192a",display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask about your codebase…" disabled={loading}
          style={{flex:1,background:"#060a14",border:"1px solid #1e2637",borderRadius:6,padding:"8px 12px",fontSize:13,color:"#c8d8f0",outline:"none",fontFamily:"inherit"}}/>
        <button onClick={send} disabled={loading||!input.trim()}
          style={{background:loading||!input.trim()?"#0d1525":"#6ee7f722",border:`1px solid ${loading||!input.trim()?"#1e2637":"#6ee7f744"}`,borderRadius:6,padding:"8px 14px",color:loading||!input.trim()?"#2a3a55":"#6ee7f7",fontSize:16,cursor:loading||!input.trim()?"not-allowed":"pointer",transition:"all 0.15s"}}>↑</button>
      </div>
      <style>{`@keyframes dm-pulse{0%,100%{opacity:0.3;transform:scale(0.9)}50%{opacity:1;transform:scale(1.1)}}`}</style>
    </div>
  );
};

// ── Nav ───────────────────────────────────────────────────────────────────────

// ── Docs & KT Page ─────────────────────────────────────────────────────────────
const docsList = [
  { id:1, title:"Authentication Service", file:"src/auth/jwt.service.ts", status:"published", platform:"mintlify", lastSync:"2m ago", coverage:94, stale:false },
  { id:2, title:"Payments & Stripe Integration", file:"src/payments/stripe.ts", status:"stale", platform:"confluence", lastSync:"5 months ago", coverage:41, stale:true },
  { id:3, title:"User Service API", file:"src/api/users.controller.ts", status:"draft", platform:"notion", lastSync:"1d ago", coverage:78, stale:false },
  { id:4, title:"Database Schema v2", file:"src/db/migrations/", status:"published", platform:"mintlify", lastSync:"3h ago", coverage:88, stale:false },
  { id:5, title:"Redis Cache Layer", file:"src/cache/redis.client.ts", status:"missing", platform:"—", lastSync:"never", coverage:0, stale:true },
  { id:6, title:"Notification Service", file:"src/notifications/", status:"draft", platform:"notion", lastSync:"2d ago", coverage:62, stale:false },
];

const ktSessions = [
  { id:1, title:"Auth Module Handoff", from:"Riya M.", to:"Priya R.", date:"May 12, 2025", status:"completed", modules:["AuthService","JWTUtil","SessionCache"], recording:true, docLinked:true },
  { id:2, title:"Payments Deep Dive", from:"Dev T.", to:"Aisha T.", date:"May 14, 2025", status:"scheduled", modules:["PaymentService","StripeClient"], recording:false, docLinked:false },
  { id:3, title:"DB Migration Runbook", from:"Meera V.", to:"Rohan S.", date:"May 10, 2025", status:"completed", modules:["UserDB"], recording:true, docLinked:true },
  { id:4, title:"API Gateway Overview", from:"Arjun K.", to:"Karan M.", date:"May 8, 2025", status:"completed", modules:["UserService"], recording:true, docLinked:false },
];

const platforms = [
  { name:"Mintlify", connected:true, docs:12, color:"#6ee7f7", desc:"Auto-generates and publishes API docs from code & comments" },
  { name:"Confluence", connected:true, docs:8, color:"#0052cc", desc:"Syncs architecture decisions, runbooks, and team wikis" },
  { name:"Notion", connected:false, docs:0, color:"#e8e8e8", desc:"Connect for inline docs, KT notes, and onboarding pages" },
  { name:"GitHub Wiki", connected:false, docs:0, color:"#a78bfa", desc:"Embed docs directly in your repository wiki" },
];

const DocsKTPage = () => {
  const [tab, setTab] = useState("docs"); // docs | kt | generate | platforms
  const [selectedDoc, setSelectedDoc] = useState(docsList[0]);
  const [genInput, setGenInput] = useState("");
  const [genOutput, setGenOutput] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genMode, setGenMode] = useState("api"); // api | kt | runbook | onboarding
  const [ktModal, setKtModal] = useState(null);

  const statusColor = { published:"#22c55e", stale:"#f59e0b", draft:"#6ee7f7", missing:"#ff3b3b" };
  const platformColor = { mintlify:"#6ee7f7", confluence:"#4da6ff", notion:"#8899bb" };

  const generateDoc = async () => {
    if (!genInput.trim() || genLoading) return;
    setGenLoading(true);
    setGenOutput("");
    const prompts = {
      api: `Generate production-ready API documentation for this code/module from the acme-engineering Node.js/TypeScript codebase. Include: Overview, Prerequisites, Authentication, Endpoints/Methods, Parameters, Response schemas, Error codes, and Code examples. Format as clean Markdown for Mintlify.\n\nCode/Module: ${genInput}`,
      kt: `Create a Knowledge Transfer (KT) document for a new developer joining acme-engineering who needs to understand this module. Include: Purpose, Architecture overview, Key decisions made (and why), Common gotchas, How to run locally, How to debug, Who to ask for help. Format as Markdown.\n\nModule/Topic: ${genInput}`,
      runbook: `Write an operational runbook for acme-engineering's on-call engineers. Include: When to use this runbook, Pre-requisites, Step-by-step procedures, Rollback steps, Escalation contacts, and Post-incident checklist. Format as Markdown.\n\nScenario/Module: ${genInput}`,
      onboarding: `Create a structured onboarding guide for a new engineer joining the acme-engineering team who will work on this area. Include: Background reading, Local setup steps, First tasks to try, Key files to read, Slack channels to join, First-week checklist. Format as Markdown.\n\nArea/Module: ${genInput}`,
    };
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompts[genMode] }],
        }),
      });
      const data = await res.json();
      const text = data.text || data.error || "No response.";
      setGenOutput(text);
    } catch { setGenOutput("⚠ Connection error. Please try again."); }
    setGenLoading(false);
  };

  const tabs = [
    { id:"docs", label:"Documentation" },
    { id:"kt", label:"KT Sessions" },
    { id:"generate", label:"AI Generate" },
    { id:"platforms", label:"Integrations" },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <StatCard label="Total Docs" value="28" color="#6ee7f7"/>
        <StatCard label="Coverage Score" value="72%" color="#22c55e" sub="+8% this sprint"/>
        <StatCard label="Stale Docs" value="3" color="#f59e0b" sub="Need update"/>
        <StatCard label="KT Sessions" value="4" color="#a78bfa" sub="This month"/>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:4,padding:"4px",background:"#080c17",borderRadius:8,border:"1px solid #1e2637",width:"fit-content"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"6px 16px",borderRadius:6,border:"none",background:tab===t.id?"#0d1525":"transparent",color:tab===t.id?"#6ee7f7":"#4a5a7a",cursor:"pointer",fontSize:13,fontFamily:"inherit",transition:"all 0.15s",whiteSpace:"nowrap"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DOCS TAB ── */}
      {tab==="docs" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:12}}>
          <Card title="All Documentation">
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {docsList.map(doc=>(
                <div key={doc.id} onClick={()=>setSelectedDoc(doc)}
                  style={{padding:"12px 14px",borderRadius:6,background:selectedDoc.id===doc.id?"#0a1520":"#080c17",border:`1px solid ${selectedDoc.id===doc.id?"#1e3050":"#12192a"}`,cursor:"pointer",transition:"all 0.15s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <span style={{flex:1,fontSize:13,color:"#c8d8f0",fontWeight:500}}>{doc.title}</span>
                    <span style={{fontSize:10,color:statusColor[doc.status],background:statusColor[doc.status]+"18",border:`1px solid ${statusColor[doc.status]}33`,borderRadius:4,padding:"2px 8px",fontWeight:700,fontFamily:"monospace",textTransform:"uppercase"}}>{doc.status}</span>
                    {doc.platform!=="—" && <span style={{fontSize:11,color:platformColor[doc.platform]||"#8899bb",background:platformColor[doc.platform]+"15"||"#8899bb15",borderRadius:4,padding:"2px 8px"}}>{doc.platform}</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:"#445566",fontFamily:"monospace"}}>{doc.file}</span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:60,height:3,background:"#1e2637",borderRadius:2,overflow:"hidden"}}>
                        <div style={{width:`${doc.coverage}%`,height:"100%",background:doc.coverage>80?"#22c55e":doc.coverage>50?"#f59e0b":"#ff3b3b",borderRadius:2}}/>
                      </div>
                      <span style={{fontSize:11,color:"#445566"}}>{doc.coverage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Doc detail */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{background:"#0d111c",border:`1px solid ${statusColor[selectedDoc.status]}33`,borderRadius:8,padding:16}}>
              <div style={{fontSize:11,color:statusColor[selectedDoc.status],fontWeight:700,textTransform:"uppercase",fontFamily:"monospace",marginBottom:8}}>{selectedDoc.status}</div>
              <div style={{fontSize:15,color:"#e8f0ff",fontWeight:600,marginBottom:4}}>{selectedDoc.title}</div>
              <div style={{fontSize:12,color:"#445566",fontFamily:"monospace",marginBottom:14}}>{selectedDoc.file}</div>

              <div style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6,color:"#8899bb"}}>
                  <span>Doc Coverage</span><span style={{color:selectedDoc.coverage>80?"#22c55e":selectedDoc.coverage>50?"#f59e0b":"#ff3b3b",fontFamily:"monospace"}}>{selectedDoc.coverage}%</span>
                </div>
                <div style={{height:6,background:"#1e2637",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:`${selectedDoc.coverage}%`,height:"100%",background:selectedDoc.coverage>80?"#22c55e":selectedDoc.coverage>50?"#f59e0b":"#ff3b3b",borderRadius:3}}/>
                </div>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                {[
                  {label:"Platform",val:selectedDoc.platform},
                  {label:"Last Sync",val:selectedDoc.lastSync},
                  {label:"Status",val:selectedDoc.status},
                ].map(r=>(
                  <div key={r.label} style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                    <span style={{color:"#445566"}}>{r.label}</span>
                    <span style={{color:"#c8d8f0"}}>{r.val}</span>
                  </div>
                ))}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <button onClick={()=>{setTab("generate");setGenInput(selectedDoc.title+" — "+selectedDoc.file);}}
                  style={{width:"100%",padding:"8px",background:"#6ee7f722",border:"1px solid #6ee7f744",borderRadius:6,color:"#6ee7f7",fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <Icon name="sparkle" size={13}/> AI Generate / Update Doc
                </button>
                {selectedDoc.stale && (
                  <div style={{padding:"8px 10px",background:"#1f1500",border:"1px solid #f59e0b33",borderRadius:6,fontSize:12,color:"#f59e0b",lineHeight:1.5}}>
                    ⚠ This doc is out of date. Last code change was {selectedDoc.lastSync} ago — regenerate recommended.
                  </div>
                )}
              </div>
            </div>

            <Card title="Quick Actions">
              {[
                {label:"Sync to Mintlify",icon:"upload",color:"#6ee7f7"},
                {label:"Push to Confluence",icon:"upload",color:"#4da6ff"},
                {label:"View on Notion",icon:"eye",color:"#8899bb"},
                {label:"Download as Markdown",icon:"download",color:"#a78bfa"},
              ].map(a=>(
                <button key={a.label}
                  style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 10px",background:"transparent",border:"none",borderBottom:"1px solid #12192a",color:"#8899bb",cursor:"pointer",fontSize:13,fontFamily:"inherit",textAlign:"left",transition:"color 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.color=a.color}
                  onMouseLeave={e=>e.currentTarget.style.color="#8899bb"}>
                  <Icon name={a.icon} size={14}/>{a.label}
                </button>
              ))}
            </Card>
          </div>
        </div>
      )}

      {/* ── KT TAB ── */}
      {tab==="kt" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:12}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,color:"#8899bb"}}>4 sessions this month · 3 completed</div>
              <button style={{padding:"7px 14px",background:"#6ee7f722",border:"1px solid #6ee7f744",borderRadius:6,color:"#6ee7f7",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ Schedule KT</button>
            </div>
            {ktSessions.map(kt=>(
              <div key={kt.id} style={{background:"#0d111c",border:`1px solid ${kt.status==="scheduled"?"#6ee7f733":"#1e2637"}`,borderRadius:8,padding:16,cursor:"pointer"}} onClick={()=>setKtModal(kt)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:14,color:"#e8f0ff",fontWeight:600,marginBottom:4}}>{kt.title}</div>
                    <div style={{fontSize:12,color:"#445566"}}>{kt.date}</div>
                  </div>
                  <span style={{fontSize:10,color:kt.status==="completed"?"#22c55e":"#f59e0b",background:kt.status==="completed"?"#0a2a0a":"#1f1500",border:`1px solid ${kt.status==="completed"?"#22c55e33":"#f59e0b33"}`,borderRadius:4,padding:"3px 9px",fontWeight:700,fontFamily:"monospace",textTransform:"uppercase"}}>{kt.status}</span>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:"#1e2637",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#8899bb",fontWeight:700}}>{kt.from[0]}</div>
                  <span style={{fontSize:12,color:"#c8d8f0"}}>{kt.from}</span>
                  <span style={{fontSize:12,color:"#2a3a55"}}>→</span>
                  <div style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,#6ee7f7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#060a14",fontWeight:700}}>{kt.to[0]}</div>
                  <span style={{fontSize:12,color:"#c8d8f0"}}>{kt.to}</span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                  {kt.modules.map(m=><span key={m} style={{fontSize:11,background:"#1e2637",color:"#6ee7f7",padding:"2px 8px",borderRadius:20}}>{m}</span>)}
                </div>
                <div style={{display:"flex",gap:12}}>
                  <span style={{fontSize:11,color:kt.recording?"#22c55e":"#2a3a55",display:"flex",alignItems:"center",gap:4}}>
                    <span>{kt.recording?"●":"○"}</span> Recording
                  </span>
                  <span style={{fontSize:11,color:kt.docLinked?"#6ee7f7":"#2a3a55",display:"flex",alignItems:"center",gap:4}}>
                    <Icon name="link" size={11}/> Doc linked
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Card title="KT Health">
              {[
                {label:"Modules with KT done",val:"6 / 9",color:"#22c55e"},
                {label:"Modules at risk (1 owner)",val:"3",color:"#ff3b3b"},
                {label:"KT docs linked",val:"2 / 4",color:"#f59e0b"},
                {label:"Avg KT duration",val:"47 min",color:"#6ee7f7"},
              ].map(r=>(
                <div key={r.label} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #12192a",fontSize:13}}>
                  <span style={{color:"#5a6a8a",fontSize:12}}>{r.label}</span>
                  <span style={{color:r.color,fontFamily:"monospace",fontWeight:700}}>{r.val}</span>
                </div>
              ))}
            </Card>
            <Card title="Bus Factor Risk">
              {[
                {module:"StripeClient",owners:1,risk:"high"},
                {module:"JWTUtil",owners:1,risk:"high"},
                {module:"AuthService",owners:2,risk:"med"},
                {module:"UserService",owners:3,risk:"low"},
              ].map(m=>(
                <div key={m.module} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #12192a"}}>
                  <span style={{fontSize:12,fontFamily:"monospace",color:"#c8d8f0"}}>{m.module}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:"#445566"}}>{m.owners} owner{m.owners>1?"s":""}</span>
                    <RiskBadge level={m.risk}/>
                  </div>
                </div>
              ))}
              <div style={{marginTop:10,padding:"8px 10px",background:"#2a0a0a",border:"1px solid #ff3b3b33",borderRadius:6,fontSize:12,color:"#ff7070",lineHeight:1.5}}>
                ⚠ StripeClient & JWTUtil have single owners — schedule KT before next sprint.
              </div>
            </Card>
            <button onClick={()=>{setTab("generate");setGenMode("kt");}}
              style={{width:"100%",padding:"9px",background:"#a78bfa22",border:"1px solid #a78bfa44",borderRadius:6,color:"#a78bfa",fontSize:13,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Icon name="sparkle" size={13}/> AI Generate KT Doc
            </button>
          </div>
        </div>
      )}

      {/* ── GENERATE TAB ── */}
      {tab==="generate" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card title="AI Documentation Generator">
              <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                {[{id:"api",label:"API Docs"},{id:"kt",label:"KT Document"},{id:"runbook",label:"Runbook"},{id:"onboarding",label:"Onboarding Guide"}].map(m=>(
                  <button key={m.id} onClick={()=>setGenMode(m.id)}
                    style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${genMode===m.id?"#6ee7f744":"#1e2637"}`,background:genMode===m.id?"#6ee7f722":"transparent",color:genMode===m.id?"#6ee7f7":"#4a5a7a",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div style={{fontSize:12,color:"#445566",marginBottom:8}}>
                {genMode==="api" && "Describe a module, paste code, or give a file path — AI will generate Mintlify-ready API docs."}
                {genMode==="kt" && "Describe the module or topic — AI will generate a complete KT document for the incoming engineer."}
                {genMode==="runbook" && "Describe the scenario or system — AI will generate a step-by-step operational runbook."}
                {genMode==="onboarding" && "Describe the area — AI will generate a first-week onboarding guide for new hires."}
              </div>
              <textarea value={genInput} onChange={e=>setGenInput(e.target.value)} rows={6}
                placeholder={
                  genMode==="api" ? "e.g. JWT authentication middleware — handles token validation, expiry, and refresh logic"
                  : genMode==="kt" ? "e.g. Payments module — Stripe integration, retry logic, webhook handling"
                  : genMode==="runbook" ? "e.g. Payment service down — how to diagnose and recover"
                  : "e.g. New backend engineer joining the auth team"
                }
                style={{width:"100%",background:"#080c17",border:"1px solid #1e2637",borderRadius:6,padding:"10px 12px",fontSize:13,color:"#c8d8f0",outline:"none",fontFamily:"inherit",resize:"vertical",lineHeight:1.6}}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={generateDoc} disabled={genLoading||!genInput.trim()}
                  style={{flex:1,padding:"9px",background:genLoading||!genInput.trim()?"#0d1525":"#6ee7f722",border:`1px solid ${genLoading||!genInput.trim()?"#1e2637":"#6ee7f744"}`,borderRadius:6,color:genLoading||!genInput.trim()?"#2a3a55":"#6ee7f7",fontSize:13,cursor:genLoading||!genInput.trim()?"not-allowed":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  {genLoading ? "Generating…" : <><Icon name="sparkle" size={13}/> Generate</>}
                </button>
                {genOutput && <button onClick={()=>setGenOutput("")} style={{padding:"9px 14px",background:"transparent",border:"1px solid #1e2637",borderRadius:6,color:"#445566",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Clear</button>}
              </div>
            </Card>

            {/* Platform publish targets */}
            <Card title="Publish To">
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[
                  {name:"Mintlify",connected:true,color:"#6ee7f7",desc:"Published to docs.acme.dev"},
                  {name:"Confluence",connected:true,color:"#4da6ff",desc:"Push to Engineering Space"},
                  {name:"Notion",connected:false,color:"#8899bb",desc:"Connect Notion first"},
                  {name:"GitHub Wiki",connected:false,color:"#a78bfa",desc:"Connect repo wiki first"},
                ].map(p=>(
                  <div key={p.name} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"#080c17",borderRadius:6,border:"1px solid #12192a"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:p.connected?p.color:"#2a3a55",flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:p.connected?"#c8d8f0":"#445566"}}>{p.name}</div>
                      <div style={{fontSize:11,color:"#2a3a55"}}>{p.desc}</div>
                    </div>
                    <button disabled={!p.connected||!genOutput}
                      style={{padding:"4px 10px",background:p.connected&&genOutput?p.color+"22":"transparent",border:`1px solid ${p.connected&&genOutput?p.color+"44":"#1e2637"}`,borderRadius:4,color:p.connected&&genOutput?p.color:"#2a3a55",fontSize:11,cursor:p.connected&&genOutput?"pointer":"not-allowed",fontFamily:"inherit"}}>
                      {p.connected?"Push":"Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Generated output */}
          <Card title={genOutput?"Generated Document":"Preview"} style={{position:"relative"}}>
            {genLoading ? (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,gap:16}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#6ee7f7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",animation:"spin 1.5s linear infinite"}}>
                  <Icon name="brain" size={18}/>
                </div>
                <div style={{fontSize:14,color:"#8899bb"}}>Claude is generating your document…</div>
                <div style={{fontSize:12,color:"#2a3a55"}}>Analysing codebase context · acme-engineering</div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : genOutput ? (
              <div style={{overflowY:"auto",maxHeight:520}}>
                <pre style={{fontSize:12,color:"#c8d8f0",lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"'Fira Code',monospace",margin:0}}>{genOutput}</pre>
                <div style={{display:"flex",gap:8,marginTop:14,paddingTop:12,borderTop:"1px solid #1e2637"}}>
                  <button style={{flex:1,padding:"7px",background:"#6ee7f722",border:"1px solid #6ee7f744",borderRadius:6,color:"#6ee7f7",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Copy Markdown</button>
                  <button style={{flex:1,padding:"7px",background:"#a78bfa22",border:"1px solid #a78bfa44",borderRadius:6,color:"#a78bfa",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Save as Draft</button>
                </div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,gap:12,color:"#2a3a55"}}>
                <Icon name="docs" size={40}/>
                <div style={{fontSize:14}}>Fill in the prompt and click Generate</div>
                <div style={{fontSize:12}}>Supports API docs, KT docs, runbooks, and onboarding guides</div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── PLATFORMS TAB ── */}
      {tab==="platforms" && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
            {platforms.map(p=>(
              <div key={p.name} style={{background:"#0d111c",border:`1px solid ${p.connected?p.color+"33":"#1e2637"}`,borderRadius:8,padding:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:36,height:36,borderRadius:8,background:p.color+"22",border:`1px solid ${p.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:p.color}}>{p.name[0]}</div>
                    <div>
                      <div style={{fontSize:14,color:"#e8f0ff",fontWeight:600}}>{p.name}</div>
                      {p.connected && <div style={{fontSize:11,color:"#22c55e",display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:8}}>●</span> Connected</div>}
                    </div>
                  </div>
                  <button style={{padding:"6px 14px",background:p.connected?p.color+"22":"transparent",border:`1px solid ${p.connected?p.color+"44":"#1e2637"}`,borderRadius:6,color:p.connected?p.color:"#5a6a8a",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    {p.connected?"Manage":"Connect"}
                  </button>
                </div>
                <div style={{fontSize:13,color:"#8899bb",lineHeight:1.6,marginBottom:10}}>{p.desc}</div>
                {p.connected && (
                  <div style={{display:"flex",gap:16}}>
                    <div style={{fontSize:12,color:"#445566"}}><span style={{color:p.color,fontFamily:"monospace",fontSize:15,fontWeight:700}}>{p.docs}</span> docs synced</div>
                    <div style={{fontSize:12,color:"#445566"}}>Auto-sync <span style={{color:"#22c55e"}}>on</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Card title="Sync Rules">
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                {trigger:"PR merged to main",action:"Regenerate affected module docs → Push to Mintlify",active:true},
                {trigger:"New ADR created",action:"Auto-create Confluence page in Architecture space",active:true},
                {trigger:"KT session completed",action:"Link recording + generate summary doc in Notion",active:false},
                {trigger:"Doc coverage < 50%",action:"Flag in dashboard + notify module owner",active:true},
                {trigger:"Weekly",action:"Stale doc scan → notify owners of docs unchanged > 3 months",active:true},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:"#080c17",borderRadius:6,border:"1px solid #12192a"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:r.active?"#22c55e":"#2a3a55",flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"#5a6a8a",marginBottom:2}}>When: <span style={{color:"#8899bb"}}>{r.trigger}</span></div>
                    <div style={{fontSize:12,color:"#c8d8f0"}}>→ {r.action}</div>
                  </div>
                  <span style={{fontSize:11,color:r.active?"#22c55e":"#2a3a55"}}>{r.active?"Active":"Off"}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* KT Modal */}
      {ktModal && (
        <div style={{position:"fixed",inset:0,background:"#000a",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900}} onClick={()=>setKtModal(null)}>
          <div style={{background:"#0d111c",border:"1px solid #1e3050",borderRadius:12,padding:28,width:480,maxWidth:"90vw"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:16,color:"#e8f0ff",fontWeight:600,marginBottom:4}}>{ktModal.title}</div>
                <div style={{fontSize:12,color:"#445566"}}>{ktModal.date}</div>
              </div>
              <button onClick={()=>setKtModal(null)} style={{background:"none",border:"none",color:"#445566",cursor:"pointer",fontSize:20,lineHeight:1,padding:0}}>×</button>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"#1e2637",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#8899bb",fontWeight:700}}>{ktModal.from[0]}</div>
              <span style={{fontSize:13,color:"#c8d8f0"}}>{ktModal.from}</span>
              <span style={{color:"#2a3a55",fontSize:16}}>→</span>
              <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#6ee7f7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#060a14",fontWeight:700}}>{ktModal.to[0]}</div>
              <span style={{fontSize:13,color:"#c8d8f0"}}>{ktModal.to}</span>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"#5a6a8a",marginBottom:6}}>Modules covered</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {ktModal.modules.map(m=><span key={m} style={{fontSize:12,background:"#1e2637",color:"#6ee7f7",padding:"3px 10px",borderRadius:20}}>{m}</span>)}
              </div>
            </div>
            <div style={{display:"flex",gap:16,marginBottom:18}}>
              <div style={{fontSize:13,color:ktModal.recording?"#22c55e":"#445566",display:"flex",alignItems:"center",gap:6}}><span>{ktModal.recording?"●":"○"}</span> Session Recording {ktModal.recording?"Available":"Pending"}</div>
              <div style={{fontSize:13,color:ktModal.docLinked?"#6ee7f7":"#445566",display:"flex",alignItems:"center",gap:6}}><Icon name="link" size={13}/> Doc {ktModal.docLinked?"Linked":"Not Linked"}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setKtModal(null);setTab("generate");setGenMode("kt");setGenInput(ktModal.title+" — modules: "+ktModal.modules.join(", "));}}
                style={{flex:1,padding:"9px",background:"#a78bfa22",border:"1px solid #a78bfa44",borderRadius:6,color:"#a78bfa",fontSize:13,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <Icon name="sparkle" size={13}/> Generate KT Doc
              </button>
              {ktModal.recording&&<button style={{flex:1,padding:"9px",background:"#22c55e22",border:"1px solid #22c55e44",borderRadius:6,color:"#22c55e",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>▶ View Recording</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const nav = [
  { id:"dashboard", label:"Overview", icon:"dashboard" },
  { id:"review", label:"Code Review", icon:"code" },
  { id:"bugs", label:"Bug Predictor", icon:"bug" },
  { id:"knowledge", label:"Knowledge Graph", icon:"graph" },
  { id:"sprint", label:"Sprint Intelligence", icon:"sprint" },
  { id:"onboarding", label:"Dev Onboarding", icon:"onboard" },
  { id:"architecture", label:"Architecture", icon:"architecture" },
  { id:"docs", label:"Docs & KT", icon:"docs" },
  { id:"settings", label:"Settings", icon:"settings" },
];

// ── App ───────────────────────────────────────────────────────────────────────
export default function DevMind() {
  const [active,setActive] = useState("dashboard");
  const [showAI,setShowAI] = useState(false);
  const [showNotif,setShowNotif] = useState(false);
  const [time,setTime] = useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),60000);return()=>clearInterval(t);},[]);
  const [me,setMe] = useState(null);
  const [showMenu,setShowMenu] = useState(false);
  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>setMe(data.user));
    const { data:{subscription} } = supabase.auth.onAuthStateChange((_e,s)=>setMe(s?.user??null));
    return ()=>subscription.unsubscribe();
  },[]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  useRealtimeNotifications(me?.id, () => {
    // Show a visual indication of new notification in topbar
    setShowNotif(true); 
    // Trigger re-renders for children that might need fresh data
    setRefreshTrigger(prev => prev + 1);
  });

  const initial = (me?.user_metadata?.full_name || me?.email || "?")[0].toUpperCase();
  const signOut = async ()=>{ await supabase.auth.signOut(); window.location.href="/login"; };

  const screens = {
    dashboard: <Dashboard key={`dashboard-${refreshTrigger}`} />,
    review: <CodeReview key={`review-${refreshTrigger}`} />,
    bugs: <BugPredictor key={`bugs-${refreshTrigger}`} />,
    knowledge: <KnowledgePage key={`knowledge-${refreshTrigger}`} />,
    sprint: <SprintPage key={`sprint-${refreshTrigger}`} />,
    onboarding: <OnboardingPage key={`onboarding-${refreshTrigger}`} />,
    architecture: <ArchitecturePage key={`arch-${refreshTrigger}`} />,
    docs: <DocsKTPage key={`docs-${refreshTrigger}`} />,
    settings: <SettingsPage key={`settings-${refreshTrigger}`} />,
  };
  const current = nav.find(n=>n.id===active);

  return (
    <div style={{display:"flex",height:"100vh",background:"#060a14",color:"#c8d8f0",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",overflow:"hidden",position:"relative"}}>
      {/* Sidebar */}
      <div style={{width:220,background:"#080c17",borderRight:"1px solid #12192a",display:"flex",flexDirection:"column",flexShrink:0,zIndex:10}}>
        <div style={{padding:"20px 18px 16px",borderBottom:"1px solid #12192a"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <div style={{width:28,height:28,background:"linear-gradient(135deg,#6ee7f7,#a78bfa)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Icon name="brain" size={14}/>
            </div>
            <span style={{fontSize:16,fontWeight:700,color:"#e8f0ff",letterSpacing:"-0.5px"}}>DevMind</span>
          </div>
          <div style={{fontSize:11,color:"#2a3a55"}}>org: acme-engineering</div>
        </div>
        <nav style={{flex:1,padding:"12px 10px",display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
          {nav.map(item=>(
            <button key={item.id} onClick={()=>setActive(item.id)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:6,border:"none",background:active===item.id?"#0d1525":"transparent",color:active===item.id?"#6ee7f7":"#4a5a7a",cursor:"pointer",textAlign:"left",width:"100%",fontSize:13,fontFamily:"inherit",transition:"all 0.15s",borderLeft:active===item.id?"2px solid #6ee7f7":"2px solid transparent"}}>
              <Icon name={item.icon} size={15}/>{item.label}
            </button>
          ))}
        </nav>
        <div style={{padding:"12px 18px",borderTop:"1px solid #12192a"}}>
          <div style={{fontSize:11,color:"#2a3a55",marginBottom:6}}>AI Status</div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 6px #22c55e"}}/>
            <span style={{fontSize:12,color:"#22c55e"}}>Active · 47 devs online</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Topbar */}
        <div style={{padding:"14px 24px",borderBottom:"1px solid #12192a",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#080c17",flexShrink:0,zIndex:10}}>
          <div>
            <div style={{fontSize:16,color:"#e8f0ff",fontWeight:600}}>{current?.label}</div>
            <div style={{fontSize:12,color:"#2a3a55"}}>{time.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})} · Real-time AI analysis</div>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <button onClick={()=>{setShowNotif(p=>!p);setShowAI(false);}} style={{background:"none",border:"none",color:showNotif?"#6ee7f7":"#4a5a7a",cursor:"pointer",padding:4,position:"relative",display:"flex"}}>
              <Icon name="bell" size={18}/>
              <div style={{position:"absolute",top:0,right:0,width:8,height:8,background:"#ff3b3b",borderRadius:"50%",border:"2px solid #080c17"}}/>
            </button>
            <button onClick={()=>{setShowAI(p=>!p);setShowNotif(false);}} style={{display:"flex",alignItems:"center",gap:6,background:showAI?"#6ee7f722":"#0d1525",border:`1px solid ${showAI?"#6ee7f744":"#1e2637"}`,borderRadius:20,padding:"5px 12px",color:showAI?"#6ee7f7":"#4a5a7a",cursor:"pointer",fontSize:12,fontFamily:"inherit",transition:"all 0.15s"}}>
              <Icon name="chat" size={13}/> Ask AI
            </button>
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowMenu(p=>!p)} style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#6ee7f7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#060a14",border:"none",cursor:"pointer"}}>{initial}</button>
              {showMenu && (
                <div style={{position:"absolute",top:36,right:0,background:"#0d111c",border:"1px solid #1e2637",borderRadius:8,minWidth:200,padding:6,zIndex:100,boxShadow:"0 8px 24px #000a"}}>
                  <div style={{padding:"8px 10px",borderBottom:"1px solid #12192a",marginBottom:4}}>
                    <div style={{fontSize:12,color:"#c8d8f0",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{me?.user_metadata?.full_name || me?.email}</div>
                    <div style={{fontSize:11,color:"#445566",marginTop:2}}>{me?.email}</div>
                  </div>
                  <button onClick={signOut} style={{width:"100%",textAlign:"left",padding:"8px 10px",background:"none",border:"none",color:"#ff9a9a",fontSize:12,cursor:"pointer",borderRadius:4,fontFamily:"inherit"}}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Content */}
        <div style={{flex:1,overflow:"auto",padding:20}}>
          {screens[active]}
        </div>
      </div>

      {/* Panels */}
      {showNotif && <NotificationsPanel onClose={()=>setShowNotif(false)}/>}
      {showAI && <AIAssistant onClose={()=>setShowAI(false)}/>}
    </div>
  );
}
