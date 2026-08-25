import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const FEATURES = [
  { name: "Signals", desc: "Surface what is trending in your niche before it saturates." },
  { name: "Scan", desc: "Pull competitor ads from the Meta Ad Library, automatically." },
  { name: "Deconstruct", desc: "Break every ad into hook, angle, format, and claim." },
  { name: "Plan", desc: "Get a ranked weekly test plan with confidence scores." },
  { name: "Brain", desc: "A knowledge graph that remembers what wins in your market." },
];

const STEPS = [
  { n: 1, t: "Add your brand", d: "Tell AdBrain your niche and your competitors." },
  { n: 2, t: "We scan the ads", d: "AdBrain collects the creative your competitors are running." },
  { n: 3, t: "AI deconstructs them", d: "Every ad becomes structured facts in your Brand Brain." },
  { n: 4, t: "You get a test plan", d: "A ranked list of what to test next, and why." },
  { n: 5, t: "The Brain learns", d: "Results feed back, so next week's plan is sharper." },
];

const COMPARE = [
  ["Tells you what to test next", true, false, false],
  ["Explains why an ad works", true, false, false],
  ["Learns from your past results", true, false, false],
  ["Shows what already happened", true, true, false],
  ["Generates raw creative", true, false, true],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="mx-auto max-w-6xl px-6 py-24 text-center">
            <span className="inline-block rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
              Creative Decision Intelligence for Meta growth teams
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Know what to test next, before you spend on it.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--muted)]">
              Ideas are not the problem. Which one to test is. AdBrain turns your competitors&apos;
              ads into a ranked weekly test plan you can trust.
            </p>
            <div className="mt-9 flex items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-[var(--brand)] px-6 py-3 font-medium text-[var(--brand-foreground)] transition hover:opacity-90"
              >
                Get started free
              </Link>
              <a
                href="#how"
                className="rounded-lg border border-[var(--border)] px-6 py-3 font-medium hover:bg-[var(--card)]"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            You do not need more ideas. You need to know which one to bet on.
          </h2>
          <p className="mt-4 text-[var(--muted)]">
            Reporting tools tell you what already happened. AI generators give you more to choose
            from. Neither answers the only question that matters at spend time.
          </p>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight">One system, five moves</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((f) => (
              <div
                key={f.name}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
              >
                <p className="font-semibold text-[var(--brand)]">{f.name}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Compare */}
        <section id="compare" className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Not a dashboard. Not a generator.
          </h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-3" />
                  <th className="p-3 font-semibold text-[var(--brand)]">AdBrain</th>
                  <th className="p-3 font-medium text-[var(--muted)]">Reporting tools</th>
                  <th className="p-3 font-medium text-[var(--muted)]">AI generators</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row[0] as string} className="border-t border-[var(--border)]">
                    <td className="p-3">{row[0]}</td>
                    {row.slice(1).map((cell, i) => (
                      <td key={i} className="p-3">
                        {cell ? (
                          <span className="text-[var(--brand)]">Yes</span>
                        ) : (
                          <span className="text-[var(--muted)]">No</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--brand)] text-sm font-bold text-[var(--brand-foreground)]">
                  {s.n}
                </div>
                <p className="mt-4 font-semibold">{s.t}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-6 py-20">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Stop guessing which ad to test.</h2>
            <p className="mx-auto mt-3 max-w-md text-[var(--muted)]">
              Set up your first brand in minutes and get a test plan backed by real competitor ads.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-block rounded-lg bg-[var(--brand)] px-6 py-3 font-medium text-[var(--brand-foreground)] transition hover:opacity-90"
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
