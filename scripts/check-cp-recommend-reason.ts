// Runnable check for lib/creative-production/recommend/reason.ts (grounded recommendation reason).
// Run: node --experimental-strip-types scripts/check-cp-recommend-reason.ts
import assert from "node:assert/strict";
import { recommendReason } from "../lib/creative-production/recommend/reason.ts";

assert.equal(recommendReason(false, 30), "30% off, not advertised yet — a strong offer to test", "untested + discount");
assert.equal(recommendReason(false, 0), "Ad-ready, not advertised yet", "untested, no discount");
assert.match(recommendReason(true, 50), /already advertised/i, "advertised message");
assert.match(recommendReason(true, 0), /already advertised/i, "advertised wins even with no discount");
// No invented performance words (grounding guard).
for (const r of [recommendReason(false, 40), recommendReason(true, 40)]) assert.ok(!/roas|converts|best[- ]?seller|proven/i.test(r), "no invented performance claim");

console.log("PASS: check-cp-recommend-reason (grounded reason: advertised>discount, no invented performance)");
