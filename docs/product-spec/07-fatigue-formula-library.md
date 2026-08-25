# [07] Fatigue Formula Library

The code-ready spec that `lib/rules/fatigue.ts` implements. Fatigue is a **multi-signal
diagnosis, not frequency alone** (brief). Raw inputs are OFFICIAL; every signal here is a
**delta over time** on an existing metric; the fatigue verdict is an **INTERNAL CALCULATION**;
the forecast is a **MODEL ESTIMATE / INFERENCE, never a fact**.

This file is the formula-level expansion of category **H** in
[`01c-metric-dictionary-fatigue-diversity-scaling.md`](01c-metric-dictionary-fatigue-diversity-scaling.md)
(H1–H9). It reuses those metric definitions rather than redefining them, and every input's
source class matches [`02-meta-data-mapping.md`](02-meta-data-mapping.md). Consistent with
`brief.md` and `00-master-plan.md`.

## Source-class legend (from [02])
**FETCH** = direct Meta API field · **CALC** = computed from fetched fields · **INFER** =
AI-modeled · **EXTERNAL** = another system · **CANNOT-KNOW** = not reliably knowable.

## Fact labels
OFFICIAL PLATFORM FACT · INTERNAL CALCULATION (DERIVED) · RESEARCH-BACKED · INDUSTRY BENCHMARK ·
MODEL ESTIMATE · INFERENCE · UNKNOWN.

## Benchmark honesty (brief + [02], non-negotiable)
**No hardcoded generic benchmarks.** Every threshold, weight, cap, and band cutoff below is one of:
(a) an **INTERNAL CALCULATION heuristic calibrated per-account against that account's own baseline**,
(b) a **v0 prior** — a provisional starting number the code needs to run, explicitly labelled
`calibrate-at-build` and **not validated**, or (c) **UNKNOWN — verify at build**. None is presented
as an official Meta fact or a validated industry number. The two rules that keep this honest:
**"active != winning"** (irrelevant here — fatigue is on our own ads) and **"insufficient data !=
fatigue"**: a signal below its sample floor is dropped, never scored as if fatigued.

---

## 1 · What decision each signal drives (decision gate)

Every signal below survives only because it changes one of these actions. A signal that changes no
action is cut, not shown.

| Signal | Drives the decision |
|---|---|
| Frequency level + trend (H1) | Refresh creative vs **expand audience** vs cap frequency |
| CPM trend (H2) | Is the cost rise **fatigue vs auction/seasonality** (confound check, not a solo trigger) |
| CTR decay (H3) | Refresh vs keep (leading attention loss) |
| CPC trend (D/H, [02] click) | Refresh vs keep (cost-of-click drift; confirms CTR story) |
| Hook-rate decay (H4) | Is the **creative itself** fatiguing → produce a replacement |
| Hold-rate / retention decay (H4) | Same — replace the creative, not the delivery |
| CVR decay (H5) | Pause/replace vs hold (outcome confirmation) |
| CPA increase (H5) | Pause/replace vs hold |
| ROAS decay (H5) | Pause/replace vs hold |
| Reach / impression-growth saturation (H7) | **Expand audience** vs refresh creative |
| Creative age (H6) | Which ads to **watch/replace first**; feeds supply forecast |
| Spend velocity (H6) | How **fast** this ad will burn its audience; watch-order + supply forecast |
| **Fatigue State (H8)** | The core action: **keep / watch / refresh / pause** |
| **Fatigue Forecast (H9)** | **Pre-emptive** refresh + creative-supply planning |

---

## 2 · Design principles (why this model is shaped this way)

1. **Leading before lagging.** Attention signals (hook rate, hold rate, CTR, CPC) move *first*;
   outcome signals (CVR, CPA, ROAS) *confirm*. The composite weights leading signals higher so the
   system warns **before** the money is lost — the "prediction" step of the transform. A verdict
   built only on lagging signals is a post-mortem, not a diagnosis.
2. **Precursor vs evidence vs context.** Frequency and reach-saturation are *precursors* (conditions
   that make fatigue likely). Attention/outcome decays are *evidence* (fatigue happening).
   Creative age and spend velocity are *context/risk multipliers* — an old, fast-burning ad deserves
   more suspicion, but age alone is **not** fatigue (a durable evergreen can be old and healthy).
