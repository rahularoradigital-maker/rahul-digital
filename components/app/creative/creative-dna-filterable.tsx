"use client";

import { useMemo } from "react";
import { assessDiversity, type CreativeRecord, type DiversityRead } from "@/lib/creative/diversity";
import { actionGroup, GROUP_LABEL, GROUP_ORDER, type ActionGroup } from "@/lib/creative/action-group";
import { GatedSection } from "@/components/app/gated-section";
import { Button } from "@/components/ui/button";
import { useStickyActionFilter } from "@/components/app/creative/use-sticky-action-filter";
import { rupees } from "@/lib/format";

// Creative format diversity + Creative DNA, filterable by the action the ad needs (Pause / Refresh /
// Hold / Continue). The per-ad decode RECORDS come from the server; here we re-aggregate the diversity
// read over just the chosen action group, so you can see the DNA of only the ads you need to pause.
// When records are absent (the rare live-pull path), we render the server's aggregated read read-only.

export function CreativeDnaFilterable({ records, actionByAd, fallback, deepReadCount = 0 }: { records: CreativeRecord[]; actionByAd: Record<string, string>; fallback: DiversityRead | null; deepReadCount?: number }) {
  const [filter, setFilter] = useStickyActionFilter("diversity");

  const groupOf = (r: CreativeRecord) => actionGroup(actionByAd[r.adId] ?? "");

  // Count ads per action group so each chip shows a number and empty groups stay hidden.
  const counts = useMemo(() => {
    const c = {} as Record<ActionGroup, number>;
    for (const r of records) {
      const g = groupOf(r);
      c[g] = (c[g] ?? 0) + 1;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, actionByAd]);

  const filtered = filter === "all" ? records : records.filter((r) => groupOf(r) === filter);
  // Re-run the SAME deterministic diversity read over the filtered subset (pure function).
  const div = useMemo(() => (records.length > 0 ? assessDiversity(filtered) : fallback), [records.length, filtered, fallback]);

  const fmt = div?.dimensions.find((d) => d.dimension === "format");
  const hasFormat = !!fmt && fmt.activeBuckets > 0;
  const dnaDims = (div?.dimensions ?? []).filter((d) => d.dimension !== "format" && d.activeBuckets > 0);

  const chips = records.length > 0 && (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter creatives by the action they need">
      <Button variant={filter === "all" ? "default" : "outline"} size="sm" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
        All <span className="ml-1 opacity-70 tabular-nums">{records.length}</span>
      </Button>
      {GROUP_ORDER.filter((g) => counts[g] > 0).map((g) => (
        <Button key={g} variant={filter === g ? "default" : "outline"} size="sm" aria-pressed={filter === g} onClick={() => setFilter(g)}>
          {GROUP_LABEL[g]} <span className="ml-1 opacity-70 tabular-nums">{counts[g]}</span>
        </Button>
      ))}
    </div>
  );

  const scopeNote = filter !== "all" ? ` · showing only ads to ${GROUP_LABEL[filter as ActionGroup]}` : "";

  return (
    <div className="space-y-6">
      {chips}

      {records.length > 0 && (
        <div className="text-[13px] text-[var(--ink-muted)]">
          <span className="tabular-nums">{filtered.length}</span> ad{filtered.length === 1 ? "" : "s"}
          {filter !== "all" ? ` to ${GROUP_LABEL[filter as ActionGroup]}` : ""} ·{" "}
          <span className="font-semibold text-[var(--ink)] tabular-nums">{rupees.format(filtered.reduce((s, r) => s + r.spendRs, 0))}</span> of spend
        </div>
      )}

      {!hasFormat ? (
        filter !== "all" ? (
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 text-[13px] text-[var(--ink-muted)]">
            No decoded creatives in &quot;{GROUP_LABEL[filter as ActionGroup]}&quot; yet.
          </div>
        ) : (
          <GatedSection
            title="Full diversity and white space"
            what="Retrieval distinctness measures how different your ads look to Meta's eye, not just to a human."
            delivers={["Distinctness score (cosine on creative fingerprints)", "Duplicate clusters Meta reads as one ad", "Hook, angle, persona and format variety"]}
            needs="the creative decoder and fingerprints, coming next"
          />
        )
      ) : (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="text-base font-normal">Creative format diversity</div>
            <span className="shrink-0 rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">Real assets</span>
          </div>
          <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
            How your live creatives spread across formats, from real Meta ad assets{scopeNote}. The deeper read (scene, colours, mood, hook, funnel stage) is in Creative DNA below.
          </div>
          <div className="space-y-2.5">
            {fmt!.buckets.map((b) => (
              <div key={b.name}>
                <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                  <span className="font-medium capitalize">{b.name}</span>
                  <span className="tabular-nums text-[var(--ink-muted)]">{Math.round(b.spendShare * 100)}% of spend · {b.count} ad{b.count === 1 ? "" : "s"}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(b.spendShare * 100, 2)}%` }} />
                </div>
              </div>
            ))}
          </div>
          {div!.whitespace.length > 0 && (
            <div className="mt-4 border-t border-[var(--surface-alt)] pt-3.5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">White-space (proven but under-invested)</div>
              <div className="space-y-1.5">
                {div!.whitespace.map((w, i) => (
                  <div key={`${w.dimension}-${w.bucket}-${i}`} className="text-[13px] text-[var(--ink)]">
                    <span className="font-medium capitalize">{w.bucket}</span> {w.dimension} - {w.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {dnaDims.length > 0 && (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="text-base font-normal">Creative DNA</div>
            <div className="flex shrink-0 items-center gap-1.5">
              {deepReadCount > 0 && (
                <span className="rounded-full border border-transparent bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]">{deepReadCount} deep-read (video motion)</span>
              )}
              <span className="rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">{Math.round((div?.coverage ?? 0) * 100)}% analysed</span>
            </div>
          </div>
          <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
            Read from your real ad images, video cover frames and copy: scene, setting, colours, mood, plus funnel stage, hook, emotion and subject{scopeNote}. {deepReadCount > 0 ? `${deepReadCount} of your top spenders were read as real video motion (deep analysis) - the rest use the cover frame.` : "For video, only the cover frame is read - the motion inside the video is not analysed unless you run the deep read below."} Each creative is decoded once and reused, so this fills in over the next few loads.
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {dnaDims.map((d) => (
              <div key={d.dimension}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  <span>{d.dimension}</span>
                  <span className="tabular-nums normal-case font-normal">{d.diversityScore}/100 spread</span>
                </div>
                <div className="space-y-1.5">
                  {d.buckets.slice(0, 5).map((b) => (
                    <div key={b.name}>
                      <div className="mb-0.5 flex items-center justify-between gap-3 text-[13px]">
                        <span className="capitalize">{b.name}</span>
                        <span className="tabular-nums text-[var(--ink-muted)]">{Math.round(b.spendShare * 100)}% · {b.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(b.spendShare * 100, 2)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
