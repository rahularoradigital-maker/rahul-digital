// Decision Engine (brief.md "Engines"): OBSERVATION -> DIAGNOSIS -> EVIDENCE -> RULE ->
// CONFIDENCE -> ACTION -> EXPECTED IMPACT, with a full explainability trace.
// Pure functions, no I/O. Fail closed: a bad input is rejected with reasons,
// never thrown, never patched up with invented values (mirrors lib/validator.ts).

import { getRule } from "./rules/registry.ts";
import type { Rule } from "./rules/registry.ts";
import { diagnose } from "./causality.ts";
import type { DiagnosticSignals } from "./causality.ts";

export type FactLabel =
  | "OFFICIAL"
  | "DERIVED"
  | "MODEL_ESTIMATE"
  | "INFERENCE"
  | "EXTERNAL"
  | "UNKNOWN";

export type Evidence = {
  metric: string;
  value: number | string;
  windowDays?: number;
  source: string;
  factLabel: FactLabel;
};

export type Priority = "DO_NOW" | "DO_NEXT" | "WATCH" | "DO_NOT_ACT" | "NEEDS_MORE_DATA";

export type DecisionInput = {
  observation: string;
  diagnosis: string;
  evidence: Evidence[];
  ruleId: string;
  confidence: { score: number; reasons: string[] };
  action: string;
  expectedImpact?: { value: number; unit: string; factLabel: "MODEL_ESTIMATE" | "DERIVED" };
  priority: Priority;
};

export type ExplainRow = { label: string; value: string };

// The validated output: the input, the full rule that fired, and the trace.
export type Decision = DecisionInput & { rule: Rule; explain: ExplainRow[] };

export type BuildResult =
  | { status: "ok"; decision: Decision }
  | { status: "rejected"; reasons: string[] };

// Internal calibration constants (calibrate-at-build): the minimum confidence
// score a decision must carry to satisfy each rule's confidenceRequirement band.
// These are provisional v0 priors, not validated numbers.
const CONFIDENCE_FLOOR: Record<Rule["confidenceRequirement"], number> = {
  low: 0.3,
  medium: 0.6,
  high: 0.8,
};

/**
 * Validate a DecisionInput against the rule library and build the explainable
 * Decision. FAIL CLOSED: any structural or confidence problem returns
 * rejected with reasons; nothing is fabricated, nothing throws.
 */
export function buildDecision(input: DecisionInput): BuildResult {
  const reasons: string[] = [];

  if (input == null || typeof input !== "object") {
    return { status: "rejected", reasons: ["input is not an object"] };
  }

  const rule = getRule(input.ruleId);
  if (rule === undefined) {
    reasons.push(`unknown ruleId ${JSON.stringify(input.ruleId)}: decisions must cite a registered rule`);
  }

  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    reasons.push("evidence is empty: a decision without evidence is an assertion, not a decision");
  }

  const score = input.confidence?.score;
  if (typeof score !== "number" || Number.isNaN(score) || score < 0 || score > 1) {
    reasons.push("confidence.score must be a number in [0,1]");
  } else if (rule !== undefined) {
    const floor = CONFIDENCE_FLOOR[rule.confidenceRequirement];
    if (score < floor) {
      reasons.push(
        `confidence score ${score} is below the "${rule.confidenceRequirement}" requirement of rule ${rule.id}`,
      );
    }
  }

  if (input.expectedImpact != null && input.expectedImpact.factLabel == null) {
    reasons.push("expectedImpact present without a factLabel: an unlabelled impact number reads as a fact");
  }

  if (reasons.length > 0 || rule === undefined) {
    return { status: "rejected", reasons };
  }

  const decision: Decision = { ...input, rule, explain: [] };
  decision.explain = explain(decision);
  return { status: "ok", decision };
}

/**
 * J4 — measurement is a gate, not a score. Before building a decision that
 * depends on trusting the account's numbers, run the causality ladder first; if
 * measurement is broken, REJECT (never recommend an action on numbers you cannot
 * trust). Additive and opt-in: buildDecision above is unchanged, so existing
 * callers are unaffected; callers who have diagnostic signals route through here.
 */
export function buildDecisionGatedByMeasurement(
  input: DecisionInput,
  signals: DiagnosticSignals,
): BuildResult {
  const d = diagnose(signals);
  if (d.status === "suppressed") {
    return { status: "rejected", reasons: [`measurement gate (J4): ${d.reason}`] };
  }
  return buildDecision(input);
}

/**
 * The full explainability trace (brief.md explainability engine): every row is
 * assembled verbatim from the decision and its rule. No row introduces a number
 * that is not already present in the inputs.
 */
export function explain(decision: Decision): ExplainRow[] {
  const rows: ExplainRow[] = [];
  rows.push({ label: "What happened", value: decision.observation });
  rows.push({ label: "Why", value: decision.diagnosis });
  for (const e of decision.evidence) {
    const window = e.windowDays !== undefined ? `, ${e.windowDays}-day window` : "";
    rows.push({
      label: "Data used",
      value: `${e.metric} = ${e.value} [${e.factLabel}] (source: ${e.source}${window})`,
    });
  }
  rows.push({ label: "Rule fired", value: `${decision.rule.id}: ${decision.rule.formula}` });
  rows.push({ label: "Threshold", value: decision.rule.threshold });
  rows.push({
    label: "Confidence",
    value: `${decision.confidence.score} (requirement: ${decision.rule.confidenceRequirement}); ${decision.confidence.reasons.join("; ")}`,
  });
  rows.push({ label: "What could invalidate this", value: decision.rule.exceptions.join("; ") });
  if (decision.expectedImpact !== undefined) {
    rows.push({
      label: "Expected impact",
      value: `${decision.expectedImpact.value} ${decision.expectedImpact.unit} [${decision.expectedImpact.factLabel}]`,
    });
  }
  rows.push({ label: "Recommended action", value: `${decision.action} (priority: ${decision.priority})` });
  return rows;
}
