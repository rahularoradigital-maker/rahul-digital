# [08] Forecasting Framework — 7-day & 14-day Fatigue Probability

The **prediction** step of the transform (`OBSERVATION → DIAGNOSIS → PREDICTION → RECOMMENDATION →
ACTION`). It turns the fatigue *diagnosis* ([01c] H8, the 8-state verdict) into a *forward-looking
probability*: "how likely is this creative to cross into a worse fatigue state inside the next 7 and
14 days, why, what happens if it does, and what to do now?"

This file is the deep spec behind **[01c] H9 (Fatigue Forecast)** and reuses **[01d] M1 (Creative
Fatigue Probability)**, **M2 (Days-to-Fatigue)** and **M5 (Audience Saturation Forecast)** rather than
redefining them. **This is the document `lib/rules/will-break.ts` implements.**

It is consistent with `brief.md`, `00-master-plan.md`, `02-meta-data-mapping.md`, `01c`, and `01d`.

---

## 0 · The one rule of this file: a forecast is not a fact

Per `brief.md` and `00-master-plan.md`: *"never present a prediction as a fact."* Everything this
framework outputs is a **MODEL ESTIMATE**, always shipped with a confidence and an explicit
"unreliable when…" clause. It is never OFFICIAL, never DERIVED-as-truth.

**[02] source class of the forecast output = `INFER`** (modeled/estimated). The *inputs* feeding it
are `FETCH OFFICIAL` (delivery/attention/conversion) or `CALC DERIVED` (their trends); the model on
top is `INFER`. (Note: [01d] labels the M-category data class `CALC`; [02]'s legend classifies a
model output as `INFER`. This file follows [02] — the required consistency anchor — and treats the
inputs as FETCH/CALC and the forecast as INFER. Same fact-label either way: **MODEL ESTIMATE**.)

---

## 1 · Three data states — never blur them

The single largest honesty risk in a forecast surface is letting a projection *look* like a
measurement. Every value this framework touches is exactly one of three states, and the UI/API must
carry the state on the value (see [22][25]).

| State | What it is | Fact label | Example |
|---|---|---|---|
| **OBSERVED** | A measured value from history (the inputs). | OFFICIAL PLATFORM FACT (raw) or INTERNAL CALCULATION (its trend) | "CTR fell 22% over the last 7 days." |
| **FORECAST** | The model's projection at current trajectory. | **MODEL ESTIMATE** (+ confidence, + CI) | "68% probability of crossing into FATIGUING within 7 days." |
| **SCENARIO** | A conditional what-if under an assumed action. | **MODEL ESTIMATE (conditional)** — states its assumption | "If frequency is capped at 2.0, 7-day probability drops to ~40%." |

Rules:
- A FORECAST value must never be rendered in the same style/label as an OBSERVED value.
- A SCENARIO must always name its assumption; a scenario without its assumption stated is cut.
- The forecast is **anchored to the observed diagnosis**: it forecasts the *transition* out of the
  current H8 state, so the "from" state is always OBSERVED and shown next to the projected "to" state.

---

## 2 · The decision this framework drives (decision gate)

Per the decision gate (most important cross-cutting rule): a score stays only if it changes a
decision. The forecast exists to enable **one class of decision — act *before* the loss, not after:**

| Forecast output | Decision it drives | Action-priority mapping ([16], brief) |
|---|---|---|
| High 7-day probability, high confidence | Pre-emptive refresh **now**; queue replacement creative | **DO NOW** |
| High 14-day / rising, medium confidence | Schedule replacement into the creative-supply plan | **DO NEXT** |
| Low probability, or mixed signals | Keep running, keep watching | **WATCH** |
| Any driver below its sample floor | Do not forecast | **NEEDS MORE DATA** |
| Healthy + stable trajectory | No action | **DO NOT ACT** |

Days-to-fatigue (M2) feeds the **creative supply / velocity** requirement (`brief.md`: 7/14/30-day
creative requirement tied to spend + fatigue + replacement rate). If a forecast changes none of
these, it is a vanity number — cut it.

---

## 3 · Inputs to the forecast (each traced to [02])

