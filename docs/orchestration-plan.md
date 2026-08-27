# Orchestration plan - agents in sync + multi-source data (Google Ads, Shopify, GA4, Triple Whale)

Question: should we adopt LangGraph so all agents stay in sync as we add Google Ads, Shopify,
GA4, and third-party connectors like Triple Whale?

## Short answer
Split the problem in two, because they are NOT the same thing:

1. **Data connectors (Google Ads / Shopify / GA4 / Triple Whale)** = ETL / ingestion. This is
   NOT an agent problem and LangGraph is the wrong tool for it. Solve it with a typed
   **connector interface + a normalization layer**, all in TypeScript (in-language with the app).
2. **LLM agent orchestration (the creative analysis, and future decision agents)** = where a
   graph framework helps IF the workflow gets complex (branching, retries, human-in-loop,
   durable state). Here LangGraph is a candidate, but only when we outgrow the current
   TypeScript orchestrator.

## Why NOT LangGraph for the data connectors
- LangGraph is a Python-first framework (there is `@langchain/langgraph` for JS, but it is less
  mature). Adopting it for data pulls would mean running a separate Python service alongside the
  Next.js app - real ops overhead on Vercel for zero benefit, because pulling + normalizing ad
  metrics is deterministic ETL, not an LLM agent graph.
- Connectors need: auth/token storage, rate-limit-aware pulls, incremental sync, retries, a
  common normalized schema. None of that is what LangGraph provides.

## Recommended architecture (the "sync all sources" layer)
A single **MetricsSource interface** every connector implements, feeding one normalized model
the brain already consumes:
```
interface MetricsSource {
  id: "meta" | "google_ads" | "shopify" | "ga4" | "triple_whale";
  fetchAdMetrics(account, window): Promise<NormalizedMetricsRow[]>;   // ad/adset/campaign day-wise
  fetchRevenue?(window): Promise<RevenueRow[]>;                        // Shopify / Triple Whale (MER, nCAC)
}
```
- `lib/connectors/meta.ts` (exists as meta-source, refactor behind the interface), then
  `google-ads.ts`, `shopify.ts`, `ga4.ts`, `triple-whale.ts` - each isolated, each testable.
- One **normalization layer** maps every source into the same `NormalizedMetricsRow` /
  `RevenueRow`, so the scoring/fatigue/decision engines never care which platform the data came
  from. This is what actually keeps everything "in sync."
- A **connector registry + scheduler** (later: the managed queue from the scale plan) pulls each
  source on its own cadence and rate limits, writing into the shared store.
- Revenue sources (Shopify / Triple Whale) unlock the currently-gated MER and nCAC KPIs.

This is the same seam the scale plan already calls for (`lib/ad-source.ts` is the first version
of it). It is drop-in per connector and needs no new runtime.

## Where LangGraph (or a graph framework) could earn its place - later
The LLM side only. Today `lib/agents/creative/orchestrator.ts` fans out to specialist agents and
merges - a simple, fast, in-language TS orchestrator that works. Consider LangGraph.js when the
agent workflow needs:
- durable, checkpointed state across long multi-step runs (resume after failure),
- conditional branching between agents based on intermediate results,
- human-in-the-loop approval mid-graph (which maps directly to our RLEF / decision_triples idea),
- built-in retries/streaming per node.

Until then, the TS orchestrator + the `decision_triples` audit log (which already records the
situation -> recommendation -> judgment -> outcome trail) give us agent "sync" and traceability
without a Python dependency.

## Recommendation
1. **Now:** build the `MetricsSource` connector interface + normalization layer in TypeScript.
   Add connectors incrementally (Meta done; then Shopify for revenue -> MER/nCAC; then Google
   Ads, GA4, Triple Whale). No LangGraph.
2. **Keep** the TS creative-agent orchestrator; keep logging `decision_triples` as the sync/audit
   spine.
3. **Revisit LangGraph.js** only for the LLM agent graph, once it needs durable state /
   branching / human-in-loop - and even then weigh it against staying in-language.

Net: LangGraph is not needed to keep the connectors in sync; a typed connector interface is the
right answer. Reserve LangGraph for the LLM agent graph if and when its complexity demands it.
