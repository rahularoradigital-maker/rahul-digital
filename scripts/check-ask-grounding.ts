// Runnable check for lib/ask-grounding.ts (ISSUE 28). No env needed.
//   node --experimental-strip-types scripts/check-ask-grounding.ts
import { strict as assert } from "node:assert";
import { groundedNumbers, ungroundedNumbers, extractNumbers } from "../lib/ask-grounding.ts";

// numbers are pulled from nested objects, arrays, and formatted strings.
const data = {
  window: "last 14 days",
  totals: { spend: 1735163, revenue: 7680095, roas: 4.43 },
  waste: { totalWastedRs: 55010, shareOfSpend: 0.04, ads: [{ roas: 10.6 }] },
};
const g = groundedNumbers(data);
assert.ok(g.has(4.43) && g.has(55010) && g.has(10.6) && g.has(14), "collects nested + string numbers");

// A grounded answer (all figures from DATA) -> nothing flagged.
assert.deepEqual(ungroundedNumbers("Your wasted spend is Rs 55,010 and ROAS is 4.43x over 14 days.", g), [], "grounded answer passes");

// Formatting/rounding tolerance: commas and a 1% rounding both pass.
assert.deepEqual(ungroundedNumbers("Spend was Rs 17,35,163 (about 17,35,000).", g), [], "commas + rounding within 1% pass");

// A FABRICATED specific number is flagged.
assert.deepEqual(ungroundedNumbers("Your wasted spend is Rs 87,342.", g), [87342], "fabricated number flagged");

// Small counts / list ordinals are NOT flagged (phrasing, not claimed metrics).
assert.deepEqual(ungroundedNumbers("Here are 4 ideas, ranked 1 to 4.", g), [], "small ordinals ignored");

// extractNumbers handles currency, x, %, commas.
assert.deepEqual(extractNumbers("Rs 55,010 at 4.43x and 4%"), [55010, 4.43, 4], "extract normalizes formats");

console.log("PASS: Ask grounding collects DATA numbers, passes grounded/rounded, flags fabrications");
