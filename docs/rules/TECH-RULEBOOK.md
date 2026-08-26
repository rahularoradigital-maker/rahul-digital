# AdBrain Tech Rulebook

**Version 1.0 &middot; August 2026 &middot; the single source of truth for the tech team**

This document turns every decision we have made about the product into rules and formulas. If a question comes up about how something should work, the answer is here. If it is not here, it is not decided yet, so flag it, do not guess.

It is written in plain words on purpose. A new engineer should follow it on the first read. Money is written as "Rs" or "USD", never a symbol. There are no em dashes anywhere, by rule.

**Companion files (read together):**
- `AdBrain_METRIC_BREAKDOWN.html` - the 25 metrics in two tiers, with every formula, source and lever.
- `AdBrain_ACTION_DASHBOARD.html` - the working mockup of the dashboard, every tile carries its own spec.
- `AdBrain_MEASUREMENT_CANON.html` - the editable weighted scorecards.
- `AdBrain_BUILD_PHASES.html` - the architecture, data model and build order.

**Precedence:** where a weight or formula appears in more than one file, the Measurement Canon wins, then this rulebook, then the rest.

---

## 0. The eleven laws (the non-negotiables)

Everything below is detail. These eleven are the spine. If a feature breaks one of these, the feature is wrong, not the law.

1. **No screen ships unless it ends in a ranked action with a number in it.** A metric on its own is not a feature. The question every panel answers is "what do I do, and how much is it worth", not "what is happening".

2. **Describe less, decide more.** The user is drowning in data. Every new pixel must earn its place by moving someone closer to a decision.

3. **The dashboard leads with the future.** What will break in the next 7 and 14 days comes first, above what already happened. Act in advance, not after.

4. **Point at the exact thing.** Never "improve diversity". Always "stop these 10 ad ids, keep this 1". Name the ad, the metric, the day.

5. **Read the account day by day, 60 to 90 days back.** Never a single average. The slope is the insight.

6. **Compare a brand to itself first.** Public benchmarks are context for a client conversation, never an input to a score. The account's own trailing history is the only fair line.

7. **Measurement is a gate, not a score.** If sales are not reaching the platform, every other number is fiction, so the whole board is suppressed until the ruler is fixed.

8. **Every number carries a trust gate and a confidence.** State until when a number is not worthy of a decision, and how sure we are given the data sources connected.

9. **AdBrain recommends, a human acts.** For the next 12 months nothing launches or pauses on its own. The record of human decisions is the asset.

10. **Write everything to the ledger.** Every recommendation, every human decision, every 30-day outcome. Append only, never edited. This is the one thing a competitor cannot copy.

11. **Causality first.** Before you define any formula or fetch any field, define what makes the metric move and what it moves next. Formulas and data needs are derived from the cause-and-effect chain, not the other way round. When a number moves, diagnose by walking the cause tree in order and ruling causes out, never jump to the obvious one.

12. **The spend floor is the first filter, implement it before anything else.** The system never considers any ad, ad set, or creative that has not spent above **Rs 300 (or USD 5) in the last 7 days**. This filter runs at ingest, the moment data arrives from the Meta API, before any score, grade, trend or comparison. A number built on tiny spend is noise, and noise must never reach a decision. Build this gate first.

13. **Compare like with like: same objective only.** Any in-account comparison of an ad is made only against the average of ads with the same campaign objective. A conversion ad is judged against other conversion ads, never against traffic or engagement ads. This apple-to-apple rule applies to every objective, and the account's own 180 to 365 day history carries the most weight in that comparison.

---

## 1. Core doctrine: from information to decisions

The old tool showed a lot and decided nothing. This one is built the other way round. The pipeline is always:

```
raw day-wise data  ->  metrics (2 tiers)  ->  engines  ->  a ranked action with a number
```

Three layers, and the value is only in the last one.

- **Layer 1, the dials (Tier 2 metrics).** Easy to fetch, they describe. CPM went up. Hook rate fell.
- **Layer 2, the truth (Tier 1 metrics).** Hard to compute, they judge. Contribution ROAS, nCAC, half-life.
- **Layer 3, the decision (engines).** They rank and point. Stop this ad, shoot this concept, expected plus 6 percent ROAS.

A media buyer should be able to open the dashboard, read one verdict line, and know exactly what to do this week without scrolling. Everything else is the working behind that line, available on click for the tech team and the curious.

---

## The operating mind: how a top 0.1% media buyer thinks

A tool is only as good as the judgment it encodes. This is the mental model of the best buyers in the world, the ones running USD 100M to 1B a month. Every engine in this rulebook exists to apply one of these principles automatically, at a scale no human can hold in their head. Read this section as the "why" behind all the maths.

The elite operator does not think in dashboards. They think in a small number of hard truths.

1. **Spend on the margin, not the average.** The average ROAS can look healthy while the next rupee already loses money. They allocate budget like a portfolio, always pushing the next rupee to where it earns most, and they stop the moment the marginal return crosses break-even. *Wired in: the marginal ROAS engine (5.x) and the growth diagnosis, which read the slope at today's spend, not the flattering average.*

2. **Profit is the only scoreboard.** Not platform ROAS, not revenue. Contribution margin after every cost, and how fast the cash comes back. They will happily lose money on the first order if payback and lifetime value justify it, and they will kill a 6x ROAS campaign that is quietly unprofitable on margin. *Wired in: contribution ROAS, LTV to CAC with payback, contribution margin as Tier 1 truth metrics that gate every decision.*

3. **The platform lies, and incrementality is the only truth.** Meta and Google both claim the same sale. The elite buyer discounts every platform number and runs a holdout before any big budget shift, because the only honest question is "would this sale have happened anyway". *Wired in: the incrementality engine, signal-adjusted MER, and the rule that platform ROAS is a within-platform sorting tool, never a profit statement.*

4. **At scale, creative is the only lever left.** Targeting is automated, bidding is automated. The one thing a buyer still controls is the creative: how much, how different, how fresh. Winning at USD 1B a month is a creative-volume and creative-diversity game, not a targeting game. *Wired in: the diversity engine, half-life, the concept engine, and the creative-mix comparison.*

5. **Kill fast, scale slow, feel nothing.** No attachment to an ad because it was expensive to make or someone loved it. Losers are stopped without ego. Winners are scaled 30 percent at a time to protect the learning, never doubled overnight. *Wired in: the Scale, Continue, Stop gates, and the "scale by 30 percent" rule.*

6. **Think in ranges and confidence, never a single number.** Every metric is a distribution, not a point. The elite buyer acts on how sure they are, and waits for enough data before betting. A number from 200 impressions is a rumour, not a fact. *Wired in: the confidence ladder and the trust gates, which state until when a number is not worthy of a decision.*

7. **Everything is second-order.** Scaling raises frequency, which raises CPM, which lowers ROAS. A discount lifts today's sales and recruits worse repeat cohorts. A hook that wins this week fatigues next week. The best buyers think two moves ahead, always. *Wired in: causality (Section 4.4), the fatigue exposure curve, and the cohort and return-rate metrics.*

8. **Diagnose in order, never guess the cause.** When a number moves, they do not blame the loudest suspect. They rule out measurement, then tracking, then auction, then funnel, then stock, before they ever touch creative. *Wired in: the causality ladder and the ranked 627-cause library.*

9. **Protect the account like capital.** Never bet the whole account on one test. Caps, guardrails, measurement checked first, holdouts before large shifts. Survival beats a good week. *Wired in: the signal-quality gate, the daily auto-pause cap, and "never stop without replacements queued".*

