// Runnable check for the resumable ingestion ordering (lib/ingest/ad-metrics.ts selectAdsToSync).
// node --experimental-strip-types scripts/check-ingest-resumable.ts
import assert from "node:assert/strict";
import { selectAdsToSync } from "../lib/ingest/select-ads.ts";

const ads = [{ adId: "a" }, { adId: "b" }, { adId: "c" }, { adId: "d" }];
const cutoff = 1000;
// b was synced AFTER the cutoff (fresh) -> skipped. a is missing (never synced). c/d are stale, d staler.
const syncedAt = new Map<string, number>([
  ["b", 2000],
  ["c", 800],
  ["d", 500],
]);

const order = selectAdsToSync(ads, syncedAt, cutoff).map((a) => a.adId);

// Fresh ad (synced within the window) is not re-synced this run.
assert.ok(!order.includes("b"), `a fresh ad is skipped, got ${order.join(",")}`);
// Never-synced ad comes first, then the stalest, then the less stale.
assert.deepEqual(order, ["a", "d", "c"], `missing-first then stalest-first, got ${order.join(",")}`);

// Everything fresh -> nothing to do -> a run is immediately "complete" (empty work list).
const allFresh = selectAdsToSync(ads, new Map(ads.map((a) => [a.adId, 5000])), cutoff);
assert.equal(allFresh.length, 0, "when every ad is fresh, there is no work (the sync stays complete)");

// Cold start (no ad_meta yet) -> every ad is work, original order preserved (all equal at 0).
const cold = selectAdsToSync(ads, new Map(), cutoff).map((a) => a.adId);
assert.deepEqual(cold, ["a", "b", "c", "d"], "a cold start queues every ad");

console.log("PASS: resumable ingestion ordering checks");
