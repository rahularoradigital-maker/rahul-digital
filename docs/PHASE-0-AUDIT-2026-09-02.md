# Phase 0 — Complete Codebase Audit & Execution Plan (adbrain-mvp / AdScale)

**Date:** 2026-09-02 · **Scope:** `/Users/lyxelflamingo/adbrain-mvp` (Next.js 16.3.2 · React 19.2.8 · Supabase · Vercel Hobby)
**Method:** 5 parallel read-only discovery agents (architecture, security, bloat, performance, SEO/a11y/UX/observability) + live production checks + live database checks + Supabase security/performance advisors. **Every claim below carrying a ✅ was independently re-verified by me** against the code, the live site, or the live database — not taken from an agent on faith. Anything unverifiable is marked **UNKNOWN**.
**No code was changed to produce this document.**

> ⚠️ **Honesty note.** Several findings are defects I introduced *earlier today* while shipping features. They are called out as **[MINE]** and ranked on merit, not hidden. That is the point of an audit.

---

## Measured baseline (the "before")

| Metric | Value |
|---|---|
| TS/TSX files · LOC | 626 · 51,913 |
| Pages · API routes · components · lib modules | 33 · 47 (+2) · 113 · 247 |
| Runtime deps · dev deps | **13** · 8 (no overlapping libraries) |
| `"use client"` files | 68 |
| Client JS (`.next/static`) · largest chunk | 1.7 MB · 232 KB |
| `check:*` scripts · `check:all` chain | 144 files · **139 serial `npm run` cold starts** (4,117-char line) |
| Test runner | **none** (no jest/vitest/playwright — assert-scripts only) |
| Migrations · DB tables · RLS enabled · RLS-on-but-**zero-policies** | 40 · 58 · 58 · **50** |
| `ad_metrics` rows (90d / total) · `ad_meta` · `ad_changes` | 14,159 / 14,588 · 1,060 · 4,810 |
| CI gates | lint + typecheck + build + `check:all` |
| Error tracking / RUM | **none** (Sentry seam exists, unused) |
| Empty `catch {}` blocks | 68 (+5 `.catch(()=>{})`), concentrated in the Meta data path |
| Unreachable `lib/` modules (kept alive only by check scripts) | 24 modules · 2,215 LOC |
| `docs/` | 161 files · 21,499 lines of markdown (**13 prior audits of this same codebase**) |

---

## A. Current architecture summary

**Shape:** a single Next.js App Router monolith on Vercel. Public marketing site under `app/` (SSG/ISR), authenticated product under `app/app/*` (RSC, server-rendered), 47 route handlers under `app/api/`, Supabase Postgres + Auth + Storage, Vercel Cron for background sync. No microservices, no separate backend — correct for the scale.

**Request chain (read path):**
```
proxy.ts (/app only, local JWT verify) → app/app/layout.tsx (getCurrentUser → requireProductAccess)
→ page → lib/app/cockpit-data.ts loadCockpit → resolveCockpitScope (7 adbrain.* cookies)
→ lib/meta-sync.ts fetchLiveCockpit → L1 LRU(500) → L2 cockpit_cache (SWR 24h) → cold pull (8s cap)
→ lib/cockpit/from-store.ts buildCockpitFromStore (ad_metrics + ad_meta paged @1000)
→ lib/scoring.ts toCockpitInputs → lib/cockpit/analyze.ts analyzeAccount → components/cockpit/*
```
**Write path:** Vercel Cron → `/api/cron/sync` (bearer `CRON_SECRET`, constant-time) → resumable self-chaining hops → `lib/ingest/ad-metrics.ts` + `change-history.ts` → `ad_metrics` / `ad_meta` / `ad_changes`. Manual equivalent `/api/ingest/run`.

