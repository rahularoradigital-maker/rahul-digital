import { ConnectState } from "@/components/app/connect-state";
import { GatedSection } from "@/components/app/gated-section";
import type { CockpitData } from "@/lib/app/cockpit-data";

// Diversity & White Space (rulebook 5.2 retrieval distinctness). Real portfolio-spread
// numbers come from the connected cockpit today (active ad count, top-1 spend share);
// the fingerprint-based distinctness score needs the creative decoder, not built yet,
// so that half of the page stays honestly gated.

export function DiversitySection({ data, days }: { data: CockpitData; days: number }) {
  if (!data.connected) {
    return <ConnectState reason={data.reason} errorNote={data.errorNote} accountName={data.accountName} days={data.days} />;
  }

  const { view } = data;
  const conc = view.concentration;

  return (
    <div className="space-y-6">
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
        <div className="mb-1 text-base font-semibold">Portfolio spread</div>
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

      {(() => {
        const div = data.ownDiversity;
        const fmt = div?.dimensions.find((d) => d.dimension === "format");
        // Fall back to the gated placeholder only when there is no real creative-format data yet.
        if (!div || !fmt || fmt.activeBuckets === 0) {
          return (
            <GatedSection
              title="Full diversity and white space"
              what="Retrieval distinctness measures how different your ads look to Meta's eye, not just to a human."
              delivers={[
                "Distinctness score (cosine on creative fingerprints)",
                "Duplicate clusters Meta reads as one ad",
                "Hook, angle, persona and format variety",
              ]}
              needs="the creative decoder and fingerprints, coming next"
            />
          );
        }
        return (
          <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="text-base font-semibold">Creative format diversity</div>
              <span className="shrink-0 rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">Real assets</span>
            </div>
            <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
              How your live creatives spread across formats, from real Meta ad assets. The semantic layer (hook / angle / persona distinctness) needs the creative decoder - coming next.
            </div>
            <div className="space-y-2.5">
              {fmt.buckets.map((b) => (
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
            {div.whitespace.length > 0 && (
              <div className="mt-4 border-t border-[var(--surface-alt)] pt-3.5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">White-space (proven but under-invested)</div>
                <div className="space-y-1.5">
                  {div.whitespace.map((w, i) => (
                    <div key={`${w.dimension}-${w.bucket}-${i}`} className="text-[13px] text-[var(--ink)]">
                      <span className="font-medium capitalize">{w.bucket}</span> {w.dimension} - {w.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
