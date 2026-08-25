# Phase 1 (repointed) — Own-Account Action Cockpit (Design)

**Date:** 2026-08-25
**Status:** Approved direction, ready for implementation planning
**Supersedes:** `2026-08-25-phase-1-competitor-intel-design.md` (competitor-first). See §Repoint.
**Design system:** `DESIGN.md` (derived from the "Yamin media cockpit" reference).

---

## 1. Repoint (what changed and why)

The owner supplied a concrete UI reference (an own-account "action dashboard") and
directed: **step 1 = connect your ad account, then immediately pull data.** So Phase 1
is repointed from *competitor-first* to *own-account-first*. Competitor intel
(ScrapeCreators) is retained but demoted to one section (Share of Voice). This pulls
Meta/Google OAuth forward from Phase 2 into Phase 1. The full 9-section cockpit is in
scope for v1 (owner decision).

## 2. The loop

1. **Connect** a Meta (primary) and/or Google ad account via OAuth.
2. **Pull** the account's performance data (campaigns, ad sets, ads, daily metrics).
3. **Analyze** with Gemini + rule logic; write facts to the Brand Brain (triples).
4. **Cockpit**: a single action dashboard that leads with a verdict, ranks what to do,
   shows the working, and quantifies money and confidence.
5. **Decide**: user approves/denies recommendations. Nothing changes the live account
   without an explicit, confirmed Apply (see §7 safety).

## 3. Data sources

| Source | Provides | Access reality |
|---|---|---|
| **Meta Marketing API** (primary) | Own ad performance: spend, impressions, clicks, purchases, ROAS, CPA, frequency, CTR, per ad/adset/campaign, daily | OAuth (`ads_read`). Full public app needs review; for first users we run the app in dev/standard access with the user added as tester (their own account). |
| **Google Ads API** (secondary) | Own Google/YouTube ad performance | OAuth + a developer token (needs Google approval). Gated, so Google is a fast-follow connector even within v1 if the token approval lags. |
| **ScrapeCreators** (competitor) | Competitor Meta ads (copy, image, video, active status) for Share of Voice + concept gaps | Free tier, server-only key. |
| **Gemini** (AI) | Verdict, "show the working" explanations, creative concepts, video/image analysis | Free tier, all-Google AI. |

## 4. Screens and information architecture

One scrolling cockpit at `/app`, max-width 1200px, sticky section nav, fixed bottom
Apply bar. Sections (all v1), each: plain verb title + one supporting sentence + a
"show the working" affordance.

1. **Filter bar** — window (7/14/30d), objectives (multi-select, like Meta), context line.
2. **Cockpit verdict** — the verdict in one sentence + chips (scale N / stop N / shoot N);
   companion **health score** donut (one honest number). Sub-metrics: projected ROAS 14d,
   recovered/week, confidence.
3. **Reads** — 5 health cards (account health, creative analytics, competitor, diversity,
   fatigue): status dot, value, sparkline, one insight, "why".
4. **Funnel** — balance grade (letter + score), stage bars vs aim, and adjustable
   reference weights (sliders recompute the grade live).
5. **Will break** — ranked list of ads about to degrade, with the day named, the metric
   move, and urgency bar.
6. **Do this today** — the approve/deny queue. Each row: tag (scale/continue/stop), outcome
   sentence, ad id, why, money impact, Approve / Deny / Snooze.
7. **Waste (money on the table)** — buckets tied to rules (below-floor spend, near-duplicate
   creatives, fatigued spend, wrong objective, out-of-stock), each with a fix + "send to queue".
8. **Creative leaderboard** — per-ad cards with the creative thumbnail, ROAS/spend/orders/CPA,
   fatigue, sparkline, verdict, "why".
9. **Share of voice** — competitor category share (ScrapeCreators) + the format gap that
   feeds concepts.
10. **What to make next** — Gemini concepts as shoot-ready recipes (sku/format/concept/offer/
   landing) with expected ROAS and source weights; approve to stage.
11. **Change history** — log of changes with who moved it (buyer vs algorithm), metric delta,
   and "replay".

## 5. Interaction states (design-review Pass 2 output)

| Area | Loading | Empty | Error | Partial |
|---|---|---|---|---|
| Connect account | spinner + "Connecting to Meta" | "No account connected. Connect to begin." primary Connect button | "Meta declined access. Reconnect." + reason | one platform connected, other pending |
| Data pull | progress bar with counts (ads pulled / analyzed) | "No ads in this window. Widen the window." | "Pull failed at step X. Retry." per-step | some ads analyzed, banner "still analyzing N" |
| Verdict / score | skeleton of the sentence + donut | "Not enough data yet for a verdict." | "Could not compute. Show the working." | "Based on N of M ads" caveat |
| Do-this queue | skeleton rows | "Nothing to act on. You are clean." (warm, positive) | per-row error, row stays actionable | "N recommendations, M still computing" |
| Any "working" drawer | skeleton rows | n/a | "Source unavailable" per row | show rows we have |

Empty states are warm and give the next action, never "No items found."

## 6. Responsive + accessibility (Pass 6 output)

- **Desktop (>=1024px):** as reference (asymmetric grids, 1200px).
- **Tablet (768-1023px):** cockpit stacks verdict over score; 5-card Reads becomes 2-3 per row;
  queue rows keep actions but wrap money under the buttons.
