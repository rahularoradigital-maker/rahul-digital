// FUTURE / not-yet-wired (ISSUE 18): this is the SEMANTIC diversity engine over spec-05 semantic
// fingerprints (lib/fingerprint.ts). It is NOT what the app renders - the live diversity is
// lib/creative/diversity.ts (deterministic, over lib/creative/fingerprint.ts). This file is exercised
// only by scripts/check-diversity.ts and is kept as the designed seam for embedding-based similarity.
//
// Diversity Engine — the five scores of spec 06 (I1–I5), computed over creative
// fingerprints (spec 05). Pure and deterministic: these measure diversity of
// IDEAS across fingerprint dimensions, never "number of ads".
//
// Honesty rules inherited from spec 06 §0:
// - Spend-weighted basis by default (§0.3): money at risk is the decision basis.
// - Null-dimension fingerprints are a DATA GAP, excluded from denominators and
//   reported as `unclassified` — never counted as sameness (spec 05 §7 guardrail).
// - Empty input / nothing classifiable → { status: "insufficient_data" }.
//   NEVER a fabricated score (mirrors lib/rules/metrics.ts sentinel style).
// - Every weight/threshold below is INTERNAL CALIBRATION, calibrate-at-build
//   (spec 06 §8): a defensible scaffold, not a benchmark.
//
// ponytail: no Chao–Shen small-sample bias correction and no §0.7 confidence
// band yet (needs snapshot history); calibrate/add at build per spec 06 §0.7–0.8.

import {
  FINGERPRINT_DIMENSIONS,
  similarity,
  type CreativeFingerprint,
  type FingerprintDimension,
} from "../fingerprint.ts";

/** One active creative with its spend weight (spend = FETCH OFFICIAL, spec 06 §0.2). */
export type DiversityItem = { fingerprint: CreativeFingerprint; spend: number };

const INSUFFICIENT = { status: "insufficient_data" } as const;

/**
 * Redundancy similarity cutoff τ (spec 06 §3): a pair is "near-duplicate" at
 * similarity >= τ. INTERNAL CALIBRATION, calibrate-at-build against human
 * "are these the same ad?" labels — never shipped as a benchmark.
 */
const REDUNDANCY_TAU = 0.8;

/**
 * White-space lattice cap (spec 06 §4): the full combinatorial space is
 * astronomically large and MUST be pruned to plausible cells or the score is
 * meaningless. Above this cap we refuse to score rather than pretend.
 * Calibrate-at-build.
 */
const MAX_LATTICE_CELLS = 10_000;

/** Drop items whose spend is not a finite number >= 0 (trust boundary). */
function validItems(items: DiversityItem[]): DiversityItem[] {
  return items.filter((it) => Number.isFinite(it.spend) && it.spend >= 0);
}

/** Spend per non-null label of one dimension + count of unclassified (null) items. */
function spendByLabel(
  items: DiversityItem[],
  dimension: FingerprintDimension
): { byLabel: Map<string, number>; total: number; unclassified: number } {
  const byLabel = new Map<string, number>();
  let total = 0;
  let unclassified = 0;
  for (const it of items) {
    const label = it.fingerprint[dimension];
    if (label === null) {
      unclassified++; // data gap, reported — never scored as sameness
      continue;
    }
    byLabel.set(label, (byLabel.get(label) ?? 0) + it.spend);
    total += it.spend;
  }
  return { byLabel, total, unclassified };
}

export type DiversityScoreResult =
  | {
      status: "ok";
      score: number; // 0..1 normalized effective-N
      effectiveN: number; // Hill number, q=1: "how many equally-run ideas"
      categories: number; // distinct labels observed
      unclassified: number; // items excluded for null dimension (data gap)
    }
  | { status: "insufficient_data" };

/**
 * I1 Diversity (spec 06 §1): spend-weighted Shannon entropy of the label
 * distribution → effective number of categories (Hill number, q=1: exp(H),
 * spec 06 §0.4) → normalized to 0..1 (spec 06 §0.5).
 *
 * `referenceTaxonomySize` is Kd, the count of POSSIBLE categories for the
 * dimension — calibrate-at-build with the operator. When given, score =
 * effN / Kd (running 2 of 10 relevant hooks evenly must NOT score fully
 * diverse). When absent we fall back to normalizing by categories OBSERVED,
 * which measures evenness only and overstates diversity of a narrow set —
 * documented fallback, replace with a real Kd at build (spec 06 §0.5).
 */
