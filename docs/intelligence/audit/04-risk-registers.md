# Phase 0 Audit — #10 Security + #11 Data-Quality + #12 AI + #13 Creative-Intelligence + #14 Tenancy + #16 SEO (READ-ONLY)

Fresh full-repo forensic read (2026-09-01). Evidence is `file:line`. No code changed. Extends
`docs/production-readiness.md`. Headline: **no AI call owns a financial number and no live cross-tenant
leak was found — the real exposure is (a) a data-quality signal that is computed but never used, (b) the
injection fence bypassed on the most attacker-controllable inputs, and (c) tenant isolation resting on
convention with no DB-level test.**

## #11 Data-quality risks

| ID | Risk | Evidence | Sev |
|---|---|---|---|
| DQ-1 | **`confidencePenalty` is display-only — never touches a decision.** `decide()` takes no dataQuality arg; the penalty renders as a banner while per-ad cards keep their own 70-85% confidence. A `zero_revenue_with_spend`/`spend_shock` account can show "confidence de-rated 45%" AND "DO NOW: Pause · 80%" side by side. | `decision.ts:92,105`; `page.tsx:102-123`; consumed nowhere else | **HIGH** |
| DQ-2 | **No independent revenue reconciliation.** `reconcile/scopes.ts` compares AdScale-whole vs a filtered Meta view — SAME Meta source. Meta-reported ROAS is ground truth for every waste/marginal/scale decision. Shopify products synced but never cross-checked vs Meta revenue. | `reconcile/scopes.ts:30-40`; `shopify_products` unused in reconcile | **HIGH** |
| DQ-3 | **Richer data-quality engine is orphaned dead code.** `lib/data-quality.ts` detects MISSING_DAYS/DUPLICATE_ROWS/STALE_DATA/TRACKING_SHIFT/ZERO_DENOMINATOR — none in the wired `scoring/` version — and has ZERO importers. The freshest/most-dangerous checks never run. | `lib/data-quality.ts:40`; no importers | MED |
| DQ-4 | **`zeroRevenueWithSpend` is only a warning** and doesn't stop the ad-level ROAS-0 -> loser/pause path (`analyze.ts:239`). A tracking-down ad reads ROAS 0 and can be surfaced as a loser. | `data-quality.ts:119`; `analyze.ts:239` | MED |
| DQ-5 | **Objective asymmetry** — awareness ads get the strict volume-gated `decide()`; sales ads get `verdict()`; the two paths do not share thin-data discipline. | `analyze.ts:254-264` | MED |
| DQ-6 | **"Underfunded — room to scale" not data-quality gated** — a spend-shock / tracking gap can distort the log-log elasticity into a wrong scale/cut call, gated only by marginal's own R²/day confidence. | `page.tsx:126`; `marginal.ts` | MED |

## #12 AI risks

| ID | Risk | Evidence | Sev |
|---|---|---|---|
| AI-1 | **Injection fence bypassed on scraped brand homepage HTML** -> Brand DNA. `deriveJSON` structurally cannot fence. Highest-exposure external, attacker-controllable input. | `brand-dna.ts:61-62`; `llm-json.ts:8` | **HIGH** |
| AI-2 | **Fence bypassed on competitor ad copy** from Meta Ad Library scrape — adversarial content a rival can seed. | `agents/creative/agents.ts:55` | **HIGH** |
| AI-3 | Fence bypassed on Shopify product text + own ad copy. | `product-dna.ts:45`; `brand/profile.ts:48-68` | MED |
| AI-4 | **Numeric-grounding verifier exists ONLY on the Ask route.** Brand DNA, concepts, competitor attributes, and narration have no anti-hallucination check yet drive user-facing strategy. | `ask/route.ts:117-131` only | MED |
| AI-5 | **Silent text-task fallback** — user is never told which model answered or that a degraded fallback was used (creative production IS transparent via generation-state). | `ai/router.ts:28-33` | LOW-MED |

Good (preserve): no AI owns a number (verdicts/ROAS/waste/marginal all deterministic); `narrate()` is
fenced and forbidden from changing a verdict (`judgment/agent.ts:120-132`); whole DB never sent to a model
(Ask sends a compact computed snapshot); cost tracking is per-call USD, per-user, kill-switch-honored,
budget-capped (`ai/spend.ts`, `budget.ts`, `router.ts:25`). The fence itself (`lib/ai/compose.ts`) is
genuinely good — it is just used only ~half the time.

