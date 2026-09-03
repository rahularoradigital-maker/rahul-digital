import { NextResponse, after, type NextRequest } from "next/server";
import { cronSecretGate } from "@/lib/app/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLiveCockpit, getUserMetaSession } from "@/lib/meta-sync";
import { readToken } from "@/lib/oauth-store";
import { syncAdMetrics } from "@/lib/ingest/ad-metrics";
import { syncChangeHistory } from "@/lib/ingest/change-history";
import { refreshAccountRollup } from "@/lib/rollups/account";
import { refreshCreativeRollup } from "@/lib/rollups/creative";
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
function kickChain(origin: string, secret: string, uid: string, acct: string, hop: number) {
  if (hop >= MAX_HOPS) return;
  after(() =>
    fetch(`${origin}/api/cron/sync?uid=${encodeURIComponent(uid)}&acct=${encodeURIComponent(acct)}&hop=${hop}`, { headers: { authorization: `Bearer ${secret}` } }).catch(() => {}),
  );
}

export async function GET(request: NextRequest) {
  const gate = cronSecretGate(request); // one shared constant-time bearer primitive (was hand-copied in 3 routes)
  if (!gate.ok) return gate.response;

  const cronSecret: string = gate.secret; // the verified secret, re-presented by the self-chaining continue hops
  const origin = request.nextUrl.origin;
  const uid = request.nextUrl.searchParams.get("uid");
  const hop = Number(request.nextUrl.searchParams.get("hop") ?? "0");

  // CONTINUE MODE: one ACCOUNT, one bounded ingestion slice, then chain to the next hop until complete.
  // `acct` names the specific account to sync (every connected brand is synced, not just the active one, so
  // every brand's store stays complete + accurate). Falls back to the active account when acct is absent.
  if (uid) {
    const acctParam = request.nextUrl.searchParams.get("acct");
    let acctExternalId = acctParam ?? undefined;
    let token: Awaited<ReturnType<typeof readToken>> = null;
    if (acctParam) {
      const { data: row } = await createAdminClient()
        .from("ad_accounts")
        .select("id")
        .eq("user_id", uid)
        .eq("external_id", acctParam)
        .eq("platform", "meta")
        .eq("status", "connected")
        .maybeSingle();
      if (row) token = await readToken(row.id as string, uid).catch(() => null);
    } else {
      const session = await getUserMetaSession(uid);
      if (session) { token = session.token; acctExternalId = session.activeExternalId; }
    }
    if (!token || !acctExternalId) return NextResponse.json({ ok: true, uid, acct: acctExternalId, skipped: "no token" });
    const res = await syncAdMetrics(uid, acctExternalId, token);
    // Change-history ingest rides the same hop (incremental + cheap). Best-effort: a failure here must never
    // block the metrics sync or the chain - it records its own last_error in change_sync_state.
    await syncChangeHistory(uid, acctExternalId, token).catch(() => {});
    // Continue the chain while there is work AND this hop made progress. An immediate no-progress failure
    // (processed === 0, e.g. Meta's app-level rate limit blocking the very first call) STOPS the chain, so
    // it doesn't tight-loop against the wall - the next daily trigger resumes it after a cooldown. A hop
    // that made progress before hitting the wall still chains, so a big sync keeps advancing between limits.
    if (!res.complete && res.processed > 0) kickChain(origin, cronSecret, uid, acctExternalId, hop + 1);
    // 10x #5 instant-app: once an account is fully synced, refresh its rollup so dashboards read a single row
    // instead of scanning. Off the request path (this hop already ran), best-effort. Only on the final hop.
    if (res.complete) {
      await refreshAccountRollup(uid, acctExternalId).catch(() => {});
      await refreshCreativeRollup(uid, acctExternalId).catch(() => {});
    }
    return NextResponse.json({ ok: res.ok, uid, acct: acctExternalId, hop, processed: res.processed, remaining: res.remaining, complete: res.complete, error: res.error });
  }

  // DAILY MODE: warm each user's (active) cockpit once, then start an ingestion chain for EVERY connected
  // account - so every brand's store stays complete + accurate, not just the currently-active one.
  const admin = createAdminClient();
  const { data, error } = await admin.from("ad_accounts").select("id, user_id, external_id").eq("platform", "meta").eq("status", "connected");
  if (error) return NextResponse.json({ error: "Could not list accounts." }, { status: 500 });

  const accounts = (data ?? []) as { id: string; user_id: string; external_id: string }[];
  const userIds = [...new Set(accounts.map((a) => a.user_id))];
  let warmed = 0;
  let empty = 0;
  let failed = 0;

  const warmedUsers = new Set<string>();
  const queue = [...accounts];
  async function worker() {
    for (;;) {
      const a = queue.shift();
      if (!a) return;
      try {
        // Warm the user's active-account cockpit once (cache); the ingestion chains below cover EVERY account.
        if (!warmedUsers.has(a.user_id)) {
          warmedUsers.add(a.user_id);
          let status = "error";
          for (const days of WARM_WINDOWS) {
            const live = await fetchLiveCockpit(a.user_id, days);
            if (days === WARM_WINDOWS[0]) status = live.status;
          }
          if (status === "connected") warmed++;
          else if (status === "not_connected") empty++;
          else failed++;
        }
        // Start THIS account's resumable ingestion chain (hop 0). The heavy pull runs in the chained
        // invocations, not here, so the daily trigger stays fast and never times out on a huge account.
        kickChain(origin, cronSecret, a.user_id, a.external_id, 0);
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
