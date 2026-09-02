import { EmailCapture } from "@/components/marketing/email-capture";

// Marketing honesty pass (Rahul, 2026-09-02): removed the fabricated social-proof sections that presented
// invented customers as real - TrustBand (logo wall + "Trusted by hundreds"), FundingCard ("Backed by top
// D2C operators"), Testimonials (four named quotes), and CaseStudy ("+38% / The Pant Project"). None were
// substantiated, and the product is a private beta. Re-add any of them only with a real, consented source.
// Kept: Features (capability descriptions), Security (compliance postures), FinalCta (demo capture).

const FEATURES = [
  { title: "Scout", body: "Competitor ad, hook and offer tracking across your whole category, continuously." },
  { title: "Echo", body: "Turns reviews, DMs, comments and Reddit into structured customer insight." },
  { title: "Brand Brain", body: "Remembers what worked, what failed and why, so you never repeat a dead angle." },
  { title: "Adam Studio", body: "Drafts hooks, scripts and statics grounded in live winners and your brand voice." },
  { title: "Ranked Test Plan", body: "A confidence-ranked plan of what to make next, delivered every Monday." },
  { title: "Integrations", body: "Connect your Meta account today. TikTok, Shopify, GA4 and Klaviyo are on the roadmap." },
];

export function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-[40px] leading-[1.08]">Everything you need, in one place</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-[var(--ink-muted)]">
          The building blocks leading teams use to run their creative operations.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] p-6 transition hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[0_14px_32px_-20px_rgba(37,37,37,0.35)]"
            >
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-[var(--radius-card)] bg-[var(--accent-soft)] text-[var(--accent)]">
                &#9670;
              </div>
              <h3 className="text-lg font-medium">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-muted)]">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// SOC 2 Type II removed 2026-09-02 (Rahul): not certified. "Meta Partner" removed 2026-09-02 (Rahul): the
// "certified Meta Partner" claim was unsubstantiated. GDPR / EU AI Act are compliance postures a privacy
// policy + data-deletion flow back. Re-add SOC 2 or a Meta-Partner badge only once each is real.
const BADGES = ["GDPR", "EU AI Act"];

export function Security() {
  return (
    <section className="pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[linear-gradient(135deg,var(--accent-soft),var(--surface))] p-12 text-center">
          <h2 className="text-[32px] leading-[1.1]">We value your trust.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-relaxed text-[var(--ink-muted)]">
            Your trust is our priority. We safeguard your data and signals with the highest standards of
            security and compliance, every decision protected and auditable.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {BADGES.map((b) => (
              <span
                key={b}
                className="rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-[var(--radius-card)] bg-[var(--ink)] p-14 text-center text-white">
          <h2 className="mx-auto max-w-xl text-[40px] leading-[1.08] text-white">
            Get started with AdScale AI today
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[17px] text-white/70">
            Get a personalized demo and see your first weekly test plan, built from your own account.
          </p>
          <div className="mx-auto mt-8 w-fit">
            <EmailCapture />
          </div>
        </div>
      </div>
    </section>
  );
}
