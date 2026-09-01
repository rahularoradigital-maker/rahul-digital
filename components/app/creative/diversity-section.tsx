import { ConnectState } from "@/components/app/connect-state";
import { CreativeStrategyCard } from "@/components/app/creative/CreativeStrategyCard";
import { CreativeDnaFilterable } from "@/components/app/creative/creative-dna-filterable";
import { DeepAnalysisCard } from "@/components/app/creative/deep-analysis-card";
import type { CockpitData } from "@/lib/app/cockpit-data";
import type { DiversityComparison } from "@/lib/creative/diversity-vs-competitors";

// Diversity & White Space (rulebook 5.2 retrieval distinctness). Real portfolio-spread
// numbers come from the connected cockpit today (active ad count, top-1 spend share);
// the format + Creative DNA read comes from the real decoded assets and is filterable by
// the action each ad needs (Pause / Refresh / Hold / Continue) via CreativeDnaFilterable.
// `competitors` is the own-vs-competitor format comparison (null when none added).

export function DiversitySection({ data, days, competitors, deepReadCount = 0 }: { data: CockpitData; days: number; competitors?: DiversityComparison | null; deepReadCount?: number }) {
  if (!data.connected) {
    return <ConnectState reason={data.reason} errorNote={data.errorNote} accountName={data.accountName} days={data.days} />;
  }

  const { view } = data;
  const conc = view.concentration;
  const ownFmt = data.ownDiversity?.dimensions.find((d) => d.dimension === "format");
  const hasOwnFormat = !!ownFmt && ownFmt.activeBuckets > 0;
  // adId -> the action the verdict engine recommends, so the DNA can be filtered by action group.
  const actionByAd = Object.fromEntries(view.leaderboard.map((a) => [a.id, a.action.label]));

  return (
    <div className="space-y-6">
      {/* The strategist's read - winning DNA, portfolio fragility, proven white-space, and what to make next. */}
      {data.ownStrategy && <CreativeStrategyCard s={data.ownStrategy} />}

      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
        <div className="mb-1 text-base font-normal">Portfolio spread</div>
        <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
          Real numbers from your connected account. Not diversity yet, just how many ads are live and how concentrated
          spend is across them.
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">Active ads</div>
            <div className="mt-1.5 text-[26px] font-semibold tabular-nums tracking-tight">{view.leaderboard.length}</div>
          </div>
          <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">Top-ad spend share</div>
            {conc.status === "ok" ? (
              <div className="mt-1.5 text-[26px] font-semibold tabular-nums tracking-tight">
                {Math.round(conc.top1Share * 100)}%
                <span className="ml-1.5 text-[13px] font-normal text-[var(--ink-muted)]">of spend on one ad</span>
              </div>
            ) : (
              <div className="mt-1.5 text-[13px] text-[var(--ink-muted)]">Not enough spend to assess</div>
            )}
          </div>
        </div>
      </div>

      {/* Creative format diversity + Creative DNA, filterable by action (Pause / Refresh / Hold / Continue). */}
      <CreativeDnaFilterable records={data.ownDiversityRecords ?? []} actionByAd={actionByAd} fallback={data.ownDiversity} deepReadCount={deepReadCount} />

      {/* Deep read (free one-time): real video motion on the top-10 spenders, with the exact list used. */}
      <DeepAnalysisCard accountId={data.accountId} />

      {hasOwnFormat && <CompetitorCompare cmp={competitors ?? null} />}
    </div>
  );
}

// You vs competitors: my format mix (share of spend) against the competitors already scraped from
// the public Ad Library, deduped so re-uploads do not inflate the count. Only presence is compared -
// a competitor's spend/ROAS is never knowable. Renders the quiet "add competitors" note when none
// have been added for this account.
function CompetitorCompare({ cmp }: { cmp: DiversityComparison | null }) {
  if (!cmp) {
    return (
      <div className="rounded-[10px] border border-dashed border-[var(--hairline)] bg-[var(--surface)] p-6 text-[13px] text-[var(--ink-muted)]">
        Add competitors on the Market tab to compare your format mix against theirs.
      </div>
    );
  }

  const rows = cmp.formats.filter((f) => (f.ownShare ?? 0) > 0 || (f.competitorShare ?? 0) > 0);

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-base font-normal">You vs competitors</div>
        <span className="shrink-0 rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">Ad Library</span>
      </div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">{cmp.basis} Presence only - a competitor&apos;s spend and results are never exposed by Meta.</div>

      <div className="space-y-3">
        {rows.map((f) => {
          const own = f.ownShare === null ? null : Math.round(f.ownShare * 100);
          const comp = f.competitorShare === null ? null : Math.round(f.competitorShare * 100);
          return (
            <div key={f.format}>
              <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                <span className="font-medium capitalize">
                  {f.format}
                  {f.gap && <span className="ml-2 rounded-full bg-[var(--warn-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--warn-ink)]">Gap</span>}
                  {f.overConcentration && <span className="ml-2 rounded-full bg-[var(--warn-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--warn-ink)]">Over-concentrated</span>}
                </span>
                <span className="tabular-nums text-[var(--ink-muted)]">
                  you {own === null ? "-" : `${own}%`} · competitors {comp === null ? "-" : `${comp}%`}
                </span>
              </div>
              <div className="flex gap-1.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(own ?? 0, 2)}%` }} />
                </div>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                  <div className="h-full rounded-full bg-[var(--ink-muted)]" style={{ width: `${Math.max(comp ?? 0, 2)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(cmp.gaps.length > 0 || cmp.overConcentration.length > 0) && (
        <div className="mt-4 border-t border-[var(--surface-alt)] pt-3.5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">What stands out</div>
          <ul className="space-y-1.5">
            {cmp.gaps.map((g) => (
              <li key={g} className="text-[13px] text-[var(--ink)]">{g}</li>
            ))}
            {cmp.overConcentration.map((o) => (
              <li key={o} className="text-[13px] text-[var(--ink)]">{o}</li>
            ))}
          </ul>
        </div>
      )}

      {cmp.suggestion && (
        <div className="mt-3.5 rounded-[8px] border border-[var(--hairline)] bg-[var(--bg)] p-3 text-[13px] text-[var(--ink)]">
          <span className="font-medium">Where to diversify:</span> {cmp.suggestion}
        </div>
      )}
    </div>
  );
}
