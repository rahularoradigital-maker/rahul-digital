# 24 — Data Warehouse Schema

**Artifact 24 of the AdBrain master product spec.**
Persona lens: senior Meta media buyer + creative strategist + data scientist operating at ~$100M/mo spend. This schema exists to answer **"what should we do next?"** — so it is engineered around the *decision* layer (rules → recommendations → changes → measured effect), with reporting facts as a byproduct, not the goal.

Target engine: **PostgreSQL 15+ on Supabase** (with `pgcrypto`, `pgvector`, and native declarative partitioning).

---

## 0. Provenance & reconciliation status (read first)

| Item | Status at authoring (2026-08-25) | Consequence |
|---|---|---|
| `docs/product-spec/brief.md` | **NOT PRESENT** in workspace | Metric discipline applied from the artifact-24 task brief itself (10-question rule, decision gate, fact-labels). Reconcile wording at build. |
| `docs/product-spec/00-master-plan.md` | **NOT PRESENT** | Cross-artifact references below are to *expected* artifact numbers; verify at build. |
| `docs/product-spec/02-meta-data-mapping.md` | **NOT PRESENT** | Data-mapping classes (`FETCH` / `CALC` / `INFER` / `EXTERNAL` / `CANNOT-KNOW`) used here per the task definition. Column-level class assignments **must be reconciled** against the real mapping doc when it lands. |
| `supabase/migrations/0001_*.sql`, `0002_*.sql` | **NOT PRESENT** (no `supabase/` dir, no `.sql` in tree) | This artifact **assumes** the canonical contents of 0001/0002 (see §15) and defines all new objects as migrations **0003+**. If the real 0001/0002 differ, the reconciliation table in §15 is the merge contract. **Do not apply these DDLs blind — diff against real 0001/0002 first.** |

> **Rule (non-negotiable):** nothing in this schema is a fabricated Meta field. Every column carries a **fact-label**. Where a value is a benchmark or threshold that is unverified as of Aug 2026, it is stored as data with `provenance = 'UNKNOWN'` / `verify_at_build = true`, never hard-coded as truth.

---

## 1. Design principles

1. **Daily grain is mandatory.** Every fact table is a **day-wise snapshot** keyed by `(entity_id, date_key, attribution_window, action_report_time)`. No "current totals only" tables. Lifetime/aggregate numbers are always derived by summation over days, never stored as the source of truth. Rationale: creative fatigue, budget pacing, and CPA drift are only visible day-over-day; a lifetime blob destroys the decision signal.
2. **Official facts and derived metrics live in physically separate tables.** `*_insights_daily` = raw Meta Insights fields only (**OFFICIAL PLATFORM FACT**). `*_metrics_daily` = everything AdBrain computes (**INTERNAL CALCULATION (DERIVED)**). They share the same keys and join 1:1. A derived table is **never** allowed to hold a raw Meta field, and vice versa. This makes "is this an official number or our math?" answerable by table name alone.
3. **Dimensions vs facts.** Hierarchy entities (account/campaign/adset/ad/creative) are **dimension** tables holding identity + slowly-changing config; measures live only in fact tables. Config that changes over time is captured both as **SCD Type-2 history** (structural attributes) and as a **daily config snapshot** (pacing/budget/status), because "what was the budget on the day this CPA spiked?" is a first-class question.
4. **Immutability + restatement.** Meta restates the last ~28 days as conversions attribute late. So insights rows are **append-with-supersede**: a `loaded_at` + `is_current` flag per `(keys)`; we never destructively `UPDATE` a historical fact. §12 details restatement handling.
5. **Attribution window is part of the key, not a column you pick later.** The same ad-day has different numbers under `7d_click` vs `1d_view`. We store each window we fetch as its own row (`attribution_window` in the PK). No silent default.
6. **Separation of official time bases.** Meta reports either by *impression time* or *conversion time* (`action_report_time`). Both are part of the key so we never mix them.
7. **Every stored derived metric passes the decision gate** (§13). If a computed column changes no decision, it is tagged `class = 'vanity'` in `metric_catalog` and excluded from recommendation inputs.
8. **Multi-tenant from row zero.** Every table carries `account_id` (or joins to it) and is guarded by RLS keyed to `account_id`. AdBrain runs many advertiser accounts; leakage is the cardinal sin.

---

## 2. Legends

**Data-mapping class** (from `02-meta-data-mapping.md`, task definition):

| Class | Meaning |
|---|---|
| `FETCH` | Pulled directly from a Meta API field |
| `CALC` | Computed by AdBrain from FETCH inputs |
| `INFER` | Model/heuristic estimate, not measured |
| `EXTERNAL` | From a non-Meta source (CRM, Shopify, GA4, manual) |
| `CANNOT-KNOW` | Meta does not expose it; stored only if EXTERNAL supplies it |

**Fact-label** (stamped per column-group / per row):

`OFFICIAL PLATFORM FACT` · `INTERNAL CALCULATION (DERIVED)` · `RESEARCH-BACKED` · `INDUSTRY BENCHMARK` · `MODEL ESTIMATE` · `INFERENCE` · `UNKNOWN`

**Level:** `account` · `campaign` · `adset` · `ad` · `creative`.

---

