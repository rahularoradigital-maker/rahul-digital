# AdBrain Decision Log

Settled decisions, so we stop re-litigating them. If you want to reopen one, change
its status and say why. All dates 2026-08-25. Decider: Rahul (owner); architecture
decisions co-owned with Claude (implementer). Governing docs linked per entry.

---

### D1 — Build the full product, but phased (not all at once)
- **Decision:** Build the deepsolv-style SaaS as a real MVP, in sequenced phases, not one big bang.
- **Context:** "Build this from zero" for a full SaaS, non-technical owner, goal = MVP for first users.
- **Options:** all-at-once full platform; clickable prototype; phased MVP.
- **Rationale:** phasing is the only way a solo non-technical owner ships something usable instead of nothing for months.
- **Status:** Active. **Revisit-by:** if a co-founder/team joins (parallelism changes the math).
- Governs: `docs/superpowers/specs/*`.

### D2 — Managed, low-ops stack
- **Decision:** Next.js + Supabase (auth/DB) + Vercel + an AI API. No self-hosted infra.
- **Context:** Non-technical owner; Claude runs all code.
- **Options:** custom backend/infra; various hosts/DBs.
- **Rationale:** nothing to patch or babysit; generous free tiers; one codebase.
- **Status:** Active. **Revisit-by:** if scale/compliance outgrows managed tiers.

### D3 — Brand Brain = knowledge-graph triples in Postgres
- **Decision:** Store learned facts as subject-predicate-object triples in a Postgres `triples` table. No separate graph DB.
- **Context:** Owner asked for a knowledge-graph "Brand Brain."
- **Options:** loose text notes; a dedicated graph DB (Neo4j); Postgres triples table.
- **Rationale:** queryable and auditable without new infra; Neo4j is overkill at MVP scale.
- **Status:** Active. **Revisit-by:** if graph traversal outgrows SQL.

### D4 — Ship under "AdBrain," not deepsolv
- **Decision:** Own brand/name; never deepsolv's identity.
- **Context:** Replicating deepsolv's product for real users.
- **Options:** clone deepsolv branding; use our own.
- **Rationale:** cloning a real company's brand is trademark infringement / impersonation.
- **Status:** Active (name is a placeholder). **Revisit-by:** when a final brand name is chosen.

### D5 — Data source: ScrapeCreators (replaced Apify)
- **Decision:** Use ScrapeCreators' Facebook Ad Library endpoint for competitor ads.
- **Context:** Need commercial Meta ad data; owner wants free tools.
- **Options:** Apify Ad Library scraper (~$0.001/ad); ScrapeCreators (free tier, then paid); Meta Ad Library API (political ads only, unusable).
- **Rationale:** owner chose ScrapeCreators; free tier fits MVP; Meta's own API can't return commercial ads.
- **Status:** Active. Supersedes the earlier Apify choice. **Revisit-by:** if free credits run out or data quality is poor.

### D6 — AI: all-Google Gemini (Claude dropped)
- **Decision:** Gemini for all analysis and reasoning, including native image AND video. Remove Claude from the project.
- **Context:** Owner wants Google + free tools.
- **Options:** Claude; Google Cloud Vision (OCR only); Gemini multimodal.
- **Rationale:** Gemini reasons over image and video natively on a free tier, which also deleted ffmpeg + transcription + the queue (see D7).
- **Status:** Active. **Revisit-by:** if Gemini free-tier limits or quality block the product.
- **Implementation status (2026-08-25):** NOT yet applied. Phase 0 code still uses Claude
  (`lib/anthropic.ts`, `app/api/health/claude`). The Gemini swap is a Phase 1 build step. Until
  then, docs (Gemini) and code (Claude) intentionally differ. See audit F1.

### D7 — No heavy video pipeline (Gemini native video)
- **Decision:** No ffmpeg frame extraction, no separate transcription, no external queue. Gemini ingests video directly.
- **Context:** Owner wanted full video analysis; earlier ADR-0001 planned a queue+ffmpeg+ElevenLabs worker.
- **Options:** ADR-0001's queue-driven worker; Gemini native video.
- **Rationale:** Gemini native video makes the heavy pipeline unnecessary and keeps it free/low-ops.
- **Status:** Active. **Supersedes ADR-0001.** Governs: `docs/adr/ADR-0001-*` (Superseded).

