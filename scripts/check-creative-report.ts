// Proof for the creative health report (lib/creative/creative-report): honest lines, actions only when the
// numbers support them, never a fabricated figure.
// Run: node --experimental-strip-types scripts/check-creative-report.ts

import { buildCreativeReport, reportToText, reportToHtml, pickBestWorst, type ReportInput, type AdBrief } from "../lib/creative/creative-report.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const base: ReportInput = { accountName: "Soch", days: 90, healthScore: 62, adsAssessed: 166, fatiguing: 10, winners: 3, top1SharePct: 24, dominantFormat: "video", wasteRs: 40000, opportunityLossRs: 12000, deepReadCount: 6 };

const r = buildCreativeReport(base);
ok(/10 of 166 ads fatiguing/.test(r.headline), "headline states fatiguing count");
ok(r.sections.some((s) => s.title === "Health" && s.lines.some((l) => /62\/100/.test(l))), "health score reported");
ok(r.sections.some((s) => s.title === "Money at stake" && s.lines.some((l) => /Rs 40,000/.test(l))), "waste formatted in rupees (Indian grouping)");
ok(r.sections.some((s) => s.title === "Creative DNA" && s.lines.some((l) => /6 of your top spenders/.test(l))), "deep-read count reported");
ok(r.sections.some((s) => s.title === "What to do" && s.lines.some((l) => /Refresh or replace/.test(l))), "fatiguing -> refresh action");

// concentration >=50% -> fragility + diversify action; healthScore null -> honest "not enough data".
const fragile = buildCreativeReport({ ...base, top1SharePct: 63, healthScore: null });
ok(fragile.sections.some((s) => s.title === "Concentration" && s.lines.some((l) => /Fragile/.test(l))), "high concentration flagged fragile");
ok(fragile.sections.some((s) => s.title === "What to do" && s.lines.some((l) => /Diversify/.test(l))), "fragile -> diversify action");
ok(fragile.sections.some((s) => s.title === "Health" && s.lines.some((l) => /not enough/.test(l))), "null health -> honest, not a number");

// nothing wrong -> a calm "hold", no invented urgency; and no fabricated money line.
const calm = buildCreativeReport({ ...base, fatiguing: 0, top1SharePct: 20, wasteRs: 0, opportunityLossRs: 0, winners: 0 });
ok(calm.sections.some((s) => s.title === "What to do" && s.lines.some((l) => /Hold/.test(l))), "no issues -> hold");
ok(calm.sections.some((s) => s.title === "Money at stake" && s.lines.some((l) => /No material waste/.test(l))), "no money issue -> says so, no fake figure");

// text render carries the headline + every section title.
const txt = reportToText(r);
ok(/Creative health report/.test(txt) && /What to do/.test(txt) && /Soch - last 90 days/.test(txt), "text render is complete");

// html render is a complete, escaped, standalone document.
const html = reportToHtml(buildCreativeReport({ ...base, accountName: "A & <b>Co</b>" }));
ok(/^<!doctype html>/i.test(html) && /<\/html>$/i.test(html.trim()), "html is a complete document");
ok(/Creative health report/.test(html) && html.includes("What to do"), "html carries the report content");
ok(html.includes("A &amp; &lt;b&gt;Co&lt;/b&gt;") && !html.includes("<b>Co</b>"), "dynamic strings are HTML-escaped (no injection)");

// best vs worst: winner is best, a refresh/loser is worst, never the same ad, empty -> both null.
const ad = (o: Partial<AdBrief>): AdBrief => ({ id: "x", name: "Ad", score: 50, verdict: "watch", spendRs: 0, fatigueState: null, actionLabel: "Hold", ...o });
ok(pickBestWorst([]).best === null && pickBestWorst([]).worst === null, "no ads -> both null");
const bw = pickBestWorst([ad({ id: "w", verdict: "winner", score: 88 }), ad({ id: "l", verdict: "loser", score: 20 }), ad({ id: "m", verdict: "watch", score: 55 })]);
ok(bw.best?.id === "w", "highest-scoring winner is best");
ok(bw.worst?.id === "l", "a loser is worst");
const noWinner = pickBestWorst([ad({ id: "a", verdict: "watch", score: 70 }), ad({ id: "b", verdict: "refresh", score: 30 })]);
ok(noWinner.best?.id === "a", "no winner -> highest-scoring ad is best");
ok(noWinner.worst?.id === "b", "a refresh ad is worst");
ok(pickBestWorst([ad({ id: "only", verdict: "winner", score: 80 })]).worst === null, "no dying ad -> worst null (never same as best)");

console.log(`check-creative-report: ${pass} assertions passed.`);
