# Competitor Creative Intelligence — Canonical Architecture (FOLLOW STRICTLY)

> The required architecture for AdBrain's Market / Competitor Creative Intelligence system. This is the
> source of truth: the feature is built to these 9 layers, in this order, with these exact outputs. Any
> deviation must be recorded here with the reason.
>
> Flow: Facebook Ad Library → data-collection API → Processing → Analytics → LLM Creative Analysis →
> Competitive Intelligence → Dashboard. Everything after the URL input runs automated, no human step.

## 1 · Human Input (the ONLY manual step)
- My brand's Facebook Ad Library URL.
- Competitor brands' Facebook Ad Library URLs.

## 2 · Data Collection Layer (automated)
- Fetch from the Facebook Ad Library. Captured per ad: **Ad ID, Brand/Page, Creative + format
  (video/image/carousel), Copy/Headline/Description/CTA, Landing page, Start/End date, Platforms +
  metadata.**
- ⚠️ **Data-source dependency (blocker):** the diagram names **ScrapeCreators API**. Per project state,
  ScrapeCreators is **out of credits**, and the Meta Ad Library API needs Rahul's **identity verification**
  (both pending). The pipeline is source-agnostic below this layer, so layer 2 is the gate: it needs one
  working source (ScrapeCreators credits **or** Meta Ad Library API access). Nothing downstream is real
  until this is unblocked.

## 3 · Data Processing Layer (automated)
- Clean & dedupe raw API data (remove duplicates).
- Normalize fields; segment with a **brand-vs-competitor tag**.
- Output: **Standardized Ad Dataset.**

## 4–6 · Analytics Layer (automated)
- **Split by brand** → My Brand Ads / Competitor Brand Ads.
- **Brand-Level Analytics:** total/active/inactive ads; video/image/carousel counts; creative-format
  distribution; ad-duration distribution; platform distribution; Ad-Library distribution signals.
- **Performance Intelligence:** strongest hooks & CTAs; messaging & format patterns; creator/collaborator
  list + frequency.
- **Top 10 Creative Selection:** ranked per brand AND per competitor.

## 7 · AI Intelligence Layer — LLM (automated)
- **LLM Creative Analysis — 42+ attributes**, including: hook & hook type, first 3s, script, messaging,
  offer, CTA; product-vs-human, creator traits, voice/audio; visual & scene structure, color, typography,
  branding; pain point, benefit, emotion, social proof, storytelling; editing, pacing, closing, conversion,
  funnel intent.
- **TOF / MOF / BOF classification** (funnel stage per creative).
- Output: **Creative Intelligence Dataset.**

## 8 · Competitive Intelligence Engine (automated)
- **Merge brand + competitor datasets**, then produce:
  Competitor Comparison Table · Creative Scorecard · Hook Matrix · Offer Architecture ·
  Creator Network · SWOT Analysis · Creative DB (Funnel Analysis) · **Gap Analysis + Recommendations.**

## 9 · Output Layer
- **Competitor Creative Intelligence Dashboard / Report:** brand performance (my brand vs competitors);
  creative/hook/CTA/offer intelligence; creator intelligence (collaborator network); funnel intelligence
  (TOF/MOF/BOF mix); **competitive gaps + the next creatives to test.**

## Gap map — what exists vs what this requires
| Layer | Exists today | Missing to meet the spec |
|---|---|---|
| 1 Input | Market tab takes brand/competitor input | Explicit "my + competitor FB Ad Library URLs" input |
| 2 Collect | `competitor_brands`/`competitor_ads` tables; Meta Ad Library + WebSearch helpers | A working, funded source (ScrapeCreators credits or Meta Ad Library API verification) |
| 3 Process | some normalize/store | Clean+dedupe+brand/competitor-tag → one Standardized Ad Dataset |
| 4–6 Analytics | partial competitor read | Brand-level analytics, performance intelligence, Top-10 per brand/competitor |
| 7 LLM | `competitor_creative_analysis` table | The full 42-attribute LLM pass + TOF/MOF/BOF classification |
| 8 CI engine | — | Comparison table, scorecard, hook matrix, offer architecture, creator network, SWOT, gap analysis |
| 9 Output | Market dashboard shell | The full CI dashboard/report with "next creatives to test" |

## Build sequence (once layer 2 is unblocked)
2 → 3 → 4–6 → 7 → 8 → 9, each with a runnable check. Nothing downstream ships on fabricated data: if the
source is unavailable, the Market tab shows an honest "connect a source" state, never invented competitor ads.

*Recorded 2026-08-30. This architecture is binding; update this file (not the code silently) to change it.*
