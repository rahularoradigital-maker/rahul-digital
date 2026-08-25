# 23 — API Architecture

**Artifact:** 23 of 28 · **Program:** AdBrain — AI Meta-Ads Creative + Media Intelligence System
**Owner persona:** Principal architect + senior Meta media buyer + creative strategist + data scientist at $100M/mo scale
**System question this serves:** *"What should we do next?"* — not *"how did ads perform?"*
**Status:** GROUNDED against `brief.md`, `00-master-plan.md`, `02-meta-data-mapping.md`, `ADR-0002`, `ADR-0003` (2026-08-25)

This is the **route/service surface**: the plumbing that sits between Meta's Graph/Marketing API, our stores, the analysis pipeline, and the dashboards. It is *not* the metric spec (that is [01a–01d]) nor the storage spec (that is [24]). Every data element a route moves is tagged with the **source class from [02]** (FETCH / CALC / INFER / EXTERNAL / CANNOT-KNOW) and a **fact label** (OFFICIAL PLATFORM FACT / INTERNAL CALCULATION (DERIVED) / RESEARCH-BACKED / INDUSTRY BENCHMARK / MODEL ESTIMATE / INFERENCE / UNKNOWN). Where [02] says something is EXTERNAL or CANNOT-KNOW, no route here fabricates it — it either fetches from the named external system or the read API returns "needs external source".

---

## 0. Cross-references (authority order)

