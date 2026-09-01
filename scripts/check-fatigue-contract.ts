// Proof for the fatigue -> Output Contract adapter: a stopped ad surfaces nothing; a conversion ad under the
// 50-conversion floor HOLDs (not enough signal); a well-sampled fatiguing ad becomes a valid decided contract
// carrying its ₹ impact + reasoning. Run: node --experimental-strip-types scripts/check-fatigue-contract.ts

import assert from "node:assert/strict";
import type { CockpitAd } from "../lib/cockpit/analyze.ts";
import { fatigueToContract } from "../lib/intelligence/from-fatigue.ts";
import { validateOutput } from "../lib/intelligence/output-contract.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// minimal CockpitAd - only the fields the adapter reads (cast; the engine builds the full object in prod).
const base = {
  id: "ad1", name: "Video | 20s", objective: "conversion", spendRs: 20000, revenueRs: 4000, roas: 0.2,
  conversions: 3, verdict: "refresh", score: 30, confidence: 0.9, why: ["earning less per impression"],
  action: { label: "Refresh", priority: "high" }, wastedRs: 12000, delivering: true, active: true,
} as unknown as CockpitAd;

// 1) stopped ad -> null (no action on paused/ended).
ok(fatigueToContract({ ...base, delivering: false } as CockpitAd) === null, "stopped ad -> null");

// 2) conversion ad under the floor -> HOLD.
const h = fatigueToContract(base);
ok(h !== null && h.trust.ok === false && h.decision === null, "3 conv on a conversion ad -> HOLD");
ok(/need >=50/.test(h!.trust.reason), "HOLD reason names the 50-conversion floor");

// 3) well-sampled fatiguing conversion ad -> valid decided contract.
const d = fatigueToContract({ ...base, conversions: 80 } as CockpitAd);
ok(d !== null && d.decision !== null && validateOutput(d!).ok, "80 conv fatiguing -> valid decision");
ok(d!.economicImpactRs === 12000, "economic impact = wasted spend (₹12,000)");
ok(d!.decision!.call === "Refresh", "decision uses the ad's real action label");
ok(d!.confidence === "high", "0.9 confidence -> high");

// 4) non-conversion objective (awareness): the conversion floor does NOT gate it.
const aw = fatigueToContract({ ...base, objective: "awareness", conversions: 0, action: { label: "Hold", priority: "low" } } as unknown as CockpitAd);
ok(aw !== null && aw.decision !== null, "awareness ad is not blocked by the conversion floor");

console.log(`check-fatigue-contract: ${pass} assertions passed.`);
