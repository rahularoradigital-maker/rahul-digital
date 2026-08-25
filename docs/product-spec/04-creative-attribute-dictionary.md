# [04] Creative Attribute Dictionary

The full taxonomy of **extractable creative attributes** — the descriptive DNA of every ad, the raw
material that [05] assembles into a fingerprint, [06] measures for diversity/white-space, and the
rule/recommendation engines ([15][16]) reason over. This artifact defines *what we can describe about a
creative and how sure we are of each description*. It does **not** measure performance — performance
of the creative lives in **G Creative** ([01b]) and **H Fatigue** ([01c]). An attribute is a
*description, not a verdict*: knowing an ad is "UGC, founder speaker, problem-solution angle" says
nothing about whether it wins — pairing attribute → performance is the job of [05]/[16], not this file.

## How to read every entry
Each attribute carries, at minimum: **definition · allowed values · how extracted · source class
([02]) · fact label · confidence tier · observed-vs-inferred boundary · the decision it drives ·
when NOT to trust it.** Per the master-plan decision gate, an attribute that drives no diagnosis is
tagged `descriptive-only — not primary` (it may still feed clustering/diversity, but never a
standalone recommendation).

## Source classes (from [02], which wins on any disagreement)
| Class | Meaning here | Fact label it earns |
|---|---|---|
| **FETCH** | A field Meta returns directly (`adcreatives`, `object_story_spec`) | OFFICIAL PLATFORM FACT |
| **CALC** | Deterministically computed from fetched fields or from our own extracted bytes (counts, ratios, hashes) | INTERNAL CALCULATION |
| **EXTERNAL/CALC** | Produced by our Vision/transcription service running on our stored blobs (frames, OCR, scenes, transcript) — [02] "video frames, visual attributes, embeddings → EXTERNAL/CALC" | MODEL ESTIMATE (extraction output; the *reading* is a model's, not Meta's) |
| **INFER** | A semantic label a model assigns (hook type, angle, persona) — [02] "persona/hook/angle/concept labels → INFER" | INFERENCE (always carries its own `_conf`) |
| **EXTERNAL** | From another system (landing page crawler, product feed) | EXTERNAL |

No attribute here is ever presented as an OFFICIAL Meta attribute unless [02] classes its source field
as FETCH. The fingerprint store ([24] §5) enforces this at the schema level: label fields are
`INFERENCE`, hashes/embeddings are `INTERNAL_CALCULATION`, nothing is `OFFICIAL_PLATFORM_FACT`.

## The observed → inferred spectrum (the core doctrine of this artifact)
Extraction confidence is not one number; it degrades along a spectrum. Every attribute is placed on it.

| Tier | What it is | Typical confidence | Example |
|---|---|---|---|
| **T0 · Platform-observed** | A Meta FETCH field | Deterministic (it is what Meta says) | format, aspect ratio, CTA button type, ad copy text |
| **T1 · Deterministically-derived** | CALC from fetched/extracted bytes | Deterministic given inputs | word count, duration, scene count, aspect bucket |
| **T2 · CV-detected concrete** | Vision detects a discrete, verifiable thing | High but model-bounded | face present, on-screen text present, logo present, product on screen |
| **T3 · CV-characterised** | Vision reads an aesthetic/style | Medium | visual style, shot type, colour mood, pacing feel |
| **T4 · Semantically inferred** | A model interprets meaning/intent | Medium→low; **INFERENCE, review-gated** | hook type, angle, awareness level, persona, offer intent, emotional tone |

**Rule:** T0–T1 may drive decisions directly. T2 may with its detection confidence. **T3–T4 never drive
an irreversible action alone** — they cluster, hypothesise, and route to human review below a
calibrated confidence floor (`floor UNKNOWN → calibrate at build`, [14][26]). "Extracted" never
means "correct": a low-confidence inferred label is a hypothesis, exactly as "active != winning" and
"insufficient data != waste" hold elsewhere in the brief.

## Extraction stack (from [23] §6 Vision Service, [02])
- **Meta Marketing API** (`adcreatives{object_story_spec, body, title, call_to_action_type}`) → T0 structural fields. FETCH.
- **Asset service** downloads image/video blobs to our store (keyed by `content_hash`) → normalised bytes.
- **Vision service** (Gemini native video understanding and/or CV: frame sampling, scene/shot segmentation, OCR, face/object/logo detection) runs **only on our blobs, never calls Meta** ([23] §6.2) → T2/T3.
- **Transcription** (native video model or transcription service) → transcript, spoken hook. EXTERNAL/CALC.
- **LLM labeller** (Gemini) maps observed evidence → semantic labels with a confidence and a short rationale → T4. INFER.
- **Fingerprint written once per `content_hash`** ([24] §5): re-uploads are detected, not re-analysed. Every extraction records `model_version` for reproducibility and re-labelling when the model changes.

