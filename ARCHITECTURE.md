# AdBrain — Complete Architecture & Context Dump

> A single reference for the entire app: what it is, how it's built, how the pieces talk, every
> external service, key, formula, table, and the current honest status. Derived directly from the
> source code, the live Supabase schema, and config — not from memory. Date: 2026-08-28.

---

## 1. What the app is

**AdBrain** is a Meta (Facebook/Instagram) ads **creative-decision-intelligence** web app. A user
connects their Meta ad account; the app pulls their real ads + daily metrics, runs a set of
**deterministic decision engines** over them, and shows a cockpit that says — per ad — what to
**scale / refresh / hold / kill**, and **why**, in plain language, with the exact numbers.

Core principle enforced everywhere: **only the user's REAL data is ever shown. Nothing is
fabricated.** When data is missing, the app shows an honest "not enough signal / connect X" state,
never a made-up number.

- **Type:** Single Next.js app (web + API in one). No separate backend.
- **Repo:** GitHub `rahularoradigital-maker/rahul-digital`, default/production branch
  `validation-v0-v1`.
- **Live URL:** `https://rahul-digital.vercel.app`

---

## 2. Tech stack (exact versions)

| Layer | Tech |
|---|---|
| Framework | **Next.js 16.3.2** (App Router, React Server Components) |
| UI | **React 19.2.8**, **Tailwind CSS v4** |
| Language | **TypeScript 5** (strict; `.ts`/`.tsx`) |
| Auth + DB client | **@supabase/ssr 0.12.5**, **@supabase/supabase-js 2.112.4** |
| AI SDK | **@anthropic-ai/sdk 0.120.0** (now only used by the Claude health-check route; the live "Ask" feature uses Gemini via REST) |
| Lint | ESLint 9 + eslint-config-next |

Next 16 renamed `middleware.ts` → **`proxy.ts`** (at repo root). There is no `middleware.ts`.

---

## 3. Hosting & infrastructure (where everything lives)

| Thing | Where | Detail |
|---|---|---|
| **App hosting** | **Vercel** | Team `rahularoradigital-3134`, **Hobby plan**. Deploys from the `validation-v0-v1` branch on push. Serverless functions (Node runtime). |
| **Database + Auth** | **Supabase** | Project id `gizgdgyxyqpvtgecrmik`. Postgres + Supabase Auth (email/password + Google OAuth). Asymmetric **ES256** JWT signing keys are enabled. |
| **Source control / CI** | **GitHub** | `rahularoradigital-maker/rahul-digital`. CI = `.github/workflows/ci.yml` (build + `npm run check:all`). |
| **Ad data** | **Meta Marketing (Graph) API v21.0** | Live, per connected account. |
| **AI (creative + Ask)** | **Google Gemini** (`gemini-3.6-flash`, REST, free tier) | Creative attribute decoding + Ask AdBrain answers. |
| **Competitor ad data** | **ScrapeCreators API** | Pulls competitors' live Facebook Ad Library ads. |

**Hobby-plan constraints that matter:** serverless function timeout is tight (cold cockpit pulls
can 504 — see §16), and cron jobs are limited to **once per day**.

---

## 4. Environment variables / keys (all 13)

Set in Vercel (production) and `.env.local` (dev). Server-only unless prefixed `NEXT_PUBLIC_`.

| Env var | Used for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public (safe). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon client key | Public; protected by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client (bypasses RLS) | **Secret.** Used for all server-side DB writes/reads of protected tables. |
| `TOKEN_ENC_KEY` | AES key to encrypt/decrypt stored Meta OAuth tokens | **Secret.** |
| `GEMINI_API_KEY` | Google Gemini REST calls (creative decode + Ask) | **Secret.** Free tier. |
| `ANTHROPIC_API_KEY` | Claude — now only `/api/health/claude` | **Secret.** Ask was migrated off Claude to Gemini. |
| `META_APP_ID` | Meta OAuth app id | For the connect flow. |
| `META_APP_SECRET` | Meta OAuth app secret | **Secret.** |
| `META_REDIRECT_URI` | Meta OAuth callback URL | |
| `SCRAPECREATORS_API_KEY` | ScrapeCreators (competitor ads) | **Secret.** |
| `CRON_SECRET` | Bearer token guarding `/api/cron/sync` | **Secret.** If unset, the cron route returns 503 (inert). |
| `ADBRAIN_PERF` | Set to `1` to log per-phase timing of the cockpit pull | Diagnostics only. |
| `NODE_ENV` | Standard | Guards the dev-only `/preview/cockpit`. |

