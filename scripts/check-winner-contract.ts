// Proof for the winner -> Output Contract adapter (§37 taxonomy + §95 no-winner-without-delivery).
// Run: node --experimental-strip-types scripts/check-winner-contract.ts

import assert from "node:assert/strict";
import type { CockpitAd } from "../lib/cockpit/analyze.ts";
import { winnerToContract } from "../lib/intelligence/from-winner.ts";
import { validateOutput } from "../lib/intelligence/output-contract.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}
const ad = (winner: Record<string, unknown> | undefined, spendRs = 90000) =>
  ({ id: "w1", name: "Hero UGC", spendRs, delivering: true, active: true, winner } as unknown as CockpitAd);

const w = (o: Partial<{ quality: number; scale: number; stability: number; opportunity: number; overall: number }>) =>
  ({ quality: 50, scale: 50, stability: 50, opportunity: 50, overall: 50, label: "INTERNAL CALCULATION", why: ["x"], ...o });

// 1) No winner scores -> null.
ok(winnerToContract(ad(undefined)) === null, "no winner scores -> null");

// 2) Too little proven spend -> HOLD (no winner without delivery).
const thin = winnerToContract(ad(w({ quality: 80, scale: 10, stability: 70, opportunity: 80, overall: 70 })));
ok(thin !== null && thin.trust.ok === false, "low scale -> HOLD");
ok(/proven spend/.test(thin!.trust.reason), "HOLD names the delivery gap");

// 3) Proven winner -> Scale carefully.
const proven = winnerToContract(ad(w({ quality: 75, scale: 70, stability: 70, opportunity: 50, overall: 72 })));
ok(proven !== null && validateOutput(proven!).ok, "proven -> valid decision");
ok(proven!.decision!.call === "Scale carefully", "proven -> scale carefully");
ok(proven!.confidence === "high", "overall 72 -> high");

// 4) Fragile winner (good+scaled but unstable) -> Protect.
const fragile = winnerToContract(ad(w({ quality: 75, scale: 70, stability: 20, opportunity: 40, overall: 60 })));
ok(fragile!.decision!.call === "Protect it - add backups", "unstable -> protect");

// 5) Emerging (good+fresh, not scaled) -> give it room.
const emerging = winnerToContract(ad(w({ quality: 75, scale: 45, stability: 55, opportunity: 75, overall: 65 })));
ok(emerging!.decision!.call === "Give it room to prove out", "good+opportunity, not scaled -> emerging");

console.log(`check-winner-contract: ${pass} assertions passed.`);
