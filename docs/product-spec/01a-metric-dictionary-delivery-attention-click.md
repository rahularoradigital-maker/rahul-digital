# 01a — Master Metric Dictionary: Delivery, Attention, Engagement, Click Quality

**Artifact:** 01a of 28 (AdBrain master product spec)
**Scope:** Category A DELIVERY · Category B ATTENTION · Category C ENGAGEMENT · Category D CLICK QUALITY
**Persona lens:** senior Meta media buyer + creative strategist + data scientist at $100M/mo scale
**Question it answers:** "what should we do next?" — not "how did ads perform?"
**Last edited:** 2026-08-25 · **Status:** DRAFT — pending foundation-doc reconciliation (see Provenance)

---

## 0. How to read this dictionary

Every metric below is documented against **all 10 discipline questions** (measures / matters / decision / inputs / formula / source / window / min sample / limitations / when-NOT-to-trust), and carries three headers:

- **LEVEL** — the object the metric is native to: `account` / `campaign` / `adset` / `ad` / `creative`. A metric can be *rolled up*, but it has one native level; aggregating a rate metric upward requires re-computing from summed numerators/denominators, never averaging the rates.
- **FACT-LABEL** — provenance of the *value*: `OFFICIAL PLATFORM FACT` / `INTERNAL CALCULATION (DERIVED)` / `RESEARCH-BACKED` / `INDUSTRY BENCHMARK` / `MODEL ESTIMATE` / `INFERENCE` / `UNKNOWN`.
- **MAPPING CLASS** — from `02-meta-data-mapping.md`: `FETCH` (Meta returns it directly) / `CALC` (we compute from FETCH fields) / `INFER` (modelled/probabilistic) / `EXTERNAL` (needs non-Meta data) / `CANNOT-KNOW` (structurally unavailable).

> **The core distinction this document enforces:** a metric Meta *returns as a field* (e.g. `cpm`, `ctr`, `frequency`) is an OFFICIAL PLATFORM FACT even though it is arithmetically a ratio — Meta computes it server-side and stamps it. A metric **we** assemble from two Meta fields (e.g. hook rate = 3-sec plays ÷ impressions) is an INTERNAL CALCULATION (DERIVED) and must **never** be shown to a buyer as a Meta field. Mislabelling here is the single most common integrity failure in ads tooling. See §B (Attention) for the worst offenders.

**Benchmark honesty:** where a "good" threshold is not verifiable from a primary source as of Aug 2026, the cell reads `UNKNOWN — verify at build` or `establish account baseline`. AdBrain never ships an arbitrary threshold dressed as truth. The correct default comparator is almost always the **account's own trailing baseline**, not an internet benchmark.

**Field-name convention:** Meta Marketing API `insights` field names are shown in `monospace`. API field names drift between Graph API versions; every `FETCH` field is flagged `verify field name at build` because the exact string (and whether it is a top-level field or an entry inside the `actions`/`video_*_watched_actions` arrays) depends on the pinned API version.

---

## Provenance & open dependencies (read before trusting cross-refs)

At authoring time the three named foundation files — `docs/product-spec/brief.md`, `00-master-plan.md`, `02-meta-data-mapping.md` — **were not present in the workspace**. This artifact was written from the discipline rules carried in the authoring brief plus primary Meta-platform knowledge. Consequences:

| Dependency | Status | Action at build |
|---|---|---|
| Mapping-class taxonomy (FETCH/CALC/INFER/EXTERNAL/CANNOT-KNOW) | Used as defined in brief | Reconcile exact class per field against `02-meta-data-mapping.md` |
| Exact Meta API field strings & API version | Stated from knowledge, flagged `verify field name at build` | Pin to the API version in `02` and re-verify each field |
| Numeric benchmarks | Deliberately **not** asserted | Fill from account baseline or a cited primary source |
| Metric-ID scheme (A1, B2 …) | Local to this file | Align with the master metric registry if one exists |

All `verify at build` flags are load-bearing, not hedging.

---
---

# CATEGORY A — DELIVERY

*What the auction did with our money: how many people, how often, at what unit cost. Delivery metrics answer "is the machine even shipping our ads to fresh humans efficiently?" — the precondition for every downstream metric being meaningful.*

## A1 — Impressions

