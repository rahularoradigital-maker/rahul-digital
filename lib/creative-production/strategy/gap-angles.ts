// Generate the MISSING angles, from the Creative DNA diversity gaps (Studio improvement #2). The DNA read
// shows an account can be e.g. ~100% Lifestyle scene and ~87% Aspirational mood - so making more of the same
// adds no diversity. PURE: given the observed distribution of each creative dimension, flag any dimension
// dominated by one label and suggest the concrete under-represented angle to generate instead. Advisory:
// it tells Studio what to bias toward, it never blocks a choice.

export type DimensionShare = { label: string; share: number }; // share in 0..1, per label within a dimension
export type AngleGap = { dimension: "funnel" | "scene" | "mood"; dominant: string; dominantShare: number; suggest: string };

// Concrete "what to add" when a dimension is over-concentrated on one label. Keys are lowercased labels;
// the fallback keeps the message honest ("add variety") when we don't have a specific opposite.
const SUGGEST: Record<string, Record<string, string>> = {
  funnel: { tof: "add BOF concepts (offer / urgency / direct product)", bof: "add TOF concepts (lifestyle / problem-aware hooks)", mof: "add TOF and BOF concepts to cover the whole funnel" },
  scene: { lifestyle: "add product-demo and product-on-white concepts", "product-demo": "add lifestyle / in-context concepts", "text-card": "add real product and lifestyle imagery" },
  mood: { aspirational: "add urgency and playful concepts", calm: "add energetic / urgent concepts", premium: "add approachable / playful concepts" },
};

function suggestFor(dimension: AngleGap["dimension"], dominant: string): string {
  const d = SUGGEST[dimension]?.[dominant.toLowerCase()];
  return d ?? `add concepts that are not "${dominant}" to diversify ${dimension}`;
}

/**
 * Find over-concentrated dimensions. A dimension is a "gap" when its top label's share >= `dominance`
 * (default 0.65) AND there is more than one possible label (so a single-item account isn't flagged as a gap).
 * Returns the biggest gaps first. Empty when the account is already well spread.
 */
export function findAngleGaps(
  dist: { funnel?: DimensionShare[]; scene?: DimensionShare[]; mood?: DimensionShare[] },
  opts: { dominance?: number } = {},
): AngleGap[] {
  const dominance = opts.dominance ?? 0.65;
  const gaps: AngleGap[] = [];
  (["funnel", "scene", "mood"] as const).forEach((dimension) => {
    const shares = dist[dimension];
    if (!shares || shares.length < 2) return; // need >1 label to call one "dominant"
    const top = [...shares].sort((a, b) => b.share - a.share)[0];
    if (top && top.share >= dominance) {
      gaps.push({ dimension, dominant: top.label, dominantShare: top.share, suggest: suggestFor(dimension, top.label) });
    }
  });
  return gaps.sort((a, b) => b.dominantShare - a.dominantShare);
}
