import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAudit } from "@/lib/security/audit-log";
import { listRecentEvents } from "@/lib/owner/events";
import { p75 as percentile75, rateVital, isVitalName, type VitalRating } from "@/lib/vitals/rate";
import { blogSlug } from "@/lib/analytics/classify";

// Data for the admin cost/ops console: per-user + per-provider + per-task AI spend (from ai_usage), and the
// background-job health (ad + change sync state). Reads via the service-role admin client. Aggregation is in
// JS over a bounded window - fine at current volume; move to a SQL rollup/materialized view at scale.

const round = (n: number) => Math.round(n * 1e4) / 1e4;

export type UserSpend = { userId: string | null; email: string; calls: number; promptTokens: number; completionTokens: number; costUsd: number };
export type Bucket = { key: string; calls: number; costUsd: number };
export type JobRow = { account: string; userEmail: string; lastOk: boolean | null; lastError: string | null; lastRunAt: string | null; detail: string };
export type ConnectorStatus = { name: string; configured: boolean; status: "ok" | "not_configured" | "attention"; detail: string };
export type OwnerOverview = { totalUsers: number; dau: number; wau: number; mau: number; newUsers7d: number; newUsers30d: number; activeAiUsers: number };
export type ActivityRow = { at: string; event: string; user: string; feature: string | null };
export type UserFeature = { email: string; features: { feature: string; calls: number; costUsd: number }[]; costUsd: number };
export type ProblemRow = { at: string; feature: string; message: string; user: string };
export type WebVitalRow = { metric: string; p75: number | null; rating: VitalRating | null; samples: number };
export type WebsiteAnalytics = {
  pageViews: number;
  visitors: number; // approximate: distinct daily visitor hashes in the window
  blogReads: number;
  topPages: { path: string; views: number }[];
  topReferrers: { host: string; views: number }[];
  topBlogs: { slug: string; reads: number }[];
};
export type AuditEventRow = { at: string; actor: string; action: string; target: string; result: string; reason: string | null };
export type AdminDashboard = {
  windowDays: number;
  totalCalls: number;
  totalCostUsd: number;
  totalTokens: number;
  users: UserSpend[];
  providers: Bucket[];
  tasks: Bucket[];
  jobs: JobRow[];
  audit: AuditEventRow[];
  connectors: ConnectorStatus[];
  overview: OwnerOverview;
  activity: ActivityRow[];
  models: Bucket[];
  userFeatures: UserFeature[];
  problems: ProblemRow[];
  webVitals: WebVitalRow[];
  website: WebsiteAnalytics;
};

type UsageRow = { user_id: string | null; task: string | null; provider: string; model: string; prompt_tokens: number; completion_tokens: number; cost_usd: number };

