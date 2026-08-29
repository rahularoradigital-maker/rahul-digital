// One runnable check: the per-ad headline metric matches the OBJECTIVE, so awareness/engagement ads
// never display a "0.0x ROAS" that reads as a ROAS verdict. No frameworks.
// Run: node --experimental-strip-types scripts/check-objective-headline.ts
import assert from "node:assert/strict";
import { objectiveHeadline } from "../lib/rules/objective-metrics.ts";

// Conversion -> ROAS (the sales family keeps ROAS).
assert.deepEqual(objectiveHeadline("conversion", { spendRs: 1000, roas: 2.5, impressions: 5000, clicks: 100 }), { label: "ROAS", value: "2.5x" });

// Awareness -> CPM, NEVER ROAS (this is the bug the user hit: an awareness ad showing 0.0x).
const aw = objectiveHeadline("awareness", { spendRs: 6000, roas: 0, impressions: 1_000_000, clicks: 2000 });
assert.equal(aw.label, "CPM", "awareness is read on CPM, not ROAS");
assert.equal(aw.value, "₹6", "CPM = 6000/1e6*1000 = 6");
assert.notEqual(aw.value, "0.0x", "an awareness ad must never show a ROAS figure");

// Engagement -> CTR.
assert.deepEqual(objectiveHeadline("engagement", { spendRs: 6000, roas: 0, impressions: 100_000, clicks: 1500 }), { label: "CTR", value: "1.50%" });

// Traffic / leads / app_installs -> link CPC.
assert.deepEqual(objectiveHeadline("traffic", { spendRs: 5000, roas: 0, impressions: 100_000, clicks: 2500 }), { label: "CPC", value: "₹2.0" });
assert.equal(objectiveHeadline("leads", { spendRs: 5000, roas: 0, impressions: 100_000, clicks: 1000 }).label, "CPC");

// No fabrication: missing impressions/clicks (e.g. an old cache) -> "n/a", never a made-up number.
assert.equal(objectiveHeadline("awareness", { spendRs: 6000, roas: 0 }).value, "n/a", "no impressions -> n/a CPM");
assert.equal(objectiveHeadline("engagement", { spendRs: 6000, roas: 0, impressions: 0, clicks: 0 }).value, "n/a", "zero impressions -> n/a CTR");
// A conversion ad with 0 spend still reports n/a ROAS, never a fake.
assert.equal(objectiveHeadline("conversion", { spendRs: 0, roas: null }).value, "n/a");

console.log("PASS: objective-appropriate headline metric (awareness->CPM, engagement->CTR, traffic->CPC, sales->ROAS, n/a-safe)");
