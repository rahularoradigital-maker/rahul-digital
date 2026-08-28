import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

type Verdict = "scale" | "test" | "kill";

const VERDICT_STYLES: Record<Verdict, string> = {
  scale: "bg-[var(--good-bg)] text-[var(--good-ink)]",
  test: "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
  kill: "bg-[var(--bad-bg)] text-[var(--bad-ink)]",
};

const MODULES: {
  step: string;
  h: string;
  d: string;
  points: string[];
  mock: string;
  rows: { k: string; v: string; verdict: Verdict }[];
}[] = [
  {
    step: "01 . SCAN",
    h: "See every signal in one place",
    d: "Competitor ads, customer voice and your own account, continuously scanned and structured so nothing gets missed.",
    points: [
      "Competitor ad, hook and offer tracking",
      "Reviews, DMs, comments and Reddit",
      "Live Meta account sync",
    ],
    mock: "signals",
    rows: [
      { k: "Competitor ads tracked", v: "1,240", verdict: "scale" },
      { k: "Customer mentions", v: "3,802", verdict: "scale" },
      { k: "Category trend", v: "Regional up", verdict: "test" },
    ],
  },
  {
    step: "02 . DECIDE",
    h: "Turn signals into a ranked plan",
    d: "AdBrain AI weighs everything and returns clear verdicts, what to test, scale, iterate and kill, ranked by confidence.",
    points: [
      "Ranked weekly test plan",
      "Kill, iterate and scale verdicts",
      "Confidence scoring with evidence",
    ],
    mock: "test plan",
    rows: [
      { k: "Founder origin story", v: "Scale", verdict: "scale" },
      { k: "Regional UGC", v: "Test", verdict: "test" },
      { k: "Comparison static v4", v: "Kill", verdict: "kill" },
    ],
  },
  {
    step: "03 . CREATE",
    h: "Draft the creative that wins",
    d: "Hooks, scripts and statics written from exactly what is working in-market right now, in your brand voice.",
    points: ["Hook and angle generation", "UGC and VSL scripts", "Static concept briefs"],
    mock: "adam studio",
    rows: [
      { k: "Hooks drafted", v: "12", verdict: "scale" },
      { k: "Scripts ready", v: "4", verdict: "scale" },
      { k: "Static briefs", v: "6", verdict: "scale" },
    ],
  },
  {
    step: "04 . TRACK",
    h: "Learn from every experiment",
    d: "Momentum tracking feeds every outcome back into Brand Brain, so the agents get sharper each week.",
    points: [
      "CTR, ROAS, CPA and fatigue tracking",
      "Brand Brain long-term memory",
      "ROAS decomposition reports",
    ],
    mock: "brand brain",
    rows: [
      { k: "Tests remembered", v: "318", verdict: "scale" },
      { k: "Dead angles flagged", v: "22", verdict: "kill" },
      { k: "Avg ROAS lift", v: "+38%", verdict: "scale" },
    ],
  },
];

export default function ProductPage() {
  return (
    <>
      {/* Announcement bar */}
      <div className="bg-[var(--accent)] px-4 py-2 text-center text-sm text-white">
        Meta-first creative and media intelligence. Google coming next.
      </div>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-20 pb-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-1.5 text-sm text-[var(--ink-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            The AdBrain AI platform
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Four agents. One weekly decision loop.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--ink-muted)]">
            AdBrain AI connects to your Meta account, scans the market, and hands your team a ranked
            test plan, with the reasoning behind every call.
          </p>
          <div className="mt-9">
            <Link
              href="/book-demo"
              className="inline-block rounded-full bg-[var(--ink)] px-7 py-3 font-medium text-white transition hover:opacity-90"
            >
              Book a demo
            </Link>
          </div>
        </section>

        {/* Alternating feature modules */}
        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col gap-10">
            {MODULES.map((m, i) => {
              const flip = i % 2 === 1;
              return (
                <div
                  key={m.step}
                  className={
                    "grid items-center gap-10 lg:grid-cols-2" +
                    (i > 0 ? " border-t border-[var(--hairline)] pt-10" : "")
                  }
                >
                  {/* Copy */}
                  <div className={flip ? "lg:order-2" : ""}>
                    <div className="text-sm font-medium text-[var(--accent)]">{m.step}</div>
                    <h2 className="mt-3 text-3xl tracking-tight sm:text-4xl">{m.h}</h2>
                    <p className="mt-3.5 text-lg leading-relaxed text-[var(--ink-muted)]">{m.d}</p>
                    <div className="mt-6 flex flex-col gap-3">
                      {m.points.map((pt) => (
                        <div key={pt} className="flex items-start gap-2.5 text-[15px]">
                          <span className="font-medium text-[var(--accent)]">&#10003;</span>
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mock card */}
                  <div className={flip ? "lg:order-1" : ""}>
                    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] p-6">
                      <div className="overflow-hidden rounded-[10px] bg-[var(--surface)] shadow-sm">
                        <div className="flex items-center gap-1.5 bg-[var(--ink)] px-3.5 py-2.5">
                          <span className="h-2 w-2 rounded-full bg-white/25" />
                          <span className="h-2 w-2 rounded-full bg-white/25" />
                          <span className="h-2 w-2 rounded-full bg-white/25" />
                          <span className="ml-2 text-xs text-white/60">AdBrain AI . {m.mock}</span>
                        </div>
                        <div className="px-5 py-2">
                          {m.rows.map((r) => (
                            <div
                              key={r.k}
                              className="flex items-center justify-between border-b border-[var(--hairline)] py-3 last:border-b-0"
                            >
                              <span className="text-sm text-[var(--ink-muted)]">{r.k}</span>
                              <span
                                className={
                                  "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase " +
                                  VERDICT_STYLES[r.verdict]
                                }
                              >
                                {r.v}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Dark CTA band */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl bg-[var(--ink)] px-8 py-16 text-center text-white">
            <h2 className="text-3xl tracking-tight sm:text-4xl">See your first test plan, live.</h2>
            <p className="mx-auto mt-4 max-w-md text-white/70">
              Connect your account and watch the agents build a ranked plan from your real data in
              minutes.
            </p>
            <Link
              href="/book-demo"
              className="mt-9 inline-block rounded-full bg-white px-7 py-3 font-medium text-[var(--ink)] transition hover:opacity-90"
            >
              Talk to founders
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