## Confidence — how each attribute's number is set (feeds [14])
`extraction_confidence` per attribute = f(tier floor, extractor's own score, evidence corroboration,
asset quality). Concretely: T0/T1 = 1.0 (deterministic); T2 = detector score; T3/T4 = model's
self-reported confidence **down-weighted** when (a) the modality is missing (e.g. inferring speaker
type on a text-only static), (b) corroborating signals disagree (transcript says "founder", visuals
show a studio actor), or (c) asset quality is low. **No numeric confidence-to-action threshold is
asserted here** — the floor that separates "auto-use" from "route-to-review" is `UNKNOWN / calibrate
at build` against a human-labelled gold set ([26] QA). Never present a T4 label without its `_conf`.

---

# A · Structural / platform attributes (T0–T1 · FETCH / CALC · OFFICIAL / INTERNAL CALCULATION)
These are the ground truth of the taxonomy — cheapest, surest, and the backbone of diversity/white-space
because they never need a model to be believed.

### CA-S01 · Media type / format
| Field | Value |
|---|---|
| Definition | The creative's media container as Meta classifies it. |
| Allowed values | `image` · `video` · `carousel` · `collection` · `dynamic/DPA` · `catalog` · `text-only`. (Verify the exact enum against the live `adcreatives`/`object_story_spec` at build — Meta renames.) |
| Extraction | FETCH `object_story_spec` / `effective_object_story_id` type. No model. |
| Source class · fact | FETCH · **OFFICIAL PLATFORM FACT** |
| Tier · confidence | T0 · deterministic |
| Observed vs inferred | Observed. |
| Decision it drives | Gates which downstream attributes even apply (video-only vs static-only, see G-set in [01b]); a primary **diversity/coverage** axis ([06]); "are we over-concentrated in one format?" |
| When NOT to trust | Dynamic/placement-customised creatives can present multiple formats under one ad id — record the *delivered* format per placement, don't collapse. |

### CA-S02 · Aspect ratio & CA-S03 · Placement footprint
| Field | Value |
|---|---|
| Definition | S02: the asset's width:height. S03: the set of placements the creative is eligible for / delivered in. |
| Allowed values | S02: `9:16` · `4:5` · `1:1` · `16:9` · `1.91:1` · `other` (bucket from exact dims). S03: Feed · Reels · Stories · Explore · Marketplace · Audience Network · Search · etc. (calibrate enum at build). |
| Extraction | S02: CALC from asset dimensions (FETCH) → bucket (T1). S03: FETCH from asset/placement config. |
| Source class · fact | S02 CALC · INTERNAL CALCULATION; S03 FETCH · OFFICIAL PLATFORM FACT |
| Tier · confidence | T1 / T0 · deterministic |
| Observed vs inferred | Observed. |
| Decision it drives | Placement-fit diagnosis ("a 1:1 asset running in 9:16 Reels wastes 40% of screen" → produce vertical); **read every retention/hook metric per placement, never mixed** (the G-set warns mixed-placement aggregates are untrustworthy). |
| When NOT to trust | An asset eligible for a placement is not proof it delivered there — separate eligibility from delivery. |

### CA-S04 · Video duration
| Field | Value |
|---|---|
| Definition | Length of the video asset in seconds. |
| Allowed values | Raw seconds + bucket `≤6s` · `7–15s` · `16–30s` · `31–60s` · `>60s` (**bucket edges = calibrate at build**, not asserted as fact). |
| Extraction | CALC from the video file / FETCH length field. |
| Source class · fact | CALC · INTERNAL CALCULATION |
| Tier · confidence | T1 · deterministic |
| Observed vs inferred | Observed. |
| Decision it drives | Length-vs-retention diagnosis (pairs with G3 retention curve, G4 avg watch time → "trim toward the point most reach"); duration diversity ([06]); required input to normalise retention across lengths (a 15s and 60s video are not comparable at p50 — G3 limitation). |
| When NOT to trust | Never read duration as a quality signal on its own; length only matters against the retention curve for the *same* placement. |

