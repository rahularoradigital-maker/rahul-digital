# [03] Google Ads Data Mapping (architecture-ready, Meta-first)

What the **Google Ads API** actually gives us vs. what we must calculate, infer, get elsewhere, or
admit we cannot know — the Google counterpart to [02]. Google is a **secondary, architecture-ready**
source: AdBrain is Meta-first, and this doc exists so the warehouse [24], API layer [23], and metric
dictionary [01] have a Google row to trace to *when* a brand connects Google Ads. It is not an MVP
requirement.

Grounded in Google Ads API (GAQL / GoogleAdsService.SearchStream) structure as understood to
**Jan 2026**. The Google Ads API is **versioned and short-lived** (a new version every few months,
old ones sunset within ~a year), so **every field name below is "verify at build"** — treat the
schema as a shape, not a frozen contract. Where a specific quota, threshold, or field is not
confidently verified as of Aug 2026, it is marked **UNKNOWN / verify at build**. No number here is
invented.

**Legend (same as [02]):** **FETCH** = direct API field · **CALC** = computed from fetched fields ·
**INFER** = modeled/estimated · **EXTERNAL** = another system · **CANNOT-KNOW** = not reliably
knowable.
**Fact tags:** OFFICIAL PLATFORM FACT / INTERNAL CALCULATION (DERIVED) / RESEARCH-BACKED /
INDUSTRY BENCHMARK / MODEL ESTIMATE / INFERENCE / UNKNOWN.

---

## 0. Access gating — the first thing that differs from Meta

Google Ads API access is **harder to get and harder to keep** than Meta's, and this shapes the whole
integration. This is a build-blocking prerequisite, not a metric.

| Requirement | Class | Notes |
|---|---|---|
| **Developer token** (approved by Google) | EXTERNAL / OFFICIAL PLATFORM FACT | Applied for against a **manager (MCC) account**; Meta has no equivalent gate. |
| Token **access levels**: Test / Basic / Standard | OFFICIAL PLATFORM FACT | Test tokens query **test accounts only** — cannot read a real client account. Standard is needed for production scale. |
| Basic-access **daily operation cap** | UNKNOWN / verify at build | Historically a per-day operations limit on Basic access; exact number changes — **do not hardcode**, read the current quota doc at build. |
| OAuth2 (per-user consent) + `login-customer-id` header for MCC | OFFICIAL PLATFORM FACT | Same OAuth family as Meta but the MCC/`login-customer-id` routing has no Meta analogue. |
| API **version sunset** cadence | OFFICIAL PLATFORM FACT | ~quarterly releases, versions deprecate within ~1 year. Pin a version; schedule upgrades. Meta is versioned too but Google churns faster. |

**Consequence for the build:** a brand cannot be "connected to Google" as fast as Meta. The connect
flow [23] must handle the developer-token + MCC + access-level path, and the UI must degrade
gracefully while a token is Test/Basic. Until then, Google surfaces show **"source not connected"**,
never a fabricated number.

---

## 1. Hierarchy levels (Google side) — and how they map to Meta

Google's tree is a **different shape**. Do not silently equate levels; the dictionary [01] must name
the Google level explicitly.

| Google level | ≈ Meta level | Class | Notes |
|---|---|---|---|
| Manager account (MCC) | (above account) | FETCH OFFICIAL | Routing/permissions container; no Meta twin. |
| Customer (account) | Account | FETCH OFFICIAL | `customer` resource. |
| Campaign | Campaign | FETCH OFFICIAL | Campaign **type** matters enormously (Search / Performance Max / Video / Demand Gen / Display / Shopping) — each exposes *different* fields. |
| Ad group | **Ad set** | FETCH OFFICIAL | Closest structural analogue to Meta's ad set. |
| Ad group ad (`ad_group_ad`) | Ad | FETCH OFFICIAL | The served ad. |
| Asset / asset group (`asset`, `asset_group`, `ad_group_ad_asset_view`) | Creative / element | FETCH OFFICIAL | Google ads are **assembled from assets** (headlines, descriptions, images, videos), not one monolithic creative — see §5. |
| Keyword / criterion (`ad_group_criterion`) | *(no Meta twin)* | FETCH OFFICIAL | Search **intent** targeting; Meta has no keyword layer. |
| Search term (`search_term_view`) | *(no Meta twin)* | FETCH OFFICIAL | The **actual user query** — Google-unique intelligence. |