3. **Delta, not level.** Fatigue is degradation over time. Every signal compares a recent window to
   the ad's **own baseline** (its first-week / peak), never to a hardcoded industry number.
4. **Multi-window consensus.** A one-day move is noise. A signal counts only when it agrees across
   at least two of the 3 / 7 / 14-day windows (sample permitting) — this separates trend from noise
   (brief) and is the AUTOPSY guard against day-of-week and single-day spikes.
5. **Insufficient data is a state, not a zero.** If a driver is below its sample floor it is
   **dropped from the composite** (weights renormalise over available signals); if too many/too
   critical drivers are missing → state = **INSUFFICIENT DATA**. A thin signal never reads as
   "healthy" or "fatigued" by default.
6. **Confounds gate the verdict (AUTOPSY).** Before any FATIGUING+ verdict stands, check for
   promo/pricing/LP/tracking change, audience/placement change, budget scale (mechanical impression
   jump), seasonality/auction (Q4), attribution-window change, and Simpson's paradox across
   audiences. A confounded move is flagged "mixed / externally explained", not asserted as fatigue.

---

## 3 · Signal library — per-signal normalisation

Each signal is normalised to a **fatigue contribution `c ∈ [0,1]`**: `0` = healthy on this signal,
`1` = fully fatigued on this signal. Direction is handled per signal (some fatigue = rising, some =
falling). All caps/floors are **calibrate-at-build** priors, not benchmarks.

Notation: `x_now` = value over the recent window (default 7d); `x_base` = the ad's own baseline
(first-week or rolling peak, whichever the calibration chooses — document one); `clamp01(z) =
max(0, min(1, z))`.

| # | Signal | 01c ref | Direction | Contribution `c` | Group |
|---|---|---|---|---|---|
| S1 | Frequency level | H1 | rising = worse | `clamp01(avg_freq / FREQ_CAP)` | precursor |
| S2 | Frequency trend | H1 | rising = worse | `clamp01((freq_now/freq_base − 1) / FREQ_RISE_CAP)` | precursor |
| S3 | CPM trend | H2 | rising = worse | `clamp01((cpm_now/cpm_base − 1) / COST_RISE_CAP)` | context/cost |
| S4 | CTR decay (link-CTR primary) | H3 | falling = worse | `clamp01((ctr_base − ctr_now) / ctr_base)` | leading |
| S5 | CPC trend | [02] click / H | rising = worse | `clamp01((cpc_now/cpc_base − 1) / COST_RISE_CAP)` | leading/cost |
| S6 | Hook-rate decay (video) | H4 | falling = worse | `clamp01((hook_base − hook_now) / hook_base)` | leading |
| S7 | Hold-rate / retention decay (video) | H4 | falling = worse | `clamp01((hold_base − hold_now) / hold_base)` | leading |
| S8 | CVR decay | H5 | falling = worse | `clamp01((cvr_base − cvr_now) / cvr_base)` | lagging |
| S9 | CPA increase | H5 | rising = worse | `clamp01((cpa_now/cpa_base − 1) / CPA_RISE_CAP)` | lagging |
| S10 | ROAS decay | H5 | falling = worse | `clamp01((roas_base − roas_now) / roas_base)` | lagging |
| S11 | Reach saturation | H7 | growth stalling = worse | `clamp01(1 − reach_growth / impr_growth)` when `impr_growth > 0`; else drop | precursor |

**Context modifiers (not summed as evidence — they scale suspicion / watch-order):**

| # | Modifier | 01c ref | Use |
|---|---|---|---|
| M1 | Creative age | H6 | `age_factor = clamp01(age_days / AGE_REF)` — raises watch-priority and forecast risk; never adds fatigue on its own |
| M2 | Spend velocity | H6 | `burn_factor = clamp01(spend_velocity / VEL_REF)` — how fast the audience is being consumed; raises urgency + supply need |

