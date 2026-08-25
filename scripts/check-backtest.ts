// "Test the tester": prove the backtest scoring logic is correct on synthetic data with KNOWN
// outcomes BEFORE it is ever trusted on a real account.
//   npm run check:backtest
import { strict as assert } from "node:assert";
import type { MetricsRow } from "../lib/ad-source.ts";
import { score, didBreak, backtest, type AdHistory } from "./backtest.ts";

// 1) Pure scorer on controlled predicted/actual pairs (isolated from the rules engine).
const s = score([
  { predicted: true, actual: true }, // hit
  { predicted: true, actual: false }, // false positive
  { predicted: false, actual: true }, // false negative
  { predicted: false, actual: false }, // true negative
]);
assert.equal(s.predicted, 2, "two predicted breaks");
assert.equal(s.hits, 1, "one hit");
assert.equal(s.falsePositives, 1, "one false positive");
assert.equal(s.falseNegatives, 1, "one false negative");
assert.equal(s.accuracy, 0.5, "precision = hits/predicted = 0.5");

const sEmpty = score([{ predicted: false, actual: false }]);
assert.equal(sEmpty.accuracy, null, "no predictions -> accuracy null, never a fake number");

// 2) didBreak ground-truth proxy: ROAS falling >=20% -> broke; holding -> did not.
function row(date: string, spend: number, revenue: number): MetricsRow {
  return { adExternalId: "x", date, spend, impressions: 1000, clicks: 40, purchases: 10, revenue, frequency: 2 };
}
const beforeStrong = [row("2026-01-01", 100, 400), row("2026-01-02", 100, 400), row("2026-01-03", 100, 400)]; // roas 4
assert.equal(didBreak(beforeStrong, [row("2026-01-04", 100, 250)]), true, "roas 4 -> 2.5 is a break");
assert.equal(didBreak(beforeStrong, [row("2026-01-04", 100, 380)]), false, "roas 4 -> 3.8 held (>0.8x)");

// 3) Integration: an ad with < 7 before-rows is SKIPPED, never scored.
const thin: AdHistory = { adExternalId: "thin", rows: [row("2026-01-01", 100, 400), row("2026-01-09", 100, 100)] };
const r = backtest([thin], "2026-01-05");
assert.equal(r.scored, 0, "thin ad not scored");
assert.equal(r.skipped, 1, "thin ad skipped");
assert.equal(r.willBreak.accuracy, null, "nothing scored -> no fabricated accuracy");

console.log("PASS: backtest harness checks");
