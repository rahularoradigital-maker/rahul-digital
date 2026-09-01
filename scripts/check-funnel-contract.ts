// Proof for the funnel -> Output Contract adapter: the engine's own hold reason becomes a HOLD; a trustworthy
// named leak becomes a decided contract with the spend behind it. Run: node --experimental-strip-types scripts/check-funnel-contract.ts

import assert from "node:assert/strict";
import type { AdDiagnosis } from "../lib/funnel/diagnosis.ts";
import { funnelToContract } from "../lib/intelligence/from-funnel.ts";
import { validateOutput } from "../lib/intelligence/output-contract.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const base = {
  adId: "ad9", name: "Carousel | Kurta", objective: "traffic",
  stage: { label: "MOF" }, spend: 30000, metrics: {}, steps: [],
  leak: { key: "lpv", label: "landing-page view rate", value: 0.28, ownBest: 0.55, objectiveAvg: 0.4, gap: 0.49 },
  hold: null,
} as unknown as AdDiagnosis;

// 1) A trustworthy leak -> decided contract with the spend behind it.
const d = funnelToContract(base);
ok(d !== null && d.decision !== null && validateOutput(d!).ok, "named leak -> valid decision");
ok(d!.economicImpactRs === 30000, "economic impact = the ad's spend behind the leak");
ok(/landing-page view rate/.test(d!.diagnosis ?? ""), "diagnosis names the weakest step");
ok(d!.confidence === "high", "49% gap -> high confidence");

// 2) The engine holds -> we HOLD with its reason, no decision.
const held = funnelToContract({ ...base, leak: null, hold: "only 1 ad shares this objective (need 5)" } as unknown as AdDiagnosis);
ok(held !== null && held.trust.ok === false && held.decision === null, "engine hold -> contract HOLD");
ok(/need 5/.test(held!.trust.reason), "HOLD carries the engine's exact reason");

// 3) A small gap -> lower confidence.
const small = funnelToContract({ ...base, leak: { ...base.leak!, gap: 0.1 } } as unknown as AdDiagnosis);
ok(small!.confidence === "low", "10% gap -> low confidence");

console.log(`check-funnel-contract: ${pass} assertions passed.`);
