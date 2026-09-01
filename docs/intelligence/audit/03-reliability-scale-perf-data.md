# Phase 0 Audit — #7 Failure-modes + #8 Tech-debt + #9 Performance + #11 Data-quality + #15 Scale (READ-ONLY)

## Failure modes (top)
- **F1 (P1)** Headline scope totals silently shrink: if account-level `fetchScopeInsights` fails/partials
  (`meta-sync.ts:271,509`; `from-store.ts:348`), spend/revenue/ROAS fall back to the sum of only the top-50
  analyzed ads — **undercounts the headline, no flag/banner.**
- **F2 (P1)** Store activation is all-or-nothing + silent: completeness gate returns `null` if ANY ad lacks an
  `ad_meta` row (`from-store.ts:178,243`), and metadata-chunk failure is non-fatal (`ad-metrics.ts:118`). A few
  unsynced ads keep the store disabled **forever** → always the slow top-50 live pull. Only visible via `ad_sync_state.last_error`.
- **F3 (P1)** No concurrency lock on sync: cron self-chain + manual `/api/ingest/run` + re-fired trigger can run
  the same account concurrently; upserts stay correct but both pick the same stalest ads → double Meta calls → faster rate-limit exhaustion.
- **F5 (P2)** Infra/DB outage renders as "not connected" (`meta-sync.ts:186`) — masks an incident as a disconnect.
- **F6 (P2)** Pagination hard caps (`maxPages=60`, etc.) silently truncate large enumerations, no completeness signal.

## Scale (first walls)
- **S1 (P0/P1)** Whole brain recomputed at REQUEST time over an unbounded in-memory ad set: `buildCockpitFromStore`
  reads ALL 90-day rows into one array (~270k @3k ads, ~900k @10k) then `analyzeAccount` runs O(ads × 1,061 rules);
  and with a token present the store path runs `analyzeAccount` **twice** (`from-store.ts:259,280`). First thing to
  blow the 300s/memory budget. **The scaling wall.**
- **S2 (P1)** Live fallback capped at `MAX_ADS=50` — a big un-warmed account only ever analyzes its top 50 ads.
- **S4/S5 (P1)** Daily warm loop (CONCURRENCY=3, daily cron) can't fit 10k users; no global Meta rate governor
  (per-call backoff only) — chains fan out per account across users against a shared app-level Meta limit.
- Sync IS resumable/deadline-bounded/idempotent (DEADLINE_MS=230s, stalest-first, PK upsert). Missing: idempotency
  across CONCURRENT runs (F3) + a completeness signal.

## Performance (precompute candidates)
- **P3.1 (P1)** Full analysis pipeline runs at request time on every miss/stale-refresh instead of precomputed
  during sync. **P3.2 (P1)** run twice in the store path. **P3.3 (P2)** `applicableRules` re-filters+sorts 1,061
  rules per ad per request though only ~36 contexts exist (memoizable). **P3.4 (P2)** ~5 live Graph calls
  (currency, 2× native, scope, statuses) fire on the "instant" store path — defeats "store = fast."

## Data quality (trust-critical)
- **D1 (P1) — the confidence de-rating is COSMETIC.** `dataQuality.confidencePenalty` is only DISPLAYED in the
  ConfidenceBanner (`app/app/page.tsx:111`); **no consumer subtracts it** from any confidence/verdict/score. The
  banner says "confidence de-rated X%" while the numbers shown are NOT de-rated. **Single most important DQ finding.**
- **D2 (P1)** The rich data-quality engine `lib/data-quality.ts` (MISSING_DAYS, DUPLICATE_ROWS, TRACKING_SHIFT
  clicks>impressions, STALE_DATA, gateRecommendation) is **imported by nothing** — dead code. The live path uses a
  shallow `lib/scoring/data-quality.ts` that doesn't detect duplicates/missing-days/tracking-shift/staleness.
- **D3 (P2)** Judgment inputs are proxies: `metricVsMedian = performance/50` (percentile→ratio, not a real median),
  `settledDays = days-1`, `platform:"Meta"` hardcoded (`analyze.ts:343,351,352`).
- **D4 (P2)** Timezone missing → windows use UTC (day-shifts non-UTC spend); unknown currency → budget divisor
  defaults /100 (JPY/KRW 100× wrong) — both silent.
- Positive: DB PK prevents duplicate (ad,date) rows; `impressions>0` CHECK keeps non-delivered rows out.

## Tech debt (most impactful)
1. Two divergent DQ engines; rich one dead, penalty cosmetic (D1/D2).
2. No precomputed cockpit; full brain recomputed at request time, doubled (S1/P3.1/P3.2).
3. No concurrency control on ingestion + no Meta rate governor (F3/S5).
4. Store activation all-or-nothing + silent (F2).
5. Giant cached JSON blob keyed by hand-bumped CACHE_SCHEMA string (the "data baked in" root cause).

**Most trust-eroding:** D1 (fake de-rating) + F1 (headline silently shrinks). **First scaling wall:** S1/P3.1.
**First growth break:** F3/S5.
