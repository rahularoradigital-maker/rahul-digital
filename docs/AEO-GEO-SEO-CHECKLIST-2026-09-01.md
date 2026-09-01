# AEO / GEO / SEO checklist — 45 items from ~30 recent credible sources (2026-09-01)

Built from 5 parallel research passes over Google Search Central, the Princeton/KDD-2024 GEO paper,
Ahrefs (incl. the 75,000-brand study), Semrush, Search Engine Land, Search Engine Journal, Backlinko,
Microsoft/Bing, and schema specialists. Each item is flagged:

- **DURABLE** = a fundamental of how search/AI works; still true in ~5 years. **FAD** = tied to a proposal or
  vendor feature that may not survive.
- **Status on AdBrain:** ✅ done · 🟡 partial · 🔴 gap.
- **Owner:** [CODE] I can ship it · [YOU] needs your real data · [OFF] off-page, a person must do it.

The one-line truth from the research: **AI visibility ≈ 80% good fundamental SEO + being genuinely cited
across the web. Off-page brand mentions correlate ~3x stronger than backlinks and stronger than any
on-page tweak — and that part cannot be coded.** Don't over-optimize; one study found heavy "GEO
treatment" scored *worse* than the untouched page.

---

## A. Technical foundation (the floor — highest durability)
1. **[CODE ✅ DURABLE]** Server-render content so crawlers/AI read it without running JS. (Next.js SSR — done.)
2. **[CODE ✅ DURABLE]** Keep money pages crawlable/indexable; no accidental noindex. (Done; /app /api /auth disallowed.)
3. **[CODE 🟡 DURABLE]** XML sitemap with REAL `lastmod` timestamps, referenced in robots.txt. (Sitemap done; add lastmod to static pages.)
4. **[CODE ✅ DURABLE]** One self-referencing canonical per page; force https + one host. (Done.)
5. **[CODE ✅ DURABLE]** HTTPS everywhere. (Done.)
6. **[CODE 🟡 DURABLE]** Pass Core Web Vitals at p75 (LCP <2.5s, INP <200ms, CLS <0.1). (Verify with PageSpeed; only ~48% of sites pass — a real differentiator.)
7. **[CODE ✅ DURABLE]** Mobile-first / responsive. (Done.)
8. **[CODE 🔴 DURABLE]** Explicitly ALLOW legit AI crawlers in robots.txt (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended); block only aggressive scrapers (Bytespider). Re-audit quarterly. (Currently allowed via wildcard; make it explicit.)
9. **[CODE ✅ DURABLE]** Crawlable `<a href>` pagination/nav to deep pages; no JS-only "load more". (Done.)

## B. Structured data / schema (entity clarity, NOT an AI trick)
> Google officially says schema is NOT required for AI Overviews. Value = entity clarity + the rich results still live.
10. **[CODE ✅ DURABLE]** Organization schema (name, logo, url, description). (Done — enrich below.)
11. **[CODE 🟡 DURABLE]** WebSite schema — keep `name`/`url`; **DROP any SearchAction** (Sitelinks Searchbox retired Nov 2024). (Have name/url; no SearchAction — good.)
12. **[CODE 🔴 DURABLE]** SoftwareApplication on /product with real `offers` (no fake ratings). (Site-wide only now; add to product page.)
13. **[CODE ✅ DURABLE]** BlogPosting/Article on every post (headline, author, image, dates). (Done.)
14. **[CODE ✅ DURABLE]** BreadcrumbList on templated pages (still a live rich result). (On articles; extend site-wide.)
15. **[CODE 🔴 DURABLE]** Person/Author schema tied to Article `author` `@id` (name, jobTitle, worksFor, sameAs, knowsAbout). (Missing — author is the Org.)
16. **[CODE 🟡 FAD-for-stars]** FAQPage schema — add for LLM parsing ONLY. **Google FAQ rich result was removed May 2026** — expect zero SERP stars. (Not present; low priority.)
17. **[SKIP — deprecated]** HowTo schema (rich result gone), Book/Course/ClaimReview/Salary/etc. (June 2025 batch). Don't build.

## C. Content structure for AI extraction
18. **[CODE ✅ DURABLE]** Answer the question in the first 1-2 sentences / ~40-60 words under each heading (inverted pyramid). ~55% of AI citations come from the top 30% of the page. (Done — "Quick answer" boxes.)
19. **[CODE 🟡 DURABLE]** Question-based H2/H3 headings ("What is X?" not "About X"). (Partial — tighten across posts.)
20. **[CODE ✅ DURABLE]** Self-contained chunks: one idea per section, no "as above", define terms in-section. (Mostly done.)
21. **[CODE ✅ DURABLE]** Short paragraphs (2-4 sentences), bullet lists, and REAL HTML tables for comparisons. (Done; add more tables.)
22. **[CODE 🔴 DURABLE-pattern]** FAQ section (visible Q&A) on homepage/product + key posts — matches conversational AI queries. (Missing.)
23. **[CODE 🟡 DURABLE]** Depth that fully satisfies intent (guides often 1,500-2,500+ words) — but word count is an OUTPUT, not a target. Density of extractable claims > raw length. (Posts are ~700w — thin on facts; deepen with real data, not padding.)
24. **[CODE ✅ DURABLE]** Consistent term per concept; Title ≈ H1; never bury answers in tabs/accordions/images/PDF. (Done.)

