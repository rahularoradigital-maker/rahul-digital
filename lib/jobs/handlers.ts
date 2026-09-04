import "server-only";
import type { JobHandler } from "./drain.ts";
import { refreshAccountRollup } from "@/lib/rollups/account";
import { refreshCreativeRollup } from "@/lib/rollups/creative";
import { createAdminClient } from "@/lib/supabase/admin";
import { readToken } from "@/lib/oauth-store";
import { syncAdMetrics } from "@/lib/ingest/ad-metrics";
import { syncChangeHistory } from "@/lib/ingest/change-history";
import { verifyAndLog } from "@/lib/rollups/verify";
import { warmCockpitCache } from "@/lib/cockpit/warm";
import { postgresQueue } from "@/lib/queue-postgres";

// Safety cap on how many times one account's sync re-enqueues itself in a cycle (mirrors cron/sync MAX_HOPS).
// syncAdMetrics is resumable and each slice reports processed>0 only on real progress, so a healthy account
// converges to complete long before this; the cap only stops a pathological account from looping forever.
const SYNC_MAX_HOPS = 30;

// Job-type -> handler registry (cleanup #4). The drain (app/api/jobs/drain) claims pending jobs and dispatches
// each by its `type` to the handler here; a handler runs the actual work and THROWS on failure (the drain then
// retries or dead-letters via the queue's attempts logic). To move a long-running route onto durable jobs:
// add its background work as a new handler here, and have the route enqueue that type instead of running inline.
// Keeping handlers here (not inside the drain route) keeps the drain a thin, generic worker.
export const JOB_HANDLERS: Record<string, JobHandler> = {
  // Self-test: proves the enqueue -> claim -> dispatch -> complete pipeline end to end with no side effects.
  // Enqueue a { type: "__selftest__" } job and the drain completes it. Safe to keep or remove.
  __selftest__: async () => {
    /* no-op */
  },
  // S2 (scale): one account's instant-app rollups, refreshed off the request path via the durable queue.
  // /api/cron/rollups enqueues one of these per connected account; the drain runs them (retry -> dead-letter
  // on failure). Idempotent (a refresh recomputes from the store), so a re-run or duplicate is harmless.
  "rollup-account": async (payload) => {
    const { userId, account } = payload as { userId?: string; account?: string };
    if (!userId || !account) throw new Error("rollup-account: missing userId/account");
    await refreshAccountRollup(userId, account);
    await refreshCreativeRollup(userId, account);
  },
  // S2/queue (scale, golden path): one connected account's Meta ingestion, as a durable, resumable job.
  // cron/sync (with SYNC_VIA_QUEUE=1) enqueues one of these per account instead of the fragile after()-self-
  // chain, so a dropped hop no longer costs a full day: the drain retries/backs-off/dead-letters, and every
  // account's progress is observable in `jobs`. The work is IDENTICAL to the cron continue-hop (same
  // syncAdMetrics slice + change-history, then rollups + drift verify on completion) - only the transport
  // changes, so the golden numbers are untouched.
  "sync-account": async (payload) => {
    const { userId, account, hop = 0 } = payload as { userId?: string; account?: string; hop?: number };
    if (!userId || !account) throw new Error("sync-account: missing userId/account");
    // A job carries no session, so resolve THIS account's token the same way the cron continue-hop does.
    const { data: row } = await createAdminClient()
      .from("ad_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("external_id", account)
      .eq("platform", "meta")
      .eq("status", "connected")
      .maybeSingle();
    if (!row) return; // disconnected/removed since enqueue -> nothing to do (not a failure)
    const token = await readToken(row.id as string, userId).catch(() => null);
    if (!token) return; // no usable token -> skip quietly; a reconnect re-enqueues on the next daily run

    // ONE bounded, deadline-capped slice (identical to ingest/run and the cron continue-hop).
    const res = await syncAdMetrics(userId, account, token);
    await syncChangeHistory(userId, account, token).catch(() => {}); // best-effort; records its own last_error
    if (!res.ok) throw new Error(res.error ?? "sync failed"); // let the queue retry with backoff

    if (!res.complete) {
      // Durable equivalent of the after()-self-chain: enqueue the next slice so the drain continues it. Only
      // when this slice made real progress (processed>0) and under the hop cap, so a stuck account can't loop
      // (matches the cron's "no progress -> stop, resume next daily trigger" rule).
      if (res.processed > 0 && hop < SYNC_MAX_HOPS) {
        await postgresQueue.enqueue({ type: "sync-account", payload: { userId, account, hop: hop + 1 } }, userId);
      }
      return;
    }
    // Fully synced: refresh instant-app rollups + log the store-vs-Meta drift verdict (same as the cron final
    // hop). Best-effort - a rollup/verify hiccup must not fail an otherwise-successful sync (no needless retry).
    await refreshAccountRollup(userId, account).catch(() => {});
    await refreshCreativeRollup(userId, account).catch(() => {});
    await verifyAndLog(userId, account, token).catch(() => {});
    // Pre-warm the cockpit cache with the FRESH post-sync data so the user's first load is instant, not a
    // cold Meta pull. A job has no request scope for after(), so run inline - nobody waits on a queue job.
    await warmCockpitCache(userId).catch(() => {});
  },
};

export function getJobHandler(type: string): JobHandler | null {
  return JOB_HANDLERS[type] ?? null;
}
