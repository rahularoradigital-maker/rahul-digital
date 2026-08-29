import { DAILY_KPIS, type DailyPoint, type DailyKpiKey } from "@/lib/cockpit/daily-series";
import { Sparkline } from "@/components/app/analytics/sparkline";
import { rupees } from "@/lib/format";

// Small day-wise SPARKLINES - one tiny trend line per metric, no axes, no big chart. Matches the
// requested card style: a metric label, its WINDOW value, a direction glyph, and a small line showing
// how the metric moved across the window. Pure presentation; every value comes from buildDailySeries
// upstream. Nulls are gaps in the line (a day that could not report a ratio), never a fake 0.
//
// The headline number is the whole-WINDOW aggregate (windowHeadline), never the last day: the last days
// under-report conversions (Meta attributes purchases days after the click), so a last-day headline
// showed a false 0.00 ROAS next to a real CPA/spend. The sparkline still shows the day-by-day shape.

const intFmt = new Intl.NumberFormat("en-IN");

function fmtValue(v: number | null, fmt: string): string {
  if (v === null || !Number.isFinite(v)) return "n/a";
  switch (fmt) {
    case "x": return `${v.toFixed(2)}x`;
    case "inr": return rupees.format(Math.round(v));
    case "inr2": return `₹${v.toFixed(2)}`;
    case "pct": return `${v.toFixed(2)}%`;
    default: return intFmt.format(Math.round(v));
  }
}

// A tiny inline line for one metric's day-wise values. Fixed viewBox, scales to the tile width.
// Direction of a metric across the window (first vs last real value). Neutral wording only: "up" on a
// metric like CPA is not "good", so the glyph reports direction, never a verdict/colour judgment.
function trendGlyph(values: (number | null)[]): string {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length < 2) return "";
  const first = nums[0], last = nums[nums.length - 1];
  const delta = last - first;
  const scale = Math.abs(first) || 1;
  if (Math.abs(delta) / scale < 0.02) return "→";
  return delta > 0 ? "↑" : "↓";
}

export function DailyTrendChart({ series, headline }: { series: DailyPoint[]; headline?: Record<DailyKpiKey, number | null> }) {
  if (series.length === 0) return null;
  return (
    <div>
      <div className="text-sm font-medium text-[var(--ink)]">Day-wise trends</div>
      <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Each number is the whole-window total. The line shows how the metric moved day by day.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {DAILY_KPIS.map((k) => {
          const values = series.map((p) => p[k.key] as number | null);
          // Headline = whole-window aggregate (mutually consistent, no attribution-lag zero). Fall back
          // to the last real day only when no window headline was provided (older cache / edge).
          const last = headline
            ? headline[k.key]
            : [...values].reverse().find((v) => v !== null && Number.isFinite(v)) ?? null;
          return (
            <div key={k.key} className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">{k.label}</span>
                <span className="text-[11px] text-[var(--ink-muted)]">{trendGlyph(values)}</span>
              </div>
              <div className="mt-0.5 text-base font-medium tabular-nums text-[var(--ink)]">{fmtValue(last, k.fmt)}</div>
              <div className="mt-2"><Sparkline values={values} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
