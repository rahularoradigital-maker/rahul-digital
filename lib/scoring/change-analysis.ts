import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { measureChangeImpact, isolatedWindow, type ImpactRow, type Objective } from "./change-impact.ts";
import { rankBuyers, rollupChangeTypes, type ChangeResult } from "./change-ranking.ts";

// Orchestrator (Media-Buyer Change Intelligence, Phase 4). Joins ad_changes -> ad_metrics, measures each
// change's before/after impact (change-impact.ts), and rolls up per media-buyer + per change-type
// (change-ranking.ts). Server-only (admin reads). It only judges changes OLD ENOUGH to have a full
// after-window; changes on an object with no metrics (or account-level) are skipped, never guessed.

const BEFORE_DAYS = 7;
const AFTER_DAYS = 7;
const MIN_AGE_DAYS = AFTER_DAYS; // a change needs a complete after-window before we can judge it
const METRICS_LOOKBACK_DAYS = 120; // enough to cover before-windows of the oldest judged change
const PAGE = 1000;

type MetricRow = { ad_id: string; adset_id: string | null; campaign_id: string | null; date: string; objective: string | null; spend: number; impressions: number; clicks: number; purchases: number; revenue: number };
type ChangeRowDB = { event_time: string; date: string; level: string; object_id: string | null; change_type: string; source: "buyer" | "algo"; actor_id: string | null; actor_name: string | null };

const isoDaysAgo = (now: number, n: number) => new Date(now - n * 86_400_000).toISOString().slice(0, 10);
const dayMs = (d: string) => new Date(`${d}T00:00:00Z`).getTime();

// Map Meta objective strings onto the impact engine's objective vocabulary.
function toObjective(o: string | null): Objective {
  const v = (o ?? "").toLowerCase();
  if (["conversion", "traffic", "engagement", "awareness", "leads", "app_installs"].includes(v)) return v as Objective;
  if (v.includes("conversion") || v.includes("sales") || v.includes("purchase") || v.includes("outcome_sales")) return "conversion";
  if (v.includes("traffic") || v.includes("link_click")) return "traffic";
  if (v.includes("aware") || v.includes("reach")) return "awareness";
  if (v.includes("lead")) return "leads";
  if (v.includes("install") || v.includes("app_")) return "app_installs";
  return "engagement";
}

function toImpactRows(rows: MetricRow[]): ImpactRow[] {
  return rows.map((m) => ({ date: m.date, spend: m.spend || 0, impressions: m.impressions || 0, clicks: m.clicks || 0, conversions: m.purchases || 0, revenue: m.revenue || 0 }));
}

