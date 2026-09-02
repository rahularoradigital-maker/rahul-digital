// Proof for the event ROI rubric (lib/scoring/event-roi): ROI% only where real revenue exists, honest
// null (never a fabricated ROI) for non-revenue events, materiality-gated, spend-ranked.
// Run: node --experimental-strip-types scripts/check-event-roi.ts

import { computeEventRoi, type EventRow } from "../lib/scoring/event-roi.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const rows: EventRow[] = [
  { event: "Purchase", spendRs: 100000, revenueRs: 437000, purchases: 500 },
  { event: "Add to Cart", spendRs: 40000, revenueRs: 0, purchases: 0 },
  { event: "Lead", spendRs: 300, revenueRs: 0, purchases: 0 }, // below the materiality floor
];
const out = computeEventRoi(rows);
const byEvent = Object.fromEntries(out.map((e) => [e.event, e]));

// 1) revenue event -> real ROI% + ROAS, positive when revenue > spend.
ok(byEvent["Purchase"].roiPct === 337, "Purchase ROI% = (437k-100k)/100k = 337%");
ok(byEvent["Purchase"].roas === 4.37, "Purchase ROAS = 4.37x");
ok(byEvent["Purchase"].costPerPurchaseRs === 200, "cost per purchase = 100000/500 = 200");
ok(byEvent["Purchase"].note === "ROI from real purchase value.", "revenue event note");

// 2) non-revenue event -> ROI is null (NEVER fabricated) + an honest note.
ok(byEvent["Add to Cart"].roiPct === null && byEvent["Add to Cart"].roas === null, "no-revenue event has null ROI (not 0, not invented)");
ok(!byEvent["Add to Cart"].hasRevenue, "no-revenue event flagged hasRevenue=false");
ok(/judge it on cost per result/.test(byEvent["Add to Cart"].note), "no-revenue event says judge on cost per result");

// 3) materiality gate: a Rs 300 event is too small to judge.
ok(byEvent["Lead"].material === false && /Too little spend/.test(byEvent["Lead"].note), "sub-floor event flagged not material");
ok(byEvent["Purchase"].material === true, "a large event is material");

// 4) spend share + ranking.
ok(byEvent["Purchase"].spendSharePct === 71, "spend share = 100000 / 140300 ~ 71%");
ok(out[0].event === "Purchase" && out[out.length - 1].event === "Lead", "sorted by spend descending");

// 5) a zero-spend account -> no divide-by-zero, shares are 0.
const empty = computeEventRoi([{ event: "Purchase", spendRs: 0, revenueRs: 0, purchases: 0 }]);
ok(empty[0].spendSharePct === 0 && empty[0].roiPct === null, "zero spend -> 0 share, null ROI, no NaN");

console.log(`check-event-roi: ${pass} assertions passed.`);