### D8 — PIVOT: own-account-first cockpit
- **Decision:** Phase 1 = connect your Meta/Google ad account, pull YOUR data, show an action cockpit. Competitor intel becomes one section (Share of Voice). OAuth pulled forward from Phase 2.
- **Context:** Owner supplied a warm-paper action-cockpit reference and said "step 1 = connect accounts, then pull data."
- **Options:** own-account-first; competitor-first (keep, adopt look only); both at once.
- **Rationale:** the reference is an own-account dashboard and the owner prioritized connect-then-pull.
- **Status:** Active. Supersedes the competitor-first Phase 1 spec. Governs: `docs/superpowers/specs/2026-08-25-phase-1-account-cockpit-design.md`.

### D9 — Full 9-section cockpit in v1
- **Decision:** All 9 reference sections ship in v1 (verdict, reads, funnel, will-break, do-this queue, waste, leaderboard, SOV, concepts, history).
- **Context:** Scoping the first cockpit build.
- **Options:** lean action core; core + money/breakage; full cockpit.
- **Rationale:** owner chose completeness over a thin first slice.
- **Status:** Active, **re-affirmed 2026-08-25** after the opportunity analysis
  (`docs/discovery/feature-request-analysis.md`) recommended a leaner core. Owner chose to keep
  all 9. Do not re-litigate. **Revisit-by:** if the build stalls / time-to-usable becomes a problem.
  (Trade-off accepted: weeks, not days, to usable; some sections unvalidated.)

### D10 — Adopt the warm-paper action-cockpit design language
- **Decision:** Warm paper palette, Schibsted Grotesk + JetBrains Mono, action-dashboard ethos, "show the working" drawer. Retire Phase 0's indigo/dark look.
- **Context:** Owner provided the reference and said "want UI/UX like this."
- **Options:** keep Phase 0 indigo/dark; adopt the reference.
- **Rationale:** the reference is distinctive and anti-slop; Phase 0's look was generic.
- **Status:** SUPERSEDED (2026-08-25) by **D10b**. Kept as history.

### D10b — Adopt the telli.com design system (owner's handoff)
- **Decision:** Design system = telli.com style from the owner's design handoff: bg `#F7F7F7`,
  ink `#252525`, accent blue `#038BF7` (accent only, never a field), Inter, 70px pill / 10px card
  radius, LIGHT (400-weight) headlines. Brand = "AdBrain AI". Marketing structure + an 11-screen
  web app defined in the handoff.
- **Context:** Owner supplied `Metris slide deck design.zip` (4 .dc.html artboards + HANDOFF.md)
  saying "here is design." Its product principles match the master brief.
- **Options:** keep the warm-paper reference direction (D10); adopt the telli handoff.
- **Rationale:** owner explicitly provided it; it's a complete, aligned system with real artboards.
- **Status:** Active. Supersedes D10. Governs `DESIGN.md`; source `docs/design/HANDOFF.md` + `*.dc.html`.

### D11 — Winning signal = longevity + impressions (with fallback)
- **Decision:** Treat long-running, high-impression ads as proven winners; fall back to active + variant-count if impressions/date are unavailable.
- **Context:** No own-performance data in the original competitor-first plan.
- **Options:** longevity+impressions; +manual thumbs; analyze-everything-equally.
- **Rationale:** classic Ad Library arbitrage; needs no owner data. (Now mostly applies to the SOV/competitor section post-pivot.)
- **Status:** Active. **Revisit-by:** once own-account performance data is the primary signal.

### D12 — Write-back safety: manual-apply default, never auto-apply
- **Decision:** Recommendations only stage; applying changes to a live ad account requires an explicit, confirmed action. v1 = show the exact change, owner applies in Meta. No auto-apply.
- **Context:** The cockpit's Apply pushes real money-moving changes.
- **Options:** auto-apply; API write-back with confirm; manual-apply.
- **Rationale:** pausing ads / moving budget is payment-adjacent and irreversible; safety first.
- **Status:** Active. **Revisit-by:** when adding opt-in API write-back (needs dry-run + per-batch confirm + audit). Governs: cockpit spec §7, principle #6.