10. **New customers are growth, repeat buyers are profit, and blended numbers hide both.** They watch new-customer CAC and new-customer share, not blended vanity, because a channel can look cheap while only re-selling to people who were already coming. *Wired in: nCAC, new-customer percent, and blended new-customer ROAS.*

11. **Cash and speed decide how fast you can scale, not ROAS.** Payback period and cash conversion are the real speed limit. A brand with 3-month payback can outspend a brand with 12-month payback at the same ROAS. *Wired in: CAC payback and the profit-truth dimension of account health.*

12. **Reduce everything to one number and one action.** At a billion a month there is no time to read five screens. The whole account collapses to a single verdict and a single next move, with the working available on demand. *Wired in: the one-number verdict and the "no screen ships without a ranked action" law.*

**The point of the tool is this:** a top 0.1% buyer applies these twelve truths to a handful of accounts by instinct. AdBrain applies them to every account, on every ad, every day, with the maths written down so the judgment is consistent and never forgotten. The engines are not clever features. They are these twelve instincts, encoded.

---

## 2. Data sources and the confidence ladder

### 2.1 The five sources

| Code | Source | Gives us | How to pull |
|---|---|---|---|
| `META` | Meta Marketing API v20 | spend, impressions, reach, clicks, video views, actions, fatigue inputs | `GET /{ad-account}/insights` with `level=ad`, `time_increment=1`, `date_preset=last_90d` |
| `GA4` | GA4 Data API | sessions, funnel step events, channel and source, engagement | `runReport` with `dimensions=[date, sessionDefaultChannelGroup]`, funnel metrics |
| `SHOP` | Shopify Admin API | real orders, revenue, returns, stock, new vs returning | `GET /orders.json`, `/products.json` for stock, customer `orders_count` for new vs returning |
| `FIN` | Finance sheet (typed) | COGS, shipping, fees, production cost | a human keeps it current, no API exists |
| `DECODE + FPRINT` | our decoder and fingerprinter | hook, angle, persona, format, language, and vision plus text embeddings per ad | frame at 1 fps, transcribe, classify, embed. Store embeddings forever, frames 30 days |
| `3P` | Triple Whale / Northbeam / Wicked | blended MER, pixel ROAS, attribution truth | vendor API or export |
| `ADLIB` | Meta Ad Library (public) | every live ad of any competitor | public, no login, decoded the same way as ours |

### 2.2 The confidence ladder (this is a rule, encode it)

Every action shows a confidence score, and that score **rises as more data sources are connected**. This is not decoration, it tells the user which recommendations to trust today and what to connect to trust more.

```
confidence(action) is defined at four levels:

  L0  Dashboard only (META)          base
  L1  + GA4                          + funnel truth
  L2  + Shopify                      + real money and new-customer truth
  L3  + 3rd-party tracking           + attribution truth

Rule: confidence must be non-decreasing across the levels.
      conf.dash <= conf.ga4 <= conf.shop <= conf.tp
```

**The key design rule:** creative and delivery actions are confident on the dashboard alone, because Meta owns that data. Economic actions are not, because they need Shopify and finance. So:

- A fatigue "stop this ad" is ~90 percent on dashboard-only. Meta owns the fatigue inputs.
- A "your ATC rate is the ROAS leak" is ~55 percent on dashboard-only, ~85 with GA4, because it needs site funnel data.
- A "contribution ROAS is really 1.28, not 4.0" is ~40 percent on dashboard-only, ~88 with Shopify plus finance, because it needs COGS.
- An "nCAC is 80 percent higher than blended CAC" is ~45 on dashboard, ~94 with 3rd-party, because it needs the new-customer join and clean attribution.

The UI shows the current level, the current percent, and one line: "connect Shopify to raise this to 90 percent". The user then knows exactly what to wire up next and why.

---

## 2A. The spend floor: the first filter, build this before anything else

**Nothing enters the system until it has spent above Rs 300 (or USD 5) in the last 7 days.** This is the very first thing to build, and it runs at the point of ingest, before any score, grade, trend, comparison or recommendation.

```
FILTER (runs at ingest, on every ad / ad set / creative from the Meta API):
   keep only rows where  spend_last_7_days > 300 INR   (or 5 USD, by account currency)
   everything below the floor is set aside as "low data", never scored, never compared,
   never shown in Scale/Stop/Winner logic.
```

Why it is first: a number built on tiny spend is noise. An 8x ROAS on Rs 200 of spend and 2 purchases is not a winner, it is a coin toss. If noise reaches a decision, the whole system loses trust. The currency for the threshold is read from the auto-detected account currency (Section 5A.1), so USD accounts use 5 USD, INR accounts use Rs 300.

Low-data items are not deleted, they are held in a "not enough data yet, keep testing" state and re-checked each day until they cross the floor.

## 3. How the tool learns: 60 to 90 days, day by day

This is the engine room. Read it carefully, it drives everything downstream.

**Pull the last 60 to 90 days at `time_increment=1`, one row per creative per day.** A single average hides a dying creative. A day-wise series shows the decay slope, the weekday pattern, the festival spike, and the exact day a trend will cross a line.

From that day-wise history the tool learns four things:

1. **Winning patterns.** Which decoded elements (hook, angle, format, talent, offer) correlate with winners, and how fast each fatigues. This tells us what to make more of.
2. **The account's own healthy ranges.** Never a public benchmark. Its own trailing normal for CPM, CTR, ATC rate, and so on, so a drop is measured against itself.
3. **The seasonal shape.** Festival weeks and dips, so a festival CPM rise is not mistaken for a problem.
4. **The competitor gaps.** By decoding the public Ad Library daily, which hooks and angles rivals own, which are open, and the day a rival started copying a hook we owned.

Those four feed the next steps, the early warnings, and the new concepts. **If any of the four cannot be computed, say so on the affected tiles, never fill the gap with a guess.**

---

## 4. The metric system: two tiers, funnel, priority

### 4.1 Two tiers

- **Tier 2, easy to get.** Raw dials, one API call or one division. Capture all of them from day one. Twelve of them: CPM, CTR, CPC, frequency, hook rate, hold rate, add-to-cart rate, checkout completion, site CVR, AOV, platform ROAS, cost per purchase.
- **Tier 1, hard to get and calculate.** Truth metrics, each built from Tier 2 numbers plus one hard ingredient. Thirteen of them: MER, new customer percent, win rate, cost per winner, contribution ROAS, nCAC, blended new-customer ROAS, LTV to CAC, contribution margin, half-life, diversity, marginal ROAS, incrementality.

**The wiring rule:** a Tier 1 metric cannot be computed without its Tier 2 inputs plus its one hard ingredient. Build order is fixed: capture Tier 2 first, then add the four hard ingredients (finance sheet, customer join, decoder, holdout), then Tier 1 lights up. Miss one hard ingredient and a whole row of Tier 1 stays dark.

### 4.2 Funnel stage (TOF, MOF, BOF) on every metric and every action

Every metric and every action belongs to a funnel stage. Tag it, show it, and judge it by the right yardstick for that stage.

| Stage | What it is | Metrics that matter here | What creative works |
|---|---|---|---|
| **TOF** | awareness, new people | CPM, reach, frequency, hook rate, thumbstop, video quartiles, CTR | broad, problem-first, strong 3-second hooks, new angles. Judged on stopping the scroll, not ROAS |
| **MOF** | consideration, weighing it | hold rate, landing views, view content, ATC rate, ATC / landing, time on page | demos, comparisons, product realism, reviews. Judged on moving interest to cart. Most brands starve this stage |
| **BOF** | conversion, ready to buy | checkout rate, purchase rate, CPA, ROAS, AOV, retargeting frequency, return rate | offers, urgency, price justification, guarantees, retargeting. Judged on closing and protecting margin |

