# AdScale — Master Architecture & Product Audit (discovery pass)

**Date:** 2026-09-03 · **Author:** Principal-architect review (session 25) · **Status:** DISCOVERY ONLY — no code changed in this pass.
**Scope:** the whole product (`adbrain-mvp`, branded AdScale), live at `adscaledigital.co`, branch `validation-v0-v1`.

> This report supersedes the framing of `docs/PHASE-0-AUDIT-2026-09-02.md` and extends it with product-leverage and workflow analysis. Where this pass measured something live, it says so; where a number needs a tool I did not run (Lighthouse, a profiler), it is marked **NOT MEASURED** rather than guessed.

---

## 0. The single most important context (read first)

The product has **1 user (the founder), 5 connected ad accounts, 14,588 `ad_metrics` rows.** It is a **private-beta, pre-launch** app. Yet the codebase is large (523 TS/TSX files, ~46.6k LOC, 57 API routes, 275 lib modules, 168 check scripts, 46 migrations) and 15+ Claude sessions are committing in parallel (154 commits today alone).

**This dominates every recommendation below.** The leverage is NOT "scale to 10k users" (that plan exists in `docs/` and is premature) and NOT micro-cleanups. The leverage is: **(a) get the ONE core loop trustworthy and instant, (b) reach launch-readiness, (c) reduce the coordination/complexity tax that 15 parallel agents are adding faster than any one can pay it down.** The biggest architectural risk here is not a bad pattern — it is **entropy from parallel authorship**: duplicated helpers, drifting docs, transient broken files, and a 165-command test chain no single person can reason about.

---

## 1. Product understanding

**What it is:** a Meta (and nascent Google) ads decision co-pilot for D2C brands/agencies. A user connects a Meta ad account; AdScale reads the real ad data and says, in plain English, **what to scale, refresh, or kill, and why** — plus a competitor read, a creative studio, a funnel diagnosis, change-impact attribution, and an influencer-hunt module.

**Core promise:** turn raw ad metrics into a *trustworthy decision*, with an explicit trust check ("is there enough spend to judge this?") so the user never acts on a lucky day. It **recommends, never acts** on the account (a deliberate, repeated product rule).

**Business model:** self-serve SaaS, token-metered Free/$99/$399/$999 (pricing page live; metering + Stripe are later). Private-beta access gate (WAITLIST→APPROVED).

**Stack:** Next.js 16 (App Router, RSC-first, Turbopack) · React 19 · Supabase (Postgres 17 + Auth + Storage) · Vercel (Hobby) · Gemini (text/vision) + OpenAI (images) · 13 runtime deps, no state library, no ORM, no test framework.

---

## 2. System architecture map

```
USER (signed-in, private beta)
  ↓  Next.js middleware (proxy.ts) — auth + access gate
UI  (RSC pages under app/app/*, ~72 "use client" islands)
  ↓  server components call lib/* directly (no API hop for reads)
CLIENT STATE  (cookies: adbrain.{platform,objectives,campaign,events,window,catalog}; sessionStorage TTL caches; minimal React state)
  ↓
API  (57 route.ts; mutations + on-demand jobs; product-gated via guardProductApi/withProductApi)
  ↓
BUSINESS LOGIC  (lib/* — scoring, cockpit assembly, rollups, intelligence contracts, creative-production)
  ↓
DATA  Supabase Postgres (service-role admin client does the real work; RLS default-deny) · Meta Graph API · Gemini/OpenAI
  ↓
RESPONSE → UI (server-rendered; L1 in-proc LRU + L2 cockpit_cache; unstable_cache data cache; rollups)
  ↓
OBSERVABILITY  captureError() → console/Sentry-seam · notifications table · /api/health (admin) · owner_events/audit_log
```

**Canonical read chain (the cockpit, the heart of the app):**
`loadCockpit(days)` → `resolveCockpitScope(cookies)` → `fetchLiveCockpit` (L1 LRU + L2 `cockpit_cache`, SWR 24h, `CACHE_SCHEMA` v7, 8s cold-pull cap) → `buildCockpitFromStore` → `toCockpitInputs` → `analyzeAccount` (the deterministic scoring engine, golden-guarded).

**Ingestion chain:** `/api/cron/sync` (03:00 daily, self-chaining hops) and on-demand `/api/ingest/run` → `syncAdMetrics` + `syncChangeHistory` → `ad_metrics` / `ad_meta` / `ad_changes`; on completion → `refreshAccountRollup` + `refreshCreativeRollup` + `verifyAndLog` (store-vs-Meta).

