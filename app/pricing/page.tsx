import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PricingTiers } from "@/components/marketing/pricing-tiers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahul-digital.vercel.app";

export const metadata = {
  title: "Pricing — AdBrain",
  description:
    "Simple token-based pricing. Start free with 50 tokens (about 7 ad-account analyses a month), then scale up. Every plan gives a reason for every call, and AdBrain never spends on your account.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    title: "AdBrain pricing — start free, scale with your ad spend",
    description: "Free plan with 50 tokens a month, then Starter, Growth, and Scale. Tokens map to real ad-account analyses.",
    url: `${SITE_URL}/pricing`,
    siteName: "AdBrain AI",
  },
};

// Pricing FAQ. Answers the exact questions the research says usage-based buyers ask ("what's a credit", "what
// if I run out", "do they roll over"). Every answer is TRUE to the current plan: monthly reset, run-out pauses +
// upgrade prompt (self-serve billing is a later phase, so we do NOT promise instant paid checkout here), no
// fabricated overage mechanics. FAQPage JSON-LD is for LLM parsing (Google removed FAQ rich results in 2026).
const FAQS: { q: string; a: string }[] = [
  {
    q: "What is a token?",
    a: "A token is one AI action. A full ad-account analysis - a scale, refresh, or kill recommendation with the reason behind it - uses about 7 tokens. Every plan shows roughly how many analyses your monthly tokens cover, so you are never guessing.",
  },
  {
    q: "What happens when I run out of tokens?",
    a: "Your analyses pause until your tokens reset at the start of the next month, and we prompt you to move to a larger plan. We do not silently charge you overage or stop your account without telling you.",
  },
  {
    q: "Do tokens roll over?",
    a: "Monthly tokens reset at the start of each billing cycle, so each month starts fresh. This keeps the plan simple and predictable.",
  },
  {
    q: "Is the Free plan really free?",
    a: "Yes. Free gives you 50 tokens a month, about 7 real analyses on your own ad account, with no card required. It is enough to see genuine recommendations on your data. Creative image generation is not included on Free.",
  },
  {
    q: "Will AdBrain change my ads automatically?",
    a: "No. On every plan AdBrain only reads your accounts and recommends what to do; you decide and act. It never edits, pauses, or spends on your account by itself.",
  },
  {
    q: "Does it work for agencies with several accounts?",
    a: "Yes. Paid plans work across multiple ad accounts, so an agency can see decisions for every client in one place. Higher plans simply include more tokens.",
  },
];

export default function PricingPage() {
  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Pricing", item: `${SITE_URL}/pricing` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ]);

  return (
    <>
      <script type="application/ld+json">{jsonLd}</script>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-1.5 text-sm text-[var(--ink-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            Pricing
          </span>
          <h1 className="mx-auto mt-6 max-w-2xl text-5xl leading-[1.06] tracking-tight sm:text-6xl">
            Start free. Scale with your ad spend.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--ink-muted)]">
            Every plan reads your Meta and Google ads and tells you what to scale, refresh, or kill, with a reason
            for every call. Tokens map to real analyses, so you always know what you are buying.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16">
          <PricingTiers />
        </section>

        <section className="border-t border-[var(--hairline)] py-20">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-center text-[32px] leading-tight">Pricing questions</h2>
            <dl className="mt-10 divide-y divide-[var(--hairline)]">
              {FAQS.map((f) => (
                <div key={f.q} className="py-6 first:pt-0">
                  <dt>
                    <h3 className="text-[18px] font-medium leading-snug text-[var(--ink)]">{f.q}</h3>
                  </dt>
                  <dd className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-muted)]">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
