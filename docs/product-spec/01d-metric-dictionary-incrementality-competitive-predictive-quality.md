# AdBrain Master Metric Dictionary — Part D

## Categories K–N: Incrementality · Competitive · Predictive · Data Quality

> **Artifact 01d of 28** · Master Metric Dictionary (final quarter).
> Persona: senior Meta media buyer + creative strategist + data scientist operating at $100M/mo.
> This dictionary answers **"what should we do next?"** — every metric below names the decision it changes or is cut.

---

### How to read this file

**Dependency note (verify at build):** the three canonical foundations referenced by the program (`brief.md`, `00-master-plan.md`, `02-meta-data-mapping.md`) were **not present in the repo** when this artifact was authored. Fact-labels, data-mapping classes and the 10-question schema below follow the conventions handed down in the artifact brief. When the foundations land, re-reconcile the data-mapping class of every metric here against `02-meta-data-mapping.md` (especially the FETCH/CANNOT-KNOW calls for the Ad Library and Lift APIs).

**Fact-label vocabulary** (rule 3 — applied to every value and every source line):

| Label | Meaning |
|---|---|
| OFFICIAL PLATFORM FACT | A field Meta returns directly (Insights / Ad Library / dataset diagnostics). |
| INTERNAL CALCULATION (DERIVED) | We compute it from official fields. Never call it a Meta field. |
| RESEARCH-BACKED | Supported by named public research/method; cite at build. |
| INDUSTRY BENCHMARK | A comparison value from the market. UNKNOWN until sourced. |
| MODEL ESTIMATE | Output of an AdBrain model (probability/forecast). Has error bars. |
| INFERENCE | A judgement drawn from indirect signals. Not a measurement. |
| UNKNOWN | Not knowable from our data as of Aug 2026. Verify at build or leave blank. |

**Data-mapping class** (rule 4): `FETCH` (Meta returns it) · `CALC` (we derive it) · `INFER` (judgement) · `EXTERNAL` (needs a non-Meta source) · `CANNOT-KNOW` (unobtainable at any level).

**The 10 questions** (rule 2) are answered for every metric: (1) what it measures, (2) why it matters, (3) the decision it drives, (4) inputs, (5) formula, (6) source, (7) comparison window, (8) minimum sample size, (9) limitations, (10) when NOT to trust it.

**Category-level honesty rules (non-negotiable):**
- **K Incrementality is INFERENCE / experiment-only.** Nothing here is ever an OFFICIAL PLATFORM FACT. Platform-reported ROAS ≠ incremental ROAS. If there is no holdout, there is no incrementality number — only a modelled estimate flagged as such.
- **L Competitive: active ≠ winning.** The Ad Library tells you an ad *exists and runs*, not that it *performs*. Competitor spend, impressions, CPA and ROAS are **CANNOT-KNOW** for commercial ads (narrow EU/political carve-out only).
- **M Predictive is MODEL ESTIMATE.** Every forecast ships with a confidence interval and a "model could be wrong when…" clause. A forecast is a decision aid, not a fact.
- **N Data Quality gates everything.** If N flags the data as thin, stale, broken or heavily modelled, every metric in 01a–01d inherits that caveat. N runs **before** any recommendation is surfaced.

---

# K. INCREMENTALITY

> **Reality check:** Meta's platform-reported conversions and ROAS include conversions that would have happened anyway (brand demand, retargeting people already buying, view-through on loyal customers). Incrementality isolates the *causal lift*. It can only be **measured by an experiment** (holdout / geo test / ghost ads) and otherwise only **estimated by a model**. Class for the whole category: `INFER` (experiment output is INFERENCE about the causal world; there is no `FETCH` truth for "would this have happened anyway").

## K1. Incremental Conversions (Lift)

