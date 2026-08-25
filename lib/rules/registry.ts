// Centralized Rule Library (rules engine = source of truth, brief.md "Engines").
// Business logic lives HERE as data, not hardcoded in features. Every rule carries
// its formula, trigger, threshold, exceptions, and a citation to the spec artifact
// it came from. Uncalibrated thresholds are the literal string "calibrate-at-build":
// a provisional placeholder is never presented as a validated number (brief.md
// "no arbitrary unvalidated thresholds").

export type Rule = {
  id: string;
  name: string;
  purpose: string;
  inputs: string[];
  formula: string; // human-readable, no invented numbers
  trigger: string;
  threshold: string; // "calibrate-at-build" where uncalibrated
  exceptions: string[]; // honesty guards: what invalidates the rule's verdict
  output: string;
  recommendedAction: string;
  confidenceRequirement: "low" | "medium" | "high";
  source: string; // the spec artifact this rule is drawn from
  version: string;
  reviewDate: string;
};

// Shared honesty guards (brief.md AUTOPSY gate). Every verdict must survive these.
const GUARD_SAMPLE = "Small sample: any input below its minimum data floor drops the verdict to INSUFFICIENT DATA, never a score";
const GUARD_TRACKING = "Tracking, attribution-window, pricing, or landing-page change inside the window explains the move, not the creative";
const GUARD_SEASONALITY = "Promotion or seasonality confound (sale event, Q4 auction pressure) explains the move externally";

