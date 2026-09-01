# Risk / Performance / Scale — Sync + Cockpit-Cache (Phase 0, READ-ONLY)

Charter basis: §83-§87 (cost model per rule, precompute during sync, 10x/100x, resumability),
§128-§130 (silent failure / stale visibility), §147-§152 (large-account model, cache/queue design).
All claims cite `file:line`. Numbers modelled from the noted account (~1,034 ads, "Soch") and the
charter's 2k-10k-ad target. UNKNOWN where not measurable statically.

## 1. Cost model per expensive path

| Path | Trigger | Meta calls | DB queries | AI calls | Cost scaling |
|---|---|---|---|---|---|
| **Cockpit build from store** `lib/cockpit/from-store.ts:80-125,162,171` | every cold/stale cockpit miss | 0-2 (scope + status refresh 263) | **`ceil(rows/1000)` sequential `ad_metrics` reads + `ceil(ads/1000)` `ad_meta` reads** | 0 (decode deferred) | **O(ads×days)** rows read + summed **in JS**, per build |
| Cockpit build live fallback `lib/meta-sync.ts:271-491` | store empty / gate fail / null | ~6-8 batched (top-spend, insights, meta, creatives, adset-ends, scope, native) | 1 (account row) | 0 blocking (decode via `after`) | O(MAX_ADS=50) — bounded |
| L2 cache serve `lib/meta-sync.ts:680-704` | warm hit | 0 | 1 (`cockpit_cache` single row) | 0 | O(1) — the good path |
| Ingestion slice `lib/ingest/ad-metrics.ts:80-142` | cron hop / manual | 1 enumerate + `ceil(ads/40)` day-wise chunks (paged) | 1 `ad_meta` read + `ceil(rows/500)` upserts + `ceil(ads/500)` meta upserts | 0 | O(ads×days), bounded by `DEADLINE_MS` |
| Semantic decode `lib/creative/decode.ts:76-96,125-145` | after() on each build | 0 | reads + ≤(15 copy + 10 visual) upserts | **≤25 Gemini/run** | O(new creatives), fingerprint-once (but see S7) |
| Change history `lib/ingest/change-history.ts:21-39` | each cron hop | ≤25 pages | ≤`ceil(seen/500)` upserts | 0 | O(new changes), incremental cursor |

Per-page-load steady state = **1 DB read** (L2 warm). Acceptable. The danger is every path that
rebuilds from the store, because it is O(ads×days) with **no DB-side aggregation** (§85 "no single SQL/array").

## 2. Precomputation opportunities (§84 — compute during sync, not per page load)

1. **The whole cockpit view is recomputed from raw rows on every cache miss.** `buildCockpitFromStore`
   reads *all* 90-day day-wise rows (`readAllMetricRows`) and re-runs `analyzeAccount`, `windowFunnel`,
   `levelFunnels`, `marginalScaling`, `assessDataQuality`, `buildDailySeries` in JS (`from-store.ts:280-340`).
   The sync already touches every row — it should write a **per-ad daily rollup** and/or a precomputed
   cockpit snapshot to a table, so the request path reads a small pre-aggregated set, not 270k raw rows. **P1.**
2. **Account/day and adset/day rollups** (SQL `GROUP BY`) would collapse the JS `byDay`/`levelFunnels`
   loops into an indexed read. **P2.**
3. `cockpit_cache` is a computed-blob cache but with `FRESH_MS=300_000` (5 min, `meta-sync.ts:549`) it
   expires fast; raising freshness for store-backed builds (data only changes on the daily sync) would cut
   background rebuilds ~99%. Currently a 5-min-old warm view triggers a full O(rows) background rebuild. **P2.**

## 3. 10x / 100x behaviour — what breaks first

Model per account, 90-day window, ~1 delivering row/ad/day retained (`impressions>0` gate, `ad-metrics.ts:108`):

| Ads | ~Rows (90d) | `ad_metrics` paged reads/build (1000/pg) | JS objects held | Verdict |
|---|---|---|---|---|
| 1,034 (today) | ~90k | ~90 sequential | ~90k | Slow-ish; usually served warm |
| 3,000 | ~270k | ~270 sequential | ~270k | **Cold build likely exceeds `COLD_PULL_TIMEOUT_MS`=8s** → "Still syncing" loop |
| 10,000 | ~900k | ~900 sequential | ~900k | Cold build times out every time; memory pressure on the serverless instance |

**#1 thing that breaks first at 10x: the cold `buildCockpitFromStore` full-account read.**
`readAllMetricRows` (`from-store.ts:80-104`) pages the store **sequentially** (each `.range()` awaits the
previous), holds every row in memory, and sums in JS. At ~3k ads the cold path already risks the 8s
timeout at `meta-sync.ts:731`; the user then sees the honest "Still syncing" error and retries, each retry
paying the same cost (single-flight helps only same-instance concurrency). This directly violates §85
("no single request/SQL/array" for 2k-10k-ad accounts).

