// Cost-budgeted AI-critic escalation (charter §53-56 + §70 AI cost). The deterministic critic (critic-review)
// runs free on everything; the AI critic (lib/judgment/critic.ts) is expensive, so we only spend it where a
// second opinion earns its cost: high-stakes decisions that LOOK confident (the deterministic critic upheld
// them) - exactly the confident-but-maybe-wrong calls that cost money. This file is the pure planner: it picks
// WHICH decisions to escalate within a budget; the actual AI call stays behind a seam in the caller.

import type { OutputContract } from "./output-contract.ts";
import { reviewContract } from "./critic-review.ts";

const RANK = { high: 2, med: 1, low: 0 } as const;

export type EscalationPlan = {
  escalate: OutputContract[]; // worth an AI critic pass, highest-stakes first, within budget
  candidates: number; // how many qualified before the budget cap
  projectedCostUsd: number;
};

// Pick the decisions worth the AI critic's money: a real decision, already UPHELD by the free critic (so it
// looks solid), still claiming high/med confidence, above a rupee floor. Ranked by money at stake, capped at
// maxCalls. A HOLD or an already-downgraded decision is never escalated (the free pass already handled it).
export function planEscalation(
  cs: OutputContract[],
  opts: { maxCalls: number; costPerCallUsd: number; minImpactRs?: number },
): EscalationPlan {
  const floor = opts.minImpactRs ?? 10000;
  const qualified = cs.filter((c) => {
    if (!c.decision) return false;
    if ((c.economicImpactRs ?? 0) < floor) return false;
    if (RANK[c.confidence] < RANK.med) return false; // low-confidence calls aren't the dangerous ones
    return reviewContract(c).verdict === "upheld"; // the free critic already lowered the flagged ones
  });
  const ranked = [...qualified].sort((a, b) => (b.economicImpactRs ?? 0) - (a.economicImpactRs ?? 0));
  const escalate = ranked.slice(0, Math.max(0, opts.maxCalls));
  return {
    escalate,
    candidates: qualified.length,
    projectedCostUsd: Number((escalate.length * opts.costPerCallUsd).toFixed(4)),
  };
}
