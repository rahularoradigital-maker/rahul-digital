// Phase 4/5 — Category Creative Map + white-space, PURE (operates on CreativePattern[] from the DB; no I/O).
// The plan's "Motion" box, computed from our own pattern database: the % distribution of personas/angles/
// formats across the market, and the creative territories nobody is using (the white space).
import type { CreativePattern } from "./schema.ts";

export type DistRow = { name: string; count: number; share: number };

// Distribution of one pattern type across all patterns (e.g. what % of angle-patterns are "transformation").
export function distribution(patterns: CreativePattern[], type: CreativePattern["type"]): DistRow[] {
  const counts = new Map<string, number>();
  for (const p of patterns) {
    if (p.type !== type) continue;
    const name = p.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export type CategoryMap = { personas: DistRow[]; angles: DistRow[]; formats: DistRow[] };
export function categoryMap(patterns: CreativePattern[]): CategoryMap {
  return { personas: distribution(patterns, "persona"), angles: distribution(patterns, "angle"), formats: distribution(patterns, "format") };
}

// Per-creative tuple: each creative (grouped by sourceRef) contributes its dominant persona/angle/format.
// Grouping by the creative is what lets us see COMBINATIONS (persona x angle x format), not just single-axis %.
function creativeTuples(patterns: CreativePattern[]): { persona: string; angle: string; format: string }[] {
  const byCreative = new Map<string, CreativePattern[]>();
  for (const p of patterns) {
    const key = p.sourceRef ?? p.id;
    (byCreative.get(key) ?? byCreative.set(key, []).get(key)!).push(p);
  }
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const first = (ps: CreativePattern[], t: CreativePattern["type"]) => {
    const hit = ps.find((p) => p.type === t);
    return hit ? norm(hit.text) : "";
  };
  const out: { persona: string; angle: string; format: string }[] = [];
  for (const ps of byCreative.values()) {
    const persona = first(ps, "persona");
    const angle = first(ps, "angle");
    const format = first(ps, "format");
    if (persona || angle || format) out.push({ persona, angle, format });
  }
  return out;
}

export type WhiteSpace = { persona: string; angle: string; format: string; marketShare: number };

// The creative territories the MARKET is under-using: enumerate every observed persona x angle x format from
// the tuples, then return the combinations whose market share is at or below `threshold` (default 5%),
// including combinations that never appear (share 0) but whose parts each exist in the market. Sorted by the
// most "proven parts, least-used combination" first (each axis is popular on its own, rare together).
export function whiteSpace(patterns: CreativePattern[], opts: { threshold?: number } = {}): WhiteSpace[] {
  const threshold = opts.threshold ?? 0.05;
  const tuples = creativeTuples(patterns);
  const total = tuples.length;
  if (!total) return [];

  const personas = [...new Set(tuples.map((t) => t.persona).filter(Boolean))];
  const angles = [...new Set(tuples.map((t) => t.angle).filter(Boolean))];
  const formats = [...new Set(tuples.map((t) => t.format).filter(Boolean))];

  const share = (p: string, a: string, f: string) =>
    tuples.filter((t) => t.persona === p && t.angle === a && t.format === f).length / total;
  const axisShare = (sel: (t: { persona: string; angle: string; format: string }) => string, v: string) =>
    tuples.filter((t) => sel(t) === v).length / total;

  const gaps: (WhiteSpace & { proven: number })[] = [];
  for (const p of personas) for (const a of angles) for (const f of formats) {
    const s = share(p, a, f);
    if (s > threshold) continue; // already well-served
    // "proven parts": each axis is individually popular, so the combination is a credible gap, not noise.
    const proven = axisShare((t) => t.persona, p) + axisShare((t) => t.angle, a) + axisShare((t) => t.format, f);
    gaps.push({ persona: p, angle: a, format: f, marketShare: s, proven });
  }
  return gaps
    .sort((x, y) => y.proven - x.proven || x.marketShare - y.marketShare)
    .slice(0, 20)
    .map(({ persona, angle, format, marketShare }) => ({ persona, angle, format, marketShare }));
}