**LEVEL:** ad (native) · rolls up to adset/campaign/account · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`impressions`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Number of times an ad entered a person's screen (rendered), including repeat views to the same person. |
| 2 | Why it matters | The universal denominator. Nearly every rate metric (CTR, hook rate, CPM) divides by it, so its integrity gates everything downstream. |
| 3 | Decision it drives | Whether a creative has had *enough exposure to be judged at all* (sample-size gate). Below the impression floor, "kill/scale" decisions are noise. |
| 4 | Inputs | Ad serve events (render-counted, not load-counted). |
| 5 | Formula | Direct count — no formula. |
| 6 | Source | `impressions` — Meta returns directly. OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Whatever the analysis window is; impressions are additive across days, so any window sums cleanly. |
| 8 | Min sample size | N/A (it *is* the sample). It sets the floor for others — see each rate metric. |
| 9 | Limitations | Counts renders, not attention or even a full viewable render. One human = many impressions. Not deduplicated (that's Reach). |
| 10 | When NOT to trust | During active delivery an in-flight day undercounts; very fresh data (last 24–72h) is subject to Meta restatement. Cross-account comparison of raw impressions is meaningless without normalising by spend. |

---

## A2 — Reach

**LEVEL:** adset (native — dedup is bounded by the delivery object) · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`reach`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Number of **unique** people who saw the ad at least once in the window. |
| 2 | Why it matters | Distinguishes "reached many people once" from "hammered a few repeatedly." The unique-audience denominator for frequency and for incrementality thinking. |
| 3 | Decision it drives | Audience-expansion vs saturation: if reach plateaus while spend rises, the adset has exhausted its addressable pool → broaden targeting, raise budget cap, or accept rising frequency. |
| 4 | Inputs | Deduplicated user-level impression events within the window. |
| 5 | Formula | Direct count (Meta-side dedup). |
| 6 | Source | `reach` — OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Window-bound and **non-additive**: reach for Jan + reach for Feb ≠ reach for Jan–Feb (same person can appear in both). Always pull reach for the exact window you report. |
| 8 | Min sample size | N/A. |
| 9 | Limitations | Non-additive across time and across adsets (a person in two adsets is double-counted at campaign roll-up unless Meta dedups at that level). Estimated at very small numbers. |
| 10 | When NOT to trust | Never sum it across windows or objects. Do not compare reach across audiences of different sizes without normalising to reach/target-pool. |

---

## A3 — Frequency

**LEVEL:** adset (native) · **FACT-LABEL:** OFFICIAL PLATFORM FACT (Meta returns the field, though it equals impressions ÷ reach) · **MAPPING CLASS:** FETCH (`frequency`) — also reproducible as CALC

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Average number of times each reached person saw the ad in the window. |
| 2 | Why it matters | The primary **creative-fatigue and audience-saturation** signal. Rising frequency with falling CTR/rising CPM is the classic fatigue fingerprint. |
| 3 | Decision it drives | Refresh creative / expand audience / cap frequency. This is one of AdBrain's highest-value "what next" triggers. |
| 4 | Inputs | Impressions, Reach. |
| 5 | Formula | `frequency = impressions ÷ reach` (Meta returns it pre-computed). |
| 6 | Source | `frequency` — OFFICIAL PLATFORM FACT / FETCH. *If reconstructed by us it becomes DERIVED — prefer the returned field.* |
| 7 | Comparison window | Must match the reach window exactly; because reach is non-additive, **frequency is non-additive too** — recompute per window from that window's impressions and reach. |
| 8 | Min sample size | Interpret only once reach is large enough to be stable (rule of thumb `reach ≥ ~1,000`; INTERNAL CALCULATION — statistical convention, not a Meta fact). |
| 9 | Limitations | An *average* — hides distribution. Frequency 3 can mean "everyone saw it 3×" or "most saw it once, a tail saw it 15×." The tail is what actually fatigues. Distribution ("frequency distribution") is a separate, richer cut — mark `verify availability at build`. |
| 10 | When NOT to trust | As a single number for a fatigue decision without the distribution and without pairing it with a *trend* in CTR/CPM. A high frequency on a tiny retargeting pool is expected, not a problem. The "fatigue at frequency X" threshold is `UNKNOWN — establish account baseline`; there is no universal magic number. |

---

## A4 — Spend (Amount Spent)

**LEVEL:** ad (native) · rolls up cleanly (additive) · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`spend`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Currency actually charged for delivery in the window. |
| 2 | Why it matters | The cost side of every efficiency ratio (CPM, CPC, CPA, ROAS) and the budget-pacing input. |
| 3 | Decision it drives | Budget reallocation — shift spend toward objects with better downstream efficiency; the sample-size gate for cost-based confidence (see A5, D9). |
| 4 | Inputs | Billed auction events. |
| 5 | Formula | Direct sum. |
| 6 | Source | `spend` — OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Additive across any window/object; safe to sum. |
| 8 | Min sample size | N/A as a count. As a *denominator*, cost-per metrics need enough spend to have produced a stable count of the numerator event. |
| 9 | Limitations | Ad-account currency and timezone bound — comparing spend across accounts requires currency + timezone normalisation (EXTERNAL: FX rates). Excludes off-platform fees, agency margin, production cost. |
| 10 | When NOT to trust | Same-day figures (still billing). For true blended efficiency you must add non-Meta costs — Meta spend alone understates real CAC. |

---

## A5 — CPM (Cost per 1,000 Impressions)

**LEVEL:** ad (native) · **FACT-LABEL:** OFFICIAL PLATFORM FACT (returned field) · **MAPPING CLASS:** FETCH (`cpm`) — reproducible as CALC

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Average auction cost to show the ad 1,000 times. |
| 2 | Why it matters | The purest **auction-price / audience-cost** signal, isolated from click and conversion behaviour. Rising CPM on a stable audience = more competition or worse ad quality ranking. |
| 3 | Decision it drives | Diagnose *where* efficiency is leaking: if CPA rose but CPM is flat, the problem is downstream (creative/landing/offer), not the auction. Splits "traffic got expensive" from "traffic got worse." |
| 4 | Inputs | Spend, Impressions. |
| 5 | Formula | `cpm = (spend ÷ impressions) × 1000` (Meta returns pre-computed). |
| 6 | Source | `cpm` — OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Recompute from summed spend and impressions for the window; **do not average daily CPMs** (that biases toward low-volume days). |
| 8 | Min sample size | Stable at modest impressions (`≥ ~1,000`); noisy below. INTERNAL CALCULATION — statistical convention. |
| 9 | Limitations | Driven by audience competitiveness, placement mix, seasonality (Q4 auction inflation is real but its magnitude is `UNKNOWN — verify per account/year`), and Meta's ad-quality ranking. A "good" CPM is entirely audience-dependent — no universal benchmark. |
| 10 | When NOT to trust | For cross-audience comparison (broad prospecting vs narrow retargeting have structurally different CPMs). As a quality metric in isolation — cheap impressions to the wrong people are not a win. |

---

## A6 — Budget Delivery / Pacing Rate

**LEVEL:** adset/campaign (native — budget lives on the delivery object; CBO vs ABO changes which) · **FACT-LABEL:** INTERNAL CALCULATION (DERIVED) · **MAPPING CLASS:** CALC (from `spend` + budget setting) — budget setting itself is FETCH

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | How much of the intended budget the object is actually spending (spend ÷ budget, normalised to the pacing period). |
| 2 | Why it matters | Under-delivery silently caps a winning campaign; the "why aren't we spending?" question precedes any performance question. |
| 3 | Decision it drives | Fix delivery blockers (bid too low, audience too small, learning-limited, disapproval) vs raise budget on a healthy scaler. |
| 4 | Inputs | Spend, configured daily/lifetime budget, elapsed time in period. |
| 5 | Formula | `pacing = spend_in_period ÷ (budget × fraction_of_period_elapsed)`. Values <1 = under-pacing. |
| 6 | Source | Spend `FETCH`; budget from campaign/adset config `FETCH`; the ratio is ours → INTERNAL CALCULATION (DERIVED) / CALC. |
| 7 | Comparison window | Align to the budget period (daily budgets → intraday pacing; lifetime → whole flight). |
| 8 | Min sample size | N/A; but intraday pacing early in a day is unreliable (delivery is non-linear across dayparts). |
| 9 | Limitations | Meta intentionally under/over-delivers day-to-day within lifetime budgets; daily-budget over/under by up to a documented tolerance is normal, not a fault (`verify current tolerance % at build`). |
| 10 | When NOT to trust | As an alarm early in a day or flight. Chronic under-delivery is the real signal; single-period wobble is expected. |

---

## A7 — Delivery-Insights signals (First-Impression Ratio, Audience Saturation, Auction Overlap)

**LEVEL:** adset · **FACT-LABEL:** UNKNOWN — availability not verified · **MAPPING CLASS:** likely INFER or CANNOT-KNOW (subset historically CALC in the deprecated Delivery Insights UI)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | First-Impression Ratio = share of impressions that were someone's first exposure; Audience Saturation = how tapped-out the pool is; Auction Overlap = self-competition between your own adsets. |
| 2 | Why it matters | Direct saturation / self-cannibalisation signals — high-value "what next" triggers *if available*. |
| 3 | Decision it drives | Consolidate overlapping adsets; broaden or refresh a saturated audience. |
| 4 | Inputs | Meta internal delivery diagnostics. |
| 5 | Formula | Meta-internal; not publicly specified. |
| 6 | Source | Historically surfaced in the **Delivery Insights** tab, much of which Meta has removed/curtailed. Current API exposure `UNKNOWN — verify at build`. |
| 7 | Comparison window | N/A until availability confirmed. |
| 8 | Min sample size | N/A. |
| 9 | Limitations | May be UI-only, deprecated, or unavailable via API. Do not build a decision on it until confirmed. |
| 10 | When NOT to trust | Until build-time verification confirms it exists in the pinned API version. Treat as aspirational, not shippable. Overlap can otherwise be **approximated** (INFER) from audience-definition analysis — flag as estimate, not fact. |

---
---

# CATEGORY B — ATTENTION

*Did anyone actually watch? Attention metrics are where derived-vs-official mislabelling does the most damage, because the two most-quoted numbers in creative strategy — hook rate and hold rate — are BOTH derived and hold rate has no agreed definition. This section fixes that.*

## B1 — Video Plays

**LEVEL:** ad/creative · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`video_play_actions`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Times the video *started* to play (includes autoplay starts). |
| 2 | Why it matters | The denominator for completion/retention curves and one candidate denominator for hold rate. |
| 3 | Decision it drives | Rarely a decision on its own; feeds retention analysis (B4) and hold-rate construction (B7). |
| 4 | Inputs | Play-start events. |
| 5 | Formula | Direct count. |
| 6 | Source | `video_play_actions` — OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Additive across the window. |
| 8 | Min sample size | Interpret retention off it only once plays `≥ ~500–1,000` (statistical convention, DERIVED). |
| 9 | Limitations | Autoplay inflates it massively in feed placements — a "play" is not a decision to watch. Placement-dependent (autoplay vs click-to-play). |
| 10 | When NOT to trust | As an attention signal by itself (autoplay). As a cross-placement comparator without segmenting by placement. |

---

## B2 — 3-Second Video Plays

**LEVEL:** ad/creative · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`video_3_sec_watched_actions` — `verify field name/array at build`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Times the video was watched for at least 3 continuous seconds (or to completion if shorter). |
| 2 | Why it matters | Meta's own coarse "the thumb stopped" proxy and the standard **numerator for hook rate**. |
| 3 | Decision it drives | Via hook rate (B6): keep/kill the **first frames** of a creative. |
| 4 | Inputs | 3-second watch events. |
| 5 | Formula | Direct count. |
| 6 | Source | Action-array metric — OFFICIAL PLATFORM FACT / FETCH. Note Meta shifted emphasis to ThruPlay; 3-sec remains available but confirm exposure in the pinned version. |
| 7 | Comparison window | Additive. |
| 8 | Min sample size | Tie to impressions floor of its rate (see B6). |
| 9 | Limitations | 3 seconds is a low, autoplay-contaminated bar; a "3-sec view" in an autoplay feed is weak evidence of intent. |
| 10 | When NOT to trust | As proof of genuine attention; it is a *relative* creative-vs-creative signal, not an absolute one. |

---

## B3 — ThruPlay

**LEVEL:** ad/creative · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`video_thruplay_watched_actions`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Times the video played to completion, **or** for at least 15 seconds (whichever comes first). |
| 2 | Why it matters | Meta's preferred "meaningful watch" metric and an optimisation objective; a common (and defensible) **numerator for hold rate**. |
| 3 | Decision it drives | Whether the *body* of the creative holds attention; ThruPlay-optimised buying decisions. |
| 4 | Inputs | ThruPlay events. |
| 5 | Formula | Direct count. |
| 6 | Source | `video_thruplay_watched_actions` — OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Additive. |
| 8 | Min sample size | Tie to the hold-rate denominator floor (see B7). |
| 9 | Limitations | The "15s OR complete" definition means ThruPlay is **not comparable across videos of different lengths** — a 12s video's ThruPlay = completion; a 90s video's ThruPlay = 15s partial. This asymmetry is the root of the hold-rate confusion (B7). |
| 10 | When NOT to trust | When comparing creatives of very different durations without normalising for length. |

---

## B4 — Video Percent-Watched (25/50/75/95/100%) & Retention Curve

**LEVEL:** ad/creative · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`video_p25/p50/p75/p95/p100_watched_actions`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Count of views reaching each quartile/threshold of the video's length. |
| 2 | Why it matters | The **retention curve** — the single richest creative-diagnostic in the platform. Where the curve cliffs tells the editor exactly which second to cut. |
| 3 | Decision it drives | Creative re-edit: a sharp drop between p25→p50 says "the middle drags"; a drop at p95→p100 is normal (people leave before the end card). Pinpoints the edit, not just "video is weak." |
| 4 | Inputs | Threshold-watch counts + video duration (EXTERNAL if not in the same pull). |
| 5 | Formula | Retention at threshold `= p{n}_watched ÷ video_plays` (or ÷ impressions for an exposure-based curve — state which). The *count* is FETCH; the *curve* is CALC/DERIVED. |
| 6 | Source | Quartile action arrays — OFFICIAL PLATFORM FACT / FETCH. The normalised curve is INTERNAL CALCULATION (DERIVED). |
| 7 | Comparison window | Counts additive; recompute the curve from summed counts, never average percentages. |
| 8 | Min sample size | Curve is jumpy below `~500` plays. |
| 9 | Limitations | Percentages are of *length*, so two videos are only comparable at the same duration or after time-normalising. Quartiles are coarse — the true cliff can hide inside a quartile. |
| 10 | When NOT to trust | Cross-duration comparison without normalisation; low-play creatives. |

---

## B5 — Average Watch Time

**LEVEL:** ad/creative · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`video_avg_time_watched_actions`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Average seconds watched per play (Meta-defined). |
| 2 | Why it matters | A single scalar summary of retention, useful for ranking many creatives fast before drilling into curves. |
| 3 | Decision it drives | Shortlist which creatives deserve a full retention-curve review; a length-normalised attention rank. |
| 4 | Inputs | Total watch time, plays. |
| 5 | Formula | Meta-returned; conceptually total-seconds ÷ plays. |
| 6 | Source | `video_avg_time_watched_actions` — OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Recompute from totals; do not average the averages. |
| 8 | Min sample size | `~500` plays for stability. |
| 9 | Limitations | An average → hidden distribution; length-biased (longer videos can post higher absolute avg watch time while retaining a *smaller fraction*). Prefer avg-watch ÷ length for fair comparison. |
| 10 | When NOT to trust | Cross-length ranking in raw seconds; small samples. |

---

## B6 — Hook Rate  ⚠️ THE DERIVED-VS-OFFICIAL TRAP

**LEVEL:** ad/creative · **FACT-LABEL:** INTERNAL CALCULATION (DERIVED) — **NOT a Meta field** · **MAPPING CLASS:** CALC

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Share of impressions that turned into a 3-second view — i.e. how well the **first ~1–3 seconds stop the scroll**. |
| 2 | Why it matters | The highest-leverage creative lever: fixing a weak hook lifts every downstream metric. It is the canonical "swap the opening frames" trigger. |
| 3 | Decision it drives | Re-shoot / re-order the opening of the creative; or kill the creative at the hook stage before spending on the body. |
| 4 | Inputs | 3-second video plays (B2), Impressions (A1). |
| 5 | Formula | `hook_rate = video_3_sec_watched_actions ÷ impressions`. |
| 6 | Source | **DERIVED — we compute it. Meta does NOT return a "hook rate" field.** Both inputs are FETCH; the ratio is CALC. Displaying this as a platform metric is a labelling violation. |
| 7 | Comparison window | Recompute from summed 3-sec plays and impressions for the window; never average daily hook rates. |
| 8 | Min sample size | Impressions `≥ ~1,000–2,000` before the rate is trustworthy (statistical convention, DERIVED). |
| 9 | Limitations | Inherits autoplay contamination of the 3-sec bar; **placement-dependent** (Stories/Reels autoplay differently from feed) so must be computed within placement; denominator uses impressions not plays, so non-video-eligible impressions can distort it. |
| 10 | When NOT to trust | Across mixed placements; on low impressions; as an absolute "good/bad" number — the only honest comparator is *this account's other creatives* or its own trailing baseline. Benchmark thresholds circulating online are `UNKNOWN — do not hard-code`. |

---

## B7 — Hold Rate  ⚠️ THREE COMPETING DEFINITIONS — ONE CHOSEN

**LEVEL:** ad/creative · **FACT-LABEL:** INTERNAL CALCULATION (DERIVED) — **NOT a Meta field** · **MAPPING CLASS:** CALC

"Hold rate" is quoted constantly and defined inconsistently. The three definitions in circulation are genuinely different metrics that answer different questions. AdBrain must pick one, compute it identically everywhere, and label the choice.

### The three definitions

| Def | Formula | What it actually answers | Weakness |
|---|---|---|---|
| **H1** (chosen) | `ThruPlay ÷ impressions` = `video_thruplay_watched_actions ÷ impressions` | "Of everyone we paid to reach, what share reached a meaningful watch (15s/complete)?" — exposure-anchored, same denominator as hook rate | ThruPlay's "15s OR complete" makes it length-sensitive |
| **H2** | `ThruPlay ÷ 3-sec plays` | "Of those we hooked, what share we held to a meaningful watch?" — retention *given* a hook | Denominator is itself a derived/soft number; two ratios stacked |
| **H3** | `video_p100_watched ÷ video_plays` (true completion rate) | "What share of starts watched to the very end?" | Punishes long videos; end-card drop-off makes it pessimistic |

### AdBrain's decision: **use H1 (`ThruPlay ÷ impressions`), documented.**

Rationale: (a) it shares the **impressions** denominator with hook rate (B6), so hook and hold sit on one comparable scale and form a clean two-step funnel (stop-scroll → hold-attention); (b) it uses ThruPlay, Meta's own "meaningful watch" concept, keeping the numerator defensible; (c) it needs only two FETCH fields both reliably available. Where creative lengths differ materially, **also** surface the length-normalised retention curve (B4) — hold rate ranks, the curve diagnoses. H2 and H3 may be shown as *secondary* cuts but the word "hold rate" in the product means H1, always.

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | (H1) Share of impressions that became a ThruPlay (15s-or-complete watch). |
| 2 | Why it matters | The "does the body hold attention after the hook" lever; pairs with hook rate to localise whether a creative fails at the *stop* or the *hold* stage. |
| 3 | Decision it drives | Re-edit the middle/body of the creative (vs re-edit the opening, which hook rate drives); kill creatives that hook but don't hold. |
| 4 | Inputs | ThruPlay (B3), Impressions (A1). |
| 5 | Formula | `hold_rate = video_thruplay_watched_actions ÷ impressions` (definition H1). |
| 6 | Source | **DERIVED — Meta returns no "hold rate" field.** Inputs FETCH; ratio CALC. |
| 7 | Comparison window | Recompute from summed ThruPlay and impressions; never average rates. Always compare within the same definition — mixing H1/H2/H3 across reports is the trap. |
| 8 | Min sample size | Impressions `≥ ~1,000–2,000` (DERIVED convention). |
| 9 | Limitations | Length-sensitive via ThruPlay's dual definition; placement-dependent; must be paired with the retention curve when durations differ. |
| 10 | When NOT to trust | Cross-length or cross-placement comparison unnormalised; low impressions; **any report that doesn't state which of H1/H2/H3 it used** — treat an unlabelled hold rate as untrustworthy. |

---

## B8 — Thumbstop Rate (alias — do not double-count)

**LEVEL:** ad/creative · **FACT-LABEL:** INTERNAL CALCULATION (DERIVED) · **MAPPING CLASS:** CALC

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Scroll-stopping power. In most shops "thumbstop rate" is a **synonym for hook rate** (`3-sec ÷ impressions`); a minority define it as `any video play ÷ impressions`. |
| 2 | Why it matters | Same lever as hook rate — flagged separately only to prevent teams treating it as a *second, independent* metric. |
| 3 | Decision it drives | Same as hook rate (opening-frames decision). |
| 4 | Inputs | 3-sec plays (or plays), Impressions. |
| 5 | Formula | `= hook_rate` under the majority definition. |
| 6 | Source | DERIVED / CALC. |
| 7 | Comparison window | As B6. |
| 8 | Min sample size | As B6. |
| 9 | Limitations | Naming collision causes duplicate/contradictory reporting. |
| 10 | When NOT to trust | Whenever it appears alongside "hook rate" as if the two were different signals. **AdBrain decision:** standardise on "hook rate," treat "thumbstop" as an alias, define it once. |

---
---

# CATEGORY C — ENGAGEMENT

*Signals of active response short of a click-out. Useful for creative resonance and (via reactions/comments) sentiment, but engagement is a means, not the end — most of these are secondary to click/conversion for a performance account. Labelled accordingly.*

## C1 — Post Engagement (total)

**LEVEL:** ad/creative · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`post_engagement` / `actions:post_engagement`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | All engagement actions on the ad post (reactions, comments, shares, saves, clicks of any kind, etc.) summed. |
| 2 | Why it matters | A coarse "did this resonate at all" roll-up; a fast triage scalar. |
| 3 | Decision it drives | Shortlist creatives for deeper engagement-quality review. **Primary? No — advanced/roll-up.** It bundles clicks with reactions, so it can't cleanly drive a single decision. |
| 4 | Inputs | Sum of component engagement actions. |
| 5 | Formula | Meta-summed. |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Additive. |
| 8 | Min sample size | N/A as a count. |
| 9 | Limitations | Bundles high-intent (clicks) with low-intent (reactions), obscuring what actually happened. |
| 10 | When NOT to trust | As a performance KPI — it is a vanity roll-up unless decomposed into the components below. |

---

## C2 — Reactions

**LEVEL:** ad/creative · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`actions:post_reaction`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Count of Like/Love/Haha/Wow/Sad/Angry reactions on the ad post. |
| 2 | Why it matters | Cheap resonance signal; the *mix* (Love vs Angry) is a rough sentiment read. |
| 3 | Decision it drives | Weak creative-resonance tiebreaker; sentiment early-warning if Angry spikes. **Primary? No — secondary/vanity for a performance account.** |
| 4 | Inputs | Reaction events (by type where available). |
| 5 | Formula | Direct count. |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH (per-type breakdown `verify at build`). |
| 7 | Comparison window | Additive. |
| 8 | Min sample size | Sentiment mix needs a meaningful base (`≥ ~100` reactions) to read. |
| 9 | Limitations | Reactions accrue on the *organic* post identity too; using one Page-post ID across ads pools reactions (social proof) but blurs per-ad attribution. Weak correlation to conversion. |
| 10 | When NOT to trust | As a performance proxy; low counts for sentiment. |

---

## C3 — Comments

**LEVEL:** ad/creative · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (count `actions:comment`) + EXTERNAL (comment *text/sentiment* needs the Comments edge + NLP)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Number of comments on the ad post (count). Text is a separate pull. |
| 2 | Why it matters | Comment *count* is minor; comment **content** is gold — objections, FAQs, and angle ideas straight from the market. |
| 3 | Decision it drives | Count: low value. Content: creative-angle and objection-handling decisions, and moderation of harmful comments. Content analysis is a genuinely high-value "what next" input. |
| 4 | Inputs | Comment count (FETCH); comment text via Comments edge (EXTERNAL to insights); sentiment via NLP (INFER). |
| 5 | Formula | Count direct; sentiment modelled. |
| 6 | Source | Count OFFICIAL PLATFORM FACT / FETCH. Sentiment = MODEL ESTIMATE / INFER. |
| 7 | Comparison window | Count additive; sentiment is a windowed model output. |
| 8 | Min sample size | Sentiment/theme mining needs enough comments to be representative (`≥ ~30–50`; DERIVED convention). |
| 9 | Limitations | Comments pool across ads sharing a post ID; bot/spam comments; sentiment models err on sarcasm/mixed-language (relevant for Indian-English/Hinglish markets). |
| 10 | When NOT to trust | Comment *count* as a KPI; sentiment on tiny samples or without a language-appropriate model. Never present model sentiment as fact — label MODEL ESTIMATE. |

---

## C4 — Shares

**LEVEL:** ad/creative · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`actions:post` = shares of the post)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Times people shared the ad post. |
| 2 | Why it matters | Strongest *organic-amplification / earned-reach* signal — shares extend reach at zero marginal CPM and correlate with genuinely resonant creative. |
| 3 | Decision it drives | Double down on share-driving creative angles; identify formats worth organic cross-posting. Secondary-but-meaningful for creative strategy. |
| 4 | Inputs | Share events. |
| 5 | Formula | Direct count. |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH (confirm the `post` action key at build — naming is a known trap). |
| 7 | Comparison window | Additive. |
| 8 | Min sample size | Rare event; needs large impressions to read a rate. |
| 9 | Limitations | Low base rates → noisy; earned reach from shares is not separately credited in paid reach, so its value is under-measured (CANNOT-KNOW the exact incremental reach). |
| 10 | When NOT to trust | As a primary KPI; rate comparisons on small samples. |