## 3. Schema map

```
DIMENSIONS (identity + SCD2 config)          FACTS (daily grain)
──────────────────────────────────          ────────────────────────────────
ad_account ─┐                                account_insights_daily   (OFFICIAL)
            ├─ campaign ─┐                   campaign_insights_daily  (OFFICIAL)
            │            ├─ adset ─┐         adset_insights_daily     (OFFICIAL)
            │            │         ├─ ad ──  ad_insights_daily        (OFFICIAL)
            │            │         │         ad_action_breakdown_daily(OFFICIAL)
            │            │         │         ad_placement_daily       (OFFICIAL)
            │            │         │         ad_demographic_daily     (OFFICIAL)
            │            │         └─ creative (ad_creative)
            │            │
            │            └───────────────►   *_metrics_daily          (DERIVED, 1:1 per level)
            │
CREATIVE INTELLIGENCE          BRAND BRAIN           DECISION LAYER
───────────────────           ────────────          ──────────────────────
creative_asset                brand_triple          benchmark
creative_fingerprint          brand_entity          rule
creative_embedding (vector)   triple_source         recommendation
creative_element_tag                                change_log (interventions)
                                                     metric_catalog (self-doc)
```

Convention notes: `snake_case`; surrogate PK `id uuid default gen_random_uuid()`; every Meta object also stores its **native Meta id** as `text` (Meta ids exceed bigint range → always `text`). `date_key date` is the snapshot day in the **account's reporting timezone** (stored on `ad_account`).

---

## 4. Dimension tables (hierarchy)

### 4.1 `ad_account`  — level: account

| Column | Type | Class | Fact-label | Notes |
|---|---|---|---|---|
| `id` | uuid PK | — | — | surrogate |
| `meta_account_id` | text UNIQUE | FETCH | OFFICIAL PLATFORM FACT | e.g. `act_1234567890` |
| `name` | text | FETCH | OFFICIAL PLATFORM FACT | |
| `currency` | text | FETCH | OFFICIAL PLATFORM FACT | ISO-4217; all money below is in this currency, minor units |
| `timezone_name` | text | FETCH | OFFICIAL PLATFORM FACT | reporting tz; defines `date_key` |
| `spend_cap_minor` | bigint | FETCH | OFFICIAL PLATFORM FACT | nullable |
| `business_id` | text | FETCH | OFFICIAL PLATFORM FACT | owning BM |
| `attribution_default` | text | FETCH | OFFICIAL PLATFORM FACT | account default attribution setting |
| `created_time` | timestamptz | FETCH | OFFICIAL PLATFORM FACT | |
| `loaded_at` | timestamptz default now() | CALC | INTERNAL CALCULATION (DERIVED) | ETL bookkeeping |

### 4.2 `campaign` — level: campaign

Key parent: `account_id uuid → ad_account(id)`. Native `meta_campaign_id text UNIQUE`.

| Column | Type | Class | Fact-label |
|---|---|---|---|
| `id` uuid PK, `account_id` uuid FK | — | — | — |
| `meta_campaign_id` text UNIQUE | FETCH | OFFICIAL PLATFORM FACT |
| `name` text | FETCH | OFFICIAL PLATFORM FACT |
| `objective` text | FETCH | OFFICIAL PLATFORM FACT |
| `buying_type` text | FETCH | OFFICIAL PLATFORM FACT |
| `special_ad_categories` text[] | FETCH | OFFICIAL PLATFORM FACT |
| `bid_strategy` text | FETCH | OFFICIAL PLATFORM FACT |
| `daily_budget_minor` / `lifetime_budget_minor` bigint | FETCH | OFFICIAL PLATFORM FACT |
| `created_time` / `updated_time` timestamptz | FETCH | OFFICIAL PLATFORM FACT |

### 4.3 `adset` — level: adset

Parent `campaign_id`. Native `meta_adset_id`.

| Column | Type | Class | Fact-label | Notes |
|---|---|---|---|---|
| `meta_adset_id` text UNIQUE | FETCH | OFFICIAL PLATFORM FACT | |
| `name`, `optimization_goal`, `billing_event`, `bid_strategy` text | FETCH | OFFICIAL PLATFORM FACT | |
| `daily_budget_minor` / `lifetime_budget_minor` bigint | FETCH | OFFICIAL PLATFORM FACT | |
| `targeting` jsonb | FETCH | OFFICIAL PLATFORM FACT | raw targeting spec |
| `targeting_hash` text | CALC | INTERNAL CALCULATION (DERIVED) | stable hash of `targeting` for audience-dedupe & overlap analysis |
| `promoted_object` jsonb | FETCH | OFFICIAL PLATFORM FACT | pixel/event/app |
| `attribution_spec` jsonb | FETCH | OFFICIAL PLATFORM FACT | the adset's attribution setting |
| `start_time` / `end_time` timestamptz | FETCH | OFFICIAL PLATFORM FACT | |

### 4.4 `ad` — level: ad

Parent `adset_id`; also `creative_id uuid → ad_creative(id)`.

