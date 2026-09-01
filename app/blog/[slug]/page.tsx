import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getArticleBySlug } from "@/lib/growth/articles";
import { Markdown } from "../md";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahul-digital.vercel.app";

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

  const url = `${SITE_URL}/blog/${slug}`;
  // Article + breadcrumb entity signals. Honest only: author is the AdScale organization (no fabricated
  // person), dates come from the real published_at, no images/ratings we cannot substantiate.
  const jsonLd = JSON.stringify([
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
  ]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <script type="application/ld+json">{jsonLd}</script>
      <Link href="/blog" className="text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)]">← All posts</Link>
      <article className="mt-6">
        {a.topic && (
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--accent)]">{a.topic}</p>
        )}
        <h1 className="mt-2 text-[28px] font-normal leading-tight tracking-tight text-balance">{a.title}</h1>
        {a.dek && <p className="mt-2 text-[16px] text-[var(--ink-muted)]">{a.dek}</p>}
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ink-muted)]">
          <span className="text-[var(--ink)]">By the AdScale team</span>
          <span aria-hidden>·</span>
          {a.published_at && <time dateTime={a.published_at}>{a.published_at.slice(0, 10)}</time>}
          {a.published_at && <span aria-hidden>·</span>}
          <span>{readingMinutes(a.body_md)} min read</span>
        </p>
        {slug !== PILLAR_SLUG && (
          <p className="mt-3 text-[13px]">
            <Link href={`/blog/${PILLAR_SLUG}`} className="text-[var(--accent)] hover:underline">
              Part of: How to decide what to change in your Meta ads →
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
          className="mt-6 h-auto w-full rounded-[12px] border border-[var(--hairline)]"
        />
        <div className="mt-8">
          <Markdown md={a.body_md} />
        </div>
        {/* Intent-appropriate next action: an informational reader learns, then can try the product. */}
        <aside className="mt-12 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface-alt)] p-5">
          <p className="text-[14px] text-[var(--ink)]">See what AdScale flags in your own ad account - what to scale, refresh, or kill, with a reason for every call.</p>
          <Link href="/product" className="mt-3 inline-block text-[14px] font-medium text-[var(--accent)] hover:underline">How AdScale works →</Link>
        </aside>
        {/* Google's "how/why" disclosure: honest about production, so the content is people-first, not search-first. */}
        <p className="mt-8 border-t border-[var(--hairline)] pt-5 text-[12px] leading-relaxed text-[var(--ink-muted)]">
          Written by the AdScale team from established Meta and Google media-buying practice, AI-assisted and
          reviewed for accuracy. We do not invent statistics, results, or case studies; figures are sourced to
          the platforms&apos; own documentation where cited.
        </p>
      </article>
    </main>
  );
}