Formula reuse: `ctr`, `cpa`, `roas`, `cvr` are the [01a]/[01b] definitions implemented in
`lib/rules/metrics.ts` (`ctr`, `cpa`, `roas`; CVR = purchases/clicks-or-lpv). Hook rate =
`3_sec_plays / impressions` and hold rate = **one documented definition** (H4 flags 3 competing
defs: p75/3-sec [Meta], 15-sec/3-sec [industry], thruplay/3-sec — **pick p75/3-sec and record it**;
cross-tool comparison is invalid unless the same def is used). CPC = `spend / clicks` (or
`spend / inline_link_clicks` — state which; link-CPC preferred, matching the link-CTR choice in H3).

### Per-signal source class, level, window, min sample, when-NOT-to-trust

| Signal | [02] class + fact label | Level | Window | Min sample (calibrate-at-build) | When NOT to trust |
|---|---|---|---|---|---|
| S1/S2 Frequency | FETCH OFFICIAL (value) → CALC DERIVED (trend) | Ad set → Ad/Camp/Acct | 7d vs prior 7d; 3d for fast movers | reach ≥ per-account floor (UNKNOWN) | small/retargeting audiences (high freq by design); post-audience-expansion reset; still in learning |
| S3 CPM trend | FETCH OFFICIAL → CALC DERIVED | Ad / Ad set | 7/14/30d | impressions ≥ floor (UNKNOWN) | Q4/holiday auction inflation; audience/placement change; account-wide CPM shift (isolate via difference-from-account) |
| S4 CTR decay | FETCH OFFICIAL → CALC DERIVED | Ad / Creative | 7d vs ad's own peak | impressions/day ≥ floor (UNKNOWN) | placement-mix shift; day-of-week unsmoothed; small denominator |
| S5 CPC trend | FETCH OFFICIAL (cpc) → CALC DERIVED | Ad / Creative | 7/14d | clicks ≥ floor (UNKNOWN) | placement/bid change; CPM-driven (decompose CPC = CPM/(CTR·1000)) |
| S6/S7 Hook/Hold | raw plays FETCH OFFICIAL → **hook/hold CALC DERIVED, NOT official** | Creative / Ad (video only) | 7d vs creative baseline; 3d high-spend | video plays ≥ floor (UNKNOWN) | non-video (N/A → drop); placement change (Reels vs Feed differ); def mismatch with any external number |
| S8/S9/S10 CVR/CPA/ROAS | purchases/value FETCH OFFICIAL (attribution-caveated) → ratios CALC DERIVED | Ad / Creative / Ad set | 7d vs prior + baseline; 14/30d low-volume | conversions ≥ stability floor (UNKNOWN) | promo/pricing/LP/tracking change; small conversion counts; attribution-window change; Simpson's paradox |
| S11 Reach saturation | FETCH OFFICIAL → CALC DERIVED flag | Ad set / Campaign | 7d slope vs prior | meaningful reach base (UNKNOWN) | audience just expanded/changed; budget just scaled (mechanical impression jump) |
| M1 Creative age | CALC DERIVED (first-seen from snapshots) | Creative / Ad | rolling | continuous snapshot history ([22][24]) | snapshot gaps; creative-id reuse across ads confuses age |
| M2 Spend velocity | spend FETCH OFFICIAL → velocity CALC DERIVED | Creative / Ad | rolling 7/14/30d | continuous snapshot history | snapshot gaps; recent budget change |

---

## 4 · Composite Fatigue Index (the core formula)

**Definition.** A single bounded score `FI ∈ [0,1]` per creative/ad, combining the available
signals S1–S11 by weight, over only the signals that pass their sample floor.

**Formula.**
```
available = { i : signal S_i passes its min-sample floor for this ad+window }
FI = ( Σ_{i ∈ available} w_i · c_i ) / ( Σ_{i ∈ available} w_i )
```
Renormalising by the weight of *available* signals is deliberate: an image ad (no S6/S7) or a
low-conversion ad (no S8–S10) is scored fairly on what it has, and a missing signal never silently
drags `FI` toward 0. If `available` is empty or fails the critical-coverage rule (§6), `FI` is
undefined → **INSUFFICIENT DATA**.

**Multi-window guard.** Each `c_i` used in `FI` is the **consensus** contribution: compute `c_i` on
3d, 7d, 14d (sample permitting) and use the median; if the windows disagree in sign (some up, some
down) mark that signal "unstable" and **halve its weight** for this run (noise discount). This is
principle 4 in code.

### Weights + reasons

