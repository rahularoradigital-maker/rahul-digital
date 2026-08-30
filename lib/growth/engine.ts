// Growth-agent brain (spec sections 6, 7, 8, 11). Pure, no I/O - fully testable (scripts/check-growth.ts).
// Takes a normalized Conversation, scores the opportunity with DOCUMENTED weights, runs the promotion gate,
// and decides an action. The autonomous ceiling is DRAFT/REQUEST_APPROVAL - the engine NEVER decides to
// publish (publishing is a human action by design). Every number here is defined and defended, never arbitrary.

import { INTENT_SIGNALS, BRAND } from "./knowledge.ts";

// --- Conversation object (section 6) ---
export type Conversation = {
  conversationId: string;
  platform: string; // reddit | quora | linkedin | x | youtube | web
  community: string; // subreddit / space / channel
  author: string | null;
  url: string;
  timestamp: string; // ISO
  content: string;
  title?: string;
  // enriched:
  topic?: string;
  intent?: "problem_aware" | "solution_research" | "tool_comparison" | "none";
  audience?: string;
  sentiment?: "neg" | "neutral" | "pos";
  question?: boolean;
  painPoint?: string | null;
  commercialIntent?: number; // 0..1
};

// --- OPPORTUNITY SCORE weights (section 7). Documented + must sum to 1 across the positive factors; risk is a
// separate 0..1 penalty applied multiplicatively. Tunable here, versioned, NEVER arbitrary at a call site. ---
export const OPP_WEIGHTS = {
  relevance: 0.18, // topical match to what AdScale solves
  intent: 0.18, // problem-aware / researching a solution (not idle chatter)
  solutionFit: 0.15, // how squarely AdScale can genuinely help this specific problem
  commercialIntent: 0.12, // signs of budget / buying stage
  audienceFit: 0.1, // matches an ICP
  problemSeverity: 0.09, // acute pain (wasted spend, "tanked") > mild curiosity
  recency: 0.08, // fresh threads convert; old ones are learn-only
  communityQuality: 0.06, // a real practitioner community vs low-signal
  competition: 0.04, // fewer existing good answers = more room to help
} as const;
const WEIGHT_SUM = Object.values(OPP_WEIGHTS).reduce((a, b) => a + b, 0); // asserted ~1.0 in the check

export type OppFactors = { [K in keyof typeof OPP_WEIGHTS]: number } & { risk: number };

export type Opportunity = {
  conversation: Conversation;
  factors: OppFactors;
  score: number; // 0..1
  promote: PromotionVerdict;
  decision: GrowthAction;
  why: string[];
};

export type GrowthAction = "IGNORE" | "MONITOR" | "LEARN" | "DRAFT" | "REQUEST_APPROVAL";

// Clamp helper.
const c01 = (v: number) => Math.max(0, Math.min(1, v));

// Topic + fit from the intent signals: the best-matching signal's fit, and whether any phrase appears.
export function matchIntent(text: string): { topic: string | null; fit: number; matched: boolean } {
  const t = text.toLowerCase();
  let best: { topic: string; fit: number } | null = null;
  for (const s of INTENT_SIGNALS) {
    if (s.phrases.some((p) => t.includes(p))) {
      if (!best || s.adscaleFit > best.fit) best = { topic: s.topic, fit: s.adscaleFit };
    }
  }
  return best ? { topic: best.topic, fit: best.fit, matched: true } : { topic: null, fit: 0, matched: false };
}

// --- OPPORTUNITY SCORE (section 7) ---
export function opportunityScore(f: OppFactors): number {
  const positive =
    OPP_WEIGHTS.relevance * f.relevance +
    OPP_WEIGHTS.intent * f.intent +
    OPP_WEIGHTS.solutionFit * f.solutionFit +
    OPP_WEIGHTS.commercialIntent * f.commercialIntent +
    OPP_WEIGHTS.audienceFit * f.audienceFit +
    OPP_WEIGHTS.problemSeverity * f.problemSeverity +
    OPP_WEIGHTS.recency * f.recency +
    OPP_WEIGHTS.communityQuality * f.communityQuality +
    OPP_WEIGHTS.competition * f.competition;
  return c01((positive / WEIGHT_SUM) * (1 - 0.6 * c01(f.risk))); // risk can cut up to 60% - documented ceiling
}

// --- PROMOTION GATE (section 11). Mention AdScale ONLY if every gate passes. ---
export type PromotionVerdict = { mayMention: boolean; reasons: string[] };
export function promotionGate(f: OppFactors, communityAllowsPromo: boolean): PromotionVerdict {
  const checks: [boolean, string][] = [
    [f.solutionFit >= 0.6, "AdScale genuinely fits the problem"],
    [communityAllowsPromo, "the community permits a product mention"],
    [f.intent >= 0.5, "the person is actually researching a solution"],
    [f.commercialIntent >= 0.3, "there is a legitimate commercial reason"],
  ];
  const failed = checks.filter(([ok]) => !ok).map(([, why]) => `not met: ${why}`);
  return { mayMention: failed.length === 0, reasons: failed.length ? failed : ["all promotion gates passed"] };
}

// --- DECISION ENGINE (section 8). Autonomous ceiling is DRAFT/REQUEST_APPROVAL - never PUBLISH. ---
export function decide(score: number, f: OppFactors, promote: PromotionVerdict): GrowthAction {
  if (score < 0.3) return "IGNORE";
  if (score < 0.45) return "MONITOR";
  if (score < 0.6) return "LEARN"; // extract the insight for content, don't reply
  // score >= 0.6: worth a human-reviewed draft. High risk or a promo in a sensitive spot -> strict approval.
  if (f.risk >= 0.5 || (promote.mayMention && f.risk >= 0.3)) return "REQUEST_APPROVAL"; // Level 3
  return "DRAFT"; // Level 2: draft now, human approves before anything leaves
}

// Compose the full opportunity from a scored conversation.
export function assess(conv: Conversation, f: OppFactors, communityAllowsPromo: boolean): Opportunity {
  const score = opportunityScore(f);
  const promote = promotionGate(f, communityAllowsPromo);
  const decision = decide(score, f, promote);
  const why = [
    `score ${(score * 100).toFixed(0)}/100 (relevance ${f.relevance.toFixed(2)}, intent ${f.intent.toFixed(2)}, fit ${f.solutionFit.toFixed(2)}, risk ${f.risk.toFixed(2)})`,
    promote.mayMention ? "AdScale mention permitted (be useful first)" : `no AdScale mention: ${promote.reasons[0]}`,
    `action: ${decision}`,
  ];
  return { conversation: conv, factors: f, score, promote, decision, why };
}

export { WEIGHT_SUM, BRAND };
