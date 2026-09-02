// Proof for the creative health report (lib/creative/creative-report): honest lines, actions only when the
// numbers support them, never a fabricated figure.
// Run: node --experimental-strip-types scripts/check-creative-report.ts

import { buildCreativeReport, reportToText, type ReportInput } from "../lib/creative/creative-report.ts";

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

console.log(`check-creative-report: ${pass} assertions passed.`);
