// Runnable check for buyer/change-type ranking (lib/scoring/change-ranking.ts). No I/O.
// node --experimental-strip-types scripts/check-change-ranking.ts
import assert from "node:assert/strict";
import { rankBuyers, rollupChangeTypes, type ChangeResult } from "../lib/scoring/change-ranking.ts";
import type { ChangeImpact } from "../lib/scoring/change-impact.ts";

const imp = (verdict: ChangeImpact["verdict"], deltaPct: number | null): ChangeImpact => ({ verdict, metric: "ROAS", before: 1, after: 1, deltaPct, reason: "" });
const r = (actor: string, changeType: string, verdict: ChangeImpact["verdict"], delta: number | null, source: "buyer" | "algo" = "buyer"): ChangeResult => ({ actorId: actor, actorName: actor, changeType, source, impact: imp(verdict, delta) });

const results: ChangeResult[] = [
  // Priya: 3 improved, 1 worsened -> hitRate 0.75, confident (4 usable)
  r("Priya", "budget", "improved", 40), r("Priya", "budget", "improved", 30), r("Priya", "audience", "improved", 20), r("Priya", "budget", "worsened", -25),
  // Raj: 1 improved, 3 worsened -> hitRate 0.25, confident
  r("Raj", "budget", "improved", 10), r("Raj", "audience", "worsened", -30), r("Raj", "audience", "worsened", -20), r("Raj", "creative", "worsened", -15),
  // an algo move (must be excluded from buyer ranking) + an insufficient (counted, not usable)
  r("System", "status", "improved", 50, "algo"), r("Priya", "creative", "insufficient", null),
];

const buyers = rankBuyers(results);
assert.equal(buyers.length, 2, "algo actor excluded -> only 2 buyers");
assert.equal(buyers[0].actorName, "Priya", "higher hit-rate ranks first");
assert.equal(buyers[0].improved, 3);
assert.equal(buyers[0].worsened, 1);
assert.equal(buyers[0].insufficient, 1, "insufficient counted");
assert.equal(buyers[0].usable, 4, "insufficient NOT in usable");
assert.ok(Math.abs((buyers[0].hitRate ?? 0) - 0.75) < 1e-9, "Priya hitRate 0.75");
assert.equal(buyers[0].confident, true, "4 usable >= MIN_SAMPLE");
assert.ok(buyers[0].score > buyers[1].score, "Priya scores above Raj");
assert.equal(buyers[1].actorName, "Raj");

// A low-sample buyer is not-confident.
const solo = rankBuyers([r("Solo", "budget", "improved", 10)]);
assert.equal(solo[0].confident, false, "1 usable < MIN_SAMPLE -> not confident");

// Small-sample rigor: a proven high-volume buyer (45/50 = 90%) must out-rank a lucky perfect small-sample
// one (3/3 = 100%). Raw hit-rate would rank the 3/3 first (100 > 90); shrink-to-prior corrects it.
const bigWinner = Array.from({ length: 50 }, (_, i) => r("Whale", "budget", i < 45 ? "improved" : "worsened", i < 45 ? 20 : -20));
const luckyFew = [r("Lucky", "budget", "improved", 20), r("Lucky", "audience", "improved", 20), r("Lucky", "creative", "improved", 20)];
const ranked = rankBuyers([...luckyFew, ...bigWinner]);
assert.equal(ranked[0].actorName, "Whale", "45/50 out-ranks 3/3 after shrinkage");
const whale = ranked.find((b) => b.actorName === "Whale")!;
const lucky = ranked.find((b) => b.actorName === "Lucky")!;
assert.ok((whale.hitRate ?? 0) < (lucky.hitRate ?? 0), "raw hit-rate still favors the lucky 3/3 (0.9 < 1.0)");
assert.ok((whale.score) > (lucky.score), "but the SHRUNK ranking score favors the whale");
assert.ok((lucky.shrunkHitRate ?? 0) < (lucky.hitRate ?? 0), "shrink pulls a 3/3 below its raw 1.0");
assert.ok(Math.abs((lucky.shrunkHitRate ?? 0) - 0.75) < 1e-9, "3/3 shrinks to (3+1.5)/(3+3)=0.75");

