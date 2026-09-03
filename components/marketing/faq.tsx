// Homepage FAQ. Built for answer-engine extraction (AEO): each question is a real question a buyer asks,
// phrased as an H3, with the answer stated directly underneath. Collapsible via NATIVE <details>/<summary>
// (Rahul, 2026-09-03): the answer text stays server-rendered IN THE HTML (native details only visually
// collapses it - crawlers and answer engines still read it, unlike JS display:none tabs), and the FAQPage
// JSON-LD is generated from the SAME array, so structured data still matches the text (a Google requirement)
// and the AEO benefit is preserved. No client JS - this stays a server component. Every answer is factually
// true: AdScale reads accounts and recommends, it never acts; it never points at paused/ended entities as
// actions; pricing is early-access -> demo (no fabricated price).

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
        <div className="mt-12 divide-y divide-[var(--hairline)]">
          {FAQS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 [&::-webkit-details-marker]:hidden">
                <h3 className="text-[19px] font-medium leading-snug text-[var(--ink)]">{f.q}</h3>
                <span
                  aria-hidden
                  className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border border-[var(--hairline)] text-[18px] leading-none text-[var(--ink-muted)] transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="-mt-1 max-w-2xl pb-6 text-[16px] leading-relaxed text-[var(--ink-muted)]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
