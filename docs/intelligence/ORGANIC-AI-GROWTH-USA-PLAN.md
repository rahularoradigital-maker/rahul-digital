# AdScale — Organic Traffic + AI-Results Growth Plan (USA market)

**Question this answers:** what else can we do to get organic traffic and rank AdScale in the USA
market — in AI answers (ChatGPT, Perplexity, Claude) and Google AI Overviews — organically?

**Prepared:** 2026-09-16. Grounded in a live audit of `/Users/lyxelflamingo/adbrain-mvp` + a
sourced 2026 best-practices research pass (sources cited inline; full list at bottom).

---

## The one finding that reorders everything

AdScale's **on-page AEO is already strong** (direct-answer intros, tables, cited stats, FAQ + FAQPage
on all 15 posts, Organization/WebSite/SoftwareApplication/BlogPosting/Breadcrumb JSON-LD, live
/llms.txt, AI-crawler-friendly robots.txt). More on-page tweaking has **diminishing returns**.

The evidence says the binding constraint is now **OFF-PAGE and ENTITY signals**:
- Web **brand mentions correlate with AI-Overview inclusion ~3x more than backlinks** (Ahrefs 75k-brand
  study, via citeflow.io/blog/brand-mentions-vs-backlinks, 2025).
- **~82-94% of AI citations come from earned, non-brand-owned sources** (Muck Rack 2025-12, via
  authoritytech.io).
- To rank in the **US**, you need **US-based mentions/links + US-localized content**; authority does not
  transfer across borders (seojetty.com international-seo, 2026).
- **ChatGPT gates on the Bing index** — not in Bing = near-zero chance of citation (subscribepr.com, 2026).

**So the plan has two tracks:**
- **CODE TRACK (Claude can do):** fix the on-page gaps the audit found, add entity/E-E-A-T scaffolding,
  US-localize, expand the BOFU content cluster, build an original-data citation magnet, wire measurement.
- **FOUNDER TRACK (only Rahul can do — the bigger lever):** free directory listings, Bing Webmaster,
  US digital PR / brand mentions, founder LinkedIn/X/YouTube, authentic Reddit/Quora. Claude can draft
  every asset, but the accounts and the publishing are Rahul's.

Honest expectation: this is a **3-6 month compounding play**, not a switch. Organic + AI ranking for a
new, non-US brand is earned, not deployed.

---

## Anti-patterns to prevent (do NOT do these — each is sourced)

- **Do NOT buy or fabricate brand mentions / reviews / backlinks.** Google says pursuing inauthentic
  mentions "isn't as helpful as it might seem" and it risks penalties. (Google AI optimization guide.)
- **Do NOT add fake schema** (aggregateRating, Offer/price, awards) to chase stars. Keep the existing
  honesty policy. Google FAQ *star* results were removed in 2026 anyway — FAQ schema's value is LLM
  extraction, not Google stars.
- **Do NOT rely on llms.txt for Google benefit** — Google ignores it ("neither harm nor help"). Keep it
  (harmless, some non-Google tools read it); do not invest more in it.
- **Do NOT chase a word-count target.** 3,000-5,000-word figures are correlation, not a rule. Depth to
  fully answer beats length.
- **Do NOT ship thin programmatic pages.** Google's helpful-content/spam rules punish mass-produced thin
  content. Any templated page must carry real, unique data.
- **Do NOT rely on hreflang alone** for the US, and do NOT expect India-audience backlinks to move US
  SERPs.
- **Do NOT invent statistics** for the original-data asset. Only ship aggregated, real, anonymized
  numbers, and only when there is enough data to be honest (project rule).

---

## PHASE 0 — Discovery (DONE; this section is the baseline)

**Current state (from the live audit):**
- Schema live: Organization/WebSite/SoftwareApplication (`app/layout.tsx:44-46`), BlogPosting +
  BreadcrumbList + conditional FAQPage (`app/blog/[slug]/page.tsx:45-78`), Breadcrumb + FAQPage on
  `/product` and `/pricing`.