| Column | Type | Class | Fact-label |
|---|---|---|---|
| `meta_ad_id` text UNIQUE | FETCH | OFFICIAL PLATFORM FACT |
| `name`, `status`, `effective_status` text | FETCH | OFFICIAL PLATFORM FACT |
| `creative_id` uuid FK | FETCH | OFFICIAL PLATFORM FACT |
| `tracking_specs` / `conversion_specs` jsonb | FETCH | OFFICIAL PLATFORM FACT |
| `created_time` / `updated_time` timestamptz | FETCH | OFFICIAL PLATFORM FACT |

### 4.5 `ad_creative` — level: creative

The **creative** dimension. Distinct from `ad`: one creative may be reused across many ads/adsets — this is why creative-level intelligence (§7) hangs off `ad_creative`, not `ad`.

| Column | Type | Class | Fact-label | Notes |
|---|---|---|---|---|
| `id` uuid PK | — | — | — |
| `meta_creative_id` text UNIQUE | FETCH | OFFICIAL PLATFORM FACT | |
| `account_id` uuid FK | FETCH | OFFICIAL PLATFORM FACT | |
| `name` text | FETCH | OFFICIAL PLATFORM FACT | |
| `object_type` text | FETCH | OFFICIAL PLATFORM FACT | e.g. VIDEO, SHARE, DPA |
| `title` / `body` / `call_to_action_type` text | FETCH | OFFICIAL PLATFORM FACT | primary text/headline/CTA |
| `object_story_spec` jsonb | FETCH | OFFICIAL PLATFORM FACT | full spec |
| `asset_feed_spec` jsonb | FETCH | OFFICIAL PLATFORM FACT | for dynamic/Advantage+ creatives |
| `image_hash` / `video_id` text | FETCH | OFFICIAL PLATFORM FACT | links to `creative_asset` |
| `content_fingerprint` text | CALC | INTERNAL CALCULATION (DERIVED) | dedupe of "same creative, new id" (see §7.2) |
| `created_time` timestamptz | FETCH | OFFICIAL PLATFORM FACT | |

### 4.6 SCD Type-2 config history — `entity_config_scd`

Structural attribute changes (budget, status, bid strategy, targeting hash) that must be time-travelable for intervention attribution. **One table, polymorphic by level**, to avoid five near-identical tables (ponytail: one table + a `level` enum beats five copies).

```sql
CREATE TYPE entity_level AS ENUM ('account','campaign','adset','ad','creative');

CREATE TABLE entity_config_scd (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES ad_account(id),
  level         entity_level NOT NULL,
  entity_id     uuid NOT NULL,          -- FK enforced by trigger per level
  attribute     text NOT NULL,          -- 'daily_budget_minor','status','bid_strategy','targeting_hash',...
  value         jsonb NOT NULL,         -- FETCH  / OFFICIAL PLATFORM FACT
  valid_from    timestamptz NOT NULL,
  valid_to      timestamptz,            -- NULL = current
  is_current    boolean NOT NULL DEFAULT true,
  source        text NOT NULL DEFAULT 'meta_fetch', -- 'meta_fetch' | 'adbrain_change' (self-caused)
  UNIQUE (level, entity_id, attribute, valid_from)
);
```
`source='adbrain_change'` links a config change back to a `change_log` row — closing the loop between "we changed X" and "the daily numbers moved".

---

## 5. Daily snapshot facts — OFFICIAL (raw Meta Insights)

**Fact-label for every column in §5: OFFICIAL PLATFORM FACT. Class: FETCH.** These tables hold **only** fields Meta returns from the Insights API. No ratios we compute (those go to §6).

### 5.1 Common key & partitioning

Every `*_insights_daily` table shares this key skeleton:

```sql
-- key columns present on account/campaign/adset/ad insights tables
  <entity>_id        uuid NOT NULL REFERENCES <entity>(id),
  account_id         uuid NOT NULL REFERENCES ad_account(id),  -- denormalised for RLS + partition pruning
  date_key           date NOT NULL,                            -- account reporting tz
  attribution_window text NOT NULL,   -- '7d_click','1d_click','1d_view','7d_click_1d_view',...
  action_report_time text NOT NULL DEFAULT 'impression',       -- 'impression' | 'conversion'
  -- ... measures ...
  loaded_at          timestamptz NOT NULL DEFAULT now(),
  is_current         boolean NOT NULL DEFAULT true,            -- restatement supersede flag (§12)
  PRIMARY KEY (<entity>_id, date_key, attribution_window, action_report_time, loaded_at)
```
Partition each insights table **by RANGE on `date_key` (monthly)**. Rationale: queries are always windowed by date; monthly partitions keep the hot set small and let old months be detached cheaply. `account_id` is denormalised onto every fact row so RLS and partition pruning never need a dimension join.

### 5.2 `ad_insights_daily` (the workhorse; adset/campaign/account are the same shape, fewer breakdown tables)

