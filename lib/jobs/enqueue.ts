import "server-only";
import { after } from "next/server";
import { postgresQueue } from "../queue-postgres.ts";
import { getJobHandler } from "./handlers.ts";
import { drainQueue } from "./drain.ts";

// Enqueue a durable job AND process it in the background of the CURRENT request (cleanup #4). Next's after()
// runs the drain once the response has flushed, in the same invocation's remaining budget - so a job runs
// immediately WITHOUT needing CRON_SECRET or the cron to be wired. Durability is unaffected: the job is a row
// in `jobs` either way, so if after() dies or times out mid-job, the visibility timeout lets the next kick /
// the cron safety-net re-claim it. This is how a 60-300s route moves off the request path: call this, return a
// jobId immediately, and let the client poll job status - instead of holding the HTTP request open for minutes.
const DRAIN_BATCH = 10;

export async function enqueueAndProcess(type: string, payload: Record<string, unknown> = {}, userId?: string): Promise<string> {
  const jobId = await postgresQueue.enqueue({ type, payload }, userId);
  after(async () => {
    try {
      await drainQueue(postgresQueue, getJobHandler, DRAIN_BATCH);
    } catch {
      // Best-effort background drain. The job is already durable in `jobs`; a failure here just means it is
      // picked up by the next enqueue's after()-drain or the cron safety-net (visibility-timeout re-claim).
    }
  });
  return jobId;
}