### CA-S05 · Asset count / card count (carousel)
| Field | Value | 
|---|---|
| Definition | Number of cards/frames in a carousel or collection. |
| Allowed values | integer ≥1. |
| Extraction | CALC from `object_story_spec` child assets. |
| Source class · fact | CALC · INTERNAL CALCULATION |
| Tier · confidence | T1 · deterministic |
| Observed vs inferred | Observed. |
| Decision it drives | Per-card analysis routing; carousel-vs-single diversity. Otherwise `descriptive-only — not primary`. |
| When NOT to trust | Card-level performance needs per-card metrics, which Meta exposes unevenly — verify at build before diagnosing a specific card. |

### CA-S06 · Ad copy — primary text / headline / description
| Field | Value |
|---|---|
| Definition | The written copy blocks: `body` (primary text), `title` (headline), link description. |
| Allowed values | free text (stored verbatim). |
| Extraction | FETCH `adcreatives{body, title}` / `object_story_spec`. |
| Source class · fact | FETCH · **OFFICIAL PLATFORM FACT** (the text is exactly what ran) |
| Tier · confidence | T0 · deterministic |
| Observed vs inferred | Observed (the text). Any *reading* of the text — angle, claim, tone — is a separate inferred attribute (D-set), not this one. |
| Decision it drives | The substrate for message-match to the landing page ([01b] continuity), copy-length/readability signals (CA-S07), and every T4 semantic label; copy diversity. |
| When NOT to trust | Dynamic-creative ads rotate multiple copy variants under one id — capture the variant set, not just the first. |

### CA-S07 · Copy length / readability
| Field | Value |
|---|---|
| Definition | Word/character count of primary text and headline; optional readability grade. |
| Allowed values | integers; readability grade (e.g. Flesch) `descriptive-only` unless calibrated. |
| Extraction | CALC from CA-S06. |
| Source class · fact | CALC · INTERNAL CALCULATION |
| Tier · confidence | T1 · deterministic (count) / T3 (readability model, if used) |
| Observed vs inferred | Count observed; readability characterised. |
| Decision it drives | "Long-copy vs short-copy" testing axis; truncation risk ("primary text exceeds the ~125-char fold — front-load the hook"; **exact fold length UNKNOWN / verify at build**, Meta changes it). |
| When NOT to trust | No word-count threshold predicts performance — treat as a test dimension, never a rule, unless [27] supplies a validated benchmark. |

### CA-S08 · CTA button type
| Field | Value |
|---|---|
| Definition | The Meta call-to-action button attached to the ad. |
| Allowed values | Meta enum: `SHOP_NOW` · `LEARN_MORE` · `SIGN_UP` · `GET_OFFER` · `BOOK_TRAVEL` · `DOWNLOAD` · `SUBSCRIBE` · `ORDER_NOW` · `NONE` · … (use the live `call_to_action_type` enum — [23] §6 lists it FETCH). |
| Extraction | FETCH `adcreatives{call_to_action_type}`. |
| Source class · fact | FETCH · **OFFICIAL PLATFORM FACT** |
| Tier · confidence | T0 · deterministic |
| Observed vs inferred | Observed. This is the *button*; the *intent* it signals (soft vs hard ask) is inferred — CA-I11. |
| Decision it drives | CTA diversity ([06] lists CTA as a diversity axis); CTA-vs-CVR testing; message-match ("SHOP_NOW → PDP, LEARN_MORE → content page"). |
| When NOT to trust | Button choice is constrained by objective/placement — don't read it as a pure creative choice. |

### CA-S09 · Destination / landing URL
| Field | Value |
|---|---|
| Definition | The click destination (link URL / deep link). |
| Allowed values | URL (normalised; UTMs parsed separately). |
| Extraction | FETCH `object_story_spec` link. |
| Source class · fact | FETCH · **OFFICIAL PLATFORM FACT** (that this URL was set) |
| Tier · confidence | T0 · deterministic |
| Observed vs inferred | Observed. The *content* of that page is EXTERNAL (LP crawler, [02]); the creative→LP message-match is a separate inferred judgement. |
| Decision it drives | Ties the creative to landing-page/product analysis ([01b] continuity, product coverage); "good creative → wrong/broken LP" detection. |
| When NOT to trust | Never place personal data in captured URLs; a set URL is not proof the page still resolves — LP health is checked externally. |

---

# B · Visual attributes (CV-observed / characterised · EXTERNAL/CALC · MODEL ESTIMATE)
Produced by the Vision service on our blobs. T2 (concrete detections) are trustworthy with their
detector score; T3 (aesthetic reads) are directional. All are MODEL ESTIMATE — a model's reading,
never a Meta fact.

