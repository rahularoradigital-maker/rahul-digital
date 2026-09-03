// Phase 11 performance memory. Run: npm run check:creative-os-memory
import { strict as assert } from "node:assert";
import { classifyResult, patternWinRates } from "../lib/creative-os/memory-pure.ts";

function main() {
  const avg = 2.0; // account average ROAS
  assert.equal(classifyResult({ spend: 1000, roas: 3.0, impressions: 50000 }, avg), "winner", ">=1.2x avg = winner");
  assert.equal(classifyResult({ spend: 1000, roas: 0.8, impressions: 50000 }, avg), "loser", "<=0.5x avg = loser");
  assert.equal(classifyResult({ spend: 1000, roas: 2.2, impressions: 50000 }, avg), "promising", ">=avg = promising");
  assert.equal(classifyResult({ spend: 1000, roas: 1.5, impressions: 50000 }, avg), "inconclusive", "between 0.5x and avg");
  assert.equal(classifyResult({ spend: 0, roas: null, impressions: 0 }, avg), "untested", "no spend = untested");
  assert.equal(classifyResult({ spend: 1000, roas: 5, impressions: 50000, fatigued: true }, avg), "fatigued", "fatigue overrides");
  assert.equal(classifyResult({ spend: 10, roas: 5, impressions: 100 }, avg, { minSpend: 500 }), "inconclusive", "below min spend = inconclusive");
  assert.equal(classifyResult({ spend: 1000, roas: 3, impressions: 50000 }, null), "inconclusive", "no account bar = inconclusive");

  // Win-rate: pattern "h1" is in 2 winners + 1 loser -> 2/3; inconclusive/untested ignored.
  const rates = patternWinRates([
    { patternIds: ["h1", "a1"], result: "winner" },
    { patternIds: ["h1", "a2"], result: "winner" },
    { patternIds: ["h1", "a3"], result: "loser" },
    { patternIds: ["h2"], result: "inconclusive" }, // ignored
    { patternIds: ["h2"], result: "untested" }, // ignored
  ]);
  const h1 = rates.find((r) => r.patternId === "h1")!;
  assert.equal(h1.tests, 3);
  assert.equal(h1.wins, 2);
  assert.ok(Math.abs(h1.winRate - 2 / 3) < 1e-9);
  assert.ok(!rates.some((r) => r.patternId === "h2"), "patterns with only non-decisive tests are excluded");
  // sorted by winRate desc
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i - 1].winRate >= rates[i].winRate);

  console.log("PASS: creative-os memory (result classification, volume gate, per-pattern win-rate)");
}

main();
