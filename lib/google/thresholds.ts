// Every numeric threshold the Google brain uses, in ONE place, each tagged with its provenance so we never
// pass off an invented number as fact (Rahul's rule: ground only real, sourced thresholds). "official" = a
// number Google publishes; "heuristic" = a widely-cited practitioner rule of thumb (labeled as such in the
// UI too). Kept in lib/google/ SEPARATE from Meta. Pure + relative-import-free + no server-only (node-gate-able).

export type Provenance = "official" | "heuristic";

export type Threshold = {
  value: number;
  provenance: Provenance;
  note: string;
  source: string;
};

export const GOOGLE_THRESHOLDS = {
  // --- Impression share: budget-vs-rank routing (the single most actionable Google lever) ---
  // Search IS + Lost IS(budget) + Lost IS(rank) ~= 100%. https://support.google.com/google-ads/answer/7103314
  lostIsBudgetConstrained: {
    value: 0.10, // >10% of eligible impressions lost to budget => meaningfully budget-capped
    provenance: "heuristic",
    note: "Lost IS (budget) above ~10-20% signals a budget-limited campaign. Industry rule of thumb, not a Google-published gate.",
    source: "https://count.co/metric/impression-share-lost-budget",
  },
  lostIsRankConstrained: {
    value: 0.20, // >20% lost to rank (with budget ~0) => an Ad Rank problem, not a money problem
    provenance: "heuristic",
    note: "Lost IS (rank) above ~20% with budget not the constraint signals a competitiveness/Ad Rank problem.",
    source: "https://www.dotidot.io/post/impression-share-google-ads-diagnose-budget-and-rank-issues",
  },

  // --- Quality Score (auction quality; Search) ---
  qualityScorePoor: {
    value: 4, // <=4 tends to pay a CPC premium
    provenance: "heuristic",
    note: "QS 7-10 is 'good' (often a CPC discount); QS <=4 is 'poor' and tends to pay a premium. Agency convention, not an official Google table.",
    source: "https://www.storegrowers.com/google-ads-quality-score/",
  },
  qualityScoreGood: {
    value: 7,
    provenance: "heuristic",
    note: "QS >=7 is generally considered good. Used as the pivot in the QS-priority score cost*(7-QS).",
    source: "https://searchengineland.com/google-ads-quality-score-cpcs-468204",
  },

  // --- Smart Bidding learning + eligibility (mostly OFFICIAL conversion floors) ---
  troasMinConversions30d: {
    value: 15, // Search/Display floor to run value bidding
    provenance: "official",
    note: "Target ROAS needs at least ~15 conversions in the last 30 days (Search/Display) to have enough data.",
    source: "https://support.google.com/google-ads/answer/6268637",
  },
  tcpaMinConversions30d: {
    value: 15,
    provenance: "official",
    note: "Target CPA floor is ~15 conversions / 30 days; ~30/30d is the recommended level for good performance.",
    source: "https://support.google.com/google-ads/answer/6268632",
  },
  troasRecommendedConversions30d: {
    value: 50, // reliable value optimization / PMax target-adding point
    provenance: "heuristic",
    note: "~50 conversions/30d (or ~50 total before adding a PMax tROAS) gives a reliable value-optimization read. Best-practice guidance.",
    source: "https://support.google.com/google-ads/answer/11189316",
  },
  learningWindowDays: {
    value: 14, // a change resets learning; ~7-14 days to settle
    provenance: "heuristic",
    note: "Smart Bidding learning is typically ~7 days, up to ~14. A 'learning' status beyond ~14 days signals misconfiguration, not normal learning.",
    source: "https://www.storegrowers.com/target-cpa/",
  },
  budgetChangeResetPct: {
    value: 0.20, // single changes >20% likely disrupt learning
    provenance: "heuristic",
    note: "Keep single budget/target changes <=~20% to avoid resetting the learning phase; scale in 20-30% steps then wait 1-2 weeks.",
    source: "https://lineardesign.com/blog/bidding-strategy-google-ads/",
  },

  // --- Auction Insights competitive routing ---
  positionAboveLosing: {
    value: 0.50, // competitor ranks above you >50% of shared auctions => losing the head-to-head
    provenance: "heuristic",
    note: "A competitor's Position Above Rate >50% (with their IS above yours) means you are losing the head-to-head: a rank problem.",
    source: "https://searchengineland.com/google-ads-auction-insights-461513",
  },
  outrankingRoomToPush: {
    value: 0.80, // you outrank everyone >80% and CPA below target => room to scale
    provenance: "heuristic",
    note: "Outranking Share >80% vs all competitors with CPA below target means room to push (raise budget/target).",
    source: "https://www.karooya.com/blog/google-ads-auction-insights-2026-guide-to-tracking-and-outmaneuvering-your-competitors/",
  },
} as const satisfies Record<string, Threshold>;

export type GoogleThresholdKey = keyof typeof GOOGLE_THRESHOLDS;

// Convenience: the raw number, so call sites read `t("lostIsBudgetConstrained")` not a magic literal.
export function t(key: GoogleThresholdKey): number {
  return GOOGLE_THRESHOLDS[key].value;
}
