# 01c — Master Metric Dictionary: H FATIGUE, I DIVERSITY, J SCALING

> Part of the AdBrain Master Metric Dictionary (Artifact 01c of 28).
> AdBrain answers **"what should we do next?"** — every metric below must change a decision or it is cut.

---

## ⚠️ Build note on dependencies

The three canonical foundation files this artifact was told to read — `docs/product-spec/brief.md`, `docs/product-spec/00-master-plan.md`, `docs/product-spec/02-meta-data-mapping.md` — **do not yet exist in the workspace as of 2026-08-25**. This artifact was written from the discipline embedded in the authoring brief (10-question metric contract, fact-label taxonomy, data-mapping classes FETCH/CALC/INFER/EXTERNAL/CANNOT-KNOW). **At build, re-reconcile every "source" and "data-mapping class" cell against `02-meta-data-mapping.md` once it lands.** Any cell citing a Meta Marketing API field name is marked so it can be verified against the real field list.

---

## Legend (used in every table)

**Fact labels** (attach to every value):

| Label | Meaning |
|---|---|
| **OFFICIAL PLATFORM FACT** | A field Meta returns directly (Marketing/Insights API). Named so it can be verified. |
| **INTERNAL CALCULATION (DERIVED)** | AdBrain computes it from Meta facts. Not a Meta field. |
| **RESEARCH-BACKED** | Grounded in published research/method, cited. |
| **INDUSTRY BENCHMARK** | A cross-account comparison value. Must be verifiable or marked UNKNOWN. |
| **MODEL ESTIMATE** | Output of an AdBrain model (forecast, score, classifier). Probabilistic. |
| **INFERENCE** | Reasoned guess from indirect signals. Lower confidence. |
| **UNKNOWN / verify at build** | Not established as of Aug 2026. Never presented as truth. |

**Data-mapping class** (from `02-meta-data-mapping.md`):

| Class | Meaning |
|---|---|
| **FETCH** | Pulled directly from Meta API. |
| **CALC** | Derived by AdBrain from FETCHed values. |
| **INFER** | Estimated from indirect/partial signals (probabilistic). |
| **EXTERNAL** | Requires a non-Meta source (CRM, MMM, site analytics, human tag). |
| **CANNOT-KNOW** | Not obtainable from Meta at this level; do not fake it. |

**Levels:** account / campaign / adset / ad / creative.

> **Sample-size & threshold honesty:** Every numeric threshold, benchmark, and half-life below that is not a Meta-documented value is marked **UNKNOWN / verify at build** or **tunable default**. AdBrain must learn account-specific thresholds from that account's own history rather than shipping arbitrary constants as truth.

---

# Category H — FATIGUE

**Design principle:** Fatigue is **multi-signal**, not frequency alone. Frequency is one input and frequently a lagging or misleading one (a high frequency on a still-converting ad is not fatigue; a rising frequency with collapsing hook rate and rising CPA is). AdBrain classifies each ad/creative into **one of 8 fatigue states** using a vector of signals, and only the *state* drives the action.

## H0 — The 8 Fatigue States (the classifier output)

**Fact label:** MODEL ESTIMATE (state classifier) — the *state taxonomy* is an INTERNAL CALCULATION framework, not a Meta field.
**Level:** ad and creative (a creative can be fatigued account-wide even where one ad still delivers). **Data-mapping class:** CALC + INFER.

| # | State | Plain meaning | Dominant signal pattern | Decision it drives |
|---|---|---|---|---|
| 1 | **FRESH / LEARNING** | Too new to judge | Below min sample; delivery unstable | Wait / protect budget; do not kill |
| 2 | **RAMPING** | Getting more efficient | CPA↓ or ROAS↑ over trailing windows, freq low | Hold or feed budget |
| 3 | **PEAK** | Best efficiency window | Efficiency at trailing max, signals stable | Scale candidate (see J) |
| 4 | **STABLE / PLATEAU** | Flat, still profitable | Efficiency flat within noise band, freq moderate | Maintain; queue a refresh |
| 5 | **CREATIVE FATIGUE** | The *creative* is wearing out | Hook rate & CTR decaying while freq rises; CPM stable-ish | Refresh creative (new hook/angle), not audience |
| 6 | **AUDIENCE SATURATION** | The *audience* is exhausted | New-reach ratio falling, freq climbing, CPM rising, CTR flatter | Expand/rotate audience or raise budget cap; refreshing creative alone won't fix |
| 7 | **TERMINAL DECLINE** | Broken; bleeding money | CPA past account tolerance, negative feedback up, all trends down | Pause / kill |
| 8 | **ZOMBIE / FALSE-POSITIVE** | Looks fine, isn't incremental | ROAS "good" but mostly retargeting/brand-harvest; low incrementality | Cut or reallocate; do NOT scale (would just harvest existing demand) |

