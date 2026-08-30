// The corpus layer. Loads the 1,061-rule decision corpus (docs/decision-rules/adbrain-decision-rules.json,
// mirrored here as rules.json) and answers ONE question for the Judge agent: given this ad's context
// (platform, objective, level, lifecycle), which rules are in force? That list is what the agent "looks at"
// - it is how the agent decides for itself what matters for THIS ad instead of running one fixed check on all.
// Pure, no I/O (the JSON is bundled at build). The deterministic engine still owns the verdict; the corpus
// only names the reasoning that applies, so every label the agent shows is traceable to a rule id.

import type { Objective } from "../rules/comparator.ts";
import raw from "./rules.json" with { type: "json" };

export type Rule = {
  id: string;
  label: "Evidence" | "Agreement" | "Confidence";
  category: string;
  platform: "Meta" | "Google";
  objective: string;
  level: string;
  lifecycle: string;
  rule: string;
  signals: string;
  condition: string;
  why: string;
  action: string;
  weight: number;
  status: string;
};

const RULES = (raw as { rules: Rule[] }).rules;

export type Platform = "Meta" | "Google";
export type Lifecycle = "any" | "learning" | "mature" | "scaling" | "declining" | "new (ramp)";
export type Level = "ad/asset" | "ad set / ad group" | "campaign" | "account";

export type RuleContext = {
  platform: Platform;
  objective: Objective;
  level: Level;
  lifecycle: Lifecycle;
};

// The app's internal objective vocabulary -> the corpus objective families (Meta + Google spellings).
// A rule tagged "any" always applies; otherwise it must name one of the ad's mapped families.
const OBJECTIVE_FAMILIES: Record<Objective, string[]> = {
  conversion: ["sales", "search_sales", "pmax", "shopping"],
  leads: ["leads", "search_leads"],
  traffic: ["traffic"],
  engagement: ["engagement"],
  awareness: ["awareness", "display", "demandgen"],
  app_installs: ["app_installs"],
};

function objectiveMatches(rule: Rule, ctx: RuleContext): boolean {
  if (rule.objective === "any") return true;
  return (OBJECTIVE_FAMILIES[ctx.objective] ?? []).includes(rule.objective);
}

function levelMatches(rule: Rule, ctx: RuleContext): boolean {
  return rule.level === "any" || rule.level === ctx.level;
}

function lifecycleMatches(rule: Rule, ctx: RuleContext): boolean {
  return rule.lifecycle === "any" || ctx.lifecycle === "any" || rule.lifecycle === ctx.lifecycle;
}

// A rule is IN FORCE only if it is actually enforced/active - "shipped" or "partly". "planned" rules are a
// roadmap, not a basis: the Judge agent must never cite an unshipped rule as the reason for a live verdict.
// (Audit finding: of 1,061 rules, ~721 are "planned"; serving them as in-force overstated the reasoning.)
const IN_FORCE = new Set(["shipped", "partly"]);
export function isInForce(r: Rule): boolean {
  return IN_FORCE.has(r.status);
}

/** Every IN-FORCE rule for this ad's context, most heavily weighted first. This is the agent's reading list. */
export function applicableRules(ctx: RuleContext): Rule[] {
  return RULES.filter((r) => isInForce(r) && r.platform === ctx.platform && objectiveMatches(r, ctx) && levelMatches(r, ctx) && lifecycleMatches(r, ctx)).sort((a, b) => b.weight - a.weight);
}

/** Applicable rules for one Triple-Label axis (Evidence | Agreement | Confidence). */
export function rulesForLabel(ctx: RuleContext, label: Rule["label"]): Rule[] {
  return applicableRules(ctx).filter((r) => r.label === label);
}

export const CORPUS_SIZE = RULES.length;
