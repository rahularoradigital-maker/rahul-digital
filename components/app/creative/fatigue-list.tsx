"use client";

import { useMemo } from "react";
import type { CockpitAd } from "@/lib/cockpit/analyze";
import { FATIGUE_STATE, PRIORITY_STYLE } from "@/components/cockpit/styles";
import { AdLink } from "@/components/cockpit/AdLink";
import { Button } from "@/components/ui/button";
import { actionGroup, GROUP_LABEL, GROUP_ORDER, type ActionGroup } from "@/lib/creative/action-group";
import { useStickyActionFilter } from "@/components/app/creative/use-sticky-action-filter";
import { rupees } from "@/lib/format";

// Money at stake for one ad: its wasted rupees if it is bleeding, else its own spend - the same real
// definition the "This week's plan" queue uses (analyze.ts). Never a fabricated number.
const stakeOf = (ad: CockpitAd) => (ad.wastedRs > 0 ? ad.wastedRs : ad.spendRs);

export function FatigueList({ ads, accountName, accountId, dateParam, days }: { ads: CockpitAd[]; accountName: string; accountId?: string; dateParam?: string; days: number }) {
  const [filter, setFilter] = useStickyActionFilter("fatigue");

  // Worst first: ascending CreativeScore puts the fatiguing/fatigued ads at the top.
  const sorted = useMemo(() => [...ads].sort((a, b) => a.score - b.score), [ads]);
  const atRisk = ads.filter((a) => a.verdict === "refresh" || a.verdict === "loser").length;

  // Count per action group, so each chip shows how many ads it holds (and empty groups are hidden).
  const counts = useMemo(() => {
    const c = {} as Record<ActionGroup, number>;
    for (const ad of sorted) {
      const g = actionGroup(ad.action.label);
      c[g] = (c[g] ?? 0) + 1;
    }
    return c;
  }, [sorted]);

  const visible = filter === "all" ? sorted : sorted.filter((ad) => actionGroup(ad.action.label) === filter);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-muted)]">
          <span className={`h-1.5 w-1.5 rounded-full ${atRisk > 0 ? "bg-[var(--warn-ink)]" : "bg-[var(--good-ink)]"}`} />
          {`${accountName} · ${ads.length} ads assessed · last ${days} days`}
        </div>
        <h1 className="mt-1.5 text-[26px] font-normal tracking-tight">
          {ads.length === 0
            ? "No ads assessed yet."
            : atRisk === 0
              ? "Nothing is fatiguing right now."
              : `${atRisk} of ${ads.length} ad${ads.length === 1 ? "" : "s"} ${atRisk === 1 ? "is" : "are"} fatiguing or fatigued.`}
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">
          Read off the real verdict engine, sorted worst first by CreativeScore.
        </p>
      </div>

      {/* Action filter: show just the ads that need one kind of decision (e.g. only the ones to Pause). */}
      {sorted.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            All <span className="ml-1 opacity-70 tabular-nums">{sorted.length}</span>
          </Button>
          {GROUP_ORDER.filter((g) => counts[g] > 0).map((g) => (
            <Button key={g} variant={filter === g ? "default" : "outline"} size="sm" onClick={() => setFilter(g)}>
              {GROUP_LABEL[g]} <span className="ml-1 opacity-70 tabular-nums">{counts[g]}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Economic weight of the current filter: how much money the shown decision covers. */}
      {visible.length > 0 && (
        <div className="text-[13px] text-[var(--ink-muted)]">
          <span className="tabular-nums">{visible.length}</span> ad{visible.length === 1 ? "" : "s"}
          {filter !== "all" ? ` to ${GROUP_LABEL[filter as ActionGroup]}` : ""} ·{" "}
          <span className="font-semibold text-[var(--ink)] tabular-nums">{rupees.format(visible.reduce((s, a) => s + stakeOf(a), 0))}</span> at stake
        </div>
      )}

      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 text-[13px] text-[var(--ink-muted)]">
        A precise fatigue percentage and a half-life death date need per-ad delivery history (impressions per day,
        frequency) this account does not expose yet. Needs more delivery history - never a fabricated date or percentage.
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        {visible.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ink-muted)]">
            {sorted.length === 0 ? "No ads assessed yet." : `No ads in "${GROUP_LABEL[filter as ActionGroup]}".`}
          </div>
        ) : (
          <div className="px-6 pb-2 pt-2">
            {visible.map((ad) => {
              const fatigue = FATIGUE_STATE[ad.verdict];
              const action = PRIORITY_STYLE[ad.action.priority];
              const conf = Math.round(ad.confidence * 100);
              return (
                <div key={ad.id} className="border-t border-[var(--surface-alt)] py-4 first:border-t-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <AdLink accountId={accountId} adId={ad.id} adSetId={ad.adSetId} campaignId={ad.campaignId} name={ad.name} className="truncate text-[15px] font-semibold" dateParam={dateParam} />
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${fatigue.cls}`}>
                        {fatigue.label}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs text-[var(--ink-muted)] tabular-nums">
                      <span>CreativeScore {ad.score.toFixed(0)}/100</span>
                      <span>{conf}% conf</span>
                    </div>
                  </div>

                  {ad.why.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {ad.why.map((w, i) => (
                        <li key={i} className="truncate text-xs text-[var(--ink-muted)]">
                          &#8627; {w}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-[var(--ink-muted)]">Needs more delivery history for a timed forecast</span>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${action.cls}`}>
                      {ad.action.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