export function diversityScore(
  items: DiversityItem[],
  dimension: FingerprintDimension,
  referenceTaxonomySize?: number
): DiversityScoreResult {
  const { byLabel, total, unclassified } = spendByLabel(validItems(items), dimension);
  if (byLabel.size === 0 || total <= 0) return INSUFFICIENT;
  let entropy = 0;
  for (const spend of byLabel.values()) {
    const p = spend / total;
    if (p > 0) entropy -= p * Math.log(p);
  }
  const effectiveN = Math.exp(entropy);
  const k = referenceTaxonomySize ?? byLabel.size; // Kd; observed-count fallback (see doc)
  if (!Number.isFinite(k) || k < 1) return INSUFFICIENT;
  return {
    status: "ok",
    score: Math.min(1, effectiveN / k),
    effectiveN,
    categories: byLabel.size,
    unclassified,
  };
}

export type ConcentrationScoreResult =
  | {
      status: "ok";
      score: number; // normalized HHI, 0..1 (1 = all spend on one value)
      topShare: number; // largest single value's spend share
      hhi: number; // raw Herfindahl–Hirschman index
      unclassified: number;
    }
  | { status: "insufficient_data" };

/**
 * I2 Concentration (spec 06 §2): HHI of spend shares by dimension value,
 * normalized HHI* = (HHI − 1/K) / (1 − 1/K) → 0..1; plus topShare (CR1).
 * The inverse face of I1 read at q=2. K defaults to observed categories when
 * no reference taxonomy size is given (same fallback caveat as diversityScore).
 * Concentration is not inherently bad — read with performance + fatigue,
 * never alone (spec 06 §2 limitations).
 */
export function concentrationScore(
  items: DiversityItem[],
  dimension: FingerprintDimension,
  referenceTaxonomySize?: number
): ConcentrationScoreResult {
  const { byLabel, total, unclassified } = spendByLabel(validItems(items), dimension);
  if (byLabel.size === 0 || total <= 0) return INSUFFICIENT;
  let hhi = 0;
  let topShare = 0;
  for (const spend of byLabel.values()) {
    const s = spend / total;
    hhi += s * s;
    if (s > topShare) topShare = s;
  }
  const k = referenceTaxonomySize ?? byLabel.size;
  if (!Number.isFinite(k) || k < 1) return INSUFFICIENT;
  // K = 1 → HHI range degenerates to the point {1}: fully concentrated by definition.
  const score = k === 1 ? 1 : (hhi - 1 / k) / (1 - 1 / k);
  return { status: "ok", score, topShare, hhi, unclassified };
}

export type RedundancyScoreResult =
  | {
      status: "ok";
      score: number; // share of spend sitting on duplicate copies beyond one exemplar
      clusters: number; // near-duplicate clusters found (size >= 2)
      threshold: number; // the τ used (calibrate-at-build)
    }
  | { status: "insufficient_data" };

/**
 * I3 Redundancy (spec 06 §3): are these separate ads secretly the same idea?
 * Pairwise similarity() → connected-components clustering at τ → spend basis:
 * Redundancy = Σ_clusters (cluster_spend_share × (size−1)/size), i.e. the spend
 * sitting on copies beyond one exemplar per cluster. Equal contentHash is an
 * exact duplicate regardless of label coverage (spec 05 §7.1: identity beats
 * resemblance). If no pair is comparable at all (labels too sparse) →
 * insufficient_data — never substitute a guess for similarity.
 * Note: similar != redundant of PERFORMANCE (spec 06 §3 limitations); this
 * score flags consolidation candidates, it does not declare waste.
 */
export function redundancyScore(items: DiversityItem[]): RedundancyScoreResult {
  const valid = validItems(items);
  const n = valid.length;
  if (n < 2) return INSUFFICIENT;
  const totalSpend = valid.reduce((acc, it) => acc + it.spend, 0);
  if (totalSpend <= 0) return INSUFFICIENT;

  // Union-find over items. ponytail: O(n²) pairwise scan — fine for an active
  // ad set; upgrade path is ANN over embeddings when they land behind similarity().
  const parent = valid.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number) => {
    parent[find(i)] = find(j);
  };

  let comparablePairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = valid[i].fingerprint;
      const b = valid[j].fingerprint;
      if (a.contentHash === b.contentHash) {
        comparablePairs++;
        union(i, j); // exact duplicate: same bytes, score 1.0 (spec 05 §7.1)
        continue;
      }
      const sim = similarity(a, b);
      if (sim.status !== "ok") continue;
      comparablePairs++;
      if (sim.score >= REDUNDANCY_TAU) union(i, j);
    }
  }
  if (comparablePairs === 0) return INSUFFICIENT; // nothing measurable, say so

  const clusterSpend = new Map<number, { spend: number; size: number }>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const c = clusterSpend.get(root) ?? { spend: 0, size: 0 };
    c.spend += valid[i].spend;
    c.size += 1;
    clusterSpend.set(root, c);
  }
  let score = 0;
  let clusters = 0;
  for (const c of clusterSpend.values()) {
    if (c.size < 2) continue;
    clusters++;
    score += (c.spend / totalSpend) * ((c.size - 1) / c.size);
  }
  return { status: "ok", score, clusters, threshold: REDUNDANCY_TAU };
}

