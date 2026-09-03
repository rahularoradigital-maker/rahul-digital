// Phase 12 — Second / third / fourth-order reasoning, PURE. Takes a first-order performance fact and walks the
// consequence chain the plan specifies, ending in a concrete creative opportunity. Deterministic assembly of
// the narrative + the derived territory; no I/O, no AI (an optional AI polish can wrap it later).

export type OrderInput = {
  winningFormat: string; // e.g. "ugc"
  persona: string; // the persona that responded
  refinement: string; // the specific sub-pattern that worked, e.g. "demonstration-led"
  marketShareOfCombo: number; // 0..1 — how much the market already uses persona x refinement x format
};

export type OrderChain = {
  firstOrder: string;
  secondOrder: string;
  thirdOrder: string;
  fourthOrder: string;
  territory: { persona: string; angle: string; format: string }; // the opportunity to feed the strategist
};

// Build the CHANGE → DIRECT → BEHAVIOURAL → SYSTEM → BUSINESS chain from a measured win. The fourth order is
// only asserted as an opportunity when the market is actually under-using the combination (evidence-gated).
export function reasonChain(i: OrderInput): OrderChain {
  const pct = Math.round(i.marketShareOfCombo * 100);
  const underused = i.marketShareOfCombo < 0.15;
  return {
    firstOrder: `${i.winningFormat.toUpperCase()} performs better for persona "${i.persona}".`,
    secondOrder: `Persona "${i.persona}" responds specifically to ${i.refinement} ${i.winningFormat}.`,
    thirdOrder: underused
      ? `The market is under-using ${i.refinement} ${i.winningFormat} for "${i.persona}" (only ~${pct}% of creatives).`
      : `The market already uses ${i.refinement} ${i.winningFormat} for "${i.persona}" heavily (~${pct}%), so the edge is execution, not territory.`,
    fourthOrder: underused
      ? `Build a creative territory around "${i.persona}" + ${i.refinement} + ${i.winningFormat} before competitors crowd it.`
      : `Differentiate within a crowded territory: pair ${i.refinement} ${i.winningFormat} with a fresh angle or proof mechanism.`,
    territory: { persona: i.persona, angle: i.refinement, format: i.winningFormat },
  };
}
