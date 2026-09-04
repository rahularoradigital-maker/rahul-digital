// Phase 8 (audit): the cockpit's shared TYPES, extracted from analyze.ts so the type surface has one clear
// home and the assembler (analyze.ts) is logic, not a type dump. Pure types only - no runtime logic, no I/O.
// analyze.ts imports these and re-exports them, so every existing `@/lib/cockpit/analyze` import keeps working.
import { wasteRollup, type ConcentrationResult } from "../rules/account.ts";
import type { VerdictInput, Verdict } from "../rules/verdict.ts";
import type { Objective } from "../rules/comparator.ts";
import type { FatigueRead } from "../scoring/fatigue.ts";
import type { RecentVsBaseline } from "../scoring/recent-vs-baseline.ts";
import type { Explanation } from "../scoring/rubrics.ts";
import type { OpportunityLoss } from "../scoring/opportunity.ts";
import type { WinnerScores } from "../scoring/winner.ts";
import type { AdJudgment } from "../judgment/agent.ts";

export type { Verdict } from "../rules/verdict.ts";

/** One ad as the cockpit needs it. Sub-scores are 0-100 (produced upstream by the
 *  scoring engines); the raw facts drive verdict, waste, and the action queue. */
export type CockpitAdInput = VerdictInput & {
  id: string;
  name: string;
  adSetId?: string; // parent ad set / campaign ids, for the Ads Manager deep link hierarchy
  campaignId?: string;
  adsetName?: string; // readable parent names, so money figures trace to a campaign / ad set
  campaignName?: string;
  active?: boolean; // current delivery status; false = paused/archived (hidden from suggestions)
  delivering?: boolean; // recent-spend liveness: false = no spend in the recent window (stopped), no action shown
  thumbUrl?: string | null; // best still image for the leaderboard thumbnail; null/absent when none
  objective: Objective;
  spendRs: number;
  revenueRs: number;
  wastedRs: number; // per-ad wasted spend (upstream waste calc; sample supplies it)
  impressions?: number; // for the objective-appropriate headline metric (CPM/CTR/CPC), never ROAS-only
  clicks?: number;
  // Absolute 0-100 objective score (scoring.healthScoreOf): ROAS-vs-benchmark for
  // conversion, CTR-vs-benchmark for click objectives, reach+freshness for awareness.
  // Optional so hand-built fixtures / the sample account fall back to CreativeScore.
  healthScore?: number | null;
  // Day-wise fatigue read + creative half-life (days to the fatigue floor). Optional so
  // fixtures without daily rows still type-check.
  fatigueRead?: FatigueRead;
  halfLifeDays?: number | null;
  recentVs30?: RecentVsBaseline; // additive 7d-vs-30d read (Ads Manager cross-check); not part of scoring
};

export type Priority = "DO_NOW" | "DO_NEXT" | "WATCH";

export type CockpitAction = { label: string; priority: Priority; why: string };

export type CockpitAd = {
  id: string;
  name: string;
  adSetId?: string; // parent ad set / campaign ids, for the Ads Manager deep link hierarchy
  campaignId?: string;
  adsetName?: string; // readable parent names, so money figures trace to a campaign / ad set
  campaignName?: string;
  active?: boolean; // current delivery status; false = paused/archived (hidden from suggestions)
  delivering?: boolean; // recent-spend liveness: false = stopped (no recent spend), excluded from the action queue
  thumbUrl?: string | null; // best still image for the leaderboard thumbnail; null/absent when none
  objective: Objective;
  spendRs: number;
  revenueRs: number;
  roas: number | null; // null when spend is 0 (never a fabricated ratio)
  conversions: number; // purchases in the window (real, from the day-wise rows)
  impressions?: number; // for the objective-appropriate headline (CPM/CTR/CPC), never ROAS-only -> old cache degrades
  clicks?: number;
  verdict: Verdict;
  score: number;
  confidence: number;
  why: string[];
  action: CockpitAction;
  wastedRs: number;
  fatigueRead?: FatigueRead; // day-wise fatigue read (state, trajectory, evidence)
  halfLifeDays?: number | null; // creative half-life: days to the fatigue floor
  recentVs30?: RecentVsBaseline; // 7d recent trend vs 30d baseline, on the ad's own metric (Ads Manager cross-check)
  winner?: WinnerScores; // multi-factor winner rank (quality x scale x stability x opportunity)
  judgment?: AdJudgment; // Triple-Label read (Evidence x Agreement x Confidence) from the parallel Judge agent
};

// Account creative half-life: the spend-weighted median of the ads' half-lives (days to the
// fatigue floor). Null when too few ads have a day-wise read to say anything honest.
export type CreativeHalfLife = {
  medianDays: number | null;
  assessedAds: number; // ads with a real day-wise half-life
  fatiguingAds: number; // ads whose fatigue state is fatiguing or fatigued
  basis: string;
};

// One ad's contribution to a money-bleeding total, so a headline rupee figure is always
// traceable to the exact ads + the calculation behind it (never an unexplained number).
export type SpendContributor = {
  adId: string;
  name: string;
  adSetId?: string;
  campaignId?: string;
  adsetName?: string; // readable campaign / ad set the ad belongs to
  campaignName?: string;
  amountRs: number; // the rupees this ad contributes to the total
  roas: number | null;
  spendRs: number;
  fatigueState?: string; // for at-risk rows
};

export type CockpitView = {
  dataSource: "SAMPLE" | "LIVE";
  totals: { spendRs: number; revenueRs: number; roas: number | null };
  accountHealth: { score: number; factLabel: "MODEL_ESTIMATE"; basis: string; explain: Explanation };
  creativeHalfLife: CreativeHalfLife;
  opportunity: OpportunityLoss; // money bleeding: wasted + at-risk (fatiguing) spend

  leaderboard: CockpitAd[]; // sorted by CreativeScore, best first
  doThis: (CockpitAction & { adId: string; adName: string; moneyAtStakeRs: number })[]; // priority tier, then money at stake
  waste: ReturnType<typeof wasteRollup>;
  wasteContributors: SpendContributor[]; // which ads make up the wasted spend + the math
  atRiskContributors: SpendContributor[]; // which fatiguing/fatigued ads make up the at-risk spend
  concentration: ConcentrationResult;
};
