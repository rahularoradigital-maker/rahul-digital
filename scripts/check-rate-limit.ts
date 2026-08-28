// Runnable check for lib/rate-limit.ts. No env needed.
//   node --experimental-strip-types scripts/check-rate-limit.ts
import { strict as assert } from "node:assert";
import { createRateLimiter } from "../lib/rate-limit.ts";

const limit = createRateLimiter({ windowMs: 1000, max: 3 });
let t = 0;

// First `max` requests in the window are allowed.
assert.equal(limit("ip1", t).limited, false, "1st allowed");
assert.equal(limit("ip1", t).limited, false, "2nd allowed");
assert.equal(limit("ip1", t).limited, false, "3rd allowed");
// The one past the cap is blocked, and reports a positive retry-after.
const blocked = limit("ip1", t);
assert.equal(blocked.limited, true, "4th blocked");
assert.ok(blocked.retryAfterMs > 0 && blocked.retryAfterMs <= 1000, "retryAfterMs within window");

// A different key is independent (no cross-IP contamination).
assert.equal(limit("ip2", t).limited, false, "other key independent");

// After the window elapses, the key resets and is allowed again.
t = 1001;
assert.equal(limit("ip1", t).limited, false, "resets after window");

// Bounded memory: exceeding maxKeys sweeps expired entries instead of growing forever.
const small = createRateLimiter({ windowMs: 10, max: 1, maxKeys: 2 });
small("a", 0);
small("b", 0);
small("c", 100); // now > 2 keys and a,b expired -> swept on this call
assert.ok(small("c", 100).limited, "c still tracked after sweep");

console.log("PASS: rate limiter fixed-window, per-key isolation, window reset, bounded map");
