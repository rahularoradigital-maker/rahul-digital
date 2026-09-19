import Link from "next/link";
import Image from "next/image";
import { listPublishedArticles } from "@/lib/growth/articles";

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
  return (
    <section className="page-hero" style={{ borderBottom: "none" }}>
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
