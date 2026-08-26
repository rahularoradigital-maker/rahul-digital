"use client";

import { useState } from "react";

const STEPS = [
  {
    num: "01",
    title: "Scan",
    body: "Every signal you collect, competitor ads, customer voice and your own account, continuously scanned and structured.",
    bullets: ["Competitor tracking", "Voice-of-customer", "Live account sync"],
  },
  {
    num: "02",
    title: "Decide",
    body: "AdBrain AI weighs everything and returns clear decisions, what to test, scale and stop, ranked by confidence.",
    bullets: ["Ranked test plan", "Kill / scale calls", "Confidence scoring"],
  },
  {
    num: "03",
    title: "Create",
    body: "Hooks, scripts and statics written from exactly what is working in-market, in your brand voice.",
    bullets: ["Hook generation", "UGC & VSL scripts", "Static concepts"],
  },
  {
    num: "04",
    title: "Scale",
    body: "Momentum tracking feeds every outcome back into Brand Brain, so the agents get sharper each week.",
    bullets: ["Momentum tracking", "Brand Brain memory", "ROAS reports"],
  },
];

export function Method() {
  const [step, setStep] = useState(0);
  const active = STEPS[step];

  return (
    <section
      id="method"
      className="border-y border-[var(--hairline)] bg-[var(--surface)] py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--bg)] px-4 py-1.5 text-[13px] font-medium text-[var(--ink-muted)]">
            How it works
          </span>
          <h2 className="mx-auto max-w-2xl text-[40px] leading-[1.08]">
            The AI platform for your creative decisions
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-[var(--ink-muted)]">
            The AdBrain AI Method, developed with and run by leading growth teams globally.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.num}
                onClick={() => setStep(i)}
                className={`rounded-[var(--radius-card)] px-5 py-4 text-left text-[17px] font-medium transition ${
                  step === i ? "bg-[var(--ink)] text-white" : "bg-[var(--bg)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                <span className="mr-2 text-[13px] opacity-60">{s.num}</span>
                {s.title}
              </button>
            ))}
          </div>
          <div className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--bg)] p-8">
            <h3 className="text-2xl">{active.title}</h3>
            <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-[var(--ink-muted)]">{active.body}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {active.bullets.map((b) => (
                <div
                  key={b}
                  className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-sm"
                >
                  {b}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
