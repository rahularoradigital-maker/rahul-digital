# AdBrain — Feature/Scope Analysis (session backlog)

Date: 2026-08-25.
**Honesty note:** AdBrain has no users yet. There are no customer feature requests. This
analyzes the scope items that accumulated during design, treated as **founder hypotheses**.
Importance and satisfaction below are estimates, not measured opportunity scores. The point
is to prioritize the *problems*, not to lock features.

Goal used for alignment (from the strategy canvas): **trusted decisions, cheaply delivered,
for in-house D2C teams, Meta-first.** North Star = approved actions applied per account.

## Themes

| Theme | Backlog items | The problem it serves |
|---|---|---|
| A. Connect & trust the data | connect Meta, pull metrics, show-the-working, Brand Brain | "I can't trust or even see my account clearly" (enabler) |
| B. Tell me what to do | verdict, do-this queue, waste, will-break | "I don't know what to scale/stop today" (CORE) |
| C. Understand my creative | creative leaderboard, deconstruction, full video analysis | "I can't tell which creative actually works" |
| D. Look outward | competitor SOV, concepts to make next | "What are rivals doing / what should I shoot" |
| E. Act & remember | write-back/auto-apply, change history | "Applying and tracking changes is manual" |
| F. Expand reach | Google connector | "I also run Google ads" |

## Opportunity read (Importance x Unmet-ness, estimated 0-1)

| Item | Importance | Satisfaction w/ alternatives | Est. opportunity | Effort | Risk |
|---|---|---|---|---|---|
| Verdict + do-this queue + working (B) | 0.9 | 0.2 | **~0.72 (highest)** | Med | Med |
| Recover wasted spend / waste buckets (B) | 0.85 | 0.25 | **~0.64** | Med | Low (deterministic) |
| Creative leaderboard from own data (C) | 0.75 | 0.35 | **~0.49** | Low-Med | Low |
| Connect + pull + Brand Brain (A) | enabler | - | prerequisite | Med | Med (OAuth) |
| Will-break forecasting (B) | 0.7 | 0.4 | ~0.42 | High | High (predictions) |
| Competitor SOV (D) | 0.55 | 0.5 | ~0.28 | Med | Med (data) |
| Concepts to make next (D) | 0.5 | 0.55 | ~0.22 | Med | Med (gen quality) |
| Full multi-frame video analysis (C) | 0.45 | 0.6 | ~0.18 | **High** | **High** |
| Auto-apply write-back (E) | 0.4 | 0.6 | ~0.16 | High | **High (money)** |
| Google connector (F) | 0.35 | 0.6 | ~0.14 | Med | Med (token approval) |

## Top 3 opportunities to prioritize

### 1. "Know what to scale/stop today, and trust it" (verdict + do-this queue + show-the-working)
- **Rationale:** the core JTBD and the North Star action live here; highest importance, lowest
  satisfaction with alternatives (Ads Manager + gut feel).
- **Alternatives to consider:** a weekly email digest instead of a live cockpit; a single
  "3 moves this week" card before the full queue.
- **Riskiest assumption:** the recommendations are correct AND non-obvious (H2).
- **Cheap test:** concierge cockpit for 3-5 real accounts (read-only), no product.

### 2. "Recover wasted spend" (waste buckets)
- **Rationale:** near the top on importance, and it is *deterministic and explainable* (low risk),
  so it earns trust fast and quantifies value in money (fits principle #3).
- **Alternatives:** start with the single biggest waste bucket (fatigued spend) before all five.
- **Riskiest assumption:** our waste rules match what a good buyer would flag.
- **Cheap test:** rules backtest on a real account's history; compare to a buyer's judgment.

### 3. "See which creative actually works" (creative leaderboard)
- **Rationale:** high importance, low effort/risk (it is mostly presenting own-account metrics),
  and it grounds the Brand Brain with real results.
- **Alternatives:** a ranked table before the visual card grid.
- **Riskiest assumption:** users trust our winner/loser verdicts on their ads.
- **Cheap test:** show the leaderboard for one real account and ask "is this right?"

## Recommend deferring (low opportunity vs. effort/risk)
This directly questions **decision D9 (full 9-section cockpit in v1).** By opportunity score,
these add cost well before their importance is validated:
- **Full multi-frame video analysis** (~0.18 opp, high effort/risk) — thumbnail + copy is enough
  for v1; add depth only if users ask.
- **Auto-apply write-back** (money risk) — manual-apply already decided (D12); keep deferred.
- **Google connector** — Meta-first serves the segment; add when a user actually needs Google.
- **Will-break forecasting** — ship a simple fatigue flag first; full forecasting is high-risk.
- **Concepts generation** — the strategy de-prioritizes generation; do after the core loop earns trust.

## The honest recommendation
The opportunity data (even as hypotheses) and the strategy both point to a **lean core v1**
(themes A + top-3 of B/C), not the full nine sections at once. This reopens D9. Not overriding
it — flagging that the highest-opportunity, lowest-risk path is a smaller first cut, and the
single most valuable next action is a **concierge test / rules backtest** to validate H2 before
more building.
