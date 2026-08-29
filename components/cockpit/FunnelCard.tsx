import type { FunnelMetrics } from "@/lib/metrics/funnel-metrics";
import type { DailyPoint } from "@/lib/cockpit/daily-series";
import type { LevelFunnels } from "@/lib/cockpit/level-funnel";
import { FunnelCardBody } from "@/components/cockpit/FunnelCardBody";

// Ad-level funnel metrics a 1% D2C media buyer watches, computed from the real day-wise rows
// (lib/metrics/funnel-metrics). The interactive body (Ad / Ad set / Campaign selector + per-metric
// day-wise sparklines) lives in FunnelCardBody (client). This wrapper is the server card shell.

export function FunnelCard({ funnel, dailySeries = [], funnelLevels }: { funnel: FunnelMetrics; dailySeries?: DailyPoint[]; funnelLevels?: LevelFunnels }) {
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <FunnelCardBody funnel={funnel} dailySeries={dailySeries} funnelLevels={funnelLevels} />
    </div>
  );
}
