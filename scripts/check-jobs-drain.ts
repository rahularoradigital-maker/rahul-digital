// Contract test for the durable-job drain loop (cleanup #4/#6). Runs drainQueue against the in-memory queue
// with a fake handler registry - no DB, no cron - to prove: a good handler completes its job, a throwing
// handler fails it (retry then dead-letter after maxAttempts), a missing handler fails it, one bad job never
// stops the rest of the batch, and an empty queue is a no-op.
// Run: node --experimental-strip-types scripts/check-jobs-drain.ts
import assert from "node:assert/strict";
import { InMemoryQueue } from "../lib/queue-memory.ts";
import { drainQueue, type JobHandler } from "../lib/jobs/drain.ts";

const handlers: Record<string, JobHandler> = {
  ok: async () => {},
  boom: async () => {
    throw new Error("boom");
  },
};
const getHandler = (t: string): JobHandler | null => handlers[t] ?? null;

const q = new InMemoryQueue({ maxAttempts: 2 });
const okId = await q.enqueue({ type: "ok", payload: {} });
const boomId = await q.enqueue({ type: "boom", payload: {} });
const orphanId = await q.enqueue({ type: "no_such_type", payload: {} });

// First drain: whole batch claimed; ok completes; boom (throws) + orphan (no handler) both fail -> retried.
const r1 = await drainQueue(q, getHandler, 10);
assert.deepEqual(r1, { claimed: 3, done: 1, failed: 2 }, "batch: 1 done, 2 failed");
assert.equal(q.peek(okId)!.status, "done", "successful handler -> job done");
assert.equal(q.peek(boomId)!.status, "pending", "throwing handler -> retried (attempts < max)");
assert.equal(q.peek(orphanId)!.status, "pending", "missing handler -> retried");
// (batch isolation: ok completed even though boom + orphan were in the same batch - asserted by done===1 above)

// Second drain: the two retryable jobs hit attempts=2=max on this claim, fail again -> dead-letter. The done
// job is not re-claimed.
const r2 = await drainQueue(q, getHandler, 10);
assert.deepEqual(r2, { claimed: 2, done: 0, failed: 2 }, "only the two retryable jobs re-claimed");
assert.equal(q.peek(boomId)!.status, "dead", "boom dead-lettered after maxAttempts");
assert.equal(q.peek(orphanId)!.status, "dead", "orphan dead-lettered after maxAttempts");

// Nothing left -> no-op.
assert.deepEqual(await drainQueue(q, getHandler, 10), { claimed: 0, done: 0, failed: 0 }, "empty queue is a no-op");

console.log("PASS: jobs drain (dispatch, complete, retry, missing-handler, dead-letter, batch isolation)");
