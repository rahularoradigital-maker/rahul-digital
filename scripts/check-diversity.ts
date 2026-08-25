// Runnable check for lib/fingerprint.ts + lib/rules/diversity.ts. No env needed.
//   node --experimental-strip-types scripts/check-diversity.ts
import { strict as assert } from "node:assert";
import { FINGERPRINT_DIMENSIONS, similarity, type CreativeFingerprint } from "../lib/fingerprint.ts";
import {
  diversityScore,
  concentrationScore,
  redundancyScore,
  coverageScore,
  whiteSpace,
  type DiversityItem,
} from "../lib/rules/diversity.ts";

function fp(id: string, dims: Partial<Record<(typeof FINGERPRINT_DIMENSIONS)[number], string>>): CreativeFingerprint {
  const base = Object.fromEntries(FINGERPRINT_DIMENSIONS.map((d) => [d, dims[d] ?? null]));
  return {
    ...base,
    creativeId: id,
    contentHash: "hash_" + id,
    extractedAt: "2026-08-25T00:00:00.000Z",
    confidence: {},
  } as CreativeFingerprint;
}

// ---- fixtures ---------------------------------------------------------------
// Concentrated portfolio: 6 ads, but 5 are the same idea (same hook + 5 more
// shared dims) carrying 90% of spend; 1 genuinely different ad has the rest.
const sameIdea = {
  persona: "new-moms",
  problem: "no-time",
  desire: "quick-dinner",
  hook: "problem-callout",
  angle: "transformation",
  format: "ugc",
};
const concentrated: DiversityItem[] = [
  ...[1, 2, 3, 4, 5].map((i) => ({ fingerprint: fp("c" + i, sameIdea), spend: 180 })),
  {
    fingerprint: fp("c6", {
      persona: "students",
      problem: "budget",
      desire: "save-money",
      hook: "question",
      angle: "price",
      format: "static",
    }),
    spend: 100,
  },
];

// Spread portfolio: 4 ads, 4 distinct ideas, even spend.
const hooks = ["problem-callout", "question", "stat", "demo"];
const spread: DiversityItem[] = hooks.map((h, i) => ({
  fingerprint: fp("s" + i, {
    persona: "persona-" + i,
    problem: "problem-" + i,
    desire: "desire-" + i,
    hook: h,
    angle: "angle-" + i,
    format: "format-" + i,
  }),
  spend: 100,
}));

// ---- I1 diversity: assert ORDERING, not absolute values ---------------------
const KD = 6; // reference taxonomy size, same for both so scores are comparable
const divConc = diversityScore(concentrated, "hook", KD);
const divSpread = diversityScore(spread, "hook", KD);
assert.equal(divConc.status, "ok");
assert.equal(divSpread.status, "ok");
if (divConc.status === "ok" && divSpread.status === "ok") {
  assert.ok(divConc.score < divSpread.score, "concentrated spend must score lower diversity");
  assert.ok(divConc.effectiveN < 2, "90/10 split over 2 hooks → effective-N well under 2");
  assert.equal(divConc.unclassified, 0);
}

// null-dimension items are excluded and reported, never scored
const withNull = [...concentrated, { fingerprint: fp("cx", { persona: "new-moms" }), spend: 50 }];
const divNull = diversityScore(withNull, "hook", KD);
assert.equal(divNull.status, "ok");
if (divNull.status === "ok") assert.equal(divNull.unclassified, 1, "null hook counted as unclassified");

// all-null dimension → insufficient, never a fabricated score
assert.equal(diversityScore(concentrated, "landing").status, "insufficient_data");

// ---- I2 concentration -------------------------------------------------------
const conConc = concentrationScore(concentrated, "hook");
const conSpread = concentrationScore(spread, "hook");
assert.equal(conConc.status, "ok");
assert.equal(conSpread.status, "ok");
if (conConc.status === "ok" && conSpread.status === "ok") {
  assert.ok(conConc.topShare > 0.8, "shared hook carries 90% of spend");
  assert.ok(conConc.score > conSpread.score, "concentrated must out-score spread on HHI");
  assert.equal(conSpread.score, 0, "even spend over observed categories → normalized HHI 0");
}