The forecast is a function of the fatigue *signals* already defined in [01c] H1–H7 — it does not
invent new raw metrics. It consumes their **trajectory** (level + slope + volatility), plus creative
age and a similar-creative prior. Every input carries its [02] source class.

| # | Input | What the model uses | [01] source | [02] class | Fact label (of the input) |
|---|---|---|---|---|---|
| IN1 | **Frequency trajectory** | current frequency + slope of frequency over the window | [01c] H1 | Delivery: frequency FETCH OFFICIAL; trend CALC | OFFICIAL (level) / INTERNAL CALC (slope) |
| IN2 | **Reach-growth trajectory** | new-reach slope; saturation flag (impressions↑ while reach→flat) | [01c] H7; [01d] M5 | Delivery FETCH OFFICIAL; saturation CALC | OFFICIAL / INTERNAL CALC |
| IN3 | **CTR decay** | link-CTR & all-CTR slope vs the ad's own baseline | [01c] H3 | Delivery FETCH OFFICIAL; decay CALC | OFFICIAL / INTERNAL CALC |
| IN4 | **CPM drift** | CPM slope, isolated from account-wide CPM move | [01c] H2 | Delivery FETCH OFFICIAL; trend CALC | OFFICIAL / INTERNAL CALC |
| IN5 | **Hook/hold-rate decay** (video) | early-retention slope | [01c] H4 | Attention: raw plays FETCH OFFICIAL; hook/hold CALC (not official) | OFFICIAL (raw) / INTERNAL CALC (rates) |
| IN6 | **Outcome decay** | CVR / CPA / ROAS slope vs baseline | [01c] H5 | Conversion FETCH OFFICIAL (attribution-caveated); ratios CALC | OFFICIAL (attribution-caveated) / INTERNAL CALC |
| IN7 | **Creative age** | days since first delivery | [01c] H6 | CALC from daily snapshots | INTERNAL CALCULATION |
| IN8 | **Spend velocity** | spend/day and its acceleration (how fast the audience burns) | [01c] H6 | spend FETCH OFFICIAL; velocity CALC | OFFICIAL / INTERNAL CALC |
| IN9 | **Similar-creative history** (prior) | how comparable past creatives decayed (fingerprint-matched, [05]) | [05] fingerprint (INFER) + this account's history | INFER tags + CALC history | INFERENCE (the match) / MODEL ESTIMATE (the prior) |
| IN10 | **Sample sufficiency** | per-signal denominator vs its floor; days of continuous history | [01d] N3 | CALC / N-category | INTERNAL CALCULATION (a gate, not a prediction) |

**Nothing here is fetched as a "fatigue field."** Meta has no fatigue metric ([02]); the forecast is
built entirely on top of OFFICIAL delivery/attention/conversion history + our own snapshot-derived
trends + an optional similar-creative prior.

---

## 4 · Method — how the probability is produced

The forecast answers: *given the current trajectory of IN1–IN9, what is the probability the creative
crosses into a worse H8 state within the horizon?* Two honest, transparent methods, blended; **no
black box, no arbitrary constant presented as truth.**