---

## C5 — Saves

**LEVEL:** ad/creative · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`actions:onsite_conversion.post_save` — `verify key at build`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Times people saved/bookmarked the ad post. |
| 2 | Why it matters | High-intent consideration signal — a save = "I want to come back to this," common in considered/high-ticket purchases. |
| 3 | Decision it drives | Flag creatives/offers worth a retargeting follow-up; identify consideration-stage angles. Secondary but a useful intent proxy. |
| 4 | Inputs | Save events. |
| 5 | Formula | Direct count. |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Additive. |
| 8 | Min sample size | Rare → needs volume for a stable rate. |
| 9 | Limitations | Low base rate; not all placements support saves; intent inference is directional not proven. |
| 10 | When NOT to trust | As a conversion substitute; small samples. |

---

## C6 — Engagement Rate

**LEVEL:** ad/creative · **FACT-LABEL:** INTERNAL CALCULATION (DERIVED) — no single Meta field · **MAPPING CLASS:** CALC

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Engagement per unit of audience — but the denominator is contested (impressions vs reach) exactly like hold rate. |
| 2 | Why it matters | Normalises engagement for exposure so creatives are comparable. |
| 3 | Decision it drives | Creative-resonance ranking. **Primary? No — secondary/advanced.** |
| 4 | Inputs | Post engagement (C1) or a chosen component; impressions or reach. |
| 5 | Formula | **AdBrain decision:** `engagement_rate = post_engagement ÷ reach` (per-person resonance). Report the impressions-based variant only when explicitly labelled. Pick one, state it. |
| 6 | Source | DERIVED / CALC. Not an official field. |
| 7 | Comparison window | Recompute from components for the window; reach-based version is non-additive (reach is). |
| 8 | Min sample size | `reach ≥ ~1,000`. |
| 9 | Limitations | Denominator ambiguity (mirror of the hold-rate trap); "engagement" numerator definition varies (all actions vs reactions-only). Weak link to revenue. |
| 10 | When NOT to trust | When the numerator/denominator definition isn't stated; as a performance KPI. Standardise the formula or the metric is meaningless across reports. |

