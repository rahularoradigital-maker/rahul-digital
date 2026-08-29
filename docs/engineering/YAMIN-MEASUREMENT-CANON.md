# Yamin Measurement Canon — AdBrain reference

The Yamin Measurement Canon (v2.0, Aug 2026, reference brand boAt) is the **canonical spec** for AdBrain's
scoring: every weight, formula, band, and input. The machine-readable rules are committed here as
[`yamin-measurement-canon.spec.json`](./yamin-measurement-canon.spec.json) (the exact `YAMIN_SPEC` block
from the source HTML — read that, don't re-derive weights). Source HTML + the sister `YAMIN_BUILD_PHASES`
(architecture + 9-table data model) live in `docs/shared-research/imagive-whatsapp/` (gitignored, local only).

**This wins on any weight/formula conflict with older specs.** Build *toward* it — improve, don't blind-copy.

## The doctrine (6 rules that govern everything)
1. **Compare a brand to itself**, never a public benchmark, inside a score (public benchmarks disagree ~60%).
2. **Score creative inside its own campaign** — hook rate has no standard formula; rank an ad vs the ads it competes with (same campaign, same 14 days).
3. **Measurement is a gate, not a score** — if sales aren't reaching Meta (Meta purchases vs real Shopify orders), STOP; score nothing.
4. **Grade the portfolio we supply, not the spend Meta allocates** — diversity measured on our creative spread, not spend (Meta concentrates budget on ~6% of ads on purpose).
5. **Every number carries an evidence tag** — A platform / B panel / C folklore (never build on) / Y Yamin-judgement.
6. **Recommend, never act** — nothing auto-launches/pauses for 12 months; the human-decision ledger is the moat.

## The compute order + rollup
1. Pull raw fields; fail loudly on a partial pull.
2. Compute **Signal Quality** first. **If Signal Quality < 60 → publish "measurement broken", STOP.**
3. Compute each scorecard as `sum(weight x dimension_score)`, dropping any dimension whose inputs are missing and **rebalancing remaining weights to 1.00**.
4. Roll up: `AccountGrade = 0.40*AccountHealth + 0.30*CreativeAnalytics + 0.20*Diversity + 0.10*(100 - FatigueLoad)`, where `FatigueLoad` = share of active spend on ads scoring above 70 fatigue.
5. Growth Diagnosis: 5 blockers; "audience used up" is suppressed unless BOTH the creative-supply and ads-are-the-same blockers score < 40. Take the single top blocker → one action with a number in it.
6. Log to the ledger: inputs, scores, action, confidence.

## The five scorecards
- **A. Meta Account Health** · **B. Creative Analytics** · **C. Creative Diversity** · **D. Creative Fatigue** · **E. Growth Diagnosis** (why a brand cannot scale). Exact per-dimension weights/formulas/bands are in the JSON spec.

## Key thresholds (from `confidence_rules`)
- Accept a read-off-the-ad label only at **>= 97%** confidence; 80-96% retry once at temp 0; below 80% or after 2 tries → UNKNOWN, human queue. **A confidence below 97% is a question for a human, not a label.**
- **Do not score an ad under ~USD 50 spend** (numbers swing more than signal).
- Duplicate creative similarity threshold **0.92**. Action confidence min **85%**. EMQ: treat **7.5 as full marks** (not 8), weight coverage ~2x.
- **Fatigue uses Meta's published curve on `exposure_n` (rolled up across ad sets), NOT a frequency ceiling** — frequency is counted per ad set, tiredness happens per creative.

## The four missing-data rules (matter more than the formulas)
1. Never fill a gap with an average (a confident wrong score is worse than none) — show the dimension **unavailable**.
2. If a dimension can't run, **drop it and rebalance** to 1.00, and label the card "partial data".
3. Never silently substitute — every estimated/dropped input shows on screen.
4. A confidence below 97% is a human question, not a label.

## AdBrain gap analysis (honest: what we can do now vs what needs new data)
AdBrain is **Meta-only** today. Per the canon's own rules, dimensions needing data we lack must show
*unavailable*, never be faked.

| Canon input source | AdBrain has it? | Consequence |
|---|---|---|
| AM-M (Meta Marketing API) | ✅ yes | Account Health, Fatigue, hook/hold, exposure_n, CPR — buildable now |
| AL-M (Meta Ad Library, competitors) | ✅ partial (ScrapeCreators) | Diversity-vs-competitors (presence/format only) — shipped |
| SHOP (Shopify) | ❌ no | Signal-Quality **gate**, nCAC, contribution margin, payback, OOS spend — must show "waiting on Shopify" |
| EMQ (Dataset Quality API) | ❌ no | Event Match Quality dimension — unavailable |
| FIN (finance sheet) | ❌ no | All profit/margin numbers — "waiting on finance" |
| DECODE / FPRINT (Crystal Decoder, fingerprints) | ⚠️ partial (format only; semantic decoder not wired) | Semantic diversity (hook/angle/persona), duplicate detection — partial |
| LEDGER (decision ledger) | ✅ yes (`decision_triples`) | The learning moat — already recording |

### What AdBrain already does that aligns with the canon
- **Roll up across ad sets before scoring** (funnel levels + the level-funnel helper) — the canon's single most-emphasised rule.
- **No fabrication / null-on-zero-denominator everywhere; "n/a" not a fake 0** — matches the missing-data rules.
- **Confidence de-rating banner** on the cockpit — the seed of the evidence-tag discipline.
- **Objective-aware verdicts** (awareness on CPM/CTR/CPC/LPV, not ROAS) — matches "score inside the objective".
- **decision_triples ledger** — the recommend-never-act + logged-decisions moat.

### Highest-value next steps toward the canon (build order)
1. **Evidence tags (A/B/C/Y) + confidence-inspectable pillars** — every number shows its source + formula + how-sure. (Canon doctrine rule 5.)
2. **Signal-Quality gate** — once Shopify is connected, add the Meta-vs-Shopify reconciliation gate that STOPS scoring when measurement is broken.
3. **Fatigue on `exposure_n` + Meta's published curve**, rolled up across ad sets, framed as named-ad + countdown + mechanism + cost.
4. **Align AccountGrade to the rollup formula** (0.40/0.30/0.20/0.10) with per-dimension weights from the spec, each dimension droppable + rebalancing.
5. **Diversity on portfolio supply** (already format-based; extend to the 8 named dimensions when the semantic decoder is wired).

The formulas are a *starting line* (mostly Y/B tier); the moat is correcting them from the `decision_triples` ledger over time. Do NOT copy all 129 metrics — build the ~15-20 that map to the real decisions, to full rigor, first.
