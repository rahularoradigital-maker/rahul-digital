// Runnable check for lib/causality.ts (buyer-judgment-rules.md J3 + J4). No env needed.
//   node --experimental-strip-types scripts/check-causality.ts
import { strict as assert } from "node:assert";
import { CAUSE_LADDER, diagnose, severityForCause } from "../lib/causality.ts";
import type { DiagnosticSignals } from "../lib/causality.ts";

// ladder shape: fixed order, measurement first, creative_fatigue last.
assert.equal(CAUSE_LADDER[0], "measurement", "measurement must be the first rung (J4)");
assert.equal(CAUSE_LADDER[CAUSE_LADDER.length - 1], "creative_fatigue", "creative_fatigue must be LAST (J3)");
assert.equal(CAUSE_LADDER.length, 8, "ladder has 8 rungs");
assert.equal(new Set(CAUSE_LADDER).size, CAUSE_LADDER.length, "rungs must be unique");

// J4 gate FIRST: a broken pixel suppresses the whole board, even for a tiny move.
const gated = diagnose({ measurementBroken: true, cpmSpiked: true, moveSizePct: 3 });
assert.equal(gated.status, "suppressed");
assert.ok(gated.status === "suppressed" && gated.reason === "fix measurement first");

// broken-pixel small move -> severity "black" DESPITE small moveSizePct (graded by cause, not size).
assert.equal(severityForCause("measurement", 2), "black", "measurement is black at any size (J4)");
assert.equal(severityForCause("tracking_attribution", 2), "red", "tracking is red at any size");
// a benign cause with a LARGE move is not automatically red (J3).
assert.equal(severityForCause("auction_cpm", 30), "green", "a 30% festival-auction move is green (J3)");

// cpmSpiked (measurement + tracking clean) -> auction_cpm, with the two rungs above it ruled out.
const cpm = diagnose({ cpmSpiked: true, moveSizePct: 22 });
assert.ok(cpm.status === "ok" && cpm.cause === "auction_cpm", "cpm spike diagnoses auction_cpm");
assert.ok(cpm.status === "ok" && cpm.ruledOut.includes("measurement"), "measurement must be ruled out");
assert.ok(cpm.status === "ok" && cpm.ruledOut.includes("tracking_attribution"), "tracking must be ruled out");
assert.ok(cpm.status === "ok" && cpm.severity === "green", "cpm at 22% move is green (benign cause)");

// audience_saturation ONLY when supply + sameness are both healthy (J3 suppression).
// high freq + fresh creative does NOT recover + both health checks true -> saturation.
const saturated: DiagnosticSignals = {
  frequencyHigh: true,
  freshCreativeRecovers: false,
  creativeSupplyHealthy: true,
  samenessHealthy: true,
  moveSizePct: 18,
};
const sat = diagnose(saturated);
assert.ok(sat.status === "ok" && sat.cause === "audience_saturation", "healthy supply/sameness -> saturation");
assert.ok(sat.status === "ok" && sat.rung === CAUSE_LADDER.indexOf("audience_saturation"), "rung index matches");

// same signals but supply/sameness NOT healthy -> saturation is SKIPPED and it
// falls through to creative_fatigue, with audience_saturation now in ruledOut.
const notHealthy = diagnose({ ...saturated, creativeSupplyHealthy: false });
assert.ok(notHealthy.status === "ok" && notHealthy.cause === "creative_fatigue", "suppressed saturation falls to fatigue");
assert.ok(
  notHealthy.status === "ok" && notHealthy.ruledOut.includes("audience_saturation"),
  "skipped saturation must be listed as ruled out",
);

// clean set, high freq, a fresh creative RECOVERS, supply/sameness healthy ->
// walks all the way to creative_fatigue LAST, every earlier rung ruled out.
const fatigue = diagnose({
  frequencyHigh: true,
  freshCreativeRecovers: true,
  creativeSupplyHealthy: true,
  samenessHealthy: true,
  moveSizePct: 40,
});
assert.ok(fatigue.status === "ok" && fatigue.cause === "creative_fatigue", "fresh-creative-recovers -> fatigue LAST");
assert.ok(
  fatigue.status === "ok" && fatigue.rung === CAUSE_LADDER.length - 1,
  "creative_fatigue is the last rung",
);
for (const earlier of CAUSE_LADDER.slice(0, -1)) {
  assert.ok(
    fatigue.status === "ok" && fatigue.ruledOut.includes(earlier),
    `every earlier rung ruled out (${earlier})`,
  );
}
assert.ok(fatigue.status === "ok" && fatigue.severity === "red", "a 40% move on fatigue is red by size");

// nothing fires and nothing to decide on -> insufficient_data.
const nothing = diagnose({ moveSizePct: 12 });
assert.equal(nothing.status, "insufficient_data");

console.log("PASS: causality ladder checks");
