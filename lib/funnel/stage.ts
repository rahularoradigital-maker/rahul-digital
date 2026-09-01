// Funnel STAGE classifier (pure, no I/O; gated by scripts/check-funnel-diagnosis.ts).
// Answers "where does this ad sit" - top / middle / bottom of funnel - as two separate signals, strongest
// first: the ad-set OPTIMIZATION GOAL (what Meta actually delivers against) beats the campaign OBJECTIVE
// (a weaker clue). When the two disagree it trusts the goal, LOWERS confidence, and flags the ad for a human
// - it never hides the disagreement. When only the objective is known and it is "traffic" or "engagement"
// (which can honestly be run as either TOF or MOF) it also lowers confidence and flags review.
//
// This is a name-free, deterministic classifier grounded in Meta's own goal/objective vocabulary. Confidence
// numbers are project heuristics (not a sourced benchmark) - honest, overridable, never dressed up as fact.
import type { Objective } from "../rules/comparator.ts";

export type FunnelStage = "TOF" | "MOF" | "BOF";
export type StageResult = {
  stage: FunnelStage;
  confidence: number; // 0..100, our heuristic
  reviewRequired: boolean;
  source: "optimization_goal" | "objective";
  note: string;
};

// Meta ad-set optimization goals -> stage. Uppercase raw Meta values. Unknown goal -> null (fall back to objective).
const GOAL_STAGE: Record<string, FunnelStage> = {
  REACH: "TOF", IMPRESSIONS: "TOF", AD_RECALL_LIFT: "TOF", THRUPLAY: "TOF", VIDEO_VIEWS: "TOF",
  POST_ENGAGEMENT: "TOF", PAGE_LIKES: "TOF", EVENT_RESPONSES: "TOF", ENGAGED_USERS: "TOF",
  LINK_CLICKS: "MOF", LANDING_PAGE_VIEWS: "MOF", QUALITY_CALL: "MOF", VISIT_INSTAGRAM_PROFILE: "MOF",
  OFFSITE_CONVERSIONS: "BOF", CONVERSIONS: "BOF", VALUE: "BOF", PURCHASE: "BOF", ADD_TO_CART: "BOF",
  COMPLETE_REGISTRATION: "BOF", LEAD_GENERATION: "BOF", QUALITY_LEAD: "BOF", SUBSCRIBE: "BOF", APP_INSTALLS: "BOF",
};

// Campaign objective (AdScale's internal union) -> stage. traffic + engagement are "arguable" (a traffic
// campaign is legitimately run as either top or middle of funnel), so they carry lower confidence + review.
function stageFromObjective(objective: Objective): { stage: FunnelStage; arguable: boolean } {
  switch (objective) {
    case "awareness": return { stage: "TOF", arguable: false };
    case "engagement": return { stage: "TOF", arguable: true };
    case "traffic": return { stage: "MOF", arguable: true };
    case "conversion":
    case "leads":
    case "app_installs": return { stage: "BOF", arguable: false };
    default: return { stage: "MOF", arguable: true };
  }
}

export function classifyStage(optimizationGoal: string | null | undefined, objective: Objective): StageResult {
  const goalStage = optimizationGoal ? GOAL_STAGE[optimizationGoal.toUpperCase()] ?? null : null;
  const obj = stageFromObjective(objective);

  if (goalStage) {
    if (goalStage === obj.stage) {
      return { stage: goalStage, confidence: 92, reviewRequired: false, source: "optimization_goal", note: "Optimization goal and campaign objective agree." };
    }
    return {
      stage: goalStage,
      confidence: 75,
      reviewRequired: true,
      source: "optimization_goal",
      note: `Optimization goal (${optimizationGoal}) says ${goalStage} but the campaign objective (${objective}) says ${obj.stage}; trusting the goal Meta actually delivers against. Worth a human check.`,
    };
  }

  // No usable optimization goal -> fall back to the campaign objective.
  if (obj.arguable) {
    return { stage: obj.stage, confidence: 60, reviewRequired: true, source: "objective", note: `No optimization goal available; objective "${objective}" can be run as either top or middle of funnel. Worth a human check.` };
  }
  return { stage: obj.stage, confidence: 80, reviewRequired: false, source: "objective", note: "No optimization goal available; classified from the campaign objective." };
}
