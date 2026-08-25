# Buyer Judgment Rules (adopted)

Source: the owner's prior rulebook for another tool (identity NOT carried over — no name, no
branding, no visual canon; the rules and logic are the owner's own IP and are adopted here).
These encode top-0.1%-buyer judgment and SUPERSEDE softer language in our earlier specs wherever
they conflict. Thresholds below are **INTERNAL CALIBRATION (owner-decided starting anchors,
editable)** — a legitimate third state between "official fact" and "unknown".

## J1. The spend floor runs first, at ingest
Nothing is scored, compared, graded or recommended unless it spent **> Rs 300 (or USD 5) in the
last 7 days** (currency auto-detected from the ad account). Below-floor items are held as
"not enough data yet, keep testing", re-checked daily — never deleted, never scored.
**Build:** a pre-filter before every engine; the FIRST gate in the pipeline.
*Changes:* rules registry gets SPF-001; every engine's input contract assumes floored data.

## J2. Compare like with like: same objective, own history first
Every in-account comparison is against ads with the SAME campaign objective only (conversion vs
conversion, never vs traffic/engagement), weighted mostly by the account's own 180-365-day history.
Public benchmarks are context for conversation, never an input to a score.
```
objective_average(metric) = avg over same-objective floored ads, weighted to own long history
ad_score(metric)          = distance from its objective_average
```
*Changes:* the comparator in the winner/verdict engine; metric dictionary comparison-window rows.

## J3. The causality ladder: diagnose in order, never jump
Before blaming creative for ANY drop, rule out in order:
**1 measurement broken → 2 tracking/attribution change → 3 auction/CPM → 4 landing/checkout →
5 stock-out → 6 audience saturation → 7 only then creative fatigue.**
Severity is graded by CAUSE, not by the size of the move (a 30% ROAS drop from a broken pixel is
an emergency; the same drop from a festival auction is green). Every metric carries a causal
record: UP when / DOWN when / then-this-moves.
*Changes:* the decision engine walks this ladder before emitting a diagnosis; "audience used up"
may never be reported unless creative-supply and sameness checks are both healthy.

## J4. Measurement is a gate, not a score
If signal quality is broken (sales not reaching the platform), the whole board is suppressed with
one message: "fix measurement first". A confident wrong number is worse than no number.

## J5. Fatigue: the exposure curve, never a frequency threshold
Fatigue is measured at CREATIVE level, exposures rolled up across every ad set it runs in:
```
exposure_fatigue = 100 x (1 - (N+1)^-0.4)      [Meta-published exponent 0.4 = RESEARCH-BACKED anchor,
                                                replace with measured per-account values]
Composite = 0.40 exposure + 0.30 cost-confirmation + 0.15 CTR-decay + 0.10 annoyance + 0.05 age
Half-life: N_half ≈ 4.66 exposures → days_to_death = (N_half - N_now)/daily_exposure_gain
→ a DEATH DATE per creative, not a vague score
```
Trust gate: 3+ days live AND 1,000+ impressions/day, else "still learning"; new creatives borrow
their angle's account half-life until they have 3 days of their own.
*Changes:* merge into fatigueV2 (the exposure curve becomes the anchor signal; our multi-signal
set stays as the confirmation layer); will-break emits a death DATE.

## J6. Trust gates (concrete "not worthy until" thresholds)
Per-ad score: Rs 4,000/USD 50 spend + 3 days · fatigue/half-life: 1,000+ imp/day · funnel rates:
2,000+ sessions · winner flag: 100+ conversions + 3 days · account median: 30+ ads · trend warning:
7+ continuous days · vs-own-past: 90 days history else observe-mode. Missing-data rule: never fill
with an average; drop the dimension and rebalance weights to 1.00; never substitute silently; an
AI-decoded label under 97% confidence is a question for a human, not a value.
*Changes:* these replace our "calibrate-at-build UNKNOWN" placeholders as INTERNAL CALIBRATION
constants in a single `lib/rules/trust-gates.ts` constants module (editable, persisted per account).

## J7. Confidence rises with connected sources
`conf(META-only) <= conf(+GA4) <= conf(+Shopify) <= conf(+3P attribution)` — non-decreasing.
Creative/delivery actions are confident on Meta alone (Meta owns that data); economic actions
(contribution ROAS, nCAC) are NOT until Shopify/finance connect. Every action shows its level and
one line: "connect X to raise this to Y%".
*Changes:* `computeConfidence` gains a `connectedSources` input and the level messaging.

## J8. Change-log attribution: rule the humans out before the creative
Pull the account activities log daily. A day with **>= 4 manual changes** followed by a >= 2-point
performance drop is attributed to CHANGES (learning reset), not creative. Label every change
BUYER (in the log) vs ALGO (delivery moved with no logged change). Backend history, replayable for
any window; each day's +/- computed from real metric deltas, never typed by hand.
*Changes:* NEW module + ledger table; step 2-of-the-ladder gets teeth. Cap: one budget change per
ad set per day; freeze-and-relearn 72h is the standard fix.

