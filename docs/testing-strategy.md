# AdBrain Testing Strategy

Balances coverage, speed, and low-ops. Reuses test cases already specified elsewhere
(Strategist [T1-T8](ai/prompts/strategist-v1.md), failure-recovery
[fault injection](agents/failure-recovery.md)). Grows with the build (tech-debt #6).

## Two framing calls
- **The rules engine gets the deepest coverage.** It computes the authoritative numbers the AI
  copies; untested rules mean "show the working" is a lie. This is the most important suite.
- **Low-dep tooling:** assert-based node scripts for pure units (like `check:crypto`), Node 22's
  built-in `node:test` for integration (zero dependency), Playwright + axe only once real UI exists.

## Pyramid for AdBrain
```
        /  E2E  \        connect -> run -> verdict -> approve (1 happy path) + a live Gemini eval sample
       / Integration \    RLS isolation, sync idempotency, job queue, auth flow, API-route security
      /   Unit Tests   \  rules engine (biggest), crypto, transforms, triple dedup, validator/byte-match logic
```

## Plan by component

| Area | Test type | Coverage target | Example cases |
|---|---|---|---|
| **Rules engine** (fatigue/waste/will-break/funnel/health) | Unit (assert) | 85%+ of branches | `fatigue(freq=4.1, ctr_falling, days_past)` -> past-half-life=true; waste bucket detection; will-break on a known series; **insufficient-data returns a sentinel, never a number** |
| **Token crypto** | Unit (done) | 100% of boundary | round-trip, IV uniqueness, tamper, wrong-key (✓); add empty + unicode token, malformed payload |
| **Prompt outputs** (Strategist etc.) | Contract/golden (offline) + live eval | goldens 100% pass to deploy | T1 byte-match, T2 no fabricated number, T3 citation subset, T5 voice (no em dash/hype), T6 schema, T7 ranking, T8 no-apply |
| **Validator + post-processing** | Unit (assert) | high | number byte-match diff catches a mismatch; uncited rec dropped; cannot_verify on missing trace |
| **RLS / data isolation** | Integration (`node:test` + test DB) | 100% of tenant boundaries | user B cannot read A's brands/triples/ad_metrics; `oauth_tokens` returns 0 rows to any client |
| **Sync / data pipeline** | Integration + unit | idempotency proven | re-run sync -> no duplicate `ad_metrics` on `(ad_id,date)`; Curator produces no duplicate triples |
| **Job queue** (ADR-0003) | Integration | resumability proven | enqueue -> drain <=RPM -> finalize; stale-item reset; crash mid-run resumes; rate cap respected |
| **API routes** (OAuth callback, cron) | Contract + security | 100% of the auth boundary | callback stores an ENCRYPTED token (stored != plaintext) and never returns a token; cron route 401s without the secret |
| **Auth flow** | E2E (Playwright, later) | happy path + gate | signup -> login -> `/app`; logged-out `/app` -> `/login`; sign out -> `/` |
| **Cockpit UI** | Component + a11y (axe) | states + a11y floor | loading/empty/error states render; approve/deny; keyboard nav; 44px targets; contrast >=4.5:1 |

## What to cover vs skip
- **Cover:** the rules engine, every security boundary (crypto, RLS, token endpoints), sync
  idempotency, job resumability, the prompt invariants, and the a11y floor.
- **Skip:** framework glue, trivial getters, the marketing page copy, one-off scripts.

## Current coverage (honest gap analysis)
- **Exists:** `check:crypto` (solid). `check:claude` (being dropped with the Gemini swap).
- **Zero coverage today:** rules engine (unbuilt), RLS isolation, sync idempotency, job queue,
  prompt goldens, auth e2e, cockpit a11y. Most are zero because unbuilt, not neglected — but the
  RLS isolation and prompt-golden suites must exist BEFORE real users (security + honesty gates).

## Test-as-you-build phasing (aligns with tech-debt Phase B)
- With each **rule function**: its assert-based unit test (the moat's first tests).
- With the **OAuth routes**: the encrypt-on-write + never-return-token contract test (audit F4).
- With the **schema/migrations**: an RLS isolation integration test (two test users).
- With the **sync + job queue**: idempotency + resumability integration tests (the failure-recovery list).
- With each **prompt** (VERSIONING): its golden set green before it ships.
- With the **cockpit UI**: axe a11y + interaction-state component tests.

## CI (tech-debt #3)
A GitHub Action on push: `npm run build` + all `check:*` + `node --test` (units + integration
that don't need a live DB). Integration needing Supabase runs against a dedicated test project (or
local `supabase start`). Live Gemini evals stay a manual, opt-in script (they cost calls).
```
