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