| Depends on | For | Reconciliation rule |
|---|---|---|
| `02-meta-data-mapping.md` | The canonical source class of every field (FETCH/CALC/INFER/EXTERNAL/CANNOT-KNOW) and which Meta endpoints/fields exist | **[02] wins on any field-level disagreement.** Every ingestion element below cites its [02] row. If a field is not in [02], it is not fetched until [02] adds it. |
| `ADR-0002` (token strategy) | How OAuth tokens are obtained, stored (AES-256-GCM envelope, service-role-only table), refreshed, scoped | This artifact **references** ADR-0002 and MUST NOT restate token crypto or lifetimes. Token touch-points are tagged `[per ADR-0002]`. |
| `ADR-0003` (cron-drained job queue) | The async model: no always-on worker; a Vercel Cron tick claims ≤ RPM/RateBudget pending `job_items`, processes, marks done/failed; stale items reset; idempotent upserts | Every slow route below is a **queue producer**, not an inline handler. This artifact MUST NOT introduce a competing worker model. Tagged `[per ADR-0003]`. |
| `brief.md` + `00-master-plan.md` | The 10-question metric discipline, the decision gate, fact-labeling, the OBSERVE→DIAGNOSE→PREDICT→RECOMMEND transform | Applied in [§9](#9-operational-metrics) to the *operational* metrics this layer owns. Marketing metrics belong to [01a–01d]. |

> **Meta versioning caveat:** the Graph/Marketing API is versioned and Meta deprecates/renames fields ([02] says so explicitly). Field *existence* below is OFFICIAL PLATFORM FACT per [02]; version strings, exact quotas, and attribution-window availability are marked **UNKNOWN / verify at build** and are never presented as settled.

---

## 1. Design principles

1. **Read/write split.** Ingestion + pipeline **write** stores; dashboards **only read** pre-computed read models. No dashboard calls Meta, and no read triggers a compute.
2. **Everything slow is a job.** Any call touching Meta, downloading a video, running CV, or running analysis is enqueued and drained by the cron tick `[per ADR-0003]`. Handlers return `202 + job_id`, never block. This is also how we stay inside Gemini/Meta rate limits *structurally* (the per-tick cap is the rate limiter — ADR-0003).
3. **Idempotent by (entity, day, version).** Day-wise (`time_increment=1`) is the atomic grain ([02]: per-day via `time_increment=1`). Re-runs upsert, never duplicate — matching ADR-0003's idempotency contract and [24]'s `(ad_id, date)` upsert key.
4. **Source class + fact label travel with the data.** Every field carries its [02] class and fact label from ingestion through the read API, so the dashboard renders the label without re-deriving. Ingestion never relabels a CALC value as an OFFICIAL Meta field (brief rule).
5. **The pipeline is a DAG of stages, not a monolith.** `observe → diagnose → predict → recommend`; each stage independently enqueueable, retryable, inspectable. A failed `predict` never blocks a fresh `observe`.
6. **Recommendations are proposals, never actions.** No route writes back to Meta — no budget change, no pause, no ad creation. AdBrain answers "what should we do next?"; a human executes. Hard boundary, not a v1 limitation.
7. **EXTERNAL is honest, not invented.** Metrics [02] classes as EXTERNAL (MER, NCAC, LTV) or INFERENCE (iROAS, elasticity) or CANNOT-KNOW (competitor economics) are never synthesized from Meta alone. The read API returns "needs external source" or a MODEL ESTIMATE with confidence — never a fabricated number.

---

## 2. Service map (bounded contexts)

```
                    ┌───────────────────────────────────────────────────┐
   Meta Graph /     │                   AdBrain backend                  │
   Marketing API ──▶│                                                    │
                    │  (A) Ingestion Service  ── writes ─▶ raw store     │
                    │  (B) Asset Service      ── writes ─▶ blob + meta   │
                    │  (C) Vision Service     ── writes ─▶ fingerprint   │
                    │  (D) Analysis Pipeline  ── writes ─▶ read models   │
                    │  (E) Read / Query API   ── reads  ─▶ dashboards    │
                    │  (F) External Connectors── writes ─▶ external facts│
                    │  (X) Auth / OAuth       ── [per ADR-0002]          │
                    │  (Q) Job Queue + Cron   ── [per ADR-0003]          │
                    └───────────────────────────────────────────────────┘
                                      │  202 + job_id
                                      ▼
                              Dashboards (read-only)
```

| # | Service | Responsibility | Talks to Meta? | Queue role | [02] classes it moves |
|---|---|---|---|---|---|
| A | **Ingestion** | OAuth-scoped insights sync (day-wise) + entity tree (account→campaign→adset→ad→creative) | Yes | Producer + consumer | FETCH (raw), then CALC downstream |
| B | **Asset** | Pull raw creative (copy, image_hash, video source, thumbnails, story spec) | Yes | Producer + consumer | FETCH (asset + metadata) |
| C | **Vision** | CV extraction + fingerprinting on our blobs (frames, scenes, OCR, embeddings, pHash) | No (reads blobs) | Consumer | EXTERNAL/CALC (extraction) → INFER (semantic labels) |
| D | **Analysis** | observe→diagnose→predict→recommend over read-ready facts | No | Consumer (chained DAG) | CALC → INFER → INFERENCE/MODEL ESTIMATE |
| E | **Read/Query** | Serves dashboards from pre-computed read models | No | Neither | passes through class + label |
| F | **External Connectors** | Shopify/CRM/finance, LP crawler, product feed, competitor scrape — *architecture-ready, Meta-only MVP leaves these "needs external source"* | No (3rd-party APIs) | Producer + consumer | EXTERNAL, and CANNOT-KNOW for competitor economics |
| X | **Auth/OAuth** | Token grant, storage, refresh, scope enforcement | Yes (token exchange) | — | `[per ADR-0002]` |
| Q | **Queue+Cron** | Durable `jobs`/`job_items` drained on cron tick | — | infrastructure | `[per ADR-0003]` |

---

## 3. Conventions (all routes)

| Concern | Convention |
|---|---|
| Base path | `/api/v1` — our contract version, independent of Meta's Graph API version. |
| Auth (inbound) | Session/service token on every route (Supabase auth; RLS by brand/account ownership, consistent with ADR-0002/0003). OAuth-to-Meta is server-internal only; the browser never sees a Meta token `[per ADR-0002]`. |
| Long jobs | Return `202 Accepted` + `{ job_id, status_url }`; poll `GET /api/v1/jobs/{job_id}`. No long-polling, no websockets in v1 (the dashboard polls, matching ADR-0003). |
| Idempotency | Mutating ingestion routes accept `Idempotency-Key`; dedup key = `(account_id, entity_id, day, breakdown_signature, meta_api_version)`. Reduces to `(ad_id, date)` at the row level per [24] and ADR-0002 §3. |
| Pagination (read) | Cursor-based `?cursor=&limit=` (default 100, max 500). |
| Errors | RFC-9457 problem+json `{ type, title, status, detail, instance }`. Meta errors are wrapped, never leaked raw (they can contain token fragments — ADR-0002 "never log tokens"). |
| Time | Timestamps UTC ISO-8601. Meta "day" honours the **ad-account timezone**, stored per row to avoid off-by-one aggregation ([02] day-wise grain; [24] stores the tz). |
| Provenance | Every data field in a response carries a sibling `_class` (the [02] class) and `_fact` (the fact label). See §1.4. |

---

## 4. (X) Auth / OAuth — reference only

Token acquisition, AES-256-GCM envelope storage in a service-role-only table, refresh cadence, and scope minimisation are **owned by ADR-0002**. This artifact records only the API touch-points.

| Route / hook | Purpose | Notes |
|---|---|---|
| `GET /api/v1/auth/meta/start` | Begin Meta OAuth (server-side Authorization Code + PKCE where supported) | Requests the minimum ads-read scope. **Exact scope list = UNKNOWN / verify at build** against [02]'s field needs (`ads_read`, plus `business_management` if acting for a business). |
| `GET /api/v1/auth/meta/callback` | OAuth redirect handler; exchanges code → token server-side | Hands the token to the Auth Service for encrypted storage `[per ADR-0002]`; never returns it to the browser. |
| internal `AdSource.getToken(account_id)` | Supplies a valid token to Ingestion/Asset services | The `AdSource` provider abstraction (ADR-0002 §4) lets Meta and Google share one interface. Refresh/expiry is ADR-0002's job; callers treat it as "give me a working token or fail closed". |

**Fact:** Meta uses OAuth 2.0 with the Graph API. `[OFFICIAL PLATFORM FACT]`
**UNKNOWN / verify at build:** exact long-lived-token lifetime, refresh mechanics, and user-token vs System-User-token choice — all owned by ADR-0002.

---

## 5. (A) Ingestion Service — Meta insights + entity sync

**Goal:** land day-wise (`time_increment=1`) performance facts and the entity tree, idempotently, without ever blocking a request. Every element cites its [02] row.

### 5.1 Entity tree sync (account → campaign → adset → ad → creative)

| Route | Method | Behaviour |
|---|---|---|
| `/api/v1/sync/{account_id}/entities` | POST | Enqueues a full entity-tree crawl → `202 + job_id`. |

Meta calls the job makes: `GET /act_{account_id}/campaigns`, `/adsets`, `/ads`, `/adcreatives`, `fields=` limited to what [02] whitelists.

| Element | [02] row / class | Fact label |
|---|---|---|
| account/campaign/adset/ad/creative ids + names | Hierarchy levels; FETCH | OFFICIAL PLATFORM FACT |
| `budget`, `delivery`/`effective_status` (campaign/adset) | Delivery/spend → FETCH | OFFICIAL PLATFORM FACT |

**Level:** account / campaign / adset / ad / creative. **[02] class:** FETCH (all entity metadata is directly returned by Meta).

### 5.2 Insights sync (day-wise) — the core pull

| Route | Method | Behaviour |
|---|---|---|
| `/api/v1/sync/{account_id}/insights` | POST | Body `{ since, until, level, breakdowns[] }` → enqueues a day-wise insights job → `202 + job_id`. |

**Fields pulled, each mapped to its [02] class** (the job stores raw fetched fields; derived metrics are computed later in §7, never here):

| Field group | Example fields | [02] class | Fact label |
|---|---|---|---|
| Delivery/spend | `spend`, `impressions`, `reach`, `frequency`, `cpm`, `cpc`, `ctr`, `clicks`, `inline_link_clicks` | FETCH | OFFICIAL PLATFORM FACT |
| Time grain | `date_start`/`date_stop` via `time_increment=1` | FETCH | OFFICIAL PLATFORM FACT — day-wise snapshot ([22][24]) |
| Attention/video | `video_3_sec` (3-sec plays), `thruplay`, `video_p25/50/75/100_watched_actions`, `video_avg_time_watched` | FETCH | OFFICIAL PLATFORM FACT — Meta provides the *raw plays* only |
| Landing | `landing_page_views` (action type), and per-action costs | FETCH | OFFICIAL PLATFORM FACT |
| Conversion | `actions`, `action_values` (purchases + conversion value) | FETCH | OFFICIAL PLATFORM FACT — **attribution-window dependent** |

**Explicitly NOT fetched here — these are CALC, computed in §7, never mislabeled as Meta fields** (brief rule): `hook rate` (= 3-sec plays / impressions), `hold rate` (3 competing defs — pick and document one), retention curve / attention decay (from p25–100), `roas`, `cpa`, `cvr`, `aov`, spend velocity / 7/14/30-day trend / concentration. All **CALC → INTERNAL CALCULATION (DERIVED)**. [02] is explicit that hook rate and hold rate are *not* official fields.

**Explicitly UN-fetchable from Meta alone** — the read API surfaces these as "needs external source" (§8), never synthesized: new-customer CAC / new-vs-returning split, MER / blended ROAS / contribution margin, LTV / LTV:CAC / payback → **EXTERNAL** (Shopify/CRM/finance); incremental revenue / iROAS / marginal CAC / spend elasticity → **INFERENCE** (needs experiment or MMM; MODEL ESTIMATE, never a fact — [02] hard limit).

**How the job pulls (fact-labelled):**

| Element | Value | Fact label |
|---|---|---|
| Endpoint | `GET /act_{account_id}/insights` (and per-entity `/{id}/insights`) | OFFICIAL PLATFORM FACT — endpoint exists |
| Day grain | `time_increment=1` → one row per entity per day | OFFICIAL PLATFORM FACT |
| Level | `level=account\|campaign\|adset\|ad` | OFFICIAL PLATFORM FACT |
| Breakdowns | `breakdowns=` (`publisher_platform`, `platform_position`, `age`, `gender`, `country`, …) | OFFICIAL PLATFORM FACT — valid combinations constrained; **which combos we use = verify against [02]** |
| Attribution | `action_attribution_windows=` (e.g. `7d_click`, `1d_view`) | OFFICIAL PLATFORM FACT — default windows/availability **UNKNOWN / verify at build** |
| Large pulls | `run_async=true` → `report_run_id` → poll → fetch pages | OFFICIAL PLATFORM FACT — async report pattern exists |

**Async-report handling matches ADR-0003:** the job does not busy-wait on `report_run_id`. It submits the async report, records `report_run_id` on the `job_item`, and **re-enqueues a "poll" item**. The next cron tick checks `async_status`/`async_percent_completion` and either re-enqueues another poll or moves to result-fetch. Every unit of work stays short and cron-drainable, exactly the model ADR-0003 chose over one long function.

**Idempotency / backfill / restatement:** dedup key `(account_id, entity_id, day, breakdown_signature, meta_api_version)`; re-running a date range upserts in place (row-level `(ad_id, date)` per [24]/ADR-0002 §3). Meta **restates** recent days as attribution matures, so the scheduler re-pulls a trailing window on each daily tick — **N = UNKNOWN / verify at build** (depends on the attribution windows in use; do **not** hardcode "28 days" as fact — [02] flags iOS/privacy attribution as modeled/underreported).

**Rate limiting:** the Marketing API applies Business-Use-Case (BUC) throttling, reported in `X-Business-Use-Case-Usage` (and related) headers. `[OFFICIAL PLATFORM FACT: header-based BUC throttling exists]`. Exact points-per-call, decay, and account-tier limits = **UNKNOWN / verify at build**. On approaching the limit the job **re-enqueues with backoff** rather than hard-failing — the same per-tick pacing ADR-0003 uses for Gemini RPM, applied to Meta.

### 5.3 What ingestion writes

Raw insights rows + entity metadata land in the **raw store**, each tagged `_class = FETCH`, `_fact = OFFICIAL_PLATFORM_FACT`. Derived metrics are **not** computed here — that is the pipeline's job (§7), tagged `_class = CALC`, `_fact = INTERNAL_CALCULATION (DERIVED)`. Each row also stores the ad-account timezone and the `meta_api_version` it was pulled under (part of the idempotency key).

---

## 6. (B) Asset Service + (C) Vision Service — creative pipeline

### 6.1 Asset Service (pull the raw creative) — [02] class FETCH

| Route | Method | Behaviour |
|---|---|---|
| `/api/v1/sync/{account_id}/assets` | POST | Enqueues an asset pull for new/changed creatives → `202 + job_id`. |

| Asset | How obtained | [02] class | Fact label |
|---|---|---|---|
| Ad copy / story spec / CTA | `adcreatives{object_story_spec, body, title, call_to_action_type}` | FETCH | OFFICIAL PLATFORM FACT |
| Format / aspect | `adcreatives` fields | FETCH | OFFICIAL PLATFORM FACT |
| Image | `image_hash` → `/act_{account_id}/adimages` | FETCH | OFFICIAL PLATFORM FACT |
| Video source | `video_id` → `GET /{video_id}` (source + `thumbnails`) | FETCH | OFFICIAL PLATFORM FACT — download subject to permissions; **source-download availability = verify at build** |
| Thumbnail | creative `thumbnail_url` / video thumbnails | FETCH | OFFICIAL PLATFORM FACT |

**Video pipeline stages** (each a separate `job_item` stage so no single job runs long — ADR-0003 per-item model; note ADR-0001's heavy ffmpeg/QStash pipeline was **superseded**, so this is a light, cron-drained fan-out, and native video understanding can be done by Gemini rather than ffmpeg frame extraction where chosen):
1. `resolve` — map ad → creative → `video_id` / `image_hash`.
2. `download` — fetch the media blob to our blob store. **A queued, size-bounded job; the API never streams a video inline.**
3. `normalize` — sample to frames + audio track for CV (or hand the whole video to native video analysis).
4. `handoff` — enqueue a Vision job pointing at the normalized artifacts.

### 6.2 Vision Service (CV extraction + fingerprinting)

Runs **only on our blobs** — never calls Meta. Consumer-only in the queue. This is [02]'s "video frames, visual attributes, embeddings → EXTERNAL/CALC (computer vision)" plus "persona/hook/angle/concept labels → INFER". The fingerprint is stored **once per creative** (brief §Creative intelligence).

| Route | Method | Behaviour |
|---|---|---|
| `/api/v1/vision/{asset_id}/fingerprint` | POST | Enqueues CV fingerprinting for one asset → `202 + job_id`. |
| `/api/v1/vision/{asset_id}/fingerprint` | GET | Reads the stored fingerprint (from fp store, no recompute). |

**Fingerprint fields — class matched to [02]** (raw CV extraction is EXTERNAL/CALC; a deterministic hash is CALC; *semantic* labels are INFER; advisory risk flags are MODEL ESTIMATE):

| Fingerprint field | What / decision it serves | [02] class | Fact label |
|---|---|---|---|
| Perceptual hash (pHash / video hash) | Near-dup detection — "genuinely new creative or a re-upload?" | CALC (deterministic) | INTERNAL CALCULATION (DERIVED) |
| Transcript | First-1/3/5s content, claims, VO | EXTERNAL/CALC (transcription service / native video) | RESEARCH-BACKED tooling output; treat text as extracted, not asserted |
| Frame sampling / scene + shot segmentation | Pacing, hook length, first-3s content — "is drop-off a hook problem?" | EXTERNAL/CALC (computer vision) | MODEL ESTIMATE |
| On-screen text / OCR | Text-overlay density — "over-crowded for the placement?" | EXTERNAL/CALC (computer vision) | MODEL ESTIMATE |
| Visual embeddings (visual/text/audio/scene/hook/concept/persona/angle) | Clustering, diversity, white-space [06][13] | EXTERNAL/CALC (embeddings) | MODEL ESTIMATE |
| Has-face / logo / format tags | Attribute tagging for clustering | EXTERNAL/CALC → INFER | INFERENCE |
| Persona / hook / angle / concept labels | The creative-fingerprint semantic layer [05] | INFER | INFERENCE — carries confidence |
| Brand-safety / policy-risk flags | Pre-flag likely disapprovals | INFER | MODEL ESTIMATE — advisory only |

**Decision gate (brief rule 1):** each fingerprint field names the diagnosis it feeds; any that feeds none is marked **advanced/vanity — not primary**. No embedding or label is presented as an OFFICIAL Meta attribute — [02] classes all of these as EXTERNAL/CALC or INFER, never FETCH.

---

## 7. (D) Analysis Pipeline — observe → diagnose → predict → recommend

A **DAG of queued stages** (ADR-0003 `job_items`, one stage each). Each stage reads inputs from a store, writes outputs to a store, and enqueues the next. No stage is on any HTTP request path. This is where the system earns "what should we do next?" (the transform in `brief.md` / `00-master-plan.md`).

```
observe ──▶ diagnose ──▶ predict ──▶ recommend ──▶ read models
   │           │            │            │
 facts     drivers      forecasts     proposals
 (CALC)    (INFER)      (INFERENCE/   (MODEL
                         MODEL EST)    ESTIMATE)
```

| Route | Method | Behaviour |
|---|---|---|
| `/api/v1/analysis/{account_id}/run` | POST | Enqueues the full DAG (or `?from=predict` to resume) → `202 + job_id`. |
| `/api/v1/analysis/{job_id}` | GET | Stage-by-stage status + which stage produced what. |

| Stage | Reads | Produces | [02] class → fact label | Decision it exists to drive |
|---|---|---|---|---|
| **observe** | raw insights (FETCH) + fingerprints | derived metrics computed our way (CTR, hook rate, hold rate, ROAS, CPA, frequency trend, spend velocity/concentration) | CALC → INTERNAL CALCULATION (DERIVED) | "What actually changed?" — the honest baseline |
| **diagnose** | observe output | driver attribution (fatigue? audience? placement? creative? LP?) | INFER → INFERENCE | "*Why* did it change?" — root cause, not symptom |
| **predict** | observe + diagnose | short-horizon fatigue forecasts (7/14-day per brief), saturation/decay, marginal economics/elasticity | INFERENCE → MODEL ESTIMATE | "What happens if we do nothing? / if we spend another \$10K?" |
| **recommend** | all above | ranked, human-executable proposals with expected effect + confidence + sample | MODEL ESTIMATE | "What should we do next?" — the product's reason to exist |

**Hard rules baked in:**
- `recommend` output is **DRAFT PROPOSALS ONLY**. No route pushes a change to Meta (brief: recommendations are proposals; a human executes). Every proposal carries: action, entity + level, expected effect (MODEL ESTIMATE), confidence, sample size, reason. Insufficient sample → emitted as *"insufficient data — do not act"* (the DO NOT ACT / NEEDS MORE DATA states in the brief), never silently dropped.
- Every derived number is DERIVED and **reproducible from stored inputs** — the read API can "show the maths" for any recommendation (the explainability engine [25]).
- **No fabricated benchmark** (brief rule 5): where a proposal needs a threshold and none is verified, it is emitted **UNKNOWN / verify at build**, not invented. iROAS / elasticity / incrementality are **INFERENCE** per [02] — labelled MODEL ESTIMATE with confidence, never a fact.
- EXTERNAL-dependent diagnoses (MER, NCAC, LTV) run only if a connector (§F) supplied the data; otherwise the recommendation degrades gracefully and states the missing source.

---

## 8. (E) Read / Query API — dashboards

Dashboards read **only** here. Every response is served from a pre-computed read model: **zero** compute, **zero** Meta calls, **zero** queue writes on the read path.

| Route | Serves | Level |
|---|---|---|
| `GET /api/v1/read/{account_id}/overview` | Account health snapshot + freshness banner | account |
| `GET /api/v1/read/{account_id}/entities?level=&cursor=` | Entity tree with rolled-up derived metrics | campaign/adset/ad |
| `GET /api/v1/read/{account_id}/creative/{creative_id}` | Creative card: metrics + CV fingerprint + near-dup siblings | creative |
| `GET /api/v1/read/{account_id}/diagnoses` | Ranked "why" cards | adset/ad |
| `GET /api/v1/read/{account_id}/recommendations` | Ranked next-action proposals (DRAFT) | any |
| `GET /api/v1/read/{account_id}/freshness` | Per-source last-successful-sync + staleness | account |
| `GET /api/v1/read/{account_id}/economics` | On-platform ROAS/CPA (DERIVED) **+ explicit "needs external source" for MER/NCAC/LTV/iROAS** | account/campaign |

**Freshness is first-class.** Ingestion is async and can silently degrade (expired token → ADR-0002 fail-closed; BUC backoff; Meta restatement). Every read response includes `freshness = { source, last_success_at, is_stale, reason }`. A stale read is **labelled**, never hidden — the dashboard shows a staleness banner rather than presenting old numbers as current.

**Provenance rendering.** Every metric field carries `_class` (its [02] class) and `_fact` (its label), so the UI shows "OFFICIAL PLATFORM FACT" vs "DERIVED" vs "MODEL ESTIMATE" vs "needs external source" without re-deriving. This is the [02] "every economics view flags attribution limits" rule made concrete: any economics figure that is attribution-window-dependent carries an attribution caveat inline.

---

## 9. Operational metrics

Marketing metrics (CTR, ROAS, CPA, fatigue, diversity) belong to [01a–01d]. This layer owns **operational** metrics — health of the API/ingestion/pipeline itself. Each passes the brief's 10-question gate; **level = infrastructure**; **[02] class = CALC (DERIVED)** from our own job/HTTP records (not a Meta field), except where a Meta header is the input.

### 9.1 Sync freshness lag

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Time between the latest Meta "day" that should be present and what we've landed. |
| 2 | Why | Stale facts silently corrupt every downstream recommendation. |
| 3 | Decision | Show/hide the staleness banner; block `recommend` on stale data; alert if lag breaches SLO. |
| 4 | Inputs | `now`, `last_success_at` per source, ad-account timezone. |
| 5 | Formula | `lag = now − last_success_at` (per source, tz-aware). |
| 6 | Source / class | INTERNAL CALCULATION (DERIVED) from `jobs` records · [02] class CALC. |
| 7 | Window | Rolling vs SLO target. |
| 8 | Min sample | 1 sync record (it's an event, not a distribution). |
| 9 | Limitations | A fresh sync of *wrong* data still reads fresh; freshness ≠ correctness. |
| 10 | When NOT to trust | During a known Meta outage/restatement — freshness looks bad but is Meta-side. **SLO target = UNKNOWN / verify at build.** |

### 9.2 Queue depth / oldest-unstarted-job age

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Backlog in the cron-drained queue and age of the oldest waiting `job_item`. |
| 2 | Why | Growing backlog means the tick can't keep up; freshness degrades next. |
| 3 | Decision | Raise tick frequency / per-tick budget `[within ADR-0003]`; shed or reprioritise job classes. |
| 4 | Inputs | `job_items`: `enqueued_at`, `started_at`, `status`. |
| 5 | Formula | `depth = count(status=queued)`; `oldest_age = now − min(enqueued_at where queued)`. |
| 6 | Source / class | INTERNAL CALCULATION (DERIVED) · [02] class CALC. |
| 7 | Window | Per tick + rolling. |
| 8 | Min sample | n/a (census). |
| 9 | Limitations | Depth hides class mix — one stuck video download ≠ 100 quick reads. |
| 10 | When NOT to trust | Right after a backfill is enqueued (expected transient spike, not a regression). |

### 9.3 Meta call success rate + BUC headroom

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Share of Meta calls succeeding, and remaining Business-Use-Case rate budget. |
| 2 | Why | Approaching the BUC limit forces backoff, lengthening freshness lag. |
| 3 | Decision | Throttle/backoff scheduling; spread pulls; alert before hard-throttle. |
| 4 | Inputs | HTTP status per call + `X-Business-Use-Case-Usage` headers. |
| 5 | Formula | `success_rate = ok / total`; `headroom = 100 − reported_usage_pct`. |
| 6 | Source / class | Header input = OFFICIAL PLATFORM FACT; aggregate = INTERNAL CALCULATION (DERIVED) · [02] class FETCH→CALC. |
| 7 | Window | Rolling hour, per account. |
| 8 | Min sample | Enough calls to be meaningful; a single 429 is not a trend. |
| 9 | Limitations | Meta's usage accounting is opaque; header semantics can change across versions. |
| 10 | When NOT to trust | **Exact limits/decay = UNKNOWN / verify at build**; treat headroom as directional, not exact. |

### 9.4 Read-API p95 latency

| # | Question | Answer |
|---|---|---|
| 1 | Measures | 95th-percentile response time of dashboard read routes. |
| 2 | Why | Read must be fast because it's pre-computed; a slow read means the read/compute split leaked. |
| 3 | Decision | If p95 rises, investigate a compute creeping onto the read path (a design violation). |
| 4 | Inputs | Per-request timing on `/api/v1/read/*`. |
| 5 | Formula | p95 over the window. |
| 6 | Source / class | INTERNAL CALCULATION (DERIVED) · [02] class CALC. |
| 7 | Window | Rolling. |
| 8 | Min sample | Enough requests for a stable percentile (small-n percentiles are noise). |
| 9 | Limitations | p95 hides the p99 tail a single user actually feels. |
| 10 | When NOT to trust | Low-traffic periods — percentile unstable. **SLO target = UNKNOWN / verify at build.** |

---

## 10. Failure & degradation model

| Failure | Detection | Behaviour (honest-by-default) |
|---|---|---|
| Meta token invalid/expired | Auth Service fail-closed `[per ADR-0002]` | Ingestion jobs fail fast; freshness goes stale; banner shown. Never present stale data as fresh. |
| Meta rate-limit (BUC) | `X-Business-Use-Case-Usage` / 429 | Re-enqueue with backoff (ADR-0003 pacing); don't drop the job; surface headroom (§9.3). |
| Meta restatement of recent days | Trailing re-pull window (N = verify at build) | Overwrite in place (idempotent upsert); flag affected days "restated". |
| Async report never completes | Poll `job_item` exceeds max attempts | Mark failed, alert, keep last good; never fabricate the missing day. |
| Video source unavailable | Asset `download` 404/permission | Skip CV; mark creative "no-fingerprint"; recommendations degrade with reduced confidence, not silent gaps. |
| External source absent (Shopify/CRM/LP) | Connector (§F) has no data | Economics read returns "needs external source" — never a fabricated MER/NCAC/LTV/iROAS ([02] EXTERNAL/INFERENCE). |
| Competitor economics requested | Always | Return UNKNOWN — competitor spend/results are CANNOT-KNOW ([02]); active ad ≠ winning ad. |
| Cron tick misses / queue stalls | Queue-depth + oldest-age (§9.2); stale-item reset `[per ADR-0003]` | Alert; on recovery the durable queue drains in order — no work lost. |
| Compute leaks onto read path | Read p95 rises (§9.4) | Treated as a design regression, not a scaling problem. |

**Never:** auto-write to Meta, auto-pause, auto-budget, fabricate a benchmark to fill a gap, relabel a CALC/INFER value as an OFFICIAL Meta fact, or present stale/degraded/external-missing data without a label.

---

## 11. Open questions — verify at build

| # | Question | Blocking? |
|---|---|---|
| 1 | Graph/Marketing API **version string** at build (part of the idempotency key) | Yes — pin it. |
| 2 | Exact OAuth scopes + user-token vs System-User-token (ADR-0002 owns) | Yes — confirm scopes cover [02]'s fields. |
| 3 | BUC rate-limit points/decay/tier limits | Yes — sets backoff + scheduling. |
| 4 | Attribution windows in use → trailing re-pull window `N` | Yes — sets restatement handling; do not hardcode 28 days. |
| 5 | Video **source-download** permission at $100M/mo asset volume | Yes — determines CV on source vs thumbnails; also native-video vs frame-sampling choice. |
| 6 | Which breakdown combinations [02] sanctions (many mutually exclusive) | Yes — invalid combos hard-fail at Meta. |
| 7 | `hold rate` definition to adopt (p75/3-sec vs 15-sec/3-sec vs thruplay/3-sec — [02] lists 3) | Yes — must be one documented CALC before observe stage. |
| 8 | External connectors (Shopify/CRM/finance/LP/product) — in-scope for MVP or "needs external source" only? | No — Meta-only MVP ships with the honest fallback; connectors are architecture-ready (§F). |
| 9 | Meta **webhooks** for near-real-time change signals | No — polling is the v1 default; capability = UNKNOWN / verify at build. |
| 10 | SLO target values for §9 metrics | No — needed before alerting, not before build. |

---

## Appendix — route index (quick reference)

| Route | Verb | Service | Sync/Async | Dominant [02] class |
|---|---|---|---|---|
| `/api/v1/auth/meta/start` | GET | Auth | sync | — `[per ADR-0002]` |
| `/api/v1/auth/meta/callback` | GET | Auth | sync | — `[per ADR-0002]` |
| `/api/v1/sync/{account_id}/entities` | POST | Ingestion | async (202) | FETCH |
| `/api/v1/sync/{account_id}/insights` | POST | Ingestion | async (202) | FETCH (raw) |
| `/api/v1/sync/{account_id}/assets` | POST | Asset | async (202) | FETCH |
| `/api/v1/vision/{asset_id}/fingerprint` | POST | Vision | async (202) | EXTERNAL/CALC → INFER |
| `/api/v1/vision/{asset_id}/fingerprint` | GET | Vision | sync (read) | EXTERNAL/CALC → INFER |
| `/api/v1/analysis/{account_id}/run` | POST | Analysis | async (202) | CALC → INFERENCE/MODEL EST |
| `/api/v1/analysis/{job_id}` | GET | Analysis | sync (read) | — |
| `/api/v1/jobs/{job_id}` | GET | Queue | sync (read) | — `[per ADR-0003]` |
| `/api/v1/read/{account_id}/overview` | GET | Read | sync (read) | mixed (labelled) |
| `/api/v1/read/{account_id}/entities` | GET | Read | sync (read) | FETCH + CALC |
| `/api/v1/read/{account_id}/creative/{creative_id}` | GET | Read | sync (read) | FETCH + INFER |
| `/api/v1/read/{account_id}/diagnoses` | GET | Read | sync (read) | INFERENCE |
| `/api/v1/read/{account_id}/recommendations` | GET | Read | sync (read) | MODEL ESTIMATE |
| `/api/v1/read/{account_id}/economics` | GET | Read | sync (read) | CALC + EXTERNAL/INFERENCE (labelled "needs external source") |
| `/api/v1/read/{account_id}/freshness` | GET | Read | sync (read) | CALC |

*All `async (202)` routes are queue producers drained by cron `[per ADR-0003]`. No route writes back to Meta. Every field in every read response carries its [02] source class and fact label.*
