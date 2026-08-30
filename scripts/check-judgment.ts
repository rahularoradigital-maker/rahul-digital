// Runnable proof for the parallel Judge agent (lib/judgment). Asserts the Triple-Label engine + corpus
// tracing behave the way a senior buyer would expect on hand-built cases. No framework, no fixtures.
// Run: node --experimental-strip-types scripts/check-judgment.ts

import { judge } from "../lib/judgment/engine.ts";
import { judgeAd, judgeAccount, type AdInput } from "../lib/judgment/agent.ts";
import { applicableRules, CORPUS_SIZE } from "../lib/judgment/corpus.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// --- base: a strong, durable, material Meta sales ad ---
const strong: AdInput = {
  id: "a1", name: "Strong winner", platform: "Meta", objective: "conversion",
  spend: 4000, adSetSpend: 10000, conversions: 220, clicks: 1800, impressions: 90000,
  daysDelivered: 12, settledDays: 9, metricVsMedian: 1.6,
  fatigueState: "fresh", fatigueTrajectory: "improving", fatigueSufficiency: "ok",
};

// --- the materiality case: 4% of ad-set spend. Must be un-judgeable, no fatigue verdict. ---
const thin: AdInput = {
  ...strong, id: "a2", name: "Thin spender", spend: 400, adSetSpend: 10000,
  conversions: 6, clicks: 40, impressions: 3000, daysDelivered: 3, settledDays: 1,
  fatigueState: "fatiguing", fatigueTrajectory: "worsening",
};

// --- a weak, fatigued, material ad: should be judgeable and lean to cut ---
const weak: AdInput = {
  ...strong, id: "a3", name: "Tired loser", metricVsMedian: 0.6,
  fatigueState: "fatigued", fatigueTrajectory: "worsening",
};

// 1) Corpus loaded and non-trivial
ok(CORPUS_SIZE >= 1000, `corpus has >=1000 rules (got ${CORPUS_SIZE})`);
ok(applicableRules({ platform: "Meta", objective: "conversion", level: "ad/asset", lifecycle: "any" }).length > 0, "some rules apply to a Meta sales ad");

// 2) Strong ad: judgeable, agreement leans scale, verdict SCALE, confidence high
const js = judge(strong);
ok(js.evidence.judgeable, "strong ad is judgeable");
ok(js.agreement.lean === "scale" && js.agreement.agree >= 2, "strong ad: >=2/3 signals agree to scale");
ok(js.verdict === "SCALE", `strong ad verdict SCALE (got ${js.verdict})`);
ok(js.confidence.tier === "high", `strong ad confidence high (got ${js.confidence.tier})`);

// 3) Thin ad: NOT judgeable, verdict INSUFFICIENT, no fatigue-based cut, materiality gate failed
const jt = judgeAd(thin);
ok(!jt.evidence.judgeable, "thin ad is NOT judgeable");
ok(jt.verdict === "INSUFFICIENT", `thin ad verdict INSUFFICIENT (got ${jt.verdict})`);
ok(jt.evidence.gates.some((g) => g.name === "materiality" && !g.passed), "thin ad fails the materiality gate");
ok(jt.basis.some((b) => b.category === "Materiality"), "thin ad basis cites a Materiality rule id");
ok(jt.basis.some((b) => /^R\d+/.test(b.id)), "thin ad basis carries a real rule id");

// 4) Weak fatigued material ad: judgeable, leans cut, verdict KILL (under-objective)
const jw = judgeAd(weak);
ok(jw.evidence.judgeable, "weak ad is judgeable (material + volume ok)");
ok(jw.agreement.lean === "cut", "weak ad agreement leans cut");
ok(jw.verdict === "KILL", `weak ad verdict KILL (got ${jw.verdict})`);
// The cut is backed by an IN-FORCE rule (efficiency-vs-peers), never an unshipped one. Fatigue rules are
// currently all "planned", so - honestly - the basis does NOT cite them, even though the engine reads fatigue.
ok(jw.basis.length > 0 && jw.basis.every((b) => /^R\d+/.test(b.id)), "weak ad basis cites only real, in-force rule ids");
ok(jw.basis.some((b) => b.category === "Efficiency (relative)"), "weak ad cut is backed by an in-force efficiency rule");

// 5) Account rollup: counts add up, actionable excludes INSUFFICIENT/WATCH
const acct = judgeAccount([strong, thin, weak]);
ok(acct.adsJudged === 3, "account judged 3 ads");
ok(acct.counts.byVerdict.SCALE === 1 && acct.counts.byVerdict.KILL === 1 && acct.counts.byVerdict.INSUFFICIENT === 1, "verdict counts correct");
ok(acct.actionable.every((a) => a.verdict !== "INSUFFICIENT" && a.verdict !== "WATCH"), "actionable list excludes non-actions");
ok(acct.corpusSize === CORPUS_SIZE, "account reports full corpus size");

// 6) Integration: the cockpit pipeline attaches a Triple-Label judgment to every scored ad
const { analyzeAccount } = await import("../lib/cockpit/analyze.ts");
const { SAMPLE_ADS } = await import("../lib/sample/account.ts");
const view = analyzeAccount(SAMPLE_ADS, "SAMPLE");
ok(view.leaderboard.length > 0, "sample account produced ads");
ok(view.leaderboard.every((a) => a.judgment != null), "every cockpit ad carries a judgment");
ok(view.leaderboard.every((a) => typeof a.judgment!.confidence.tier === "string" && a.judgment!.agreement.of === 3), "each judgment has the three labels (confidence tier + N/3 agreement)");
ok(view.leaderboard.every((a) => a.judgment!.evidence.judgeable ? a.judgment!.basis.length > 0 : true), "judgeable ads cite at least one rule id");

console.log(`check-judgment: ${pass} assertions passed. corpus=${CORPUS_SIZE}. engine: ${acct.summary} | pipeline: ${view.leaderboard.length} cockpit ads judged.`);