// Change-type rollup: budget appears across buyers; audience mixed.
const types = rollupChangeTypes(results);
const budget = types.find((t) => t.changeType === "budget");
assert.ok(budget, "budget rollup exists");
assert.equal(budget?.improved, 3, "budget improved = Priya x2 + Raj x1");
assert.equal(budget?.worsened, 1, "budget worsened = Priya x1");

// Change-type rollup ordering is shrinkage-safe too: a 1/1 type must not sit above a proven 40/50 type.
const typeResults: ChangeResult[] = [
  r("A", "rare", "improved", 30), // "rare" is 1/1 = raw 100%
  ...Array.from({ length: 50 }, (_, i) => r("B", "common", i < 40 ? "improved" : "worsened", i < 40 ? 15 : -15)), // 40/50 = 80%
];
const tord = rollupChangeTypes(typeResults);
assert.equal(tord[0].changeType, "common", "40/50 change-type out-ranks a lucky 1/1 after shrinkage");
const rare = tord.find((t) => t.changeType === "rare")!;
assert.ok((rare.hitRate ?? 0) === 1, "rare still shows raw 100%");
assert.ok((rare.shrunkHitRate ?? 0) < 1, "but its shrunk rate is below 1");

// Strict attribution: a buyer is credited ONLY for ad/ad-set-level verdicts; campaign-level moves are
// directional context and must NOT count toward the buyer (that would rank activity, not outcomes).
const impG = (verdict: ChangeImpact["verdict"], grain: "ad" | "adset" | "campaign"): ChangeImpact => ({ verdict, metric: "ROAS", before: 1, after: 1, deltaPct: 10, reason: "", grain });
const rg = (actor: string, verdict: ChangeImpact["verdict"], grain: "ad" | "adset" | "campaign", outcomeKey?: string): ChangeResult => ({ actorId: actor, actorName: actor, changeType: "budget", source: "buyer", impact: impG(verdict, grain), outcomeKey });
const gated = rankBuyers([
  rg("Mix", "improved", "ad", "k1"), rg("Mix", "worsened", "adset", "k2"),
  rg("Mix", "improved", "campaign", "k3"), rg("Mix", "worsened", "campaign", "k4"), // campaign -> excluded from buyer credit
]);
const mix = gated.find((b) => b.actorName === "Mix")!;
assert.equal(mix.usable, 2, "only ad + ad-set verdicts credit the buyer; campaign excluded");
assert.deepEqual({ ad: mix.grain.ad, adset: mix.grain.adset, campaign: mix.grain.campaign }, { ad: 1, adset: 1, campaign: 0 }, "no campaign grain reaches a buyer tally");
assert.ok(Math.abs((mix.grain.preciseShare ?? 0) - 0.5) < 1e-9, "preciseShare = ad(1)/usable(2) = 0.5");

// Dedupe: several changes that resolve to the SAME outcome (same key) count ONCE, not once per change.
const deduped = rankBuyers([
  rg("Dup", "improved", "adset", "same"), rg("Dup", "improved", "adset", "same"), rg("Dup", "improved", "adset", "same"),
]).find((b) => b.actorName === "Dup")!;
assert.equal(deduped.usable, 1, "3 changes sharing one outcome count as a single credit");
assert.equal(deduped.improved, 1, "the shared outcome is one improved, not three");

// A verdict with no grain (older cached shape) counts as ad-level, and no outcomeKey means no dedupe.
const legacy = rankBuyers([r("Old", "budget", "improved", 20), r("Old", "budget", "improved", 10), r("Old", "budget", "worsened", -10)]).find((b) => b.actorName === "Old")!;
assert.equal(legacy.usable, 3, "no-grain, no-key legacy results are each kept");
assert.ok(Math.abs((legacy.grain.preciseShare ?? 0) - 1) < 1e-9, "no-grain verdicts default to ad-level (preciseShare 1)");

console.log("PASS: change ranking (buyer hit-rate, algo excluded, insufficient handling, confidence, shrinkage, type rollup, grain gate, dedupe, grain mix)");