**Source of truth:** the **store** (`ad_metrics`/`ad_meta`) is the app's source of truth; Meta is re-pulled nightly and reconciled. Business rules live in `lib/scoring/*` (deterministic) + `lib/intelligence/*` (the §110 Output Contract). Tenancy is **app-level** (`.eq("user_id", …)`), not database RLS.

---

## 3. Feature map (with leverage class)

| Feature | Where | Class |
|---|---|---|
| **Account Cockpit** (health, verdicts, KPIs, funnel, fatigue, culprit, leaderboard) | `app/app/page.tsx` + `components/cockpit/*` + `lib/cockpit/*` + `lib/scoring/*` | **CORE VALUE** |
| Funnel diagnosis (TOF/MOF/BOF, weakest step) | `app/app/funnel` + `lib/funnel/*` | CORE |
| Change-Impact (media-buyer change → before/after) | `app/app/changes` + `lib/scoring/change-*` | CORE |
| Reconcile-with-Meta + **TrustLine** (self-proving accuracy) | `app/app/reconcile` + `lib/reconcile/*` + `lib/rollups/*` | CORE (trust) |
| Creative Studio (Shopify→concepts→AI static ads) | `components/app/creative-production/studio.tsx` (1001 LOC) + `lib/creative-production/*` | CORE (differentiator) |
| Creative analysis / Deep read (vision decode) | `lib/creative/*` | SUPPORTING |
| Competitor / Market intelligence | `app/app/market` + `lib/competitor*` | SUPPORTING (data source constrained) |
| Influencer Hunt | `components/app/creators/*` + `lib/influencer/*` | SUPPORTING |
| Growth/Scout (discover→draft) | `lib/growth/*` + `/blog` | SUPPORTING |
| Daily decision brief / Today card / digest | `lib/intelligence/*` | SUPPORTING (proactive) |
| Instant-app rollups + self-proving verify | `lib/rollups/*` | TECHNICAL NECESSITY → becoming CORE (trust + speed) |
| Notification Center | `lib/notifications/*` | SUPPORTING |
| Google Ads track | `lib/google/*` | LEGACY-ish (demo mode; real API unwired) |
| Marketing site (home/pricing/blog/legal) | `app/page.tsx`, `app/pricing`, `components/marketing/*` | CORE (acquisition) |

---

## 4. User workflow map (primary loop)

**Persona:** D2C performance marketer / agency operator (India, INR), time-poor, lives in Ads Manager today.

**Primary job-to-be-done:** *"Tell me what to change in my ad account this week, and let me trust it."*

```
ENTRY (login) → CONNECT META (2 clicks) → [SYNC: silent wait] → COCKPIT
  → sees health + ranked verdicts (scale/refresh/kill + reason)
  → drills: funnel / change-impact / reconcile / creative
  → DECISION (which ad to act on) → ACTS IN META (outside AdScale)
  → returns weekly to re-check
POST-COMPLETION VALUE: fewer wasted spend, faster decisions, a defensible reason per call
```

**Where the user waits:** the **cold cockpit/first sync** (the "still syncing" gap — onboarding lane is fixing it; rollups now make repeat reads instant). **Where the user makes unnecessary decisions:** choosing platform/objective/event/campaign/window filters manually every visit. **Where the system makes the user do its work:** the user must *return and re-check* — the product is largely **reactive**, not proactive (the daily brief + notifications are the early fix).

---

## 5. Data flow map

- **Ingestion (write):** Meta Graph → `syncAdMetrics` → upsert `ad_metrics(user,account,ad,date)` + `ad_meta`; `syncChangeHistory` → `ad_changes`. Resumable, self-chaining, bounded per hop.
- **Read (fast path):** page → rollup row (`account_rollups`/`creative_rollups`) **or** `cockpit_cache` L2 **or** `unstable_cache` (changes/funnel) — else a live store scan via `readAllPages` (parallel-burst).
- **Self-proving:** on sync-complete → `verifyAndLog` diffs rollup vs a fresh Meta pull → `account_verifications` (trend) → notification on conflict → TrustLine.
- **Derivation:** store rows → `analyzeAccount` (pure, deterministic, golden-guarded) → verdicts/health. **No AI in the decision path** (AI is used for creative gen + vision decode + chat, gated by budget/kill-switch).

**Transform hot-spots:** `ad_metrics` is scanned per window on cold reads (mitigated by rollups); `kpi-catalog.ts` (2,442 LOC) is a large data blob.

---

## 6. Dependency map (health: strong)

