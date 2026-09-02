// Proof for the marginal-scaling -> Output Contract adapter (§47: never scale on ROAS alone).
// Run: node --experimental-strip-types scripts/check-marginal-contract.ts

import assert from "node:assert/strict";
import type { MarginalRead } from "../lib/scoring/marginal.ts";
import { marginalToContract } from "../lib/intelligence/from-marginal.ts";
import { validateOutput } from "../lib/intelligence/output-contract.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}
const read = (o: Partial<MarginalRead>): MarginalRead =>
  ({ classification: "HEALTHY", spendElasticity: 0.85, currentRoas: 2.2, marginalRoas: 1.9, diminishingReturns: true, confidence: 0.8, label: "MODELLED", why: ["x"], ...o } as MarginalRead);
const opts = { entityId: "ad1", name: "Hero", spendRs: 50000 };

// 1) UNKNOWN -> HOLD (can't fit the curve).
const u = marginalToContract(read({ classification: "UNKNOWN", spendElasticity: null, confidence: 0.1 }), opts);
ok(u !== null && u.trust.ok === false && u.decision === null, "UNKNOWN -> HOLD");

// 2) UNDERFUNDED (headroom) -> Increase budget.
const under = marginalToContract(read({ classification: "UNDERFUNDED", spendElasticity: 1.2 }), opts);
ok(under !== null && validateOutput(under!).ok, "underfunded -> valid decision");
ok(under!.decision!.call === "Increase budget", "headroom -> increase budget");
ok(under!.economicImpactRs === 50000, "economic impact = the ad's spend");

// 3) SATURATED (high ROAS but no headroom) -> do not scale.
const sat = marginalToContract(read({ classification: "SATURATED", spendElasticity: 0.3, currentRoas: 4.5 }), opts);
ok(sat!.decision!.call === "Do not scale - reallocate", "saturated -> do not scale even at high ROAS (§47)");
ok(sat!.confidence === "high", "0.8 confidence -> high");

// 4) APPROACHING_SATURATION -> hold + line up next.
const app = marginalToContract(read({ classification: "APPROACHING_SATURATION" }), opts);
ok(/Hold budget/.test(app!.decision!.call), "approaching saturation -> hold");

console.log(`check-marginal-contract: ${pass} assertions passed.`);
