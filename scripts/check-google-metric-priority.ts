// One runnable check for Google metric priority ("most effective metrics on top"). No frameworks.
// Run: node --experimental-strip-types scripts/check-google-metric-priority.ts
import assert from "node:assert/strict";
import { topMetricsFor, accountTopMetrics } from "../lib/google/metric-priority.ts";
import { allCampaignTypes, normalizeChannelType } from "../lib/google/campaign-types.ts";

// Every campaign type has a non-empty, de-duplicated ordered stack.
for (const spec of allCampaignTypes()) {
  const m = topMetricsFor(spec.type);
  assert.ok(m.length > 0, `${spec.type} has a metric stack`);
  const keys = m.map((x) => x.key);
  assert.equal(new Set(keys).size, keys.length, `${spec.type} stack has no duplicate metrics`);
  for (const x of m) assert.ok(x.label && x.why, `${spec.type} metric ${x.key} has a label + why`);
}

// Type-specific leads reflect how each type is actually judged.
assert.equal(topMetricsFor("search")[0].key, "cpa", "Search leads on cost/conversion");
assert.ok(topMetricsFor("search").some((m) => m.key === "lost_is_budget"), "Search surfaces Lost IS (budget)");
assert.ok(topMetricsFor("search").some((m) => m.key === "quality_score"), "Search surfaces Quality Score");
assert.equal(topMetricsFor("performance_max")[0].key, "roas", "PMax leads on ROAS");
assert.equal(topMetricsFor("shopping")[0].key, "roas", "Shopping leads on ROAS");
assert.equal(topMetricsFor("video")[0].key, "view_rate", "Video leads on view rate, not ROAS");

// Account-level lead follows the spend.
const shoppingHeavy = accountTopMetrics({ search: 40000, shopping: 250000, performance_max: 90000 });
assert.equal(shoppingHeavy.leadType, "shopping", "spend-weighted lead is the biggest-spend type");
assert.equal(shoppingHeavy.metrics[0].key, "roas", "shopping-heavy account leads with ROAS");
const searchHeavy = accountTopMetrics({ search: 300000, display: 20000 });
assert.equal(searchHeavy.leadType, "search", "search-heavy account leads with Search metrics");
assert.equal(accountTopMetrics({}).leadType, "search", "empty spend defaults to Search");

// Channel-type normalisation (raw GAQL/label -> taxonomy).
assert.equal(normalizeChannelType("PERFORMANCE_MAX"), "performance_max");
assert.equal(normalizeChannelType("Discovery"), "demand_gen", "Discovery migrated to Demand Gen");
assert.equal(normalizeChannelType("SEARCH"), "search");
assert.equal(normalizeChannelType("YouTube"), "video");
assert.equal(normalizeChannelType(null), "search", "unknown/null defaults to Search, never throws");

console.log("OK check-google-metric-priority: per-type stacks + spend-weighted account lead + channel normalisation verified.");
