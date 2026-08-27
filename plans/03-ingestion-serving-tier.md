# [plan-03] Ingestion & Serving Tier — background sync + cache + rollups (replace per-request fetch)

## Defect

The cockpit fetches live Meta data **inside the server render**: ~4–6 Graph round-trips per load
(`fetchLiveCockpitUncached`), capped at `MAX_ADS = 100`. This is the root cause of cold-load
latency, the top-N undercount risk (partly mitigated by `fetchScopeInsights`), and the rate-limit
exposure that `docs/enumerated-floating-dahl.md` flags as failing at ~20 concurrent users. The
seams exist (`lib/queue.ts`, `lib/cache.ts`, `lib/ad-source.ts`) but nothing drains them.

## Symptoms

- Cold cockpit load is dominated by sequential Meta latency, not JS. (Weight audit §3)
- `MAX_ADS = 100` means deep accounts analyze only the top-100-by-spend ads; account totals had
  to be back-filled by a separate scope aggregate. (`lib/meta-sync.ts`)
- No materialized rollups: health/leaderboard recompute on every page view.
- No per-tenant rate limiting; a large account can exhaust the app-level Meta budget for others.

## Fix sequence

1. Implement the `Queue` seam (cron-drained Postgres now, QStash/SQS later) and move the Meta
   pull off the request path into a background sync job keyed by `last_synced_at` (incremental,
   upsert on `(ad_id, date)`).
2. Persist day-wise rows to a fact table; add materialized account/creative rollups computed on
   sync, read by the cockpit (dashboard reads never call Meta).
3. Implement the `Cache` seam (in-memory now, Redis later) with SWR + per-tenant keys, invalidated
   on new sync.
4. Add a token-bucket scheduler + per-tenant rate caps behind `ad-source.ts`.
5. Remove the `MAX_ADS` analysis cap once reads are served from rollups.

## Test matrix

| Load | Cold cache | Warm cache | Deep account (>100 ads) | Meta 429 storm |
|---|---|---|---|---|
| dashboard read | served from rollup, no Meta call | instant | full coverage, no cap | backoff holds, no user error |
| sync job | resumable on kill | incremental since last | paginates fully | retries with jitter |

## Out of scope

Multi-region/read-replica DB and the full 10k provisioning — this plan builds the seams so those
are config swaps (per `docs/enumerated-floating-dahl.md` phasing).