| Field | Detail |
|---|---|
| **Level** | Campaign / account (test cell). **Class:** `INFER` (experiment). **Label:** INFERENCE (experiment-derived), never OFFICIAL. |
| **1. Measures** | The number of conversions caused by the ads that would **not** have occurred without them, over a defined test. |
| **2. Why it matters** | The single honest answer to "is this spend creating demand or harvesting it?" Everything downstream (iROAS, budget) is built on this. |
| **3. Decision it drives** | Whether to keep, scale, or kill a campaign/channel on a *causal* basis — and how much platform-reported conversions overstate reality (the haircut applied to reported numbers). |
| **4. Inputs** | Test-group conversions, control/holdout-group conversions, group sizes (or exposed vs. eligible-unexposed), test window. |
| **5. Formula** | `Incremental conversions = ConvRate(test) × Population − ConvRate(control) × Population` (or Meta Lift's exposed-vs-holdout estimate). DERIVED from experiment cells. |
| **6. Source** | Meta Conversion Lift / A/B test / Geo Lift output → **INFERENCE**. `INFER`. **Verify at build:** confirm which Lift/experiment APIs are still GA in Aug 2026 (Meta has repeatedly restructured Lift access). |
| **7. Comparison window** | The pre-registered test window only. Never compare a lift number to a non-experimental period. |
| **8. Min sample** | Powered for the expected lift: enough conversions in **both** cells to detect the minimum effect at the chosen significance (see K5). A common failure is a holdout too small to ever reach significance — flag before launch, not after. UNKNOWN exact n until effect size + variance are set → compute at design time. |
| **9. Limitations** | Only valid for the tested unit, budget and period; contamination between cells; short tests miss delayed conversions; geo tests need comparable markets. |
| **10. Don't trust when** | No true holdout exists (then this is a MODEL ESTIMATE, relabel it); test underpowered; cross-cell contamination; conversion tracking degraded (see N). |

## K2. Incremental Revenue

| Field | Detail |
|---|---|
| **Level** | Campaign / account. **Class:** `INFER`. **Label:** INFERENCE (experiment-derived). |
| **1. Measures** | Revenue caused by the ads beyond baseline, over the test. |
| **2. Why it matters** | Converts causal conversions into money — the numerator of the only ROAS worth trusting. |
| **3. Decision it drives** | Budget allocation across campaigns/channels by *true* revenue contribution, not attributed revenue. |
| **4. Inputs** | Incremental conversions (K1), incremental **AOV** (guard: incremental buyers may have different AOV than average). |
| **5. Formula** | `Incremental revenue = Incremental conversions × AOV(incremental)`. DERIVED. |
| **6. Source** | Experiment output + order value → **INFERENCE**. `INFER`. |
| **7. Comparison window** | Test window only. |
| **8. Min sample** | Inherits K1; revenue variance is higher than conversion variance, so needs *more* volume to stabilise (a few whales distort it). |
| **9. Limitations** | AOV assumption; refunds/returns not netted unless fed in; long purchase cycles truncated by window. |
| **10. Don't trust when** | AOV taken from all buyers rather than incremental buyers; returns ignored; sample dominated by outliers. |

## K3. Incremental ROAS (iROAS)

| Field | Detail |
|---|---|
| **Level** | Campaign / account. **Class:** `CALC` on `INFER` inputs. **Label:** INTERNAL CALCULATION (DERIVED) built on INFERENCE. **This is not Meta's "ROAS" field.** |
| **1. Measures** | Return on ad spend counting **only** incremental revenue. |
| **2. Why it matters** | Platform ROAS can read 4x while iROAS reads 1.1x on a retargeting-heavy campaign. iROAS is the profit-truth. |
| **3. Decision it drives** | Scale / hold / cut at the campaign and channel level; sets the real efficiency frontier for reallocation. |
| **4. Inputs** | Incremental revenue (K2), spend for the tested unit/window (OFFICIAL PLATFORM FACT `FETCH`). |
| **5. Formula** | `iROAS = Incremental revenue ÷ Spend`. DERIVED. |
| **6. Source** | K2 (INFERENCE) ÷ Meta spend (FETCH) → **INTERNAL CALCULATION (DERIVED)**. `CALC`. |
| **7. Comparison window** | Test window; only compare iROAS across units tested under comparable designs. |
| **8. Min sample** | Inherits K1/K2. Report with a CI, never a point estimate alone (see K5). |
| **9. Limitations** | Only as good as the experiment; not continuously available (tests are periodic); does not account for lifetime value beyond window. |
| **10. Don't trust when** | Presented as a live/daily number (it isn't — it's a periodic test result), or when derived without a holdout (that is a modelled iROAS, relabel MODEL ESTIMATE). |

## K4. Reported-to-Incremental Ratio (Attribution Haircut)

| Field | Detail |
|---|---|
| **Level** | Campaign / channel. **Class:** `CALC`. **Label:** INTERNAL CALCULATION (DERIVED). |
| **1. Measures** | How much Meta's attributed conversions/revenue overstate the incremental truth. |
| **2. Why it matters** | Lets AdBrain apply a *learned haircut* to daily platform-reported numbers between tests, so day-to-day decisions aren't made on inflated ROAS. |
| **3. Decision it drives** | The discount factor applied to platform ROAS in all interim (non-test) reporting and pacing. |
| **4. Inputs** | Platform-reported conversions/revenue (FETCH), incremental conversions/revenue (K1/K2). |
| **5. Formula** | `Haircut = Incremental ÷ Reported` (e.g. 0.35 = only 35% of reported was incremental). DERIVED. |
| **6. Source** | FETCH ÷ INFERENCE → **INTERNAL CALCULATION (DERIVED)**. `CALC`. |
| **7. Comparison window** | Ratio is estimated at test time and *applied forward* until the next test; decays in validity as conditions change. |
| **8. Min sample** | Inherits the test it's built from. |
| **9. Limitations** | A single ratio flattens variation by audience/creative/season; valid only while media mix is stable. |
| **10. Don't trust when** | Media mix, funnel stage, or seasonality has shifted since the test; applied to a campaign structurally different from the tested one. |

## K5. Lift Statistical Significance (p-value / Confidence Interval)

| Field | Detail |
|---|---|
| **Level** | Test. **Class:** `CALC`. **Label:** INTERNAL CALCULATION (DERIVED) / RESEARCH-BACKED method. |
| **1. Measures** | The probability the observed lift is not noise, and the plausible range of the true effect. |
| **2. Why it matters** | An "iROAS of 2.4x" with a CI spanning 0.5x–4.3x is a non-result. Significance separates a decision from a coin flip. |
| **3. Decision it drives** | Whether the lift result is allowed to drive any budget decision at all (the gate before K1–K4 are actioned). |
| **4. Inputs** | Cell conversion counts, cell sizes, chosen α (e.g. 0.05), variance. |
| **5. Formula** | Two-proportion z / bootstrap CI on lift; report effect ± CI and p. RESEARCH-BACKED. |
| **6. Source** | Computed from experiment cells → **INTERNAL CALCULATION (DERIVED)**. `CALC`. |
| **7. Comparison window** | Test window. |
| **8. Min sample** | This *is* the sample-size gate; pre-register minimum detectable effect and required n before launch. |
| **9. Limitations** | Significance ≠ business relevance (a tiny significant lift may not be worth scaling); multiple-testing inflation if many cells. |
| **10. Don't trust when** | Peeking / stopping early on a good day; α not corrected for multiple cells; underpowered test reported as "no effect" when it's really "no power". |

## K6. Baseline (Holdout) Conversion Rate

| Field | Detail |
|---|---|
| **Level** | Audience / account. **Class:** `INFER`. **Label:** INFERENCE (experiment-derived). |
| **1. Measures** | The conversion rate of comparable people who saw **no** ad — the "would have happened anyway" rate. |
| **2. Why it matters** | It is the anchor for every lift number; a rising baseline (strong organic demand) shrinks true incrementality even as reported numbers hold. |
| **3. Decision it drives** | Whether observed performance reflects the ads or underlying demand; informs the haircut (K4) and whether to reduce spend when organic demand is already strong. |
| **4. Inputs** | Holdout-group conversions and size. |
| **5. Formula** | `Baseline CVR = Holdout conversions ÷ Holdout population`. DERIVED. |
| **6. Source** | Holdout cell → **INFERENCE**. `INFER`. |
| **7. Comparison window** | Test window; track trend across successive tests. |
| **8. Min sample** | Holdout must be large enough to estimate a small baseline rate stably. |
| **9. Limitations** | Holdouts cost revenue (opportunity cost); may be politically hard to sustain; contamination inflates it. |
| **10. Don't trust when** | Holdout too small; holdout users still reached via other channels (cross-channel contamination). |

## K7. Marginal iROAS (Spend-Response / Diminishing Returns)

| Field | Detail |
|---|---|
| **Level** | Campaign / channel. **Class:** `INFER` (experiment) → `MODEL ESTIMATE` between tests. **Label:** INFERENCE when tested; MODEL ESTIMATE when interpolated. |
| **1. Measures** | The incremental return on the **next** dollar at the current spend level (not the average iROAS). |
| **2. Why it matters** | Average iROAS says "this channel is good"; marginal iROAS says "the next \$10k here returns less than backend." The scaling decision lives here. |
| **3. Decision it drives** | Exactly how much more (or less) to spend on a unit before it stops paying — the reallocation frontier. |
| **4. Inputs** | Multiple spend-level test points (or observed spend/return curve), current spend. |
| **5. Formula** | Slope of the incremental-revenue-vs-spend curve at current spend (`d(incremental revenue)/d(spend)`). DERIVED / modelled. |
| **6. Source** | Multi-cell spend test → INFERENCE; interpolation between tests → **MODEL ESTIMATE**. `INFER`/`CALC`. |
| **7. Comparison window** | Requires several spend levels observed within a comparable period. |
| **8. Min sample** | Needs multiple powered points across the spend range — expensive; often only 2–3 points available, so curve shape is assumed → flag. |
| **9. Limitations** | Curve shifts with creative refresh, seasonality, auction competition; extrapolation beyond tested range is unreliable. |
| **10. Don't trust when** | Extrapolating past the highest tested spend; only one spend point exists (then it's a guess, not a curve). |

