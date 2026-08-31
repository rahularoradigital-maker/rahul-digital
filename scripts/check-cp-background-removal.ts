// One runnable check for the background-removal provider selection (product-fidelity path). No frameworks.
// Only the PURE selectRemover() is exercised - no network. Run:
//   node --experimental-strip-types scripts/check-cp-background-removal.ts
import assert from "node:assert/strict";
import { selectRemover } from "../lib/creative-production/media/background-removal.ts";

// Photoroom wins when its key is present (preferred: more accurate + cheaper per research).
assert.equal(selectRemover({ PHOTOROOM_API_KEY: "pk", REMOVEBG_API_KEY: "rk" }), "photoroom");
assert.equal(selectRemover({ PHOTOROOM_API_KEY: "pk" }), "photoroom");
// remove.bg is the fallback when only its key is present.
assert.equal(selectRemover({ REMOVEBG_API_KEY: "rk" }), "removebg");
// No key -> "none" (keyless stub: still returns the real product, just uncut).
assert.equal(selectRemover({}), "none");
// Blank/whitespace keys count as absent.
assert.equal(selectRemover({ PHOTOROOM_API_KEY: "   ", REMOVEBG_API_KEY: "" }), "none");

console.log("OK check-cp-background-removal: provider selection correct (photoroom > removebg > none).");