---

## 5. External services & the exact endpoints called

- **Meta Graph API v21.0** — `https://graph.facebook.com/v21.0` (insights, ads, campaigns, ad sets,
  creatives) + OAuth `https://www.facebook.com/v21.0/dialog/oauth` and
  `https://graph.facebook.com/v21.0/oauth/access_token`.
- **Google Gemini** — `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`.
- **ScrapeCreators** — `https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads` and
  `.../adLibrary/search/companies`.
- **Supabase** — `https://<project>.supabase.co` (auth, Postgres via the JS client).

---

## 6. Directory structure (full, with purpose)

```
app/                              Next.js App Router (pages + API)
  layout.tsx                      Root layout (fonts, globals.css)
  page.tsx  product/  book-demo/  Public marketing pages (static)
  (auth)/                         login, signup, server auth actions
  auth/callback/                  OAuth code-exchange callback
  app/                            THE PRODUCT (auth-gated)
    layout.tsx                    App shell: auth guard + sidebar + topbar
    page.tsx                      COCKPIT (home)
    action-center/page.tsx        ACTIONS (ranked plan + judgment buttons)
    creative/page.tsx             CREATIVE (Fatigue / Diversity / Brand Brain / Concepts tabs)
    media/page.tsx                MEDIA (budget + KPIs)
    market/page.tsx               MARKET (competitor intelligence)
    settings/page.tsx             SETTINGS (account, sources, verdict weights)
    loading.tsx  error.tsx        Skeleton + error boundary
  preview/cockpit/page.tsx        DEV-ONLY component preview (404 in prod)
  api/
    ask/                          Ask AdBrain (Gemini, grounded answers)
    meta/accounts|campaigns/      List Meta accounts / campaigns (client dropdowns)
    connect/meta/                 OAuth: authorize -> callback -> select-account
    competitors/run|analyze|search/  Competitor pull, Gemini analyze, brand search
    creative/analyze/             Own-ad creative decode (Gemini agents)  [stage 7]
    audit/judgment/               Record operator approve/dismiss (RLEF label)
    leads/                        Public book-demo lead capture
    cron/sync/                    Daily background cache pre-warm (Vercel Cron)
    health/claude/                Claude connectivity probe
    debug/creatives/              Dev diagnostics

lib/
  app/         cockpit-data.ts (page data loader), user.ts (getClaims auth), nav.ts,
               windows.ts (date presets), kpi-catalog.ts (162 KPIs), ads-manager-url.ts
  meta-sync.ts     Orchestrates a live pull: account -> Meta -> analyze -> 2-level cache
  meta-source.ts   Meta Graph API implementation (insights, ads, creatives, pagination)
  ad-source.ts     Provider interface (Meta today, Google later) — ADR-0002
  scoring.ts       Bridge: real daily Meta rows -> engine inputs
  cockpit/analyze.ts   Integration seam: runs all engines over an account -> CockpitView
  rules/           DETERMINISTIC decision engines (the "brain", buyer-judgment rules J1-J10):
                     spend-floor(J1) comparator(J2) causality(J3/J4) trust-gates(J6)
                     change-log(J8) verdict(J10) account waste diversity fatigue metrics
                     production will-break registry
  scoring/         fatigue, fatigue-forecast, marginal, opportunity, winner, data-quality,
                   decision (objective-aware), rubrics (why-explanations)
  metrics/funnel-metrics.ts   Thumb-stop/hold/LP/ATC/checkout ratios
  creative/        fingerprint.ts (deterministic format), diversity.ts (format + white-space)
  agents/creative/ Gemini creative decoder: agents.ts (small single-attribute agents) +
                   orchestrator.ts (fan-out over one shared image fetch)  [stage 7]
  competitors/     data.ts, analytics.ts, types.ts (competitor pipeline stages 4-9)
  gemini.ts        Gemini REST primitive (callGemini JSON, callGeminiText prose)
  anthropic.ts     Claude client (health check only)
  scrapecreators.ts  Competitor ad pull + normalize (stages 2-3)
  supabase/        server.ts (SSR client), admin.ts (service-role), client.ts (browser)
  oauth-store.ts crypto.ts   Encrypt + store Meta tokens (AES via TOKEN_ENC_KEY)
  audit/           decision-triples.ts, record.ts (RLEF labeled-triples logging)
  confidence.ts data-quality.ts validator.ts   Honesty/confidence gates
  cache.ts queue.ts   Seams for future Redis/queue (ADR-0004)
  sample/account.ts   SAMPLE data (dev preview only; never shown to real users)

components/
  app/          Shell + controls (sidebar, topbar, switchers, tabs, settings-panel) and
                per-section UIs (creative/, media/, market/)
  cockpit/      Cockpit widgets (ActionList, Leaderboard, HealthRing, FunnelCard,
                FatigueRadar, WhyDrawer, KpiCard, AdLink, CollapsibleRows)
  marketing/    Public landing components
  auth-form.tsx google-button.tsx

scripts/        34 runnable self-checks (node:assert, no framework) — the correctness gate
proxy.ts        Next-16 middleware: refreshes Supabase session + gates /app
next.config.ts  Security headers + CSP (report-only)
```

