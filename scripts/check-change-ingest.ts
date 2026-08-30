// Runnable check for the change-history mapping (lib/ingest/change-map.ts). No network, no DB.
// node --experimental-strip-types scripts/check-change-ingest.ts
import assert from "node:assert/strict";
import { mapActivityRow, normalizeChangeType, levelFromActivity, sourceFromActor, dedupeChanges, type ChangeRow } from "../lib/ingest/change-map.ts";

// event_type -> normalized change_type
assert.equal(normalizeChangeType("update_ad_set_budget"), "budget");
assert.equal(normalizeChangeType("update_campaign_group_spend_cap"), "budget");
assert.equal(normalizeChangeType("update_ad_set_run_status"), "status");
assert.equal(normalizeChangeType("update_ad_set_bid_strategy"), "bid");
assert.equal(normalizeChangeType("update_ad_set_target_spec"), "audience");
assert.equal(normalizeChangeType("update_ad_creative"), "creative");
assert.equal(normalizeChangeType("update_campaign_name"), "name");
assert.equal(normalizeChangeType("update_ad_set_optimization_goal"), "optimization");
assert.equal(normalizeChangeType("some_unknown_event"), "other");

// level detection: object_type first, then event_type inference
assert.equal(levelFromActivity("CAMPAIGN", "x"), "campaign");
assert.equal(levelFromActivity("AD_SET", "x"), "adset");
assert.equal(levelFromActivity("AD", "x"), "ad");
assert.equal(levelFromActivity("AD_ACCOUNT", "x"), "account");
assert.equal(levelFromActivity(undefined, "update_campaign_budget"), "campaign");
assert.equal(levelFromActivity(undefined, "update_ad_set_run_status"), "adset");

// source: an actor => buyer; missing/zero actor => algo
assert.equal(sourceFromActor("100088"), "buyer");
assert.equal(sourceFromActor("0"), "algo");
assert.equal(sourceFromActor(null), "algo");
assert.equal(sourceFromActor(undefined), "algo");

// Full row: a real buyer budget change on an ad set
const row = mapActivityRow({
  event_type: "update_ad_set_budget",
  event_time: "2026-08-29T17:25:46+0000",
  actor_id: "100088", actor_name: "Priya (Buyer)",
  object_id: "23851", object_name: "AdSet - Prospecting", object_type: "AD_SET",
  extra_data: '{"old_value":"50000","new_value":"80000"}',
});
assert.ok(row, "row maps");
const r = row as ChangeRow;
assert.equal(r.change_type, "budget");
assert.equal(r.level, "adset");
assert.equal(r.adset_id, "23851");
assert.equal(r.campaign_id, null);
assert.equal(r.source, "buyer");
assert.equal(r.actor_name, "Priya (Buyer)");
assert.equal(r.date, "2026-08-29");
assert.equal(r.change_id, "23851:2026-08-29T17:25:46+0000:update_ad_set_budget");
assert.deepEqual(r.extra_data, { old_value: "50000", new_value: "80000" });

// Missing event_type/time -> dropped, never a fake row
assert.equal(mapActivityRow({ event_type: "", event_time: "2026-08-29T00:00:00+0000" }), null);
assert.equal(mapActivityRow({ event_type: "x", event_time: "" }), null);

// Algo move (no actor) => source algo
const algo = mapActivityRow({ event_type: "campaign_ended", event_time: "2026-08-20T00:00:00+0000", object_id: "9", object_type: "CAMPAIGN" });
assert.equal((algo as ChangeRow).source, "algo");

// dedupe collapses identical change_id but keeps distinct ones (r vs algo have different change_ids)
assert.equal(dedupeChanges([r, r, algo as ChangeRow]).length, 2, "dedupe by change_id keeps distinct");
assert.equal(dedupeChanges([r, r, r]).length, 1, "identical change_ids collapse to one");

console.log("PASS: change-history mapping (event->type, level, source, dedupe, safe-drop)");