Weights encode *leading-before-lagging* and *evidence-over-precursor*. **All values are v0
calibration priors — `calibrate-at-build`, per-account, versioned, NOT validated benchmarks.** They
exist so the code runs day one; the calibration job replaces them against each account's own history
(fit weights so the index best predicts the next-window CPA/ROAS move).

| Signal | Group | v0 weight `w_i` (prior) | Reason for the weight |
|---|---|---|---|
| S6 Hook-rate decay | leading | 0.16 | Earliest, most creative-specific fatigue signal for video; top-of-video attention collapses first |
| S7 Hold-rate decay | leading | 0.12 | Confirms the creative (not delivery) is tiring; complements S6 |
| S4 CTR decay | leading | 0.14 | Strongest non-video leading signal; relevance loss shows here before outcomes |
| S5 CPC trend | leading/cost | 0.06 | Corroborates S4 in cost terms; lower weight because it is partly CPM-driven (confound) |
| S10 ROAS decay | lagging | 0.12 | The bottom-line symptom; high weight but lagging so it confirms rather than predicts |
| S9 CPA increase | lagging | 0.10 | Outcome-cost confirmation; paired with S10 |
| S8 CVR decay | lagging | 0.08 | Landing/offer-side confirmation of outcome fatigue |
| S1 Frequency level | precursor | 0.06 | Classic precursor but insufficient alone (brief); low weight, high explanatory value |
| S2 Frequency trend | precursor | 0.04 | Rate of saturation; supports S1 |
| S11 Reach saturation | precursor | 0.06 | Distinguishes "same people more" from healthy reach; routes to *expand audience* not *refresh* |
| S3 CPM trend | context/cost | 0.06 | Weakest as fatigue evidence (most confounded by auction/season); kept mainly as a confound flag |
| **Σ** | | **1.00** | Leading 0.48 · lagging 0.30 · precursor 0.16 · context 0.06 — leading > lagging by design |

Context modifiers M1/M2 do **not** enter `FI`. They scale **urgency** and **forecast risk** (§7)
and set watch-order, so an old, fast-burning ad with the same `FI` as a young slow one is actioned
first.

- Source / [02] class: composite of FETCH OFFICIAL inputs + CALC DERIVED trends → **CALC DERIVED**
  verdict. Fact label: `FI` = **INTERNAL CALCULATION (DERIVED)** with confidence.

---

## 5 · The 8 states (H8) — classification

State = a function of `FI`, **signal consensus** (how many leading vs lagging groups are firing),
**direction** (is `FI` rising or falling over recent snapshots), and **coverage/confidence**.
Bands on `FI` are **v0 priors, calibrate-at-build** (fit cutoffs to each account's own transition
history; do not ship these as truth).

| State | Entry logic (v0 prior — calibrate-at-build) | Meaning → action |
|---|---|---|
| **INSUFFICIENT DATA** | critical-coverage rule (§6) fails, OR any key driver below floor | Can't judge → collect data, no verdict |
| **HEALTHY** | `FI < 0.20` and no leading group firing and `FI` flat/falling | Keep; normal rotation |
| **EARLY WARNING** | `0.20 ≤ FI < 0.35`, exactly **one leading** signal firing, lagging still fine | Watch; queue a replacement idea |
| **EMERGING** | `0.35 ≤ FI < 0.50`, **≥2 leading** firing and/or frequency rising, lagging not yet confirmed | Refresh soon; start production |
| **FATIGUING** | `0.50 ≤ FI < 0.65`, leading **and** ≥1 lagging firing together, `FI` rising | Refresh now |
| **FATIGUED** | `0.65 ≤ FI < 0.80`, lagging (CPA/ROAS) materially worse and sustained ≥2 windows | Replace; begin phase-down |
| **SEVERE** | `FI ≥ 0.80`, large sustained ROAS/CPA loss + high frequency | Pause/replace immediately |
| **RECOVERING** | `FI` falling ≥2 consecutive windows after a prior EMERGING+ state or a known refresh event | Hold; the change worked, keep watching |

Rules that override the band:
- **Consensus gate.** A high `FI` driven by a *single* confounded signal (e.g. only S3 CPM in Q4) is
  capped at **EARLY WARNING** and flagged "single-signal / possible auction", never escalated to
  FATIGUED on one confounded driver.