---

## 7. Request/data lifecycle (how a page load actually works)

```
Browser → Vercel Edge → proxy.ts (middleware)
                          └─ getClaims(): verify JWT LOCALLY (ES256, no network) + refresh if near expiry
                          └─ /app/* and not authed → redirect /login
        → Next.js server component (e.g. app/app/page.tsx)
            └─ loadCockpit(days)  [lib/app/cockpit-data.ts]
                 ├─ getCurrentUser() = getClaims() (React-cached)  [local verify]
                 ├─ resolveCockpitScope(cookies): window / campaign / objective / weights
                 └─ fetchLiveCockpit(userId, ...)  [lib/meta-sync.ts]
                      ├─ getActiveAccountExternalId(userId)  [1 light DB read, for cache key]
                      ├─ L1 in-process Map  → if fresh (<5m), return
                      ├─ L2 cockpit_cache (Supabase) → fresh: return; stale (<24h): return + refresh in background
                      └─ COLD pull: fetchLiveCockpitUncached()
                           ├─ read ad_accounts + decrypt token (oauth_tokens, AES)
                           ├─ resolveCampaignIds (objective→campaigns, all statuses, paginated)
                           ├─ Meta API (concurrent): scope insights, top-spending ads,
                           │     per-ad daily insights (level=ad, time_increment=1),
                           │     ad meta (status/campaign/adset names), creatives
                           ├─ analyzeAccount(inputs, "LIVE", weights)  → runs ALL engines
                           └─ write L1 + (background) L2 cache
        → render server components → stream HTML to browser
```

**Key point:** the heavy Meta pull happens once per (account, window, filter, weights) key and is
cached. Navigating between cockpit/creative/media/market reuses the same cached view. Ask AdBrain
reuses the same cache key so it never triggers a separate pull.

---

## 8. The "AI" layer vs the deterministic engines (important)

Most of AdBrain is **NOT AI** — it's deterministic rule engines, which is why the numbers are
trustworthy and reproducible. There are exactly **two** places that call an LLM:

### Deterministic engines (no AI) — the "brain" (`lib/rules/` + `lib/scoring/`)
Buyer-judgment rules J1–J10, each a pure function with a runnable self-check:
- **J1 spend-floor** — ignore ads below a spend floor before scoring anything.
- **J2 comparator** — only compare ads within the same campaign objective.
- **J3/J4 causality** — rule out non-creative causes (measurement, CPM, audience, LP, stock,
  tracking) before blaming the creative.
