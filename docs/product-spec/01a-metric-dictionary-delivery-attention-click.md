# [01a] Master Metric Dictionary — A Delivery · B Attention · C Engagement · D Click Quality

Part of output [01] Master Metric Dictionary. Scope: the four "top-of-funnel / on-platform"
categories. Conversion (E), Economics (F), and the creative/diversity/fatigue families live in
sibling files. Every metric here traces to a row in [02] Meta Data Mapping and carries its fact
label. Current date: 2026-08-25. Where a platform specific or benchmark is not verified in-hand it
is marked **UNKNOWN / verify at build** — never fabricated.

## How to read every entry
Each metric answers all 10 questions from the brief:
1 measures · 2 why · 3 **decision it changes** · 4 inputs · 5 formula · 6 source · 7 comparison
window · 8 minimum sample · 9 limitations · 10 when NOT to trust it.

And carries a header line: **LEVEL · [02]-class · FACT LABEL · DECISION-GATE verdict**.

### Fact-label vocabulary (from the brief)
OFFICIAL PLATFORM FACT · INTERNAL CALCULATION (DERIVED) · RESEARCH-BACKED · INDUSTRY BENCHMARK ·
MODEL ESTIMATE · INFERENCE · UNKNOWN.

### [02] source-class mapping (the rule this file must obey)
| [02] class | Meaning | Fact label it forces |
|---|---|---|
| FETCH | direct Meta API field | OFFICIAL PLATFORM FACT |
| CALC | computed from fetched fields | INTERNAL CALCULATION (DERIVED) |
| INFER | modeled/estimated | MODEL ESTIMATE or INFERENCE |
| EXTERNAL | another system (Shopify/CRM/LP crawler) | EXTERNAL |
| CANNOT-KNOW | not reliably knowable | UNKNOWN |

A metric fetched raw is an OFFICIAL PLATFORM FACT. The moment we divide two fetched fields, the
result is INTERNAL CALCULATION (DERIVED) even though its inputs are official. This distinction is
the whole point of the "attention trap" (see B).

### The one benchmark rule
This file states **no numeric benchmark as truth.** Every "compare against" points to the Benchmark
engine ([27]), which must attach source/date/sample/confidence or return "benchmark unavailable".
Minimum-sample numbers below are INTERNAL CALCULATION heuristics (stated reasoning, meant to be
validated), not platform facts.

---

# A · DELIVERY
What Meta actually served, to how many, at what price. All raw fields here are FETCH OFFICIAL ([02]
"Delivery / spend"). Delivery metrics are mostly **diagnostic context** — they rarely change an
action alone, but they gate the trust of every downstream metric (a metric on 40 impressions is
noise). Trends and concentration built on top of them are DERIVED.

## A1 · Spend
**LEVEL: any (ad→account) · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS (context/gate)**
| Q | Answer |
|---|---|
| Measures | Currency actually spent in the window. |
| Why | The denominator of nearly every efficiency metric; sizes the stakes of any decision. |
| Decision | Gates whether an entity has enough weight to act on; feeds waste [10] and scale [11]. |
| Inputs | `spend` |
| Formula | Direct field (sum over window). |
| Source | Meta Insights API `spend`. [02] Delivery/spend. |
| Window | value / prev / 3/7/14/30-day, per `time_increment=1`. |
| Min sample | n/a (it is itself the sample weight). |
| Limitations | Currency/timezone of the ad account; excludes fees; not margin. |
| Don't trust when | Account currency differs from reporting currency; partial-day pull mid-flight. |

