# Phase 0 Audit — #2 Architecture Map + #3 Data-Flow Map (READ-ONLY)

Reconciled against `docs/ARCHITECTURE.md` (2026-08-25). A newer root `/ARCHITECTURE.md` (2026-08-28) is closer
to reality and should likely become canonical.

## 1. System map (real end-to-end flow)

**Cockpit read path (the product's spine):**
Meta Marketing Graph API v21 (user OAuth token) → `lib/meta-source.ts` (graphGet/graphGetAll, 15s timeout,
3-attempt retry on 429/500/503, cursor pagination) → **INGESTION (two lanes)**: (A) background nightly +
on-demand writes the STORE — `app/api/cron/sync/route.ts` / `app/api/ingest/run/route.ts` → `lib/ingest/ad-metrics.ts`
(`syncAdMetrics`, day-wise streaming of every spending ad); (B) live per-request pull fallback when store empty —
`lib/meta-sync.ts` `fetchLiveCockpitUncached()` (top-50 ads by spend, 90d) → **DATABASE (Supabase Postgres)**:
`ad_metrics` (day-wise facts, PK user_id,account_external_id,ad_id,date, impressions>0 gate), `ad_meta`,
`ad_sync_state`/`change_sync_state`, `ad_changes` (Meta activity-log, NOT app-applied), `cockpit_cache`,
`creative_semantics`, `ad_accounts`, `oauth_tokens`(encrypted), `profiles`(access_state, plan), `token_usage` →
**NORMALIZATION** (`meta-source.ts` purchaseValue/firstActionValue collapse omni_/offsite_ actions, no
double-count; mapMetaObjective; minor-unit budget divisor; `toCockpitInputs` in lib/scoring.ts) → **CALCULATION**
(pure deterministic — `lib/cockpit/analyze.ts` orchestrates lib/rules/verdict.ts, lib/rules/account.ts,
lib/scoring/{decision,winner,opportunity,fatigue,marginal,data-quality}.ts, lib/metrics/funnel-metrics.ts,
lib/cockpit/{daily-series,level-funnel}.ts) → **DECISION** (verdict + ranked "do this today" queue, waste/at-risk,
health MODEL_ESTIMATE, half-life; second opinion `lib/judgment/agent.ts` over rules.json, pure) → **AI**
(narration/Q&A only, never computes — `lib/ai/router.ts`→config→providers; `app/api/ask/route.ts` grounded Q&A
with `ungroundedNumbers()` veto + 1 stricter retry) → **UI** (Next 16 server components under app/app/*, gated by
proxy.ts + access gate) → **USER ACTION** advisory only (deep links to Meta; nothing pushed to Meta) → **OUTCOME**
(next nightly sync re-pulls with use_account_attribution_setting=true → converges to Ads Manager).

**Caches (`lib/meta-sync.ts:535-736`):** L1 in-process LruMap(500) + L2 Supabase `cockpit_cache` (shared). SWR:
FRESH_MS=5min serve; STALE_MS=24h serve-stale + background `after()` refresh; cold miss blocks COLD_PULL_TIMEOUT_MS=8s
then "still syncing". `createSingleFlight` collapses concurrent cold misses. CACHE_SCHEMA="v6" in the key.
Store-first: `buildCockpitFromStore()` primary, live pull fallback.

**Cron/"queue":** Vercel Cron → `app/api/cron/sync/route.ts` (daily) + growth; auth Bearer $CRON_SECRET
(timingSafeEqual). Sync is resumable self-chaining (DEADLINE_MS=230s, AD_CHUNK=40, progress in ad_sync_state,
re-invokes ?uid&acct&hop, MAX_HOPS=20, CONCURRENCY=3; stops on zero-progress). `lib/queue.ts` is an UNUSED
interface seam (ADR-0004), no Postgres impl wired.

**External APIs:** Meta Graph v21 (primary + competitor), Meta Ad Library ads_archive (shipped competitor source),
Gemini/Anthropic/OpenAI (router w/ per-task fallback), Google Ads (lib/google/* exists, live wiring UNKNOWN/demo),
ScrapeCreators (out of credits), Shopify (creative-production).

**Auth/tenancy/RLS:** proxy.ts JWT-local verify (getClaims, ES256, fail-open to /login); access gate
`lib/app/access.ts` (access_state, PRODUCT_OK, fail-closed to WAITLIST, admin allowlist); oauth_tokens RLS
default-deny + service-role only + AES-256-GCM + server-only; RLS on 38 tables but **live reads use
createAdminClient() (service role, RLS bypassed) with explicit user_id + account_external_id code filters** — so
tenancy isolation is primarily CODE-LEVEL; RLS is defense-in-depth (0009_tenancy.sql:45). Dual tenancy: legacy
user_id (what cockpit uses) vs newer orgs→brands→ad_accounts (partially wired). Security: immutable audit_log
(0015), system_flags kill switches (0016, honoured in ai/router.ts), RBAC/classification (lib/security/*).
Metering: token_usage + spend_tokens() RPC (0024), reserve_ask_quota.

## 2. Reconciliation vs docs/ARCHITECTURE.md — key DRIFT
- Cron described as "job-queue drainer" → DRIFT (it's resumable self-chaining ingestion; lib/queue.ts unimplemented).
- Intelligence "Deconstruct→Curate→Rules→Strategize→Explain" agent pipeline → DRIFT (no such chain; decision is
  pure code, AI only narrates).
- Tables `jobs`/`job_items`/`recommendations`/`changes` → DRIFT (don't exist; only `ad_changes` = Meta's log).
- `triples`=Brand Brain powering cockpit → DRIFT (cockpit never reads triples).
- ScrapeCreators competitor / single-provider Gemini / RLS-as-isolation → DRIFT.
- Status "specified not built / deployment not started" → DRIFT (fully stale, ~5 weeks behind).
- MISSING from doc: access gate, token metering, L1/L2 cache, audit/kill-switches, Meta Ad Library source.

## 3. Top architectural risks (most severe first)
1. **`docs/ARCHITECTURE.md` is ~5 weeks stale and actively misleading** — describes an aspirational pipeline +
   nonexistent tables, omits everything shipped. Root `/ARCHITECTURE.md` is newer; pick one canonical, fix drift.
2. **Request-time fan-out + fragile nightly convergence** — live fallback makes many Meta calls/cold-load;
   correctness leans on the daily self-chain (MAX_HOPS=20) completing; no managed queue/worker behind it.
3. **Silent-truncation/completeness hazards** — multiple hard caps (maxPages, 1000-row paging, MAX_ADS=50) with
   past-under-count comments; headline numbers depend on several best-effort guards all holding.
4. **Dual, half-migrated tenancy — isolation rests on call-site user_id discipline (RLS bypassed via service
   role).** A future query that forgets the user_id/account filter leaks cross-tenant. Highest-severity gap.
5. **`ad_changes` naming collision** — doc's "log every change, never auto-apply" implies an apply-and-log loop
   that doesn't exist (no app→Meta write). A trap if apply is added later assuming logging exists.
6. **AI grounding enforced in ONE route (ask), not centrally** — other AI surfaces (decision-verdict, positioning,
   brand-profile, creative-vision) have no equivalent numeric-grounding veto; the "AI never invents a number"
   invariant is not uniformly guaranteed.
7. **Cron self-chain has no durable dead-letter / cross-day backoff** — a hop hitting Meta's rate wall stops the
   chain until the next daily trigger; large accounts can silently sit partially-synced for a day.

Key files: lib/meta-sync.ts, lib/meta-source.ts, lib/ingest/ad-metrics.ts, lib/cockpit/from-store.ts,
lib/cockpit/analyze.ts, app/api/cron/sync/route.ts, app/api/ask/route.ts, lib/ai/{config,router}.ts,
lib/app/access.ts, lib/oauth-store.ts, proxy.ts, migrations 0001/0002/0009/0024.
