# SYSTEM MAP — AdScale/AdBrain (Phase 0, READ-ONLY)

Generated 2026-09-01. Evidence-cited architecture + data-flow audit. Every claim carries `file:line`.
Tags: **MATCH** (code agrees with doc), **DRIFT** (doc wrong/stale), **UNKNOWN** (not verifiable from source).

Stack: Next.js 16 App Router (`middleware` renamed to `proxy` — `proxy.ts:8`), React 19, TS, Supabase Postgres.

---

## 1. Request → outcome data-flow walkthrough

A logged-in load of any `/app/*` page:

1. **Auth edge** — `proxy.ts:8` runs on every matched request (`proxy.ts:74-77` matcher). For `/app*` it verifies the JWT **locally** via `supabase.auth.getClaims()` (ES256, no Auth-server round-trip — `proxy.ts:57`), refreshing the session cookie through `setAll`. No claims → redirect `/login` (`proxy.ts:64-69`). Fails **open to /login** on any error (`proxy.ts:59-61`), and is skipped entirely before Supabase keys exist (`proxy.ts:20-22`).
2. **Layout guard** — `app/app/layout.tsx:30-38`: re-checks `getCurrentUser()` (never trust middleware alone) then `requireProductAccess()`. Access gate `lib/app/access.ts:20-33` reads `profiles.access_state` via **service-role** client; **fails CLOSED to WAITLIST** on any error (`access.ts:31`), admins short-circuit off `ADMIN_EMAILS` allowlist (`access.ts:23`).
3. **Data load** — page calls `loadCockpit(days)` (`lib/app/cockpit-data.ts:47`). It resolves scope filters from cookies (`resolveCockpitScope`, `cockpit-data.ts:122-145` — window/campaign/objective/weights/catalog/platform) and calls `fetchLiveCockpit(...)` (`cockpit-data.ts:69`). Display window is the topbar's 7/14/30/60/90/custom; fatigue/trend/scaling always use a fixed 90-day baseline (`cockpit-data.ts:115-120`).
4. **Cache resolve** (`lib/meta-sync.ts:645-736`) — cache key = `CACHE_SCHEMA(v6):activeAccount:days:window:campaign:objectives:weights:catalog` (`meta-sync.ts:667`). **L1** in-process `LruMap(500)` fresh <5min → return (`meta-sync.ts:672-676`). **L2** `cockpit_cache` table fresh <5min → return; stale <24h → return stale + `after()` background refresh (`meta-sync.ts:699-715`). Cold/too-stale → block on live pull, capped at `COLD_PULL_TIMEOUT_MS=8s` then return "Still syncing" (`meta-sync.ts:725-735`). Concurrent misses collapse via `createSingleFlight` (`meta-sync.ts:633-636`).
5. **Cockpit build — TWO builders** inside `fetchLiveCockpitUncached` (`meta-sync.ts:165`):
   - **PRIMARY: `buildCockpitFromStore()`** (`lib/cockpit/from-store.ts:127`) reads the **complete day-wise store** (`ad_metrics` + `ad_meta`, paged past the 1000-row cap `from-store.ts:77-125`), joins metadata, applies catalog/objective/campaign filters, and returns the whole account (no top-N cap). Returns `null` (→ fallback) on empty store, missing metadata, incomplete coverage gate (`from-store.ts:164-247`).
   - **FALLBACK: live Meta pull** (`meta-sync.ts:263-345`) — `listTopSpendingAds` capped at `MAX_ADS=50` (`meta-sync.ts:93,276,288`), one account-level `fetchAdInsights` call, concurrent status/creatives.
