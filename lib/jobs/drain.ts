import type { Queue } from "../queue.ts";

// The drain LOOP, as a pure function of a Queue + a handler lookup (cleanup #4/#6). Kept separate from the
// HTTP route and the concrete Postgres queue so it is testable against the in-memory queue with a fake
// handler registry (scripts/check-jobs-drain.ts) - no DB, no cron secret. Claims a bounded batch, runs each
// job through its handler, marks it done on success, or failed (the queue decides retry vs dead-letter by
// attempts) on a thrown handler OR a missing handler. One bad job never stops the rest of the batch.
export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

export async function drainQueue(
  queue: Queue,
  getHandler: (type: string) => JobHandler | null,
  batch: number,
): Promise<{ claimed: number; done: number; failed: number }> {
  const jobs = await queue.claim(batch);
  let done = 0;
  let failed = 0;
  for (const job of jobs) {
    const handler = getHandler(job.type);
    if (!handler) {
      await queue.fail(job.id, `no handler registered for type '${job.type}'`);
      failed++;
      continue;
    }
    try {
      await handler(job.payload);
      await queue.complete(job.id);
      done++;
    } catch (e) {
      await queue.fail(job.id, e instanceof Error ? e.message : "handler error");
      failed++;
    }
  }
  return { claimed: jobs.length, done, failed };
}