**Rule:** never judge a TOF creative on ROAS or a BOF creative on hook rate. Score each ad on the yardstick of its own stage.

### 4.3 Priority (P0 to P5), a dependency ladder not an importance ranking

- **P0** raw, must fetch first. Everything derives from these. Spend, impressions, clicks, purchases, revenue, sessions, add-to-cart, leads, COGS.
- **P1** first build. CPM, CPC, CTR, CVR, ROAS, CPA, AOV, CAC.
- **P2** second build. Cost per ATC, hook rate, ATC to landing, MER, contribution margin.
- **P3** deeper diagnosis. Checkout to cart, frequency, quartile completion, retention.
- **P4** cohort, long run. LTV, payback, LTV to CAC, cohort ROAS.
- **P5** advanced, modeled. Marginal ROAS, incrementality, signal-adjusted MER.

The ladder tells the tech team what to wire up first. CPM is P2 because it needs P0 spend and P0 impressions. nCAC is P1 but depends on P0 spend and P0 new-customer conversions, and cannot be fetched, only built.

### 4.4 Causality: the chain that defines every formula and every data need

This is the map the whole system is built on. **Before we write a formula or decide what to fetch, we define the causal chain of the metric: what makes it move, and what it moves next.** Formulas and data needs come out of the causal chain, not the other way round. If we do not know the cause, we do not know what to fetch or what to fix.

Every metric carries a three-part causal record, the same shape used in the metrics library:

```
UP when:          the specific causes that raise it
DOWN when:        the specific causes that lower it
Then this moves:  the downstream metrics it pushes, and in which direction
```

Example, CPM:
```
UP when:          more advertisers crowd the auction, the audience is too narrow,
                  frequency climbs, festival demand spikes.
DOWN when:        the auction empties after a sale, the audience is widened,
                  fresh creative earns better delivery.
Then this moves:  CPC up, CPA up, ROAS down unless conversion rate improves.
```

Two rules follow, and they govern the entire build.

**Rule A, define needs from causes.** The data we fetch for a metric is exactly the set of inputs its causes and its formula require, no more. We do not add a field unless a cause or a formula needs it. This keeps the pipeline lean and every field justified. When someone asks "why are we fetching this", the answer is always "because this cause depends on it".

**Rule B, diagnose in causal order (the causality ladder).** When a metric moves, do not blame the obvious thing. Walk the cause tree from root to leaf and rule causes out in order. The classic example, a ROAS drop. Rule out in this order before touching creative:

```
1. Is measurement broken?           (the gate, always first)
2. Did tracking or attribution change?
3. Did CPM rise from the auction?
4. Did the landing page or checkout break?
5. Did a hero SKU run out of stock?
6. Is the audience genuinely saturated?
7. Only now: creative fatigue.
```

We ship the full ranked cause list (44 signals, 627 ranked causes, each with its likely-cause order and a discriminating check) so the tool checks the likely causes first and never jumps to the last one. The severity of a moved metric depends on its cause, not its size: a 30 percent ROAS drop caused by a broken pixel is a black-level emergency, the same drop caused by a festival auction is expected and green.

**This is why every metric has a "what moves it, what it moves next" field, and why the diagnosis engine ranks causes by likelihood before it acts.** Causality is not a nice-to-have. It is the map that tells us what to compute, what to fetch, and what to fix, in that order.

### 4C. Compare like with like: same objective, and lean on our own history

Two rules for every comparison we make inside an account.

**Rule 1, same objective only.** When we judge one ad, we compare it only with other ads that have the same campaign objective. Say an account has 100 live ads across 5 campaigns. One campaign is engagement, one is traffic, and three are conversion. Those three conversion campaigns hold 20 ad sets and 80 of the 100 ads. If we want to judge one ad that sits inside those conversion ad sets, we compare it only against the average of those 80 conversion ads. We never compare it with the traffic or engagement ads, because they are doing a different job. This is a fair, apple to apple comparison, and it applies to every objective: prospecting against prospecting, retargeting against retargeting, lead-gen against lead-gen.

**Rule 2, our own history counts the most.** In that comparison, the biggest weight goes to the account's own past, 180 to 365 days of it. A number that has held true for this brand for a year is more trustworthy than any outside benchmark. So the "average to beat" is built mostly from the account's own long history for that same objective, and the outside world is only a light check.

```
objective_average(metric) = average of that metric across all ads with the
                            SAME objective that passed the spend floor,
                            weighted mostly by 180 to 365 day account history.

ad_score(metric) = how far this ad sits above or below its objective_average.
```

Why it matters: a Rs 250 cost per order is good under one objective and bad under another. Judging every ad against one account-wide average would be wrong. Same objective, own history first.

---

## 5. The engines

Each engine takes metrics in and puts a ranked action out. Every one has the same five parts: what it needs, the formula, the output in absolute terms, the trust gate, and the confidence. **And every engine that explains a "why" must walk the causal ladder from Section 4.4, ruling causes out in order, before it names a cause or an action.**

### 5.1 Creative fatigue and half-life

**Fatigue score (higher is worse):**
```
Fatigue = 0.40 x exposure_fatigue      (Meta's own published curve)
        + 0.30 x cost_confirmation      (cost per result vs our past ads)
        + 0.15 x ctr_decay
        + 0.10 x annoyance              (negative feedback, quality ranking slide)
        + 0.05 x age_vs_half_life

exposure_fatigue = 100 x (1 - (N+1)^-0.4)
  N = average times a person saw THIS creative, rolled up across every ad set it runs in
```

**Half-life (a death date, per creative):**
```
N_half solved from  CTR_first x (N+1)^-0.4 = 0.5 x CTR_first   ->  N_half ~ 4.66
days_to_death = (N_half - N_now) / daily_exposure_gain
daily_exposure_gain = impressions_per_day / reach_per_day
death_date = today + days_to_death
```

**Trust gate:** needs at least 3 days live and 1,000+ impressions a day for the creative. Below that, show "still learning", not a date. New creatives borrow the account half-life for their angle until they have their own 3 days.

**Rule:** never trigger fatigue on a frequency threshold. Meta's own research says frequency is the wrong unit. We use the curve at creative level.

### 5.2 Diversity and retrieval distinctness

```
Diversity = weighted variety across hook, angle, persona, funnel, format, language,
            plus retrieval distinctness, minus duplicate spend concentration

retrieval_distinctness = 100 x (1 - ads_inside_a_cluster / active_ads)
cluster two ads when  cosine(0.6 x vision_fp + 0.4 x text_fp) > 0.92
```

**Rule:** measure diversity on the portfolio we supplied, not on the spend Meta allocated. Meta concentrates budget on purpose, so a spend-based score punishes us for Meta's choice. And measure distinctness to Meta's eye (the fingerprint), not the human eye, because Meta treats two ads with different text over the same image as one.

**Trust gate:** every live ad must be decoded and fingerprinted. Any undecoded ad is shown as "pending", never counted as distinct.

### 5.3 Message-gap (competitive)

```
For each buyer motivator m:
  our_coverage(m)   = spend share of OUR ads carrying m
  comp_coverage(m)  = best coverage of m among tracked competitors
  market_weight(m)  = share of category attention on m   (weights sum to 1.00)

MessageMarketFit = sum over m of  market_weight(m) x min(100, our_coverage(m))
GapScore(m)      = market_weight(m) x max(0, comp_coverage(m) - our_coverage(m))
```