## A2 · Impressions
**LEVEL: any · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS (gate/denominator)**
| Q | Answer |
|---|---|
| Measures | Times the ad entered screen (Meta's rendered count). |
| Why | Denominator for CPM, CTR, hook rate, frequency; primary sample-size gate. |
| Decision | Sets minimum-sample confidence for every rate metric below. |
| Inputs | `impressions` |
| Formula | Direct field. |
| Source | Meta Insights `impressions`. [02] Delivery/spend. |
| Window | value/prev/trend; day-wise. |
| Min sample | n/a. |
| Limitations | Impression ≠ view (only video plays approximate attention — see B). |
| Don't trust when | Comparing across placements with different viewability. |

## A3 · Reach
**LEVEL: adset/campaign/account (not additive across time) · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS (context)**
| Q | Answer |
|---|---|
| Measures | Unique people who saw the ad. |
| Why | The unique-audience base; the denominator of frequency. |
| Decision | Audience saturation checks; feeds fatigue [07] (reach growth stalling). |
| Inputs | `reach` |
| Formula | Direct field. |
| Source | Meta Insights `reach`. [02] Delivery/spend. |
| Window | value/prev/trend; **not summable across days** (dedup only within Meta's window). |
| Min sample | n/a. |
| Limitations | Cannot be added across date ranges; Meta-modeled uniqueness. |
| Don't trust when | Summing daily reach to a total (double-counts); very small audiences. |

## A4 · Frequency
**LEVEL: adset/campaign/account · [02]: FETCH (Meta-provided = impressions/reach) · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS**
| Q | Answer |
|---|---|
| Measures | Avg times each reached person saw the ad. |
| Why | Classic (but insufficient) fatigue signal; over-exposure driver of CPM rise / CTR decay. |
| Decision | Feeds fatigue [07] as ONE signal (never alone — brief rule); audience-refresh / cap decisions. |
| Inputs | `frequency` (or `impressions`, `reach`). |
| Formula | Meta provides it; identity = impressions / reach. |
| Source | Meta Insights `frequency`. [02] flags it Meta-provided. |
| Window | value/prev/trend; day-wise and cumulative differ. |
| Min sample | Reach large enough to be stable (heuristic: reach ≳ a few thousand). |
| Limitations | Averages hide the heavy-exposure tail; high freq ≠ fatigue by itself. |
| Don't trust when | Used as the sole fatigue verdict (brief forbids); tiny reach; cumulative-vs-daily confusion. |

## A5 · CPM (cost per 1,000 impressions)
**LEVEL: any · [02]: FETCH OFFICIAL (also reconstructable as CALC) · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS**
| Q | Answer |
|---|---|
| Measures | Price to buy 1,000 impressions. |
| Why | Auction-cost signal; rising CPM at flat relevance = fatigue/competition/audience narrowing. |
| Decision | Fatigue [07] input; efficiency triage; creative-refresh timing. |
| Inputs | `cpm` (or `spend`, `impressions`). |
| Formula | Meta field; identity = spend / impressions × 1000. |
| Source | Meta Insights `cpm`. [02] Delivery/spend. |
| Window | value/prev/trend; day-wise for anomaly detection. |
| Min sample | Impressions ≳ 1,000 for a stable read (heuristic). |
| Limitations | Driven by auction/seasonality/audience as much as by creative; confounded. |
| Don't trust when | Isolating creative quality from it (AUTOPSY: seasonality, auction shifts). |

## A6 · Spend velocity
**LEVEL: any · [02]: CALC (from daily spend) · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: PASS**
| Q | Answer |
|---|---|
| Measures | Rate/acceleration of spend over recent days. |
| Why | Detects fast scaling (fatigue risk) or throttling; pairs with marginal economics. |
| Decision | Scale [11] / protect / slow-down; flags entities scaling faster than performance holds. |
| Inputs | daily `spend` series. |
| Formula | e.g. slope of spend over N days, or (spendₜ − spendₜ₋₇)/spendₜ₋₇. Document chosen form. |
| Source | Derived from Meta daily spend. [02] "spend velocity … CALC DERIVED". |
| Window | 3/7/14-day. |
| Min sample | ≥ 7 daily points for a slope (heuristic). |
| Limitations | Sensitive to budget edits and day-of-week; not performance itself. |
| Don't trust when | < 1 week of data; recent manual budget change (confounds slope). |

## A7 · Spend trend (3/7/14/30-day)
**LEVEL: any · [02]: CALC · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: PASS**
| Q | Answer |
|---|---|
| Measures | Directional change in spend across windows. |
| Why | Context for every efficiency change (did CPA rise because spend jumped?). |
| Decision | Distinguishes "we spent more" from "it got worse"; AUTOPSY confounder check. |
| Inputs | daily `spend`. |
| Formula | windowed sums + % change; trend vs noise per [22]. |
| Source | Derived. [02] "7/14/30d spend trend … CALC DERIVED". |
| Window | 3/7/14/30-day. |
| Min sample | window length in days. |
| Limitations | % change unstable on small bases. |
| Don't trust when | Base spend near zero; window shorter than one weekly cycle. |

## A8 · Budget utilization / pacing
**LEVEL: campaign/adset · [02]: FETCH (budget) + CALC · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: PASS**
| Q | Answer |
|---|---|
| Measures | Spend vs set budget (under/over/on-pace). |
| Why | Under-delivery = missed scale; capped delivery = artificial ceiling. |
| Decision | Raise/lower budget; unblock delivery; scale [11] readiness. |
| Inputs | `budget`, `spend`, delivery/`effective_status`. |
| Formula | spend / budget over pacing window. |
| Source | Meta `budget` + `spend` (FETCH); ratio DERIVED. [02] Delivery/spend. |
| Window | daily / flight-to-date. |
| Min sample | ≥ 1 full delivery day. |
| Limitations | CBO/Advantage+ shifts budget across adsets — adset pacing misleads under CBO. |
| Don't trust when | Learning phase; CBO active; budget edited mid-window. |

## A9 · Delivery / effective status
**LEVEL: campaign/adset/ad · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS (gate)**
| Q | Answer |
|---|---|
| Measures | Whether the entity is actually delivering (active/limited/rejected/learning/etc.). |
| Why | A "bad" metric on a rejected or learning entity is not a performance fact. |
| Decision | Gates all diagnosis; fix delivery before judging creative. |
| Inputs | `effective_status`, delivery info. |
| Formula | Direct field(s). |
| Source | Meta. [02] "delivery/effective_status FETCH OFFICIAL". |
| Window | current state (point-in-time). |
| Min sample | n/a. |
| Limitations | Status is momentary; history needs day-wise capture [22]. |
| Don't trust when | Judging performance while status ≠ active (learning/limited/rejected). |

## A10 · Impression / reach growth
**LEVEL: any · [02]: CALC · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: PASS**
| Q | Answer |
|---|---|
| Measures | Rate of new impressions/reach accrual. |
| Why | Stalling reach growth at rising frequency = audience exhaustion (fatigue [07] signal). |
| Decision | Audience expansion / refresh; fatigue confirmation. |
| Inputs | daily `impressions`, `reach`. |
| Formula | Δ over window; reach growth needs Meta-deduped reach, not summed. |
| Source | Derived from FETCH fields. [02] Delivery/spend. |
| Window | 3/7/14-day. |
| Min sample | ≥ 7 daily points. |
| Limitations | Reach not summable across days; growth confounded by budget changes. |
| Don't trust when | Budget changed; reach approximated by summing daily. |

---

# B · ATTENTION
**The brief's key trap ([02]: "the brief's key trap").** Meta gives raw video plays as OFFICIAL
FACTS. The attention *rates* everyone quotes (hook rate, hold rate) are **our divisions of those
facts — INTERNAL CALCULATION (DERIVED)** — and must never be shown as official Meta metrics.
Attention metrics apply to video creative only; for static, they are N/A.

### The derived-vs-official split, made explicit
| Looks like a Meta metric | Actually | [02] class | Fact label |
|---|---|---|---|
| video_3_sec plays | raw field | FETCH | OFFICIAL PLATFORM FACT |
| ThruPlay | raw field | FETCH | OFFICIAL PLATFORM FACT |
| p25/50/75/100 watched | raw actions | FETCH | OFFICIAL PLATFORM FACT |
| video_avg_time_watched | raw field | FETCH | OFFICIAL PLATFORM FACT |
| **Hook rate** | 3-sec ÷ impressions | CALC | **INTERNAL CALCULATION (DERIVED)** |
| **Hold rate** | (one of 3 defs, ÷ 3-sec) | CALC | **INTERNAL CALCULATION (DERIVED)** |
| Retention curve / decay | shape of p25–p100 | CALC | **INTERNAL CALCULATION (DERIVED)** |

## B1 · 3-second video plays
**LEVEL: ad/creative · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS (input to hook rate)**
| Q | Answer |
|---|---|
| Measures | Count of ≥3-second video plays (Meta's 3-sec play definition). |
| Why | Raw numerator for hook rate; the coarsest "did the thumb stop" signal. |
| Decision | Feeds hook rate → hook/opening-frame decisions. |
| Inputs | `video_3_sec_watched_actions` (or `video_play_actions` per API version — verify at build). |
| Formula | Direct field. |
| Source | Meta Insights. [02] Attention/video. |
| Window | value/prev/trend; day-wise. |
| Min sample | tied to impressions (see hook rate). |
| Limitations | Autoplay inflates it; a 3-sec "play" is a low bar, not proof of attention. |
| Don't trust when | Autoplay/sound-off placements; comparing across placements. |

## B2 · ThruPlay
**LEVEL: ad/creative · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS (input to hold rate)**
| Q | Answer |
|---|---|
| Measures | Meta's ThruPlay: video played to completion OR ≥15s, whichever first (**verify exact def at build — Meta wording**). |
| Why | Meta's own "meaningful watch" optimization metric; numerator for the chosen hold-rate definition. |
| Decision | Hold-rate / mid-video retention decisions; ThruPlay-optimized delivery quality. |
| Inputs | `video_thruplay_watched_actions`. |
| Formula | Direct field. |
| Source | Meta Insights. [02] Attention/video ("thruplay"). |
| Window | value/prev/trend. |
| Min sample | tied to 3-sec plays (see hold rate). |
| Limitations | For creatives < 15s, ThruPlay = completion, changing its meaning by length. |
| Don't trust when | Comparing hold across creatives of very different lengths. |

## B3 · Video percentages watched (p25 / p50 / p75 / p100)
**LEVEL: ad/creative · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS (retention-curve inputs)**
| Q | Answer |
|---|---|
| Measures | Viewers reaching 25/50/75/100% of the video. |
| Why | The shape of drop-off = where the creative loses people (edit decisions). |
| Decision | Which second/scene to cut or re-order; retention-curve [B8] and decay [B9]. |
| Inputs | `video_p25/p50/p75/p100_watched_actions`. |
| Formula | Direct fields. |
| Source | Meta Insights. [02] Attention/video. |
| Window | value/prev; day-wise. |
| Min sample | 3-sec plays large enough for stable ratios. |
| Limitations | Quartiles only (coarse); %-of-length, not comparable second-for-second across lengths. |
| Don't trust when | Very short videos; low play counts. |

## B4 · Video average time watched
**LEVEL: ad/creative · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: WATCH (secondary)**
| Q | Answer |
|---|---|
| Measures | Mean seconds watched per impression/play (verify denominator basis at build). |
| Why | Single-number attention summary; complements the curve. |
| Decision | Secondary; supports edit/length decisions. |
| Inputs | `video_avg_time_watched`. |
| Formula | Direct field. |
| Source | Meta Insights. [02] Attention/video. |
| Window | value/prev/trend. |
| Min sample | as B3. |
| Limitations | Mean hides bimodal drop-off; denominator basis varies. |
| Don't trust when | Used instead of the curve; short creatives. |

## B5 · Hook rate  ⚠ DERIVED (not an official Meta field)
**LEVEL: ad/creative · [02]: CALC · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: PASS (primary creative signal)**
| Q | Answer |
|---|---|
| Measures | Share of impressions that became a 3-sec play — "did the opening stop the scroll?". |
| Why | Fastest read on the first-frame/hook; top creative-iteration lever. |
| Decision | Keep/kill/iterate the **hook**; prioritize new opening frames; fatigue [07] signal. |
| Inputs | `video_3_sec_watched_actions`, `impressions`. |
| Formula | **hook rate = 3-sec plays / impressions.** ([02] states this exact derivation.) |
| Source | **INTERNAL CALCULATION** over two OFFICIAL fields. Never label as a Meta metric. [02] "NOT an official field; a custom calc". |
| Window | value/prev/trend; day-wise for early fatigue. |
| Min sample | Impressions ≳ 1,000 (heuristic: ~±3pp CI on a proportion; validate via [14]). |
| Limitations | Autoplay/placement inflate the numerator; not comparable across placements (Reels vs Feed). |
| Don't trust when | Mixed placements pooled (Simpson's paradox — AUTOPSY); < ~1k impressions; sound-off contexts. |

## B6 · Hold rate  ⚠ DERIVED · 3 competing definitions — one chosen below
**LEVEL: ad/creative · [02]: CALC · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: PASS (primary creative signal)**

[02] explicitly flags that hold rate has **three competing definitions** and instructs: *pick one,
document it.* The three:

| # | Definition | Numerator | Denominator | Note |
|---|---|---|---|---|
| Def-1 (Meta-depth) | retention to 75% | `video_p75_watched` | `video_3_sec` | depth-of-watch flavor |
| Def-2 (industry 15s) | 15-second views | 15-sec views (proxy) | `video_3_sec` | classic "15-sec/3-sec"; no clean native 15s field → needs a proxy |
| Def-3 (ThruPlay) | ThruPlay watches | `video_thruplay` | `video_3_sec` | uses Meta's own meaningful-watch field |

**CHOSEN CANONICAL (AdBrain): Def-3 — hold rate = ThruPlay / 3-sec plays.**
Reason: both inputs are OFFICIAL Meta fields (no proxy needed, unlike Def-2), and ThruPlay is
Meta's own "meaningful watch" concept, making it the most defensible single definition. Def-1 is
retained as a secondary "deep-hold / 75% retention" metric; Def-2 is rejected (no native 15s field →
would require an unlabeled proxy). **All three definitions and this choice are surfaced in the
metric's hover/explainability so no one mistakes it for the only definition.**

| Q | Answer |
|---|---|
| Measures | Of those the hook caught (3-sec plays), the share held to a meaningful watch (ThruPlay). |
| Why | Separates "good hook, weak body" from "good all the way"; drives edit vs re-hook decisions. |
| Decision | Fix the **body/middle** of the video vs the hook; fatigue [07]; keep/kill. |
| Inputs | `video_thruplay_watched_actions`, `video_3_sec_watched_actions`. |
| Formula | **hold rate = ThruPlay / 3-sec plays** (canonical Def-3). |
| Source | INTERNAL CALCULATION over two OFFICIAL fields. [02] "hold rate … CALC DERIVED … pick one, document it". |
| Window | value/prev/trend; day-wise. |
| Min sample | 3-sec plays ≳ 1,000 (heuristic; validate via [14]). |
| Limitations | ThruPlay meaning changes with video length (<15s = completion); definition-dependent — cross-tool comparisons invalid unless same def. |
| Don't trust when | Comparing to another platform/tool using a different hold-rate definition; very short/long creatives pooled; small play counts. |

## B7 · Cost per ThruPlay / cost per 3-sec play
**LEVEL: ad/creative · [02]: CALC (spend ÷ FETCH count) · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: WATCH (secondary)**
| Q | Answer |
|---|---|
| Measures | Spend per meaningful video watch (ThruPlay) or per 3-sec play. |
| Why | Attention-buying efficiency; ties attention to money for upper-funnel objectives. |
| Decision | Upper-funnel/awareness efficiency triage; secondary to conversion economics. |
| Inputs | `spend`, `video_thruplay_watched_actions` (or 3-sec). |
| Formula | spend / ThruPlay (or / 3-sec plays). |
| Source | INTERNAL CALCULATION. [02] Attention/video + Delivery/spend. |
| Window | value/prev/trend. |
| Min sample | ThruPlays ≳ a few hundred (heuristic). |
| Limitations | Not a conversion metric; cheap attention ≠ business value. |
| Don't trust when | Used as a success metric for a conversion objective. |

## B8 · Retention curve
**LEVEL: creative · [02]: CALC (from p25–p100) · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: PASS (edit decisions)**
| Q | Answer |
|---|---|
| Measures | The drop-off shape across 0→25→50→75→100%. |
| Why | Pinpoints where viewers leave — the single most actionable editing insight. |
| Decision | Which scene/second to cut, shorten, or move; hook vs body diagnosis. |
| Inputs | 3-sec plays, p25/p50/p75/p100. |
| Formula | Normalized retention at each quartile (relative to 3-sec plays or impressions — document basis). |
| Source | INTERNAL CALCULATION over OFFICIAL fields. [02] "retention curve … CALC DERIVED". |
| Window | value/prev; compare across creative versions. |
| Min sample | 3-sec plays ≳ 1,000. |
| Limitations | Only 4 points (quartiles), %-based so length-sensitive; no per-second granularity from Meta. |
| Don't trust when | Comparing curves across very different lengths; low plays. |

## B9 · Attention decay
**LEVEL: creative · [02]: CALC · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: WATCH (fatigue input)**
| Q | Answer |
|---|---|
| Measures | Worsening of hook/hold/retention over time for the same creative. |
| Why | Attention-side early-warning of creative fatigue before CPA moves. |
| Decision | Fatigue [07] early-warning; pre-emptive refresh. |
| Inputs | daily hook rate / hold rate / retention series. |
| Formula | trend/slope of attention metrics over 7/14-day. |
| Source | INTERNAL CALCULATION. [02] "attention decay … CALC DERIVED". |
| Window | 7/14/21-day. |
| Min sample | ≥ 7 daily points, each with adequate volume. |
| Limitations | Confounded by audience/placement shifts; a signal not a verdict (fatigue is multi-signal). |
| Don't trust when | Placement/audience changed; sparse daily volume; used as sole fatigue call. |

## B10 · Landing page views (LPV) — *appears in both B and D*
**LEVEL: ad/adset · [02]: FETCH (LPV is an action type) · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS**
> LPV bridges attention→click→destination. Fully specified in **D6** to avoid duplication; noted
> here because it is the truest "did they actually arrive" attention-to-site signal.
> [02]: "landing_page_views … FETCH OFFICIAL / CALC."

---

# C · ENGAGEMENT
Reactions, comments, shares, saves, total post engagement. **Decision-gate caution:** most
engagement metrics are the brief's canonical *vanity* risk — high engagement rarely changes a buying
decision on its own. They stay here as **secondary/advanced** unless tied to a concrete decision
(social proof, comment-sentiment triage, share-driven distribution). Raw engagement action counts
are FETCH OFFICIAL (Meta action types); rates are DERIVED. *(Engagement rows are not itemized
individually in [02]; they are standard Insights `actions` of `post_engagement` type — verify exact
action-type names at build.)*

## C1 · Post engagement (total)
**LEVEL: ad/creative · [02]: FETCH (actions, post_engagement) · OFFICIAL PLATFORM FACT · DECISION-GATE: ADVANCED/VANITY — not primary**
| Q | Answer |
|---|---|
| Measures | Sum of engagement actions on the ad post. |
| Why | Coarse "did people interact" signal; weak proxy for resonance. |
| Decision | Rarely changes an action alone → secondary. Use only as context/social-proof. |
| Inputs | `actions` (post_engagement). |
| Formula | Direct field (sum of engagement action types). |
| Source | Meta Insights `actions`. Verify action-type names at build. |
| Window | value/prev/trend. |
| Min sample | impressions ≳ 1,000 for a rate. |
| Limitations | Mixes cheap (like) and costly (share) actions; not tied to revenue. |
| Don't trust when | Presented as a primary KPI (KILLCRITIC: vanity metric). |

## C2 · Reactions / likes
**LEVEL: ad/creative · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: ADVANCED/VANITY — not primary**
| Q | Answer |
|---|---|
| Measures | Count of reactions/likes. |
| Why | Lowest-cost engagement; minimal decision value. |
| Decision | Social-proof context only; not a buying decision. |
| Inputs | `actions` (like/reaction). |
| Formula | Direct field. |
| Source | Meta Insights. Verify names at build. |
| Window | value/prev. |
| Min sample | as C1. |
| Limitations | Easiest to game; near-zero economic signal. |
| Don't trust when | Used to rank creatives (vanity). |

## C3 · Comments
**LEVEL: ad/creative · [02]: FETCH (count) + EXTERNAL/INFERENCE (text/sentiment) · OFFICIAL PLATFORM FACT (count) · DECISION-GATE: PASS (only with sentiment) / else secondary**
| Q | Answer |
|---|---|
| Measures | Comment count on the ad. |
| Why | Volume is weak; **sentiment/objection content is decision-grade** (feeds creative angle + CRO). |
| Decision | If sentiment-analyzed: address objections, harvest angles, flag negative pile-ons. Count alone: secondary. |
| Inputs | `actions` (comment); comment text = EXTERNAL (a fetch beyond Insights aggregates). |
| Formula | Direct count; sentiment = separate NLP (INFERENCE, with confidence). |
| Source | Count: Meta OFFICIAL. Text/sentiment: EXTERNAL + INFERENCE. |
| Window | value/prev. |
| Min sample | enough comments to read sentiment (heuristic ≳ 20). |
| Limitations | Count says nothing about polarity; negative comments can inflate the count. |
| Don't trust when | Judging creative on comment *count*; sentiment on tiny volume. |

## C4 · Shares
**LEVEL: ad/creative · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS (organic-distribution signal)**
| Q | Answer |
|---|---|
| Measures | Times the ad was shared. |
| Why | The engagement action with real signal — earned distribution + strong resonance. |
| Decision | Double-down on shareable concepts; concept/angle library [06] input. |
| Inputs | `actions` (share). |
| Formula | Direct field; share rate = shares / impressions (DERIVED). |
| Source | Meta OFFICIAL (count). |
| Window | value/prev/trend. |
| Min sample | impressions ≳ 1,000 for a rate. |
| Limitations | Rare event → noisy at low volume. |
| Don't trust when | Low impressions; share rate on a tiny base. |

## C5 · Saves
**LEVEL: ad/creative · [02]: FETCH (verify availability) · OFFICIAL PLATFORM FACT (if returned) / else UNKNOWN · DECISION-GATE: WATCH**
| Q | Answer |
|---|---|
| Measures | Times users saved the ad/post. |
| Why | High-intent bookmark signal (consideration). |
| Decision | Consideration-content signal; secondary. |
| Inputs | `actions` (save) — **verify this action type is exposed via Insights at build**. |
| Formula | Direct field if present. |
| Source | Meta OFFICIAL **if returned**; otherwise UNKNOWN — do not fabricate. |
| Window | value/prev. |
| Min sample | as C4. |
| Limitations | May not be available for all objectives/placements. |
| Don't trust when | Field absent (mark UNKNOWN, don't infer). |

## C6 · Engagement rate  ⚠ DERIVED
**LEVEL: ad/creative · [02]: CALC · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: ADVANCED/VANITY — not primary**
| Q | Answer |
|---|---|
| Measures | Engagement actions per impression (or per reach). |
| Why | Normalizes engagement by delivery; still low decision value. |
| Decision | Secondary context; not a buying decision. |
| Inputs | `post_engagement`, `impressions` (or `reach`). |
| Formula | engagement / impressions. **Document impressions-vs-reach basis** (they differ). |
| Source | INTERNAL CALCULATION over OFFICIAL fields. |
| Window | value/prev/trend. |
| Min sample | impressions ≳ 1,000. |
| Limitations | Definition-sensitive (which actions count; which denominator); vanity risk. |
| Don't trust when | Compared across tools with different definitions; used as a primary KPI. |

## C7 · Cost per engagement (CPE)
**LEVEL: ad/creative · [02]: CALC · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: WATCH (engagement-objective only)**
| Q | Answer |
|---|---|
| Measures | Spend per engagement action. |
| Why | Efficiency only when engagement IS the objective. |
| Decision | Engagement-objective campaign triage; else ignore. |
| Inputs | `spend`, `post_engagement`. |
| Formula | spend / engagement actions. |
| Source | INTERNAL CALCULATION. |
| Window | value/prev/trend. |
| Min sample | engagements ≳ a few hundred. |
| Limitations | Meaningless for conversion objectives. |
| Don't trust when | Applied to a conversion/sales campaign. |

---

# D · CLICK QUALITY
Not "clicks" — **click quality**: whether clicks are real link clicks, whether they survive to the
landing page, and where the drop-off is. This is where cheap-CTR creatives get exposed. Raw click
and LPV counts are FETCH OFFICIAL; every rate and every "connection/drop-off" metric is DERIVED.

## D1 · Clicks (all)
**LEVEL: any · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: WATCH (too broad alone)**
| Q | Answer |
|---|---|
| Measures | All clicks (includes non-link: expands, likes, page clicks, etc.). |
| Why | Broadest, noisiest click count; mainly a denominator/context. |
| Decision | Little alone — use link clicks (D3) for creative decisions. |
| Inputs | `clicks`. |
| Formula | Direct field. |
| Source | Meta Insights `clicks`. [02] Delivery/spend. |
| Window | value/prev/trend. |
| Min sample | impressions ≳ 1,000 for a rate. |
| Limitations | Includes clicks that never intended to leave the ad → overstates intent. |
| Don't trust when | Used as "traffic"; use link clicks / LPV instead. |

## D2 · CTR (all)
**LEVEL: any · [02]: FETCH OFFICIAL (also CALC identity) · OFFICIAL PLATFORM FACT · DECISION-GATE: WATCH**
| Q | Answer |
|---|---|
| Measures | All clicks / impressions. |
| Why | Broad interest signal; inflated by non-link clicks. |
| Decision | Weak; prefer link CTR (D4) for creative keep/kill. |
| Inputs | `ctr` (or `clicks`, `impressions`). |
| Formula | Meta field; identity = clicks / impressions. |
| Source | Meta Insights `ctr`. [02] Delivery/spend. |
| Window | value/prev/trend; day-wise for fatigue. |
| Min sample | impressions ≳ 1,000 (heuristic; ~±2–3pp CI). |
| Limitations | "All" clicks overstate destination intent. |
| Don't trust when | Treated as link-click intent; small impressions; mixed placements. |

## D3 · Link clicks (inline_link_clicks)
**LEVEL: any · [02]: FETCH · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS**
| Q | Answer |
|---|---|
| Measures | Clicks on the ad's link specifically. |
| Why | The real "intent to leave to our destination" count. |
| Decision | Creative keep/kill on click intent; numerator for link CTR + cost-per-link-click. |
| Inputs | `inline_link_clicks`. |
| Formula | Direct field. |
| Source | Meta Insights `inline_link_clicks`. [02]: "link CTR uses inline_link_clicks". |
| Window | value/prev/trend. |
| Min sample | impressions ≳ 1,000. |
| Limitations | Still upstream of the site (a click ≠ a landing — see D6/D8). |
| Don't trust when | Assumed equal to site arrivals (that's LPV, D6). |

