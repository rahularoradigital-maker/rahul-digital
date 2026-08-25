# [05] Creative Fingerprint Spec

**Owner persona:** Principal creative strategist + CV/data scientist thinking at $100M/mo Meta spend.

The **fingerprint** is the standardized, per-creative representation that turns a raw ad asset (image,
video, copy, transcript, landing page) into a fixed set of **semantic labels** + **numeric embeddings**,
computed **once per creative content** and reused forever. It is the substrate 04/06/07/08/12/13 read;
it is **not** a performance metric (performance lives in [01b] G) and **never** an official Meta fact.

The brief's fingerprint =
**PERSONA + PROBLEM + DESIRE + HOOK + ANGLE + FORMAT + VISUAL + SPEAKER + PRODUCT + OFFER + LANDING PAGE**,
plus **8 embedding kinds** (visual / text / audio / scene / hook / concept / persona / angle).

## Read-first / consistency contract
- **Field-level class** is owned by [02] Meta Data Mapping (`FETCH / CALC / INFER / EXTERNAL / CANNOT-KNOW`).
  Fingerprint labels are **INFER**; transcript is **EXTERNAL/CALC**; hashes are **CALC**; embeddings are
  **CALC (deterministic model output)** whose *interpretation* is a MODEL ESTIMATE (see §6). Nothing here
  is `FETCH`/OFFICIAL.
- **Storage** is owned by [24] §5 (`creative_fingerprint`, `creative_embedding`, keyed by `content_hash`,
  unique on `(creative_id, model_version)`). This spec does **not** redefine the schema; it defines *what
  goes in each field, how it is extracted, and the decisions it drives.*
- **Pipeline** is owned by [23] §6 (Media job → Vision service, `POST/GET /vision/{asset_id}/fingerprint`,
  cron-drained, one stage per `job_item`).
- **Metric definitions** (hook rate, hold rate, retention curve) are owned by [01b] G / [01a] B — referenced,
  never re-derived here. The fingerprint stores *content* attributes (what the creative IS); performance
  metrics stay in the dictionary (how it PERFORMED).

## Non-negotiables applied here
1. **Decision gate:** every dimension, embedding, and derived score below names the decision it drives, or is
   cut to `advanced/vanity — not primary`.
2. **Full discipline** on every derived score (§7): definition · inputs · formula · weights + reason ·
   source + class · level · window · min sample · confidence · limitations · when NOT to trust.
3. **Fact labels** on every value (§6). A label is INFERENCE with its own `_conf`; a forecast (e.g.
   "looks like a winner") is a MODEL ESTIMATE, never a fact.
4. **Never fabricate** a similarity/near-dup/novelty threshold. Every cut-point below is `calibrate at build`
   until validated against labeled data. `active != winning`; `insufficient data != waste`;
   **`similar != redundant`** and **`no-fingerprint != low-diversity`** (a missing fingerprint is a data gap,
   not a finding).

---

## 1. What the fingerprint is for (the decisions it exists to serve)

A fingerprint is worthless unless something downstream decides differently because of it. Every consumer:

