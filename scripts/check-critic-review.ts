// Proof for the deterministic contract critic (§53-56): it can only LOWER confidence, caps confidence at the
// evidence tier (§56), upholds HOLDs, and never raises. Run: node --experimental-strip-types scripts/check-critic-review.ts

import assert from "node:assert/strict";
import type { OutputContract } from "../lib/intelligence/output-contract.ts";
import { reviewContract, critiqued } from "../lib/intelligence/critic-review.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const decided = (tier: OutputContract["trust"]["tier"], conf: OutputContract["confidence"], whatCouldBeWrong = "clean"): OutputContract => ({
  id: "x", kind: "scaling", entity: { level: "ad", id: "a", name: "A" },
  data: { summary: "s", source: "meta-store" }, trust: { ok: true, tier, reason: "ok" },
  decision: { call: "Scale", why: "headroom" }, economicImpactRs: 50000, secondOrder: "so", diagnosis: "d",
  confidence: conf, whatCouldBeWrong,
});

// 1) high confidence on INFERENCE evidence -> downgraded to med (the tier cap).
const r1 = reviewContract(decided("INFERENCE", "high"));
ok(r1.verdict === "downgrade" && r1.finalConfidence === "med", "high on INFERENCE -> downgraded to med");
ok(r1.finalConfidence !== "high", "the critic lowered confidence");

// 2) high on CALCULATED evidence with clean risk -> upheld (tier supports high).
const r2 = reviewContract(decided("CALCULATED", "high"));
ok(r2.verdict === "upheld" && r2.finalConfidence === "high", "high on CALCULATED with no live alternative -> upheld");

// 3) high but whatCouldBeWrong names a live alternative -> flagged down.
const r3 = reviewContract(decided("CALCULATED", "high", "If a budget jump reset learning, this is delivery not fatigue"));
ok(r3.verdict === "flag" && r3.finalConfidence === "med", "a live alternative makes 'high' optimistic -> flagged to med");

// 4) never raises: low stays low even on VERIFIED.
ok(reviewContract(decided("VERIFIED", "low")).finalConfidence === "low", "critic never raises a low to high");

// 5) a HOLD (no decision) is upheld untouched.
const hold: OutputContract = { id: "h", kind: "fatigue", data: { summary: "s", source: "m" }, trust: { ok: false, tier: "UNKNOWN", reason: "thin" }, confidence: "low", whatCouldBeWrong: "wait" };
ok(reviewContract(hold).verdict === "upheld", "a HOLD is upheld (nothing to over-claim)");

// 6) critiqued() writes the lowered confidence + a critic note, never touching numbers.
const c = critiqued(decided("INFERENCE", "high"));
ok(c.confidence === "med" && /\[critic:/.test(c.whatCouldBeWrong), "critiqued() lowers confidence + notes why");
ok(c.economicImpactRs === 50000, "the critic never changes a number (§55)");

console.log(`check-critic-review: ${pass} assertions passed.`);
