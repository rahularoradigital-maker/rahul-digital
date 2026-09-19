// Free calculator tools (organic backlink magnets + product-logic demos). Data + PURE math live here, in one
// tested place (see scripts/check-tools.ts); the client UI (components/marketing/tool-calculator.tsx) imports
// these compute fns and switches on slug. No fabricated data: the user enters their own numbers, and every
// formula is a real, well-established media-buying identity. Powers /tools and /tools/[tool].

export type Field = {
  key: string;
  label: string;
  suffix?: string; // e.g. "%", "x", "$"
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  kind?: "number" | "toggle";
};

export type Tool = {
  slug: string;
  name: string; // short registry/card name
  h1: string;
  dek: string;
  category: string;
  intro: string; // answer-first markdown, rendered above the calculator
  fields: Field[];
  related?: string[]; // blog slugs / glossary term slugs to link out to
};

export const TOOLS: Tool[] = [
  {
    slug: "roas-break-even-calculator",
    name: "ROAS break-even calculator",
    h1: "ROAS break-even calculator",
    dek: "Find the exact ROAS where your ads stop losing money, from your gross margin.",
    category: "Efficiency",
    intro:
      "Your break-even ROAS is one divided by your gross margin. If your gross margin is 40% (0.4), you break even at a ROAS of 2.5, because every $1 of revenue only leaves $0.40 to cover the ad that produced it. Anything above your break-even ROAS is profit on ad spend; anything below is a loss, no matter how good the number looks next to an industry benchmark. There is no universal 'good ROAS' — yours is set by your own margin. Enter your gross margin below to get the exact line your ads have to clear.",
    fields: [
      { key: "marginPct", label: "Gross margin", suffix: "%", placeholder: "40", min: 1, max: 99, step: 1 },
    ],
    related: ["good-roas-for-d2c-brand", "roas"],
  },
  {
    slug: "ltv-cac-ratio-calculator",
    name: "LTV:CAC ratio calculator",
    h1: "LTV:CAC ratio calculator",
    dek: "See how much a customer is worth versus what they cost, and how fast you get paid back.",
    category: "Economics",
    intro:
      "Your LTV:CAC ratio is customer lifetime gross profit divided by customer acquisition cost. A widely-used rule of thumb is that a healthy subscription or D2C business runs around 3:1 or better — a customer is worth about three times what it costs to acquire them — while 1:1 means you are buying revenue at a loss once costs are counted. Lifetime value here is gross profit, not revenue: average order value times gross margin times the number of orders a customer makes. Payback is how many orders it takes to recover the acquisition cost. Enter your numbers to see both.",
    fields: [
      { key: "aov", label: "Average order value", suffix: "$", placeholder: "80", min: 1, step: 1 },
      { key: "marginPct", label: "Gross margin", suffix: "%", placeholder: "40", min: 1, max: 99, step: 1 },
      { key: "ordersPerCustomer", label: "Orders per customer (lifetime)", placeholder: "3", min: 1, step: 0.1 },
      { key: "cac", label: "Customer acquisition cost", suffix: "$", placeholder: "60", min: 1, step: 1 },
    ],
    related: ["cac", "ncac", "ltv"],
  },
  {
    slug: "scale-refresh-kill-calculator",
    name: "Scale / refresh / kill calculator",
    h1: "Should you scale, refresh, or kill this ad?",
    dek: "A deterministic verdict on one ad from its ROAS, target, frequency, and learning status.",
    category: "Decision",
    intro:
      "The right move on an ad is not a gut call — it follows from four things: how its ROAS compares to your target, whether its frequency is climbing (the tell for creative fatigue), and whether it is still in the learning phase. If it is still learning, you wait, because changing budget or bids resets delivery. If ROAS is well above target and frequency is stable, you scale. If ROAS is holding but frequency has jumped, the problem is a tiring creative, so you refresh before you cut. If ROAS is far below break-even, you kill it and move the money. This calculator applies that logic directly — it mirrors how AdScale reasons, in a simplified, directional form. It is a guide, not a substitute for reading the full account.",
    fields: [
      { key: "roas", label: "Current ROAS", suffix: "x", placeholder: "2.4", min: 0, step: 0.1 },
      { key: "targetRoas", label: "Your target ROAS", suffix: "x", placeholder: "2.0", min: 0.1, step: 0.1 },
      { key: "frequency", label: "Current frequency (last 7d)", placeholder: "3.2", min: 0, step: 0.1 },
      { key: "freqBaseline", label: "Frequency when it launched", placeholder: "2.0", min: 0, step: 0.1 },
      { key: "inLearning", label: "Still in the learning phase?", kind: "toggle" },
    ],
    related: ["how-to-decide-what-to-change-in-meta-ads", "creative-fatigue", "learning-phase"],
  },
];

