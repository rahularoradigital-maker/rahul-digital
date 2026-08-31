// Regression guard for the semantic-decode payoff: once a creative's funnel-stage/hook/emotion/subject are
// populated (by lib/creative/decode.ts, fingerprint-once cached), the diversity engine reads all FIVE
// dimensions instead of format alone. The decode's AI call needs a live model, but the CONSUMING behaviour -
// that semantics turn a 1-D read into a 5-D one - is what must never silently regress.
// Run: node --experimental-strip-types scripts/check-decode.ts

import { assessDiversity, type CreativeRecord } from "../lib/creative/diversity.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const withSem: CreativeRecord[] = [
  { adId: "1", adName: "a", spendRs: 5000, winner: 80, format: "video", funnelStage: "TOF", hookType: "curiosity", emotion: "aspiration", subject: "human/UGC-led" },
  { adId: "2", adName: "b", spendRs: 4000, winner: 70, format: "image", funnelStage: "BOF", hookType: "offer", emotion: "urgency", subject: "product-led" },
  { adId: "3", adName: "c", spendRs: 3000, winner: 65, format: "video", funnelStage: "MOF", hookType: "social-proof", emotion: "trust", subject: "human/UGC-led" },
  { adId: "4", adName: "d", spendRs: 800, winner: 90, format: "carousel", funnelStage: "BOF", hookType: "comparison", emotion: "trust", subject: "product-led" },
];
const d = assessDiversity(withSem);
ok(d.coverage === 1, "coverage reflects that all ads carry a semantic read");
const active = d.dimensions.filter((x) => x.activeBuckets > 1).length;
ok(active >= 4, `at least 4 semantic dimensions are active (got ${active})`);
ok(d.dimensions.some((x) => x.dimension === "funnel stage" && x.activeBuckets === 3), "funnel stage reads TOF/MOF/BOF");
ok(d.dimensions.some((x) => x.dimension === "hook type" && x.activeBuckets === 4), "hook type spread is read");

// The OLD behaviour (all semantic dims null) collapses to format alone - what this feature fixes.
const noSem = withSem.map((r) => ({ ...r, funnelStage: null, hookType: null, emotion: null, subject: null }));
const d0 = assessDiversity(noSem);
ok(d0.coverage === 0, "null semantics -> coverage 0 (honest)");
ok(d0.dimensions.filter((x) => x.activeBuckets > 1).length === 1, "null semantics -> only format is active (the pre-decoder state)");

console.log(`check-decode: ${pass} assertions passed.`);