Rank motivators by GapScore. The top one is the message to add. This replaces subjective "7 out of 10" scores with a computed, defensible number.

### 5.4 ROAS driver decomposition (which lever to pull)

```
ROAS = ( CTR x LP_rate x ATC_rate x Checkout_rate x Purchase_rate x AOV x 1000 ) / CPM

Because ROAS is a product of these parts, a 10 percent lift in ANY part
changes ROAS by the same 10 percent. So rank the parts by:

LeverPriority = GapVsOwnBest x Movability
```

The top lever is where the next rupee of effort goes. Usually it is not the hook everyone argues about, it is a funnel step like ATC rate.

### 5.5 Creative mix and funnel mix (vs competitor and AI)

```
mix_share(x) = spend_on_x / total_spend x 100     (per format, per funnel stage)
gap(x)       = our_share(x) - recommended_share(x)
```

Three columns, always: **our mix, competitor average, AI recommended.**

- **Our mix** from decoding our own ads, weighted by spend.
- **Competitor average** from decoding rival ads pulled from the public Ad Library.
- **AI recommended** from AdBrain's category model, the mix that wins for this category, fitted from outcomes across accounts, not a guess.

**Rule:** flag any stage or format more than 10 points off the recommended mix. The biggest negative gap is the stage to feed next. This is how creative analytics becomes a real vs-category read instead of a wall of our own numbers.

### 5.6 The one-number verdict and growth diagnosis

Fuse all engines into one ranked next move.

```
MoveValue = ExpectedROASLift x Confidence x Ease
```

Candidate moves, each already a number from an engine:
- replace the N creatives dying this week (half-life)
- launch the take-live set (concept engine)
- brief the top message gap (message-gap)
- pull the top ROAS lever (driver model)
- fix the top fatigue bucket by spend (fatigue)

The growth diagnosis ranks six blockers and reports the top one only. **The gate runs first:** if signal quality is under 60, report only "fix measurement first" and score nothing. **The suppression rule:** "audience used up" may never be reported unless the creative-supply blocker and the ads-are-the-same blocker are both healthy. This stops the most expensive wrong diagnosis in the industry.

---

## 5A. The setup gate: nothing runs without a window and an objective

**The first thing on the dashboard is two choices: duration and objective. Until both are set, nothing else moves.** This is a hard rule, not a default. A number without a window and an objective is meaningless: a 2 percent conversion rate over 7 days for prospecting is a different thing from the same number over 90 days for retargeting.

- **Duration:** last 7, 14, 30, 60 or 90 days. Everything is read day by day inside that window.
- **Objective:** prospecting (TOF), consideration (MOF), conversion (BOF), full funnel, retargeting, or lead generation.

**Objective is multi-select, like Meta.** More than one objective can be chosen at once (prospecting, consideration, conversion, retargeting, lead generation, app installs, engagement). **Duration supports custom date ranges,** not only presets: a "custom range" option reveals a from-and-to date picker.

Every grade, number, warning and recommendation below the gate is computed for the chosen window and objectives. When one stage is chosen, the dashboard scopes to that stage. When several are chosen, all are in play. **Build the gate as a real lock: the rest of the view stays inert until a duration and at least one objective are set.**

### 5A.1 Auto-detected context: country, currency, business type

The tool detects the account's context automatically and scopes everything to it. This is not optional, it is the reason the numbers mean anything.

```
country + currency:  GET /{ad-account}  ->  currency, business_country
business type (D2C vs B2B):
   D2C  if the account fires purchase events and has a product catalog
   B2B  if it uses lead forms, long cycles, and has no catalog
```

Why it matters: a US B2B funnel split is meaningless for an India D2C brand. Every world, competitor and AI reference is first filtered to the detected country and business type, because every country and every model buys differently.

### 5A.2 The category peer set: same country, same category, +/- 30 percent price band

**All AI recommendations and all competitor comparisons are always drawn from the whole category in the account's country, limited to products priced within plus or minus 30 percent of the brand's own average selling price.** This is a hard rule.

```
peer_set = brands in {same country, same category}
           whose product price is between 0.70x and 1.30x
           of our average selling price (from Shopify or the catalog feed)
```

Why the price band matters: a Rs 1,299 earbud must be judged against Rs 900 to Rs 1,690 rivals, not against a Rs 15,000 headphone. Comparing across price tiers gives a wrong "category norm" and a wrong whitespace read. The peer set makes every comparison like-for-like. It is recomputed as the brand's price or the market moves.

## 5B. Account funnel balance grade (a letter grade, blended from four references)

Beyond efficiency, an account is graded on **balance**: is the spend split across TOF, MOF and BOF the way it should be. And "should be" is never one opinion. It is a blend of four reference points, so no single source can mislead us.

```
The four reference points, per funnel stage:
  ours       our own best-performing window (day-wise), the split that actually worked for us
  ai         AdBrain's fitted category model for this vertical and objective
  competitor the average split of tracked rivals, from the Ad Library decode
  world      the published category norm

target(stage) = 0.40 x ours + 0.25 x ai + 0.20 x competitor + 0.15 x world

distance = sum over TOF, MOF, BOF of  | now(stage) - target(stage) |
score    = 100 - distance
grade:   A >= 85    B >= 70    C >= 55    D >= 40    else F
```

**Why our own best counts most (0.40).** A split that already produced our best contribution ROAS is proven for this brand, and beats any outside opinion. The AI model, competitors and the world are there to stop us over-fitting to a lucky window, in that order of trust.

**The output is not just a grade, it is a balance instruction.** The biggest negative gap names the starved stage. Example: our split TOF 62, MOF 8, BOF 30, the blend targets TOF 50, MOF 24, BOF 26, so distance 32, score 68, grade C, and MOF is starved by 16 points. The instruction: shift new production to MOF, hold TOF, it is over-served.

The grade also drives the **format split recommendation** (video, static, carousel, collection), computed the same way: our own best format mix blended with AI, competitor and world, so the tool says not just "make more MOF" but "make more MOF demos as static side-by-side, because the category rewards static there and we run almost none".

### 5B.1 Every weight and rule is editable, and the working is always visible

Two rules for the whole dashboard, not just the funnel grade.

1. **The working is always visible, not hidden behind a click.** Every computed block (the grade, the creative mix, the recipes, the change log, the universe-knowledge references) shows a short always-on caption: FROM (where the data comes from), FORMULA (in simplest form), and LOGIC. The full detail can still expand, but the source and formula are never hidden.

2. **Every weight and threshold is editable, and edits persist.** The reference weights (our own best, AI, competitor, world) and the category rules (the price band percent) are shown as editable number inputs. Changing one recomputes the grade live, updates the recipe picker formula, and updates the creative-mix target. Edits are saved per account. A sum check warns if the four weights do not add to 1.00, with a one-click Balance button. **The canonical source of truth for weights is the Measurement Canon; the on-dashboard editors are per-account overrides.**

## 5C. Change log vs performance: rule the buyer's own actions in or out

A good or bad 7 or 14 days is often not the creative, it is how many manual changes the team made. Meta relearns delivery on every edit to budget, audience, status or bid, so too many changes in a day reset learning and tank performance, and it looks exactly like creative fatigue if you do not have the change log.

