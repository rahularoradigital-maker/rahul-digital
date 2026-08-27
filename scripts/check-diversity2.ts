// One runnable check for the creative diversity + white-space engine. No frameworks.
// Run: node --experimental-strip-types scripts/check-diversity2.ts
import assert from "node:assert/strict";
import { assessDiversity, type CreativeRecord } from "../lib/creative/diversity.ts";

function rec(over: Partial<CreativeRecord>): CreativeRecord {
  return {
    adId: "a",
    adName: "Ad",
    spendRs: 1000,
    winner: 50,
    format: "image",
    funnelStage: "TOF",
    hookType: "question",
    emotion: "curiosity",
    subject: "product",
    ...over,
  };
}

// 1) A monoculture: every ad is the same image/TOF/question/product. No diversity.
const mono = Array.from({ length: 5 }, (_, i) => rec({ adId: `m${i}` }));
const monoRead = assessDiversity(mono);
assert.equal(monoRead.overall, 0, "a monoculture has zero diversity");
const fmt = monoRead.dimensions.find((d) => d.dimension === "format")!;
assert.equal(fmt.activeBuckets, 1);
assert.equal(fmt.diversityScore, 0, "one bucket = no diversity");

// 2) An even 2-format split is maximally diverse on that dimension.
const split = [
  rec({ adId: "v1", format: "video", spendRs: 1000 }),
  rec({ adId: "i1", format: "image", spendRs: 1000 }),
];
const splitFmt = assessDiversity(split).dimensions.find((d) => d.dimension === "format")!;
assert.equal(splitFmt.activeBuckets, 2);
assert.equal(splitFmt.diversityScore, 100, "an even two-way split is fully diverse");

// 3) White-space: a proven angle (high winner) starved of spend surfaces as production work.
const ws = [
  rec({ adId: "big", format: "image", subject: "product", spendRs: 90000, winner: 40 }),
  rec({ adId: "thin", format: "video", subject: "human", spendRs: 2000, winner: 82 }),
];
const wsRead = assessDiversity(ws);
const hasHumanWhitespace = wsRead.whitespace.some((w) => w.dimension === "subject" && w.bucket === "human");
assert.ok(hasHumanWhitespace, "proven-but-thin 'human' subject must be flagged as white-space");
assert.ok(wsRead.productionQueue.length > 0, "white-space must generate a production suggestion");
assert.match(wsRead.productionQueue[0].suggestion, /Produce more/, "production item names what to make");

// 4) A proven bucket that ALREADY carries most spend is NOT white-space (nothing to open up).
const saturated = [
  rec({ adId: "a", subject: "product", spendRs: 90000, winner: 85 }),
  rec({ adId: "b", subject: "human", spendRs: 10000, winner: 30 }),
];
const satRead = assessDiversity(saturated);
assert.ok(
  !satRead.whitespace.some((w) => w.bucket === "product"),
  "a proven bucket that already dominates spend is not under-invested white-space",
);

// 5) Coverage reflects how many ads have a semantic read (null semantic fields = not fingerprinted).
const partial = [
  rec({ adId: "s1", funnelStage: "TOF", hookType: "question", emotion: "curiosity", subject: "product" }),
  rec({ adId: "s2", funnelStage: null, hookType: null, emotion: null, subject: null }),
];
const covRead = assessDiversity(partial);
assert.equal(covRead.coverage, 0.5, "coverage = share of ads with any semantic field");

// 6) Empty input never throws or fabricates.
const empty = assessDiversity([]);
assert.equal(empty.overall, 0);
assert.equal(empty.productionQueue.length, 0);
assert.equal(empty.coverage, 0);

console.log("PASS: creative diversity + white-space + production queue");