6. **Normalize → calculate** — both paths converge on `toCockpitInputs()` (`lib/scoring`) → `analyzeAccount()` (`lib/cockpit/analyze.ts`), `windowFunnel`, `buildDailySeries`, `levelFunnels`, `marginalScaling`, `assessDataQuality` (`from-store.ts:246-364`). **Source gate everywhere:** only ads with `impressions>0 && spendRs>0 && active!==false` are judged (`from-store.ts:246`, `meta-sync.ts:353`). Headline totals prefer Meta account-level `ScopeInsights` so numbers match Ads Manager (`from-store.ts:348-364`).
7. **Decision** — deterministic verdict + ranked "do this today" queue, waste/at-risk, fatigue half-life (`lib/cockpit/analyze.ts`, `lib/rules/*`, `lib/scoring/*`). Store path additionally refreshes CURRENT `effective_status` for action candidates + top 60 spenders in ONE bounded Meta call so paused/ended ads never get a nudge (`from-store.ts:257-278`).
8. **AI (narration only)** — `after()` logs decision triples (`cockpit-data.ts:82`, `lib/audit/record`). `/api/ask` is grounded Q&A: `guardProductApi()` (`app/api/ask/route.ts:31`) → reuses the SAME cockpit cache key (`ask/route.ts:67-68`) → `ungroundedNumbers()` veto + one stricter retry (`ask/route.ts:121-123`).
9. **UI → user action** — server components render; all actions are **advisory** (deep links to Meta Ads Manager). Nothing is pushed to Meta.
10. **Outcome loop** — nightly cron re-ingests day-wise with account attribution, converging the store to Ads Manager (`app/api/cron/sync/route.ts:11-19`).

---

## 2. ASCII component map

```
Browser (/app/*)
   │
   ▼
proxy.ts  ── getClaims() ES256 local verify ──► redirect /login on miss (fail-open)
   │ (authenticated)
   ▼
app/app/layout.tsx ── requireProductAccess() ─► redirect /waitlist (fail-CLOSED)
   │                        │
   │                        └─ lib/app/access.ts ─► profiles.access_state (service-role)
   ▼
Page (server component) ─► lib/app/cockpit-data.ts loadCockpit()
   │  resolveCockpitScope(cookies)                       │
   ▼                                                      ▼
lib/meta-sync.ts fetchLiveCockpit()
   │   ┌───────────── L1 LruMap(500), FRESH 5m ───────────┐
   │   ├───────────── L2 cockpit_cache table, STALE 24h SWR┤ (after() bg refresh)
   │   └──── cold: singleFlight → fetchLiveCockpitUncached (8s cap) ──┐
   │                                                                  ▼
   │                              ┌─────────── TWO BUILDERS ──────────┐
   │                    PRIMARY   │ buildCockpitFromStore (from-store) │ ◄── ad_metrics + ad_meta (STORE, uncapped)
   │                    FALLBACK  │ live Meta pull (MAX_ADS=50)        │ ◄── Meta Graph v21 (per-request)
   │                              └───────────────┬───────────────────┘
   ▼                                              ▼
lib/scoring toCockpitInputs ─► lib/cockpit/analyze analyzeAccount (PURE)
        ├─ rules/{verdict,account}  scoring/{decision,winner,fatigue,marginal,data-quality}
        ├─ metrics/funnel-metrics   cockpit/{daily-series,level-funnel}
        ▼
   Decision (verdict + do-this queue + waste/at-risk)  ──► UI cards, deep links (advisory only)
        │
        └─ AI: /api/ask grounded Q&A (ungrounded-number veto); audit/record triples (after())

INGESTION (background, writes the STORE)
   Vercel Cron ─► app/api/cron/sync (Bearer CRON_SECRET, timingSafeEqual)
        ├─ DAILY: warm active cockpit + start ingestion chain per connected account
        └─ CONTINUE (?uid&acct&hop): syncAdMetrics slice (230s deadline) + syncChangeHistory
                 └─ self-chains via after()+fetch until complete (MAX_HOPS=20, CONCURRENCY=3)
   Vercel Cron ─► app/api/cron/growth (07:00) ─► discover HN/Reddit/SE/GNews → DRAFTS only

DB (Supabase Postgres): ad_metrics, ad_meta, ad_sync_state, ad_changes/change_sync_state,
   cockpit_cache, creative_semantics, ad_accounts, oauth_tokens(AES-GCM), profiles(access_state),
   token_usage, orgs/org_members/brands/brand_members (tenancy), audit_log, system_flags
Clients: lib/supabase/{server(anon+cookies), client(browser anon), admin(SERVICE ROLE, bypasses RLS)}
```

---

## 3. Caches / queues / cron