## K8. Ghost/PSA Lift (Estimated Incrementality Without a Revenue Holdout)

| Field | Detail |
|---|---|
| **Level** | Campaign. **Class:** `INFER`. **Label:** INFERENCE (experiment-derived); relabel MODEL ESTIMATE if no true control. |
| **1. Measures** | Lift estimated by showing the control group a placebo/charity (PSA) ad or "ghost" ad instead of nothing, isolating the ad effect from selection bias. |
| **2. Why it matters** | Cleaner than a pure no-ad holdout because both cells are "in the auction," reducing selection bias between exposed and unexposed. |
| **3. Decision it drives** | Same as K1 (causal keep/scale/kill) where a pure holdout is impractical. |
| **4. Inputs** | Test-ad cell vs. ghost/PSA cell conversions and sizes. |
| **5. Formula** | Same lift math as K1 with PSA cell as control. |
| **6. Source** | Ghost-ad / PSA experiment → **INFERENCE**. `INFER`. **Verify at build:** current availability of ghost-ad methodology within Meta tooling. |
| **7. Comparison window** | Test window. |
| **8. Min sample** | As K1/K5. |
| **9. Limitations** | Requires methodology support; PSA exposure is not truly "no ad" so measures a slightly different estimand. |
| **10. Don't trust when** | Implemented without genuine randomisation; treated as identical to a pure-holdout lift. |

**Cut from K (named for discipline):** "Incrementality score" as a single always-on number with no experiment behind it → that is a MODEL ESTIMATE dressed as a fact; only surface it labelled as such with its inputs (K4 haircut + model), never as "incrementality."

---

# L. COMPETITIVE (Meta Ad Library)

> **Reality check:** The Ad Library shows what ads a page **is running**, the creative, and (for most commercial ads) a "started running on" date. It does **not** show impressions, spend, CTR, CPA or ROAS for commercial ads — those are **CANNOT-KNOW**. A narrow carve-out exists for political/social-issue ads (spend & impression **ranges**) and expanded EU/DSA transparency (reach data in the EU); treat both as exceptions, not the base case. **Active ≠ winning.** A long-running ad is *probably* working, but that is INFERENCE, not proof.

## L1. Competitor Active Ad Count

| Field | Detail |
|---|---|
| **Level** | Competitor (page). **Class:** `FETCH`. **Label:** OFFICIAL PLATFORM FACT (Ad Library). |
| **1. Measures** | Number of ads a competitor page currently has active. |
| **2. Why it matters** | A crude activity/aggression signal; large swings flag a push or a pullback. |
| **3. Decision it drives** | Whether to investigate a competitor's ramp (defend/steal share) or treat them as dormant — a *triage* signal, not a spend signal. |
| **4. Inputs** | Ad Library query by page, active status. |
| **5. Formula** | Count of active ads. FETCH (count). |
| **6. Source** | Meta Ad Library API → **OFFICIAL PLATFORM FACT**. `FETCH`. |
| **7. Comparison window** | Snapshot + trend over time (we must store snapshots; Library gives "now"). |
| **8. Min sample** | n/a (a census of their visible ads), but small counts are noisy. |
| **9. Limitations** | Count ≠ spend or reach; many near-duplicate variants inflate it; a single big-budget ad can beat 50 small ones. |
| **10. Don't trust when** | Read as a budget proxy; comparing pages with different testing styles (heavy DCT testers show huge counts at low spend). |

## L2. Ad Longevity / Days Active

| Field | Detail |
|---|---|
| **Level** | Competitor ad / creative. **Class:** `CALC` on `FETCH` date → `INFER` on "winning." **Label:** INTERNAL CALCULATION (DERIVED) from an OFFICIAL date; INFERENCE about performance. |
| **1. Measures** | How long a specific competitor ad has been running. |
| **2. Why it matters** | The best available proxy for "this creative works for them" — advertisers rarely keep losers live for months. |
| **3. Decision it drives** | Which competitor angles/creatives to study and adapt (creative strategy), ranked by presumed staying power. |
| **4. Inputs** | Ad "started running on" date (FETCH), today. |
| **5. Formula** | `Days active = today − start date`. DERIVED. |
| **6. Source** | Ad Library start date → **OFFICIAL PLATFORM FACT** for the date; longevity→performance link is **INFERENCE**. `CALC`+`INFER`. |
| **7. Comparison window** | Rolling; compare within a competitor set. |
| **8. Min sample** | Judge patterns across many ads, not one; one long-runner can be inertia. |
| **9. Limitations** | Long-running ≠ profitable (could be brand/always-on, or neglect); date granularity varies; relaunches reset the clock. |
| **10. Don't trust when** | Treated as proof of performance; used on brand/awareness ads that run long by design regardless of ROI. |

## L3. Creative Launch Cadence (New Ads / Week)

