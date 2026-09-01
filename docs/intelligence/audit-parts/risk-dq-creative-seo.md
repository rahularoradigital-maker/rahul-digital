# Risk Audit — Data Quality, Creative Intelligence, SEO/Public Site

Phase 0, READ-ONLY. No code changed. Evidence tags A/B/C/D per charter §15 (A=code-proven,
B=strong inference from code, C=doc-only claim, D=unverifiable/UNKNOWN). Ratings P0 (blocks trust)
→ P3 (cosmetic). Verdict = MATCH / DRIFT / UNKNOWN vs `docs/intelligence/MASTER-CHARTER.md`.

---

## 1. DATA QUALITY (§55-§58, §79, §128-§130)

There are **two** data-quality engines and the stronger one is not wired.

| # | Finding | Rating | Verdict | Evidence |
|---|---------|--------|---------|----------|
| DQ-1 | **The account-level gate is dead code.** `lib/data-quality.ts` detects MISSING_DAYS, DUPLICATE_ROWS, STALE_DATA, SMALL_SAMPLE, OUTLIER_SPEND, TRACKING_SHIFT, ZERO_DENOMINATOR and exposes `gateRecommendation()` — exactly the §55/§128-130 honesty gate. Grep shows **no caller anywhere**; only its own definition (`lib/data-quality.ts:40,168`). The cockpit instead uses the weaker per-series engine below. | **P1** | DRIFT (§55, §128-130) | A — `grep gateRecommendation` returns only the def; `lib/data-quality.ts:168` |
| DQ-2 | **The wired engine cannot see missing days.** `lib/scoring/data-quality.ts` is the one surfaced in the cockpit (`lib/cockpit/from-store.ts:339`, `lib/meta-sync.ts:488`, `lib/google/cockpit.ts:75`). It flags only small-sample / spend-shock / delivery-gap / outlier / zero-revenue. It counts `rows.length`, never expected-vs-present calendar days: a 5-of-90-day sparse series with >10 purchases reports *"Clean series over 5 day(s)"* (`data-quality.ts:142-143`). Missing days, duplicates, stale sync, timezone, currency, source-mismatch, missing-ads are all undetected here. | **P1** | DRIFT (§55, §79 not-enough-history) | A — `lib/scoring/data-quality.ts:53-63,142-147` |
| DQ-3 | **§79 (unknown ≠ zero) — NOT violated on the paths checked.** Empty series → `smallSample` returns 0 delivery days → **critical**, `reliable=false` (`data-quality.ts:56-57`); it is never scored as healthy. Not-connected returns `{connected:false, reason:"not_connected"}`, a distinct state, **never zeroed metrics** (`lib/app/cockpit-data.ts:40,92,100-102`). `decode.ts` `str()` maps literal `"unknown"`/`"null"` model output to `null`, not a bucket (`decode.ts:32-36`). Not-enough-history is de-rated (warning/critical), not called healthy. | **P2 (good)** | MATCH (§79) | A — `data-quality.ts:56-59`; `cockpit-data.ts:92-102`; `decode.ts:32-36` |
| DQ-4 | **Reconcile counts unknown status as ACTIVE.** `scopes.ts` "Active only" and "Active + purchases" keep on `a.active !== false`, so `null` (status lookup failed) is folded into the active count (`scopes.ts:36,38`). Documented as deliberate ("kept, never hidden", `scopes.ts:11`) but it silently inflates the active-scope spend/ROAS with unknown-status ads — an unknown treated as a definite state in a headline number. | **P2** | DRIFT (§79 edge) | A — `lib/reconcile/scopes.ts:11,36,38` |
| DQ-5 | **No currency / timezone / attribution-basis reconciliation anywhere.** §56-§58 require each metric to declare gross/net, attribution, date basis, timezone, currency and to reconcile *semantics* before numbers. Neither engine models any of these; reconcile only re-scopes one store's rows (`store.ts` aggregates raw `spend/revenue`, no currency field). Multi-account/multi-currency totals would sum blindly. | **P1** | DRIFT (§56-§58) | A/B — `lib/reconcile/store.ts:26-49`; both DQ engines carry no fx/tz field |

**§79 answer: not violated on the verified paths** (empty/not-connected/not-enough-history are all
handled honestly). The real DQ risk is *coverage*, not unknown-as-zero: the engine that would catch
missing-days/dupes/stale (DQ-1) is unwired, and the wired one is blind to them (DQ-2).

---

## 2. CREATIVE INTELLIGENCE (§33-§43, §94, §118)

