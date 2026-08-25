# [12] Competitive Intelligence Framework

> **Artifact 12 of 28.** Persona: senior Meta media buyer + creative strategist + data scientist at $100M/mo.
> This framework answers **"what should we do next?"** by reading competitor *creative* — not competitor *performance*.
> Every signal below names the decision it drives, carries its data-mapping class and fact-label, and is built on the
> Category-L metric dictionary (01d, L1–L7). **A competitor signal that does not change one of our decisions is cut.**

---

## 0. The three hard rules (this framework is built to obey them)

Grounded directly in `brief.md` and `02-meta-data-mapping.md`. These are not caveats bolted on at the end — they are the
design constraints that shape every score below.

| # | Rule | Source | How this framework enforces it |
|---|---|---|---|
| **R1** | **Active ≠ winning.** A running ad proves the ad *exists and is delivered*, not that it *performs*. | `02` competitor row ("active != winning"); 01d §L | Longevity (§5) is the *only* performance proxy and is labelled **INFERENCE**, never fact. No signal claims a competitor ad "works". |
| **R2** | **Competitor economics = CANNOT-KNOW.** Spend, impressions, CPA, ROAS, revenue for commercial advertisers are not reliably knowable. | `02` ("competitor spend/results → CANNOT-KNOW"); 01d §L7 | §6 quarantines economics as **UNKNOWN**. No score consumes a guessed competitor spend. Third-party "spend estimates" are labelled **MODEL ESTIMATE (third-party)**, never fact, and never drive a budget decision. |
| **R3** | **Competitor data generates HYPOTHESES, not conclusions.** | `brief.md` ("generates HYPOTHESES not conclusions") | Every output of this framework is a *testable hypothesis for our own account* (§8), routed to a test in our creative pipeline — never an instruction to copy, and never a conclusion about the market. |

**Data-mapping class for the entire framework:** `EXTERNAL` (Meta Ad Library + ScrapeCreators — a system *other than* the
Meta Insights API, per `02`). Narrow carve-out: political/social-issue ads expose spend & impression **ranges** and EU/DSA
exposes reach — treat as exceptions, not the base case (§6). Everything a classifier produces on top of Ad Library creative
is `EXTERNAL`+`INFER`.

---

## 1. What this framework is for (decision gate)

Competitive intelligence in AdBrain exists to change five decisions, and only these five. Each maps to signals defined below.

| Decision it must change | Signals that drive it | Section |
|---|---|---|
| **D1. Triage** — which competitors to investigate now vs. ignore | Competitor Activity Index (§4) | §4 |
| **D2. What to study** — which competitor *creatives/angles* to reverse-engineer and adapt | Creative Persistence Score (§5), Longevity-Weighted Theme Signal (§7) | §5, §7 |
| **D3. Angle & offer strategy** — which angle to test next; whether to enter a promo war or avoid it | Angle/Offer Theme Prevalence (§7), Promo-Intensity Signal (§7) | §7 |
| **D4. Format strategy** — where to bet creative production (video/image/carousel) | Format Bet Index (§4) | §4 |
| **D5. Market defence** — react to a competitor entering our geo/market | Market-Entry Signal (§7) | §7 |

**Explicitly NOT a decision this framework drives:** anything that requires competitor spend, budget, CPA, ROAS, or
share-of-voice for commercial advertisers (§6, R2). Those are surfaced only as **UNKNOWN**, marked *advanced/vanity — not
primary*, so a media buyer is never tempted to allocate our budget against a fabricated competitor number.

---

## 2. Data sources & source class (traced to `02`)

