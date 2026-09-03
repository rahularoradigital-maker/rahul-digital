// Runnable check for the pure logic in lib/rollups/account.ts (10x #5 instant-app rollups).
// Run: npm run check:rollups

import { strict as assert } from "node:assert";
import { computeScopes, type ReconAd } from "../lib/reconcile/scopes.ts";
import { rollupHeadline, isRollupFresh, buildRollupRecon, reconHeadlines } from "../lib/rollups/pure.ts";

function main() {
  // rollupHeadline extracts the whole-account scope exactly (same math the reconcile page shows).
  const ads: ReconAd[] = [
    { spend: 100, revenue: 300, purchases: 4, active: true, catalog: false },
    { spend: 50, revenue: 0, purchases: 0, active: false, catalog: true },
    { spend: 25, revenue: 100, purchases: 1, active: true, catalog: false },
  ];
  const report = computeScopes(ads);
  const h = rollupHeadline(report);
  assert.equal(h.spend, 175, "whole-account spend = sum of all ad spend");
  assert.equal(h.revenue, 400, "whole-account revenue = sum of all ad revenue");
  assert.equal(h.ads, 3, "whole-account ad count = every ad in the window");
  // headline must equal the "whole" scope, never a filtered one
  const whole = report.scopes.find((s) => s.key === "whole");
  assert.equal(h.spend, whole?.spend);
  assert.equal(h.ads, whole?.ads);

  // A report with no ads -> zeroed headline, never a crash.
  const empty = rollupHeadline(computeScopes([]));
  assert.deepEqual(empty, { spend: 0, revenue: 0, ads: 0 });

  // Freshness: within the window fresh, past it stale, garbage timestamp is never fresh.
  const now = Date.parse("2026-09-02T12:00:00Z");
  assert.equal(isRollupFresh("2026-09-02T00:00:00Z", now, 26 * 3600 * 1000), true, "12h old is fresh under a 26h window");
  assert.equal(isRollupFresh("2026-08-31T00:00:00Z", now, 26 * 3600 * 1000), false, "60h old is stale under a 26h window");
  assert.equal(isRollupFresh("not-a-date", now), false, "unparseable timestamp is never fresh");
  assert.equal(isRollupFresh(new Date(now).toISOString(), now, 0), true, "exactly now is fresh at maxAge 0 (<=)");

  // buildRollupRecon: identical stored vs fresh => trustworthy match; a >5% gap => conflict (rollup stale).
  const same = buildRollupRecon({ spend: 1000, revenue: 3000 }, { spend: 1000, revenue: 3000 });
  assert.equal(same.summary.trustworthy, true, "identical rollup vs store is trustworthy");
  assert.equal(same.summary.conflicts, 0);
  assert.equal(same.recs.length, 2, "checks spend + revenue");
  const stale = buildRollupRecon({ spend: 1000, revenue: 3000 }, { spend: 1000, revenue: 3600 }); // revenue +20%
  assert.equal(stale.summary.trustworthy, false, "a 20% revenue gap is a conflict (rollup stale)");
  assert.ok(stale.summary.conflicts >= 1);

  // reconHeadlines: cross-source (store vs Meta) with the given source labels; matching => trustworthy.
  const vsMeta = reconHeadlines({ spend: 1000, revenue: 3000 }, { spend: 1000, revenue: 3000 }, "store", "meta");
  assert.equal(vsMeta.summary.trustworthy, true, "store == meta is trustworthy");
  assert.ok(vsMeta.recs[0].note.includes("store") && vsMeta.recs[0].note.includes("meta"), "notes name both sources");
  const conflictMeta = reconHeadlines({ spend: 1000, revenue: 3000 }, { spend: 1300, revenue: 3000 }, "store", "meta"); // spend +30%
  assert.equal(conflictMeta.summary.trustworthy, false, "a 30% spend gap vs Meta is a conflict");

  console.log("PASS: account rollups (headline = whole-account scope, empty-safe, freshness window, drift verdict)");
}

main();
