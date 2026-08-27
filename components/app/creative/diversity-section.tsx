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
    </div>
  );
}
