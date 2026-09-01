# Phase 0 Audit — #7 Failure-Modes + #8 Tech-Debt + #9 Performance + #15 Scale (READ-ONLY)

Grounded in a fresh full-repo forensic read (2026-09-01). Evidence is `file:line`. No code changed.
Companion to `01-architecture-dataflow.md`. Verdict up front: **the calculation core is pure,
AI-free, resumable and idempotent — the debt is concentrated in the READ PATH scale and a missing
queue/materialization layer, plus a handful of places where a FAILURE is rendered as valid data.**

## #7 Failure-mode inventory (per external call)

| Call | Location | On failure | Class |
|---|---|---|---|
| Meta Graph (all reads) | `meta-source.ts:44` | 3 attempts, retry 429/500/503/network, then THROWS | Loud (safe) |
| `listTopSpendingAds` | `meta-sync.ts:275` | catch -> `ads=[]`; skips fallback if a filter is active | **Masquerade** |
| `fetchScopeInsights` (headline totals) | `meta-sync.ts:271`, `from-store.ts:348` | `.catch(()=>null)` -> falls back to SUM of top-50 analyzed ads | **Masquerade** |
| `fetchAdMeta`/`fetchAdCreatives` | `meta-sync.ts:292` | `.catch(new Map())` -> status undefined -> treated ACTIVE | Safe direction |
| `fetchAdStatuses` (liveness) | `from-store.ts:263` | catch -> keep stored (stale) status | Degrades |
| `fetchLevelNative` (reach/freq/budget) | `meta-source.ts:806` | catch -> empty -> UI "n/a" | Graceful |
| Gemini vision/json | `gemini.ts:94` | 1 retry then `return null` | Graceful but SILENT |
| AI router chain | `ai/router.ts:26` | kill-switch/budget -> null; walks fallbacks; else null | Graceful, silent fallback |
| Photoroom / remove.bg | `background-removal.ts:45` | `!ok -> null` -> returns UNCUT original (`removed:false`) | Graceful degrade |
| Store reads | `from-store.ts:163` | catch -> null -> live pull | Silent fallback |
| Supabase admin down | `meta-sync.ts:186` | catch -> `{status:"not_connected"}` | Connect screen (not 500) |

### The dangerous class — FAILURE masquerading as valid data (ranked)
1. **Scope-total failure -> top-50 sum, shown as the true account ROAS/spend** (`meta-sync.ts:509-515`,
   `from-store.ts:348-354`). On a 3,000-ad account a transient error yields a confident, understated
   ROAS the UI renders identically to a correct one. **No "estimated" flag reaches the user.** Highest severity.
2. **Meta error under an active filter -> empty set -> "no_data / healthy-empty"** (`meta-sync.ts:275-284`
   -> `cockpit-data.ts:91`). A transient 500 is indistinguishable from "you genuinely have no spend."
3. **Unrecognized Meta action-type shape -> purchases/revenue = 0** (`meta-source.ts:96,114`) -> real
   converters flagged as waste/loser. A schema drift reads as "this ad is failing," not "we cannot read this."
4. **Stale stored liveness -> action recommended on an already-paused ad** — refresh is bounded to
   `|doThis|+60` ads (`from-store.ts:262`); a low-spend just-paused ad outside that set still surfaces as "do this."
5. **Silent background decode failure -> creative diversity quietly null** (`meta-sync.ts:399`,
   `from-store.ts:411`) — no distinction between "read failed" and "genuinely absent."

## #9 Performance bottlenecks
- **Whole-account analytics recomputed at REQUEST time** on any `cockpit_cache` miss: `buildCockpitFromStore`
  (`from-store.ts:127-444`) reads EVERY `ad_metrics` row for 90d + EVERY `ad_meta` row into one array, then
  4+ full in-memory passes + `analyzeAccount`, inside an 8s-capped page request (`meta-sync.ts:551`).
- **"Store" path still fires ~4-5 live Graph calls per cold render** (scope insights + adset/campaign native +
  liveness refresh, `meta-sync.ts:227-239`).
- **Full-account row read BEFORE the completeness gate rejects** (`from-store.ts:162-243`) — wasted I/O on
  partially-synced large accounts.
- **L1 cache is per-serverless-instance and cold on every new lambda** (`meta-sync.ts:565`); Upstash exists
  (`lib/upstash.ts`) but is UNUSED in this hot path — most "warm" loads still pay an L2 DB round-trip.