// ---- I3 redundancy ----------------------------------------------------------
const redConc = redundancyScore(concentrated);
assert.equal(redConc.status, "ok");
if (redConc.status === "ok") {
  assert.equal(redConc.clusters, 1, "the 5 same-idea ads form one near-dup cluster");
  // 90% of spend on a 5-ad cluster → 0.9 × (5−1)/5 = 0.72 of spend is redundant copies
  assert.ok(Math.abs(redConc.score - 0.72) < 1e-9, "spend share on near-dup copies");
}
const redSpread = redundancyScore(spread);
assert.equal(redSpread.status, "ok");
if (redSpread.status === "ok") assert.equal(redSpread.score, 0, "distinct ideas → no redundancy");

// ---- I5 coverage: 2 of 4 target hooks covered → 0.5 -------------------------
const cov = coverageScore(concentrated, [{ dimension: "hook", values: hooks }]);
assert.equal(cov.status, "ok");
if (cov.status === "ok") {
  assert.equal(cov.score, 0.5);
  assert.equal(cov.covered, 2);
  assert.equal(cov.total, 4);
  assert.deepEqual(
    cov.gaps.map((g) => g.value).sort(),
    ["demo", "stat"]
  );
}
// no target list → coverage is undefined, never invented
assert.equal(coverageScore(concentrated, []).status, "insufficient_data");

// ---- I4 white-space: lists the missing combos -------------------------------
const universe = [
  { dimension: "hook" as const, values: ["problem-callout", "question"] },
  { dimension: "format" as const, values: ["ugc", "static"] },
];
const ws = whiteSpace(concentrated, universe);
assert.equal(ws.status, "ok");
if (ws.status === "ok") {
  // occupied: (problem-callout, ugc) and (question, static) → 2 of 4 cells empty
  assert.equal(ws.total, 4);
  assert.equal(ws.count, 2);
  assert.equal(ws.score, 0.5);
  assert.ok(
    ws.missing.some((m) => m.hook === "question" && m.format === "ugc"),
    "missing list must contain the unoccupied combo"
  );
  assert.ok(ws.missing.some((m) => m.hook === "problem-callout" && m.format === "static"));
}

// ---- empty input → insufficient_data everywhere, NO numeric score -----------
for (const r of [
  diversityScore([], "hook"),
  concentrationScore([], "hook"),
  redundancyScore([]),
  coverageScore([], [{ dimension: "hook", values: hooks }]),
  whiteSpace([], universe),
]) {
  assert.equal(r.status, "insufficient_data");
  assert.ok(!("score" in r), "insufficient_data must carry no score");
}

// ---- similarity -------------------------------------------------------------
const twinA = fp("a", sameIdea);
const twinB = fp("b", sameIdea);
const simTwin = similarity(twinA, twinB);
assert.equal(simTwin.status, "ok");
if (simTwin.status === "ok") {
  assert.equal(simTwin.score, 1, "identical fingerprints → similarity 1");
  assert.equal(simTwin.sharedDimensions, 6);
}

const simDisjoint = similarity(concentrated[0].fingerprint, concentrated[5].fingerprint);
assert.equal(simDisjoint.status, "ok");
if (simDisjoint.status === "ok") {
  assert.equal(simDisjoint.score, 0, "fully-disjoint non-null labels → similarity 0");
}

// fewer than 4 comparable dimensions → insufficient_data
const thinA = fp("ta", { persona: "p", problem: "q", desire: "r" });
const thinB = fp("tb", { persona: "p", problem: "q", desire: "r" });
assert.equal(similarity(thinA, thinB).status, "insufficient_data");

console.log("PASS: fingerprint + diversity checks");
