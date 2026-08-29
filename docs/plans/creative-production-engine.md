# Plan — AdBrain Creative Production Engine
## Shopify → Product/Brand Intelligence → Creative Strategy → AI Static-Ad Generation

A new, **isolated** module inside AdBrain. Built for US DTC brands / agencies spending $1M–$100M/month.
Execute **phase by phase in fresh contexts** — each phase is self-contained (goal, reuse-first build list,
doc/file references, verification checklist, anti-pattern guards). Follow the `adbrain-engineering-os`
skill and the existing gate discipline: every non-trivial pure module ships a `scripts/check-*.ts` wired
into `npm run check:all`; CI runs `lint → build → check:all` on every push. New tables via Supabase MCP
`apply_migration` **and** a mirrored SQL file in `supabase/migrations/`.

**Golden rules (do not violate):** (1) do NOT modify or break existing AdBrain modules; (2) reuse before
building; (3) no API keys in browser code — all privileged calls server-side; (4) never fabricate product
claims or brand facts — mark `UNKNOWN`; (5) keep the image provider behind an interface so the model can
change without a rewrite; (6) generate the *visual* with AI, compose precise *text* deterministically.

---

## PHASE 0 — Allowed APIs + Reuse/Build Map (READ FIRST, verified 2026-08)

### 0.1 Google image generation — VERIFIED (verify the two ⚠️ live before coding)
- **Do NOT use "Nano Banana" as a model id.** It was `gemini-2.5-flash-image` (now legacy).
- **Current model ids** (env-driven; try `-preview` suffix first for 3.x):
  - `gemini-3.1-flash-image-preview` — workhorse (default `IMAGE_MODEL`). ~$0.067/img @1K.
  - `gemini-3-pro-image-preview` — best text-in-image / product-label fidelity. ~$0.134/img @1K.
  - `gemini-2.5-flash-image` — legacy fallback (`IMAGE_FALLBACK_MODEL`). $0.039/img.
