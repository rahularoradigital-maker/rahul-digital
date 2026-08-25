// Queue seam (ADR-0004). MVP impl: a Postgres cron-drained queue (ADR-0003). Scale impl:
// a managed queue (QStash/SQS) + worker fleet. Both satisfy this one contract, so swapping at
// P1 is a config change, not a rewrite. Heavy pipeline work MUST route through this, never inline.

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
