"use client";

import { useState } from "react";
import Link from "next/link";

const GROUPS = [
  {
    name: "What to test",
    intro:
      "Find the highest-confidence experiments from competitor moves, customer signals and your own history.",
    items: [
      { title: "Competitor research", body: "Track ads, hooks and offers side by side across your category." },
      { title: "Ranked weekly plan", body: "What to make next, ranked by confidence and expected lift." },
      { title: "Winning-ad detection", body: "Surfaced by ad longevity and downstream conversion, not impressions." },
      { title: "Category trends", body: "See which formats are rising and fading, week over week." },
      { title: "New-angle discovery", body: "Fresh angles pulled from live in-market winners." },
    ],
  },
  {
    name: "What to scale",
    intro:
      "Double down on what converts, with reasoning against your winners and competitor benchmarks.",
    items: [
      { title: "Creative reasoning", body: "Understand exactly why an ad is working or not." },
      { title: "Fatigue detection", body: "Catch creative decay before spend leaks." },
      { title: "Benchmark compare", body: "You vs. your history vs. the category." },
      { title: "ROAS decomposition", body: "See what actually drove the result." },
    ],
  },
  {
    name: "What to stop",
    intro:
      "Deprioritize hooks and formats unlikely to improve, with clear, evidenced kill decisions.",
    items: [
      { title: "Brand Brain memory", body: "Never retest an angle that already failed." },
      { title: "Kill decisions", body: "Clear stop signals backed by evidence." },
      { title: "Saved-budget report", body: "See exactly the spend you avoided." },
      { title: "Low-intent flags", body: "Catch high-click, low-conversion traps early." },
    ],
  },
];

export function UseCases() {
  const [group, setGroup] = useState(0);
  const active = GROUPS[group];

  return (
    <section id="use-cases" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-[40px] leading-[1.08]">Driving results across teams</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {GROUPS.map((g, i) => (
            <button
              key={g.name}
              onClick={() => setGroup(i)}
              className={`rounded-[var(--radius-pill)] px-5 py-2.5 text-[15px] font-medium transition ${
                group === i
                  ? "bg-[var(--ink)] text-white"
                  : "border border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-[var(--ink-muted)]">{active.intro}</p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {active.items.map((c) => (
            <div
              key={c.title}
              className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] p-6 transition hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[0_14px_32px_-20px_rgba(37,37,37,0.35)]"
            >
              <h3 className="text-lg font-medium">{c.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-muted)]">{c.body}</p>
            </div>
          ))}
          <div className="grid place-items-center rounded-[var(--radius-card)] bg-[var(--accent-soft)] p-6">
            <Link
              href="/product"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-5 py-2.5 text-[15px] font-medium text-[var(--ink)] transition hover:opacity-90"
            >
              Discover more &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
