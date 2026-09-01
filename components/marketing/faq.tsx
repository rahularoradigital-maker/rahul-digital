// Homepage FAQ. Built for answer-engine extraction (AEO): each question is a real question a buyer asks,
// phrased as an H3, with the answer stated directly and visibly underneath (no accordion - collapsed/tab
// content is not reliably read by AI answer engines). The FAQPage JSON-LD is generated from the SAME array,
// so the structured data always matches the visible text (a Google requirement). Every answer is factually
// true to the product: AdScale reads accounts and recommends, it never acts; it never points at paused/ended
// entities as actions; pricing is early-access -> demo (no fabricated price).

const FAQS: { q: string; a: string }[] = [
  {
    q: "What does AdScale do?",
    a: "AdScale reads your Meta and Google ad accounts and tells you what to scale, refresh, or kill, with a clear reason for every call. It turns raw ad metrics into a decision you can act on.",
  },
  {
    q: "How is AdScale different from Meta Ads Manager?",
    a: "Ads Manager shows you the numbers. AdScale reads those numbers and gives you the decision plus the reason. It first checks whether there is enough spend behind a metric to trust it, so you do not act on a lucky or unlucky day.",
  },
  {
    q: "Does AdScale change my ads automatically?",
    a: "No. AdScale recommends; you decide and act. It never edits, pauses, or spends on your account by itself.",
  },
  {
    q: "Which ad platforms does AdScale support?",
    a: "Meta (Facebook and Instagram) and Google Ads. You can view decisions for one platform or both together.",
  },
  {
    q: "How does AdScale decide what to scale or kill?",
    a: "It checks three things in order: is there enough spend to judge the metric at all, what is the trend over a real window, and how the ad stands against your own other ads on the same objective. A single good or bad day is never enough on its own.",
  },
  {
    q: "Will AdScale recommend acting on a paused or ended campaign?",
    a: "No. AdScale never points you to anything paused or ended as a next action. It can, however, tell you when a paused or ended campaign was the cause of a recent drop in performance.",
  },
  {
    q: "Is my ad account data safe?",
    a: "AdScale connects through the official Meta and Google APIs and reads your data only to analyse it. It does not post, edit, or change anything on your account.",
  },
  {
    q: "Does AdScale work for agencies with multiple accounts?",
    a: "Yes. AdScale works across multiple ad accounts, so an agency can see the decisions for every client in one place.",
  },
  {
    q: "How much does AdScale cost?",
    a: "AdScale is in early access. Book a demo and we will walk you through how it works and current pricing.",
  },
];

// Constant, app-controlled JSON (no user input) rendered as <script> text children - safe for ld+json,
// matching the site-wide pattern in app/layout.tsx (no dangerouslySetInnerHTML).
const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

export function FAQ() {
  return (
    <section id="faq" className="border-t border-[var(--hairline)] py-20">
      {/* Machine-readable FAQ for LLM/answer-engine parsing. Matches the visible Q&A exactly. */}
      <script type="application/ld+json">{JSON_LD}</script>
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-4 py-1.5 text-[13px] font-medium text-[var(--ink-muted)]">
            FAQ
          </span>
          <h2 className="text-[40px] leading-[1.08]">Common questions</h2>
        </div>
        <dl className="mt-12 divide-y divide-[var(--hairline)]">
          {FAQS.map((f) => (
            <div key={f.q} className="py-6 first:pt-0">
              <dt>
                <h3 className="text-[19px] font-medium leading-snug text-[var(--ink)]">{f.q}</h3>
              </dt>
              <dd className="mt-2 max-w-2xl text-[16px] leading-relaxed text-[var(--ink-muted)]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
