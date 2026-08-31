// Deterministic demo Google account for DEMO mode (no developer token yet). Fixed numbers, no randomness,
// so the diagnosis is stable and gate-testable. Deliberately spans campaign types + states so every engine
// rule has something to bite on: a budget-capped winner (R1), a budget-capped loser (R2), a rank-capped
// campaign (R3), one still learning (R5), a low-Quality-Score campaign (R8), an eCPC campaign (R14), and one
// ready for value bidding (R15). MUST be presented as demo, never as real numbers. Pure, node-gate-able.

import type { GoogleAccountSnapshot } from "./types.ts";

export function demoGoogleAccount(accountName = "Google Ads (demo)"): GoogleAccountSnapshot {
  return {
    accountExternalId: "demo",
    accountName,
    windowDays: 30,
    campaigns: [
      {
        campaignId: "g_srch_brand", name: "Search - Brand", type: "search", bidStrategy: "target_roas",
        cost: 84000, conversions: 210, conversionValue: 378000, conversions7d: 52,
        roas: 4.5, cpa: 400, targetRoas: 3.0, distinctConversionValues: true,
        impressionShare: 0.71, lostIsBudget: 0.22, lostIsRank: 0.07,
        qualityScore: 8, expectedCtrBucket: "above_average", adRelevanceBucket: "above_average", landingPageBucket: "average",
        learningStatus: "eligible", daysSinceLastChange: 26,
      },
      {
        campaignId: "g_srch_generic", name: "Search - Generic", type: "search", bidStrategy: "target_cpa",
        cost: 61000, conversions: 44, conversionValue: 73000, conversions7d: 11,
        roas: 1.2, cpa: 1386, targetCpa: 700, distinctConversionValues: false,
        impressionShare: 0.55, lostIsBudget: 0.18, lostIsRank: 0.27,
        qualityScore: 6, expectedCtrBucket: "average", adRelevanceBucket: "average", landingPageBucket: "average",
        learningStatus: "eligible", daysSinceLastChange: 40,
      },
      {
        campaignId: "g_srch_compete", name: "Search - Competitor", type: "search", bidStrategy: "maximize_conversions",
        cost: 38000, conversions: 26, conversionValue: 41000, conversions7d: 8,
        roas: 1.08, cpa: 1461, targetCpa: null, distinctConversionValues: false,
        impressionShare: 0.41, lostIsBudget: 0.03, lostIsRank: 0.35,
        qualityScore: 3, expectedCtrBucket: "below_average", adRelevanceBucket: "average", landingPageBucket: "average",
        learningStatus: "eligible", daysSinceLastChange: 33,
      },
      {
        campaignId: "g_pmax_core", name: "Performance Max - Core", type: "performance_max", bidStrategy: "maximize_conversion_value",
        cost: 132000, conversions: 300, conversionValue: 528000, conversions7d: 9,
        roas: 4.0, cpa: 440, targetRoas: 3.5, distinctConversionValues: true,
        impressionShare: null, lostIsBudget: null, lostIsRank: null,
        learningStatus: "learning", daysSinceLastChange: 5,
      },
      {
        campaignId: "g_shop_all", name: "Shopping - All Products", type: "shopping", bidStrategy: "maximize_conversions",
        cost: 96000, conversions: 88, conversionValue: 402000, conversions7d: 24,
        roas: 4.18, cpa: 1090, targetRoas: null, distinctConversionValues: true,
        impressionShare: 0.63, lostIsBudget: 0.06, lostIsRank: 0.31,
        learningStatus: "eligible", daysSinceLastChange: 51,
      },
      {
        campaignId: "g_disp_retarget", name: "Display - Retargeting", type: "display", bidStrategy: "ecpc",
        cost: 22000, conversions: 40, conversionValue: 96000, conversions7d: 10,
        roas: 4.36, cpa: 550, targetCpa: 600, distinctConversionValues: false,
        learningStatus: "eligible", daysSinceLastChange: 60,
      },
    ],
  };
}
