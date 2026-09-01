"use client";

import { useState } from "react";

type Verdict = "Scale" | "Test" | "Kill";

const VERDICT_STYLE: Record<Verdict, string> = {
  Scale: "text-[var(--good-ink)] bg-[var(--good-bg)]",
  Test: "text-[var(--warn-ink)] bg-[var(--warn-bg)]",
  Kill: "text-[var(--bad-ink)] bg-[var(--bad-bg)]",
};

const AGENTS = [
  {
    name: "Scout",
    role: "Competitor Tracking",
    desc: "Watches every competitor ad, hook and offer across your category.",
    plan: [
      { label: "Founder origin story", verdict: "Scale" as Verdict },
      { label: "Regional UGC", verdict: "Test" as Verdict },
      { label: "Comparison static v4", verdict: "Kill" as Verdict },
    ],
  },
  {
    name: "Adam",
    role: "Creative Strategist",
    desc: "Drafts hooks, scripts and statics from what is working right now.",
    plan: [
      { label: "Problem-agitate hook", verdict: "Test" as Verdict },
      { label: "Before/after carousel", verdict: "Scale" as Verdict },
      { label: "Generic feature list", verdict: "Kill" as Verdict },
    ],
  },
  {
    name: "Echo",
    role: "Voice-of-Customer",
    desc: "Turns reviews, DMs and Reddit into objections and desires.",
    plan: [
      { label: "Sensitive-skin angle", verdict: "Test" as Verdict },
      { label: "Cruelty-free proof", verdict: "Scale" as Verdict },
      { label: "Price-only messaging", verdict: "Kill" as Verdict },
    ],
  },
  {
    name: "Planner",
    role: "Weekly Test Plan",
    desc: "Ranks everything by confidence and ships a plan each Monday.",
    plan: [
      { label: "Seasonal hook", verdict: "Scale" as Verdict },
      { label: "Value-seeker angle", verdict: "Test" as Verdict },
      { label: "Repeated failed angle", verdict: "Kill" as Verdict },
    ],
  },
];

const DOTS = [
  "var(--accent)", "var(--accent-soft)", "var(--accent-soft)", "var(--accent)", "var(--accent-soft)", "var(--accent)",
  "var(--accent-soft)", "var(--accent)", "var(--accent-soft)", "var(--accent-soft)", "var(--accent)", "var(--accent-soft)",
  "var(--accent)", "var(--accent-soft)", "var(--accent-soft)", "var(--accent)", "var(--accent-soft)", "var(--accent)",
];

const ANALYTICS = [
  { k: "Ranked tests this week", v: "12", delta: "+3" },
  { k: "Avg ROAS on scaled", v: "3.4x", delta: "+38%" },
  { k: "Dead angles avoided", v: "22", delta: "" },
  { k: "Strategist hours saved", v: "6h", delta: "/wk" },
];

const INTEGRATIONS = ["Meta Ads", "TikTok", "Shopify", "GA4", "Klaviyo", "Slack"];

const API_SNIPPET = `curl -X POST \\
  https://api.adscaledigital.co/v1/plan \\
  -H 'Authorization: <api-key>' \\
  -d '{
    "account_id": "act_9f3c...",
    "goal": "roas"
  }'`;

const TABS = ["Overview", "Analytics", "Integrations", "API"] as const;

export function ProductDemo() {
  const [tab, setTab] = useState(0);
  const [agent, setAgent] = useState(0);
  const [generated, setGenerated] = useState(false);
  const active = AGENTS[agent];

  return (
    <section className="pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-6 flex flex-wrap gap-3">
          {TABS.map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              className={`rounded-full px-5 py-2.5 text-[15px] font-medium transition ${
                tab === i
                  ? "border border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] p-4 md:grid-cols-[320px_1fr]">
          {/* Agent picker */}
          <div className="rounded-[var(--radius-card)] bg-[var(--bg)] p-4">
            <p className="mb-3 font-medium">Choose an agent</p>
            {AGENTS.map((a, i) => (
              <button
                key={a.name}
                onClick={() => {
                  setAgent(i);
                  setGenerated(false);
                }}
                className={`mb-2 flex w-full items-center gap-3 rounded-[var(--radius-card)] border bg-[var(--surface)] p-3 text-left transition ${
                  agent === i ? "border-[var(--accent)]" : "border-[var(--hairline)]"
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  &bull;
                </span>
                <span>
                  <span className="block font-medium">{a.name}</span>
                  <span className="block text-[13px] text-[var(--ink-muted)]">{a.role}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Right panel per tab */}
          {tab === 0 && (
            <div className="relative min-h-[260px] overflow-hidden rounded-[var(--radius-card)] bg-[linear-gradient(135deg,var(--accent-soft),var(--surface))] p-6">
              <div className="grid grid-cols-6 gap-2" style={{ gridTemplateColumns: "repeat(6,32px)" }}>
                {DOTS.map((d, i) => (
                  <span key={i} className="h-8 w-8 rounded-full" style={{ background: d }} />
                ))}
              </div>
              <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] p-4">
                <div className="mb-1 font-medium">
                  {active.name} &middot; {active.role}
                </div>
                <div className="mb-3 text-[13px] text-[var(--ink-muted)]">{active.desc}</div>
                <button
                  onClick={() => setGenerated(true)}
                  className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  {generated ? "Plan ready" : "Build my test plan"}
                </button>
                {generated && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {active.plan.map((p) => (
                      <div key={p.label} className="flex items-center justify-between">
                        <span className="text-[13px]">{p.label}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${VERDICT_STYLE[p.verdict]}`}
                        >
                          {p.verdict}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 1 && (
            <div className="rounded-[var(--radius-card)] bg-[var(--bg)] p-6">
              {ANALYTICS.map((r) => (
                <div
                  key={r.k}
                  className="flex items-center justify-between border-b border-[var(--hairline)] py-3.5 last:border-0"
                >
                  <span className="text-sm text-[var(--ink-muted)]">{r.k}</span>
                  <span className="text-lg font-medium">
                    {r.v}{" "}
                    {r.delta && <span className="text-[13px] font-medium text-[var(--good-ink)]">{r.delta}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === 2 && (
            <div className="grid grid-cols-2 content-start gap-3 rounded-[var(--radius-card)] bg-[var(--bg)] p-6 sm:grid-cols-3">
              {INTEGRATIONS.map((i) => (
                <div
                  key={i}
                  className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-4 text-center text-sm font-medium"
                >
                  {i}
                </div>
              ))}
            </div>
          )}

          {tab === 3 && (
            <div className="overflow-x-auto rounded-[var(--radius-card)] bg-[var(--ink)] p-6">
              <pre className="font-mono text-[12.5px] leading-relaxed text-[#e6e6e2]">{API_SNIPPET}</pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
