import Link from "next/link";
import { EmailCapture } from "@/components/marketing/email-capture";

const LOGOS = ["Pilgrim", "Ghar Soaps", "The Pant Project", "Hair Originals", "NexTen", "Boldfit"];

export function TrustBand() {
  return (
    <section className="border-y border-[var(--hairline)] bg-[var(--surface)] py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="mx-auto max-w-3xl text-[28px] leading-[1.15]">
          Trusted by hundreds of leading D2C brands and agencies, from scrappy to scaled.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-[var(--ink-muted)]">
          See how these teams use AdBrain AI to decide their creative every week.
        </p>
        <div className="mt-10 grid grid-cols-2 items-center gap-8 sm:grid-cols-3 lg:grid-cols-6">
          {LOGOS.map((l) => (
            <div key={l} className="grid h-10 place-items-center font-semibold text-[var(--ink-muted)] opacity-65">
              {l}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FundingCard() {
  return (
    <section id="funding" className="pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-[var(--radius-card)] bg-[var(--ink)] p-10 text-white">
          <div>
            <h3 className="max-w-2xl text-[26px] leading-[1.15]">
              AdBrain AI is building the creative intelligence layer for growth teams
            </h3>
            <p className="mt-3 text-base text-white/70">
              Backed by top D2C operators and Meta partners, new and existing.
            </p>
          </div>
          <Link
            href="/signup"
            className="rounded-full bg-white px-5 py-2.5 text-[15px] font-medium text-[var(--ink)] transition hover:opacity-90"
          >
            Read Now
          </Link>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { title: "Scout", body: "Competitor ad, hook and offer tracking across your whole category, continuously." },
  { title: "Echo", body: "Turns reviews, DMs, comments and Reddit into structured customer insight." },
  { title: "Brand Brain", body: "Remembers what worked, what failed and why, so you never repeat a dead angle." },
  { title: "Adam Studio", body: "Drafts hooks, scripts and statics grounded in live winners and your brand voice." },
  { title: "Ranked Test Plan", body: "A confidence-ranked plan of what to make next, delivered every Monday." },
  { title: "Integrations", body: "Connect Meta, TikTok, Shopify, GA4 and Klaviyo via native integrations or API." },
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

const BADGES = ["GDPR", "SOC 2 Type II", "EU AI Act", "Meta Partner"];

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

const QUOTES = [
  {
    quote:
      "AdBrain AI tells us which ad to make before we spend a rupee. It replaced three spreadsheets and a weekly guessing meeting.",
    name: "Ananya R.",
    role: "Growth Lead at Pilgrim",
  },
  {
    quote:
      "The Brand Brain alone is worth it, we stopped retesting angles that had already failed twice. Our win rate doubled.",
    name: "Marcus D.",
    role: "Head of Performance at NexTen",
  },
  {
    quote:
      "It reads like having a senior creative strategist on call, and every answer is backed by real signals.",
    name: "Priya S.",
    role: "Founder at Ghar Soaps",
  },
  {
    quote:
      "What took a full team of analysts now lands in our inbox every Monday. Surprisingly easy to use.",
    name: "John O.",
    role: "Director of Growth at Hair Originals",
  },
];

export function Testimonials() {
  return (
    <section id="stories" className="border-y border-[var(--hairline)] bg-[var(--surface)] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-4 py-1.5 text-[13px] font-medium text-[var(--ink-muted)]">
            Customer Stories
          </span>
          <h2 className="text-[40px] leading-[1.08]">Loved by leading teams</h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-[var(--ink-muted)]">
            See how industry leaders use AdBrain AI to simplify their creative decisions.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {QUOTES.map((q) => (
            <figure
              key={q.name}
              className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--bg)] p-8 transition hover:-translate-y-1 hover:shadow-[0_14px_32px_-20px_rgba(37,37,37,0.28)]"
            >
              <div className="text-[40px] leading-none text-[var(--accent)]">&ldquo;</div>
              <blockquote className="mt-2 text-lg leading-relaxed">{q.quote}</blockquote>
              <figcaption className="mt-5 text-[15px]">
                <span className="font-medium">{q.name}</span>{" "}
                <span className="text-[var(--ink-muted)]">, {q.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CaseStudy() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-8 rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] p-10 md:grid-cols-[200px_1fr]">
          <div className="text-[72px] leading-none text-[var(--accent)]">+38%</div>
          <div>
            <h3 className="text-[26px] leading-[1.15]">
              How The Pant Project lifted ROAS 38% on scaled creatives with AdBrain AI
            </h3>
            <p className="mt-4 text-lg italic leading-relaxed text-[var(--ink-muted)]">
              &ldquo;AdBrain AI ranks our whole test plan by confidence, we just ship the top three. Our
              team stays focused on what really matters.&rdquo;
            </p>
            <p className="mt-3 text-sm text-[var(--ink-muted)]">
              Priya Nair, Head of Growth at The Pant Project
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex rounded-full bg-[var(--ink)] px-5 py-2.5 text-[15px] font-medium text-white transition hover:opacity-90"
            >
              View Case Study
            </Link>
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
            Get started with AdBrain AI today
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
