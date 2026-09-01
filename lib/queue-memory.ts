// In-memory Queue implementation (cleanup #4). NOT durable - it lives in one process and is lost on restart -
// so it is for tests + local dev only, never the production job runner (that is PostgresQueue). It exists so
// the Queue CONTRACT is executable and asserted (scripts/check-queue.ts) without a database, and so dev works
// with no Postgres. Mirrors the exact semantics PostgresQueue must honor: FIFO claim, a visibility timeout
// that lets a stuck claimed job be re-claimed, attempts-based retry, and a dead-letter after maxAttempts.
import type { Job, Queue } from "./queue.ts";

type Stored = Job & { status: "pending" | "claimed" | "done" | "dead"; claimedAt: number | null; maxAttempts: number; lastError: string | null };

export class InMemoryQueue implements Queue {
  private jobs = new Map<string, Stored>(); // insertion order = FIFO claim order
  private seq = 0;
  private readonly maxAttempts: number;
  private readonly visibilityMs: number;
  private readonly now: () => number;

  constructor(opts: { maxAttempts?: number; visibilityMs?: number; now?: () => number } = {}) {
    this.maxAttempts = opts.maxAttempts ?? 5;
    this.visibilityMs = opts.visibilityMs ?? 5 * 60 * 1000;
    this.now = opts.now ?? (() => Date.now());
  }

  async enqueue(job: Pick<Job, "type" | "payload">): Promise<string> {
    const id = `job_${++this.seq}`;
    this.jobs.set(id, { id, type: job.type, payload: job.payload, attempts: 0, status: "pending", claimedAt: null, maxAttempts: this.maxAttempts, lastError: null });
    return id;
  }

  async claim(max: number): Promise<Job[]> {
    const t = this.now();
    const claimable = [...this.jobs.values()].filter(
      (j) => j.status === "pending" || (j.status === "claimed" && j.claimedAt != null && t - j.claimedAt > this.visibilityMs),
    );
    const picked = claimable.slice(0, Math.max(0, max));
    for (const j of picked) {
      j.status = "claimed";
      j.claimedAt = t;
      j.attempts += 1;
    }
    return picked.map((j) => ({ id: j.id, type: j.type, payload: j.payload, attempts: j.attempts }));
  }

  async complete(jobId: string): Promise<void> {
    const j = this.jobs.get(jobId);
    if (j) j.status = "done";
  }

  async fail(jobId: string, error: string): Promise<void> {
    const j = this.jobs.get(jobId);
    if (!j) return;
    j.lastError = error;
    if (j.attempts >= j.maxAttempts) {
      j.status = "dead"; // dead-letter: exhausted retries
    } else {
      j.status = "pending"; // retry: back in the queue, keeps its FIFO position
      j.claimedAt = null;
    }
  }

  /** Test/inspection helper (not part of the Queue contract). */
  peek(jobId: string): Readonly<Stored> | undefined {
    return this.jobs.get(jobId);
  }
}
