import type { FunnelMetrics } from "@/lib/metrics/funnel-metrics";

// Ad-level funnel metrics a 1% D2C media buyer watches, computed from the real day-wise rows
// (lib/metrics/funnel-metrics). Every ratio is null when its denominator is 0 (no video, no
// add-to-cart, etc.); we show "n/a" then, never a fabricated number.
const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function pctText(v: number | null): string {
  return v === null ? "n/a" : `${v.toFixed(2)}%`;
}
function rsText(v: number | null): string {
  return v === null ? "n/a" : rupees.format(v);
}

export function FunnelCard({ funnel }: { funnel: FunnelMetrics }) {
  const stats: { label: string; value: string; hint: string }[] = [
    { label: "Thumb-stop", value: pctText(funnel.thumbStopRate), hint: "3s video views / impressions" },
    { label: "Hold rate", value: pctText(funnel.holdRate), hint: "thruplays / 3s views" },
    { label: "CTR", value: pctText(funnel.ctr), hint: "clicks / impressions" },
    { label: "CPM", value: rsText(funnel.cpm), hint: "cost / 1000 impressions" },
    { label: "CPC", value: rsText(funnel.cpc), hint: "cost / click" },
    { label: "LP view rate", value: pctText(funnel.lpViewRate), hint: "landing-page views / outbound clicks" },
    { label: "Add-to-cart", value: pctText(funnel.atcRate), hint: "ATC / landing-page views" },
    { label: "Checkout", value: pctText(funnel.checkoutRate), hint: "initiate checkout / ATC" },
  ];

  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-base font-semibold">Funnel metrics</div>
        <span className="shrink-0 rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">
          Ad-level, this window
        </span>
      </div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
        Real thumb-stop, hold, and click-to-checkout ratios. &quot;n/a&quot; means the account did not report that step.
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{s.label}</div>
            <div className="mt-1 text-[20px] font-semibold tabular-nums">{s.value}</div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">{s.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
