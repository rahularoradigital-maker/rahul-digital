// Queue seam (ADR-0004). MVP impl: a Postgres cron-drained queue (ADR-0003). Scale impl:
// a managed queue (QStash/SQS) + worker fleet. Both satisfy this one contract, so swapping at
// P1 is a config change, not a rewrite. Heavy pipeline work SHOULD route through this, never inline.
//
// STATUS (honest, 2026-09-01): this is an INTERFACE ONLY - there is no concrete Queue implementation and
// nothing imports it yet. Long-running work today runs inline in route handlers with 60-300s windows (see
// cleanup #4: move that work into a durable job on a real impl of THIS contract). It is a dormant seam, not
// a live fake path - it serves nothing, so it cannot mislead; it just isn't load-bearing until #4 lands.

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
