// Proof for the deep-creative-analysis pure logic (lib/creative/deep-analysis-pure): the read is never
// fabricated, motion is video-only, the entitlement gate is a hard "one free run", and the DB->manifest
// mapping is honest (analyzed only when a model actually read it).
// Run: node --experimental-strip-types scripts/check-deep-analysis.ts

import { parseDeepRead, hasUsedFreeRun, rowToManifest, MAX_CREATIVES, FREE_RUNS } from "../lib/creative/deep-analysis-pure.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// 1) bounds are the product spec: free = one run, at most 10 creatives.
ok(MAX_CREATIVES === 10, "max creatives is 10");
ok(FREE_RUNS === 1, "free plan = one run");

// 2) parseDeepRead never fabricates: nothing readable -> null.
ok(parseDeepRead(null, true) === null, "null model output -> null");
ok(parseDeepRead({}, true) === null, "empty object -> null (no fabricated read)");
ok(parseDeepRead({ sceneType: "", setting: "  " }, true) === null, "all-blank fields -> null");

// 3) a real read comes back populated; blanks within it stay null.
const v = parseDeepRead({ sceneType: "lifestyle", palette: "warm pastels", motionSummary: "quick cuts, product reveal at 3s" }, true);
ok(v !== null && v.sceneType === "lifestyle" && v.palette === "warm pastels", "populated read keeps its fields");
ok(v !== null && v.setting === null, "a missing field stays null, not empty string");
ok(v !== null && v.motionSummary === "quick cuts, product reveal at 3s", "video keeps its motion summary");

// 4) motion is VIDEO-only: an image never claims motion even if the model returned some.
const img = parseDeepRead({ sceneType: "text-card", motionSummary: "should be dropped for an image" }, false);
ok(img !== null && img.motionSummary === null, "image read drops motionSummary (allowMotion=false)");

// 5) entitlement gate: zero runs = allowed; at/over the cap = used.
ok(!hasUsedFreeRun(0), "0 prior runs -> free run available");
ok(hasUsedFreeRun(1), "1 prior run -> used (no second free run)");
ok(hasUsedFreeRun(2), "over the cap -> still used");

// 6) DB row -> manifest: analyzed reflects whether a model actually read it (never fabricated).
const readRow = rowToManifest({ content_hash: "h1", ad_id: "a1", ad_name: "Hero video", format: "video", spend_rs: "24000", scene_type: "lifestyle", motion_summary: "reveal", model: "gemini" });
ok(readRow.analyzed === true, "row with a model is analyzed=true");
ok(readRow.spendRs === 24000, "spend parsed to a number");
ok(readRow.motionSummary === "reveal", "motion summary carried to the manifest");
const unreadRow = rowToManifest({ content_hash: "h2", ad_id: "a2", model: null, spend_rs: null });
ok(unreadRow.analyzed === false, "row with no model is analyzed=false (could not read)");
ok(unreadRow.spendRs === null, "null spend stays null (not 0)");

console.log(`check-deep-analysis: ${pass} assertions passed.`);
