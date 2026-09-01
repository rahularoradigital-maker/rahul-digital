// SHADOW comparison for the P1-4 benchmark change (charter §20/§75). Runs the CURRENT absolute-benchmark
// score (roasToScore) beside the candidate empirical-Bayes shrinkage score (roasToScoreShrunk, prior =
// break-even 1x) on representative ads, and asserts the invariants that make the change safe to promote.
// It does NOT touch the live score - it is the evidence for the promote decision. Run:
//   node --experimental-strip-types scripts/check-shadow-benchmark.ts
import assert from "node:assert/strict";
import { roasToScore, roasToScoreShrunk } from "../lib/scoring.ts";

const PRIOR = 1; // break-even ROAS = the neutral prior: an ad is assumed break-even until evidence moves it.
type Case = { name: string; roas: number; conv: number };
const cases: Case[] = [
  { name: "Fluke 15x / 2 purchases", roas: 15, conv: 2 },
  { name: "Winner 5x / 120 purchases", roas: 5, conv: 120 },
  { name: "Solid 3x / 40 purchases", roas: 3, conv: 40 },
  { name: "Loser 0.5x / 60 purchases", roas: 0.5, conv: 60 },
];

const rows = cases.map((c) => {
  const old = roasToScore(c.roas);
  const neu = roasToScoreShrunk(c.roas, c.conv, PRIOR);
  return { ...c, old, neu, delta: neu - old };
});

console.log("SHADOW: absolute vs shrinkage health score (prior = break-even 1x, k=20)");
console.log("case                          roas  conv   old   new  Δ");
for (const r of rows) console.log(`${r.name.padEnd(28)}  ${String(r.roas).padStart(4)}  ${String(r.conv).padStart(4)}   ${String(r.old).padStart(3)}   ${String(r.neu).padStart(3)}  ${r.delta >= 0 ? "+" : ""}${r.delta}`);

const fluke = rows.find((r) => r.name.startsWith("Fluke"))!;
const winner = rows.find((r) => r.name.startsWith("Winner"))!;
const loser = rows.find((r) => r.name.startsWith("Loser"))!;

// THE headline §20 invariant: the OLD engine ranks the unproven 15x fluke ABOVE the proven 5x winner;
// the shrinkage engine flips it, so evidence wins.
assert.ok(fluke.old > winner.old, `OLD engine wrongly ranks the fluke above the winner (${fluke.old} > ${winner.old})`);
assert.ok(fluke.neu < winner.neu, `NEW engine ranks the proven winner above the unproven fluke (${fluke.neu} < ${winner.neu})`);
// Shrinkage de-rates the fluke hardest and barely touches the well-evidenced winner (comparability preserved).
assert.ok(Math.abs(fluke.delta) > Math.abs(winner.delta) * 3, "the fluke is de-rated far more than the winner");
assert.ok(Math.abs(winner.delta) <= 8, `the well-evidenced winner is preserved (Δ=${winner.delta})`);
// ASYMMETRIC: a below-neutral loser is NOT rescued at all - its score is UNCHANGED, so a bleeding account
// keeps reading low (this is the fix for the break-even prior nudging losers up).
assert.equal(loser.neu, loser.old, `a below-neutral loser is not rescued - score unchanged (${loser.old} -> ${loser.neu})`);
assert.ok(loser.neu < 40, `a 60-purchase 0.5x loser stays a clear loser (new=${loser.neu})`);

console.log(`\nPASS: shadow invariants hold. Headline: old ranks the fluke (${fluke.old}) ABOVE the winner (${winner.old}); shrinkage fixes it (fluke ${fluke.neu} < winner ${winner.neu}).`);
