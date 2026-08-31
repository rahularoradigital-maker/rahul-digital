# ADR — Known scale ceilings & act-triggers

Status: accepted 2026-08-31. These are architectural ceilings found by a principal-engineer inspection of the
data path (traced from the schema up). They are **deliberately NOT built yet** — at current scale (single
user, ~1k ads, cached) the system is correct and fast, and building them now would be premature optimization.
Each entry names the **evidence**, the **measurable trigger** to act, and the **fix**. Act on the trigger, not
on a hunch.

---

## C1 — Cockpit recomputes account health from RAW day-wise rows (no rollups)

- **Evidence:** `lib/cockpit/from-store.ts` `readAllMetricRows()` pages the whole 90-day `ad_metrics` window
  for the account (PAGE=1000) into memory and re-scores it on every cold load. There are no materialized
  rollup/summary tables (`git grep "materialized view" supabase/migrations` = none).
- **Why it's fine now:** cached (LRU + `cockpit_cache`), so paid once per window per TTL; a ~1k-ad account is
  ~90k rows.
- **First thing that breaks at 10x:** a 3k-ad account = ~270k rows read (270 round-trips) + scored per cold
  load; agency users with 10 accounts multiply it. `ad_metrics` grows ~O(accounts × ads × 365) rows/year.
- **ACT-TRIGGER (any one):** a single account exceeds **~250k rows in the 90-day window**, OR cold cockpit
  p95 > **4s**, OR `ad_metrics` exceeds **~50M rows**.
- **FIX (2021-correct):** compute a **daily rollup per (user, account, date)** and a per-(ad, window) summary
  **on sync** (write-time), and read the rollup (hundreds of rows) on load. Extends
  `docs/24-data-warehouse-schema.md`. Partition `ad_metrics` by date + add a retention window when it grows.

## C2 — Sync-all-accounts is eager (syncs brands nobody opens)

- **Evidence:** `app/api/cron/sync/route.ts` daily mode now starts an ingestion chain for **every** connected
  account. Correct for accuracy today; wrong pattern at scale.
- **First break at 10x:** 10k users × ~5 brands = ~50k account syncs/night, including brands never viewed →
  N× Meta calls (rate-limit risk), N× rows, N× cost.
- **ACT-TRIGGER:** total connected accounts > **~2,000**, OR Meta rate-limit errors appear in the daily sync,
  OR nightly sync no longer completes within its window.
- **FIX:** sync only brands **opened in the last N days** (lazy/recently-active), and sync a brand **on first
  visit** (fire-and-forget) rather than eagerly nightly. Move the heavy pipeline behind a managed queue +
  worker tier (ADR-0003/-0004 revisit trigger).

## C3 — Attribution split (headline vs per-ad live)

- **Evidence:** `fetchScopeInsights` + the nightly store ingest use `use_account_attribution_setting`
  (match Ads Manager); the heavy per-ad live pull `fetchAdInsights` deliberately does NOT (it was a ~5x
  slowdown). So headline + stored per-ad numbers reconcile to Meta; per-ad numbers shown from the **cold live
  fallback** use default attribution and may not.
- **Why it's fine now:** the store is the source of truth; the live per-ad path is only a cold fallback, and
  with C2's nightly sync most brands read the store.
- **ACT-TRIGGER:** a user reports a per-ad number that doesn't reconcile to Ads Manager while the headline
  does, on a brand served by the live fallback.
- **FIX:** once every brand reliably has a store (C2), **retire the per-ad live fallback** so all per-ad
  numbers come from the account-attribution store; until then, **label** live-fallback per-ad rows as
  "approximate (syncing)". (Funnel already did this — it is now store-only, 2026-08-31.)

## C4 — Observability (no request tracing / error aggregation)

- **Evidence:** we have `owner_events` (login/connect/error), `ai_usage` (per-user/model cost), and the admin
  "problems" panel — but no per-request who/brand/account/op/duration/success trace and no error tracker.
- **ACT-TRIGGER:** first real users onboard, OR the first production incident we can't explain from logs.
- **FIX:** add error tracking (e.g. Sentry) + structured per-request logs (who / brand / account / operation /
  version / start / finish / success / duration / cost), redacting secrets. This is
  `docs/production-readiness.md` §3 — mandatory before real load.

---

**Standing rule:** revisit this file at each milestone. Do not build a ceiling's fix before its trigger fires;
do not ignore a trigger once it fires. Correctness and data integrity always win over the fix's cleverness.
