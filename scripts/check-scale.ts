// S7 (scale plan): a DETERMINISTIC scale-invariant harness. It proves the S0-S4 scale work actually holds at
// 1,000-tenant / 1,500-account scale, using the REAL shipped primitives (readAllPages, the durable queue +
// drain, the AI budget thresholds, the rate limiter) against synthetic in-memory data - no DB, no network, no
// cost, no infra. This is the "prove the logic scales" half of S7; the "prove the infra scales" half is a
// load test against a deployed env (see docs/SCALE-PLAN load-test runbook), which needs Vercel Pro.
//
// Run: node --experimental-strip-types scripts/check-scale.ts
import assert from "node:assert/strict";
import { readAllPages, PAGE } from "../lib/supabase/paged.ts";
import { InMemoryQueue } from "../lib/queue-memory.ts";
import { drainQueue, type JobHandler } from "../lib/jobs/drain.ts";
import { overBudget, resolveDailyBudget, resolveTenantDailyBudget } from "../lib/ai/budget.ts";
// The in-process fixed-window engine that enforceRateLimit (lib/rate-limit-distributed) falls back to when
// Upstash is unconfigured - imported directly because that module is `server-only` (can't load under node).
// Same contract Upstash honours across instances, so this proves the per-user cap logic itself.
import { createRateLimiter } from "../lib/rate-limit.ts";

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) {
    failures++;
    console.log("  FAIL", msg);
  } else {
    console.log("  ok  ", msg);
  }
}

// ---------------------------------------------------------------------------------------------------------
// 1. PAGING (S0): the un-paged `.select()` silently caps at 1,000 rows. readAllPages must return EVERY row
//    past that cap, in order, so the nightly sync never skips a tenant and per-account reads never truncate.
// ---------------------------------------------------------------------------------------------------------
console.log("1. Paging past the 1,000-row cap (the tenant-skipper):");
// A fake paginator backed by an ordered array; mirrors a Supabase .order().range(from,to) result exactly.
function fakePager(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  return (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null as null });
}
for (const total of [0, 1, 999, PAGE, PAGE + 1, 1500, 4321]) {
  const out = await readAllPages<{ id: number }>(fakePager(total));
  ok(out.length === total, `reads all ${total} rows (no silent 1,000 cap)`);
  ok(out.every((r, i) => r.id === i), `preserves order for ${total} rows`);
}
// An error on any page must throw, never return a short (silently-truncated) list.
let threw = false;
try {
  await readAllPages<{ id: number }>((f) => Promise.resolve(f === 0 ? { data: null, error: { message: "boom" } } : { data: [], error: null }));
} catch {
  threw = true;
}
ok(threw, "a page error throws (never a silently-short read)");

// ---------------------------------------------------------------------------------------------------------
// 2. DURABLE QUEUE at 1,500-account scale (S2 cron/sync -> queue): a full backlog of resumable, self-
//    re-enqueueing sync jobs must ALL converge to complete, poison jobs must dead-letter (not loop forever),
//    and repeated drains (the after()-kick self-chain + a scheduled sweep) must drain the tail with nothing
//    stranded. This is the exact shape the sync-account handler produces.
// ---------------------------------------------------------------------------------------------------------
console.log("2. Draining a 1,500-account sync backlog to completion (S2 golden-path queue):");
const N_ACCOUNTS = 1500;
const POISON = new Set([7, 500, 1499]); // a few accounts whose sync always fails -> must dead-letter
const SLICES_PER_ACCOUNT = 4; // each healthy account needs 4 resumable slices to finish (like a big Meta pull)
const MAX_HOPS = 30; // mirrors SYNC_MAX_HOPS in the real handler
let clock = 1_000_000;
const q = new InMemoryQueue({ maxAttempts: 3, visibilityMs: 1, now: () => clock });
const completed = new Set<number>();
const sliceProgress = new Map<number, number>();

// Handler mirrors lib/jobs/handlers.ts "sync-account": run a slice; if incomplete AND progressing, re-enqueue
// the next slice (hop+1, capped); a poison account throws so the queue retries then dead-letters it.
const handlers: Record<string, JobHandler> = {
  "sync-account": async (payload) => {
    const { account, hop = 0 } = payload as { account: number; hop?: number };
    if (POISON.has(account)) throw new Error(`sync failed for ${account}`); // -> retry, then dead-letter
    const done = (sliceProgress.get(account) ?? 0) + 1;
    sliceProgress.set(account, done);
    if (done >= SLICES_PER_ACCOUNT) {
      completed.add(account);
      return; // complete: (real handler refreshes rollups + verify here)
    }
    if (hop < MAX_HOPS) await q.enqueue({ type: "sync-account", payload: { account, hop: hop + 1 } });
  },
};
const getHandler = (t: string): JobHandler | null => handlers[t] ?? null;

