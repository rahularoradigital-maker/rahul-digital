// Judge an ad on the metrics its campaign OBJECTIVE actually optimises for. A conversion /
// sale / catalog campaign is read on ROAS + CPA (then LP-view rate, add-to-cart rate, CTR);
// an awareness / engagement / traffic campaign has few or no purchases, so ROAS is ~0 BY
// DESIGN and reading it on ROAS mislabels it a loser. Those are read on CPM, CTR, link CPC
// and LP-views instead. This module is the single source of truth for that split, so the
// judge in cockpit/analyze.ts never guesses from a magic "!= conversion" check. Pure, no I/O.

import type { Objective } from "./comparator.ts";

/** Which metric family governs the check / judge / suggest for an ad. */
export type MetricFamily = "sales" | "awareness";

// The objectives read on reach + engagement metrics, not on sales metrics. Everything not in
// this set (conversion, and any unknown objective) defaults to "sales", i.e. the prior ROAS-led
// behaviour, so nothing regresses for conversion accounts. leads / app_installs sit here because
// they carry no ROAS and are already judged on their own funnel metric (CTR/CPC), not on sales.
const AWARENESS_OBJECTIVES: ReadonlySet<Objective> = new Set<Objective>([
  "awareness",
  "engagement",
  "traffic",
  "leads",
  "app_installs",
]);

/**
 * Map every Objective to the metric family that judges it.
 *  - "sales": conversion (Sale / Catalog map to "conversion" upstream). Read on ROAS + CPA,
 *    then LP-view rate, add-to-cart rate, CTR.
 *  - "awareness": awareness, engagement, traffic, leads, app_installs. Read on CPM, CTR, link
 *    CPC, LP-views. ROAS is ~0 by design here, so it is NOT a kill signal.
 * Unknown / missing objective falls back to "sales" (the prior, safe default).
 */
export function objectiveFamily(objective: Objective): MetricFamily {
  return AWARENESS_OBJECTIVES.has(objective) ? "awareness" : "sales";
}

/** The metrics that govern each family, in priority order. For the explainable "why" line. */
export const FAMILY_METRICS: Record<MetricFamily, string> = {
  sales: "ROAS, CPA, LP-view rate, add-to-cart rate, CTR",
  awareness: "CPM, CTR, link CPC, LP-views",
};

/**
 * The one-line reason a verdict is read on this family, for the ad's "why" list. Names the
 * objective-appropriate metrics so an awareness ad is never silently judged on a 0 ROAS.
 */
export function objectiveReason(objective: Objective): string {
  return objectiveFamily(objective) === "awareness"
    ? `Awareness/engagement ad: ${FAMILY_METRICS.awareness} are the read, not ROAS.`
    : `Conversion ad: ${FAMILY_METRICS.sales} are the read.`;
}

// The single headline metric to SHOW for an ad, matched to its objective - so an awareness / engagement
// ad never displays a "0.0x ROAS" that reads as a ROAS verdict. Sales -> ROAS; awareness -> CPM (reach
// cost); traffic/leads/app_installs -> link CPC (click cost); engagement -> CTR. Value is "n/a" (never a
// fabricated number) when the inputs to form it are absent (e.g. an old cache without impressions/clicks).
export type ObjectiveHeadline = { label: string; value: string };
export function objectiveHeadline(
  objective: Objective,
  m: { spendRs: number; roas: number | null; impressions?: number; clicks?: number },
): ObjectiveHeadline {
  const impr = m.impressions ?? 0;
  const clicks = m.clicks ?? 0;
  if (objectiveFamily(objective) === "sales") {
    return { label: "ROAS", value: m.roas == null ? "n/a" : `${m.roas.toFixed(1)}x` };
  }
  if (objective === "awareness") {
    const cpm = impr > 0 ? (m.spendRs / impr) * 1000 : null;
    return { label: "CPM", value: cpm == null ? "n/a" : `₹${Math.round(cpm)}` };
  }
  if (objective === "traffic" || objective === "leads" || objective === "app_installs") {
    const cpc = clicks > 0 ? m.spendRs / clicks : null;
    return { label: "CPC", value: cpc == null ? "n/a" : `₹${cpc.toFixed(1)}` };
  }
  // engagement
  const ctr = impr > 0 ? (clicks / impr) * 100 : null;
  return { label: "CTR", value: ctr == null ? "n/a" : `${ctr.toFixed(2)}%` };
}
