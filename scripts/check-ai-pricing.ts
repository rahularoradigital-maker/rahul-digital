// Runnable check for AI token pricing (lib/ai/token-pricing.ts). No I/O.
// node --experimental-strip-types scripts/check-ai-pricing.ts
import assert from "node:assert/strict";
import { priceFor, costUsd } from "../lib/ai/token-pricing.ts";

// Prefix matching: specific before generic (gpt-4o-mini must not be shadowed by gpt-4o / gpt).
assert.deepEqual(priceFor("gpt-4o-mini"), { in: 0.15, out: 0.6 }, "gpt-4o-mini distinct from gpt-4o");
assert.deepEqual(priceFor("gpt-4o"), { in: 2.5, out: 10.0 });
assert.deepEqual(priceFor("gemini-flash-lite-latest"), { in: 0.1, out: 0.4 }, "flash-lite distinct from flash");
assert.deepEqual(priceFor("gemini-3.6-flash"), { in: 0.3, out: 1.2 });
assert.deepEqual(priceFor("claude-haiku-4-5-20251001"), { in: 1.0, out: 5.0 });
assert.deepEqual(priceFor("claude-sonnet-5"), { in: 3.0, out: 15.0 });

// Unknown model -> a non-zero middling estimate, never $0.
const unk = priceFor("some-future-model");
assert.ok(unk.in > 0 && unk.out > 0, "unknown model priced > 0");

// costUsd: linear in tokens, output priced higher, rounded to 6dp.
assert.equal(costUsd("gpt-4o-mini", 1_000_000, 0), 0.15, "1M prompt tokens @ 0.15");
assert.equal(costUsd("gpt-4o-mini", 0, 1_000_000), 0.6, "1M completion tokens @ 0.60");
assert.equal(costUsd("gpt-4o-mini", 1_000_000, 1_000_000), 0.75, "in+out");
assert.equal(costUsd("gpt-4o-mini", 0, 0), 0, "no tokens -> 0");
assert.equal(costUsd("gpt-4o-mini", -50, -10), 0, "negative tokens clamp to 0");

console.log("PASS: AI token pricing (prefix match, in/out split, unknown>0, cost math)");
