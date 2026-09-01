// Queue contract test (cleanup #4). Exercises the durable-job semantics against the in-memory impl so the
// contract PostgresQueue must honor is executable and asserted without a database: FIFO claim, a bounded
// claim size, no double-claim inside the visibility window, re-claim after the visibility timeout, retry on
// fail, and dead-letter after maxAttempts. Run: node --experimental-strip-types scripts/check-queue.ts
import assert from "node:assert/strict";
import { InMemoryQueue } from "../lib/queue-memory.ts";

// Controllable clock so the visibility timeout is deterministic (no real waiting).
let clock = 1_000_000;
const q = new InMemoryQueue({ maxAttempts: 3, visibilityMs: 1000, now: () => clock });

// --- enqueue + FIFO claim + bounded size ---
const a = await q.enqueue({ type: "t", payload: { n: 1 } });
const b = await q.enqueue({ type: "t", payload: { n: 2 } });
const c = await q.enqueue({ type: "t", payload: { n: 3 } });
const first = await q.claim(2);
assert.deepEqual(first.map((j) => j.id), [a, b], "claim(2) returns the 2 oldest, in FIFO order");
const second = await q.claim(2);
assert.deepEqual(second.map((j) => j.id), [c], "next claim returns only the remaining job (not the claimed ones)");
assert.deepEqual(await q.claim(2), [], "no unclaimed jobs left -> empty claim (no double-claim inside visibility)");

// --- complete removes a job from the queue permanently ---
await q.complete(a);
clock += 2000; // advance past the visibility window
const afterComplete = (await q.claim(5)).map((j) => j.id).sort();
assert.deepEqual(afterComplete, [b, c].sort(), "completed job never re-appears; the other two time out and are re-claimable");
assert.equal(q.peek(a)!.status, "done", "completed job is marked done");

// --- retry: fail() puts the job back to pending (keeps position), attempts already counted on claim ---
await q.complete(b);
await q.fail(c, "boom"); // c has been claimed twice now (attempts=2), still < maxAttempts=3 -> retry
assert.equal(q.peek(c)!.status, "pending", "a failed job under maxAttempts goes back to pending (retry)");
assert.equal(q.peek(c)!.attempts, 2, "attempts counted per claim");

// --- dead-letter: exhaust attempts ---
const reclaim = await q.claim(1); // 3rd claim of c -> attempts=3
assert.deepEqual(reclaim.map((j) => j.id), [c]);
await q.fail(c, "boom again"); // attempts(3) >= maxAttempts(3) -> dead-letter, NOT re-queued
assert.equal(q.peek(c)!.status, "dead", "a job that exhausts maxAttempts is dead-lettered, not retried forever");
clock += 5000;
assert.deepEqual(await q.claim(5), [], "a dead-lettered job is never claimed again");

// --- fail() on an unknown id is a safe no-op ---
await q.fail("nope", "x");

console.log("PASS: queue contract (FIFO claim, bounded, visibility re-claim, retry, dead-letter)");
