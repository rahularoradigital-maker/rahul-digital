// Runnable check for the shared optimization-event scope predicate (lib/scope/event-filter.ts). No I/O.
// node --experimental-strip-types scripts/check-scoping.ts
import assert from "node:assert/strict";
import { passesEventFilter } from "../lib/scope/event-filter.ts";

// Filter OFF (nothing selected) -> every ad passes, whatever its event (incl. null).
assert.equal(passesEventFilter("PURCHASE", null), true, "null selection = keep all");
assert.equal(passesEventFilter(null, null), true);
assert.equal(passesEventFilter("PURCHASE", new Set()), true, "empty selection = keep all");
assert.equal(passesEventFilter(null, new Set()), true);

// Filter ON -> keep only ads whose stored event is in the set.
const sel = new Set(["ADD_TO_CART", "PURCHASE"]);
assert.equal(passesEventFilter("ADD_TO_CART", sel), true, "selected event passes");
assert.equal(passesEventFilter("PURCHASE", sel), true);
assert.equal(passesEventFilter("LEAD", sel), false, "unselected event is dropped");

// Ads with NO stored event are dropped while a filter is active (can't attribute them to the chosen event).
assert.equal(passesEventFilter(null, sel), false, "null event dropped under active filter");
assert.equal(passesEventFilter(undefined, sel), false, "undefined event dropped under active filter");

console.log("PASS: optimization-event scope predicate (off=keep-all, on=match-only, null-dropped-when-active)");