```
FROM   Meta Marketing API activity log:  GET /{ad-account}/activities
         fields=event_type, object_name, extra_data, event_time  since=14 days
       + the AdBrain change ledger + Shopify offer and price history, joined by date
       + daily performance from insights time_increment=1

change_volatility(day) = count of manual changes that day
learning_penalty       = number of days with volatility >= 4 in the window

Attribution rule: a performance drop is linked to CHANGES, not creative, when a day
with 4 or more changes is immediately followed by a 2-point-or-worse performance drop.
Only after ruling changes out does the tool blame the creative.
```

This is the causality ladder (Section 4.4) applied to human actions. The dashboard shows the last 14 days day by day, each day's performance delta beside the exact pauses, scales, budget changes and offer swaps, and flags any day with 4 or more changes as TOO MANY. The action is usually simple: freeze changes on the worst ad sets and let delivery relearn for 72 hours, and cap manual budget changes at one per ad set per day. Log every change to the ledger so this correlation sharpens over time.

### 5C.1 It is a backend history, and every plus or minus is a real metric move

Two rules the tech team must build exactly.

1. **Track it in the backend, replay it for any period.** Every change from the activities log and the AdBrain ledger is stored, not just shown for the last 14 days. The user opens this history from the footer of the dashboard and asks for any window. So when an ad goes down, we can always look back and say what happened around it.

2. **The day's plus or minus is computed from the metrics, never typed by hand.** Each day's score comes from the real metric change of the affected ad or ad set: ROAS up is good, CPA down is good, CTR up is good, CPM down is good, add-to-cart to landing up is good. The history stores the metric deltas behind each number, so the plus or minus is always explainable.

3. **Every change is labelled by cause: buyer or algorithm.**

```
source of a change:
  BUYER  if it appears in the activities log  (a person did it: paused, scaled,
           budget change, audience edit, offer swap)
  ALGO   if delivery moved with NO logged change  (Meta reallocation or a
           learning-phase shift the system made on its own)

attribution of a DROP:
  if a >=4-change BUYER day is followed by a >=2-point drop  -> the buyer caused it
  else if metrics moved with no logged change                -> an algorithm call
  else -> walk the creative cause ladder (Section 4.4)
```

So the history answers the one question that starts every fight: when an ad went down, was it us or was it the algorithm. It says so plainly, with the metric move and the cause, before anyone blames the creative.

## 5D. How AdBrain judges every creative (the layer above CTR, ROAS and CPA)

A weak buyer asks only "is this ad getting a good ROAS?". A top buyer asks a bigger question:

> "What is this creative doing, for whom, for how long, at what spend, with which product, and where is the funnel getting stronger or weaker, day by day?"

AdBrain must answer the bigger question. So for every creative that passed the spend floor (Rule 12), AdBrain captures the following. This sits ABOVE the basic metrics, it does not replace them. All of it is read from the Meta API, our decoder (the crystals), GA4 and Shopify.

**1. Creative identity.** Ad id (track the same ad over time), creative age in days (a 2-day winner is not the same as a 60-day winner), first live date, last edit date (an edit resets the reading), format (video, static, carousel), aspect ratio, placement (feed, stories, reels, audience network), version (V1, V2, V3), and creative family (the parent concept, so we know if the idea itself works).

**2. Product and offer.** Exact product or SKU shown, how many products, category or collection, hero product, price shown, discount shown, offer type (discount, bundle, free shipping, gift, subscription), how clear the offer is, product margin where we have it, best-seller flag, new product flag, stock status (in stock, low, out of stock), the landing page used, and whether this ad drives a higher or lower average order value. This matters because a Rs 5,000 ROAS ad on a high-margin product is not the same as the same ROAS on a low-margin product.

**3. Human and visual look.** Is a person present, how many, gender mix, rough age, creator type (real user, actor, founder, customer, expert), face visible, product held or worn or demonstrated, before and after, lifestyle scene or studio shot, indoor or outdoor, background type, camera style (phone, professional, screen recording), camera movement, text on screen and how much, captions, and when the logo and the product first appear.

**4. Audio and video build.** Music, voiceover and whose voice, trending or original audio, and what happens in the first 3 seconds (hook, product, text, problem, brand). Plus video length and the full retention curve: 3-second, 25, 50, 75, 95 and 100 percent, ThruPlay rate, hold rate, and average watch time.

**5. Hook and message.** Hook type (problem, curiosity, benefit, shock, social proof) and a hook strength score 1 to 10. Whether it is problem-led, benefit-led, fear-led, desire-led, education-led, comparison, testimonial, demonstration, founder-led, offer-led, or objection-handling. Proof type (review, expert, data, before-after), the call to action, the angle (price, quality, convenience, ingredient, outcome), the buyer persona it targets, and the awareness stage (unaware, problem-aware, solution-aware, product-aware).

**6. Top-of-funnel attention (formulas).**
```
CPM              = spend / impressions x 1000
Thumb-stop rate  = 3-sec views / impressions x 100
25/50/75/95/100% view rate = that view count / video starts x 100
ThruPlay rate    = ThruPlays / impressions x 100
Hold rate        = ThruPlays / 3-sec views x 100
```

**7. Traffic quality (formulas).**
```
Link CTR         = link clicks / impressions x 100
CPC              = spend / link clicks
LPV rate         = landing page views / link clicks x 100
Cost per LPV     = spend / landing page views
Click to LPV loss= 100 - LPV rate
Bounce rate      = bounced sessions / sessions x 100      (GA4)
Engaged rate     = engaged sessions / sessions x 100      (GA4)
```

**8. Ecommerce funnel (formulas).**
```
LPV to ATC       = add to carts / landing page views x 100
Cost per ATC     = spend / add to carts
ATC to checkout  = checkouts / add to carts x 100
Checkout to buy  = purchases / checkouts x 100
ATC to purchase  = purchases / add to carts x 100
Purchase rate    = purchases / sessions x 100
CPA              = spend / purchases
AOV              = revenue / purchases
ROAS             = revenue / spend
```

**9. Lead-gen funnel (formulas).**
```
LPV to lead      = leads / landing page views x 100
CPL              = spend / leads
Lead to MQL      = MQLs / leads x 100
MQL to SQL       = SQLs / MQLs x 100
SQL to customer  = customers / SQLs x 100
CAC              = spend / new customers
```

**10. Day-by-day trend (this is the important one).** Do not only show the 30-day total. Show the movement: day 1 vs day 2, day 3 vs day 7, last 3 days vs the 3 before, last 7 days vs the 7 before. And the direction of each key line: CTR, CPM, CPC, cost per LPV, cost per ATC, cost per checkout, CPA, ROAS, AOV, LPV-to-ATC, ATC-to-checkout, checkout-to-buy, and frequency, each rising or falling. Example: cost per ATC goes Rs 180, Rs 190, Rs 235, Rs 290 over 7 days. AdBrain should say "this creative is losing efficiency at the cart step, cost per add to cart is up 61 percent in 7 days", which is far more useful than "ROAS went down".

**11. Audience context.** Frequency, reach growth, frequency growth, cold or warm or retargeting or lookalike or broad, best and worst age, gender, geography and placement, audience overlap where available, and the new-customer versus existing-customer share.

**12. Creative diversity.** Count the active creatives, and the number of unique hooks, angles, offers, formats, creators, products, personas, visual styles and calls to action. Then a diversity score. Example: 10 ads are live, but 8 share the same hook, 7 the same creator, 9 the same offer. AdBrain should say "10 ads are live, but diversity is low, most are variations of one idea."

**13. Creative lifecycle.** Days live, spend to date, the date of peak performance, peak and current ROAS, peak and current CTR, peak and current CPA, frequency at peak and now, days since peak, percent decline from peak, and spend and purchases since peak. This answers "was this a real winner, or just a launch spike?"

