// Google-native data shapes. Deliberately NOT the shared Meta MetricsRow: Google's decisive fields
// (impression share, Lost IS budget/rank, Quality Score, tROAS attainment, bid strategy, learning status)
// have no Meta equivalent, so forcing them into the shared row would either pollute Meta or lose the signal.
// Keeping them here honours Rahul's "separate track for Google vs Meta". Pure module (no imports).

import type { GoogleCampaignType } from "./campaign-types.ts";

export type BidStrategy =
  | "manual_cpc"
  | "maximize_clicks"
  | "maximize_conversions"
  | "target_cpa"
  | "maximize_conversion_value"
  | "target_roas"
  | "target_impression_share"
  | "ecpc"; // deprecated (sunset week of 2025-03-31); flagged for forced migration

export type QualityBucket = "below_average" | "average" | "above_average";

// One campaign's current state, aggregated over the selected window. Everything the deterministic
// engine (R1-R15) needs to route a decision. Optional fields = "not reported / not applicable for this
// campaign type" (e.g. Quality Score is Search-only), read as absent, never as 0.
export type GoogleCampaignSnapshot = {
  campaignId: string;
  name: string;
  type: GoogleCampaignType;
  bidStrategy: BidStrategy;

  // Money + outcome (window totals)
  cost: number;
  conversions: number;
  conversionValue: number;
  conversions7d: number; // recency, for the learning-fed check (R4)

  // Efficiency + target
  roas: number | null; // conversionValue / cost
  cpa: number | null; // cost / conversions
  targetRoas?: number | null; // the tROAS set on the campaign, if value-based
  targetCpa?: number | null; // the tCPA set, if conversion-count based
  distinctConversionValues?: boolean; // are differentiated values passed (tROAS eligibility)

  // Impression share (Search / Shopping / PMax; absent for Demand Gen / Video)
  impressionShare?: number | null; // 0..1
  lostIsBudget?: number | null; // 0..1
  lostIsRank?: number | null; // 0..1

  // Auction quality (Search)
  qualityScore?: number | null; // 1..10
  expectedCtrBucket?: QualityBucket;
  adRelevanceBucket?: QualityBucket;
  landingPageBucket?: QualityBucket;

  // Learning / change hygiene
  learningStatus?: "learning" | "eligible" | "limited" | "misconfigured";
  daysSinceLastChange?: number | null; // days since last bid/budget/target/structural change
};

export type GoogleAccountSnapshot = {
  accountExternalId: string;
  accountName: string;
  windowDays: number;
  campaigns: GoogleCampaignSnapshot[];
};