- **J6 trust-gates** — "not worthy until" thresholds (enough purchases + days + stability).
- **J8 change-log** — attribute drops to human changes before creative fatigue.
- **J10 verdict** — final winner / refresh / do_not_kill_yet / loser (the CreativeScore, §9).
- Plus: fatigue, fatigue-forecast (7/14-day), marginal scaling, opportunity loss, winner ranking,
  waste, diversity, data-quality, objective-aware decision engine.

### AI (Google Gemini `gemini-3.6-flash`, free tier) — two features only
1. **Creative decoder** (`lib/agents/creative/` + `/api/creative/analyze` and `/api/competitors/analyze`):
   small single-purpose "agents" (hook, message, offer, persona, emotion, format, funnel-stage…)
   each with its own narrow JSON schema; the orchestrator fetches a creative's still image once and
   fans the agents out over it. Used for competitor creative intelligence and (partially) own-ad
   semantic diversity. Thinking is disabled (`thinkingBudget: 0`) for speed/cost.
2. **Ask AdBrain** (`/api/ask` + `lib/gemini.ts callGeminiText`): folds a no-fabrication system
   prompt + a compact snapshot of the user's real cockpit data + the question into one Gemini call;
   answers in prose, grounded only in the data. Rolling 24h per-user cap (50) via `ask_log`.

`@anthropic-ai/sdk` (Claude) is still installed but only powers `/api/health/claude`.

---

## 9. Formulas & KPIs (exact)

### CreativeScore (the core verdict number, `lib/rules/verdict.ts`)
```
CreativeScore = 0.30·performance + 0.30·trend + 0.20·(100 − fatigue) + 0.20·funnel
```
(each input 0–100; weights are per-account editable in Settings, must sum to 1.)

**Verdict cut points:** winner requires CreativeScore ≥ **70**; loser requires ≤ **40**; funnel is
"healthy" at ≥ **60**; fatigue is "high" at ≥ **60**.

**Trust gates (`lib/rules/trust-gates.ts`):** a WINNER also needs ≥ **100 purchases** and ≥ **3
days**; a per-ad score needs ≥ **₹4,000 / $50** spend and ≥ **3 days**. ("8x ROAS on 2 purchases" is
blocked as a coin-toss.)

### Funnel ratios (`lib/metrics/funnel-metrics.ts`) — all %, `null` if denominator is 0
```
CTR           = clicks / impressions
thumb-stop    = video_3s_views / impressions
hold rate     = video_thruplays / video_3s_views
LP view rate  = landing_page_views / outbound_clicks
ATC rate      = add_to_carts / landing_page_views
checkout rate = initiate_checkouts / add_to_carts
```

### Other engines (behaviour)
- **Account Health** — spend-weighted objective performance, minus a waste penalty; 0–100,
  labelled `MODEL_ESTIMATE` (never presented as ground truth).
- **Blended ROAS** = revenue / spend (null when spend = 0).
- **Concentration** = top-1 ad's share of spend.
- **Waste** — high-spend + below-break-even (ROAS < 1x) ads, with the exact ₹ and math per ad.
- **Opportunity loss** = wasted spend + spend on ads flagged fatiguing/fatigued.
- **Fatigue** — day-wise ROAS slope + exposure; **forecast** projects P(fatigued) at +7 / +14 days.
- **Marginal scaling** — spend elasticity + marginal-ROAS on the next increment (fit R²).
- **Data-quality / confidence** — de-rates confidence when the daily series is too volatile
  (e.g. "confidence de-rated 20%, spend swung 3.2x day-over-day").

### KPI catalog
`lib/app/kpi-catalog.ts` holds **162** named KPIs (Media page KPI selector).

### Windows & limits
- Date windows: **[7, 14, 30, 60, 90]** days; default **14**. Custom ranges supported.
- **MAX_ADS = 100** analyzed per pull (top spenders). Default lookback 30d internally.
- Cache: **FRESH = 5 min**, **STALE = 24 h**, schema version **v4**.

---

## 10. Database schema (Supabase Postgres — live)

RLS is **on for every table**. Protected tables have **no client policies** (deny-by-default);
they're read/written only by the **service-role admin client** server-side. This is intentional, not
a gap.

