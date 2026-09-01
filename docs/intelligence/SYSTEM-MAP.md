# AdBrain — System Map (Phase 0, Batch A, deliverable #2/#3)

Status: FIRST PASS from a structural scan + spine read (2026-09-01). Confirmed items are grounded in
files named below; items marked (UNVERIFIED) still need a deeper read in a later Batch-A turn. Per the
charter, nothing here is invented — gaps are labelled, not guessed.

## 1. The spine: source -> ingestion -> store -> calc -> decision -> AI -> UI -> action -> outcome

```
EXTERNAL SOURCE            INGESTION                 STORE (Supabase)        CALC / DECISION            UI / ACTION
Meta Graph API      ->  /api/cron/sync (daily 3am)  ->  ad_metrics        ->  lib/cockpit/*        ->  /app (cockpit)
 (lib/meta-source,       resumable self-chain        ->  ad_meta            ->  lib/scoring/*        ->  /app/creative
  meta-sync.ts)          (ADR-0004, syncAdMetrics,   ->  ad_changes         ->  lib/rules/*          ->  /app/funnel
Google (lib/google-       CONCURRENCY=3, MAX_HOPS=20) ->  cockpit_cache      ->  lib/funnel/*         ->  /app/changes
 source, demo)          lib/ingest/ad-metrics.ts     ->  competitor_*       ->  lib/judgment/*       ->  /app/media
Shopify (creative-      lib/ingest/change-history.ts ->  creative_*         ->  lib/creative/*       ->  /app/creators
 production)            /api/ingest/run (manual)     ->  influencer_*       ->  lib/reconcile/*      ->  /app/market ...
ScrapeCreators (IG)    /api/cron/growth (daily 7am) ->  ai_usage, ...      ->  lib/decision.ts      ->  Ask AdBrain (/api/ask)
```

Provider abstraction (ADR-0002): `lib/ad-source.ts` defines `AdSource` (meta | google) with
`TokenSet` / `SourceAd` / `MetricsRow`. Providers are adapters; business logic should stay
source-agnostic (charter §59-§60) — TO AUDIT in Batch B whether the calc engines honor this or leak
Meta-specifics.

## 2. Ingestion detail (confirmed from app/api/cron/sync/route.ts)
- Trigger: Vercel Cron `0 3 * * *` -> `/api/cron/sync`, auth via `Authorization: Bearer $CRON_SECRET`
  (constant-time compare; 503 when secret unset, 401 on mismatch — not a public work trigger).
- Resumable + self-chaining: each run does a bounded ad slice; if incomplete it re-invokes
  `?uid=&acct=&hop=` via `after()` (fires post-response). MAX_HOPS=20, CONCURRENCY=3 (Meta rate-limit
  guard). This is the 1,034-ad-account lesson (charter §147) already implemented.
- Warms `cockpit_cache` for WARM_WINDOWS=[90] (the single COMPARISON_DAYS window the whole app uses) so
  first page load is a cache read, and runs day-wise `syncAdMetrics` + `syncChangeHistory`.
- Second cron: `0 7 * * *` -> `/api/cron/growth` (Scout growth agent).

## 3. Seams for scale (confirmed exist; wiring depth UNVERIFIED)
- `lib/ad-source.ts` — ingestion seam (rate-limit-aware scheduler is the P1 add).
- `lib/queue.ts` — `Queue` interface + `Job` type (cron-drain now, QStash/SQS later).
- `lib/cache.ts` — `Cache` interface + `InMemoryCache` (Redis/edge later).
- `lib/rate-limit.ts` + `lib/rate-limit-distributed.ts`, `lib/single-flight.ts`, `lib/lru.ts`,
  `lib/upstash.ts` — concurrency/rate controls. TO AUDIT: which paths actually use the distributed one.