## 5E. The verdict: winner, refresh, do-not-kill, or loser (editable formula)

A creative is not a winner just because ROAS is high. AdBrain scores each creative on several signals, compares them to the objective average (Section 4C), reads the day-wise trend (5D point 10), and only then decides. **Every weight below is editable, and the source of truth is the Measurement Canon.**

```
For each creative (past the spend floor), compute against its OBJECTIVE average:

  performance   = how far above/below the objective average on ROAS, CPA, CTR, ATC/LP
  trend         = day-wise slope on ROAS, CTR, CPM, CPA, ATC/LP, frequency
                  (rising good lines and falling bad lines = healthy)
  fatigue       = from the fatigue engine (Section 5.1)
  data_enough   = spend, purchases and days live vs the minimum thresholds
  funnel_health = is LPV to ATC to checkout to purchase improving or breaking

CreativeScore = w1 x performance + w2 x trend + w3 x (100 - fatigue)
              + w4 x funnel_health          (weights editable, default 0.30/0.30/0.20/0.20)
```

**Winner check, not just high ROAS.** Before calling an ad a winner, all of these must hold: enough spend, enough purchases, enough days, stable performance, healthy funnel movement, good CPA, good AOV, decent new-customer share, low fatigue, and room to scale. Example: Ad A has 8x ROAS on Rs 3,000 and 2 purchases. Ad B has 4.5x ROAS on Rs 2 lakh, 180 purchases, stable for 30 days. For a real buyer, B is the true winner, not A.

**Loser check, never on one bad metric.** Before calling an ad a loser, rule out: not enough spend, not enough data, a different audience quality, an unusually high CPM, a broken LPV rate, a broken ATC rate, a broken checkout rate, out-of-stock product, a changed landing page, a promotion change, or broken tracking. Then classify the real reason: true loser, early loser, low-data, funnel problem, audience problem, tracking problem, product problem, or creative fatigue. This is the causality ladder (Section 4.4) applied to a single ad.

**The final output, for every creative:** one clear verdict, a confidence, and a short "why" list of the exact signals.

```
CREATIVE: WINNER          confidence 91%
  strong CTR, strong LPV to ATC, CPA below objective average,
  ROAS stable 21 days, frequency still healthy, no major fatigue, works across 3 audiences

CREATIVE: REFRESH         confidence 88%
  thumb-stop still healthy, hold rate falling, cost per ATC up 42% in 7 days,
  frequency up 2.1 to 3.7, CTR down 28%, ROAS down 31%

CREATIVE: DO NOT KILL YET  confidence 95%
  ROAS looks weak, but only Rs 8,000 spent, 4 purchases, not enough data, keep testing
```

The goal is not a bigger dashboard. It is to answer the real buyer question: why is this creative winning or losing, what changed, where did it change, and what should I do next. This is exactly the philosophy the existing creative fatigue logic already follows, combining objective performance, audience saturation, delivery trends and creative repetition instead of trusting one KPI.

## 5F. Real situations a top buyer faces at scale, and exactly what AdBrain does

These are the real situations a top 1 percent buyer or creative strategist hits every week on an account spending USD 100M a month. For each one, the tech team should not have to think, the rule is written here. Read this as the test suite: if AdBrain handles all of these correctly, it thinks like the best buyers.

Every rule below points to a section for the full formula. The pattern is always the same: do not trust one number, check the cause in order, and only then act.

| # | The situation | The trap (what a weak tool does) | What AdBrain does |
|---|---|---|---|
| 1 | An ad shows 8x ROAS on Rs 3,000 and 2 orders | Calls it a winner and scales it | Holds it as "do not kill yet, not enough data". Spend floor and data check (Rule 12, 5E). |
| 2 | A steady winner suddenly drops | Blames the creative and pauses it | Walks the cause ladder: measurement, tracking, CPM, landing, stock, saturation, then fatigue (4.4). |
| 3 | Whole-account ROAS falls but each ad looks fine | Panics and cuts budget | Checks MER, tracking leak, a promo change, or seasonality first. Often the account is fine and the ruler moved (5.6, 5C). |
| 4 | ROAS is rising but growth has stalled | Celebrates the ROAS | Flags that new-customer share is falling, budget quietly moved to retargeting (nCAC, new-customer percent). |
| 5 | Performance tanked after a busy week of edits | Assumes creative fatigue | Shows the change log: too many budget and status changes reset learning (5C). |
| 6 | CPM jumps during a festival | Reads it as a problem | Compares to the same festival window last year, not to the trailing average (5.6, auto seasonality). |
| 7 | The team shipped 10 "new" ads | Counts 10 fresh ideas | Fingerprints them, finds 8 are near-copies Meta reads as one, diversity is low (5.2). |
| 8 | A winner is scaled hard and dies | Thinks the creative broke | Scaling raised frequency and CPM, that is second-order. Scale 30 percent at a time (5E, operating mind 5). |
| 9 | Comparing a conversion ad to the account average | Uses one account-wide average | Compares only to other conversion ads, weighted by 180 to 365 day history (4C). |
| 10 | Two ads both at 5x ROAS | Treats them as equal | Judges on contribution margin, a high-margin SKU at 5x beats a low-margin SKU at 5x (5D point 2). |
| 11 | An ad keeps spending to an out-of-stock SKU | Keeps optimising it | Flags it as pure waste from the stock join, stop until restock (Stop rules). |
| 12 | The landing page was changed mid-flight | Compares before and after as one | Resets the reading from the edit date, old and new are different tests (5D point 1). |
| 13 | The offer changed from 10 percent off to flat Rs 200 | Blames the creative for the shift | Ties the change to the offer swap in the ledger, not the creative (5C). |
| 14 | Meta says 6x, Shopify says the business made less | Trusts the platform | Uses MER and a holdout to discount platform over-claim (5.6, incrementality). |
| 15 | An ad is tired, or the audience is used up | Guesses one of them | Runs a creative swap test: if a fresh ad recovers it, it was fatigue, if not, it was the audience (fatigue vs saturation). |
| 16 | An ad wins in Reels but loses in Feed | Judges it on the blended number | Breaks performance down by placement and acts per placement (5D point 1, 11). |
| 17 | A hook we owned is now copied by rivals | Keeps riding it | The copying alarm fires when a hook we held 60 days goes category-common, queue a new hook (competitor watch). |
| 18 | A brand-new product with no history | Has no baseline to judge it | Borrows the account average for that angle and objective until it has 3 days of its own data (trust gates). |
| 19 | India COD orders get returned, real ROAS is lower | Reports the inflated ROAS | Uses return-adjusted and contribution ROAS, not the platform number (5D point 2, contribution ROAS). |
| 20 | An ad set is set live but barely spending | Ignores it | Flags under-delivery and pacing, the ad set is choking on a low bid or a tiny audience (delivery). |
| 21 | Five ads from one concept run together | Lets them compete | Flags cannibalisation, they split learning, keep the best and pause the rest (anti-redundancy). |
| 22 | An ad spiked on day one then faded | Calls the spike a winner | Reads the lifecycle: peak date, days since peak, percent decline from peak, so a launch spike is not mistaken for a winner (5D point 13). |
| 23 | A US account and an India account | Uses one global benchmark | Auto-detects country, currency and business type, and scopes every reference to it (5A.1). |
| 24 | A B2B account with a 60-day sales cycle | Judges it on same-day ROAS | Uses the lead-gen funnel and expects a lag between spend and pipeline (5D point 9, 5A.1). |
| 25 | The pixel or purchase event breaks | Reports a fake collapse | The signal-quality gate suppresses the whole board and says "fix measurement first" (Law 7, 5.6). |
| 26 | Tracking coverage slowly slips | Reads it as a performance drop | Signal-adjusted MER separates a tracking leak from a real drop (5.6). |
| 27 | A cheap channel that mostly re-sells to existing buyers | Over-funds it | nCAC shows the true cost of a new customer, not the flattering blended CAC (Profit metrics). |
| 28 | Cost per add to cart is climbing day by day | Waits for ROAS to drop | Calls it early from the day-wise trend: "losing efficiency at the cart, cost per ATC up 61 percent in 7 days" (5D point 10). |

