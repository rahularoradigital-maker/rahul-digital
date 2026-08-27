// Creative diversity + white-space engine. Given each analyzed ad's format (free) and its
// semantic read (hook / funnel stage / emotion / subject, from the cached Gemini fingerprint)
// plus its proven winner score and spend, it answers three questions the brief asks for:
//   1. How concentrated is the creative mix? (are we running one thing over and over?)
//   2. Where is the white-space? (a bucket that WINS but we barely spend on it)
//   3. What should we make next? (a production queue derived from proven-but-thin buckets)
//
// Pure, no I/O, no fabrication. White-space is only ever a bucket we have REAL winning ads in
// but under-invest - an absent bucket is reported as "untested", never as an opportunity we
// cannot support with data. Semantic buckets that are null (not yet fingerprinted) are skipped,
// and `coverage` reports how much of the account actually has a semantic read.

import type { CreativeFormat } from "./fingerprint.ts";

export type CreativeRecord = {
  adId: string;
  adName: string;
  spendRs: number;
  winner: number; // 0-100 overall winner score (proven quality x scale x stability x upside)
  format: CreativeFormat;
  funnelStage: string | null; // TOF / MOF / BOF
  hookType: string | null;
  emotion: string | null; // primary emotion
  subject: string | null; // product-led vs human/UGC-led
};

export type BucketStat = { name: string; spendShare: number; count: number; avgWinner: number };
export type DimensionDiversity = {
  dimension: string;
  buckets: BucketStat[];
  activeBuckets: number;
  diversityScore: number; // 0-100: 100 = evenly spread, 0 = all spend in one bucket
  dominant: string | null;
  dominantShare: number;
  note: string;
};
export type WhiteSpace = { dimension: string; bucket: string; reason: string; avgWinner: number; spendShare: number };
export type ProductionItem = { suggestion: string; basis: string; priority: number };
export type DiversityRead = {
  overall: number; // 0-100, averaged over dimensions that have >= 2 active buckets
  dimensions: DimensionDiversity[];
  whitespace: WhiteSpace[];
  productionQueue: ProductionItem[];
  coverage: number; // 0-1 share of ads carrying a semantic read
  label: "INTERNAL CALCULATION";
  basis: string;
};

// --- Calibrate-at-build constants (tune once real accounts are observed) ---
const PROVEN_WINNER = 60; // avg winner at/above this = the bucket demonstrably works
const UNDERINVESTED_SHARE = 0.15; // below this share of spend = we are barely backing it
const MAX_QUEUE = 6;

const DIMENSIONS: { key: keyof CreativeRecord; label: string }[] = [
  { key: "format", label: "format" },
  { key: "funnelStage", label: "funnel stage" },
  { key: "hookType", label: "hook type" },
  { key: "emotion", label: "emotion" },
  { key: "subject", label: "subject" },
];

function bucketOf(rec: CreativeRecord, key: keyof CreativeRecord): string | null {
  const v = rec[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

// Spend-weighted concentration -> diversity. HHI = sum(share^2); with k active buckets the
// minimum (even split) is 1/k and the max (all in one) is 1. Normalise to [0,1] against that
// floor so diversity is comparable across dimensions with different bucket counts.
function dimensionOf(records: CreativeRecord[], key: keyof CreativeRecord, label: string): DimensionDiversity {
  const present = records.filter((r) => bucketOf(r, key) !== null);
  const totalSpend = present.reduce((a, r) => a + r.spendRs, 0);
  const byBucket = new Map<string, { spend: number; count: number; winnerSum: number }>();
  for (const r of present) {
    const b = bucketOf(r, key) as string;
    const e = byBucket.get(b) ?? { spend: 0, count: 0, winnerSum: 0 };
    e.spend += r.spendRs;
    e.count += 1;
    e.winnerSum += r.winner;
    byBucket.set(b, e);
  }
  const buckets: BucketStat[] = [...byBucket.entries()]
    .map(([name, e]) => ({
      name,
      spendShare: totalSpend > 0 ? e.spend / totalSpend : e.count / present.length,
      count: e.count,
      avgWinner: e.count > 0 ? e.winnerSum / e.count : 0,
    }))
    .sort((a, b) => b.spendShare - a.spendShare);

  const k = buckets.length;
  const hhi = buckets.reduce((a, b) => a + b.spendShare ** 2, 0);
  const normConc = k > 1 ? (hhi - 1 / k) / (1 - 1 / k) : 1;
  const diversityScore = k >= 2 ? Math.round((1 - normConc) * 100) : 0;
  const dominant = buckets[0] ?? null;

  const note =
    k === 0
      ? `No semantic read for ${label} yet.`
      : k === 1
        ? `Only one ${label} in market (${dominant!.name}); no diversity to measure.`
        : `${k} ${label}s in market; ${dominant!.name} leads at ${Math.round(dominant!.spendShare * 100)}% of spend.`;

  return {
    dimension: label,
    buckets,
    activeBuckets: k,
    diversityScore,
    dominant: dominant?.name ?? null,
    dominantShare: dominant?.spendShare ?? 0,
    note,
  };
}

export function assessDiversity(records: CreativeRecord[]): DiversityRead {
  const dimensions = DIMENSIONS.map((d) => dimensionOf(records, d.key, d.label));

  // Overall diversity: average of the dimensions that actually have something to spread across.
  const measurable = dimensions.filter((d) => d.activeBuckets >= 2);
  const overall = measurable.length > 0 ? Math.round(measurable.reduce((a, d) => a + d.diversityScore, 0) / measurable.length) : 0;

  // White-space: a bucket that demonstrably WINS (avg winner high) but carries little spend.
  // This is a real, data-backed opportunity - scale/produce more of a proven-but-thin angle.
  const whitespace: WhiteSpace[] = [];
  for (const d of dimensions) {
    if (d.activeBuckets < 2) continue; // with one bucket there is no "under-invested vs the rest"
    for (const b of d.buckets) {
      if (b.avgWinner >= PROVEN_WINNER && b.spendShare < UNDERINVESTED_SHARE) {
        whitespace.push({
          dimension: d.dimension,
          bucket: b.name,
          reason: `proven (avg winner ${Math.round(b.avgWinner)}) but only ${Math.round(b.spendShare * 100)}% of spend`,
          avgWinner: b.avgWinner,
          spendShare: b.spendShare,
        });
      }
    }
  }
  whitespace.sort((a, b) => b.avgWinner * (1 - b.spendShare) - a.avgWinner * (1 - a.spendShare));

  const productionQueue: ProductionItem[] = whitespace.slice(0, MAX_QUEUE).map((w, i) => ({
    suggestion: `Produce more ${w.bucket} ${w.dimension} creatives`,
    basis: `${w.bucket} is ${w.reason} - scale the proven angle before it is your only bet`,
    priority: i + 1,
  }));

  const withSemantic = records.filter((r) => r.funnelStage || r.hookType || r.emotion || r.subject).length;
  const coverage = records.length > 0 ? withSemantic / records.length : 0;

  const basis =
    records.length === 0
      ? "No analyzed creatives yet."
      : `${records.length} creatives; ${Math.round(coverage * 100)}% have a semantic read. Overall creative diversity ${overall}/100.`;

  return { overall, dimensions, whitespace, productionQueue, coverage, label: "INTERNAL CALCULATION", basis };
}