- **Endpoint (classic path, matches AdBrain's raw-fetch convention):**
  `POST https://generativelanguage.googleapis.com/v1beta/models/{IMAGE_MODEL}:generateContent`
  header `x-goog-api-key: $GEMINI_API_KEY`; body `contents[].parts[]` with `{text}` and/or
  `{inlineData:{mimeType,data}}`; force image out with `generationConfig.responseModalities:["IMAGE"]`;
  aspect ratio via `generationConfig.imageConfig.aspectRatio`. Output at
  `candidates[0].content.parts[].inlineData.data` (base64) + `.mimeType`.
  - ⚠️ VERIFY LIVE #1: the exact `-preview` suffix for 3.x ids. ⚠️ VERIFY LIVE #2: classic
    `:generateContent` vs the new `/v1beta/interactions` endpoint — Google's own docs are inconsistent.
    Probe each with a 1-image call and confirm HTTP 200 + inlineData before building on it (mirror the
    existing `probeGemini()` diagnostic in `lib/gemini.ts`).
- **Product fidelity:** pass the Shopify product photo as a reference via `inlineData` base64 (request
  total < 20 MB; else Files API). Native aspect ratios: `1:1, 4:5, 9:16` (all our feed/story sizes). `1.91:1`
  is NOT a preset — request `16:9` and crop/pad to 1.91:1 in the composition layer.
- **Text caveat (Google-documented):** models "may misspell / struggle with complex typography." → the
  AI renders background/scene only; headline/CTA/legal text is composed deterministically (Phase 8).
- **Key stays server-side.** Reuse the `x-goog-api-key`-in-header + `fetchWithTimeout` pattern from
  `lib/gemini.ts`. Sources: ai.google.dev/gemini-api/docs/image-generation, /gemini-3, /pricing.

### 0.2 Shopify Admin GraphQL — VERIFIED
- **API version `2026-07`** (or `2026-01` conservative). Endpoint
  `https://{shop}.myshopify.com/admin/api/2026-07/graphql.json` (POST). **REST is legacy — GraphQL only.**
- **Products query:** `products(first:50, after:$cursor){ pageInfo{hasNextPage endCursor} edges{node{ id
  title handle descriptionHtml productType vendor tags status totalInventory onlineStoreUrl
  featuredImage{url altText width height} seo{title description} images(first:10){edges{node{url altText}}}
  variants(first:20){edges{node{ id title price compareAtPrice sku inventoryQuantity availableForSale }}}
  collections(first:10){edges{node{id title handle}}} metafields(first:20){edges{node{namespace key value type}}}
}}}` — paginate on `endCursor` while `hasNextPage`. Product URL = `onlineStoreUrl` or `{domain}/products/{handle}`.
- **Auth (mirror the Meta OAuth flow exactly):** authorize
  `https://{shop}/admin/oauth/authorize?client_id=&scope=read_products&redirect_uri=&state=` → callback with
  `code` → `POST https://{shop}/admin/oauth/access_token` `{client_id,client_secret,code}` → `access_token` →
  send on every request as header `X-Shopify-Access-Token`. **Scope: `read_products`** (+ `read_inventory`
  for stock).
- **Rate limits:** calculated-cost leaky bucket (Standard 100 pts/s, bucket 1000; single query cap 1000
  pts). Read `extensions.cost.throttleStatus.currentlyAvailable` / `restoreRate` and back off. Source:
  shopify.dev/docs/api/admin-graphql, /usage/limits.

### 0.3 Ad format specs — VERIFIED
- **Meta:** 1:1 `1080×1080`, 4:5 `1080×1350` (best performer), 9:16 `1080×1920`, 1.91:1 `1200×628`.
  Stories/Reels **unified safe zone (Mar 2026):** top ~14%, sides ~6%, bottom up to ~35% — keep text/logo
  in the central band.
- **Google RDA:** landscape `1200×628`, square `1200×1200`, portrait `1200×1500` (optional); uploaded
  display core set `300×250, 336×280, 728×90, 300×600, 160×600, 970×250, 320×50, 320×100`.
- **Cross-platform default set** (one asset per ratio): `1080×1080`, `1080×1350`, `1080×1920`, `1200×628`.

### 0.4 Reuse / Build / Extend map (from repo inventory)
| Concern | Verdict | Reuse / template |
|---|---|---|
| Auth (users) | reuse | `lib/app/user.ts` `getCurrentUser()`; route `supabase.auth.getUser()` |
| OAuth + token encryption | reuse pattern | Meta flow `app/api/connect/meta/*`; `lib/crypto.ts` (AES-256-GCM); `lib/oauth-store.ts` |
| Supabase clients / RLS | reuse | `lib/supabase/server.ts`, `admin.ts` (service-role, deny-by-default tables) |
| AI text/JSON | reuse | `lib/gemini.ts` `callGeminiText`, `callGemini(prompt,schema,inline)`, `stringObjectSchema`, `probeGemini` |
| HTTP | reuse | `lib/http.ts` `fetchWithTimeout` |
| Caching | reuse | `lib/cache.ts` `InMemoryCache`, `creative_insights` per-(user,account,type) cache pattern |
| Background sync | reuse pattern | `lib/ingest/ad-metrics.ts` `syncAdMetrics` (idempotent upsert, `*_sync_state`, never-throw, chunked stream) |
| Creative strategy inputs | reuse | `lib/creative/diversity.ts` (`productionQueue`, white-space, format-gap), `lib/scoring/fatigue.ts`, 22-attr taxonomy `lib/competitors/types.ts` `CreativeAttributes`, `ad_metrics` store |
| App shell / nav / tabs / tokens | reuse | `app/app/layout.tsx`, `lib/app/nav.ts` (`NAV_GROUPS`), `components/app/tabs.tsx`, CSS vars in `app/globals.css`, `components/app/control-styles.ts` |
| Gate + migrations | reuse discipline | `check:all` chain; Supabase MCP `apply_migration` + mirrored SQL |
| **Shopify connector** | **BUILD** | none exists (only the `RevenueSource` seam in `lib/connectors/revenue.ts`) |
| **Image GENERATION primitive** | **BUILD** | app only *analyzes* today; new `lib/creative-production/providers/*` |
| **Visual Brand DNA (palette/fonts/logo)** | **BUILD/extend** | `BrandProfile` is text-only; add visual fields extracted from the storefront |
| **Blob/asset storage** | **BUILD** | no Supabase Storage/S3 today — create a bucket |
| **Structured concept/format catalog** | **BUILD** | today an ad-hoc Gemini prompt; make it a typed registry |

### 0.5 Anti-patterns (guard every phase)
- ❌ Passing `nano-banana` / `gemini-2.5-flash-image-preview` as the model. ❌ Hardcoding a model id
  (must be `IMAGE_MODEL` env). ❌ Shopify REST product endpoints. ❌ Hardcoding Shopify version `2025-01`
  (out of support). ❌ Blindly resizing one image into every ratio (must recompose). ❌ Letting the image
  model render precise/legal copy. ❌ Fabricating product claims (mark `UNKNOWN`). ❌ Any key in a client
  component. ❌ Fetching the full catalogue on every page load. ❌ Modifying existing AdBrain files beyond
  additive nav/registration.

### Namespace for everything new
`lib/creative-production/**`, `app/api/creative-production/**`, `app/app/creative-production/page.tsx`,
`components/app/creative-production/**`, `scripts/check-cp-*.ts`, tables prefixed `cp_` /
`shopify_*`. Keeps the module isolated and greppable.

---

## PHASE 1 — Shopify connection (OAuth + URL fallback)
**Goal:** a user connects Shopify (or pastes a store URL); an existing connection is auto-detected.
**Build (mirror Meta OAuth):**
- `app/api/creative-production/shopify/authorize/route.ts`, `callback/route.ts` — copy the structure of
  `app/api/connect/meta/authorize` + `callback`. Env: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`,
  `SHOPIFY_REDIRECT_URI`, `SHOPIFY_SCOPES=read_products,read_inventory`. Validate `state` (CSRF).
- Store the shop domain + encrypted access token: new table `shopify_connections(user_id, shop_domain,
  access_token_encrypted, scopes, status, connected_at)`. Encrypt with `lib/crypto.ts` `encryptToken`;
  read via a `readShopifyToken(userId)` helper modeled on `lib/oauth-store.ts`.
- **URL fallback (B):** if OAuth is not yet approved, accept a `myshopify.com` / custom domain string and
  store `status='url_only'` (no token) so later phases can degrade to storefront-only / manual.
- Auto-detect: on the Creative Studio load, if a `shopify_connections` row exists, show "Connected" — do
  not prompt to reconnect.
**Verify:** OAuth round-trips on a dev store; token lands **encrypted** (decrypts back); re-visiting shows
connected; `state` mismatch is rejected; no secret in any client bundle (`grep SHOPIFY_API_SECRET app/**` →
only server routes).
**Anti-patterns:** ❌ token in plaintext; ❌ token in a NEXT_PUBLIC var; ❌ skipping `state`.

## PHASE 2 — Shopify product sync (Admin GraphQL, cached, incremental)
**Goal:** every product cached locally; fast first load; no repeated full fetches.
**Build (copy the `syncAdMetrics` shape):**
- `lib/creative-production/shopify/client.ts` — `shopifyGraphQL(shop, token, query, vars)` via
  `fetchWithTimeout`; reads `extensions.cost` and paces on `throttleStatus`.
- `lib/creative-production/shopify/sync.ts` — `syncShopifyProducts(userId)`: paginate the Phase-0.2 query
  on `endCursor`; upsert into `shopify_products(user_id, shop_domain, product_id, handle, title,
  description, product_type, vendor, tags jsonb, status, images jsonb, variants jsonb, collections jsonb,
  seo jsonb, metafields jsonb, updated_at)` `onConflict (user_id, product_id)`; write `shopify_sync_state`
  (last_ok/last_error/products_seen). Never throws. Background-safe (`after()`/cron) + `POST
  /api/creative-production/shopify/sync` that **awaits** (hold-connection) with `maxDuration=300` — the
  ad-metrics ingest already proved `after()` is unreliable for multi-minute jobs.
- Incremental: filter `updated_at:>{last_synced}` (Shopify query filter) after the first backfill.
**Verify:** product count in `shopify_products` matches the store; images/variants/prices captured; a
second run does no full re-pull; `extensions.cost` pacing prevents 429s; missing description/image handled
(nullable). Add `scripts/check-cp-shopify-normalize.ts` for the pure normalize step.
**Anti-patterns:** ❌ REST; ❌ full-catalogue fetch per page load; ❌ faking a product count.

## PHASE 3 — Product Intelligence (Product DNA)
**Goal:** a typed Product DNA object per product, grounded, never hallucinated.
**Build:**
- `lib/creative-production/intelligence/product-dna.ts` — pure type `ProductDNA` (id, name, category,
  primaryBenefit, secondaryBenefits[], problemSolved, targetPersona, useCase, keyIngredients[],
  differentiators[], usps[], proof[], claims[], offerEligibility, price, discount, images[], url,
  brandRelevance, creativeOpportunities[], creativeRestrictions[], confidence). Every derived field may be
  `"UNKNOWN"`.
- `deriveProductDNA(product)` via `callGemini(prompt, schema)` — schema-forced JSON; prompt forbids
  inventing claims (reuse the grounding preamble style from `deriveBrandProfile`). Cache per product in a
  `cp_product_dna` table (upsert on `(user_id, product_id)`), like `creative_insights`.
**Verify:** missing data → `UNKNOWN` (not invented); claims trace to the Shopify description; re-run hits
cache. `scripts/check-cp-product-dna.ts` asserts the UNKNOWN-not-fabricate rule on a fixture with sparse data.
**Anti-patterns:** ❌ inventing benefits/proof; ❌ raw description passed downstream unstructured.

## PHASE 4 — Visual Brand DNA + Brand Control Panel
**Goal:** the brand's visual identity (default creative constraint), user-overridable.
**Build (extend, don't replace `BrandProfile`):**
- New `cp_brand_dna(user_id, account_external_id?, shop_domain?, palette jsonb {primary,secondary,bg,text},
  fonts jsonb {heading,body}, logo_url, image_style, design_style, cta_style, tone, density, source,
  version, updated_at)`.
- Extract from the storefront: fetch the homepage/about via `WebFetch`/`fetchWithTimeout` + parse product
  imagery; derive palette/fonts/logo with `callGemini` (vision on a screenshot/hero image) — mark `UNKNOWN`
  where not found. Seed `tone`/`voice` from the existing `BrandProfile`.
- Brand Control Panel component (Phase 11 UI) writes overrides to the same row; "Use Brand Defaults" resets
  to derived values (keep derived + override columns distinct so reset is lossless).
**Verify:** palette/fonts extracted for a real storefront; overrides persist; reset restores derived.
`scripts/check-cp-brand-dna.ts` for the pure merge(derived, override) logic.
**Anti-patterns:** ❌ inventing a palette when none is detectable (mark UNKNOWN + ask the user); ❌
overwriting the existing text `BrandProfile`.

## PHASE 5 — Creative Format Registry + Concept Strategy Engine
**Goal:** a typed catalog of 70–80 static formats, and *ranked, justified* concepts per product.
**Build:**
- `lib/creative-production/formats/concept-registry.ts` — a typed array of the 70–80 concept archetypes
  from the spec (Before/After, Problem/Solution, 5-Star, UGC Quote, Product Hero, Comparison, 3/5 Reasons,
  Ingredient Spotlight, etc.), each `{id, name, awarenessStage, structure, textSlots[], visualPattern,
  bestFor}`. **If the user later supplies a Creative Format Library, that file becomes the source of truth —
  do not overwrite it** (load-if-present pattern).
- `lib/creative-production/strategy/concept-engine.ts` — pure `rankConcepts(productDNA, brandDNA, signals)`:
  score = ProductOpportunity × CreativeWhiteSpace × AudienceNeed × HistoricalPerformance × FormatSuitability
  × BrandFit. Signals reuse `lib/creative/diversity.ts` (`whiteSpace`, `productionQueue`, format-gap),
  `lib/scoring/fatigue.ts`, and the `ad_metrics` store. Then `generateConcepts` fills each ranked archetype
  into a `CreativeConcept` (id, product, persona, problem, desire, awarenessStage, hook, angle, format,
  coreMessage, visualDirection, headline, supportingCopy, cta, offer, whyThisConcept, whyNow, evidence,
  confidence) via `callGemini(schema)`. Store in `cp_concepts`.
**Verify:** concepts are ranked (not random), each carries evidence + confidence + a real white-space/gap
reason; the score is deterministic (`scripts/check-cp-concept-rank.ts` on fixtures). Formats count ≥ 70.
**Anti-patterns:** ❌ random format pick; ❌ concept with no rationale/evidence; ❌ overwriting a supplied library.

## PHASE 6 — Image Provider Abstraction + Generation Engine
**Goal:** provider-independent image generation; UI never knows the provider.
**Build:**
- `lib/creative-production/providers/types.ts` — `interface ImageProvider { generateCreative(brief),
  editCreative(brief, baseImage), generateVariant(brief, parent), getCapabilities(), getCostEstimate(brief),
  getGenerationStatus(id) }` + `GenerationResult {imageBase64, mimeType, provider, model, costUsd,
  promptVersion}`.
- `lib/creative-production/providers/google-gemini.ts` — implements it with the Phase-0.1 classic endpoint
  via `fetchWithTimeout` + `x-goog-api-key`. **Model + fallback are env-driven:** `IMAGE_PROVIDER=google`,
  `IMAGE_MODEL=gemini-3.1-flash-image-preview`, `IMAGE_FALLBACK_MODEL=gemini-2.5-flash-image`. Passes the
  product photo as an `inlineData` reference; sets `imageConfig.aspectRatio`; retries fallback model on
  error (reuse the 429/503 retry shape from `callGemini`).
- `lib/creative-production/providers/registry.ts` — `getImageProvider()` reads `IMAGE_PROVIDER` and returns
  the adapter. The generation engine + all callers depend only on `ImageProvider`.
- Add a `probeImageProvider()` diagnostic (mirror `probeGemini`) to VERIFY the live model id/endpoint (0.1 ⚠️).
**Verify:** one real generation returns a base64 image; switching `IMAGE_MODEL` needs no code change; a bad
model id falls back; cost estimate returns a number. `scripts/check-cp-provider.ts` asserts the interface +
env-driven selection (with a stub provider — no network in the check).
**Anti-patterns:** ❌ hardcoded model; ❌ UI importing the Google adapter directly; ❌ key in client.

## PHASE 7 — Ad Format Registry + Generation Brief + Product Fidelity
**Goal:** canonical output formats (verified dims) + a structured brief the provider consumes; product stays accurate.
**Build:**
- `lib/creative-production/formats/format-registry.ts` — typed `AdFormat {id, platform, name, width, height,
  aspectRatio, purpose, safeZone, textConstraints, exportFormat, version, source}` seeded with the Phase-0.3
  verified sizes (Meta 1080², 1080×1350, 1080×1920, 1200×628; Google 1200×628/1200×1200/1200×1500 + core
  display set). `source` cites the doc; `version` lets specs update.
- `lib/creative-production/generation/brief.ts` — `GenerationBrief` (brandDNAId, productDNAId, formatId,
  conceptId, hook, angle, offer, visualDirection, typography, colors, composition, aspectRatio, text{...},
  restrictions, requiredProductFidelity, negativeInstructions, referenceImages[]). Compact: send **ids +
  only the needed fields**, not whole objects (Phase 10 token rule).
- Product fidelity: always attach the product photo as reference; after generation, a fidelity check
  (Phase 9) flags "product fidelity risk" → offer Regenerate / Edit / Use original cutout / Cancel.
**Verify:** dims match the sources; 1.91:1 produced by requesting 16:9 + crop; brief carries reference image.
`scripts/check-cp-format-registry.ts` asserts every format's dims/ratio against the verified table.
**Anti-patterns:** ❌ dims from memory; ❌ omitting the reference image; ❌ sending whole DNA blobs in the brief.

## PHASE 8 — Deterministic Composition + Format Adaptation + Export + Blob Store
**Goal:** AI visual + deterministic text/logo overlay; recompose per ratio; store + export.
**Build:**
- `lib/creative-production/composition/*` — compose the final ad = AI background (Phase 6) + HTML/SVG
  typography (headline/subhead/CTA/offer/legal) + product cutout + logo, rendered to PNG at the exact
  format px. (Server-side render: an SVG/`@napi-rs/canvas`/`satori`-style layer — pick one, keep it behind
  a `composeAd(brief, aiVisual)` function; provider-independent.)
- **Format adaptation:** per ratio, a composition rule set (not a blind resize) — reposition product,
  headline hierarchy, CTA, logo; honor the Phase-0.3 **safe zones** (esp. 9:16 central band).
- **Blob storage:** create a Supabase **Storage bucket** `cp-assets` (private; signed URLs). Store the AI
  visual, each composed format PNG, and the product cutout. (First storage in the app — add the bucket via
  MCP + document it.)
- Export: signed-URL download per asset + a "download all (zip)" server route.
**Verify:** the same concept yields correctly-composed 1:1 / 4:5 / 9:16 / 1.91:1 (not stretched); text is
crisp (deterministic, not model-rendered); 9:16 keeps content in the safe band; assets land in the bucket;
export downloads. `scripts/check-cp-adaptation.ts` for the per-ratio layout math + safe-zone rule.
**Anti-patterns:** ❌ one image stretched to all sizes; ❌ text baked by the image model; ❌ public bucket.

## PHASE 9 — Creative QA Engine
**Goal:** no asset is `READY` until automated QA passes.
**Build:** `lib/creative-production/qa/qa-engine.ts` — pure `runQA(asset, brief, brandDNA): QAResult
{status: "READY"|"FAILED"|"REVIEW", checks[]}`. Checks: aspect-ratio/resolution match, safe-zone respected,
text present & matches the approved copy (compare composed strings — deterministic, so exact), CTA/offer
present, brand-color presence, contrast/legibility (WCAG ratio on text vs bg), product-fidelity flag
(from Phase 7), file size within platform max. A critical failure ⇒ `FAILED`; soft issues ⇒ `REVIEW`.
**Verify:** a wrong-ratio or low-contrast asset is `FAILED`; a clean asset is `READY`.
`scripts/check-cp-qa.ts` on pass/fail fixtures.
**Anti-patterns:** ❌ marking READY on a failed critical check; ❌ QA that only inspects the AI visual, not
the composed asset.

## PHASE 10 — Storage model, Versioning, Cost control, Token optimization
**Goal:** full lineage, no wasted generations, minimal tokens.
**Build:**
- Tables: `cp_generations` (request: brief id refs, provider, model, prompt_version, cost_usd, status,
  created_at), `cp_assets` (creative_id, version, parent_creative_id, concept_id, product_id, generation_id,
  format_id, brand_dna_version, product_dna_version, storage_path, qa_status, approval_status, edits jsonb,
  created_at). **Never overwrite the original** — new version rows.
- Cost control: `getCostEstimate(brief[])` (Phase 6) → show count × per-image cost + est. time **before**
  generating; block runaway batches; **dedup** — hash the brief (reuse `fnv1a` from
  `lib/creative/fingerprint.ts`); an identical brief returns the cached asset, no re-generation.
- Token optimization: pass **ids** (BrandDNA/ProductDNA/Concept/Format/Brief) + only required fields; cache
  stable context (reuse `lib/cache.ts`).
**Verify:** regenerating an unchanged brief is a cache hit (0 cost); a new version links to its parent; cost
shows before generation. `scripts/check-cp-brief-hash.ts` (stable hash) + `check-cp-cost.ts`.
**Anti-patterns:** ❌ overwriting originals; ❌ regenerating identical briefs; ❌ whole-catalogue in a prompt.

## PHASE 11 — UI: Creative Studio
**Goal:** the end-to-end workflow, in the existing shell.
**Build (reuse shell/nav/tabs/tokens):**
- `app/app/creative-production/page.tsx` + one `NAV_GROUPS` entry in `lib/app/nav.ts` + `<Tabs>` for
  sub-views. Styled only with existing CSS vars + `control-styles`.
- Top: Brand (control panel), Shopify connection status, Product selection, Offer, Generate.
- Product grid: image, name, price, short desc, product score, creative-opportunity score, current ad
  status (from `ad_metrics`/leaderboard), checkbox. **Max 10** — block the 11th with an explanation.
- Auto product recommendation (§11 of spec): reuse `ad_metrics` + diversity white-space + fatigue to rank
  which products to advertise; each with Why / Evidence / Confidence / creative opportunity (never just
  best-seller).
- Workflow steps 1–10 (Select product → concept → brief → brand → offer → generate → review → edit →
  variants → export). Filters: product / concept / format / platform / status (Approved/Rejected/Review/
  Failed QA).
- Editor (on asset click): preview, product, concept, headline, copy, offer, font, colors, logo,
  background, format, platform; Generate Again / Create Variant / Download / Approve / Reject.
- **"Why this creative?" panel:** why product / concept / format / hook / offer, what data influenced it,
  which creative gap it fills, confidence — sourced from Phases 3/5 + `ad_metrics` (connects generation to
  AdBrain's intelligence).
- Human review: Approve/Reject/Edit/Regenerate/Save/Export on every asset; nothing auto-generates dozens of
  images without approval (cost gate from Phase 10).
**Verify:** the whole flow runs for 1, 5, 10 products; 11th product blocked; "why" panel populated; approve/
reject/export work; provider is invisible in the UI.
**Anti-patterns:** ❌ new design system; ❌ importing a provider adapter in a client component; ❌ >10 products.

## PHASE 12 — Error handling, QA-loop testing, learning-loop seam, 10× review
**Build/verify:**
- Graceful fallbacks for: Shopify unavailable / expired token (re-auth prompt), missing products/images,
  rate limits (pace), generation failure/timeout/provider outage (fallback model, retry, honest error),
  invalid image, storage/export failure. **Never freeze the UI.**
- Run the QA loop end-to-end with the spec's test matrix: 1/5/10 products, missing image, missing
  description, no brand data, no offer, very long name, very long offer, multiple variants, API failure,
  generation failure, provider unavailable. Run it **twice**.
- Learning-loop **seam only** (do not build the full loop): store enough lineage (Phase 10) that a future
  job can join `cp_assets` → published ad → `ad_metrics` performance, and enforce §31 (correlation ≠
  causation: record observed pattern + hypothesis + evidence strength + alternative + confidence, never a
  bare "the blue background caused it").
- 10× review (§36): after the first working slice, list the highest-value improvements and implement only those.
**Verify:** each failure mode degrades gracefully; the two full QA passes are green.

## FINAL PHASE — Verification against the 38 quality gates
Walk the spec's §38 checklist and the FINAL TEST literally. For each gate, cite the file/route/check that
satisfies it. Confirm: existing AdBrain untouched (`git diff` touches only new `creative-production` / `cp_`
paths + the single `nav.ts` line), `npm run build` green, `npm run check:all` green (with all new
`check-cp-*` added to the chain), API keys server-only, dims match sources, assets recomposed not resized,
QA gates enforced, versioning + cost + dedup present, "why" panel live, 1/5/10-product flows tested twice.

### Smallest production-ready vertical slice (build first, then widen)
Phases 1→2→3(minimal)→6→7(1 format)→8(1 ratio + text overlay)→9→11(minimal)→export. i.e. **connect Shopify
→ sync products → 1 product's DNA → generate one 1:1 static with deterministic headline/CTA → QA →
approve → export.** Prove that end-to-end, then add concept ranking (5), brand DNA (4), multi-format
adaptation (8), recommendations + full Studio (11), cost/versioning (10). Do not build all 12 phases before
the first slice runs.