| Column | Type | Notes (all OFFICIAL PLATFORM FACT / FETCH) |
|---|---|---|
| `impressions` | bigint | |
| `reach` | bigint | *not additive across days* — flagged non-additive in `metric_catalog` |
| `frequency` | numeric | Meta's own field; do **not** sum across days (derive from impressions/reach if a window value is needed) |
| `spend_minor` | bigint | money in account currency minor units |
| `clicks` | bigint | all clicks |
| `inline_link_clicks` | bigint | link clicks |
| `unique_inline_link_clicks` | bigint | |
| `video_3s_views` | bigint | `video_play_actions` 3s |
| `video_thruplay` | bigint | ThruPlay |
| `video_p25/50/75/100_watched` | bigint | quartile watched counts |
| `video_avg_time_watched_s` | numeric | |
| `quality_ranking` | text | HIGH/AVERAGE/BELOW — categorical, per delivery |
| `engagement_rate_ranking` | text | categorical |
| `conversion_rate_ranking` | text | categorical |
| `purchase_roas` | numeric | Meta's reported ROAS **for the row's attribution_window** (still OFFICIAL — it is Meta's number, not ours) |
| `actions` | jsonb | raw action-type array (mirrored, exploded into 5.3) |
| `action_values` | jsonb | raw value array |

> Note: `purchase_roas` is OFFICIAL because it is Meta's field. AdBrain's own blended/true ROAS (using EXTERNAL revenue) is a *different*, DERIVED column and lives in §6 — never overwrite one with the other.

### 5.3 `ad_action_breakdown_daily` — exploded conversions

Meta returns `actions`/`action_values` as nested arrays; storing them exploded makes per-event-type analysis indexable.

```sql
CREATE TABLE ad_action_breakdown_daily (
  ad_id uuid, account_id uuid, date_key date,
  attribution_window text, action_report_time text,
  action_type text NOT NULL,   -- 'purchase','lead','omni_purchase','landing_page_view',...
  count bigint,                -- OFFICIAL PLATFORM FACT / FETCH
  value_minor bigint,          -- OFFICIAL PLATFORM FACT / FETCH (Meta-reported conversion value)
  loaded_at timestamptz DEFAULT now(), is_current boolean DEFAULT true,
  PRIMARY KEY (ad_id, date_key, attribution_window, action_report_time, action_type, loaded_at)
) PARTITION BY RANGE (date_key);
```

### 5.4 Breakdown facts (ad level) — all OFFICIAL / FETCH

| Table | Grain adds | Purpose (decision) |
|---|---|---|
| `ad_placement_daily` | `+ publisher_platform, platform_position` | Where to cut/shift budget by placement |
| `ad_demographic_daily` | `+ age, gender` | Audience-truth for creative targeting |
| `ad_region_daily` | `+ region/country` | Geo reallocation |
| `ad_hourly_daily` | `+ hour_of_day` | Dayparting decisions |

> **CANNOT-KNOW guard:** Meta does **not** allow combining certain breakdowns (e.g. some action breakdowns with demographics) and suppresses small cells for privacy. These tables therefore carry a `data_suppressed boolean` flag; a NULL measure with `data_suppressed=true` means "Meta withheld", not "zero". Aggregators must treat them differently.

---

## 6. Daily snapshot facts — DERIVED (AdBrain math)

**Fact-label for every column in §6: INTERNAL CALCULATION (DERIVED). Class: CALC** (unless a column is marked INFER/EXTERNAL). Same keys as §5, joined 1:1. Kept physically separate so a reader can never mistake our ratio for Meta's field.

### 6.1 `ad_metrics_daily` (representative; other levels analogous)

| Column | Type | Class | Fact-label | Formula (inputs from §5) |
|---|---|---|---|---|
| `cpm_minor` | numeric | CALC | DERIVED | `spend_minor / impressions * 1000` |
| `cpc_link_minor` | numeric | CALC | DERIVED | `spend_minor / inline_link_clicks` |
| `ctr_link` | numeric | CALC | DERIVED | `inline_link_clicks / impressions` |
| `hook_rate` | numeric | CALC | DERIVED | `video_3s_views / impressions` |
| `hold_rate` | numeric | CALC | DERIVED | `video_p100_watched / impressions` |
| `cpa_minor` | numeric | CALC | DERIVED | `spend_minor / <primary_action count>` (primary action from `rule`/account config) |
| `cvr` | numeric | CALC | DERIVED | `<primary_action> / inline_link_clicks` |
| `roas_meta` | numeric | CALC | DERIVED | mirror of Meta `purchase_roas` recomputed for consistency check (flags Meta vs our disagreement) |
| `roas_true` | numeric | CALC + EXTERNAL | DERIVED | `external_revenue_minor / spend_minor` — needs EXTERNAL revenue (§6.2); NULL if none |
| `mer_contribution_minor` | numeric | CALC + EXTERNAL | DERIVED | ad's spend share applied to account MER; INFERENCE-adjacent, flagged |
| `fatigue_index` | numeric | INFER | MODEL ESTIMATE | model over frequency trend + CTR decay (see artifact on creative fatigue); **not** a Meta fact |
| `saturation_flag` | boolean | INFER | INFERENCE | frequency rising while CTR falling N days |
| `primary_action_type` | text | CALC | DERIVED | which action was treated as the conversion this row |
| `sample_impressions` | bigint | CALC | DERIVED | copy of impressions used as the sample-size guard for trust gating |

### 6.2 `external_revenue_daily` — EXTERNAL truth (CANNOT-KNOW from Meta alone)

Meta's reported conversion value is pixel-attributed and often disagrees with the ledger. True ROAS/CAC needs the merchant's own numbers.

```sql
CREATE TABLE external_revenue_daily (
  account_id uuid, date_key date,
  entity_level entity_level, entity_id uuid,     -- may be account-only if source can't attribute deeper
  source text NOT NULL,          -- 'shopify','ga4','crm_manual',...   EXTERNAL
  revenue_minor bigint,          -- EXTERNAL  / RESEARCH-BACKED-if-audited else UNKNOWN
  orders int,
  new_customer_revenue_minor bigint,  -- for nCAC; nullable
  ingested_at timestamptz DEFAULT now(),
  PRIMARY KEY (account_id, date_key, entity_level, entity_id, source)
);
```

---

## 7. Creative intelligence

### 7.1 `creative_asset` — the media file behind creatives

| Column | Type | Class | Fact-label |
|---|---|---|---|
| `id` uuid PK | — | — |
| `account_id` uuid FK | FETCH | OFFICIAL PLATFORM FACT |
| `asset_type` text (`image`/`video`) | FETCH | OFFICIAL PLATFORM FACT |
| `meta_image_hash` / `meta_video_id` text | FETCH | OFFICIAL PLATFORM FACT |
| `storage_uri` text | EXTERNAL | INTERNAL CALCULATION (DERIVED) | our copy in object storage |
| `duration_s` / `width` / `height` numeric | FETCH | OFFICIAL PLATFORM FACT |
| `sha256` text | CALC | DERIVED | byte-hash for exact-dupe detection |

### 7.2 `creative_fingerprint` — "is this the same creative wearing a new id?"

Meta mints new creative/ad ids constantly (relaunches, duplications). Performance history is worthless if it fragments across ids. Fingerprints unify them.

```sql
CREATE TABLE creative_fingerprint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id uuid NOT NULL REFERENCES ad_creative(id),
  account_id uuid NOT NULL REFERENCES ad_account(id),
  fingerprint_kind text NOT NULL,   -- 'perceptual_image' | 'video_scene' | 'copy_shingle' | 'composite'
  fingerprint text NOT NULL,        -- CALC / INTERNAL CALCULATION (DERIVED)  (e.g. pHash, minhash)
  algo_version text NOT NULL,       -- so we can re-fingerprint without ambiguity
  created_at timestamptz DEFAULT now(),
  UNIQUE (creative_id, fingerprint_kind, algo_version)
);
-- Same fingerprint across creative_ids => a `creative_lineage` view groups them into one concept.
```
All fingerprints are **DERIVED** — never presented as a Meta identity.

### 7.3 `creative_embedding` — semantic vectors (pgvector)

```sql
CREATE EXTENSION IF NOT EXISTS vector;   -- expected already in 0001; see §15

CREATE TABLE creative_embedding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id uuid NOT NULL REFERENCES ad_creative(id),
  account_id uuid NOT NULL REFERENCES ad_account(id),
  modality text NOT NULL,           -- 'image' | 'video' | 'text' | 'multimodal'
  model_name text NOT NULL,         -- provenance of the vector
  model_version text NOT NULL,
  dim int NOT NULL,
  embedding vector NOT NULL,        -- MODEL ESTIMATE / INFERENCE  (never a fact)
  created_at timestamptz DEFAULT now(),
  UNIQUE (creative_id, modality, model_name, model_version)
);
CREATE INDEX ON creative_embedding USING hnsw (embedding vector_cosine_ops);
```
Powers "find creatives similar to our winners" and cluster-level fatigue. Fact-label **MODEL ESTIMATE** throughout; `dim`/`model_version` pinned so mixed-model vectors are never compared by mistake.

### 7.4 `creative_element_tag` — structured creative attributes

| Column | Type | Class | Fact-label | Notes |
|---|---|---|---|---|
| `creative_id` uuid FK | — | — | |
| `element_type` text | INFER | MODEL ESTIMATE | 'hook_type','format','has_face','cta_style','offer_type','angle' |
| `value` text | INFER | MODEL ESTIMATE | e.g. 'ugc','problem_solution','testimonial' |
| `confidence` numeric | INFER | MODEL ESTIMATE | 0–1; recommendation inputs gate on this |
| `tagger` text | — | — | model/human provenance |

---

## 8. Brand brain (triples)

A knowledge graph so recommendations are grounded in the brand's own truth (products, offers, claims, personas, do/don't rules), not generic advice.

