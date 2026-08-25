# Validation V0 + V1 Implementation Plan

> **For agentic workers:** execute task-by-task. `[NOW]` = buildable without credentials.
> `[OWNER]` = needs Rahul's Meta developer app / account. `[DATA]` = needs real synced data.

**Goal:** Build the Meta connection scaffolding and the rules-backtest machinery so that, once
a real account is connected, we can run the held-out backtest (spec §V1).

**Architecture:** Server-side OAuth (ADR-0002) stores encrypted tokens; a sync pulls `ad_metrics`;
an offline harness time-splits that history and scores the rules engine's predictions.

**Tech Stack:** Next.js 16 route handlers, `lib/crypto.ts` (built), `lib/rules/` (built),
Supabase service-role client, `node --experimental-strip-types` checks.

## Global Constraints
- Tokens: encrypt on write via `lib/crypto.ts`, store via service role only, NEVER return to client (audit F4).
- Rules engine numbers are authoritative; the harness never counts an ad it lacked data for as correct.
- `npm run build` green + `check:*` green before commit.

---

### Task 1 [OWNER] — Meta developer app
Owner creates a Meta app (App ID + secret), adds the account as a tester, registers redirect URIs.
Documented in SETUP; not code.

### Task 2 [NOW] — Service-role Supabase client
- Create `lib/supabase/admin.ts`: a Supabase client using `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  for writing `oauth_tokens` (bypasses RLS). Throws if the key is missing.
- Verify: `npm run build` green.

### Task 3 [NOW] — Token store helper + OAuth routes (scaffold)
- Create `lib/oauth-store.ts`: `storeToken(adAccountId, tokens)` — encrypts access/refresh via
  `lib/crypto.ts`, upserts into `oauth_tokens` via the admin client. Never returns token values.
- Create `app/api/connect/meta/authorize/route.ts` (redirect to Meta OAuth) and
  `app/api/connect/meta/callback/route.ts` (exchange code, create `ad_accounts` row, call `storeToken`).
  Guarded to fail cleanly if Meta env is unset.
- Verify: `npm run build` green. (Real OAuth round-trip is Task 1-gated; untested until then.)

### Task 4 [OWNER/DATA] — Historical sync
Pull daily ad-level metrics via the Meta Marketing API into `ad_metrics` (incremental, upsert on
`(ad_id,date)`). Needs a connected account. Plan only for now.

### Task 5 [NOW] — Backtest harness
- Create `scripts/backtest.ts`: given `MetricsRow[]` per ad and a split date T, compute
  `fatigue`/`wasteForAd`/will-break using rows <= T, then score against actuals in (T, T+7].
  Output per-account accuracy + precision/recall on "will break" + a skipped count for thin ads.
- Pure functions over rows (no DB in the scorer, so it is testable); a thin `readMetrics()` seam
  will later read `ad_metrics`.

### Task 6 [NOW] — Synthetic self-test ("test the tester")
- Create `scripts/check-backtest.ts`: build synthetic ads with KNOWN outcomes (one that clearly
  breaks after T, one that clearly does not), run the harness, assert the scorer reports the
  correct hits/false-positives and the expected accuracy. Print `PASS: backtest harness checks`.
- Add `check:backtest` to package.json + CI.
- Verify: `node --experimental-strip-types scripts/check-backtest.ts` prints PASS; `npm run build` green.

### Task 7 [DATA] — Run the real backtest + report
Once Tasks 1/4 are done: run the harness on the real account, produce the accuracy report, compare
to the §V1 bar (>=70% will-break correct). Plan only.

### Task 8 — Expert + concierge
- [NOW] `docs/validation/expert-rating-sheet.md`: a template for a media buyer to rate each
  recommendation correct/incorrect + obvious/non-obvious (§V2).
- [LATER] V3 concierge with real owners.

---

## Execute-now set (this session, on a branch)
Tasks 2, 3, 5, 6, and 8's rating sheet. Everything else is [OWNER]/[DATA]/[LATER].

## Success criteria
- Build green; `check:backtest` PASS on synthetic data (the harness is proven correct before real data).
- OAuth scaffolding compiles and encrypts-on-write (real round-trip verified once the Meta app exists).
