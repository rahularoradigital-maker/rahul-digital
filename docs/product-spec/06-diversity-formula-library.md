# [06] Diversity Formula Library

The exact, computable math behind the five diversity scores the brief demands:
**Diversity · Concentration · Redundancy · White-Space · Coverage**, computed over the creative
fingerprint [05] dimensions. This file is the formula layer under **[01c] category I (Diversity)**:
01c gives each score the 10-question dictionary treatment; **06 gives the runnable formula, the
weight vector + its reasoning, the normalization, the sample floors, and the confidence function**.
Where the two ever disagree on a source class, **[02] wins**, then [01c].

Consistent with: `brief.md`, `00-master-plan.md`, `02-meta-data-mapping.md`, `01c-…-diversity-…md`,
and the storage in `24-data-warehouse-schema.md` (`creative_fingerprint`, `creative_embedding`).

---

## 0. Cross-cutting spec (applies to all five scores)

### 0.1 The fingerprint dimensions scored (19)
From brief + [01c] + [05]. Each is an **AI-inferred label** per creative with its own confidence.

`persona · problem · desire · awareness · hook · angle · concept · format · visual · speaker ·
product · offer · background · environment · message · landing · CTA · narrative · structure`

> The warehouse (`creative_fingerprint`, 24 §5) persists the 11 core dimensions as `label + _conf`
> columns and the rest as extensible label rows; embeddings (`creative_embedding`, kinds
> visual/text/audio/scene/hook/concept/persona/angle) feed **Redundancy [I3]** only.

### 0.2 Source class + fact label (inherited by every score below)
| Layer | [02] class | Fact label |
|---|---|---|
| Fingerprint **tags** (persona/hook/angle/…) | **INFER** | **INFERENCE** (each carries `_conf`) |
| Fingerprint **embeddings** (for I3) | **EXTERNAL/CALC** (computer vision) | **INTERNAL CALCULATION** (deterministic) |
| `spend`, `impressions`, `purchases`, `value` (weighting) | **FETCH** | **OFFICIAL PLATFORM FACT** (attribution-caveated) |
| **The five scores themselves** | **CALC** over INFERRED inputs | **INTERNAL CALCULATION (DERIVED) over INFERRED tags** |
| Diversity/HHI **math** (Shannon/Simpson/Hill/Herfindahl) | — | **RESEARCH-BACKED** *method*; a *threshold on it* is **UNKNOWN / calibrate-at-build** |
| Competitor-derived white-space candidates (I4) | EXTERNAL | **INFERENCE / HYPOTHESIS** (active != winning); competitor economics **UNKNOWN** |

**The load-bearing honesty rule:** the index math is textbook and RESEARCH-BACKED, but **a diversity
number is only as trustworthy as the tags under it, and every cut-line on it is UNKNOWN until
calibrated per account.** No weight or threshold in this file is presented as a benchmark. All are
`INTERNAL CALCULATION, calibrate-at-build`, and the proposed starting numbers are a **scaffold**, not
a fact.

