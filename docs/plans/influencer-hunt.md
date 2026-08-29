# Influencer Hunt — Phased Implementation Plan

**A brand-first creator discovery, vetting & matching engine inside AdBrain.** Isolated behind
`INFLUENCER_HUNT_ENABLED`, reusing existing infrastructure, never auto-merged. Benchmark: *"find the
creators most strategically valuable for THIS brand, explain why, show evidence, expose risk, return an
actionable shortlist"* — not "search a database."

> Each phase is self-contained for a fresh session. It states **what to copy** (with exact file
> references), **verification** (how to prove it works — a `check:*` script + a live smoke), and
> **anti-pattern guards** (what NOT to do). Do not invent APIs; copy the cited patterns. Do the phases in
> order. Nothing merges to the product without the Phase 11 gate.

---

## PHASE 0 — Discovery findings (the ground truth every later phase builds on)

### 0.1 Reuse map (copy these; never duplicate)
| Need | Copy from | Notes |
|---|---|---|
| Full-stack route skeleton (auth → brand context → Gemini → cache result → GET cached) | `app/api/market/positioning/route.ts` | The single best template. `type: "influencer_hunt"` in `creative_insights` or a dedicated table. |
| Data layer (types → one-writer store → account-scoped reader) | `lib/competitors/{types,store,data}.ts` | `store.ts` = the one shared writer so conflict keys never drift. |
| Background pipeline (chunked, idempotent, per-page upsert, observability row, never-throws) | `lib/ingest/ad-metrics.ts` + `app/api/cron/sync/route.ts` | `AD_CHUNK=40`, `UPSERT_BATCH=500`, `writeState` outcome row, `Bearer $CRON_SECRET` guard. |
| AI (prose synthesis; suggest handles) | `lib/gemini.ts` `callGeminiText`; `lib/brand/profile.ts` `suggestCompetitorNames` | Text MUST use `gemini-flash-lite-latest`. Structured JSON = `stringObjectSchema` (UPPERCASE types) + `callGemini`. |
| Brand/competitor context to inherit | `lib/brand/profile.ts` `loadBrandProfile`; `lib/competitors/data.ts` `loadCompetitorData`; `getUserMetaSession` (`lib/meta-sync.ts`) | Intake seeds from the confirmed `BrandProfile` + tracked competitors. |
| Creator data source (already available) | **ScrapeCreators MCP** (`v1_instagram_profile`, `v1_instagram_search_profiles`, `v1_instagram_user_reels`, `v1_tiktok_profile`, `v1_youtube_channel`, `v1_find_social_profiles`) | The in-repo `lib/scrapecreators.ts` is **Ad-Library-only** and out of credits — do NOT extend it. |
| Auth | routes: `createClient()` + `supabase.auth.getUser()` → 401; pages: `getCurrentUser()` (`lib/app/user.ts`) | `/app/*` layout already guards. |
| DB | `lib/supabase/admin.ts` `createAdminClient()` (service role, bypasses RLS — scope every query by `user_id`) | RLS-on-no-policy = default-deny; only service role reads. |
| Timeouts | `lib/http.ts` `fetchWithTimeout(url, init, ms)` | Every outbound call must be time-bounded. |
| Nav + page | add `NavItem` to `lib/app/nav.ts`; new `app/app/influencer/page.tsx`; `components/app/tabs.tsx` | `app/app/market/page.tsx` is the 40-line template. |
| Empty/locked state | `components/app/gated-section.tsx` `GatedSection` | Use instead of placeholder data. |
| Design tokens | `app/globals.css` `:root` — `--surface`, `--ink`, `--ink-muted`, `--accent #0a66c2`, `--hairline`, `--good/warn/bad-*`, `rounded-[10px]` cards | Reuse `KpiCard`, `CollapsibleRows`, `EvidenceTag`, `CreativeThumb`, `AdLink`. |
| Test convention | `scripts/check-brand.ts` → `node:assert/strict`, ends `console.log("PASS: …")`; wire into `package.json` `check:all` (the CI gate) | Keep all discovery/scoring logic in pure `lib/influencer/*.ts` so it's assert-testable offline. |