**How to use this list:** it is not decoration, it is acceptance criteria. Before shipping, run each of the 28 situations through the system and confirm AdBrain does the right column, not the trap column. If any one fails, that is a missing rule, not an edge case to ignore.

## 6. Concept generation doctrine (the important one)

This is the hardest and most valuable part, and the one the tech team must get right. How does AdBrain decide what new creative to make? By combining three inputs, in a fixed order, so nothing is missed.

### 6.1 The three inputs

```
1. COMPETITOR GAP (whitespace)   - what rivals under-use, from the Ad Library decode
2. AI CATEGORY MODEL             - what wins for this category, from AdBrain's fitted model
3. OUR OWN WINNERS               - what already works for us, from the 90-day decode
```

None of the three alone is enough. Competitor gap alone gives you untested ideas. The AI model alone ignores your brand's reality. Your own winners alone keep you in a rut. The intelligence is in combining them.

### 6.1b The output is a buildable recipe, not an idea

A concept is not "make a comfort video". It is a **recipe with named parts, each part chosen from the four sources with a number behind it**:

```
recipe = pick(SKU) + pick(format) + pick(concept) + pick(offer) + pick(landing)

each pick = argmax over candidates of:
    0.40 x our_performance   (day-wise, what already wins for us)
  + 0.25 x ai_fit            (AdBrain category model)
  + 0.20 x competitor_gap    (whitespace from the Ad Library decode)
  + 0.15 x world_norm        (category benchmark)

constraints:
  SKU        must be in stock and margin healthy
  concept    must fill the top funnel or message gap
  format     must be our best-winning format for that stage
  offer      must protect margin (bundles and thresholds beat blanket discounts)
  landing    must fix the weakest funnel step
```

Every part carries a source tag so the buyer sees why it was chosen: `OURS` our data, `AI` the model, `COMP` competitor gap, `WORLD` the norm, `CRYSTAL` the decode taxonomy.

**Two real recipe examples, in absolute terms:**

```
Airdopes 141 [OURS best margin, in stock]
 + UGC POV [OURS 14% hit rate]
 + Comfort "full day" [CRYSTAL gap 0% ours, 19% category]
 + Free case bundle [AI AOV lever, not a discount]
 + fit-proof PDP [WORLD our landing is weak on fit]

Airdopes 311 Pro [OURS bass hero SKU]
 + static side-by-side [COMP rivals under-use demo]
 + bass demo [CRYSTAL product realism thin]
 + free shipping over Rs 999 [WORLD beats a percent discount]
 + bass-meter PDP [AI lifts add-to-cart]
```

This is the whole point: the tool does not hand a creative team a vague brief, it hands them a spec they can shoot, with every choice traced to our own performance, the AI model, the competitor gap, and the world norm.

### 6.1c The production handoff: recipe to Claude to nano-banana, assets attached on their own

Once the recipe is locked, the concept does not sit in a doc waiting for a person to retype it. It flows through an automatic chain. The tech team must build this handoff so no step needs a manual copy-paste or a chased-down asset.

```
STEP 1  AdBrain locks the recipe
        SKU + format + concept + offer + landing, each already chosen with a number.

STEP 2  AdBrain sends the concept to CLAUDE
        Claude writes the shooting script and the image prompt, built from this exact
        recipe plus the look note and the "why from the data".
        Rule: all scripts route to Claude. We do not hand-write scripts from scratch.

STEP 3  AdBrain sends the concept + prompt to NANO-BANANA for image generation
        AdBrain attaches every asset the shot needs, automatically, no manual upload:
          - the SKU pack shot (from the recipe's SKU pick)
          - the brand kit and logo
          - the price and offer badge (from the offer pick)
          - the winning-format reference (from the format pick)
          - the product-page screenshot (from the landing pick)

STEP 4  MEDIA TEAM approves before anything goes live
        Governance stays on. The system builds the concept, the script and the frames,
        but it does not launch on its own. Nothing auto-launches for the first 12 months.
```

Two hard rules in this chain. First, **scripts always go to Claude, images always go to nano-banana**, and the assets for the image step are gathered by AdBrain from the recipe parts, never asked of a human. Second, **the chain stops at the Media Team**: it produces a ready-to-approve concept with script and frames, and a person makes the launch call. The value is that the path from "here is the concept" to "here are the frames and script" has zero manual steps, so the team spends its time approving, not assembling.

### 6.2 The gap-finding step: what to make, and how it should look

```
Step 1  Find the biggest GAP.  Take the highest of:
          - top MessageGapScore (a motivator we are absent on)
          - biggest funnel-mix gap (usually a starved MOF)
          - biggest diversity hole (a hook or angle we lack)

Step 2  Confirm the gap is OPEN, not crowded.
          open if competitor coverage of it is also low (whitespace),
          OR if the AI category model says it wins and we under-index.

Step 3  Choose the FORMAT from our own winners.
          format_score = win_rate(format) x avg_half_life(format)
          pick the top-scoring format we already run.

Step 4  Compose:  the GAP angle, shot in our WINNING format,
          respecting the funnel stage it serves.

Step 5  Guard against duplication (all must pass):
          - brief cosine < 0.72 vs everything tested in the last 6 months
          - fills a named gap (no gap, no brief)
          - passes brand safety, ASCI, trademark
          - the set of new concepts covers at least 6 personas and the starved funnel stage
```

**In plain words:** take the reason to buy that the market wants and we are missing (gap), check nobody else owns it yet (whitespace) or that the category rewards it (AI model), and shoot it in the format that already wins for us (our data). That is a whitespace angle in a proven format, which starts warm instead of cold.

### 6.3 Worked example (this is the intelligence in action)

- **Gap:** the message-gap engine finds "comfort, long-wear" at 0 percent of our ads, weighted 19 percent of category attention. Biggest gap.
- **Open?** Yes. Rivals Noise and boult are also low on comfort, so it is whitespace, not a crowded fight. The AI model also flags comfort as a rising winner for audio D2C.
- **Format:** our 90-day data shows founder and UGC POV has the highest hit rate (14 percent vs 7 account average) and the longest half-life (12 days vs 6 for statics).
- **Compose:** comfort angle x UGC POV format, MOF stage (consideration).
- **Output concept:** one real user, a full day, Airdopes never come out, close-ups on the ear, "poora din, kaan nahi dukhte", phone-shot. Three variants: metro, gym, work-call.

That is not a guess. Every part traces to data: the angle from the gap, the openness from competitor and AI, the format from our own winners.

### 6.4 The rule that stops us missing an area

```
Every daily run must check ALL of these gap sources before generating concepts:
  message-gap (motivators)   funnel-mix gap (TOF/MOF/BOF)   format-mix gap
  diversity holes (hooks, angles, personas)   language and region gap
  the competitor copying alarm (a hook we owned now going category-common)

The concept engine ranks across ALL gap sources, not just the loudest one,
so a starved MOF and a missing language are both surfaced, not only the obvious hook gap.
```