### 0.3 Scope + basis (must be stated on every reported value)
- **Scope** = the creative set scored: `account` | `campaign` | `active-ads-only` | `by-product`.
  Default decision-surface scope = **active ads, account level** (dead ads don't create real risk).
- **Basis** = the weight on each creative:
  - **spend-weighted** (`w_c = spend_c / Σspend`) → **the decision-relevant basis** (money at risk).
  - **count** (`w_c = 1/N`) → structural/portfolio view.
  - **outcome-weighted** (`w_c = value_c / Σvalue`) → optional, "diversity of what actually converts".
  Every score is reported **spend-weighted by default**; count-basis shown alongside because they
  diverge (a portfolio can look diverse by count and be concentrated by spend — that gap is itself a
  signal). **Never report a diversity number without naming scope + basis.**

### 0.4 Why Hill numbers / effective-N (the unifying device)
Raw Shannon `H` and Simpson `λ` are not comparable across dimensions with different category counts.
We convert everything to an **effective number of categories** (Hill number `qD`, Jost 2006) — "how
many equally-common categories would give this much spread" — then normalize to `[0,1]`. This makes
`persona` diversity (say 6 categories) comparable to `format` diversity (say 3) so a weighted mean
across dimensions is meaningful.

| Order q | Name | Effective number `qD` | Sensitivity |
|---|---|---|---|
| 0 | Richness | `S` (count of categories present) | ignores shares; counts rare cats fully |
| 1 | Shannon | `exp(H)`, `H = −Σ pᵢ ln pᵢ` | weights categories by frequency (recommended default) |
| 2 | Simpson / HHI | `1/Σpᵢ²` (= inverse-Simpson = `1/HHI`) | dominated by the common categories |

**Default: q = 1 (Shannon/`exp(H)`) for Diversity [I1]; q = 2 (HHI) for Concentration [I2]** — the two
are deliberately the same family read from opposite ends, so they stay mathematically reconcilable
(see §6).

### 0.5 Normalization (how a per-dimension index becomes a 0–1 sub-score)
For dimension `d` with `Kd` = **reference-taxonomy size** (the count of *possible/relevant*
categories for that dimension, defined at build with the operator — **calibrate-at-build**):

```
nDiv_d = effectiveN_d / Kd            # 0..1, rewards BOTH breadth and evenness
```

Design choice, stated explicitly: normalize by **possible** categories `Kd`, **not** by categories
*observed*. Rationale — running only 2 of 10 relevant hooks perfectly evenly must **not** score as
"fully diverse"; narrowness is exactly the fragility the score exists to catch. Reporting also
includes **Pielou evenness** `J_d = H_d / ln(S_d)` (evenness among what's run) as a diagnostic, so a
low `nDiv_d` can be read as "narrow" (few categories) vs "lopsided" (uneven) vs both.
`Kd` is `UNKNOWN — set at build`; if no taxonomy is agreed for a dimension, that dimension is
**excluded and disclosed**, never scored against an invented `Kd`.

### 0.6 The weight vector `w_d` (shared by I1, I2; I5 uses its own priority weights)
**Reason for weighting:** dimensions are weighted by **decision-impact** — how independently a
dimension drives *fatigue-independence*, *audience reach*, and *strategic risk*. Hook/angle/persona
change *who responds and when it burns out*; background/environment are largely cosmetic and rarely
change the outcome. An unweighted mean would let cosmetic variety inflate the headline number and
hide real concentration in the dimensions that matter.

| Tier | Dimensions | Starting scaffold weight | Why this tier |
|---|---|---|---|
| **High** | hook, angle, persona, format, product | **3** | drive fatigue-independence, audience reach, and revenue exposure; concentration here = true single-point-of-failure |
| **Mid** | problem, desire, awareness, offer, concept, message, landing | **2** | shape targeting/message-match and funnel coverage; matter, but downstream of the High tier |
| **Low** | visual, speaker, CTA, narrative, structure, background, environment | **1** | execution/cosmetic variety; real but weak decision impact on their own |

- Fact label on the weights: **INTERNAL CALCULATION, calibrate-at-build.** The 3/2/1 tiers are a
  **starting scaffold** (a defensible prior), **not** a validated benchmark. Calibration target:
  regress each dimension's concentration against realized fatigue-correlated loss on this account's
  own history and re-fit; version the weight vector (per [15] rule-engine versioning).
- Normalized form used in formulas: `ŵ_d = w_d / Σw_d`.

### 0.7 Confidence function (shared shape for all five)
Every score ships a **confidence in [0,1]**, never a bare number:

```
confidence = tag_conf × sample_adequacy × signal_stability   (× embedding_quality for I3)
```

| Factor | Definition | Floor behavior |
|---|---|---|
| `tag_conf` | spend-weighted mean of the `_conf` on the tags used | low tag_conf → whole score low-confidence |
| `sample_adequacy` | `min(1, N_eff / N_floor)` where `N_eff` = effective # creatives (§0.8) | below floor → clamp confidence, badge "insufficient data" |
| `signal_stability` | 1 − (score volatility across the last k daily snapshots, normalized) | a score that jumps day-to-day is noise, not diversity |
| `embedding_quality` (I3 only) | coverage × model-agreement of embeddings on the active set | missing embeddings → **cannot compute**, say so |

`N_floor`, `k`, and the volatility normalizer are **UNKNOWN — calibrate-at-build**. Confidence is
reported as a band (High/Med/Low), never as false-precise decimals.

### 0.8 Minimum sample (shared)
Entropy and HHI are **biased and unstable on small N** (few creatives, or sparse categories with
1–2 observations). Rules:
- Report a score only when `N_eff ≥ N_floor` **and** no scored dimension is carried by a single
  creative; otherwise → **INSUFFICIENT DATA** (mirrors [01c] H8's discipline: never a false verdict).
- `N_eff` uses **effective count under spend weights**: `N_eff = (Σspend)² / Σ(spend²)` (Kish
  effective sample size) — one $10k ad + nine $10 ads is `N_eff ≈ 1`, not 10.
- Apply small-sample bias correction to Shannon (**Chao–Shen** or Miller–Madow) before normalizing.
- `N_floor` value = **UNKNOWN — calibrate-at-build** (a hardcoded floor would be an arbitrary
  threshold — disallowed by the brief).

---

## 1. I1 · Diversity Score

| Field | Value |
|---|---|
| **Decision it drives** | Broaden creative exploration? Low score → commission net-new angles/personas/formats; high score → exploit, don't over-explore. Feeds [16] recommendation "what to produce next" and account-health "diversity" dimension [09]. |
| **Definition** | Weighted mean, across fingerprint dimensions, of the normalized effective-number-of-categories of the **spend-weighted** category distribution. "How spread is the money across genuinely different creative types." |
| **Inputs** | fingerprint tags per active creative (**INFER**), `spend` per creative (**FETCH OFFICIAL**), reference taxonomy sizes `Kd` (**EXTERNAL/build**). |
| **Formula** | Per dimension `d`: `pᵢ = spend_share of category i`; `H_d = −Σ pᵢ ln pᵢ` (bias-corrected); `effN_d = exp(H_d)`; `nDiv_d = effN_d / Kd`. **`DiversityScore = Σ_d ŵ_d · nDiv_d` → 0..1.** |
| **Weights + reason** | `ŵ_d` from §0.6 (decision-impact tiers). Reason: cosmetic variety must not inflate the headline; fatigue-independent dimensions dominate. Scaffold, calibrate-at-build. |
| **Source / [02] class** | INFER tags + FETCH spend → **CALC DERIVED**. |
| **Level** | Account / Campaign (portfolio). Not meaningful at ad level. |
| **Time window** | Snapshot of the active set; report **7d/30d trend** of the score (rising = diversifying). |
| **Min sample** | §0.8. Tiny portfolios or sparse categories → low confidence / INSUFFICIENT DATA. |
| **Confidence** | §0.7 (tag_conf × sample_adequacy × signal_stability). |
| **Limitations** | Tag-accuracy-bound (INFERENCE); "diverse tags" can be **functionally** similar → always read with **Redundancy [I3]**; count vs spend basis diverge; `Kd` choice moves the number. |
| **When NOT to trust** | tag confidence low; `N_eff` below floor; a dimension has too many singleton categories (entropy unstable); score swings day-to-day (`signal_stability` low). |

- Fact label: **INTERNAL CALCULATION (DERIVED) over INFERRED tags**, with confidence.

---

## 2. I2 · Concentration Score

| Field | Value |
|---|---|
| **Decision it drives** | De-risk or accept? High concentration → diversify to remove single-point-of-failure, **unless** the concentration is a proven healthy winner (cross-check performance + fatigue). Answers the brief's "where are we over-concentrated". Feeds [10] waste / [11] scaling / [09] health. |
| **Definition** | Weighted mean of the normalized **Herfindahl–Hirschman Index** of the spend distribution per dimension. The inverse face of I1, read at q=2. |
| **Inputs** | `spend` (and optionally `purchases`/`value`) per fingerprint value (**FETCH OFFICIAL**) + tags (**INFER**). |
| **Formula** | Per dimension: `sᵢ = spend share of category i`; `HHI_d = Σ sᵢ²` (range `[1/Kd, 1]`); normalized `HHI*_d = (HHI_d − 1/Kd) / (1 − 1/Kd)` → 0..1. Also report **top-N share** `CRₙ = Σ top-n sᵢ` (n=1,3). **`ConcentrationScore = Σ_d ŵ_d · HHI*_d`.** |
| **Weights + reason** | Same `ŵ_d` as I1 (§0.6): concentration in hook/angle/persona/format/product is the dangerous kind; concentration in `background` is not. Scaffold, calibrate-at-build. |
| **Source / [02] class** | FETCH spend + INFER tags → **CALC DERIVED**. |
| **Level** | Account / Campaign / **by product**. |
| **Time window** | Snapshot + weekly trend (rising concentration = growing fragility). |
| **Min sample** | §0.8; HHI unstable on very few units. Prefer `1/HHI` (effective-N) when explaining to humans. |
| **Confidence** | §0.7. |
| **Limitations** | **Concentration is not inherently bad** (a $500/day @4× winner is fine — brief) — must be read with performance + fatigue [H8], never alone; tag-accuracy-bound. |
| **When NOT to trust** | concentration reflects a deliberate healthy winner; low tag confidence; too few units; a promo temporarily skews spend into one creative. |

- Fact label: **INTERNAL CALCULATION (DERIVED) over INFERRED tags**.

---

## 3. I3 · Redundancy Score

| Field | Value |
|---|---|
| **Decision it drives** | Consolidate / retire near-duplicates and redirect production to genuinely new territory. Distinguishes "real diversity" from "many ads that are secretly the same" — the correction on I1. Feeds [10] waste (redundant slots) + [16] production plan. |
| **Definition** | Share of active creatives (or of spend) sitting inside dense same-region clusters in fingerprint-embedding space — creatives that count as separate ads but are functional near-duplicates. |
| **Inputs** | `creative_embedding` vectors (**EXTERNAL/CALC** computer vision, [05]/24 §5) + tags (INFER) + `spend` (FETCH). |
| **Formula** | Build pairwise **cosine similarity** on the chosen embedding kind(s) (default: `visual`+`concept`, per [05]); cluster (agglomerative / connected-components) at threshold **τ**; a cluster is "redundant" if size ≥ 2 with intra-cluster cosine ≥ τ. **Count basis:** `Redundancy = 1 − C/N` (`C` = # clusters, `N` = # creatives). **Spend basis (default):** `Redundancy = Σ_over_clusters (cluster_spend_share × (size−1)/size)` = spend sitting on duplicate copies beyond one exemplar per cluster → 0..1. |
| **Weights + reason** | Two calibrated knobs, both **UNKNOWN — calibrate-at-build**: (a) **τ** the similarity cutoff (a hardcoded cosine cutoff would be an arbitrary threshold — disallowed); (b) which embedding kinds/facets count toward "same" (visual-same but angle-different may be *iteration*, not redundancy). Calibrate τ against human "are these the same ad?" labels. |
| **Source / [02] class** | Embeddings **EXTERNAL/CALC** + INFER tags → **CALC DERIVED**. |
| **Level** | Account / Campaign. |
| **Time window** | Snapshot; trend as new creatives ship (is production adding real variety or copies?). |
| **Min sample** | Needs embeddings computed for the **whole active set**; partial embedding coverage → report coverage and lower confidence; **no embeddings → cannot compute, say so** (never substitute tag-equality as if it were similarity). |
| **Confidence** | §0.7 **× embedding_quality** (coverage × cross-model agreement). |
| **Limitations** | Visual/semantic similarity **≠ redundancy of performance** — two near-identical ads can perform differently; τ-sensitivity; embedding model bias. |
| **When NOT to trust** | embeddings missing/low quality; the "duplicates" are a **deliberate iterative test** of one concept (that's a test with a hypothesis, not waste — check the learning store); τ uncalibrated. |

- Fact label: **INTERNAL CALCULATION (DERIVED)** over EXTERNAL/CALC embeddings + INFERRED tags.

---

## 4. I4 · White-Space Score

| Field | Value |
|---|---|
| **Decision it drives** | **What to produce next** — net-new fingerprint territory we don't yet occupy. The brief's "where is the white space". Feeds [16] production recommendations + [13] White-Space Framework (this is the score; 13 is the surfacing/prioritization engine). |
| **Definition** | Fraction of the **plausible, valuable** fingerprint-combination lattice that we are NOT currently running, prioritized by candidate value. Output is a **scalar + a ranked list of specific empty cells**, not just a number. |
| **Inputs** | our occupied combinations (**INFER** tags), a **pruned candidate lattice** (build-defined), value signals: adjacency to our proven winners (CALC), competitor-active regions (**EXTERNAL**, [12]), and the **learning store** of past failed tests. |
| **Formula** | Over a defined combination lattice `L` (e.g. persona × hook × angle × format, pruned to plausible cells): `occupied` = cells with ≥1 active creative; **`WhiteSpace = Σ_{c∈candidates} value_c · [c unoccupied] / Σ_{c∈candidates} value_c`** (value-weighted share of valuable space that's empty). `value_c` = f(adjacency-to-winner, competitor-activity(hypothesis), coverage-priority), minus a penalty for cells in the **tried-and-failed** set. |
| **Weights + reason** | `value_c` favors cells **adjacent to proven winners** (most likely to transfer) and competitor-active cells (**HYPOTHESIS only — active != winning**, brief). Empty ≠ opportunity: a cell may be empty because it was **tried and failed** — such cells are down-weighted using the test-learning memory, else white-space becomes a list of known-bad ideas. All weights **calibrate-at-build**. |
| **Source / [02] class** | INFER tags + EXTERNAL competitor data → **CALC DERIVED**; the "valuable" judgment is **INFERENCE**. |
| **Level** | Account / Campaign / by product. |
| **Time window** | Snapshot; re-scored as portfolio + competitor set + learning store change. |
| **Min sample** | Needs a **pruned** lattice and enough tagged history to know what's occupied. The full combinatorial space is astronomically large — **must** be pruned to plausible cells or the score is meaningless. |
| **Confidence** | §0.7; **plus** a lattice-quality factor (was the space pruned by a defensible rule or arbitrarily?). Competitor-derived value is capped at HYPOTHESIS confidence. |
| **Limitations** | combinatorial explosion (pruning is load-bearing and subjective); "empty" may mean "already failed"; competitor presence is not proof of a winner; economics of competitor cells = **UNKNOWN**. |
| **When NOT to trust** | lattice arbitrary/unpruned; competitor data treated as proof; no memory of past failed tests; value model uncalibrated. |

- Fact label: score = **INTERNAL CALCULATION (DERIVED)**; competitor-derived candidates =
  **INFERENCE / HYPOTHESIS**, never a fact; competitor economics remain **UNKNOWN** ([02]).

---

## 5. I5 · Coverage Score

| Field | Value |
|---|---|
| **Decision it drives** | **Fill the gap** — which strategically intended targets (hero products, key personas, funnel stages, formats) have **no live creative**. Brief's "which products have creative coverage / gaps". Feeds [16] + [09] LP/product coverage health. |
| **Definition** | Of the **operator-defined intended** fingerprint targets, the priority-weighted fraction that actually have live creative. Coverage is measured **against a plan**, unlike I1–I4 which are intrinsic to the running set. |
| **Inputs** | **intended target list + priorities** (**EXTERNAL** — product feed / strategy input) vs. occupied tags (**INFER**). |
| **Formula** | Per dimension: `Coverage_d = covered_targets_d / total_intended_d`. Priority-weighted overall: **`CoverageScore = Σᵢ priorityᵢ · covered(targetᵢ) / Σᵢ priorityᵢ`** (indicator `covered=1` if ≥1 active creative maps to that target). Report per-dimension (persona-, product-, awareness-, format-coverage) so gaps are actionable. |
| **Weights + reason** | Targets weighted by **strategic priority** (hero products, key personas) — priority is an **EXTERNAL business input**, not a Meta fact; obtain from the operator, **verify at build**. Optionally weight "covered" by a minimum-spend threshold so a $1/day token ad doesn't count as real coverage. |
| **Source / [02] class** | EXTERNAL intended-target list + INFER coverage → **CALC DERIVED**. |
| **Level** | Account / by product / by persona. |
| **Time window** | Snapshot; trend as catalogue / strategy changes. |
| **Min sample** | Needs a **defined intended-target list**; without it, coverage is **undefined — say so, never invent targets** (this is the sharpest guardrail on I5). |
| **Confidence** | §0.7, plus freshness of the target list (stale product feed → lower confidence). |
| **Limitations** | **Coverage ≠ performance** (covered-but-losing is still a problem — pair with fatigue/ROAS); depends on an accurate, current target list and accurate tags. |
| **When NOT to trust** | no agreed target list; product feed stale; tags low-confidence; token-spend ads counted as coverage. |

- Fact label: **INTERNAL CALCULATION (DERIVED)** over EXTERNAL target list + INFERRED coverage.

---

## 6. Internal consistency between the scores (reconciliation math)

These five are not independent numbers; they must agree with each other or a bug is present.

| Relationship | Expected math | If violated → |
|---|---|---|
| Diversity [I1] ↔ Concentration [I2] | monotonically inverse per dimension: `effN` (q=1) and `1/HHI` (q=2) both rise as spread rises. Not identical (different q), so `I1 + I2 ≠ 1` exactly — do **not** hardcode that identity. | if I1 and I2 move the *same* direction on the same scope/basis → weighting or share-computation bug. |
| Diversity [I1] ↔ Redundancy [I3] | high I1 **with** high I3 = **fake diversity** (many tags, functionally same). This pairing is the single most important read in the library. | high-I1/high-I3 must be surfaced, not averaged away. |
| Coverage [I5] ↔ White-Space [I4] | coverage gap (intended-but-empty) ⊆ white-space (any valuable-empty). Coverage is the *planned* subset of white space. | a covered target appearing as white space → target-mapping bug. |
| Basis divergence | spend-basis diversity ≪ count-basis diversity = "diverse library, concentrated spend" | that gap is a **reported signal**, not an error. |

**Optional roll-up (`Portfolio Diversity Index`)** — a single 0–1 headline for [09] account health:
`PDI = a·I1 + b·(1−I2) + c·(1−I3) + d·I4 + e·I5`, weights `a..e` **calibrate-at-build** and
**disclosed**. Marked optional because a single number hides the I1/I3 tension above; the five
sub-scores are the primary surface, PDI is a convenience for the executive lens [21]. Never let PDI
replace the sub-scores on a decision surface.

---

## 7. Decision map (decision-gate compliance — every score names its action)

| Score | Observation | Decision | Action bucket ([16] / brief) |
|---|---|---|---|
| I1 Diversity | low & falling | broaden exploration | DO NEXT: commission new angles/personas |
| I2 Concentration | high in a fatiguing winner | de-risk | DO NOW: diversify before the winner breaks |
| I2 Concentration | high in a healthy winner | accept, monitor | WATCH (not waste) |
| I3 Redundancy | high | consolidate/retire duplicates | DO NEXT: cut redundant slots, redirect production |
| I4 White-Space | high-value empty cell adjacent to a winner | produce net-new | DO NEXT: test the empty cell (with hypothesis) |
| I5 Coverage | hero product/persona uncovered | fill the gap | DO NOW/NEXT by strategic priority |
| any | confidence Low / below sample floor | do not act on the number | NEEDS MORE DATA |

Every score that cannot name a live decision on the surface is demoted to advanced analytics — none
here are vanity: all five map to a production/budget/risk decision in the brief's final test.

---

## 8. Calibrate-at-build checklist (the UNKNOWNs, collected)

Nothing below is shipped as a fact; each must be set with the operator/data before the scores go live.

| # | Parameter | Used by | Status |
|---|---|---|---|
| 1 | reference taxonomy size `Kd` per dimension | I1, I2 | **UNKNOWN — set with operator** |
| 2 | dimension weight vector `w_d` (3/2/1 scaffold) | I1, I2 | scaffold → **calibrate on account history** |
| 3 | effective-sample floor `N_floor`, snapshot count `k` | all (§0.8) | **UNKNOWN — calibrate** |
| 4 | redundancy cosine threshold `τ` + embedding kinds | I3 | **UNKNOWN — calibrate vs human labels** |
| 5 | white-space lattice pruning rule + `value_c` model | I4 | **UNKNOWN — build-defined, defensible** |
| 6 | intended-target list + priorities + min-spend-for-covered | I5 | **EXTERNAL — from operator** |
| 7 | PDI roll-up weights `a..e` (if PDI is used) | §6 | **UNKNOWN — calibrate + disclose** |
| 8 | small-sample bias correction (Chao–Shen/Miller–Madow) | I1 | method fixed; verify implementation |

---

## 9. Consistency check vs [02] and [01c]

| 06 element | Traces to | Class enforced |
|---|---|---|
| tags (persona/hook/angle/…) feeding all scores | [02] creative assets — persona/hook/angle **INFER (INFERENCE)** | OK — every score inherits inference uncertainty |
| spend/impressions/value weighting | [02] delivery/conversion **FETCH OFFICIAL** | OK |
| embeddings for I3 | [02] creative — CV embeddings **EXTERNAL/CALC** | OK |
| competitor cells for I4 | [02] competitor **EXTERNAL**, active != winning; economics **CANNOT-KNOW** | OK — HYPOTHESIS, never fact |
| intended targets for I5 | [02] product/LP **EXTERNAL** | OK |
| I1–I5 definitions, levels, decisions | [01c] I1–I5 | **06 is the formula layer under 01c; no definition drift** |
| all weights/thresholds | brief benchmark-honesty + [02] "no hardcoded generic benchmarks" | OK — every one marked calibrate-at-build/UNKNOWN |

**No hardcoded benchmark or threshold is introduced.** The index math (Shannon/Simpson/Hill/HHI) is
RESEARCH-BACKED method; every weight, taxonomy size, sample floor, and similarity cutoff is
`INTERNAL CALCULATION, calibrate-at-build` or `UNKNOWN`. `active != winning` and `insufficient data
!= waste` are honored throughout.
