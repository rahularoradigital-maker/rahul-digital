# 24 — Data Warehouse Schema

**Artifact:** 24 of 28 · **Program:** AdBrain — AI Meta-Ads Creative + Media Intelligence System
**Owner persona:** Principal data/media architect + senior Meta media buyer, thinking at $100M/mo spend
**System question this serves:** *"What should we do next?"* — the warehouse is the substrate the
OBSERVATION → DIAGNOSIS → PREDICTION → RECOMMENDATION → ACTION chain reads from and writes to.
**Status:** DRAFT — reconcile at build (see [§0](#0-cross-references-read-first)).

---

## 0. Cross-references (read first)

This artifact defines the **persistence layer**: hierarchy (dimension) tables, day-wise snapshot
(fact) tables, creative fingerprints/embeddings, the brand-brain triples, benchmarks, rules,
recommendations, and change tracking. It is the store, not the metric spec and not the route spec.

| Depends on | For | Reconciliation rule |
|---|---|---|
| `02-meta-data-mapping.md` | The canonical class of every field: **FETCH / CALC / INFER / EXTERNAL / CANNOT-KNOW**. Every column below cites this. | Artifact 02 wins on any field-level disagreement. A field 02 calls FETCH lands in an **OFFICIAL** table; CALC lands in a **DERIVED** table; INFER lands in a fingerprint/label table; EXTERNAL lands in an external-source table; CANNOT-KNOW is **never stored as a fact** (only as a caveated hypothesis or left absent). |
| `01a–01d` (Metric Dictionary) | The 10-question spec of every **marketing** metric (measures/why/decision/inputs/formula/source/window/min-sample/limits/when-not-to-trust). | This schema **stores** those metrics; it does **not** re-derive their definitions. `metric_catalog` (§4.3) is the row-per-metric bridge; each row points at its `[01x]` entry. Warehouse-**native** metrics (freshness, restatement delta, data completeness) get their full 10-Q here in §9 because no other artifact owns them. |
| `23-api-architecture.md` | Who writes/reads these tables, the idempotency key, fact-class propagation, freshness-as-first-class. | Ingestion writes OFFICIAL facts; the analysis pipeline writes DERIVED facts + recommendations; the Read API reads pre-computed models. The dedup key `(ad_account_id, entity_id, day, breakdown_signature, meta_api_version)` from 23 §5.2 is the natural key of the OFFICIAL daily fact table. |
| `0001_init.sql`, `0002_ad_accounts.sql` | Existing tables — **extend additively, never contradict.** | Reuses `public.brands`, `public.ad_accounts`, `public.triples`, `public.competitors`, `public.competitor_ads`, `public.test_plans`, `public.test_plan_items`, `public.oauth_tokens`. New migrations `0003`–`0009` only **add**; the one edit to an existing table is additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on `triples` (§6). |

> **Honesty note (build gate):** The foundation files were reconciled when writing this. Where a
> value is version-, quota-, or threshold-specific it is marked **UNKNOWN / verify at build** and is
> **not** stored as a truth. No benchmark, min-sample, or threshold number is invented here; those
> live in `metric_catalog` / `benchmark` rows sourced from `[01]`/`[27]`, or are absent.

---

## 1. Design principles

1. **OFFICIAL and DERIVED are physically separate tables.** A value Meta returned (`fact_insights_daily`) is never written into the same row as a value we computed (`fact_metric_daily`). This is the schema-level enforcement of brief rule 3 ("never present a calculated metric as an official Meta metric"). The two tables use different `fact_class` defaults, and a `CHECK` forbids the wrong class in each.
2. **Day is the atomic grain (mandatory).** Every performance fact is stored at `time_increment=1` — one row per entity, per day, per breakdown signature, per attribution setting, per Meta API version. All 3/7/14/30-day windows are *aggregations* of daily rows, never a stored coarse grain that loses a day.
3. **Fact class travels with the data.** Every fact/derived table carries `fact_class` and, where it maps to Meta, `data_map_class` (the 02 legend). The Read API renders the label without re-deriving it (23 §1.4).
4. **Idempotent by natural key.** Re-ingesting a day overwrites in place (`ON CONFLICT ... DO UPDATE`). Meta restatement of recent days is expected and handled by re-pull + overwrite, with the magnitude recorded (§9.2, AUTOPSY input).
5. **Immutable dimensions, versioned attributes.** Entities (campaign/adset/ad/creative) are dimensions; their mutable settings (budget, status, audience, creative binding) are change-tracked in `entity_change` (§8) so a performance shift can be attributed to a *change* rather than mis-diagnosed as fatigue.
6. **Fingerprint once, reuse forever.** Each creative's CV fingerprint + embeddings are computed once and stored (`creative_fingerprint`, `creative_embedding`), keyed by content hash so a re-upload is detected, not re-analyzed.
7. **Recommendations are DRAFT rows.** `recommendation` stores proposals with status `draft`; nothing in this schema ever writes back to Meta (CLAUDE rule 7, 23 §7). There is no "executed_to_meta" path or status.
8. **RLS everywhere.** Every table is owned transitively by a user via `ad_accounts.user_id` or `brands.user_id`, exactly as 0001/0002 do it. Global reference rows (shared benchmarks/rules/metric catalog) are readable but not client-writable.

---

## 2. Shared conventions (all new tables)

| Concern | Convention |
|---|---|
| Style | `create table if not exists`, `create index if not exists`, `drop policy if exists` then `create policy` — **safe to re-run**, matching 0001/0002. `text + CHECK` instead of Postgres enums (re-runnable, matches existing style). |
| Fact class | `fact_class text CHECK (fact_class in ('OFFICIAL_PLATFORM_FACT','INTERNAL_CALCULATION','RESEARCH_BACKED','INDUSTRY_BENCHMARK','MODEL_ESTIMATE','INFERENCE','UNKNOWN'))`. |
| Data-map class | `data_map_class text CHECK (data_map_class in ('FETCH','CALC','INFER','EXTERNAL','CANNOT_KNOW'))` — the 02 legend. |
| Level | `level text CHECK (level in ('account','business','campaign','adset','ad','creative','frame','element','message','hook','angle','persona','landing','product','outcome'))`. Meta **insights** only populate `account/campaign/adset/ad`; `creative`+ are our enrichment levels (02 §hierarchy). |
| Time | `day date` for the snapshot grain + `account_tz text` stored per row (Meta "day" honours the ad-account timezone; 23 §3). All `*_at` are `timestamptz` UTC. |
| Money | Stored in **minor units** (`bigint`) to avoid float drift; `currency` per row. |
| Ownership | Facts key on `ad_account_id uuid references public.ad_accounts(id)`; brand-brain rows key on `brand_id`. `brand_ad_accounts` (§3) links the two. |

**New migration files (all additive):**

| File | Contents |
|---|---|
| `0003_hierarchy.sql` | dimension tables + `brand_ad_accounts` link |
| `0004_facts_daily.sql` | `metric_catalog` + OFFICIAL daily facts + DERIVED daily metrics |
| `0005_creative_intelligence.sql` | fingerprints + embeddings (+ pgvector) |
| `0006_brand_brain.sql` | additive ALTER on `triples` + entity-label bridge |
| `0007_benchmarks_rules.sql` | benchmarks + rule engine + rule evaluations |
| `0008_recommendations_changes.sql` | recommendations + entity/external change tracking |
| `0009_ops_readmodels.sql` | source freshness + read-model materializations |

---

## 3. Hierarchy (dimension) tables — `0003_hierarchy.sql`

**Level:** account → business → campaign → adset → ad → creative (02 §hierarchy). **Data-map class:**
FETCH for all entity metadata (02: "all entity metadata is directly returned by Meta"). **Fact class:**
`OFFICIAL_PLATFORM_FACT`.

```sql
-- 0003_hierarchy.sql — Meta entity dimension tree. Additive to 0001/0002. Safe to re-run.

-- Link a brand (analysis workspace, 0001) to a connected ad account (connection, 0002).
create table if not exists public.brand_ad_accounts (
  brand_id       uuid not null references public.brands (id)      on delete cascade,
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (brand_id, ad_account_id)
);

-- BUSINESS: the Meta Business above the ad account (02: "Business above account").
create table if not exists public.dim_business (
  id            uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  external_id   text not null,                 -- Meta business id  [FETCH / OFFICIAL]
  name          text,                          -- [FETCH / OFFICIAL]
  raw_json      jsonb,                         -- full API payload, provenance
  fact_class    text not null default 'OFFICIAL_PLATFORM_FACT',
  data_map_class text not null default 'FETCH',
  created_at    timestamptz not null default now(),
  unique (ad_account_id, external_id)
);

create table if not exists public.dim_campaign (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  external_id    text not null,                -- campaign_id            [FETCH / OFFICIAL]
  name           text,                         -- [FETCH / OFFICIAL]
  objective      text,                         -- [FETCH / OFFICIAL]
  buying_type    text,                         -- [FETCH / OFFICIAL]
  status         text,                         -- effective_status snapshot [FETCH / OFFICIAL]
  daily_budget_minor    bigint,               -- changes tracked in entity_change §8
  lifetime_budget_minor bigint,
  currency       text,                         -- [FETCH / OFFICIAL]
  raw_json       jsonb,
  fact_class     text not null default 'OFFICIAL_PLATFORM_FACT',
  data_map_class text not null default 'FETCH',
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  unique (ad_account_id, external_id)
);

create table if not exists public.dim_adset (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  campaign_id    uuid references public.dim_campaign (id) on delete cascade,
  external_id    text not null,                -- adset_id  [FETCH / OFFICIAL]
  name           text,
  status         text,
  optimization_goal text,                      -- [FETCH / OFFICIAL]
  billing_event  text,                         -- [FETCH / OFFICIAL]
  daily_budget_minor    bigint,
  lifetime_budget_minor bigint,
  targeting_json jsonb,                        -- audience def; changes -> entity_change §8
  raw_json       jsonb,
  fact_class     text not null default 'OFFICIAL_PLATFORM_FACT',
  data_map_class text not null default 'FETCH',
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  unique (ad_account_id, external_id)
);

-- CREATIVE dim created before dim_ad so dim_ad.creative_id can FK it.
create table if not exists public.dim_creative (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  external_id    text not null,                -- creative_id                 [FETCH / OFFICIAL]
  name           text,
  body           text,                         -- ad copy                     [FETCH / OFFICIAL]
  title          text,                         -- [FETCH / OFFICIAL]
  call_to_action_type text,                    -- [FETCH / OFFICIAL]
  object_story_spec jsonb,                     -- [FETCH / OFFICIAL]
  format         text,                         -- [FETCH / OFFICIAL]
  aspect_ratio   text,                         -- [FETCH / OFFICIAL]
  image_hash     text,                         -- Meta's hash                 [FETCH / OFFICIAL]
  video_id       text,                         -- [FETCH / OFFICIAL]
  thumbnail_url  text,                         -- [FETCH / OFFICIAL]
  landing_url    text,                         -- link from object_story_spec  [FETCH / OFFICIAL]
  content_hash   text,                         -- OUR hash of the asset bytes  [INTERNAL_CALCULATION]
  raw_json       jsonb,
  fact_class     text not null default 'OFFICIAL_PLATFORM_FACT',
  data_map_class text not null default 'FETCH',
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  unique (ad_account_id, external_id)
);

create table if not exists public.dim_ad (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  adset_id       uuid references public.dim_adset (id) on delete cascade,
  external_id    text not null,                -- ad_id  [FETCH / OFFICIAL]
  name           text,
  status         text,
  creative_id    uuid references public.dim_creative (id) on delete set null, -- current binding
  raw_json       jsonb,
  fact_class     text not null default 'OFFICIAL_PLATFORM_FACT',
  data_map_class text not null default 'FETCH',
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  unique (ad_account_id, external_id)
);

create index if not exists dim_business_acct_idx  on public.dim_business (ad_account_id);
create index if not exists dim_campaign_acct_idx  on public.dim_campaign (ad_account_id);
create index if not exists dim_adset_campaign_idx on public.dim_adset (campaign_id);
create index if not exists dim_ad_adset_idx        on public.dim_ad (adset_id);
create index if not exists dim_creative_acct_idx   on public.dim_creative (ad_account_id);
create index if not exists dim_creative_content_idx on public.dim_creative (content_hash);
```

> `content_hash` (our hash of the downloaded bytes) is `INTERNAL_CALCULATION`, deliberately separate
> from Meta's `image_hash`/`video_id` — it powers near-duplicate detection ("we've run this before")
> even when Meta re-issues a new creative id for the same asset (aligns 23 §6.2 perceptual hash).

**RLS pattern (applied to every dim table; shown once, repeat per table):**

```sql
alter table public.dim_campaign enable row level security;
drop policy if exists "own dim_campaign" on public.dim_campaign;
create policy "own dim_campaign" on public.dim_campaign for all
  using (exists (select 1 from public.ad_accounts a
                 where a.id = ad_account_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.ad_accounts a
                      where a.id = ad_account_id and a.user_id = auth.uid()));
```

---

## 4. Daily snapshot facts — `0004_facts_daily.sql`

The heart of the warehouse. **Two physically separate fact tables** so OFFICIAL and DERIVED never
share a row, plus `metric_catalog` (the bridge to `[01]`). Create `metric_catalog` first (FK target).

### 4.1 `metric_catalog` — the bridge to `[01]`

One row per metric. This is where the **10-question discipline** and the **decision gate** live for
every marketing metric (sourced from `[01a–01d]` — **not duplicated** here, per reuse-over-rewrite).
This schema stores metric *values*; `[01]` defines the metrics.

```sql
create table if not exists public.metric_catalog (
  metric_key     text primary key,               -- e.g. 'hook_rate','roas','concentration_hhi'
  display_name   text not null,
  category       text not null check (category in
                   ('A_delivery','B_attention','C_engagement','D_click_quality','E_conversion',
                    'F_economics','G_creative','H_fatigue','I_diversity','J_scaling',
                    'K_incrementality','L_competitive','M_predictive','N_data_quality')),
  levels         text[] not null,                -- levels this metric is valid at
  data_map_class text not null check (data_map_class in ('FETCH','CALC','INFER','EXTERNAL','CANNOT_KNOW')),
  fact_class     text not null,                  -- default class of stored values
  decision       text not null,                  -- DECISION GATE: the decision it changes...
  is_primary     boolean not null default true,  -- ...or false = 'advanced/vanity - not primary'
  formula        text,                           -- the chosen formula (resolves 02's ambiguities, e.g. hold_rate)
  formula_version text,
  unit           text,
  default_window text,                           -- comparison window
  min_sample     bigint,                         -- from [01]/[27]; NULL = UNKNOWN / verify at build
  limitations    text,
  when_not_to_trust text,
  dict_ref       text,                           -- '[01a] Attention' etc. — source of the 10-Q spec
  updated_at     timestamptz not null default now()
);
```

> **Decision-gate enforcement:** a row with `is_primary = false` is barred from the primary dashboard
> surface (KILLCRITIC input). Every row **must** name `decision`; a NULL `decision` is a catalog error
> the QA framework [26] fails on. `min_sample = NULL` means **UNKNOWN / verify at build** — the metric
> is stored but flagged low-confidence until a sourced value lands. Example seed rows: `hook_rate`
> (B_attention, CALC, `formula='video_3s_views/impressions'`, decision="is the drop-off a hook
> problem?"); `roas` (F_economics, CALC, decision="scale / hold / cut this entity?"); `ncac`
> (F_economics, **EXTERNAL**, decision="true new-customer efficiency" — needs Shopify per 02).

### 4.2 `fact_insights_daily` — OFFICIAL only

Every column here is a field Meta returns (02 §delivery/attention/conversion, class **FETCH /
OFFICIAL**). Nothing computed by us is ever written here. Natural key = the 23 §5.2 idempotency key.

```sql
-- OFFICIAL Meta insights, day-wise. Exactly what Meta returned. Never store a derived value here.
create table if not exists public.fact_insights_daily (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  level          text not null check (level in ('account','campaign','adset','ad')),
  entity_id      text not null,                 -- Meta id at that level
  day            date not null,                 -- time_increment=1 grain  [OFFICIAL]
  account_tz     text not null,                 -- Meta day honours account tz
  breakdown_signature text not null default 'none', -- e.g. 'publisher_platform+age'
  attribution_setting text not null default 'default', -- e.g. '7d_click,1d_view'
  meta_api_version text not null,               -- part of the natural key

  -- Delivery / spend  (02: FETCH OFFICIAL)
  spend_minor    bigint,
  impressions    bigint,
  reach          bigint,
  frequency      numeric,                       -- Meta-provided (= impressions/reach)
  clicks         bigint,
  inline_link_clicks bigint,
  cpm            numeric,                        -- Meta-provided official field
  cpc            numeric,                        -- Meta-provided official field
  ctr            numeric,                        -- Meta-provided official field
  currency       text,

  -- Attention / video  (02: FETCH OFFICIAL — the RAW plays, not hook/hold rate, which are CALC)
  video_3s_views        bigint,                  -- video_3_sec_watched_actions
  thruplays             bigint,                  -- thruplay
  video_p25_views       bigint,
  video_p50_views       bigint,
  video_p75_views       bigint,
  video_p100_views      bigint,
  video_avg_time_watched numeric,
  landing_page_views    bigint,                  -- LPV action type (02: FETCH OFFICIAL)

  -- Conversion (02: FETCH OFFICIAL, attribution-window dependent) — kept as raw arrays
  actions        jsonb,                          -- [{action_type, value}]
  action_values  jsonb,                          -- [{action_type, value}]
  is_modeled_attribution boolean default false,  -- iOS/privacy modeled/underreported flag (02 hard limits)

  raw_json       jsonb,                           -- full API row, provenance
  fact_class     text not null default 'OFFICIAL_PLATFORM_FACT'
                 check (fact_class = 'OFFICIAL_PLATFORM_FACT'),   -- enforce: OFFICIAL-only table
  data_map_class text not null default 'FETCH' check (data_map_class = 'FETCH'),
  ingested_at    timestamptz not null default now(),
  unique (ad_account_id, level, entity_id, day, breakdown_signature, attribution_setting, meta_api_version)
);

create index if not exists fid_acct_day_idx on public.fact_insights_daily (ad_account_id, day);
create index if not exists fid_entity_idx    on public.fact_insights_daily (level, entity_id, day);
```

> Conversions are kept as raw `actions`/`action_values` arrays because the useful number is
> attribution-window dependent (02) — extracting "purchases"/"purchase value" is a DERIVED step, so
> it belongs in §4.3, not here. `is_modeled_attribution` surfaces the iOS/privacy limit (02 hard
> limits) so every economics view can flag it.

### 4.3 `fact_metric_daily` — DERIVED (long/tall)

Everything **we compute** (02 class **CALC**), modeled values (02 class **INFER**), and
external-sourced values (02 class **EXTERNAL**). Long/tall so the ~100-metric dictionary extends
without a schema change. Carries the master-plan discipline-#4 shape: value / prev / change / trend /
confidence / min-sample.

```sql
-- DERIVED metrics. One row per (entity, day, metric, window). Never OFFICIAL.
create table if not exists public.fact_metric_daily (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  level          text not null,                  -- any hierarchy level
  entity_id      text not null,
  day            date not null,
  metric_key     text not null references public.metric_catalog (metric_key),
  window         text not null default '1d',     -- '1d'|'3d'|'7d'|'14d'|'30d' comparison window
  value          numeric,
  prev_value     numeric,                        -- same metric, prior comparable window
  delta          numeric,                        -- value - prev_value
  pct_change     numeric,
  trend          text check (trend in ('up','down','flat','noisy','insufficient')),
  sample_n       bigint,                         -- observations behind this value
  min_sample     bigint,                         -- from metric_catalog / [01]; not invented here
  min_sample_met boolean,
  confidence     numeric,                        -- 0..1 from the confidence engine [14]
  fact_class     text not null                   -- CALC->INTERNAL_CALCULATION; INFER->MODEL_ESTIMATE/INFERENCE; EXTERNAL->EXTERNAL
                 check (fact_class in ('INTERNAL_CALCULATION','MODEL_ESTIMATE','INFERENCE','EXTERNAL','UNKNOWN')),
  data_map_class text not null check (data_map_class in ('CALC','INFER','EXTERNAL')),
  formula_version text,                          -- reproducibility (23 §7 "show the maths")
  inputs_ref     jsonb,                          -- pointers to the fact_insights_daily rows used
  computed_at    timestamptz not null default now(),
  unique (ad_account_id, level, entity_id, day, metric_key, window)
);

create index if not exists fmd_acct_day_idx on public.fact_metric_daily (ad_account_id, day);
create index if not exists fmd_metric_idx    on public.fact_metric_daily (metric_key, level, day);
```

> **Why long/tall, not a wide derived table:** the dictionary has ~100 metrics across 14 categories
> (A–N). A wide table would need a migration per new metric and waste storage on N/A cells at levels
> where a metric doesn't apply. `hook_rate`, `hold_rate`, `roas`, `cpa`, `cvr`, `aov`,
> `spend_velocity`, concentration/HHI, etc. are all rows keyed by `metric_key`. **`hold_rate` note:**
> 02 flags three competing definitions — the chosen one is recorded in `metric_catalog.formula` +
> `formula_version`, never left ambiguous. **EXTERNAL note:** MER/NCAC/LTV/iROAS (02: EXTERNAL/INFER)
> land here with the appropriate class; they are absent (not fabricated) until Shopify/CRM/experiment
> data exists.

---

## 5. Creative fingerprints + embeddings — `0005_creative_intelligence.sql`

**Level:** creative (+ frame). **Data-map class:** INFER for labels, INTERNAL_CALCULATION for
deterministic hashes/embeddings (02 §creative assets: "AI-labeled; INFERENCE with confidence";
embeddings via CV). **Never** OFFICIAL.

```sql
create extension if not exists vector;  -- pgvector; UNKNOWN / verify at build it's enabled on the instance

-- One fingerprint per creative content. The brief's fingerprint =
-- PERSONA+PROBLEM+DESIRE+HOOK+ANGLE+FORMAT+VISUAL+SPEAKER+PRODUCT+OFFER+LANDING.
create table if not exists public.creative_fingerprint (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  creative_id    uuid not null references public.dim_creative (id) on delete cascade,
  content_hash   text not null,                  -- ties fingerprint to bytes, not to Meta id
  phash          text,                           -- perceptual hash        [INTERNAL_CALCULATION]
  video_hash     text,                           -- [INTERNAL_CALCULATION]

  -- The 11 fingerprint dimensions, each a label + its own confidence  [INFER -> INFERENCE]
  persona        text, persona_conf   numeric,
  problem        text, problem_conf   numeric,
  desire         text, desire_conf    numeric,
  hook           text, hook_conf      numeric,
  angle          text, angle_conf     numeric,
  format         text, format_conf    numeric,
  visual_style   text, visual_conf    numeric,
  speaker        text, speaker_conf   numeric,
  product        text, product_conf   numeric,
  offer          text, offer_conf     numeric,
  landing        text, landing_conf   numeric,

  -- Video intelligence (02: EXTERNAL/CALC transcript; CV frames)  [MODEL_ESTIMATE]
  transcript     text,
  first_3s_summary text,
  scene_count    int,
  pacing_score   numeric,
  attributes_json jsonb,                          -- full extracted attribute set [04]

  model_version  text not null,                   -- which CV/LLM produced this
  fact_class     text not null default 'INFERENCE'
                 check (fact_class in ('INFERENCE','MODEL_ESTIMATE','INTERNAL_CALCULATION')),
  data_map_class text not null default 'INFER',
  computed_at    timestamptz not null default now(),
  unique (creative_id, model_version)
);

-- Embeddings: one row per (creative, kind, model). Kinds: visual/text/audio/scene/hook/concept/persona/angle.
create table if not exists public.creative_embedding (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  creative_id    uuid not null references public.dim_creative (id) on delete cascade,
  kind           text not null check (kind in
                   ('visual','text','audio','scene','hook','concept','persona','angle')),
  model          text not null,
  dim            int not null,
  embedding      vector,                          -- pgvector; per-kind fixed-dim ANN index built at build
  fact_class     text not null default 'INTERNAL_CALCULATION'
                 check (fact_class = 'INTERNAL_CALCULATION'),   -- deterministic model output
  data_map_class text not null default 'INFER',
  computed_at    timestamptz not null default now(),
  unique (creative_id, kind, model)
);

create index if not exists cf_creative_idx on public.creative_fingerprint (creative_id);
create index if not exists cf_hash_idx      on public.creative_fingerprint (content_hash);
create index if not exists ce_creative_idx  on public.creative_embedding (creative_id, kind);
-- ANN index (ivfflat/hnsw) needs a fixed dim per kind -> build per-kind partial indexes at build:
--   create index on creative_embedding using hnsw (embedding vector_cosine_ops) where kind='visual';
```

> **Fingerprint fact-labeling is strict:** every label field is `INFERENCE` and carries its own
> `_conf`; hashes and embeddings are `INTERNAL_CALCULATION` (deterministic). No fingerprint field is
> ever `OFFICIAL_PLATFORM_FACT` — the brief and 02 both forbid dressing a model label as a Meta fact.
> Diversity/white-space [06][13] read these labels; near-dup detection reads `phash`/`content_hash`.

---

## 6. Brand brain (triples) — `0006_brand_brain.sql`

`public.triples` already exists (0001). **Extend additively only** — do not recreate. Adds level,
temporality (so a superseded belief is retained, not deleted → audit/AUTOPSY), and a fact class.

```sql
-- Additive ALTERs on the existing triples table. Safe to re-run.
alter table public.triples add column if not exists level text;          -- which level the belief is about
alter table public.triples add column if not exists as_of date;          -- when it became true
alter table public.triples add column if not exists superseded_by uuid references public.triples (id);
alter table public.triples add column if not exists fact_class text
  check (fact_class in ('INTERNAL_CALCULATION','RESEARCH_BACKED','INFERENCE','EXTERNAL','UNKNOWN'));

-- Bridge: connect a triple's subject/object to concrete warehouse entities (creative/adset/...).
create table if not exists public.triple_entity_link (
  triple_id     uuid not null references public.triples (id) on delete cascade,
  level         text not null,
  entity_id     text not null,          -- Meta id or creative content_hash
  role          text not null check (role in ('subject','object')),
  primary key (triple_id, level, entity_id, role)
);
```

> Triples remain the source_type-tagged knowledge graph (`deconstruction | result | competitor_scan`,
> from 0001). Competitor-scan rows are `INFERENCE` at best and, for competitor **economics**, **must
> not be created** — 02 says competitor spend/results are **CANNOT-KNOW**; only hypotheses ("active
> != winning") may be stored, and only as low-confidence `INFERENCE`.

---

## 7. Benchmarks + rules — `0007_benchmarks_rules.sql`

### 7.1 `benchmark` — never a hardcoded generic number

Every benchmark row **must** carry source + date + sample + confidence + limits, or it does not
exist (brief: "no hardcoded generic benchmarks"; "else benchmark unavailable"). Sourced from `[27]`.

```sql
create table if not exists public.benchmark (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid references public.brands (id) on delete cascade, -- NULL = shared/global
  scope          text not null check (scope in ('global','niche','account','self')),
  context_key    text not null,          -- e.g. 'ctr|ad|ecom_apparel|us|feed'
  metric_key     text not null references public.metric_catalog (metric_key),
  level          text not null,
  segment_json   jsonb,                  -- niche/geo/placement dimensions matched on
  value          numeric,
  low            numeric,                -- interval, not a false-precise point
  high           numeric,
  sample_n       bigint,                 -- NULL/low sample -> low confidence, surfaced
  source         text not null,          -- citation; REQUIRED (schema-level guard)
  source_date    date not null,          -- REQUIRED; benchmarks decay
  confidence     numeric,
  limitations    text,
  fact_class     text not null check (fact_class in
                   ('RESEARCH_BACKED','INDUSTRY_BENCHMARK','INTERNAL_CALCULATION')), -- self-benchmark = INTERNAL
  valid_from     date,
  valid_to       date,
  created_at     timestamptz not null default now()
);
create index if not exists benchmark_ctx_idx on public.benchmark (metric_key, level, scope);
```

> `NOT NULL` on `source` + `source_date` is the schema-level guard against a fabricated benchmark.
> `scope='self'` (this account vs its own history) is `INTERNAL_CALCULATION`; external comps are
> `RESEARCH_BACKED`/`INDUSTRY_BENCHMARK`. A query that finds no matching row returns "benchmark
> unavailable" — the app never falls back to an invented default (brief rule 5, engines).

### 7.2 Rule engine

Mirrors the brief's rule-object contract (id/name/inputs/formula/trigger/threshold/exceptions/
output/action/confidence/source/version). Fires are stored so a recommendation can cite exactly why.

```sql
create table if not exists public.rule (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid references public.brands (id) on delete cascade,  -- NULL = global rule library
  rule_key       text not null,
  version        int  not null default 1,
  name           text not null,
  category       text,                    -- fatigue/waste/scaling/health/diversity...
  inputs_json    jsonb not null,          -- metric_keys + windows it reads
  formula        text not null,
  trigger_condition text not null,
  threshold_json jsonb,                    -- thresholds; validated, never arbitrary
  threshold_source text,                   -- REQUIRED when a threshold is present
  exceptions_json jsonb,                   -- AUTOPSY guards (promo, small sample, seasonality...)
  output_template text,
  action         text,
  confidence_basis text,
  fact_class     text not null default 'INTERNAL_CALCULATION',
  enabled        boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid), rule_key, version)
);

create table if not exists public.rule_evaluation (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  rule_id        uuid not null references public.rule (id) on delete cascade,
  rule_version   int  not null,
  level          text not null,
  entity_id      text not null,
  day            date not null,
  fired          boolean not null,
  inputs_snapshot jsonb not null,          -- the exact values read (reproducibility)
  computed_values jsonb,
  confidence     numeric,
  created_at     timestamptz not null default now(),
  unique (rule_id, rule_version, ad_account_id, level, entity_id, day)
);
create index if not exists rule_eval_entity_idx on public.rule_evaluation (level, entity_id, day);
```

> `threshold_source` is required whenever `threshold_json` is set — the schema refuses an unsourced
> arbitrary threshold (brief: "no arbitrary unvalidated thresholds"). Rule versions are immutable;
> changing a threshold creates a new `version`, so old fires stay explainable.

---

## 8. Recommendations + changes — `0008_recommendations_changes.sql`

### 8.1 `recommendation` — DRAFT proposals only

Stores the full decision chain (brief: OBSERVATION→DIAGNOSIS→EVIDENCE→RULE→CONFIDENCE→ACTION→
EXPECTED IMPACT→VALIDATION) and the action-prioritization bucket. **No execution path exists.**

```sql
create table if not exists public.recommendation (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  level          text not null,
  entity_id      text not null,
  day            date not null,

  observation    text not null,           -- what changed (DERIVED)
  diagnosis      text not null,           -- why (INFERENCE)
  evidence_json  jsonb not null,          -- {metric_daily_ids[], triple_ids[], rule_eval_ids[]}
  rule_id        uuid references public.rule (id) on delete set null,
  prediction_json jsonb,                  -- 'what happens if we do nothing' (MODEL_ESTIMATE)

  action         text not null,
  action_class   text not null check (action_class in
                   ('DO_NOW','DO_NEXT','WATCH','DO_NOT_ACT','NEEDS_MORE_DATA')),
  expected_impact_json jsonb,             -- MODEL_ESTIMATE, never a fact
  confidence     numeric,
  sample_n       bigint,
  effort         text,
  urgency        text,
  expected_value numeric,
  risk           text,

  status         text not null default 'draft'  -- no value means 'written to Meta'
                 check (status in ('draft','accepted','dismissed','superseded')),
  fact_class     text not null default 'MODEL_ESTIMATE'
                 check (fact_class in ('MODEL_ESTIMATE','INFERENCE','UNKNOWN')),
  valid_until    date,
  created_at     timestamptz not null default now()
);
create index if not exists rec_acct_day_idx on public.recommendation (ad_account_id, day);
create index if not exists rec_action_idx    on public.recommendation (action_class, status);
```

> `status` has **no** value representing a write-back to Meta. `accepted` means the human took it into
> a `test_plan_item` (0001) or acted manually; AdBrain still never touches the ad account (CLAUDE
> rule 7, 23 §7). A `NEEDS_MORE_DATA` recommendation is emitted explicitly, never silently dropped.

### 8.2 Change tracking — the AUTOPSY substrate

Distinguishing a fatigue signal from a *budget/audience/creative/promo/price/LP/tracking change* is
the brief's central adversarial gate. Two tables: platform-detected changes, and external events
Meta can't know.

```sql
-- Changes we detect by diffing dim_* snapshots (budget, status, audience, creative binding).
create table if not exists public.entity_change (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  level          text not null,
  entity_id      text not null,
  change_type    text not null check (change_type in
                   ('budget','status','bid','audience','creative_binding','optimization_goal','placement')),
  detected_on    date not null,
  before_json    jsonb,
  after_json     jsonb,
  source         text not null default 'meta_diff',
  fact_class     text not null default 'OFFICIAL_PLATFORM_FACT',  -- diff of two OFFICIAL snapshots
  data_map_class text not null default 'CALC',                    -- detected by our diff
  created_at     timestamptz not null default now()
);
create index if not exists entity_change_idx on public.entity_change (level, entity_id, detected_on);

-- External events Meta cannot know: promo, price/LP/tracking change, stockout, seasonality.
-- USER- or EXTERNAL-sourced (02: EXTERNAL / off-platform).
create table if not exists public.external_event (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.brands (id) on delete cascade,
  ad_account_id  uuid references public.ad_accounts (id) on delete set null,
  event_type     text not null check (event_type in
                   ('promo','price_change','lp_change','tracking_change','stockout','seasonality','other')),
  starts_on      date not null,
  ends_on        date,
  scope_json     jsonb,                    -- which products/campaigns it touches
  description    text,
  source         text not null,            -- 'user' | shopify | crm ...
  fact_class     text not null default 'EXTERNAL'
                 check (fact_class in ('EXTERNAL','INFERENCE','UNKNOWN')),
  data_map_class text not null default 'EXTERNAL',
  created_at     timestamptz not null default now()
);
create index if not exists ext_event_brand_idx on public.external_event (brand_id, starts_on);
```

> When AUTOPSY sees a ROAS drop it joins `fact_metric_daily` against `entity_change` and
> `external_event` on the same day-window **before** calling it fatigue. A drop that coincides with a
> budget 3x or a promo ending is flagged "confounded — not fatigue", never a false FATIGUED state.

---

## 9. Warehouse-native metrics — full 10-question specs

Marketing metrics get their 10-Q in `[01a–d]` (bridged by `metric_catalog`). The metrics **this
schema itself owns** — data-integrity metrics with no other home — get their full treatment here.
All are **level = account/source**, **category N (data quality)**, **data-map class CALC →
fact_class INTERNAL_CALCULATION (DERIVED)**, and each names the decision it changes.

### 9.1 Snapshot freshness lag *(stored read-model value; operational twin in 23 §9.1)*

| # | | |
|---|---|---|
| 1 | Measures | Gap between the latest Meta "day" that should exist and the latest day actually landed in `fact_insights_daily`, per source. |
| 2 | Why | A stale snapshot silently corrupts every downstream DERIVED metric and recommendation. |
| 3 | **Decision** | Show/hide the staleness banner; **block** `recommend` from running on stale data; page on-call if lag breaches SLO. |
| 4 | Inputs | `max(day)` in `fact_insights_daily`; `source_freshness.last_success_at`; `account_tz`; `now`. |
| 5 | Formula | `lag_days = expected_latest_day(account_tz) − max(day landed)`; `lag_time = now − last_success_at`. |
| 6 | Source | INTERNAL_CALCULATION (DERIVED) from warehouse + job records. |
| 7 | Window | Rolling; compared to the SLO target. |
| 8 | Min sample | n/a — an event, not a sample. |
| 9 | Limitations | A fresh sync of *restated/wrong* data still reads fresh; freshness ≠ correctness. |
| 10 | When NOT to trust | During a known Meta outage/restatement window — lag looks bad but is Meta-side. **SLO target = UNKNOWN / verify at build.** |

### 9.2 Restatement delta *(AUTOPSY input, warehouse-native)*

| # | | |
|---|---|---|
| 1 | Measures | How much a previously-landed day's OFFICIAL metrics changed when Meta re-served it (attribution maturation). |
| 2 | Why | Meta restates recent days; a "trend" that is really restatement is a false signal. |
| 3 | **Decision** | Judge whether an observed change is real or restatement noise; set the trailing re-pull window `N`; flag affected days "restated" on every view. |
| 4 | Inputs | Overwritten value vs prior stored value for the same natural key in `fact_insights_daily` (captured before overwrite). |
| 5 | Formula | `restatement_delta = new_value − prior_value` per metric per restated day; `% = delta/prior`. |
| 6 | Source | INTERNAL_CALCULATION (DERIVED). |
| 7 | Window | Trailing re-pull window (last N days). **N = UNKNOWN / verify at build** (depends on attribution windows, 02/23). |
| 8 | Min sample | 1 restated day. |
| 9 | Limitations | Only captures restatement within the re-pull window; older restatements are invisible. |
| 10 | When NOT to trust | Right after connecting an account (initial backfill is not a restatement). |

### 9.3 Data completeness score

| # | | |
|---|---|---|
| 1 | Measures | Share of expected daily rows present and non-null across the entity tree for a period. |
| 2 | Why | Diversity/fatigue/health scores on partial data mislead; the confidence engine [14] needs this input. |
| 3 | **Decision** | Whether to compute a score at all vs return "insufficient data"; how much to discount downstream confidence. |
| 4 | Inputs | Expected (entity × day) grid from `dim_*`; actual rows in `fact_insights_daily`; null-rate of key fields. |
| 5 | Formula | `completeness = present_cells / expected_cells`, weighted by field importance (weights + reasons in `metric_catalog`). |
| 6 | Source | INTERNAL_CALCULATION (DERIVED). |
| 7 | Window | Per requested analysis window. |
| 8 | Min sample | The window must span ≥ the metric's own min_sample or the score itself is low-confidence. |
| 9 | Limitations | "Present" ≠ "correct"; a zero-spend day is legitimately empty, not missing — must not count as a gap. |
| 10 | When NOT to trust | New/paused entities with legitimately sparse delivery; treat sparsity as a state, not an error. |

> These three are `is_primary = true` — each changes a concrete decision. Raw ops counters (row
> counts, ingest durations) are **advanced/vanity — not primary** and live in ops tooling, not the
> metric surface.

---

## 10. Ops + read models — `0009_ops_readmodels.sql`

```sql
-- Per-source freshness read model (feeds 23 §8 freshness block + the staleness banner).
create table if not exists public.source_freshness (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts (id) on delete cascade,
  source         text not null,           -- 'meta_insights'|'meta_entities'|'assets'|'vision'|'shopify'...
  last_success_at timestamptz,
  latest_day_landed date,
  is_stale       boolean not null default false,
  reason         text,
  updated_at     timestamptz not null default now(),
  unique (ad_account_id, source)
);

-- Read models are pre-computed for the Read API (23 §8: dashboards do zero compute).
-- Implement as materialized views or refreshed tables; refreshed by the pipeline, never on read.
--   mv_entity_rollup    : entity tree + rolled-up DERIVED metrics per window  (reads fact_metric_daily)
--   mv_account_overview : account health snapshot + freshness                 (reads facts + source_freshness)
--   mv_creative_card    : creative + fingerprint + near-dup siblings          (reads dim_creative + creative_fingerprint)
-- Every read-model row carries fact_class per field so the UI labels without re-deriving.
```

---

## 11. OFFICIAL vs DERIVED — the separation, at a glance

| Concern | OFFICIAL store | DERIVED store |
|---|---|---|
| Table(s) | `fact_insights_daily`, `dim_*`, `entity_change` | `fact_metric_daily`, `creative_fingerprint`, `creative_embedding`, `rule_evaluation`, `recommendation` |
| 02 class | FETCH | CALC / INFER / EXTERNAL |
| `fact_class` | `OFFICIAL_PLATFORM_FACT` (CHECK-enforced) | `INTERNAL_CALCULATION` / `MODEL_ESTIMATE` / `INFERENCE` / `EXTERNAL` (CHECK forbids OFFICIAL) |
| Written by | Ingestion service (23 §5) | Analysis pipeline (23 §7) |
| Overwrite policy | Idempotent overwrite; restatement delta captured (§9.2) | Recomputed from OFFICIAL + `formula_version`; fully reproducible |
| Can be a Meta fact? | Yes | **Never** — the CHECK constraint makes mislabeling impossible |

The CHECK constraints on `fact_class` are the load-bearing guardrail: it is **physically impossible**
to store a computed number in the OFFICIAL table, or an OFFICIAL label in a DERIVED table. Brief rule
3 enforced by the database, not by convention.

---

## 12. Migration order + RLS summary

**Apply order:** `0001` → `0002` → `0003_hierarchy` → `0004_facts_daily` → `0005_creative_intelligence`
→ `0006_brand_brain` → `0007_benchmarks_rules` → `0008_recommendations_changes` → `0009_ops_readmodels`.
Within `0004`, create `metric_catalog` **before** `fact_metric_daily` (FK target).

**RLS (every new table):** enabled, safe-to-re-run policies, ownership transitive via
`ad_accounts.user_id` (platform data) or `brands.user_id` (brand brain). Global reference tables
(`metric_catalog`; `benchmark`/`rule` rows with NULL `brand_id`) are **read-any-authenticated,
write-service-role-only** (same pattern `oauth_tokens` uses in 0002):

```sql
alter table public.metric_catalog enable row level security;
drop policy if exists "read metric_catalog" on public.metric_catalog;
create policy "read metric_catalog" on public.metric_catalog for select using (auth.role() = 'authenticated');
-- no INSERT/UPDATE/DELETE policy => writes only via the service role (bypasses RLS).

drop policy if exists "read benchmark" on public.benchmark;
create policy "read benchmark" on public.benchmark for select
  using (brand_id is null
         or exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid()));
```

---

## 13. Open questions — verify at build

| # | Question | Blocking? |
|---|---|---|
| 1 | Meta Graph/Marketing **API version** string — part of `fact_insights_daily`'s natural key. | Yes |
| 2 | Attribution windows in use → `attribution_setting` values + restatement re-pull `N` (§9.2). | Yes |
| 3 | Which breakdown combinations 02 sanctions → the `breakdown_signature` vocabulary. | Yes |
| 4 | `pgvector` availability + per-kind embedding **dimensions** → embedding ANN index build (§5). | Yes (for creative ANN) |
| 5 | `min_sample` values per metric (from `[01]`/`[27]`) — NULL today = UNKNOWN, not a guess. | No (stored, flagged) |
| 6 | SLO targets for freshness lag / completeness (§9). | No (needed before alerting) |
| 7 | Hard FK `dim_ad.creative_id` → `dim_creative` safe given load order, or defer/add post-load. | No (build detail) |

*This schema stores facts; it never invents them. Every column is fact-labeled, every stored metric
traces to `[02]` for its class and `[01]` for its 10-question definition, and OFFICIAL is walled off
from DERIVED at the database level.*