export type CoverageTarget = {
  dimension: FingerprintDimension;
  values: string[];
  /** Strategic priority weight (EXTERNAL business input, spec 06 §5). Default 1. */
  priority?: number;
};

export type CoverageScoreResult =
  | {
      status: "ok";
      score: number; // priority-weighted fraction of intended targets with live creative
      covered: number;
      total: number;
      gaps: { dimension: FingerprintDimension; value: string }[]; // actionable: what to fill
    }
  | { status: "insufficient_data" };

/**
 * I5 Coverage (spec 06 §5): of the operator-INTENDED targets, the
 * priority-weighted fraction with at least one live creative.
 * CoverageScore = Σᵢ priorityᵢ·covered(targetᵢ) / Σᵢ priorityᵢ.
 * Coverage is measured against a plan: without a target list it is UNDEFINED —
 * insufficient_data, never invented targets (the sharpest guardrail on I5).
 * Coverage != performance: covered-but-losing is still a problem.
 */
export function coverageScore(
  items: DiversityItem[],
  targets: CoverageTarget[]
): CoverageScoreResult {
  const valid = validItems(items);
  if (valid.length === 0) return INSUFFICIENT;
  if (targets.length === 0 || targets.every((t) => t.values.length === 0)) return INSUFFICIENT;

  let weightSum = 0;
  let coveredWeight = 0;
  let covered = 0;
  let total = 0;
  const gaps: { dimension: FingerprintDimension; value: string }[] = [];
  for (const t of targets) {
    const priority = t.priority !== undefined && Number.isFinite(t.priority) && t.priority > 0 ? t.priority : 1;
    for (const value of t.values) {
      total++;
      weightSum += priority;
      const hit = valid.some((it) => it.fingerprint[t.dimension] === value);
      if (hit) {
        covered++;
        coveredWeight += priority;
      } else {
        gaps.push({ dimension: t.dimension, value });
      }
    }
  }
  if (weightSum <= 0) return INSUFFICIENT;
  return { status: "ok", score: coveredWeight / weightSum, covered, total, gaps };
}

export type WhiteSpaceResult =
  | {
      status: "ok";
      score: number; // share of the pruned lattice that is unoccupied
      missing: Record<string, string>[]; // the empty cells: {dimension: value, ...}
      count: number; // = missing.length
      total: number; // lattice size scored
    }
  | { status: "insufficient_data" };

/**
 * I4 White-Space (spec 06 §4): unoccupied cells of the fingerprint-combination
 * lattice defined by `universe` (a PRUNED, build-defined candidate space —
 * e.g. persona × hook × format restricted to plausible cells). A cell is
 * occupied when at least one creative matches EVERY dimension value in it
 * (null never matches: a missing label is a gap, not an occupant).
 *
 * Score is the unoccupied share of the lattice. Spec 06's value weighting
 * (adjacency-to-winner, competitor activity, tried-and-failed penalty) is
 * calibrate-at-build and needs winner/competitor/learning inputs that do not
 * exist yet; until then value is uniform, so score = count/total — a scaffold,
 * disclosed, not a benchmark. Empty != opportunity: a cell may have been tried
 * and failed.
 *
 * Lattices above MAX_LATTICE_CELLS are refused (insufficient_data): an
 * unpruned combinatorial space makes the score meaningless (spec 06 §4).
 */
export function whiteSpace(
  items: DiversityItem[],
  universe: { dimension: FingerprintDimension; values: string[] }[]
): WhiteSpaceResult {
  const valid = validItems(items);
  if (valid.length === 0) return INSUFFICIENT;
  if (universe.length === 0 || universe.some((u) => u.values.length === 0)) return INSUFFICIENT;

  const total = universe.reduce((acc, u) => acc * u.values.length, 1);
  if (total > MAX_LATTICE_CELLS) return INSUFFICIENT; // prune the lattice first

  // Occupied combos: one key per creative, over the universe's dimensions.
  const sep = "\u0000"; // NUL: cannot collide with any label text
  const occupied = new Set<string>();
  for (const it of valid) {
    const labels = universe.map((u) => it.fingerprint[u.dimension]);
    if (labels.some((l) => l === null)) continue; // unlabeled → cannot occupy a cell
    occupied.add(labels.join(sep));
  }

  // Enumerate the lattice, collect unoccupied cells.
  const missing: Record<string, string>[] = [];
  const cell: string[] = new Array(universe.length);
  const walk = (depth: number) => {
    if (depth === universe.length) {
      if (!occupied.has(cell.join(sep))) {
        const combo: Record<string, string> = {};
        universe.forEach((u, i) => {
          combo[u.dimension] = cell[i];
        });
        missing.push(combo);
      }
      return;
    }
    for (const v of universe[depth].values) {
      cell[depth] = v;
      walk(depth + 1);
    }
  };
  walk(0);

  return { status: "ok", score: missing.length / total, missing, count: missing.length, total };
}
