// One runnable check for the cockpit verdict line. No frameworks.
// Run: node --experimental-strip-types scripts/check-verdict-line.ts
import assert from "node:assert/strict";
import { cockpitVerdict } from "../lib/cockpit/verdict-line.ts";

const fmt = (n: number) => `Rs ${n}`;

// Money at stake + do-now count + winners: leads with the leak, then the winners to protect.
assert.equal(
  cockpitVerdict({ atStakeRs: 44094, doNowCount: 7, winners: 2, fatiguing: 3 }, fmt),
  "Rs 44094 is bleeding across 7 do-now fixes - stop it first; 2 winners to protect and scale.",
);

// Singulars read correctly.
assert.equal(
  cockpitVerdict({ atStakeRs: 500, doNowCount: 1, winners: 1, fatiguing: 0 }, fmt),
  "Rs 500 is bleeding across 1 do-now fix - stop it first; 1 winner to protect and scale.",
);

// No winners but fatiguing ads: falls back to the watch clause.
assert.equal(
  cockpitVerdict({ atStakeRs: 1000, doNowCount: 0, winners: 0, fatiguing: 4 }, fmt),
  "Rs 1000 is bleeding - stop it first; 4 ads fatiguing - watch closely.",
);

// Nothing urgent: an HONEST calm line, never a manufactured to-do.
assert.equal(
  cockpitVerdict({ atStakeRs: 0, doNowCount: 0, winners: 0, fatiguing: 0 }, fmt),
  "No urgent money leaks this window. Hold, gather more data, and test new creative.",
);

// Winners with no leak: just the protect clause.
assert.equal(
  cockpitVerdict({ atStakeRs: 0, doNowCount: 0, winners: 3, fatiguing: 0 }, fmt),
  "3 winners to protect and scale.",
);

console.log("PASS: cockpit verdict line (money-led, honest no-urgency case, singular/plural)");