function modalObjective(rows: MetricRow[]): string | null {
  const counts = new Map<string, number>();
  for (const m of rows) if (m.objective) counts.set(m.objective, (counts.get(m.objective) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [o, n] of counts) if (n > bestN) ((best = o), (bestN = n));
  return best;
}

export type ChangeAnalysis = { results: ChangeResult[]; buyers: ReturnType<typeof rankBuyers>; changeTypes: ReturnType<typeof rollupChangeTypes>; judged: number; skipped: number };

// Data-cache tag for one account's analysis (the /app/changes page caches under it; the change-history
// ingest busts it on every successful hop, so a fresh sync is visible on the next request).
export const changeAnalysisTag = (userId: string, accountExternalId: string) => `change-analysis:${userId}:${accountExternalId}`;

export async function analyzeAccountChanges(userId: string, accountExternalId: string, opts: { now?: number } = {}): Promise<ChangeAnalysis> {
  const admin = createAdminClient();
  const now = opts.now ?? Date.now();
  const judgeCutoff = isoDaysAgo(now, MIN_AGE_DAYS); // changes on/before this are old enough to judge
  const metricsSince = isoDaysAgo(now, METRICS_LOOKBACK_DAYS);

  // 1. Changes old enough to have a settled after-window (cap to a sane batch).
  const { data: changesData } = await admin
    .from("ad_changes")
    .select("event_time,date,level,object_id,change_type,source,actor_id,actor_name")
    .eq("user_id", userId)
    .eq("account_external_id", accountExternalId)
    .lte("date", judgeCutoff)
    .order("date", { ascending: false })
    .limit(1000);
  const changes = (changesData ?? []) as ChangeRowDB[];

  // 2. Account metrics over the lookback window, paged past the 1000-row cap, indexed by object at each level.
  const byAd = new Map<string, MetricRow[]>();
  const byAdset = new Map<string, MetricRow[]>();
  const byCampaign = new Map<string, MetricRow[]>();
  const push = (m: Map<string, MetricRow[]>, k: string | null, row: MetricRow) => {
    if (!k) return;
    const a = m.get(k);
    if (a) a.push(row);
    else m.set(k, [row]);
  };
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("ad_metrics")
      .select("ad_id,adset_id,campaign_id,date,objective,spend,impressions,clicks,purchases,revenue")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .gte("date", metricsSince)
      // P0 correctness: OFFSET/LIMIT paging without a deterministic ORDER BY has no stability guarantee in
      // Postgres - across a 120-day multi-page scan rows can be duplicated or dropped, silently corrupting
      // the before/after windows the whole Change-Impact read is built on. Every other paged reader in the
      // codebase orders first (from-store.ts, funnel/store.ts); this one did not.
      .order("ad_id", { ascending: true })
      .order("date", { ascending: true })
      .range(from, from + PAGE - 1);
    const rows = (data ?? []) as MetricRow[];
    for (const m of rows) {
      push(byAd, m.ad_id, m);
      push(byAdset, m.adset_id, m);
      push(byCampaign, m.campaign_id, m);
    }
    if (rows.length < PAGE) break;
  }

  // 2b. Index every change's day per object, so a change's window can be clipped at its neighbours (a later
  // change on the same object must not bleed into this change's after-window). Keyed by "level:object_id".
  const changeDaysByObject = new Map<string, number[]>();
  for (const c of changes) {
    if (!c.object_id) continue;
    const key = `${c.level}:${c.object_id}`;
    const arr = changeDaysByObject.get(key);
    if (arr) arr.push(dayMs(c.date));
    else changeDaysByObject.set(key, [dayMs(c.date)]);
  }

  // 3. Measure each judgeable change.
  const results: ChangeResult[] = [];
  let judged = 0;
  let skipped = 0;
  for (const c of changes) {
    const oid = c.object_id;
    const pool = !oid ? null : c.level === "ad" ? byAd.get(oid) : c.level === "adset" ? byAdset.get(oid) : c.level === "campaign" ? byCampaign.get(oid) : null;
    if (!pool || pool.length === 0) {
      skipped++;
      continue; // account-level, or an object we have no metrics for -> cannot measure, never guess
    }
    const cd = dayMs(c.date);
    // Clip the windows at the nearest OTHER change on this same object so the verdict isolates THIS change.
    const others = (changeDaysByObject.get(`${c.level}:${oid}`) ?? []).filter((t) => t !== cd);
    const { beforeStart, afterEnd } = isolatedWindow(cd, others, BEFORE_DAYS, AFTER_DAYS);
    const beforeRows = toImpactRows(pool.filter((m) => { const t = dayMs(m.date); return t < cd && t >= beforeStart; }));
    const afterRows = toImpactRows(pool.filter((m) => { const t = dayMs(m.date); return t > cd && t <= afterEnd; }));
    const impact = measureChangeImpact({ objective: toObjective(modalObjective(pool)), beforeRows, afterRows });
    results.push({ actorId: c.actor_id, actorName: c.actor_name, changeType: c.change_type, source: c.source, impact });
    judged++;
  }

  return { results, buyers: rankBuyers(results), changeTypes: rollupChangeTypes(results), judged, skipped };
}
