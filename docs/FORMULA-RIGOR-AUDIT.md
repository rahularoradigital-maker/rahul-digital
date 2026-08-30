# Formula Rigor Audit

> The standard: every rule/formula must be strict, expert-grade (a media buyer running $100M/mo on one
> brand), **nothing assumed**, and **stable** (a constant that keeps changing is a bug). This doc inventories
> every decision formula, grades its basis, flags each assumption, and states the expert-grade target + the
> stability rule. Changing a formula without updating this doc is a band-aid and is not allowed.

Grades: 🟢 grounded (account's own data or a sourced industry/platform rule) · 🟠 defensible constant (a
buyer would sign off, frozen + documented) · 🔴 assumption / placeholder (must be replaced).

## The three principles every formula is held to
1. **Self-baselined, not magic numbers** — judge each ad against the account's *own* 90-day day-wise history, not absolute numbers someone invented.
2. **Statistical sufficiency before any verdict** — never scale/kill until the ad has enough *volume* (conversions / clicks / impressions) to be real, not just enough days.
3. **Every constant sourced or frozen** — grounded in platform/industry practice or the account's data; genuine judgment constants are versioned here and do not drift.

## Inventory

| # | Formula (file) | What it decides | Basis today | Grade | Expert-grade target / stability rule |
|---|---|---|---|---|---|
| 1 | **Statistical sufficiency** (`decision.ts`) | Whether an ad has enough volume to judge at all | **JUST HARDENED** — gates on conversions (≥15), clicks (≥100/1k impr), impressions (≥10k awareness), per objective; below → HOLD | 🟢 | Grounded in media-buying practice (Meta learning ~50 conv/wk; rate stability ~100 clicks). Frozen constants; revisit only with data, logged here. |
| 2 | **90-day self-baseline window** (`cockpit-data.ts`) | The comparison baseline for every ad | Fixed 90-day day-wise; each ad vs the account's own history | 🟢 | Correct — self-baselined, not absolute. Keep fixed (app-wide COMPARISON_DAYS). |
| 3 | **Decision thresholds** STRONG 70 / GOOD 55 / WEAK 45 (`decision.ts`) | scale / refresh / pause / hold cutoffs | **HARDENED** — scale/pause now require BOTH the absolute grade AND self-baselined standing (percentile vs the account's own same-objective ads): scale needs top ~30%, pause needs bottom ~30%, so it never scales a good-but-not-leading ad nor kills the least-bad ad of a weak account | 🟢 | Both absolute + relative must agree. Tiers frozen + documented. |
| 4 | **Fatigue index weights** freq .4 / CTR-decay .4 / CPM-rise .2 (`fatigue.ts`) | Blends the fatigue signal | Chosen weights | 🟠 | Frozen + documented. The three signals are the *right* ones (a buyer reads exactly these). Weights revisited only from outcome backtests, logged here. |
| 5 | **Frequency saturation curve** `100·(1-(f+1)^-0.4)` (`fatigue.ts`) | How exposure saturation grows with frequency | Meta's published exposure-decay shape | 🟢 | Sourced (platform). Keep. |
| 6 | **Fatigue state cuts** fresh/watch/fatiguing (`fatigue.ts`) | Labels the fatigue index | Chosen cuts on 0-100 | 🟠 | Frozen + documented; revisit from backtests only. |
| 7 | **Near-zero metric guard + half-life cap** (`fatigue.ts`) | Stops noise-driven trends & fantasy half-lives | Floors per metric + 120-day cap | 🟢 | Correct honesty rule (shipped earlier). Keep. |
| 8 | **Attribution tail-trim** 2 days (`attribution.ts`) | Drops still-attributing recent days from trend reads | Conversions land days after click | 🟢 | Sourced (attribution lag is real). Keep; could self-derive per account later. |
| 9 | **Objective score / benchmarks** (`rules/*`, `scoring.ts`) | Absolute grade on the objective's own metric | Benchmark tiers | 🟠 | Audit each benchmark source; where none, self-baseline vs the account's own distribution. |
| 10 | **Winner score** quality×scale×stability×opportunity (`winner.ts`) | Ranks winners to protect/scale | Weighted composite | 🟠 | Frozen + documented; validate the weighting against realized outcomes. |
| 11 | **Account health** (`analyze.ts`) | Spend-weighted objective performance, 0-100 | Spend-weighted blend | 🟠 | Defensible; document the exact blend + freeze. |
| 12 | **Marginal scaling / diminishing returns** (`marginal.ts`) | Headroom to scale | Elasticity fit (needs ≥5 valid days) | 🟢 | Correct approach (real diminishing-returns curve). Keep; widen the fit as data grows. |
| 13 | **Concept scoring — white-space & historical performance** (`creative-production/strategy`) | Ranks creative concepts | **"honest neutral constants until Meta data is wired"** | 🔴 | **Real placeholder.** Replace with actuals once the ingestion store feeds concept scoring (the day-wise store now exists). Highest-priority remaining assumption. |
| 14 | **Evidence tiers A/B/C + Judgement** (`evidence.ts`) | Provenance tag on every number | Honesty framework | 🟢 | Correct — this *is* the anti-assumption guardrail. Keep. |

## Status
- **Fixed:** #1 statistical sufficiency (no verdict on thin volume) + #3 self-baselined scale/pause (absolute AND account-relative standing must agree).
- **Frozen + documented (🟠):** #4, #6, #10, #11 — defensible, version-locked here so they don't drift.
- **Remaining 🔴 to replace:** #13 (concept-scoring white-space + historical-performance placeholders). Blocked on a clean concept-archetype → creative-format mapping before grounding it from the store (grounding it on an invented mapping would itself be an assumption). #9 (per-benchmark sourcing) is the next 🟠→🟢 step.

*Updated 2026-08-30. Any formula change must update the matching row here.*