### CA-V01 · People / face presence & count
| Field | Value |
|---|---|
| Definition | Whether human faces/people appear, and how many. |
| Allowed values | `has_person` bool · `face_count` int · `primary_person` bool. |
| Extraction | CV face/person detection across sampled frames (or the still). |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE |
| Tier · confidence | T2 · detector score |
| Observed vs inferred | **Observed** (a face is/ isn't there). *Who* they are (founder, customer, actor) is inferred — CA-I12 speaker type. |
| Decision it drives | "Person vs no-person" creative axis (a core DTC lever); diversity (people axis, [06]); routes speaker-type inference. |
| When NOT to trust | Occlusion, animation, or crowd scenes degrade counts; a detected face at low score is not confirmed — carry the score. |

### CA-V02 · Product presence & prominence
| Field | Value |
|---|---|
| Definition | Whether the advertised product appears and how prominently (screen share / time on screen). |
| Allowed values | `product_shown` bool · `prominence` {`hero` · `secondary` · `absent`} · `first_appearance_s` (video). |
| Extraction | CV object detection matched to product feed imagery (EXTERNAL product info, [02]); time-to-first-appearance from frame timeline. |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE |
| Tier · confidence | T2 (shown) · T3 (prominence) |
| Observed vs inferred | Presence observed; prominence characterised. |
| Decision it drives | "Product-forward vs lifestyle/problem-first" axis; **product coverage/white-space** ("which SKUs have creative, which have none" — brief §landing/product); late-product-reveal vs retention. |
| When NOT to trust | Look-alike products / packaging variants confuse matching; without a product-image reference, prominence is a guess — lower confidence. |

### CA-V03 · On-screen text density & CA-V04 · Text timing
| Field | Value |
|---|---|
| Definition | V03: amount of text overlaid on the visual (OCR word/area share). V04: when text appears/changes over the video. |
| Allowed values | V03: `text_area_pct` · `ocr_word_count` · bucket `none/light/moderate/heavy` (**bucket edges calibrate at build**). V04: timeline of text events. |
| Extraction | CV OCR per frame; area = text bbox / frame area. |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE |
| Tier · confidence | T2 (OCR presence/words) · T3 (density judgement) |
| Observed vs inferred | Text content observed (OCR); "over-crowded" is characterised. |
| Decision it drives | "Overcrowded for the placement?" ([23] §6.2 example) → simplify overlays; caption-heavy vs clean testing; readability-on-mobile flag. |
| When NOT to trust | **The old Meta "20% text rule" is deprecated — do NOT assert any text-share threshold as a fact/benchmark** (UNKNOWN / calibrate). OCR misses stylised fonts; low-res assets under-count. |

### CA-V05 · Caption / subtitle presence
| Field | Value |
|---|---|
| Definition | Whether burned-in or platform captions accompany speech. |
| Allowed values | `has_captions` bool · `caption_type` {burned-in · none · unknown}. |
| Extraction | CV/OCR persistent-text-with-speech detection; cross-check transcript timing. |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE |
| Tier · confidence | T2 · detector score |
| Observed vs inferred | Observed. |
| Decision it drives | Sound-off accessibility flag ("voice-driven ad with no captions → add captions"; most Feed views are sound-off — treat as a heuristic, not a benchmarked number). |
| When NOT to trust | Distinguish decorative overlay text from actual captions; ambiguous → mark unknown, don't assume. |

### CA-V06 · Brand / logo presence & timing
| Field | Value |
|---|---|
| Definition | Whether the brand mark appears and when (esp. within first frames). |
| Allowed values | `has_logo` bool · `first_logo_s` · `logo_persistent` bool. |
| Extraction | CV logo detection against brand reference. |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE |
| Tier · confidence | T2 · detector score |
| Observed vs inferred | Observed. |
| Decision it drives | "Branded too early / too late" testing; branding-vs-hook trade-off in the opener. |
| When NOT to trust | Small/faint logos missed; no strong performance rule about logo timing — test dimension, not a law. |

### CA-V07 · Dominant colour palette / colour mood
| Field | Value |
|---|---|
| Definition | Dominant colours and overall colour character. |
| Allowed values | palette (hex clusters) · mood {bright · dark · pastel · high-contrast · muted} (mood = calibrate). |
| Extraction | CV colour histogram (palette = T1-ish deterministic from pixels); mood label = T3. |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE (palette is deterministic; mood is characterised) |
| Tier · confidence | T2 (palette) · T3 (mood) |
| Observed vs inferred | Palette observed; mood characterised. |
| Decision it drives | Visual diversity/"everything looks the same" (redundancy, [06]); scroll-stopping contrast hypothesis. Mostly `descriptive-only` for a single ad; valuable in aggregate. |
| When NOT to trust | Colour ≠ performance; use for clustering/diversity, not standalone recommendations. |

### CA-V08 · Shot type / composition
| Field | Value |
|---|---|
| Definition | Framing of the primary shot(s). |
| Allowed values | `close-up` · `medium` · `wide` · `product-only` · `screen-recording` · `split-screen` · `text-card` (calibrate enum). |
| Extraction | CV frame analysis. |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE |
| Tier · confidence | T3 · characterised |
| Observed vs inferred | Characterised. |
| Decision it drives | Composition diversity; hook-style testing (close-up talking-head vs product demo). |
| When NOT to trust | Mixed-shot videos need per-scene tagging; single dominant-shot label loses nuance. |

### CA-V09 · Visual style / production style
| Field | Value |
|---|---|
| Definition | Overall production aesthetic. Maps to fingerprint `visual_style` ([24] §5). |
| Allowed values | `UGC/handheld` · `studio/polished` · `animation/motion-graphics` · `screen-capture` · `stock` · `meme/native` · `stop-motion` (calibrate enum at build). |
| Extraction | CV + LLM over frames. |
| Source class · fact | EXTERNAL/CALC → INFER · MODEL ESTIMATE / INFERENCE |
| Tier · confidence | T3 · characterised |
| Observed vs inferred | Characterised — borderline inferred; carry confidence. |
| Decision it drives | UGC-vs-studio is a top DTC production lever; visual diversity ([06]); production-cost-vs-performance. |
| When NOT to trust | Hybrid styles (studio-shot made to look UGC) fool the label; below floor → route to review. |

### CA-V10 · Setting / environment / background
| Field | Value |
|---|---|
| Definition | Where the creative is set. |
| Allowed values | `home` · `outdoor` · `studio/seamless` · `office` · `retail` · `abstract/graphic` · `bathroom/kitchen` (category-relevant, calibrate). |
| Extraction | CV scene classification. |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE |
| Tier · confidence | T3 · characterised |
| Observed vs inferred | Characterised. |
| Decision it drives | Background/environment diversity ([06] lists both); "relatable home vs studio" testing. `descriptive-only` alone; strong in aggregate. |
| When NOT to trust | Multi-scene videos → dominant-scene bias; low confidence on abstract/graphic content. |

### CA-V11 · Motion / pacing (scene-change rate)
| Field | Value |
|---|---|
| Definition | Scene/cut count and cutting rhythm. Maps to fingerprint `scene_count` / `pacing_score` ([24] §5). |
| Allowed values | `scene_count` int · `cuts_per_10s` · pacing bucket `slow/medium/fast` (calibrate). |
| Extraction | CV scene/shot segmentation. |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE |
| Tier · confidence | T2 (cut count) · T3 (pacing feel) |
| Observed vs inferred | Cut count observed; "fast/slow" characterised. |
| Decision it drives | Pairs with retention curve (G3) → "is drop-off a pacing problem?"; pacing diversity. |
| When NOT to trust | Static/single-shot → n/a; hard cuts vs transitions may be counted differently — document the segmentation rule. |

---

# C · Audio / transcript attributes (EXTERNAL/CALC · MODEL ESTIMATE)

### CA-A01 · Audio presence & type
| Field | Value |
|---|---|
| Definition | Whether the video has audio and its nature. |
| Allowed values | `has_audio` bool · type {`voiceover` · `on-camera-speech` · `music-only` · `sfx-only` · `silent`}. |
| Extraction | Audio track analysis + transcript alignment. |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE |
| Tier · confidence | T2 (presence) · T3 (type) |
| Observed vs inferred | Presence observed; type characterised. |
| Decision it drives | Sound-on-vs-sound-off design (with CA-V05 captions); "voice-led vs music-led" testing. |
| When NOT to trust | Sound-off is the common view state — never assume audio was heard; pair with captions before recommending. |

### CA-A02 · Transcript (spoken content)
| Field | Value |
|---|---|
| Definition | Full speech-to-text of the video. Maps to fingerprint `transcript` ([24] §5). |
| Allowed values | free text with timings. |
| Extraction | Transcription service or native video model ([02] "transcript → EXTERNAL/CALC"). |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE (treat text as *extracted*, not asserted — [23] §6) |
| Tier · confidence | T2 · ASR confidence |
| Observed vs inferred | Observed-ish (what was said), bounded by ASR error. All *meaning* drawn from it (claims, angle) is inferred. |
| Decision it drives | Substrate for spoken-hook (CA-A03), claims/proof (CA-I09/CA-I10), message-match, and text embeddings; "which scripts/claims correlate with retention". |
| When NOT to trust | Accents/noise/music raise word error; never quote a claim for compliance off a low-confidence transcript. |

### CA-A03 · Spoken hook (first line) & CA-A04 · First 1/3/5s content
| Field | Value |
|---|---|
| Definition | The opening spoken line, and a structured summary of the first 1/3/5 seconds (visual + spoken). Maps to fingerprint `first_3s_summary` ([24] §5). |
| Allowed values | text (first line) · per-window summary {visual, spoken, on-screen-text}. |
| Extraction | Transcript window 0–5s + frame summary of the opener. |
| Source class · fact | EXTERNAL/CALC · MODEL ESTIMATE |
| Tier · confidence | T2 (content) · T4 (any hook-type read, → CA-I01) |
| Observed vs inferred | The opener content is observed; classifying it as a "hook type" is inferred (CA-I01). |
| Decision it drives | The single highest-leverage diagnosis: **low hook rate (G1) → what is the opener, and how do we change it?** Directly targets the first-3s fix the G-set prescribes. |
| When NOT to trust | Static creative has no temporal hook (use the still + headline instead); mixed placements crop the opener differently. |

---

# D · Semantic / strategic attributes (INFER · INFERENCE · T4, review-gated)
The interpretive layer — the fingerprint's meaning dimensions ([24] §5: persona/problem/desire/hook/
angle/offer/…). **Every one is INFERENCE, carries its own `_conf`, and never drives an irreversible
action below the calibrated floor.** These are hypotheses the buyer confirms, not facts.