## D. GEO on-page levers (the Princeton paper's top findings)
25. **[CODE 🔴 DURABLE]** Add real, sourced STATISTICS to claims (+~37-41% in the study). Pages with 19+ data points ≈ 2x citations. Use only real, cited numbers. (Missing — biggest content gap.)
26. **[CODE 🔴 DURABLE]** Add direct QUOTES from named experts. (Missing.)
27. **[CODE 🔴 DURABLE]** CITE authoritative outbound sources inline (Meta/Google docs, studies). Top-3 lever; helps most on lower-ranked pages. (Missing — articles cite nothing external.)
28. **[CODE ✅ DURABLE]** Clean, fluent prose; direct/authoritative voice, cut hedging. (Done.)
29. **[CODE 🔴 DURABLE]** Visible publish + last-updated dates; refresh on a real cadence (fast-moving topics ~quarterly). No fake date-flips. (Have published date; add dateModified + a refresh cadence.)
30. **[CAUTION DURABLE]** Do NOT over-GEO: stuffing stats/citations/authority tone scored *worse* in testing. Optimize structure + accessibility; don't manufacture authority theater. (Guard rail for #25-27.)
31. **[SKIP]** Keyword stuffing — zero/negative effect in the GEO study. Don't.

## E. E-E-A-T / trust (Trust is Google's #1; not a direct ranking factor — a filter AI reuses)
32. **[YOU+CODE 🔴 DURABLE]** Real author byline on every post, linked to a bio page with genuine credentials + publication history. (Missing — needs a real named author, e.g. the founder.)
33. **[YOU 🔴 DURABLE]** Author `sameAs` cross-links (LinkedIn, X, associations) with consistent name. (Needs your real profile URLs.)
34. **[CODE ✅ DURABLE]** First-hand experience signals ("we tested", real client counts, case studies). (Have a case study; weave experience into posts.)
35. **[CODE ✅ DURABLE]** Disclose how content was produced where a reader would expect it; keep it people-first, not search-first. (Add a light editorial note.)
36. **[CODE ✅ DURABLE]** Avoid AI-filler / thin "summarizing others" content. (Rewrites help; deepen with originality.)

## F. Entity SEO (do-now for a startup)
37. **[YOU+CODE 🔴 DURABLE]** Organization schema with stable `@id` + full `sameAs` (Wikidata, LinkedIn, Crunchbase, G2/Capterra, YouTube, socials), foundingDate, contactPoint. One case study: +46% impressions. (Needs your real profile URLs.)
38. **[YOU 🔴 DURABLE]** Create a Wikidata entry (instance-of, industry, HQ, founder, official site). Google ingests it into the Knowledge Graph. (~30 min; you/your team.)
39. **[YOU/OFF 🔴 DURABLE]** Standardize brand name/identity (NAP) across every profile; quarterly audit. (Off-site consistency.)
40. **[OFF 🔴 DURABLE]** Get listed on G2, Capterra, Trustpilot + niche directories; add each to `sameAs`. Brands on 4+ platforms ≈ 2.8x more likely cited in ChatGPT. (Off-page.)

## G. Topical authority + internal linking
41. **[CODE 🟡 DURABLE]** Pillar-and-cluster architecture: one 2,000+ word hub per core topic, spokes linking back. "Fan-out" coverage is the strongest measured on-page predictor of AI citation. (Have a spoke cluster; missing the pillar hubs.)
42. **[CODE ✅ DURABLE]** Internal links with descriptive, varied anchors; no orphan pages. (Shipped the cluster interlinks this session.)

## H. Off-page / earned signals — the biggest lever, and NOT code
43. **[OFF 🔴 DURABLE]** Earn brand mentions in third-party editorial/industry pieces — even UNLINKED ones count (0.664 corr., ~3x backlinks). Founder-led PR, HARO-style expert quotes, podcasts. (The single biggest lever.)
44. **[OFF 🔴 DURABLE]** Reclaim unlinked mentions (Google Alerts → ask for a link). Get into "best-of"/comparison listicles (~32-49% of AI citations). Publish genuinely helpful (never spammy) answers on Reddit/Quora. Build a YouTube presence with clean transcripts (~0.74 corr., strongest single signal). Pursue a few relevant editorial backlinks (76-92% of AI-cited pages also rank top-10). (Off-page program.)

## I. Measurement
45. **[YOU+CODE 🔴 DURABLE]** Set up Google Search Console + submit sitemap; track AI citations / brand mentions / share-of-voice as an ongoing loop, not a one-off. Without this, "it's working" is unverifiable. (Do this first so results are measurable.)

---

## Explicitly SKIP (deprecated or unproven — building these wastes effort or backfires)
- `llms.txt` — AI bots don't read it (Google's Mueller; ~97% never fetched; zero correlation across 300K domains). Cheap to add a stub, but not a priority and not a real signal.
- FAQ / HowTo schema for *rich results* — removed by Google (2026 / 2023). FAQ markup still fine for LLM parsing only.
- WebSite SearchAction / Sitelinks Searchbox — retired Nov 2024.
- Speakable schema, "vector-embedding optimization", keyword stuffing, over-GEO authority theater.

## Honest caveats
- Effect-size numbers (+40%, 3x, 2.8x) are from ONE 2024 academic paper on a simulated engine + correlational vendor studies — directional, not causal. Don't treat them as laws.
- AI referral traffic is still ~1% of total for most sites today (though it converts better). This is a build-the-moat play, not a this-quarter traffic play.
- The durable core is unglamorous: render server-side, stay crawlable/fast/HTTPS, real authorship, real sourced facts, topical depth, and earned mentions. Everything else is secondary.
