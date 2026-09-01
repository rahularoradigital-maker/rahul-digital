import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapMetaObjective, listAdSetOptimizationGoals } from "@/lib/meta-source";
import { getUserMetaSession } from "@/lib/meta-sync";
import { diagnoseFunnel, type FunnelAd, type FunnelReport } from "@/lib/funnel/diagnosis";
import type { ExtendedMetricsRow } from "@/lib/metrics/funnel-metrics";

// Funnel diagnosis - READ PATH. Reads the STORE (ad_metrics) only. The store is filled in the background by
// the nightly sync (which now covers EVERY connected brand, not just the active one), so a page load never
// blocks on a large live Meta pull - it reads the already-ingested, account-attribution-correct rows and
// returns null when a brand has not synced yet (the page then shows a "syncing" state). This is the
// deliberate 2021-style shape: background jobs fill the store, requests read the store. The account is
// resolved via getUserMetaSession (same resolver the cockpit uses, so Funnel always matches the topbar
// brand). Objective -> internal union via mapMetaObjective; ad-set optimization goal fetched for staging.
const PAGE = 1000;
const DEFAULT_LOOKBACK_DAYS = 30;

type Db = {
  ad_id: string; date: string; objective: string | null; adset_id: string | null; campaign_id: string | null; spend: number; impressions: number; clicks: number;
  outbound_clicks: number; video_3s: number; video_thruplays: number; landing_page_views: number;
  add_to_carts: number; initiate_checkouts: number; purchases: number;
};

function dbToExt(r: Db): ExtendedMetricsRow {
  return {
    date: r.date, spend: r.spend, impressions: r.impressions, clicks: r.clicks, outboundClicks: r.outbound_clicks,
    video3sViews: r.video_3s, videoThruplays: r.video_thruplays, landingPageViews: r.landing_page_views,
    addToCarts: r.add_to_carts, initiateCheckouts: r.initiate_checkouts, purchases: r.purchases,
  };
}

export type FunnelReportBundle = { report: FunnelReport; accountName: string; accountId: string; since: string; until: string; lookbackDays: number; source: "store" } | null;

type Session = NonNullable<Awaited<ReturnType<typeof getUserMetaSession>>>;

type FunnelFilters = { catalog?: "include" | "exclude"; objectives?: string[]; campaignIds?: string[]; events?: string[] };

