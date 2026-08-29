// Runnable check for the cache-shape guard (ISSUE 26). No env needed.
//   node --experimental-strip-types scripts/check-renderable.ts
// The audit's test: an old-shape cache fixture must be safely REJECTED (so it degrades to a fresh pull
// instead of a 500), while a current-shape blob is accepted.
import { strict as assert } from "node:assert";
import { isRenderableShape } from "../lib/cockpit/renderable.ts";

// Non-connected states are never cached -> pass through.
assert.equal(isRenderableShape({ status: "not_connected" }), true, "not_connected passes");
assert.equal(isRenderableShape({ status: "error", message: "x" }), true, "error passes");

// A current-shape connected blob is renderable.
const full: Record<string, unknown> = {
  status: "connected",
  view: { wasteContributors: [], atRiskContributors: [], leaderboard: [], doThis: [] },
  scopeTotals: {}, dataQuality: {}, marginal: {}, funnel: {}, metrics: {},
};
assert.equal(isRenderableShape(full), true, "full shape accepted");

// An OLD-shape blob missing any required top-level field is rejected.
for (const missing of ["scopeTotals", "dataQuality", "marginal", "funnel", "metrics", "view"]) {
  const bad = { ...full };
  delete bad[missing];
  assert.equal(isRenderableShape(bad), false, `missing ${missing} -> rejected`);
}

// A connected blob whose view is missing a required array the render maps over is rejected.
const badView = { ...full, view: { wasteContributors: [], atRiskContributors: [], leaderboard: [] } };
assert.equal(isRenderableShape(badView), false, "view missing doThis -> rejected");

// Junk / corrupt blobs are rejected (never crash, never render).
assert.equal(isRenderableShape(null), false, "null rejected");
assert.equal(isRenderableShape("nope"), false, "string rejected");

console.log("PASS: cache-shape guard accepts current/non-connected, rejects old-shape + junk");