---
---

# CATEGORY D — CLICK QUALITY

*Clicks are the last on-platform signal before the site takes over. The core discipline here: "click" is three different things (all clicks / link clicks / outbound clicks), and the gap between a link click and a landing-page view is where budget quietly dies. Getting the click definition right is a prerequisite for honest CTR and CPC.*

## D0 — Click-type primer (read first)

Meta reports **three** click concepts. Confusing them corrupts every CTR/CPC below.

| Concept | Field | Counts | Use |
|---|---|---|---|
| All clicks | `clicks` | Every click: link, reactions, comments, shares, page-name, expand, media | Almost never the right performance metric — inflated by engagement clicks |
| Link clicks | `inline_link_clicks` | Clicks on links in the ad (may include on-Meta destinations like IG profile / lead form) | Standard for on-platform link performance |
| Outbound clicks | `outbound_clicks` | Clicks that **leave Meta** to your site | The truest "traffic to my site" click |

**AdBrain default:** use **outbound clicks** for site-traffic decisions and **link clicks** for on-platform destinations; reserve all-clicks for engagement analysis only, always labelled "(all clicks)".

---

## D1 — Clicks (All)

**LEVEL:** ad · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`clicks`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Every click on the ad, of any kind. |
| 2 | Why it matters | Component of "all-clicks CTR"; useful only for engagement-click analysis. |
| 3 | Decision it drives | Diagnose "high CTR but no site traffic" = clicks are going to reactions/expands, not the link. Otherwise low value. **Primary? No.** |
| 4 | Inputs | All click events. |
| 5 | Formula | Direct count. |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Additive. |
| 8 | Min sample size | N/A count. |
| 9 | Limitations | Bundles intent levels; systematically overstates "traffic." |
| 10 | When NOT to trust | As a proxy for site visits — use outbound clicks (D3) instead. Any CTR built on it must be labelled "(all)". |

