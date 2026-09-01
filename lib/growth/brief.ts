// The daily brief (spec sections 27, 40, 39). Runs the pure pipeline over discovered conversations and produces
// a "what should I do today": top opportunities (DRAFT / REQUEST_APPROVAL only - never auto-published), demand
// signals (a topic asked by many = a content opportunity), and learn items. Pure - no I/O, no publishing.

import { assess, matchIntent, type Conversation, type Opportunity, type GrowthAction } from "./engine.ts";
import { factorsFor } from "./discover.ts";
import { BRAND } from "./knowledge.ts";

export type DemandSignal = { topic: string; count: number; contentIdea: string };
export type Brief = {
  generatedAt: string;
  discovered: number;
  byAction: Record<GrowthAction, number>;
  topOpportunities: Opportunity[];
  demandSignals: DemandSignal[];
  learn: Opportunity[];
};

const DEMAND_THRESHOLD = 3; // a topic asked by >= this many people this run = a real demand signal (section 27)

export function generateBrief(conversations: Conversation[], nowMs: number, topN = 10): Brief {
  const assessed = conversations.map((c) => assess(c, factorsFor(c, nowMs), communityAllowsPromo(c.community)));

  const byAction: Record<GrowthAction, number> = { IGNORE: 0, MONITOR: 0, LEARN: 0, DRAFT: 0, REQUEST_APPROVAL: 0 };
  for (const a of assessed) byAction[a.decision]++;

  const actionable = assessed.filter((a) => a.decision === "DRAFT" || a.decision === "REQUEST_APPROVAL").sort((a, b) => b.score - a.score);
  const learn = assessed.filter((a) => a.decision === "LEARN").sort((a, b) => b.score - a.score).slice(0, topN);

  // Demand signals: cluster by topic across everything worth learning-or-acting-on.
  const topicCount = new Map<string, number>();
  for (const a of assessed) {
    if (a.decision === "IGNORE" || a.decision === "MONITOR") continue;
    const topic = matchIntent(a.conversation.content).topic;
    if (topic) topicCount.set(topic, (topicCount.get(topic) ?? 0) + 1);
  }
  const demandSignals: DemandSignal[] = [...topicCount.entries()]
    .filter(([, n]) => n >= DEMAND_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count, contentIdea: contentIdeaFor(topic) }));

  return { generatedAt: new Date(nowMs).toISOString(), discovered: conversations.length, byAction, topOpportunities: actionable.slice(0, topN), demandSignals, learn };
}

// Whether a community permits a product mention. Conservative default: most subs restrict promo, so DEFAULT
// FALSE - the agent must be useful without mentioning AdScale unless a community is explicitly marked open.
// (Community memory, section 24, will hold per-community rules; until then, assume no-promo = safest.)
const PROMO_OK = new Set<string>([]); // none opted-in yet -> useful-first everywhere
export function communityAllowsPromo(community: string): boolean {
  return PROMO_OK.has(community);
}

// A content idea for a repeated topic (section 27 -> content engine). One line; the content engine expands it.
function contentIdeaFor(topic: string): string {
  const map: Record<string, string> = {
    "creative fatigue": "Guide: 'How to actually tell creative fatigue from noise' - the materiality + frequency read, with a worked example.",
    "what to scale/kill": "Guide: 'The scale/kill decision checklist a $100M buyer uses' - sufficiency, standing, trajectory.",
    "ROAS / efficiency drop": "Teardown: 'Your ROAS dropped - the 5 real causes and how to tell which one', with a diagnostic tree.",
    "reporting / dashboards": "Explainer: 'Which 6 metrics actually matter at ad vs ad-set vs campaign level' (and why they differ).",
    "attribution": "Explainer: 'Reading Meta numbers you can't fully trust - what to still act on'.",
    "tool comparison": "Comparison page: honest 'X vs Y vs reading it yourself' - what each is actually for.",
    "AI advertising / automation": "POV: 'Where AI genuinely helps ad decisions - and where it's just a black box'.",
  };
  return map[topic] ?? `Content: a practical, sourced answer to the recurring '${topic}' question.`;
}

// Render the brief to markdown (for the daily file / owner review). No publishing - a report only.
export function briefToMarkdown(b: Brief): string {
  const L: string[] = [];
  L.push(`# AdScale Growth Brief - ${b.generatedAt.slice(0, 10)}`);
  L.push("");
  L.push(`Discovered **${b.discovered}** conversations. Decisions: ${b.byAction.DRAFT} draft · ${b.byAction.REQUEST_APPROVAL} needs-approval · ${b.byAction.LEARN} learn · ${b.byAction.MONITOR} monitor · ${b.byAction.IGNORE} ignore.`);
  L.push("");
  L.push("_Drafts only. Nothing is published. Every item is for your review._");
  L.push("");
  L.push("## Demand signals (a topic many people are asking = a content opportunity)");
  if (b.demandSignals.length === 0) L.push("- None crossed the threshold this run.");
  for (const d of b.demandSignals) L.push(`- **${d.topic}** (${d.count} asking) -> ${d.contentIdea}`);
  L.push("");
  L.push("## Top opportunities (highest-scoring, worth a drafted reply)");
  if (b.topOpportunities.length === 0) L.push("- None scored high enough to draft this run. Silence is a valid decision.");
  b.topOpportunities.forEach((o, i) => {
    L.push(`### ${i + 1}. [${o.decision}] ${(o.score * 100).toFixed(0)}/100 - ${o.conversation.community}`);
    L.push(`- ${o.conversation.title ?? o.conversation.content.slice(0, 120)}`);
    L.push(`- ${o.conversation.url}`);
    L.push(`- Why: ${o.why.join(" · ")}`);
    L.push(`- AdScale mention: ${o.promote.mayMention ? "permitted (be useful first)" : "NO - " + o.promote.reasons[0]}`);
  });
  L.push("");
  L.push(`_${BRAND.name} · useful before promotional · human approves every reply._`);
  return L.join("\n");
}
