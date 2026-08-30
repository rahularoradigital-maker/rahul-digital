# Media-Buyer Change Intelligence — Plan

> Goal: ingest an account's change history (who changed what, at campaign/ad-set/ad level), attribute each
> change to its performance impact over the following days, learn/rank whether buyers' moves help or hurt.
> Evidence-based (2 discovery agents, 2026-08-30). Build on existing rails; measure honestly.

## Feasibility (verified against Meta docs) — PARTIAL-YES

- **Endpoint:** `GET /act_{account_id}/activities` (and per-object `/{campaign|adset|ad}/activities`).
- **Fields:** `event_type, event_time, actor_id, actor_name, object_id, object_name, object_type, extra_data (JSON old→new), translated_event_type`.
- **event_types cover everything a buyer does** — budget (`update_ad_set_budget`, `update_campaign_budget`…), status (`update_*_run_status`), bid (`update_ad_set_bid_strategy`…), targeting (`update_ad_set_target_spec`…), creative (`update_ad_creative`…), name — at all 3 levels.
- ❌ **No email in the activity row** — only `actor_id` + `actor_name`. The "email → name" premise is FALSE. Email is a best-effort 2nd hop to `/{business_id}/business_users?fields=id,name,email` (BM members only; misses agency/system actors). **→ Key buyers by `actor_name`/`actor_id`; email is optional enrichment.**
- ⚠️ **Retention is a rolling ~1-week default (widen via `since`/`until`, no guaranteed depth).** → **Must ingest incrementally daily from day one; cannot back-fill history later.**
- The magnitude of each change lives in `extra_data` (JSON, shape varies per event_type) → parse + normalize.

## Reuse map (don't reinvent)
- **Ingestion contract:** copy `syncAdMetrics` (`lib/ingest/ad-metrics.ts:39`) + `SyncResult` + the cron self-chain (`app/api/cron/sync/route.ts`).
- **Meta fetch:** `graphGet`/`graphGetAll` (`lib/meta-source.ts:36,74`) — Bearer auth, retry/backoff, cursor paging.
- **Store:** mirror `ad_metrics`/`ad_sync_state` (`0008`) — `(user_id, account_external_id, …)` PK, deny-by-default RLS, paged reads past the 1000-row cap (`from-store.ts:62`).
- **The attribution brain ALREADY EXISTS:** `lib/rules/change-log.ts` (buyer-vs-algo-vs-creative, learning-phase penalty, `attributeDrop`) — pure + tested, just unwired. It eats `ChangeEvent[]` + `DayPerf[]`. (NOTE: the hygiene audit called `lib/rules/*` "dead" — this file is the exception; it becomes live here. Do not delete it.)
- **Statistical rigor:** `settledRows` (attribution tail, `lib/scoring/attribution.ts:21`), `volumeSufficiency` (`decision.ts:68`), self-baselining (before-window as the ad's own baseline), `assessDataQuality` (delivery-gap = a change boundary), `aggByDay` (`from-store.ts:257`).

## Phases

### Phase 1 — Change ingestion (THIS SLICE)
- Migration `0015_ad_changes` + `change_sync_state` (cursor = last `event_time`).
- `lib/meta-source.ts`: `fetchAccountActivities(accountExternalId, token, sinceISO)` + `mapActivityRow` (normalize event_type→`change_type` pause|scale|budget|audience|creative|status|name|other; derive `level` + `source` buyer|algo from actor presence).
- `lib/ingest/change-history.ts`: `syncChangeHistory(userId, accountExternalId, token)` — incremental (since cursor, else 30-day backfill), paginate, dedupe upsert on `(user_id, account_external_id, change_id)`, advance cursor. Never throws.
- Wire into cron continue-mode after `syncAdMetrics`.
- `scripts/check-change-ingest.ts` (mapActivityRow normalization) → `check:change-ingest` in `check:all`.
- **Verify:** build gate green; live run on boAt account writes real `ad_changes` rows.

### Phase 2 — Actor → buyer identity
- Best-effort `business_users` join for email; always keep `actor_name`. A `media_buyers` view keyed by `(account, actor_id)`.

### Phase 3 — Impact engine (the rigorous core)
- For each change: build before-window (N days pre) + after-window (7/10/14 days post) from `ad_metrics` via `aggByDay`, **trim the still-settling tail (`settledRows`)**, gate on `volumeSufficiency`, compute the signed delta vs the ad's own before-baseline, feed `change-log.ts` to rule out learning-phase/algo. Output per change: `improved | worsened | insufficient` + confidence + the metric deltas. Never a naive causal claim.
- `scripts/check-change-impact.ts` (settled-trim, sufficiency, delta sign, insufficient sentinel).

### Phase 4 — Learning + ranking
- Aggregate per buyer + per change-type: hit-rate of "improved", median delta, sample size. Rank buyers on outcomes (with sufficiency), surface which move-types consistently help/hurt for this account.

### Phase 5 — Surface
- A "Change Impact" tab (in `/app/media` or new `/app/changes`) + the admin backend. Shows the change timeline, per-change verdict, and buyer/rule leaderboards.

### Final — Verification
- All `check:*` green; live run on boAt; spot-check a real budget/pause change's before/after delta by hand.

## Honest guardrails (5-year)
Correlation ≠ causation: confounded by concurrent changes, external swings, learning phase. We report a controlled before/after delta with the learning phase excluded and significance gated, labeled honestly. Ranking is directional signal for the buyer, not a verdict on the person.