---

## D2 — Link Clicks

**LEVEL:** ad · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`inline_link_clicks`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Clicks on the ad's link(s) — the CTA/destination link. |
| 2 | Why it matters | Standard measure of link interest; denominator for cost-per-link-click and link CTR. |
| 3 | Decision it drives | Creative/CTA optimisation for click intent; the volume feeding the click→LP-view funnel (D7/D8). |
| 4 | Inputs | Link-click events. |
| 5 | Formula | Direct count. |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Additive. |
| 8 | Min sample size | For link CTR, impressions `≥ ~1,000–2,000`. |
| 9 | Limitations | Can include clicks to on-Meta destinations (IG profile, instant forms), so it is **not** identical to "left for my website" — that's outbound (D3). |
| 10 | When NOT to trust | As site-traffic when destinations are on-Meta; use outbound clicks for true off-platform traffic. |

---

## D3 — Outbound Clicks

**LEVEL:** ad · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`outbound_clicks`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Clicks that took the person off Meta to an external destination. |
| 2 | Why it matters | The truest "I sent a human to my site" count — the honest top of the site-side funnel. |
| 3 | Decision it drives | Traffic-quality and budget decisions; the correct numerator when reconciling against site analytics (D8). |
| 4 | Inputs | Outbound-click events. |
| 5 | Formula | Direct count. |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Additive. |
| 8 | Min sample size | As link clicks. |
| 9 | Limitations | Still a click, not a session — the click→LP-view gap (D8) can be large; multiple outbound clicks per person possible (see unique variants, D10). |
| 10 | When NOT to trust | As a visit count when the click→LP gap is wide (slow LP, misclicks). Reconcile with site analytics. |

