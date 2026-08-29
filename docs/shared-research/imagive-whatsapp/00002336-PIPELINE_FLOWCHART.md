# Creative Analysis Pipeline — Flowchart

**Date:** 2026-07-10

---

## Full Pipeline (Top to Bottom)

```mermaid
flowchart TD
    START([" 🚀 POST /scan/{id}/creative-analysis\n media_type = only_image | only_text | auto "])

    START --> FETCH["📦 Fetch Ads from DB\n facebook_ads_libraries\n ─────────────────────\n Active-first, oldest start_date\n Top 10 ads per brand"]

    FETCH --> MEDIACHECK{Is media_type\nimage / video /\ncarousel / auto?}

    %% TEXT ONLY PATH
    MEDIACHECK -- "only_text" --> BUILDTEXT["📝 buildTextInput()\n ─────────────────\n ## BRAND\n Name, Category, Followers\n ## ADS (N)\n  Headline, Description,\n  CTA, Status, Platforms"]

    %% VISUAL PATH
    MEDIACHECK -- "visual type" --> EXTRACTURLS["🔗 extractImageUrls()\n ─────────────────────\n only_image  → ad_image_url\n only_video  → video_poster\n only_carousel → carousel_images\n auto  → all of the above"]

    EXTRACTURLS --> PYTHONPOOL["⚡ Http::pool() — Parallel\n POST /creative-analyser/media/summary\n ─────────────────────────────────────\n Auth: Basic user:password\n Header: x-api-token\n Body: multipart image_urls[]"]

    PYTHONPOOL --> PYTHONRESP["🐍 Python Returns Per Ad\n ─────────────────────────\n creative_type\n summary\n key_message\n visual_summary\n detected_elements:\n   • hook\n   • text_overlays\n   • products / offers / cta\n video_analysis:\n   • transcript, speaker\n   • engagement, hook_strength\n   • color, narrative, compliance\n image_analysis:\n   • composition, text_detection\n   • scroll_stop_probability\n ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n ❌ token_usage  STRIPPED OUT"]

    PYTHONRESP --> ASSEMBLEVIS["🔧 Assemble visualSummaryRaw\n ────────────────────────────\n[Ad 123 | status: active | running since: Jun 8]\n{\n  'creative_type': 'image',\n  'summary': '...',\n  'detected_elements': { hook, text_overlays },\n  'image_analysis': { ... }\n}\n\n --- \n\n[Ad 456 | status: active | ...]\n{ ... }"]

    ASSEMBLEVIS --> BUILDTEXT2["📝 buildTextInput()\n ─────────────────\n ## BRAND + ## ADS text\n (skipped for pure visual types)"]

    BUILDTEXT --> PRIME
    BUILDTEXT2 --> PRIME

    PRIME["🔑 primeInstructions()\n ────────────────────\n Upload MASTER PROMPT once\n → returns prime_id\n Saves (N-1) × 600 tokens\n per analysis request"]

    PRIME --> BUILDPAYLOAD

    BUILDPAYLOAD{Build OpenAI\nPayload by\nmedia_type}

    BUILDPAYLOAD -- "only_text" --> PAYLOAD_TEXT["📄 Text Payload\n ──────────────\n instructions: system_prompt\n previous_response_id: prime_id\n input: brand+ads text string\n max_output_tokens: 8192\n temperature: 0.7"]

    BUILDPAYLOAD -- "only_image\nonly_video\nonly_carousel" --> PAYLOAD_VISUAL["🖼️ Pure Visual Payload\n ──────────────────────\n instructions: system_prompt\n previous_response_id: prime_id\n input: [\n   { type: input_text,\n     text: ## VISUAL ANALYSIS\n           + visualSummaryRaw },\n   { type: input_image,\n     image_url: url_1 },\n   { type: input_image,\n     image_url: url_2 },\n   ...up to 10 images\n ]"]

    BUILDPAYLOAD -- "image_text\nvideo_text\ncarousel_text\nauto" --> PAYLOAD_COMBINED["📋 Combined Payload\n ────────────────────\n instructions: system_prompt\n previous_response_id: prime_id\n input: [\n   { type: input_text,\n     text: brand+ads text\n           + ## VISUAL ANALYSIS\n           + visualSummaryRaw },\n   { type: input_image, url_1 },\n   { type: input_image, url_2 },\n   ...up to 10 images\n ]"]

    PAYLOAD_TEXT --> OPENAI_PARALLEL
    PAYLOAD_VISUAL --> OPENAI_PARALLEL
    PAYLOAD_COMBINED --> OPENAI_PARALLEL

    OPENAI_PARALLEL["⚡ Http::pool() — All Brands Parallel\n POST /v1/responses\n ─────────────────────────────────\n Authorization: Bearer OPENAI_API_KEY\n model: gpt-5.2\n All brand payloads fire simultaneously"]

    OPENAI_PARALLEL --> OPENAI_RESP["🤖 OpenAI Returns per Brand\n ────────────────────────────\n 1. Messaging System\n    (core promise, belief map,\n     buyer motivators score)\n 2. Tone Audit\n    (tone profile, gaps,\n     competitor comparison)\n 3. Creative Diversification\n    (hook diversity 1-10,\n     format diversity 1-10,\n     angle saturation)\n 4. Hormozi Value Framework\n    (dream outcome, proof,\n     value ladder)\n 5. Top 3 Hooks\n    (production-ready,\n     psychological mechanism)\n 6. Prioritized Recommendations\n    (5-7 ranked by impact)"]

    OPENAI_RESP --> POSTBUNDLE["🔄 generatePostAnalysisBundle()\n ────────────────────────────────\n Fires 3 more parallel OpenAI calls:\n • executive_summary (ai_overview)\n • brand_category_strategic_read\n • funnel_mix + comparison_table"]

    POSTBUNDLE --> ADVANCEDBUNDLE["🔄 generateAdvancedBundle()\n ────────────────────────────\n Fires 4 more parallel OpenAI calls:\n • score_card\n • hook_matrix\n • offer_architecture + creator_network\n • boat_swot + gap_analysis + recommendation"]

    ADVANCEDBUNDLE --> DBBUILD["🗄️ Build from DB (no AI)\n ────────────────────────\n • buildAdsVolumeChart()\n • buildTopPerformingHooks()  ← DB headlines\n • buildCreativeMixByBrand()\n • buildCreativeDb()\n • buildFunnelMix()"]

    DBBUILD --> STORE["💾 Store Result in DB\n ad_analyzer_scans\n ─────────────────\n status: completed\n result: JSON\n batch_id: uuid"]

    STORE --> RESPONSE["✅ Final Response\n ─────────────────\n ai_overview\n brand_category_strategic_read\n visual_comparison\n   └ ads_volume\n   └ top_performing_hooks  ← DB\n   └ creative_mix_by_brand\n funnel_mix\n comparison_table\n score_card\n hook_matrix\n offer_architecture\n creator_network\n boat_swot\n creative_db\n gap_analysis\n recommendation\n total_token_usage\n media_pipeline  ← debug\n   └ python_summaries per ad\n   └ urls_analyzed per ad"]
```