13 runtime deps: `next`, `react`, `react-dom`, `@supabase/{ssr,supabase-js}`, 4 Radix primitives, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`. **No overlapping libraries, no HTTP client, no ORM, no state lib, no template engine.** This is genuinely lean and a real strength — keep it.
**Action:** run `npm audit --omit=dev --audit-level=high` + `osv-scanner` (advisory status **NOT MEASURED** this pass). No removals recommended.

---

## 7. Architecture problems (ranked)

1. **Parallel-authorship entropy (highest real risk).** 15+ agents, 154 commits/day, a shared working tree. Symptoms observed *this session*: duplicated helpers (`metricFor`, `readCookie` ×7, switcher pairs), an automated a11y fixer that corrupted `<thead>` across 9 files, repeated ungated-route regressions (`intelligence/today`, `intelligence/grade`, `onboarding/status`), docs drift. **Root cause:** no serialization of structural change; the WIP ledger is advisory. **Better:** a small "structural change" lock for shared files (cockpit page, meta-source, package.json, migrations), and the CI gate (below) as the true arbiter. **Migration path:** enforce `check:all` + `tsc` + `build` in CI on push; forbid direct commits that fail them.
2. **No test runner; 165-command serial `check:all`.** 168 assert-scripts is *good discipline*, but the chain is unrunnable-by-humans and slow. **Better:** `node --test` (Node's built-in) over the same assert files → one parallel command; keep the invariants, lose the chain.
3. **`cockpit` assembly is a large, central, high-coupling path.** `analyze.ts` (443) + `from-store.ts` (475) + `meta-sync.ts` (750) + `meta-source.ts` (1,146) form the money path; it is golden-guarded (good) but concentrated and edited by many. **Better:** the split proposed in the prior audit (`meta/{transport,accounts,insights,entities,…}`, `cockpit/{types,assemble}`) — **HIGH risk, golden-guarded, do last and alone.**
4. **`studio.tsx` (1,001 LOC) god-component.** One client file owns search/generate/QA/export/brand-panel. **Better:** split into step components + a reducer; move policy-lint/char-limits server-side into `runQA`.
5. **`kpi-catalog.ts` (2,442 LOC) data-as-code in a client path** (partly fixed this session by moving the derived list server-side). **Better:** treat as server data; ship only what a client needs.
6. **Tenancy is app-level, not RLS.** 53 of 61 tables are RLS-enabled with **zero policies** (default-deny) and all real work goes through the service-role admin client with `.eq("user_id")`. This is a **deliberate, coherent** model — but it means a single missing `.eq("user_id")` is a cross-tenant leak (one was found + fixed in `onboarding/status` this session). **Better (keep the model, add the guard):** a store-layer lint that every `createAdminClient().from(<tenant table>)` read is user-scoped; `check:tenancy` exists — broaden it.

---

## 8. Code bloat (evidence-based, from this session)

| Class | Item | Action |
|---|---|---|
| Dead (safe) | `ads-manager-url.check.ts` (deleted), 5 starter SVGs (deleted), `public/cockpit-v1.html` (deleted, was **publicly served**), `_inbox.zip` 3.7MB (gitignored) | DONE |
| Staged-not-wired | 28 `lib/` modules unreachable from the app, **each with a passing test**; several are staged foundations (creative engines, account-deletion, control-plane security, durable queue) | **KEEP / per-module decision** — not dead |
| v1 rules engine | `lib/rules/*` + root `lib/{decision,validator,confidence}.ts` — Aug-25 originals superseded by `lib/scoring/*`, but entangled with `check:all` | INVESTIGATE → archive out of build |
| Dup logic | `readCookie` ×7, switcher pairs 67–82% identical, `metricFor` (deduped this session) | MERGE |
| Data-in-bundle | `kpi-catalog.ts` 70KB | MOVE server-side (partly done) |
| Docs | 160+ files, multiple audits, 4 architecture docs | CONSOLIDATE |

**Honest sizing:** low-risk removable ≈ 2–3% of LOC. The codebase is *tidy by dead-code standards*; the real waste is duplication + the check-chain + docs + staged-but-unwired subsystems — **not raw volume.**

---

## 9. Security problems (with live verification this session)

**Fixed + verified live this session:**
- **CRITICAL (fixed):** 3 `cp_*` SECURITY DEFINER RPCs were `anon`-executable with a caller-supplied `p_user` → cross-tenant read of any tenant's product/opportunity data over the public REST API. Migration `0033` (revoke from `PUBLIC`, re-grant `service_role`) — verified `anon=false, service=true`.
- **HIGH (fixed):** open-redirect on `/auth/callback`; AI budget + kill-switch enforced at the `callGemini` primitive; SSRF guards on the two user-URL fetchers; 6 ungated product routes gated; avatar proxy auth+rate-limit+size cap; `/api/health` detail admin-gated.
- **MED (fixed):** function `search_path` pinned; 7 unindexed FKs covered (`0034`).

**Open / for the owner:**
- **MED:** Supabase **leaked-password protection** disabled — a dashboard toggle only Rahul can flip. (Auth → Providers → Email.)
- **LOW/INFO:** 2 `auth_rls_initplan` perf warnings (`profiles`, `token_usage` policies re-evaluate `auth.*` per row); `handle_new_user` shows as `anon`-executable but is a trigger — **proven not `/rpc`-callable** (false positive).
- **PROCESS (real):** ungated-route regressions recur (fixed `intelligence/today` + a peer fixed `intelligence/grade` this session). `check:access-gate` catches them — **must be CI-blocking.**

Tenancy model is coherent (default-deny + service-role) but one-mistake-fragile; see §7.6.

---

## 10. Performance problems (measured live this session)

| Surface | Before | After (shipped) | Lever |
|---|---|---|---|
| `/app/changes` | 16.5s cold · 11.1s warm | **1.6s** repeat | data-cache (`unstable_cache`), ingest-busted tag |
| `/app/funnel` | 8.58 MB · 11.9s | **1.25 MB · 3.0s** | client render + 20-card preview + data-cache |
| `/app` client JS | 757 KB / 14 chunks | **706 KB / 13** | KPI catalog off the client bundle |
| `/app/reconcile` (uncached read) | 8.7 / 5.7s | **~3.6–4.1s** | parallel-burst store paging + rollup fast-path |
| Store reads | serial paging (1 round-trip/1k rows) | **parallel bursts of 8** | `readAllPages` |
| Cockpit repeat load | cold Meta pull | **rollup / cockpit_cache** | instant-app rollups |

**NOT MEASURED (needs Lighthouse/RUM):** LCP, INP, CLS, hydration cost, TTFB distribution. **Recommend:** add `web-vitals` RUM (a real endpoint) before claiming Core-Web-Vitals wins. **Remaining bottleneck:** the cold cockpit first-paint on a never-synced account (rollups fix repeat, not the very first pull) — the true fix is streaming/`<Suspense>` on `app/app/page.tsx` (golden, do carefully).

---

## 11. UX problems

- **Reactive, not proactive:** the user must return and re-check. (Daily brief + notifications + TrustLine are the early fix; the cockpit itself should open with "here are the 3 things to do today," which the Today card begins.)
- **Silent first-sync gap** ("still syncing" with no progress) — onboarding lane shipping a progress island.
- **Filter fatigue:** platform/objective/event/campaign/window are manual, per visit, and remembered only in cookies — the system could infer sensible defaults.
- **Trust is under-surfaced:** the product's core differentiator (spend-gated, reason-backed, Meta-reconciled) was mostly invisible until the TrustLine/verify work this session; it should be a first-class, everywhere signal.
- **Consistency debt:** two FAQ patterns, `--good-ink`/`--warn-ink` contrast, dropdown roles/focus — design-system lane is addressing.

---

## 12. Workflow problems (the product-strategy view)

The core loop **works but does not compound yet.** The user acts *in Meta*, so AdScale never sees the outcome of its own advice unless the next sync happens to reflect it — and it does not *close the loop* on "was my recommendation right?" (the learning-loop/#2 and outcome work is the fix, in flight). The product knows a great deal (every ad, every change, every buyer, historical results) and **under-uses it**: recommendations are computed fresh each visit rather than personalized by what this account/user did before.

---

## 13. Existing-feature opportunities (leverage, not new features)

1. **Cockpit → "Today" first:** open with the ranked 3 actions, not a dashboard to interpret. (Today card exists; make it the hero.)
2. **TrustLine everywhere:** the reconcile-verified trust badge belongs on the cockpit headline, not just the reconcile page.
3. **Creative rollup → Studio:** the winner/wasting flags (built this session) should seed Studio's "make more like the winners" directly.
4. **Change-Impact → proactive alert:** a change that made things worse should *notify*, not wait to be browsed.
5. **Reconcile drift → automatic:** now automatic post-sync (built this session) — surface the streak ("verified 12 days running") as a trust asset.
6. **Filters → smart defaults:** infer the objective/event the account actually optimizes for.
7. **Funnel weakest-step → Studio brief:** a diagnosed leak should one-click become a creative test brief.
8. **Notification Center → digest email:** the daily brief exists; the email send is the last mile (gated on a provider).

---

## 14. Top 10 "10X" workflow opportunities

> Framed as **existing-workflow** improvements, ranked by leverage for a *pre-launch trust product*. Effort/confidence are H/M/L.

| # | Existing workflow | Current friction | Proposed 10X change | Why 10X | 1st order | 2nd order | 3rd order | 4th order | Effort | Conf |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Cold first-insight** (connect→value) | silent multi-min sync; user may bounce | rollup/cache-backed instant first headline + guided progress; stream cockpit | activation is the #1 pre-launch metric | value seen in seconds | more users finish onboarding | more connected accounts / data | better recommendations → retention | M | H |
| 2 | **Interpreting the cockpit** | user must read a dashboard | lead with "today: 3 actions" (Today card as hero) | turns analysis into decision | faster decision | more actions taken | AdScale sees outcomes | learning loop compounds | M | H |
| 3 | **Trusting the numbers** | "does this match Meta?" doubt | TrustLine + automatic verify + streak, everywhere | trust is the product | fewer abandonments | more reliance | word-of-mouth (agencies) | lower CAC | L | H |
| 4 | **Deciding which creative to make** | manual, disconnected from performance | winner/wasting flags → Studio "make more like winners" | closes insight→action | less blank-page effort | more creatives made | more test data | better creative intelligence | M | M |
| 5 | **Reacting to a bad change** | user must browse Change-Impact | proactive notification on a harmful change | timing beats reporting | faster reversal | less wasted spend | measurable saved-$ story | retention + pricing power | M | H |
| 6 | **Was the advice right?** (closed loop) | never measured | outcome grader (in flight) → per-account hit-rate | product gets smarter | credibility | personalization | defensible moat | data flywheel | M | M |
| 7 | **Weekly re-check** (reactive) | user must return | digest email with the 3 things | proactive re-engagement | more sessions | more actions | more data | retention | L | H |
| 8 | **Filter every visit** | manual scope selection | inferred defaults from the account's real objectives | less cognitive load | faster to value | fewer mis-scoped reads | cleaner data | fewer support questions | L | M |
| 9 | **Multi-account (agency)** | one login, many clients | account switcher → cross-account "what needs attention" roll-up | agency is the wedge | one-glance triage | agency stickiness | seat expansion | revenue/account | M | M |
| 10 | **Onboarding trust** | claims on marketing site | replace unverifiable claims (done: SOC2/testimonials removed) with the live TrustLine as proof | honesty as marketing | credibility | conversion | brand | durable trust | L | H |

---

## 15–17. Second / third / fourth-order opportunities (the compounding chain)

**The flywheel this product should build:**
```
Instant, trustworthy first insight (1)  →  more activations
  → more connected accounts → more ad-data in the store
    → better, personalized recommendations (6)
      → user acts more, and AdScale SEES the outcome (2,5,6)
        → closed-loop learning → per-account hit-rate rises
          → trust compounds (3) → agencies refer (9) → CAC falls
            → revenue funds paid AI tiers → richer creative intelligence (4)
```
Every item in §14 is chosen because it *feeds the next*. The product is **not compounding today** (advice is stateless, outcomes unseen). Items 1→2→6→3 are the minimum chain to make it compound; they are largely **in flight** across the lanes.

---

## 18. Product-intelligence opportunities

What the product **already knows** but under-uses: every ad's full history, every media-buyer change + who made it, competitor ads, creative DNA (scene/mood/format), prior verdicts, and now store-vs-Meta trust trends. What it **should do with it:** personalize the ranking by this account's own history; grade its own past advice (#6); rank media buyers by measured impact (built: `change-ranking`); pre-fill Studio from winners; and set filter defaults from observed optimization events. **No new data collection is required** — the intelligence is latent in tables that already exist.

---

## 19. Target architecture (evolve, do NOT rewrite)

Keep: Next.js App Router + RSC-first · Supabase (default-deny + service-role) · Vercel · the deterministic scoring engine + §110 Output Contract · the lean 13-dep tree · fingerprint-once + rollups + L1/L2 cache. Add, without rewrite:
1. **One auth authority** (`withProductApi`/`withAdminApi`/`withCronSecret` — largely done) with the access-gate **CI-blocking.**
2. **A store-layer boundary** (`lib/**/store.ts` owns all `createAdminClient().from(...)`; tenancy-scoped by lint).
3. **The cockpit assembler split** (`cockpit/{types,assemble}` + thin `meta/*` fetchers) — the one HIGH-risk item, done last, alone, golden-guarded.
4. **`node --test`** replacing the 165-cmd chain (same invariants, one parallel command).
5. **Observability seam** (`captureError` → Sentry DSN; `web-vitals` RUM).
6. **The instant-app layer** (rollups + verify) as a first-class, documented subsystem (done this session; `D-rollups`/`D-verify`).

---

## 20. Target folder structure (directional, not a move-everything mandate)

```
app/            routes only (pages + route handlers) — thin
  (marketing)/  home, pricing, blog, legal
  app/          the product (cockpit, funnel, changes, reconcile, creative, market, creators)
  api/          mutations + jobs (each product route gated)
lib/
  scoring/      deterministic engine (golden-guarded)  ← source of business rules
  cockpit/      assemble + types (fed by meta/* + store)
  meta/         transport, accounts, insights, entities  ← split of meta-source
  rollups/      instant-app precompute + self-proving verify
  intelligence/ §110 contract + adapters + learning loop
  <domain>/store.ts   the ONLY place a domain touches the DB (service-role, user-scoped)
components/     presentational + small islands (domain-foldered)
scripts/        one node --test suite (invariants preserved)
supabase/migrations/  forward-only, applied + recorded
docs/           ONE architecture doc, ONE decisions log, ONE changelog
```

## 21. Target component structure

Server components render; client islands are small and leaf. Split the two god-components (`studio.tsx`, and any 400+ LOC dashboard) into step/section components + a reducer. A component should know its own view and nothing about data assembly (that lives in `lib/*/store.ts`). Trust/freshness are shared primitives (`DataFreshness`, `TrustLine`) reused across screens.

---

## 22. Phased roadmap

| Phase | Objective | Risk | Success metric | Rollback |
|---|---|---|---|---|
| 0 Discovery | this report | none | shared understanding | n/a |
| 1 Make gates authoritative | `check:all`+`tsc`+`build` CI-blocking on push; `node --test` | LOW | red never reaches `main` | revert CI config |
| 2 Security close-out | leaked-password toggle; broaden `check:tenancy`; keep access-gate green | LOW | advisors clean of actionable items | migrations are additive |
| 3 De-entropy | dedupe `readCookie`/switchers/`metricFor`; archive v1 rules; consolidate docs | LOW–MED | LOC ↓, one arch doc | git revert per change |
| 4 Instant first-insight (#1,#2) | stream cockpit + Today-card hero + rollup first paint | **MED–HIGH** (golden) | activation ↑, cold p95 ↓ | feature-flag the first paint |
| 5 Trust everywhere (#3,#5,#6) | TrustLine on cockpit; proactive change alerts; close the outcome loop | MED | verify-streak visible; hit-rate logged | additive surfaces |
| 6 DB/API tune | partial indexes; drop unused indexes; `<Suspense>`; parallelize serial reads | LOW–MED | p95 ↓, DB CPU ↓ | indexes are reversible |
| 7 Studio + creative loop (#4) | split `studio.tsx`; winners→Studio brief | MED | creatives-made ↑ | component-level revert |
| 8 Cockpit assembler split | `cockpit/{types,assemble}` + `meta/*` | **HIGH** | golden identical before/after | do alone, golden gate |
| 9 Proactive + agency (#7,#9) | digest email; cross-account triage | MED | re-engagement ↑ | provider-gated |

**Rule:** one phase, verified (gates + live check), documented, before the next. High-risk (4, 8) done alone with the golden invariants as the contract.

## 23. Risk matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Parallel-authorship regression | **High** | High | CI-blocking gates (Phase 1) — the single highest-ROI fix |
| Golden money-path change breaks scoring | Med | High | `check:golden`/`check:shadow-benchmark` as the contract; do §8 alone |
| Cross-tenant leak (app-level tenancy) | Med | Critical | store-layer scoping lint; access-gate CI |
| Deploy can't be driven (Vercel 403 for agents) | High | Med | owner Redeploy; document it; don't create disconnected deploys |
| Over-building the pre-launch app | **High** | Med | this report's #0: launch-readiness > infra scale |

## 24. Expected ROI

The highest-ROI move is **Phase 1 (CI-blocking gates)** — near-zero effort, kills the recurring regressions that 15 parallel agents keep reintroducing (ungated routes, broken files, red builds). After that, **Phase 4–5 (instant, trustworthy first insight + closed loop)** are the product-ROI multipliers: they are the difference between a dashboard and a co-pilot that compounds. Everything else is hygiene that protects those two.

## 25. Success metrics

- **Engineering:** red never reaches the branch (CI); `check:all` runs as one parallel `node --test`; zero ungated product routes; advisors clean.
- **Performance:** cockpit cold p95 < 5s, repeat < 1.5s; `/app` first-load JS trending down; RUM Core Web Vitals **measured** (currently not).
- **Product:** time-to-first-insight < 2 min; % of sessions that reach an action; verify-streak length; recommendation hit-rate (once the loop closes); weekly re-engagement.

---

## Final scorecard (0–100, current → target)

| Dimension | Current | Target | Note |
|---|---|---|---|
| Architecture | 72 | 88 | coherent + lean; entropy + 2 god-modules drag it |
| Code quality | 74 | 88 | tidy; duplication + check-chain |
| Maintainability | 66 | 88 | 165-cmd chain, no test runner, 15-agent churn |
| Security | 80 | 92 | critical leak closed live; app-level tenancy is one-mistake-fragile; leaked-pw toggle open |
| Performance | 74 | 88 | big wins shipped + measured; cold first paint + RUM remain |
| Scalability | 70 | 85 | fine for now; rollups/paging/pooler-ready; premature to chase 10k |
| UX | 68 | 86 | reactive→proactive is the gap |
| UI consistency | 70 | 88 | design-system lane in progress |
| Accessibility | 62 | 85 | contrast/roles/focus debt |
| Workflow efficiency | 64 | 90 | the 10X matrix (§14) |
| Product intelligence | 58 | 90 | latent data under-used; loop not closed |
| Observability | 66 | 85 | captureError seam + health; no RUM/Sentry DSN live |
| Testing | 60 | 85 | 168 asserts (great) but no runner, no e2e |
| Developer experience | 64 | 88 | gates not CI-blocking; docs sprawl |

**CURRENT (weighted): ~68/100** · **TARGET: ~87/100**
**BIGGEST GAP:** Product intelligence + Workflow efficiency (the product doesn't compound yet).
**HIGHEST-LEVERAGE FIX:** make the gates CI-blocking (Phase 1) — it protects everything else and costs almost nothing, and it's the direct antidote to the #1 real risk (parallel-authorship entropy).
**EXPECTED IMPACT:** stop the regression treadmill → free the lanes to build the compounding loop (instant + trustworthy + closed-loop) that turns a dashboard into a co-pilot.

---

*No code was modified in this pass. Recommended first execution step (on your approval): Phase 1 — wire `tsc && npm run build && node scripts/run-checks` as a CI-blocking check on push, and collapse the 165-command chain into one `node --test` run without losing a single invariant.*

---

## Phase 1 — EXECUTED 2026-09-03 (make gates authoritative + fast)

**Objective:** collapse the 165-command serial `check:all` into one parallel command, and confirm the gate is trustworthy.

**Done + verified:**
- `scripts/run-checks.mjs` + `npm run check`: runs the EXACT `check:all` set in parallel. **165/165 checks in ~1.8s** (was minutes serial); reports every failure, exits non-zero if any fail. CI (`.github/workflows/ci.yml`) now runs `npm run check`.
- **Finding (critical):** the branch gate was **RED on 6 checks** — i.e. CI was failing on committed code. Root-caused and fixed all 6:
  1. `check:migrations` false-positive: `/_down/` matched `0032_lock_**down**_…` — anchored the rollback marker to the `_down.sql` suffix.
  2. `check:migrations` real issue: duplicate ordinal `0030` (two features, both already applied) — grandfathered (renaming an applied migration is riskier).
  3. `check:{chunk,objective,brand-website,currency}` (4 checks): `lib/meta-source.ts` value-imported `captureError` via `@/lib/…`, which the strip-types check runner can't resolve — switched to a relative import (one line; unblocked all 4).
  4. `check:account-deletion`: 5 user-scoped tables (`account_rollups`, `creative_rollups`, `account_verifications`, `deep_analysis_run`, `deep_creative_read`) were unclassified → would orphan data on account deletion. Added to `EXPLICIT_DELETE_BY_USER`.
- After fixes: **165/165 green, tsc clean, build compiles.**

**Impact:** CI is now fast AND the gate is actually green (it wasn't). This directly addresses the #1 risk (parallel-authorship entropy): the gate now catches regressions in seconds and CI enforces it.

**Not changed:** no product behavior; all edits are tooling/gate/data-classification. `check:all` (serial) kept as the job-list source + fallback.

**Next (awaiting go):** Phase 2 — security close-out (leaked-password toggle is yours; broaden `check:tenancy`; keep access-gate green).

---

## Phase 2 — EXECUTED 2026-09-03 (security close-out)

**Objective:** close the remaining actionable security-advisor items; confirm posture.

**Done + verified (live):**
- Re-ran the Supabase security advisor. The 3 `cp_*` cross-tenant RPCs are GONE (0033 held). The ~57 `rls_enabled_no_policy` entries are **INFO by design** — the default-deny + service-role tenancy model, not a defect.
- **`handle_new_user` least-privilege** (migration `0039`, applied): revoked EXECUTE from `anon`/`authenticated`/`public`. The advisor WARNed it as anon-executable, but it is a trigger (returns `trigger`) — proven not `/rpc`-callable. This is defense-in-depth (remove the unusable grant so the linter is clean and no future change can expose it). **Verified:** `anon_exec=false, authed_exec=false`, and the auth.users trigger is **still wired** — signups unaffected (trigger execution does not check the EXECUTE grant).
- **Only remaining security item: leaked-password protection** — a Supabase Auth dashboard toggle, OWNER action (Authentication → Sign In / Providers → Email).

**Deliberately deferred (anti-over-engineering):** a static "every admin-client read is user-scoped" tenancy check would false-positive on legitimately-unscoped reads (public/system/aggregate tables) and red the gate. The correct, enforceable place is the **store-layer boundary in Phase 5** — a check that all `createAdminClient().from(<tenant table>)` lives in `lib/**/store.ts` and is user-scoped, where the boundary makes the assertion precise. Noted, not shipped as a fragile gate.

**Result:** advisor clean of actionable items except the owner's leaked-password toggle; gate green; no product behavior changed.

**Next (awaiting go):** Phase 3 — de-entropy (dedupe `readCookie`/switchers, archive the v1 rules engine, consolidate docs).

---

## Phase 6 (slice) — EXECUTED 2026-09-03 (isolated DB perf)

- **`auth_rls_initplan`** (migration `0040`, applied + verified): the two user-facing RLS policies (`profiles."own profile read"`, `token_usage.token_usage_select_own`) used bare `auth.uid()` (re-evaluated per row). Rewrapped as `(select auth.uid())` (evaluated once per query). Verified live: both `qual` now read `(SELECT auth.uid())`. Identical rows, better plan at scale. These are the only two user-facing RLS policies (the rest is the service-role model).

---

## Execution summary & honest stop point (2026-09-03)

**Completed autonomously, each verified + gated + committed:**
- **Phase 1** — parallel check runner (165→166 checks in ~1.9s vs minutes) + fixed 6 red gate checks (CI was failing). `b8fa133`.
- **Phase 2** — security close-out: `handle_new_user` least-privilege (`0039`), classified new tables, confirmed posture. `3b4993d`.
- **Phase 6 (slice)** — RLS init-plan perf (`0040`).
- (Earlier this session, pre-audit) — the P0/P1/P2 security + correctness + performance + instant-app + self-proving work now cross-referenced here.

**Deliberately NOT bulldozed (the senior-engineer call the mandate asked for):**
The remaining phases — **3** (dedupe `readCookie`/switchers, archive the v1 rules engine), **4** (cockpit streaming / first-paint), **5** (store-layer boundary + cockpit assembler split), **7** (frontend perf), **8** (the HIGH-risk golden money-path split), **11** (a11y) — are predominantly edits to **hot and golden files that 14 other sessions are actively changing** (154 commits today). This audit's own #1 finding is that parallel-authorship entropy is the top risk; racing these through a churning tree as one autonomous agent would *cause* the regressions diagnosed here (and two are golden money-path changes that must be output-identical, verified against `check:golden`/`check:shadow-benchmark`, done alone).

Specifically confirmed unsafe-to-solo right now:
- The v1 rules-engine archive (Phase 3) is **entangled**: reachability from the golden `lib/cockpit/analyze.ts` path is ambiguous (`causality.ts` is in that neighborhood), so a wrong deletion could break scoring. Correctly marked INVESTIGATE, not deleted.
- The cockpit assembler split (Phase 8) and cockpit streaming (Phase 4) touch `app/app/page.tsx` + `lib/cockpit/*` + `lib/meta-*`, edited by multiple sessions this session alone.

**The enabling investment is done:** the gate is now fast (~2s) and green and CI-enforced, which is exactly what makes phases 3–8 safe to do **incrementally, with ownership, in a coordinated window** — the right way, not a solo race. Recommend scheduling those against a quieter tree (or a dedicated branch) with the golden invariants as the contract.