## 4. Calc / decision engines (lib/, by domain — inventory in Batch B)
- Account/health/waste/spend: `lib/rules/{account,waste,spend-floor,metrics,will-break}.ts`, `lib/scoring/data-quality.ts`, `lib/data-quality.ts`, `lib/sample/account.ts`.
- Creative: `lib/scoring/{fatigue,fatigue-forecast,winner}.ts`, `lib/creative/{decode,diversity,diversity-vs-competitors,fingerprint,strategy}.ts`, `lib/rules/{fatigue,diversity,production}.ts`.
- Funnel: `lib/funnel/{diagnosis,stage,thresholds,store}.ts`, `lib/metrics/funnel-metrics.ts`, `lib/cockpit/level-funnel.ts`.
- Change/causality: `lib/scoring/{change-analysis,change-impact,change-ranking,culprit,causality}.ts`, `lib/causality.ts`, `lib/ingest/{change-history,change-map}.ts`, `lib/rules/change-log.ts`.
- Economics: `lib/scoring/{marginal,opportunity,attribution}.ts`. (nCAC/MER/contribution — TO CONFIRM coverage vs charter §61-§64.)
- Cockpit assembly: `lib/cockpit/{analyze,from-store,daily-series,level-metrics,verdict-line,renderable}.ts`, `lib/decision.ts`, `lib/scoring/decision.ts`, `lib/scoring/status-stops.ts`.
- Judgment/AI-critic: `lib/judgment/{agent,corpus,engine}.ts` over the 1061-rule corpus.
- Evidence/trust: `lib/scoring/evidence.ts`, `lib/confidence.ts`, `lib/rules/trust-gates.ts`, `lib/ask-grounding.ts`.
- Influencer: `lib/influencer/*` (scoring, providers, discover, rank — Phase 1/2 filters + authenticity done).
- Competitor: `lib/competitors/*`, `lib/scoring/rubrics.ts`.
- Reconcile: `lib/reconcile/{scopes,store}.ts`.

## 5. AI layer (charter §68-§72) — TO AUDIT in Batch C
`lib/ai/*` (routing + usage), `lib/gemini.ts`, `lib/prompts/*`, `lib/judgment/*`, `lib/ask-grounding.ts`.
Model choice: gemini-flash-lite-latest for text (memory). AI usage metered in `ai_usage` (migration 0019)
+ token metering (0024). Guardrails claimed: auth-gated /api/judgment, per-user rate caps, prompt-injection
guards. TO VERIFY each live.

## 6. Database ownership (24 migrations, supabase/migrations/)
Core: 0001 init, 0002/0005 ad_accounts (+active flag), 0008 daywise ad_metrics, 0012 impressions>0,
0018 ad_meta content_hash, 0017 ad_changes / creative_semantics, 0023 creative_visual_semantics.
Tenancy: 0009 tenancy, 0010 brand-scope creative-production, 0011 org_invites, 0018 user_fks, 0022
access_state (+down). Security/ops: 0015 audit_log, 0016 system_flags, 0021 provider_keys, 0019 ai_usage,
0024 token_metering, 0013/0014 notifications (+dedupe unique). Feature: 0006/0007 shopify + influencer,
0020 growth_sources/owner_events. FULL column-level ownership map -> Batch A next turn (data-flow map).

## 7. Auth / RLS / tenancy (charter §80-§81) — spine confirmed, depth TO AUDIT
- Auth: Supabase (@supabase/ssr), `lib/supabase/{server,admin}.ts` (admin = service-role). Next 16
  `proxy.ts` (renamed middleware), async `cookies()`.
- Access gate: `lib/app/access.ts` `guardProductApi()` (private-beta default-deny, WAITLIST->APPROVED,
  migration 0022) — confirmed used in influencer/run; TO AUDIT coverage across all product routes.
- Tenancy: Brand -> Account model (migration 0009), `lib/tenancy/*`. Charter flags deeper per-feature
  isolation as a critical concern — Batch C tenancy-risk register.
- Meta OAuth: `/api/connect/meta/*`, `lib/oauth-store.ts` (token store), token encryption (ADR-0002).

## 8. Failure paths / observability (charter §128-§130) — TO AUDIT
`lib/observability.ts`, `lib/alerts.ts` (sendAlert on sync failure / AI budget), `instrumentation.ts`.
Claim: failures stay observable (no failed-calc->0). Batch B/C must verify each engine's missing-data
behavior against §79 (unknown != zero).

## 9. External integrations
Meta Graph (ads data), Google Ads (demo/partial), Shopify (creative-production), ScrapeCreators (IG
influencer), Gemini (AI), Upstash (distributed rate-limit/cache?), Supabase (auth/DB). Vercel (host, Hobby
plan, ~60s serverless cap / 300s on cron routes).

## What we do NOT yet know (honest gaps for later Batch-A turns)
- Column-level DB ownership + the full data-flow map (deliverable #3) — not yet produced.
- BUSINESS-LOGIC.md (deliverable #4) — per-metric formulas/assumptions/windows — not yet produced.
- Whether calc engines are truly source-agnostic or leak Meta specifics (§59-§60).
- Which routes actually enforce `guardProductApi()` + tenancy scoping (§80-§81) — needs a route-by-route sweep.
- Real missing-data behavior per engine (§79) — needs reading each engine, not just naming it.
- Whether `cockpit_cache` freshness/invalidation matches §130-§131.
```
