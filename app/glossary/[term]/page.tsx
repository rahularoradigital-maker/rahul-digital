import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeShell } from "@/components/marketing/theme-shell";
import { Markdown } from "@/app/blog/md";
import { allTerms, getTerm, GLOSSARY } from "@/lib/glossary/terms";
import { getCuratedArticleBySlug } from "@/lib/blog/file-articles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

// Prerender every term at build so the first request is an edge hit. Static data, no revalidate needed.
export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ term: t.slug }));
}
export const dynamicParams = false; // only known terms; anything else is a real 404

export async function generateMetadata({ params }: { params: Promise<{ term: string }> }) {
  const { term } = await params;
  const t = getTerm(term);
  if (!t) return { title: "Glossary — AdScale", robots: { index: false, follow: true } };
  const title = `What is ${t.term}? Definition for Meta & Google ads — AdScale`;
  return {
    title,
    description: t.short,
    alternates: { canonical: `/glossary/${t.slug}` },
    openGraph: { type: "article", title, description: t.short, url: `${SITE_URL}/glossary/${t.slug}`, siteName: "AdScale AI" },
    twitter: { card: "summary_large_image", title, description: t.short },
  };
}

export default async function TermPage({ params }: { params: Promise<{ term: string }> }) {
  const { term } = await params;
  const t = getTerm(term);
  if (!t) notFound();

  const url = `${SITE_URL}/glossary/${t.slug}`;
  const related = (t.related ?? [])
    .map((slug) => getCuratedArticleBySlug(slug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  // A few sibling terms from the same category for lateral internal links.
  const siblings = allTerms().filter((x) => x.category === t.category && x.slug !== t.slug).slice(0, 4);

  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      "@id": `${url}#term`,
      name: t.term,
      alternateName: t.aka ?? undefined,
      description: t.short,
      url,
      inDefinedTermSet: `${SITE_URL}/glossary#set`,
      termCode: t.category,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Glossary", item: `${SITE_URL}/glossary` },
        { "@type": "ListItem", position: 3, name: t.term, item: url },
      ],
    },
    // A FAQ block so the definition can win an "what is X" AI answer / snippet. Matches on-page copy.
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: `What is ${t.term}?`, acceptedAnswer: { "@type": "Answer", text: t.short } }],
    },
  ]);

  return (
    <ThemeShell>
      <script type="application/ld+json">{jsonLd}</script>
      <section className="page-hero" style={{ borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <Link href="/glossary" className="lab" style={{ display: "inline-block", marginBottom: 24 }}>&larr; Glossary</Link>
          <article>
            <p className="lab" style={{ color: "var(--accent)" }}>{t.category}</p>
            <h1 style={{ marginTop: 12, fontSize: "clamp(1.9rem,4.5vw,2.8rem)", fontWeight: 600, lineHeight: 1.08, letterSpacing: "-.02em" }}>What is {t.term}?</h1>
            {t.aka?.length ? <p style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--faint)" }}>Also: {t.aka.join(" · ")}</p> : null}

            {/* Answer-first: the definition, up top, is what AI answer engines quote. */}
            <p style={{ marginTop: 22, fontSize: 19, lineHeight: 1.55, color: "var(--ink)", fontWeight: 500, textWrap: "balance" }}>{t.short}</p>

            {t.formula ? (
              <div style={{ marginTop: 20, border: "1px solid var(--line2)", background: "var(--bg2)", padding: "14px 18px", fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink)" }}>{t.formula}</div>
            ) : null}

            <div className="prose-rd" style={{ marginTop: 26 }}>
              <Markdown md={t.body} />
            </div>

            {related.length ? (
              <section style={{ marginTop: 44 }}>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 600 }}>Go deeper</h2>
                <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                  {related.map((a) => (
                    <li key={a.slug}>
                      <Link href={`/blog/${a.slug}`} style={{ color: "var(--accent)", fontSize: 15, fontWeight: 500 }}>{a.title} &rarr;</Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {siblings.length ? (
              <section style={{ marginTop: 40, borderTop: "1px solid var(--line)", paddingTop: 24 }}>
                <p className="lab" style={{ marginBottom: 12 }}>Related terms</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {siblings.map((s) => (
                    <Link key={s.slug} href={`/glossary/${s.slug}`} className="chip">{s.term}</Link>
                  ))}
                </div>
              </section>
            ) : null}

            <aside style={{ marginTop: 48, border: "1px solid var(--line2)", background: "var(--bg2)", padding: "24px 26px" }}>
              <p style={{ fontSize: 15, color: "var(--ink)", margin: 0 }}>AdScale reads {t.term} from your live ad account and tells you what to change, with a reason for every call.</p>
              <Link href="/product" className="btn solid" style={{ marginTop: 16 }}>How AdScale works</Link>
            </aside>
          </article>
        </div>
      </section>
    </ThemeShell>
  );
}