| Field | Detail |
|---|---|
| **Level** | Competitor. **Class:** `CALC` on `FETCH`. **Label:** INTERNAL CALCULATION (DERIVED). |
| **1. Measures** | Rate at which a competitor introduces new creatives. |
| **2. Why it matters** | Testing velocity is a leading indicator of a competitor's creative maturity and likely fatigue-management. |
| **3. Decision it drives** | Whether AdBrain's own creative-output cadence is competitive; when to raise testing volume. |
| **4. Inputs** | Start dates of new ads over time (requires our stored snapshots). |
| **5. Formula** | `New distinct ads in period ÷ weeks`. DERIVED. |
| **6. Source** | Ad Library start dates over stored snapshots → **INTERNAL CALCULATION (DERIVED)**. `CALC`. |
| **7. Comparison window** | Weekly / monthly trend. |
| **8. Min sample** | Several weeks of snapshots before the rate is meaningful. |
| **9. Limitations** | Minor variants counted as "new"; cadence ≠ quality or budget. |
| **10. Don't trust when** | Snapshot history is short/gappy; dedup of variants not applied. |

## L4. Format & Placement Mix

| Field | Detail |
|---|---|
| **Level** | Competitor. **Class:** `CALC` on `FETCH`. **Label:** INTERNAL CALCULATION (DERIVED). |
| **1. Measures** | Share of a competitor's active ads by format (video/image/carousel) and, where shown, publisher platform. |
| **2. Why it matters** | Reveals where a competitor is betting (e.g. heavy Reels/video) and format gaps AdBrain could exploit. |
| **3. Decision it drives** | Format prioritisation in AdBrain's creative brief. |
| **4. Inputs** | Creative type per ad (FETCH), platform tags where available. |
| **5. Formula** | `% of active ads by format`. DERIVED. |
| **6. Source** | Ad Library creative metadata → **INTERNAL CALCULATION (DERIVED)**. `CALC`. |
| **7. Comparison window** | Snapshot + trend. |
| **8. Min sample** | Enough ads to make shares non-trivial. |
| **9. Limitations** | Mix ≠ budget behind each format; placement info incomplete for commercial ads. |
| **10. Don't trust when** | Inferring spend weighting from count weighting. |

## L5. Messaging / Angle & Offer Themes

| Field | Detail |
|---|---|
| **Level** | Competitor / creative. **Class:** `INFER`. **Label:** INFERENCE (NLP on creative text). |
| **1. Measures** | The dominant hooks, value props, and offers (discount/BOGO/free-trial) in competitor creative. |
| **2. Why it matters** | Shows the market's current messaging consensus and white space; flags a competitor's promo intensity. |
| **3. Decision it drives** | Creative angle selection and counter-positioning; whether to match a promo war or avoid it. |
| **4. Inputs** | Ad body/headline text & imagery (FETCH), NLP/vision extraction (our model). |
| **5. Formula** | Theme/offer classification and frequency. INFERENCE (model output). |
| **6. Source** | Ad Library creative text + AdBrain classifier → **INFERENCE**. `INFER`. |
| **7. Comparison window** | Snapshot + trend. |
| **8. Min sample** | Enough creatives per competitor for themes to be stable, not anecdotal. |
| **9. Limitations** | Classifier error; sarcasm/brand voice mis-read; theme prevalence ≠ theme *performance* (no spend behind it). |
| **10. Don't trust when** | Treated as "what works" rather than "what they're saying"; small creative counts. |

## L6. New Geo / Market Entry Signal

| Field | Detail |
|---|---|
| **Level** | Competitor. **Class:** `INFER` on `FETCH`. **Label:** INFERENCE. |
| **1. Measures** | A competitor beginning to run ads targeting a country/market they weren't in before. |
| **2. Why it matters** | Early warning of competitive expansion into AdBrain's markets (or a market worth following them into). |
| **3. Decision it drives** | Defensive spend / market-entry timing. |
| **4. Inputs** | Ad Library targeting country field over time (FETCH), our snapshots. |
| **5. Formula** | New country appearing in a competitor's active-ad targeting vs. prior snapshot. INFERENCE. |
| **6. Source** | Ad Library country data → **INFERENCE** (about intent). `INFER`. |
| **7. Comparison window** | Snapshot-over-snapshot. |
| **8. Min sample** | Confirm across multiple ads before calling an "entry." |
| **9. Limitations** | Country shown is *where ads appear*, not necessarily a strategic launch; test buys look like entries. |
| **10. Don't trust when** | One stray ad; EU-only enhanced data mistaken for global behaviour. |

## L7. Competitor Spend / Impressions / ROAS

| Field | Detail |
|---|---|
| **Level** | Competitor. **Class:** `CANNOT-KNOW` (commercial) with a narrow `FETCH`-range exception. **Label:** UNKNOWN for commercial ads. |
| **1. Measures** | What a competitor actually spends, how many impressions they buy, and their returns. |
| **2. Why it matters** | It's what everyone wants — and mostly can't have. Naming it explicitly stops AdBrain from fabricating it. |
| **3. Decision it drives** | *None reliably* for commercial competitors → **advanced/vanity — not primary.** Do not drive budget off guessed competitor spend. |
| **4. Inputs** | For political/social-issue ads only: Ad Library spend & impression **ranges**. EU/DSA: reach data. Commercial: nothing. |
| **5. Formula** | n/a (ranges are read directly where they exist). |
| **6. Source** | Political/social-issue Ad Library ranges → **OFFICIAL PLATFORM FACT (range)** `FETCH`; all commercial spend/ROAS → **UNKNOWN / CANNOT-KNOW**. **Verify at build:** exact EU/DSA fields available via API in Aug 2026. |
| **7. Comparison window** | n/a for commercial. |
| **8. Min sample** | n/a. |
| **9. Limitations** | Third-party "spend estimate" tools are modelled guesses — if used, label **MODEL ESTIMATE (third-party)**, never fact. |
| **10. Don't trust when** | Any commercial-competitor spend/ROAS figure is presented as known; a third-party estimate is quoted as truth. |

**Cut from L (named for discipline):** "Share of Voice" and "competitor CTR/CPA" for commercial advertisers → **CANNOT-KNOW**; if a directional SoV proxy (by ad count) is shown, it must be labelled INTERNAL CALCULATION (DERIVED, count-based proxy) and marked *advanced/vanity — not primary*, because count is not impressions.

---

# M. PREDICTIVE

> **Reality check:** Every metric here is a **MODEL ESTIMATE** — an AdBrain model's forecast or probability, not an observed fact. Each ships with a confidence interval and an explicit "model is unreliable when…" clause. Forecasts drive *proactive* decisions (act before the number turns bad), which is the whole point of AdBrain — but a forecast presented without error bars is a lie. Data-mapping class across M: `CALC` (models built on FETCH history), never `FETCH`.

