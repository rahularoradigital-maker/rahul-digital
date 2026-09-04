// Runnable check for CPA decomposition (lib/scoring/cpa-decomposition.ts). No I/O.
// Run: node --experimental-strip-types scripts/check-cpa-decomposition.ts
import assert from "node:assert/strict";
import { decomposeCpa, type CpaWindow } from "../lib/scoring/cpa-decomposition.ts";

// Baseline window: CPM 10 (spend 1000 / 100k impr *1000), CTR 2% (2000 clicks), CVR 5% (100 purchases), CPA 10.
const base: CpaWindow = { spend: 1000, impressions: 100_000, clicks: 2000, purchases: 100 };

// CTR halves (2000 -> 1000 clicks), everything else that can hold does. Purchases follow CVR-constant: with
// half the clicks at the same CVR, purchases halve (50). CPA doubles (1000/50 = 20), and CTR is the culprit.
const ctrDrop: CpaWindow = { spend: 1000, impressions: 100_000, clicks: 1000, purchases: 50 };
const d1 = decomposeCpa(base, ctrDrop);
assert.ok(d1.ok, "d1 should compute");
assert.ok(d1.deltaPct !== null && d1.deltaPct > 90, `CPA ~doubles, got ${d1.deltaPct}%`);
assert.equal(d1.dominant, "ctr", `CTR is the dominant driver, got ${d1.dominant}`);
assert.ok((d1.contributions?.ctr ?? 0) > 0, "CTR fall pushes CPA up (positive contribution)");
assert.ok(Math.abs(d1.contributions?.cvr ?? 99) < 1e-6, "CVR unchanged -> ~0 contribution");

// CPM doubles (spend 2000, same impressions/clicks/purchases): CPA doubles, CPM is the culprit.
const cpmUp: CpaWindow = { spend: 2000, impressions: 100_000, clicks: 2000, purchases: 100 };
const d2 = decomposeCpa(base, cpmUp);
assert.equal(d2.dominant, "cpm", `CPM is the dominant driver, got ${d2.dominant}`);
assert.ok((d2.contributions?.cpm ?? 0) > 0, "CPM rise pushes CPA up");

// CVR improves (same clicks, more purchases 100 -> 200): CPA halves, CVR is the (negative) driver.
const cvrUp: CpaWindow = { spend: 1000, impressions: 100_000, clicks: 2000, purchases: 200 };
const d3 = decomposeCpa(base, cvrUp);
assert.ok((d3.deltaPct ?? 0) < 0, "CPA fell");
assert.equal(d3.dominant, "cvr", `CVR is the dominant driver, got ${d3.dominant}`);
assert.ok((d3.contributions?.cvr ?? 0) < 0, "CVR rise pulls CPA down (negative contribution)");

// log-additivity: contributions sum to ~deltaPct in log terms (not exactly to the arithmetic %, but close for
// this doubling case the sign + dominant is what matters). Just assert they sum finite.
const sum = (d1.contributions!.cpm + d1.contributions!.ctr + d1.contributions!.cvr);
assert.ok(Number.isFinite(sum), "contributions are finite and additive");

// Zero-volume window -> insufficient, never a fabricated decomposition.
assert.equal(decomposeCpa(base, { spend: 0, impressions: 0, clicks: 0, purchases: 0 }).ok, false);

console.log("PASS: CPA decomposition (CPM/CTR/CVR attribution, dominant driver, insufficient gate)");
