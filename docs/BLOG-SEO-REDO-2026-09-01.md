# Blog SEO redo — 2026-09-01

You said the 10 blogs were "1 out of 10": not indexed, not on the landing page or footer,
no images, no structure, no keywords, thin writing. You were right on every count. Here is
what was actually broken, what is now fixed, and how it was verified live.

## The core problem you spotted: the blog was invisible to Google

The blog existed, but nothing linked to it. The footer's "Blog" link pointed at `/book-demo`,
and no nav or footer link reached `/blog` at all. A crawler landing on the homepage had no path
to the posts. That is why "Google can't read it" — it literally could not find them.

## What is fixed (all live on adscaledigital.co / rahul-digital.vercel.app)

| Problem you raised | Fix shipped | Verified live |
|---|---|---|
| Not on landing page / footer, not indexed | Header nav + footer now link to `/blog` (4 links from the homepage) | Yes — 1 header + 3 footer links confirmed |
| No images | Every article now has a branded hero image + a per-article social share card (og:image) | Yes — hero loads at 1200px; OG route returns image/png |
| No structure | Topic eyebrow, reading time, quick-answer box, H2 sections, bottom-line takeaway on every post | Yes |
| No keywords targeted | Each article targets one keyword cluster; keyword/topic now in the on-page schema | Yes |
| No internal links (indexation) | Every article links to 3 sibling articles as a topic cluster (crawl path) | Yes — links render as real anchors |
| Thin writing | All 10 rewritten from ~250 words to 617–779 words, structured and specific | Yes |
| Not crawlable | robots.txt allows `/blog`; sitemap.xml lists all 21 posts | Yes |

A hidden bug was found and fixed along the way: the article markdown renderer only rendered
`https://` links, so the internal cluster links (`/blog/...`) were showing as plain text. Fixed
in the shared renderer, so every article got it at once.

## The 10 rewritten articles (interlinked topic cluster)

| Article | Target topic | Words |
|---|---|---|
| [Why your Meta ads stopped spending](https://adscaledigital.co/blog/why-meta-ads-stopped-spending) | delivery / underdelivery | 779 |
| [Why did my Meta ad results suddenly drop](https://adscaledigital.co/blog/why-meta-ad-results-dropped) | diagnosis | 730 |
| [When to kill vs scale a Meta ad](https://adscaledigital.co/blog/when-to-kill-or-scale-meta-ad) | decisions | 696 |
| [Stop deciding on spend too small to judge](https://adscaledigital.co/blog/ad-spend-materiality-noise) | materiality | 685 |
| [Ad vs ad set vs campaign metrics](https://adscaledigital.co/blog/ad-set-vs-campaign-vs-ad-metrics) | metrics by level | 681 |
| [Meta ad creative fatigue](https://adscaledigital.co/blog/meta-ad-creative-fatigue) | creative fatigue | 665 |
| [Why Meta ROAS does not match Shopify](https://adscaledigital.co/blog/meta-roas-vs-shopify-true-roas) | attribution | 654 |
| [A DTC creative testing framework](https://adscaledigital.co/blog/dtc-creative-testing-framework) | creative testing | 649 |
| [Creative diversity and winning DNA](https://adscaledigital.co/blog/creative-diversity-winning-dna) | creative strategy | 627 |
| [CBO vs ABO: when to use each](https://adscaledigital.co/blog/cbo-vs-abo-when-to-use) | budget structure | 617 |

Each opens with a "Quick answer" (built for Google featured snippets / AI answers), then real
structured sections, a worked example, and a bottom-line takeaway. No invented statistics — only
well-known, real Meta mechanics (the 50-conversions-a-week learning phase, 7-day-click / 1-day-view
attribution, the 20% scaling step). No hype language.

## Honest gaps

- **OpenSEO is NOT connected this session.** The `openseo` MCP was added to config but needs an
  interactive OAuth sign-in to become reachable — it was not available here, confirmed by tool
  search returning nothing. So this pass is best-practice SEO done by hand, not driven by the
  OpenSEO skillset. Once you authorize it in an interactive Claude session, I can layer OpenSEO's
  keyword research, SERP gap analysis, and structured on-page scoring on top.
- **Length.** 617–779 words is a solid, tight length for these focused, decision-oriented pieces
  (3x the old length). If you want a few of these expanded into 1,500+ word pillar guides with
  more examples and screenshots, say which and I will deepen them.
- **Hero images are branded typographic cards, not photos.** They are real, on-brand, and match
  the share card — no stock photography, nothing fabricated. If you want real product/scene imagery,
  that needs an image source or the Nano Banana pipeline pointed at the blog.

## Commits

- `dde99e9` — OG image route
- `55c49f9` — article hero/structure/internal-links + `/blog` nav links + markdown link fix
