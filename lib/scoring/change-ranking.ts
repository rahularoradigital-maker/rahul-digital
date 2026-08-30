// Buyer + change-type ranking (Media-Buyer Change Intelligence, Phase 4). PURE: given each change's measured
// impact, roll up per media-buyer and per change-type - who/what consistently improves vs worsens the
// account. Honest: only BUYER-source changes count toward buyer ranking (algo moves are excluded);
// "insufficient" verdicts are counted but never treated as a win or loss; a buyer below MIN_SAMPLE usable
// verdicts is marked not-yet-confident rather than ranked on noise.

import type { ChangeImpact } from "./change-impact.ts";

export type ChangeResult = {
  actorId: string | null;
  actorName: string | null;
  changeType: string;
  source: "buyer" | "algo";
  impact: ChangeImpact;
};

export type BuyerRollup = {
  actorId: string | null;
  actorName: string;
  usable: number; // improved + worsened + flat (verdicts we could actually judge)
  improved: number;
  worsened: number;
  flat: number;
  insufficient: number;
  hitRate: number | null; // improved / usable
  medianDeltaPct: number | null;
  confident: boolean; // usable >= MIN_SAMPLE
  score: number; // ranking score (hit-rate led, median-delta tiebreak)
};

export type ChangeTypeRollup = {
  changeType: string;
  usable: number;
  improved: number;
  worsened: number;
  flat: number;
  insufficient: number;
  hitRate: number | null;
  medianDeltaPct: number | null;
};

const MIN_SAMPLE = 3; // fewer than this many usable verdicts = not enough to rank a buyer with confidence

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function tally(rs: ChangeResult[]) {
  const improved = rs.filter((r) => r.impact.verdict === "improved").length;
  const worsened = rs.filter((r) => r.impact.verdict === "worsened").length;
  const flat = rs.filter((r) => r.impact.verdict === "flat").length;
  const insufficient = rs.filter((r) => r.impact.verdict === "insufficient").length;
  const usable = improved + worsened + flat;
  const hitRate = usable ? improved / usable : null;
  const deltas = rs.filter((r) => r.impact.verdict !== "insufficient" && r.impact.deltaPct != null).map((r) => r.impact.deltaPct as number);
  return { improved, worsened, flat, insufficient, usable, hitRate, medianDeltaPct: median(deltas) };
}

// Rank media buyers by outcome (not activity). Buyer-source only.
export function rankBuyers(results: ChangeResult[]): BuyerRollup[] {
  const byActor = new Map<string, ChangeResult[]>();
  for (const r of results) {
    if (r.source !== "buyer") continue;
    const key = r.actorId ?? r.actorName ?? "unknown";
    const arr = byActor.get(key);
    if (arr) arr.push(r);
    else byActor.set(key, [r]);
  }
  const rollups: BuyerRollup[] = [];
  for (const rs of byActor.values()) {
    const t = tally(rs);
    const confident = t.usable >= MIN_SAMPLE;
    // Hit-rate is the spine (0-100); median delta nudges the tiebreak. Un-judgeable buyers score 0.
    const score = t.hitRate == null ? 0 : Math.round(t.hitRate * 100 + (t.medianDeltaPct ?? 0) * 0.1);
    rollups.push({ actorId: rs[0].actorId, actorName: rs[0].actorName ?? "Unknown", ...t, confident, score });
  }
  // Confident buyers first, then by score, then by sample size.
  return rollups.sort((a, b) => Number(b.confident) - Number(a.confident) || b.score - a.score || b.usable - a.usable);
}

// Which change-types (budget/audience/creative/...) tend to help vs hurt on this account. All sources.
export function rollupChangeTypes(results: ChangeResult[]): ChangeTypeRollup[] {
  const byType = new Map<string, ChangeResult[]>();
  for (const r of results) {
    const arr = byType.get(r.changeType);
    if (arr) arr.push(r);
    else byType.set(r.changeType, [r]);
  }
  const out: ChangeTypeRollup[] = [];
  for (const [changeType, rs] of byType) {
    const t = tally(rs);
    out.push({ changeType, ...t });
  }
  return out.sort((a, b) => (b.hitRate ?? -1) - (a.hitRate ?? -1) || b.usable - a.usable);
}
