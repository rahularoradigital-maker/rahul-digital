import Link from "next/link";
import Image from "next/image";
import { listPublishedArticles } from "@/lib/growth/articles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

// Public blog index. Renders PUBLISHED articles only (owner-approved). SEO/AEO surface for adscaledigital.co.
// ISR, not force-dynamic: the blog index was re-rendering + hitting Supabase on EVERY request (measured
// ~5.7s TTFB, x-vercel-cache MISS). A published post is not time-critical, so cache the render at the edge
// and revalidate hourly - new posts still appear within the hour, and the DB is hit once per hour, not
// once per visitor. (Matches the sitemap's 3600s cadence.)
export const revalidate = 3600;
export const metadata = {
  title: "AdScale Blog — how to decide what to change in your ads",
  description: "Practical, no-hype guides on reading Meta and Google ad performance and deciding what to act on.",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: "AdScale Blog — how to decide what to change in your ads",
    description: "Practical, no-hype guides on reading Meta and Google ad performance and deciding what to act on.",
    url: "/blog",
    siteName: "AdScale AI",
  },
};

export default async function BlogIndex() {
  const articles = await listPublishedArticles();
  // Blog + ItemList + Breadcrumb entity signals (the index carried no structured data before). Honest: only
  // real published posts, in display order, each pointing at its canonical URL.
  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      "@id": `${SITE_URL}/blog#blog`,
      name: "AdScale Blog",
      url: `${SITE_URL}/blog`,
      description: "Practical, no-hype guides on reading Meta and Google ad performance and deciding what to act on.",
      publisher: { "@id": `${SITE_URL}#organization` },
      blogPost: articles.map((a) => ({ "@type": "BlogPosting", headline: a.title, url: `${SITE_URL}/blog/${a.slug}`, datePublished: a.published_at ?? undefined })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: articles.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/blog/${a.slug}`, name: a.title })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      ],
    },
  ]);
  return (
    <section className="page-hero" style={{ borderBottom: "none" }}>
      <script type="application/ld+json">{jsonLd}</script>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="eyebrow"><span className="tick" /><span className="lab">Field notes</span></div>
        <h1>AdScale Blog.</h1>
        <p className="lede">Practical guides on deciding what to change in your Meta and Google ads, with a reason for every call.</p>

        {articles.length === 0 ? (
          <p style={{ marginTop: 40, color: "var(--muted)", fontSize: 14 }}>No posts yet. Check back soon.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column" }}>
            {articles.map((a) => (
              <li key={a.id} className="rv" style={{ borderTop: "1px solid var(--line)", padding: "30px 0" }}>
                <Link href={`/blog/${a.slug}`} className="group postrow">
                  <Image
                    src={`/blog/${a.slug}/opengraph-image`}
                    alt={a.title}
                    width={1200}
                    height={630}
                    sizes="(min-width: 640px) 200px, 100vw"
                    style={{ height: "auto", width: "100%", border: "1px solid var(--line2)" }}
                  />
                  <div>
                    {a.topic && <p className="lab" style={{ color: "var(--accent)" }}>{a.topic}</p>}
                    <p style={{ marginTop: 6, fontSize: 18, fontWeight: 600, lineHeight: 1.3, color: "var(--ink)" }}>{a.title}</p>
                    {a.dek && <p style={{ marginTop: 6, fontSize: 14, color: "var(--muted)" }}>{a.dek}</p>}
                    {a.published_at && <p style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--faint)" }}>{a.published_at.slice(0, 10)}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