---

## D4 — CTR (All)

**LEVEL:** ad · **FACT-LABEL:** OFFICIAL PLATFORM FACT (returned field) · **MAPPING CLASS:** FETCH (`ctr`) — reproducible CALC

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | All clicks ÷ impressions. |
| 2 | Why it matters | Broad interest signal; feeds Meta's relevance/quality ranking indirectly. |
| 3 | Decision it drives | Weak — inflated by engagement clicks. Prefer link/outbound CTR for real decisions. **Primary? No — use D5/D6.** |
| 4 | Inputs | Clicks (all), impressions. |
| 5 | Formula | `ctr = clicks ÷ impressions`. Meta returns it. |
| 6 | Source | `ctr` — OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Recompute from summed clicks and impressions; never average daily CTRs. |
| 8 | Min sample size | impressions `≥ ~1,000–2,000`. |
| 9 | Limitations | Overstates link intent; not comparable across placements without segmenting. |
| 10 | When NOT to trust | For traffic/conversion decisions — it rewards engagement-bait creatives that never send anyone to site. |

---

## D5 — Link CTR

**LEVEL:** ad · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`inline_link_click_ctr`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Link clicks ÷ impressions. |
| 2 | Why it matters | The workhorse click-efficiency metric for creative and CTA testing. |
| 3 | Decision it drives | Keep/kill/iterate creative and CTA; a leading indicator that pairs with hook rate to separate "attention" from "intent." |
| 4 | Inputs | Link clicks (D2), impressions. |
| 5 | Formula | `inline_link_click_ctr = inline_link_clicks ÷ impressions`. Meta-returned. |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Recompute from components; no averaging of rates. |
| 8 | Min sample size | impressions `≥ ~1,000–2,000` (DERIVED convention). |
| 9 | Limitations | Placement-sensitive; can be gamed by clickbait that tanks downstream conversion — must be read alongside LP-view rate (D8) and CVR (artifact 01b). |
| 10 | When NOT to trust | In isolation — a high link CTR with a low click→LP-view ratio (D8) means the click quality is bad or the LP is broken. "Good CTR" thresholds are `UNKNOWN — use account baseline`. |