### D13 — Token storage: app-layer AES-256-GCM in a service-role table
- **Decision:** Store OAuth tokens with app-layer envelope encryption in a service-role-only Postgres table; master key server-env only; server-side OAuth; `AdSource` abstraction; Vercel Cron incremental sync.
- **Context:** OAuth tokens can spend the owner's money (top P1 risk).
- **Options:** app-layer envelope encryption; Supabase Vault; external secrets manager.
- **Rationale:** standard pattern for per-user tokens; in-stack, free, scales; Vault is the wrong shape, external manager is overkill for MVP.
- **Status:** Active. Governs: `docs/adr/ADR-0002-*`.

### D14 — Six design principles adopted
- **Decision:** Decisions over dashboards; show the working over "trust us"; money over metrics; one honest number over five; distinctive over default; confirmed over automatic (on money).
- **Context:** Repeated design/product arguments this session.
- **Rationale:** each was derived from a real call and takes a side.
- **Status:** Active (+1 on probation: "real data over rules of thumb"). Governs: `DESIGN.md §0`.

---

### D15 — Production, at 10k users/day scale (design-for-scale, provision-for-now)
- **Decision:** AdBrain ships as a live web product designed for 10k DAU. Build the MVP behind
  clean seams (queue, cache, AdSource) so scaling is a swap, not a rewrite. Fingerprint-once is the
  primary cost control. Production-readiness gates (security/privacy/legal/ops) are blocking before launch.
- **Context:** Owner: "going live on the web, not an artifact" + "plan it for 10k users/day."
- **Rationale:** free tiers fail at ~20 users; a rewrite later is the expensive thing; seams avoid it.
- **Status:** Active. Supersedes ADR-0003 (MVP queue) for scale. Governs `docs/adr/ADR-0004`,
  `docs/production-readiness.md`, the approved 10k plan.

### D16 — Adopt the owner's buyer-judgment rulebook (logic yes, identity no)
- **Decision:** The rules and logic from the owner's prior tool's rulebook (spend floor at ingest,
  same-objective comparison, the causality ladder, exposure-curve fatigue + death dates, trust
  gates, source-connection confidence ladder, change-log attribution, verdict engine, four-reference
  blend, ledger outcome loop, the 28 situations as acceptance criteria) are adopted as the
  judgment source of truth — de-branded (no prior-tool name, styling, or identity). Where they
  conflict with earlier softer spec language, the judgment rules win. Thresholds enter as
  INTERNAL CALIBRATION (owner-decided anchors, editable), not as fabricated truth.
- **Context:** Owner supplied the rulebook + winner/loser framework + metric breakdown and asked
  to use the logic without the identity.
- **Rationale:** it encodes concrete top-buyer judgment our spec lacked; our engineering/honesty
  architecture (fact labels, validator, tested code) is kept — the merge is strictly stronger.
- **Status:** Active. Governs: `docs/product-spec/buyer-judgment-rules.md` (J1-J15 + integration order).

## Superseded / historical
- **ADR-0001** (queue+ffmpeg+ElevenLabs video worker) — superseded by D7.
- **Competitor-first Phase 1 spec** — superseded by D8.
- **Apify data source** — superseded by D5. **Claude as primary AI** — superseded by D6.

## D-audit-1 (2026-09-02) — Phase-0 audit execution: how store-derived pages are cached
- **Decision:** pages that render a store-derived read (`/app/changes`, `/app/funnel`) cache the computed result in the platform data cache (`unstable_cache`), keyed by user + account (+ exact topbar scope + date where the window rolls daily), with a 6 h TTL backstop and ONE shared tag `accountStoreTag(user, acct)` (`lib/cache.ts`) that the change-history ingest busts on every successful hop. Request APIs (`cookies()`) are resolved outside the cached function.
- **Rejected:** the in-process `InMemoryCache` (does not survive across serverless invocations); the `"use cache"` directive (needs a `next.config` flag = infra change, a stop condition); per-page tags (each page inventing its own invalidation).
- **Consequence:** first view after a deploy or a sync primes (slow); every view after reads (`/app/changes` 11.1 s → 1.6 s measured). A stale read is bounded by the next ingest hop or 6 h.