- **Mobile (<768px):** single column; sticky section nav becomes a horizontal scroll strip;
  bottom Apply bar stays fixed; approve/deny become full-width 44px targets; drawer is full-screen.
- A11y: contrast >=4.5:1 (ink on cream passes), status color always paired with a text label,
  full keyboard nav on the queue + drawers, visible focus rings, 44px touch targets.

## 7. Safety: applying changes to a live account (one-way door)

Approve/deny only **stages** decisions. The bottom Apply bar pushes changes to the real ad
account (pausing ads, changing budgets) which is destructive and outward-facing, so:
- v1 default is **manual-apply**: we show the exact change and the user makes it in Meta.
  API write-back (auto-pause/auto-budget) is an explicit opt-in fast-follow behind a
  per-batch confirm.
- Every applied change is logged to Change History.
- Never auto-apply. "Nothing launches on its own."

(Flagged as an unresolved decision in §11 — confirm manual-apply-first vs write-back-now.)

## 8. Data model (additions to Phase 0)

Own-account entities:
```
ad_accounts   id, user_id, platform(meta|google), external_id, name, status, connected_at, token_ref
campaigns     id, ad_account_id, external_id, name, objective, status
ad_sets       id, campaign_id, external_id, name, audience, status
ads           id, ad_set_id, external_id, name, creative_url, media_type, status
ad_metrics    id, ad_id, date, spend, impressions, clicks, purchases, revenue, frequency  (daily)
recommendations id, brand_id, kind(scale|stop|continue), ad_id, outcome, why, money_impact, confidence, state(staged|approved|denied|applied), evidence_triple_ids[]
changes       id, brand_id, ad_id, kind, actor(buyer|algorithm|adbrain), delta, applied_at
```
Reuse from Phase 0/earlier: `brands`, `triples` (Brand Brain now stores own-account
results too, e.g. `[UGC hook] --roas--> [4.38] in [our account]`), `competitor_ads`,
`test_plans` (folds into `recommendations`). All RLS-scoped to the owner.

## 9. AI + logic responsibilities

- **Gemini:** the verdict sentence, every "show the working" explanation, creative concepts,
  and image/video analysis of creatives. Prompts versioned; output schema-validated.
- **Rule logic (deterministic, not AI):** fatigue half-life, waste buckets, funnel grade,
  will-break forecasting, health score. These must be explainable in the drawer (source +
  formula + reason). AI narrates; rules decide the numbers, so the working is auditable.

## 10. Build sequencing (within v1, so it is buildable)

Even though all 9 sections are in scope, build in this order so each step is testable:
1. Meta OAuth connect + token storage (+ dev-mode setup).
2. Data pull + `ad_metrics` ingestion + job/progress UI.
3. Design-system re-base (adopt DESIGN.md; retire indigo/dark).
4. Cockpit shell + Reads + Creative leaderboard (read-only, real data).
5. Rule logic: fatigue, waste, will-break, funnel, health score + "show the working" drawers.
6. Do-this queue (staged recommendations) + verdict (Gemini).
7. Competitor SOV (ScrapeCreators) + concepts (Gemini).
8. Change history + Apply (manual-apply default).
9. Google connector (if dev token approved).

## 11. Open items / risks

1. **Meta app review / dev access** — first users run under dev/standard access (owner's app,
   users as testers). Full public launch needs review. Start paperwork now.
2. **Google Ads API developer token** — separate approval; Google may lag, so it is gated.
3. **Prediction honesty** — "will break in N days" and "projected ROAS" are forecasts; label
   them as estimates and always show the working. Never present a forecast as a fact.
4. **Write-back safety** (§7) — confirm manual-apply-first vs API write-back.
5. **Data volume / cost** — daily metric pulls per ad can be large; cap history window at MVP
   (e.g. 30-60 days) and paginate.

## 12. Design-review status

- Pass 1 Information Architecture: reference + §4 → strong.
- Pass 2 States: §5 table added.
- Pass 3 Journey: connect → verdict → act → apply, each step ends in a decision.
- Pass 4 AI slop: DESIGN.md guardrails; reference is deliberately anti-slop (warm paper, mono
  numerals, no 3-col grid). Phase 0 indigo/dark must be retired (re-base in build step 3).
- Pass 5 Design system: `DESIGN.md` now exists (gap closed).
- Pass 6 Responsive/a11y: §6.
- Pass 7 Unresolved: write-back safety (§7/§11.4); Google token timing (§11.2).

## 13. NOT in scope (deferred)

- Full Meta/Google public app review (use dev access for first users).
- Auto-apply/auto-optimization without confirmation.
- Multi-user teams / seats.
- Billing.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open | score 3/10 → 8/10, 3 decisions made |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | not run |

Design review outcome: the plan was repointed (own-account-first cockpit), a `DESIGN.md`
was created from the reference (closing the Pass 5 gap), and interaction states, responsive,
and a11y specs were added. Three decisions were made in-review: (1) own-account-first pivot,
(2) full 9-section cockpit for v1, (3) adopt the reference design system.

**VERDICT:** DESIGN reviewed and repointed. Eng review required next — this plan now carries
OAuth, external write-back, and a rules engine, all of which need architecture validation.

**UNRESOLVED DECISIONS:**
- Write-back safety (§7): manual-apply-first vs API write-back to the live account.
- Google Ads API developer-token timing (§11.2): may push Google connector past v1.