---

## D6 — Outbound CTR

**LEVEL:** ad · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`outbound_clicks_ctr`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Outbound clicks ÷ impressions. |
| 2 | Why it matters | Cleanest measure of "impressions → off-platform traffic" efficiency. |
| 3 | Decision it drives | Traffic-efficiency decisions where the destination is your own site; the most honest CTR for a conversion account. |
| 4 | Inputs | Outbound clicks (D3), impressions. |
| 5 | Formula | `outbound_clicks_ctr = outbound_clicks ÷ impressions`. Meta-returned. |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Recompute from components. |
| 8 | Min sample size | impressions `≥ ~1,000–2,000`. |
| 9 | Limitations | As D3 — click ≠ session; placement-sensitive. |
| 10 | When NOT to trust | Without reconciling against actual site sessions (D8, and site analytics in the EXTERNAL layer). |

---

## D7 — Landing Page Views

**LEVEL:** ad · **FACT-LABEL:** OFFICIAL PLATFORM FACT (pixel-reported) · **MAPPING CLASS:** FETCH (`actions:landing_page_view`) — **depends on pixel** (EXTERNAL prerequisite)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Times a person clicked *and* the destination page actually loaded (pixel `PageView` fired after the outbound click). |
| 2 | Why it matters | The first *confirmed arrival* — bridges Meta clicks to the site. The click-to-LPV gap is pure waste. |
| 3 | Decision it drives | Fix landing-page speed/reliability; re-judge "expensive traffic" that is really a broken/slow LP. High-value diagnostic. |
| 4 | Inputs | Pixel PageView events attributed to the ad click. |
| 5 | Formula | Direct count (attributed). |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH **but conditional on a working pixel** — if the pixel is missing/misfiring this is UNKNOWN, not zero. |
| 7 | Comparison window | Additive; but attribution-window-bound (see 01b for attribution). |
| 8 | Min sample size | As clicks. |
| 9 | Limitations | Pixel-dependent → undercounts with ad blockers, consent opt-outs (iOS/GDPR), slow loads, SPA misconfig. Post-ATT signal loss is real (magnitude `UNKNOWN — verify per account`). |
| 10 | When NOT to trust | When pixel health is unverified; treating a low LPV as a traffic problem when it may be a measurement problem. Always check pixel firing before acting. |

---

## D8 — Click-to-Landing-Page-View Rate (Click Quality / Connection Rate)

**LEVEL:** ad · **FACT-LABEL:** INTERNAL CALCULATION (DERIVED) · **MAPPING CLASS:** CALC (from two FETCH fields, pixel-conditional)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Share of clicks that became a confirmed landing-page view — the **click→arrival survival rate**. |
| 2 | Why it matters | Isolates a silent budget leak: you pay for the click, but slow/broken LPs, misclicks, and bots mean many never arrive. One of the highest-ROI diagnostics in this whole dictionary. |
| 3 | Decision it drives | Fix LP performance (speed, mobile, redirects), pause placements with junk clicks, or flag click fraud — *before* blaming the creative or offer. |
| 4 | Inputs | Landing page views (D7), outbound or link clicks (D3/D2 — **state which**). |
| 5 | Formula | **AdBrain decision:** `connection_rate = landing_page_views ÷ outbound_clicks` (outbound is the true off-platform intent). Report the link-click variant only when explicitly labelled. |
| 6 | Source | DERIVED / CALC; pixel-conditional. Not a Meta field. |
| 7 | Comparison window | Recompute from summed components; align attribution windows of numerator and denominator. |
| 8 | Min sample size | clicks `≥ ~500` for a stable rate (DERIVED convention). |
| 9 | Limitations | Can exceed 100% or misbehave when numerator and denominator use different attribution/click definitions — a common bug; enforce consistent definitions. Pixel loss depresses it artificially. |
| 10 | When NOT to trust | When pixel health is unverified (looks like bad clicks, is actually lost measurement); when numerator/denominator click-types or windows are mismatched. A low value is a *diagnosis prompt*, not a verdict. |

