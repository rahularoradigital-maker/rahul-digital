// "The most effective metrics should be on top" (Rahul). On Google, which metric leads depends on the
// campaign type: a Search account lives on impression share + Quality Score, a PMax/Shopping account on
// conversion value at target ROAS, a Video account on view rate. This returns the ORDERED metric stack to
// surface first, per type, plus an account-level pick driven by where the spend actually is. Pure, gated.

import type { GoogleCampaignType, CampaignTypeSpec } from "./campaign-types.ts";
import { campaignTypeSpec } from "./campaign-types.ts";

export type MetricKey =
  | "roas" | "conversion_value" | "conversions" | "cpa"
  | "impression_share" | "lost_is_budget" | "lost_is_rank"
  | "quality_score" | "ctr" | "avg_cpc" | "conversion_rate"
  | "click_share" | "view_rate" | "cpv";

export type MetricSpec = { key: MetricKey; label: string; why: string };

const M: Record<MetricKey, MetricSpec> = {
  roas: { key: "roas", label: "ROAS", why: "revenue per rupee spent - the outcome value bidding optimises" },
  conversion_value: { key: "conversion_value", label: "Conv. value", why: "total revenue the campaign generated" },
  conversions: { key: "conversions", label: "Conversions", why: "outcome volume" },
  cpa: { key: "cpa", label: "Cost / conv.", why: "what each conversion costs vs your target" },
  impression_share: { key: "impression_share", label: "Impr. share", why: "how much of the eligible auction you actually captured" },
  lost_is_budget: { key: "lost_is_budget", label: "Lost IS (budget)", why: "share missed because budget ran out - the scale lever" },
  lost_is_rank: { key: "lost_is_rank", label: "Lost IS (rank)", why: "share missed because Ad Rank was too low - the competitiveness lever" },
  quality_score: { key: "quality_score", label: "Quality Score", why: "drives Ad Rank and the CPC you actually pay" },
  ctr: { key: "ctr", label: "CTR", why: "click-through rate; feeds expected-CTR quality" },
  avg_cpc: { key: "avg_cpc", label: "Avg. CPC", why: "average cost per click" },
  conversion_rate: { key: "conversion_rate", label: "Conv. rate", why: "clicks that convert" },
  click_share: { key: "click_share", label: "Click share", why: "clicks captured vs the maximum reachable (PMax/Shopping/Search)" },
  view_rate: { key: "view_rate", label: "View rate", why: "share of impressions watched - the consideration signal" },
  cpv: { key: "cpv", label: "CPV", why: "cost per view" },
};

// The ordered top-metric stack per campaign type - most decisive first.
const PRIORITY: Record<GoogleCampaignType, MetricKey[]> = {
  search: ["cpa", "roas", "lost_is_budget", "lost_is_rank", "quality_score", "impression_share", "ctr", "conversion_rate", "avg_cpc"],
  performance_max: ["roas", "conversion_value", "conversions", "click_share", "cpa", "conversion_rate"],
  shopping: ["roas", "conversion_value", "impression_share", "click_share", "avg_cpc", "conversion_rate"],
  display: ["cpa", "conversions", "impression_share", "ctr", "avg_cpc"],
  demand_gen: ["cpa", "conversions", "conversion_value", "ctr"],
  video: ["view_rate", "cpv", "conversions", "ctr"],
  app: ["cpa", "conversions", "roas"],
};

// The metric stack to lead with for a campaign of this type.
export function topMetricsFor(type: GoogleCampaignType): MetricSpec[] {
  return PRIORITY[type].map((k) => M[k]);
}

// Account-level: lead with the metrics of the campaign type carrying the most spend, so the dashboard's
// top row reflects where the money actually is (a Shopping-heavy account leads with ROAS; a Search-heavy
// one with impression share + Quality Score). Ties + empty -> Search (the most common default).
export function accountTopMetrics(spendByType: Partial<Record<GoogleCampaignType, number>>): {
  leadType: GoogleCampaignType;
  spec: CampaignTypeSpec;
  metrics: MetricSpec[];
} {
  let leadType: GoogleCampaignType = "search";
  let max = -1;
  for (const [type, spend] of Object.entries(spendByType) as [GoogleCampaignType, number][]) {
    if (spend > max) { max = spend; leadType = type; }
  }
  return { leadType, spec: campaignTypeSpec(leadType), metrics: topMetricsFor(leadType) };
}