### 4a · Component 1 — trend extrapolation (per-signal)
For each decaying signal (IN1–IN8), fit its recent slope on the ad's **own** history and project it
to the horizon (7d, 14d). Where each projected signal would sit relative to that signal's
state-transition band gives a per-signal "distance to the next-worse state."
- Boring by design: robust linear/recent-slope fit (resistant to a single day's noise), not a
  high-order curve that overfits a two-week series.
- Extrapolation is only trusted **inside/near the observed range** — projecting far past what the ad
  has ever done is flagged low-confidence (KILLCRITIC: weak forecast).

### 4b · Component 2 — survival / hazard framing (whole-creative)
Treat "crossing into a worse fatigue state" as a survival event and estimate a **hazard** that rises
with creative age (IN7), cumulative exposure (IN1 × age), spend velocity (IN8), and the
similar-creative prior (IN9). Output = probability the event occurs by day 7 and by day 14, plus a
**median days-to-fatigue** (this is [01d] M2). This gives the framework a sensible answer even when a
single slope is noisy, and it naturally produces "sooner for fast-burning ads."

### 4c · Blend + weights + reason for weights
`P(fatigue by H) = combine( trend_component, hazard_component )`, weighted, then calibrated to a
probability (see 4d).

| Driver group | Direction | Weight | Reason for the weight |
|---|---|---|---|
| Leading attention signals (IN3 CTR decay, IN5 hook/hold decay) | ↑ risk | **highest** | earliest, most creative-specific fatigue signal; they move *before* outcomes, so they carry the most predictive information for a *forward* call |
| Saturation signals (IN1 frequency↑, IN2 reach-growth→0) | ↑ risk | high | classic exhaustion mechanism; distinguishes creative fatigue from audience saturation (routes to M5 vs M1) |
| Outcome signals (IN6 CVR/CPA/ROAS decay) | ↑ risk (confirming) | medium | lagging and attribution-noisy; confirm rather than predict — weighting them highest would make the "forecast" a coincident indicator, not a forecast |
| Exposure/pace (IN7 age, IN8 velocity) | ↑ risk | medium | set *how fast*, less *whether*; drive M2 timing more than M1 probability |
| CPM drift (IN4) | ↑ risk (weak) | low | most confounded by auction/seasonality (AUTOPSY); a supporting signal only |

> **Weights are INTERNAL CALCULATION, calibrated per account, versioned in [15] the rule engine — the
> exact numbers are UNKNOWN and MUST be set/validated at build against each account's own history.**
> The *ordering rationale* above is the durable design; the *values* are not hardcoded here. A
> hardcoded weight presented as a truth would violate rule 4 / the benchmark-honesty rule.

> Contrast with today's shipped heuristic `lib/rules/fatigue.ts`: that is a **coincident**
> 50/50 frequency+CTR-decay score of the *current* state (it even flags this as a ceiling and an
> upgrade path — "fit a real decay curve once we have enough history"). [08] is the **forward** layer;
> `will-break.ts` is that upgrade — it consumes the same trends and projects them, it does not
> re-measure the present.

### 4d · Calibration (so the probability means something)
A raw model score is not a probability. Calibrate against **realised outcomes on this account's own
history** (did creatives with score X actually cross within the horizon Y% of the time?) — reliability
/ isotonic-style calibration, re-fit as history accrues.
- Until enough labelled history exists to calibrate, the framework reports a **band, not a point**
  (e.g. "elevated / high" with a wide CI), and says the calibration is provisional. It never emits a
  precise-looking "73.4%" it cannot back (KILLCRITIC: fake precision).

---

## 5 · The forecast output object

Every forecast (per ad/creative, per horizon) emits this structure. All of it is **MODEL ESTIMATE**.

| Field | Type | Notes |
|---|---|---|
| `entity` | id + level | Creative / Ad (primary). Level named, never mixed ([02] hierarchy). |
| `from_state` | H8 state (OBSERVED) | current diagnosis it is forecasting the exit from |
| `horizon` | `7d` \| `14d` | both are produced; per brief |
| `probability` | 0–1 (MODEL ESTIMATE) | P(crosses into a worse H8 state within horizon) |
| `confidence_interval` | band | required; the point without the band is not shippable |
| `confidence` | LOW / MED / HIGH | from the confidence model (§6); not the same as probability |
| `days_to_fatigue` | median + CI (MODEL ESTIMATE) | [01d] M2; feeds creative-supply timing |
| `primary_drivers` | ranked list | the top 2–3 IN* signals pushing the probability, each with its OBSERVED value + slope ("why are we saying this?" — brief) |
| `expected_consequence` | text + magnitude band | what happens if unaddressed (e.g. "CPA ↑, projected band X–Y"), MODEL ESTIMATE |
| `recommended_action` | enum + detail | REFRESH NOW / QUEUE REPLACEMENT / EXPAND AUDIENCE / WATCH / NEEDS MORE DATA — mapped to DO NOW/NEXT/WATCH ([16]) |
| `fatigue_type` | CREATIVE / AUDIENCE / MIXED | routes creative fatigue (M1 → new creative) vs audience saturation (M5 → new audience); different fix |
| `counter_explanation` | text | the benign alternative (seasonality/auction/promo) the AUTOPSY gate checked (§7) |
| `state` | `FORECAST` | data-state tag (§1); scenarios carry `SCENARIO` + `assumption` |
| `fact_label` | `MODEL ESTIMATE` | always |
| `model_version` | id | which [15]-versioned weights/calibration produced it |

**Creative vs audience routing is load-bearing:** a forecast that says "fatigue coming" without
saying *which kind* sends the buyer to the wrong fix. High frequency + reach saturation (IN1/IN2) with
*stable* hook rate → AUDIENCE (M5): expand/rotate audience. Falling hook/CTR (IN3/IN5) at *stable*
frequency → CREATIVE (M1): produce a replacement. Both → MIXED.

---

## 6 · Confidence model (separate from probability)

Probability = "how likely." Confidence = "how much we trust that number." They are independent: a
confident 20% and a shaky 20% drive different actions. Confidence is built from ([14] Confidence
Framework):

| Confidence driver | Raises confidence | Lowers confidence |
|---|---|---|
| **Sample sufficiency** (IN10) | every signal above its floor; long continuous history | any driver near/below floor; short-lived ad |
| **Signal agreement** | leading + lagging signals point the same way | signals disagree → flag "mixed signals," widen CI |
| **Trajectory stability** | smooth, low-variance slopes | volatile day-to-day series |
| **Calibration maturity** | account has labelled history to calibrate against | provisional/uncalibrated → band only |
| **Absence of structural change** | no recent budget/audience/LP/offer change | recent change → trajectory invalid, confidence floored |
| **Similar-creative support** (IN9) | strong fingerprint-matched prior agrees | no comparable history → weaker prior |

**Hard gate (matches `fatigue.ts` philosophy — refuse rather than guess):** if any *key* driver is
below its sample floor, the framework returns **NEEDS MORE DATA**, not a low-confidence number. It
never fabricates a forecast on thin data. Minimum-history and per-signal floors are **UNKNOWN —
calibrate at build** (mirrors `fatigue.ts` `MIN_ROWS = 7` as a documented starting point, not a
validated threshold).

---

## 7 · Adversarial gates applied to the forecast

Both brief gates run against every forecast before it ships.

**AUTOPSY (is this a real forecast or an artefact?)** — each produces a `counter_explanation`:
| Trap | Check |
|---|---|
| False fatigue | Is the decay real, or a small-sample wobble / day-of-week effect unsmoothed? |
| Seasonality / promo | Is the "decay" a post-promo comedown or a calendar dip, not fatigue? |
| Auction / market CPM | Is CPM drift (IN4) account-wide/market-wide, not creative-specific? (isolate via difference-from-account) |
| Attribution shift | Did the attribution window/setting change, faking an outcome drop? ([01d] N4/N5) |
| Structural change | Budget/audience/LP/offer change inside the window → trajectory invalid, do not forecast |
| Simpson's paradox | Is the blended decline an audience-mix artefact? ([01c] H5 note) |

**KILLCRITIC (is this forecast worth showing?):**
| Trap | Rule |
|---|---|
| Weak forecast | short history / far extrapolation / wide CI → downgrade to WATCH or suppress, don't dress it up |
| Fake precision | no false decimals; report bands until calibrated (§4d) |
| Vanity forecast | if it changes no decision (§2), cut it |
| Unclear action | every shipped forecast must carry a `recommended_action`; no "FYI" forecasts |

---

## 8 · `lib/rules/will-break.ts` — the implementation contract

The forecasting layer is deterministic and testable: the **rules engine computes, AI narrates**
(`00-master-plan.md` #6). `will-break.ts` is the forward sibling of `fatigue.ts`.

Suggested shape (consistent with `fatigue.ts`'s discriminated-union, refuse-on-thin-data style):

```ts
export type WillBreakResult =
  | {
      status: "ok";
      horizon: "7d" | "14d";
      probability: number;          // 0–1, MODEL ESTIMATE
      ci: [number, number];         // required band
      confidence: "low" | "med" | "high";
      daysToFatigue: number | null; // M2 median; null if not estimable
      fatigueType: "creative" | "audience" | "mixed";
      drivers: Driver[];            // ranked IN* signals w/ observed value + slope
      expectedConsequence: string;
      recommendedAction: "refresh_now" | "queue_replacement"
                       | "expand_audience" | "watch";
      counterExplanation: string;   // AUTOPSY result
      modelVersion: string;
    }
  | { status: "insufficient_data"; reason: string }        // §6 hard gate
  | { status: "suppressed"; reason: string };              // KILLCRITIC weak-forecast
```

Contract requirements:
1. **Consumes trends, never re-measures the present.** Inputs are the IN1–IN9 trajectories; it must
   not duplicate `fatigue.ts`'s coincident score — it projects it forward.
2. **Refuse over guess.** Below the sample floor → `insufficient_data` with a reason; never a
   fabricated probability (same discipline as `fatigue.ts`).
3. **Bands, not fake precision.** Uncalibrated → wide `ci`, `confidence: "low"`; never a spurious
   decimal.
4. **Every `ok` result carries drivers + action + counterExplanation** (decision gate +
   explainability [25]).
5. **Weights/thresholds are injected, versioned, calibrated** ([15]) — not hardcoded literals
   presented as truth. Any starting constant carries a `// calibrate-at-build:` comment naming it as a
   provisional heuristic, not a validated threshold (ponytail ceiling rule).
6. **One runnable check** (assert-based self-check): a synthetic decaying series → `ok` with rising
   probability and correct driver ranking; a flat/short series → `insufficient_data`; a
   frequency-saturation-only series → `fatigue_type: "audience"`. Keeps the build gate honest.

---

## 9 · Minimum sample & time windows (summary)

| Item | Window | Minimum sample | Status |
|---|---|---|---|
| Slope fit per signal | trailing 7–14d vs ad's own baseline | enough daily rows for a stable slope | floor **UNKNOWN — calibrate at build** (`fatigue.ts` starts at 7 rows) |
| Forecast horizon | **7d and 14d** (both, per brief) | as above | — |
| Hazard / survival fit | needs creative age + continuous snapshot history | gaps in snapshots → suppress | depends on [22][24] snapshot integrity |
| Similar-creative prior (IN9) | this account's fingerprint-matched history | enough comparable past creatives | INFERENCE; weak/absent → drop the prior, don't invent it |
| Calibration | rolling, re-fit as labels accrue | enough labelled crossings to calibrate | provisional until then (§4d) |

---

## 10 · Consistency check vs [02] / [01c] / [01d]

| [08] element | Traces to | Class / label enforced |
|---|---|---|
| Forecast output (probability, days-to-fatigue) | [01c] H9; [01d] M1, M2 | output **INFER**, label **MODEL ESTIMATE** (+CI) |
| Audience-saturation routing (fatigue_type) | [01d] M5 | MODEL ESTIMATE; distinguishes creative vs audience fatigue |
| IN1 freq / IN2 reach / IN4 CPM | [01c] H1/H7/H2; [02] Delivery | inputs **FETCH OFFICIAL**; trends **CALC DERIVED** |
| IN3 CTR decay | [01c] H3; [02] Delivery | FETCH OFFICIAL; decay CALC |
| IN5 hook/hold decay | [01c] H4; [02] Attention | raw plays FETCH OFFICIAL; hook/hold **CALC DERIVED, not official** |
| IN6 outcome decay | [01c] H5; [02] Conversion | purchases/value FETCH OFFICIAL (attribution-caveated); ratios CALC |
| IN7 age / IN8 velocity | [01c] H6; [02] Delivery | spend FETCH OFFICIAL; age/velocity CALC |
| IN9 similar-creative prior | [05] fingerprint; [02] creative labels | tags **INFER**; prior **MODEL ESTIMATE** |
| Weights / thresholds | [15] rule engine | **INTERNAL CALCULATION, calibrated per account, versioned**; values UNKNOWN — set at build |
| Confidence | [14] Confidence Framework | separate from probability; hard-gates to NEEDS MORE DATA |

**No hardcoded benchmark or threshold is presented as truth.** Every constant is either
calibrated-INTERNAL (per account, versioned) or explicitly **UNKNOWN / calibrate-at-build**, per
`brief.md` rule 4 and [02]'s "no hardcoded generic benchmarks." "active != winning" and "insufficient
data != waste/fatigue" are honoured: below the floor → NEEDS MORE DATA, never a fabricated forecast.
