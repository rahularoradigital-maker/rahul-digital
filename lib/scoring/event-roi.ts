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
  thinSample: boolean; // has revenue but few purchases - ROI is directional only, not stable
  note: string; // plain-English honesty label
};

// Materiality: an event needs a real ABSOLUTE amount of spend before its ROI/bleed means anything. Only an
// absolute floor - NOT a share gate: when one event dominates spend (e.g. Purchase at 95%), a share gate
// would wrongly hide a genuinely material bleed on a small-share event (e.g. Rs 1.35L bleeding at 1.7% share).
// Money bleeding is material because of its rupees, not its share.
const DEFAULT_MIN_SPEND = 1000; // Rs over the window
const MIN_PURCHASES = 25; // below this, a revenue ROI is directional only (too few conversions to be stable)

// One-glance money split: total event spend and how it divides between events that produce rupee revenue
// (direct response) and events that don't (awareness - Reach, Profile visit, engagement). Honest CFO view of
// where the money actually goes. Null when there is no event spend at all.
export function eventSpendSplit(rows: EventRoi[]): { totalRs: number; revenuePct: number; awarenessPct: number } | null {
  const total = rows.reduce((s, e) => s + e.spendRs, 0);
  if (total <= 0) return null;
  const revenue = rows.filter((e) => e.hasRevenue).reduce((s, e) => s + e.spendRs, 0);
  const revenuePct = Math.round((revenue / total) * 100);
  return { totalRs: Math.round(total), revenuePct, awarenessPct: 100 - revenuePct };
}

// A grounded reallocation insight (no AI): identifies spend on CONVERSION-INTENT events that are returning
// BELOW break-even (real revenue but negative ROI) against the best revenue event, and sizes the ₹ at stake.
// It deliberately does NOT count no-revenue awareness events (Reach, Profile visit) as "bleeding" - those
// serve a different goal and have no ROI to judge. Returns null when nothing is clearly bleeding.
export function eventBleedSummary(rows: EventRoi[]): { line: string; bleedRs: number } | null {
  const revenueEvents = rows.filter((e) => e.material && e.hasRevenue && e.roiPct !== null);
  const bleeders = revenueEvents.filter((e) => (e.roiPct as number) < 0);
  if (bleeders.length === 0) return null;
  const best = revenueEvents.reduce<EventRoi | null>((b, e) => (!b || (e.roiPct as number) > (b.roiPct as number) ? e : b), null);
  const bleedRs = Math.round(bleeders.reduce((s, e) => s + e.spendRs, 0));
  const names = bleeders
    .slice(0, 3)
    .map((e) => `${e.event.replace(/_/g, " ").toLowerCase()} ${e.roiPct}%`)
    .join(", ");
  const bestPart = best && (best.roiPct as number) > 0 ? ` while ${best.event.replace(/_/g, " ").toLowerCase()} returns +${best.roiPct}%` : "";
  return { bleedRs, line: `Rs ${bleedRs.toLocaleString("en-IN")} is on conversion-intent events returning below break-even (${names})${bestPart}. Shifting that budget toward your best-returning event is likely higher ROI.` };
}

// --- Trend: is a bleeding event getting worse or recovering? A single-window ROI cannot tell a new problem
// from a chronic one, so we compare the same event's ROI against the equal-length window just before it. Only
// events with real revenue in BOTH windows get a trend - never a fabricated arrow on thin/awareness data.
export type EventTrend = { event: string; deltaPct: number; direction: "worsening" | "improving" | "flat" };
const TREND_THRESHOLD = 5; // ROI percentage points; smaller moves are noise, shown as flat

export function eventRoiTrend(current: EventRoi[], prior: EventRoi[]): Map<string, EventTrend> {
  const prev = new Map(prior.filter((e) => e.roiPct !== null).map((e) => [e.event, e.roiPct as number]));
  const out = new Map<string, EventTrend>();
  for (const e of current) {
    if (e.roiPct === null) continue;
    const before = prev.get(e.event);
    if (before === undefined) continue; // no comparable revenue last window - no trend, not a guess
    const deltaPct = e.roiPct - before;
    const direction = Math.abs(deltaPct) < TREND_THRESHOLD ? "flat" : deltaPct < 0 ? "worsening" : "improving";
    out.set(e.event, { event: e.event, deltaPct: Math.round(deltaPct), direction });
  }
  return out;
}

// The equal-length window immediately before [since, until] (UTC, inclusive "YYYY-MM-DD"). Pure, so it is
// testable without a clock and never drifts by timezone.
export function priorWindow(since: string, until: string): { priorSince: string; priorUntil: string } {
  const DAY = 86400000;
  const s = Date.parse(since + "T00:00:00Z");
  const u = Date.parse(until + "T00:00:00Z");
  const len = Math.round((u - s) / DAY) + 1; // inclusive day count
  const priorUntil = new Date(s - DAY);
  const priorSince = new Date(s - DAY * len);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { priorSince: iso(priorSince), priorUntil: iso(priorUntil) };
}

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
        thinSample: hasRevenue && r.purchases > 0 && r.purchases < MIN_PURCHASES,
        note: !material
          ? "Too little spend to judge yet."
          : hasRevenue
            ? r.purchases > 0 && r.purchases < MIN_PURCHASES
              ? `ROI from real purchase value, but only ${r.purchases} purchase${r.purchases === 1 ? "" : "s"} - directional, not stable.`
              : "ROI from real purchase value."
            : "No rupee revenue is attributed to this event - judge it on cost per result, not ROI.",
      };
    })
    .sort((a, b) => b.spendRs - a.spendRs);
}
