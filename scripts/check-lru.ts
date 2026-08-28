// Runnable check for lib/lru.ts (ISSUE 09). No env needed.
//   node --experimental-strip-types scripts/check-lru.ts
import { strict as assert } from "node:assert";
import { LruMap } from "../lib/lru.ts";

const c = new LruMap<string, number>(3);
c.set("a", 1);
c.set("b", 2);
c.set("c", 3);
assert.equal(c.size, 3, "holds up to max");

// Inserting a 4th evicts the least-recently-used (a).
c.set("d", 4);
assert.equal(c.size, 3, "stays bounded at max");
assert.equal(c.get("a"), undefined, "LRU 'a' evicted");
assert.deepEqual([...c.keys()].sort(), ["b", "c", "d"], "b,c,d remain");

// get() bumps recency: touch b, then insert e -> c (now LRU) is evicted, not b.
c.get("b");
c.set("e", 5);
assert.equal(c.get("c"), undefined, "'c' evicted after 'b' was bumped");
assert.equal(c.get("b"), 2, "'b' survived because it was recently used");

// delete + keys behave like a Map (bustCockpitCache relies on these).
c.delete("b");
assert.equal(c.get("b"), undefined, "delete works");
assert.ok(!([...c.keys()].includes("b")), "keys() reflects deletion");

console.log("PASS: LRU bound, LRU eviction order, recency bump, delete/keys surface");