### 8.1 `brand_entity`

| Column | Type | Class | Fact-label |
|---|---|---|---|
| `id` uuid PK, `account_id` uuid FK | — | — |
| `entity_type` text | EXTERNAL | RESEARCH-BACKED | 'product','persona','offer','claim','competitor','value_prop' |
| `name` text | EXTERNAL | RESEARCH-BACKED |
| `attributes` jsonb | EXTERNAL | RESEARCH-BACKED |

### 8.2 `brand_triple` — subject → predicate → object

```sql
CREATE TABLE brand_triple (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ad_account(id),
  subject_id uuid REFERENCES brand_entity(id),
  subject_text text,               -- when subject isn't a catalogued entity
  predicate text NOT NULL,         -- 'targets','claims','priced_at','contraindicated_for','wins_against'
  object_id uuid REFERENCES brand_entity(id),
  object_text text,
  confidence numeric,              -- 0–1
  fact_label text NOT NULL,        -- 'RESEARCH-BACKED' | 'INFERENCE' | 'MODEL ESTIMATE' | 'UNKNOWN'
  valid_from timestamptz DEFAULT now(),
  valid_to timestamptz,            -- triples expire; brand truth changes
  CHECK (subject_id IS NOT NULL OR subject_text IS NOT NULL)
);

CREATE TABLE triple_source (       -- provenance: every triple must be traceable
  triple_id uuid REFERENCES brand_triple(id),
  source_kind text,                -- 'brand_doc','call_transcript','website','human_input','ad_copy'
  source_uri text,
  excerpt text,
  captured_at timestamptz DEFAULT now(),
  PRIMARY KEY (triple_id, source_uri)
);
```
Every triple carries its **own** `fact_label` and at least one `triple_source` row — a claim with no source is not trusted by the recommender.

