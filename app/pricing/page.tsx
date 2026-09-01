import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PricingTiers } from "@/components/marketing/pricing-tiers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahul-digital.vercel.app";

export const metadata = {
  title: "Pricing — AdScale",
  description:
    "Every plan includes unlimited ad-account decisions. Tokens power the AI extras - chat and creative generation. Start free with unlimited decisions plus 50 tokens, no card required.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    title: "AdScale pricing — start free, scale with your ad spend",
    description: "Free plan with 50 tokens a month, then Starter, Growth, and Scale. Tokens map to real ad-account analyses.",
    url: `${SITE_URL}/pricing`,
    siteName: "AdScale AI",
  },
};

// Pricing FAQ. Answers the exact questions the research says usage-based buyers ask ("what's a credit", "what
// if I run out", "do they roll over"). Every answer is TRUE to the current plan: monthly reset, run-out pauses +
// upgrade prompt (self-serve billing is a later phase, so we do NOT promise instant paid checkout here), no
// fabricated overage mechanics. FAQPage JSON-LD is for LLM parsing (Google removed FAQ rich results in 2026).
const FAQS: { q: string; a: string }[] = [
  {
    q: "What is a token?",
    a: "Tokens power the AI extras: chat answers and creative generation. Every plan includes unlimited ad-account decisions - tokens are only spent when you ask the AI a question (1 token), generate ad copy (2 tokens), or generate an image (about 20 tokens).",
  },
  {
    q: "What happens when I run out of tokens?",
    a: "Your unlimited decisions keep working. Only AI chat and creative generation pause until your tokens reset at the start of the next month, and we prompt you to upgrade. We never silently charge you overage.",
  },
  {
    q: "Do tokens roll over?",
    a: "Monthly tokens reset at the start of each billing cycle, so each month starts fresh. This keeps the plan simple and predictable.",
  },
  {
    q: "Is the Free plan really free?",
    a: "Yes. Free includes unlimited scale, refresh, and kill decisions, plus 50 tokens a month for AI chat and ad copy, with no card required. Image generation needs a paid plan.",
  },
  {
    q: "Will AdScale change my ads automatically?",
    a: "No. On every plan AdScale only reads your accounts and recommends what to do; you decide and act. It never edits, pauses, or spends on your account by itself.",
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
            Every plan includes unlimited scale, refresh, and kill decisions, with a reason for each. Tokens power
            the AI extras - chat answers and creative generation - so you only pay for what actually costs to produce.
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
