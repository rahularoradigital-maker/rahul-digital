import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const FEATURES = [
  { name: "Connect", desc: "Link your Meta account in one click. Your real ads and spend flow in automatically." },
  { name: "Verdict", desc: "Every ad gets a call: scale, refresh, do-not-kill-yet, or kill. With the reason." },
  { name: "Diagnose", desc: "When something drops, we rule out measurement, auction, funnel, stock, saturation before blaming the creative." },
  { name: "Fatigue", desc: "See which creatives are wearing out before the numbers crater, on the exposure curve." },
  { name: "Competitors", desc: "Paste an Ad Library link. We pull what they are running and where your white space is." },
  { name: "Brain", desc: "A memory of what wins in your market, so next week's plan is sharper than this week's." },
];

const STEPS = [
  { n: "01", t: "Connect Meta", d: "One click. We read your account, never change it." },
  { n: "02", t: "We read the account", d: "Real spend, ROAS, and frequency, ad by ad." },
  { n: "03", t: "The brain decides", d: "Winner, loser, refresh, hold — with the working shown." },
  { n: "04", t: "You act", d: "A ranked do-this list. You make each change in Meta." },
];

export default function Home() {
  return (
    <>
      {/* Announcement bar — accent blue */}
      <div className="bg-[var(--accent)] px-4 py-2 text-center text-sm text-white">
        Meta-first creative and media intelligence. Google coming next.
      </div>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
          <span className="inline-block rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-1.5 text-sm text-[var(--ink-muted)]">
            Creative Decision Intelligence
          </span>
          <h1 className="mx-auto mt-8 max-w-3xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Know what to test next,
            <br />
            <span className="text-[var(--ink-muted)]">before you spend on it.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--ink-muted)]">
            AdBrain reads your real Meta ads and tells you what to scale, refresh, or kill — and why.
            Not another dashboard. A decision.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-[var(--radius-pill)] bg-[var(--ink)] px-7 py-3 font-medium text-white transition hover:opacity-90"
            >
              Get started free
            </Link>
            <a
              href="#how"
              className="rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-7 py-3 font-medium text-[var(--ink)] transition hover:bg-[var(--surface-alt)]"
            >
              See how it works
            </a>
          </div>
        </section>

        {/* Problem */}
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl">You do not need more ideas. You need to know which one to bet on.</h2>
          <p className="mt-5 text-[var(--ink-muted)]">
            Reporting tools tell you what already happened. AI generators give you more to choose from.
            Neither answers the only question that matters at spend time.
          </p>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-3xl tracking-tight sm:text-4xl">One system, six moves</h2>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.name}
                className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] p-6 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  <p className="font-medium">{f.name}</p>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-3xl tracking-tight sm:text-4xl">How it works</h2>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] p-6">
                <div className="text-sm text-[var(--accent)]">{s.n}</div>
                <p className="mt-3 font-medium">{s.t}</p>
                <p className="mt-1.5 text-sm text-[var(--ink-muted)]">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Dark CTA band */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl bg-[var(--ink)] px-8 py-16 text-center text-white">
            <h2 className="text-3xl tracking-tight sm:text-4xl">Stop guessing which ad to test.</h2>
            <p className="mx-auto mt-4 max-w-md text-white/70">
              Connect your Meta account and get a decision, backed by your own data, in minutes.
            </p>
            <Link
              href="/signup"
              className="mt-9 inline-block rounded-[var(--radius-pill)] bg-white px-7 py-3 font-medium text-[var(--ink)] transition hover:opacity-90"
            >
              Get started free
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
