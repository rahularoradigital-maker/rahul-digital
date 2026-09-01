# AdScale — Release & Verification Protocol (deliverable #20)
**Date:** 2026-09-01. Every code change to a user-visible calculation follows this. Derived from charter §82, §128-§135, §146 and the founder's standing rules.

## The GREEN gate (all must pass before "done")
1. `npx tsc --noEmit` — 0 errors.
2. `npm run lint` — 0 errors (warnings allowed).
3. `npm run build` — compiles.
4. `npm run check:all` — every gate green (the suite is large; if it times out, it is NOT claimed complete — re-run to completion).
5. Regression fixtures (golden accounts + golden decisions, §76/§77) pass.
6. Formula property tests (§78): CTR≤100%, spend≥0, ROAS=rev/spend, plus zero/null/missing/duplicate/late/timezone/currency.
7. Brand-consistency + SEO-metadata gates.

## Then LIVE verification (charter §82 — the founder's hard rule)
Code-verified ≠ live-verified. After deploy, on a real account, confirm the change **running in production**, plus **one edge case** and **one failure case**. State exactly what level was reached: CODE-VERIFIED vs LIVE-VERIFIED. Never claim "fixed" before the live check.

## Change-review checklist (§136, run before marking complete)
What was the actual bug? Did we fix the *cause* (not the path)? Could a sibling code path still have it? New assumption introduced? Complexity ↑? Performance ↓? Cost ↑? Could it affect another tenant?

## Devil's-advocate matrix (§135) — try to prove it wrong
wrong date · wrong account · tiny sample · huge sample · zero · null · missing · duplicate · stale · concurrent · API failure · partial API response · model failure · fallback · paused ad · deleted ad · creative/budget/campaign/tracking changed.

## Regression memory (§73, §146)
Every bug → ROOT CAUSE → FIX → TEST → RULE → DOC → FUTURE GUARDRAIL, appended to `REGRESSION-LOG.md` + a golden fixture. Never solve the same edge case twice.

## Concurrency rule (learned this session)
This repo has had parallel agent sessions. Commit **only your own named files** (never `git add -A`), and re-check `git log`/`git status` before and after. One session owns a given work-stream at a time.