---

## Python Per-Ad Data Structure

```mermaid
flowchart LR
    AD["Ad Entry\n ad_id\n image_urls[]\n video_url\n video_poster"]

    AD --> PY["Python API\n /creative-analyser\n /media/summary"]

    PY --> FIELDS["Full Response\n ──────────────"]

    FIELDS --> F1["creative_type\n 'image' | 'video_type_1'\n 'video_type_2' | 'carousel'"]
    FIELDS --> F2["summary\n One paragraph overview"]
    FIELDS --> F3["key_message\n One sentence"]
    FIELDS --> F4["visual_summary\n Layout + color + mood"]
    FIELDS --> F5["detected_elements\n ├─ hook ← ⚠️ may be visual desc\n ├─ text_overlays ← actual text\n ├─ products[]\n ├─ offers[]\n └─ cta"]
    FIELDS --> F6["video_analysis\n ├─ speech transcript\n ├─ hook_strength\n ├─ engagement_signals\n ├─ attention_and_salience\n ├─ compliance_and_safety\n ├─ color_and_style\n └─ narrative_and_script"]
    FIELDS --> F7["image_analysis\n ├─ composition\n ├─ text_detection\n ├─ dominant_palette\n └─ scroll_stop_probability"]
    FIELDS --> F8["token_usage\n ❌ STRIPPED\n not sent to OpenAI"]
```