// cron/sync daily enqueue: one job per connected account.
for (let a = 0; a < N_ACCOUNTS; a++) await q.enqueue({ type: "sync-account", payload: { account: a, hop: 0 } });

// Drive drains until the queue is idle (bounded rounds so a bug can't hang the check). BATCH mirrors a real
// drain claim; advancing the clock past visibilityMs lets a re-enqueued continuation be claimed next round -
// exactly what the after()-kick self-chain + the Pro scheduled sweep do.
const BATCH = 100;
let rounds = 0;
const MAX_ROUNDS = 2000; // generous ceiling; a correct drain finishes in far fewer
for (; rounds < MAX_ROUNDS; rounds++) {
  clock += 10; // past the 1ms visibility window, so continuations become claimable
  const res = await drainQueue(q, getHandler, BATCH);
  if (res.claimed === 0) break;
}
const healthy = N_ACCOUNTS - POISON.size;
ok(completed.size === healthy, `all ${healthy} healthy accounts fully synced (${completed.size})`);
ok([...POISON].every((p) => !completed.has(p) && (sliceProgress.get(p) ?? 0) === 0), "poison accounts never progressed or completed");
ok(rounds < MAX_ROUNDS, `drained in ${rounds} bounded rounds (no infinite loop)`);
ok(Math.max(...[...sliceProgress.values()]) <= SLICES_PER_ACCOUNT, "no account exceeded its slice count (hop cap holds)");
// The queue is now fully idle: one more claim (past the visibility window) returns nothing. This is the real
// proof the poison jobs were DEAD-LETTERED, not left stuck pending - a stranded job would still be claimable.
clock += 10;
ok((await q.claim(BATCH)).length === 0, "queue fully drained: poison jobs dead-lettered, tail not stranded");

// ---------------------------------------------------------------------------------------------------------
// 3. PER-TENANT AI BUDGET (S4): a whale over its OWN daily cap is paused, while the global cap stays clear so
//    every other tenant keeps AI. Uses the real threshold + resolver fns over a 1,000-tenant cost table.
// ---------------------------------------------------------------------------------------------------------
console.log("3. Per-tenant AI budget isolation at 1,000 tenants (S4 noisy-neighbour guard):");
const globalCap = resolveDailyBudget(undefined); // $25 default
const tenantCap = resolveTenantDailyBudget(undefined); // $5 default
ok(tenantCap < globalCap, `tenant cap ($${tenantCap}) is below the global cap ($${globalCap})`);
// One whale just over its cap; 900 normal tenants at a cent each. Global stays well under its ceiling.
const whaleCost = tenantCap + 1;
const normalCost = 0.01;
const normalTenants = 900;
const globalTotal = whaleCost + normalTenants * normalCost;
ok(overBudget(whaleCost, tenantCap), "the whale trips its per-tenant ceiling (paused for itself)");
ok(!overBudget(normalCost, tenantCap), "a normal tenant is nowhere near its ceiling");
ok(!overBudget(globalTotal, globalCap), `global spend $${globalTotal.toFixed(2)} stays under the global cap, so AI stays UP for the other ${normalTenants} tenants`);

// ---------------------------------------------------------------------------------------------------------
// 4. RATE LIMIT under a burst (S3): the per-user fixed-window cap must allow exactly `max` in a window then
//    limit the rest (in-process fallback path; Upstash is the same contract, shared across instances).
// ---------------------------------------------------------------------------------------------------------
console.log("4. Per-user rate limit under a 100-request burst (S3):");
const WINDOW = 60_000;
const MAX = 30;
const limiter = createRateLimiter({ windowMs: WINDOW, max: MAX });
const rlKey = "user-42";
const t0 = 5_000_000; // fixed instant inside one window (deterministic)
let allowed = 0;
let limited = 0;
for (let i = 0; i < 100; i++) {
  const r = limiter(rlKey, t0);
  if (r.limited) limited++;
  else allowed++;
}
ok(allowed === MAX, `exactly ${MAX} requests allowed in the window (got ${allowed})`);
ok(limited === 100 - MAX, `the other ${100 - MAX} are limited (got ${limited})`);

// ---------------------------------------------------------------------------------------------------------
console.log("");
if (failures > 0) {
  console.log(`SCALE HARNESS: ${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("PASS: scale invariants hold at 1,500-account / 1,000-tenant scale (paging, durable queue drain, per-tenant budget, rate limit)");