Frame / Hook / Angle / Persona / Landing / Product remain **OUR enrichment layers** (see [04][05]),
identical to the Meta side.

---

## 2. Delivery / spend (FETCH, OFFICIAL — mostly maps cleanly)

| Field | Level | Class | Notes |
|---|---|---|---|
| `metrics.impressions`, `metrics.clicks` | any | FETCH OFFICIAL | Direct analogue to Meta. |
| `metrics.cost_micros` | any | FETCH OFFICIAL | **Cost is in micros** — divide by 1e6 for currency. Easy to get wrong; guard at ingest. |
| `metrics.average_cpc`, `metrics.average_cpm`, `metrics.ctr` | any | FETCH OFFICIAL | Google-provided; CTR = clicks/impressions. |
| `segments.date` (day-wise via GAQL segment) | any | FETCH OFFICIAL | **Day-wise snapshots** ([22][24]) come from `segments.date`, not a `time_increment` param. |
| campaign budget, `campaign.status` / `ad_group.status` | campaign/adset | FETCH OFFICIAL | Note Google **shared budgets** across campaigns — attribute carefully. |
| spend velocity, 7/14/30d spend trend, concentration | any | CALC DERIVED | From daily `cost_micros`; same formulas as [02]. |
| **`frequency`** | — | **CANNOT-KNOW (Search) / FETCH partial (Video/Display/Demand Gen)** | **KEY DIFFERENCE: Google has no universal frequency.** Reach/avg-frequency exist only for reach-based types (YouTube/Display/Demand Gen) via unique-reach metrics; **Search has none**. Frequency-based fatigue (a core Meta signal) **does not transfer** — flag as unavailable per campaign type. |

---

## 3. Attention / video (YouTube-shaped, not feed-shaped)

Google's "attention" lives mostly on **YouTube/Video** and is defined differently from Meta's
3-sec/thruplay model.

