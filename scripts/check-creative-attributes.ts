// Runnable check for the creative-attributes contract (ISSUE 20). No env needed.
//   node --experimental-strip-types scripts/check-creative-attributes.ts
// Locks the exact attribute count + names so docs/prompts/types can't drift back to a phantom "42".
import { strict as assert } from "node:assert";
import { CREATIVE_ATTRIBUTE_KEYS } from "../lib/competitors/types.ts";

assert.equal(CREATIVE_ATTRIBUTE_KEYS.length, 22, `expected 22 creative attributes, got ${CREATIVE_ATTRIBUTE_KEYS.length}`);
assert.equal(new Set(CREATIVE_ATTRIBUTE_KEYS).size, 22, "attribute keys must be unique");
assert.ok(CREATIVE_ATTRIBUTE_KEYS.includes("funnelStage"), "must include funnelStage");
assert.ok(CREATIVE_ATTRIBUTE_KEYS.includes("notes"), "must include notes");
// The type is derived from this array (see types.ts), so a field add/remove that isn't reflected here
// fails the build; this asserts the agreed count so the '42' claim can never reappear silently.

console.log(`PASS: creative attributes contract = ${CREATIVE_ATTRIBUTE_KEYS.length} named fields (single source)`);