| Mechanism | Where | Key / bound | TTL / behavior |
|---|---|---|---|
| **L1 in-process** | `meta-sync.ts:565,672-676` | `LruMap<memKey>`, max **500** | FRESH 5min (`FRESH_MS` :549); per serverless instance, lost on cold start |
| **L2 cockpit_cache (DB)** | `meta-sync.ts:678-715,590-608` | PK `(user_id, cache_key)`, key carries `CACHE_SCHEMA=v6` (:560) | FRESH 5min serve; STALE 24h serve+bg `after()` refresh; rows older than 24h deleted on write |
| **Cold-pull cap** | `meta-sync.ts:551,731-735` | `COLD_PULL_TIMEOUT_MS=8000` | timeout → `{status:error,"Still syncing"}`; `after(pull)` keeps warming |
| **Single-flight** | `meta-sync.ts:633-636`, `lib/single-flight.ts` | per memKey | collapses concurrent cold/refresh pulls into one |
| **Semantic decode cache** | `from-store.ts:369-411`, `lib/creative/decode` | content_hash / `cdn:` filename | fingerprint-once; visual decode bounded 10/run via `after()` |
| **Store completeness gate** | `from-store.ts:243,178,166` | — | falls back to live pull if metadata/coverage incomplete |
| **Graph pagination cap** | `meta-source.ts:75` | `maxPages=12` | silent-truncation hazard on very large lists |
| **Cron: sync** | `vercel.json:5-8`, `app/api/cron/sync/route.ts` | `0 3 * * *`, `maxDuration=300`, `CONCURRENCY=3`, `MAX_HOPS=20`, `DEADLINE_MS=230s`, `AD_CHUNK=40` | resumable self-chaining ingestion via `after()`+`fetch(?uid&acct&hop)`; stops chain on zero-progress (:88) |
| **Cron: growth** | `vercel.json:9-12`, `app/api/cron/growth/route.ts` | `0 7 * * *`, `maxDuration=60` | discovers HN/SE/GNews/Reddit → DRAFTS only, publishes nothing |
| **`lib/queue.ts`** | `lib/queue.ts`, ADR-0004 | — | **UNUSED interface seam**; no durable queue/worker wired |

Both crons authenticate with `Authorization: Bearer $CRON_SECRET` via `timingSafeEqual`; **503 (inert) if `CRON_SECRET` unset**, 401 on mismatch (`sync/route.ts:42-51`, `growth/route.ts:22-25`).

---

## 4. External API dependencies

