// Proof for the unified Output Contract (§110/§120, reasoning-chain rule #3): the chain's core law is
// enforced deterministically - a DECISION can never ship without TRUST + economic impact + second-order +
// diagnosis + what-could-be-wrong, and an untrusted output HOLDs instead of deciding.
// Run: node --experimental-strip-types scripts/check-output-contract.ts

import assert from "node:assert/strict";
import { hold, decide, validateOutput, headline, type OutputContract } from "../lib/intelligence/output-contract.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// 1) HOLD: untrusted data -> no decision, no action, honest reason.
const h = hold({
  id: "fatigue:ad1",
  kind: "fatigue",
  data: { summary: "3 conversions over 14d", source: "meta-store" },
  reason: "3 conversions, need >=50",
  whatToDo: "Let it spend to a >=50-conversion sample before judging.",
});
ok(h.trust.ok === false, "hold is untrusted");
ok(h.decision === null && h.action === null, "hold makes no decision/action");
ok(validateOutput(h).ok, "a HOLD is a valid contract");
ok(headline(h).startsWith("HOLD"), "hold headline says HOLD");

// 2) DECIDE: trusted + full chain -> valid.
const d = decide({
  id: "bleed:ad2",
  kind: "bleed",
  entity: { level: "ad", name: "Video | 20s" },
  data: { summary: "CPA ₹1,240 vs ₹520 baseline over 21d", source: "meta-store" },
  tier: "CALCULATED",
  trustReason: "62 conversions, 41% of ad-set spend - material",
  signal: "CPA up 138% sustained 9 days",
  diagnosis: "CTR collapse (attention), not CVR - creative fatigue",
  economicImpactRs: 43646,
  secondOrder: "Killing it reallocates ₹43.6k to the next ad, which may also be fatiguing",
  thirdOrder: "If the replacement pool is thin, account acquisition capacity drops",
  decision: { call: "Refresh the creative", why: "attention has decayed, not the offer" },
  action: "Draft 2 new hooks in Studio; pause after the new set is live (reversible)",
  whatCouldBeWrong: "If a budget jump reset learning, the CPA rise is delivery, not fatigue",
  confidence: "high",
  sampleNote: "62 conv, 21d",
});
ok(validateOutput(d).ok, "a full decided contract is valid");
ok(headline(d).includes("43,646") || headline(d).includes("43646"), "decided headline shows ₹ at stake");

// 3) THE LAW: a decision while trust failed is INVALID.
const illegal: OutputContract = { ...h, decision: { call: "Kill it", why: "looks bad" } };
const v1 = validateOutput(illegal);
ok(!v1.ok && v1.problems.some((p) => p.includes("never jump DATA->DECISION")), "law: no decision without trust");

// 4) A decision missing its reasoning is INVALID (economic impact / second-order / diagnosis).
const missing: OutputContract = {
  id: "x", kind: "scale",
  data: { summary: "s", source: "meta" },
  trust: { ok: true, tier: "CALCULATED", reason: "material" },
  decision: { call: "Scale", why: "high ROAS" },
  economicImpactRs: null, // <-- missing
  confidence: "med",
  whatCouldBeWrong: "small sample",
};
const v2 = validateOutput(missing);
ok(!v2.ok, "decision without reasoning is invalid");
ok(v2.problems.some((p) => p.includes("economic impact")), "flags missing ₹ impact (§91)");
ok(v2.problems.some((p) => p.includes("second-order")), "flags missing second-order (rule #3)");

// 5) whatCouldBeWrong is mandatory (§120).
const noRisk: OutputContract = { ...d, whatCouldBeWrong: "" };
ok(!validateOutput(noRisk).ok, "empty whatCouldBeWrong is invalid (§120)");

// 6) decide() throws on an illegal assembly (so bad output fails in tests, not in the UI).
let threw = false;
try {
  // Empty diagnosis/second-order/why are type-valid strings but violate the chain, so decide() must throw.
  decide({ id: "y", kind: "kill", data: { summary: "s", source: "m" }, tier: "INFERENCE", trustReason: "r", signal: "x", diagnosis: "", economicImpactRs: 0, secondOrder: "", decision: { call: "Kill", why: "" }, action: "a", whatCouldBeWrong: "w", confidence: "low" });
} catch {
  threw = true;
}
ok(threw, "decide() throws when the reasoning chain is incomplete");

console.log(`check-output-contract: ${pass} assertions passed.`);
