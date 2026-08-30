import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAudit } from "@/lib/security/audit-log";

// Data for the admin cost/ops console: per-user + per-provider + per-task AI spend (from ai_usage), and the
// background-job health (ad + change sync state). Reads via the service-role admin client. Aggregation is in
// JS over a bounded window - fine at current volume; move to a SQL rollup/materialized view at scale.

const round = (n: number) => Math.round(n * 1e4) / 1e4;

export type UserSpend = { userId: string | null; email: string; calls: number; promptTokens: number; completionTokens: number; costUsd: number };
export type Bucket = { key: string; calls: number; costUsd: number };
export type JobRow = { account: string; userEmail: string; lastOk: boolean | null; lastError: string | null; lastRunAt: string | null; detail: string };
export type ConnectorStatus = { name: string; configured: boolean; status: "ok" | "not_configured" | "attention"; detail: string };
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
  try {
    const { data } = await admin.auth.admin.listUsers();
    for (const u of data.users) if (u.email) emails.set(u.id, u.email);
  } catch {
    /* best-effort: fall back to showing the id */
  }

  const byUser = new Map<string, UserSpend>();
  const byProvider = new Map<string, Bucket>();
  const byTask = new Map<string, Bucket>();
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

  const auditRaw = await listAudit(50);
  const audit: AuditEventRow[] = auditRaw.map((a) => ({
    at: a.occurred_at,
    actor: a.actor_id ? emails.get(a.actor_id) ?? a.actor_id : "system",
    action: a.action,
    target: [a.target_type, a.target_id].filter(Boolean).join(":") || "-",
    result: a.result ?? "ok",
    reason: a.reason,
  }));

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
  };
}