---

## 9. Benchmarks

Benchmarks are the most dangerous data in the system: a wrong number presented as truth mis-fires every recommendation. So **no benchmark is hard-coded** — all live here, each with provenance and a `verify_at_build` gate.

```sql
CREATE TABLE benchmark (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,          -- FK to metric_catalog.metric_key
  scope text NOT NULL,               -- 'global','vertical','account','placement'
  scope_value text,                  -- e.g. vertical='ecommerce_apparel'
  level entity_level NOT NULL,
  stat text NOT NULL,                -- 'p25','median','p75','mean'
  value numeric,                     -- NULL allowed when UNKNOWN/verify_at_build
  unit text,
  provenance text NOT NULL,          -- 'INDUSTRY BENCHMARK'|'RESEARCH-BACKED'|'INTERNAL CALCULATION (DERIVED)'|'UNKNOWN'
  source_citation text,              -- required unless provenance='INTERNAL...'
  as_of date,
  verify_at_build boolean NOT NULL DEFAULT true,   -- true => UI must show "unverified"
  sample_size bigint,                -- n behind the benchmark
  created_at timestamptz DEFAULT now(),
  UNIQUE (metric_key, scope, scope_value, level, stat, as_of)
);
```
- **Internal (account-relative) benchmarks** are computed from our own `*_metrics_daily` history → provenance `INTERNAL CALCULATION (DERIVED)`, `verify_at_build=false`, `sample_size` populated. These are the *trustworthy* ones.
- **Industry benchmarks** stay `provenance='INDUSTRY BENCHMARK'` with a citation and `verify_at_build=true` **until** a human verifies the source as of the build date. **No arbitrary threshold ships as truth.**

---

## 10. Rules

Rules define what a decision *is* for an account: the primary conversion, target CPA/ROAS, guardrails, and the condition→action logic that generates recommendations.

```sql
CREATE TABLE rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ad_account(id),
  rule_type text NOT NULL,           -- 'primary_action','target','guardrail','trigger'
  level entity_level,                -- where it applies
  name text NOT NULL,
  definition jsonb NOT NULL,         -- condition + threshold + action; thresholds reference benchmark ids, not literals
  min_sample jsonb,                  -- e.g. {"impressions":1000,"conversions":30} — sample gate for firing
  comparison_window jsonb,           -- e.g. {"lookback_days":7,"vs":"trailing_28d"}
  priority int DEFAULT 100,
  enabled boolean DEFAULT true,
  created_by text, created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```
Thresholds inside `definition` reference `benchmark.id` or `metric_catalog` limits — never bare magic numbers — so a threshold's provenance is always inspectable.

---

## 11. Recommendations (the product's actual output)

The "what should we do next?" table. One row = one proposed action with full evidence, so it is auditable and reversible.

