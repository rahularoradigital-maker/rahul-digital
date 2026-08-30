// Per-model token pricing for AI-cost accounting. PURE (no I/O, no server-only) so the gate exercises it.
// USD per 1,000,000 tokens, {input, output}. Matched by model-name prefix, longest/most-specific first.
// APPROXIMATE list prices - confirm current values in each provider's pricing page; env cannot change these
// (accounting, not runtime). Gemini free tier bills $0 in practice, but we cost it at list price so the
// dashboard shows the true marginal value of usage.

// Version + provenance of this pricing table (control-plane Phase 7: pricing must be versioned, not silent).
// Bump when any price changes; recorded conceptually with each cost so historical costs stay reproducible.
export const MODEL_PRICING_VERSION = "2026-08-30";
export const MODEL_PRICING_SOURCE = "provider public pricing pages (approximate) - confirm before billing on it";

type Price = { match: string; in: number; out: number };

// Order matters: more specific prefixes first (e.g. "gpt-4o-mini" before "gpt-4o").
const PRICES: Price[] = [
  { match: "gemini-flash-lite", in: 0.1, out: 0.4 },
  { match: "gemini-3.6-flash", in: 0.3, out: 1.2 },
  { match: "gemini-3-pro", in: 1.25, out: 5.0 },
  { match: "gemini-flash", in: 0.3, out: 1.2 },
  { match: "gemini", in: 0.3, out: 1.2 },
  { match: "gpt-4o-mini", in: 0.15, out: 0.6 },
  { match: "gpt-4o", in: 2.5, out: 10.0 },
  { match: "gpt-4.1-mini", in: 0.4, out: 1.6 },
  { match: "gpt-4.1", in: 2.0, out: 8.0 },
  { match: "gpt", in: 2.5, out: 10.0 },
  { match: "claude-haiku", in: 1.0, out: 5.0 },
  { match: "claude-sonnet", in: 3.0, out: 15.0 },
  { match: "claude-opus", in: 15.0, out: 75.0 },
  { match: "claude", in: 3.0, out: 15.0 },
];

const DEFAULT: Price = { match: "", in: 1.0, out: 3.0 }; // unknown model -> a middling estimate, never 0

export function priceFor(model: string): { in: number; out: number } {
  const m = (model || "").toLowerCase();
  const hit = PRICES.find((p) => m.startsWith(p.match));
  return hit ? { in: hit.in, out: hit.out } : { in: DEFAULT.in, out: DEFAULT.out };
}

// Cost of one call, in USD. Rounded to 6 decimals (fractions of a cent matter at volume).
export function costUsd(model: string, promptTokens: number, completionTokens: number): number {
  const p = priceFor(model);
  const cost = (Math.max(0, promptTokens) / 1e6) * p.in + (Math.max(0, completionTokens) / 1e6) * p.out;
  return Math.round(cost * 1e6) / 1e6;
}