---

## Hook Generation Logic

```mermaid
flowchart TD
    HOOKREQ["Need: top_performing_hooks\nper brand"]

    HOOKREQ --> MEDIATYPE{media_type?}

    MEDIATYPE -- "ALL types\n(fixed in latest version)" --> DBQUERY["SELECT headline, primary_text,\nlibrary_id, start_date\nFROM facebook_ads_libraries\nWHERE facebook_ads_pages_id = ?\nAND headline IS NOT NULL\nAND CHAR_LENGTH(headline) <= 150\nAND headline NOT REGEXP '^https?://'"]

    DBQUERY --> BLACKLIST["Filter Blacklist\n───────────────\n❌ 'See details'\n❌ 'default_collection_headline'\n❌ 'Visit Instagram Profile'\n❌ 'Install now'\n❌ 'Shop Now'\n❌ 'Learn more'\n❌ 'undefined'\n+ 15 more generic CTAs"]

    BLACKLIST --> PERIOD{Last 30 days\nhave 5+\ndistinct headlines?}

    PERIOD -- Yes --> LAST30["Use last_30d slice\nperiod = 'last_30d'"]
    PERIOD -- No --> ALLTIME["Use all_time slice\nperiod = 'all_time'"]

    LAST30 --> RANK["Group by headline\nCount occurrences\nSort DESC\nTake top 5"]
    ALLTIME --> RANK

    RANK --> HOOKS["hooks: [\n  { rank:1, hook: 'Shop Skechers Now',\n    ads_count: 8, relative_pct: 100 },\n  { rank:2, hook: 'Comfort That Performs',\n    ads_count: 1, relative_pct: 13 },\n  ...\n]"]

    HOOKS --> DEBUG["hooks_debug: [\n  { headline: 'Shop Skechers Now',\n    ads: [\n      { library_id, primary_text, start_date },\n      ...\n    ]\n  }\n]"]
```

---

## OpenAI Prompt Chain (Token Optimization)

```mermaid
sequenceDiagram
    participant PHP
    participant OpenAI

    Note over PHP,OpenAI: STEP 1 — Prime once (saves tokens)
    PHP->>OpenAI: POST /v1/responses<br/>{ input: masterPrompt + "Acknowledge: ready",<br/>  max_output_tokens: 16, store: true }
    OpenAI-->>PHP: { id: "resp_prime_abc123" }

    Note over PHP,OpenAI: STEP 2 — All brands fire in parallel
    PHP->>OpenAI: Brand A payload<br/>{ previous_response_id: "resp_prime_abc123",<br/>  input: [brand_text + visual_summary + images] }
    PHP->>OpenAI: Brand B payload<br/>{ previous_response_id: "resp_prime_abc123", ... }
    PHP->>OpenAI: Brand C payload<br/>{ previous_response_id: "resp_prime_abc123", ... }
    PHP->>OpenAI: Brand D payload<br/>{ previous_response_id: "resp_prime_abc123", ... }

    OpenAI-->>PHP: Brand A analysis (6-section text)
    OpenAI-->>PHP: Brand B analysis (6-section text)
    OpenAI-->>PHP: Brand C analysis (6-section text)
    OpenAI-->>PHP: Brand D analysis (6-section text)

    Note over PHP,OpenAI: STEP 3 — Post-analysis bundles
    PHP->>OpenAI: generatePostAnalysisBundle()<br/>(executive summary, category read, funnel mix)
    PHP->>OpenAI: generateAdvancedBundle()<br/>(score_card, hook_matrix, swot, gap_analysis)

    OpenAI-->>PHP: All bundle responses

    Note over PHP: STEP 4 — DB-only (no AI)<br/>top_performing_hooks, ads_volume,<br/>creative_mix, creative_db
```

