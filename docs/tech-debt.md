# AdBrain Tech Debt Register

Priority = (Impact + Risk) x (6 - Effort). All 1-5. Grounded in the code reviews, the
intended-vs-implemented audit, and the system-design load estimation — not invented.

## The unusual headline
AdBrain's biggest risk is **not** classic code debt. It is the inverse: a large design/doc
surface (24 docs, weeks of specced features) sitting on ~a few hundred lines of code, with the
**core hypothesis untested** (are the recommendations actually right and non-obvious?). Call it
**spec-ahead-of-code debt**. Its cheapest, highest-value paydown is validating the bet, which by
the formula below outranks every code cleanup.

## Register (scored)

| # | Item | Category | Impact | Risk | Effort | Priority | Notes |
|---|---|---|---|---|---|---|---|
| 1 | **Validate core hypothesis** (rules backtest / concierge test) | Spec-ahead-of-code | 5 | 4 | 1 | **45** | Cheap, offline, no credentials; validates weeks of planned build |
| 2 | No monitoring before real users | Infrastructure | 3 | 5 | 3 | **24** | Blind to the free-tier breaking points 1-2 in prod |
| 3 | No CI (build gate + checks are manual) | Test/Infra | 3 | 3 | 2 | **24** | Cheap: a GitHub Action running build + check:* |
| 4 | Provider drift (code=Claude, decision=Gemini) | Architecture | 3 | 3 | 3 | **18** | Audit F1; blocks Phase 1; docs contradict code |
| 5 | Single shared Gemini free key = one RPM/RPD budget | Architecture | 2 | 4 | 3 | **18** | System-design bp1; breaks ~20 concurrent users |
| 6 | Test coverage grows with the build | Test | 3 | 3 | 3 | **18** | Only 2 checks today (crypto, claude); pipeline untested |
| 7 | Deploy pipeline (no remote/staging/rollback drill) | Infrastructure | 2 | 2 | 2 | **16** | Pre-launch; fine for now |
| 8 | Auth polish (next-redirect, server-side validation, signup enumeration) | Code | 1 | 2 | 1 | **15** | Code-review #1-4; fold into OAuth pass |
| 9 | Design-system re-base (indigo/dark -> warm-paper) | Architecture | 3 | 2 | 4 | **10** | Audit F2; whole UI; do at Phase 1 UI build |
| 10 | Dead Claude SDK/code after Gemini swap | Dependency | 1 | 1 | 1 | **10** | Remove with item 4 |
| 11 | Supabase free-tier auto-pause on inactivity | Infrastructure | 1 | 2 | 1 | **8** | Keep-alive ping or accept cold start |

## Phased remediation (alongside feature work)
- **Phase A — before building more (cheapest, highest leverage):**
  item 1 (validate the bet via the rules backtest), item 3 (add CI: a GitHub Action running
  `npm run build` + `check:*`). Both cheap; both de-risk everything after.
- **Phase B — folded into the Phase 1 build (no separate work):**
  item 4 + 10 (Gemini swap + drop Claude), item 9 (design re-base), item 8 (auth polish lands when
  OAuth touches `actions.ts`/`proxy.ts`), item 6 (write tests as each agent/route is built).
- **Phase C — before real users:**
  item 2 (monitoring: job success/failure, Validator cannot_verify rate, quota alarms),
  item 7 (git remote + Vercel + a rollback drill), item 11 (keep-alive).
- **Phase D — at ~10-20 active users / when competitor features ship:**
  item 5 (Gemini per-tenant keys or paid tier), paid ScrapeCreators, Vercel Pro / external cron.

## Business justification (top 3)
- **Item 1 (45):** the entire build is a bet that the recommendations are good. Testing that
  offline for near-zero cost, before pouring weeks into the cockpit, is the single highest-ROI move.
- **Item 2 (24):** without monitoring, the free-tier breaking points (Gemini contention, credit
  exhaustion) hit silently and the first sign is a user complaint. Cheap insurance.
- **Item 3 (24):** manual build gates get skipped; a 20-line CI action makes "build green + checks
  pass" automatic on every push, protecting the whole codebase for almost no effort.

## What we are deliberately NOT calling debt
- The 24 design docs are not debt if they get built or validated soon; they become debt only if
  they rot unbuilt (which is why item 1 is #1).
- D9 (full cockpit) is a settled decision, not debt — re-scoping is closed.
```
