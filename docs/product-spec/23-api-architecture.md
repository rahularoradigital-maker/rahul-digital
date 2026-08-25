# 23 — API Architecture

**Artifact:** 23 of 28 · **Program:** AdBrain — AI Meta-Ads Creative + Media Intelligence System
**Owner persona:** Senior Meta media buyer + creative strategist + data scientist at $100M/mo scale
**System question this serves:** *"What should we do next?"* — not *"how did ads perform?"*
**Status:** DRAFT — reconcile at build (see [§0 Cross-references](#0-cross-references-read-first))

---

## 0. Cross-references (read first)

This artifact defines the **route/service surface** — the API contract layer that sits between Meta's Graph/Marketing API, our stores, the analysis pipeline, and the dashboards. It is the *plumbing spec*, not the metric spec.

| Depends on | For | Reconciliation checkpoint |
|---|---|---|
| `02-meta-data-mapping.md` | Which fields are FETCH / CALC / INFER / EXTERNAL / CANNOT-KNOW; the exact Meta endpoints + fields we may pull | Every ingestion route below cites a data class. At build, diff this file's endpoint list against artifact 02's canonical field map; artifact 02 wins on any field-level disagreement. |
| `ADR-0002` (token strategy) | How OAuth tokens are obtained, stored, encrypted, refreshed, and scoped | This artifact **references** ADR-0002 and MUST NOT restate token lifetimes or storage crypto. Where it names token behaviour it is a pointer, tagged `[per ADR-0002]`. |
| `ADR-0003` (cron-drained job queue) | The async execution model: no always-on workers; a cron tick drains a durable queue | Every long-running route below (sync, video download, CV fingerprint, analysis) is a **queue producer**, not an inline handler. This artifact MUST NOT introduce a competing worker model. |
| `brief.md` (10-question discipline) | The metric contract | Applied in [§9](#9-operational-metrics-the-only-metrics-this-artifact-owns) to the *operational* metrics this layer emits. Marketing metrics are owned by their own artifacts. |

> **Honesty note (build gate):** At the time this artifact was written, the three foundation files above were not co-present in the tree. Endpoint names and Meta field names below are labelled with their fact class; anything version- or quota-specific is marked **UNKNOWN / verify at build**. Do not treat any Meta quota, version string, or webhook capability here as settled until reconciled against artifact 02 and a live Graph API version check.

---

## 1. Design principles

1. **Read/write split.** Ingestion + pipeline **write** to stores. Dashboards **only read** from pre-computed read models. No dashboard ever calls Meta directly, and no dashboard triggers a compute on the request path.
2. **Everything slow is a job.** Any call that touches Meta, downloads a video, runs CV, or runs the analysis pipeline is enqueued and drained by the cron tick `[per ADR-0003]`. HTTP handlers return a `job_id` + `202 Accepted`, never block.
3. **Idempotent by (entity, day, version).** Every ingested row is keyed so a re-run overwrites rather than duplicates. Day-wise (`time_increment=1`) is the atomic grain for insights.
4. **Fact-class travels with the data.** Every field carries its provenance (`OFFICIAL_PLATFORM_FACT`, `INTERNAL_CALCULATION`, `RESEARCH_BACKED`, `INDUSTRY_BENCHMARK`, `MODEL_ESTIMATE`, `INFERENCE`, `UNKNOWN`) from ingestion through read API, so the dashboard can render the label without re-deriving it.
5. **The pipeline is a DAG of stages, not a monolith.** `observe → diagnose → predict → recommend`. Each stage is independently enqueueable, retryable, and inspectable. A failed `predict` never blocks a fresh `observe`.
6. **Recommendations are proposals, never actions.** No route in this system writes back to Meta (no budget changes, no pausing, no ad creation). AdBrain answers "what should we do next?"; a human executes. This is a hard boundary, not a v1 limitation.

---

## 2. Service map (bounded contexts)

```
                    ┌────────────────────────────────────────────────┐
   Meta Graph /     │                 AdBrain backend                 │
   Marketing API ──▶│                                                 │
                    │  (A) Ingestion Service   ── writes ─▶ raw store │
                    │  (B) Asset Service       ── writes ─▶ blob+meta │
                    │  (C) Vision Service      ── writes ─▶ fp store  │
                    │  (D) Analysis Pipeline   ── writes ─▶ read models
                    │  (E) Read/Query API      ── reads  ─▶ dashboards│
                    │  (X) Auth/OAuth Service  ── [per ADR-0002]      │
                    │  (Q) Job Queue + Cron    ── [per ADR-0003]      │
                    └────────────────────────────────────────────────┘
                                    │  202 + job_id
                                    ▼
                            Dashboards (read-only)
```

| # | Service | Responsibility | Talks to Meta? | Queue role |
|---|---|---|---|---|
| A | **Ingestion** | OAuth-scoped insights sync, day-wise; entity metadata (account/campaign/adset/ad/creative) | Yes | Producer + consumer |
| B | **Asset** | Pull creative assets (image hashes, video sources, thumbnails, ad copy, story specs) | Yes | Producer + consumer |
| C | **Vision** | Computer-vision fingerprinting of creatives (perceptual hash, scene/shot, text-overlay, brand-safe checks) | No (reads blobs) | Consumer |
| D | **Analysis** | `observe → diagnose → predict → recommend` over the read-ready facts | No | Consumer (chained) |
| E | **Read/Query** | Serves dashboards from pre-computed read models; no compute, no Meta | No | Neither |
| X | **Auth/OAuth** | Token grant, storage, refresh, scope enforcement | Yes (token exchange) | — `[per ADR-0002]` |
| Q | **Queue+Cron** | Durable job table drained on cron tick | — | Infrastructure `[per ADR-0003]` |

---

## 3. Conventions (all routes)

| Concern | Convention |
|---|---|
| Base path | `/api/v1` — the version prefix is our contract version, independent of Meta's Graph API version. |
| Auth (inbound) | Session/service token on every route. OAuth-to-Meta is internal only; dashboards never see a Meta token. `[per ADR-0002]` |
| Long jobs | Return `202 Accepted` + `{ job_id, status_url }`. Poll `GET /api/v1/jobs/{job_id}`. No long-polling, no websockets in v1. |
| Idempotency | Mutating ingestion routes accept `Idempotency-Key`; dedup key is `(account_id, entity_id, day, meta_api_version)`. |
| Pagination (read) | Cursor-based: `?cursor=&limit=` (default 100, max 500). |
| Errors | RFC-9457 problem+json: `{ type, title, status, detail, instance }`. Meta errors are wrapped, never leaked raw (they can contain token fragments). |
| Time | All timestamps UTC ISO-8601. Meta "day" honours the **ad account timezone** — stored explicitly per row to avoid off-by-one aggregation. |
| Fact class | Every data field in a response carries a sibling `_class` (see §1.4). |

---

## 4. (X) Auth / OAuth — reference only

Token acquisition, storage crypto, refresh cadence, and scope minimisation are **owned by ADR-0002**. This artifact only records the *touch-points* the API surface needs.

| Route / hook | Purpose | Notes |
|---|---|---|
| `GET  /api/v1/auth/meta/start` | Begin Meta OAuth (redirect to Meta dialog) | Scopes requested are the minimum for ads read: `ads_read`, plus `business_management` if managing on behalf of a business. **Scope list = UNKNOWN / verify at build** against artifact 02's field needs. |
| `GET  /api/v1/auth/meta/callback` | OAuth redirect handler; exchanges code → token | Hands token to Auth Service for storage `[per ADR-0002]`. Never returns the token to the browser. |
| internal `AuthService.getToken(account_id)` | Supplies a valid token to Ingestion/Asset services | Refresh/expiry handling is ADR-0002's job; callers treat it as "give me a working token or fail closed". |

**Fact:** Meta uses OAuth 2.0 with the Graph API. `[OFFICIAL PLATFORM FACT]`
**UNKNOWN / verify at build:** exact long-lived token lifetime, refresh mechanics, and whether System User tokens (non-expiring, business-scoped) are used instead of user tokens — that decision lives in ADR-0002.

---

## 5. (A) Ingestion Service — Meta insights + entity sync

**Goal:** land day-wise (`time_increment=1`) performance facts and the entity tree, idempotently, without ever blocking a request.

### 5.1 Entity tree sync (account → campaign → adset → ad → creative)

| Route | Method | Behaviour |
|---|---|---|
| `/api/v1/sync/{account_id}/entities` | POST | Enqueues a full entity-tree crawl. `202 + job_id`. |
| Meta calls made (by the job) | — | `GET /act_{account_id}/campaigns`, `/adsets`, `/ads`, `/adcreatives` with `fields=` limited to what artifact 02 whitelists. `[OFFICIAL PLATFORM FACT: these edges exist]` |

**Level:** account / campaign / adset / ad / creative. **Data class:** FETCH (all entity metadata is directly returned by Meta).

### 5.2 Insights sync (day-wise) — the core pull

| Route | Method | Behaviour |
|---|---|---|
| `/api/v1/sync/{account_id}/insights` | POST | Body: `{ since, until, level, breakdowns[] }`. Enqueues a day-wise insights job. `202 + job_id`. |

**How the job pulls (fact-labelled):**

| Element | Value | Fact class |
|---|---|---|
| Endpoint | `GET /act_{account_id}/insights` (and per-entity `/{campaign_id}/insights`, etc.) | OFFICIAL PLATFORM FACT — endpoint exists |
| Day grain | `time_increment=1` → one row per entity per day | OFFICIAL PLATFORM FACT |
| Level | `level=account\|campaign\|adset\|ad` | OFFICIAL PLATFORM FACT |
| Breakdowns | `breakdowns=` (e.g. `publisher_platform`, `platform_position`, `age`, `gender`, `country`) | OFFICIAL PLATFORM FACT — but valid combinations are constrained and **which combos we use = verify against artifact 02** |
| Attribution | `action_attribution_windows=` (e.g. `7d_click`, `1d_view`) | OFFICIAL PLATFORM FACT — default windows and availability **UNKNOWN / verify at build** |
| Large pulls | `run_async=true` → `report_run_id` → poll run status → fetch results page | OFFICIAL PLATFORM FACT — async report pattern exists |

**Async-report handling matches ADR-0003:** the sync job does **not** busy-wait on Meta's `report_run_id`. It submits the async report, records the `report_run_id` on the job row, and **re-enqueues a "poll" job**. The next cron tick checks completion (`async_status` / `async_percent_completion`) and either re-enqueues another poll or moves to result-fetch. This keeps every unit of work short and cron-drainable rather than holding a worker open. `[reconciles ADR-0003]`

**Idempotency / backfill:** dedup key `(account_id, entity_id, day, breakdown_signature, meta_api_version)`. Re-running a date range overwrites in place. Meta may **restate** recent days (attribution maturation), so the scheduler re-pulls a trailing window (e.g. last N days) on each daily tick — **N = UNKNOWN / verify at build** (depends on the attribution windows in use; do not hardcode "28 days" as fact).

**Rate limiting:** Marketing API applies Business-Use-Case (BUC) rate limiting; usage is reported in response headers (`X-Business-Use-Case-Usage` and related). `[OFFICIAL PLATFORM FACT: header-based BUC throttling exists]`. Exact points-per-call, decay, and account-tier limits = **UNKNOWN / verify at build**. Ingestion jobs read these headers and, on approaching the limit, **re-enqueue with backoff** rather than hard-failing — again cron-friendly.

### 5.3 What ingestion writes

Raw insights rows + entity metadata land in the **raw store**, each tagged `_class = OFFICIAL_PLATFORM_FACT` (it came straight from Meta). Derived metrics are **not** computed here — that is the pipeline's job (§7), which tags them `INTERNAL_CALCULATION (DERIVED)`. Ingestion never mislabels a derived value as a Meta field (brief rule 3).

---

## 6. (B) Asset Service + (C) Vision Service — creative pipeline

### 6.1 Asset Service (pull the raw creative)

| Route | Method | Behaviour |
|---|---|---|
| `/api/v1/sync/{account_id}/assets` | POST | Enqueues asset pull for new/changed creatives. `202 + job_id`. |

**Meta calls (fact-labelled):**

| Asset | How obtained | Fact class |
|---|---|---|
| Ad copy / story spec | `adcreatives{object_story_spec, body, title, call_to_action_type, ...}` | OFFICIAL PLATFORM FACT — fields exist |
| Image | `object_story_spec` image / `image_hash` → `/act_{account_id}/adimages` | OFFICIAL PLATFORM FACT |
| Video source | `video_id` → `GET /{video_id}` (source + `thumbnails`) | OFFICIAL PLATFORM FACT — access subject to permissions; **availability of source download = verify at build** |
| Thumbnail | creative `thumbnail_url` / video thumbnails | OFFICIAL PLATFORM FACT |

**Video pipeline stages** (each a separate queue step so no single job runs long):
1. `resolve` — map ad → creative → `video_id` / `image_hash`.
2. `download` — fetch the media blob to our blob store. **Downloading media is a queued job; the API never streams a video inline.** (Aligns with the platform rule that file downloads are deliberate, size-bounded operations.)
3. `normalize` — transcode/sample to frames + audio track for CV (e.g. keyframe extraction).
4. `handoff` — enqueue a Vision job pointing at the normalized artifacts.

**Data class:** FETCH for the raw asset + metadata; the *derived* creative attributes come from Vision (§6.2) and are INFER.

### 6.2 Vision Service (CV fingerprinting)

Runs **only on our blobs** — never calls Meta. Consumer-only in the queue.

| Route | Method | Behaviour |
|---|---|---|
| `/api/v1/vision/{asset_id}/fingerprint` | POST | Enqueues CV fingerprinting for one asset. `202 + job_id`. |
| `/api/v1/vision/{asset_id}/fingerprint` | GET | Read the stored fingerprint (served from fp store, no recompute). |

**What the fingerprint records (all `_class = INFERENCE` or `MODEL_ESTIMATE` — model output, never a Meta fact):**

| Fingerprint field | What | Fact class |
|---|---|---|
| Perceptual hash (pHash / video hash) | Near-duplicate creative detection ("we've run this before") | INTERNAL_CALCULATION (deterministic hash) |
| Scene / shot segmentation | Pacing, hook length, first-3s content | MODEL_ESTIMATE |
| On-screen text / OCR | Text-overlay density, claims, CTA-in-frame | MODEL_ESTIMATE |
| Format / aspect / has-face / logo presence | Creative-attribute tagging for clustering | INFERENCE |
| Audio: music vs voiceover vs silent | Sound-on/off dependency | INFERENCE |
| Brand-safety / policy-risk flags | Pre-flag likely disapprovals | MODEL_ESTIMATE — advisory only |

**Decision each fingerprint field must serve** (or it is cut per brief rule 1): near-dup hash → *"is this a genuinely new creative or a re-upload?"*; hook segmentation → *"is the drop-off a hook problem?"*; text density → *"is the creative over-crowded for the placement?"*. Fingerprint fields that serve no diagnosis get marked **advanced/vanity — not primary**.

---

## 7. (D) Analysis Pipeline — observe → diagnose → predict → recommend

A **DAG of queued stages**. Each stage reads its inputs from a store, writes its outputs to a store, and enqueues the next stage. No stage is on any HTTP request path. This is where the system earns "what should we do next?".

```
observe ──▶ diagnose ──▶ predict ──▶ recommend ──▶ read models
   │           │            │            │
 facts     drivers      forecasts     proposals
(DERIVED)  (INFERENCE)  (MODEL_EST)  (MODEL_EST)
```

| Route | Method | Behaviour |
|---|---|---|
| `/api/v1/analysis/{account_id}/run` | POST | Enqueues the full DAG (or `?from=predict` to resume). `202 + job_id`. |
| `/api/v1/analysis/{job_id}` | GET | Stage-by-stage status + which stage produced what. |

| Stage | Reads | Produces | Output fact class | Decision it exists to drive |
|---|---|---|---|---|
| **observe** | raw insights (FETCH) + fingerprints | derived metrics (CTR, CPA, ROAS, frequency trend, etc.) computed our way | INTERNAL_CALCULATION (DERIVED) | "What actually changed?" — the honest baseline |
| **diagnose** | observe output | driver attribution (fatigue? audience? placement? creative?) | INFERENCE | "*Why* did it change?" — the root cause, not the symptom |
| **predict** | observe + diagnose | short-horizon forecasts + saturation/decay curves | MODEL_ESTIMATE | "What happens if we do nothing?" |
| **recommend** | all above | ranked, human-executable proposals w/ expected effect + confidence | MODEL_ESTIMATE | "What should we do next?" — the product's reason to exist |

**Hard rules baked into this stage:**
- `recommend` output is **DRAFT PROPOSALS ONLY**. No route pushes a change to Meta. Every proposal carries: the action, the entity + level, the expected effect (labelled MODEL_ESTIMATE), a confidence, the sample size behind it, and the reason. A proposal with insufficient sample is emitted as *"insufficient data — do not act"*, never silently dropped.
- Every derived number is labelled DERIVED and is **reproducible from stored inputs** — the read API can expose "show the maths" for any recommendation.
- No fabricated benchmark. Where a proposal needs a comparison threshold and none is verified, it is emitted as **UNKNOWN / verify at build**, not an invented number (brief rule 5).

---

## 8. (E) Read / Query API — dashboards

Dashboards read **only** here. Every response is served from a pre-computed read model; **zero** compute, **zero** Meta calls, **zero** queue writes on the read path.

| Route | Serves | Level |
|---|---|---|
| `GET /api/v1/read/{account_id}/overview` | Account health snapshot + freshness banner | account |
| `GET /api/v1/read/{account_id}/entities?level=&cursor=` | Entity tree with rolled-up derived metrics | campaign/adset/ad |
| `GET /api/v1/read/{account_id}/creative/{creative_id}` | Creative card: metrics + CV fingerprint + near-dup siblings | creative |
| `GET /api/v1/read/{account_id}/diagnoses` | Ranked "why" cards | adset/ad |
| `GET /api/v1/read/{account_id}/recommendations` | Ranked next-action proposals (DRAFT) | any |
| `GET /api/v1/read/{account_id}/freshness` | Per-source last-successful-sync + staleness | account |

**Freshness is first-class.** Because ingestion is async and can silently degrade (expired token, rate-limit backoff, Meta restatement), every read response includes a `freshness` block: `{ source, last_success_at, is_stale, reason }`. A stale read is **labelled**, never hidden — the dashboard shows a staleness banner rather than presenting old numbers as current. (Same failure-honesty principle the Growth OS learned the hard way with silent skips.)

Every metric field in a read response carries its `_class` label so the UI renders "OFFICIAL PLATFORM FACT" vs "DERIVED" vs "MODEL ESTIMATE" without re-deriving.

---

## 9. Operational metrics (the only metrics this artifact owns)

Marketing metrics (CTR, ROAS, CPA, fatigue, etc.) belong to their own artifacts. This layer owns **operational** metrics. Each below passes the brief's 10-question gate; any that changed no decision would be marked *advanced/vanity — not primary*.

### 9.1 Sync freshness lag

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Time between the latest Meta "day" that should be present and what we've actually landed. |
| 2 | Why it matters | Stale facts silently corrupt every downstream recommendation. |
| 3 | Decision it drives | Show/hide the staleness banner; block `recommend` from running on stale data; page on-call if lag breaches SLO. |
| 4 | Inputs | `now`, `last_success_at` per source, account timezone. |
| 5 | Formula | `lag = now − last_success_at` (per source, tz-aware). |
| 6 | Source | INTERNAL_CALCULATION (DERIVED) from job records. |
| 7 | Comparison window | Rolling; vs the SLO target. |
| 8 | Min sample | 1 sync record (n/a — it's an event). |
| 9 | Limitations | A "fresh" sync of *wrong* data still reads fresh; freshness ≠ correctness. |
| 10 | When NOT to trust | During a known Meta outage or restatement window — freshness looks bad but is a Meta-side artifact. **SLO target value = UNKNOWN / verify at build.** |

### 9.2 Queue depth / oldest-unstarted-job age

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Backlog in the cron-drained queue and age of the oldest waiting job. |
| 2 | Why it matters | A growing backlog means the cron tick can't keep up; freshness will degrade next. |
| 3 | Decision it drives | Increase tick frequency / batch size `[within ADR-0003]`; shed or reprioritise job classes. |
| 4 | Inputs | Job table: `enqueued_at`, `started_at`, `status`. |
| 5 | Formula | `depth = count(status=queued)`; `oldest_age = now − min(enqueued_at where queued)`. |
| 6 | Source | INTERNAL_CALCULATION (DERIVED). |
| 7 | Window | Per tick + rolling. |
| 8 | Min sample | n/a (census). |
| 9 | Limitations | Depth alone hides class mix — one stuck video download ≠ 100 quick reads. |
| 10 | When NOT to trust | Right after a backfill is enqueued (expected transient spike, not a regression). |

### 9.3 Meta call success rate + BUC headroom

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Share of Meta calls succeeding, and remaining Business-Use-Case rate budget. |
| 2 | Why it matters | Approaching the BUC limit forces backoff, which lengthens freshness lag. |
| 3 | Decision it drives | Throttle/backoff scheduling; spread pulls; alert before hard-throttle. |
| 4 | Inputs | HTTP status per call + `X-Business-Use-Case-Usage` headers. |
| 5 | Formula | `success_rate = ok / total`; `headroom = 100 − reported_usage_pct`. |
| 6 | Source | OFFICIAL PLATFORM FACT (headers) → INTERNAL_CALCULATION (aggregate). |
| 7 | Window | Rolling hour + per account. |
| 8 | Min sample | Enough calls to be meaningful; a single 429 is not a trend. |
| 9 | Limitations | Meta's usage accounting is opaque; header semantics can change. |
| 10 | When NOT to trust | **Exact limits/decay = UNKNOWN / verify at build**; treat headroom as directional, not exact. |

### 9.4 Read-API p95 latency

| # | Question | Answer |
|---|---|---|
| 1 | Measures | 95th-percentile response time of dashboard read routes. |
| 2 | Why it matters | Read must be fast because it's pre-computed; a slow read means the read/compute split leaked. |
| 3 | Decision it drives | If p95 rises, investigate a compute creeping onto the read path (a design violation). |
| 4 | Inputs | Per-request timing on `/api/v1/read/*`. |
| 5 | Formula | p95 over the window. |
| 6 | Source | INTERNAL_CALCULATION (DERIVED). |
| 7 | Window | Rolling. |
| 8 | Min sample | Enough requests for a stable percentile (small-n percentiles are noise). |
| 9 | Limitations | p95 hides the tail (p99) that a single user actually feels. |
| 10 | When NOT to trust | Low-traffic periods — percentile is unstable. **SLO target = UNKNOWN / verify at build.** |

---

## 10. Failure & degradation model

| Failure | Detection | Behaviour (honest-by-default) |
|---|---|---|
| Meta token invalid/expired | Auth Service fail-closed `[per ADR-0002]` | Ingestion jobs fail fast; freshness goes stale; banner shown. No stale data presented as fresh. |
| Meta rate-limit (BUC) | Response headers / 429 | Re-enqueue with backoff; do not drop the job; surface headroom metric (§9.3). |
| Meta restatement of recent days | Trailing re-pull window | Overwrite in place (idempotent); flag affected days as "restated". |
| Async report never completes | Poll job exceeds max attempts | Mark failed, alert, keep last good; never fabricate the missing day. |
| Video source unavailable | Asset `download` step 404/permission | Skip CV for that asset; mark creative "no-fingerprint"; recommendation engine degrades gracefully, labelling reduced confidence. |
| Cron tick misses / queue stalls | Queue-depth + oldest-age metrics (§9.2) | Alert; on recovery the durable queue drains in order — no work lost `[per ADR-0003]`. |
| Compute leaks onto read path | Read p95 rises (§9.4) | Treated as a design regression, not a scaling problem. |

**Never:** auto-write to Meta, auto-pause, auto-budget, fabricate a benchmark to fill a gap, or present stale/degraded data without a label.

---

## 11. Open questions — verify at build

| # | Question | Blocking? |
|---|---|---|
| 1 | Graph/Marketing API **version string** in use as of build date | Yes — pin it; it's part of the idempotency key. |
| 2 | Exact OAuth scopes + user-token vs System-User-token decision | Yes — ADR-0002 owns; confirm scope list covers artifact 02's fields. |
| 3 | BUC rate-limit points/decay/tier limits | Yes — sets backoff + scheduling. |
| 4 | Attribution windows in use → trailing re-pull window `N` | Yes — sets restatement handling. |
| 5 | Video **source-download** permission at $100M/mo asset volume | Yes — determines whether CV runs on source or thumbnails only. |
| 6 | Which breakdown combinations artifact 02 sanctions (many are mutually exclusive) | Yes — invalid combos hard-fail at Meta. |
| 7 | Meta **webhooks** for near-real-time change signals — supported for our use? | No — polling is the v1 default; webhooks are an optimisation. Capability = UNKNOWN / verify at build. |
| 8 | SLO target values for §9 metrics | No — needed before alerting, not before build. |

---

## Appendix — route index (quick reference)

| Route | Verb | Service | Sync/Async |
|---|---|---|---|
| `/api/v1/auth/meta/start` | GET | Auth | sync |
| `/api/v1/auth/meta/callback` | GET | Auth | sync |
| `/api/v1/sync/{account_id}/entities` | POST | Ingestion | async (202) |
| `/api/v1/sync/{account_id}/insights` | POST | Ingestion | async (202) |
| `/api/v1/sync/{account_id}/assets` | POST | Asset | async (202) |
| `/api/v1/vision/{asset_id}/fingerprint` | POST | Vision | async (202) |
| `/api/v1/vision/{asset_id}/fingerprint` | GET | Vision | sync (read) |
| `/api/v1/analysis/{account_id}/run` | POST | Analysis | async (202) |
| `/api/v1/analysis/{job_id}` | GET | Analysis | sync (read) |
| `/api/v1/jobs/{job_id}` | GET | Queue | sync (read) |
| `/api/v1/read/{account_id}/overview` | GET | Read | sync (read) |
| `/api/v1/read/{account_id}/entities` | GET | Read | sync (read) |
| `/api/v1/read/{account_id}/creative/{creative_id}` | GET | Read | sync (read) |
| `/api/v1/read/{account_id}/diagnoses` | GET | Read | sync (read) |
| `/api/v1/read/{account_id}/recommendations` | GET | Read | sync (read) |
| `/api/v1/read/{account_id}/freshness` | GET | Read | sync (read) |

*All `async (202)` routes are queue producers drained by cron `[per ADR-0003]`. No route writes back to Meta.*