```sql
CREATE TABLE recommendation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ad_account(id),
  level entity_level NOT NULL,
  entity_id uuid NOT NULL,           -- what to act on
  rule_id uuid REFERENCES rule(id),  -- which rule fired (nullable for model-generated)
  action_type text NOT NULL,         -- 'scale_budget','cut','duplicate_winner','refresh_creative','shift_placement','new_angle'
  action_params jsonb,               -- e.g. {"budget_delta_pct": 20}
  rationale text NOT NULL,           -- plain-language why (Rahul-voice for LinkedIn OS; media-buyer voice here)
  evidence jsonb NOT NULL,           -- metric snapshots + benchmark ids + sample sizes used
  confidence numeric,                -- 0–1  (MODEL ESTIMATE)
  expected_effect jsonb,             -- forecast delta; fact-label MODEL ESTIMATE
  priority_score numeric,            -- ranking
  status text NOT NULL DEFAULT 'proposed', -- 'proposed'|'accepted'|'dismissed'|'applied'|'expired'
  generated_at timestamptz DEFAULT now(),
  decided_at timestamptz,
  decided_by text,
  snapshot_date date NOT NULL        -- the day-grain data this was computed from
);
```
- `status` never auto-advances to `applied` without an explicit action (mirrors the program's "drafts only, never auto-send" discipline — see change_log).
- `evidence` embeds the exact metric values, `benchmark.id`s, and sample sizes so a recommendation can be re-audited even after the underlying daily rows are restated.

---

## 12. Changes / interventions log + restatement

### 12.1 `change_log` — every mutation we make (or propose) to Meta

Closes the loop: recommendation → change → measured effect. Essential for causal read of "did our action work?".

```sql
CREATE TABLE change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ad_account(id),
  level entity_level NOT NULL,
  entity_id uuid NOT NULL,
  recommendation_id uuid REFERENCES recommendation(id),  -- nullable (manual/external change)
  change_type text NOT NULL,         -- 'budget','status','bid','creative_swap','targeting','new_ad'
  before jsonb, after jsonb,         -- OFFICIAL PLATFORM FACT snapshot of the field
  mode text NOT NULL DEFAULT 'draft',-- 'draft' | 'applied'  (never auto-apply without human)
  applied_at timestamptz,
  applied_by text,
  meta_write_response jsonb,         -- API result if applied
  effect_eval jsonb,                 -- filled later: pre/post metric deltas (DERIVED)
  created_at timestamptz DEFAULT now()
);
```
- `mode='draft'` is the default; a change is only pushed to Meta after explicit human accept (program-wide rule).
- `effect_eval` is populated by a later job comparing `*_metrics_daily` before/after `applied_at` — the empirical answer to "did it work?".

### 12.2 Restatement handling (Meta backfills conversions)

Meta revises the trailing ~28 days as late conversions attribute. Policy:

| Mechanism | Behaviour |
|---|---|
| `is_current` + `loaded_at` in fact PK | New fetch of an existing `(entity, date, window, report_time)` inserts a **new** row; the prior row's `is_current` flips to `false`. History of the number itself is preserved. |
| `fact_restatement_log` | Records `(keys, old_value, new_value, delta, restated_at)` for spend/conversions so we can quantify attribution drift and warn when a recommendation was made on since-restated data. |
| Freshness/limitations | `metric_catalog` marks conversion-based metrics "unstable for last 28 days"; recommendations gate on it. |

---

## 13. Metric discipline — the 10 questions for every DERIVED metric

`metric_catalog` is the machine-readable home of the 10-question discipline; the table below is the human view for the core stored derived metrics. **Official Meta fields (§5) are raw facts and are catalogued with fact-label + source + level; the 10-question decision discipline is applied here to the metrics AdBrain *computes and acts on*.**

```sql
CREATE TABLE metric_catalog (
  metric_key text PRIMARY KEY,       -- 'cpa_minor','hook_rate',...
  level entity_level NOT NULL,
  data_class text NOT NULL,          -- FETCH|CALC|INFER|EXTERNAL|CANNOT-KNOW
  fact_label text NOT NULL,
  measures text NOT NULL,            -- Q1 what it measures
  why text NOT NULL,                 -- Q2 why it matters
  decision text NOT NULL,            -- Q3 the decision it drives  (if blank => class='vanity')
  inputs text NOT NULL,              -- Q4
  formula text,                      -- Q5
  source text NOT NULL,              -- Q6
  comparison_window text NOT NULL,   -- Q7
  min_sample text NOT NULL,          -- Q8
  limitations text NOT NULL,         -- Q9
  distrust_when text NOT NULL,       -- Q10 when NOT to trust it
  class text NOT NULL DEFAULT 'primary', -- 'primary' | 'vanity'
  is_additive boolean NOT NULL       -- can it be summed across days?
);
```

Worked entries (abbreviated — full text lives in the metric-dictionary artifacts; every stored metric MUST have a complete row):

| metric_key | Level | Class / Fact-label | Decision it drives | Formula | Source | Compare window | Min sample | Limitations | Distrust when |
|---|---|---|---|---|---|---|---|---|---|
| `cpa_minor` | ad | CALC / DERIVED | Cut vs keep vs scale an ad | `spend / primary_action_count` | §5 `spend_minor`, §5.3 action count | 7d vs trailing 28d | ≥30 conversions **and** ≥1,000 impressions (verify at build; account-tunable in `rule.min_sample`) | Attribution-window dependent; ignores LTV | conversions < min_sample; inside 28-day restatement window; iOS-heavy audience underreports |
| `roas_true` | ad/account | CALC+EXTERNAL / DERIVED | Scale/cut on real profit, not pixel | `external_revenue_minor / spend_minor` | §6.2 EXTERNAL + §5 spend | 7d vs 28d | needs EXTERNAL revenue present; else NULL | Only as good as CRM/Shopify feed; attribution to entity may be account-only | no EXTERNAL feed; revenue lag > report lag |
| `hook_rate` | creative | CALC / DERIVED | Kill/keep a video opener; brief new hooks | `video_3s_views / impressions` | §5 fields | vs account p75 (`benchmark`) | ≥1,000 impressions | 3s ≠ intent; autoplay inflates | placement mix skews (Stories vs Feed); <1k impr |
| `hold_rate` | creative | CALC / DERIVED | Re-edit mid/back half of video | `video_p100 / impressions` | §5 | vs winners cohort | ≥1,000 impressions | length-biased | mixed durations compared directly |
| `fatigue_index` | creative | INFER / MODEL ESTIMATE | Refresh creative before CPA breaks | model(freq trend, CTR decay) | §5 frequency, ctr | rolling 14d | ≥7 days data | it's an estimate, not a fact | new creative (<7d); budget just changed |
| `frequency` | ad | FETCH / OFFICIAL | Widen audience / raise budget cap | Meta field | §5 | point-in-time by window | n/a | **non-additive** across days | someone SUMs it across days |
| `reach` | campaign | FETCH / OFFICIAL | Audience saturation check | Meta field | §5 | point-in-time | n/a | **non-additive**; de-duped only within its own window | summed across days/entities |
| `impressions` | ad | FETCH / OFFICIAL | volume/qualifier for other metrics | Meta field | §5 | additive | n/a | vanity alone → gate | used as a success metric by itself (`class='vanity'` when standalone) |

`is_additive=false` on `reach`/`frequency` is enforced at the query layer so no rollup silently sums them.

---

## 14. Keys, indexing, RLS, conventions (summary)

| Concern | Decision |
|---|---|
| Surrogate PK | `uuid` `gen_random_uuid()` everywhere; Meta native id stored as `text UNIQUE` |
| Fact grain PK | `(entity_id, date_key, attribution_window, action_report_time, loaded_at)` |
| Partitioning | `*_insights_daily`, `*_metrics_daily`, `*_breakdown_daily` → RANGE monthly on `date_key` |
| Hot indexes | `(account_id, date_key)`, `(entity_id, date_key) WHERE is_current`, GIN on `actions`/`targeting` jsonb, HNSW on embeddings |
| RLS | every table filtered by `account_id` = caller's tenant; `ad_account` is the tenant root |
| Money | integer **minor units** + `currency` on `ad_account`; never float money |
| Time | `date_key` in account reporting tz; all `timestamptz` in UTC |
| Deletes | soft-delete via `is_current`/`valid_to`; facts are append-only (aligns with program rule: never destroy working data) |
| Self-doc | `metric_catalog` + `benchmark.provenance` make every number's origin queryable |

---

## 15. Reconciliation with `supabase/migrations` 0001 & 0002

> **0001/0002 were not present at authoring.** The table below states what this artifact **assumes** they contain and how new objects layer on. **At build: diff real 0001/0002 against this, then adjust the merge column before writing 0003.**

| Assumed in 0001/0002 (canonical) | This artifact's stance | Merge action |
|---|---|---|
| `create extension pgcrypto` (for `gen_random_uuid`) | Reuse | If absent, add to 0003 head |
| `create extension vector` | Reuse for §7.3 | If absent, prepend to 0003 |
| Base dimension tables `ad_account`, `campaign`, `adset`, `ad`, `ad_creative` | **Extend, do not recreate** — §4 columns are a superset | Emit `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for any §4 column missing; **never `DROP`** |
| Some insights table (likely a single flat `insights`) | Do not contradict | Keep it; add the per-level `*_insights_daily` + `*_metrics_daily` split as **new** tables; if 0001's insights table mixes official+derived, mark it deprecated and backfill-migrate, don't rewrite in place |
| RLS policies keyed to tenant | Reuse pattern | New tables adopt the same policy shape/`account_id` |
| Naming/enum conventions | Adopt existing | If 0001 already defines `entity_level` or level enums, **reuse**; drop the `CREATE TYPE` here to avoid conflict |

**Proposed new migrations (additive only):**

| Migration | Contents |
|---|---|
| `0003_dw_hierarchy_and_scd.sql` | §4 column extensions, `entity_config_scd`, `metric_catalog` |
| `0004_dw_daily_facts.sql` | §5 official `*_insights_daily` + breakdowns (partitioned) |
| `0005_dw_derived_metrics.sql` | §6 `*_metrics_daily`, `external_revenue_daily`, `fact_restatement_log` |
| `0006_creative_intelligence.sql` | §7 asset/fingerprint/embedding/element_tag (+ `vector` guard) |
| `0007_brand_brain.sql` | §8 `brand_entity`, `brand_triple`, `triple_source` |
| `0008_decision_layer.sql` | §9 `benchmark`, §10 `rule`, §11 `recommendation`, §12 `change_log` |

Every migration is **additive** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`); none drops or rewrites an existing working table — consistent with the program's "smallest diff, never remove working data" discipline.

---

## 16. Open questions / verify-at-build

| # | Item | Why it matters |
|---|---|---|
| 1 | Actual contents of 0001/0002 | Determines ADD-COLUMN vs CREATE-TABLE for §4; whether `entity_level`/`vector`/`pgcrypto` already exist |
| 2 | Exact Meta Insights field list for this API version (v20+?) | §5 column names/availability (e.g. ThruPlay, quality rankings) shift by API version — confirm against live `02-meta-data-mapping.md` |
| 3 | Which action_type is "primary conversion" per account | Drives `cpa_minor`/`cvr`; lives in `rule` but defaults must be set |
| 4 | All industry benchmark values | Ship as `verify_at_build=true`, `provenance='INDUSTRY BENCHMARK'`, NULL value until sourced — never as truth |
| 5 | Embedding model + dim | Pins `creative_embedding` HNSW index and cross-comparability |
| 6 | Attribution windows to persist | Storage cost vs decision need; default `7d_click_1d_view` + `1d_click` |
| 7 | Restatement re-fetch window length | Assumed 28 days; confirm against Meta's current stated window |