| Source | What it gives | Class (per `02`) | Fact-label of the raw value | Refresh model |
|---|---|---|---|---|
| **Meta Ad Library API** | Ad existence, "started running" date, creative (image/video/text), format, targeting country, page | `EXTERNAL` | OFFICIAL PLATFORM FACT (Meta authors it) *but class `EXTERNAL`* — it is not the Insights API | Snapshot = "now"; **we must store dated snapshots** to derive any trend (L2/L3) |
| **ScrapeCreators (or equivalent)** | Same surface, sometimes richer creative capture / historical coverage | `EXTERNAL` | OFFICIAL PLATFORM FACT for what it faithfully mirrors; UNKNOWN where it interpolates — **verify at build** | Scheduled crawl → our snapshot store |
| **AdBrain classifiers (NLP/vision)** over the above | Hook, angle, persona, offer, format labels, embeddings | `EXTERNAL`+`INFER` | INFERENCE (model output over OFFICIAL creative) | Runs per new snapshot |
| **Ad Library political/social-issue view** | Spend & impression **ranges** (political/issue ads only) | `EXTERNAL` | OFFICIAL PLATFORM FACT (range) — **exception, not base case** | As published |
| **EU/DSA transparency** | Reach data (EU) | `EXTERNAL` | OFFICIAL PLATFORM FACT (EU only) — **verify Aug-2026 API fields at build** | As published |
| **Commercial competitor spend / impressions / ROAS** | — | `CANNOT-KNOW` | **UNKNOWN** — never fabricate (R2) | n/a |

> **Snapshot mandate.** The Ad Library returns a *point-in-time* view. Longevity, cadence, theme-trend, and market-entry
> signals are all **derived from our own dated snapshot history**, not from the API directly. No snapshot history → those
> signals are `INSUFFICIENT DATA`, not zero. This is the single biggest build dependency for §5/§7 and is flagged in §11.

---

## 3. What we extract per competitor creative (the unit of analysis)

Reuses the creative fingerprint vocabulary from `brief.md`/[04][05], applied to *competitor* creative. Every attribute below
is **INFERENCE** (classifier output over OFFICIAL Ad Library creative) unless noted; each ships with a per-label model
confidence, and low-confidence labels are suppressed rather than guessed.

| Attribute | What it is | Class | Label | Feeds |
|---|---|---|---|---|
| Format | video / image / carousel / DCT | `EXTERNAL` | OFFICIAL (Ad Library metadata) | Format Bet Index (§4) |
| Days active / longevity | today − start date, across our snapshots | `EXTERNAL`+`CALC` | OFFICIAL (date) → INFERENCE (performance) | Persistence Score (§5) |
| Hook | opening line / first-frame device | `EXTERNAL`+`INFER` | INFERENCE | Theme signals (§7), white-space [13] |
| Angle | problem/desire framing (e.g. time-saving, status, fear) | `EXTERNAL`+`INFER` | INFERENCE | §7, [13] |
| Persona | who the creative speaks to | `EXTERNAL`+`INFER` | INFERENCE | §7, [13] |
| Offer | discount / BOGO / free-trial / bundle / none | `EXTERNAL`+`INFER` | INFERENCE | Promo-Intensity (§7) |
| Value prop / message | the core promise | `EXTERNAL`+`INFER` | INFERENCE | §7, [13] |
| Landing destination | URL/domain where shown | `EXTERNAL` | OFFICIAL where exposed; else UNKNOWN | §7 (offer↔LP continuity, hypothesis only) |

Stored once per competitor creative as a **competitor fingerprint** (mirror of [05], EXTERNAL provenance stamped) so §5/§7
aggregate without re-classifying.

---

## 4. Activity & format signals (Decision D1, D4)

### 4.1 Competitor Activity Index — *triage which competitors to investigate*

