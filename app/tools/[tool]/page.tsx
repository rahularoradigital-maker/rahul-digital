import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeShell } from "@/components/marketing/theme-shell";
import { Markdown } from "@/app/blog/md";
import ToolCalculator from "@/components/marketing/tool-calculator";
import { TOOLS, getTool } from "@/lib/tools/tools";
import { getCuratedArticleBySlug } from "@/lib/blog/file-articles";
import { getTerm } from "@/lib/glossary/terms";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}
export const dynamicParams = false; // only known tools; anything else is a real 404

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const t = getTool(tool);
  if (!t) return { title: "Free tools — AdScale", robots: { index: false, follow: true } };
  const title = `${t.name} (free) — AdScale`;
  return {
    title,
    description: t.dek,
    alternates: { canonical: `/tools/${t.slug}` },
    openGraph: { type: "website", title, description: t.dek, url: `${SITE_URL}/tools/${t.slug}`, siteName: "AdScale AI" },
    twitter: { card: "summary_large_image", title, description: t.dek },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const t = getTool(tool);
  if (!t) notFound();

  const url = `${SITE_URL}/tools/${t.slug}`;
  // Related links: resolve each related slug against blog OR glossary so the tool sits inside the cluster.
  const related = (t.related ?? [])
    .map((slug) => {
      const a = getCuratedArticleBySlug(slug);
      if (a) return { href: `/blog/${a.slug}`, label: a.title };
      const g = getTerm(slug);
      if (g) return { href: `/glossary/${g.slug}`, label: `${g.term} — definition` };
      return null;
    })
    .filter((x): x is { href: string; label: string } => Boolean(x));

  const jsonLd = JSON.stringify([
    {
      // WebApplication (SoftwareApplication subtype): a free, browser-based tool. No aggregateRating/review —
      // there are no genuine on-page reviews, and fabricated ones are a structured-data violation.
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${url}#app`,
      name: t.name,
      description: t.dek,
      url,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools` },
        { "@type": "ListItem", position: 3, name: t.name, item: url },
      ],
    },
  ]);

  return (
    <ThemeShell>
      <script type="application/ld+json">{jsonLd}</script>
      <section className="page-hero" style={{ borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <Link href="/tools" className="lab" style={{ display: "inline-block", marginBottom: 24 }}>&larr; Free tools</Link>
          <div className="eyebrow"><span className="tick" /><span className="lab">{t.category}</span></div>
          <h1 style={{ maxWidth: "22ch" }}>{t.h1}</h1>
          <p className="lede">{t.dek}</p>

          <div style={{ marginTop: 20 }}>
            <ToolCalculator slug={t.slug} />
          </div>

          {/* Answer-first explainer (GEO extraction shape) below the tool. */}
          <div className="prose-rd" style={{ marginTop: 40 }}>
            <Markdown md={t.intro} />
          </div>

          {related.length ? (
            <section style={{ marginTop: 40, borderTop: "1px solid var(--line)", paddingTop: 24 }}>
              <p className="lab" style={{ marginBottom: 12 }}>Go deeper</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {related.map((r) => (<li key={r.href}><Link href={r.href} style={{ color: "var(--accent)", fontSize: 15, fontWeight: 500 }}>{r.label} &rarr;</Link></li>))}
              </ul>
            </section>
          ) : null}

          <aside style={{ marginTop: 48, border: "1px solid var(--line2)", background: "var(--bg2)", padding: "24px 26px" }}>
            <p style={{ fontSize: 15, color: "var(--ink)", margin: 0 }}>AdScale runs this logic across your whole ad account, every day, and tells you what to change, with a reason for every call.</p>
            <Link href="/book-demo" className="btn solid" style={{ marginTop: 16 }}>Book a demo</Link>
          </aside>
        </div>
      </section>
    </ThemeShell>
  );
}