### CA-I01 · Hook type
| Field | Value |
|---|---|
| Definition | The persuasion mechanism of the opening. Fingerprint `hook`. |
| Allowed values | `question` · `problem-callout` · `bold-claim` · `pattern-interrupt` · `stat/shock` · `curiosity/tease` · `testimonial-open` · `demo-open` · `before-after` · `negativity/callout` (calibrate & extend at build). |
| Extraction | LLM over CA-A03/CA-A04 + opening frames. |
| Source class · fact | INFER · **INFERENCE** (+`hook_conf`) |
| Tier · confidence | T4 · model conf, down-weighted if opener modality missing |
| Decision it drives | Hook diversity/white-space ([06]); "which hook types earn attention *for this account*" (attribute→G1 pairing in [05][16]); what to brief for the next batch. |
| When NOT to trust | Novel/blended hooks force a wrong bucket; below floor → review. No hook type is universally "best" — pair with performance, never assert from the label. |

### CA-I02 · Angle / messaging angle
| Field | Value |
|---|---|
| Definition | The core persuasive argument. Fingerprint `angle`. |
| Allowed values | `problem-solution` · `benefit-led` · `social-proof` · `authority/expert` · `fear/loss-aversion` · `aspiration/identity` · `price/value` · `comparison` · `novelty/how-it-works` (calibrate). |
| Extraction | LLM over copy + transcript + visuals. |
| Source class · fact | INFER · **INFERENCE** (+`angle_conf`) |
| Tier · confidence | T4 |
| Decision it drives | Angle diversity & white-space (a top-level [06] axis); angle→performance learning; next-test briefing. |
| When NOT to trust | Ads carry multiple angles — capture primary + secondary, don't force one; below floor → review. |