| Field | Level | Class | Notes |
|---|---|---|---|
| `metrics.video_views` | ad/creative | FETCH OFFICIAL | A "view" ≠ Meta's 3-sec play. On skippable in-stream, a view = **30s / full / interaction** (verify current def at build). Not comparable to Meta hook rate. |
| `metrics.video_view_rate` | ad/creative | FETCH OFFICIAL | Views / impressions (Google's def). |
| `metrics.video_quartile_p25/p50/p75/p100_rate` | ad/creative | FETCH OFFICIAL | Quartile completion — the closest analogue to Meta's p25–100 watched actions. |
| **hook rate** (Google) | creative | **CALC DERIVED / UNKNOWN** | No clean Meta-equivalent "3-sec/impressions". Any Google "hook rate" must be **explicitly redefined** (e.g. p25 rate) and labeled DERIVED, never presented as the same metric as Meta hook rate. |
| retention curve, attention decay | creative | CALC DERIVED | From quartile rates; coarser than Meta (4 points, not a curve). |
| `metrics.engagements`, `metrics.interactions`, `metrics.interaction_rate` | any | FETCH OFFICIAL | Google-specific engagement counters; map to metric taxonomy cat. C with care. |

---

## 4. Click quality + **auction competitiveness** (Google-unique — the real edge)

This is where Google gives intelligence **Meta cannot**: how competitive the auction is and whether
we are losing to budget or to rank. There is no Meta analogue — treat as a distinct capability, not a
port of a Meta metric.

| Field | Level | Class | Notes |
|---|---|---|---|
| `metrics.search_impression_share` | campaign/adgroup | FETCH OFFICIAL | Share of eligible impressions won. **Google-unique.** High-value for the scaling engine [11]. |
| `metrics.search_budget_lost_impression_share` | campaign/adgroup | FETCH OFFICIAL | Impression share lost **to budget** → a direct "scale this" signal. |
| `metrics.search_rank_lost_impression_share` | campaign/adgroup | FETCH OFFICIAL | Lost **to Ad Rank** → a "fix quality/bid" signal, not a budget one. Distinguishing these is the whole point. |
| `metrics.search_top_impression_share`, `search_absolute_top_impression_share` | campaign/adgroup | FETCH OFFICIAL | Position quality on the page. |
| **Quality Score** `ad_group_criterion.quality_info.quality_score` (+ components) | keyword | FETCH OFFICIAL | 1–10, **Search keyword-level, Google-unique**. Components: expected CTR, ad relevance, LP experience. No Meta twin. |
| `search_term_view` (actual queries) | search term | FETCH OFFICIAL | Real user intent language — feeds persona/angle/message intelligence in a way Meta cannot. |
| **Auction Insights** (competitor impression share, overlap rate, outranking share) | campaign | **CANNOT-KNOW via API / UNKNOWN** | Visible in the Google **UI** but **not exposed in the Ads API** (verify at build — this has been a long-standing gap). Do not scrape-and-fabricate; competitor economics stay UNKNOWN, same rule as [02]. |

---

## 5. Creative assets (assembled, not monolithic — and text-first on Search)

The deepest structural difference for **creative intelligence**. On Meta a creative is one object;
on Google an ad is **assembled at serve time from assets**, and on Search the "creative" is
**text**, so the fingerprint [05] pipeline (frames, visual embeddings, hooks) partly does not apply.

| Field | Level | Class | Notes |
|---|---|---|---|
| `ad_group_ad.ad` (RSA headlines/descriptions, RDA assets) | ad | FETCH OFFICIAL | Responsive Search Ads = up to N headlines + descriptions Google mixes. "Creative" analysis here is **copy analysis**, not visual. |
| `asset` (image/video/text/sitelink/callout) | asset | FETCH OFFICIAL | The reusable building blocks; join via `ad_group_ad_asset_view` / `asset_group_asset`. |
| **`...asset_view.performance_label`** (LOW / GOOD / BEST / LEARNING) | asset | FETCH OFFICIAL | **Google-unique, coarse** per-asset rating. Useful signal, but 4 buckets ≠ AdBrain's continuous scores — treat as INPUT, not as our score. |
| video transcript | creative | EXTERNAL / CALC | Same as Meta: transcription service / Gemini native video. YouTube may expose captions (verify), else external. |
| video frames, visual attributes, embeddings | creative | EXTERNAL / CALC | Computer vision (Gemini / Google Vision); store once as a fingerprint [05]. Applies to **Video/Display/Demand Gen/PMax**, not Search text. |
| persona / hook / angle / concept labels | creative | INFER | AI-labeled; INFERENCE with confidence — same as [02]. |
| landing page content, message-match, `final_urls` | ad/asset | FETCH (URL) + EXTERNAL (crawl) | `final_urls` is a fetched field; LP content still needs the crawler. |
| product info (Shopping/PMax via Merchant Center) | product | EXTERNAL | Google Merchant Center feed; PMax listing groups reference it. |

---

## 6. Conversion / economics (same external ceilings as Meta, plus DDA)

| Field | Level | Class | Notes |
|---|---|---|---|
| `metrics.conversions`, `metrics.conversions_value`, `metrics.all_conversions*` | any | FETCH OFFICIAL | **Attribution-model + conversion-action dependent.** Google defaults to **data-driven attribution (DDA)** — modeled, so even the "official" number carries model assumptions. Flag it. |
| `metrics.cost_per_conversion`, `metrics.conversions_from_interactions_rate` (CVR) | any | CALC / FETCH | ROAS = `conversions_value` / (cost_micros/1e6) → CALC DERIVED. |
| new-customer CAC / new-vs-returning | account/campaign | **EXTERNAL (mostly)** | Google has a **New Customer Acquisition goal** and new-customer conversion values, but a reliable new/returning split still needs Shopify/CRM — treat as EXTERNAL, same as [02]. |
| MER, blended ROAS, contribution margin | account | EXTERNAL | Finance/Shopify. Cross-platform blended truth is **more** relevant here because Google + Meta must be blended — but still EXTERNAL. |
| **incremental revenue / iROAS, marginal CAC/ROAS, elasticity** | any | INFERENCE | Google offers **Conversion Lift / geo experiments (drafts & experiments)** natively — better raw material than Meta for causal claims, but still MODEL ESTIMATE, never a fact. |
| LTV, LTV:CAC, payback | account | EXTERNAL | CRM/subscription/finance. |

---

## 7. Where Google structurally differs from Meta (design summary)

| Dimension | Meta | Google | Build implication |
|---|---|---|---|
| Demand type | Interruption / demand-gen (push) | High-intent search (pull) + YouTube/Display (push) | Creative intelligence must **branch by surface**: Search = copy/intent; Video/PMax/Demand Gen = Meta-like visual. |
| Frequency | Native, all levels | Search: **none**; reach types: partial | Frequency-based **fatigue does not port**; use CPC/QS/impression-share decay instead on Search. |
| Auction transparency | Opaque | **Impression share + lost-to-budget/rank + Quality Score** | Google enables a *better* scaling/waste signal on Search than Meta — build it as Google-only capability, not a Meta port. |
| Creative unit | One creative object | **Assets assembled** (RSA/PMax) | Fingerprint [05] operates at **asset** level; expect partial/coarse (`performance_label`) signals. |
| Competitor intel | Ad Library (active ads) | Ads Transparency Center (active ads); **Auction Insights not in API** | Competitor economics UNKNOWN on both; Auction Insights is UI-only — do not fabricate. |
| Black-box campaign types | Advantage+ (partial) | **Performance Max** (heavy) | PMax exposes limited asset-group/channel data, **no keyword/placement drill-down** — mark those dimensions CANNOT-KNOW for PMax. |
| Attribution | Pixel/CAPI, window-based | **DDA default (modeled)** | Even "official" Google conversions are modeled — label accordingly on every economics view. |

---

## 8. Hard limits (CANNOT-KNOW / heavily caveated)

- **Auction Insights competitor share** → UI-only, **not in the API** (verify at build). Competitor
  economics remain UNKNOWN, same rule as [02].
- **Performance Max internals** → no keyword-, placement-, or per-channel-level breakdown of
  spend/results; asset-group is the floor. Mark PMax drill-downs CANNOT-KNOW.
- **Frequency on Search** → does not exist; any "Google frequency" is per-type only.
- **True incrementality without an experiment** → INFERENCE, even though Google Lift/geo experiments
  give better raw material than Meta.
- **DDA-modeled conversions** → the "official" number is itself a model; never present as ground
  truth without the attribution caveat.
- **Version churn** → any field name here can be renamed/removed on the next API version; the schema
  is a shape, not a contract.

---

## 9. Consequences for the build

- **Google is Phase-2, not MVP.** The Meta-only MVP ships first ([02]); Google connects behind the
  developer-token + MCC + access-level gate (§0). Until connected, Google surfaces read
  **"source not connected"**.
- **Blend, don't merge.** Google + Meta share ROAS/CPA/conversions *names* but not definitions
  (DDA vs pixel window; view vs 3-sec play; ad group vs ad set). The warehouse [24] must store the
  **source platform + level + attribution model** on every row so [01] never compares unlike things.
- **Play to Google's strengths, don't force Meta's frame.** Impression-share (budget vs rank),
  Quality Score, and search-term intent are Google-only intelligence the scaling [11] / waste [10] /
  message engines should exploit — not shoehorned into Meta-shaped fatigue.
- **Every dictionary [01] metric that has a Google source cites its row here + its fact tag + its
  Google level, and every field is re-verified against the pinned API version at build.**