## M1. Creative Fatigue Probability

| Field | Detail |
|---|---|
| **Level** | Ad / creative. **Class:** `CALC` (model). **Label:** MODEL ESTIMATE. |
| **1. Measures** | Probability a creative is entering fatigue (declining efficiency from overexposure) now / within N days. |
| **2. Why it matters** | Catches decay *before* CPA blows out, enabling refresh ahead of the drop rather than after. |
| **3. Decision it drives** | When to refresh/retire a creative and queue its replacement. |
| **4. Inputs** | Frequency, CTR/CTR-decay slope, CPM trend, CVR trend, spend, days live (all FETCH history). |
| **5. Formula** | Classifier/survival model over the decay signals → probability + predicted days-to-fatigue. MODEL ESTIMATE. |
| **6. Source** | AdBrain model on Meta Insights history → **MODEL ESTIMATE**. `CALC`. Any "frequency > X = fatigued" rule is **INDUSTRY BENCHMARK / UNKNOWN threshold — verify/learn per account**, not a truth. |
| **7. Comparison window** | Trailing trend (e.g. 7–14d slope) vs. the creative's own baseline. |
| **8. Min sample** | Enough impressions/conversions for CTR & CVR trends to be non-noise; low-volume creatives → suppress the probability, don't guess. |
| **9. Limitations** | Fatigue confounded with auction shifts, seasonality, audience saturation; correlation not causation. |
| **10. Don't trust when** | Volume is thin; a CPM spike is market-wide (not creative-specific); the creative just exited learning (early noise). |

## M2. Days-to-Fatigue Forecast

| Field | Detail |
|---|---|
| **Level** | Ad / creative. **Class:** `CALC`. **Label:** MODEL ESTIMATE. |
| **1. Measures** | Estimated days until the creative crosses a fatigue threshold. |
| **2. Why it matters** | Turns M1's probability into a schedule — when the replacement must be ready. |
| **3. Decision it drives** | Creative production timing / refresh calendar. |
| **4. Inputs** | Current decay slope, frequency accumulation rate, remaining fresh audience estimate. |
| **5. Formula** | Extrapolate decay curve to threshold; report median + CI. MODEL ESTIMATE. |
| **6. Source** | AdBrain model → **MODEL ESTIMATE**. `CALC`. |
| **7. Comparison window** | Forward projection from trailing window. |
| **8. Min sample** | As M1. |
| **9. Limitations** | Assumes current trajectory holds; budget changes reshape it. |
| **10. Don't trust when** | Spend/audience about to change materially; thin data; wide CI ignored. |

## M3. Spend / Budget Pacing Forecast

| Field | Detail |
|---|---|
| **Level** | Campaign / account. **Class:** `CALC`. **Label:** MODEL ESTIMATE. |
| **1. Measures** | Projected end-of-period spend vs. budget at current pace. |
| **2. Why it matters** | Prevents under-delivery (money left on table) and overspend before month-end. |
| **3. Decision it drives** | Mid-flight budget adjustments / pacing corrections. |
| **4. Inputs** | Spend-to-date (FETCH), days elapsed/remaining, delivery trend, budget. |
| **5. Formula** | `Projected spend = spend-to-date + (avg daily × days remaining)`, trend-adjusted. MODEL ESTIMATE. |
| **6. Source** | Meta spend history + model → **MODEL ESTIMATE** (the projection). `CALC`. Spend-to-date itself is OFFICIAL PLATFORM FACT. |
| **7. Comparison window** | Current flight/period. |
| **8. Min sample** | A few days of delivery for a stable daily rate. |
| **9. Limitations** | Auction volatility, weekends, learning phase distort the daily rate; new campaigns pace erratically. |
| **10. Don't trust when** | Early in a flight; right after a budget/structure change; strong day-of-week seasonality unmodelled. |

## M4. Conversion & Revenue Forecast (7/14/30d)

| Field | Detail |
|---|---|
| **Level** | Campaign / account. **Class:** `CALC`. **Label:** MODEL ESTIMATE. |
| **1. Measures** | Expected conversions/revenue over the next horizon at current settings. |
| **2. Why it matters** | Enables planning and early detection of a coming shortfall. |
| **3. Decision it drives** | Whether to intervene now to hit a target; expectation-setting with stakeholders. |
| **4. Inputs** | Conversion/revenue history (FETCH), spend plan, seasonality, pending attribution maturation (see N7). |
| **5. Formula** | Time-series/regression forecast with CI. MODEL ESTIMATE. |
| **6. Source** | AdBrain model on Insights → **MODEL ESTIMATE**. `CALC`. |
| **7. Comparison window** | Forward horizon vs. trailing baseline + YoY seasonality. |
| **8. Min sample** | Enough history to fit seasonality; short-history accounts → wide CI, say so. |
| **9. Limitations** | Breaks on regime changes (new offer, big creative shift, tracking break); revenue forecasts high-variance. |
| **10. Don't trust when** | A structural change just happened; attribution still maturing (recent days will be revised up); CI dwarfs the point estimate. |

## M5. Audience Saturation Forecast

| Field | Detail |
|---|---|
| **Level** | Adset / audience. **Class:** `CALC`. **Label:** MODEL ESTIMATE. |
| **1. Measures** | When an audience's fresh reach runs out and frequency starts forcing efficiency down. |
| **2. Why it matters** | Distinguishes *creative* fatigue (M1) from *audience* exhaustion — different fixes (new creative vs. new audience/expansion). |
| **3. Decision it drives** | When to expand/rotate audiences or lift budget caps. |
| **4. Inputs** | Reach, frequency trend, audience size estimate, incremental-reach rate (FETCH). |
| **5. Formula** | Reach-curve saturation model; project frequency ceiling. MODEL ESTIMATE. |
| **6. Source** | AdBrain model on Insights → **MODEL ESTIMATE**. `CALC`. Audience size figures from Meta are themselves ESTIMATES — inherit that error. |
| **7. Comparison window** | Trailing reach/frequency trend. |
| **8. Min sample** | Sufficient reach history. |
| **9. Limitations** | Meta audience-size estimates are broad; Advantage+/broad targeting makes "audience size" fuzzy. |
| **10. Don't trust when** | Broad/Advantage+ targeting (no fixed audience to saturate); reach data thin. |