### CA-I03 · Awareness level (target)
| Field | Value |
|---|---|
| Definition | The Schwartz awareness stage the creative addresses. |
| Allowed values | `unaware` · `problem-aware` · `solution-aware` · `product-aware` · `most-aware` (established framework — RESEARCH-BACKED as a *framework*, the *label* is INFERENCE). |
| Extraction | LLM over full creative. |
| Source class · fact | INFER · **INFERENCE** |
| Tier · confidence | T4 |
| Decision it drives | Funnel-coverage gap ("all our creative is product-aware → nothing for cold/problem-aware" — a white-space [13] and audience-match diagnosis). |
| When NOT to trust | Awareness is partly an audience property, not just the creative — corroborate with targeting; below floor → review. |

### CA-I04 · Persona / audience target
| Field | Value |
|---|---|
| Definition | Who the creative appears to speak to. Fingerprint `persona`. |
| Allowed values | account-specific persona set (calibrate from brand brief / segments); each a label + descriptor. |
| Extraction | LLM over casting, language, problem framing. |
| Source class · fact | INFER · **INFERENCE** (+`persona_conf`) |
| Tier · confidence | T4 |
| Decision it drives | Persona diversity/coverage ([06] top axis); "which personas have no creative" (white-space); persona→performance. |
| When NOT to trust | Intended ≠ reached audience (targeting/delivery decide reach); a creative can speak to several — capture primary; below floor → review. |

