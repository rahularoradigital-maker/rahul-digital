import type { EventRoi, EventTrend } from "@/lib/scoring/event-roi";
import { eventBleedSummary, eventSpendSplit } from "@/lib/scoring/event-roi";
import { eventBleedToContract } from "@/lib/intelligence/from-event-roi";
import { ReasoningTrace } from "@/components/intelligence/ReasoningTrace";
import { eventMoneyMapHtml } from "@/lib/scoring/money-map";
import { DownloadButton } from "@/components/cockpit/DownloadButton";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// The formula, shown on hover/focus of the "i" - so the number is always auditable (charter: explain the decision).
const FORMULA =
  "Spend by event = total spend of ads optimising for that event. " +
  "ROI% = (revenue - spend) / spend x 100, shown ONLY for events that produce real purchase revenue. " +
  "Events with no rupee revenue (Add to Cart, Lead, Traffic) show n/a - judged by cost per result, not ROI, so no value is invented. " +
  "Events below a spend floor are marked too small to judge.";

function InfoDot() {
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label="How event ROI is calculated" className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--hairline)] text-[10px] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
        i
      </button>
      <span className="pointer-events-none absolute left-0 top-6 z-10 hidden w-72 rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] p-3 text-left text-[12px] font-normal leading-relaxed text-[var(--ink)] shadow-md group-hover:block group-focus-within:block">
        {FORMULA}
      </span>
    </span>
  );
}

// A small trend chip: only shown where the event had real revenue in BOTH windows and the ROI moved beyond
// the noise threshold. "worsening" is the one a media buyer must see first, so it carries the alert colour.
function TrendChip({ t }: { t?: EventTrend }) {
  if (!t || t.direction === "flat") return null;
  const worse = t.direction === "worsening";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${worse ? "bg-[var(--bad-bg,#fdecea)] text-[var(--bad-ink)]" : "bg-[var(--good-bg,#e7f5ee)] text-[var(--good-ink)]"}`}
      title={`ROI ${worse ? "down" : "up"} ${Math.abs(t.deltaPct)} points vs the previous equal-length window`}
    >
      {worse ? "↓" : "↑"} {Math.abs(t.deltaPct)} pts
    </span>
  );
}

export function EventRoiCard({ rows, trend }: { rows: EventRoi[]; trend?: Map<string, EventTrend> }) {
  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-base font-normal">Spend &amp; return by event</div>
          <InfoDot />
        </div>
        {rows.length > 0 && <DownloadButton content={eventMoneyMapHtml(rows)} filename="money-map.html" mime="text/html" label="Money map" />}
      </div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
        How much you spend on each optimisation event, and the ROI where the event actually makes money.
        {(() => {
          const split = eventSpendSplit(rows);
          return split ? <span className="block mt-1 text-[var(--ink)]">{inr.format(split.totalRs)} total · {split.revenuePct}% on revenue events · {split.awarenessPct}% on awareness.</span> : null;
        })()}
      </div>

      {(() => {
        const bleed = eventBleedSummary(rows);
        if (!bleed) return null;
        const contract = eventBleedToContract(rows, { entityId: "account" });
        return (
          <div className="mb-4 rounded-[8px] border border-[var(--warn-bg)] bg-[var(--warn-bg)] p-3 text-[13px] text-[var(--warn-ink)]">
            <span className="font-medium">Reallocate:</span> {bleed.line}
            {contract && <ReasoningTrace contract={contract} />}
          </div>
        );
      })()}

      {rows.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[var(--hairline)] bg-[var(--bg)] p-4 text-[13px] text-[var(--ink-muted)]">
          No event data yet. This fills in once your account syncs the ad-set optimisation event.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((e) => (
            <div key={e.event} className="border-t border-[var(--surface-alt)] pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[14px] font-medium capitalize">{e.event.replace(/_/g, " ")}</span>
                <span className="text-[13px] text-[var(--ink-muted)] tabular-nums">
                  {inr.format(e.spendRs)} <span className="opacity-70">· {e.spendSharePct}% of spend</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(e.spendSharePct, 2)}%` }} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
                {!e.material ? (
                  <span className="text-[var(--ink-muted)]">Too small to judge</span>
                ) : e.roiPct !== null ? (
                  <>
                    <span className={`font-semibold tabular-nums ${e.roiPct >= 0 ? "text-[var(--good-ink)]" : "text-[var(--bad-ink)]"}`}>
                      ROI {e.roiPct >= 0 ? "+" : ""}{e.roiPct}%
                    </span>
                    {e.roas !== null && <span className="text-[var(--ink-muted)] tabular-nums">{e.roas}x ROAS</span>}
                    {e.costPerPurchaseRs !== null && <span className="text-[var(--ink-muted)] tabular-nums">{inr.format(e.costPerPurchaseRs)}/purchase</span>}
                    {e.thinSample && <span className="rounded-full bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">directional</span>}
                    <TrendChip t={trend?.get(e.event)} />
                  </>
                ) : (
                  <span className="text-[var(--ink-muted)]">ROI n/a - no revenue for this event; judge on cost per result</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
