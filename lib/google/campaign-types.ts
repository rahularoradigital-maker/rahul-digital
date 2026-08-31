// Google Ads campaign taxonomy + the metric that matters MOST per type ("most effective metric on top",
// Rahul's ask). Google is NOT Meta: there is no single funnel - Search lives or dies on impression share
// and Quality Score, PMax on conversion value at a target ROAS, Video on view rate. So each campaign type
// carries its own north-star + the diagnostics that actually move it. Kept in lib/google/ SEPARATE from the
// Meta brain (Rahul's rule). Pure + relative imports + no server-only, so scripts/check-*.ts can node-load it.
//
// Grounded in Google's own docs (not invented):
//  - PMax best practices: https://support.google.com/google-ads/answer/11189316
//  - Maximize conversion value / tROAS: https://support.google.com/google-ads/answer/7684216
//  - Demand Gen metrics: https://support.google.com/google-ads/answer/13695597
//  - Video optimization + view metrics: https://support.google.com/google-ads/answer/3013684
//  - App bid strategy: https://support.google.com/google-ads/answer/12073727

export type GoogleCampaignType =
  | "search"
  | "performance_max"
  | "shopping"
  | "display"
  | "demand_gen"
  | "video"
  | "app";

// What the algorithm is being asked to buy. value-based => judge on ROAS/conversion value; volume-based
// => judge on conversions at a target CPA; reach-based => judge on CPM/view rate, NOT conversions.
export type GoogleGoal = "conversion_value" | "conversions" | "installs" | "reach" | "consideration";

export type CampaignTypeSpec = {
  type: GoogleCampaignType;
  label: string;
  goal: GoogleGoal;
  northStar: string; // the ONE metric a buyer optimizes for this type - what goes on top
  primaryKpis: string[]; // the metrics that directly define success
  diagnostics: string[]; // secondary reads that explain WHY the north-star moved
  // Which cross-cutting Google metrics are meaningful here (they are not universal):
  hasImpressionShare: boolean; // IS / Lost IS(budget|rank) exist for Search, Shopping, PMax (+ Display IS)
  hasQualityScore: boolean; // Quality Score is a keyword-auction concept: Search (+ Shopping feed quality proxy)
  valueBased: boolean; // optimises conversion VALUE (ROAS) rather than conversion COUNT (CPA)
};

// One row per Google campaign type. Order = rough share of a typical D2C/retail account's spend + how
// action-oriented it is (Search/PMax/Shopping first: where the money and the levers are).
const SPECS: Record<GoogleCampaignType, CampaignTypeSpec> = {
  search: {
    type: "search",
    label: "Search",
    goal: "conversions",
    northStar: "Cost per conversion (CPA) at target",
    primaryKpis: ["conversions", "cost_per_conversion", "conversion_value", "roas"],
    diagnostics: ["search_impression_share", "lost_is_budget", "lost_is_rank", "quality_score", "ctr", "avg_cpc", "conversion_rate", "abs_top_is"],
    hasImpressionShare: true,
    hasQualityScore: true,
    valueBased: false,
  },
  performance_max: {
    type: "performance_max",
    label: "Performance Max",
    goal: "conversion_value",
    northStar: "Conversion value at target ROAS",
    primaryKpis: ["conversion_value", "roas", "conversions", "cost_per_conversion"],
    diagnostics: ["click_share", "new_customer_value", "asset_group_performance", "conversion_rate"],
    hasImpressionShare: true, // PMax reports click share; Shopping-in-PMax has IS-style diagnostics
    hasQualityScore: false, // no keyword Quality Score; asset strength is the closest proxy
    valueBased: true,
  },
  shopping: {
    type: "shopping",
    label: "Shopping",
    goal: "conversion_value",
    northStar: "ROAS",
    primaryKpis: ["conversion_value", "roas", "conversions"],
    diagnostics: ["benchmark_ctr", "benchmark_cpc", "search_impression_share", "click_share", "avg_cpc", "conversion_rate"],
    hasImpressionShare: true,
    hasQualityScore: false, // feed quality (titles/images) is the lever, not keyword QS
    valueBased: true,
  },
  display: {
    type: "display",
    label: "Display",
    goal: "conversions",
    northStar: "Conversions at target CPA",
    primaryKpis: ["conversions", "cost_per_conversion"],
    diagnostics: ["display_impression_share", "viewable_ctr", "view_through_conversions", "cpm", "avg_cpc"],
    hasImpressionShare: true,
    hasQualityScore: false,
    valueBased: false,
  },
  demand_gen: {
    type: "demand_gen",
    label: "Demand Gen",
    goal: "conversions",
    northStar: "Conversions (incl. view-through) at target CPA",
    primaryKpis: ["conversions", "cost_per_conversion", "conversion_value"],
    diagnostics: ["view_through_conversions", "unique_reach", "video_views", "ctr"],
    hasImpressionShare: false, // Demand Gen has no impression-share metric
    hasQualityScore: false,
    valueBased: false,
  },
  video: {
    type: "video",
    label: "Video (YouTube)",
    goal: "consideration",
    northStar: "View rate (consideration) or conversions (action), per campaign goal",
    primaryKpis: ["view_rate", "cpv", "conversions"],
    diagnostics: ["video_quartiles", "ctr", "view_through_conversions", "unique_reach", "frequency"],
    hasImpressionShare: false,
    hasQualityScore: false,
    valueBased: false,
  },
  app: {
    type: "app",
    label: "App",
    goal: "installs",
    northStar: "Cost per install / in-app action at target",
    primaryKpis: ["installs", "in_app_actions", "cost_per_conversion"],
    diagnostics: ["install_volume", "in_app_conversion_rate", "troas_attainment"],
    hasImpressionShare: false,
    hasQualityScore: false,
    valueBased: false, // value-based only when in-app purchase value is tracked (tROAS)
  },
};

export function campaignTypeSpec(type: GoogleCampaignType): CampaignTypeSpec {
  return SPECS[type];
}

export function allCampaignTypes(): CampaignTypeSpec[] {
  return Object.values(SPECS);
}

// Normalise a raw Google Ads advertising_channel_type (GAQL) or a loose label to our taxonomy.
// Unknown -> "search" (the safest, most-common default) rather than throwing, so a new channel type
// Google introduces never breaks ingestion - it just reads as Search until we map it explicitly.
export function normalizeChannelType(raw: string | null | undefined): GoogleCampaignType {
  const s = (raw ?? "").toUpperCase().replace(/[\s-]+/g, "_");
  if (s.includes("PERFORMANCE_MAX") || s === "PMAX") return "performance_max";
  if (s.includes("SHOPPING")) return "shopping";
  if (s.includes("DISPLAY")) return "display";
  if (s.includes("DEMAND_GEN") || s.includes("DISCOVERY")) return "demand_gen"; // Discovery migrated to Demand Gen
  if (s.includes("VIDEO") || s.includes("YOUTUBE")) return "video";
  if (s.includes("APP") || s.includes("MULTI_CHANNEL")) return "app";
  return "search";
}