| Field | Detail |
|---|---|
| **Decision (gate)** | **D1.** Investigate a competitor's ramp (defend / steal share) vs. treat as dormant. Triage only — **never** a spend signal. |
| **Level** | Competitor (page). |
| **Definition** | A composite that flags *changes* in a competitor's visible advertising activity. |
| **Inputs** | Active ad count (01d **L1**), new-ads-per-week cadence (01d **L3**), Δ vs. our prior snapshots. |
| **Formula** | `Activity Index = w1·z(active_count) + w2·z(cadence) + w3·z(Δcount_vs_prior)`, z-scored within a comparable competitor set. |
| **WEIGHTS + reason** | `w1=0.25` (level = weak; count is inflated by DCT testers), `w2=0.35` (cadence = testing maturity, more informative than a static count), `w3=0.40` (the **change** is what triggers action — a ramp/pullback is the decision trigger, so it carries the most weight). **Weights are UNKNOWN starting values — calibrate at build** against observed cases where a ramp actually preceded a competitive move; do not present as validated. |
| **Data source + class** | Ad Library counts & dates over stored snapshots → `EXTERNAL`+`CALC`. |
| **Fact-label** | INTERNAL CALCULATION (DERIVED) over OFFICIAL PLATFORM FACTs. |
| **Time window** | Current snapshot + trend vs. prior snapshots (needs ≥ several weeks of history for cadence/Δ). |
| **Minimum sample** | Cadence/Δ meaningless below **UNKNOWN — calibrate** weeks of snapshot history; small active counts are noisy. Suppress below floor. |
| **Confidence** | Low–medium. It is a *census of visible ads*, not a measurement of investment. |
| **Limitations** | Count ≠ spend or reach; near-duplicate DCT variants inflate it; one big-budget ad can outperform 50 small ones. |
| **When NOT to trust** | Read as a budget proxy (R2); comparing a heavy-DCT tester to a low-variant advertiser as if counts were comparable; snapshot history short/gappy. |

### 4.2 Format Bet Index — *where to prioritise creative production*

