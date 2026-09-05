// Runnable check for contribution economics (lib/scoring/contribution.ts). No I/O.
// Run: node --experimental-strip-types scripts/check-contribution.ts
import assert from "node:assert/strict";
import { contribution, validMargin } from "../lib/scoring/contribution.ts";

// Revenue 1000, spend 200, purchases 10, margin 60%.
const c = contribution({ revenueRs: 1000, spendRs: 200, purchases: 10, marginPct: 60 });
assert.ok(c.cmRoas !== null && Math.abs(c.cmRoas - 3) < 1e-9, `cmRoas = (1000*0.6)/200 = 3, got ${c.cmRoas}`);
assert.ok(c.contributionProfitRs !== null && Math.abs(c.contributionProfitRs - 400) < 1e-9, `profit = 600-200 = 400, got ${c.contributionProfitRs}`);
assert.ok(c.cogsRs !== null && Math.abs(c.cogsRs - 400) < 1e-9, `cogs = 1000*0.4 = 400, got ${c.cogsRs}`);
assert.equal(c.netMarginPct, 60);
assert.ok(c.aov !== null && Math.abs(c.aov - 100) < 1e-9, `aov = 1000/10 = 100, got ${c.aov}`);

// The margin-aware ROAS must undercut platform ROAS (5x here) - the whole point.
const platformRoas = 1000 / 200; // 5
assert.ok((c.cmRoas ?? 0) < platformRoas, "contribution ROAS is below platform ROAS");

// No margin set -> margin-dependent fields null, but AOV still computes (needs no margin).
const noMargin = contribution({ revenueRs: 1000, spendRs: 200, purchases: 10, marginPct: null });
assert.equal(noMargin.cmRoas, null);
assert.equal(noMargin.contributionProfitRs, null);
assert.ok(noMargin.aov !== null && Math.abs(noMargin.aov - 100) < 1e-9, "AOV computes without a margin");

// Out-of-range margins are "not set" (never a fabricated economic number).
assert.equal(validMargin(0), false);
assert.equal(validMargin(100), false);
assert.equal(validMargin(-5), false);
assert.equal(validMargin(60), true);
assert.equal(contribution({ revenueRs: 1000, spendRs: 200, purchases: 0, marginPct: 120 }).cmRoas, null);

// Zero purchases -> AOV null (no fabrication), margin fields still fine.
assert.equal(contribution({ revenueRs: 1000, spendRs: 200, purchases: 0, marginPct: 60 }).aov, null);

console.log("PASS: contribution economics (cmROAS, profit, COGS, AOV, margin validity gates)");