Second to break: **completeness-gate double cost.** `from-store.ts:243` returns `null` (→ full live pull)
if *any* windowed ad lacks an `ad_meta` row. On a large account whose metadata sync lags metrics sync,
every page load reads all raw rows + all meta rows, discards them, THEN does a live pull — paying both.

Third: **deploy/schema-bump stampede.** Bumping `CACHE_SCHEMA` (`meta-sync.ts:560`) orphans every L2 row,
so after any deploy all active users cold-miss simultaneously. Single-flight is in-process only, so
N users × M instances all cold-pull at once → thundering herd on Meta + N concurrent O(rows) store reads.

## 4. User-scale (10 → 10,000 users)

- Daily cron `cron/sync/route.ts:92-131` lists **all** connected accounts and warms with `CONCURRENCY=3`.
  At 10k users this is 10k sequential-ish warms at 3-wide inside one 300s function — **cannot finish**; late
  users never warm and their ingestion chains (started only after their warm block, and skipped entirely if
  warm throws — S11) never start. **P1 at scale.** Needs a queue/fan-out, not one mega-invocation.
- Vercel Hobby cron fires **daily** (`vercel.json` `0 3 * * *`); the self-chain is the only intra-day
  convergence. `MAX_HOPS=20` caps a single account's daily coverage — a very large account plus many users
  cannot all converge from one daily trigger.
- `ai_usage` budget check (`ai/budget.ts:24-30`) sums today's rows in JS ("ponytail: swap for SQL sum at
  scale") — fine now, O(rows) at high AI volume.

## 5. Cache design review (§149: key / scope / TTL / invalidation / stampede)

| Property | Finding | file:line |
|---|---|---|
| Key | `CACHE_SCHEMA:activeId:lookback:window:campaign:objectives:weights:catalog`; `memKey` prefixes `userId` | `meta-sync.ts:667-668` |
| Scope | L1 in-process LRU (500, `LruMap`); L2 shared Supabase `cockpit_cache` keyed by (user,cache_key). Tenant-safe (userId in both). | `meta-sync.ts:564-565`, `lru.ts` |
| TTL | FRESH 5min, STALE 24h, cold timeout 8s | `meta-sync.ts:549-551` |
| Invalidation | `bustCockpitCache(userId)` scoped-clears L1 by prefix + deletes L2 rows; schema bump orphans old shapes; `isRenderableShape` rejects stale-shape blobs | `meta-sync.ts:568-585,690`, `renderable.ts` |
| Bound | L1 = 500 LRU; L2 growth bounded only by 24h age-out (`writeCockpitL2:600-604`) — many filter permutations × users can bloat between cleanups | `meta-sync.ts:590-608` |
| Stampede | Single-flight per `memKey` — **in-process only**; cross-instance & deploy-wide stampede unprotected | `single-flight.ts`, §3 above |
| Failure | every L2 access guarded → falls back to L1 + live pull | `meta-sync.ts:695-697` |

Cache verdict: well-designed for a single warm instance; the **cross-instance stampede** and **short
FRESH_MS for store-backed data** are the two real gaps.

## 6. Queue / job design (§150)

There is **no durable job/queue table**. Ingestion "queue" = `ad_sync_state` (last_run/ok/error/ads_seen,
`ad-metrics.ts:46-50`) + the HTTP self-chain (`kickChain`). Missing vs the §150 checklist: no job id, no
priority, no attempt/backoff counter, no idempotency key beyond upsert PKs, no per-run checkpoint offset
(resume is derived from `ad_meta.updated_at`, not a stored cursor). A dropped `after()` hop has no
retry other than the next daily cron. Adequate for one account/day; **P2** to make many-account convergence
reliable at scale.

## 7. Prioritised findings

- **P0** — S3: headline ROAS/spend silently swap data source on a scope-call failure (`meta-sync.ts:509`,
  `from-store.ts:348`). A wrong-but-confident economic number violates §130/§56. Fix: mark the number's
  source/confidence, or HOLD, when scope is unavailable.
- **P1** — Cold `buildCockpitFromStore` full-account O(ads×days) read on the request path (`from-store.ts:80-104,
  162`); breaks first at ~3k ads. Precompute a rollup/snapshot during sync (§84).
- **P1** — Completeness-gate double cost (`from-store.ts:243`): full store read + full live pull when metadata lags.
- **P1** — S1/S2: DB/token errors render as "not connected" (`meta-sync.ts:186,194`) — masks failure as empty truth.
- **P1** — Daily-cron single-invocation warm-all won't scale past a few hundred users; S11 couples warm failure
  to ingestion never starting (`cron/sync/route.ts:112-125`).
- **P2** — Deploy/schema-bump cross-instance cache stampede (no distributed lock).
- **P2** — S7: unclassifiable creatives re-decoded every run (no negative marker) — recurring AI cost.
- **P2** — Short `FRESH_MS` (5min) forces frequent O(rows) background rebuilds of store-backed, once-daily data.
- **P2** — No durable queue (attempt/backoff/checkpoint); dropped hop waits a full day.
- **P3** — `ai_usage`/budget JS sums; L2 table growth bounded only by 24h age-out.
