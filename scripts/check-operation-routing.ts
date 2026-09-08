// Runnable check for dispatcher routing (Track A, Phase A3). Pure, no network, no env.
//   node --experimental-strip-types scripts/check-operation-routing.ts
// Proves each operation kind routes to the right tool, and that the named target resolves deterministically
// (exact id, exact name, substring) or honestly fails - never silently matching the wrong object.
import { strict as assert } from "node:assert";
import { routeFor, matchTarget } from "../lib/operations/routing.ts";

// 1) Routing per kind.
assert.equal(routeFor("propose_budget_change").tool, "cockpit");
assert.equal(routeFor("propose_budget_change").needsTarget, true, "a budget change must resolve a target");
assert.equal(routeFor("propose_pause").tool, "cockpit");
assert.equal(routeFor("diagnose").tool, "cockpit");
assert.equal(routeFor("diagnose").needsTarget, false, "account-level diagnose needs no target");
assert.equal(routeFor("brief_new_campaign").tool, "creative");
assert.equal(routeFor("launch_creative").routeTo, "/app/creative-production");
assert.equal(routeFor("answer").tool, "ask");

// 2) Target resolution.
const rows = [
  { id: "120210", name: "Diwali Hook A", adsetName: "Prospecting", campaignName: "Festive Sale" },
  { id: "120211", name: "Diwali Hook B", adsetName: "Retargeting", campaignName: "Festive Sale" },
  { id: "999", name: "Always-On Brand", adsetName: "BAU", campaignName: "Always-On Brand" },
];
assert.equal(matchTarget(rows, "120211")?.id, "120211", "exact id wins");
assert.equal(matchTarget(rows, "Diwali Hook A")?.id, "120210", "exact name wins");
assert.equal(matchTarget(rows, "retargeting")?.id, "120211", "substring on ad set resolves");
assert.equal(matchTarget(rows, "festive")?.id, "120210", "substring on campaign resolves to the first match");
assert.equal(matchTarget(rows, "nonexistent ad"), null, "no match returns null, not a wrong guess");
assert.equal(matchTarget(rows, ""), null, "empty query returns null");
assert.equal(matchTarget(rows, "  120210  ")?.id, "120210", "query is trimmed");

// 3) matchTarget returns the FULL row (keeps metrics), not a stripped copy.
const withMetrics = [{ id: "a1", name: "Winner", spendRs: 1000, roas: 4.2 }];
assert.equal(matchTarget(withMetrics, "a1")?.roas, 4.2, "full row (metrics) is returned");

console.log("OK check-operation-routing: kinds route to the right tool, targets resolve deterministically or fail honestly.");