| Field | Detail |
|---|---|
| **Decision (gate)** | **D4.** Format prioritisation in our creative brief; spotting a format the field is crowding into (or vacating). |
| **Level** | Competitor, aggregated to competitor-set. |
| **Definition** | Share of a competitor's (and the set's) active ads by format. |
| **Inputs** | Format per creative (01d **L4**, §3). |
| **Formula** | `% active ads by format`, per competitor and set-wide; trend vs. prior snapshots. |
| **WEIGHTS + reason** | Unweighted share (each active ad counts once). **Deliberately NOT count-weighted by presumed budget** — that would smuggle in `CANNOT-KNOW` spend (R2). Rationale: honest count share beats a fabricated spend-weighted share. |
| **Data source + class** | Ad Library creative metadata → `EXTERNAL`+`CALC`. |
| **Fact-label** | INTERNAL CALCULATION (DERIVED). |
| **Time window** | Snapshot + trend. |
| **Minimum sample** | Enough active ads per competitor that shares aren't dominated by 1–2 ads (**UNKNOWN floor — calibrate**). |
| **Confidence** | Medium for the *mix*; **zero** for any spend implication. |
| **Limitations** | Mix of *counts* ≠ mix of *budget*; placement/platform data incomplete for commercial ads. |
| **When NOT to trust** | Inferring spend weighting from count weighting; treating a format the set ignores as automatically "white space" without our own test (that's a hypothesis, §8, → [13]). |

---

## 5. The performance proxy: Creative Persistence Score (Decision D2)

> **This is where R1 lives.** Longevity is the *only* signal that gestures at "this works for them", and it is **INFERENCE**,
> not proof. Advertisers rarely keep losers live for months — but "rarely" is not "never", and always-on brand ads, neglected
> live ads, and relaunches all corrupt the signal. So longevity ranks *what to study*, never *what to copy*.

### 5.1 Creative Persistence Score

| Field | Detail |
|---|---|
| **Decision (gate)** | **D2.** Which competitor creatives/angles to reverse-engineer and adapt into *our* test queue — ranked by presumed staying power. |
| **Level** | Competitor creative (also rolls up to angle/persona in §7). |
| **Definition** | A longevity-based rank of how likely a competitor creative is to be a genuine performer for them (a study-priority, not a verdict). |
| **Inputs** | Days active (01d **L2** = today − Ad-Library start date, over our snapshots); relaunch/dedup flag; brand-vs-DR classification of the creative (§3 angle/offer). |
| **Formula** | `Persistence = w1·norm(days_active) + w2·survived_expected_test_window − w3·brand_alwayson_penalty`, where `survived_expected_test_window` = 1 if the ad outlived a normal test-and-kill window, else 0. |
| **WEIGHTS + reason** | `w1=0.55` (raw longevity is the core proxy), `w2=0.30` (crossing a *test-kill* threshold is more meaningful than one extra day — it's the discontinuity that implies a deliberate keep decision), `w3=0.15` (down-weight ads that run long *by design* — brand/awareness/always-on — because their longevity says nothing about DR performance). **All weights + the "expected test window" are UNKNOWN — calibrate at build** per vertical; the test-kill window is a per-vertical learned value, **never a hardcoded "14 days" presented as truth** (R1, brief "no arbitrary thresholds"). |
| **Data source + class** | Ad Library start date (`EXTERNAL`, OFFICIAL) → days-active (`CALC`) → performance link (`INFER`). |
| **Fact-label** | OFFICIAL PLATFORM FACT (the start date) → INTERNAL CALCULATION (days active) → **INFERENCE** (the "it works" implication). The score itself is INFERENCE. |
| **Time window** | Rolling; judged within a competitor set and vertical. |
| **Minimum sample** | Judge *patterns across many ads*, never a single long-runner (one long-runner = possible inertia). Meaningful only with **UNKNOWN — calibrate** weeks of continuous snapshot coverage (gaps hide kills/relaunches). |
| **Confidence** | Low–medium, and explicitly capped: this can never exceed INFERENCE confidence because there is no observed performance behind it (R1). |
| **Limitations** | Long-running ≠ profitable (brand, always-on, or simple neglect); relaunches reset the clock and *understate* true longevity; date granularity varies; a paused-then-resumed ad looks new. |
| **When NOT to trust** | Treated as proof of performance (R1); applied to obvious brand/awareness ads; snapshot history gappy (a kill you didn't observe reads as "still running"); a single creative used to draw a market conclusion (R3). |

**Counter-explanation (required, per brief's explainability engine).** Every high-Persistence creative is surfaced with the
built-in counter: *"This may be long-running because it is a brand/always-on ad, a neglected live ad, or a relaunch — not
because it converts. We cannot see their results (R2). Treat as a hypothesis to test (R3)."*

---

## 6. Competitor economics — the CANNOT-KNOW wall (R2)

| Field | Detail |
|---|---|
| **Decision it drives** | **None, for commercial competitors.** Marked *advanced/vanity — not primary*. Naming it explicitly is what stops fabrication (`02`, 01d §L7). |
| **Level** | Competitor. |
| **Class** | `CANNOT-KNOW` (commercial) — matches `02` "competitor spend/results → CANNOT-KNOW". Narrow `EXTERNAL`-range exception below. |
| **What is knowable** | Political/social-issue ads: spend & impression **ranges** (OFFICIAL PLATFORM FACT, range). EU/DSA: reach data (OFFICIAL, EU only) — **verify exact Aug-2026 API fields at build**. |
| **What is UNKNOWN** | Commercial spend, impressions, CPM, CPC, CPA, CVR, ROAS, revenue, budget, share-of-voice (impression-based). All → **UNKNOWN**, never a fact, never an input to any other score. |
| **Third-party "spend estimates"** | If a third-party estimator is integrated, its output is **MODEL ESTIMATE (third-party)** — surfaced with that label, error bars, and a "not observed" flag. **Never** promoted to fact; **never** allowed to drive our budget (R2). |
| **When NOT to trust** | *Any* commercial-competitor spend/ROAS/SoV figure presented as known; a third-party estimate quoted as truth; a count-based "share of voice" implying impression share. |

**Cut from this framework (decision-gate discipline, named so it's a deliberate exclusion, not an oversight):**
- **Commercial "Share of Voice" by impressions** → `CANNOT-KNOW`. A *count-based* directional proxy may be shown only if
  labelled **INTERNAL CALCULATION (DERIVED, count-based proxy)** and marked *advanced/vanity — not primary* (count ≠ impressions).
- **Competitor CTR / CPA / ROAS** for commercial advertisers → `CANNOT-KNOW`; cut from every primary surface.
- **"Copy this winning ad"** as an instruction → violates R1+R3; the only sanctioned output is a *hypothesis to test* (§8).

---

## 7. Angle, offer, market signals (Decisions D3, D5)

### 7.1 Angle / Offer Theme Prevalence

| Field | Detail |
|---|---|
| **Decision (gate)** | **D3.** Which angle/hook to test next; where the market's messaging is converging (crowded) vs. where it isn't (white space → [13]). |
| **Level** | Competitor-set, aggregated across creatives. |
| **Definition** | Frequency distribution of hooks, angles, personas, and value props across the competitor set's active creative. |
| **Inputs** | Classifier labels (01d **L5**, §3) per creative. |
| **Formula** | `Prevalence(theme) = active creatives carrying theme ÷ total active creatives` (set-wide and per competitor); trend vs. prior snapshots. |
| **WEIGHTS + reason** | Unweighted by default (each active creative = 1 vote). **NOT weighted by longevity here** — §7.3 does that deliberately as a separate signal, so raw "what they're *saying*" stays distinct from "what *persists*". Keeping them separate prevents R1 leakage into the prevalence count. |
| **Data source + class** | Ad Library creative text/imagery + AdBrain classifier → `EXTERNAL`+`INFER`. |
| **Fact-label** | INFERENCE (model output over OFFICIAL creative text). |
| **Time window** | Snapshot + trend. |
| **Minimum sample** | Enough creatives per theme that prevalence is stable, not anecdotal (**UNKNOWN floor — calibrate**); themes below floor shown as "emerging/insufficient", not ranked. |
| **Confidence** | Medium; bounded by classifier accuracy. |
| **Limitations** | Classifier error (sarcasm, brand voice, multi-angle ads); **prevalence ≠ performance** — no spend behind any theme (R1); popular ≠ effective. |
| **When NOT to trust** | Treated as "what works" rather than "what they're saying" (R1); small creative counts; classifier confidence low. |

### 7.2 Promo-Intensity Signal

| Field | Detail |
|---|---|
| **Decision (gate)** | **D3.** Whether to match a promo war or hold margin and avoid it. |
| **Definition** | Share of competitor active creative carrying a discount/BOGO/free-trial offer, and its trend (a rising share = the field is discounting). |
| **Inputs** | Offer label (§3, 01d L5); trend across snapshots. |
| **Formula** | `Promo-Intensity = active creatives with an offer ÷ total active creatives`; flag Δ vs. prior snapshots. |
| **WEIGHTS + reason** | Unweighted share. Rationale: we can see *whether* they promote, not *how deep the real economics are* (R2), so weighting by discount depth would over-claim. |
| **Data source + class** | `EXTERNAL`+`INFER`. |
| **Fact-label** | INFERENCE. |
| **Time window** | Snapshot + trend; seasonal overlay required (BFCM etc.). |
| **Minimum sample** | As §7.1. |
| **Confidence** | Medium. |
| **Limitations** | Offer *stated* ≠ offer *economics* (R2); seasonal promos look like a "war"; a stated discount may be a loss-leader we can't cost. |
| **When NOT to trust** | Reading a seasonal spike as a strategic shift; assuming we can profitably match a discount whose margin we can't see (R2). |

### 7.3 Longevity-Weighted Theme Signal — *the best hypotheses*

| Field | Detail |
|---|---|
| **Decision (gate)** | **D2 + D3.** Rank angles/hooks that are **both persistent (§5) and prevalent (§7.1)** — the strongest candidates to adapt and test. This is the framework's headline "what to study next" output. |
| **Level** | Theme (angle/hook/persona), across the competitor set. |
| **Definition** | Themes that survive (high Persistence) *and* recur (high Prevalence) are the least-weak evidence a message is doing real work for the field. |
| **Inputs** | Persistence Score (§5) per creative; Theme Prevalence (§7.1). |
| **Formula** | `ThemeSignal(theme) = w1·mean_persistence(creatives with theme) + w2·prevalence(theme)`. |
| **WEIGHTS + reason** | `w1=0.60` (persistence carries more evidentiary weight — a theme kept live is a stronger tell than one merely launched), `w2=0.40` (prevalence adds breadth: many advertisers converging independently is corroboration). **UNKNOWN starting weights — calibrate at build**; the whole score is capped at INFERENCE confidence because both inputs are (R1). |
| **Data source + class** | Composite of §5 (`EXTERNAL`+`CALC`+`INFER`) and §7.1 (`EXTERNAL`+`INFER`) → `INFER`. |
| **Fact-label** | **INFERENCE** (compounds two inference inputs). |
| **Time window** | Snapshot + trend; needs the same snapshot-history depth as §5. |
| **Minimum sample** | Only rank themes clearing both §5 and §7.1 floors; others flagged "insufficient", never silently ranked. |
| **Confidence** | Low–medium, capped; compounds §5 and §7.1 error — state this. |
| **Limitations** | Two stacked inferences; correlation across advertisers can be herd behaviour, not proven performance (R1); no economics behind any of it (R2). |
| **When NOT to trust** | Presented as "proven winning angles"; used to justify copying rather than testing (R3); thin snapshot history. |

### 7.4 Market-Entry / New-Geo Signal (Decision D5)

| Field | Detail |
|---|---|
| **Decision (gate)** | **D5.** Defensive spend / market-entry timing when a competitor starts targeting our geo (or a geo worth following them into). |
| **Level** | Competitor. |
| **Definition** | A country appearing in a competitor's active-ad targeting that was absent in prior snapshots. |
| **Inputs** | Ad Library targeting-country field (01d **L6**) over our snapshots. |
| **Formula** | New country in active-ad targeting vs. prior snapshot, confirmed across **multiple** ads before flagging an "entry". |
| **WEIGHTS + reason** | Confirmation-count gated (single-ad appearances suppressed) rather than weighted — rationale: one stray or test-buy ad must not raise a false alarm; requiring corroboration is the honest guard. Confirmation count = **UNKNOWN — calibrate**. |
| **Data source + class** | Ad Library country data over snapshots → `EXTERNAL`+`INFER`. |
| **Fact-label** | INFERENCE (about intent). |
| **Time window** | Snapshot-over-snapshot. |
| **Minimum sample** | Multiple corroborating ads over ≥2 snapshots. |
| **Confidence** | Low–medium. |
| **Limitations** | "Country shown" = *where ads appear*, not necessarily a strategic launch; test buys mimic entries; EU-only enhanced data can be mistaken for global behaviour. |
| **When NOT to trust** | One stray ad; EU/DSA-enhanced data read as global; short/gappy snapshot history. |

---

## 8. From signal to hypothesis (R3 — the output contract)

Nothing in §4–§7 is an instruction. Every surfaced signal is converted into a **testable hypothesis for our own account**,
routed into the creative pipeline and the rule/recommendation engines ([15][16]), where it is proven or killed on *our* data.

**Hypothesis object (what this framework emits):**

| Field | Content | Example |
|---|---|---|
| `observation` | The competitor fact + its label | "3 competitors run a 'save 2 hours a day' time-saving angle; mean Persistence high (INFERENCE)." |
| `class + label` | Provenance stamp | `EXTERNAL`+`INFER`; INFERENCE; economics UNKNOWN. |
| `hypothesis` | A claim about **our** account, testable | "A time-saving hook will beat our current status-led hook for persona X." |
| `why_it_might_be_wrong` | The mandatory counter-explanation | "Their longevity may be brand/always-on (R1); we can't see their economics (R2); herd behaviour ≠ proof." |
| `test` | The experiment on our account | "Produce 2 time-saving variants; A/B vs. control; judge on N9 significance." |
| `decision_if_true / if_false` | The action either way | "Scale the angle into the brief / retire the hypothesis and log the learning." |
| `confidence` | Capped at INFERENCE | Low–medium; never OFFICIAL. |

**Handoff to White-Space [13]:** §7.1 prevalence (what the field crowds into) + §5 persistence feed the competitor axis of the
white-space map. AdBrain's own creative universe vs. the competitor universe → *unoccupied* combinations become white-space
hypotheses. Crucially, "unoccupied by competitors" is itself only a hypothesis (the field may have tested and abandoned it —
which our snapshot history can sometimes show, and often can't), never a conclusion (R3).

---

## 9. Explainability & confidence (per brief's engines)

Every competitive signal, when surfaced, answers: **what** (the signal), **why it matters** (the decision it drives),
**data** (Ad Library / ScrapeCreators snapshot + date + class), **formula** (as above), **benchmark** (there is **no external
competitive benchmark** — mark UNKNOWN, do not fabricate), **rule** (the trigger threshold, learned/UNKNOWN not hardcoded),
**counter-explanation** (R1/R2/R3 caveat), **confidence** (capped at INFERENCE — no competitive signal can be OFFICIAL about
performance), **action** (the hypothesis + test in §8).

**Confidence inputs (feeds [14]):** snapshot-history depth & continuity (gaps → down-weight), creative-count per competitor
(thin → suppress), classifier confidence (low → suppress the label), and **always** the hard cap: no performance claim exceeds
INFERENCE because competitor results are `CANNOT-KNOW`.

---

## 10. Adversarial gates (AUTOPSY + KILLCRITIC, per brief)

| Failure the gate hunts | Where it bites here | Mitigation built in |
|---|---|---|
| **Survivorship bias** | Persistence (§5) sees only ads *still up* — killed ads vanished from view | Judge patterns across many ads; store snapshots so kills are observed, not inferred; counter-explanation on every §5 output |
| **"Active = winning" fallacy** | The entire framework's temptation | R1 enforced structurally; longevity capped at INFERENCE; no signal claims performance |
| **Fabricated economics** | Any spend/ROAS/SoV number | R2: §6 quarantine; third-party estimates labelled MODEL ESTIMATE; economics never an input |
| **Small-sample / anecdote** | One long-runner or a 2-ad theme drives a call | Minimum-sample floors (all UNKNOWN → calibrate); below-floor = "insufficient", not ranked |
| **Seasonality mistaken for strategy** | Promo-Intensity spike (§7.2), cadence spike (§4) | Seasonal overlay required before flagging a "shift" |
| **Snapshot gaps read as continuity** | §5 longevity, §7.4 entry | Continuity check; gappy history → down-weight/suppress |
| **Classifier error as fact** | §3, §7 labels | Per-label confidence; low-confidence labels suppressed; labels tagged INFERENCE |
| **Vanity metric on the primary surface** | Active count, SoV proxy | Decision gate (§1): count-based signals are triage-only or *advanced — not primary* |
| **Copying instead of testing** | Any "adapt this" output | R3: every output is a hypothesis routed to a test, never an instruction |

---

## 11. Build-time reconciliation & open items

1. **DONE:** every class reconciled to `02` — framework class = `EXTERNAL` (Ad Library/ScrapeCreators); commercial economics =
   `CANNOT-KNOW`; classifier outputs = `EXTERNAL`+`INFER`. R1/R2/R3 enforced structurally, not as footnotes.
2. **OPEN — verify at build (rule 5, do not fabricate):**
   - Exact Aug-2026 Meta Ad Library API surface: fields, rate limits, historical coverage, whether "started running" dates and
     format metadata are reliably exposed for commercial ads.
   - ScrapeCreators (or chosen provider) coverage, historical depth, and where it interpolates vs. mirrors.
   - EU/DSA reach fields and political/social-issue spend-range fields available via API (§6).
3. **OPEN — the snapshot store is a hard dependency.** §5/§7.3/§7.4 and all trends require our own **dated snapshot history**.
   Without it, those signals are `INSUFFICIENT DATA`, not zero. Schedule the crawl → warehouse ([24]) day-wise, mirroring the
   snapshot mandate `02` sets for our own data.
4. **OPEN — every threshold is UNKNOWN until calibrated per vertical (rule 5, brief "no arbitrary thresholds"):** all §4–§7
   weights, the "expected test-kill window" (§5), minimum creative/snapshot counts, and the market-entry confirmation count.
   Ship them labelled *calibrate-at-build*, never as validated constants.
5. **No competitive benchmark exists** for "normal" longevity, cadence, or theme prevalence. Mark **UNKNOWN / benchmark
   unavailable** rather than inventing one; a per-vertical baseline may be *learned* from our own snapshot corpus over time and
   labelled INTERNAL CALCULATION when it is.

---

## 12. One-line honesty summary

This framework reads competitor **creative** (EXTERNAL, OFFICIAL where Meta authors it), infers **persistence** as a capped
proxy for "might be working" (INFERENCE, because **active ≠ winning**), refuses to guess competitor **economics** (CANNOT-KNOW),
and converts everything into **hypotheses we test on our own account** (never conclusions) — so a $100M/mo media buyer gets
sharper *questions* to test, and is never handed a fabricated competitor number to bet budget on.
