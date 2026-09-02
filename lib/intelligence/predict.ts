// Bridge: a decided Output Contract -> a learning-loop Prediction (charter §112). Without this, the learning
// loop has nothing to grade; with it, every decision the product makes is recorded as a testable forward
// claim, and later graded against what the metric actually did. Pure. A HOLD or a decision-less contract ->
// null (nothing was predicted). Gradeability follows the outcome-engine rule: only "keep-spending" calls make
// an honest, comparable forward claim (a refresh/reallocate changes the thing, so its later metric isn't).

import type { OutputContract } from "./output-contract.ts";
import type { Prediction, Direction } from "./outcome.ts";

// Map a decision's plain-English call to (is it a keep-spending bet?, which direction we implicitly predict).
// keep-spending = we expect the ad to keep performing if left running (gradeable). Everything that changes the
// creative or moves budget is NOT gradeable - the same ad_id's later metric is no longer comparable.
function readCall(call: string): { gradeable: boolean; predicted: Direction } {
  const c = call.toLowerCase();
  if (/\bscale\b|increase budget|more budget|test more/.test(c)) return { gradeable: true, predicted: "improve" };
  if (/\bhold\b|continue|give it room|leave/.test(c)) return { gradeable: true, predicted: "stable" };
  // refresh / diversify / protect / reallocate / do not scale / address the leak -> a change; not gradeable,
  // but it IS a warning that, untouched, the metric would worsen (used for false-positive tracking).
  return { gradeable: false, predicted: "worsen" };
}

// The metric a decision is really about (so we observe the right number later). Defaults to roas.
function metricFor(kind: string): string {
  if (kind === "funnel") return "cvr";
  if (kind === "money-bleed") return "cpa";
  return "roas";
}

export function contractToPrediction(c: OutputContract): Prediction | null {
  if (!c.decision || !c.trust.ok) return null;
  const { gradeable, predicted } = readCall(c.decision.call);
  return {
    id: c.id,
    kind: c.kind,
    metric: metricFor(c.kind),
    predicted,
    confidence: c.confidence,
    gradeable,
    economicImpactRs: c.economicImpactRs ?? null,
  };
}

// Convenience: map a batch of contracts to predictions, dropping the ones with nothing to predict.
export function contractsToPredictions(cs: OutputContract[]): Prediction[] {
  return cs.map(contractToPrediction).filter((p): p is Prediction => p !== null);
}