- **Lagging-confirmation gate.** FATIGUED / SEVERE **require** a lagging outcome signal (S8/S9/S10)
  to be firing and sustained; leading signals alone top out at FATIGUING. This stops "the CTR
  dipped" from reading as "the ad is dead" while it still converts.
- **AUTOPSY gate.** If a confound (§2.6) is detected, the verdict carries an `externally_explained`
  flag and drops one severity band pending resolution.

- Level: Creative / Ad (primary); rolls to Ad set with spend-weighting. Comparison window: 3/7/14d
  consensus. Fact label: state = **INTERNAL CALCULATION (DERIVED)** with confidence; all thresholds
  **calibrated per account**, none an INDUSTRY BENCHMARK unless a cited, dated source is attached at
  build (else **UNKNOWN**).

---

## 6 · Confidence + minimum-sample (the honesty layer)

Every `FI` and state ships with a **confidence ∈ [0,1]** (feeds [14] Confidence Framework), built
from four factors — no fake precision:

| Factor | What it measures | Effect |
|---|---|---|
| **Coverage** | `Σ w_i(available) / Σ w_i(all-applicable)` | more of the model's weight observed → higher confidence |
| **Sample depth** | daily rows present vs required; conversion counts for S8–S10 | thin data → lower confidence, wider band |
| **Signal agreement** | do leading and lagging point the same way? | agreement ↑ confidence; disagreement → "mixed signals" flag |
| **Window stability** | do 3/7/14d agree in sign? | stable → ↑; unstable → ↓ (and the noise discount in §4) |

**Critical-coverage rule (→ INSUFFICIENT DATA).** A verdict is refused (not guessed) when **either**
the total available weight `< COVERAGE_FLOOR` (v0 prior, calibrate-at-build) **or** *no* leading
group signal is available (for video, S6/S7 missing **and** S4 missing). Rationale: a fatigue call
with no leading evidence is just a lagging post-mortem — say "insufficient" instead. This is the
code embodiment of **"insufficient data != fatigue"** and directly reuses H8's rule ("if any key
driver below its floor → INSUFFICIENT DATA, never a false verdict").

Minimum-sample floors per signal are listed in §3 and are all **UNKNOWN / calibrate-at-build** — the
build step sets them from each account's variance, and until set the signal is treated as unavailable
rather than trusted.

---

## 7 · Fatigue Forecast (H9) — handoff to [08]

The library **produces the inputs**; [08] Forecasting Framework owns the model. Given the per-signal
trend slopes, `FI` trajectory, and the M1/M2 context modifiers:

```
risk_7d, risk_14d = P(cross into a worse state within horizon)
               = f( slope(FI), slope(leading signals), age_factor, burn_factor )   [per 08]
```

- Output shape (per brief): **probability + confidence + named drivers + expected consequence +
  recommended action** ("replace by <date>"). `burn_factor` (M2) shortens the horizon: a
  fast-burning ad at the same `FI` fatigues sooner and needs its replacement produced earlier
  (feeds the 7/14/30-day creative-supply requirement).
- Source / [02] class: modeled from CALC DERIVED trends → **INFERENCE**. Fact label:
  **MODEL ESTIMATE / INFERENCE, always with confidence — never OFFICIAL, never a fact.**
- When NOT to trust: short history, volatile signals, recent structural change (budget/audience/LP);
  cannot foresee external shocks (promo/competitor/seasonality). Present as probability + confidence,
  never a certainty (KILLCRITIC weak-forecast guard).

---

## 8 · Code-ready interface (what `lib/rules/fatigue.ts` implements)

