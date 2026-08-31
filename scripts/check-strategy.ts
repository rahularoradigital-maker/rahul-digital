// Proof for the creative-strategy engine: it names the winning DNA, flags portfolio fragility (fatigue-aware),
// surfaces proven white-space, and writes a grounded production brief - the read a top strategist makes.
// Run: node --experimental-strip-types scripts/check-strategy.ts

import { assessDiversity, type CreativeRecord } from "../lib/creative/diversity.ts";
import { buildCreativeStrategy } from "../lib/creative/strategy.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// An account whose winners are UGC + problem-solution, carried by 2 big creatives (one fatiguing), with a
// proven-but-thin carousel/social-proof angle it barely backs.
const records: CreativeRecord[] = [
  { adId: "1", adName: "UGC hero A", spendRs: 60000, winner: 85, format: "video", funnelStage: "TOF", hookType: "problem-solution", emotion: "trust", subject: "human/UGC-led", delivering: true, fatigued: true },
  { adId: "2", adName: "UGC hero B", spendRs: 50000, winner: 80, format: "video", funnelStage: "MOF", hookType: "problem-solution", emotion: "trust", subject: "human/UGC-led", delivering: true, fatigued: false },
  { adId: "3", adName: "Product static", spendRs: 15000, winner: 45, format: "image", funnelStage: "BOF", hookType: "offer", emotion: "urgency", subject: "product-led", delivering: true, fatigued: false },
  { adId: "4", adName: "Carousel proof A", spendRs: 4000, winner: 88, format: "carousel", funnelStage: "MOF", hookType: "social-proof", emotion: "trust", subject: "human/UGC-led", delivering: true, fatigued: false },
  { adId: "5", adName: "Carousel proof B", spendRs: 3000, winner: 82, format: "carousel", funnelStage: "MOF", hookType: "social-proof", emotion: "trust", subject: "human/UGC-led", delivering: true, fatigued: false },
];
const div = assessDiversity(records);
const s = buildCreativeStrategy(records, div);

// 1) Winning DNA names the real drivers (UGC / problem-solution), by lift over the account average.
ok(s.winningDNA.length > 0, "winning DNA is identified");
ok(s.winningDNA.some((d) => d.attribute === "human/UGC-led" || d.attribute === "problem-solution"), "DNA names the UGC / problem-solution winners");
ok(s.winningDNA.every((d) => d.lift > 0 && d.ads >= 2), "every DNA signal has positive lift + real evidence (>=2 ads)");

// 2) Fragility is HIGH: top-2 creatives are 110k/132k = 83% of spend, and a big winner is fatiguing.
ok(s.fragility.top2Share > 0.5, "top-2 concentration detected");
ok(s.fragility.fatiguingWinnerShare > 0.2, "fatiguing-winner exposure detected");
ok(s.fragility.level === "high", `fragility is HIGH (got ${s.fragility.level})`);

// 3) Proven white-space: carousel / social-proof wins (avg ~85) but is a tiny share of spend.
ok(s.whitespace.some((w) => w.bucket === "carousel" || w.bucket === "social-proof"), "proven-but-thin carousel/social-proof surfaced");

// 4) The brief is concrete + grounded: it should propose scaling the white-space AND refreshing the fatiguing winner.
ok(s.brief.length > 0, "a production brief is produced");
ok(s.brief.some((b) => /fresh execution|UGC hero A/i.test(b.make + b.because)), "brief proposes refreshing the fatiguing winner");
ok(s.brief.some((b) => /carousel|social-proof/i.test(b.make)), "brief proposes scaling the proven-but-thin angle");

// 5) liveShare discounts the fatigued winner from "working now".
ok(s.liveShare < 1 && s.liveShare > 0, "liveShare excludes fatigued spend (not 100%)");
ok(!!s.summary && s.summary.includes("Winners here skew"), "summary reads like a strategist");

console.log(`check-strategy: ${pass} assertions passed. DNA=[${s.winningDNA.map((d) => d.attribute).join(", ")}] fragility=${s.fragility.level}`);
