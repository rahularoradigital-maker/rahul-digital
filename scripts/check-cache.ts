// Runnable check for lib/cache.ts (the ADR-0004 cache seam).
//   npm run check:cache
import { strict as assert } from "node:assert";
import { InMemoryCache } from "../lib/cache.ts";

// Controllable clock so TTL expiry is deterministic (no sleeping).
let t = 1000;
const cache = new InMemoryCache(() => t);

// round trip
await cache.set("k", { a: 1 });
assert.deepEqual(await cache.get("k"), { a: 1 }, "round trip");

// miss returns null
assert.equal(await cache.get("missing"), null, "miss -> null");

// del
await cache.del("k");
assert.equal(await cache.get("k"), null, "del removes");

// TTL: not expired, then expired after the clock advances past it
await cache.set("ttl", "v", 10); // expires at t=1000 + 10s = 11000
assert.equal(await cache.get("ttl"), "v", "within TTL -> value");
t = 12000; // advance past expiry
assert.equal(await cache.get("ttl"), null, "past TTL -> null (and evicted)");

console.log("PASS: cache seam checks");
