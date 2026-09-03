// Phase 6 — Creative Strategist, PURE blueprint assembly. Turns an Opportunity + the brand's proven patterns
// into the plan's concept chain: opportunity → persona → angle → hook → format → proof → concept → testing
// hypothesis. Deterministic assembly (no I/O, no AI) so it is fully testable; the optional AI copy pass happens
// in a thin wrapper elsewhere. Grounds every concept in REAL patterns (ids kept), never invented.
import type { CreativePattern, Opportunity } from "./schema.ts";

export type Blueprint = {
  persona: string | null;
  angle: string | null;
  format: string | null;
  hook: string | null; // the strongest available hook pattern for this territory
  proof: string | null;
  concept: string; // plain-English concept statement
  testingHypothesis: string; // what we expect + how we'll know
  sourcePatternIds: string[]; // provenance: the patterns this concept is built from
  confidence: number;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Pick the best pattern of a type for a territory: prefer one tied to real performance (by roas), else the
// most recent. Returns the pattern (with its id for provenance) or null when the brand has none yet.
function bestPattern(patterns: CreativePattern[], type: CreativePattern["type"]): CreativePattern | null {
  const of = patterns.filter((p) => p.type === type);
  if (!of.length) return null;
  const withPerf = of.filter((p) => p.performance && p.performance.roas != null);
  if (withPerf.length) return withPerf.sort((a, b) => (b.performance!.roas ?? 0) - (a.performance!.roas ?? 0))[0];
  return of[0];
}

// Build one blueprint for an opportunity, drawing hook/proof from the brand's own proven patterns where they
// exist. `patterns` should be the brand's pattern set (own_ad + winners) so concepts inherit what has worked.
export function buildBlueprint(opp: Pick<Opportunity, "persona" | "angle" | "format" | "confidence">, patterns: CreativePattern[]): Blueprint {
  const hook = bestPattern(patterns, "hook");
  const proof = bestPattern(patterns, "proof");
  const ids = [hook?.id, proof?.id].filter((x): x is string => !!x);
  const persona = opp.persona, angle = opp.angle, format = opp.format;
  const concept =
    `${format ?? "creative"} for ${persona ?? "the target persona"} using a ${angle ?? "problem"} angle` +
    (hook ? `, opening on "${hook.text}"` : "") +
    (proof ? `, backed by ${proof.text}` : "") + ".";
  const testingHypothesis =
    `If we show ${persona ?? "this persona"} a ${angle ?? "problem"}-led ${format ?? "creative"}, ` +
    `CTR and hold-rate should beat the account's ${format ?? "creative"} average, because the territory is under-served and the hook is proven.`;
  return { persona, angle, format, hook: hook?.text ?? null, proof: proof?.text ?? null, concept, testingHypothesis, sourcePatternIds: ids, confidence: opp.confidence };
}

// Dedupe blueprints by (persona|angle|format) so the strategist never emits the same territory twice.
export function buildBlueprints(opps: Pick<Opportunity, "persona" | "angle" | "format" | "confidence">[], patterns: CreativePattern[]): Blueprint[] {
  const seen = new Set<string>();
  const out: Blueprint[] = [];
  for (const o of opps) {
    const key = `${norm(o.persona ?? "")}|${norm(o.angle ?? "")}|${norm(o.format ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(buildBlueprint(o, patterns));
  }
  return out;
}
