import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { measureWithCascade, type CascadeLevel, type ImpactRow, type Objective, type Grain } from "./change-impact.ts";
import { rankBuyers, rollupChangeTypes, type ChangeResult } from "./change-ranking.ts";

// Orchestrator (Media-Buyer Change Intelligence, Phase 4). Joins ad_changes -> ad_metrics, measures each
// change's before/after impact (change-impact.ts), and rolls up per media-buyer + per change-type
// (change-ranking.ts). Server-only (admin reads). It only judges changes OLD ENOUGH to have a full
// after-window; changes on an object with no metrics (or account-level) are skipped, never guessed.

// Windows the cascade tries, shortest first (Media-Buyer coverage): most ad-level windows are too thin to
// clear the volume floor, so we also try the 10- and 14-day windows Rahul asked for - the SHORTEST that
// clears wins, so a verdict is always as tight as the data honestly allows.
const WINDOWS = [7, 10, 14];
const MIN_AGE_DAYS = WINDOWS[0]; // a change needs a complete (shortest) after-window before we can judge it
const METRICS_LOOKBACK_DAYS = 120; // enough to cover before-windows of the oldest judged change

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
  let metricRows: MetricRow[] = [];
  try {
    // Parallel-burst paging (was serial). P0 correctness: OFFSET/LIMIT paging without a TOTAL order has no
    // stability guarantee in Postgres - across a 120-day multi-page scan rows can be duplicated or dropped,
    // silently corrupting the before/after windows the whole Change-Impact read is built on; ad_id + date
    // is total for ad_metrics.
    metricRows = await readAllPages<MetricRow>((from, to) =>
      admin
        .from("ad_metrics")
        .select("ad_id,adset_id,campaign_id,date,objective,spend,impressions,clicks,purchases,revenue")
        .eq("user_id", userId)
        .eq("account_external_id", accountExternalId)
        .gte("date", metricsSince)
        .order("ad_id", { ascending: true })
        .order("date", { ascending: true })
        .range(from, to),
    );
  } catch {
    // was: errors ignored, treated as an empty page
  }
  // Parent maps so an ad-level change can cascade to its ad-set / campaign when its own window is too thin.
  const adToAdset = new Map<string, string>();
  const adToCampaign = new Map<string, string>();
  const adsetToCampaign = new Map<string, string>();
  for (const m of metricRows) {
    push(byAd, m.ad_id, m);
    push(byAdset, m.adset_id, m);
    push(byCampaign, m.campaign_id, m);
    if (m.adset_id && !adToAdset.has(m.ad_id)) adToAdset.set(m.ad_id, m.adset_id);
    if (m.campaign_id && !adToCampaign.has(m.ad_id)) adToCampaign.set(m.ad_id, m.campaign_id);
    if (m.adset_id && m.campaign_id && !adsetToCampaign.has(m.adset_id)) adsetToCampaign.set(m.adset_id, m.campaign_id);
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

  // Build the finest -> coarsest grain chain for a change, resolving parents so a thin ad-level window can
  // fall back to its ad-set / campaign (which aggregate enough volume to clear the floor).
  const cd = (c: ChangeRowDB) => dayMs(c.date);
  function levelsFor(c: ChangeRowDB): CascadeLevel[] {
    const oid = c.object_id;
    if (!oid) return [];
    const chain: { grain: Grain; id: string; pool: Map<string, MetricRow[]> }[] = [];
    if (c.level === "ad") {
      chain.push({ grain: "ad", id: oid, pool: byAd });
      const as = adToAdset.get(oid);
      if (as) chain.push({ grain: "adset", id: as, pool: byAdset });
      const cp = adToCampaign.get(oid);
      if (cp) chain.push({ grain: "campaign", id: cp, pool: byCampaign });
    } else if (c.level === "adset") {
      chain.push({ grain: "adset", id: oid, pool: byAdset });
      const cp = adsetToCampaign.get(oid);
      if (cp) chain.push({ grain: "campaign", id: cp, pool: byCampaign });
    } else if (c.level === "campaign") {
      chain.push({ grain: "campaign", id: oid, pool: byCampaign });
    }
    const changeDayMs = cd(c);
    const out: CascadeLevel[] = [];
    for (const { grain, id, pool } of chain) {
      const rows = pool.get(id);
      if (!rows || rows.length === 0) continue;
      // Isolate against OTHER changes at the SAME grain on this object (a coarser grain's sub-level changes
      // are the activity we are aggregating over, not confounders to clip on - clipping on them would
      // re-collapse the very window the cascade widened).
      const others = (changeDaysByObject.get(`${grain}:${id}`) ?? []).filter((t) => t !== changeDayMs);
      out.push({ grain, objectId: id, objective: toObjective(modalObjective(rows)), rows: toImpactRows(rows), changeDayMs, otherChangeDaysMs: others });
    }
    return out;
  }

  // 3. Measure each judgeable change via the coverage cascade (finest grain + shortest window that clears).
  const results: ChangeResult[] = [];
  let judged = 0;
  let skipped = 0;
  for (const c of changes) {
    const levels = levelsFor(c);
    if (levels.length === 0) {
      skipped++;
      continue; // account-level, or an object we have no metrics for at any grain -> cannot measure, never guess
    }
    const impact = measureWithCascade(levels, WINDOWS);
    // Outcome signature: which object+window the verdict was actually measured on. Two changes that resolve to
    // the SAME grain/object/day/window share ONE outcome - the rollups dedupe on this so a buyer isn't credited
    // N times for a single campaign/ad-set move they touched N times (activity inflation).
    const chosen = levels.find((l) => l.grain === impact.grain);
    const outcomeKey = chosen ? `${impact.grain}:${chosen.objectId}:${c.date}:${impact.windowDays ?? ""}` : undefined;
    results.push({ actorId: c.actor_id, actorName: c.actor_name, changeType: c.change_type, source: c.source, impact, outcomeKey });
    judged++;
  }

  return { results, buyers: rankBuyers(results), changeTypes: rollupChangeTypes(results), judged, skipped };
}
