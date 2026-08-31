import Link from "next/link";
import { listPublishedArticles } from "@/lib/growth/articles";

// Public blog index. Renders PUBLISHED articles only (owner-approved). SEO/AEO surface for rahul-digital.vercel.app.
export const dynamic = "force-dynamic";
export const metadata = {
  title: "AdBrain Blog — how to decide what to change in your ads",
  description: "Practical, no-hype guides on reading Meta and Google ad performance and deciding what to act on.",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: "AdBrain Blog — how to decide what to change in your ads",
    description: "Practical, no-hype guides on reading Meta and Google ad performance and deciding what to act on.",
    url: "/blog",
    siteName: "AdBrain AI",
  },
};

export default async function BlogIndex() {
  const articles = await listPublishedArticles();
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-[28px] font-normal tracking-tight">AdBrain Blog</h1>
      <p className="mt-2 text-[15px] text-[var(--ink-muted)]">Practical guides on deciding what to change in your Meta and Google ads — with a reason for every call.</p>
      {articles.length === 0 ? (
        <p className="mt-10 text-[14px] text-[var(--ink-muted)]">No posts yet. Check back soon.</p>
      ) : (
        <ul className="mt-10 space-y-6">
          {articles.map((a) => (
            <li key={a.id} className="border-t border-[var(--hairline)] pt-6 first:border-0 first:pt-0">
              <Link href={`/blog/${a.slug}`} className="text-[19px] font-semibold text-[var(--ink)] hover:text-[var(--accent)]">{a.title}</Link>
              {a.dek && <p className="mt-1 text-[14px] text-[var(--ink-muted)]">{a.dek}</p>}
              {a.published_at && <p className="mt-1 text-[12px] text-[var(--ink-muted)]">{a.published_at.slice(0, 10)}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
