import "server-only";
import type { JobHandler } from "./drain.ts";

// Job-type -> handler registry (cleanup #4). The drain (app/api/jobs/drain) claims pending jobs and dispatches
// each by its `type` to the handler here; a handler runs the actual work and THROWS on failure (the drain then
// retries or dead-letters via the queue's attempts logic). To move a long-running route onto durable jobs:
// add its background work as a new handler here, and have the route enqueue that type instead of running inline.
// Keeping handlers here (not inside the drain route) keeps the drain a thin, generic worker.
export const JOB_HANDLERS: Record<string, JobHandler> = {
  // Self-test: proves the enqueue -> claim -> dispatch -> complete pipeline end to end with no side effects.
  // Enqueue a { type: "__selftest__" } job and the drain completes it. Safe to keep or remove.
  __selftest__: async () => {
    /* no-op */
  },
};

export function getJobHandler(type: string): JobHandler | null {
  return JOB_HANDLERS[type] ?? null;
}
