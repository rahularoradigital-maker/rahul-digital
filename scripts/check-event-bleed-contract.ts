// Proof for the event-bleed -> §110 Output Contract adapter (lib/intelligence/from-event-roi): a real
// reallocation decision with money, second-order effect, a DRAFT action, and an honest failure mode; null
// when nothing bleeds.
// Run: node --experimental-strip-types scripts/check-event-bleed-contract.ts

import { computeEventRoi } from "../lib/scoring/event-roi.ts";
import { eventBleedToContract } from "../lib/intelligence/from-event-roi.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const rows = computeEventRoi([
  { event: "PURCHASE", spendRs: 7568096, revenueRs: 41177351, purchases: 15309 },
  { event: "CONTENT_VIEW", spendRs: 134598, revenueRs: 21695, purchases: 11 },
  { event: "LANDING_PAGE_VIEWS", spendRs: 59946, revenueRs: 6678, purchases: 3 },
  { event: "REACH", spendRs: 13199, revenueRs: 0, purchases: 0 },
]);

const c = eventBleedToContract(rows, { entityId: "act_1", accountName: "Soch" });
ok(c !== null, "a bleed produces a contract");
ok(c!.kind === "event-reallocation" && c!.entity?.level === "account", "account-level reallocation decision");
ok(c!.economicImpactRs === 134598 + 59946, "economic impact = the bleed rupees");
ok(!!c!.decision && /Reallocate toward purchase/i.test(c!.decision.call), "decision points at the best event (Purchase)");
ok(/purchase returns \+444%/i.test(c!.diagnosis), "diagnosis cites the best return");
ok(/Draft:/.test(c!.action ?? ""), "action is a DRAFT (never auto-applied)");
ok(!!c!.secondOrder && /learning phase/.test(c!.secondOrder), "second-order names the learning-phase reset");
ok(/last-click|attribution|top-funnel/i.test(c!.whatCouldBeWrong), "honest failure mode: attribution under-credit");
ok(c!.confidence === "high", "high confidence when the best event is a robust sample");

// no bleed -> null (never a fabricated reallocation).
ok(eventBleedToContract(computeEventRoi([{ event: "PURCHASE", spendRs: 100000, revenueRs: 400000, purchases: 500 }]), { entityId: "x" }) === null, "all-positive -> no contract");

console.log(`check-event-bleed-contract: ${pass} assertions passed.`);