## D4 · Link CTR
**LEVEL: any · [02]: FETCH OFFICIAL / CALC identity · OFFICIAL PLATFORM FACT (Meta reports it) · DECISION-GATE: PASS (primary click signal)**
| Q | Answer |
|---|---|
| Measures | Link clicks / impressions. |
| Why | Cleanest on-platform intent-per-impression; core creative signal. |
| Decision | Keep/kill/iterate creative on click intent; fatigue [07] input. |
| Inputs | `inline_link_clicks`, `impressions` (Meta also exposes the rate directly). |
| Formula | inline_link_clicks / impressions. |
| Source | Meta Insights (rate) / INTERNAL CALCULATION (identity). [02] Delivery/spend. |
| Window | value/prev/trend; day-wise. |
| Min sample | impressions ≳ 1,000 (heuristic). |
| Limitations | Placement-sensitive; high CTR + low LPV = curiosity/misleading creative (see D8). |
| Don't trust when | Placements pooled (Simpson's — AUTOPSY); judged without LPV follow-through. |

## D5 · Outbound clicks / outbound CTR
**LEVEL: any · [02]: FETCH (if returned) · OFFICIAL PLATFORM FACT / else UNKNOWN · DECISION-GATE: WATCH**
| Q | Answer |
|---|---|
| Measures | Clicks that left Meta entirely (outbound), and their rate. |
| Why | Stricter than link clicks (excludes clicks to on-Meta destinations). |
| Decision | Off-platform intent quality; secondary to link CTR + LPV. |
| Inputs | `outbound_clicks`, `outbound_clicks_ctr` — **verify exposure at build**. |
| Formula | outbound_clicks / impressions. |
| Source | Meta OFFICIAL if returned; else UNKNOWN. |
| Window | value/prev/trend. |
| Min sample | impressions ≳ 1,000. |
| Limitations | Overlaps link clicks; availability varies by objective. |
| Don't trust when | Field absent (mark UNKNOWN); conflated with link clicks. |

