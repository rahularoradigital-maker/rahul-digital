import Link from "next/link";
import { ThemeShell, SecHead } from "@/components/marketing/theme-shell";
import { allTerms, termsByCategory } from "@/lib/glossary/terms";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

// The glossary hub: an AEO / AI-citation surface (answer-first definitions) and a topic-authority page that
// links into the blog cluster and the product. Static content, so it prerenders and caches at the edge.
export const metadata = {
  title: "Performance marketing glossary — Meta & Google ad terms | AdScale",
  description: "Clear, honest definitions of the Meta and Google advertising metrics that decide what to change in your ads: ROAS, MER, CAC, nCAC, impression share, Quality Score, creative fatigue, and more.",
  alternates: { canonical: "/glossary" },
  openGraph: {
    type: "website",
    title: "Performance marketing glossary — Meta & Google ad terms",
    description: "Clear, honest definitions of the ad metrics that decide what to change: ROAS, MER, CAC, nCAC, impression share, Quality Score, and more.",
    url: "/glossary",
    siteName: "AdScale AI",
  },
};

export default function GlossaryIndex() {
  const groups = termsByCategory();
  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      "@id": `${SITE_URL}/glossary#set`,
      name: "AdScale performance marketing glossary",
      url: `${SITE_URL}/glossary`,
      hasDefinedTerm: allTerms().map((t) => ({
        "@type": "DefinedTerm",
        "@id": `${SITE_URL}/glossary/${t.slug}#term`,
        name: t.term,
        description: t.short,
        url: `${SITE_URL}/glossary/${t.slug}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Glossary", item: `${SITE_URL}/glossary` },
      ],
    },
  ]);

  return (
    <ThemeShell>
      <script type="application/ld+json">{jsonLd}</script>
      <section className="page-hero" style={{ borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div className="eyebrow"><span className="tick" /><span className="lab">Glossary</span></div>
          <h1>The ad metrics that decide what to change.</h1>
          <p className="lede">Honest, plain-English definitions of the Meta and Google advertising terms behind every AdScale recommendation. No hype, no invented benchmarks.</p>
        </div>
      </section>

      {groups.map((g, i) => (
        <section className="blk" key={g.category} style={i === 0 ? { borderTop: "1px solid var(--line)" } : undefined}>
          <div className="wrap" style={{ maxWidth: 860 }}>
            <SecHead num={`/ ${String(i + 1).padStart(2, "0")}`} title={g.category} />
            <div className="faq" style={{ borderTop: "1px solid var(--line)" }}>
              {g.terms.map((t) => (
                <Link
                  key={t.slug}
                  href={`/glossary/${t.slug}`}
                  className="rv postrow"
                  style={{ gap: 10, padding: "20px 4px", borderBottom: "1px solid var(--line)" }}
                >
                  <div style={{ fontWeight: 600 }}>{t.term}{t.aka?.length ? <span style={{ color: "var(--faint)", fontWeight: 400 }}> · {t.aka[0]}</span> : null}</div>
                  <div style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.5 }}>{t.short}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="close">
        <div className="wrap">
          <div className="lab" style={{ marginBottom: 18 }}>See it on your own account</div>
          <h2>Every term, read from your live data.</h2>
          <p>AdScale reads these signals from your Meta and Google accounts and tells you what to scale, refresh, or kill, with a reason for every call.</p>
          <div className="ctas" style={{ justifyContent: "center" }}><a className="btn solid" href="/book-demo">Book a demo</a><a className="btn" href="/blog">Read the guides</a></div>
        </div>
      </section>
    </ThemeShell>
  );
}
