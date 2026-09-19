import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getArticleBySlug, listPublishedArticles } from "@/lib/growth/articles";
import { getCuratedArticles } from "@/lib/blog/file-articles";
import { autolinkTerms } from "@/lib/glossary/autolink";
import { Markdown } from "../md";

// ISR, not force-dynamic: each article was re-rendered + fetched from Supabase on every request
// (measured cache MISS). Articles change rarely, so cache the render at the edge and revalidate hourly;
// new slugs render on-demand then cache (dynamicParams default). This is the single biggest blog-speed win.
export const revalidate = 3600;

// Prerender the curated articles at build so their FIRST request is an edge HIT, not a cold render.
// Scout-written DB articles are not known at build; they render on-demand then cache (dynamicParams default).
export function generateStaticParams() {
  return getCuratedArticles().map((a) => ({ slug: a.slug }));
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

// The cluster's pillar hub. Every spoke links up to it (and it links down to every spoke) so the topic
// cluster is a real hub-and-spoke - the strongest on-page signal for topical authority / AI-citation fan-out.
const PILLAR_SLUG = "how-to-decide-what-to-change-in-meta-ads";

// ~220 wpm reading estimate; min 1. Cheap word count, good enough for a byline.
function readingMinutes(md: string): number {
  return Math.max(1, Math.round(md.trim().split(/\s+/).length / 220));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a) return { title: "AdScale Blog", robots: { index: false, follow: true } };
  const url = `${SITE_URL}/blog/${slug}`;
  const title = `${a.title} — AdScale`;
  const description = a.dek ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { type: "article", title, description, url, siteName: "AdScale AI", publishedTime: a.published_at ?? undefined },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a) notFound();

  // Related guides: same-topic spokes first, then recent others, so every post links out to 3 siblings.
  // Strengthens the topic cluster and spreads internal link equity (no post is a dead end).
  const all = await listPublishedArticles();
  const pool = all.filter((x) => x.slug !== slug);
  const sameTopic = a.topic ? pool.filter((x) => x.topic === a.topic) : [];
  const related = [...sameTopic, ...pool.filter((x) => !sameTopic.includes(x))].slice(0, 3);

  const url = `${SITE_URL}/blog/${slug}`;
  // Article + breadcrumb entity signals. Honest only: author is the AdScale organization (no fabricated
  // person), dates come from the real published_at, no images/ratings we cannot substantiate.
  const ldBlocks: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: a.title,
      description: a.dek ?? undefined,
      image: [`${url}/opengraph-image`],
      keywords: a.topic ?? undefined,
      articleSection: a.topic ?? undefined,
      inLanguage: "en",
      datePublished: a.published_at ?? undefined,
      dateModified: a.published_at ?? undefined,
      author: { "@type": "Organization", name: "AdScale AI", url: SITE_URL },
      publisher: { "@type": "Organization", name: "AdScale AI", url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` } },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE_URL}/blog` },
        { "@type": "ListItem", position: 2, name: a.title, item: url },
      ],
    },
  ];
  // FAQPage entity (AEO / rich results). Emitted ONLY when the article carries a curated faq, and the same
  // Q&A is rendered visibly below - Google requires the structured data to match on-page content.
  if (a.faq?.length) {
    ldBlocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: a.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  const jsonLd = JSON.stringify(ldBlocks);

  return (
    <section className="page-hero" style={{ borderBottom: "none" }}>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <script type="application/ld+json">{jsonLd}</script>
        <Link href="/blog" className="lab" style={{ display: "inline-block", marginBottom: 24 }}>&larr; All posts</Link>
        <article>
          {a.topic && <p className="lab" style={{ color: "var(--accent)" }}>{a.topic}</p>}
          <h1 style={{ marginTop: 12, fontSize: "clamp(1.9rem,4.5vw,2.8rem)", fontWeight: 600, lineHeight: 1.08, letterSpacing: "-.02em", textWrap: "balance", maxWidth: "20ch" }}>{a.title}</h1>
          {a.dek && <p style={{ marginTop: 12, fontSize: 17, color: "var(--muted)", lineHeight: 1.5 }}>{a.dek}</p>}
          <p style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: ".04em", color: "var(--faint)" }}>
            <span style={{ color: "var(--muted)" }}>By the AdScale team</span>
            <span aria-hidden>&middot;</span>
            {a.published_at && <time dateTime={a.published_at}>{a.published_at.slice(0, 10)}</time>}
            {a.published_at && <span aria-hidden>&middot;</span>}
            <span>{readingMinutes(a.body_md)} min read</span>
          </p>
          {slug !== PILLAR_SLUG && (
            <p style={{ marginTop: 14, fontSize: 13 }}>
              <Link href={`/blog/${PILLAR_SLUG}`} style={{ color: "var(--accent)" }}>
                Part of: How to decide what to change in your Meta ads &rarr;
              </Link>
            </p>
          )}
          {/* Real image only: the article's own branded share card, matching og:image. No stock photography.
              next/image so the LCP hero is served right-sized + WebP; priority since it is above the fold. */}
          <Image
            src={`/blog/${slug}/opengraph-image`}
            alt={`${a.title} — AdScale`}
            width={1200}
            height={630}
            priority
            style={{ marginTop: 28, height: "auto", width: "100%", border: "1px solid var(--line2)" }}
          />
          <div className="prose-rd" style={{ marginTop: 32 }}>
            {/* Auto-link the first mention of each glossary term to its definition (topic-authority internal links). */}
            <Markdown md={autolinkTerms(a.body_md)} />
          </div>
          {a.faq?.length ? (
            <section style={{ marginTop: 48 }}>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 600 }}>Frequently asked questions</h2>
              <div className="faq" style={{ marginTop: 12 }}>
                {a.faq.map((f, i) => (
                  <details className="qa" key={i}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
          {related.length ? (
            <section style={{ marginTop: 48, borderTop: "1px solid var(--line)", paddingTop: 26 }}>
              <p className="lab" style={{ marginBottom: 14 }}>Related guides</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/blog/${r.slug}`} style={{ color: "var(--ink)", fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{r.title}</Link>
                    {r.dek && <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>{r.dek}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {/* Intent-appropriate next action: an informational reader learns, then can try the product. */}
          <aside style={{ marginTop: 56, border: "1px solid var(--line2)", background: "var(--bg2)", padding: "24px 26px" }}>
            <p style={{ fontSize: 15, color: "var(--ink)", margin: 0 }}>See what AdScale flags in your own ad account, what to scale, refresh, or kill, with a reason for every call.</p>
            <Link href="/product" className="btn solid" style={{ marginTop: 16 }}>How AdScale works</Link>
          </aside>
          {/* Google's "how/why" disclosure: honest about production, so the content is people-first, not search-first. */}
          <p style={{ marginTop: 36, borderTop: "1px solid var(--line)", paddingTop: 22, fontSize: 12, lineHeight: 1.6, color: "var(--faint)" }}>
            Written by the AdScale team from established Meta and Google media-buying practice, AI-assisted and
            reviewed for accuracy. We do not invent statistics, results, or case studies; figures are sourced to
            the platforms&apos; own documentation where cited.
          </p>
        </article>
      </div>
    </section>
  );
}