## D6 · Landing page views (LPV)
**LEVEL: ad/adset · [02]: FETCH (LPV is an action type) · OFFICIAL PLATFORM FACT · DECISION-GATE: PASS**
| Q | Answer |
|---|---|
| Measures | Times a person clicked AND the landing page actually loaded (Meta pixel-confirmed). |
| Why | The truest "did they arrive" count — filters bounced/abandoned clicks. |
| Decision | Real-traffic quality; denominator for on-site CVR; good-creative/bad-LP triage. |
| Inputs | `landing_page_views` (actions). |
| Formula | Direct action count. |
| Source | Meta Insights (action type). [02]: "landing_page_views … FETCH OFFICIAL / CALC". |
| Window | value/prev/trend. |
| Min sample | link clicks ≳ a few hundred to read the connection ratio. |
| Limitations | Requires pixel firing; blocked/slow pixels undercount (attribution/privacy — [02] hard limits). |
| Don't trust when | Pixel/consent issues; iOS/privacy gaps flagged per [02]. |

## D7 · LPV rate / cost per LPV (CPLPV)
**LEVEL: ad/adset · [02]: FETCH+CALC · OFFICIAL (count) + INTERNAL CALCULATION (rate/cost, DERIVED) · DECISION-GATE: PASS**
| Q | Answer |
|---|---|
| Measures | LPV per impression (rate) and spend per LPV (cost). |
| Why | Efficiency of buying actual site arrivals. |
| Decision | Traffic-efficiency triage; upstream of conversion economics. |
| Inputs | `landing_page_views`, `impressions`, `spend`. |
| Formula | LPV rate = LPV / impressions; CPLPV = spend / LPV. |
| Source | INTERNAL CALCULATION over OFFICIAL fields. [02] Attention/video (lpv_rate, cost_per_lpv). |
| Window | value/prev/trend. |
| Min sample | LPV ≳ a few hundred. |
| Limitations | Pixel-dependent; not a conversion. |
| Don't trust when | Pixel undercount; small LPV base. |

