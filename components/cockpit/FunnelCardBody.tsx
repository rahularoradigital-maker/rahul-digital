"use client";

import { useState } from "react";
import type { FunnelMetrics } from "@/lib/metrics/funnel-metrics";
import type { DailyKpiKey, DailyPoint } from "@/lib/cockpit/daily-series";
import type { LevelFunnels } from "@/lib/cockpit/level-funnel";
import { Sparkline } from "@/components/app/analytics/sparkline";
import { rupees, rupeesPrecise } from "@/lib/format";

// Interactive funnel body: an Ad / Ad set / Campaign selector (replacing the old static "Ad-level"
// pill). Ad level shows the account-aggregate 8 ratios with day-wise sparklines; Ad set / Campaign
// show a compact table of the top groups by spend, each with its own rolled-up ratios. Real data
// only - a null ratio renders "n/a", never a fabricated 0. If funnelLevels is absent (older cached
// blob), only the Ad view is offered.

type Level = "ad" | "adset" | "campaign";

function pct(v: number | null): string {
  return v === null ? "n/a" : `${v.toFixed(2)}%`;
}
function rs(v: number | null): string {
  return v === null ? "n/a" : rupees.format(v);
}
// Per-unit costs (CPM/CPC) show 2 decimals - rounding to whole rupees hides real differences.
function rsUnit(v: number | null): string {
  return v === null ? "n/a" : rupeesPrecise.format(v);
}

const STATS: { label: string; hint: string; kpi: DailyKpiKey; get: (f: FunnelMetrics) => string }[] = [
  { label: "Thumb-stop", hint: "3s video views / impressions", kpi: "thumbStop", get: (f) => pct(f.thumbStopRate) },
  { label: "Hold rate", hint: "thruplays / 3s views", kpi: "holdRate", get: (f) => pct(f.holdRate) },
  { label: "CTR", hint: "clicks / impressions", kpi: "ctr", get: (f) => pct(f.ctr) },
  { label: "CPM", hint: "cost / 1000 impressions", kpi: "cpm", get: (f) => rsUnit(f.cpm) },
  { label: "CPC", hint: "cost / click", kpi: "cpc", get: (f) => rsUnit(f.cpc) },
  { label: "LP view rate", hint: "landing-page views / outbound clicks", kpi: "lpViewRate", get: (f) => pct(f.lpViewRate) },
  { label: "Add-to-cart", hint: "ATC / landing-page views", kpi: "atcRate", get: (f) => pct(f.atcRate) },
  { label: "Checkout", hint: "initiate checkout / ATC", kpi: "checkoutRate", get: (f) => pct(f.checkoutRate) },
];

function Pill({ level, active, onClick, children }: { level: Level; active: boolean; onClick: (l: Level) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onClick(level)}
      className={
        active
          ? "rounded-full bg-[var(--ink)] px-3 py-1 text-[12px] font-medium text-white"
          : "rounded-full px-3 py-1 text-[12px] text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
      }
    >
      {children}
    </button>
  );
}

export function FunnelCardBody({ funnel, dailySeries, funnelLevels }: { funnel: FunnelMetrics; dailySeries: DailyPoint[]; funnelLevels?: LevelFunnels }) {
  const [level, setLevel] = useState<Level>("ad");
  const hasLevels = Boolean(funnelLevels && (funnelLevels.adset.length > 0 || funnelLevels.campaign.length > 0));
  const groups = level === "adset" ? funnelLevels?.adset ?? [] : level === "campaign" ? funnelLevels?.campaign ?? [] : [];

  return (
    <>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-base font-normal">Funnel metrics</div>
        {hasLevels ? (
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--bg)] p-0.5">
            <Pill level="ad" active={level === "ad"} onClick={setLevel}>Ad</Pill>
            <Pill level="adset" active={level === "adset"} onClick={setLevel}>Ad set</Pill>
            <Pill level="campaign" active={level === "campaign"} onClick={setLevel}>Campaign</Pill>
          </div>
        ) : (
          <span className="shrink-0 rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">Ad-level, this window</span>
        )}
      </div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
        Real thumb-stop, hold, and click-to-checkout ratios. &quot;n/a&quot; means the account did not report that step.
        {level !== "ad" ? ` Top ${level === "adset" ? "ad sets" : "campaigns"} by spend, each rolled up from its own ads.` : ""}
      </div>

      {level === "ad" ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{s.label}</div>
              <div className="mt-1 text-[22px] font-semibold tabular-nums">{s.get(funnel)}</div>
              <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">{s.hint}</div>
              {dailySeries.length > 0 && (
                <div className="mt-2"><Sparkline values={dailySeries.map((p) => p[s.kpi] as number | null)} height={24} /></div>
              )}
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="py-6 text-center text-sm text-[var(--ink-muted)]">No {level === "adset" ? "ad set" : "campaign"} breakdown for this window.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
                <th className="py-2 pr-3 font-medium">{level === "adset" ? "Ad set" : "Campaign"}</th>
                <th className="py-2 pr-3 text-right font-medium">Spend</th>
                {STATS.map((s) => (
                  <th key={s.label} className="py-2 pr-3 text-right font-medium">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-t border-[var(--surface-alt)]">
                  <td className="max-w-[220px] truncate py-2 pr-3 font-medium text-[var(--ink)]" title={g.name}>{g.name}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{rupees.format(g.spendRs)}</td>
                  {STATS.map((s) => (
                    <td key={s.label} className="py-2 pr-3 text-right tabular-nums">{s.get(g.funnel)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
