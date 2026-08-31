import "server-only";
import { googleAdsSource, isGoogleAdsConfigured } from "@/lib/google-source";
import type { MetricsRow } from "@/lib/ad-source";
import { toCockpitInputs, type RealAd } from "@/lib/scoring";
import { analyzeAccount } from "@/lib/cockpit/analyze";
import { windowFunnel, type ExtendedMetricsRow } from "@/lib/metrics/funnel-metrics";
import { buildDailySeries, type DailyInputRow } from "@/lib/cockpit/daily-series";
import { marginalScaling } from "@/lib/scoring/marginal";
import { assessDataQuality } from "@/lib/scoring/data-quality";
import { VERDICT_WEIGHTS } from "@/lib/rules/verdict";
import type { CockpitData } from "@/lib/app/cockpit-data";

// Google cockpit (Phase 2). Runs the SAME vendor-independent brain (toCockpitInputs -> analyzeAccount +
// windowFunnel + buildDailySeries + marginalScaling + assessDataQuality) over Google Ads data, so the Cockpit
// screen renders Google exactly like Meta - no core changes. In DEMO mode (no developer token) the numbers
// come from the deterministic stub source, and the caller MUST badge the section as demo (never present stub
// data as real). When the real Google Ads client lands, this function is unchanged. Never throws.
const DEMO_ACCOUNT = "demo";

export async function buildGoogleCockpitData(userId: string, days: number): Promise<CockpitData> {
  void userId; // real path will resolve the user's connected Google account + token here
  const demo = !isGoogleAdsConfigured();
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const token = { accessToken: "demo" };

  try {
    const ads = await googleAdsSource.listAds(DEMO_ACCOUNT, token);
    const realAds: RealAd[] = [];
    for (const ad of ads) {
      const rows: MetricsRow[] = await googleAdsSource.fetchMetrics(ad.externalId, since, token);
      if (rows.length === 0) continue;
      realAds.push({
        externalId: ad.externalId,
        name: ad.name ?? ad.externalId,
        objective: "conversion", // Google search demo campaigns optimise for conversions
        rows,
        baselineRows: rows,
        endsInDays: null,
        adSetId: `${ad.externalId}_ag`, // ad group stands in for the ad set
        campaignId: `${DEMO_ACCOUNT}_camp`,
        active: ad.status === "ACTIVE",
        thumbUrl: null,
      });
    }

    const inputs = toCockpitInputs(realAds).filter((a) => (a.impressions ?? 0) > 0 && a.spendRs > 0 && a.active !== false);
    if (inputs.length === 0) {
      return { connected: false, days, reason: "no_data", accountName: demo ? "Google Ads (demo)" : "Google Ads" };
    }
    const view = analyzeAccount(inputs, "LIVE", VERDICT_WEIGHTS);

    const extRows: ExtendedMetricsRow[] = realAds.flatMap((ad) =>
      ad.rows.map((r) => ({
        date: r.date, spend: r.spend, impressions: r.impressions, clicks: r.clicks,
        outboundClicks: r.outboundClicks ?? 0, video3sViews: r.video3sViews ?? 0, videoThruplays: r.videoThruplays ?? 0,
        landingPageViews: r.landingPageViews ?? 0, addToCarts: r.addToCarts ?? 0, initiateCheckouts: r.initiateCheckouts ?? 0,
        purchases: r.purchases,
      })),
    );
    const funnel = windowFunnel(extRows);

    // Per-day aggregation for the trend chart + scaling + data quality.
    const byDay = new Map<string, DailyInputRow>();
    for (const ad of realAds)
      for (const r of ad.rows) {
        const d = byDay.get(r.date) ?? { date: r.date, spend: 0, impressions: 0, clicks: 0, outboundClicks: 0, video3sViews: 0, videoThruplays: 0, landingPageViews: 0, addToCarts: 0, initiateCheckouts: 0, purchases: 0, revenue: 0 };
        d.spend += r.spend; d.impressions += r.impressions; d.clicks += r.clicks;
        d.outboundClicks += r.outboundClicks ?? 0; d.landingPageViews += r.landingPageViews ?? 0;
        d.purchases += r.purchases; d.revenue += r.revenue;
        byDay.set(r.date, d);
      }
    const dayRows = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    const marginal = marginalScaling(dayRows);
    const dataQuality = assessDataQuality(dayRows);
    const dailySeries = buildDailySeries(dayRows);

    const sSpend = dayRows.reduce((a, d) => a + d.spend, 0);
    const sImpr = dayRows.reduce((a, d) => a + d.impressions, 0);
    const sClicks = dayRows.reduce((a, d) => a + d.clicks, 0);
    const sPur = dayRows.reduce((a, d) => a + d.purchases, 0);
    const sRev = dayRows.reduce((a, d) => a + d.revenue, 0);

    return {
      connected: true,
      view,
      metrics: { impressions: sImpr, clicks: sClicks, purchases: sPur, cpm: sImpr > 0 ? (sSpend / sImpr) * 1000 : null, ctrAll: sImpr > 0 ? (sClicks / sImpr) * 100 : null, cpcAll: sClicks > 0 ? sSpend / sClicks : null, cpa: sPur > 0 ? sSpend / sPur : null },
      scopeTotals: { spendRs: Math.round(sSpend), revenueRs: Math.round(sRev), roas: sSpend > 0 ? sRev / sSpend : null },
      funnel,
      marginal,
      dataQuality,
      ownDiversity: null,
      dailySeries,
      accountName: demo ? "Google Ads (demo)" : "Google Ads",
      accountId: DEMO_ACCOUNT,
      dateParam: `${since}_${until}`,
      adsAnalyzed: inputs.length,
      processed: { campaigns: 1, adSets: new Set(realAds.map((a) => a.adSetId)).size, ads: inputs.length },
      days,
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return { connected: false, days, reason: "error", accountName: demo ? "Google Ads (demo)" : "Google Ads" };
  }
}