## D8 · Click-to-LPV connection rate  ⚠ DERIVED (the click-quality core)
**LEVEL: ad/adset · [02]: CALC · INTERNAL CALCULATION (DERIVED) · DECISION-GATE: PASS (primary diagnostic)**
| Q | Answer |
|---|---|
| Measures | Of link clicks, the share that became landing-page views. |
| Why | **The click-quality metric.** Low ratio = clicks not surviving to site = misleading creative, slow LP, dead link, or pixel gap. |
| Decision | Fix LP speed / link / creative honesty; separates "bad creative" from "bad landing". |
| Inputs | `landing_page_views`, `inline_link_clicks`. |
| Formula | LPV / link clicks (report as %). |
| Source | INTERNAL CALCULATION over two OFFICIAL fields. Derived from [02] LPV + link-click rows. |
| Window | value/prev/trend. |
| Min sample | link clicks ≳ a few hundred. |
| Limitations | Low ratio has multiple causes (LP speed, pixel, mobile, link error) — diagnostic not verdict; pixel/consent confounds. |
| Don't trust when | Pixel/consent issues (undercount LPV → false-low ratio); small clicks; iOS/privacy gaps ([02]). |

## D9 · CPC (all) and cost per link click
**LEVEL: any · [02]: FETCH OFFICIAL / CALC identity · OFFICIAL PLATFORM FACT · DECISION-GATE: WATCH → PASS (link variant)**
| Q | Answer |
|---|---|
| Measures | Spend per click (all) and spend per link click. |
| Why | Cost of buying clicks/intent; the link variant is the meaningful one. |
| Decision | Traffic-cost triage; scaling [11] cost-side; prefer cost-per-link-click over CPC(all). |
| Inputs | `cpc` (all), `spend`, `inline_link_clicks`. |
| Formula | CPC(all)=spend/clicks; cost-per-link-click = spend / inline_link_clicks. |
| Source | Meta `cpc` OFFICIAL; link variant = INTERNAL CALCULATION. [02] Delivery/spend. |
| Window | value/prev/trend. |
| Min sample | clicks ≳ a few hundred. |
| Limitations | Cheap clicks can be low-quality (pair with D8); CPC(all) noisier than link variant. |
| Don't trust when | Optimizing CPC(all) while LPV/conversion collapse; small click counts. |

