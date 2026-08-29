# AdBrain — Canonical App Rules & Architecture Canon

**The single source of truth for how this app must behave — forever, for every user, every account.**
Every rule here is universal (applies to all accounts, no exceptions) and, where marked *Guarded*, is
enforced by a runnable check that runs in CI on every code push. If a rule regresses, the build fails
before it can reach users. That is the "rules can't go haywire" guarantee.

> **Who we are building for:** US-based performance agencies running **$100,000,000 / month on a single
> brand**. At that scale one brand can have **thousands of ads and hundreds of campaigns**, the users are
> sophisticated and unforgiving, and a single wrong or fabricated number can lose a client. Every decision
> in this doc is judged against that bar, not against a demo. Anything that only works for a small account
> is called out as a band-aid to replace, not a rule to keep.

Last updated: 2026-08-29. Owner: Rahul. Enforcement: `npm run check:all` (57 checks) + `next build` + `tsc`, run in CI (`.github/workflows/engineering-health.yml`) on every push.

---

## Part 1 — The permanent rules (NEVER break)

These are the trust core. They are what makes the app credible to a $100M agency. They are kept forever.

| # | Rule (plain English) | Why it matters at $100M scale | Enforced by |
|---|---|---|---|
| R1 | **Only ever show the user's REAL data. Never fabricate a number, date, link, or metric.** A missing value shows as "n/a", never a fake 0. | An agency will cross-check against Ads Manager. One invented number and they never trust the tool again. | Guarded (multiple no-fabrication checks; null-on-zero-denominator everywhere) |
| R2 | **Recommend, never act.** DMs, pauses, budget changes are always drafts the human approves. Nothing auto-launches or auto-pauses. | A wrong auto-pause on a $100M account is a career-ending mistake. The human decision log is also our moat. | Guarded (decision-ledger checks) |
| R3 | **Ranking and verdicts are formula-driven. The AI narrates, it never ranks or decides.** | Agencies must be able to audit *why* an ad ranked where it did. "The AI felt like it" is unacceptable. | Guarded (scoring/verdict/decision checks) |
| R4 | **Judge every ad on its objective's own metric.** Sales/conversion/catalog → ROAS, CPA. Awareness/engagement/traffic/leads → CPM, CTR, link CPC, LPV. Never judge an awareness ad on ROAS. | A brand splits budget across objectives; judging all on ROAS mislabels half the account as "losers". | Guarded (objective-scoring, objective-headline checks) |
| R5 | **Compare a brand to itself,** same objective, over a fixed day-wise baseline — never to a public benchmark inside a score. | Public benchmarks disagree ~60% and are meaningless for a specific brand's economics. | Guarded (scoring percentile = within same objective) |
| R6 | **Attribution honesty.** Headline totals use the whole-window aggregate, never the last day (Meta attributes sales days late). Trend/fatigue/stability reads drop the still-settling tail so an ad is never falsely called "declining". | A false "ROAS crashing" alert on a $100M account triggers a panic pause of a healthy ad. | Guarded (daily-series/window-headline, attribution checks) |
| R7 | **Catalog (dynamic product ads) is not a testable creative and is handled honestly.** Concepts never propose "Catalog" as a format. "Catalog: Excluded" must show catalog-free numbers, not catalog spend hidden under an "Excluded" label. | Catalog is automated from the feed; treating it as creative, or leaking its revenue into an "excluded" view, gives false strategy. | Guarded (fingerprint/catalog, catalog-honesty checks) |
| R8 | **Never suggest anything for paused, ended, or archived ads/ad sets/campaigns.** | Telling an agency to "pause" an already-paused ad destroys credibility. | Guarded (paused-exclusion gate at source) |
| R9 | **Show each ad's own objective metric in the UI, never a ROAS figure for a non-sales ad.** | A "0.0x" next to an awareness ad reads as a ROAS verdict and looks broken. | Guarded (objective-headline check) |
| R10 | **Verify to 100% and test on the live app before claiming anything is done.** Plan first, then verify every change including edge cases. | (Process rule for how AdBrain itself is built.) | Process rule + CI gate |
| R11 | **Every rule above is backed by a runnable check that runs in CI.** A code change that breaks a rule fails the build before release. | This is what keeps the rules from silently drifting as the app grows. | The `check:all` suite itself |

