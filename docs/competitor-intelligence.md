# Competitor Creative Intelligence — architecture

Implements the shared 9-stage "Facebook Ad Library Automated Competitor Creative
Intelligence System". Every layer after the input runs on real Ad Library data; no
number is fabricated. Built as **many small agents with an orchestration layer** — no
stage depends on a single monolithic call.

## Stage → code map

| Stage | What it does | Code |
|------|--------------|------|
| 1 · Human input | Find brands to track (search Meta pages, click to add) or paste Ad Library URLs. Seeded from the brand's market to reduce manual effort. | `components/app/market/competitor-input.tsx`, `app/api/competitors/search/route.ts` |
| 2 · Data collection | ScrapeCreators pulls every live ad (creative, copy, CTA, dates, platforms, media URLs). Paginated. | `lib/scrapecreators.ts` (`fetchBrandAds`), `app/api/competitors/run/route.ts` |
| 3 · Processing | Normalize fields, dedupe (delete-then-insert per brand), tag brand vs competitor. | `lib/scrapecreators.ts` (`normalize`), `run` route |
| 4–6 · Analytics | Per-brand: total/active/inactive, video/image/carousel mix, top CTAs, hooks, top creatives. | `lib/competitors/analytics.ts` (`analyzeBrand`) |
| 7 · LLM creative analysis | Multi-agent: 5 specialist agents (hook, message, offer, visual, creator) run in parallel; a dependent funnel agent (TOF/MOF/BOF) consumes their merged findings. | `lib/agents/creative/agents.ts`, `lib/agents/creative/orchestrator.ts`, `lib/gemini.ts`, `app/api/competitors/analyze/route.ts` |
| 8 · Competitive engine | Comparison table, whitespace gaps (formats/CTAs), funnel mix per brand, hook/offer/emotion patterns. | `lib/competitors/analytics.ts` (`buildReport`, `buildCreativeIntel`) |
| 9 · Dashboard | Renders it all; every creative links to the real Ad Library ad. | `components/app/market/competitor-dashboard.tsx` |

## The orchestration layer (stage 7)

`lib/agents/creative/orchestrator.ts` coordinates the small agents so no single agent owns
the whole result:

1. Fetch the creative image once (shared across vision agents).
2. Run the **specialist** agents in parallel; each owns one narrow slice of the 42
   attributes with its own prompt + schema, and can only write its own fields.
3. Merge slices (first non-empty wins — no clobbering).
4. Run the **dependent** funnel agent with the merged context (agents passing data).
5. If every agent failed, return null so the caller skips the ad (never store an empty read).

One agent failing blanks only its own fields. Pure merge/aggregation logic is covered by
`scripts/check-competitors.ts`.

## Data model (Supabase)

- `competitor_brands` — one row per tracked brand (page_id, label, is_my_brand, ad_count).
- `competitor_ads` — normalized ads (media URLs included), keyed `(user_id, page_id, ad_archive_id)`.
- `competitor_creative_analysis` — stage-7 output: funnel stage + the 42-attribute set as JSON.

All service-role, scoped by `user_id`, RLS deny-by-default (matches `oauth_tokens` / `cockpit_cache`).

## Keys required

- `SCRAPECREATORS_API_KEY` — stages 1–6/8 (Ad Library pull + brand search).
- `GEMINI_API_KEY` — stage 7 (creative analysis + video-frame reading), model `gemini-2.5-flash`.

## Not yet built

The written stage-8 outputs (Creative Scorecard, Hook Matrix, Offer Architecture, SWOT,
Gap Analysis + Recommendations) — the LLM-authored layers on top of the structured data.
