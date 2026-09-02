import { notFound } from "next/navigation";
import { analyzeAccount, type CockpitAdInput } from "@/lib/cockpit/analyze";
import { SAMPLE_ADS } from "@/lib/sample/account";
import { ActionList } from "@/components/cockpit/ActionList";
import { Leaderboard } from "@/components/cockpit/Leaderboard";
import { FunnelCard } from "@/components/cockpit/FunnelCard";
import { EventRoiCard } from "@/components/cockpit/EventRoiCard";
import { computeEventRoi } from "@/lib/scoring/event-roi";
import { levelFunnels } from "@/lib/cockpit/level-funnel";
import { buildDailySeries } from "@/lib/cockpit/daily-series";
import { windowFunnel } from "@/lib/metrics/funnel-metrics";
import { rupees } from "@/lib/format";

// DEV-ONLY visual preview of the cockpit components with sample data (no auth needed), so the
// redesign, the per-verdict "why" lines, and the "Show more" collapse can be eyeballed without
// logging into the real /app. Returns 404 in production so it is never shipped to users.
// Synthetic ad-set / campaign data (dev-only) so the Funnel card's Ad set / Campaign drill-in + metric picker
// can be eyeballed without a connected Meta account. Two ad sets in one campaign, one that stops mid-window.
const PREVIEW_DAYS = Array.from({ length: 21 }, (_, i) => `2026-08-${String(i + 8).padStart(2, "0")}`);
function mkRows(scale: number, stopAfter: number) {
  return PREVIEW_DAYS.map((date, i) => {
    const on = i <= stopAfter ? 1 : 0;
    return {
      date, spend: (900 * scale + i * 12) * on, impressions: 48000 * scale * on, clicks: 780 * scale * on,
      outboundClicks: 600 * scale * on, video3sViews: 29000 * scale * on, videoThruplays: 6100 * scale * on,
      landingPageViews: 520 * scale * on, addToCarts: 82 * scale * on, initiateCheckouts: 41 * scale * on,
      purchases: 21 * scale * on, revenue: 61000 * scale * on,
    };
  });
}
const PREVIEW_ADS = [
  { adSetId: "as1", adsetName: "Ad_006/1_ASC_ROAS_GOAL_7DC1V", campaignId: "c1", campaignName: "Lyxel_006_Conversion_ASC", rows: mkRows(1.2, 20) },
  { adSetId: "as1", adsetName: "Ad_006/1_ASC_ROAS_GOAL_7DC1V", campaignId: "c1", campaignName: "Lyxel_006_Conversion_ASC", rows: mkRows(0.9, 20) },
  { adSetId: "as2", adsetName: "Ad_007/1_ASC_BID_CAP_772", campaignId: "c1", campaignName: "Lyxel_006_Conversion_ASC", rows: mkRows(0.7, 10) },
  { adSetId: "as3", adsetName: "Ad_022/1_ASC_Sale_TOF", campaignId: "c2", campaignName: "Lyxel_022_Sale_ASC_TOF", rows: mkRows(1.5, 20) },
];
const PREVIEW_FUNNEL = {
  funnel: windowFunnel(PREVIEW_ADS.flatMap((a) => a.rows)),
  series: buildDailySeries(PREVIEW_ADS.flatMap((a) => a.rows)),
  levels: levelFunnels(PREVIEW_ADS, 8, {
    adset: new Map([
      ["as1", { reach: 240000, frequency: 2.1, budgetRs: 5000, budgetType: "daily" as const }],
      ["as2", { reach: 90000, frequency: 3.8, budgetRs: 2000, budgetType: "daily" as const }],
      ["as3", { reach: 310000, frequency: 1.6, budgetRs: 8000, budgetType: "daily" as const }],
    ]),
    campaign: new Map([
      ["c1", { reach: 400000, frequency: 2.4, budgetRs: 15000, budgetType: "daily" as const }],
      ["c2", { reach: 310000, frequency: 1.6, budgetRs: 8000, budgetType: "daily" as const }],
    ]),
  }),
};

export default function PreviewCockpit() {
  if (process.env.NODE_ENV === "production") notFound();

  // Pad the 5-ad sample to 14 (distinct ids) so the long-list collapse actually triggers and the
  // "wall of identical rows" this addresses is reproduced.
  const padded: CockpitAdInput[] = Array.from({ length: 14 }, (_, i) => {
    const base = SAMPLE_ADS[i % SAMPLE_ADS.length];
    return { ...base, id: `${base.id}_${i}`, name: `${base.name} ${i + 1}` };
  });
  const view = analyzeAccount(padded, "SAMPLE");
  const date = "2026-08-14_2026-08-28";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <div className="text-[13px] text-[var(--ink-muted)]">Dev preview · sample data</div>
        <h1 className="mt-1 text-[26px] font-normal tracking-tight">Cockpit components</h1>
      </div>
      <ActionList items={view.doThis} ads={view.leaderboard} accountId="act_0" dateParam={date} />
      <FunnelCard funnel={PREVIEW_FUNNEL.funnel} dailySeries={PREVIEW_FUNNEL.series} funnelLevels={PREVIEW_FUNNEL.levels} />
      <Leaderboard ads={view.leaderboard} rupees={rupees} accountId="act_0" dateParam={date} />
      <EventRoiCard rows={computeEventRoi([{ event: "Purchase", spendRs: 830062, revenueRs: 3629118, purchases: 2100 }, { event: "Add to Cart", spendRs: 120000, revenueRs: 0, purchases: 0 }, { event: "Landing Page Views", spendRs: 400, revenueRs: 0, purchases: 0 }])} />
    </div>
  );
}