// Read every ad_metrics row for the account in-window, grouped by ad, applying the topbar filters (Catalog /
// Objective / Campaign) exactly like the Cockpit does. Returns { ads:[], ... } when nothing matches / the
// store is empty (brand not synced yet) so the caller returns null and the page shows a "syncing" state.
async function readStore(userId: string, accountExternalId: string, since: string, until: string, filters: FunnelFilters = {}): Promise<{ ads: FunnelAd[]; adsetByAd: Map<string, string> }> {
  const admin = createAdminClient();
  const rows: Db[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("ad_metrics")
      .select("ad_id,date,objective,adset_id,campaign_id,spend,impressions,clicks,outbound_clicks,video_3s,video_thruplays,landing_page_views,add_to_carts,initiate_checkouts,purchases")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .gte("date", since)
      .lte("date", until)
      .order("ad_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { ads: [], adsetByAd: new Map() };
    const page = (data ?? []) as Db[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (!rows.length) return { ads: [], adsetByAd: new Map() };

  const names = new Map<string, string>();
  const catalogById = new Map<string, boolean>();
  const eventById = new Map<string, string | null>(); // optimization-event filter (topbar, global)
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin.from("ad_meta").select("ad_id,name,is_catalog,optimization_event").eq("user_id", userId).eq("account_external_id", accountExternalId).order("ad_id", { ascending: true }).range(from, from + PAGE - 1);
    const page = (data ?? []) as { ad_id: string; name: string | null; is_catalog: boolean | null; optimization_event: string | null }[];
    for (const m of page) {
      if (m.name) names.set(m.ad_id, m.name);
      catalogById.set(m.ad_id, !!m.is_catalog);
      eventById.set(m.ad_id, m.optimization_event);
    }
    if (page.length < PAGE) break;
  }

  const byAd = new Map<string, Db[]>();
  const adsetByAd = new Map<string, string>();
  for (const r of rows) {
    const l = byAd.get(r.ad_id) ?? [];
    l.push(r);
    byAd.set(r.ad_id, l);
    if (r.adset_id && !adsetByAd.has(r.ad_id)) adsetByAd.set(r.ad_id, r.adset_id);
  }

  // Topbar filters (applied off the store's own fields, no extra Meta call), matching the Cockpit.
  const excludeCatalog = filters.catalog === "exclude";
  const objSet = filters.objectives && filters.objectives.length ? new Set(filters.objectives) : null;
  const campSet = filters.campaignIds && filters.campaignIds.length ? new Set(filters.campaignIds) : null;
  const evSet = filters.events && filters.events.length ? new Set(filters.events) : null;

  const ads: FunnelAd[] = [];
  for (const [adId, rs] of byAd) {
    if (excludeCatalog && catalogById.get(adId)) continue; // "Catalog: Excluded" hides dynamic catalog ads
    if (evSet) { const ev = eventById.get(adId); if (ev == null || !evSet.has(ev)) continue; } // optimization-event scope
    const objective = mapMetaObjective(rs.find((r) => r.objective)?.objective ?? "");
    if (objSet && !objSet.has(objective)) continue;
    const campaignId = rs.find((r) => r.campaign_id)?.campaign_id ?? null;
    if (campSet && (!campaignId || !campSet.has(campaignId))) continue;
    ads.push({
      adId,
      name: names.get(adId) ?? adId,
      objective,
      optimizationGoal: null,
      adSetId: adsetByAd.get(adId) ?? null,
      campaignId,
      rows: rs.map(dbToExt),
    });
  }
  return { ads, adsetByAd };
}

// Fetch ad-set optimization goals once and stamp each ad's optimizationGoal (higher-confidence staging).
// Graceful: any failure -> goals stay null -> the classifier falls back to the campaign objective.
async function applyGoals(ads: FunnelAd[], adsetByAd: Map<string, string>, session: Session): Promise<FunnelAd[]> {
  const adsetIds = [...new Set([...adsetByAd.values()])];
  let goalByAdset = new Map<string, string>();
  try {
    if (adsetIds.length) goalByAdset = await listAdSetOptimizationGoals(session.activeExternalId, adsetIds, session.token);
  } catch {
    goalByAdset = new Map();
  }
  return ads.map((a) => {
    const adsetId = adsetByAd.get(a.adId);
    return adsetId ? { ...a, optimizationGoal: goalByAdset.get(adsetId) ?? null } : a;
  });
}

export async function loadFunnelReport(
  userId: string,
  opts: { lookbackDays?: number; explicitWindow?: { since: string; until: string } } & FunnelFilters = {},
): Promise<FunnelReportBundle> {
  const session = await getUserMetaSession(userId);
  if (!session) return null; // no connected Meta account -> nothing to diagnose (page shows a connect prompt)
  const accountExternalId = session.activeExternalId;
  const accountName = session.activeAccountName ?? accountExternalId;

  // Honor the topbar window (explicit range wins; else the N-day lookback).
  const until = opts.explicitWindow ? opts.explicitWindow.until : new Date().toISOString().slice(0, 10);
  const since = opts.explicitWindow ? opts.explicitWindow.since : new Date(Date.now() - (opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS) * 86_400_000).toISOString().slice(0, 10);
  const lookbackDays = Math.max(1, Math.round((Date.parse(until) - Date.parse(since)) / 86_400_000));

  const { ads: storeAds, adsetByAd } = await readStore(userId, accountExternalId, since, until, {
    catalog: opts.catalog,
    objectives: opts.objectives,
    campaignIds: opts.campaignIds,
  });
  if (!storeAds.length) return null; // brand not synced yet / nothing matches -> page shows "syncing" state

  const ads = await applyGoals(storeAds, adsetByAd, session);
  return { report: diagnoseFunnel(ads, {}), accountName, accountId: accountExternalId, since, until, lookbackDays, source: "store" };
}