### 0.2 Provider truth (drives the whole abstraction)
- **Audience demographics (location/age/gender/authenticity) — the thing that makes this NOT "a database" — come ONLY from Modash or HypeAuditor** (paid, ~$16.2k/yr and ~$249/mo+ respectively, modeled estimates, never ground truth).
- **ScrapeCreators & Apify = public profile + engagement only.** No audience demographics (ScrapeCreators has a TikTok-countries-only endpoint at 26 credits; IG/YT none). Cheap: ScrapeCreators ~$0.001–0.002/profile, credits never expire, cached calls free.
- **Meta (Business Discovery)** = ToS-clean, free within ~200 calls/hr, but **cannot see another creator's audience** — only public counts/engagement of Business/Creator accounts, IG only. Creator Marketplace Discovery API needs App Review (2–4 wks) and returns mocked data until approved.
- **Contact/email**: only the creator's **self-published public business email** is fair game. No private data, no login-gated scraping, no CAPTCHA bypass, meter it, and outreach is **draft-only**.
- **Adapter priority ladder** (stop at the first tier that answers; escalate cost/risk only when needed):
  1. **Meta official API** (ToS-clean, free, owned-account truth + cheap public metrics of others)
  2. **ScrapeCreators** (cheap bulk discovery + public engagement, multi-platform)
  3. **Modash primary / HypeAuditor secondary** (audience intelligence — *shortlisted creators only*)
  4. **Apify Actors** (flexible fallback for missing fields/platforms)
  5. **Browser automation** (last resort; logged-out public pages only; never behind login/CAPTCHA)
  This ladder *is* the progressive-enrichment cost model: tiers 1–2 are the cheap discovery layer, tier 3 is the expensive enrichment layer spent only on creators that already passed a free filter.

### 0.3 Anti-patterns (guard against these in every phase)
- ❌ Extending `lib/scrapecreators.ts` (Ad-Library only, out of credits). Build a new provider adapter instead.
- ❌ Hard-coding one provider. Everything goes through `CreatorDataProvider`.
- ❌ Fabricating any field (followers, engagement, audience, email, collab, pricing, authenticity). Missing = `null` + evidence `UNKNOWN`, never a fake `0`.
- ❌ Treating modeled audience data as fact — always carry `confidence` + `source` + `collectedAt`.
- ❌ Enriching every discovered creator (cost blowout). Enrich only the top-N after cheap filtering.
- ❌ A new UI system / auth / storage / logging. Reuse the design tokens + Supabase + existing patterns.
- ❌ Auto-merge. Phase 11 gate + human approval only.
- ❌ Building on a schema file — the live schema is authoritative and applied via the **Supabase MCP**; mirror SQL as `supabase/migrations/0007_influencer_hunt.sql` with a "applied via MCP" header (like `0006`).

---

## PHASE 1 — Isolation scaffold + feature flag + data model + provider interface (no external calls)

**Goal:** a self-contained, flag-gated module skeleton that compiles, renders a gated empty state, and
defines the data model + provider interface — with zero behavior change to the rest of AdBrain.

