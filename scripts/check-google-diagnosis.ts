// One runnable check for the Google decision engine. No frameworks.
// Run: node --experimental-strip-types scripts/check-google-diagnosis.ts
import assert from "node:assert/strict";
import { demoGoogleAccount } from "../lib/google/demo-account.ts";
import { diagnoseGoogleAccount, type GoogleFinding } from "../lib/google/diagnosis.ts";

const snap = demoGoogleAccount();
const d1 = diagnoseGoogleAccount(snap);
const d2 = diagnoseGoogleAccount(snap);

// Determinism (no randomness anywhere).
assert.deepEqual(d1, d2, "diagnosis must be deterministic");

const rulesFor = (id: string) => d1.findings.filter((f) => f.campaignId === id).map((f) => f.rule).sort();
const has = (id: string, rule: string) => d1.findings.some((f) => f.campaignId === id && f.rule === rule);

// R1: budget-capped WINNER -> raise budget.
assert.ok(has("g_srch_brand", "R1"), "brand campaign (winning + budget-capped) should trigger R1 scale");
const r1 = d1.findings.find((f) => f.campaignId === "g_srch_brand" && f.rule === "R1")!;
assert.equal(r1.kind, "scale");
assert.equal(r1.severity, "high");
assert.ok(r1.moneyAtStake > 0, "R1 carries money at stake (budget headroom)");

// R2: budget-capped LOSER -> do NOT scale.
assert.ok(has("g_srch_generic", "R2"), "generic campaign (below target + budget-capped) should trigger R2, not R1");
assert.ok(!has("g_srch_generic", "R1"), "a below-target campaign must NEVER be told to scale");

// R3: rank-capped -> fix Ad Rank, not budget. (competitor + shopping)
assert.ok(has("g_srch_compete", "R3"), "competitor campaign (lost IS rank high, budget low) should trigger R3");
assert.ok(!has("g_srch_compete", "R1") && !has("g_srch_compete", "R2"), "rank-capped campaign is not a budget decision");

// R8: low Quality Score -> CPC penalty, weakest component named.
assert.ok(has("g_srch_compete", "R8"), "QS<=4 competitor campaign should trigger R8 quality");
const r8 = d1.findings.find((f) => f.rule === "R8")!;
assert.ok(/expected CTR/i.test(r8.detail), "R8 should name expected CTR as the weak component for the competitor campaign");
assert.ok(r8.moneyAtStake > 0, "R8 priority = cost * (7 - QS) > 0");

// LEARNING GUARD (R5): a campaign changed inside the learning window must NOT get bid/budget advice.
assert.ok(has("g_pmax_core", "R5"), "PMax changed 5 days ago should be held as learning (R5)");
for (const r of ["R1", "R2", "R3"]) assert.ok(!has("g_pmax_core", r), `learning campaign must not receive ${r} (would reset learning)`);

// R14: eCPC -> forced migration.
assert.ok(has("g_disp_retarget", "R14"), "eCPC display campaign should trigger R14 migration");

// R15: enough conversions + distinct values + not yet value-based -> eligible for tROAS.
assert.ok(has("g_shop_all", "R15"), "shopping campaign (88 conv, distinct values, max-conv) should be tROAS-eligible (R15)");

// Ranking: high severity first, then money at stake descending.
const sev = d1.findings.map((f) => f.severity);
const firstMed = sev.indexOf("medium");
const firstLow = sev.indexOf("low");
if (firstMed >= 0) assert.ok(sev.slice(0, firstMed).every((s) => s === "high"), "all highs come before any medium");
if (firstLow >= 0) assert.ok(!sev.slice(firstLow).includes("high"), "no high after a low");

// Sanity on the summary.
assert.equal(d1.counts.high + d1.counts.medium + d1.counts.low, d1.findings.length, "counts sum to findings");
assert.ok(d1.totalMoneyAtStake > 0, "total money at stake is real");

console.log(`OK check-google-diagnosis: ${d1.findings.length} findings, ${d1.counts.high} high / ${d1.counts.medium} med / ${d1.counts.low} low, ₹${d1.totalMoneyAtStake} at stake.`);
console.log(`  brand=${rulesFor("g_srch_brand")} generic=${rulesFor("g_srch_generic")} compete=${rulesFor("g_srch_compete")} pmax=${rulesFor("g_pmax_core")} shop=${rulesFor("g_shop_all")} display=${rulesFor("g_disp_retarget")}`);
void (null as unknown as GoogleFinding);
