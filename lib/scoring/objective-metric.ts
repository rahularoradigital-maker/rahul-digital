// The objective -> headline metric mapping, in ONE place. The Phase-0 audit found this switch duplicated
// VERBATIM in change-impact.ts and recent-vs-baseline.ts (14 identical lines, differing only in a field name),
// plus partial copies elsewhere. Two copies of "what does this objective optimise for" is how ROAS-vs-CPC
// verdicts silently diverge between screens. Both engines now import from here. PURE, no I/O.

export type MetricObjective = "conversion" | "traffic" | "engagement" | "awareness" | "leads" | "app_installs";

// A window aggregate the metric is formed from. `conversions` = purchases/results for the objective.
export type MetricAgg = { spend: number; impressions: number; clicks: number; conversions: number; revenue: number };

export type ObjectiveMetric = {
  name: string;
  higherIsBetter: boolean;
  // null when the denominator is zero, i.e. the metric cannot be formed - callers must treat that as
  // "insufficient", never as 0.
  compute: (a: MetricAgg) => number | null;
};

export function metricFor(objective: MetricObjective): ObjectiveMetric {
  switch (objective) {
    case "conversion":
      return { name: "ROAS", higherIsBetter: true, compute: (a) => (a.spend > 0 ? a.revenue / a.spend : null) };
    case "leads":
    case "app_installs":
      return { name: "cost per result", higherIsBetter: false, compute: (a) => (a.conversions > 0 ? a.spend / a.conversions : null) };
    case "awareness":
      return { name: "CPM", higherIsBetter: false, compute: (a) => (a.impressions > 0 ? (a.spend / a.impressions) * 1000 : null) };
    case "traffic":
      return { name: "CPC", higherIsBetter: false, compute: (a) => (a.clicks > 0 ? a.spend / a.clicks : null) };
    case "engagement":
    default:
      return { name: "CTR", higherIsBetter: true, compute: (a) => (a.impressions > 0 ? a.clicks / a.impressions : null) };
  }
}
