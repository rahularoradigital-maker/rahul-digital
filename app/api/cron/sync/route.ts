import { NextResponse, after, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLiveCockpit, getUserMetaSession } from "@/lib/meta-sync";
import { syncAdMetrics } from "@/lib/ingest/ad-metrics";
import { syncChangeHistory } from "@/lib/ingest/change-history";
import { getAiCallsToday } from "@/lib/ai/usage";
import { sendAlert } from "@/lib/alerts";

// Background sync (ADR-0004): pre-warm each connected account's DEFAULT cockpit into cockpit_cache on a
// schedule, so the first page load is a fast cache read instead of a cold Meta pull, AND run the day-wise
// ingestion so the cockpit can read/rank every ad from the store.
//
// The ingestion is RESUMABLE and SELF-CHAINING: a 2-3k-ad account can't be fully synced in one 300s
// request, so each run does a bounded slice (see syncAdMetrics) and, if not complete, re-invokes this route
// in "continue mode" (?uid=&hop=) for that account. On Vercel Hobby the cron itself can only fire daily, so
// this chain is what lets a large account converge to full coverage within minutes of the daily trigger,
// rather than one slice per day. `after()` fires the next hop once the current response is flushed.
//
// Triggered by Vercel Cron (see vercel.json), which sends `Authorization: Bearer $CRON_SECRET`. Inert until
// CRON_SECRET is set (503), and rejects any request without the matching secret (401) - so neither the daily
// trigger nor a continue hop is ever a public, unauthenticated way to make the app do work.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONCURRENCY = 3; // bounded so a sync wave never stampedes Meta's rate limits
const WARM_WINDOWS = [90]; // the ONE window the whole app uses (COMPARISON_DAYS); warming it makes every page instant
const MAX_HOPS = 20; // safety cap on the self-chain per account per cycle (~20 x a slice of ads; converges long before this)

// Fire the next continue hop for one account, after the current response is sent. Best-effort: a dropped hop
// just means that account resumes on the next daily trigger instead. MAX_HOPS bounds a runaway chain.
function kickChain(origin: string, secret: string, uid: string, hop: number) {
  if (hop >= MAX_HOPS) return;
  after(() =>
    fetch(`${origin}/api/cron/sync?uid=${encodeURIComponent(uid)}&hop=${hop}`, { headers: { authorization: `Bearer ${secret}` } }).catch(() => {}),
  );
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  // Constant-time compare so the secret can't be recovered via response-timing.
  const presented = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronSecret: string = secret; // narrowed to string above; a typed local keeps it string inside closures
  const origin = request.nextUrl.origin;
  const uid = request.nextUrl.searchParams.get("uid");
  const hop = Number(request.nextUrl.searchParams.get("hop") ?? "0");

  // CONTINUE MODE: one account, one bounded ingestion slice, then chain to the next hop until complete.
  if (uid) {
    const session = await getUserMetaSession(uid);
    if (!session) return NextResponse.json({ ok: true, uid, skipped: "no session" });
    const res = await syncAdMetrics(uid, session.activeExternalId, session.token);
    // Change-history ingest rides the same hop (incremental + cheap). Best-effort: a failure here must never
    // block the metrics sync or the chain - it records its own last_error in change_sync_state.
    await syncChangeHistory(uid, session.activeExternalId, session.token).catch(() => {});
    // Continue the chain while there is work AND this hop made progress. An immediate no-progress failure
    // (processed === 0, e.g. Meta's app-level rate limit blocking the very first call) STOPS the chain, so
    // it doesn't tight-loop against the wall - the next daily trigger resumes it after a cooldown. A hop
    // that made progress before hitting the wall still chains, so a big sync keeps advancing between limits.
    if (!res.complete && res.processed > 0) kickChain(origin, cronSecret, uid, hop + 1);
    return NextResponse.json({ ok: res.ok, uid, hop, processed: res.processed, remaining: res.remaining, complete: res.complete, error: res.error });
  }

  // DAILY MODE: warm every connected account's cockpit, then start each account's ingestion chain.
  const admin = createAdminClient();
  const { data, error } = await admin.from("ad_accounts").select("user_id").eq("platform", "meta").eq("status", "connected");
  if (error) return NextResponse.json({ error: "Could not list accounts." }, { status: 500 });

  const userIds = [...new Set((data ?? []).map((r) => r.user_id as string))];
  let warmed = 0;
  let empty = 0;
  let failed = 0;

  const queue = [...userIds];
  async function worker() {
    for (;;) {
      const wid = queue.shift();
      if (!wid) return;
      try {
        let status = "error";
        for (const days of WARM_WINDOWS) {
          const live = await fetchLiveCockpit(wid, days);
          if (days === WARM_WINDOWS[0]) status = live.status;
        }
        if (status === "connected") warmed++;
        else if (status === "not_connected") empty++;
        else failed++;
        // Start this account's resumable ingestion chain (hop 0). The heavy pull runs in the chained
        // invocations, not here, so the daily trigger stays fast and never times out on a huge account.
        if (status === "connected") kickChain(origin, cronSecret, wid, 0);
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, worker));

  // Daily ops + cost alarm: push failures and AI-spend-over-budget to the alert channel (no-op if
  // ALERT_WEBHOOK_URL is unset - it just logs). AI_DAILY_CALL_BUDGET=0/unset disables the budget check.
  const aiCalls = await getAiCallsToday();
  const budget = Number(process.env.AI_DAILY_CALL_BUDGET || 0);
  const overBudget = budget > 0 && aiCalls > budget;
  if (failed > 0 || overBudget) {
    await sendAlert({
      title: failed > 0 ? `${failed} account(s) failed the daily sync` : "AI daily call budget exceeded",
      detail: `Warmed ${warmed}/${userIds.length}, failed ${failed}. AI calls today: ${aiCalls}${budget ? ` (budget ${budget})` : ""}.`,
      severity: overBudget ? "critical" : "warning",
      context: { warmed, failed, aiCalls, budget },
    });
  }

  return NextResponse.json({ ok: true, accounts: userIds.length, warmed, empty, failed, aiCalls, ingestionChainsStarted: warmed });
}
