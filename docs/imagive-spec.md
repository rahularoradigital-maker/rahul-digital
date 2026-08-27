# Imagive.ai teardown → AdBrain feature spec

Source: saved snapshot of Imagive.ai **Competitive Analysis** screen (captured 2026-08-27),
brand = **boAt**, tracking 3 competitors (JBL, Gonoise, Mivi). The snapshot is a
client-rendered SPA; only the Competitive Analysis module was hydrated, so this spec covers
that screen exhaustively. Other modules exposed in Imagive's nav but not rendered:
**Account analytics**, **Creator intelligence**, **Ads library**, plus a creation suite
(Bulk ad maker, Smart resizer, Hook/Image generator, Whiteboard). Imagive is an ad *maker*
first, so several "insights" terminate in a **"use this creative and text"** hand-off into
their generator — that remix loop is their moat, not a metric.

## How to read the coverage column
- **COVERED** — we already compute this (or a stronger version).
- **GAP (fillable)** — we hold the raw data; needs a small aggregation/UI layer.
- **GAP (needs plumbing)** — fillable but requires new storage (history snapshots) or a new field pull.
- **NOT FEASIBLE** — the underlying number does not exist in our sources for the competitor case (usually: no impression/reach data for non-EU commercial ads in the public Ad Library).

Our sources, per the brief:
**(a) Meta Ads Marketing API** — day-wise insights for *our own* account (spend, impr, clicks, purchases, revenue, frequency, video/funnel actions).
**(b) ScrapeCreators / FB Ad Library** — *competitor* creative, copy, CTA, format, dates, platforms, media URLs.
**(c) Gemini** — our 42-attribute creative read (hook/offer/visual/funnel...).

---

## 1. "Ad Performance Intelligence" KPI band

| # | Metric (Imagive label) | What it measures | How Imagive shows it | Our source | Coverage | Value |
|---|---|---|---|---|---|---|
| 1 | **Total Active Ads** — `286` | Count of live ads across you + all tracked competitors | Big number + "across you & 3 competitors" + delta chip **"163 vs last 30d"** | (b) `activeAds` per brand, summed | Number COVERED; delta = **GAP (needs plumbing)** — we delete-then-insert, keep no history, so a "vs last 30d" trend needs a snapshot table | **High** |
| 2 | **Creative Mix** — Carousel 49% (140) / Video 51% (146) / Image 0% (0) | Format distribution of the ad set | 3 stacked % rows with ad counts | (b) `formatMix` (video/image/carousel/other) | **COVERED** (we have counts; just render as %) | **High** |
| 3 | **Low Impression Creatives** — `0%` "ads with below-average visibility" + status pill **"🟢 Good (healthy reach)"** | Share of ads getting little delivery | % + traffic-light health pill | Impressions/reach — **not in the public Ad Library for IN commercial ads**; only exists via (a) for *our own* account | **NOT FEASIBLE for competitors** (the `0%` is almost certainly a placeholder/heuristic). For **our own** brand: **GAP (fillable)** from (a) impressions | **Low** (competitor) / **Med** (own) |
| 4 | **New Ads This Week** — `14.7%` "already outperforming category" + **"14.7% vs prev week"** | Launch velocity — how fast the brand ships new creative | % + WoW delta + category-benchmark blurb | (b) `startDate` gives new-ad counts, but WoW comparison needs history | **GAP (needs plumbing)** — computable once we snapshot counts over time (or infer from start dates within the window) | **High** — cadence is a real competitive tell |

---

## 2. Top Performing Ads (ranking)

| # | Item | What it measures | How Imagive shows it | Our source | Coverage | Value |
|---|---|---|---|---|---|---|
| 5 | **Top Performing Ads** "across all tracked competitors · last 30d" | A ranked shortlist of the best creatives in the market | Card list: ad copy + **longevity badge** + **objective label** + a **"Why?"** explainer | (b) ranking proxy + (c) narration | **GAP (fillable)** — see 6–8 for the signals; we have `topCreatives` but rank only by active+recent, not a defensible "top performer" score | **High** |
| 6 | **Longevity badge** — "1+ year" / "Last 1 year" | Days the ad has run continuously | Text badge on each top ad | (b) `startDate` (unix) → days running | **GAP (fillable)** — trivial from data we store. **This is the core Ad-Library winner proxy**: long-running ad = it converts, or they'd have killed it | **High** |
| 7 | **Objective label** — "Conversion" | Funnel intent of the ad | Tag under each ad | (c) `funnelStage` TOF/MOF/BOF, or (b) `ctaType` heuristic | **COVERED (partial)** — we classify funnel stage; "Conversion/Traffic/Awareness" objective mapping is a thin relabel | **Med** |
| 8 | **"Why?" explainer** | Plain-English reason this ad ranks as a top performer | Tooltip/expander per ad | (c) Gemini/Claude narration over 6+7 signals | **GAP (fillable)** — this is the "written layer" already flagged as *not yet built* in `competitor-intelligence.md` | **High** — narration is what makes the ranking trustworthy |

**Ranking logic (inferred):** with no spend/impression data on competitors, Imagive ranks
"top performing" almost entirely by **longevity + number of active variations** (see 12).
This is the honest, well-known Ad-Library proxy and we can reproduce it exactly.

---

## 3. Platform Distribution

