// Runnable check for lib/rules/registry.ts + lib/decision.ts. No env needed.
//   node --experimental-strip-types scripts/check-decision.ts
import { strict as assert } from "node:assert";
import { RULES, getRule, ruleIds } from "../lib/rules/registry.ts";
import { buildDecision, explain } from "../lib/decision.ts";
import type { DecisionInput } from "../lib/decision.ts";

// registry: at least 8 rules, unique ids
assert.ok(RULES.length >= 8, "registry must hold at least 8 rules");
assert.equal(new Set(ruleIds()).size, RULES.length, "rule ids must be unique");

// every rule: all 13 fields non-empty, source cites a spec artifact
for (const r of RULES) {
  for (const key of [
    "id", "name", "purpose", "formula", "trigger", "threshold", "output",
    "recommendedAction", "confidenceRequirement", "source", "version", "reviewDate",
  ] as const) {
    assert.ok(typeof r[key] === "string" && r[key].trim() !== "", `${r.id}.${key} must be non-empty`);
  }
  assert.ok(Array.isArray(r.inputs) && r.inputs.length > 0, `${r.id}.inputs must be non-empty`);
  assert.ok(Array.isArray(r.exceptions) && r.exceptions.length > 0, `${r.id}.exceptions must be non-empty`);
  assert.ok(r.source.startsWith("docs/product-spec/"), `${r.id}.source must cite a spec artifact`);
}
assert.equal(getRule("FAT-001")?.name, "Fatigue past half-life: stop spending");
assert.equal(getRule("NOPE-999"), undefined, "unknown id must return undefined");

// a valid DecisionInput -> ok, and explain carries the rule id + every evidence metric
const valid: DecisionInput = {
  observation: "Ad 1234 CTR fell sharply while frequency climbed",
  diagnosis: "Creative fatigue past half-life on ad 1234",
  evidence: [
    { metric: "ctr_decay", value: 0.62, windowDays: 7, source: "meta_insights_daily", factLabel: "DERIVED" },
    { metric: "frequency", value: 3.4, windowDays: 7, source: "meta_insights_daily", factLabel: "OFFICIAL" },
  ],
  ruleId: "FAT-001",
  confidence: { score: 0.87, reasons: ["two windows agree", "no confounds detected"] },
  action: "Pause ad 1234 and swap in the queued replacement",
  expectedImpact: { value: 4200, unit: "Rs/week saved", factLabel: "MODEL_ESTIMATE" },
  priority: "DO_NOW",
};
const ok = buildDecision(valid);
assert.equal(ok.status, "ok", "valid input must build");
assert.ok(ok.status === "ok");
const trace = ok.decision.explain.map((row) => `${row.label}: ${row.value}`).join("\n");
assert.ok(trace.includes("FAT-001"), "explain must name the rule id");
for (const e of valid.evidence) {
  assert.ok(trace.includes(e.metric), `explain must include evidence metric ${e.metric}`);
}
assert.deepEqual(explain(ok.decision), ok.decision.explain, "explain must be deterministic");

// unknown ruleId -> rejected
const badRule = buildDecision({ ...valid, ruleId: "ZZZ-999" });
assert.equal(badRule.status, "rejected");
assert.ok(badRule.status === "rejected" && badRule.reasons.some((r) => r.includes("ZZZ-999")));

// empty evidence -> rejected
const noEvidence = buildDecision({ ...valid, evidence: [] });
assert.equal(noEvidence.status, "rejected");
assert.ok(noEvidence.status === "rejected" && noEvidence.reasons.some((r) => r.includes("evidence")));

// confidence 0.4 against a rule requiring "high" -> rejected, reason names confidence
const lowConf = buildDecision({ ...valid, confidence: { score: 0.4, reasons: ["thin data"] } });
assert.equal(lowConf.status, "rejected");
assert.ok(
  lowConf.status === "rejected" && lowConf.reasons.some((r) => r.includes("confidence")),
  "low-confidence rejection must name confidence",
);

// out-of-range confidence -> rejected
assert.equal(buildDecision({ ...valid, confidence: { score: 1.2, reasons: [] } }).status, "rejected");

// explain introduces no digits not present in the inputs (spot-check the valid decision)
const allowed = JSON.stringify(valid) + JSON.stringify(getRule(valid.ruleId));
for (const run of trace.match(/\d+(\.\d+)?/g) ?? []) {
  assert.ok(allowed.includes(run), `explain invented the number ${run}`);
}

console.log("PASS: rule library + decision engine checks");
