import type { DecisionFeed } from "@/lib/intelligence/collect";
import type { OutputContract, Confidence } from "@/lib/intelligence/output-contract";
import { ReasoningTrace } from "@/components/intelligence/ReasoningTrace";

// "Today - what to fix first": the reasoning-backed daily brief. Renders the intelligence team's
// collectDecisions() feed (§110 Output Contracts) - the top few per-ad decisions ranked by money at stake,
// plus account-level reads as context. Every row can expand to its full DATA->...->LEARNING reasoning, so a
// number is never shown without its why. Pure render over an already-computed feed (no data work here).

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const CONF: Record<Confidence, { label: string; cls: string }> = {
  high: { label: "high confidence", cls: "bg-[var(--good-bg)] text-[var(--good-ink)]" },
  med: { label: "medium confidence", cls: "bg-[var(--warn-bg)] text-[var(--warn-ink)]" },
  low: { label: "low confidence", cls: "bg-[var(--surface-alt)] text-[var(--ink-muted)]" },
};

function Row({ c }: { c: OutputContract }) {
  const conf = CONF[c.confidence] ?? CONF.low;
  return (
    <div className="border-t border-[var(--surface-alt)] py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[14px] font-semibold">{c.decision?.call ?? c.kind}</span>
          {c.entity?.name && <span className="ml-2 text-[13px] text-[var(--ink-muted)]">{c.entity.name}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {c.economicImpactRs != null && c.economicImpactRs > 0 && (
            <span className="text-[13px] font-semibold text-[var(--bad-ink)] tabular-nums">{inr.format(c.economicImpactRs)} at stake</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${conf.cls}`}>{conf.label}</span>
        </div>
      </div>
      {c.decision?.why && <div className="mt-1 text-[13px] text-[var(--ink)]">{c.decision.why}</div>}
      {c.action && <div className="mt-1 text-[12px] text-[var(--ink-muted)]">Do: {c.action}</div>}
      {/* Full DATA->...->LEARNING drill-down, shared with the CulpritBanner (f3's ReasoningTrace). */}
      <ReasoningTrace contract={c} />
    </div>
  );
}

export function TodayCard({ feed, limit = 3 }: { feed: DecisionFeed; limit?: number }) {
  const top = feed.priorities.slice(0, limit);
  if (top.length === 0 && feed.accountReads.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
        <div className="mb-1 text-base font-normal">Today - what to fix first</div>
        <div className="text-[13px] text-[var(--ink-muted)]">Nothing urgent to fix right now. Every decidable call is either healthy or waiting on more data.</div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
      <div className="mb-1 text-base font-normal">Today - what to fix first</div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">The {top.length} highest-₹ decisions, each with the full reasoning behind it. Nothing here is applied automatically.</div>
      <div>
        {top.map((c) => (
          <Row key={c.id} c={c} />
        ))}
      </div>
      {feed.accountReads.length > 0 && (
        <div className="mt-4 border-t border-[var(--surface-alt)] pt-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Account-level reads</div>
          {feed.accountReads.map((c) => (
            <Row key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