**Security model (important):** ✅ all 58 tables have RLS enabled, **50 have zero policies** → Postgres is *default-deny everywhere* and the **service-role admin client does all real work**. Tenant isolation therefore rests on every admin-client query carrying `.eq("user_id", …)` — RLS will not catch a missed filter. This is workable but must be lint-enforced (it isn't).

**State:** client = 7 scope cookies + sessionStorage/localStorage prefs; server = `cockpit_cache` + Supabase tables. Verified duplication: `adbrain.platform` parsed twice differently; diversity computed server-side *and* recomputed client-side; `readCookie` copied 7×.

**Coupling:** 3 real import cycles (`analyze↔opportunity`, `meta-sync↔from-store`, `file-articles↔growth/articles`). `lib/meta-sync.ts` is the hub (imports 21 modules, imported by 10). The hypothesised `scoring.ts↔analyze.ts` cycle **does not exist**.

**Verdict:** the architecture is fundamentally sound and appropriately small. The debt is *inside* modules (god files, duplicated pipelines, copy-paste idioms, staged-but-unwired code), not in the topology. **No architectural rewrite is warranted.**

---

## B. Top 20 problems (ranked by severity × confidence ÷ effort)

| # | Sev | Problem | Location | Verified |
|---|---|---|---|---|
| 1 | **CRIT** | **Cross-tenant read via anon-callable `SECURITY DEFINER` RPCs** — `cp_advertised_product_ids`, `cp_product_opportunities`, `cp_product_types` filter on caller-supplied `p_user`, no `auth.uid()`, executable by `anon` over public REST. Bypasses every app guard. | Postgres functions (live DB) | ✅ live SQL |
| 2 | **CRIT** | **Open redirect** in auth callback: `${origin}${next}` unvalidated → `?next=@evil.com` phishes off the real domain; enables login-CSRF | `app/auth/callback/route.ts:5,13` | ✅ |
| 3 | **CRIT** | **Entitlement gate missing on 5 mutating handlers** (2 bill LLM): suspended/waitlisted users can POST concepts/brand/assets/profile/notifications | `creative-production/{concepts,assets,brand}`, `brand/profile`, `notifications` route.ts | ✅ |
| 4 | **CRIT** | **AI daily-cost ceiling not global** — enforced in router/decode only; `deep-decode` + `llm-json` call Gemini directly | `lib/gemini.ts` (no `aiBudgetExceeded`) | ✅ |
| 5 | **HIGH** | **`CACHE_SCHEMA` not bumped** when `recentVs30` was added → cached views silently render empty "What's working" for up to 24h after any shape change. **[MINE]** | `lib/meta-sync.ts:564`; `renderable.ts` never checks it | ✅ |
| 6 | **HIGH** | **Pagination without `ORDER BY`** in change-analysis → row dup/drop across 120-day scan corrupts Change-Impact windows | `lib/scoring/change-analysis.ts:77-85` | ✅ |
| 7 | **HIGH** | **Unpaged `ad_meta` read in ingest** (Supabase caps 1,000; account has 1,060) → ~60 ads treated as never-synced and re-pulled **every run, forever** — live-active | `lib/ingest/ad-metrics.ts:92` | ✅ |
| 8 | **HIGH** | **SSRF guard missing** on the one external fetch that lacks it (brand-dna); permits `http://`, TOCTOU rebinding to metadata IP | `lib/creative-production/intelligence/brand-dna.ts:20` | ✅ |
| 9 | **HIGH** | **Silent failures in the money path**: 68 empty catches, 6 in `meta-sync`, 7 in `meta-source`; `captureError` used at 1 site, `sendAlert` at 1; **no Sentry/RUM** | `lib/meta-sync.ts:312,586,609,701,715,734` etc. | ✅ counts |
| 10 | **HIGH** | **Tenancy is app-level only** across ~30 admin-client sites incl. a service-role query **inside a page file**; no lint prevents a missed `user_id` filter | `app/app/creative/page.tsx:28-41` + 22 routes | ✅ |
| 11 | **HIGH** | **`/api/meta/campaigns` hits Meta Graph (≤25 pages) on every `/app` page load** for an unopened dropdown; 3–4 client fetches per navigation, no cache | `campaign-switcher.tsx:49`, `event-switcher.tsx:43` | agent, high-conf |
| 12 | **HIGH** | **`/app/changes` full uncached 120-day scan** every load; funnel also uncached + live Meta call per load | `change-analysis.ts:14`, `funnel/store.ts` | agent, high-conf |
| 13 | **HIGH** | **Auth pages self-canonicalize to homepage w/ duplicate titles**; legal pages emit no canonical; **`/app` has no noindex** (robots Disallow can't deindex) | `app/(auth)/*`, `app/privacy` etc., `app/app/layout.tsx` | ✅ live curl |
| 14 | **HIGH** | **Unsubstantiated social proof on the homepage** — "SOC 2 Type II", "Trusted by hundreds", "certified Meta Partner", "+38%" case study, named testimonials. Truth **UNKNOWN**; if placeholder, it's a material misrepresentation contradicting the project's own R1 ("never fabricate") | `components/marketing/static-sections.tsx:4,11,89,182,192`; `app/page.tsx:23` | ✅ strings exist |
| 15 | **HIGH** | **24 `lib/` modules (2,215 LOC) unreachable from production**, incl. RBAC never enforced, **two `assessDataQuality` with the same name**, two decision engines, two diversity engines, abandoned fatigue v1/v2 — kept green only by check scripts | `lib/rules/*`, `lib/security/rbac.ts`, `lib/data-quality.ts`… | ✅ |
| 16 | **HIGH** | **`check:all` = 139 serial cold starts; 4 checks defined but never run**; 1 script never invoked; no test runner | `package.json` | ✅ |
| 17 | **HIGH** | **`_inbox.zip` (3.7 MB) untracked and un-gitignored** at repo root — one `git add -A` commits it | repo root | agent |
| 18 | **MED** | **`/api/health` (unauth) leaks vendor-key presence, customer count, and "automation is dead" timing** — recon surface. **[MINE, partly]** | `app/api/health/route.ts` | ✅ |
| 19 | **MED** | **Copy-paste idioms**: auth preamble ×35 (8 drifting variants), `readCookie` ×7, objective/event switcher 82% identical, `metricFor` duplicated verbatim **[MINE]**, `MIN_*` thresholds duplicated by value | 34 route files; switchers; `change-impact.ts`↔`recent-vs-baseline.ts` | ✅ |
| 20 | **MED** | **God files**: `studio.tsx` 887L/34 useState/16 concerns with **policy-lint enforced only in the browser [MINE]**; `kpi-catalog.ts` 2,442L of data in the client bundle; `meta-source.ts` 1,138L / 33 exports; `?days=` param dead | `studio.tsx`, `kpi-catalog.ts`, `cockpit-data.ts:122` | ✅ |

**Just below the cut:** zero `<Suspense>` / zero code-splitting (1,580 LOC client shell on every route); durable queue built with 0 callers while 3 routes hold 300s requests; unauth image proxy amplification; contradictory pricing across 3 FAQPage schemas; blog has no header/footer + 3 dead nav anchors; no `/about`/founder/`Person` entity; `--good-ink`/`--warn-ink` fail WCAG AA (3.89:1 / 3.79:1, computed); 7 dropdowns declare `aria-haspopup` widgets they never build; client 401s render as "all caught up".

---

## C. Critical security issues (all ✅ verified)

| Sev | Issue | Fix | Verify |
|---|---|---|---|
| CRIT | Anon-callable `SECURITY DEFINER` RPCs w/ caller `p_user` (3 fns) + `handle_new_user()` exposed | `REVOKE EXECUTE … FROM anon, authenticated` (app calls via service role, unaffected) or bind to `auth.uid()`. **⛔ STOP CONDITION — DB security change, needs your approval** | curl `/rest/v1/rpc/cp_product_types` with anon key → 401/permission denied |
| CRIT | Open redirect `app/auth/callback` | allow only `/…` not `//` or `/\`; `new URL(next, origin)` | curl `?next=@evil.com` → `Location` stays on-origin |
| CRIT | 5 mutating handlers lack `guardProductApi` | add guard as first line after 401 (then replace idiom with `withProductApi` wrapper) | SUSPENDED user POST → 403 |
| CRIT | AI budget bypassable | move `aiBudgetExceeded()` into `callGemini`/`callGeminiText` primitive | set budget tiny → no Gemini request |
| HIGH | SSRF gap in brand-dna fetch (+ deep-decode video URL) | `isPublicHttpsUrl` before fetch | check-brand-website assertion |
| HIGH | Tenancy = app-level `.eq(user_id)` only; 50 tables policy-less; service-role in a page | move page query to a store; lint: no `createAdminClient`/`.from(` outside `lib/**/store.ts` | `check:plane-boundary` |
| MED | `/api/health` recon leak | split: public `{status,time}`; rest behind admin/`HEALTH_TOKEN` | `curl /api/health \| jq keys` |
| MED | Unauth image proxy (no auth/rate-limit/size cap) | require session + rate limit + byte cap | no-cookie → 401 |
| MED | Leaked-password protection OFF; 2 functions mutable `search_path` | enable in Supabase Auth; `SET search_path` on fns | advisor clean |
| LOW | Raw `error.message` to clients (5 routes); RBAC module unwired; rate limit on 5/47 routes; Upstash config UNKNOWN | fixed messages + `captureError`; wire or delete RBAC; limit 300s routes | grep gate |

**Done well (don't re-fix):** constant-time cron auth · OAuth `state` CSRF · SSRF module (DNS-rebind-safe) · enforced CSP + HSTS + XFO · RLS on all tables · IDOR discipline · zero injection surface · private storage + signed URLs + mime/size caps · secrets hygiene (no env ever committed) · brute-force lockout · layered `/app` guard · hardened public lead form.

---

## D. Critical performance issues

| Sev | Issue | Measured? | Fix |
|---|---|---|---|
| HIGH | `CACHE_SCHEMA` unbumped → stale-shape blobs served 24h **[MINE]** | ✅ code | bump to v7; then derive/enforce shape version via `check:cache` |
| HIGH | Meta Graph call on every `/app` load (`/api/meta/campaigns`, ≤25 pages, uncached) + 3–4 mount fetches | inferred (code) | lazy-load on open; sessionStorage TTL (brand-switcher already does this); `SELECT DISTINCT` RPC for events |
| HIGH | `/app/changes` uncached 120d scan; funnel uncached + live Meta call | inferred | extend L1/L2 cache pattern; shared per-request `ad_metrics` loader |
| HIGH | Ingest `ad_meta` unpaged → perpetual re-sync of ~60 ads | ✅ live (1,060 > 1,000) | page like `readAllMetaRows` |
| MED | ~15 **serial** 1,000-row round-trips per cold cockpit (14,159 rows measured, not 31 as estimated) | ✅ DB count | count-then-`Promise.all` ranges; push `aggByDay` into SQL |
| MED | Zero `<Suspense>`; serial `getUser→session→brand` chain *after* cockpit resolves | ✅ grep | Suspense boundaries; hoist |
| MED | Zero code-splitting; 1,580 LOC client shell on all 15 routes; `kpi-catalog` 70 KB in client bundle | ✅ grep | `next/dynamic` on popover bodies; move catalog server-side |
| MED | No `useMemo` in `components/cockpit` (FatigueRadar 7 passes/render) | ✅ grep | memoize |
| MED | Durable queue 0 callers; 3 routes hold 300s | ✅ grep | migrate deep-analysis/generate/shopify-sync to `enqueueAndProcess` |
| LOW | Unindexed `meta->>email` on lockout query (table empty today — future-proofing); `cockpit_cache` has **no migration** (irreproducible); 7 unindexed FKs; 20 unused indexes | ✅ advisor | partial expression index; add DDL migration; review unused |

**Measure before/after:** `npm run build` per-route First Load JS · `/app?perf=1` (`cockpitMs`, freshness) · `EXPLAIN (ANALYZE, BUFFERS)` on the 4 hot queries · **add RUM** (`web-vitals` → existing route; CSP already allows `connect-src 'self'`) — LCP/INP/CLS are currently **unmeasurable in production**.

---

## E. Critical SEO issues (✅ = live-verified)

| Sev | Issue | Fix |
|---|---|---|
| HIGH ✅ | `/login` (+signup/forgot/reset) canonical → homepage, duplicate title/description, indexable | per-page metadata + `alternates.canonical`; noindex reset/forgot |
| HIGH ✅ | `/app/*` has **no noindex** (only robots Disallow, which blocks Google from ever reading a noindex) | `robots: {index:false}` in `app/app/layout.tsx` + `X-Robots-Tag` header |
| HIGH ✅ | Legal pages emit no canonical (`/privacy` live) | `pageMetadata(path)` helper that always sets canonical |
| HIGH | **Unsubstantiated claims** (SOC 2 Type II, "trusted by hundreds", Meta Partner, +38%, testimonials) — **UNKNOWN if true** | **your decision**: substantiate + link proof, or remove. Legal exposure if placeholder |
| HIGH | Blog renders **no header/footer** — organic entry point is a dead end | wrap in SiteHeader/Footer (`app/blog/layout.tsx`) |
| HIGH | 3 primary nav anchors dead on every non-home page (`#use-cases` etc.) | `/#use-cases` |
| HIGH (GEO) | No `/about`, no founder, no `Person`/`sameAs`; 10 articles share one timestamp, no author | ship `/about` + author node |
| MED | 3 FAQPage schemas give **contradictory pricing** answers (early-access vs 4 tiers vs private beta) | one truth |
| MED | `dateModified` == `datePublished` always; `/signup` absent from sitemap; robots `Disallow: /app` also blocks `/apple-icon` (prefix) | fix |
| LOW (latent) | `NEXT_PUBLIC_SITE_URL` local fallback = stale vercel.app host; `llms.txt` uses a *different* fallback. **Prod is correct** (live canonical = adscaledigital.co) | single `lib/site-url.ts` |

**Done well:** robots/sitemap/OG/Twitter images · one `<h1>` per page (build-verified) · Organization+WebSite+SoftwareApplication `@id` graph · FAQ schema mirrors visible text · pillar/spoke blog linking · `llms.txt` dynamic + honest · 0 "AdBrain" in user-facing copy · real 404.

---

## F. Biggest sources of code bloat (proven, not guessed)

| Class | Item | Size |
|---|---|---|
| **Decision needed** | 24 `lib/` modules unreachable from prod (staged vs abandoned) — incl. `security/rbac.ts`, `classification.ts`, `rules/{fatigue,diversity,waste,will-break,…}`, `data-quality.ts`, `decision.ts`, `validator.ts`, `queue-memory.ts` | 2,215 LOC |
| **Dup logic** | auth preamble ×35 · `readCookie` ×7 · switcher pairs 67–82% identical · `metricFor` verbatim ×2 **[MINE]** · provider `fillRecipe` 55% · `MIN_*` by-value | ~1,240 LOC |
| **Dead (safe)** | `AccountSwitcher` (167L, superseded) · `ui/label.tsx` · `influencer/flag.ts` · `ad-source-registry.ts` · `jobs/enqueue.ts` · `check-shadow-benchmark.ts` · 61 dead value exports · 157 dead type exports · 8 dead CSS props · 5 starter SVGs · `public/cockpit-v1.html` (publicly served) · `_inbox.zip` 3.7 MB | ~1,170 LOC + 13 files |
| **Data in bundle** | `kpi-catalog.ts` 2,442L (5 of 13 fields never read ≈ 810L) in a `"use client"` import | 70 KB |
| **Scripts** | 144 assert-scripts, 139-cmd serial chain, 34% boilerplate, 4 orphaned checks | 8,251 LOC |
| **Docs** | 161 files / 21.5k lines · 13 audits · 4 architecture docs · 2 tech-debt · plans for shipped work · v1/v2 HTML | est. 6–8k removable |

**Honest sizing vs the "99%" target:** LOW-risk removable ≈ **1,173 LOC (2.3%)**; LOW+MED ≈ **2,415 LOC (4.6%)**. The source is already tidy by dead-code standards. The *real* waste is (a) duplication, (b) staged-but-unwired subsystems, (c) the check-script chain, (d) docs — not raw volume. "99% of *avoidable* waste" here means resolving those four, not deleting code.

---

## G. Dependency problems

**Essentially none.** 13 runtime deps (`next`, `react`, `react-dom`, `@supabase/{ssr,supabase-js}`, 4 Radix primitives, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`), 8 dev. No overlapping libraries, no HTTP client, no template engine, no parser lib. `lucide-react` used in 3 files (tree-shakes per icon — fine). **Action:** `npm audit --omit=dev --audit-level=high` + `osv-scanner` (advisories **UNKNOWN** — not run). No removals recommended.

---

## H. Recommended target architecture (smallest that supports the scale)

**Keep:** Next.js App Router · Supabase (Postgres/Auth/Storage) · Vercel · RSC-first · the deterministic engines · fingerprint-once · L1/L2 cache · the default-deny RLS + service-role model (**with** a boundary lint).

**Add / change (no rewrite):**
1. `withProductApi(handler)` / `withCronSecret(handler)` — one auth authority; delete 35 preambles; gate asserts every exported method.
2. `lib/cockpit/{types,assemble}.ts` — one cockpit assembler fed by two thin fetchers (`meta-sync` live, `from-store`); kills the cycle and the duplicated pipeline.
3. **Store-layer boundary**: all `createAdminClient`/`.from(` inside `lib/**/store.ts`; lint-enforced.
4. `lib/meta/{transport,accounts,insights,entities,creatives,ad-library}.ts` — split the 1,138-line client along its own section comments.
5. `lib/gemini.ts` enforces budget + kill-switch at the primitive.
6. Cache shape version derived/enforced (`check:cache`), not manual.
7. `node --test` replaces the 139-command chain (same files, one command, parallel).
8. Sentry via the existing `captureError` seam; route the 68 empty catches through it; RUM via `web-vitals`.
9. `pageMetadata()` helper; `app/app/layout.tsx` noindex; `app/blog/layout.tsx`.
10. Studio: server-side `runQA` owns policy-lint/char-limits; split into step components + reducer.
11. Archive (not delete) the 24 staged modules under `archive/` outside `tsconfig`, after a per-module decision.

**Do NOT introduce:** microservices, a state library, generic wrappers/factories, new deps, a second cache layer, a new test framework.

---

## I. Proposed execution phases · J. Risk

| Phase | Scope | Risk | Gate |
|---|---|---|---|
| **P0 Security** | RPC lockdown (⛔ approval) · open redirect · 5 guards · budget at primitive · SSRF gap · health split · avatar proxy · leaked-pw on · search_path | **LOW** code / **MED** DB (revoke could break an unknown anon caller — none found) | curl repro for each; advisor clean |
| **P0 Correctness** | `CACHE_SCHEMA` v7 · `ORDER BY` in change-analysis · page `ad_meta` in ingest · `metricFor`/`MIN_*` dedupe | **LOW** | golden + check:all green; cache warms once |
| **P1 Observability** | Sentry DSN via seam · empty-catch triage in `meta-*`/`cockpit`/`ingest`/`audit` · `sendAlert` on health-degraded · RUM | LOW | errors visible in Sentry; health 503 alerts |
| **P1 Architecture** | `withProductApi` · store boundary + lint · move page query · `assemble.ts` extraction (**HIGH** risk — money path, golden-guarded) · cron wrapper | LOW–**HIGH** | golden/shadow benchmark identical before/after |
| **P2 Performance** | lazy switchers + TTL cache · changes/funnel cache · parallel paging · Suspense · dynamic imports · kpi-catalog server-side · useMemo · queue adoption (3 routes) | MED | per-route First Load JS ↓; `perf=1` cockpitMs ↓; EXPLAIN plans |
| **P2 SEO/GEO** | metadata helper · noindex `/app` · blog chrome · nav anchors · pricing truth · `/about`+author · dates | LOW | live curl canonicals; Search Console |
| **P3 Bloat** | archive 24 modules (per-decision) · delete proven-dead 13 files · dedupe switchers/readCookie · `node --test` · docs consolidation (archive 13 audits) | LOW–MED | tsc/build/tests green; LOC delta measured |
| **P3 A11y/UX** | badge contrast tokens · dropdown roles + focus restore · aria-live on errors/Ask · 401 handling · nav title fallback · filter "N active · clear" | LOW | axe; keyboard pass |
| **P4 Nice-to-have** | studio split · meta-source split · docs rewrite (ARCHITECTURE/CODE_HIERARCHY/…) · DECISIONS.md/CHANGELOG | LOW | — |

After **each** phase: `lint → typecheck → build → check:all → golden` and, for anything user-visible, a live check on the signed-in account. **Stop on any red.**

---

## K. What I will NOT change

- The framework, database, auth, or deploy vendor (no migration, no rewrite).
- The default-deny RLS + service-role model (only add the lint that makes it safe).
- **Any scoring/fatigue/decision formula or threshold** — golden invariants are the contract; refactors must be output-identical.
- The 1,061-rule decision corpus.
- Cookie names (`adbrain.*`) — renaming is a breaking change for every signed-in user; needs a read-both/write-new migration, deliberately scheduled, not drift.
- Any working screen, handler, or data path (CLAUDE.md rule #2).
- The 24 staged modules — **not deleted without a per-module decision from you**.
- Marketing claims — I will not silently delete or rewrite them; **you** decide substantiate-vs-remove.

---

## ⛔ Stop conditions requiring your explicit approval before I touch them

1. **`REVOKE EXECUTE` on the 4 exposed Postgres functions** (security change to the live DB).
2. **Any new migration** (partial index on `owner_events`; DDL for the irreproducible `cockpit_cache`; unindexed FKs).
3. **Archiving/deleting the 24 unreachable modules** (destroys staged work if wrong).
4. **Removing or rewriting the homepage social-proof claims** (legal/brand call).
5. Enabling Supabase leaked-password protection (auth setting).

Everything else in P0–P3 is normal refactoring I'll proceed on once you approve the plan.

---

## Decisions for you
1. **Approve the plan?** (P0 → P1 → P2 → P3 in that order.)
2. **Approve stop-condition #1** (RPC lockdown) — it's the one real cross-tenant leak.
3. **Are the SOC 2 / testimonial / "+38%" claims true?** Yes → I link proof. No → I remove them in P2.
4. **The 24 staged modules:** which are intentional (I archive) vs abandoned (I delete)? Default if silent: **archive all, delete none.**

---

## Execution log (2026-09-02, after "Execute")

All on `validation-v0-v1`, every commit gated (tsc 0, `npm run build` 0, relevant `check:*` PASS) and live-verified on adscaledigital.co from Rahul's signed-in session. Times are server round-trips measured with `fetch(..., {cache:"no-store"})` from the browser; bytes are the response HTML.

| Phase | Commit | What |
|---|---|---|
| P0 Security | `ee1d4d8` | open-redirect fix (`/auth/callback`), AI kill-switch + budget at the `callGemini` primitive, SSRF guards (`brand-dna`, `deep-decode`), `guardProductApi` on 5 mutating handlers, `influencer/avatar` auth + rate-limit + 2 MB cap, `/api/health` detail admin-gated, migration `0032` (RPC lockdown, MANUAL apply) |
| P0 Correctness | `bca8b6c` | `CACHE_SCHEMA` v7, deterministic ORDER BY on the change-analysis scan, paged `ad_meta` read in ingest, `objective-metric.ts` + `VOLUME_FLOORS` dedupe |
| P1 | `07ec0f5` `a1a87f7` `8c55fd5` | `withProductApi`/`withAdminApi`, per-method access gate (41 methods / 34 routes), `captureError` on 21 money-path catches, `cronSecretGate` on all 3 cron routes, `lib/insights/store.ts` boundary |
| P2 SEO | `a1a87f7` | `/app` noindex (meta + `X-Robots-Tag`), self-canonicals on auth/legal/demo pages, blog gets site chrome, nav anchors → `/#…` |
| P2 Perf | `308d4f8` | campaign + event switchers behind a 5-min sessionStorage TTL (the Meta Graph call no longer fires on every `/app` load); `/api/scope/events` scoped to the active account |
| P2 Perf | `69895a1` | `/app/changes` analysis in the platform data cache (user+account key, 6 h TTL, ingest busts the tag) |
| P2 Perf | `2a61492` | `/app/funnel`: client render with 20-card preview (flight carries data, not 241 element trees) + data cache; one shared `accountStoreTag` in `lib/cache.ts` |
| P2 Perf | `f5db31e` | cockpit brand lookup parallel with `loadCockpit`; 70 KB KPI catalog off the client bundle |
| P2 Perf | `9457acf` | `lib/supabase/paged.ts` parallel-burst reader replaces 8 serial paging loops; `ad_id + date` total order on every `ad_metrics` reader (latent P0 defect in from-store / funnel / reconcile) |
| P3 | `cf7e53b` (also carries the docs below - one combined commit) | 11 zero-reference files deleted incl. the publicly served `public/cockpit-v1.html` prototype; `_inbox.zip` gitignored; orphan checks `check:change-log`, `check:shadow-benchmark` wired; new `check:paged` |

### Measured before → after (live account, same session)

| Surface | Before | After | Note |
|---|---|---|---|
| `/app/changes` | 16.5 s cold · 11.1 s warm | 11.3 s first (primes cache) · **1.6 s** repeat | 129 KB HTML unchanged |
| `/app/funnel` | 15.5 s cold · 11.9 s warm · **8.58 MB** | 16.3 s first · **3.0 s** repeat · **1.25 MB** | remaining 1.25 MB is report JSON for 444 ads (steps 521 KB) |
| `/app` client JS | 757,221 B · 14 chunks | **705,724 B** · 13 chunks | catalog chunk `027ffz1evmpyz.js` (68,678 B) gone; the 4 KB `rubrics.ts` still ships (fine) |
| `/app/reconcile` (uncached store read) | 8.7 · 5.7 · 5.5 s | 5.3–5.8 · 4.1–4.2 · 3.6–3.8 s | parallel paging; page has non-paging costs too, so this is a lower bound on the paging gain |
| `/api/meta/campaigns` per `/app` load | 1 live Meta Graph call | 0 within a 5-min window | verified by cache key in the live chunk; not timed |

### Not done (honest list)
- Stop-condition items still with Rahul: apply migration `0032`; partial index on `owner_events`; 7 unindexed FKs; SOC 2 / testimonial / "+38%" claims; Supabase leaked-password protection; the 24 unreachable modules (default: archive, delete none).
- P2 perf leftovers: `next/dynamic` on popover bodies; `useMemo` in `FatigueRadar`/`ActionList`; `<Suspense>` streaming on the cockpit; web-vitals RUM (needs an ingest endpoint); moving the 300 s routes onto the durable queue; paginating the funnel's remaining 1.25 MB behind "Show all".
- P3 leftovers: switcher/`readCookie` ×7 dedupe; `node --test` replacing the 141-command `check:all` chain; docs consolidation (35 files in `docs/` + a second `ARCHITECTURE.md` at the root); a11y contrast + dropdown roles; `meta-source.ts` split; Sentry DSN via the `captureError` seam; contradictory pricing FAQs; `/about` + author `Person`.