### CA-I05 · Problem addressed & CA-I06 · Desire / benefit promised
| Field | Value |
|---|---|
| Definition | I05: the pain/problem the creative names. I06: the outcome/desire it promises. Fingerprints `problem`, `desire`. |
| Allowed values | account-specific taxonomies (calibrate); short canonical labels. |
| Extraction | LLM over copy + transcript. |
| Source class · fact | INFER · **INFERENCE** (+ `problem_conf`/`desire_conf`) |
| Tier · confidence | T4 |
| Decision it drives | Problem/desire diversity & white-space ([06] lists both); message-match to LP promise; "we over-index on one problem". |
| When NOT to trust | Implicit problems get missed; below floor → review; don't treat as market truth, only as what *this creative* claims. |

### CA-I07 · Emotional tone
| Field | Value |
|---|---|
| Definition | Dominant emotional register. |
| Allowed values | `humorous` · `serious/earnest` · `inspirational` · `urgent/anxious` · `warm/empathetic` · `authoritative` · `playful` (calibrate). |
| Extraction | LLM over transcript + visuals + music. |
| Source class · fact | INFER · **INFERENCE** |
| Tier · confidence | T4 |
| Decision it drives | Tone diversity; tone→resonance hypotheses. Often `descriptive-only` alone; useful in aggregate. |
| When NOT to trust | Culturally subjective; sarcasm/irony misread; below floor → review. |

### CA-I08 · Offer type
| Field | Value |
|---|---|
| Definition | The commercial offer presented. Fingerprint `offer`. |
| Allowed values | `none/full-price` · `% discount` · `$ off` · `BOGO` · `free-shipping` · `free-gift` · `bundle` · `subscription/trial` · `financing` (calibrate; capture magnitude when stated). |
| Extraction | LLM/OCR over copy + on-screen text + transcript. |
| Source class · fact | INFER · **INFERENCE** (offer text may be OCR-observed T2; the *classification* is INFER) |
| Tier · confidence | T2 (offer text present) → T4 (typed) |
| Decision it drives | Offer diversity; discount-dependence diagnosis ("every winner has a discount → margin risk", a CFO-lens signal); offer→CVR. |
| When NOT to trust | Offer may live on the LP not the creative — mark source; promo periods confound offer→performance (AUTOPSY seasonality/promo). |

### CA-I09 · Urgency / scarcity
| Field | Value |
|---|---|
| Definition | Presence and type of urgency/scarcity cues. |
| Allowed values | `none` · `time-limited` · `low-stock` · `seasonal` · `evergreen-urgency` (calibrate). |
| Extraction | LLM/OCR over copy + on-screen text. |
| Source class · fact | INFER · **INFERENCE** |
| Tier · confidence | T4 (cue phrase may be T2-observed) |
| Decision it drives | Urgency-vs-CTR/CVR testing; brand-safety check on false-scarcity claims (compliance review — a real decision). |
| When NOT to trust | Urgency cues can be non-compliant if false — flag for human/legal review, never auto-approve; below floor → review. |

### CA-I10 · Proof type
| Field | Value |
|---|---|
| Definition | The kind of evidence/credibility the creative uses. |
| Allowed values | `none` · `customer-testimonial` · `UGC-review` · `expert/authority` · `clinical/study` · `demo/results` · `before-after` · `press/ratings` · `social-count` (calibrate). |
| Extraction | LLM over transcript + visuals + on-screen text. |
| Source class · fact | INFER · **INFERENCE** |
| Tier · confidence | T4 |
| Decision it drives | Proof diversity; "no proof in any creative → add social proof" (white-space); proof→CVR; **compliance routing** for clinical/results claims. |
| When NOT to trust | Claims of proof aren't validated proof — clinical/results/before-after claims must route to substantiation review, not be trusted as true; below floor → review. |

