// Runnable check for performance-aware product recommendation (recommend/performance-rank.ts). No I/O.
// node --experimental-strip-types scripts/check-cp-performance-rank.ts
import assert from "node:assert/strict";
import { rankProduct, rankProducts, type ProductPerfSignal } from "../lib/creative-production/recommend/performance-rank.ts";

// A fatiguing winner is the top priority (refresh now).
const refresh = rankProduct({ productId: "p1", advertised: true, discountPct: 0, bestRoas: 3.2, fatiguing: true, spendRs: 20000 });
assert.equal(refresh.priority, "refresh-winner");
assert.ok(refresh.score >= 80, "fatiguing winner scores high");
assert.match(refresh.reason, /fresh variant/i);

// Un-advertised with an offer = white-space to test, above an advertised-but-not-winning product.
const whitespace = rankProduct({ productId: "p2", advertised: false, discountPct: 40 });
assert.equal(whitespace.priority, "new-whitespace");
const testOffer = rankProduct({ productId: "p3", advertised: true, discountPct: 30, bestRoas: 0.9 });
assert.equal(testOffer.priority, "test-offer");
assert.ok(whitespace.score > testOffer.score, "un-advertised offer ranks above an advertised loser");

// A working winner (not fatiguing) is LOW priority to remake - leave it to scale.
const working = rankProduct({ productId: "p4", advertised: true, discountPct: 0, bestRoas: 4.0, fatiguing: false });
assert.equal(working.priority, "scale-working");
assert.ok(working.score < whitespace.score, "a working winner isn't the thing to remake");

// Full ranking: the fatiguing winner leads.
const ranked = rankProducts([
  { productId: "p4", advertised: true, discountPct: 0, bestRoas: 4.0, fatiguing: false },
  { productId: "p1", advertised: true, discountPct: 0, bestRoas: 3.2, fatiguing: true, spendRs: 20000 },
  { productId: "p2", advertised: false, discountPct: 40 },
]);
assert.equal(ranked[0].productId, "p1", "fatiguing winner ranks first");

// Unknown ROAS never fabricates a winner verdict.
const unknown = rankProduct({ productId: "p5", advertised: true, discountPct: 0 });
assert.equal(unknown.priority, "low");

console.log("PASS: performance-rank (refresh-winner > whitespace > test-offer > scale-working > low; no fabrication)");
