// Proof for the deep-creative-analysis pure logic (lib/creative/deep-analysis-pure): the read is never
// fabricated, motion is video-only, the entitlement gate is a hard "one free run", and the DB->manifest
// mapping is honest (analyzed only when a model actually read it).
// Run: node --experimental-strip-types scripts/check-deep-analysis.ts

import { parseDeepRead, hasUsedFreeRun, rowToManifest, summariseDeepReads, deepDiversityNudge, deepReadsToText, deepReadsToCsv, MAX_CREATIVES, FREE_RUNS, type DeepCreativeRow } from "../lib/creative/deep-analysis-pure.ts";

const mk = (o: Partial<DeepCreativeRow>): DeepCreativeRow => ({ contentHash: "h", adId: null, adName: null, format: "image", spendRs: null, sceneType: null, setting: null, palette: null, visualMood: null, contentSubject: null, motionSummary: null, analyzed: true, ...o });

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

// 7) synthesis: fewer than 2 read -> null (never overclaims a pattern from one creative).
ok(summariseDeepReads([mk({ sceneType: "lifestyle" })]) === null, "one read -> no pattern");
ok(summariseDeepReads([mk({ analyzed: false }), mk({ analyzed: false })]) === null, "no ACTUALLY-read creatives -> null");

// 8) synthesis: dominant scene + mood + video count are reported honestly.
const ins = summariseDeepReads([
  mk({ format: "video", sceneType: "lifestyle", visualMood: "energetic" }),
  mk({ format: "video", sceneType: "lifestyle", visualMood: "energetic" }),
  mk({ format: "image", sceneType: "text-card", visualMood: "calm" }),
]);
ok(ins !== null && /lifestyle/.test(ins.line), "names the dominant scene (lifestyle)");
ok(ins !== null && /energetic/.test(ins.line), "names the dominant mood (energetic)");
ok(ins !== null && /2 read as real video motion/.test(ins.line), "reports how many were read as video motion");
ok(ins !== null && ins.patterns.some((p) => p.dimension === "scene" && p.label === "lifestyle" && p.count === 2), "scene pattern carries its count");

// 9) "test next" nudge: fires only when top spenders concentrate in one scene (>=70%), silent otherwise.
ok(deepDiversityNudge([mk({ sceneType: "lifestyle" }), mk({ sceneType: "lifestyle" })]) === null, "under 3 reads -> no nudge");
const concentrated = [mk({ sceneType: "lifestyle" }), mk({ sceneType: "lifestyle" }), mk({ sceneType: "lifestyle" }), mk({ sceneType: "product-demo" })];
ok(/concentrated in one look/.test(deepDiversityNudge(concentrated) ?? ""), "3 of 4 same scene -> fragility nudge");
const varied = [mk({ sceneType: "lifestyle" }), mk({ sceneType: "product-demo" }), mk({ sceneType: "talking-head" })];
ok(deepDiversityNudge(varied) === null, "a varied mix -> no nudge (never nags)");

// 10) plain-text export: honest per-creative lines (video motion, image, and could-not-read).
const txt = deepReadsToText([mk({ adName: "Hero", format: "video", spendRs: 24000, sceneType: "lifestyle", motionSummary: "reveal at 3s" }), mk({ adName: "Card", format: "image", analyzed: false })]);
ok(/1\. Hero/.test(txt) && /\[video\]/.test(txt) && /motion: reveal at 3s/.test(txt), "video export line carries motion");
ok(/could not read/.test(txt), "unread creative is marked in the export");

// 11) CSV export: header + RFC-4180 quoting (a comma inside a field never breaks a column).
const csv = deepReadsToCsv([mk({ adName: "Hero", format: "video", spendRs: 24000, palette: "warm, muted", analyzed: true }), mk({ adName: "X", analyzed: false })]);
ok(csv.split("\n")[0] === "ad,format,spend_rs,scene,setting,palette,mood,subject,motion,read", "csv header is stable");
ok(/"warm, muted"/.test(csv), "a comma-containing field is quoted (no broken columns)");
ok(/could not read/.test(csv), "unread creative marked in csv");

console.log(`check-deep-analysis: ${pass} assertions passed.`);
