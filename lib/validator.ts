// The honesty gate. Plain, deterministic code (NO AI) that verifies the Strategist never
// invented a number and always cited real evidence. Pairs with lib/prompts/strategist.ts:
// the prompt asks for correctness; this enforces it before anything reaches the user.
//
// Fail closed: any structural problem returns cannot_verify with a reason, never throws.

import type { StrategistOutput } from "./prompts/strategist.ts";

export type ValidationResult = {
  verdict: "pass" | "cannot_verify";
  reasons: string[];
};

/**
 * Verify a Strategist output against the upstream ground truth.
 * @param output               the model's parsed JSON output
 * @param authoritativeNumbers every money_impact must byte/number-match one of these
 * @param evidenceIds          every rec's evidence_triple_ids must be a subset of these
 */
export function validateStrategistOutput(
  output: StrategistOutput,
  authoritativeNumbers: number[],
  evidenceIds: string[],
): ValidationResult {
  const reasons: string[] = [];

  // Structural guards first — fail closed, never trust the shape.
  if (output == null || typeof output !== "object") {
    return { verdict: "cannot_verify", reasons: ["output is not an object"] };
  }

  if (typeof output.verdict !== "string" || output.verdict.trim() === "") {
    reasons.push("verdict must be a non-empty string");
  }

  const recs = output.recommendations;
  if (!Array.isArray(recs)) {
    return { verdict: "cannot_verify", reasons: [...reasons, "recommendations must be an array"] };
  }

  // Sets/lookups from the authoritative inputs. Numbers match by exact numeric identity.
  const allowedNumbers = new Set(authoritativeNumbers);
  const allowedEvidence = new Set(evidenceIds);

  recs.forEach((rec, i) => {
    if (rec == null || typeof rec !== "object") {
      reasons.push(`recommendation[${i}] is not an object`);
      return;
    }

    // No invented numbers: money_impact must be present in authoritativeNumbers.
    if (typeof rec.money_impact !== "number" || Number.isNaN(rec.money_impact)) {
      reasons.push(`recommendation[${i}] money_impact is not a number`);
    } else if (!allowedNumbers.has(rec.money_impact)) {
      reasons.push(`recommendation[${i}] money_impact ${rec.money_impact} is not in authoritativeNumbers`);
    }

    // Real citations: evidence_triple_ids must be a subset of evidenceIds.
    if (!Array.isArray(rec.evidence_triple_ids)) {
      reasons.push(`recommendation[${i}] evidence_triple_ids must be an array`);
    } else {
      for (const id of rec.evidence_triple_ids) {
        if (!allowedEvidence.has(id)) {
          reasons.push(`recommendation[${i}] cites unknown evidence id ${JSON.stringify(id)}`);
        }
      }
    }
  });

  return reasons.length === 0
    ? { verdict: "pass", reasons: [] }
    : { verdict: "cannot_verify", reasons };
}
