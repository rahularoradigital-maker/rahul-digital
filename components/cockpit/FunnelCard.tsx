import type { FunnelMetrics } from "@/lib/metrics/funnel-metrics";
import type { DailyPoint } from "@/lib/cockpit/daily-series";
import type { LevelFunnels } from "@/lib/cockpit/level-funnel";
import { FunnelCardBody } from "@/components/cockpit/FunnelCardBody";
import { KPI_CATALOG } from "@/lib/app/kpi-catalog";

// Ad-level funnel metrics a 1% D2C media buyer watches, computed from the real day-wise rows
// (lib/metrics/funnel-metrics). The interactive body (Ad / Ad set / Campaign selector + per-metric
// day-wise sparklines) lives in FunnelCardBody (client). This wrapper is the server card shell.

// Perf (Phase-0 audit): the body only ever needed this static list, but it imported the whole 70 KB
// KPI catalog to derive it - shipping the catalog to the browser on EVERY /app load. Derived here, on the
// server, once per process, and passed down as a few dozen {name, source} pairs.
const NON_META_KPIS = (() => {
  const seen = new Set<string>();
  return KPI_CATALOG.filter((k) => !k.platform.toLowerCase().includes("meta"))
    .filter((k) => (seen.has(k.name) ? false : (seen.add(k.name), true)))
    .map((k) => ({ name: k.name, source: k.platform }));
})();

export function FunnelCard({ funnel, dailySeries = [], funnelLevels }: { funnel: FunnelMetrics; dailySeries?: DailyPoint[]; funnelLevels?: LevelFunnels }) {
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <FunnelCardBody funnel={funnel} dailySeries={dailySeries} funnelLevels={funnelLevels} nonMetaKpis={NON_META_KPIS} />
    </div>
  );
}
