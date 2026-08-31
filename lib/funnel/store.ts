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

// Read every ad_metrics row for the account in-window, grouped by ad. Returns { ads:[], ... } when the store
// is empty (brand not synced yet) so the caller returns null and the page shows a "syncing" state.
async function readStore(userId: string, accountExternalId: string, since: string, until: string): Promise<{ ads: FunnelAd[]; adsetByAd: Map<string, string> }> {
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
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin.from("ad_meta").select("ad_id,name").eq("user_id", userId).eq("account_external_id", accountExternalId).order("ad_id", { ascending: true }).range(from, from + PAGE - 1);
    const page = (data ?? []) as { ad_id: string; name: string | null }[];
    for (const m of page) if (m.name) names.set(m.ad_id, m.name);
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
  const ads: FunnelAd[] = [];
  for (const [adId, rs] of byAd) {
    ads.push({
      adId,
      name: names.get(adId) ?? adId,
      objective: mapMetaObjective(rs.find((r) => r.objective)?.objective ?? ""),
      optimizationGoal: null,
      adSetId: adsetByAd.get(adId) ?? null,
      campaignId: rs.find((r) => r.campaign_id)?.campaign_id ?? null,
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

export async function loadFunnelReport(userId: string, opts: { lookbackDays?: number } = {}): Promise<FunnelReportBundle> {
  const session = await getUserMetaSession(userId);
  if (!session) return null; // no connected Meta account -> nothing to diagnose (page shows a connect prompt)
  const accountExternalId = session.activeExternalId;
  const accountName = session.activeAccountName ?? accountExternalId;

  const lookbackDays = opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString().slice(0, 10);

  const { ads: storeAds, adsetByAd } = await readStore(userId, accountExternalId, since, until);
  if (!storeAds.length) return null; // brand not synced yet -> page shows "syncing" state (no request-path live pull)

  const ads = await applyGoals(storeAds, adsetByAd, session);
  return { report: diagnoseFunnel(ads, {}), accountName, accountId: accountExternalId, since, until, lookbackDays, source: "store" };
}