**Why 8 and not "fatigued/not":** each state maps to a *different* fix. States 5 vs 6 are the classic error — teams refresh creative when the audience is saturated (no lift) or expand audience when the creative is stale (no lift). Separating them is the whole point.

**When NOT to trust the state:** during learning phase (state 1), after any budget/audience/creative edit (resets the trend windows), during seasonal demand spikes, or when conversion volume is below min sample. **Incrementality (state 8) cannot be confirmed from Meta alone** — it needs a lift test or MMM (EXTERNAL). Without that, state 8 is an INFERENCE, flagged as such.

---

## H1 — Frequency

| Field | Value |
|---|---|
| **What it measures** | Average times a person saw the ad in the window. |
| **Why it matters** | One saturation input; useful only in combination. |
| **Decision it drives** | Contributes to states 5/6; a frequency ceiling can trigger review — but never a kill on its own. |
| **Inputs** | impressions, reach. |
| **Formula** | `impressions / reach`. **INTERNAL CALCULATION** if computed by AdBrain; Meta also returns `frequency` directly (**OFFICIAL PLATFORM FACT**). |
| **Source / class** | Meta `frequency`, `impressions`, `reach` — FETCH. |
| **Comparison window** | Rolling 7d and 28d; compare to the *same ad's* own history, not a global number. |
| **Minimum sample** | Reach large enough that frequency is stable — UNKNOWN / verify at build (learn per account). |
| **Limitations** | Average hides distribution (a few super-heavy viewers skew it); resets when audience changes; cross-device dedupe is imperfect. |
| **When NOT to trust** | As a standalone fatigue trigger; right after audience expansion; small reach. A "frequency = 3.x is bad" rule is **UNKNOWN / verify** — no universal threshold exists. |

## H2 — New-Reach Ratio (audience-exhaustion signal)

| Field | Value |
|---|---|
| **What it measures** | Share of this period's reach that is *newly* reached vs already-seen people. |
| **Why it matters** | The cleanest **audience saturation** signal (separates state 6 from state 5). |
| **Decision it drives** | Falling ratio + rising freq → expand/rotate audience (not refresh creative). |
| **Inputs** | period-over-period reach, cumulative reach. |
| **Formula** | `(reach_cumulative_t − reach_cumulative_t−1) / reach_t` — **INTERNAL CALCULATION (DERIVED)**. |
| **Source / class** | Built from repeated `reach` pulls — CALC. Meta does not expose a clean "new vs repeat reach" field at ad level → the incremental-reach construction is **INFER** and imperfect (reach is de-duplicated per query window, so differencing windows is approximate). |
| **Comparison window** | Weekly deltas over 4–6 weeks. |
| **Minimum sample** | Several weeks of stable delivery — UNKNOWN / verify at build. |
| **Limitations** | Reach de-dup across windows is approximate; audience edits reset it; overlapping ad sets double-count. |
| **When NOT to trust** | Overlapping audiences, recent targeting change, or short history. Treat as directional, not exact. |

## H3 — Hook Rate (3-second / thumbstop) and its trend

| Field | Value |
|---|---|
| **What it measures** | Share of impressions that produce an initial video view (thumbstop). |
| **Why it matters** | Earliest, fastest-moving **creative fatigue** signal (state 5) — decays before CPA does. |
| **Decision it drives** | Declining hook-rate trend on a creative → refresh the opening/hook. |
| **Inputs** | 3-second video plays (or thruplay proxy), impressions. |
| **Formula** | `video_3s_views / impressions` — **INTERNAL CALCULATION (DERIVED)**; the components are OFFICIAL PLATFORM FACTs. |
| **Source / class** | Meta `video_play_actions` / 3-sec view field + `impressions` — FETCH → CALC. Verify exact field name at build. |
| **Comparison window** | 7d vs 7d prior; slope over trailing 3–4 weeks. |
| **Minimum sample** | Enough impressions for a stable ratio — UNKNOWN / verify at build. |
| **Limitations** | Video only (no equivalent for static — use CTR trend there); autoplay inflates the numerator; placement mix shifts it. |
| **When NOT to trust** | Static/carousel creative; placement mix changed; low impressions. A "good hook rate = X%" benchmark is **UNKNOWN / verify at build**. |

## H4 — CTR Trend (link + all) as fatigue slope

