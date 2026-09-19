import PricingThemed from "@/components/marketing/pricing-themed";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

export const metadata = {
  title: "Pricing — AdScale",
  description:
    "Every plan includes unlimited ad-account decisions. Tokens power the AI extras - chat and creative generation. AdScale is in private beta; request access to get started.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    title: "AdScale pricing — usage-based, unlimited decisions",
    description: "Free, Starter, Growth, and Scale plans. Unlimited decisions on every plan; tokens power the AI extras. Private beta - request access.",
    url: `${SITE_URL}/pricing`,
    siteName: "AdScale AI",
  },
};

// Pricing FAQ. Every answer is TRUE to the current plan (monthly reset, run-out pauses + upgrade prompt, no
// fabricated overage). FAQPage JSON-LD is for LLM parsing (Google removed FAQ rich results in 2026).
const FAQS: { q: string; a: string }[] = [
  { q: "What is a token?", a: "Tokens power the AI extras: chat answers and creative generation. Every plan includes unlimited ad-account decisions - tokens are only spent when you ask the AI a question (1 token), generate ad copy (2 tokens), or generate an image (about 20 tokens)." },
  { q: "What happens when I run out of tokens?", a: "Your unlimited decisions keep working. Only AI chat and creative generation pause until your tokens reset at the start of the next month, and we prompt you to upgrade. We never silently charge you overage." },
  { q: "Do tokens roll over?", a: "Monthly tokens reset at the start of each billing cycle, so each month starts fresh. This keeps the plan simple and predictable." },
  { q: "Is the Free plan really free?", a: "Yes. Free includes unlimited scale, refresh, and kill decisions, plus 50 tokens a month for AI chat and ad copy. Image generation needs a paid plan. AdScale is currently in private beta, so access is granted by approval - request access and we will get you in." },
  { q: "Will AdScale change my ads automatically?", a: "No. On every plan AdScale only reads your accounts and recommends what to do; you decide and act. It never edits, pauses, or spends on your account by itself." },
  { q: "Does it work for agencies with several accounts?", a: "Yes. Paid plans work across multiple ad accounts, so an agency can see decisions for every client in one place. Higher plans simply include more tokens." },
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
      <PricingThemed faqs={FAQS} />
    </>
  );
}
