// Proof for the daily-brief digest (§4/§160): subject reflects money + count; body lists per-ad priorities
// then account reads; empty feed says "nothing urgent". Run: node --experimental-strip-types scripts/check-digest.ts

import assert from "node:assert/strict";
import type { DecisionFeed } from "../lib/intelligence/collect.ts";
import type { OutputContract } from "../lib/intelligence/output-contract.ts";
import { buildDigest, digestSubject } from "../lib/intelligence/digest.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const dec = (id: string, name: string, call: string, why: string, rs: number, kind = "fatigue"): OutputContract => ({
  id, kind, entity: { level: "ad", id, name },
  data: { summary: "s", source: "meta-store" }, trust: { ok: true, tier: "CALCULATED", reason: "ok" },
  decision: { call, why }, economicImpactRs: rs, confidence: "high", whatCouldBeWrong: "x",
});

const feed: DecisionFeed = {
  priorities: [dec("a", "Video | 20s", "Refresh", "attention decayed", 43646), dec("b", "Carousel", "Refresh", "worsening", 20065)],
  accountReads: [{ ...dec("acc", "Account", "Diversify the hook", "70% concentration", 700000, "diversity"), entity: { level: "account", id: "acc" } }],
};

// subject
const subj = digestSubject(feed);
ok(/₹/.test(subj) && /act on/.test(subj), "subject shows money on the table");
ok(digestSubject({ priorities: [], accountReads: [] }) === "AdBrain: nothing urgent today", "empty feed subject");

// body
const md = buildDigest(feed, { accountName: "Soch", date: "2026-09-01" });
ok(md.includes("# Soch — what to act on, 2026-09-01"), "titled with account + date");
ok(md.includes("Top ads to act on") && md.indexOf("Video | 20s") < md.indexOf("Carousel"), "priorities listed in feed order (ranked)");
ok(/43,646/.test(md), "each line shows ₹ at stake");
ok(md.includes("Account-level") && md.includes("Diversify the hook"), "account reads in their own section");
ok(md.includes("Nothing is applied automatically"), "carries the never-auto-act line");

// topN cap
const many: DecisionFeed = { priorities: Array.from({ length: 8 }, (_, i) => dec("p" + i, "Ad " + i, "Refresh", "w", 1000 * (8 - i))), accountReads: [] };
const capped = buildDigest(many, { accountName: "X", topN: 5 });
ok(capped.includes("…and 3 more"), "long list is capped with a '…and N more'");

// empty
ok(buildDigest({ priorities: [], accountReads: [] }, { accountName: "X" }).includes("Nothing urgent"), "empty feed -> nothing urgent");

console.log(`check-digest: ${pass} assertions passed.`);