## D-audit-2 (2026-09-02) — Store paging is parallel, through one reader
- **Decision:** all PostgREST 1,000-row paging goes through `readAllPages` (`lib/supabase/paged.ts`): page 1 alone, then parallel bursts of 8 until the first short page. Every `ad_metrics` reader orders by `ad_id + date` (a total order); `ad_meta` by `ad_id` (unique).
- **Why:** 8 hand-rolled serial loops in 5 files paid one round-trip per page; three of them ordered by `ad_id` only, which has no offset-paging stability guarantee in Postgres.
- **Ceiling (ponytail):** a burst may issue a few empty ranges past the end. Upgrade path: a count-first head query.

## D-audit-3 (2026-09-02) — Heavy per-row UI renders on the client, previewed
- **Decision:** a report that renders hundreds of per-entity cards is a client component that receives the report data and renders a bounded preview (20 per section) with "Show all"; nothing is dropped. Applied to `FunnelReportView` (8.58 MB → 1.25 MB per view).
- **Why:** a server component's RSC flight carries every element tree on top of the SSR HTML — 35 KB per ad here.

## D-audit-4 (2026-09-02) — Audit deliverables live in one document, not fifteen
- **Decision:** the requested ARCHITECTURE / SECURITY / PERFORMANCE / SEO / A11Y / UX / OBSERVABILITY / BLOAT / DEPENDENCY audits, refactor plan, and before/after measurements are sections A–K + the execution log of `docs/PHASE-0-AUDIT-2026-09-02.md`; decisions go here; the changelog is the root `CHANGELOG.md`; the handoff is `docs/TECH-HANDOFF.md`.
- **Why:** the audit itself found 161 docs / 13 prior audits and a duplicate `ARCHITECTURE.md`; fifteen more top-level files would add to the sprawl it was asked to reduce. Rahul can ask for the split.

## D-rollups (2026-09-02) — instant-app materialized rollups (10x #5)
- **Decision:** expensive whole-account + top-creative aggregates are computed ONCE when a sync completes and stored in `account_rollups` (0035) / `creative_rollups` (0036); reads are a single indexed row. Same pure math as the live path (`computeScopes`, and per-ad aggregation), just moved off the request path. Every read path self-heals (computes + stores on a miss) so it works before any sync and never shows an empty screen. RLS default-deny (service-role only), like `ad_metrics`.
- **Population:** sync-complete hooks (`ingest/run`, `cron/sync`) refresh both rollups; a cheap store-only `/api/cron/rollups` and an admin `/api/admin/rollups` can refresh all accounts without a Meta call. `check:rollup-wiring` guards that the wiring is never silently dropped.
- **Creative flag:** winner/wasting/steady judged against the ACCOUNT's OWN average ROAS, gated to ads that spent ≥1% of account spend (scale-free; no fabricated rupee threshold) — a tiny-budget ad is "steady", never a false winner.
- **Why not the in-process cache / a new cron:** the data cache and rollups survive across serverless invocations; a third Vercel cron would risk Hobby's cron cap, so the existing sync hooks drive population.

## D-verify (2026-09-02) — self-proving accuracy, store vs Meta (10x #1)
- **Decision:** `/api/account/verify` proves our stored headline against an INDEPENDENT source — a fresh live Meta pull (`fetchScopeInsights`) — via the intelligence `reconcile()` engine, returning match / minor_drift / conflict + a `trustworthy` flag (Rule 129: on conflict, never silently trust the nicer number). On-demand only (one aggregate Meta call), off every hot path. **Fails honest:** if Meta is unreachable it returns 502 with NO verdict rather than claiming agreement.
- **Trend, not one-off:** each check is logged to `account_verifications` (0037, append-only); the clean-streak + latest status are read back cheaply and surfaced on `/api/account/summary.trust` and `/api/health` (recent conflicts) with no extra Meta call.
