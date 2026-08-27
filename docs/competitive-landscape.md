# Competitive landscape + what to learn (path to a top-0.1% tool)

The goal: the best media-buying + creative-analytics tool, rules-first and explainable, with a
labeled-triples / expert-feedback (RLEF) moat. Below are the products worth learning from,
what each does better, and what we steal - then the plan.

## The landscape (by category)

### Creative analytics (closest to us)
- **Motion (motionapp.com)** - the category leader for performance-creative reporting. Connects
  Meta/TikTok, tags creatives (hook, format, angle, offer), and builds creative scorecards +
  reports. STEAL: creative-attribute TAGGING as first-class data (we already extract 42 attrs
  via Gemini - surface them as filterable tags), and the "creative scorecard" report layout.
- **Atria, Motion "Creative Trends"** - trend detection across a brand's creatives over time.
  STEAL: time-series of winning attributes ("video hooks up, static down last 30d").

### Competitor / ad-library intelligence
- **Foreplay.co** - swipe-file + ad-library discovery + brief builder; boards of saved rival
  ads. STEAL: save-to-board + brief generation from winning competitor creatives.
- **Atria (tryatria.com), Imagive** - competitor ad research + AI breakdowns + longevity
  ("running 1+ year" = winner). STEAL: longevity as a top-performer proxy (DONE), the
  competitor dashboard layout (platform donut, creative mix, top performers - mostly DONE).

### Attribution + revenue (the MER/nCAC gap)
- **Triple Whale, Northbeam, Prescient AI** - blended + attributed revenue, MER, nCAC,
  incrementality. This is exactly what unlocks our gated MER/nCAC. STEAL: pull revenue via a
  Shopify / Triple Whale connector and blend with spend.

### Benchmarking
- **Varos** - anonymized peer benchmarks (your CTR/CPM/CPA vs your vertical's percentile).
  STEAL: once we have many accounts, offer "your CTR is P70 for D2C apparel." Data-network moat.

### Creative generation / scoring
- **AdCreative.ai, Pencil** - generate + score creatives pre-launch. STEAL (later): pre-launch
  scoring using our rules + the winning-attribute patterns we mine.

## Where WE are already differentiated (and must lean in)
1. **Rules-first + fully explainable** - every number traces to a formula (the Why drawer +
   rubric registry). Most tools show a number; we show WHY. Keep this the headline.
2. **RLEF labeled triples** - situation -> recommendation -> operator judgment -> outcome. No
   competitor captures expert judgment as training data. This is the compounding moat.
3. **Decision engine** - explicit Pause/Scale/Continue with confidence, objective-aware. Most
   tools report; we decide.
4. **Day-wise fatigue + creative half-life** - a real trajectory + days-to-fatigue, not a
   static frequency number.
5. **Multi-agent creative analysis** - specialist agents + orchestration, auditable.

## Plan - next steps, highest leverage first
1. **Connector interface + Shopify/Triple Whale revenue** -> unlock MER, nCAC, true ROAS. This
   is the single biggest data gap vs Triple Whale/Northbeam. (See orchestration-plan.md: a typed
   MetricsSource, not LangGraph.)
2. **Creative tagging surfaced as filters** - we already extract 42 attributes; expose them as
   filterable tags + a "winning attributes this window" trend (Motion parity).
3. **Winning-combination miner** - product x format x offer x landing-page that actually wins
   (from our data) -> "next 5 concepts to test" (the user's brief). Deterministic ranking +
   one gated Gemini narration.
4. **Benchmarks (Varos-style)** once multi-account - percentile CTR/CPM/CPA per vertical.
5. **Google Ads + GA4 connectors** - cross-channel, same normalized model.
6. **Outcome capture for the RLEF loop** - measure the metric N days after a judgment, close
   the triple (we already log situation + recommendation + judgment).

## Token / cost discipline (per the build rule)
- Everything numeric is deterministic (0 tokens); the LLM only narrates + mines patterns, once
  per window, cached. Connectors are ETL, not agents. This keeps us cheaper than LLM-first tools
  while staying explainable.