export async function loadAdminDashboard(windowDays = 30): Promise<AdminDashboard> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const { data: usageData } = await admin
    .from("ai_usage")
    .select("user_id,task,provider,model,prompt_tokens,completion_tokens,cost_usd")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20000);
  const usage = (usageData ?? []) as UsageRow[];

  // id -> email (Supabase admin API; auth.users isn't exposed via PostgREST).
  const emails = new Map<string, string>();
  let allUsers: { id: string; email?: string; created_at?: string; last_sign_in_at?: string | null }[] = [];
  try {
    const { data } = await admin.auth.admin.listUsers();
    allUsers = data.users;
    for (const u of data.users) if (u.email) emails.set(u.id, u.email);
  } catch {
    /* best-effort: fall back to showing the id */
  }

  const byUser = new Map<string, UserSpend>();
  const byProvider = new Map<string, Bucket>();
  const byTask = new Map<string, Bucket>();
  const byModel = new Map<string, Bucket>();
  const userTask = new Map<string, Map<string, { calls: number; costUsd: number }>>(); // userKey -> feature -> {calls,cost}
  let totalCalls = 0;
  let totalCostUsd = 0;
  let totalTokens = 0;
  for (const r of usage) {
    totalCalls++;
    totalCostUsd += r.cost_usd || 0;
    totalTokens += (r.prompt_tokens || 0) + (r.completion_tokens || 0);
    const uk = r.user_id ?? "unattributed";
    const u = byUser.get(uk) ?? { userId: r.user_id, email: r.user_id ? emails.get(r.user_id) ?? r.user_id : "unattributed", calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 };
    u.calls++; u.promptTokens += r.prompt_tokens || 0; u.completionTokens += r.completion_tokens || 0; u.costUsd += r.cost_usd || 0;
    byUser.set(uk, u);
    const p = byProvider.get(r.provider) ?? { key: r.provider, calls: 0, costUsd: 0 };
    p.calls++; p.costUsd += r.cost_usd || 0; byProvider.set(r.provider, p);
    const tk = r.task ?? "other";
    const t = byTask.get(tk) ?? { key: tk, calls: 0, costUsd: 0 };
    t.calls++; t.costUsd += r.cost_usd || 0; byTask.set(tk, t);
    const mk = r.model || "unknown";
    const mm = byModel.get(mk) ?? { key: mk, calls: 0, costUsd: 0 };
    mm.calls++; mm.costUsd += r.cost_usd || 0; byModel.set(mk, mm);
    // per-user feature (task) breakdown: which user used which feature, how many times, at what cost.
    const uf = userTask.get(uk) ?? new Map<string, { calls: number; costUsd: number }>();
    const ufe = uf.get(tk) ?? { calls: 0, costUsd: 0 };
    ufe.calls++; ufe.costUsd += r.cost_usd || 0; uf.set(tk, ufe); userTask.set(uk, uf);
  }

  const jobs: JobRow[] = [];
  const { data: adState } = await admin.from("ad_sync_state").select("account_external_id,user_id,last_ok,last_error,last_synced_date,last_run_at,last_rows").order("last_run_at", { ascending: false }).limit(50);
  for (const s of (adState ?? []) as { account_external_id: string; user_id: string; last_ok: boolean | null; last_error: string | null; last_synced_date: string | null; last_run_at: string | null; last_rows: number | null }[]) {
    jobs.push({ account: s.account_external_id, userEmail: emails.get(s.user_id) ?? s.user_id, lastOk: s.last_ok, lastError: s.last_error, lastRunAt: s.last_run_at, detail: `metrics sync${s.last_synced_date ? ` · through ${s.last_synced_date}` : ""}${s.last_rows != null ? ` · ${s.last_rows} rows` : ""}` });
  }
  const { data: chState } = await admin.from("change_sync_state").select("account_external_id,user_id,last_ok,last_error,last_event_time,last_run_at,changes_seen").order("last_run_at", { ascending: false }).limit(50);
  for (const s of (chState ?? []) as { account_external_id: string; user_id: string; last_ok: boolean | null; last_error: string | null; last_event_time: string | null; last_run_at: string | null; changes_seen: number | null }[]) {
    jobs.push({ account: s.account_external_id, userEmail: emails.get(s.user_id) ?? s.user_id, lastOk: s.last_ok, lastError: s.last_error, lastRunAt: s.last_run_at, detail: `change sync${s.changes_seen != null ? ` · ${s.changes_seen} changes` : ""}` });
  }

  // Connector / integration health: which integrations are wired + working. Derived from env presence + a
  // couple of DB signals (no separate registry table needed at this scale - a real registry is a later seam).
  const { count: connectedAccounts } = await admin.from("ad_accounts").select("id", { count: "exact", head: true }).eq("platform", "meta").eq("status", "connected");
  const { count: shopifyConns } = await admin.from("shopify_connections").select("user_id", { count: "exact", head: true });
  const syncHasError = jobs.some((j) => j.detail.startsWith("metrics") && j.lastOk === false);
  const env = (k: string) => Boolean(process.env[k]);
  const imgChoice = (process.env.IMAGE_PROVIDER ?? "").toLowerCase();
  const imgActive = imgChoice === "openai" ? env("OPENAI_API_KEY") : (imgChoice === "google" || imgChoice === "") && env("GEMINI_API_KEY");
  const connectors: ConnectorStatus[] = [
    { name: "Gemini (AI)", configured: env("GEMINI_API_KEY"), status: env("GEMINI_API_KEY") ? "ok" : "not_configured", detail: env("GEMINI_API_KEY") ? "key set" : "no key" },
    { name: "OpenAI (fallback)", configured: env("OPENAI_API_KEY"), status: env("OPENAI_API_KEY") ? "ok" : "not_configured", detail: env("OPENAI_API_KEY") ? "key set" : "no key" },
    { name: "Anthropic (fallback)", configured: env("ANTHROPIC_API_KEY"), status: env("ANTHROPIC_API_KEY") ? "ok" : "not_configured", detail: env("ANTHROPIC_API_KEY") ? "key set" : "no key" },
    { name: "Meta Ads", configured: (connectedAccounts ?? 0) > 0, status: (connectedAccounts ?? 0) === 0 ? "not_configured" : syncHasError ? "attention" : "ok", detail: `${connectedAccounts ?? 0} connected account(s)${syncHasError ? " · a sync errored" : ""}` },
    { name: "Shopify", configured: (shopifyConns ?? 0) > 0, status: (shopifyConns ?? 0) > 0 ? "ok" : "not_configured", detail: `${shopifyConns ?? 0} store(s)` },
    { name: "Image generation", configured: imgActive, status: imgActive ? "ok" : "not_configured", detail: imgActive ? `real images (${imgChoice || "google"})` : "stub placeholders" },
    { name: "Competitor source", configured: env("SCRAPECREATORS_API_KEY"), status: "ok", detail: env("SCRAPECREATORS_API_KEY") ? "ScrapeCreators" : "Meta Ad Library (free)" },
    { name: "Upstash (limits/budget)", configured: env("UPSTASH_REDIS_REST_URL") && env("UPSTASH_REDIS_REST_TOKEN"), status: env("UPSTASH_REDIS_REST_URL") ? "ok" : "not_configured", detail: env("UPSTASH_REDIS_REST_URL") ? "distributed" : "per-instance fallback" },
    { name: "Alerts webhook", configured: env("ALERT_WEBHOOK_URL"), status: env("ALERT_WEBHOOK_URL") ? "ok" : "not_configured", detail: env("ALERT_WEBHOOK_URL") ? "configured" : "logs only" },
    { name: "Cron (auto-refresh)", configured: env("CRON_SECRET"), status: env("CRON_SECRET") ? "ok" : "attention", detail: env("CRON_SECRET") ? "armed" : "CRON_SECRET unset" },
  ];

  // Owner overview: active users (real sign-ins) + new signups, from Supabase auth timestamps. DAU/WAU/MAU
  // count users whose last sign-in falls in the window - a real active-user read, not a vanity number.
  const now2 = Date.now();
  const within = (iso: string | null | undefined, ms: number) => Boolean(iso) && now2 - new Date(iso as string).getTime() <= ms;
  const overview: OwnerOverview = {
    totalUsers: allUsers.length,
    dau: allUsers.filter((u) => within(u.last_sign_in_at, 86_400_000)).length,
    wau: allUsers.filter((u) => within(u.last_sign_in_at, 7 * 86_400_000)).length,
    mau: allUsers.filter((u) => within(u.last_sign_in_at, 30 * 86_400_000)).length,
    newUsers7d: allUsers.filter((u) => within(u.created_at, 7 * 86_400_000)).length,
    newUsers30d: allUsers.filter((u) => within(u.created_at, 30 * 86_400_000)).length,
    activeAiUsers: [...byUser.keys()].filter((k) => k !== "unattributed").length,
  };

  const activityRaw = await listRecentEvents(40);
  const activity: ActivityRow[] = activityRaw.map((e) => ({ at: e.at, event: e.eventType, user: e.userId ? emails.get(e.userId) ?? e.userId : "system", feature: e.feature }));

  const auditRaw = await listAudit(50);
  const audit: AuditEventRow[] = auditRaw.map((a) => ({
    at: a.occurred_at,
    actor: a.actor_id ? emails.get(a.actor_id) ?? a.actor_id : "system",
    action: a.action,
    target: [a.target_type, a.target_id].filter(Boolean).join(":") || "-",
    result: a.result ?? "ok",
    reason: a.reason,
  }));

  // Per-user feature breakdown (which user uses which feature + spend).
  const userFeatures: UserFeature[] = [...userTask.entries()].map(([uk, feats]) => {
    const features = [...feats.entries()].map(([feature, v]) => ({ feature, calls: v.calls, costUsd: round(v.costUsd) })).sort((a, b) => b.costUsd - a.costUsd);
    const total = features.reduce((s, f) => s + f.costUsd, 0);
    return { email: uk === "unattributed" ? "unattributed" : emails.get(uk) ?? uk, features, costUsd: round(total) };
  }).sort((a, b) => b.costUsd - a.costUsd);

  // Backend problems: recent captured errors (route + reason), for "what's breaking".
  let problems: ProblemRow[] = [];
  try {
    const { data: errs } = await admin.from("owner_events").select("created_at, user_id, feature, meta").eq("event_type", "error").order("created_at", { ascending: false }).limit(40);
    problems = ((errs ?? []) as { created_at: string; user_id: string | null; feature: string | null; meta: { message?: string } | null }[]).map((e) => ({
      at: e.created_at,
      feature: e.feature ?? "unknown",
      message: e.meta?.message ?? "",
      user: e.user_id ? emails.get(e.user_id) ?? e.user_id : "system",
    }));
  } catch {
    /* table may be empty */
  }

  // S6 RUM: real-user Core Web Vitals p75 over the window, per metric - so read-path speed at scale is a
  // measured number, not a guess. Bounded read; grouped + p75'd in JS (fine at this volume). Best-effort.
  const REPORT_METRICS = ["LCP", "INP", "TTFB", "FCP", "CLS"];
  let webVitals: WebVitalRow[] = REPORT_METRICS.map((metric) => ({ metric, p75: null, rating: null, samples: 0 }));
  try {
    const { data: vitalsData } = await admin
      .from("web_vitals")
      .select("metric,value")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50000);
    const byMetric = new Map<string, number[]>();
    for (const r of (vitalsData ?? []) as { metric: string; value: number }[]) {
      if (!byMetric.has(r.metric)) byMetric.set(r.metric, []);
      byMetric.get(r.metric)!.push(Number(r.value));
    }
    webVitals = REPORT_METRICS.map((metric) => {
      const vals = byMetric.get(metric) ?? [];
      const val = percentile75(vals);
      return { metric, p75: val === null ? null : round(val), rating: val !== null && isVitalName(metric) ? rateVital(metric, val) : null, samples: vals.length };
    });
  } catch {
    /* table may be absent pre-migration - leave the zero-sample rows */
  }

  // Website & blog analytics (first-party): pageviews, approximate unique visitors, and blog READS (real
  // engagement, not landings), over the window. Bounded read + JS aggregation (fine at current volume; move to
  // a SQL rollup if traffic grows). Best-effort - table may be absent pre-migration.
  let website: WebsiteAnalytics = { pageViews: 0, visitors: 0, blogReads: 0, topPages: [], topReferrers: [], topBlogs: [] };
  try {
    const { data: pv } = await admin
      .from("page_views")
      .select("path,ref_host,visitor_hash,event")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100000);
    const rows = (pv ?? []) as { path: string; ref_host: string | null; visitor_hash: string | null; event: string }[];
    const visitorSet = new Set<string>();
    const pageCount = new Map<string, number>();
    const refCount = new Map<string, number>();
    const blogReadCount = new Map<string, number>();
    let pageViews = 0;
    let blogReads = 0;
    for (const r of rows) {
      if (r.visitor_hash) visitorSet.add(r.visitor_hash);
      if (r.event === "view") {
        pageViews++;
        pageCount.set(r.path, (pageCount.get(r.path) ?? 0) + 1);
        const host = r.ref_host || "direct";
        refCount.set(host, (refCount.get(host) ?? 0) + 1);
      } else if (r.event === "read") {
        const slug = blogSlug(r.path);
        if (slug) {
          blogReads++;
          blogReadCount.set(slug, (blogReadCount.get(slug) ?? 0) + 1);
        }
      }
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    website = {
      pageViews,
      visitors: visitorSet.size,
      blogReads,
      topPages: top(pageCount).map(([path, views]) => ({ path, views })),
      topReferrers: top(refCount).map(([host, views]) => ({ host, views })),
      topBlogs: top(blogReadCount).map(([slug, reads]) => ({ slug, reads })),
    };
  } catch {
    /* table may be absent pre-migration - leave the zeroed analytics */
  }

  return {
    windowDays,
    totalCalls,
    totalCostUsd: round(totalCostUsd),
    totalTokens,
    users: [...byUser.values()].map((u) => ({ ...u, costUsd: round(u.costUsd) })).sort((a, b) => b.costUsd - a.costUsd),
    providers: [...byProvider.values()].map((p) => ({ ...p, costUsd: round(p.costUsd) })).sort((a, b) => b.costUsd - a.costUsd),
    tasks: [...byTask.values()].map((t) => ({ ...t, costUsd: round(t.costUsd) })).sort((a, b) => b.costUsd - a.costUsd),
    jobs,
    audit,
    connectors,
    overview,
    activity,
    models: [...byModel.values()].map((m) => ({ ...m, costUsd: round(m.costUsd) })).sort((a, b) => b.costUsd - a.costUsd),
    userFeatures,
    problems,
    webVitals,
    website,
  };
}
