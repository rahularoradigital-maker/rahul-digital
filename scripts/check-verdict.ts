// Runnable check for lib/rules/verdict.ts (J10). Run:
// node --experimental-strip-types scripts/check-verdict.ts
import assert from "node:assert/strict";
import { verdict, creativeScore, VERDICT_CONFIG } from "../lib/rules/verdict.ts";
import type { DiagnoseResult } from "../lib/causality.ts";

// CreativeScore formula: 0.30*perf + 0.30*trend + 0.20*(100-fatigue) + 0.20*funnel.
assert.equal(
  creativeScore({ performance: 100, trend: 100, fatigue: 0, funnel: 100 }),
  100,
  "all-perfect scores 100",
);
assert.equal(
  creativeScore({ performance: 80, trend: 80, fatigue: 20, funnel: 80 }),
  0.3 * 80 + 0.3 * 80 + 0.2 * 80 + 0.2 * 80,
);

const fatigueDx: DiagnoseResult = {
  status: "ok",
  cause: "creative_fatigue",
  rung: 7,
  severity: "amber",
  ruledOut: ["measurement", "tracking_attribution", "auction_cpm", "landing_checkout", "stock_out", "audience_saturation", "change_volatility"],
  note: "worn out",
};

// 1. Winner: all gates met.
const win = verdict({
  performance: 90, trend: 85, fatigue: 20, funnel: 80,
  conversions: 180, days: 30, stable: true, roomToScale: true,
});
assert.equal(win.verdict, "winner", "all gates met -> winner");

// 2. The "8x ROAS on 2 purchases" coin toss: high score, tiny sample -> NOT a winner.
const coinToss = verdict({
  performance: 100, trend: 100, fatigue: 10, funnel: 90,
  conversions: 2, days: 30, stable: true, roomToScale: true,
});
assert.notEqual(coinToss.verdict, "winner", "2 purchases can never be a winner");
assert.ok(coinToss.why.some((w) => w.includes("2 purchases")), "why explains the small sample");

// 3. A non-creative cause -> do_not_kill_yet, NEVER loser.
const cpmDx: DiagnoseResult = { status: "ok", cause: "auction_cpm", rung: 2, severity: "amber", ruledOut: ["measurement", "tracking_attribution"], note: "cpm spiked" };
const nonCreative = verdict({
  performance: 30, trend: 20, fatigue: 30, funnel: 70,
  conversions: 120, days: 20, stable: false, roomToScale: false,
  diagnosis: cpmDx,
});
assert.equal(nonCreative.verdict, "do_not_kill_yet", "non-creative cause -> hold");
assert.ok(nonCreative.why.some((w) => w.includes("auction_cpm")));

// 4. Measurement suppressed -> do_not_kill_yet (cannot judge the creative).
const suppressed = verdict({
  performance: 20, trend: 20, fatigue: 40, funnel: 50,
  conversions: 120, days: 20, stable: false, roomToScale: false,
  diagnosis: { status: "suppressed", reason: "fix measurement first" },
});
assert.equal(suppressed.verdict, "do_not_kill_yet");

// 5. creative_fatigue + low score -> loser (every non-creative cause ruled out).
const loser = verdict({
  performance: 20, trend: 15, fatigue: 80, funnel: 45,
  conversions: 120, days: 20, stable: false, roomToScale: false,
  diagnosis: fatigueDx,
});
assert.equal(loser.verdict, "loser", "creative fatigue + low score + causes ruled out -> loser");
assert.ok(loser.score <= VERDICT_CONFIG.loserScore);

// 6. creative_fatigue but score above the loser cut -> refresh, not kill.
const refreshCause = verdict({
  performance: 60, trend: 55, fatigue: 70, funnel: 75,
  conversions: 120, days: 20, stable: false, roomToScale: false,
  diagnosis: fatigueDx,
});
assert.equal(refreshCause.verdict, "refresh");

// 7. No diagnosis + high fatigue + healthy funnel -> refresh.
const refreshNoDx = verdict({
  performance: 55, trend: 50, fatigue: 75, funnel: 70,
  conversions: 120, days: 20, stable: false, roomToScale: false,
});
assert.equal(refreshNoDx.verdict, "refresh");

// 8. No diagnosis, not a winner, not fatigued -> do_not_kill_yet (never loser without ruling out).
const holdNoDx = verdict({
  performance: 45, trend: 40, fatigue: 30, funnel: 50,
  conversions: 120, days: 20, stable: false, roomToScale: false,
});
assert.equal(holdNoDx.verdict, "do_not_kill_yet", "no diagnosis -> cannot be loser");

console.log("PASS: verdict engine checks");