This is how we factor in everything possible and do not miss an area of improvement. The engine is not allowed to look at one gap type and stop.

---

## 7. Action rules: Scale, Continue, Stop, and early warnings

### 7.1 The three action gates

```
SCALE if:      fatigue < 0.30  AND  ROAS > account_median  AND  hook_percentile > 75
CONTINUE if:   0.30 <= fatigue <= 0.55  AND  performance within +/- 10% of baseline
STOP if:       fatigue > 0.70  AND  cost_per_result > 2x past  AND  3 replacements queued
```

**Rules:**
- Two gates on stop, so one noisy signal cannot pause a good ad.
- Never stop without replacements queued. Pausing with nothing ready just removes delivery.
- Scale by 30 percent at a time, not more, to avoid a learning reset.
- Every action points at an exact ad id and shows the numbers behind it.

### 7.2 Early warnings (the 7 and 14 day view)

The dashboard leads with these. Each is a projection of a day-wise slope to the day it crosses a line, with the exact culprit.

```
death:      days_to_death from the half-life engine
cpm breach: projected_CPM = CPM_now x (1 + weekly_slope)^(days/7), breach vs ceiling
diversity:  project distinctness trend to when it crosses 50
checkout:   project completion slope, size the leak as at_risk_orders x AOV
```

**Rule:** a trend needs at least 7 continuous days before it can raise a warning. A single bad weekend never triggers one. During a known festival window, compare to the same window last year, not to the trailing average.

---

## 8. Trust gates: until when a number is not worthy

Every metric and action carries a trust gate. The rule is simple: **a confident wrong number is worse than no number.** If the gate is not met, show the state honestly, do not compute.

| Number | Not worthy until |
|---|---|
| Any per-ad score | 50 USD (or Rs 4,000) spend and 3 days live |
| Fatigue, half-life | 1,000+ impressions a day for the creative |
| Funnel rates (ATC, checkout) | 2,000+ sessions in the window |
| Winner flag | 100+ conversions and 3+ days |
| Account median (for winner bar) | 30+ ads in the account, else use a fixed floor and flag it |
| Contribution margin, ROAS | the finance sheet is current, else show "waiting on finance" |
| nCAC, new customer percent | the new vs returning flag exists on orders |
| Diversity, distinctness | every live ad decoded and fingerprinted |
| Half-life for a new creative | borrows the account half-life for its angle until 3 days of its own data |
| A trend warning | 7+ continuous days of data |
| Any "against our own past" metric | 90 days of history, else run in observe mode with no grade |

**The missing-data rule, four parts:**
1. Never fill a gap with an average.
2. If a dimension cannot run, drop it and rebalance the remaining weights to 1.00.
3. Never substitute silently, always show it on screen.
4. A decoded label below 97 percent confidence is a question for a human, not a value.

---

## 9. Screen and UX rules

1. No screen ships unless it ends in a ranked action with a number.
2. Lead with the future (7 and 14 day warnings), then the actions, then the reads.
3. Point at exact ads, never at abstractions.
4. Every tile carries its working behind a click: what to fetch and how, the formula, the logic, an example, the next step, and the confidence.
5. Every tile shows its funnel stage.
6. Less data. If a panel only shows a number with no threshold and no action, cut it.
7. Hide empty panels until they have data. "No data yet" trains people to ignore panels.
8. Any soft label ("Dominant", "Low") must be anchored to a real threshold, or it is not allowed.
9. Colours from the brand tool: cool light grey background, white cards, indigo accent, green for scale, red for stop, amber for watch.
10. Show the confidence and its data level on every action, with the one line on how to raise it.

---

## 10. What we must not miss (the coverage checklist)

Run this checklist against any release. If any row is unchecked, an area of improvement is being missed.

- [ ] Every metric has its causal chain (what moves it, what it moves next), and data needs are defined from those causes
- [ ] Every "why" and diagnosis walks the causal ladder in order, never jumps to the obvious cause
- [ ] Severity is graded by cause, not by the size of the move
- [ ] Every metric tagged with funnel stage and tier and priority
- [ ] Every action points at an exact ad id
- [ ] Every tile has fetch, formula, logic, example, next step, trust gate, confidence
- [ ] Confidence rises correctly across the four data levels
- [ ] The dashboard leads with 7 and 14 day warnings
- [ ] Creative mix shown three ways: us, competitor, AI recommended
- [ ] Concept engine checks ALL gap sources, not just the loudest
- [ ] Concepts trace to competitor gap + AI model + our own winners
- [ ] Fatigue uses the exposure curve, never a frequency threshold
- [ ] Diversity measured on our portfolio, distinctness to Meta's eye
- [ ] Contribution ROAS and nCAC computed, not just platform ROAS
- [ ] Signal-quality gate suppresses the board when tracking is broken
- [ ] The spend floor (Rs 300 or USD 5 in last 7 days) runs first, at ingest, before any score
- [ ] Every in-account comparison is same-objective only, weighted mostly by 180 to 365 day history
- [ ] Every creative is judged on the 16 layers, not only CTR, ROAS and CPA
- [ ] Every creative shows a day-wise trend, not just the 30-day total
- [ ] Every creative gets one verdict (winner, refresh, do-not-kill, loser) with confidence and a why list
- [ ] The verdict weights are editable, source of truth is the Measurement Canon
- [ ] A loser is classified by real cause, never on a single bad metric
- [ ] All 28 real-buyer situations in Section 5F are handled the right way, not the trap way
- [ ] Nothing on the dashboard moves until a duration and at least one objective are set
- [ ] Objective is multi-select and duration supports custom date ranges
- [ ] Country, currency and business type (D2C vs B2B) are auto-detected from the Meta API
- [ ] Every world, competitor and AI reference is scoped to the detected country and business type
- [ ] The category peer set is the whole category in-country within +/- 30 percent of our price
- [ ] Every computed block shows an always-visible FROM, FORMULA and LOGIC caption
- [ ] Every weight and threshold is editable on the dashboard, persists, and recomputes live
- [ ] A change log lines up the buyer's pauses, scales, budget and offer changes against daily performance
- [ ] A performance dip is checked against change volatility before creative is blamed
- [ ] Account carries a funnel balance grade, blended from our own best + AI + competitor + world
- [ ] Every concept is a buildable recipe (SKU + format + concept + offer + landing), each part sourced
- [ ] Every recipe part traces to a number from our data, AI, competitor, world, or crystals
- [ ] Every recommendation, decision and 30-day outcome written to the ledger
- [ ] Nothing launches or pauses without a human
- [ ] Every engine applies one of the twelve elite-buyer principles, and can name which one
- [ ] Decisions run on the margin and on profit, not on average platform ROAS
- [ ] Platform numbers are discounted against incrementality before any large budget shift

### Open questions (decide these, do not guess)

- The exact market weights per motivator, per category. Start from research, correct from the ledger.
- The AI category model's recommended mix per vertical. Fit it from outcomes as accounts accumulate.
- The half-life exponent per brand and angle. Meta's 0.4 is the anchor, replace with measured values.
- The similarity threshold for duplicate clustering. 0.92 is the start, tune it in the Canon.
- Whether any Indian benchmark exists yet. Almost every number is from US data, so treat all ranges as directional and lean on the client's own history.

---

*AdBrain Tech Rulebook v1.0. This encodes the product decisions as of August 2026. When a decision changes, change it here first, then in the code. Where this conflicts with the Measurement Canon on a weight or formula, the Canon wins.*