---

## Part 2 — Every feedback you gave, and where it now lives in the code

| Your feedback | Status | Enforced / lives in |
|---|---|---|
| ROAS 0.00 / spend inaccurate — validate all logic | Fixed | KPI headline = window aggregate; full logic audit done |
| Catalog "Excluded" still counted catalog money | Fixed | Exclude mode uses catalog-free totals |
| Fatigue/trend biased by attribution lag | Fixed | Directional reads drop the settling tail |
| Awareness zero-ROAS polluting the scale decision | Fixed | Median ROAS is conversion-ads-only |
| Concepts kept saying "Format: Catalog" | Fixed + verified live | Concepts prompt forbids catalog as a format |
| Can't even see the brand's website | Fixed + verified live | Website auto-read from the brand's own ad links |
| Competitors / their ads / ICP / content pillars, ours vs theirs | Partly built | "ICP & Pillars" tab live (ours); competitor side needs a working data source (see ❌ below) |
| Why treating awareness/engagement as ROAS campaigns | Fixed + verified live | Rows show CPM/CTR/CPC + an objective chip, never ROAS for awareness |
| Compare against the account's last 90 days, day-wise, always | Done + verified live | Whole app fixed to a 90-day day-wise window |
| Ranking must be formula-driven, not gut/AI | Confirmed | Already true; the AI never ranks |
| Track EVERY campaign/ad that spent a penny, day-wise, any size | **In progress** | The ingestion pipeline (roadmap #1) — cannot be done by the current live pull |
| Make all rules universal + drift-proof | Done | This document + the CI check suite |
| Devil's advocate + 5-year thinking, flagged with ❌❌❌ | Adopted | Standing behavior from now on |

---

## Part 3 — Devil's advocate: what is NOT smart enough for a $100M/month app

These are the band-aids. They work today for small accounts but **will break at agency scale.** They must
be replaced, not codified as rules.

**❌❌❌ Pulling data live when a page loads, capped at the top 50 ads.**
Why it breaks: a brand spending $100M/month can have ~5,000 active ads. When the page tries to fetch
5,000 ads × 90 days of daily data *while you wait*, the server hits its time limit and the page just spins
("Loading your account" — you saw this today). To stop the spin I had to cap it at the 50 biggest-spending
ads — which means **the other 4,950 ads are invisible.** That is the opposite of what you asked for.
Fix (building now): a background pipeline that stores every ad's daily data in a database, so the app reads
it instantly, any size. *This is roadmap #1 and you've greenlit it.*

**❌❌❌ Relying on the free Gemini AI tier.**
Why it breaks: with 500 users a day each triggering ~75 AI calls, that's ~37,500 calls/day. The free tier
caps out in the low hundreds — so by mid-morning the AI simply stops answering for everyone. Example: an
agency opens "Concepts" at 11am and gets "the model was slow" — on a paid product. Fix: paid AI tier +
"analyze each creative once and reuse it" caching (cuts cost ~10x) + a per-client usage budget so one whale
account can't drain the shared quota.

**❌❌❌ Storing the whole account's data as one big JSON blob per window.**
Why it breaks: you can't ask it questions ("show me every fatiguing ad in campaign X"), and one bad write
corrupts the entire view. At $100M scale you need to slice, filter, and roll up millions of rows. Example:
an agency wants a campaign-level fatigue report across 300 campaigns — a blob can't do that; a real
database can in milliseconds. Fix: a proper daily-metrics table + pre-computed rollups.

**❌❌❌ Doing all heavy work on Vercel's serverless functions.**
Why it breaks: serverless functions are built for quick requests, not multi-minute data pulls. We proved
this today — the 90-day pull timed out. Example: syncing 5,000 ads will never fit in a request. Fix: a
dedicated background worker/queue for the heavy jobs, separate from the website.

**❌❌❌ One Meta login token per user, with unclear encryption and refresh.**
Why it breaks: tokens expire — when it does, the whole account goes dark with no warning. And an agency's ad
account is extremely sensitive; if a stored token leaks, someone could read (or worse) their $100M account.
Also, Meta rate-limits per app — one token can't sustain thousands of daily syncs. Fix: encrypt tokens at
rest, auto-refresh before expiry, and use multiple Meta app tokens to spread the rate limit.

**❌❌ Fixed 90-day window everywhere, with the date picker removed.**
Why it's not ideal: agencies live in different time frames — "how did yesterday's launch do?", "give me the
quarterly review". One frozen 90-day view serves neither. Also a 5-day-old ad judged against 90-day
veterans looks weak unfairly. Fix (once the database exists — then it's cheap): let the user pick any
display window while the *ranking baseline* stays a stable 90 days, and compare new ads against similar-age
ads, not veterans.

**❌❌ Awareness ads scored mostly on click-through rate (CTR).**
Why it's wrong: awareness is about cheap reach (CPM), not clicks. Example: a beautiful brand video with
amazing, cheap reach but few clicks gets flagged "kill" — exactly wrong for awareness. Fix: score awareness
on CPM/reach first, CTR second.

**❌❌ The ranking formula weights are educated guesses.**
Why it's risky: "trend = 30% of the score" was set by judgment, not proven on data. A wrong weight
mis-ranks the whole account. Fix: tune the weights from your own approve/dismiss decisions over time — the
human-decision ledger becomes the thing no competitor can copy.

**❌❌ Competitor data depends on one source that's currently down.**
Why it breaks: ScrapeCreators is out of credits, and Meta's own Ad Library API needs a manual identity
verification (ID upload + a mailed code) before it works. So the whole competitor/ICP feature can go dark.
Fix: two data sources with automatic fallback + caching, and complete the Meta Ad Library verification.

**❌ Attribution "settling tail" is hard-coded to 2 days.**
Why it can be slightly off: some accounts use a 7-day attribution window, so 2 days isn't enough and a small
false dip can still show. Fix: read each account's real attribution setting from Meta.

---

## Part 4 — The 5-year architecture (what $100M/month actually requires)

In build order (each unlocks the next):

1. **Day-wise ingestion pipeline** — a background job stores *every* spending ad's daily metrics in a
   database, incrementally. The app reads complete data instantly, at any size. **(Roadmap #1, greenlit,
   starting now.)**
2. **Paid AI + fingerprint-once caching + per-client quotas** — makes the AI reliable and affordable at
   scale.
3. **Background worker / queue** — moves all heavy jobs off the website's request path.
4. **Token security + auto-refresh + multi-token rate handling** — keeps accounts connected and safe.
5. **Normalized tables + pre-computed rollups + read replicas + date partitioning** — so millions of rows
   stay fast and queryable.
6. **Observability + per-client cost dashboards + quota alarms** — so you can see and control spend and
   catch failures before agencies do.
7. **Then the refinements:** flexible display window over the stable comparison baseline, age-aware
   comparison, CPM-led awareness scoring, and ledger-tuned ranking weights.

The full engineering detail lives in the scale plan; this doc is the rulebook and the priority order.

---

## Part 5 — How these rules stay drift-proof (the guarantee)

1. Every rule in Part 1 has a **runnable check** in `npm run check:all` (57 checks today).
2. CI runs `lint → build → tsc → check:all` on **every push** (`.github/workflows/engineering-health.yml`).
3. If any change breaks a rule, **the build fails and it never reaches users.**
4. New rules get a new check in the same pass, so the guarantee grows with the app.

This is why the rules can't "go up and down": they are not memory or habit, they are tests that must pass.
