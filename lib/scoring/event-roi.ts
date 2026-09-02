// Event ROI rubric: spend and return grouped by the OPTIMIZATION EVENT each ad set optimises for
// (Purchase, Add to Cart, Lead, Traffic, ...). Fundamentally strong = honest: ROI% is computed ONLY where
// the event carries real rupee revenue (a purchase). For events with no tracked revenue (ATC, Lead,
// Traffic) it returns ROI = null and says so - inventing a value there is the #1 way ad dashboards lie.
// Pure + deterministic. The card just renders this; the cockpit feeds it real per-event rows.

export type EventRow = { event: string; spendRs: number; revenueRs: number; purchases: number };

export type EventRoi = {
  event: string;
  spendRs: number;
  spendSharePct: number; // share of total event spend, 0-100
  revenueRs: number;
  hasRevenue: boolean;
  roiPct: number | null; // (revenue - spend) / spend * 100; null when the event has no revenue
  roas: number | null; // revenue / spend; null when no revenue
  costPerPurchaseRs: number | null; // spend / purchases; null when no purchases
  material: boolean; // enough spend to judge
  note: string; // plain-English honesty label
};

// Materiality: an event needs a real ABSOLUTE amount of spend before its ROI/bleed means anything. Only an
// absolute floor - NOT a share gate: when one event dominates spend (e.g. Purchase at 95%), a share gate
// would wrongly hide a genuinely material bleed on a small-share event (e.g. Rs 1.35L bleeding at 1.7% share).
// Money bleeding is material because of its rupees, not its share.
const DEFAULT_MIN_SPEND = 1000; // Rs over the window

export function computeEventRoi(rows: EventRow[], opts?: { minSpendRs?: number }): EventRoi[] {
  const minSpend = opts?.minSpendRs ?? DEFAULT_MIN_SPEND;
  const total = rows.reduce((s, r) => s + Math.max(0, r.spendRs), 0);

  return rows
    .map((r): EventRoi => {
      const spendRs = Math.max(0, r.spendRs);
      const revenueRs = Math.max(0, r.revenueRs);
      const share = total > 0 ? spendRs / total : 0;
      const hasRevenue = revenueRs > 0 && spendRs > 0;
      const material = spendRs >= minSpend;
      return {
        event: r.event || "unknown",
        spendRs: Math.round(spendRs),
        spendSharePct: Math.round(share * 100),
        revenueRs: Math.round(revenueRs),
        hasRevenue,
        roiPct: hasRevenue ? Math.round(((revenueRs - spendRs) / spendRs) * 100) : null,
        roas: hasRevenue ? Math.round((revenueRs / spendRs) * 100) / 100 : null,
        costPerPurchaseRs: r.purchases > 0 ? Math.round(spendRs / r.purchases) : null,
        material,
        note: !material
          ? "Too little spend to judge yet."
          : hasRevenue
            ? "ROI from real purchase value."
            : "No rupee revenue is attributed to this event - judge it on cost per result, not ROI.",
      };
    })
    .sort((a, b) => b.spendRs - a.spendRs);
}