**Implement (copy, don't invent):**
1. **Feature flag.** No flag system exists → add inline `process.env.INFLUENCER_HUNT_ENABLED === "1"`.
   Read it in a tiny `lib/influencer/flag.ts` (`export const influencerHuntEnabled = () => process.env.INFLUENCER_HUNT_ENABLED === "1"`). Route handlers return `404`/disabled JSON when off; `lib/app/nav.ts` hides the nav item when off.
2. **Nav + page shell.** Add one `NavItem` to `lib/app/nav.ts` (conditional on the flag). Create
   `app/app/influencer/page.tsx` as an async server component mirroring `app/app/market/page.tsx`
   (Tabs: `Search` / `Shortlist` / `Compare`). Render `GatedSection` when the flag is off or no data.
3. **Data model** (apply via Supabase MCP `apply_migration`, then mirror as `0007_influencer_hunt.sql`).
   Service-role-only tables (RLS on, **no policy**), each with `user_id` + `account_external_id` scope,
   `source`, `collected_at`, `updated_at`, `confidence`, `version`. Tables: `influencer_creator`,
   `influencer_account` (per-platform handle), `influencer_audience_snapshot`, `influencer_content`,
   `influencer_search`, `influencer_search_result` (+ scores JSON), `influencer_contact`,
   `influencer_collaboration`, `influencer_competitor_rel`, `influencer_shortlist`,
   `influencer_provider_snapshot` (raw provenance), `influencer_memory`, `influencer_sync_state`
   (observability, like `ad_sync_state`). Composite PKs double as upsert conflict keys.
4. **Provider interface + normalized model** (pure `lib/influencer/provider.ts`):
   `interface CreatorDataProvider { name; capabilities; discover(spec); profile(handle); audience(handle); }`
   returning a `NormalizedCreator` with an **evidence envelope on every field**:
   `{ value, source: "VERIFIED"|"PROVIDER"|"PUBLIC_WEB"|"CALCULATED"|"MODEL"|"INFERENCE"|"UNKNOWN", collectedAt, confidence }`.
   Add a `StubProvider` (returns typed empty results) so the pipeline compiles before real adapters.
5. **Types + one runnable check.** `lib/influencer/types.ts` + `scripts/check-influencer-hunt.ts`
   (assert the evidence envelope never fabricates, dedup identity keying, tier boundaries). Wire both
   `check:influencer-hunt` and its entry in `check:all` in `package.json`.

**Verification:** `node --experimental-strip-types scripts/check-influencer-hunt.ts` prints PASS; `npm run build` green; with the flag OFF the nav item is hidden and every `/api/influencer/*` route 404s; `list_tables` (Supabase MCP) shows the new tables with RLS enabled and no policies; the rest of the app is byte-for-byte unchanged (no edits outside `lib/influencer/*`, `app/app/influencer/*`, `app/api/influencer/*`, one `nav.ts` line, `package.json` two lines, the migration).
**Anti-pattern guards:** no external calls yet; no writes outside the new tables; the flag default is OFF.

---

## PHASE 2 — Provider adapters (Instagram P0) + normalization + dedup

**Goal:** real creator data through the abstraction, Instagram first, cheapest tiers only.

**Implement:**
1. **ScrapeCreators adapter** (`lib/influencer/providers/scrapecreators.ts`) using the **MCP `v1_*`
   tools** via the app's own HTTP call to ScrapeCreators (new client, NOT `lib/scrapecreators.ts`):
   `discover` (keyword/hashtag → `v1_instagram_search_profiles`), `profile` (`v1_instagram_profile` +
   `v1_instagram_user_reels` for engagement), `audience` → returns `UNKNOWN` (not supported). Public
   fields only; every field wrapped in the evidence envelope with `source: "PROVIDER"`.
2. **Meta Business Discovery adapter** (`lib/influencer/providers/meta.ts`) via `getUserMetaSession` token
   → public counts/engagement of Business/Creator IG accounts (`source: "VERIFIED"` for first-party). No
   other-creator audience (returns `UNKNOWN`).
3. **Audience-intel adapter stubs** (`lib/influencer/providers/{modash,hypeauditor}.ts`) — full interface,
   real calls gated behind an env key that isn't set yet, so the code path exists and fails honestly
   ("audience intelligence requires a Modash/HypeAuditor key") instead of fabricating.
4. **Normalization + canonical identity** (`lib/influencer/normalize.ts`, pure): map each provider's raw
   shape → `NormalizedCreator`; canonical key = `platform:platform_user_id` (fallback handle→URL); merge
   duplicates across providers keeping the highest-confidence value per field.

**Verification:** `check-influencer-hunt.ts` extended — dedup collapses the same creator seen via two
providers; a provider miss yields `UNKNOWN` not `0`; audience without a specialist key returns an honest
"unavailable". Live smoke: `discover("women ethnic wear")` via ScrapeCreators returns real IG handles (or
an honest out-of-credits error, degraded gracefully).
**Anti-pattern guards:** no login-gated scraping, no CAPTCHA bypass, no fabricated audience data, all calls `fetchWithTimeout`-bounded, concurrency-capped worker pool (copy `competitors/run/route.ts`).

---

## PHASE 3 — Brand intake + natural-language search → transparent Creator Search Specification

**Goal:** the brand context drives the search; the user sees the parsed criteria before anything runs.

**Implement:**
1. **Intake** inherits the confirmed `BrandProfile` + tracked competitors + positioning (copy the
   `Promise.all` composition from `market/positioning/route.ts`). Required + optional fields per spec §10.
2. **NL parser** (`lib/influencer/search-spec.ts` + a route) — `callGeminiText` (grounded, no invention)
   converts "female Indian fashion creators 50K–500K, ≥3% ER, audience mostly India" → a structured
   `CreatorSearchSpec` (creator/audience/content/commercial/risk criteria). **Render the parsed spec and
   require confirm before search — never silently alter criteria.**
3. **Filter engine** (`lib/influencer/filters.ts`, pure) + **tier engine** (`lib/influencer/tiers.ts`,
   configurable by platform/geo/campaign/brand — no hardcoded universal follower bands).

**Verification:** `check-influencer-hunt.ts` — the NL example parses to the exact spec; filters include/exclude correctly at boundaries; tiers are config-driven. Live: parsed spec shown before search.
**Anti-pattern guards:** never mutate the user's stated criteria silently; the spec is shown + confirmed.

---

## PHASE 4 — Discovery pipeline (progressive enrichment + cost control)

**Goal:** the six-stage funnel, spending money only where it earns its keep.

**Implement** (copy the `ingest/ad-metrics.ts` streaming/idempotent-upsert shape): Stage 1 broad cheap
discovery (ScrapeCreators/Meta) → Stage 2 basic public filter → Stage 3 dedupe → Stage 4 **enrich top-N
only** (audience intel via specialist adapter, gated) → Stage 5 deep content analysis → Stage 6 rank.
Per-page upsert into `influencer_search_result`; `influencer_sync_state` observability row; cache
profile/audience snapshots + repeated search configs; **never re-enrich unchanged creators**; a
`GET` returns progressive results (initial → enriched) the UI polls (`auto-refresh.tsx`).

**Verification:** running the pipeline on a spec fills results incrementally; a re-run of the same spec
spends ~0 new credits (cache hit); enrichment is capped to top-N (assert the count). 1/10/100/1000-candidate
cases handled.
**Anti-pattern guards:** no deep enrichment on every candidate; no unbounded fan-out; every stage bounded + resumable; costs logged per run.

---

## PHASE 5 — Scoring engines (pure, fully transparent)

**Goal:** every ranking is explainable — inputs, weights, formula, reason, confidence.

**Implement** (all pure `lib/influencer/scoring/*.ts`, each with a `check-*` script):
Engagement engine (store provider ER + calculated ER + methodology + denominator + date + confidence —
never present one platform's formula as universal); Audience-Fit (target customer vs creator audience,
evidence-cited); Content-Fit (recent public content → category/topic/visual/UGC/demo/testimonial fit);
**Brand-Fit** (the differentiator — category/product/persona/audience/geo/tone/positioning/competitor
overlap; follower count must NOT dominate); **Creative-Fit** (connect to AdBrain's creative
gaps/winning-concepts/missing-personas — "which creator can make the creative the brand needs"); Quality
composite (configurable weights); Risk engine (engagement/growth anomalies, fake-audience indicators);
Freshness engine (per-field `source`/`collectedAt`/`freshness`/`confidence`, "updated N days ago").
Every score returns `{ score, components[], weights, formula, reason, confidence }`.

**Verification:** `check` scripts assert each score decomposes to its components and never returns a score
without evidence; a stale field is flagged, not treated as current; a low-confidence audience field
lowers, not fabricates, the fit score.
**Anti-pattern guards:** no unexplained rankings; no universal-engagement-formula claim; follower count is one capped input, not the driver.

---

## PHASE 6 — Contactability + evidence classification + freshness surfacing

**Goal:** only legitimately public business contact, with full provenance; nothing inferred.

**Implement:** `influencer_contact` rows carry `source`, `timestamp`, `status`
(`PUBLICLY_LISTED`/`PROVIDER_SOURCED`/`VERIFIED`/`UNVERIFIED`/`UNAVAILABLE`), `confidence`. Surface public
business email/phone/website/management only when self-published; never infer private contact. Outreach
artifacts are **drafts only** (project rule).

**Verification:** `check` — a private/absent contact yields `UNAVAILABLE`, never a guess; every contact field shows its source + freshness in the profile.
**Anti-pattern guards:** no inferred emails; no login-gated data; email metered; outreach never auto-sent.

---

## PHASE 7 — UI (reuse the design system)

**Goal:** the screens from spec §25–28, built entirely on existing tokens/components.

**Implement:** Dashboard (NL search box + parsed-spec confirm + result grid); **Search result card**
(§26 fields + View/Save/Reject/Shortlist/Compare/Contact; `CreativeThumb` for the photo, `EvidenceTag`
for provenance); **Creator profile** (§25 + a prominent "Why this creator?" evidence panel); **Compare
mode** (≤5, side-by-side scores + confidence); **Shortlist** workflow (schema supports the full CRM
lifecycle later; V1 keeps to Discovered→Shortlisted→Approved→Contacted). `GatedSection` for every empty
state.

**Verification:** each screen renders from real store data; every number shows freshness + confidence; no
new CSS system introduced (grep for hardcoded colors → none; all `var(--…)`).
**Anti-pattern guards:** no duplicate UI/design system; no placeholder/fabricated data in cards.

---

## PHASE 8 — Flagship "Find Best Creators"

**Goal:** one action → brand-first automatic pipeline → ranked top-20 with reasons.

**Implement:** a single entry (brand + campaign + market + optional filters) that auto-runs
understand-brand → build-spec → query providers → filter → dedupe → enrich top-N → vet → rank → return 20,
each with the Brand-Fit "why" and evidence. Progressive display (initial list, then enriched ranking).

**Verification:** end-to-end on the Soch account returns a ranked, deduped, explained shortlist; each
result carries audience/brand/content fit + confidence + a one-line reason; cost per run logged.
**Anti-pattern guards:** must feel like "AdBrain understood the brand, then found creators," not a raw search dump.

---

## PHASE 9 — Differentiators (post-MVP; only what earns its place)

Creator White Space (relevant + growing + underused by competitors); Emerging/Rising Creator score;
Creator→Paid-media loop *architecture* (design only — creator content → paid amplification → Meta ad →
revenue, to later learn which creators produce strong paid ads); Creator-specific brief generator
(never generic); Memory that improves future discovery (durable: fit, shortlists, rejection reasons,
collab outcomes — not every raw datapoint). Each behind its own flag/tab; implement only after §43/§44
review confirms real value.

---

## PHASE 10 — Red team, testing, security/compliance, cost/perf, quality gates

Run the §41 test matrix (1/10/100/1000, duplicates, zero results, missing/stale/conflicting data, missing
email/audience, provider failure, rate limit, network failure, invalid URL, very narrow/broad queries).
§42 failure analysis (follower bias, stale data, fake engagement, sample bias, provider conflicts,
duplicate identities, bad audience inference) — fix high-impact. §39 security/compliance review
(public-data-only, no login/CAPTCHA bypass, rate-limit respect, encrypted keys). §44 independent critical
review (CTO/CMO/media-buyer/founder/security/investor lenses) — cut vanity metrics + weak scoring. §45
quality gates all green.

**Verification:** `npm run check:all` green (new checks included); §45 checklist all ticked; existing-product regression checks pass unchanged.

---

## PHASE 11 (FINAL) — Verification + controlled merge

**Verify:** every score explainable; every field has provenance + freshness; nothing fabricated; costs
controlled; the §48 success test answers YES ("a DTC brand enters brand/campaign/audience/competitor
context and receives a ranked, evidence-backed, contactable shortlist with a clear why per creator"). If
NO → return to the failing phase, build the gap, re-verify.

**Merge process (NOT automatic):** isolated build → unit tests (`check:all`) → integration test (live
smoke) → security review → performance review → regression (existing app unaffected, flag OFF = no change)
→ dependency review → **human approval** → merge. Ship the flag OFF; enable per-account.

---

## Deliverables map (spec §47 → phases)
PRD/architecture/provider-architecture → P0–P1 · data models/search schema/DB → P1 · provider adapters → P2 ·
brand-fit/audience-fit/content-fit/creative-fit/risk/engagement/freshness logic + scoring formulas → P3,P5 ·
contactability → P6 · UI/dashboard/profile/compare/shortlist → P7 · flagship → P8 · memory + white-space +
creator→paid → P9 · testing/perf/cost/security → P10 · feature-flag/integration/rollback → P1,P11.

## Open decisions for Rahul (blocking the paid-audience-intelligence layer)
1. **Audience intelligence is the differentiator and it costs money.** Modash (~$16.2k/yr) or HypeAuditor
   (~$249/mo+) is the only way to get real audience demographics + authenticity + reliable email. Which
   (if either) do we commit to? Until then, the module ships with cheap public-signal discovery
   (ScrapeCreators/Meta) + honest "audience data unavailable" — still useful, but not the full vision.
2. **ScrapeCreators credits** — the cheap discovery layer needs its credits topped up (currently empty).
3. **Meta Creator Marketplace API** (optional, later) needs App Review (2–4 weeks) — worth starting only
   if we want first-party IG creator discovery.

## Build status — updated 2026-08-29 (provider-independent core DONE)
The entire provider-INDEPENDENT brain is built, committed, and regression-protected in `check:all`.
Nothing below needs a paid provider; everything is pure + feature-flagged (`INFLUENCER_HUNT_ENABLED`),
so the rest of AdBrain is untouched until the flag is on.
- Foundation: evidence envelope + types, tiers, dedup, provider interface, flag, 9 DB tables (migration 0007).
- Path A audience proxy (`audience-proxy.ts`) — honest commenter-sample estimate, confidence capped medium.
- Scoring engines (P5, `scoring/`) — brand-fit (relevance, follower count EXCLUDED), audience-fit, content-fit,
  engagement, risk, and the quality composite. All decompose to explainable components; confidence tracks
  the weakest usable input; missing data scores 0 with confidence none (never a fabricated number).
- Ranking orchestrator (P6, `rank.ts`) — dedupe→hard-gate→score→deterministic rank. Order is purely the
  quality formula, tie-broken by confidence/engagement/id, NEVER follower count (reach can't dominate relevance).
- Checks: `check-influencer-hunt.ts`, `check-influencer-scoring.ts`, `check-influencer-rank.ts` — all in `check:all`.

STILL BLOCKED on Rahul's decisions above (paid provider / ScrapeCreators credits / Meta App Review) — those
unlock the provider adapters (P2) that actually fetch real creators. UI/nav wiring (P7) deferred while a second
build session is active in the repo (shared-file merge hazard).