## J9. Action gates and second-order safety
```
SCALE:    fatigue < 0.30 AND ROAS > account median AND hook percentile > 75  → +30% at a time, never double
CONTINUE: fatigue 0.30-0.55 AND within ±10% of baseline
STOP:     fatigue > 0.70 AND cost/result > 2x past AND 3 replacements queued  (two gates, never one signal)
```
Never stop without replacements queued. Every action names the exact ad id and the numbers.

## J10. The verdict engine (winner / refresh / do-not-kill-yet / loser)
```
CreativeScore = 0.30 performance + 0.30 trend + 0.20 (100 - fatigue) + 0.20 funnel_health
                (weights editable, persisted)
```
Winner requires ALL: enough spend/purchases/days, stability, healthy funnel, CPA/AOV, low fatigue,
room to scale — 8x ROAS on Rs 3,000/2 purchases is a coin toss, not a winner; 4.5x on Rs 2L/180
purchases/30 days stable is the real winner. Loser only after ruling out: data, audience, CPM,
funnel breaks, stock, LP change, promo change, tracking — then classified by real cause. Output:
one verdict + confidence + a why-list of exact signals.

## J11. Tier wiring and build order
Tier 2 (easy dials: CPM, CTR, CPC, frequency, hook/hold, ATC, checkout, CVR, AOV, platform ROAS,
CPA) describes. Tier 1 (MER, new-customer %, win rate, cost/winner, contribution ROAS, nCAC,
nc-ROAS, LTV:CAC, contribution margin, half-life, diversity, marginal ROAS, incrementality)
decides — and each Tier 1 = Tier 2 inputs + ONE hard ingredient (finance sheet, customer join,
creative decoder, holdout). Capture all Tier 2 from day one; a missing hard ingredient leaves that
Tier 1 row dark and LABELED dark ("waiting on finance"), never estimated.
Platform ROAS is a within-platform sorting tool, never a profit statement; profit truth = MER,
contribution ROAS, nCAC. Marginal ROAS = fit a spend-response curve from OWN history (INFERENCE,
so labeled) — the average says scale while the margin says stop.

## J12. Diversity refinements
Measure diversity on the portfolio WE supplied, not the spend Meta allocated (Meta concentrates on
purpose). Measure distinctness to META's eye: cluster ads when cosine(0.6 vision + 0.4 text
fingerprint) > 0.92 (tunable) — two ads with different text on the same image are ONE creative.
45 thumbnails can be 12 real ads. Undecoded ads show "pending", never counted as distinct.
*Changes:* redundancyScore's basis + a stated rule in the diversity engine.

## J13. Concept recipes: gap x openness x our winning format
```
each pick = argmax of 0.40 our_performance + 0.25 ai_fit + 0.20 competitor_gap + 0.15 world_norm
recipe    = SKU + format + concept + offer + landing, every part tagged with its source
guards: brief cosine < 0.72 vs last 6 months; must fill a named gap; covers >= 6 personas +
        the starved stage; check ALL gap sources (message, funnel-mix, format-mix, diversity,
        language, copying-alarm), never only the loudest
```
The four-reference blend (ours 0.40 / model 0.25 / competitor 0.20 / world 0.15) also drives the
funnel-balance grade (A-F) and format-mix targets. All weights editable + persisted.

## J14. The ledger is the moat
Append-only: every recommendation, every human decision, every 30-day outcome. Never edited. This
is what trains the weights, sharpens the change-log correlation, and cannot be copied.
*Changes:* extends our `changes`/recommendations tables with the outcome loop.

## J15. The 28 situations are acceptance criteria
The rulebook's 28 real-buyer situations (8x-on-Rs3k trap, festival CPM, near-copy "new" ads,
scale-then-die second-order, COD returns, placement splits, copied hooks, B2B lag, pixel break...)
become the QA suite [artifact 26]: before shipping, each must produce the RIGHT column, not the
trap. Any failure = a missing rule, not an edge case.

## What we KEEP from the existing build (where ours wins)
Fact-labels per value · FETCH/CALC/INFER/EXTERNAL/CANNOT-KNOW mapping · the byte-match validator +
AI-narrates-never-computes · no-fabricated-benchmarks (these thresholds enter as INTERNAL
CALIBRATION, editable, not as truth) · tested-code discipline · scale/security architecture.

## Integration order (after the in-flight P0 agents land)
1. `trust-gates.ts` constants + the spend-floor pre-filter (J1, J6) — everything depends on them.
2. Fatigue merge: exposure curve + death date into fatigueV2/will-break (J5).
3. Causality ladder into the decision engine (J3, J4) + confidence sources (J7).
4. Verdict engine (J10) with same-objective comparator (J2).
5. Change-log attribution module + ledger outcome loop (J8, J14).
6. Diversity distinctness basis (J12); recipes + blend weights (J13) when competitor/AI data flows.
7. The 28 situations wired as the QA suite (J15).
