// Queue seam (ADR-0004). MVP impl: a Postgres cron-drained queue (ADR-0003). Scale impl:
// a managed queue (QStash/SQS) + worker fleet. Both satisfy this one contract, so swapping at
// P1 is a config change, not a rewrite. Heavy pipeline work SHOULD route through this, never inline.
//
// STATUS (honest, 2026-09-01): the CONTRACT now has two impls - PostgresQueue (lib/queue-postgres.ts, the
// durable production runner over the `jobs` table, migration 0027) and InMemoryQueue (lib/queue-memory.ts,
// tests/dev). The contract semantics are asserted by scripts/check-queue.ts. NOT YET load-bearing: no route
// enqueues onto it yet - long-running work still runs inline in 60-300s handlers. The next #4 increment moves
// the first heavy route (e.g. competitors/run or the sync) onto enqueue + a cron drain, once migration 0027
// is applied. Until a route uses it, this is wired but idle - honest, not fake.

export type Job = {
  id: string;
  type: string; // e.g. "deconstruct-ad" | "sync-account" | "finalize-run"
  payload: Record<string, unknown>;
  attempts: number;
};

export interface Queue {
  /** Enqueue a job; returns its id. */
  enqueue(job: Pick<Job, "type" | "payload">): Promise<string>;
  /** Claim up to `max` pending jobs (impl handles visibility timeout / per-tenant fairness). */
  claim(max: number): Promise<Job[]>;
  /** Mark a claimed job done. */
  complete(jobId: string): Promise<void>;
  /** Mark a claimed job failed (impl decides retry vs dead-letter by attempts). */
  fail(jobId: string, error: string): Promise<void>;
}
