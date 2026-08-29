"use client";

import { useState } from "react";
import { DAILY_KPIS, type DailyKpiKey, type DailyPoint } from "@/lib/cockpit/daily-series";
import { rupees } from "@/lib/format";

// Day-wise trend line for the selected window. One SVG polyline for the chosen KPI over the real
// per-day series (no deps, no fabrication - a day with a null ratio is a gap in the line, never a
// zero). The KPI picker exposes every metric we can derive day-wise; CPA/CPC show as 00.00, CTR/
// funnel rates as 00.00%, ROAS as 0.00x. Pure presentation - all math is buildDailySeries upstream.

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

// DD MMM (e.g. 14 Aug) from a YYYY-MM-DD string, in UTC so the label matches the row's date exactly.
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
}

export function DailyTrendChart({ series }: { series: DailyPoint[] }) {
  const [key, setKey] = useState<DailyKpiKey>("roas");
  const meta = DAILY_KPIS.find((k) => k.key === key) ?? DAILY_KPIS[0];

  const pts = series.map((p, i) => ({ i, date: p.date, v: p[key] as number | null }));
  const vals = pts.map((p) => p.v).filter((v): v is number => v !== null && Number.isFinite(v));

  const empty = series.length === 0 || vals.length === 0;

  // Geometry (viewBox units; the SVG scales to its container width). A single-point series is drawn
  // as a centred dot; a flat series gets a mid-line (range floored to 1 so we never divide by zero).
  const W = 760, H = 200, padX = 10, padTop = 14, padBottom = 26;
  const innerW = W - padX * 2, innerH = H - padTop - padBottom;
  const min = empty ? 0 : Math.min(...vals);
  const max = empty ? 1 : Math.max(...vals);
  const range = max - min || 1;
  const xAt = (i: number) => (series.length <= 1 ? padX + innerW / 2 : padX + (i / (series.length - 1)) * innerW);
  const yAt = (v: number) => padTop + innerH - ((v - min) / range) * innerH;

  // One path; break (start a new M) whenever a day has no value, so gaps are not bridged by a fake line.
  let d = "";
  let pen = false;
  const dots: { x: number; y: number }[] = [];
  for (const p of pts) {
    if (p.v === null || !Number.isFinite(p.v)) { pen = false; continue; }
    const px = xAt(p.i), py = yAt(p.v);
    d += `${pen ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)} `;
    pen = true;
    if (series.length <= 1) dots.push({ x: px, y: py });
  }
  const lastVal = [...pts].reverse().find((p) => p.v !== null && Number.isFinite(p.v as number));

  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-[var(--ink)]">Day-wise trend</div>
          <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
            {meta.label} per day over this window{lastVal ? ` · latest ${fmtValue(lastVal.v, meta.fmt)}` : ""}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
          KPI
          <select
            value={key}
            onChange={(e) => setKey(e.target.value as DailyKpiKey)}
            className="rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--ink)]"
          >
            {DAILY_KPIS.map((k) => (
              <option key={k.key} value={k.key}>{k.label}</option>
            ))}
          </select>
        </label>
      </div>

      {empty ? (
        <div className="mt-4 flex h-[160px] items-center justify-center text-sm text-[var(--ink-muted)]">
          No day-wise data for {meta.label} in this window.
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" role="img" aria-label={`${meta.label} day-wise trend`} className="min-w-[520px]">
            {/* max / min gridlines + labels */}
            <line x1={padX} y1={padTop} x2={W - padX} y2={padTop} stroke="var(--hairline)" strokeWidth="1" />
            <line x1={padX} y1={padTop + innerH} x2={W - padX} y2={padTop + innerH} stroke="var(--hairline)" strokeWidth="1" />
            <text x={padX} y={padTop - 4} fontSize="11" fill="var(--ink-muted)">{fmtValue(max, meta.fmt)}</text>
            <text x={padX} y={padTop + innerH + 14} fontSize="11" fill="var(--ink-muted)">{fmtValue(min, meta.fmt)}</text>
            {/* the trend line */}
            <path d={d.trim()} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {dots.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" />
            ))}
            {/* endpoint marker */}
            {lastVal && lastVal.v !== null && <circle cx={xAt(lastVal.i)} cy={yAt(lastVal.v)} r="3.5" fill="var(--accent)" />}
            {/* first + last date labels */}
            <text x={padX} y={H - 8} fontSize="11" fill="var(--ink-muted)">{shortDate(series[0].date)}</text>
            <text x={W - padX} y={H - 8} fontSize="11" fill="var(--ink-muted)" textAnchor="end">{shortDate(series[series.length - 1].date)}</text>
          </svg>
        </div>
      )}
    </div>
  );
}
