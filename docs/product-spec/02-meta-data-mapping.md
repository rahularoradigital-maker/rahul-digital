# [02] Meta Data Mapping

The foundation: what the Meta Marketing API actually gives us vs. what we must calculate, infer,
get elsewhere, or admit we cannot know. Every metric in the dictionary [01] must trace to a row
here. Grounded in Meta Insights API docs + 2026 research; verify field availability at build time
(Meta deprecates/renames fields — the Insights API is versioned).

Legend: **FETCH** = direct API field · **CALC** = computed from fetched fields · **INFER** =
modeled/estimated · **EXTERNAL** = another system · **CANNOT-KNOW** = not reliably knowable.
Fact tags: OFFICIAL / DERIVED / INFERENCE / EXTERNAL / UNKNOWN.

## Hierarchy levels (Meta side)
Account → Campaign → Ad set → Ad → Creative. (Business above account; Frame/Element/Hook/Angle/
Persona/Landing/Product are OUR enrichment layers, not Meta's — see [04][05].)

## Delivery / spend (FETCH, OFFICIAL)
| Field | Class | Notes |
|---|---|---|
| spend, impressions, reach, frequency | FETCH OFFICIAL | frequency = impressions/reach (Meta-provided) |
| cpm, cpc, ctr, clicks, inline_link_clicks | FETCH OFFICIAL | link CTR uses inline_link_clicks |
| date_start/date_stop, per-day via time_increment=1 | FETCH OFFICIAL | **day-wise snapshots** ([22][24]) |
| budget, delivery/effective_status | FETCH OFFICIAL | at campaign/adset |
| spend velocity, 7/14/30d spend trend, concentration | CALC DERIVED | from daily spend |

## Attention / video (mixed — the brief's key trap)
| Field | Class | Notes |
|---|---|---|
| video_3_sec / thruplay / p25/50/75/100 watched actions, video_avg_time_watched | FETCH OFFICIAL | Meta provides the raw plays |
| **hook rate** = 3-sec plays / impressions | CALC DERIVED | NOT an official field; a custom calc |
| **hold rate** | CALC DERIVED | 3 competing defs (p75/3-sec [Meta], 15-sec/3-sec [industry], thruplay/3-sec) — pick one, document it |
| retention curve, attention decay | CALC DERIVED | from p25-100 |
| landing_page_views, cost_per_lpv, lpv_rate | FETCH OFFICIAL / CALC | LPV is an action type |

## Conversion / economics
| Field | Class | Notes |
|---|---|---|
| purchases, conversion value (actions/action_values) | FETCH OFFICIAL | attribution-window dependent |
| roas (purchase value / spend), cpa, cvr, aov | CALC DERIVED | from actions + spend |
| **new-customer CAC / NCAC, returning vs new** | EXTERNAL | needs Shopify/CRM; Meta alone can't reliably split |
| MER, blended ROAS, contribution margin | EXTERNAL | needs finance/Shopify |
| **incremental revenue / iROAS, marginal CAC/ROAS, spend elasticity** | INFERENCE | needs experiments or MMM; MODEL ESTIMATE, never a fact |
| LTV, LTV:CAC, payback | EXTERNAL | CRM/subscription/finance |

## Creative assets
| Field | Class | Notes |
|---|---|---|
| creative id, ad copy, image/video URLs, format, aspect | FETCH OFFICIAL | via adcreatives |
| video transcript | EXTERNAL/CALC | transcription service or Gemini native video |
| video frames, visual attributes, embeddings | EXTERNAL/CALC | computer vision (Gemini/Google Vision); store as a fingerprint [05] |
| persona/hook/angle/concept labels | INFER | AI-labeled; INFERENCE with confidence |
| landing page content, message-match | EXTERNAL | LP crawler |
| product info | EXTERNAL | product feed/Shopify |

## Competitor
| Field | Class | Notes |
|---|---|---|
| competitor active creatives, copy, format, longevity | EXTERNAL | Ad Library / ScrapeCreators; **active != winning** (state explicitly) |
| competitor spend/results | CANNOT-KNOW | UNKNOWN — never present as fact |

## Hard limits (CANNOT-KNOW / heavily caveated)
- True incrementality without a holdout → INFERENCE only.
- Cross-platform/blended truth from Meta alone → EXTERNAL.
- Competitor economics → UNKNOWN.
- iOS/privacy attribution gaps → conversions are modeled/underreported; flag attribution limits on every economics view.

## Consequences for the build
- Meta-only MVP can do: delivery, attention (with derived labels), on-platform conversion/ROAS,
  creative analysis, fatigue, diversity, competitor hypotheses. It CANNOT do MER/NCAC/LTV/iROAS
  without Shopify/CRM/finance — those surfaces show "needs external source", never a fabricated number.
- Every dictionary [01] metric cites its row here + its fact tag.
```
