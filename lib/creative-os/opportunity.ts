// Phase 6 + 12 — Opportunity Detection, PURE. The plan's key layer: not "what worked?" but "given the market
// map + our patterns, what should we do next?". Turns white space into typed Opportunity drafts with a thesis,
// evidence (pattern provenance), and an honest confidence. No I/O.
import type { CreativePattern, Opportunity } from "./schema.ts";
import { whiteSpace, type WhiteSpace } from "./category.ts";

export type OpportunityDraft = Omit<Opportunity, "id" | "createdAt" | "brandId">;

// Confidence: a white-space combo is more credible when its market share is near-zero AND we have real patterns
// backing each axis. Capped at 0.8 — a gap is a hypothesis to test, never a certainty (anti-fake-precision).
function confidenceFor(ws: WhiteSpace, backing: number): number {
  const gapStrength = 1 - Math.min(1, ws.marketShare / 0.05); // 1 at share 0, 0 at/above the 5% threshold
  const evidenceStrength = Math.min(1, backing / 3); // ~3 backing patterns = full evidence
  return Math.round(Math.min(0.8, 0.2 + 0.4 * gapStrength + 0.4 * evidenceStrength) * 100) / 100;
}

// Generate opportunities from the pattern DB. `market` = competitor/social patterns (what the market does);
// evidence links back to the specific pattern ids so every opportunity is traceable, never a bare guess.
export function detectOpportunities(market: CreativePattern[], opts: { threshold?: number; limit?: number } = {}): OpportunityDraft[] {
  const gaps = whiteSpace(market, { threshold: opts.threshold });
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const idsFor = (axisType: CreativePattern["type"], value: string) =>
    market.filter((p) => p.type === axisType && norm(p.text) === value).map((p) => p.id);

  const drafts = gaps.map((ws) => {
    const patternIds = [...idsFor("persona", ws.persona), ...idsFor("angle", ws.angle), ...idsFor("format", ws.format)];
    const confidence = confidenceFor(ws, patternIds.length);
    const pct = (ws.marketShare * 100).toFixed(0);
    const thesis =
      `The market rarely pairs persona "${ws.persona}" with a ${ws.angle} angle in ${ws.format} format ` +
      `(only ${pct}% of observed creatives). Each element is proven individually, so this combination is likely open white space worth a test.`;
    return {
      persona: ws.persona || null,
      angle: ws.angle || null,
      format: ws.format || null,
      thesis,
      evidence: { patternIds, note: `market share ${pct}%, ${patternIds.length} backing patterns` },
      confidence,
      status: "open" as const,
    };
  });
  return drafts.sort((a, b) => b.confidence - a.confidence).slice(0, opts.limit ?? 10);
}