---

## What Goes Wrong — Common Bug Map

```mermaid
flowchart TD
    BUG1["❌ Hook = visual description\n'Minimal, high-contrast product-only\npresentation highlighting the tall/\nknee-high fit and Nike swoosh branding'"]

    BUG1 --> ROOT1["Root Cause:\nPython detected_elements.hook\ngenerates composition description\nwhen no text visible in image"]

    ROOT1 --> FIX1["✅ Fix Applied:\nbuildTopPerformingHooks() uses\nDB headline column for ALL media types\nPython hook field ignored for ranking"]

    BUG2["❌ Hook = generic UI label\n'See details' | 'Install now'\n'default_collection_headline'"]

    BUG2 --> ROOT2["Root Cause:\nFacebook stores CTA button text\nin the headline column for\nsome ad formats (app-install, carousel)"]

    ROOT2 --> FIX2["✅ Fix Applied:\nBlacklist of 22 generic strings\nfiltered in SQL query:\nLOWER(TRIM(headline)) NOT IN (...)"]

    BUG3["❌ image_analysis = null\nin OpenAI prompt"]

    BUG3 --> ROOT3["Root Cause:\nHardcoded field list in buildPayload()\ndid not include 'image_analysis' key"]

    ROOT3 --> FIX3["✅ Fix Applied:\narray_diff_key(r, ['token_usage'=>true])\nPasses ALL Python fields automatically"]

    BUG4["❌ SQLSTATE 42S22\nUnknown column 'ad_description'"]

    BUG4 --> ROOT4["Root Cause:\nMigration 2026_05_07 renamed\nad_description → primary_text\nin facebook_ads_libraries table"]

    ROOT4 --> FIX4["✅ Fix Applied:\nQuery updated to use primary_text\nin both SELECT and hooks_debug map"]
```

---

## Response Key Map

```mermaid
flowchart LR
    RESP["Final API Response\n/creative-analysis/result"]

    RESP --> S1["ai_overview\n └ executive_summary\n └ where_you_lead\n └ where_you_lag\n └ what_to_do"]

    RESP --> S2["brand_category_strategic_read\n └ focus_brand_read\n └ category_read\n   └ competitive_clusters\n   └ category_leaders"]

    RESP --> S3["visual_comparison\n └ ads_volume  ← DB\n └ top_performing_hooks  ← DB\n └ creative_mix_by_brand  ← DB"]

    RESP --> S4["funnel_mix\n comparison_table\n score_card\n hook_matrix\n offer_architecture\n creator_network\n boat_swot"]

    RESP --> S5["creative_db\n └ all captured ads\n └ funnel / format filters\n └ hook, offer, description per ad"]

    RESP --> S6["gap_analysis\n recommendation"]

    RESP --> S7["media_pipeline  ← DEBUG\n └ my_brand\n   └ python_summaries[]\n     └ ad_id + full Python JSON\n   └ urls_analyzed[]\n     └ ad_id + all URLs sent\n └ competitor_1, 2, 3..."]

    RESP --> S8["total_token_usage\n └ openai: input/output tokens\n └ python: by_model breakdown\n └ combined total"]

    style S7 fill:#ffe0b2,stroke:#e65100
    style S8 fill:#e8f5e9,stroke:#2e7d32
```