- No materialized verdict/leaderboard/health table; every miss recomputes the whole view.

## #15 Scale risks (what breaks first, and at what size)
1. **Request-time whole-account read+aggregate — breaks first, ~3,000 ads** (`from-store.ts:77-340`): cold
   render exceeds the 8s cap -> user stuck on "Still syncing" (`meta-sync.ts:732`).
2. **Completeness-gate cliff -> 50-ad cap, ~3,000-10,000 ads** (`from-store.ts:243`, `meta-sync.ts:93`): if ANY
   one ad lacks metadata the entire store path is abandoned for the 50-ad live pull. A large account that never
   reaches 100% metadata coverage in one window is PERMANENTLY capped at analyzing 50 ads.
3. **Self-chain ingestion convergence, ~10,000 ads** (`cron/sync route.ts:88`, `ad-metrics.ts:23-24`): 20h
   refresh + `MAX_HOPS=20` x 230s; the chain can spend its hop budget re-refreshing stale ads before finishing
   the backlog, so the completeness gate may never pass -> store perpetually "incomplete."
4. **30k-ad enumeration ceiling** (`meta-source.ts:1020`): >30,000-ad accounts silently truncate the ad universe.
5. **No queue / no durable coordination** (`lib/queue.ts` interface defined but NEVER implemented/called): a
   dropped hop (`.catch(()=>{})`, `route.ts:37`) silently defers a whole account to the next day; no retries,
   dead-letter, or backpressure across tenants.

## #8 Tech-debt inventory (scored; extends `docs/tech-debt.md`)

| # | Item | Evidence | Impact | P |
|---|---|---|---|---|
| 1 | No job queue despite architecture requiring one | `lib/queue.ts` unused; `cron/sync route.ts:34-39` self-chain | Dropped hops defer accounts a day; no retry/backpressure | P2 |
| 2 | Whole-account analytics recomputed at request time | `from-store.ts:127-444` | ~270k rows in an 8s request; belongs at sync time | P2 |
| 3 | All-or-nothing store completeness gate | `from-store.ts:243` | One missing row drops a big account to 50-ad pull | P1 |
| 4 | Headline totals silently fall back to top-50 sum | `meta-sync.ts:509-515` | Wrong, understated ROAS shown as authoritative | **P0** |
| 5 | `MAX_ADS=50` analyzed-ad ceiling when store not fully synced | `meta-sync.ts:93` | Most large accounts analyze only 50 ads | P1 |
| 6 | Ingestion refresh churn / convergence risk | `ad-metrics.ts:23-24`, `select-ads.ts:5` | 10k-ad accounts may never reach full coverage | P2 |
| 7 | Enumeration page caps silently truncate | `meta-source.ts:1020` | Accounts >30k ads under-count with no error | P2 |
| 8 | L1 per-instance cold cache; Upstash present but unused | `meta-sync.ts:565`, `lib/upstash.ts` | Most warm loads pay an L2 round-trip | P3 |
| 9 | `confidencePenalty` computed but never wired to a decision | see `04-risk-registers.md` DQ-1 | Low-confidence account still shows high-confidence cards | **P0** |
| 10 | Orphaned richer data-quality engine (dead code) | `lib/data-quality.ts` zero importers | STALE/TRACKING_SHIFT/DUPLICATE checks never run | P1 |
| 11 | `docs/ARCHITECTURE.md` ~5 weeks stale + misleading | `01-architecture-dataflow.md` §2 | Describes nonexistent tables/pipeline | P1 (doc) |

### What is genuinely good (so remediation is not misdirected)
Pure AI-free compute core (`analyzeAccount`, scoring, `judgeAd`); idempotent upserts on natural keys
(`ad-metrics.ts:110,209`); resumable + deadline-bounded ingestion (`ad_sync_state`, `DEADLINE_MS`);
single-flight collapse of concurrent cold misses; schema-versioned L2 cache (`v6`); secrets in
Authorization headers not query strings; constant-time cron-secret compare; deterministic Ask grounding
re-check. The debt is scale-of-read and the missing queue/materialization layer, not calc correctness.

## What we do NOT yet know (honest gaps)
- Real convergence time of the self-chain at 3k / 10k ads under Meta's live rate limits (needs a load test,
  not a code read).
- Actual `cockpit_cache` hit rate in production (no cache-hit metric emitted).
- Whether any live tenant currently exceeds the 50-ad cap today (needs a prod row-count query).
