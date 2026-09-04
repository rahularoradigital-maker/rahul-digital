import { NextResponse, after, type NextRequest } from "next/server";
import { cronSecretGate } from "@/lib/app/cron-auth";
import { postgresQueue } from "@/lib/queue-postgres";
import { getJobHandler } from "@/lib/jobs/handlers";
import { drainQueue } from "@/lib/jobs/drain";
import { captureError } from "@/lib/observability";

// Durable-job drain (cleanup #4). Claims a bounded batch of pending (or stuck-past-visibility) jobs via the
// atomic claim_jobs() function and runs each through its registered handler, marking it done on success or
// failed (retry -> dead-letter) on error. Protected by CRON_SECRET (like the sync cron). Meant to be KICKED
// immediately after a route enqueues (after()+fetch), so a job runs without waiting for a scheduled tick; it
// can also be added to vercel.json as a periodic safety-net sweep later. Inert until CRON_SECRET is set.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH = 10; // jobs per invocation, bounded so one run stays under the serverless cap

async function handle(request: NextRequest) {
  const gate = cronSecretGate(request); // one shared constant-time bearer primitive (was hand-copied in 3 routes)
  if (!gate.ok) return gate.response;
  try {
    const res = await drainQueue(postgresQueue, getJobHandler, BATCH);
    // Self-chain (S2): a full batch means there is probably more pending, so kick another drain once this
    // response flushes. This lets a large enqueue (e.g. one rollup job per account nightly) drain FULLY from a
    // single kick, without waiting for a scheduled tick. The chain terminates naturally: it stops the moment a
    // drain claims fewer than BATCH, and the queue's retry->dead-letter removes stuck jobs so it can't loop.
    if (res.claimed >= BATCH) {
      const origin = request.nextUrl.origin;
      after(() => fetch(`${origin}/api/jobs/drain`, { method: "POST", headers: { authorization: `Bearer ${gate.secret}` } }).catch(() => {}));
    }
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    captureError(e, { route: "jobs/drain" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "drain failed" }, { status: 500 });
  }
}

export const GET = handle; // Vercel Cron uses GET
export const POST = handle; // an enqueuer's after()+fetch kick can use POST