## M6. Predicted CPA at Scale (Spend Elasticity)

| Field | Detail |
|---|---|
| **Level** | Campaign / adset. **Class:** `CALC`. **Label:** MODEL ESTIMATE. |
| **1. Measures** | Expected CPA if spend is increased by X% (the efficiency cost of scaling). |
| **2. Why it matters** | Scaling almost always raises CPA; this quantifies how much *before* committing budget. |
| **3. Decision it drives** | How aggressively to scale a winner before it breaks the CPA target. |
| **4. Inputs** | Historical spend↔CPA relationship (FETCH), current spend, auction/competition trend. |
| **5. Formula** | Elasticity curve fit; project CPA at target spend + CI. MODEL ESTIMATE. Pairs with the causal K7 (marginal iROAS). |
| **6. Source** | AdBrain model → **MODEL ESTIMATE**. `CALC`. |
| **7. Comparison window** | Trailing spend/CPA observations. |
| **8. Min sample** | Needs variation in historical spend to fit elasticity; flat-spend history → cannot fit, suppress. |
| **9. Limitations** | Correlational (not a controlled spend test — that's K7); auction competition can dominate; extrapolation risk. |
| **10. Don't trust when** | Spend has never varied; extrapolating far beyond observed range; auction conditions shifting. |

## M7. New-Creative Win Probability (Early Signal)

| Field | Detail |
|---|---|
| **Level** | Ad / creative. **Class:** `CALC`. **Label:** MODEL ESTIMATE. |
| **1. Measures** | Probability a newly launched creative will become a top performer, from early signals. |
| **2. Why it matters** | Cuts losers faster and doubles down on likely winners before full significance — speeds the testing loop. |
| **3. Decision it drives** | Early kill/scale of a fresh creative during testing. |
| **4. Inputs** | Early CTR, hook rate/thumbstop, early CVR, spend so far (FETCH), historical patterns of eventual winners. |
| **5. Formula** | Classifier trained on labelled historical creatives; probability + calibration. MODEL ESTIMATE. |
| **6. Source** | AdBrain model → **MODEL ESTIMATE**. `CALC`. |
| **7. Comparison window** | First hours/days vs. learned early-winner profile. |
| **8. Min sample** | Enough early impressions to trust the early signal; below floor → "insufficient signal," not a probability. |
| **9. Limitations** | Early metrics (CTR) correlate imperfectly with final CVR/ROAS; survivorship in training data; learning-phase noise. |
| **10. Don't trust when** | Still deep in learning phase; impressions below the early-signal floor; the creative type is unlike anything in training. |

## M8. Budget Reallocation Recommendation Score

| Field | Detail |
|---|---|
| **Level** | Campaign / adset (cross-unit). **Class:** `CALC`. **Label:** MODEL ESTIMATE. |
| **1. Measures** | The expected incremental return of moving the next budget unit from one campaign to another. |
| **2. Why it matters** | This is AdBrain's headline "what to do next" output — ranking moves by predicted payoff. |
| **3. Decision it drives** | The actual reallocation actions AdBrain proposes. |
| **4. Inputs** | Marginal iROAS/CPA curves (K7/M6), fatigue (M1), saturation (M5), pacing (M3), confidence from N. |
| **5. Formula** | Rank units by predicted marginal return, discounted by uncertainty (N) and haircut (K4). MODEL ESTIMATE. |
| **6. Source** | Composite AdBrain model → **MODEL ESTIMATE**. `CALC`. |
| **7. Comparison window** | Current period, forward-looking. |
| **8. Min sample** | Only rank units that individually clear their own sample floors; low-confidence units flagged, not silently ranked. |
| **9. Limitations** | Compounds upstream model error; assumes curves are stable during the move. |
| **10. Don't trust when** | Upstream inputs are low-confidence (N flags), or the recommendation swings wildly day-to-day (instability = don't act). |

---

# N. DATA QUALITY

> **Reality check:** N is the **gate**, not a report tab. It runs before any K/L/M/01a–c metric is surfaced, and stamps every recommendation with a confidence level. If tracking is broken, data is thin, or conversions are heavily modelled, AdBrain must *say so* and *hold or downgrade* the recommendation rather than act confidently on garbage. Several N metrics are genuine OFFICIAL PLATFORM FACTS (Meta exposes tracking diagnostics); others are INTERNAL CALCULATIONS comparing sources.

## N1. Event Match Quality (EMQ)

| Field | Detail |
|---|---|
| **Level** | Pixel / dataset (event). **Class:** `FETCH`. **Label:** OFFICIAL PLATFORM FACT. |
| **1. Measures** | Meta's score (roughly 0–10 / rated) for how well conversion events are matched to users via the parameters sent. |
| **2. Why it matters** | Low EMQ → under-reported conversions and worse optimisation; it silently degrades every downstream metric. |
| **3. Decision it drives** | Whether to fix tracking (CAPI params) *before* trusting performance or making budget calls. |
| **4. Inputs** | Meta Events Manager diagnostics per event. |
| **5. Formula** | Reported directly by Meta. FETCH. |
| **6. Source** | Meta Events Manager / diagnostics API → **OFFICIAL PLATFORM FACT**. `FETCH`. **Verify at build:** exact scale/labels and API exposure in Aug 2026. |
| **7. Comparison window** | Current; watch for drops. |
| **8. Min sample** | Per event type with enough volume. |
| **9. Limitations** | A score, not a guarantee of accuracy; high EMQ still allows other gaps (e.g. missing events entirely). |
| **10. Don't trust when** | Used as sole proof tracking is healthy (pair with N5/N6). |

## N2. Modeled-Conversions Share

| Field | Detail |
|---|---|
| **Level** | Account / campaign. **Class:** `FETCH`/`CALC`. **Label:** OFFICIAL PLATFORM FACT (Meta labels modelled conversions) where exposed; else INTERNAL CALCULATION. |
| **1. Measures** | Share of reported conversions that Meta **modelled/estimated** rather than directly observed (post-ATT statistical modelling). |
| **2. Why it matters** | High modelled share means the conversion numbers are partly Meta's estimate — precision at ad/creative level drops. |
| **3. Decision it drives** | How granular a decision the data can bear (modelled data is fine at campaign level, shaky at single-creative level). |
| **4. Inputs** | Meta's modelled-vs-observed reporting where available. |
| **5. Formula** | `Modelled conversions ÷ total conversions`. |
| **6. Source** | Meta reporting → **OFFICIAL PLATFORM FACT** where the split is exposed; **INTERNAL CALCULATION** if inferred. `FETCH`/`CALC`. **Verify at build:** whether the observed/modelled split is available via API vs. UI only. |
| **7. Comparison window** | Current; trend. |
| **8. Min sample** | n/a. |
| **9. Limitations** | Split not always exposed at fine granularity; definition shifts as Meta updates modelling. |
| **10. Don't trust when** | Making ad/creative-level cuts off heavily modelled data; the split is inferred rather than reported. |