- 15 curated articles (`lib/blog/curated-articles.json`), all with `faq` now; hybrid file+DB blog
  (`lib/growth/articles.ts`).
- robots.ts names 12 AI/search agents; sitemap.ts dynamic; /llms.txt live.
- GA4 present (`components/google-analytics.tsx`), GSC verification gated on `GOOGLE_SITE_VERIFICATION`
  (not set), global `index,follow` + `max-image-preview:large` robots meta (`app/layout.tsx:31`).

**Gaps the audit found (these drive Phases 1-2):**
1. **Broken pillar hub:** every spoke links "Part of: → `how-to-decide-what-to-change-in-meta-ads`", but
   that article does not exist in curated content → link 404s unless a DB row backs it.
   (`app/blog/[slug]/page.tsx:13`.)
2. **No named author / Person schema** — author is Organization "AdScale team"
   (`app/blog/[slug]/page.tsx:56,92`). Weak E-E-A-T for an ad-spend (YMYL-adjacent) topic.
3. **No Organization `sameAs`** → weak entity graph.
4. **Nav omits `/product` and `/integrations/*`** (`components/site-header.tsx`/`site-footer.tsx`) →
   weak internal links to money pages.
5. **No US-localized content**, no `/about` / founder page.
6. **GSC + Bing not verified** (Bing = the ChatGPT gate).
7. **`NEXT_PUBLIC_SITE_URL` fallback differs across files** (rahul-digital.vercel.app vs
   adscaledigital.co) — latent canonical/OG mismatch if the env var is ever unset.

---

## PHASE 1 — On-page fixes that unblock ranking (CODE, buildable now)

**What to implement**
1. **Fix the pillar hub.** Either (a) write the pillar article `how-to-decide-what-to-change-in-meta-ads`
   as a real curated article in `lib/blog/curated-articles.json` (comprehensive hub that links down to
   all 15 spokes), OR (b) remove the `PILLAR_SLUG` up-link until the hub exists. Prefer (a) — a real
   pillar is a topical-authority asset (digitalapplied.com content-clusters, 2026). Copy the existing
   article shape (id/slug/title/topic/dek/body_md/status/published_at/faq) from any entry in that file.
2. **Add money pages to nav/footer.** In `components/site-header.tsx` + `components/site-footer.tsx` add
   links to `/product` and `/integrations/meta` + `/integrations/google-ads`, matching the existing link
   pattern in those files.
3. **Unify the `NEXT_PUBLIC_SITE_URL` fallback** to `https://adscaledigital.co` in all 9 files that use
   it (audit lists them) so canonical/OG/sitemap never disagree.
4. **Provision verification env vars** (Rahul sets values in Vercel; code path already exists):
   `GOOGLE_SITE_VERIFICATION` (`app/layout.tsx:32-34`) and add a Bing equivalent
   (`msvalidate.01` meta) the same env-gated way.

**References:** audit file:lines above; content-cluster rationale
digitalapplied.com/blog/seo-content-clusters-2026-topic-authority-guide (2026).

**Verification checklist**
- `grep -rn "how-to-decide-what-to-change-in-meta-ads" lib/blog/curated-articles.json` returns the new
  pillar (option a), OR the PILLAR_SLUG up-link is gone (option b).
- `/product` and both `/integrations/*` appear in header/footer (grep the components).
- `grep -rn "rahul-digital.vercel.app" app/` returns zero.
- `npx tsc --noEmit` clean; `npm run check` 183/183 green; `npm run build` exits 0.
- Live: pillar article returns 200 and each spoke's "Part of:" link resolves.

**Anti-pattern guards:** do not invent a pillar body from nothing — ground it in the 15 spokes' real
content. Do not add schema types not already used. Do not touch `/app/*` (private).

---

## PHASE 2 — E-E-A-T + entity signals (CODE scaffolding + Rahul inputs)