---

## D9 — CPC (Cost per Click) — All, Link, and Outbound variants

**LEVEL:** ad · **FACT-LABEL:** OFFICIAL PLATFORM FACT (each variant is a returned field) · **MAPPING CLASS:** FETCH (`cpc`, `cost_per_inline_link_click`, `cost_per_outbound_click`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Average spend per click — for each click definition (all / link / outbound). |
| 2 | Why it matters | Cost efficiency of buying attention-to-click; the bridge from CPM (audience cost) toward CPA. |
| 3 | Decision it drives | Which creatives/audiences buy clicks efficiently; where cost is leaking between CPM and CPA. **Use the link or outbound variant, not all-clicks CPC.** |
| 4 | Inputs | Spend; the matching click count. |
| 5 | Formula | `cost_per_inline_link_click = spend ÷ inline_link_clicks` (and analogues). Meta returns each. |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH — but **which variant** you quote changes the number 2–5×; label it. |
| 7 | Comparison window | Recompute from summed spend and clicks; never average daily CPCs. |
| 8 | Min sample size | Enough clicks that the count is stable (`≥ ~50–100` clicks; DERIVED convention). |
| 9 | Limitations | All-clicks CPC flatters cost by counting engagement clicks; not comparable across click definitions or placements. |
| 10 | When NOT to trust | When the click variant is unstated (the classic "our CPC is ₹X" ambiguity); low click counts; cross-placement comparison. |

---

## D10 — Unique CTR & Unique Link Clicks

**LEVEL:** ad · **FACT-LABEL:** OFFICIAL PLATFORM FACT · **MAPPING CLASS:** FETCH (`unique_ctr`, `unique_inline_link_clicks`, `unique_outbound_clicks_ctr`)

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Clicks/CTR counting each person once (deduplicated), vs the repeat-counting standard metrics. |
| 2 | Why it matters | Separates "many people clicked once" from "few people clicked repeatedly" — a click-quality and fatigue nuance. |
| 3 | Decision it drives | Detect repeat-clicker inflation (retargeting, small pools); sanity-check standard CTR. Secondary/advanced. |
| 4 | Inputs | Deduplicated click events; reach. |
| 5 | Formula | `unique_ctr = unique clicks ÷ reach` (Meta-returned). |
| 6 | Source | OFFICIAL PLATFORM FACT / FETCH. |
| 7 | Comparison window | Non-additive (built on reach) — pull for the exact window. |
| 8 | Min sample size | reach `≥ ~1,000`. |
| 9 | Limitations | Non-additive; denominator is reach not impressions, so not directly comparable to standard CTR. |
| 10 | When NOT to trust | Summed across windows; compared head-to-head with impression-based CTR without noting the different denominator. |

---
---

# Cross-cutting rules for A–D (enforce in code)

1. **Never average a rate across time or objects.** Re-derive every rate (CTR, CPM, CPC, hook/hold, engagement, connection) from summed numerators and denominators for the exact window. Averaging daily rates biases toward low-volume days. `INTERNAL CALCULATION`.
2. **Reach, frequency, and everything built on them are non-additive.** Pull them for the precise reporting window; never sum across days or adsets.
3. **Fact-label discipline:** `cpm`, `ctr`, `frequency`, `cpc` and their variants are OFFICIAL because Meta *returns the field*. **Hook rate, hold rate, thumbstop rate, engagement rate, connection rate are DERIVED** and must be visibly labelled as computed, never shown as Meta fields.
4. **Hold rate = H1 (`ThruPlay ÷ impressions`) everywhere.** Any hold-rate value without a stated definition is untrustworthy. Same rule for engagement rate (÷reach) and connection rate (÷outbound clicks).
5. **Click-type must always be named:** all / link / outbound. Default to outbound for site traffic, link for on-Meta destinations, all only for engagement analysis.
6. **Sample-size gate before any keep/kill:** no rate metric drives a decision below its impression/click floor (rules of thumb here are statistical conventions labelled DERIVED, not Meta facts). Meta's own learning-phase exit (~50 optimisation events / adset / week) is an OFFICIAL PLATFORM FACT and a hard gate for optimisation-event decisions — `verify current threshold at build`.
7. **Benchmarks:** default comparator is the account's trailing baseline. Any external "good number" ships only with a cited primary source; otherwise `UNKNOWN — verify at build`. No arbitrary thresholds as truth.
8. **Pixel-conditional metrics (LPV, connection rate) require a pixel-health check first** — a low value can be lost measurement, not bad performance.
9. **Freshness:** last 24–72h data is subject to Meta restatement (attribution + billing settle); flag in-flight windows.
10. **Placement segmentation:** attention and click rates are placement-sensitive (autoplay differences). Compare within placement or explicitly note the mix.

---

## Decision-gate summary (what each category actually changes)

| Category | Primary decisions it drives | Metrics that are NOT primary (advanced/vanity) |
|---|---|---|
| A Delivery | Fatigue refresh (frequency), audience expansion (reach plateau), auction-vs-downstream diagnosis (CPM), budget pacing fix | Raw impressions as a KPI; deprecated Delivery-Insights signals until verified |
| B Attention | Re-cut the hook (hook rate), re-cut the body (hold rate + retention curve), shortlist creatives (avg watch time) | Raw video plays; thumbstop rate as a separate metric |
| C Engagement | Comment-content → creative angles & objection handling; share-driving angles; save → retargeting intent | Post engagement roll-up, reactions, engagement rate as performance KPIs |
| D Click Quality | Creative/CTA iteration (link/outbound CTR), LP-fix vs click-fraud (connection rate), cost-leak diagnosis (CPC) | All-clicks CTR/CPC as performance KPIs; unique metrics beyond sanity-checks |

---

*End of artifact 01a. Sibling: 01b (Conversion, Cost-Efficiency, Value/ROAS, Attribution). All `verify at build` flags must be closed against the pinned Meta API version and `02-meta-data-mapping.md` before this dictionary is treated as authoritative.*
