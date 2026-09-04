// Buyer + change-type ranking (Media-Buyer Change Intelligence, Phase 4). PURE: given each change's measured
// impact, roll up per media-buyer and per change-type - who/what consistently improves vs worsens the
// account. Honest: only BUYER-source changes count toward buyer ranking (algo moves are excluded);
// "insufficient" verdicts are counted but never treated as a win or loss; a buyer below MIN_SAMPLE usable
// verdicts is marked not-yet-confident rather than ranked on noise.

import type { ChangeImpact, Grain } from "./change-impact.ts";

export type ChangeResult = {
  actorId: string | null;
  actorName: string | null;
  changeType: string;
  source: "buyer" | "algo";
  impact: ChangeImpact;
  outcomeKey?: string; // grain:object:day:window signature; results sharing it are ONE outcome (dedupe target)
};

// A change is credited to a BUYER only when it was measured at its own ad / ad-set level (reasonably theirs).
// A campaign-level verdict means the ad's own window was too thin, so the number reflects the whole campaign
// moving - not attributable to one person's one change. We show those in the timeline as directional context,
// but they must NOT credit a buyer (that would rank activity, not outcomes). Missing grain = legacy ad-level.
function attributableToBuyer(r: ChangeResult): boolean {
  const g = r.impact.grain ?? "ad";
  return g === "ad" || g === "adset";
}

// Collapse results that share an outcomeKey (same object+day+window measured) to ONE, so a single ad-set /
// campaign move a buyer touched with several changes counts once, not once per change. Results with no
// outcomeKey (legacy shape) are each kept as distinct.
function dedupeByOutcome(rs: ChangeResult[]): ChangeResult[] {
  const seen = new Set<string>();
  const out: ChangeResult[] = [];
  for (const r of rs) {
    if (!r.outcomeKey) { out.push(r); continue; }
    if (seen.has(r.outcomeKey)) continue;
    seen.add(r.outcomeKey);
    out.push(r);
  }
  return out;
}

// How precise a rollup's evidence is: the coverage cascade measures a change at the finest grain that clears
// the volume floor, so a verdict "measured at ad level" is directly attributable to THIS change, while an
// ad-set / campaign verdict is directional (the change sits inside a bigger unit that also moved for other
// reasons). Surfacing this stops a hit-rate built mostly on campaign-level reads from being read as precise.
export type GrainMix = { ad: number; adset: number; campaign: number; preciseShare: number | null };

export type BuyerRollup = {
  actorId: string | null;
  actorName: string;
  usable: number; // improved + worsened + flat (verdicts we could actually judge)
  improved: number;
  worsened: number;
  flat: number;
  insufficient: number;
  hitRate: number | null; // improved / usable (RAW, for display)
  shrunkHitRate: number | null; // hit-rate shrunk toward 0.5 by sample size (what ranking uses)
  medianDeltaPct: number | null;
  confident: boolean; // usable >= MIN_SAMPLE
  score: number; // ranking score (SHRUNK hit-rate led, median-delta tiebreak)
  grain: GrainMix; // how precise this buyer's usable verdicts are (ad = precise, adset/campaign = directional)
};

export type ChangeTypeRollup = {
  changeType: string;
  usable: number;
  improved: number;
  worsened: number;
  flat: number;
  insufficient: number;
  hitRate: number | null; // RAW, for display
  shrunkHitRate: number | null; // shrunk toward 0.5 by sample size (what the ordering uses)
  medianDeltaPct: number | null;
  grain: GrainMix;
};

const MIN_SAMPLE = 3; // fewer than this many usable verdicts = not enough to rank a buyer with confidence
// Ranking rigor: a raw hit-rate overstates on tiny samples (3/3 = 100% is far noisier than 45/50 = 90%),
// so a lucky small-sample buyer would out-rank a proven high-volume one. Shrink the hit-rate toward the
// no-information prior (0.5) with a pseudo-count, empirical-Bayes style (same idea as the account-health
// shrinkage). The DISPLAYED hitRate stays raw; only the ranking score uses the shrunk value.
const SHRINK_PRIOR = 0.5;
const SHRINK_PSEUDO = 3; // pseudo-observations at the prior; equal weight to MIN_SAMPLE
function shrinkHitRate(improved: number, usable: number): number | null {
  if (usable <= 0) return null;
  return (improved + SHRINK_PSEUDO * SHRINK_PRIOR) / (usable + SHRINK_PSEUDO);
}

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
  // Grain mix of the USABLE verdicts (explicit-uncertainty, §charter): how much of this rollup's signal is
  // ad-level (precise) vs ad-set/campaign (directional). An older verdict with no grain counts as ad-level.
  const grain: GrainMix = { ad: 0, adset: 0, campaign: 0, preciseShare: null };
  for (const r of rs) {
    if (r.impact.verdict === "insufficient") continue;
    const g: Grain = r.impact.grain ?? "ad";
    grain[g]++;
  }
  grain.preciseShare = usable ? grain.ad / usable : null;
  return { improved, worsened, flat, insufficient, usable, hitRate, medianDeltaPct: median(deltas), grain };
}

// Rank media buyers by outcome (not activity). Buyer-source only; only ad/ad-set-attributable verdicts count
// (campaign-level moves aren't one person's), and each distinct outcome counts once (dedupe).
export function rankBuyers(results: ChangeResult[]): BuyerRollup[] {
  const byActor = new Map<string, ChangeResult[]>();
  for (const r of results) {
    if (r.source !== "buyer") continue;
    if (!attributableToBuyer(r)) continue; // campaign-level = directional context, not buyer credit
    const key = r.actorId ?? r.actorName ?? "unknown";
    const arr = byActor.get(key);
    if (arr) arr.push(r);
    else byActor.set(key, [r]);
  }
  const rollups: BuyerRollup[] = [];
  for (const rsRaw of byActor.values()) {
    const rs = dedupeByOutcome(rsRaw); // one credit per distinct outcome, not per change touched
    const t = tally(rs);
    const confident = t.usable >= MIN_SAMPLE;
    const shrunkHitRate = shrinkHitRate(t.improved, t.usable);
    // Shrunk hit-rate is the spine (0-100) so a proven high-volume buyer beats a lucky 3/3; median delta
    // nudges the tiebreak. Un-judgeable buyers score 0.
    const score = shrunkHitRate == null ? 0 : Math.round(shrunkHitRate * 100 + (t.medianDeltaPct ?? 0) * 0.1);
    rollups.push({ actorId: rs[0].actorId, actorName: rs[0].actorName ?? "Unknown", ...t, shrunkHitRate, confident, score });
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
    const t = tally(dedupeByOutcome(rs)); // count each distinct outcome once per type, not once per change
    out.push({ changeType, ...t, shrunkHitRate: shrinkHitRate(t.improved, t.usable) });
  }
  // Order by the SHRUNK hit-rate so a 1/1 change-type can't sit above a proven 40/50; raw hitRate stays for display.
  return out.sort((a, b) => (b.shrunkHitRate ?? -1) - (a.shrunkHitRate ?? -1) || b.usable - a.usable);
}
