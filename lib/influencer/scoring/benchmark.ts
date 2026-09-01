// Engagement-vs-benchmark: is this creator's engagement rate above, at, or below what's TYPICAL for a creator
// of its size? Instagram engagement declines as follower count rises - a well-established, publicly published
// pattern in annual influencer-benchmark reports (micro accounts routinely out-engage mega ones). We express
// that as a rounded, conservative typical BAND per follower tier and classify the creator against it. These
// bands are approximate public benchmarks, deliberately not false-precise, and ledger-tunable (like the other
// calibrated thresholds in this engine). Pure. Returns null when followers or ER are unknown - never guessed.

export type BenchmarkVerdict = "above" | "typical" | "below";
export type EngagementBenchmark = {
  tierLabel: string;
  lowPct: number; // typical band low, in %
  highPct: number; // typical band high, in %
  erPct: number; // this creator's ER, in %
  verdict: BenchmarkVerdict;
  note: string;
};

// Rounded typical follower-ER bands (percent). Public-benchmark magnitudes: ER falls as audience grows.
const TIERS: { max: number; label: string; low: number; high: number }[] = [
  { max: 50_000, label: "10K–50K", low: 1.5, high: 3.5 },
  { max: 500_000, label: "50K–500K", low: 1.0, high: 2.5 },
  { max: 1_000_000, label: "500K–1M", low: 0.8, high: 1.8 },
  { max: Infinity, label: "1M+", low: 0.5, high: 1.5 },
];

/** Classify a creator's follower engagement rate against the typical public band for its size. */
export function engagementBenchmark(followers: number | null, er: number | null): EngagementBenchmark | null {
  if (followers == null || followers <= 0 || er == null) return null;
  const tier = TIERS.find((t) => followers <= t.max) ?? TIERS[TIERS.length - 1];
  const erPct = er * 100;
  const verdict: BenchmarkVerdict = erPct > tier.high ? "above" : erPct < tier.low ? "below" : "typical";
  return {
    tierLabel: tier.label,
    lowPct: tier.low,
    highPct: tier.high,
    erPct,
    verdict,
    note: `Typical for ${tier.label}: ~${tier.low}–${tier.high}% (approximate public benchmark; engagement declines with audience size).`,
  };
}
