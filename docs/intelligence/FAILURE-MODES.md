# Failure-Mode Inventory — Sync / Ingestion / Cockpit-Cache (Phase 0, READ-ONLY)

Scope: `lib/meta-sync.ts`, `lib/cockpit/from-store.ts`, `lib/ingest/*`, `lib/meta-source.ts`,
`lib/creative/decode.ts`, `app/api/cron/sync/route.ts`, `app/api/ingest/run/route.ts`, AI router/budget.
Method: charter §128-§132 (failure must stay observable) + §147-§152 (resumability). Every row cites
`file:line`. Verdict column: SILENT = failure hidden from the user/caller; OBSERVABLE = recorded/surfaced;
DEGRADE-OK = honest graceful degrade (not a defect). UNKNOWN where I could not verify at runtime.

## A. Silent-failure sites (catch → falsy/empty/"success" that hides a real failure)

| # | Site (file:line) | Trigger | What the user/caller sees | Charter | Severity |
|---|---|---|---|---|---|
| S1 | `lib/meta-sync.ts:186-188` | DB throw while reading `ad_accounts` (service-role down, transient DB error) | `{status:"not_connected"}` → the **Connect a Meta account** screen | §128 (failed data → empty truth) / §130 | P1 |
| S2 | `lib/meta-sync.ts:194-197` | `readToken` throws (AES decrypt / DB) | `{status:"not_connected"}` → Connect screen, though an account IS connected | §128 | P1 |
| S3 | `lib/meta-sync.ts:509-527` & `lib/cockpit/from-store.ts:348-364` | `scopePromise` rejects (Meta throttle on the account-level call) | Headline spend/revenue/**ROAS silently switch** from Ads-Manager-matching account total to a sum over top-N/store ads — a *different, lower* number, no flag | §130 (stale/uncertainty must be visible), §56 | **P0** |
| S4 | `lib/cockpit/from-store.ts:161-165, 169-174` | `ad_metrics` / `ad_meta` read throws mid-page | `return null` → indistinguishable from "store empty" → falls back to top-50 live pull, silently narrower coverage under the same UI | §128, §130 | P1 |
| S5 | `app/api/cron/sync/route.ts:83` | `syncChangeHistory(...).catch(()=>{})` | change-history failure fully swallowed at call site (state row records it, but the cron response/alert says nothing) | §128 | P2 |
| S6 | `lib/creative/decode.ts:70-72, 118-120` (via 84-95, 133-144) | Gemini returns null / errors | semantics row NOT written; diversity reads on `format` alone | §128 (AI failure must not fake) — **DEGRADE-OK**, but see S7 | DEGRADE-OK |
| S7 | `lib/creative/decode.ts:82, 131` + null-write at 86/135 | a creative the model can never classify | never added to `have`/`haveVisual` (no negative marker) → **re-attempted every sync run forever** → recurring AI cost + no visible "could not classify" | §70 (measure/cap AI cost), §128 | P2 |
| S8 | `lib/meta-sync.ts:54-56` (`getActiveAccountExternalId`) | DB throw | returns `null` → cache key uses `activeId="none"` → serves/writes a *different* cache entry on a transient error (cache fragmentation, not cross-tenant since `memKey` has `userId`) | §149 (cache scope) | P2 |
| S9 | `lib/meta-sync.ts:212` timezone persist, `writeCockpitL2` 605, `writeState` 50, `notify*` | any DB write error | `.then(undefined,()=>{})` / `catch{}` — best-effort writes fail silently (sync-state row itself may never record) | §128 | P2 |
| S10 | `lib/ai/budget.ts:31-33` (`aiBudgetExceeded`) | DB throw reading `ai_usage` | **fail-open** (returns false) → AI keeps spending past the cap during a DB outage | §70 (cost ceiling) — deliberate, but the ceiling is not durable | P2 |
| S11 | `app/api/cron/sync/route.ts:110-129` | warm throw for a user | `failed++`; but `kickChain` sits AFTER the warm in the same try → **that account's ingestion chain never starts** when warm throws | §147 (resumability) | P1 |

## B. Failure-path behaviour (how errors propagate — mostly correct, listed for the map)

| # | Site (file:line) | Behaviour | Verdict |
|---|---|---|---|
| F1 | `lib/meta-sync.ts:530-532` | `fetchLiveCockpitUncached` outer catch → `{status:"error",message}` | OBSERVABLE (error surfaced) |
| F2 | `lib/meta-sync.ts:731-735` | cold pull > `COLD_PULL_TIMEOUT_MS` (8s) → `{status:"error","Still syncing…"}`; `after(pull)` keeps container alive to warm cache | OBSERVABLE + resumable-ish |
| F3 | `lib/ingest/ad-metrics.ts:80-87` | `listAllSpendingAdIds` throws → `writeState(last_ok:false)` + `notifyFailure` + `ok:false` | OBSERVABLE (charter-compliant) |
| F4 | `lib/ingest/ad-metrics.ts:126-131` | upsert throws mid-run → state + notify + `complete:false`, `remaining` reported | OBSERVABLE + resumable |
| F5 | `lib/ingest/ad-metrics.ts:118-123` | `ad_meta` chunk fails → logged, metrics kept, ad stays stale for retry | DEGRADE-OK (self-healing) |
| F6 | `lib/meta-source.ts:44-69` `graphGet` | retries 429/500/503 (3 attempts, backoff+jitter); hard 4xx not retried; per-call AbortController 15s | OBSERVABLE (good) |
| F7 | `app/api/cron/sync/route.ts:88` | chain stops when `processed===0` (immediate rate-limit wall) so it doesn't tight-loop; resumes next daily trigger | DEGRADE-OK but see below |
| F8 | `lib/single-flight.ts:11-13` | rejected pull removed in `finally` → next caller retries; never caches errors | OBSERVABLE |

## C. Stale-data visibility (§130)

- Freshness IS modelled: `syncedAt`/`stale` attached at `lib/meta-sync.ts:641-643`, set on the serving path
  (L2-STALE at 705-713). Store path passes `opts.syncedAt` through (`from-store.ts:442`) — **but the cron/live
  callers do not populate `ad_sync_state.last_synced_date` into `syncedAt` for the store path**, so a
  store-served cockpit can render with `syncedAt=undefined` (freshness unknown, not shown as stale). VERIFY in UI.
- S3 (scope fallback) is the sharpest §130 gap: the headline number's *source* changes with no user-visible marker.
- `assessDataQuality` (from-store.ts:339) grades missing days/dupes but I did not confirm it emits a
  sync-staleness signal tied to `ad_sync_state.last_run_at`. UNKNOWN — flag for Phase 1.

## D. Resumability / partial-success (§147-§151) — mostly strong

- Ingestion is genuinely resumable: `selectAdsToSync` (`lib/ingest/select-ads.ts:4-6`) orders never-synced →
  stalest, skips ads synced within `REFRESH_INTERVAL_MS`; `DEADLINE_MS=230s` stops before the 300s cap;
  self-chains via `kickChain` (`cron/sync/route.ts:34-39`, `MAX_HOPS=20`). Upserts are idempotent. GOOD.
- Gaps: (a) no per-run checkpoint of *how far into `toProcess`* — resume relies on `ad_meta.updated_at`, so an
  ad whose metrics upserted but whose `ad_meta` write failed is correctly retried (F5), but an ad whose metrics
  are still mid-window (partial days) is treated as "done" once `ad_meta` lands. (b) `MAX_HOPS=20` × ~4-5k ads/hop
  bounds coverage; a >~90k-ad-day account cannot converge in one daily cycle (see risk-perf-scale.md).
- Chain fragility: `kickChain` is best-effort `fetch` in `after()`; a dropped hop = that account waits a full day.
