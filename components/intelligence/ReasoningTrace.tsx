import type { OutputContract } from "@/lib/intelligence/output-contract";

// Renders the §110 Output Contract as a plain-English drill-down (§121 "translate, don't dump z-scores";
// §122 summary -> evidence -> reasoning). Server-compatible: a native <details> gives collapse with NO client
// JS. Shows only the stages that exist, in chain order, so a HOLD shows its honest refusal and a decided
// output shows the whole DATA -> ... -> LEARNING trail behind the call. Presentational only - never computes.

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const CONF: Record<string, string> = { high: "High confidence", med: "Medium confidence", low: "Low confidence" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-0.5 py-1 border-t border-[var(--hairline,rgba(0,0,0,0.08))] first:border-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{label}</div>
      <div className="text-[13px] leading-snug text-[var(--ink)]">{children}</div>
    </div>
  );
}

export function ReasoningTrace({ contract: c }: { contract: OutputContract }) {
  const held = !c.trust.ok;
  return (
    <details className="group mt-2">
      <summary className="cursor-pointer list-none text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] select-none">
        <span className="group-open:hidden">Why we think this →</span>
        <span className="hidden group-open:inline">Hide reasoning ↑</span>
      </summary>
      <div className="mt-2 rounded-[8px] bg-[var(--surface,rgba(0,0,0,0.02))] px-3 py-1.5">
        <Row label="Data">{c.data.summary} <span className="text-[var(--ink-muted)]">· {c.data.source}</span></Row>
        <Row label="Trust">
          {held ? "Not enough to decide" : "Trusted"} <span className="text-[var(--ink-muted)]">· {c.trust.tier.toLowerCase()} · {c.trust.reason}</span>
        </Row>
        {c.signal && <Row label="Signal">{c.signal}</Row>}
        {c.diagnosis && <Row label="Diagnosis">{c.diagnosis}</Row>}
        {c.economicImpactRs != null && <Row label="Money at stake">{inr(c.economicImpactRs)}</Row>}
        {c.secondOrder && <Row label="2nd-order">{c.secondOrder}</Row>}
        {c.thirdOrder && <Row label="3rd-order">{c.thirdOrder}</Row>}
        {c.decision && (
          <Row label="Decision">
            <span className="font-semibold">{c.decision.call}</span> — {c.decision.why}
          </Row>
        )}
        {c.action && <Row label="Action">{c.action}</Row>}
        <Row label="What could be wrong">{c.whatCouldBeWrong}</Row>
        <Row label="Confidence">{CONF[c.confidence] ?? c.confidence}{c.sampleNote ? ` · ${c.sampleNote}` : ""}</Row>
      </div>
    </details>
  );
}