| Field | Value |
|---|---|
| **What it measures** | Direction/slope of click-through rate over time (not the level). |
| **Why it matters** | Creative-fatigue signal for **all formats** incl. static; complements hook rate. |
| **Decision it drives** | Sustained negative slope with rising freq → refresh creative (state 5). |
| **Inputs** | clicks (link + all), impressions, over successive windows. |
| **Formula** | slope of `ctr = clicks / impressions` across trailing windows — **INTERNAL CALCULATION (DERIVED)**. `ctr` itself is an OFFICIAL PLATFORM FACT. |
| **Source / class** | Meta `ctr`, `inline_link_click_ctr`, `impressions` — FETCH → CALC. |
| **Comparison window** | Trailing 4–6 weekly points; own-history baseline. |
| **Minimum sample** | Clicks per window high enough that CTR is stable — UNKNOWN / verify at build. |
| **Limitations** | CTR level varies hugely by objective/placement/audience — only the *self-referential slope* is a fatigue signal, never the absolute number cross-account. |
| **When NOT to trust** | After creative/audience edit; placement mix change; low click volume. |

## H5 — CPM Trend (auction-pressure vs saturation)

| Field | Value |
|---|---|
| **What it measures** | Cost per 1,000 impressions and its direction. |
| **Why it matters** | Rising CPM alongside falling new-reach ratio points to **audience saturation** (state 6); rising CPM alone can just be auction/seasonality. |
| **Decision it drives** | Disambiguates state 5 vs 6; feeds scaling-cost forecasts (J). |
| **Inputs** | spend, impressions. |
| **Formula** | `spend / impressions × 1000` — Meta returns `cpm` directly (**OFFICIAL PLATFORM FACT**); trend is **INTERNAL CALCULATION**. |
| **Source / class** | Meta `cpm`, `spend`, `impressions` — FETCH. |
| **Comparison window** | 7d/28d trend; compare to account-level CPM trend to strip out market-wide moves. |
| **Minimum sample** | Stable daily spend — UNKNOWN / verify at build. |
| **Limitations** | Confounded by seasonality, competition, iOS/attribution, placement mix — **not clean** for isolating fatigue. |
| **When NOT to trust** | Q4/holiday, promo periods, or when the whole account's CPM moved (market, not fatigue). |

## H6 — Efficiency Trend: CPA / ROAS slope (the money signal)

| Field | Value |
|---|---|
| **What it measures** | Direction of cost-per-result / return on ad spend over time. |
| **Why it matters** | The **decision-critical** fatigue signal — states 3/4/7 hinge on it. Leading signals (hook, CTR) warn early; this confirms. |
| **Decision it drives** | Sustained CPA rise past account tolerance → TERMINAL DECLINE → pause (state 7). Stable → maintain (state 4). |
| **Inputs** | spend, conversions/purchases, conversion value. |
| **Formula** | `cpa = spend / conversions`; `roas = conversion_value / spend` — Meta returns cost-per-action and purchase ROAS (**OFFICIAL PLATFORM FACT**, attribution-window-dependent); the slope is **INTERNAL CALCULATION**. |
| **Source / class** | Meta `actions`, `cost_per_action_type`, `purchase_roas`, `spend` — FETCH → CALC. Attribution window is a config, not a truth. |
| **Comparison window** | Trailing 7/14/28d; own baseline + account tolerance band. |
| **Minimum sample** | **≥ statistically meaningful conversions per window** — tie to learning-phase volume; absolute number UNKNOWN / verify at build. |
| **Limitations** | Attribution-window sensitive; iOS/SKAN undercount; delayed conversions distort recent windows; low-volume noise. |
| **When NOT to trust** | Low conversion volume; recent attribution/tracking change; long consideration cycles where conversions lag impressions. |

## H7 — Negative Feedback / Quality drift

| Field | Value |
|---|---|
| **What it measures** | Hide/report/"see fewer" signals and Meta's ad relevance rankings drifting down. |
| **Why it matters** | Corroborates terminal decline and audience irritation; protects account health. |
| **Decision it drives** | Rising negatives + downgraded rankings → prioritize kill/refresh (states 5/7). |
| **Inputs** | negative feedback actions; quality/engagement/conversion rate rankings. |
| **Formula** | trend of negative-feedback rate; ranking transitions — **INTERNAL CALCULATION** over OFFICIAL PLATFORM FACTs. |
| **Source / class** | Meta `quality_ranking`, `engagement_rate_ranking`, `conversion_rate_ranking` (FETCH, but categorical: above/avg/below avg) + negative-feedback fields (verify availability at build — may be **CANNOT-KNOW** at ad level for small volumes). |
| **Comparison window** | 7d/28d; ranking is relative to competing advertisers, so it moves even when your ad doesn't. |
| **Minimum sample** | Meta suppresses rankings below a volume floor — UNKNOWN / verify at build. |
| **Limitations** | Rankings are **relative and coarse** (3 buckets); suppressed at low volume; laggy. |
| **When NOT to trust** | Low delivery (rankings blank); as a sole trigger; interpreting a ranking drop as your fault when competitors simply improved. |