**What to implement**
1. **Named author + Person schema.** Add an `author` field to the Article type (`lib/growth/articles.ts`)
   and to curated articles; render a real byline + link an author bio, and emit a `Person` JSON-LD with
   `name`, `jobTitle`, `sameAs` (the author's real LinkedIn/X), replacing the hardcoded Organization
   author in `app/blog/[slug]/page.tsx:56`. **Needs Rahul: whose byline + real profile URLs.**
2. **`/about` (founder) page** with the founder's real media-buying experience (first-hand E-E-A-T) +
   Person/Organization schema. **Needs Rahul: bio + a photo + credentials.**
3. **Organization `sameAs`** in `app/layout.tsx` pointing to AdScale's real LinkedIn company page, X,
   Crunchbase, G2 (added as those are created in Phase 5). **Needs Rahul: the real URLs — never fabricate.**

**References:** Google AI optimization guide (people-first, experience); junaidimtiaz.us SaaS guide 2026
(named credentialed authors weighted); Ahrefs brand-signal data via citeflow.io.

**Verification checklist**
- BlogPosting `author` is `Person` with a real `sameAs`, not Organization (view-source JSON-LD).
- `/about` returns 200 and emits Person + Organization schema.
- Rich Results Test passes for Person, Organization (with sameAs), BlogPosting.
- tsc + `npm run check` + build green.

**Anti-pattern guards:** never invent a person, credential, photo, or profile URL. If Rahul has not
supplied a real byline, keep "AdScale team" rather than fabricate a persona.

---

## PHASE 3 — US-market localization (CODE + content)

**What to implement**
1. **US-localize marketing + article copy:** US spelling (optimize not optimise, etc.), USD-first
   examples and dollar figures in article bodies, US-market framing ("US D2C brands", US platforms).
   Marketing pricing is already USD-first (`components/marketing/pricing-tiers.tsx`) — extend the US
   convention into article examples and any new content.
2. **US case-study / example framing** on `/product` and 2-3 cornerstone articles (real or clearly
   hypothetical, never fabricated as a real customer).
3. **US CDN edge / IP presence** (weak-but-real geo signal now that Search Console country targeting is
   gone). Vercel already serves from a global edge; confirm US edge coverage — no migration needed.
   .co vs .com is minor; **keep adscaledigital.co**, use subfolders (never subdomains) if any
   localization is added later.

**References:** elementor.com international-seo 2026 (US conventions); incremys.com international-seo
2026 (country targeting deprecated, IP/hosting a residual signal, subfolders > subdomains);
seojetty.com 2026 (US mentions are the decisive geo lever — see Phase 5).

**Verification checklist**
- Spelling pass: `grep -riE "optimis|colour|behaviour|centre" lib/blog/ app/` reviewed and US-ified where
  in visible copy.
- USD appears in article examples; no ₹-only examples in US-targeted posts.
- Live pages serve from a US edge (check response headers / a US-based check).

**Anti-pattern guards:** do NOT migrate domains or add hreflang-only "solutions" expecting US rank — US
authority (Phase 5) is what moves US SERPs. Do not fabricate US customer names/logos.

---

## PHASE 4 — BOFU content cluster expansion (content; Claude drafts, Rahul approves)

**What to implement** — the content types that win BOTH classic rankings and AI citations:
1. **Organize the 15 spokes into 2-3 pillars** (e.g. "Meta ads optimization", "Google Ads decision
   intelligence", "Ad metrics + economics") with the Phase-1 pillar hub(s) at the center.
2. **Write bottom-of-funnel, high-intent pages** (highest revenue-per-page for a pre-launch brand):
   - "X vs Y" comparisons (e.g. AdScale vs [category tools], Meta vs Google for D2C).
   - "Best [category] tools for [ICP]" / "[competitor] alternatives" listicles (honest, inclusive).
   - Problem-aware pages matching how buyers ask AI (question-format titles).
3. **Keep the winning template** (from the AEO doc): direct-answer intro, question H2s, tables, cited
   stats, FAQ + FAQPage. Add named author (Phase 2).
4. **Quarterly refresh** of stats/screenshots on top pages (freshness is a citation signal).

**Proposed first 5 (question-format, US-intent):** see the AI-Citation Approach doc. Recommend starting
with 3 BOFU comparison/alternatives pages + 2 high-volume question pages.

**References:** madx.digital SaaS content 2026 + fungies.io 2026 (BOFU comparison/alternatives convert +
get cited); clustea.com + digitalapplied.com 2026 (clusters → topical authority); Princeton GEO
arXiv:2311.09735 (stats/quotes/citations +30-40% AI citation).

**Verification checklist**
- Each new article: direct answer in first ~200 words, ≥1 table, ≥2 cited external stats with real URLs,
  3 FAQ Q&As, links to its pillar + 2-3 siblings.
- Pillars link down to every spoke; spokes link up (no broken PILLAR_SLUG).
- tsc + check + build green after each batch; live-verify FAQPage emits.

**Anti-pattern guards:** ground every stat in a real, live source URL (no invented numbers); comparison
pages must be honest (do not disparage or fabricate competitor facts); no thin programmatic pages.

---

## PHASE 5 — Off-page + entity (FOUNDER TRACK — the biggest lever; Claude drafts assets)

**This is where the ranking actually comes from for a new US-targeting brand.** Claude can draft every
listing, post, and pitch; Rahul owns the accounts and hits publish.

**What to do (ranked by ROI for a no-backlink brand):**
1. **Free directory listings** on G2, Capterra, GetApp, TrustRadius, Product Hunt, SourceForge,
   Crunchbase. DR-90 domains, cited heavily by AI, rank for "best/alternatives". (distribb.io,
   outreachdesk.com 2026.) — Claude drafts the profiles.
2. **Bing Webmaster Tools** — submit the site + sitemap. This is the ChatGPT/Copilot citation gate.
   (subscribepr.com, docdigitalsem.com 2026.)
3. **Original data / proprietary stat** others cite (also Phase 6): the single most link-and-citation
   -earning SaaS asset.
4. **US digital PR / earned mentions** — Qwoted / Featured (HARO successors), founder commentary pitched
   to US marketing publications. Earned media = ~82-94% of AI citations. (emgigroup.com 2026,
   authoritytech.io 2025-12.)
5. **Founder-led LinkedIn/X + a YouTube explainer channel.** YouTube is the most-cited domain in AI
   Overviews (Ahrefs/everything-pr 2026) — disproportionate value. — Claude drafts scripts/posts.
6. **Authentic Reddit/Quora participation** in ad-buying communities (draft-only, genuinely helpful,
   never spam — project rule).

**References:** citeflow.io brand-mentions-vs-backlinks; outreachdesk.com + distribb.io SaaS link
building 2026; subscribepr.com Bing 2026; emgigroup.com PR 2026.

**Verification checklist (Rahul-owned):**
- Live listing URLs on G2/Capterra/Product Hunt/Crunchbase (→ feed them into Organization `sameAs`,
  Phase 2).
- Site verified + sitemap submitted in Bing Webmaster; pages indexed in Bing.
- A running log of earned mentions (unlinked counts too).

**Anti-pattern guards:** never buy fake reviews/mentions; never astroturf Reddit/Quora; all community
posts are drafts Rahul reviews (project rule).

---

## PHASE 6 — Original-data citation magnet (CODE + data; honesty-gated)

**What to implement:** a public "AdScale benchmarks" page built from **real, aggregated, anonymized**
account data (e.g. median CPA/ROAS/CTR/frequency by vertical), refreshed periodically. This is the asset
that earns citations and links no competitor can copy (Princeton GEO + distribb.io).

**Gate:** only ship when there are **enough connected accounts to publish an honest aggregate** without
exposing any single advertiser. Until then, do not fabricate benchmarks (hard project rule — no universal
benchmarks, explicit uncertainty).

**Verification checklist:** every number traces to real aggregated data; k-anonymity threshold enforced
(minimum N accounts per cell); page emits Dataset/Article schema; "how we calculated this" methodology
shown.

**Anti-pattern guards:** no invented numbers; no single-account leakage; label sample size + date.

---

## PHASE 7 — Measurement (CODE, ~1 day)

**What to implement**
1. **GA4 custom "AI Tools" channel group** with a Source regex (chatgpt.com, perplexity.ai,
   gemini.google.com, copilot.microsoft.com, claude.ai) placed above Referral — GA4 misfiles 60-70% of
   AI traffic as Direct/Referral by default. (nicelookingdata.com 2026.) Highest-ROI measurement fix.
2. **GSC Performance → Search appearance:** track AI Overview + AI Mode impressions/CTR (available 2026).
3. **Monthly manual prompt-tests:** run the target questions through ChatGPT Search, Perplexity, Claude,
   Google AI Mode; log whether AdScale is cited. Cheapest citation tracker.
4. **Accept the ceiling:** Google AI Mode uses `noreferrer` and ~82-88% of Perplexity citations are
   zero-click — judge success by **citation presence + branded-search lift**, not referral sessions alone.
   (nicelookingdata.com, authoritytech.io 2026.)

**Verification checklist:** GA4 shows an "AI Tools" channel with sessions; GSC AI-appearance rows visible
once verified; a monthly citation log exists.

**Anti-pattern guards:** don't over-invest in a paid AI-visibility tracker (Ahrefs Brand Radar / Semrush)
until there is traction — the free stack above covers the pre-launch stage.

---

## FINAL PHASE — Verification (roll-up)

- On-page: tsc + `npm run check` (183/183) + `npm run build` green after every code phase; live-verify
  each change on adscaledigital.co (project rule: test on the live app).
- Rich Results Test passes for Organization (with sameAs), Person, BlogPosting, FAQPage.
- Pillar/spoke internal links all resolve (no PILLAR_SLUG 404).
- Bing: site verified + indexed. GSC: verified + AI-appearance visible.
- Off-page: live directory listings + a growing earned-mentions log.
- Measurement: GA4 AI channel live; monthly citation log started.

---

## Sequencing recommendation (what to do first)

1. **Phase 1** (quick code wins: fix pillar hub, nav money-page links, SITE_URL, verification env) — days.
2. **Phase 5 kickoff in parallel** (Rahul: create G2/Capterra/Product Hunt/Crunchbase + Bing Webmaster —
   Claude drafts all profiles) — this is the biggest lever and has the longest lead time.
3. **Phase 2** (named author + `/about` + sameAs — once Rahul supplies byline + real URLs).
4. **Phase 7** (measurement — so later phases are measurable).
5. **Phase 4** (BOFU cluster + pillars) ongoing.
6. **Phase 3** (US localization) folded into Phase 4 writing.
7. **Phase 6** (benchmarks) when data volume allows.

---

## Decisions this plan needs from Rahul
1. **Author identity** for E-E-A-T (whose byline + real LinkedIn/X + a bio) — Phases 2/5.
2. **Green-light Phase 1** code fixes (safe, buildable now).
3. **Off-page accounts:** confirm he'll create the G2/Capterra/Product Hunt/Crunchbase/Bing accounts
   (Claude drafts everything to paste).
4. **BOFU topics:** pick the first 3-5 (comparison/alternatives + question pages).

---

## Sources
Google Search Central AI optimization guide; Princeton GEO (arXiv:2311.09735, KDD 2024); Ahrefs 75k-brand
study (via citeflow.io); Muck Rack earned-media (via authoritytech.io); subscribepr.com / docdigitalsem.com
(Bing); seojetty.com / incremys.com / elementor.com (international SEO); madx.digital / fungies.io /
digitalapplied.com / clustea.com (content strategy); nicelookingdata.com / authoritytech.io (measurement);
distribb.io / outreachdesk.com / emgigroup.com (off-page). Full URLs in the research appendix.

*All on-page claims verified against the live repo audit 2026-09-16. No fabricated data or metrics.*
