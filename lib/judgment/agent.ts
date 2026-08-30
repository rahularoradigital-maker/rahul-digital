// The Judge agent - a SEPARATE, parallel layer that reads the dashboard's data and forms its own opinion,
// the way a senior media buyer glances at an account and knows what to trust. It runs independently of the
// scoring path (it consumes scoring's output, it does not change it), so it is a second, auditable set of
// eyes rather than a tweak to the numbers already on screen.
//
// For each ad it: (1) collects the signals [engine.ts Evidence Collector], (2) runs the deterministic
// Triple-Label engine, (3) pulls the rules in force for THAT ad's context from the 1,061-rule corpus and
// traces each decisive label back to a rule id, (4) rolls the account up. The MATH decides; the corpus names
// the reasoning; an optional AI pass only narrates. Nothing here is fabricated - every id is real, every
// number came from the input. Pure + sync at the core; the one AI call is opt-in and isolated in `narrate`.

import { judge, type Judgment, type JudgmentInput, type Verdict } from "./engine.ts";
import { applicableRules, CORPUS_SIZE, type Level, type Lifecycle, type Platform, type Rule, type RuleContext } from "./corpus.ts";

export type AdInput = JudgmentInput & {
  id: string;
  name: string;
  platform: Platform;
  level?: Level; // defaults to ad/asset - the dashboard judges ads
  lifecycle?: Lifecycle; // defaults to "any" when the caller can't infer it
};

export type TracedRule = { id: string; category: string; label: Rule["label"]; why: string; action: string };

export type AdJudgment = Judgment & {
  id: string;
  name: string;
  context: RuleContext;
  rulesConsidered: number; // how many corpus rules were in force for this ad
  basis: TracedRule[]; // the decisive rules behind the three labels, traceable to ids
};

export type AccountJudgment = {
  corpusSize: number;
  adsJudged: number;
  counts: { byVerdict: Record<Verdict, number>; judgeable: number; insufficient: number };
  actionable: AdJudgment[]; // SCALE/REFRESH/KILL, highest confidence first - what a buyer acts on today
  ads: AdJudgment[];
  summary: string;
};

function ctxOf(ad: AdInput): RuleContext {
  return { platform: ad.platform, objective: ad.objective, level: ad.level ?? "ad/asset", lifecycle: ad.lifecycle ?? "any" };
}

// Map each engine outcome to the corpus category that governs it, then attach the single heaviest rule in
// force from that category. That is the audit trail: "we suppressed the verdict -> rule R0001 (Materiality)".
const GATE_CATEGORY: Record<string, string> = {
  materiality: "Materiality",
  volume: "Volume sufficiency",
  runtime: "Minimum runtime",
  settled: "Attribution & lag",
  learning: "Learning phase",
};
const SIGNAL_CATEGORY: Record<string, string> = {
  "efficiency vs peers": "Efficiency (relative)",
  "creative wear": "Fatigue signals",
  momentum: "Fatigue signals",
};

function topRule(rules: Rule[], category: string): TracedRule | null {
  const r = rules.find((x) => x.category === category);
  return r ? { id: r.id, category: r.category, label: r.label, why: r.why, action: r.action } : null;
}

// The rules that actually drove THIS ad's three labels (not the whole reading list): every failed evidence
// gate, plus every signal that pointed the way the agreement leaned, plus the confidence-tiering rule.
function traceBasis(j: Judgment, rules: Rule[]): TracedRule[] {
  const out: TracedRule[] = [];
  const seen = new Set<string>();
  const add = (t: TracedRule | null) => {
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  };
  for (const g of j.evidence.gates) if (!g.passed) add(topRule(rules, GATE_CATEGORY[g.name]));
  if (j.agreement.lean !== "neutral") for (const s of j.agreement.signals) if (s.dir === j.agreement.lean) add(topRule(rules, SIGNAL_CATEGORY[s.name]));
  add(topRule(rules, "Confidence tiering"));
  return out;
}

/** Judge one ad: deterministic Triple-Label verdict + the corpus rules that produced it. */
export function judgeAd(ad: AdInput): AdJudgment {
  const j = judge(ad);
  const ctx = ctxOf(ad);
  const rules = applicableRules(ctx);
  return { ...j, id: ad.id, name: ad.name, context: ctx, rulesConsidered: rules.length, basis: traceBasis(j, rules) };
}

const ACTIONABLE: Verdict[] = ["SCALE", "REFRESH", "KILL"];
const CONF_ORDER = { high: 0, med: 1, low: 2 } as const;

/** Judge a whole account's worth of dashboard ads and roll up what a buyer should act on today. */
export function judgeAccount(ads: AdInput[]): AccountJudgment {
  const judged = ads.map(judgeAd);
  const byVerdict = { SCALE: 0, REFRESH: 0, KILL: 0, WATCH: 0, INSUFFICIENT: 0 } as Record<Verdict, number>;
  for (const a of judged) byVerdict[a.verdict]++;
  const judgeable = judged.filter((a) => a.evidence.judgeable).length;
  const actionable = judged
    .filter((a) => ACTIONABLE.includes(a.verdict))
    .sort((a, b) => CONF_ORDER[a.confidence.tier] - CONF_ORDER[b.confidence.tier] || b.agreement.agree - a.agreement.agree);
  const summary =
    `${judged.length} ads judged, ${judgeable} judgeable. ` +
    `${byVerdict.SCALE} scale, ${byVerdict.REFRESH} refresh, ${byVerdict.KILL} kill, ${byVerdict.WATCH} watch, ` +
    `${byVerdict.INSUFFICIENT} not yet judgeable.`;

  return {
    corpusSize: CORPUS_SIZE,
    adsJudged: judged.length,
    counts: { byVerdict, judgeable, insufficient: byVerdict.INSUFFICIENT },
    actionable,
    ads: judged,
    summary,
  };
}

/**
 * OPTIONAL AI narration. The deterministic result above is authoritative and complete on its own; this only
 * turns it into buyer-language prose for the UI. Never let it change a verdict - it receives the finished
 * judgment and explains it. Returns null when no AI provider is configured (the app then shows the
 * deterministic headline + basis, which is already a full explanation).
 */
export async function narrate(acct: AccountJudgment): Promise<string | null> {
  const { runTaskText } = await import("../ai/router.ts");
  const top = acct.actionable.slice(0, 8).map((a) => `${a.name}: ${a.verdict} (conf ${a.confidence.tier}, ${a.agreement.agree}/3 agree) - ${a.headline}`);
  const prompt =
    `You are a senior media buyer briefing an account owner. Below are deterministic verdicts already decided by a rules engine. ` +
    `Do NOT change any verdict. In 4-6 plain sentences, tell them what to do first and why, grounded only in these lines.\n\n` +
    `Account: ${acct.summary}\n\nTop actions:\n${top.join("\n")}`;
  return runTaskText("decision-verdict", prompt);
}
