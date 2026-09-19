import Link from "next/link";
import { ThemeShell, SecHead } from "@/components/marketing/theme-shell";
import { allTools } from "@/lib/tools/tools";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

// Free-tools hub. Static, prerendered. Backlink-magnet + product-logic demo surface (ItemList + Breadcrumb).
export const metadata = {
  title: "Free ad calculators — ROAS, LTV:CAC, scale/refresh/kill | AdScale",
  description: "Free calculators for Meta and Google advertisers: break-even ROAS from your margin, LTV:CAC ratio and payback, and a scale/refresh/kill verdict for any ad. No sign-up.",
  alternates: { canonical: "/tools" },
  openGraph: {
    type: "website",
    title: "Free ad calculators — ROAS, LTV:CAC, scale/refresh/kill",
    description: "Free calculators for Meta and Google advertisers. Break-even ROAS, LTV:CAC, and a scale/refresh/kill verdict. No sign-up.",
    url: "/tools",
    siteName: "AdScale AI",
  },
};

export default function ToolsIndex() {
  const tools = allTools();
  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${SITE_URL}/tools#list`,
      name: "AdScale free advertising calculators",
      itemListElement: tools.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/tools/${t.slug}`, name: t.name })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools` },
      ],
    },
  ]);

  return (
    <ThemeShell>
      <script type="application/ld+json">{jsonLd}</script>
      <section className="page-hero" style={{ borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div className="eyebrow"><span className="tick" /><span className="lab">Free tools</span></div>
          <h1>Free calculators for ad decisions.</h1>
          <p className="lede">No sign-up. Put in your own numbers and get an honest answer: the ROAS you have to clear, whether a customer pays back, and what to do with an ad today.</p>
        </div>
      </section>

      <section className="blk" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <SecHead num="/ 01" title="Pick a calculator" />
          <div className="three" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {tools.map((t) => (
              <Link key={t.slug} href={`/tools/${t.slug}`} className="c rv" style={{ minHeight: 170 }}>
                <div className="v">{t.category}</div>
                <h3 style={{ marginTop: 0 }}>{t.name}</h3>
                <p>{t.dek}</p>
                <div className="meta">Open calculator &rarr;</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="close">
        <div className="wrap">
          <div className="lab" style={{ marginBottom: 18 }}>From calculator to live account</div>
          <h2>Stop calculating one ad at a time.</h2>
          <p>AdScale runs this logic across your whole Meta and Google account, every day, and tells you what to scale, refresh, or kill, with a reason for every call.</p>
          <div className="ctas" style={{ justifyContent: "center" }}><a className="btn solid" href="/book-demo">Book a demo</a><a className="btn" href="/product">See the platform</a></div>
        </div>
      </section>
    </ThemeShell>
  );
}
