import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { postgresQueue } from "@/lib/queue-postgres";
import { getJobHandler } from "@/lib/jobs/handlers";
import { captureError } from "@/lib/observability";

// Durable-job drain (cleanup #4). Claims a bounded batch of pending (or stuck-past-visibility) jobs via the
// atomic claim_jobs() function and runs each through its registered handler, marking it done on success or
// failed (retry -> dead-letter) on error. Protected by CRON_SECRET (like the sync cron). Meant to be KICKED
// immediately after a route enqueues (after()+fetch), so a job runs without waiting for a scheduled tick; it
// can also be added to vercel.json as a periodic safety-net sweep later. Inert until CRON_SECRET is set.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH = 10; // jobs per invocation, bounded so one run stays under the serverless cap

function authorized(request: NextRequest, secret: string): boolean {
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

async function drainOnce(): Promise<{ claimed: number; done: number; failed: number }> {
  const jobs = await postgresQueue.claim(BATCH);
  let done = 0;
  let failed = 0;
  for (const job of jobs) {
    const handler = getJobHandler(job.type);
    if (!handler) {
      await postgresQueue.fail(job.id, `no handler registered for type '${job.type}'`);
      failed++;
      continue;
    }
    try {
      await handler(job.payload);
      await postgresQueue.complete(job.id);
      done++;
    } catch (e) {
      await postgresQueue.fail(job.id, e instanceof Error ? e.message : "handler error");
      failed++;
    }
  }
  return { claimed: jobs.length, done, failed };
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (!authorized(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await drainOnce()) });
  } catch (e) {
    captureError(e, { route: "jobs/drain" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "drain failed" }, { status: 500 });
  }
}

export const GET = handle; // Vercel Cron uses GET
export const POST = handle; // an enqueuer's after()+fetch kick can use POST