**Active tables:**
| Table | Purpose | Key cols |
|---|---|---|
| `ad_accounts` | Connected Meta accounts | user_id, platform, external_id, name, status |
| `oauth_tokens` | Encrypted Meta tokens | ad_account_id, encrypted_access/refresh, expires_at |
| `cockpit_cache` | 2-level cache L2 (computed views) | (user_id, cache_key) PK, data jsonb |
| `competitor_ads` | Pulled competitor + own-brand ads | (user_id, page_id, ad_archive_id) PK |
| `competitor_brands` | Tracked brands per account | user_id, page_id, account_external_id |
| `competitor_creative_analysis` | Gemini decode of competitor creatives | funnel_stage, hook, hook_type, primary_emotion, offer, attributes |
| `own_creative_fingerprints` | Own-ad creative fingerprints (content-hash keyed) | content_hash, attributes jsonb |
| `decision_triples` | RLEF audit: situation→recommendation→judgment | ad_id, time_window, rule_id, judgment (471 rows) |
| `demo_requests` | Public book-demo leads | email, brand, spend_bucket, notes |
| `ask_log` | Ask usage (rolling-24h cap) | user_id, created_at |

**Legacy/unused (0 rows, from an earlier schema iteration):** `brands`, `competitors`, `triples`,
`test_plans`, `test_plan_items`. Safe to drop after confirming nothing references them.

---

## 11. API routes (all)

| Route | Method | Auth | What it does |
|---|---|---|---|
| `/api/ask` | POST | user | Gemini answer grounded in the user's real cockpit data; 24h cap |
| `/api/meta/accounts` | GET | user | List the user's Meta ad accounts (account switcher) |
| `/api/meta/campaigns` | GET | user | List campaigns (campaign switcher) |
| `/api/connect/meta/authorize` | GET | via /app | Start Meta OAuth (sets CSRF state cookie) |
| `/api/connect/meta/callback` | GET | — | OAuth callback: exchange code, store encrypted token |
| `/api/connect/meta/select-account` | GET | user | Pick active account, bust cache, warm new one |
| `/api/competitors/run` | POST | user | ScrapeCreators pull of brand + competitor ads (bounded concurrency) |
| `/api/competitors/analyze` | POST | user | Gemini decode of competitor creatives (300/day cap, reuse cache) |
| `/api/competitors/search` | GET | user | Search Meta brand pages to add competitors |
| `/api/creative/analyze` | POST | user | Own-ad creative decode (Gemini agents, stage 7) |
| `/api/audit/judgment` | POST | user | Record operator approve/dismiss on a recommendation |
| `/api/leads` | POST | public | Book-demo lead capture (validated, honeypot) |
| `/api/cron/sync` | GET | CRON_SECRET | Daily background pre-warm of connected accounts' cockpit cache |
| `/api/health/claude` | GET | user | Claude connectivity probe |
| `/api/debug/creatives` | GET | user | Dev diagnostics |

---

## 12. Caching (two levels)

- **L1** — in-process `Map` (per serverless instance). Fresh < 5 min.
- **L2** — `cockpit_cache` table (shared across instances). Fresh < 5 min → serve; stale < 24 h →
  serve instantly + refresh in the background (`after()`); older/cold → block on a live Meta pull.
- **Cache key** = `v4 : activeAccount : lookbackDays : windowRange : campaignId : objectives :
  weights`. A non-default verdict-weight override changes the key; the default does not (so most
  users share the same entries).
- On the cold path the L2 write is deferred (`after()`) so the user isn't blocked by cache
  bookkeeping.

---

## 13. Security

- **Token encryption:** Meta OAuth tokens are AES-encrypted (`TOKEN_ENC_KEY`) before storage in
  `oauth_tokens`; decrypted only server-side.
- **RLS:** every table has RLS on; protected tables are deny-by-default and only reachable via the
  service-role admin client (server-only, `import "server-only"` tripwire on `admin.ts`).
- **Auth:** Supabase Auth (email/password + Google). `proxy.ts` refreshes the session; pages verify
  via `getClaims()` (local ES256 verification, no network round-trip).
