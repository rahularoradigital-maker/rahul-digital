// Proof for the diversity -> Output Contract adapter (§36 fragility). Run: node --experimental-strip-types scripts/check-diversity-contract.ts

import assert from "node:assert/strict";
import type { DiversityRead } from "../lib/creative/diversity.ts";
import { diversityToContract } from "../lib/intelligence/from-diversity.ts";
import { validateOutput } from "../lib/intelligence/output-contract.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}
const read = (o: Partial<DiversityRead>): DiversityRead =>
  ({ overall: 50, dimensions: [], whitespace: [], productionQueue: [], coverage: 0.8, label: "INTERNAL CALCULATION", basis: "x", ...o } as DiversityRead);
const dim = (dominantShare: number, dimension = "hook") =>
  ({ dimension, buckets: [], activeBuckets: 3, diversityScore: 100 - dominantShare * 100, dominant: "Problem-Solution", dominantShare, note: "" });

// 1) Low coverage -> HOLD.
const h = diversityToContract(read({ coverage: 0.2 }), { entityId: "acc", accountSpendRs: 1_000_000 });
ok(h !== null && h.trust.ok === false, "low coverage -> HOLD");

// 2) Fragile concentration (70% in one bucket) -> decision, ₹ = share x account spend.
const d = diversityToContract(read({ coverage: 0.8, dimensions: [dim(0.7)] }), { entityId: "acc", accountSpendRs: 1_000_000 });
ok(d !== null && d.decision !== null && validateOutput(d!).ok, "70% concentration -> valid decision");
ok(d!.economicImpactRs === 700000, "economic impact = dominantShare x account spend");
ok(/Diversify the hook/.test(d!.decision!.call), "decision targets the concentrated dimension");
ok(d!.confidence === "med", "0.7 share -> medium confidence");

// 3) Healthy spread (dominant only 40%) -> nothing to flag (null).
ok(diversityToContract(read({ coverage: 0.8, dimensions: [dim(0.4)] }), { entityId: "acc", accountSpendRs: 1_000_000 }) === null, "diverse enough -> null");

// 4) Very high concentration -> high confidence.
const hi = diversityToContract(read({ coverage: 0.8, dimensions: [dim(0.8)] }), { entityId: "acc", accountSpendRs: 1_000_000 });
ok(hi!.confidence === "high", "0.8 share -> high confidence");

console.log(`check-diversity-contract: ${pass} assertions passed.`);
