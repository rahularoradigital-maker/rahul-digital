// Advertising Memory, PURE half (Track A, Phase A2). No I/O, no server-only, RELATIVE imports so the runnable
// check loads it in plain node. Defines the account AUTOMATION RULES and selectMemory() - the deterministic
// "load when relevant" step: given an interpreted Operation, return ONLY the rules that operation needs plus
// the history keys the dispatcher (A3) will fetch. Relevance keeps prompts small and honest (a creative brief
// never drags in budget thresholds, a budget change never drags in creative tone).
import type { Operation, OperationKind } from "./types.ts";

export type AutomationRules = {
  maxBudgetStepPct: number | null; // never propose a single budget change larger than this %
  minRoas: number | null; // do-not-scale-below floor: a proposal must respect this ROAS
  protectedCampaigns: string[]; // never propose pausing these (names or ids)
  creativeTone: string | null; // brand tone/voice rule for generated creative
};

export const DEFAULT_RULES: AutomationRules = {
  maxBudgetStepPct: null,
  minRoas: null,
  protectedCampaigns: [],
  creativeTone: null,
};

// Coerce an arbitrary stored/posted blob into valid AutomationRules (trust boundary: bounds + types). Unknown
// keys are dropped; out-of-range numbers become null; protectedCampaigns is a bounded string list.
export function coerceRules(raw: unknown): AutomationRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const list = Array.isArray(r.protectedCampaigns)
    ? r.protectedCampaigns.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim().slice(0, 120)).slice(0, 50)
    : [];
  const tone = typeof r.creativeTone === "string" && r.creativeTone.trim() ? r.creativeTone.trim().slice(0, 300) : null;
  return {
    maxBudgetStepPct: num(r.maxBudgetStepPct, 1, 100),
    minRoas: num(r.minRoas, 0, 100),
    protectedCampaigns: list,
    creativeTone: tone,
  };
}

// Which rules + which history each operation kind needs. History keys are fetched later by the dispatcher
// (A3); here we only DECLARE the relevant slice so the retrieval stays relevance-driven, not "load everything".
const RELEVANCE: Record<OperationKind, { ruleKeys: (keyof AutomationRules)[]; historyNeeded: string[] }> = {
  propose_budget_change: { ruleKeys: ["maxBudgetStepPct", "minRoas"], historyNeeded: ["target_performance", "recent_changes"] },
  propose_pause: { ruleKeys: ["protectedCampaigns", "minRoas"], historyNeeded: ["target_performance"] },
  brief_new_campaign: { ruleKeys: ["creativeTone"], historyNeeded: ["brand_dna", "account_snapshot"] },
  launch_creative: { ruleKeys: ["creativeTone"], historyNeeded: ["brand_dna"] },
  diagnose: { ruleKeys: [], historyNeeded: ["account_snapshot", "target_performance"] },
  answer: { ruleKeys: [], historyNeeded: ["account_snapshot"] },
};

export type SelectedMemory = { rules: Partial<AutomationRules>; historyNeeded: string[] };

/** The relevant slice for one operation: only the rules that kind uses + the history keys it needs. */
export function selectMemory(operation: Operation, rules: AutomationRules): SelectedMemory {
  const rel = RELEVANCE[operation.kind] ?? { ruleKeys: [], historyNeeded: [] };
  const picked: Partial<AutomationRules> = {};
  for (const k of rel.ruleKeys) (picked as Record<string, unknown>)[k] = rules[k];
  return { rules: picked, historyNeeded: rel.historyNeeded };
}