## N3. Sample-Size Sufficiency Flag

| Field | Detail |
|---|---|
| **Level** | Any (ad→account). **Class:** `CALC`. **Label:** INTERNAL CALCULATION (DERIVED). |
| **1. Measures** | Whether a unit has enough conversions/impressions to support the decision being asked of it. |
| **2. Why it matters** | The most common analytics error is deciding on noise; this flag blocks it. |
| **3. Decision it drives** | Whether a metric/recommendation for that unit is shown, downgraded, or suppressed. |
| **4. Inputs** | Conversions, impressions, spend for the unit; the decision's required precision. |
| **5. Formula** | Compare observed n to the power/precision requirement for the specific comparison. DERIVED. |
| **6. Source** | Computed from Insights → **INTERNAL CALCULATION (DERIVED)**. `CALC`. |
| **7. Comparison window** | Matches the decision's window. |
| **8. Min sample** | This metric *defines* the floors; thresholds are decision-specific and **learned/UNKNOWN until set** — never a hard-coded "50 conversions" presented as truth. |
| **9. Limitations** | Floors depend on effect size and variance; one universal threshold is wrong. |
| **10. Don't trust when** | A single blanket threshold is applied across very different metrics/decisions. |

## N4. Attribution Window & Setting Coverage

| Field | Detail |
|---|---|
| **Level** | Campaign / account. **Class:** `FETCH`+`CALC`. **Label:** OFFICIAL PLATFORM FACT (the setting) + INTERNAL CALCULATION (the gap). |
| **1. Measures** | Which attribution setting is in force (e.g. 7-day click / 1-day view) and the conversions likely falling outside it. |
| **2. Why it matters** | Post-ATT, view-through and longer windows are truncated; comparing units on different settings is apples-to-oranges. |
| **3. Decision it drives** | Whether cross-unit comparisons are valid; whether to widen/normalise the window before deciding. |
| **4. Inputs** | Attribution setting per campaign (FETCH), click/view split. |
| **5. Formula** | Flag setting mismatches across compared units; estimate out-of-window conversions. |
| **6. Source** | Meta setting → **OFFICIAL PLATFORM FACT**; the gap estimate → **INTERNAL CALCULATION / MODEL ESTIMATE**. `FETCH`/`CALC`. |
| **7. Comparison window** | Aligned to the attribution setting. |
| **8. Min sample** | n/a for the setting; volume for the gap estimate. |
| **9. Limitations** | True out-of-window conversions are not directly observable; long cycles undercount. |
| **10. Don't trust when** | Comparing campaigns on different attribution settings as if equal; ignoring view-through truncation for consideration campaigns. |

## N5. Tracking-Change / Break Detection

| Field | Detail |
|---|---|
| **Level** | Pixel / dataset / account. **Class:** `CALC`. **Label:** INTERNAL CALCULATION (DERIVED) / anomaly model. |
| **1. Measures** | Sudden, unexplained drops or spikes in event volume signalling a pixel/CAPI break, deploy, or config change. |
| **2. Why it matters** | A silent tracking break makes performance "collapse" that is actually a measurement artefact — the worst false alarm to act on. |
| **3. Decision it drives** | Halt automated actions and alert to fix tracking, rather than "optimising" against broken data. |
| **4. Inputs** | Event-volume time series per event/source, deploy signals if available. |
| **5. Formula** | Anomaly detection vs. expected range (see N9). MODEL ESTIMATE / DERIVED. |
| **6. Source** | AdBrain monitor on Meta event data → **INTERNAL CALCULATION (DERIVED)**. `CALC`. |
| **7. Comparison window** | Short-term vs. expected band. |
| **8. Min sample** | Baseline volume high enough that a drop is detectable. |
| **9. Limitations** | Real demand drops look like breaks and vice-versa; needs the source split to disambiguate. |
| **10. Don't trust when** | Low-volume events (noisy); genuine seasonality unmodelled; single-source view (can't tell pixel vs. CAPI). |

## N6. Pixel↔CAPI Deduplication / Discrepancy Rate

| Field | Detail |
|---|---|
| **Level** | Pixel / dataset. **Class:** `FETCH`/`CALC`. **Label:** OFFICIAL PLATFORM FACT (dedup diagnostics) / INTERNAL CALCULATION. |
| **1. Measures** | How well browser-pixel and server (CAPI) events are deduplicated, and the discrepancy between sources. |
| **2. Why it matters** | Poor dedup → double-counted or missing conversions; a core CAPI health check post-ATT. |
| **3. Decision it drives** | Whether to fix event dedup keys before trusting conversion counts. |
| **4. Inputs** | Meta dedup diagnostics; pixel vs. CAPI event counts. |
| **5. Formula** | Discrepancy/overlap rates from diagnostics. |
| **6. Source** | Meta Events Manager diagnostics → **OFFICIAL PLATFORM FACT** where exposed; derived comparisons → **INTERNAL CALCULATION**. `FETCH`/`CALC`. |
| **7. Comparison window** | Current; trend. |
| **8. Min sample** | Adequate event volume from both sources. |
| **9. Limitations** | Diagnostics may lag; misconfig can hide as "healthy." |
| **10. Don't trust when** | One source is effectively off (nothing to dedup against); diagnostics stale. |

## N7. Data Freshness / Attribution Maturation Lag

