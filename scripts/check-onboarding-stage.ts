// Runnable check for the first-run stage machine (lib/onboarding/stage.ts). Plain asserts.
// Run: npm run check:onboarding-stage

import assert from "node:assert/strict";
import { firstRunStage, isFirstRunComplete, firstRunProgress } from "../lib/onboarding/stage.ts";

// Ordering: connect gates brand gates syncing gates ready. A later signal never skips an earlier gap.
assert.equal(firstRunStage({ metaConnected: false, brandConfirmed: false, hasData: false }), "connect");
assert.equal(firstRunStage({ metaConnected: false, brandConfirmed: true, hasData: true }), "connect", "no Meta -> always connect first");
assert.equal(firstRunStage({ metaConnected: true, brandConfirmed: false, hasData: false }), "brand");
assert.equal(firstRunStage({ metaConnected: true, brandConfirmed: false, hasData: true }), "brand", "data without brand still needs brand");
assert.equal(firstRunStage({ metaConnected: true, brandConfirmed: true, hasData: false }), "syncing", "the gap that kills activation");
assert.equal(firstRunStage({ metaConnected: true, brandConfirmed: true, hasData: true }), "ready");

assert.equal(isFirstRunComplete({ metaConnected: true, brandConfirmed: true, hasData: true }), true);
assert.equal(isFirstRunComplete({ metaConnected: true, brandConfirmed: true, hasData: false }), false, "syncing is NOT complete");

assert.deepEqual(firstRunProgress({ metaConnected: false, brandConfirmed: false, hasData: false }), { done: 0, total: 3 });
assert.deepEqual(firstRunProgress({ metaConnected: true, brandConfirmed: true, hasData: false }), { done: 2, total: 3 });
assert.deepEqual(firstRunProgress({ metaConnected: true, brandConfirmed: true, hasData: true }), { done: 3, total: 3 });

console.log("check-onboarding-stage: OK");