The current `fatigue()` is a **2-signal linear blend** (frequency + CTR decay, 0.5/0.5, `FREQ_CAP=3`,
`MIN_ROWS=7`, `WINDOW=3`) that returns `{score, pastHalfLife}` or `insufficient_data`. That is the
honest MVP and its own docstring names the ceiling: *"linear two-signal blend, not a survival model…
upgrade path: fit a real decay curve."* This library **is** that upgrade path. Migration is additive
(rule #2: never remove a working handler) — the existing shape stays a valid subset.

Target signature (backward-compatible superset):
```ts
export type FatigueState =
  | "HEALTHY" | "EARLY_WARNING" | "EMERGING" | "FATIGUING"
  | "FATIGUED" | "SEVERE" | "RECOVERING" | "INSUFFICIENT_DATA";

export type FatigueResult =
  | {
      status: "ok";
      score: number;              // FI ∈ [0,1]  (INTERNAL CALCULATION)
      state: FatigueState;        // §5
      confidence: number;         // §6, [0,1]
      pastHalfLife: boolean;      // kept: score >= REFRESH_CUTOFF (v0 0.65) — back-compat
      signals: { id: string; c: number; weight: number; available: boolean; unstable?: boolean }[];
      drivers: string[];          // human-readable "why we're saying this" (explainability)
      confounds: string[];        // AUTOPSY flags detected
    }
  | { status: "insufficient_data"; reason: string };  // §6 critical-coverage
```
Implementation notes: keep the rules engine the **source of truth** (AI only narrates `drivers`);
never divide by zero or invent a value — return `insufficient_data` (matches `metrics.ts`); every
constant (`FREQ_CAP`, `*_RISE_CAP`, `AGE_REF`, `VEL_REF`, band cutoffs, floors, `COVERAGE_FLOOR`,
weights) lives in one exported, versioned config object marked `calibrate-at-build`, not scattered
literals. Leave **one runnable check** (assert-based self-check): a synthetic ad with collapsing
hook + CTR + rising CPA + rising frequency must classify FATIGUED/SEVERE, and a 3-row ad must return
`insufficient_data`. Then `node build-check.js` stays green.

---

## 9 · Consistency check vs [01c] and [02]

| This file | Traces to | Class enforced |
|---|---|---|
| S1/S2 frequency | 01c H1 · [02] Delivery FETCH OFFICIAL; trend CALC | OK |
| S3 CPM | 01c H2 · [02] Delivery FETCH OFFICIAL; trend CALC | OK |
| S4 CTR / S5 CPC | 01c H3 · [02] Delivery/click FETCH OFFICIAL; decay/trend CALC | OK |
| S6/S7 hook/hold | 01c H4 · [02] Attention — raw FETCH OFFICIAL, **hook/hold CALC DERIVED, not official** | OK (matches [02] trap) |
| S8/S9/S10 CVR/CPA/ROAS | 01c H5 · [02] Conversion — purchases/value FETCH OFFICIAL (attribution-caveated), ratios CALC | OK |
| S11 reach saturation | 01c H7 · [02] Delivery FETCH OFFICIAL; flag CALC | OK |
| M1 age / M2 velocity | 01c H6 · [02] Delivery — spend FETCH, age/velocity CALC | OK |
| §4 Fatigue Index / §5 states | 01c H8 · composite CALC DERIVED verdict | OK |
| §7 forecast | 01c H9 · [02] → **INFERENCE**, MODEL ESTIMATE | OK |

## 10 · Calibration ledger — every non-derived number is calibrate-at-build

| Constant | Role | Status |
|---|---|---|
| `FREQ_CAP`, `FREQ_RISE_CAP` | frequency normalisation | v0 prior (`FREQ_CAP≈3` from current code) — calibrate per account |
| `COST_RISE_CAP`, `CPA_RISE_CAP` | cost-rise normalisation | v0 prior — calibrate |
| `AGE_REF`, `VEL_REF` | context-modifier scaling | v0 prior — calibrate |
| Weights `w_S1…w_S11` | composite blend (§4) | v0 priors — refit per account against next-window outcome moves |
| State band cutoffs (0.20/0.35/0.50/0.65/0.80) | 8-state classification (§5) | v0 priors — fit to account transition history |
| Per-signal min-sample floors (§3) | drop-vs-trust | **UNKNOWN — verify at build** |
| `COVERAGE_FLOOR` | INSUFFICIENT-DATA gate (§6) | v0 prior — calibrate |
| Hold-rate definition | H4 (3 competing defs) | **choose p75/3-sec and document**; no external benchmark |
| "good hook/CTR/ROAS = X" | any absolute quality bar | **UNKNOWN** — never hardcoded (H4 note) |

**No hardcoded generic benchmarks introduced.** Every threshold/weight is calibrate-at-build,
per-account, versioned, or explicitly UNKNOWN — per the brief's benchmark-honesty rule and [02].