export function allTools(): Tool[] {
  return TOOLS;
}
export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

// ---- Pure math (tested in scripts/check-tools.ts). Rounding helpers keep display honest. ----

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// Break-even ROAS = 1 / gross margin. marginPct is 1..99.
export function computeBreakEvenRoas(marginPct: number): { breakEvenRoas: number } {
  if (!(marginPct > 0) || marginPct >= 100) return { breakEvenRoas: NaN };
  return { breakEvenRoas: round(100 / marginPct) };
}

export type LtvCacInput = { aov: number; marginPct: number; ordersPerCustomer: number; cac: number };
export type LtvCacResult = { grossPerOrder: number; ltv: number; ratio: number; paybackOrders: number };
// LTV (gross-profit) = AOV x margin x orders. Ratio = LTV / CAC. Payback = CAC / gross-per-order.
export function computeLtvCac(i: LtvCacInput): LtvCacResult {
  const grossPerOrder = i.aov * (i.marginPct / 100);
  const ltv = grossPerOrder * i.ordersPerCustomer;
  const ratio = i.cac > 0 ? ltv / i.cac : NaN;
  const paybackOrders = grossPerOrder > 0 ? i.cac / grossPerOrder : NaN;
  return { grossPerOrder: round(grossPerOrder), ltv: round(ltv), ratio: round(ratio), paybackOrders: round(paybackOrders, 1) };
}

export type TriageInput = { roas: number; targetRoas: number; frequency: number; freqBaseline: number; inLearning: boolean };
export type Verdict = "scale" | "refresh" | "kill" | "hold";
export type TriageResult = { verdict: Verdict; reason: string };
// Deterministic ad triage. Order matters: learning-phase guard first (never change a learning ad), then a
// clear loss (kill), then a clean winner with stable delivery (scale), then fatigue (refresh), else hold.
export function computeAdTriage(i: TriageInput): TriageResult {
  if (i.inLearning) {
    return { verdict: "hold", reason: "This ad is still in the learning phase. Changing budget or bids now resets delivery and wastes the learning. Wait until it stabilises before acting." };
  }
  const r = i.targetRoas > 0 ? i.roas / i.targetRoas : NaN;
  const pct = Number.isFinite(r) ? Math.round(r * 100) : 0;
  const fatigued = i.freqBaseline > 0 && i.frequency / i.freqBaseline >= 1.3;
  const freqX = i.freqBaseline > 0 ? round(i.frequency / i.freqBaseline, 1) : 0;

  if (Number.isFinite(r) && r < 0.6) {
    return { verdict: "kill", reason: `ROAS is about ${pct}% of your target and well below break-even. Cut this ad and move the budget to something that is working.` };
  }
  if (Number.isFinite(r) && r >= 1.2 && !fatigued) {
    return { verdict: "scale", reason: `ROAS is about ${pct}% of your target with stable frequency. Scale the budget gradually (roughly +20-30% at a time) so you do not reset delivery.` };
  }
  if (fatigued && Number.isFinite(r) && r >= 0.6) {
    return { verdict: "refresh", reason: `Frequency is about ${freqX}x its launch level, the classic creative-fatigue signal. Refresh the creative before you cut spend, the audience and offer may still be fine.` };
  }
  return { verdict: "hold", reason: `ROAS is about ${pct}% of your target with no clear fatigue signal. Hold, keep the budget steady, and keep watching frequency and cost per result.` };
}
