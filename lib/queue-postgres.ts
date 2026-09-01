import "server-only";
import { createAdminClient } from "./supabase/admin.ts";
import type { Job, Queue } from "./queue.ts";

// Durable Postgres Queue (cleanup #4, ADR-0003). The PRODUCTION job runner: jobs are rows in public.jobs
// (migration 0027), claimed atomically via the claim_jobs()/fail_job() SQL functions (FOR UPDATE SKIP LOCKED
// + a visibility timeout), so many concurrent cron-worker invocations never double-process a job and a worker
// that dies mid-job releases it after the timeout. Same contract as InMemoryQueue; the check-queue.ts contract
// test proves the semantics, this backs them with a durable store. Service-role only (RLS denies everyone else).
type JobRow = { id: string; type: string; payload: Record<string, unknown>; attempts: number };

export class PostgresQueue implements Queue {
  async enqueue(job: Pick<Job, "type" | "payload">): Promise<string> {
    const { data, error } = await createAdminClient()
      .from("jobs")
      .insert({ type: job.type, payload: job.payload })
      .select("id")
      .single();
    if (error) throw new Error(`queue.enqueue: ${error.message}`);
    return (data as { id: string }).id;
  }

  async claim(max: number, visibilitySeconds = 300): Promise<Job[]> {
    const { data, error } = await createAdminClient().rpc("claim_jobs", { p_max: max, p_visibility_seconds: visibilitySeconds });
    if (error) throw new Error(`queue.claim: ${error.message}`);
    return ((data as JobRow[] | null) ?? []).map((r) => ({ id: r.id, type: r.type, payload: r.payload ?? {}, attempts: r.attempts }));
  }

  async complete(jobId: string): Promise<void> {
    const { error } = await createAdminClient()
      .from("jobs")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("id", jobId);
    if (error) throw new Error(`queue.complete: ${error.message}`);
  }

  async fail(jobId: string, error: string): Promise<void> {
    const { error: e } = await createAdminClient().rpc("fail_job", { p_id: jobId, p_error: error.slice(0, 2000) });
    if (e) throw new Error(`queue.fail: ${e.message}`);
  }
}

export const postgresQueue = new PostgresQueue();