---

## Cross-cutting notes for these four categories
- **Attention trap (restated):** B5/B6/B8/B9 are DERIVED. In every dashboard hover they must read
  "INTERNAL CALCULATION (DERIVED) from official Meta fields", never "Meta metric". Hold rate carries
  its chosen definition (ThruPlay / 3-sec) plus the two alternates.
- **Placement pooling = Simpson's paradox risk** (AUTOPSY) on every rate (hook rate, CTR, link CTR,
  connection rate). Prefer per-placement reads or flag when pooled.
- **Minimum samples here are INTERNAL CALCULATION heuristics** (proportion-CI reasoning), not
  platform facts — the Confidence engine [14] sets the live thresholds; validate against real data.
- **No benchmark numbers are asserted.** All "compare against" defer to the Benchmark engine [27],
  which must return source/date/sample/confidence or "benchmark unavailable".
- **Attribution/privacy caveat** ([02] hard limits) applies to D6–D8: LPV and connection rate depend
  on pixel firing; iOS/consent gaps undercount — surface the attribution-limit flag on these views.
- **Field-name verification:** action-type and video-field names (ThruPlay, 3-sec, p25–100, outbound,
  save) are API-version dependent — verify each at build; where availability is unconfirmed the
  metric is marked UNKNOWN rather than fabricated.
