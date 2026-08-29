import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLiveCockpit } from "@/lib/meta-sync";

// Background sync (ADR-0004): pre-warm each connected account's DEFAULT cockpit into cockpit_cache
// on a schedule, so the first page load of a session is a fast cache read instead of a cold ~9s
// Meta pull. It reuses fetchLiveCockpit, which self-throttles via the 5-min freshness window - a run
// on an already-fresh account does no Meta work at all, so running this often is cheap. This is the
// first phase of moving the pull OFF the request path; a later phase can pre-compute per-filter
// rollups so EVERY window/filter is a fast read, not just the default.
//
// Triggered by Vercel Cron (see vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
// Inert until CRON_SECRET is set (503), and rejects any request without the matching secret (401),
// so this is never a public, unauthenticated way to make the app do work.

export const dynamic = "force-dynamic";
export const maxDuration = 300; // many accounts x an occasional cold pull

const CONCURRENCY = 3; // bounded so a sync wave never stampedes Meta's rate limits
// Pre-warm the ONE window the whole app now uses: 90 days (the fixed comparison/ranking baseline, see
// COMPARISON_DAYS). Every feature/page shares one cockpit cache for it, so warming it makes the whole
// app instant on the next visit - and a 90-day day-wise pull is the slowest cold pull, so warming it
// nightly is what keeps the app fast.
const WARM_WINDOWS = [90];

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ad_accounts")
    .select("user_id")
    .eq("platform", "meta")
    .eq("status", "connected");
  if (error) return NextResponse.json({ error: "Could not list accounts." }, { status: 500 });

  // One warm per user (fetchLiveCockpit resolves the user's active account = the one that loads by
  // default). De-duped so a user with several accounts is warmed once.
  const userIds = [...new Set((data ?? []).map((r) => r.user_id as string))];
  let warmed = 0;
  let empty = 0;
  let failed = 0;

  const queue = [...userIds];
  async function worker() {
    for (;;) {
      const uid = queue.shift();
      if (!uid) return;
      try {
        // Warm each window in turn (self-throttled: a window already fresh does no Meta work). The
        // user's status is judged by the DEFAULT window so the counts stay meaningful.
        let status: string = "error";
        for (const days of WARM_WINDOWS) {
          const live = await fetchLiveCockpit(uid, days);
          if (days === WARM_WINDOWS[0]) status = live.status;
        }
        if (status === "connected") warmed++;
        else if (status === "not_connected") empty++;
        else failed++;
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, worker));

  return NextResponse.json({ ok: true, accounts: userIds.length, warmed, empty, failed });
}
