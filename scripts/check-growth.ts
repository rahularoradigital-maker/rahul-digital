// Proof for the growth-agent brain: documented weights, monotonic scoring, promotion gate, the DRAFT ceiling
// (it can NEVER decide to publish), and safety guardrails. No network. Run: node --experimental-strip-types scripts/check-growth.ts

import { OPP_WEIGHTS, WEIGHT_SUM, opportunityScore, promotionGate, decide, assess, matchIntent, type OppFactors, type Conversation } from "../lib/growth/engine.ts";
import { factorsFor } from "../lib/growth/discover.ts";
import { SAFETY_DONOTDO, INTENT_SIGNALS } from "../lib/growth/knowledge.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// 1) weights are documented + normalized (no arbitrary weights - spec section 7)
ok(Math.abs(WEIGHT_SUM - 1) < 1e-9, `opportunity weights sum to 1 (got ${WEIGHT_SUM})`);
ok(Object.values(OPP_WEIGHTS).every((w) => w > 0), "every weight is positive + defined");

const base: OppFactors = { relevance: 0.5, intent: 0.5, solutionFit: 0.5, commercialIntent: 0.5, audienceFit: 0.5, problemSeverity: 0.5, recency: 0.5, communityQuality: 0.5, competition: 0.5, risk: 0 };

// 2) scoring is monotonic in a positive factor and decreasing in risk
const up = opportunityScore({ ...base, relevance: 1 });
const down = opportunityScore({ ...base, relevance: 0 });
ok(up > down, "higher relevance -> higher score");
ok(opportunityScore({ ...base, risk: 1 }) < opportunityScore({ ...base, risk: 0 }), "higher risk -> lower score");
ok(opportunityScore(base) >= 0 && opportunityScore(base) <= 1, "score stays in 0..1");

// 3) promotion gate: all-must-pass, conservative
ok(!promotionGate({ ...base, solutionFit: 0.2 }, true).mayMention, "weak fit -> no mention");
ok(!promotionGate(base, false).mayMention, "community disallows -> no mention");
ok(promotionGate({ ...base, solutionFit: 0.8, intent: 0.7, commercialIntent: 0.5 }, true).mayMention, "all gates pass -> may mention");

// 4) THE CEILING: the engine can never decide to publish. Across the whole factor space, decide() only ever
// returns IGNORE/MONITOR/LEARN/DRAFT/REQUEST_APPROVAL - never a publish action.
const allowed = new Set(["IGNORE", "MONITOR", "LEARN", "DRAFT", "REQUEST_APPROVAL"]);
for (let i = 0; i <= 20; i++) {
  const s = i / 20;
  for (const risk of [0, 0.3, 0.5, 0.8]) {
    const f = { ...base, risk };
    const d = decide(s, f, promotionGate(f, true));
    ok(allowed.has(d), `decide never returns a publish action (got ${d})`);
  }
}
// a high-risk high-score item escalates to strict approval, never auto-draft
ok(decide(0.9, { ...base, risk: 0.6 }, promotionGate({ ...base, risk: 0.6 }, true)) === "REQUEST_APPROVAL", "high risk -> REQUEST_APPROVAL");
// a clean low-score item is ignored (silence is valid)
ok(decide(0.2, base, promotionGate(base, false)) === "IGNORE", "low score -> IGNORE (silence is valid)");

// 5) intent matching finds a real signal
ok(matchIntent("my creative fatigue is hitting way faster this year").matched, "matches a creative-fatigue conversation");
ok(!matchIntent("what's a good recipe for dinner").matched, "does not match an off-topic conversation");
ok(INTENT_SIGNALS.length > 0 && SAFETY_DONOTDO.some((s) => /drafts only/i.test(s)), "safety list encodes the drafts-only rule");

// 6) assess() ties it together and never publishes
const a = assess(
  { conversationId: "t1", platform: "reddit", community: "r/PPC", author: "x", url: "u", timestamp: new Date().toISOString(), content: "roas dropped and my creative fatigue is brutal, help", question: true },
  { ...base, solutionFit: 0.9, intent: 0.8, relevance: 0.9, commercialIntent: 0.6 },
  false, // community disallows promo -> useful-first, no mention
);
ok(allowed.has(a.decision), "assess decision within the allowed set");
ok(a.promote.mayMention === false, "no mention when community disallows, even on a strong fit");

// 7) ad-context guard (killcritic fix): a "creative fatigue" thread with NO advertising context (a movie
// discussion) must not become a draftable opportunity, while the same phrase WITH ad context should.
const now = Date.now();
const mkConv = (content: string): Conversation => ({ conversationId: "x", platform: "hackernews", community: "Hacker News", author: "a", url: "u", timestamp: new Date(now).toISOString(), content, question: false });
const movie = assess(mkConv("The apex of this creative fatigue was Doctor Strange in the Multiverse of Madness"), factorsFor(mkConv("The apex of this creative fatigue was Doctor Strange in the Multiverse of Madness"), now), false);
const realAd = assess(mkConv("my facebook ads creative fatigue is brutal, roas dropped, ad spend wasted"), factorsFor(mkConv("my facebook ads creative fatigue is brutal, roas dropped, ad spend wasted"), now), false);
ok(movie.decision === "IGNORE" || movie.decision === "MONITOR", `off-domain 'creative fatigue' is not draftable (got ${movie.decision})`);
ok(realAd.score > movie.score, "a real ad-context conversation outscores the off-domain one");
ok(realAd.factors.relevance > movie.factors.relevance, "ad-context guard discounts off-domain relevance");

console.log(`check-growth: ${pass} assertions passed. weights sum=${WEIGHT_SUM.toFixed(3)}.`);