export const RULES: Rule[] = [
  {
    id: "FAT-001",
    name: "Fatigue past half-life: stop spending",
    purpose: "Stop pouring budget into a creative that has degraded past the point where recent spend does useful work",
    inputs: ["frequency", "ctr", "daily spend", "daily performance window (per-ad, date-ordered)"],
    formula: "Fatigue score blends frequency saturation (repeat exposure vs the ad's own audience) with CTR decay (recent window vs the ad's own first window); past-half-life when the blended score crosses the half-life cutoff",
    trigger: "fatigue(rows) returns ok with pastHalfLife true",
    threshold: "calibrate-at-build",
    exceptions: [GUARD_SAMPLE, GUARD_TRACKING, GUARD_SEASONALITY, "Audience or placement changed mid-window (mechanical reset, not fatigue)"],
    output: "Ad flagged FATIGUED with the recent-window spend marked as at-risk",
    recommendedAction: "Pause or replace the creative; do not scale into fatigue",
    confidenceRequirement: "high",
    source: "docs/product-spec/07-fatigue-formula-library.md",
    version: "1.0.0",
    reviewDate: "2026-11-25",
  },
  {
    id: "FAT-002",
    name: "Emerging fatigue: watch and prepare",
    purpose: "Warn before the money is lost: leading attention signals (CTR, hook rate) move before outcome signals (CPA, ROAS) confirm",
    inputs: ["ctr trend", "hook rate trend", "frequency trend", "cpm trend", "multi-window comparison (recent vs baseline)"],
    formula: "Leading-signal decay (attention metrics falling vs the ad's own baseline) agreed across at least two windows, while outcome signals have not yet confirmed",
    trigger: "Fatigue score in the emerging band: above the watch cutoff but below the past-half-life cutoff",
    threshold: "calibrate-at-build",
    exceptions: [GUARD_SAMPLE, GUARD_TRACKING, GUARD_SEASONALITY, "Single-window move only: one-day moves are noise, not trend"],
    output: "Ad flagged EMERGING fatigue with the driving signals named",
    recommendedAction: "Watch; queue a replacement creative so the swap is ready before fatigue confirms",
    confidenceRequirement: "medium",
    source: "docs/product-spec/07-fatigue-formula-library.md",
    version: "1.0.0",
    reviewDate: "2026-11-25",
  },
  {
    id: "WST-001",
    name: "Below-floor spend waste",
    purpose: "Flag spend spread so thin the ad never got enough budget to prove itself; that spend reads no signal and is noise",
    inputs: ["total spend over window", "per-account spend floor"],
    formula: "Total window spend below the configured per-account spend floor marks the whole window's spend as below-floor waste",
    trigger: "totalSpend < spendFloor for the ad's window",
    threshold: "calibrate-at-build",
    exceptions: [GUARD_SAMPLE, GUARD_SEASONALITY, "Ad is newly launched and still ramping: early days under the floor are expected, not waste", "Deliberately small holdout or test cell"],
    output: "Below-floor spend amount flagged as waste with reason below_floor",
    recommendedAction: "Consolidate budget: fund fewer ads past the signal floor instead of many below it",
    confidenceRequirement: "medium",
    source: "docs/product-spec/brief.md",
    version: "1.0.0",
    reviewDate: "2026-11-25",
  },
  {
    id: "WST-002",
    name: "Fatigued spend waste",
    purpose: "Recent spend on a creative past its fatigue half-life is being poured into an ad that has stopped working",
    inputs: ["fatigue verdict (FAT-001)", "recent-window spend (date-ordered)"],
    formula: "When the fatigue rule fires past half-life, the recent-window spend on that ad is counted as fatigued waste",
    trigger: "fatigue pastHalfLife true AND recent-window spend above zero",
    threshold: "calibrate-at-build",
    exceptions: [GUARD_SAMPLE, GUARD_TRACKING, GUARD_SEASONALITY, "Ad is in a deliberate wind-down where residual spend is accepted"],
    output: "Recent-window spend flagged as waste with reason fatigued",
    recommendedAction: "Cut or reallocate the recent spend to healthy or emerging winners",
    confidenceRequirement: "high",
    source: "docs/product-spec/brief.md",
    version: "1.0.0",
    reviewDate: "2026-11-25",
  },
  {
    id: "SCL-001",
    name: "Scale a sustained winner with headroom",
    purpose: "Answer 'where does the next dollar go': scale entities whose marginal economics still work and whose audience is not saturated",
    inputs: ["roas (sustained, multi-window)", "frequency level", "marginal roas estimate", "saturation headroom", "fatigue state"],
    formula: "Sustained ROAS above the account's target across windows, frequency low enough to show unsaturated audience, positive saturation headroom, and fatigue state healthy combine into a SCALE verdict",
    trigger: "All four conditions hold together; any one failing downgrades to PROTECT or HOLD",
    threshold: "calibrate-at-build",
    exceptions: [GUARD_SAMPLE, GUARD_TRACKING, GUARD_SEASONALITY, "Marginal ROAS estimate is low-confidence: verdict becomes NEEDS MORE DATA, never a fabricated scale call", "Creative is fatiguing: never scale into fatigue"],
    output: "Entity flagged SCALE with a sized budget step",
    recommendedAction: "Increase budget stepwise and re-read marginal ROAS after each step",
    confidenceRequirement: "high",
    source: "docs/product-spec/01c-metric-dictionary-fatigue-diversity-scaling.md",
    version: "1.0.0",
    reviewDate: "2026-11-25",
  },
  {
    id: "LRN-001",
    name: "Do not kill in learning",
    purpose: "Insufficient data is a state, not a verdict: an ad still exiting learning must not be judged as waste or a loser",
    inputs: ["days live", "conversions to date", "learning-phase status", "minimum sample floor"],
    formula: "An ad below its minimum sample floor or still in the platform learning phase is excluded from waste, loser, and fatigue verdicts entirely",
    trigger: "Sample below floor OR learning phase active when a kill/waste rule would otherwise fire",
    threshold: "calibrate-at-build",
    exceptions: [GUARD_TRACKING, "Spend has far exceeded the account's proving budget with zero signal: the protection expires", "Structural breakage (rejected ad, broken link) is killable regardless of learning"],
    output: "Verdict forced to NEEDS MORE DATA; kill/waste rules suppressed for this ad",
    recommendedAction: "Do not act; let the ad reach its sample floor before judging it",
    confidenceRequirement: "low",
    source: "docs/product-spec/brief.md",
    version: "1.0.0",
    reviewDate: "2026-11-25",
  },
  {
    id: "CON-001",
    name: "Creative concentration risk",
    purpose: "A large spend share on one creative or concept is a single point of failure and hidden fatigue risk",
    inputs: ["spend share per creative", "spend-weighted concentration index (HHI or top-N share)", "fatigue state of top creatives"],
    formula: "Spend-weighted concentration index per dimension (creative, concept, hook, persona); risk flagged when the top creative's share crosses the concentration cutoff",
    trigger: "Top-creative spend share above the concentration cutoff for the account",
    threshold: "calibrate-at-build",
    exceptions: [GUARD_SAMPLE, GUARD_SEASONALITY, "Concentration on a proven, healthy winner can be deliberate and acceptable: read with performance and fatigue, never alone", "Low tag confidence on creative attributes"],
    output: "Account flagged OVER-CONCENTRATED on the named dimension with the concentrated entities listed",
    recommendedAction: "Diversify: fund challenger creatives in adjacent concepts before the concentrated winner fatigues",
    confidenceRequirement: "medium",
    source: "docs/product-spec/06-diversity-formula-library.md",
    version: "1.0.0",
    reviewDate: "2026-11-25",
  },
  {
    id: "PRD-001",
    name: "Replacement-creative production trigger",
    purpose: "Tie creative supply to demand: fatiguing spend without a ready replacement forces a production request before the account starves",
    inputs: ["fatigue forecast (per-ad)", "spend on fatiguing ads", "count of ready replacement creatives", "replacement rate"],
    formula: "Forecast spend on ads expected to fatigue inside the planning window, minus coverage from ready replacements, yields the production shortfall",
    trigger: "Forecast fatiguing spend exceeds ready-replacement coverage for the planning window",
    threshold: "calibrate-at-build",
    exceptions: [GUARD_SAMPLE, GUARD_SEASONALITY, "Fatigue forecast is a MODEL ESTIMATE, never a fact: low-confidence forecasts request a watch, not production", "Planned spend reduction makes the shortfall moot"],
    output: "Production request naming how many creatives are needed and which concepts to replace",
    recommendedAction: "Brief and produce replacement creatives now so swaps land before fatigue confirms",
    confidenceRequirement: "medium",
    source: "docs/product-spec/07-fatigue-formula-library.md",
    version: "1.0.0",
    reviewDate: "2026-11-25",
  },
];

export function getRule(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id);
}

export function ruleIds(): string[] {
  return RULES.map((r) => r.id);
}
