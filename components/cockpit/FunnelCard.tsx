import type { FunnelMetrics } from "@/lib/metrics/funnel-metrics";
import type { DailyKpiKey, DailyPoint } from "@/lib/cockpit/daily-series";
import { Sparkline } from "@/components/app/analytics/sparkline";
import { rupees } from "@/lib/format";

// Ad-level funnel metrics a 1% D2C media buyer watches, computed from the real day-wise rows
// (lib/metrics/funnel-metrics). Every ratio is null when its denominator is 0 (no video, no
// add-to-cart, etc.); we show "n/a" then, never a fabricated number. Each tile also carries a small
// day-wise sparkline (from the same real dailySeries) so the trend reads at a glance, not just the total.

function pctText(v: number | null): string {
  return v === null ? "n/a" : `${v.toFixed(2)}%`;
}
function rsText(v: number | null): string {
  return v === null ? "n/a" : rupees.format(v);
}

export function FunnelCard({ funnel, dailySeries = [] }: { funnel: FunnelMetrics; dailySeries?: DailyPoint[] }) {
  const stats: { label: string; value: string; hint: string; kpi: DailyKpiKey }[] = [
    { label: "Thumb-stop", value: pctText(funnel.thumbStopRate), hint: "3s video views / impressions", kpi: "thumbStop" },
    { label: "Hold rate", value: pctText(funnel.holdRate), hint: "thruplays / 3s views", kpi: "holdRate" },
    { label: "CTR", value: pctText(funnel.ctr), hint: "clicks / impressions", kpi: "ctr" },
    { label: "CPM", value: rsText(funnel.cpm), hint: "cost / 1000 impressions", kpi: "cpm" },
    { label: "CPC", value: rsText(funnel.cpc), hint: "cost / click", kpi: "cpc" },
    { label: "LP view rate", value: pctText(funnel.lpViewRate), hint: "landing-page views / outbound clicks", kpi: "lpViewRate" },
    { label: "Add-to-cart", value: pctText(funnel.atcRate), hint: "ATC / landing-page views", kpi: "atcRate" },
    { label: "Checkout", value: pctText(funnel.checkoutRate), hint: "initiate checkout / ATC", kpi: "checkoutRate" },
  ];

  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-base font-normal">Funnel metrics</div>
        <span className="shrink-0 rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">
          Ad-level, this window
        </span>
      </div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
        Real thumb-stop, hold, and click-to-checkout ratios. &quot;n/a&quot; means the account did not report that step.
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{s.label}</div>
            <div className="mt-1 text-[22px] font-semibold tabular-nums">{s.value}</div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">{s.hint}</div>
            {dailySeries.length > 0 && (
              <div className="mt-2">
                <Sparkline values={dailySeries.map((p) => p[s.kpi] as number | null)} height={24} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
