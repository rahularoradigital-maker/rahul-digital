# Phase 0 — Consolidated Findings + Proposed Phase 1 Plan (READ-ONLY; hold for review)

Synthesis of the 5 Phase-0 readers (01 architecture · 02 business-logic/formulas · 03 reliability/scale/data ·
04 security/tenancy/AI · creative-intel/SEO). Findings that MULTIPLE readers hit independently are flagged
[triangulated] — those are the highest-confidence.

## Executive summary
The **foundations are genuinely strong**: deterministic engines ("math decides, AI narrates"), encrypted tokens
with default-deny RLS, a fail-closed access gate, real materiality/attribution gates on fatigue and the Judge,
honest JSON-LD, resumable idempotent sync. The problems cluster in four themes:
1. **Primitives built but not wired to every path** (access gate, RLS, RBAC, tenancy model, injection fence, AI budget).
2. **Trust surfaces that look rigorous but aren't applied** (confidence de-rating is cosmetic; three different
   "enough to judge" floors; AI labels feed a recommendation with no confidence gate).
3. **Request-time full recompute over unbounded rows** — the first hard scaling wall.
4. **Fabricated marketing claims** on the public homepage that violate the product's own no-fabrication rule.

## Prioritized findings

### P0 — correctness / security / trust / legal (fix first)
- **[SEC] Access gate bypassed on POST handlers** (concepts/brand/profile) and the regression gate only checks a
  file-level string. A non-entitled user can burn AI spend + write. `check-access-gate.ts:52`. (04·S1)
- **[SEC] ~8 CONFIDENTIAL tenant tables have no RLS + aren't in any migration** (cockpit_cache, brand_profiles,
  creative_insights, cp_assets, cp_generations, ask_log, demo_requests, competitor_creative_analysis). Isolation
  rests 100% on hand-written `.eq("user_id")`. (04·S2) [triangulated with 01·risk4]
- **[TRUST] The confidence de-rating is cosmetic** — the banner says "de-rated X%" but no code applies it to any
  number shown. `app/app/page.tsx:111`. (03·D1)
- **[TRUST] Three inconsistent volume floors on the same ad** (conv 15/50/100; awareness 10k/1,000,000) run in
  parallel and can contradict each other. (02·R1) [triangulated: 02, 03·D3]
- **[LEGAL/TRUST] Fabricated homepage claims** — invented testimonials + a "+38% ROAS" case study attributed to
  real named brands, "trusted by hundreds," and unverifiable "SOC 2 Type II" / "certified Meta Partner" badges.
  Contradicts the blog's own "we do not invent statistics." `app/page.tsx:23`, `components/marketing/static-sections.tsx`. (SEO·B1)

### P1 — high economic-impact correctness + hardening
- **[TENANCY] org→brand→account isolation not enforced on data paths** (only 2 of ~41 routes use it); a
  member/viewer in a multi-member org isn't restricted on reads. (04·T1) [triangulated: 01·risk4]
- **[AI] Cost ceiling fail-open + blind without Upstash** — no per-request hard cap; daily alarm sees 0 calls. (04·A1)
- **[RIGOR] Hard-coded universal benchmarks inside scored numbers** (roasToScore 0.5, ctrToScore 0.015) drive
  Account Health + objective scores — violates `MEASUREMENT-CANON` rule 1. (02·R2)
- **[RIGOR] `trendScore` + percentiles have no volume gate** (tiny÷tiny; trend is 30% of CreativeScore) — the
  same class as the half-life bug. (02·R3)
- **[RIGOR] AI decode labels feed the "produce more X" recommendation with no confidence gate** (canon requires
  ≥97%). (02·R5) [triangulated: SEO·A1 diversity whitespace has no min-evidence gate]
- **[DATA] The rich data-quality engine is dead code**; the live shallow one misses duplicates/missing-days/
  tracking-shift/staleness, so impossible funnels never gate a recommendation. (03·D2)
- **[RELIABILITY] Headline totals silently shrink** when the account-level scope call fails — undercounts KPIs, no
  flag. (03·F1)
- **[SCALE] Whole brain recomputed at request time over all rows, twice** — the first hard wall on big accounts.
  (03·S1/P3.1/P3.2) [triangulated: 01·risk2]
- **[SEO] Canonical-domain default split** — `SITE_URL` defaults to `rahul-digital.vercel.app` in 6 files vs
  `adscaledigital.co` elsewhere; if prod env is unset, canonicals/OG/sitemap point at the preview domain. (SEO·B2)

### P2 — correctness nuance, hardening, tech-debt
Store activation all-or-nothing + silent (F2); no sync concurrency lock + no Meta rate governor (F3/S5); SSRF on
`fetchSiteText` (S3); injection fence not on scraped-HTML path (A3); positioning GET scoped by user not account
(T2); inconsistent scope keys (T3); RBAC dead code (S5); unaudited privileged mutations (S4); diversity mixes
visual+strategic axes and collapses raw-vs-effective (SEO·A2/A3); winner score has no INCONCLUSIVE state (SEO·A4);
timezone/currency silent fallback (D4); giant CACHE_SCHEMA blob; stale doc `ARCHITECTURE.md`; live Meta calls on the
store hot path (P3.4).

## Proposed finite Phase 1 (correctness + security) — with finish lines, NO scope creep
> Charter Phase 1 = "wrong numbers / scope / formulas / attribution / freshness / account isolation." Each slice
> ships behind the assurance-plane gates + a live-test + a permanent regression check.

- **1A — Security wiring (P0).** `guardProductApi()` first line of every handler + rewrite `check-access-gate.ts`
  to assert per-handler; add the 8 tables to migrations with RLS deny-all. *Finish: gate green per-handler; RLS
  present + a check that fails if a CONFIDENTIAL table lacks RLS.*
- **1B — Make trust real (P0).** Apply the confidence de-rating to surfaced numbers (or reword) ; unify the three
  volume floors into ONE shared trust gate consumed by all three engines. *Finish: one gate, a check that the
  engines read the same floor, live-verified on a real account.*
- **1C — Remove fabricated claims (P0, legal).** Replace the homepage testimonials/case-study/badges with honest
  copy (or gate behind real, substantiated data). *Finish: zero unverifiable third-party claims live.*
- **1D — Canonical domain (P0/P1).** Make `adscaledigital.co` the default in all 6 files (or guarantee the env).
  *Finish: canonical/OG/sitemap/robots all resolve to the real domain live.*
- **1E — AI cost fail-closed (P1).** Per-request hard cap; missing counter → "cap, not 0". *Finish: check + live.*
- **1F — Account-relative baselines (P1).** Replace the universal roas/ctr constants with account/objective-relative
  baselines; add a volume gate to trendScore/percentiles. *Finish: canon rule 1 satisfied; regression check.*

Everything else (scale/precompute = Phase 5; diversity semantics + winner INCONCLUSIVE = Phase 2 diagnostics;
RBAC/tenancy-model wiring = its own security slice) is sequenced AFTER, not now.

## Release / verification plan (per slice)
Assurance-plane gates green (Data/Logic/AI/Security/Tenancy/Cost/Regression) → typecheck + lint + `check:all` →
one edge case + one failure case → deploy → **live-verify on a real account** → record the learning + a permanent
regression check. No slice is "done" until live-verified; every fixed bug leaves a check behind.

## STOP — hold for review
No code changed in Phase 0. Awaiting Rahul's go on the Phase 1 order (recommended: 1A→1C→1B→1D→1E→1F).
