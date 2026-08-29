// Shared, pure helpers for the transparent scoring engines. Every score decomposes into weighted
// components, each carrying its own confidence, and the composite's confidence is the WEAKEST load-bearing
// input (a fit built on a low-confidence audience read is itself low-confidence). No fabrication.

import type { ScoreComponent, TransparentScore, Confidence } from "../types.ts";

const RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1, none: 0 };
const BY_RANK: Confidence[] = ["none", "low", "medium", "high"];

/** Lowercase word tokens, punctuation stripped, short words dropped. For keyword overlap. */
export function tokens(...parts: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    for (const w of p.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
      if (w.length >= 3) out.add(w);
    }
  }
  return out;
}

/** Overlap of two token bags as 0..100: share of the SMALLER bag present in the larger. 0 when either empty. */
export function overlapScore(a: Set<string>, b: Set<string>): number {
  const small = a.size <= b.size ? a : b;
  const big = a.size <= b.size ? b : a;
  if (small.size === 0 || big.size === 0) return 0;
  let hit = 0;
  for (const w of small) if (big.has(w)) hit += 1;
  return Math.round((hit / small.size) * 100);
}

/** The weakest confidence among the components that carry weight. */
export function weakestConfidence(components: ScoreComponent[]): Confidence {
  const loadBearing = components.filter((c) => c.weight > 0);
  if (loadBearing.length === 0) return "none";
  let min = 3;
  for (const c of loadBearing) min = Math.min(min, RANK[c.confidence]);
  return BY_RANK[min];
}

/** Compose weighted components into a TransparentScore. Weights are renormalized over components with a
 * usable (confidence != none) reading, so a missing input drops out and rebalances rather than dragging the
 * score to 0. Confidence = weakest kept. */
export function compose(components: ScoreComponent[], reason: string): TransparentScore {
  const usable = components.filter((c) => c.confidence !== "none" && c.weight > 0);
  const totalW = usable.reduce((s, c) => s + c.weight, 0);
  const score = totalW > 0 ? Math.round(usable.reduce((s, c) => s + c.weight * c.score, 0) / totalW) : 0;
  return {
    score,
    components,
    formula: "sum(weight * component) over components with a usable reading, weights renormalized to 1",
    reason,
    confidence: weakestConfidence(usable),
  };
}