| Consumer | Reads | The decision the fingerprint enables |
|---|---|---|
| [06] Diversity / Concentration / Redundancy / White-Space | labels + embeddings | "Are we running 40 ads or 3 ideas 40 times?" → produce net-new concepts vs iterate. |
| [13] White-Space | embeddings (novelty distance) + labels | "Which persona×hook×angle×format combos are unoccupied?" → what to brief next. |
| [04] Creative Attribute Dictionary | `attributes_json` | Standard vocabulary + the extraction contract 04 formalises (05 is 04's foundation). |
| [07] Fatigue | fingerprint continuity via `content_hash` | Fatigue on the *idea*, not the churny Meta creative id (re-upload keeps its history). |
| [11] Scaling / Winners | labels + similarity | "Find lookalikes of this winner to scale/brief"; "de-dupe the test cell so we're not A/B-ing the same idea." |
| [08] Forecasting | labels as features | Concept-level priors for fatigue/performance forecasts (MODEL ESTIMATE features, never fact). |
| [12] Competitive | same schema on competitor creatives | Map our universe vs theirs on one shared coordinate system. |

If a proposed field feeds none of these, it does not enter the primary fingerprint.

---

## 2. The 11 semantic dimensions

Each dimension is one label + one confidence (`*_conf`) in `creative_fingerprint` ([24] §5). All are
**INFER → INFERENCE** unless noted. "Extraction" names the primary evidence Gemini uses. "When NOT to
trust" is the honest failure mode. A dimension that cannot be grounded is written **NULL**, never guessed
(a guessed label silently corrupts diversity/white-space).

| # | Dim (schema field) | Definition (what it captures) | Primary evidence | Decision it drives | When NOT to trust the label |
|---|---|---|---|---|---|
| 1 | `persona` | Who the creative speaks to (audience self-image / segment), not Meta targeting. | Transcript address ("you moms…"), on-screen casting, copy. | Persona coverage & white-space [06][13]; persona-fatigue [07]. | Generic/aspirational creative with no clear addressee → low `persona_conf`. |
| 2 | `problem` | The pain/tension the ad names. | Hook + transcript first 1/3/5s, copy. | Problem-diversity; message-match to LP promise (§ landing). | Pure brand/vibe ads with no stated problem. |
| 3 | `desire` | The wanted end-state / benefit promised. | Transcript, copy, offer framing. | Desire coverage; pairs with problem for angle logic. | Feature-dump ads with no benefit articulated. |
| 4 | `hook` | The opening device (first ~3s): pattern-interrupt, question, stat, demo, callout. | First-3s frames + transcript + on-screen text. | Low hook **rate** (G1, [01b]) → rework *this* hook type; hook-diversity [06]. | Static creatives (no temporal hook) → mark format-appropriate NULL; slates/logos before content. |
| 5 | `angle` | The persuasion strategy (social proof, fear, authority, price, novelty, transformation…). | Whole-transcript + narrative arc. | Angle white-space [13]; angle-fatigue; briefing net-new angles. | Multi-angle ads (pick dominant, lower conf); ambiguous edits. |
| 6 | `format` | Structural type (UGC talking-head, static, carousel, product demo, listicle, reaction, split-screen…). | Scene/shot structure + media metadata. | Format concentration [06]; format×persona coverage. | DCO/dynamic-creative that renders many formats (see §8 edge cases). |
| 7 | `visual_style` | Aesthetic register (raw UGC, studio, motion-graphic, meme, lifestyle…). | Frame CV (lighting, grade, motion). | Visual redundancy [06]; "everything looks the same" concentration. | Mixed-cut videos; heavy templating that flattens style. |
| 8 | `speaker` | Who delivers it (founder, creator/UGC, actor, voiceover-only, none). | Face/voice detection + transcript. | Speaker diversity; creator-dependence risk (over-concentration on one face). | Voiceover-only vs on-camera ambiguity; multi-speaker. |
| 9 | `product` | Which SKU/product line is featured. | OCR, product recognition, copy, LP. | Product creative coverage/gaps (brief §LP+product); which SKUs are under-served. | Bundles/multi-product; brand-level ads with no SKU. |
| 10 | `offer` | The deal/CTA proposition (%, BOGO, free-ship, bundle, none, subscribe). | On-screen text/OCR, transcript, copy, LP. | Offer diversity; offer×fatigue; margin-risk flag (heavy-discount concentration). | Implicit/absent offers; time-boxed offers now stale on the LP. |
| 11 | `landing` | Where the click goes + message-match to the promise. | LP crawl (EXTERNAL) + creative promise. | Good-creative/bad-LP detection (brief §LP); continuity break routes fix to LP not creative. | LP behind login/geo/paywall; LP changed after crawl; redirect chains. |

> **Dimension-level rule:** labels come from a **controlled vocabulary per dimension** (defined & versioned
> in [04]). Free-text drifts and breaks clustering. Until [04] locks the taxonomy, the vocabulary is
> `calibrate at build`; the fingerprint stores the raw label + a `taxonomy_version`.

**`landing` is the one EXTERNAL dimension:** it needs the LP crawler ([02] "landing page content, message-match
= EXTERNAL"). With no crawl it is NULL + a `needs external source` flag, never inferred from the creative alone.

---

## 3. Video-intelligence fields (temporal, video only)

Stored on `creative_fingerprint` ([24] §5). These describe *content*, not performance; the performance
counterparts (hook rate G1, hold rate G2, retention curve G3) live in [01b] and read these for the
"*where* to fix" answer.

| Field (schema) | What | Extraction | Class / Fact | Decision it drives |
|---|---|---|---|---|
| `transcript` | Full VO/dialogue/on-screen text with rough timestamps. | Gemini native video **or** transcription service ([02]). | EXTERNAL/CALC · text is *extracted*, not asserted | Grounds hook/angle/problem/desire; claim extraction; message-match. |
| `first_3s_summary` | What happens in the first ~3s (the hook window). | Gemini on first-3s frames + transcript. | MODEL ESTIMATE | Pairs with hook **rate** (G1): low rate + weak first-3s → rework opener. |
| `scene_count` | Number of shots/scene cuts. | Scene/shot segmentation (CV). | MODEL ESTIMATE | Pacing proxy; recut guidance with retention curve (G3). |
| `pacing_score` | Cut rate / motion tempo (normalised). | Derived from scene timing. | MODEL ESTIMATE | "Too slow before the hook lands" edits; format clustering. |
| `attributes_json` | Full extracted attribute set (has-face, logo, OCR text density, aspect, duration, captions-on, music-yes/no, dominant colors…). | CV + OCR ([23] §6.2). | EXTERNAL/CALC → INFER per key | The raw bag [04] formalises; secondary clustering features. |

**Static / carousel creatives:** temporal fields (`first_3s_summary`, `scene_count`, `pacing_score`, hook-as-
opening-device) are **N/A → NULL**, not zero. A NULL here means "not applicable to this format," distinct from
"extraction failed" (tracked separately, §8). Static creatives still get dims 1-3, 5-11 + text/visual embeddings.

---

## 4. Content hashes (identity & near-dup)

| Field (schema) | What | Class / Fact | Decision it drives |
|---|---|---|---|
| `content_hash` | Hash of the actual asset bytes (+ normalised copy). Ties the fingerprint to **content, not to the Meta creative id**. | CALC · INTERNAL CALCULATION | **Fingerprint-once** dedupe + fatigue continuity across re-uploads (a re-uploaded asset gets a new Meta id but the same `content_hash` → keep its history [07], skip re-analysis). |
| `phash` | Perceptual hash (image). Robust to re-encode/crop/minor edits. | CALC · INTERNAL CALCULATION | Near-dup detection (§7 Near-Dup Score): "genuinely new or a tweak of an existing ad?" |
| `video_hash` | Perceptual/temporal hash (video). | CALC · INTERNAL CALCULATION | Near-dup for video variants. |

`content_hash` is **exact** (identity); `phash`/`video_hash` are **fuzzy** (similarity). Both are deterministic
→ INTERNAL CALCULATION, the only near-fact-grade fields in the fingerprint.

---

## 5. The 8 embeddings

One row per `(creative_id, kind, model)` in `creative_embedding` ([24] §5). `kind ∈ {visual, text, audio,
scene, hook, concept, persona, angle}`. Each embedding **vector is deterministic** given (asset, model) →
**INTERNAL CALCULATION**; any *claim derived from cosine distance* (similar / novel / redundant) is a
**MODEL ESTIMATE** (§6). Dims are per-kind fixed and set at build (`dim` column); ANN index per kind.

| Kind | Built from | Decision it drives | Notes / when absent |
|---|---|---|---|
| `visual` | Sampled frames / image (image model). | Visual redundancy & white-space [06][13]; winner-lookalike scaling [11]. | Static→image; video→pooled frames. |
| `text` | Copy + transcript + OCR (text model). | Message/claim clustering; text-side white-space. | Always available if any text exists. |
| `audio` | Audio track (music/VO characteristics). | Audio-style clustering; VO-vs-music diversity. | NULL for silent/static. |
| `scene` | Shot/scene sequence structure. | Structural-format clustering beyond the coarse `format` label. | Video only. |
| `hook` | First-3s frames + transcript. | Hook-type clustering; "have we tried this opener before?" | Video only. |
| `concept` | Fused multimodal (the "big idea"). | The primary **concept diversity** signal [06] — the truest "are these the same idea?" | Preferred blend anchor (§7). |
| `persona` | Persona-salient signals (casting, address). | Persona-space coverage/white-space. | Mirrors dim 1 in vector space. |
| `angle` | Angle-salient signals (narrative/persuasion). | Angle-space coverage/white-space [13]. | Mirrors dim 5. |

**Why both labels (§2) and embeddings (§5)?** Labels are **discrete & explainable** (a buyer reads "UGC /
fear / founder"); embeddings are **continuous & robust** (they cluster near-synonyms the taxonomy misses).
Diversity/white-space use embeddings for distance and labels for the human-readable "what's missing." Neither
alone is enough.

---

## 6. Fact-labeling (strict)

| Fingerprint element | data-map class ([02]) | Fact label | Rationale |
|---|---|---|---|
| `content_hash`, `phash`, `video_hash` | CALC | **INTERNAL CALCULATION (DERIVED)** | Deterministic function of bytes. |
| Embedding **vector** | CALC | **INTERNAL CALCULATION** | Deterministic given (asset, model) — matches [24] `creative_embedding.fact_class`. |
| A **claim from an embedding** (similar / redundant / novel / lookalike) | INFER | **MODEL ESTIMATE** | Depends on threshold + model choice; carries confidence, never asserted as fact. |
| 11 semantic labels + `*_conf` | INFER | **INFERENCE** | AI-labeled ([02] "persona/hook/angle/concept = INFER, INFERENCE with confidence"). |
| `transcript` | EXTERNAL/CALC | **extracted text** (RESEARCH-BACKED tooling output) | The words are extracted, not asserted true; claims *within* stay the advertiser's. |
| `first_3s_summary`, `scene_count`, `pacing_score`, CV `attributes_json` | EXTERNAL/CALC → INFER | **MODEL ESTIMATE** (per key) | CV output with error. |
| `landing` | EXTERNAL | **EXTERNAL** (or NULL + needs-source) | LP crawler, not Meta, not the creative. |
| Brand-safety / policy-risk flag | INFER | **MODEL ESTIMATE — advisory only** | Pre-flags likely disapproval; never a compliance guarantee. |

> **The one reconciliation to remember:** the embedding *number* is INTERNAL CALCULATION (reproducible); the
> *meaning* we read off it is a MODEL ESTIMATE. [24] labels the stored vector INTERNAL_CALCULATION; [23] §6.2
> labels the embedding's *use* MODEL ESTIMATE. Both are right at their layer — store deterministic, interpret
> with confidence. No fingerprint field is ever OFFICIAL_PLATFORM_FACT.

---

## 7. Derived scores (full discipline)

These are the only *scores* the fingerprint layer produces. Diversity/Concentration/Redundancy/White-Space
**scores** are owned by [06]/[13] and only *consume* the similarity + novelty primitives below — defined here
once so [06]/[13] reuse, not redefine. Winners/fatigue scores are [11]/[07].

### 7.1 Near-Duplicate Score
| # | Question | Answer |
|---|---|---|
| 1 | Definition | How close two creatives are as **assets** (same ad re-uploaded, minor crop/re-encode/text tweak). |
| 2 | Decision it drives | "Is this a genuinely new creative or a re-upload/tweak?" → merge test cells, keep fatigue history across the Meta-id churn, don't count a re-upload as new diversity. |
| 3 | Inputs | `content_hash` (exact), `phash`/`video_hash` (fuzzy Hamming distance). |
| 4 | Formula | `content_hash` equal → **duplicate (score 1.0)**. Else `near_dup = 1 − (hamming(phash_a, phash_b) / bits)`. |
| 5 | Weights + reason | Exact hash overrides fuzzy (identity beats resemblance). Image vs video hash chosen by media type; no cross-type near-dup. |
| 6 | Source / class | CALC · INTERNAL CALCULATION (the score); the *"duplicate" verdict* at a threshold is MODEL ESTIMATE. |
| 7 | Level / window | Creative-to-creative; time-independent (content, not delivery). |
| 8 | Min sample | None (deterministic on 2 assets). |
| 9 | Confidence | High for exact hash; medium for pHash (edits fool it both ways). |
| 10 | Limitations | pHash misses semantic dupes (same script, new footage) — that's the *similarity* score's job (7.2); and can false-positive on templated brands where all ads share a frame. |
| 11 | When NOT to trust | Near-dup **threshold** on heavily-templated accounts; cross-format comparisons; treating fuzzy near-dup as identity. |
| — | Threshold | **`calibrate at build`** against a labeled dup/not-dup set — no invented Hamming cut-point. |

### 7.2 Creative Similarity Score
| # | Question | Answer |
|---|---|---|
| 1 | Definition | Semantic closeness of two creatives as **ideas** (same concept even with different footage). |
| 2 | Decision it drives | De-dupe A/B cells that are secretly the same idea; find **lookalikes of a winner** to scale/brief [11]; cluster for diversity [06]. |
| 3 | Inputs | The 8 per-kind cosine similarities + label agreement across the 11 dims. |
| 4 | Formula | `sim = Σ_k w_k · cosine(e_k^a, e_k^b)` over available kinds, renormalised over present kinds; label agreement is a **secondary tiebreak**, not summed in (avoids double-counting concept). |
| 5 | Weights + reason | Default anchor weights (all **`calibrate at build`**): **concept highest** (it is the fused "big idea" — the truest same/different test); visual + text next (drive most human "these look/read alike"); persona/angle mid (structure the strategy space); hook/scene/audio lower (finer texture). Reason: weight by proximity to "is this the same *idea*," which is the decision. Weights are validated against human same/different judgments, never shipped arbitrary ([01b] G9 rule; KILLCRITIC on un-validated weights). |
| 6 | Source / class | CALC on embeddings (INTERNAL CALCULATION) → the similarity *verdict* is MODEL ESTIMATE. |
| 7 | Level / window | Creative-to-creative; content-based, time-independent. |
| 8 | Min sample | Needs ≥ the anchor embeddings present (concept + at least one of visual/text). Fewer kinds → wider confidence, not a blocked score. |
| 9 | Confidence | From kind-coverage (how many of 8 present) + label `_conf` agreement + model_version match. Cross-model comparisons are lower confidence (see §8). |
| 10 | Limitations | Embedding model encodes its own biases; "similar" is not "redundant" (two similar ads can serve different audiences); cosine geometry is not human perception. |
| 11 | When NOT to trust | Comparing embeddings from **different `model`/`model_version`**; missing concept + visual + text; declaring "redundant" from similarity alone without the [06] redundancy rule. |

### 7.3 Novelty / White-Space Distance
| # | Question | Answer |
|---|---|---|
| 1 | Definition | How far a creative sits from the account's existing creative cloud (max over 1 − similarity to nearest neighbours). |
| 2 | Decision it drives | "Is this a genuinely new concept, or more of the same?" → whether a proposed/briefed idea occupies white space [13]; whether the library is truly diversifying. |
| 3 | Inputs | 7.2 similarity of the creative to its k-nearest existing creatives (concept/persona/angle/visual kinds). |
| 4 | Formula | `novelty = 1 − max_j sim(new, neighbour_j)` over the account set (or mean of top-k). |
| 5 | Weights + reason | Uses 7.2's weights; concept/persona/angle up-weighted because white-space is about **idea/strategy** gaps, not pixel differences. |
| 6 | Source / class | CALC → MODEL ESTIMATE. |
| 7 | Level / window | Creative vs account creative set; snapshot at compute time (re-evaluate as the library grows). |
| 8 | Min sample | Needs a populated account set to be meaningful; a near-empty library makes everything "novel" (say so, don't celebrate it). |
| 9 | Confidence | Scales with library size + fingerprint coverage of the library. |
| 10 | Limitations | Novel ≠ good (a new idea can flop); depends on how completely the existing library is fingerprinted (gaps inflate novelty). |
| 11 | When NOT to trust | Sparse/under-fingerprinted library; brand-new account; treating novelty as a performance prediction. |
| — | "High-novelty" cut | **`calibrate at build`**; report the distribution, not an invented cutoff. |

### 7.4 Fingerprint Completeness & Confidence
| # | Question | Answer |
|---|---|---|
| 1 | Definition | How complete + trustworthy a single creative's fingerprint is (share of applicable dims/embeddings present, weighted by `_conf`). |
| 2 | Decision it drives | **The trust gate for every downstream consumer** — suppress or down-weight diversity/white-space/similarity when the fingerprint is thin; trigger re-fingerprint; show "reduced confidence," never a silent gap ([23] error handling). |
| 3 | Inputs | Presence of each applicable dim (format-aware: statics don't owe temporal fields) + each embedding kind; the `*_conf` values; `landing` availability. |
| 4 | Formula | `completeness = present_applicable / expected_applicable`; `fp_confidence = weighted mean of present _conf × completeness`. |
| 5 | Weights + reason | Decision-critical dims (persona, hook, angle, concept embedding) weighted above texture dims — their absence damages more downstream decisions. Weights `calibrate at build`. |
| 6 | Source / class | CALC · INTERNAL CALCULATION over INFERENCE inputs → reported as a confidence, feeds [14]. |
| 7 | Level / window | Per creative; recomputed when the fingerprint is (re)written. |
| 8 | Min sample | None. |
| 9 | Confidence | Self-referential — it *is* the confidence signal; pairs with [14] Confidence Framework. |
| 10 | Limitations | High completeness ≠ correct labels (a confidently-wrong label still hurts); format-aware "expected" set must be right or statics look falsely incomplete. |
| 11 | When NOT to trust | If the "expected applicable" set is mis-specified per format; if `_conf` values are un-calibrated (then completeness is the more honest half). |

> **Guardrail (KILLCRITIC / AUTOPSY):** every threshold in §7 is `calibrate at build` — no invented cosine
> or Hamming cut-point ships. `similar != redundant` (redundancy is [06]'s rule, needing performance +
> audience context). `no-fingerprint != low-diversity` — a missing fingerprint is a **data-quality gap** ([01d] N),
> excluded from diversity denominators, never counted as sameness.

---

## 8. Extraction pipeline (Gemini vision/video + transcript) — fingerprint once, reuse forever

Owned by [23] §6; summarised for the decisions it must preserve.

```
ad ──▶ resolve ──▶ download ──▶ normalize ──▶ handoff ──▶ Vision(fingerprint) ──▶ store
      (creative,   (blob to     (frames+audio   (enqueue    (labels+embeddings+   (creative_fingerprint
       video_id)    our store)   OR native vid)   vision)     hashes, ONE pass)     + creative_embedding)
```

1. **resolve** — ad → creative → `video_id` / `image_hash` ([23] §6.1).
2. **download** — media blob to our store (queued, size-bounded; never streamed inline).
3. **normalize** — sample frames + audio **or** hand the whole video to Gemini native video understanding
   (ffmpeg frame-extraction path is *superseded*, [23] §6.1). LP crawl runs in parallel for the `landing` dim.
4. **Vision (one pass)** — Gemini produces the 11 labels (+`_conf`), transcript, first-3s summary, scene/
   pacing, CV `attributes_json`, and all 8 embeddings; hashes computed deterministically. Written **once**.

**Fingerprint-once discipline (brief §Creative intelligence):**
- Keyed by **`content_hash`**, unique on **`(creative_id, model_version)`** ([24] §5). A re-upload (new Meta
  creative id, same bytes) is **detected via `content_hash`, not re-analyzed** — the existing fingerprint is
  linked and fatigue history preserved ([07]).
- **The only legitimate reprocessing** is a **`model_version` bump** (better CV/LLM). Then a *new* row is
  written under the new `model_version`; old rows are retained for reproducibility. **Never mix embeddings
  across `model`/`model_version` in one similarity call** (7.2 limitation).
- Cost/rate control is **structural**: Vision is a consumer-only queued job drained by the cron tick — the
  per-tick cap is the Gemini rate limiter ([23] ADR-0003), so "fingerprint once" is enforced by the store,
  not by hope.

---

## 9. Edge cases (feeds [28] Edge Case Library)

| Case | Handling |
|---|---|
| **No media / download 404 / permission** | Mark creative **`no-fingerprint`** ([23] error handling). Downstream degrades with *reduced confidence*, excluded from diversity denominators — **never** a silent gap and never counted as "same." |
| **Re-upload (new id, same bytes)** | `content_hash` match → link existing fingerprint, keep history, skip re-analysis. |
| **Static / carousel** | Temporal fields + `audio`/`scene`/`hook` embeddings = **N/A NULL** (format-aware completeness, §7.4); still get text/visual embeddings + non-temporal dims. |
| **Carousel / multi-asset ad** | Fingerprint per card/asset + a rolled-up ad-level fingerprint; `format='carousel'`. Similarity can run per-card. |
| **DCO / Dynamic Creative** | Many rendered variants under one ad. Fingerprint the **asset components**; flag `dco=true` in `attributes_json`; don't treat the container as one creative (it is a set). |
| **UGC / creator content** | `speaker='creator'`; watch creator-concentration risk (over-reliance on one face) as a diversity signal for [06]. |
| **LP behind login / geo / paywall / redirect chain** | `landing=NULL` + `needs external source`; message-match not computed, not faked. |
| **LP changed after crawl** | `landing` carries `crawled_at`; stale beyond a build-set TTL → re-crawl flag, don't trust old message-match. |
| **Low-confidence / ambiguous label** | Store label + low `_conf`, or **NULL** if ungroundable. A guessed label is worse than a null (it poisons diversity/white-space silently). |
| **Model-version drift** | Compare only within a `model_version`; a bump re-fingerprints into new rows; similarity across versions is flagged low-confidence or refused. |
| **Competitor creatives ([12])** | Same schema, same pipeline; but performance is UNKNOWN and `active != winning` — fingerprints generate **hypotheses**, never conclusions. |

---

## 10. What this spec deliberately does NOT do
- **Does not redefine storage** — that is [24] §5 (`creative_fingerprint`, `creative_embedding`).
- **Does not define performance metrics** — hook/hold/retention/CTR/CVR/ROAS at creative level are [01b] G /
  [01a] B. The fingerprint is *content*; the dictionary is *performance*.
- **Does not compute diversity/concentration/redundancy/white-space scores** — those are [06]/[13]; this spec
  supplies the similarity + novelty *primitives* and the labels/embeddings they read.
- **Does not lock the label taxonomy** — [04] Creative Attribute Dictionary formalises the controlled
  vocabulary; 05 is 04's foundation and stores a `taxonomy_version` in the meantime.
- **Does not assert any numeric threshold** — every cut-point (near-dup, similarity, novelty, completeness) is
  `calibrate at build` against labeled data.
```
