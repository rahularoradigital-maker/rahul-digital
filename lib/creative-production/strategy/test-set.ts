// A/B test-set builder (Studio improvement #3). Media buyers test 2-4 variants, not one asset. Instead of
// INVENTING new copy (which would fabricate claims), this picks a DIVERSE set from the product's already-
// ranked, real concepts: the top concept, then the next-best concepts that differ on a lever (angle ->
// awareness stage -> format), so the exported batch is a genuine A/B test across angles rather than N of the
// same idea. PURE + deterministic. Every variant traces to a real ranked concept.

export type TestSetConcept = {
  id: string;
  score: number;
  angle?: string;
  awarenessStage?: string;
  formatId?: string;
};

// The levers we diversify on, most-important first: a different ANGLE is the strongest test; then a
// different awareness STAGE; then a different FORMAT. Two concepts are "the same test" if they match on all.
function leverKey(c: TestSetConcept): string {
  return `${(c.angle ?? "").toLowerCase()}|${(c.awarenessStage ?? "").toLowerCase()}|${(c.formatId ?? "").toLowerCase()}`;
}

/**
 * Pick up to `n` concepts that form a real A/B set: highest score first, then greedily add the next-highest
 * concept whose (angle, awareness, format) lever-combo hasn't been used yet. Falls back to the next-highest
 * remaining concepts only once every distinct lever-combo is already represented (so it still returns `n`
 * when the product has few distinct angles). Never fabricates a concept.
 */
export function buildTestSet<T extends TestSetConcept>(concepts: T[], n = 3): T[] {
  if (n <= 0 || concepts.length === 0) return [];
  const ranked = [...concepts].sort((a, b) => b.score - a.score);
  const chosen: T[] = [];
  const usedLevers = new Set<string>();

  // Pass 1: greedily take the best concept of each not-yet-seen lever combo.
  for (const c of ranked) {
    if (chosen.length >= n) break;
    const k = leverKey(c);
    if (usedLevers.has(k)) continue;
    usedLevers.add(k);
    chosen.push(c);
  }
  // Pass 2: if we still need more (few distinct angles), fill with the next-highest remaining concepts.
  if (chosen.length < n) {
    for (const c of ranked) {
      if (chosen.length >= n) break;
      if (!chosen.includes(c)) chosen.push(c);
    }
  }
  return chosen.slice(0, n);
}

// How many genuinely-distinct tests the set covers (distinct lever combos) - so the UI can say
// "3 variants across 3 angles" vs "3 variants, 1 angle" honestly.
export function distinctAngleCount(set: TestSetConcept[]): number {
  return new Set(set.map(leverKey)).size;
}