| # | Metric | What it measures | How Imagive shows it | Our source | Coverage | Value |
|---|---|---|---|---|---|---|
| 9 | **Platform Distribution** — FB 41.4% (282), IG 39.5% (269), Messenger 9.3% (63), Audience Network 6.2% (42), Threads 3.7% (25) | Where the brand's ads are placed | Total + ranked % rows with counts | (b) `platformMix` (publisher_platforms) | **COVERED** (we tally platforms; render as %) | **Med** |
| 10 | **Placement insight vs peers** — "FB dominates your mix (41.4%) — but competitors average 27.3%. You may be over-indexed on Facebook..." | Over/under-indexing of your placement mix vs the competitor set | One narrated sentence | (b) cross-brand aggregation + (c) narration | **GAP (fillable)** — we have every brand's `platformMix`; just diff my-brand % against competitor mean and narrate | **High** — turns a chart into a decision |

---

## 4. Collaborator / Influencer Ads

| # | Metric | What it measures | How Imagive shows it | Our source | Coverage | Value |
|---|---|---|---|---|---|---|
| 11 | **Collaborator's Ads** — 0% share, 0 total influencers | Ads running through creator/branded-content profiles | % share of total + influencer count (empty state here) | (b) *if* ScrapeCreators exposes branded-content partner / `byline` / secondary page on the ad | **GAP (needs plumbing)** — feasibility depends on whether the Ad Library payload carries a creator/partner field; verify before promising it | **Med** — creator strategy is a genuine gap in our product |

---

## 5. Ad Traffic Distribution (destination intelligence)

| # | Metric | What it measures | How Imagive shows it | Our source | Coverage | Value |
|---|---|---|---|---|---|---|
| 12 | **Ad Traffic Distribution** — boat-lifestyle.com 157 (54.9%), amazon.in 103 (36%), amzn.in 14 (4.9%), dl.flipkart.com 6 (2.1%), instagram.com 5 (1.7%) | Where a competitor sends its ad clicks (own D2C site vs marketplaces vs app) | Ranked destination-domain list, ad counts + % "Redirected" | (b) `linkUrl` → parse domain, tally | **GAP (fillable)** — we already store `linkUrl`; just group by registrable domain | **High** — reveals D2C-vs-Amazon/Flipkart retail strategy at a glance; cheap to build, distinctive |

---

## 6. Recent Competitor Ads feed

| # | Item | What it measures | How Imagive shows it | Our source | Coverage | Value |
|---|---|---|---|---|---|---|
| 13 | **Recent ads feed** — brand, **"Started running on <date>"**, hook line + body, headline, CTA ("Shop now"), video/image | Fresh creative stream per competitor | Card grid, most-recent first | (b) full `NormalizedAd` (body, title, ctaText, dates, media) | **COVERED** — this is our `topCreatives` list; sort by `startDate` desc for a "recent" view | **Med** |
| 14 | **Variation count** — "3 ads" / "5 ads" / "1 ads" per card | How many near-duplicate variants of one creative are live (a spend/confidence proxy) | Small count on each card | (b) group ads by creative similarity (same video/image hash or same body) | **GAP (fillable)** — needs a dedupe/grouping pass over stored ads; doubles as a top-performer signal (more variants = higher conviction) | **High** — strong, honest proxy for "what they're betting on" |
| 15 | **"use this creative and text"** action | One-click remix of a competitor ad into your own | Button on every ad card | n/a — creation flow | **OUT OF SCOPE** (Imagive is a generator; we are intelligence). Note as a potential Claude "rewrite in my brand voice" hand-off if we ever add generation | **Low** now |
| 16 | **"View brand on Facebook Ads Library"** deep link | Verifiable source link | Header link per brand | (b) we already build real Ad Library permalinks (rule: never a search URL) | **COVERED** | **Med** |

---

## Ranked backlog — what to add (highest value first)

1. **Ad Traffic Distribution (#12)** — parse `linkUrl` → domain tally. Near-zero cost, data already stored, and uniquely exposes D2C-vs-marketplace strategy. *Ship first.*
2. **Longevity-based Top Performers + "Why?" (#5, #6, #8)** — rank by days-running × active-variation count, narrate with Claude/Gemini. This is the flagship "written layer" already scoped as not-yet-built. Highest analytical value.
3. **Variation/dedupe count per creative (#14)** — grouping pass that powers both the top-performer score and the recent feed. Honest conviction proxy.
4. **Cross-brand placement insight (#10)** + **Creative Mix as % (#2)** — pure aggregation over data we already compute; converts existing charts into decisions.
5. **Launch velocity / New-ads-this-week (#1 delta, #4)** — requires a lightweight **snapshot table** (periodic ad-count history). One schema change unlocks every "vs last period" trend Imagive shows.
6. **Collaborator/influencer ads (#11)** — verify the Ad Library payload first; real product gap if the field exists.
7. **Own-brand impression health (#3)** — only from Meta API for our own account; skip for competitors (data does not exist for IN commercial ads — do not fabricate it, per our no-fabrication rule).

## Honesty flags (do not copy Imagive blindly)
- **"Low Impression Creatives / healthy reach" (#3)** for competitors is not backed by real
  data in the public Ad Library for India — treat Imagive's `0%` as decorative. We must not
  invent a reach number for a competitor.
- **All "vs last 30d / vs prev week" deltas (#1, #4)** need history we don't yet keep. Either
  add snapshots or don't show the delta — a fabricated trend is worse than no trend.
- Imagive's **"Top Performing"** has no true performance data on competitors; it is a
  longevity/variation proxy. We can match it *and* be more transparent by labelling it as a
  proxy in the "Why?" text.
