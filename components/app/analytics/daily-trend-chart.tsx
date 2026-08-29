import { DAILY_KPIS, type DailyPoint } from "@/lib/cockpit/daily-series";
import { rupees } from "@/lib/format";

// Small day-wise SPARKLINES - one tiny trend line per metric, no axes, no big chart. Matches the
// requested card style: a metric label, its latest value, a direction glyph, and a small line showing
// how the metric moved across the window. Pure presentation; every value comes from buildDailySeries
// upstream. Nulls are gaps in the line (a day that could not report a ratio), never a fake 0.

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
function Sparkline({ values }: { values: (number | null)[] }) {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const W = 120, H = 30, pad = 2;
  if (nums.length === 0) return <div className="h-[30px]" aria-hidden="true" />;
  const min = Math.min(...nums), max = Math.max(...nums), range = max - min || 1;
  const n = values.length;
  const xAt = (i: number) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2));
  const yAt = (v: number) => pad + (H - pad * 2) - ((v - min) / range) * (H - pad * 2);

  let d = "";
  let pen = false;
  let lastPt: { x: number; y: number } | null = null;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === null || !Number.isFinite(v)) { pen = false; continue; }
    const x = xAt(i), y = yAt(v as number);
    d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    pen = true;
    lastPt = { x, y };
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="30" preserveAspectRatio="none" role="img" className="block">
      <path d={d.trim()} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r="2" fill="var(--accent)" />}
    </svg>
  );
}

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

export function DailyTrendChart({ series }: { series: DailyPoint[] }) {
  if (series.length === 0) return null;
  return (
    <div>
      <div className="text-sm font-medium text-[var(--ink)]">Day-wise trends</div>
      <p className="mt-0.5 text-xs text-[var(--ink-muted)]">How each metric moved day by day over this window.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {DAILY_KPIS.map((k) => {
          const values = series.map((p) => p[k.key] as number | null);
          const last = [...values].reverse().find((v) => v !== null && Number.isFinite(v)) ?? null;
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