| API | Purpose | Evidence |
|---|---|---|
| **Meta Marketing Graph v21** | primary ad data (insights, ads, status, creatives, scope) + competitor via Ad Library | `lib/meta-source.ts`, `lib/meta-sync.ts` |
| **Meta OAuth** | account connect + token refresh | `META_APP_ID/SECRET/REDIRECT_URI` (env grep) |
| **Google Ads** | second `AdSource` (`Platform="google"`) | `lib/ad-source.ts:4`, `lib/google/*`, `GOOGLE_ADS_DEVELOPER_TOKEN`; live wiring **UNKNOWN** (demo per memory) |
| **Anthropic / OpenAI / Gemini** | AI router (narration, Q&A, vision decode) | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`; `lib/ai/*`, `lib/gemini.ts` |
| **ScrapeCreators** | competitor/influencer scraping | `lib/scrapecreators.ts`, `SCRAPECREATORS_API_KEY`; **out of credits** per memory |
| **PhotoRoom / remove.bg** | creative-production background removal | `PHOTOROOM_API_KEY`, `REMOVEBG_API_KEY` |
| **Image provider** | AI static ad generation | `IMAGE_PROVIDER/MODEL/FALLBACK_MODEL` |
| **Upstash Redis** | distributed rate-limit | `lib/rate-limit-distributed.ts`, `lib/upstash.ts`, `UPSTASH_REDIS_REST_*` |
| **Shopify** | product catalog for creative | `supabase 0006/0007` |
| **Alert webhook** | ops alerts | `ALERT_WEBHOOK_URL` (`lib/alerts.ts`) |
| **Supabase** | Postgres + Auth (ES256 JWT) | `lib/supabase/*` |

---

## 5. Auth / tenancy / RLS entry points

- **Session verify:** `proxy.ts:57` `getClaims()` local ES256; `lib/app/user.ts` `getCurrentUser()` React-cached, never throws.
- **Product authorization:** `lib/app/access.ts` — `PRODUCT_OK={APPROVED,ACTIVE,ADMIN}` (`access.ts:16`); `requireProductAccess()` (pages) / `guardProductApi()` (routes, `access.ts:60-66`); fail-CLOSED.
- **Three Supabase clients:** `admin.ts` service-role **bypasses RLS** (server-only tripwire, `admin.ts:1`); `server.ts` anon+cookie session; `client.ts` browser anon.
- **RLS posture:** RLS enabled on ~38 tables (grep across `supabase/migrations/`). `oauth_tokens` = RLS-on + **no policy = deny-all**, service-role only (`0002_ad_accounts.sql:35,42`); `ad_metrics/ad_meta/ad_sync_state` same deny-all (`0008_daywise_ingestion.sql:75-77`). Owner tables (`brands`, `competitors`, `ad_accounts`) have `auth.uid()=user_id` policies (`0001_init.sql:90-91`, `0002:39-40`).
- **Tenancy is CODE-LEVEL, not RLS-level for live reads:** cockpit/store reads use `createAdminClient()` (RLS bypassed) with explicit `.eq("user_id",…).eq("account_external_id",…)` filters (`from-store.ts:90-97,112-118`). A missing filter would leak cross-tenant. RLS is defense-in-depth only.
- **Dual tenancy models:** legacy per-`user_id` (what the cockpit actually keys on — `meta-sync.ts`, `from-store.ts`) vs newer orgs→brands→ad_accounts (`0009_tenancy.sql`, `lib/tenancy/{access,resolve}.ts`). `lib/tenancy/access.ts` is PURE + unit-tested (`scripts/check-tenancy.ts`), but the cockpit read path does not route through `resolveUserContext`.
- **Security foundation:** immutable `audit_log` (0015), `system_flags` kill switches (0016), token metering `token_usage`+RPC (0024), AES-256-GCM token encryption (`lib/crypto.ts`, `TOKEN_ENC_KEY`).

---

## 6. MATCH / DRIFT / UNKNOWN vs existing docs

Compared against `docs/ARCHITECTURE.md` (root, 2026-08-28), `docs/10x-audit-and-plan.md`, `docs/ai-audit-architecture.md`, `docs/audit-state.json`.

| # | Claim in doc | Reality (evidence) | Tag |
|---|---|---|---|
| 1 | ARCHITECTURE.md: two-level cache L1 Map + L2 cockpit_cache, SWR 5min/24h, deferred L2 write | Exact match (`meta-sync.ts:549-550,617-619,699-715`) | **MATCH** |
| 2 | ARCHITECTURE.md §"MAX_ADS = 100 analyzed per pull" | Live-pull cap is **`MAX_ADS=50`** (`meta-sync.ts:93`); store path is **uncapped** | **DRIFT** |
| 3 | ARCHITECTURE.md: "Default lookback 30d internally" | `LOOKBACK_DAYS=90` / `COMPARISON_DAYS=90` (`meta-sync.ts:94`, `cockpit-data.ts:120`) | **DRIFT** |
| 4 | ARCHITECTURE.md: AI = "Gemini gemini-3.6-flash, free tier, two features" | Multi-provider router Anthropic/OpenAI/Gemini (`lib/ai/*`, env keys); memory notes flash-lite | **DRIFT** |
| 5 | ARCHITECTURE.md: cron "pre-warms cockpit cache" (only) | Also runs **resumable self-chaining day-wise ingestion** into the store (`sync/route.ts:11-19,80-90`) | **DRIFT (understated)** |
| 6 | ARCHITECTURE.md: "RLS is on for every table; protected tables deny-by-default; isolation via RLS" | Live reads use **service-role (RLS bypassed)**; isolation is code-level user_id filters | **DRIFT** |
| 7 | ARCHITECTURE.md/10x: store-first with live fallback, two builders | Match (`meta-sync.ts:240-262`, `from-store.ts`) | **MATCH** |
| 8 | 10x-audit PART A: AI narrates, never computes; deterministic engines | Match — decision is pure code; AI only narrates/Q&A with grounding veto | **MATCH** |
| 9 | ai-audit-architecture.md: labeled-triples / RLEF drives decisions | Triples are **logged** (`audit/record`), cockpit does NOT read them for decisions | **DRIFT** |
| 10 | ARCHITECTURE.md: cache.ts/queue.ts "seams for future Redis/queue" | `lib/queue.ts` unused; rate-limit uses real Upstash (`rate-limit-distributed.ts`) | **MATCH (queue) / partial** |
| 11 | audit-state.json: largest file meta-source.ts 606 / meta-sync.ts 531 lines; 185 files, 0 security findings | meta-sync.ts is now **~738 lines**, meta-source.ts ~1400+; audit-state is stale (2026-08-28) | **DRIFT (stale)** |
| 12 | ARCHITECTURE.md: `cockpit_cache (user_id, cache_key) PK, data jsonb` | Used exactly so; but **no CREATE TABLE migration** exists (only FK add `0018_user_fks.sql:11`) | **DRIFT (schema not in migrations)** |
| 13 | Next.js middleware in `middleware.ts` | Next 16 → `proxy.ts` (`proxy.ts:8`, no middleware.ts) | **MATCH (renamed, documented)** |
| 14 | Google Ads live integration | `lib/google/*` + `Platform="google"` exist; live API wiring | **UNKNOWN** (demo per memory) |

---

## 7. Top 5 architectural risks

1. **Cross-tenant isolation rests on call-site discipline, not RLS.** Every hot read uses `createAdminClient()` which bypasses RLS (`lib/supabase/admin.ts:6-13`) and relies on manual `.eq("user_id",…).eq("account_external_id",…)` (`from-store.ts:90-97,112-118`; `meta-sync.ts:172-183`). One forgotten filter in a future query leaks another tenant's spend data. The newer org/brand tenancy (`lib/tenancy/resolve.ts`) is not on this path. **Highest severity.**

2. **Correctness depends on a fragile nightly self-chain with no durable queue/dead-letter.** `lib/queue.ts` is an unused seam; ingestion converges only if the `after()`+`fetch` chain completes (`sync/route.ts:34-39,88`). A hop hitting Meta's rate wall with zero progress **stops the chain until the next daily trigger** (`sync/route.ts:88`), leaving a large account silently partially-synced for up to a day. Vercel Hobby cron fires only daily (`ARCHITECTURE.md:54`).

3. **Silent-truncation / completeness hazards stack.** Graph pagination `maxPages=12` (`meta-source.ts:75`), 1000-row Supabase paging (`from-store.ts:77`), live-pull `MAX_ADS=50` (`meta-sync.ts:93`). Headline accuracy leans on the account-level `ScopeInsights` best-effort promise (`from-store.ts:348-364`) — if it fails, totals fall back to summing possibly-truncated store rows.

4. **`cockpit_cache` (and ~12 other code-referenced tables) have no `CREATE TABLE` migration.** Confirmed by `docs/engineering/AUDIT-PHASE-0.md:96` (F-DATA-01) and `supabase/migrations/README.md:11`; only a FK is added in `0018_user_fks.sql:11`. A clean DB cannot be rebuilt from migrations, and `onConflict`-vs-PK mismatch bugs (which already caused a silent persist failure in `0014`) cannot be caught in the repo for these tables. RLS status of `cockpit_cache` is therefore **UNKNOWN** (not asserted in any migration).

5. **AI numeric-grounding is enforced in exactly one route.** `ungroundedNumbers()` veto lives only in `/api/ask` (`app/api/ask/route.ts:121-123`). Other AI surfaces (verdict narration, positioning, brand/creative vision) have no equivalent veto, so the "AI never invents a number" invariant is not uniformly guaranteed across surfaces.

---

Key files: `lib/meta-sync.ts`, `lib/meta-source.ts`, `lib/cockpit/from-store.ts`, `lib/cockpit/analyze.ts`, `lib/ingest/ad-metrics.ts`, `lib/app/cockpit-data.ts`, `lib/app/access.ts`, `lib/tenancy/resolve.ts`, `lib/supabase/admin.ts`, `proxy.ts`, `app/api/cron/sync/route.ts`, `app/api/ask/route.ts`, `vercel.json`, `supabase/migrations/{0001,0002,0008,0009,0018,0022,0024}`.