## #10 Security risks
- The foundation shipped is real: immutable append-only `audit_log` (0015), `system_flags` kill switches
  honored in `ai/router.ts` (0016), RBAC catalog + `CONTROL_PLANE_ONLY` least-privilege (`check-rbac`),
  5-tier data classification with `unknown -> CONFIDENTIAL` fail-safe, SSRF guard (`check-ssrf`), access
  gate default-deny (`check-access-gate`), encrypted OAuth tokens (AES-256-GCM, RLS default-deny, server-only).
- Open items (from `production-readiness.md`, still standing): no password-reset flow; no error tracking
  (Sentry); legal pages (privacy/ToS) missing; confirm `CRON_SECRET` is set in Vercel (background sync is
  off until it is). The two NEW security findings this audit adds are AI-1 and AI-2 (unfenced external text).

## #14 Tenancy risk (the gap Rahul suspected — CONFIRMED)
- No cross-tenant leak found across ~100 sampled service-role sites: every risky admin query checked
  includes `.eq("user_id", …)` (+ account/shop/brand). Cockpit cache is tenant-scoped at L1
  (`memKey = ${userId}:…`, `meta-sync.ts:668`) and L2 (`user_id+cache_key`); fingerprint caches
  (`creative_semantics`, `competitor_creative_analysis`) are per-user. `brand/select` activates `acct.id`
  with no `user_id` filter but is pre-validated through `resolveUserContext`/`canAccessBrand`.
- **The gap:** isolation is enforced by CONVENTION only — a manual `.eq("user_id", …)` on ~100
  RLS-bypassing `createAdminClient()` reads. `scripts/check-tenancy.ts` tests only the pure `access.ts`
  logic; it NEVER exercises a real DB query and there is no RLS integration test. One omitted filter is a
  silent cross-tenant leak with nothing to catch it. (No live leak today; the exposure is the absence of a
  DB-level guarantee/test.) **This is the single highest-severity structural gap in the app.**

## #13 Creative-intelligence risks
- Fabricated-proof / fake-UI is largely CLOSED: `deriveGenerationState()` honestly stamps
  `COMPOSITOR_ONLY` vs `AI_GENERATED[_WITH_FALLBACK]`; QA hard-fails `visualMissing` and never returns READY
  on a critical fail (`qa-engine.ts:126`); the stub placeholder is state-tagged, not passed off as a real ad.
- **CI-1 (residual): in-scene product fidelity QA is skipped.** When the model edits the real SKU into the
  scene (`productInScene=true`), `pipeline.ts:120` sets `productFidelityRisk=false` UNCONDITIONALLY — no
  visual diff vs the reference. A hallucinated/distorted product passes `product_fidelity` QA and can ship as
  a "faithful" ad. `text_accuracy` trusts hardcoded `textPixelsPresent:true` (acceptable only because
  `compose()` draws deterministic SVG text).
- Good: the semantic decode does NOT fabricate dimensions — returns `null` and reads on `format` alone when
  copy/vision is absent (`decode.ts:60,70-72`); agents emit `'none'` for a genuinely-absent attribute.

## #16 SEO / public-site risks (reference, not re-audited here)
Canonical home is `docs/AEO-GEO-SEO-CHECKLIST-2026-09-01.md`, `docs/BLOG-SEO-REDO-2026-09-01.md`,
`docs/OFF-PAGE-GEO-PLAYBOOK-2026-09-01.md`; enforced by `check:seo-metadata` + `check:brand-consistency`.
Known standing item: production deploys were paused (credits) per project memory — verify the public site is
live and indexable before counting SEO as done. No new code risk surfaced in this pass.

## Where the system can show a CONFIDENTLY-WRONG decision (consolidated, ranked)
1. **"DO NOW: Pause/Scale · 80%" next to a "low-confidence / tracking gap" banner** — the penalty never
   de-rates the card (DQ-1).
2. **`metricVsMedian` proxy flips SCALE/KILL** — a percentile is mislabeled as a ×median ratio and drives the
   Triple-Label agreement (`analyze.ts:352`; see `02-business-logic-formulas.md`). Confidently wrong by
   construction, not just noisy.
3. **"Underfunded — room to scale" green CTA** from an elasticity fit distorted by an ungated spend-shock (DQ-6);
   marginal's `R²=1`-on-flat-revenue path (`marginal.ts:117`) can pair a wrong number with high confidence.
4. **A tracking-down ad (spend, zero revenue) surfaced as a loser/pause** (DQ-4).
5. **A hallucinated in-scene product shipped as a "faithful" AI ad** (CI-1).
6. **Brand DNA / competitor strategy flipped by a poisoned scraped page** shown as strategic fact (AI-1, AI-2).

## What we do NOT yet know
- Whether any real tenant query in a code path NOT sampled omits the `user_id` filter (needs an
  admin-query lint/grep sweep, not a spot check).
- The true production rate of scope-total fallback and action-type-0 events (needs logging).
