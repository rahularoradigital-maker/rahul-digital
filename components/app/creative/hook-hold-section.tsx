import type { HookHoldSummary } from "@/lib/scoring/hook-hold-store";
import { rupees } from "@/lib/format";

// Hook x Hold 2x2 (creative diagnostic). Reads the self-contained store summary and renders the four
// quadrants (with the distinct fix each implies) + the per-ad placement. Honest empty state when the
// account has no video delivery to place.

const QUAD_META: Record<string, { title: string; tone: string }> = {
  scale: { title: "Scale - it works", tone: "text-[var(--good-ink)]" },
  rewrite_payoff: { title: "Rewrite the payoff", tone: "text-[var(--warn-ink)]" },
  recut_hook: { title: "Recut the hook", tone: "text-[var(--warn-ink)]" },
  kill_concept: { title: "Kill the concept", tone: "text-[var(--bad-ink)]" },
};
const PILL: Record<string, string> = {
  scale: "bg-[var(--good-bg)] text-[var(--good-ink)]",
  rewrite_payoff: "bg-[var(--surface-alt)] text-[var(--warn-ink)]",
  recut_hook: "bg-[var(--surface-alt)] text-[var(--warn-ink)]",
  kill_concept: "bg-[var(--bad-bg)] text-[var(--bad-ink)]",
  insufficient: "bg-[var(--surface-alt)] text-[var(--ink-muted)]",
};
const pctOf = (v: number | null) => (v === null ? "-" : `${(v * 100).toFixed(0)}%`);

export function HookHoldSection({ summary }: { summary: HookHoldSummary }) {
  const placed = summary.ads.filter((a) => a.read.quadrant !== "insufficient");

  if (placed.length === 0) {
    return (
      <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Hook x Hold</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          No video ads with enough delivery to place yet. Hook (thumb-stop) and hold (did the story pay the hook off?)
          need video views over at least ~1,000 impressions to read - this fills in as video ads run.
        </p>
      </section>
    );
  }

  const quads = ["scale", "rewrite_payoff", "recut_hook", "kill_concept"] as const;
  return (
    <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <h2 className="text-[15px] font-semibold text-[var(--ink)]">Hook x Hold</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
        Every video ad placed by its hook (3s-view / impressions) and hold (thruplays / 3s-views), split at your own
        account medians (hook {pctOf(summary.hookMedian)}, hold {pctOf(summary.holdMedian)}) - not a published benchmark.
        Each quadrant has a different fix.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {quads.map((q) => (
          <div key={q} className="rounded-[10px] border border-[var(--hairline)] p-3">
            <div className="flex items-center justify-between">
              <span className={`text-[13px] font-semibold ${QUAD_META[q].tone}`}>{QUAD_META[q].title}</span>
              <span className="text-[13px] tabular-nums text-[var(--ink-muted)]">{summary.counts[q]} ad{summary.counts[q] === 1 ? "" : "s"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        {placed.slice(0, 40).map((a) => (
          <div key={a.adId} className="flex items-start gap-3 border-t border-[var(--hairline)] py-2 first:border-0">
            <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${PILL[a.read.quadrant] ?? ""}`}>{QUAD_META[a.read.quadrant]?.title ?? a.read.label}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-[var(--ink)]">{a.name}</div>
              <div className="text-[12px] leading-relaxed text-[var(--ink-muted)]">
                hook {pctOf(a.read.hook)} - hold {pctOf(a.read.hold)} - {rupees.format(a.spendRs)} spend. {a.read.action}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
