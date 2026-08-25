// Runnable check for lib/validator.ts. No env needed (pure, deterministic).
//   node --experimental-strip-types scripts/check-validator.ts
import { strict as assert } from "node:assert";
import { validateStrategistOutput } from "../lib/validator.ts";
import type { StrategistOutput } from "../lib/prompts/strategist.ts";

const authoritativeNumbers = [182000, 180000];
const evidenceIds = ["t_991", "t_120"];

// T1-style: valid output, numbers match, citations are a subset -> pass.
const valid: StrategistOutput = {
  verdict: "Scale one winner and stop one dying ad this week.",
  recommendations: [
    {
      kind: "stop",
      outcome: "Turn off ad_42, it is past half life",
      ad: "ad_42",
      rationale: "Frequency high and click rate falling; spend keeps going with no new orders.",
      money_impact: 182000,
      confidence: "high",
      evidence_triple_ids: ["t_991"],
    },
    {
      kind: "scale",
      outcome: "Raise budget on ad_07",
      ad: "ad_07",
      rationale: "Held ROAS above 4 for 11 days on rising spend; audience not used up.",
      money_impact: 180000,
      confidence: "high",
      evidence_triple_ids: ["t_120"],
    },
  ],
};
const ok = validateStrategistOutput(valid, authoritativeNumbers, evidenceIds);
assert.equal(ok.verdict, "pass", "valid output must pass");
assert.deepEqual(ok.reasons, [], "a passing output has no reasons");

// Fabricated number not in authoritativeNumbers -> cannot_verify, reason names the value.
const fabricatedNumber: StrategistOutput = {
  verdict: "Scale one winner.",
  recommendations: [
    { ...valid.recommendations[1], money_impact: 999999 },
  ],
};
const badNum = validateStrategistOutput(fabricatedNumber, authoritativeNumbers, evidenceIds);
assert.equal(badNum.verdict, "cannot_verify", "invented number must fail");
assert.ok(badNum.reasons.some((r) => r.includes("999999")), "reason must name the offending value");

// Citation id not in evidenceIds -> cannot_verify.
const fabricatedCite: StrategistOutput = {
  verdict: "Stop one dying ad.",
  recommendations: [
    { ...valid.recommendations[0], evidence_triple_ids: ["t_ghost"] },
  ],
};
const badCite = validateStrategistOutput(fabricatedCite, authoritativeNumbers, evidenceIds);
assert.equal(badCite.verdict, "cannot_verify", "unknown citation must fail");
assert.ok(badCite.reasons.some((r) => r.includes("t_ghost")), "reason must name the bad citation");

// Empty verdict -> cannot_verify (verdict must be non-empty).
const emptyVerdict = validateStrategistOutput(
  { verdict: "", recommendations: [] },
  authoritativeNumbers,
  evidenceIds,
);
assert.equal(emptyVerdict.verdict, "cannot_verify", "empty verdict must fail");

// Fail closed: malformed shape must not throw.
assert.doesNotThrow(
  () => validateStrategistOutput({} as StrategistOutput, authoritativeNumbers, evidenceIds),
  "malformed output must not throw",
);

console.log("PASS: validator checks");
