# [01c] Master Metric Dictionary — H Fatigue · I Diversity · J Scaling

Slice of the Master Metric Dictionary [01] covering three categories. Every metric traces to a
row in [02] Meta Data Mapping and carries its source class. This file is consistent with
`brief.md`, `00-master-plan.md`, and `02-meta-data-mapping.md`.

## How to read every entry

Each metric answers the **10 questions** (measures / why / decision / inputs / formula / source /
comparison window / min sample / limitations / when NOT to trust), names its **LEVEL** (from the
brief's hierarchy), cites its **[02] class** (FETCH / CALC / INFER / EXTERNAL / CANNOT-KNOW), and
**fact-labels** every value.

**Source-class legend (from [02]):** FETCH = direct Meta API field · CALC = computed from fetched
fields · INFER = AI-modeled/estimated · EXTERNAL = another system (Shopify/CRM/LP crawler) ·
CANNOT-KNOW = not reliably knowable.

**Fact labels:** OFFICIAL PLATFORM FACT · INTERNAL CALCULATION (DERIVED) · RESEARCH-BACKED ·
INDUSTRY BENCHMARK · MODEL ESTIMATE · INFERENCE · UNKNOWN.

**Decision gate:** a metric on the primary surface must name the decision it changes; otherwise it
is tagged `advanced/vanity — not primary`.

**Benchmark honesty (brief + [02]):** no hardcoded generic benchmarks. Every threshold below is an
INTERNAL CALCULATION heuristic to be **calibrated per-account against that account's own baseline**,
or is explicitly marked UNKNOWN / "verify at build". None is presented as an official Meta fact or a
validated industry number.

---

# H · FATIGUE

Multi-signal, **not frequency alone** (brief). Fatigue is a *diagnosis* built from many derived
signals compared across windows; the raw inputs are OFFICIAL, the fatigue verdict is an INTERNAL
CALCULATION. The category resolves to one of **8 states** (H8) plus a **forecast** (H9).

Governing note: every fatigue signal below is a *delta over time* on an existing metric. The
absolute value is defined in category A/B/C/E/F of [01]; here we define its **trend/decay form** and
its role as a fatigue driver. Comparison windows per brief: **1 / 3 / 7 / 14 / 21 / 30-day** where
sample permits.

## H1 · Frequency (and frequency trend)

| Field | Value |
|---|---|
| **Measures** | Avg impressions per unique user over a window, and its rate of climb. |
| **Why** | Rising frequency with no reach growth = audience saturation, the classic (but insufficient alone) fatigue precursor. |
| **Decision** | Whether to refresh creative, expand audience, or cap frequency. `primary`. |
| **Inputs** | `impressions`, `reach` (both FETCH OFFICIAL). |
| **Formula** | `frequency = impressions / reach` (Meta-provided); `freq_trend = freq_t / freq_(t-window) − 1`. |
| **Source / [02] class** | [02] Delivery — **FETCH OFFICIAL** for frequency; **CALC DERIVED** for the trend. |
| **Level** | Ad set (native), rolls up to Ad / Campaign / Account. |
| **Comparison window** | 7d vs prior 7d; 3d for fast movers. |
| **Min sample** | Reach >= a per-account floor (UNKNOWN — verify at build; do not trust on tiny reach). |
| **Limitations** | High frequency != fatigue for retargeting/small audiences by design; frequency is dedup-imperfect across placements. |
| **When NOT to trust** | New ad set still exiting learning; audience deliberately small; post-audience-expansion reset. |

- Fact label: frequency value = **OFFICIAL PLATFORM FACT**; frequency-trend = **INTERNAL CALCULATION (DERIVED)**.

## H2 · CPM trend (delivery cost drift)

| Field | Value |
|---|---|
| **Measures** | Change in cost per 1,000 impressions over the window. |
| **Why** | Rising CPM on the same audience is an auction/relevance signal often co-moving with fatigue. |
| **Decision** | Diagnose whether cost rise is fatigue vs. seasonality/auction. `primary` (as a driver, not alone). |
| **Inputs** | `cpm` (FETCH OFFICIAL) daily series. |
| **Formula** | `cpm_trend = cpm_t / cpm_(t-window) − 1`. |
| **Source / [02] class** | [02] Delivery — CPM **FETCH OFFICIAL**; trend **CALC DERIVED**. |
| **Level** | Ad / Ad set. |
| **Comparison window** | 7d vs prior 7d, 14d, 30d. |
| **Min sample** | Impressions >= per-account floor (UNKNOWN — verify at build). |
| **Limitations** | CPM moves with seasonality, competition, promo periods, and audience changes — confounded (AUTOPSY: seasonality/auction). |
| **When NOT to trust** | Q4/holiday auction inflation; audience or placement change; account-wide CPM shift (isolate ad-level via difference-from-account). |

- Fact label: CPM = **OFFICIAL PLATFORM FACT**; trend = **INTERNAL CALCULATION (DERIVED)**.

## H3 · CTR decay (all-CTR and link-CTR)

| Field | Value |
|---|---|
| **Measures** | Decline in click-through rate over the window. |
| **Why** | Falling CTR = the creative is losing attention/relevance; a leading fatigue signal. |
| **Decision** | Refresh vs. keep. `primary` driver. |
| **Inputs** | `ctr`, `inline_link_clicks`, `impressions` (FETCH OFFICIAL). |
| **Formula** | `link_ctr = inline_link_clicks / impressions`; `ctr_decay = 1 − ctr_t / ctr_baseline`. |
| **Source / [02] class** | [02] Delivery — **FETCH OFFICIAL** (link-CTR uses inline_link_clicks per [02]); decay **CALC DERIVED**. |
| **Level** | Ad / Creative. |
| **Comparison window** | 7d vs the ad's own peak/first-week baseline. |
| **Min sample** | Impressions per day >= floor to stabilise CTR (UNKNOWN — verify at build). |
| **Limitations** | CTR is placement-mix dependent; all-CTR includes non-link clicks; small denominators are noisy. |
| **When NOT to trust** | Placement mix shifted; day-of-week effects unsmoothed; sample too small (wide confidence interval). |

- Fact label: CTR = **OFFICIAL PLATFORM FACT**; decay = **INTERNAL CALCULATION (DERIVED)**.

## H4 · Hook-rate & hold-rate decay (video attention)

| Field | Value |
|---|---|
| **Measures** | Decline in early-video retention: hook rate (3-sec plays / impressions) and hold rate. |
| **Why** | Attention collapse at the top of the video is the earliest creative-fatigue signal for video. |
| **Decision** | Whether the *creative itself* (not delivery) is fatiguing -> produce replacement. `primary`. |
| **Inputs** | `video_3_sec_watched`, `thruplay`, `p25/50/75/100 watched`, `video_avg_time_watched`, `impressions` (FETCH OFFICIAL). |
| **Formula** | `hook_rate = 3_sec_plays / impressions`; `hold_rate` = **pick ONE definition and document it** ([02] flags 3 competing defs: p75/3-sec [Meta], 15-sec/3-sec [industry], thruplay/3-sec). Decay = trend of each. |
| **Source / [02] class** | [02] Attention — raw plays **FETCH OFFICIAL**; **hook rate & hold rate are CALC DERIVED, NOT official fields** (explicit in [02]). |
| **Level** | Creative / Ad (video only). |
| **Comparison window** | 7d vs creative baseline; 3d for high-spend. |
| **Min sample** | Video plays >= floor (UNKNOWN — verify at build). |
| **Limitations** | Auto-play/sound-off inflates 3-sec plays; hold-rate definition ambiguity means cross-tool comparison is invalid unless the same def is used. |
| **When NOT to trust** | Non-video creative (N/A); placement change (Reels vs Feed retention differ); definition mismatch with any external benchmark. |

- Fact label: raw video actions = **OFFICIAL PLATFORM FACT**; hook/hold rate + decay = **INTERNAL CALCULATION (DERIVED)**. Any "good hook rate = X%" claim = **UNKNOWN / verify at build** (no validated benchmark hardcoded).

## H5 · CVR / CPA / ROAS decay (outcome fatigue)

| Field | Value |
|---|---|
| **Measures** | Deterioration in conversion rate, cost per acquisition, and on-platform ROAS over the window. |
| **Why** | The bottom-line symptom of fatigue; confirms upstream attention decay reached outcomes. |
| **Decision** | Pause/replace vs. hold. `primary`. |
| **Inputs** | `actions` (purchases), `action_values`, `spend`, `clicks`/`lpv` (FETCH OFFICIAL). |
| **Formula** | `cvr = purchases / clicks(or lpv)`; `cpa = spend / purchases`; `roas = value / spend`; decay = trend vs baseline. |
| **Source / [02] class** | [02] Conversion/economics — purchases & value **FETCH OFFICIAL** (attribution-window dependent); ROAS/CPA/CVR **CALC DERIVED**. |
| **Level** | Ad / Creative / Ad set. |
| **Comparison window** | 7d vs prior 7d and vs baseline; 14/30d for low-volume. |
| **Min sample** | Conversions >= a stability floor (UNKNOWN — verify at build; ROAS on very few purchases is high-variance). |
| **Limitations** | Attribution-window dependent; iOS/privacy under-reporting (modeled conversions) — flag attribution limits (per [02] hard limits); Simpson's paradox across audiences (AUTOPSY). |
| **When NOT to trust** | Promo/pricing/LP/tracking changes; small conversion counts; attribution window changed; account-level economic shift not isolated. |

- Fact label: purchases/value = **OFFICIAL PLATFORM FACT** (attribution-caveated); ROAS/CPA/CVR + decay = **INTERNAL CALCULATION (DERIVED)**.

## H6 · Creative age & spend velocity

| Field | Value |
|---|---|
| **Measures** | Days since the creative first delivered, and how fast spend is accumulating on it. |
| **Why** | Fatigue risk rises with cumulative exposure; velocity tells you how *fast* an ad will burn its audience. |
| **Decision** | Prioritise which ads to watch/replace first; feed the creative-supply forecast. `primary`. |
| **Inputs** | Creative first-seen date (CALC from daily series), daily `spend` (FETCH OFFICIAL). |
| **Formula** | `creative_age = today − first_delivery_date`; `spend_velocity = spend over last N days / N` and its trend. |
| **Source / [02] class** | [02] Delivery — spend **FETCH OFFICIAL**; spend velocity & concentration **CALC DERIVED**; creative age **CALC DERIVED** (first-seen from snapshots). |
| **Level** | Creative / Ad. |
| **Comparison window** | Rolling 7/14/30d. |
| **Min sample** | Needs a continuous daily snapshot history (see [22][24]); unreliable if snapshots have gaps. |
| **Limitations** | "First seen" only as far back as our snapshot history; age != fatigue by itself (a durable evergreen can be old and healthy). |
| **When NOT to trust** | Snapshot history incomplete; creative re-used across ads (id reuse) confuses age. |

- Fact label: age & velocity = **INTERNAL CALCULATION (DERIVED)**.

## H7 · Reach / impression-growth saturation

| Field | Value |
|---|---|
| **Measures** | Whether new-reach growth has stalled while impressions keep climbing (audience exhaustion). |
| **Why** | Distinguishes "same people seeing it more" (saturation) from healthy incremental reach. |
| **Decision** | Expand audience vs. refresh creative. `primary` driver. |
| **Inputs** | `reach`, `impressions` daily (FETCH OFFICIAL). |
| **Formula** | `reach_growth = delta_reach/delta_time`; saturation when impression-growth > 0 while reach-growth -> 0 (rising frequency). |
| **Source / [02] class** | [02] Delivery — **FETCH OFFICIAL** inputs; saturation flag **CALC DERIVED**. |
| **Level** | Ad set / Campaign. |
| **Comparison window** | 7d slope vs prior. |
| **Min sample** | Meaningful reach base (UNKNOWN — verify at build). |
| **Limitations** | Reach dedup is imperfect; audience-overlap and cap changes confound. |
| **When NOT to trust** | Audience just expanded/changed; budget just scaled (mechanical impression jump). |

- Fact label: reach/impressions = **OFFICIAL PLATFORM FACT**; saturation flag = **INTERNAL CALCULATION (DERIVED)**.

## H8 · Fatigue State (composite verdict — 8 states)

| Field | Value |
|---|---|
| **Measures** | A single classified state combining H1–H7 signals with confidence. |
| **Why** | Turns many trends into one decision-ready label with an explanation ("why are we saying this?" — brief). |
| **Decision** | The core fatigue action: keep / watch / refresh / pause. `primary`. |
| **Inputs** | All H1–H7 signals + their confidences + sample sizes. |
| **Formula** | Rule-engine classifier (per [15]): weighted multi-signal score -> state. Weights + thresholds are **INTERNAL CALCULATION, calibrated per account**, versioned, with exceptions — not arbitrary constants. |
| **Source / [02] class** | Composite of FETCH OFFICIAL inputs + CALC DERIVED trends -> **CALC DERIVED** verdict. |
| **Level** | Creative / Ad (primary); can roll to Ad set. |
| **Comparison window** | Multi-window (3/7/14d) consensus required to avoid noise -> trend. |
| **Min sample** | If any driver is below its floor -> state = **INSUFFICIENT DATA**, never a false verdict. |
| **Limitations** | A classifier is only as good as its calibration; confounds (promo/season/attribution) must be checked by AUTOPSY before a verdict stands. |
| **When NOT to trust** | Confidence low; signals disagree (flag "mixed signals"); a known external event explains the move. |

**The 8 states (from brief):**

| State | Plain meaning | Typical driver pattern |
|---|---|---|
| HEALTHY | Stable/improving | flat/rising CTR & hook rate, stable CPA |
| EARLY WARNING | First soft signal | one leading signal (hook/CTR) dipping, outcomes still fine |
| EMERGING | Fatigue forming | multiple leading signals declining, frequency rising |
| FATIGUING | Actively degrading | leading + lagging signals down together |
| FATIGUED | Degraded, confirmed | CPA/ROAS materially worse, sustained |
| SEVERE | Deep degradation | large sustained ROAS/CPA loss, high frequency |
| RECOVERING | Improving after a dip/refresh | signals reversing upward post-change |
| INSUFFICIENT DATA | Can't judge | any key driver below its sample floor |

- Fact label: state = **INTERNAL CALCULATION (DERIVED)** with confidence; all thresholds **calibrated per account**, none an INDUSTRY BENCHMARK unless a cited, dated source is attached at build (else **UNKNOWN**).

## H9 · Fatigue Forecast (7-day AND 14-day)

| Field | Value |
|---|---|
| **Measures** | Probability the creative crosses into a worse fatigue state within 7 and 14 days. |
| **Why** | Lets the buyer replace *before* the loss, not after — the "prediction" step of the transform. |
| **Decision** | Pre-emptive refresh / creative-supply planning. `primary`. |
| **Inputs** | H1–H7 trend slopes, creative age, spend velocity, decay rates. |
| **Formula** | Trend-extrapolation / survival-style model -> probability + confidence + named drivers + expected consequence + recommended action (per [08] Forecasting Framework). |
| **Source / [02] class** | Modeled from CALC DERIVED trends -> **INFERENCE**. |
| **Level** | Creative / Ad. |
| **Comparison window** | Forecast horizon 7d & 14d; trained on the ad's own history. |
| **Min sample** | Needs enough daily history for a stable slope (UNKNOWN — verify at build); short-lived ads -> low confidence. |
| **Limitations** | A forecast is not a fact (brief); cannot foresee external shocks (promo, competitor, seasonality); weak-forecast risk flagged by KILLCRITIC. |
| **When NOT to trust** | Short history; volatile signals; recent structural change (budget/audience/LP). Present as probability + confidence, never a certainty. |

- Fact label: forecast = **MODEL ESTIMATE / INFERENCE**, always with confidence; never OFFICIAL, never a fact.

---

# I · DIVERSITY

**Not "number of ads"** (brief). Diversity is measured across the creative-fingerprint dimensions:
persona / problem / desire / awareness / hook / angle / concept / format / visual / speaker /
product / offer / background / environment / message / landing / CTA / narrative / structure
(brief + [05] fingerprint). The dimension **labels themselves are AI-inferred** (per [02]: persona/
hook/angle/concept = **INFER, INFERENCE with confidence**), so **every diversity score inherits that
inference uncertainty** — a diversity number is only as trustworthy as the tagging under it.

Five scores (brief): **Diversity, Concentration, Redundancy, White-Space, Coverage** — each with
formula, weights + reason, min sample, confidence, limits. Scores are computed on a chosen scope
(account / campaign / active-ads set) and a chosen basis (by count vs by spend — always state which;
spend-weighted is the decision-relevant one).

Cross-cutting for all of I:
- **[02] class:** the underlying dimension tags are **INFER (INFERENCE)**; the scores that aggregate
  them are **CALC DERIVED** on top of inferred inputs.
- **Fact label:** every diversity/concentration/etc. value = **INTERNAL CALCULATION (DERIVED) over
  INFERRED tags**. Weights below are **INTERNAL CALCULATION heuristics, calibrated**, not benchmarks.
- **Decision gate:** all five are `primary` — they drive the "what to produce next / where are we
  over-concentrated / where is the white space" decisions in the brief's final test.

## I1 · Diversity Score

| Field | Value |
|---|---|
| **Measures** | How spread the active creative portfolio is across fingerprint dimensions (variety of personas/hooks/angles/formats/...). |
| **Why** | Low diversity = fragile account: one fatigue event or audience shift can sink most of spend at once. |
| **Decision** | Whether to broaden creative exploration (new angles/personas/formats). `primary`. |
| **Inputs** | Fingerprint tags per active creative (INFER), spend per creative (FETCH OFFICIAL). |
| **Formula** | Per dimension, an entropy / effective-number measure (e.g. Shannon or inverse-Simpson) of the spend-weighted distribution across categories; **Diversity Score = weighted mean across dimensions**. |
| **Weights + reason** | Dimensions weighted by decision-impact: hook/angle/persona/format highest (they drive fatigue independence and audience reach); background/environment lowest (cosmetic). Weights are **calibrated INTERNAL CALCULATION**, versioned; **exact values UNKNOWN — set/validate at build**, not hardcoded here. |
| **Source / [02] class** | INFER tags + FETCH spend -> **CALC DERIVED**. |
| **Level** | Account / Campaign (portfolio-level). |
| **Comparison window** | Snapshot of active set; trend across weeks. |
| **Min sample** | Enough active creatives to make a distribution meaningful (UNKNOWN — verify at build); tiny portfolios -> low confidence, report as such. |
| **Limitations** | Entirely dependent on tag accuracy (INFERENCE); "diverse tags" can still be functionally similar (redundancy, see I3); spend-weighted vs count-weighted give different pictures. |
| **When NOT to trust** | Tagging confidence low; very few ads; a dimension has too many sparse categories (entropy unstable). |

- Fact label: **INTERNAL CALCULATION (DERIVED) over INFERRED tags**, with confidence.

## I2 · Concentration Score

| Field | Value |
|---|---|
| **Measures** | How much spend/outcomes pile into a few fingerprint values (the inverse face of diversity). |
| **Why** | High concentration = single point of failure and hidden fatigue risk; the brief's "over-concentrated" question. |
| **Decision** | Whether to de-risk by diversifying, or accept concentration on a proven winner. `primary`. |
| **Inputs** | Spend (and optionally purchases/value) per fingerprint value (FETCH OFFICIAL + INFER tags). |
| **Formula** | Herfindahl-Hirschman Index (HHI) or top-N share per dimension, spend-weighted: `HHI = sum(share_i^2)`. Report per dimension + a rolled concentration index. |
| **Weights + reason** | Same dimension weighting as I1 (decision-impact); concentration on hook/angle/persona/format/product matters most. Weights = **calibrated INTERNAL CALCULATION**; values **verify at build**. |
| **Source / [02] class** | FETCH spend + INFER tags -> **CALC DERIVED**. |
| **Level** | Account / Campaign / by product. |
| **Comparison window** | Snapshot + weekly trend. |
| **Min sample** | Meaningful spend base; HHI unstable on very few units. |
| **Limitations** | Concentration is not inherently bad (a $500/day @4x winner is fine — brief); must be read with performance + fatigue, never alone. Tag-accuracy dependent. |
| **When NOT to trust** | When concentration reflects a deliberate, healthy winner; low tag confidence; too few units. |

- Fact label: **INTERNAL CALCULATION (DERIVED) over INFERRED tags**.

## I3 · Redundancy Score

| Field | Value |
|---|---|
| **Measures** | How many active creatives are functionally *near-duplicates* (same fingerprint region) despite counting as separate ads. |
| **Why** | Redundant ads fake diversity, split learning, and fatigue together — wasted creative slots. |
| **Decision** | Consolidate/retire near-duplicates; reallocate production to genuinely new territory. `primary`. |
| **Inputs** | Creative fingerprint embeddings (EXTERNAL/CALC computer-vision from [05]) + fingerprint tags (INFER). |
| **Formula** | Pairwise similarity (embedding cosine >= a threshold) -> cluster; `Redundancy = share of creatives (or spend) inside dense same-region clusters`. |
| **Weights + reason** | Similarity threshold + which fingerprint facets count toward "same" are **calibrated INTERNAL CALCULATION**; threshold value **UNKNOWN — verify at build** (a hardcoded cosine cutoff would be an arbitrary threshold — disallowed). |
| **Source / [02] class** | Embeddings **EXTERNAL/CALC** + INFER tags -> **CALC DERIVED**. |
| **Level** | Account / Campaign. |
| **Comparison window** | Snapshot; trend as new creatives ship. |
| **Min sample** | Needs embeddings computed for the active set ([05]); no embeddings -> cannot compute, say so. |
| **Limitations** | Similarity != redundancy of *performance*; two similar-looking ads can perform differently; threshold sensitivity. |
| **When NOT to trust** | Embeddings missing/low quality; deliberate iterative testing of one concept (that's a test, not waste). |

- Fact label: **INTERNAL CALCULATION (DERIVED)** over EXTERNAL/CALC embeddings + INFERRED tags.

## I4 · White-Space Score

| Field | Value |
|---|---|
| **Measures** | Unoccupied, potentially valuable fingerprint combinations we are NOT running (persona x hook x angle x format ...). |
| **Why** | White space is where the next winner may live; the brief's "where is the white space" question. |
| **Decision** | What to produce next (net-new territory). `primary`. |
| **Inputs** | Our occupied fingerprint combinations (INFER) vs. a defined opportunity space (our own + competitor-derived, [12][13]). |
| **Formula** | `White-Space = (valuable candidate combinations − occupied combinations) / valuable candidate combinations`, over a defined combination lattice; prioritised by plausibility. |
| **Weights + reason** | Candidate value weighting favors combinations adjacent to proven winners and to competitor-active (hypothesis) regions. Weights = **calibrated INTERNAL CALCULATION**; competitor-derived candidates are **HYPOTHESES not conclusions** (brief: active != winning). |
| **Source / [02] class** | INFER tags + EXTERNAL competitor data ([12]) -> **CALC DERIVED / INFERENCE** for the "valuable" judgment. |
| **Level** | Account / Campaign / by product. |
| **Comparison window** | Snapshot; re-scored as portfolio + competitor set change. |
| **Min sample** | Needs a defined combination lattice and enough tagged history to know what's occupied. |
| **Limitations** | The combination space is combinatorially huge — must be pruned to *plausible* space or the score is meaningless; "empty" may mean "already tried and failed," not "opportunity." |
| **When NOT to trust** | Combination lattice arbitrary/unpruned; competitor data treated as proof of a winner; no memory of past failed tests (check learning store). |

- Fact label: score = **INTERNAL CALCULATION (DERIVED)**; competitor-derived candidates = **INFERENCE / HYPOTHESIS**, never a fact; competitor economics remain **UNKNOWN** (per [02]).

## I5 · Coverage Score

| Field | Value |
|---|---|
| **Measures** | Of the strategically *intended* fingerprint targets (key personas, products, awareness stages, formats), what fraction actually have live creative. |
| **Why** | Exposes gaps against the plan — products/personas/funnel stages with no creative coverage (brief: "which products have creative coverage/gaps"). |
| **Decision** | Fill coverage gaps (produce for the uncovered target). `primary`. |
| **Inputs** | Intended target list (EXTERNAL — product feed / strategy input) vs. occupied tags (INFER). |
| **Formula** | `Coverage = covered_targets / total_intended_targets`, per dimension (persona coverage, product coverage, awareness-stage coverage, format coverage). |
| **Weights + reason** | Targets weighted by strategic priority (e.g. hero products, key personas) — priority is an **EXTERNAL business input**, not a Meta fact; weighting **verify at build with the operator**. |
| **Source / [02] class** | EXTERNAL intended-target list + INFER coverage -> **CALC DERIVED**. |
| **Level** | Account / by product / by persona. |
| **Comparison window** | Snapshot; trend as catalogue/strategy changes. |
| **Min sample** | Needs a defined intended-target list; without it, coverage is undefined (say so, don't invent targets). |
| **Limitations** | Coverage != performance (covered but losing is still a problem); depends on an accurate, current target list and accurate tags. |
| **When NOT to trust** | No agreed target list; product feed stale; tags low-confidence. |

- Fact label: **INTERNAL CALCULATION (DERIVED)** over EXTERNAL target list + INFERRED coverage.

---

# J · SCALING

Marginal, not average (brief): "what happens to efficiency if we spend another $10K?" The honest core
here is that **true marginal/incremental economics are INFERENCE, never fact** ([02]: incremental
revenue/iROAS, marginal CAC/ROAS, spend elasticity = **INFERENCE, MODEL ESTIMATE, never a fact**;
require experiments or MMM). Everything in J is presented with that ceiling stated.

Cross-cutting for all of J:
- **[02] class:** marginal / incremental / elasticity / saturation = **INFERENCE**; the observed
  spend and outcomes feeding them are **FETCH OFFICIAL**; average ROAS/CPA are **CALC DERIVED**.
- **Fact label:** all marginal outputs = **MODEL ESTIMATE / INFERENCE** with confidence. Never
  OFFICIAL. Blended / MER / true-margin truth = **EXTERNAL** (needs Shopify/finance — not derivable
  from Meta, per [02]).
- **Decision gate:** all `primary` — they answer "where does the next dollar go / what to scale /
  protect / replace" (brief's scale engine + final test).

## J1 · Marginal ROAS / Marginal CAC (next-dollar efficiency)

| Field | Value |
|---|---|
| **Measures** | Expected return (or cost per acquisition) on the *next* increment of spend, not the average so far. |
| **Why** | Average ROAS hides diminishing returns; the scaling decision depends on the margin, not the mean. |
| **Decision** | Scale / hold / pull back budget on this entity. `primary`. |
| **Inputs** | Daily spend vs. daily conversions/value at varying spend levels (FETCH OFFICIAL); ideally a spend-change history. |
| **Formula** | Estimated slope of the outcome-vs-spend response curve at current spend: `mROAS ~= delta_value / delta_spend` fit over observed spend changes (regression / response-curve fit), with confidence. |
| **Source / [02] class** | [02] — **INFERENCE** (needs experiments/MMM for truth); observed inputs FETCH OFFICIAL. |
| **Level** | Ad set / Campaign (budget-controlled levels); Account for portfolio. |
| **Comparison window** | Fit over recent spend-change history (e.g. trailing weeks with budget moves). |
| **Min sample** | Needs genuine spend *variation* to fit a slope; flat spend history -> cannot estimate a margin (report UNKNOWN, not a guess). |
| **Limitations** | Correlation-not-causation without a holdout; confounded by fatigue, seasonality, audience, attribution; iOS under-reporting. A modeled margin != incrementality. |
| **When NOT to trust** | No spend variation; recent structural changes; low conversion volume; no experimental validation — treat as directional only. |

- Fact label: **MODEL ESTIMATE / INFERENCE** with confidence; explicitly "directional, validate with a test."

## J2 · Spend Elasticity

| Field | Value |
|---|---|
| **Measures** | % change in outcomes for a % change in spend (curve shape: linear / diminishing / saturated). |
| **Why** | Quantifies how much headroom exists before efficiency erodes — the "another $10K" question. |
| **Decision** | Size the scale step (how much to add) and where. `primary`. |
| **Inputs** | Spend vs. outcome pairs over time at different spend levels (FETCH OFFICIAL). |
| **Formula** | Elasticity = `pct_delta_outcome / pct_delta_spend` from a fitted response curve; local elasticity at current spend. |
| **Source / [02] class** | [02] — **INFERENCE** (spend elasticity named explicitly as MODEL ESTIMATE). |
| **Level** | Ad set / Campaign / Account. |
| **Comparison window** | Trailing window with spend variation. |
| **Min sample** | Requires multiple distinct spend levels; single spend level -> not estimable. |
| **Limitations** | Same confounds as J1; curve shape can shift with fatigue/season; extrapolation beyond observed range is unreliable. |
| **When NOT to trust** | Extrapolating far past observed spend; no variation; noisy conversions. |

- Fact label: **MODEL ESTIMATE / INFERENCE**.

## J3 · Saturation Point

| Field | Value |
|---|---|
| **Measures** | The spend level beyond which incremental outcomes flatten (marginal ROAS falls below target / breakeven). |
| **Why** | Tells you the ceiling for profitable scaling on this entity before diversification is needed. |
| **Decision** | Cap spend here and diversify vs. keep pushing. `primary`. |
| **Inputs** | Fitted response curve (from J1/J2) + a breakeven/target ROAS threshold. |
| **Formula** | Spend where marginal ROAS = target/breakeven ROAS (curve inflection / plateau onset). |
| **Weights / threshold** | The target/breakeven ROAS is an **EXTERNAL business input** (needs contribution margin — Shopify/finance per [02]); using an arbitrary ROAS target as truth is disallowed — obtain it from the operator/finance. |
| **Source / [02] class** | **INFERENCE** curve + **EXTERNAL** breakeven -> INFERENCE verdict. |
| **Level** | Ad set / Campaign / Account. |
| **Comparison window** | Re-estimated as curve updates. |
| **Min sample** | Needs spend variation spanning near the plateau; if we've never spent near saturation, the point is extrapolated (low confidence). |
| **Limitations** | Extrapolated saturation is speculative; curve moves with creative refresh/fatigue; breakeven needs true margins (EXTERNAL), not Meta ROAS. |
| **When NOT to trust** | No high-spend observations; missing true margin; post-refresh curve reset. |

- Fact label: **MODEL ESTIMATE / INFERENCE**; breakeven input **EXTERNAL** (UNKNOWN until supplied).

## J4 · Scaling Headroom & Action (scale / protect / replace)

| Field | Value |
|---|---|
| **Measures** | Remaining profitable spend capacity per entity, and the resulting scale-engine verdict. |
| **Why** | Operationalises the brief's scale engine: what to scale, what to protect, what to replace, with marginal analysis. |
| **Decision** | The budget-reallocation action itself. `primary`. |
| **Inputs** | J1 marginal ROAS, J3 saturation, current spend, H8 fatigue state, quality/stability scores (Winners category, elsewhere in [01]). |
| **Formula** | `headroom = saturation_spend − current_spend`; verdict = rule-engine combine(mROAS vs target, headroom, fatigue state, stability) -> SCALE / PROTECT / REPLACE / HOLD, mapped to action priority (DO NOW / DO NEXT / WATCH / DO NOT ACT / NEEDS MORE DATA — brief). |
| **Source / [02] class** | Combines **INFERENCE** (marginal), **CALC DERIVED** (fatigue/stability), **FETCH OFFICIAL** (spend) -> **INFERENCE** verdict with confidence. |
| **Level** | Ad set / Campaign / Account. |
| **Comparison window** | Re-run each snapshot; watch stability of the verdict over days (trend, not one-day). |
| **Min sample** | Inherits the weakest input's floor; if marginal ROAS is unestimable -> verdict = NEEDS MORE DATA, never a fabricated scale call. |
| **Limitations** | Only as good as J1–J3 (all INFERENCE + confounds); a scale call ignoring fatigue (H) or a good-creative/bad-LP break (LP category) is wrong — must be cross-checked (AUTOPSY). |
| **When NOT to trust** | Marginal estimate low-confidence; fatiguing creative (don't scale into fatigue); attribution/margin gaps; recent structural change. |

- Fact label: verdict = **MODEL ESTIMATE / INFERENCE** with confidence + explicit drivers; scaling into fatigue or without true margin is flagged, not silently scaled.

---

## Consistency check vs [02]

| This file's metric group | [02] row it traces to | Class enforced |
|---|---|---|
| H1 frequency, H7 reach | Delivery/spend (FETCH OFFICIAL); trends CALC | OK |
| H2 CPM, H3 CTR | Delivery (FETCH OFFICIAL); trend/decay CALC | OK |
| H4 hook/hold decay | Attention — raw FETCH OFFICIAL, hook/hold **CALC DERIVED, not official** | OK (matches [02] trap note) |
| H5 CVR/CPA/ROAS decay | Conversion (purchases FETCH OFFICIAL, attribution-caveated; ratios CALC) | OK |
| H6 velocity/age | spend FETCH; velocity/concentration/age CALC | OK |
| H8 state, H9 forecast | composite CALC; forecast **INFERENCE** | OK |
| I1–I5 diversity family | fingerprint tags **INFER**; scores CALC over inferred inputs; embeddings EXTERNAL/CALC | OK |
| I4 white-space competitor part | competitor data EXTERNAL, **HYPOTHESIS**; economics UNKNOWN | OK |
| J1–J4 scaling family | marginal/elasticity/saturation **INFERENCE**; breakeven/MER **EXTERNAL**; spend FETCH | OK |

**No hardcoded benchmarks introduced.** Every threshold/weight is marked calibrated-INTERNAL or
UNKNOWN/verify-at-build, per the brief's benchmark-honesty rule and [02]'s "no hardcoded generic
benchmarks."
