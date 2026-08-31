"use client";

// Ad / Ad set / Campaign rollup of the live leaderboard. The user picks a level and the
// same base facts (spend, revenue, purchases) re-group under it, with ROAS + CPA derived
// per group. All math is levelMetrics upstream; this file is pure presentation and never
// invents a value (a null ratio renders "n/a", never a fake 0).

import { useMemo, useState } from "react";
import { levelMetrics, type Level, type LevelRow } from "@/lib/cockpit/level-metrics";
import { rupees } from "@/lib/format";

const LEVELS: { key: Level; label: string }[] = [
  { key: "ad", label: "Ad" },
  { key: "adset", label: "Ad set" },
  { key: "campaign", label: "Campaign" },
];

const intFmt = new Intl.NumberFormat("en-IN");
const fmtRoas = (v: number | null) => (v === null ? "n/a" : `${v.toFixed(2)}x`);
const fmtRs = (v: number | null) => (v === null ? "n/a" : rupees.format(Math.round(v)));

export function LevelMetricsSection({ rows }: { rows: LevelRow[] }) {
  const [level, setLevel] = useState<Level>("ad");
  const groups = useMemo(() => levelMetrics(rows, level), [rows, level]);
  const levelLabel = LEVELS.find((l) => l.key === level)?.label ?? "Ad";

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-[var(--ink)]">Metrics by level</div>
          <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Same window, rolled up to {levelLabel.toLowerCase()} level. ROAS and CPA are derived from the summed
            spend, revenue and purchases; a zero denominator shows n/a, never a fabricated ratio.
          </div>
        </div>
        <div className="inline-flex rounded-[8px] border border-[var(--hairline)] p-0.5" role="group" aria-label="Aggregation level">
          {LEVELS.map((l) => {
            const active = l.key === level;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setLevel(l.key)}
                aria-pressed={active}
                className={`rounded-[6px] px-3 py-1 text-sm ${
                  active ? "bg-[var(--accent)] font-medium text-white" : "text-[var(--ink-muted)]"
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-4 flex h-[80px] items-center justify-center text-sm text-[var(--ink-muted)]">
          No ads in this window to roll up.
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--hairline)] text-left text-xs text-[var(--ink-muted)]">
                <th className="py-2 pr-3 font-medium">{levelLabel}</th>
                <th className="py-2 pr-3 text-right font-medium">Ads</th>
                <th className="py-2 pr-3 text-right font-medium">Spend</th>
                <th className="py-2 pr-3 text-right font-medium">Revenue</th>
                <th className="py-2 pr-3 text-right font-medium">ROAS</th>
                <th className="py-2 pr-3 text-right font-medium">Purchases</th>
                <th className="py-2 text-right font-medium">CPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {groups.map((g) => (
                <tr key={g.key}>
                  <td className="max-w-[220px] truncate py-2 pr-3 text-[var(--ink)]" title={g.label}>{g.label}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--ink-muted)]">{g.ads}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--ink)]">{fmtRs(g.spendRs)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--ink)]">{fmtRs(g.revenueRs)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--ink)]">{fmtRoas(g.roas)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--ink)]">{intFmt.format(g.purchases)}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--ink)]">{fmtRs(g.cpaRs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-xs text-[var(--ink-muted)]">
            CTR, CPC and CPM are not shown here: impressions and clicks are not tracked per ad in this rollup, so
            they cannot be split per ad set or campaign without inventing a number.
          </div>
        </div>
      )}
    </div>
  );
}
