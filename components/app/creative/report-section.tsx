import { ConnectState } from "@/components/app/connect-state";
import type { CockpitData } from "@/lib/app/cockpit-data";
import { buildCreativeReport } from "@/lib/creative/creative-report";
import { CreativeReportCard } from "@/components/app/creative/creative-report-card";

// Assembles the creative health report from numbers the cockpit already computed (no new data, no AI) and
// hands it to the client card to render + download. Not connected -> the shared Connect state.
export function ReportSection({ data, deepReadCount = 0 }: { data: CockpitData; deepReadCount?: number }) {
  if (!data.connected) {
    return <ConnectState reason={data.reason} errorNote={data.errorNote} accountName={data.accountName} days={data.days} />;
  }
  const v = data.view;
  const lb = v.leaderboard;
  const report = buildCreativeReport({
    accountName: data.accountName,
    days: data.days,
    healthScore: v.accountHealth?.score ?? null,
    adsAssessed: lb.length,
    fatiguing: lb.filter((a) => a.verdict === "refresh" || a.verdict === "loser").length,
    winners: lb.filter((a) => a.verdict === "winner").length,
    top1SharePct: v.concentration?.status === "ok" ? Math.round(v.concentration.top1Share * 100) : null,
    dominantFormat: data.ownDiversity?.dimensions.find((d) => d.dimension === "format")?.buckets[0]?.name ?? null,
    wasteRs: v.waste?.status === "ok" ? v.waste.totalWastedRs : null,
    opportunityLossRs: v.opportunity?.totalLossRs ?? null,
    deepReadCount,
  });
  return <CreativeReportCard report={report} />;
}
