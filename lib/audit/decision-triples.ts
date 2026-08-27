// Labeled-triples audit foundation (RLEF baseline).
//
// Every recommendation the app makes is recordable as a labeled triple:
// (situation, expert judgment, outcome). See docs/ai-audit-architecture.md.
//
// This module is PURE: types + a small serializer. No DB calls, no API, no I/O.
// A route layer imports these helpers to build and store rows; the shape and the
// completeness check live here so they stay testable in isolation.

// The input half: a snapshot of the real inputs at decision time, plus the exact
// rule/formula id that produced the recommendation (so the triple is reconstructable).
export type Situation = {
  adId: string;
  accountId: string;
  objective: string;
  window: string;
  inputs: Record<string, number | string | null>;
  ruleId: string;
};

// The recommendation surfaced to the operator: the action, its priority and
// confidence, and the why-list (evidence) that traces it back to the situation.
export type Recommendation = {
  action: string;
  priority: string;
  confidence: number;
  why: string[];
};

// The expert judgment (RLEF preference label): what the operator does with the
// recommendation. null until acted on.
export type Judgment = "approve" | "dismiss" | "modify" | null;

// The downstream result, measured later once enough time has passed. null until
// measured; before/after capture the metric movement the action was meant to cause.
export type Outcome = {
  measuredAt: string | null;
  metric: string | null;
  before: number | null;
  after: number | null;
} | null;

// One full training record: (situation, expert judgment, outcome).
export type DecisionTriple = {
  id: string;
  createdAt: string;
  situation: Situation;
  recommendation: Recommendation;
  judgment: Judgment;
  outcome: Outcome;
};

// Build a triple row from a situation + recommendation. Judgment and outcome
// start empty - they are filled in later by the operator and the outcome job.
export function buildTriple(
  id: string,
  createdAt: string,
  situation: Situation,
  recommendation: Recommendation,
): DecisionTriple {
  return {
    id,
    createdAt,
    situation,
    recommendation,
    judgment: null,
    outcome: null,
  };
}

// Flatten a triple to a DB row (snake_case keys, jsonb-friendly) for storage.
// The situation/recommendation/outcome stay as nested objects so a jsonb column
// keeps them intact and fully reconstructable.
export function tripleToRow(t: DecisionTriple): Record<string, unknown> {
  return {
    id: t.id,
    created_at: t.createdAt,
    situation: t.situation,
    recommendation: t.recommendation,
    judgment: t.judgment,
    outcome: t.outcome,
  };
}

// Is a triple complete for training? It needs both an expert judgment AND an
// outcome with measured before/after values. Fresh triples are not labeled.
export function isLabeled(t: DecisionTriple): boolean {
  return (
    t.judgment !== null &&
    t.outcome !== null &&
    t.outcome.before !== null &&
    t.outcome.after !== null
  );
}