## H8 — Fatigue Composite Score (roll-up that assigns the state)

| Field | Value |
|---|---|
| **What it measures** | Single 0–100 fatigue index that maps signals H1–H7 to one of the 8 states. |
| **Why it matters** | Turns a signal vector into one actionable state + confidence. |
| **Decision it drives** | Refresh vs expand vs kill vs scale — the core H output. |
| **Inputs** | H1–H7 signal trends (each z-scored against the ad's own history). |
| **Formula** | Weighted, sign-aware combination of trend slopes → state via rules. **MODEL ESTIMATE.** Illustrative default weights (creative-fatigue-leaning), **tunable — verify/learn at build, not truth:** |

| Signal | Default weight | Why this weight (rationale, not fact) |
|---|---|---|
| Efficiency slope (H6, CPA/ROAS) | 0.30 | The decision that actually costs money; must dominate. |
| Hook-rate trend (H3) | 0.20 | Earliest creative-wear signal; leads H6. |
| CTR slope (H4) | 0.15 | Covers static; corroborates H3. |
| New-reach ratio (H2) | 0.15 | The one clean audience-vs-creative discriminator. |
| Frequency (H1) | 0.08 | Real but lagging/misleading alone → deliberately small. |
| CPM trend (H5) | 0.07 | Confounded by market → small. |
| Negative feedback / ranking (H7) | 0.05 | Coarse, laggy → small but protective. |

| Field | Value |
|---|---|
| **Source / class** | CALC over FETCHed facts; the classifier is INFER/MODEL. |
| **Comparison window** | Each signal vs its own trailing baseline; composite refreshed daily. |
| **Minimum sample** | Inherits the strictest sub-signal floor (usually H6 conversions). Below it → force state 1 FRESH, do not emit a fatigue verdict. |
| **Limitations** | Weights are priors, not truth; a single composite can mask a split signal (refresh vs expand) — **always surface the top contributing signals, not just the number**. |
| **When NOT to trust** | Below sample; post-edit; seasonality; when incrementality (state 8) is unconfirmed by an EXTERNAL lift test. |

---

# Category I — DIVERSITY

**Design principle:** Diversity is measured across **strategic dimensions**, never "number of ads." Ten near-identical UGC testimonials for one persona is 10 ads and *zero* diversity. AdBrain scores the portfolio over a defined dimension set and asks: are we concentrated, redundant, or blind to whole segments?

## I0 — The dimension taxonomy (what we diversify across)

**Fact label:** INTERNAL CALCULATION framework (tagging). **Level:** creative → adset/campaign/account roll-up. **Data-mapping class:** partly **INFER** (auto-tagged by AdBrain vision/LLM), partly **EXTERNAL** (human-labeled), partly **CANNOT-KNOW** from Meta (Meta does not label your creative's angle/persona).

| Dimension | Example values | How tagged |
|---|---|---|
| **Persona / audience** | new mom, SMB owner, gym-goer | INFER (model) or EXTERNAL (human) |
| **Awareness stage** | unaware → most aware | INFER/EXTERNAL |
| **Hook** | question, stat shock, pattern-interrupt | INFER (LLM on first frame/copy) |
| **Angle / message** | price, status, fear, convenience, social proof | INFER/EXTERNAL |
| **Format** | UGC video, static, carousel, collection | FETCH-adjacent (Meta gives some format signal) + INFER |
| **Visual style** | talking-head, screen-recording, meme, product-hero | INFER (vision model) |
| **Offer / CTA** | free trial, % off, bundle | INFER/EXTERNAL |

> Meta does **not** provide angle/persona/hook tags → these are AdBrain's own layer; their accuracy is a MODEL/INFER quality question and must be shown with confidence, not as fact.

## I1 — Diversity Score (spread across dimensions)

| Field | Value |
|---|---|
| **What it measures** | How evenly spend/impressions are spread across values within each dimension (entropy). |
| **Why it matters** | Even spread = resilience (if one angle fatigues, others carry). Concentrated = fragile. |
| **Decision it drives** | Low diversity → brief net-new angles/personas; high → fine, focus on scaling winners. |
| **Inputs** | spend (or impressions) per dimension-value; dimension tags (I0). |
| **Formula** | Per dimension: normalized **Shannon entropy** `H = −Σ pᵢ·ln(pᵢ) / ln(n)` (0–1), then average across dimensions (optionally weighted). **INTERNAL CALCULATION (DERIVED)**, entropy is RESEARCH-BACKED (information theory). |
| **Source / class** | Meta spend/impressions (FETCH) × AdBrain tags (INFER/EXTERNAL) → CALC. |
| **Comparison window** | Current live set; trend month-over-month. |
| **Minimum sample** | Enough live creatives per dimension that entropy is meaningful (n ≥ 3–4 values) — UNKNOWN / verify at build. |
| **Limitations** | Garbage-in from mis-tagging; "even spread" is not automatically good if some values are known losers; weighting choice is subjective. |
| **When NOT to trust** | Few creatives; poor tag confidence; early account with deliberate focus. |

## I2 — Concentration Score (spend-risk / single-point-of-failure)

| Field | Value |
|---|---|
| **What it measures** | How concentrated **spend and results** are in a few creatives/angles (the inverse-risk view of I1). |
| **Why it matters** | The real risk metric: "if our top creative dies tomorrow, what % of results vanish?" |
| **Decision it drives** | High concentration → urgently build backups for the winner's slot before it fatigues (feeds H + J). |
| **Inputs** | spend and conversions per creative/angle. |
| **Formula** | **HHI** `= Σ(share_i)²` (share of spend or of conversions), 0→1; and top-1 / top-3 result share. **INTERNAL CALCULATION (DERIVED)**; HHI is RESEARCH-BACKED (economics). |
| **Source / class** | Meta spend/conversions (FETCH) → CALC. |
| **Comparison window** | Current; watch alongside the winner's fatigue state. |
| **Minimum sample** | Enough conversions to trust per-creative shares — UNKNOWN / verify at build. |
| **Limitations** | Concentration on a genuine winner is fine *until* it fatigues — must be read **with** H, not alone. |
| **When NOT to trust** | Deliberate single-winner scaling phases; low conversion counts. |

## I3 — Redundancy Score (wasted near-duplicates)

| Field | Value |
|---|---|
| **What it measures** | Share of the portfolio that is functionally duplicate (same persona×angle×hook, high creative similarity) yet split across many ad IDs. |
| **Why it matters** | Redundant creatives split the learning signal, inflate the ad count, and masquerade as diversity. |
| **Decision it drives** | High redundancy → consolidate; stop counting duplicates as coverage; free the test slots. |
| **Inputs** | creative tags (I0) + creative-asset similarity (embeddings of copy/thumbnail/video). |
| **Formula** | `1 − (distinct creative clusters / total live creatives)`, clusters from semantic similarity threshold. **MODEL ESTIMATE / INFERENCE** (depends on the similarity model + threshold). |
| **Source / class** | AdBrain vision/text embeddings (INFER) over creative assets; Meta gives the asset refs (FETCH). |
| **Comparison window** | Current live set. |
| **Minimum sample** | N/A statistically, but similarity threshold must be validated — UNKNOWN / verify at build. |
| **Limitations** | Threshold-sensitive; a "duplicate" may test a real small variable (thumbnail A/B) — don't auto-flag legitimate tests. |
| **When NOT to trust** | During deliberate A/B/n creative tests; weak embedding quality. |

## I4 — White-Space Score (untested opportunity)

| Field | Value |
|---|---|
| **What it measures** | Share of the *strategic test matrix* (persona × angle × format × awareness) that has **never** been tested with a powered creative. |
| **Why it matters** | Names the next experiments — where growth that we've never touched might live. |
| **Decision it drives** | High white space → brief specific untested cells (the creative-generation queue). |
| **Inputs** | the defined matrix (strategy input, EXTERNAL) + which cells have live/historical powered creatives. |
| **Formula** | `untested_cells / total_defined_cells` (optionally weight cells by prior/expected value). **INTERNAL CALCULATION (DERIVED)** against an **EXTERNAL** matrix definition. |
| **Source / class** | Matrix = EXTERNAL (human/strategy); coverage of it = CALC over Meta history (FETCH) + tags (INFER). |
| **Comparison window** | Current; shrinks as tests run. |
| **Minimum sample** | A cell only counts "tested" once a creative in it reached statistical power (else it's "attempted, inconclusive"). Power threshold UNKNOWN / verify at build. |
| **Limitations** | Entirely dependent on how the matrix is defined — a lazy matrix hides real white space; a huge matrix manufactures fake gaps. The matrix is a judgment call, not a fact. |
| **When NOT to trust** | If the strategic matrix is undefined/stale, this score is meaningless. |

## I5 — Coverage Score (are the important cells actually alive right now)

| Field | Value |
|---|---|
| **What it measures** | Share of **priority** matrix cells that have at least one *currently live, non-fatigued, powered* creative. |
| **Why it matters** | White space asks "ever tested?"; coverage asks "protected *today*?" A cell can be tested-and-then-abandoned → covered=no. |
| **Decision it drives** | Low coverage on a high-value cell → prioritize a fresh creative there now (bridges I4 white space and H fatigue). |
| **Inputs** | priority cells (EXTERNAL) + live creatives with their fatigue state (H) and power status. |
| **Formula** | `Σ priority_weight(covered cells) / Σ priority_weight(all priority cells)`. **INTERNAL CALCULATION (DERIVED)**. |
| **Source / class** | Priorities EXTERNAL; live-and-healthy status = CALC over Meta (FETCH) + H states + tags (INFER). |
| **Comparison window** | Live now; re-scored daily as fatigue states change. |
| **Minimum sample** | Inherits H's sample floors for "non-fatigued." |
| **Limitations** | Depends on priority weighting (subjective) and on H's accuracy; "covered" ≠ "winning." |
| **When NOT to trust** | Undefined priorities; unreliable fatigue states. |

## I6 — Portfolio Diversity Index (composite)

| Field | Value |
|---|---|
| **What it measures** | One 0–100 portfolio-health-by-diversity number combining I1–I5. |
| **Why it matters** | A single tracked KPI for "is our creative portfolio resilient and exploring enough?" |
| **Decision it drives** | Trend down → the creative brief queue is under-fed; feeds account-level planning. |
| **Inputs** | I1–I5. |
| **Formula** | Weighted blend — **MODEL ESTIMATE / tunable, not truth.** Illustrative default weights + reasons: |

| Component | Default weight | Why (rationale, not fact) |
|---|---|---|
| Coverage (I5) | 0.30 | "Are priority bets protected *right now*" is the most action-linked. |
| Concentration/risk (I2) | 0.25 | Single-point-of-failure is the biggest downside risk. |
| White space (I4) | 0.20 | Where future growth is discovered. |
| Diversity spread (I1) | 0.15 | Resilience, but partly captured by I2/I5. |
| Redundancy (I3) | 0.10 | Waste/hygiene — real but lowest stakes. |

| Field | Value |
|---|---|
| **Source / class** | CALC/MODEL over the above. |
| **Comparison window** | Monthly trend; compare to the account's own history, not other accounts. |
| **Minimum sample** | Inherits sub-metric floors + tag-confidence floor. |
| **Limitations** | Composite hides which lever is broken — **always show the component breakdown**. Weights are priors. Cross-account benchmark of this index is **UNKNOWN / verify at build** and probably not comparable across verticals. |
| **When NOT to trust** | Low tag confidence; undefined matrix/priorities; brand-new account. |

---

# Category J — SCALING

**Design principle:** "Can we spend more without breaking efficiency, and if so how and how fast?" Scaling metrics are about the **marginal** dollar and **headroom**, not total spend. Meta gives no auction-impression-share metric (unlike Google), so several scaling questions are answered by AdBrain's own spend-response modeling, clearly labeled MODEL ESTIMATE, and some are **CANNOT-KNOW** from Meta.

## J1 — Learning-Phase Status

| Field | Value |
|---|---|
| **What it measures** | Whether an ad set is in Learning, Learning Limited, or Active. |
| **Why it matters** | You cannot trust efficiency or scale decisions mid-learning; edits reset it. |
| **Decision it drives** | Hold edits / consolidate ad sets to exit learning before judging or scaling. |
| **Inputs** | Meta delivery status; conversions in the trailing window. |
| **Formula** | Reported by Meta (**OFFICIAL PLATFORM FACT**: `learning` / `learning_limited` / `active` delivery status). Meta's documented guidance: an ad set generally exits learning around **~50 optimization events in ~7 days** — **RESEARCH-BACKED (Meta-documented); confirm the exact current number at build.** |
| **Source / class** | Meta delivery/status field — FETCH. |
| **Comparison window** | Rolling 7d optimization events. |
| **Minimum sample** | The ~50/7d guidance is itself the floor. |
| **Limitations** | "Learning limited" can persist for structural reasons (too many ad sets, tiny budget); the 50 figure is guidance, not physics. |
| **When NOT to trust** | As a quality signal (it's a delivery state, not performance); after any material edit. |

## J2 — Scaling Headroom (efficient spend remaining)

| Field | Value |
|---|---|
| **What it measures** | Estimated additional daily spend available before CPA exceeds the account's tolerance / ROAS floor. |
| **Why it matters** | The core scaling answer: "how much more can this absorb *profitably*?" |
| **Decision it drives** | Size and pace of budget increases; where to move money from losers to winners. |
| **Inputs** | historical spend↔CPA/ROAS points, current spend, tolerance band, fatigue state (H). |
| **Formula** | From a fitted **spend-response (saturation) curve** per ad set/campaign: headroom = spend at which marginal CPA hits the tolerance − current spend. **MODEL ESTIMATE.** |
| **Source / class** | Meta spend + results history (FETCH) → AdBrain curve fit (CALC/MODEL). |
| **Comparison window** | Trailing 30–90d of spend↔result observations; re-fit regularly. |
| **Minimum sample** | Needs enough *variation* in daily spend to fit a curve — flat-budget accounts give a near-unidentifiable curve → mark low-confidence / UNKNOWN. |
| **Limitations** | Confounded by seasonality, auction shifts, creative fatigue (a fatiguing creative fakes "no headroom"); extrapolation beyond observed spend is speculative. |
| **When NOT to trust** | Little spend variation; mid-fatigue; recent structural edits; extrapolating far past historical max spend. |

## J3 — Marginal CPA / Marginal ROAS

| Field | Value |
|---|---|
| **What it measures** | The cost/return of the *next* increment of spend (not the blended average). |
| **Why it matters** | Blended ROAS hides that the last dollars are much worse than the first — the decision lives at the margin. |
| **Decision it drives** | Increase budget only while marginal ROAS ≥ floor; stop before blended still "looks fine." |
| **Inputs** | spend-response curve slope at current spend. |
| **Formula** | derivative of results w.r.t. spend at current point → `Δspend / Δconversions`. **MODEL ESTIMATE / INTERNAL CALCULATION.** |
| **Source / class** | CALC/MODEL over Meta history (FETCH). |
| **Comparison window** | Trailing window used to fit the curve; recompute on new data. |
| **Minimum sample** | Same as J2 (needs spend variation). |
| **Limitations** | Only as good as the curve; noisy at low volume; assumes recent structure holds. |
| **When NOT to trust** | Flat spend history; post-edit; volatile auction. |

## J4 — Saturation / Spend-Response Curve fit quality

| Field | Value |
|---|---|
| **What it measures** | The fitted curve of results vs spend, plus its confidence (R²/fit diagnostics). |
| **Why it matters** | Every J2/J3 number is only trustworthy if the underlying curve fits; ship the confidence, not just the point. |
| **Decision it drives** | Whether to act on headroom/marginal numbers or say "insufficient data to advise scaling." |
| **Inputs** | daily/weekly spend↔result observations. |
| **Formula** | fit a diminishing-returns form (e.g. log/Hill saturation) → parameters + goodness-of-fit. **MODEL ESTIMATE**, RESEARCH-BACKED method (marketing saturation modeling). |
| **Source / class** | CALC/MODEL over Meta history (FETCH). |
| **Comparison window** | 30–90d; re-fit on schedule. |
| **Minimum sample** | Enough distinct spend levels/points — UNKNOWN / verify at build. |
| **Limitations** | Correlational, not causal (no experiment); creative fatigue and seasonality contaminate; overfit risk with few points. |
| **When NOT to trust** | Poor fit diagnostics; few points; known confounds active. Report as advisory, never as guaranteed. |

## J5 — Recommended Budget Step & Pace

| Field | Value |
|---|---|
| **What it measures** | The suggested size and cadence of the next budget change. |
| **Why it matters** | Too-big/too-fast steps re-trigger learning and waste; too-slow leaves money on the table. |
| **Decision it drives** | The exact budget edit AdBrain proposes (as a draft, human-approved). |
| **Inputs** | headroom (J2), marginal ROAS (J3), learning status (J1), fatigue (H). |
| **Formula** | step sized to stay within headroom and (ideally) avoid learning reset. The commonly cited **"raise ≤ ~20% every few days"** rule is **INDUSTRY BENCHMARK / folklore — verify at build; not a Meta guarantee.** AdBrain should prefer account-learned safe-step sizes over a hardcoded 20%. |
| **Source / class** | CALC/MODEL; the 20% heuristic INDUSTRY BENCHMARK (unverified as universal). |
| **Comparison window** | Re-evaluate after each step stabilizes. |
| **Minimum sample** | Wait for post-edit stabilization before the next step. |
| **Limitations** | The 20% number is not a documented Meta law; CBO/Advantage+ changes the mechanics; every edit risks learning reset. |
| **When NOT to trust** | Mid-learning; mid-fatigue; when the step exceeds modeled headroom. |

## J6 — Scale Readiness Score

| Field | Value |
|---|---|
| **What it measures** | 0–100 composite: is this ad set/campaign a good scale candidate *now*? |
| **Why it matters** | Ranks where the next dollar should go across the account. |
| **Decision it drives** | Which winners to fund, which to leave, which to fix first. |
| **Inputs** | fatigue state (H, must be 3/4), marginal ROAS ≥ floor (J3), headroom > 0 (J2), curve confidence (J4), concentration risk (I2), learning=active (J1). |
| **Formula** | gated weighted score — **MODEL ESTIMATE / tunable, not truth.** Illustrative gates+weights: |

| Input | Role | Default weight / gate |
|---|---|---|
| Fatigue state (H) | **Hard gate** | Must be PEAK/STABLE; FATIGUE/DECLINE/ZOMBIE → not scalable regardless of score |
| Marginal ROAS vs floor (J3) | Core | 0.35 |
| Headroom (J2) | Core | 0.30 |
| Curve confidence (J4) | Trust multiplier | 0.15 |
| Learning = active (J1) | Gate/penalty | 0.10 |
| Backup coverage (I5/I2) | Risk penalty | 0.10 |

| Field | Value |
|---|---|
| **Source / class** | CALC/MODEL over the above. |
| **Comparison window** | Re-scored daily. |
| **Limitations** | Inherits every sub-model's weakness; gates matter more than the score — a high score with a failed gate is **not** scalable. Weights are priors. |
| **When NOT to trust** | Any gate failing; low curve confidence; unconfirmed incrementality (would scale a ZOMBIE). |

## J7 — Days-to-Saturation Forecast

| Field | Value |
|---|---|
| **What it measures** | Estimated days until the current audience/creative hits saturation at the current/proposed spend. |
| **Why it matters** | Tells you how long a scale-up can run before you must expand audience or refresh creative. |
| **Decision it drives** | Pre-brief the next creative/audience *before* the winner saturates (feeds I white space + H). |
| **Inputs** | new-reach-ratio trend (H2), frequency trend (H1), fatigue slope (H6), addressable-audience-size estimate. |
| **Formula** | project saturation-signal trends forward to threshold. **MODEL ESTIMATE / FORECAST.** |
| **Source / class** | CALC/MODEL over Meta (FETCH) + audience-size estimate (INFER; Meta's audience size ranges are coarse). |
| **Comparison window** | forward projection off trailing 4–6 weeks. |
| **Limitations** | Forecast; audience-size inputs are coarse/estimated; assumes spend and structure hold; wide error bars. |
| **When NOT to trust** | Volatile trends; recent edits; small/lookalike audiences where size is poorly known. |

## J8 — Impression Share / Auction Coverage — **CANNOT-KNOW**

| Field | Value |
|---|---|
| **What it measures** | Share of available auctions won / lost to budget or rank (Google-style). |
| **Status** | **UNKNOWN / CANNOT-KNOW — Meta does not expose an impression-share metric.** Do not fabricate one. |
| **Decision it would drive** | "Are we budget-capped vs the whole addressable auction?" |
| **AdBrain substitute** | Infer budget-capping indirectly (delivery flat-lining at cap, marginal ROAS still ≥ floor at cap) as an **INFERENCE**, explicitly labeled — never presented as impression share. |
| **When NOT to trust** | Always treat any "impression share"-like figure as unavailable on Meta; the inferred substitute is directional only. |

---

## Cross-category decision map (how H, I, J compose)

| Situation | Signals | Next action |
|---|---|---|
| Winner still efficient, headroom + | H=PEAK/STABLE, J6 high, gates pass | Scale (J5 step), pre-brief backup (J7→I) |
| Efficiency slipping, creative-led | H=CREATIVE FATIGUE (H3/H4 down, H2 ok) | Refresh creative in that cell (I5) |
| Efficiency slipping, audience-led | H=AUDIENCE SATURATION (H2 down, freq up) | Expand/rotate audience; don't just refresh |
| "Good" ROAS, no lift | H=ZOMBIE (needs EXTERNAL lift test) | Do not scale; run incrementality test / reallocate |
| Portfolio fragile | I2 high concentration, I5 low coverage | Brief white-space cells (I4) before the winner fatigues |
| Bleeding | H=TERMINAL DECLINE | Pause/kill |

---

## Open items to reconcile at build (do not ship as truth)

1. **Every threshold/half-life/benchmark** here marked UNKNOWN/tunable → learn per account; never hardcode as truth.
2. **All Meta field names** (`frequency`, `cpm`, `purchase_roas`, `quality_ranking`, video 3-sec view field, negative-feedback fields, learning-phase status) → verify against `02-meta-data-mapping.md` and the live Marketing API version at build.
3. **The ~50-conversions/7-day learning figure** → confirm current Meta-documented value.
4. **The ~20% budget-step rule** → INDUSTRY BENCHMARK/folklore; prefer account-learned safe steps.
5. **Incrementality (state 8 / ZOMBIE)** → requires an EXTERNAL lift test or MMM; without it, it is an INFERENCE, flagged.
6. **All composite weights** (H8, I6, J6) → priors to be tuned; always expose component breakdowns, never the single number alone.
7. **Creative tagging (I0)** accuracy is a MODEL/INFER quality gate; low tag confidence invalidates all of Category I.
