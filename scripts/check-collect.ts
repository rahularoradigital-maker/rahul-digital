// Proof for the unified decision feed: per-ad priorities ranked by ₹ (one row per ad, decisions only), with
// account-level reads (diversity, scaling) kept SEPARATE so a whole-account number never buries the ads.
// Run: node --experimental-strip-types scripts/check-collect.ts

import assert from "node:assert/strict";
import type { CockpitData } from "../lib/app/cockpit-data.ts";
import { collectDecisions } from "../lib/intelligence/collect.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const ad = (id: string, o: Record<string, unknown>) =>
  ({ id, name: id, objective: "traffic", spendRs: 1000, revenueRs: 0, roas: null, conversions: 0, verdict: "refresh", score: 30, confidence: 0.6, why: ["y"], action: { label: "Refresh", priority: "high" }, wastedRs: 0, delivering: true, active: true, ...o });

const data = {
  connected: true,
  accountId: "acc", accountName: "Test",
  scopeTotals: { spendRs: 1_000_000 },
  marginal: { classification: "SATURATED", spendElasticity: 0.3, currentRoas: 4, marginalRoas: 1.2, diminishingReturns: true, confidence: 0.8, label: "MODELLED", why: ["saturated"] },
  ownDiversity: { overall: 40, dimensions: [{ dimension: "hook", buckets: [], activeBuckets: 3, diversityScore: 30, dominant: "PS", dominantShare: 0.7, note: "" }], whitespace: [], productionQueue: [], coverage: 0.8, label: "INTERNAL CALCULATION", basis: "x" },
  view: {
    leaderboard: [
      ad("big", { wastedRs: 80000, spendRs: 90000, conversions: 100 }),
      ad("small", { wastedRs: 2000, spendRs: 5000, conversions: 60 }),
      ad("stopped", { delivering: false }),
    ],
  },
} as unknown as CockpitData;

const feed = collectDecisions(data);

// priorities: per-ad, decisions only, ranked by ₹.
ok(feed.priorities.every((c) => !!c.decision && c.entity?.level === "ad"), "priorities are per-ad decisions only");
ok(feed.priorities[0].entity?.id === "big" && feed.priorities[1].entity?.id === "small", "priorities ranked by money at stake (big ₹80k before small ₹2k)");
ok(!feed.priorities.some((c) => c.entity?.id === "stopped"), "a stopped ad is no priority");
ok(feed.priorities.filter((c) => c.entity?.id === "big").length === 1, "one row per ad (no double-count)");

// accountReads: diversity + scaling, SEPARATE (not mixed into per-ad ranking).
ok(feed.accountReads.some((c) => c.kind === "diversity"), "diversity read is in accountReads");
ok(feed.accountReads.some((c) => c.kind === "scaling"), "scaling read is in accountReads");
ok(!feed.priorities.some((c) => c.kind === "diversity" || c.kind === "scaling"), "account-level reads never sit in per-ad priorities");

// disconnected -> empty both.
const empty = collectDecisions({ connected: false } as unknown as CockpitData);
ok(empty.priorities.length === 0 && empty.accountReads.length === 0, "disconnected -> empty feed");

console.log(`check-collect: ${pass} assertions passed (${feed.priorities.length} priorities, ${feed.accountReads.length} account reads).`);
