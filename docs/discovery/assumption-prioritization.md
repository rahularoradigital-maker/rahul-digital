# AdBrain — Assumption Prioritization

Impact × Risk triage of the beliefs AdBrain's success rests on. Risk = (1 − confidence) × effort.
Categories: **TEST** (high impact, high risk) · **PROCEED** (high impact, low risk) ·
**DEFER** (low/low) · **REJECT** (low impact, high risk).

## The assumptions

| # | Assumption | Impact | Risk | Category |
|---|---|---|---|---|
| H2 | The recommendations are **correct AND non-obvious** ("I wouldn't have caught that") | High | High | **TEST** |
| H1 | In-house D2C teams will **OAuth-connect a real Meta account** to a new tool | High | High | **TEST** |
| H4 | **"Show the working" alone earns enough trust to act** (no human analyst) | High | High | **TEST** |
| H3 | Users **act** on recommendations (approve/apply), not just read | High | Med-High | **TEST** |
| A7 | DTC teams **will pay** (priced under a media buyer) | High | High | **TEST** |
| A6 | **Meta-only data is sufficient** for trustworthy fatigue/waste/diversity (no Shopify/CRM yet) | High | Med-High | **TEST** |
| A9 | The 11-screen app is **usable by a non-technical** first user (density/jargon risk) | High | Med | **TEST** |
| A10 | The **7/14-day fatigue forecasts are accurate enough** to trust | Med-High | High | **TEST** |
| H5 | **Free-tier quality/limits hold** (Gemini RPM, ScrapeCreators 100 credits) | Med | Med | **PROCEED w/ mitigation** |
| A8 | We can **get Meta API access + competitor data** at first-users scale | High | Med | **PROCEED (start now)** |

## The convergence (the important finding)
Eight of the ten TEST-category assumptions are covered by **one experiment sequence we already
designed** — the validation plan (`docs/superpowers/specs/2026-08-25-validation-approach-design.md`):

- **Rules backtest** (held-out accuracy on a real account) tests: **H2** (correct), **A10**
  (forecast accuracy), **A6** (Meta-data sufficiency for fatigue/waste).
- **Concierge test** (hand-produced verdicts for 3-5 real accounts) tests: **H2** (non-obvious, via
  expert rating), **H3** (do they act?), **H4** (does shown-working earn action?), **A7** (would
  they pay?), **A9** (can a non-technical owner use it?), and **H1** (will they grant account access?).

So the single highest-leverage move is running that validation sequence. This is now the **fifth**
independent method to point at "validate the recommendations before over-building" — noted, not
re-litigating scope (owner chose to build the full spec in parallel).

## Experiments for the remaining TEST/PROCEED items

| Assumption | Experiment | Success metric / threshold |
|---|---|---|
| H2, A10, A6 | Rules backtest on 1 real account (time-split, held-out) | >= 70% of "will break" calls correct on held-out days |
| H2 (non-obvious), H3, H4, A7, A9, H1 | Concierge: read-only access to 3-5 real accounts, hand-produce the cockpit, watch behavior | >= 80% recs rated correct by a buyer; a real share "non-obvious"; >= 1 account acts/pre-pays |
| A7 (pay) | Pre-sell / letter-of-intent during concierge | >= 2 of 5 commit to pay at target price |
| A9 (usable) | 5-min unmoderated usability test on the Dashboard artboard with a non-technical DTC owner | can name the top action + open "show the working" unaided |
| H5 (free-tier) | Load probe: run one real account through Gemini + ScrapeCreators free tiers | run completes within RPM budget; ScrapeCreators credits not exhausted by 1 account |
| A8 (access) | Start Meta app review now; 1 ScrapeCreators credit test | dev access granted; a real competitor pull returns usable fields |

## Sequencing
1. **Now (no product needed):** the backtest (needs the Meta OAuth build + your account) and the
   concierge (needs read-only access to a few accounts). These test the core bet cheapest.
2. **Parallel, operational:** start Meta app review (A8), run the ScrapeCreators + Gemini probes (H5, A8).
3. **DEFER:** nothing here is low/low; every assumption is worth testing. No REJECTs — but if H2
   fails the backtest, that is the signal to rework the heuristics before more build (the whole point).