| # | Finding | Rating | Verdict | Evidence |
|---|---------|--------|---------|----------|
| CR-1 | **No canonical versioned creative taxonomy (§118).** `hookType` is free-text "1-3 words", `emotion` "one word" from the model (`decode.ts:30,64-68`); `str()` accepts any string, no enum enforcement (`decode.ts:32-36`). Diversity buckets on raw model strings, so "social-proof" / "social proof" / "testimonial" fragment into separate buckets and inflate `activeBuckets` / diversity. `sceneType`/`setting` list allowed values in the prompt only, never validated in code. | **P1** | DRIFT (§118) | A — `decode.ts:30,32-36,64-68`; `diversity.ts:76-81` |
| CR-2 | **Diversity does not separate strategic from executional (§94).** `overall` is the unweighted mean of *every* measurable dimension — strategic (funnelStage, hookType, emotion, subject) and executional (format, sceneType, setting, palette, visualMood) mixed equally (`diversity.ts:63-74,135-136`). Palette/setting variety can lift the headline "diversity" number with zero strategic spread. §94 asks for strategic-vs-executional distinction; not implemented. | **P1** | DRIFT (§94) | A — `lib/creative/diversity.ts:63-74,132-136` |
| CR-3 | **Effective (spend-weighted) diversity IS computed (§34).** Per-dimension concentration is HHI over `spendShare`, floor-normalised by bucket count (`diversity.ts:99-110`); competitor comparison weights own side by spend, competitor side by deduped presence (`diversity-vs-competitors.ts:132-133`). This is a genuine match for §34. Caveat: the cross-dimension `overall` average is *unweighted* across dimensions. | **P2 (good)** | MATCH (§34) | A — `diversity.ts:99-110`; `diversity-vs-competitors.ts:132-133` |
| CR-4 | **Fingerprint-once coverage is honest.** Deterministic FNV-1a `contentHash` over media-path+copy+CTA+format (`fingerprint.ts:53-84`); semantic decode cached per hash, copy+visual decoded once, fire-and-forget in background (`decode.ts:76-96,125-145`; `meta-sync.ts:366-397`). `coverage` reports the real share carrying a semantic read (`diversity.ts:163-164`); null buckets are skipped, absent buckets called "untested" not "opportunity" (`diversity.ts:11,86-87`). | **P3 (good)** | MATCH (§35-§43) | A — `fingerprint.ts:73-84`; `diversity.ts:86-87,163-164` |
| CR-5 | **content_hash-null fallback (memory item) — verified safe.** Ads with no creative asset this run get `format:"unknown"` and null semantics rather than being dropped or guessed (`meta-sync.ts` map builds `fpByAd` only when `assets.get(ad.id)` exists; record falls back to `"unknown"`/`null`). `excludeCatalogAds` keeps an asset-less ad rather than guess it away (`fingerprint.ts:99-104`). No null hash is coerced to a shared bucket. | **P3 (good)** | MATCH | A — `lib/meta-sync.ts:366-390`; `fingerprint.ts:99-104` |

---

## 3. SEO / PUBLIC SITE (§16 of SEO plan) — DISCOVERY, risks only

| # | Finding | Rating | Verdict | Evidence |
|---|---------|--------|---------|----------|
| SEO-1 | **Canonical-domain default is inconsistent across files.** `layout.tsx:12`, `sitemap.ts:4`, `robots.ts:3` default `SITE_URL` to `https://rahul-digital.vercel.app`; `llms.txt/route.ts:3` and the OG brand-card default to `https://adscaledigital.co` (memory: canonical = adscaledigital.co). If `NEXT_PUBLIC_SITE_URL` is unset in prod, sitemap/robots/canonical emit the wrong host → split canonical + broken llms/OG cross-refs. | **P1** | DRIFT | A — `app/layout.tsx:12`, `app/sitemap.ts:4`, `app/robots.ts:3` vs `app/llms.txt/route.ts:3`, `app/opengraph-image.tsx:1` |
| SEO-2 | **Brand name drift: code says "AdScale", memory says renamed to AdBrain.** Title, OG, JSON-LD Organization/WebSite/SoftwareApplication all "AdScale AI" (`layout.tsx:13,37-40`); "AdScale" in 57 files, "AdBrain" only in `lib/growth/*`. Public entity signals + llms.txt advertise the old name. | **P1** | DRIFT (memory: adbrain-seo) | A — `app/layout.tsx:13,37-40`; grep AdScale=57 files |
| SEO-3 | **No LocalBusiness / no BreadcrumbList / no Article schema on posts.** Only Organization + WebSite + SoftwareApplication JSON-LD site-wide (`layout.tsx:37-41`). Blog posts carry no Article/author/BreadcrumbList structured data (checked `app/blog/[slug]`). Charter §26/27 entity signals present; richer per-page schema absent. | **P2** | Partial / gap | A — `app/layout.tsx:37-41`; `app/blog/[slug]/` has no ld+json |
| SEO-4 | **Shipped & sound:** dynamic `sitemap.ts` (static + published posts, DB-hiccup degrades to static, `revalidate 3600`), `robots.ts` disallows `/app /api /auth`, per-route OG for home/product/pricing/blog (`app/**/opengraph-image.tsx`), `twitter-image.tsx`, `not-found.tsx`, `/llms.txt`, `robots` metadata grants full snippet/large-image for AI Overviews (`layout.tsx:28`). | **P3 (good)** | MATCH | A — `sitemap.ts:12-33`; `robots.ts:7-10`; `layout.tsx:28` |
| SEO-5 | **Not verifiable in Phase 0 (READ-ONLY):** console errors, JS bundle size, live internal-link graph, real Lighthouse/CWV. Needs a running build. | — | UNKNOWN | D — no runtime in Phase 0 |

---

### Top risks
- **DQ:** DQ-1 (rich gate unwired), DQ-2 (wired engine blind to missing-days/dupes/stale), DQ-5 (no fx/tz/attribution reconciliation).
- **Creative:** CR-1 (no canonical taxonomy), CR-2 (strategic vs executional not separated).
- **SEO:** SEO-1 (domain default split), SEO-2 (AdScale→AdBrain not propagated).
