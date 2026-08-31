// One runnable check for the reconcile-with-Meta scope math. No frameworks.
// Run: node --experimental-strip-types scripts/check-reconcile-scopes.ts
import assert from "node:assert/strict";
import { computeScopes, type ReconAd } from "../lib/reconcile/scopes.ts";

const ads: ReconAd[] = [
  { spend: 100, revenue: 500, purchases: 5, active: true, catalog: false }, // active + results
  { spend: 100, revenue: 400, purchases: 2, active: true, catalog: true }, // active + results, catalog
  { spend: 100, revenue: 0, purchases: 0, active: true, catalog: false }, // active, no results
  { spend: 100, revenue: 300, purchases: 3, active: false, catalog: false }, // paused but had results
  { spend: 100, revenue: 0, purchases: 0, active: false, catalog: false }, // paused, no results (pure waste)
];

const r = computeScopes(ads);
const by = new Map(r.scopes.map((s) => [s.key, s]));

// Whole account = everything.
assert.equal(by.get("whole")!.spend, 500, "whole spend = 500");
assert.equal(by.get("whole")!.revenue, 1200, "whole revenue = 1200");
assert.equal(by.get("whole")!.ads, 5, "whole = 5 ads");
assert.ok(Math.abs(by.get("whole")!.roas! - 2.4) < 1e-9, "whole ROAS = 2.4");

// Exclude catalog drops the one catalog ad.
assert.equal(by.get("exclude_catalog")!.ads, 4, "exclude_catalog = 4 ads");
assert.equal(by.get("exclude_catalog")!.spend, 400, "exclude_catalog spend = 400");

// Active only drops the 2 paused ads.
assert.equal(by.get("active")!.ads, 3, "active = 3 ads");
assert.equal(by.get("active")!.spend, 300, "active spend = 300");

// With purchases drops the 2 zero-result ads.
assert.equal(by.get("results")!.ads, 3, "results = 3 ads");
assert.equal(by.get("results")!.revenue, 1200, "results revenue = 1200");

// Active + purchases = the Meta-like filtered view: only the 2 active-with-results ads.
const ar = by.get("active_results")!;
assert.equal(ar.ads, 2, "active_results = 2 ads");
assert.equal(ar.spend, 200, "active_results spend = 200");
assert.equal(ar.revenue, 900, "active_results revenue = 900");
assert.ok(Math.abs(ar.roas! - 4.5) < 1e-9, "active_results ROAS = 4.5 (higher than whole 2.4 - the filter hides waste)");

// The narrower the scope, the higher the ROAS here (the point of the whole view: it shows the hidden waste).
assert.ok(ar.roas! > by.get("whole")!.roas!, "filtered ROAS > whole-account ROAS");

// Determinism.
assert.deepEqual(computeScopes(ads), r, "computeScopes is deterministic");

console.log("OK check-reconcile-scopes: whole vs active vs results vs active+results totals + ROAS verified.");
