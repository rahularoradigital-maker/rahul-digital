// S6: runnable check for the pure Core-Web-Vitals rating + p75 (lib/vitals/rate.ts). No I/O.
// node --experimental-strip-types scripts/check-vitals.ts
import assert from "node:assert/strict";
import { isVitalName, isValidVitalValue, rateVital, p75 } from "../lib/vitals/rate.ts";

// name validation
assert.ok(isVitalName("LCP") && isVitalName("CLS") && isVitalName("INP"), "known metric names accepted");
assert.equal(isVitalName("bogus"), false, "unknown metric rejected");

// value validation: negatives / NaN / absurd timings rejected; CLS bounded separately.
assert.equal(isValidVitalValue("LCP", -1), false, "negative rejected");
assert.equal(isValidVitalValue("LCP", Number.NaN), false, "NaN rejected");
assert.equal(isValidVitalValue("LCP", 700_000), false, "absurd timing rejected (>10min)");
assert.ok(isValidVitalValue("LCP", 2400), "a real LCP accepted");
assert.ok(isValidVitalValue("CLS", 0.05), "a real CLS accepted");
assert.equal(isValidVitalValue("CLS", 101), false, "absurd CLS rejected");

// rating thresholds (Google): boundary is inclusive at `good`, strictly above `poor` is poor.
assert.equal(rateVital("LCP", 2500), "good", "LCP at 2500 is good (inclusive)");
assert.equal(rateVital("LCP", 2500.1), "needs-improvement", "LCP just over good");
assert.equal(rateVital("LCP", 4000), "needs-improvement", "LCP at 4000 is still not poor (inclusive)");
assert.equal(rateVital("LCP", 4000.1), "poor", "LCP over 4000 is poor");
assert.equal(rateVital("CLS", 0.1), "good", "CLS at 0.1 is good");
assert.equal(rateVital("CLS", 0.26), "poor", "CLS over 0.25 is poor");
assert.equal(rateVital("TTFB", 800), "good");
assert.equal(rateVital("INP", 600), "poor");

// p75 (nearest-rank): empty -> null (never a fabricated 0).
assert.equal(p75([]), null, "empty -> null");
assert.equal(p75([5]), 5, "single value");
// 1..10 -> 75th percentile nearest-rank = ceil(0.75*10)=8th value = 8
assert.equal(p75([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 8, "p75 of 1..10 is 8");
assert.equal(p75([10, 1, 5]), 10, "unsorted input handled; p75 of 3 = 3rd = 10");

console.log("PASS: web vitals rating (name/value validation, Google thresholds inclusive-at-good, p75 nearest-rank)");