| Field | Detail |
|---|---|
| **Level** | Any. **Class:** `CALC`. **Label:** INTERNAL CALCULATION (DERIVED). |
| **1. Measures** | How much recent data is still maturing (conversions attributed with delay; modelled data restated). |
| **2. Why it matters** | Yesterday's ROAS almost always revises **up**; acting on same-day numbers over-kills good units. |
| **3. Decision it drives** | Whether recent-window data is stable enough to act on, or must "settle" first. |
| **4. Inputs** | Attribution window, known reporting lag, historical restatement pattern. |
| **5. Formula** | Flag windows within the maturation period; estimate expected upward revision. DERIVED. |
| **6. Source** | AdBrain, from Meta attribution behaviour → **INTERNAL CALCULATION (DERIVED)**. `CALC`. |
| **7. Comparison window** | Recent N days vs. matured baseline. |
| **8. Min sample** | n/a. |
| **9. Limitations** | Exact maturation curve varies by account/vertical; modelled restatements are unpredictable. |
| **10. Don't trust when** | Judging the last 24–72h as final; comparing an unmatured recent window to a matured one. |

## N8. Source Discrepancy (Meta vs. Backend / GA / Shopify)

| Field | Detail |
|---|---|
| **Level** | Account / campaign. **Class:** `EXTERNAL`+`CALC`. **Label:** INTERNAL CALCULATION (DERIVED) across sources. |
| **1. Measures** | The gap between Meta-reported conversions/revenue and the advertiser's own backend (orders/CRM/GA4). |
| **2. Why it matters** | Meta over-attributes (last-touch, view-through, cross-device); backend is ground truth for money. This gap sizes the trust problem. |
| **3. Decision it drives** | Which number funds decisions (backend for P&L; Meta for optimisation), and how big a haircut to apply (feeds K4). |
| **4. Inputs** | Meta conversions/revenue (FETCH) + backend/GA/Shopify export (EXTERNAL). |
| **5. Formula** | `Discrepancy = Meta-reported ÷ backend` per period/campaign. DERIVED. |
| **6. Source** | Meta (FETCH) vs. external system (EXTERNAL) → **INTERNAL CALCULATION (DERIVED)**. `EXTERNAL`+`CALC`. |
| **7. Comparison window** | Same period, aligned time zones and definitions. |
| **8. Min sample** | Enough orders to be stable; align on the same conversion definition. |
| **9. Limitations** | Requires a backend feed (often absent); definition/timezone mismatches masquerade as discrepancy; not a substitute for incrementality (backend still can't tell you what was incremental — that's K). |
| **10. Don't trust when** | No backend integration; definitions/time windows unaligned; treated as an incrementality measure (it isn't). |

## N9. Statistical-Significance / Confidence Flag (for any comparison)

| Field | Detail |
|---|---|
| **Level** | Any comparison. **Class:** `CALC`. **Label:** INTERNAL CALCULATION (DERIVED) / RESEARCH-BACKED. |
| **1. Measures** | Whether an observed difference between units/periods is distinguishable from noise. |
| **2. Why it matters** | Stops "Ad A beat Ad B" calls that are within noise — the daily bread of bad optimisation. |
| **3. Decision it drives** | Whether a comparison is allowed to trigger an action (winner-picking, pausing). |
| **4. Inputs** | The two (or more) rates/values, their sample sizes, variance, chosen α. |
| **5. Formula** | Appropriate test (proportions/means) or Bayesian probability-to-beat + CI. RESEARCH-BACKED method. |
| **6. Source** | Computed by AdBrain → **INTERNAL CALCULATION (DERIVED)**. `CALC`. |
| **7. Comparison window** | The compared windows (must be equal length & aligned). |
| **8. Min sample** | This is a sample-size gate; ties to N3. |
| **9. Limitations** | Multiple-comparison inflation across many ads; significance ≠ magnitude that matters. |
| **10. Don't trust when** | Many simultaneous comparisons without correction; tiny significant differences treated as important; unequal windows. |

## N10. Learning-Phase / "Learning Limited" Status

| Field | Detail |
|---|---|
| **Level** | Adset. **Class:** `FETCH`. **Label:** OFFICIAL PLATFORM FACT. |
| **1. Measures** | Whether an adset is in Learning, exited Learning, or is "Learning Limited" (never getting enough events to stabilise). |
| **2. Why it matters** | Performance during learning is unrepresentative; "Learning Limited" means the adset structurally can't stabilise — a structure decision, not a creative one. |
| **3. Decision it drives** | Whether to wait, consolidate adsets/budgets to escape Learning Limited, or discount current metrics. |
| **4. Inputs** | Meta delivery status per adset. |
| **5. Formula** | Reported directly by Meta. FETCH. |
| **6. Source** | Meta Ads Manager delivery status → **OFFICIAL PLATFORM FACT**. `FETCH`. |
| **7. Comparison window** | Current. |
| **8. Min sample** | Meta's own ~threshold of conversions per adset per week to exit learning (Meta-defined; verify exact figure at build). |
| **9. Limitations** | Metrics during/after learning differ; frequent edits reset learning. |
| **10. Don't trust when** | Judging an adset's performance while in Learning; editing repeatedly (constant resets); acting on a Learning-Limited adset's numbers as if stable. |

---

## Cross-category discipline summary

| Category | Highest honest label achievable | Never claim | Primary decision |
|---|---|---|---|
| **K Incrementality** | INFERENCE (with experiment) / MODEL ESTIMATE (without) | OFFICIAL PLATFORM FACT; live/daily iROAS | Causal keep/scale/kill; the haircut on reported numbers |
| **L Competitive** | OFFICIAL PLATFORM FACT (existence, creative, dates); rest INFERENCE / CANNOT-KNOW | Competitor spend/ROAS/SoV for commercial ads | Which competitor moves & angles to study/counter |
| **M Predictive** | MODEL ESTIMATE (always with CI) | A forecast as a fact; a point estimate without error bars | Proactive refresh, pacing, reallocation before the number turns |
| **N Data Quality** | OFFICIAL PLATFORM FACT (diagnostics) + INTERNAL CALCULATION (gaps) | That clean-looking data is trustworthy without checking N | Whether any other metric may drive an action at all |

**Build-time reconciliation checklist:**
1. Reconcile every data-mapping class against `02-meta-data-mapping.md` once it exists (esp. Lift APIs K1/K8, EU/DSA Ad Library L7, observed/modelled split N2).
2. Replace every "verify at build" with a dated, sourced confirmation of the Aug-2026 Meta API surface. No benchmark or platform fact ships unverified (rule 5).
3. Wire N as a pre-gate: no K/L/M output surfaces without an attached N confidence stamp.
4. Confirm no arbitrary thresholds (fatigue frequency, min conversions, learning-exit count) are hard-coded as truths — all are learned or Meta-defined-and-cited.