### CA-I11 · CTA intent (soft vs hard)
| Field | Value |
|---|---|
| Definition | The *ask* strength the creative communicates (distinct from the button, CA-S08). |
| Allowed values | `hard-direct` (buy now) · `soft` (learn/see how) · `content/no-ask` · `lead-capture`. |
| Extraction | LLM over copy + CTA button + closing frames. |
| Source class · fact | INFER · **INFERENCE** |
| Tier · confidence | T4 |
| Decision it drives | Funnel-stage match ("hard-sell to cold audience → mismatch"); CTA-intent diversity. |
| When NOT to trust | The button (CA-S08) is the observed truth — this is the inferred spirit; below floor → review. |

### CA-I12 · Speaker / talent type
| Field | Value |
|---|---|
| Definition | Who is presenting, by role. Fingerprint `speaker`. |
| Allowed values | `none` · `founder` · `customer/UGC` · `employee/expert` · `paid-actor` · `influencer/creator` · `mascot/animated` · `voiceover-only` (calibrate). |
| Extraction | LLM over visuals + transcript + (if available) known-talent match; corroborated with CA-V01 face presence. |
| Source class · fact | INFER · **INFERENCE** (+`speaker_conf`) |
| Tier · confidence | T4 (face presence itself is T2, CA-V01) |
| Decision it drives | Speaker diversity ([06]); "founder-led vs UGC vs actor" — a major DTC lever; speaker→performance; casting brief for next batch. |
| When NOT to trust | Role is rarely visually certain (an actor can play a "customer") — this is a hypothesis; corroborate with production notes; below floor → review. |

### CA-I13 · Creative concept / theme
| Field | Value |
|---|---|
| Definition | The overarching idea/format archetype tying the creative together (the clustering unit). |
| Allowed values | account-specific concept labels + archetypes: `talking-head-testimonial` · `product-demo` · `founder-story` · `listicle/tips` · `problem-agitate-solve` · `unboxing` · `comparison` · `meme/native` (calibrate; extend). |
| Extraction | LLM over the whole creative; also expressed as the `concept` embedding ([24] §5). |
| Source class · fact | INFER · **INFERENCE** |
| Tier · confidence | T4 |
| Decision it drives | Concept diversity/redundancy/white-space ([06]) — "how many distinct ideas are we actually running?"; concept→performance for the produce-more decision ([11][16]); the primary de-dupe/cluster key alongside embeddings. |
| When NOT to trust | Concept taxonomies drift — version them (`model_version`); a forced single label loses hybrids; below floor → review. |

---

# Cross-references & guardrails
- **Diversity coverage:** the attributes above supply every axis [06] measures — persona (I04), problem
  (I05), desire (I06), awareness (I03), hook (I01), angle (I02), concept (I13), format (S01), visual
  (V09), speaker (I12), product (V02), offer (I08), background/environment (V10), message (S06/A02),
  landing (S09), CTA (S08/I11), narrative/structure (A04/V11/I13). If [06] adds an axis, it must trace
  to an attribute here or be added here first.
- **Fingerprint mapping ([05]/[24] §5):** persona=I04, problem=I05, desire=I06, hook=I01, angle=I02,
  format=S01, visual_style=V09, speaker=I12, product=V02, offer=I08, landing=S09; transcript=A02,
  first_3s_summary=A03/A04, scene_count/pacing=V11. `attributes_json` stores the full set above.
- **AUTOPSY targets:** an inferred label taken as fact (any I-attribute without `_conf`); attribute→
  performance conclusions confounded by audience/placement/promo/seasonality (never conclude "hook type X
  wins" from a raw split — that is [05]/[16]'s job with confidence); OCR/ASR error read as certainty.
- **KILLCRITIC targets:** any attribute that drives no decision left on the primary surface (must be
  `descriptive-only — not primary`); a deprecated rule dressed as a benchmark (the **20% text rule is
  gone** — CA-V03); a T3/T4 label shown without confidence or fake-precise ("87% humorous").
- **No fabricated thresholds anywhere:** every bucket edge (duration S04, text density V03, pacing V11,
  copy fold S07) and every confidence-to-action floor is `UNKNOWN / calibrate at build` against a
  human-labelled gold set ([26]), or supplied by the Benchmark Engine ([27]) with source/date/sample/
  confidence. This file asserts *what can be described*, never *what a value should be to win*.
- **Reproducibility:** every extracted attribute is stamped with `model_version` ([24] §5) so labels can
  be recomputed when the extractor changes; re-uploads (same `content_hash`) are not re-analysed.
```