- **RLS init-plan** optimized: policies use `(select auth.uid())` (evaluated once per query).
- **Headers** (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS, and a **Content-Security-Policy in report-only mode**
  (validating before enforcing).

---

## 14. Background jobs

- **`/api/cron/sync`** — a Vercel Cron (`vercel.json`, daily `0 3 * * *`) pre-warms each connected
  account's default cockpit into `cockpit_cache`, so the first load of the day is instant instead of
  a cold Meta pull. Guarded by `CRON_SECRET`; inert (503) until that env var is set.

---

## 15. Build, CI & the correctness gate

- **Build:** `npm run build` (Next 16 + Turbopack).
- **Checks:** `npm run check:all` runs **34** deterministic self-checks in `scripts/` (each a
  `node:assert` script, no test framework) covering every engine: verdict, fatigue, marginal,
  opportunity, revenue, winner, causality, trust-gates, funnel-metrics, diversity, data-quality,
  cockpit integration, etc. **This is the source-of-truth gate** for engine correctness.
- **CI:** `.github/workflows/ci.yml` runs build + `check:all` on every push, with a concurrency
  group and `.next/cache` caching.

---

## 16. Current status — what's live, what's pending, known issues

**Live & verified working (with the real Kimirica account, in-browser):**
- Cockpit (health, funnel, ranked plan with per-verdict reasons, fatigue forecasts, budget waste +
  the math per ad, opportunity loss), Actions, Creative → Fatigue, Creative → Diversity (portfolio
  spread), Media, Market (competitor intelligence), Settings (+ working verdict weights),
  Ask AdBrain (Gemini, free), book-demo lead capture (lands in `demo_requests`), Google/email auth.

**Gated ("coming soon") — need the creative decoder or another data source:**
- Creative → **Brand Brain** (winning hooks/angles/personas) — needs the Gemini decoder wired in.
- Creative → **Concepts** (creatives to test) — same.
- Creative → **Diversity semantic layer** (hook/angle/persona distinctness) — same. (The
  deterministic **format** layer currently shows "Unknown" for all ads — the own-ad creative-asset
  fetch/fingerprint isn't populating in production yet.)
- Market → **Voice** (competitor messaging analysis).
- Cockpit → **Store economics (MER & nCAC)** — gated on a **Shopify** connection (not built yet).

**Known issues / to-do:**
- **Cold-pull 504:** on Hobby's tight function timeout, a fully cold cockpit pull (~9s+) can return
  `504 GATEWAY_TIMEOUT`. Mitigation: keep the cache warm via the cron (set `CRON_SECRET`) and/or move
  to a background-sync tier; stale-while-revalidate already makes returning loads instant.
- **`CRON_SECRET` not set** in Vercel → background sync is inert.
- Legacy tables (`brands`/`competitors`/`triples`/`test_plans`/`test_plan_items`) are unused.

---

## 17. How to take this offline / re-host

1. **Code:** the whole repo (this file included). `git clone` or download a zip of the branch.
2. **Env:** recreate the 13 env vars from §4 (get fresh keys for Supabase, Meta, Gemini,
   ScrapeCreators; generate a new `TOKEN_ENC_KEY`; the Supabase URL/keys come from a Supabase
   project).
3. **Database:** the schema in §10 lives in Supabase project `gizgdgyxyqpvtgecrmik`. To move it, use
   Supabase's schema dump (or recreate tables from the migrations the app applied). Row data
   (accounts, tokens, cache, competitor ads) is per-user and can be left behind or exported.
4. **Run locally:** `npm install` → `npm run dev` (needs the env vars set to actually pull data).
5. **Deploy:** any Vercel project pointed at the repo, with the env vars set; or `next build && next
   start` on any Node host.

> Data flow summary: **Meta Graph API → meta-sync (pull + cache) → deterministic engines (analyze)
> → cockpit view → React server components → browser.** Gemini is a side-branch for creative
> decoding and Ask. Supabase holds auth, encrypted tokens, the computed-view cache, competitor data,
> and audit logs. Nothing is fabricated; missing data becomes an honest empty state.
