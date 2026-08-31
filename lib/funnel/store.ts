import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapMetaObjective } from "@/lib/meta-source";
import { resolveUserContext } from "@/lib/tenancy/resolve";
import { diagnoseFunnel, type FunnelAd, type FunnelReport } from "@/lib/funnel/diagnosis";
import type { ExtendedMetricsRow } from "@/lib/metrics/funnel-metrics";

// Funnel diagnosis - READ PATH. Runs the deterministic engine over the stored ad_metrics for the user's
// active account (no live Meta pull, no AI). Objective is mapped to the internal union via mapMetaObjective;
// the ad-set optimization goal is not yet persisted, so the stage is classified from the objective for now
// (classifyStage carries the lower confidence + review flag when that happens).
const PAGE = 1000;
const DEFAULT_LOOKBACK_DAYS = 30;

type Db = {
  ad_id: string; date: string; objective: string | null; spend: number; impressions: number; clicks: number;
  outbound_clicks: number; video_3s: number; video_thruplays: number; landing_page_views: number;
  add_to_carts: number; initiate_checkouts: number; purchases: number;
};

function toExt(r: Db): ExtendedMetricsRow {
  return {
    date: r.date, spend: r.spend, impressions: r.impressions, clicks: r.clicks, outboundClicks: r.outbound_clicks,
    video3sViews: r.video_3s, videoThruplays: r.video_thruplays, landingPageViews: r.landing_page_views,
    addToCarts: r.add_to_carts, initiateCheckouts: r.initiate_checkouts, purchases: r.purchases,
  };
}

export type FunnelReportBundle = { report: FunnelReport; accountName: string; since: string; until: string; lookbackDays: number } | null;

export async function loadFunnelReport(userId: string, opts: { lookbackDays?: number } = {}): Promise<FunnelReportBundle> {
  const ctx = await resolveUserContext(userId);
  const active = ctx.accounts.find((a) => a.isActive) ?? ctx.accounts[0];
  if (!active) return null;
  const accountExternalId = active.externalId;

  const lookbackDays = opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString().slice(0, 10);
  const admin = createAdminClient();

  // Page ad_metrics past the 1000-row cap.
  const rows: Db[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("ad_metrics")
      .select("ad_id,date,objective,spend,impressions,clicks,outbound_clicks,video_3s,video_thruplays,landing_page_views,add_to_carts,initiate_checkouts,purchases")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .gte("date", since)
      .lte("date", until)
      .order("ad_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return null;
    const page = (data ?? []) as Db[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (!rows.length) return null;

  // Names from ad_meta (paged).
  const names = new Map<string, string>();
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("ad_meta")
      .select("ad_id,name")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .order("ad_id", { ascending: true })
      .range(from, from + PAGE - 1);
    const page = (data ?? []) as { ad_id: string; name: string | null }[];
    for (const m of page) if (m.name) names.set(m.ad_id, m.name);
    if (page.length < PAGE) break;
  }

  // Group day rows by ad -> FunnelAd[].
  const byAd = new Map<string, Db[]>();
  for (const r of rows) {
    const l = byAd.get(r.ad_id) ?? [];
    l.push(r);
    byAd.set(r.ad_id, l);
  }
  const ads: FunnelAd[] = [];
  for (const [adId, rs] of byAd) {
    const rawObjective = rs.find((r) => r.objective)?.objective ?? "";
    ads.push({
      adId,
      name: names.get(adId) ?? adId,
      objective: mapMetaObjective(rawObjective),
      optimizationGoal: null, // not persisted yet -> stage from objective (classifier flags this)
      rows: rs.map(toExt),
    });
  }

  const report = diagnoseFunnel(ads, {});
  return { report, accountName: active.name ?? accountExternalId, since, until, lookbackDays };
}
