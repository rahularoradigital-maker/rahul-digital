// Recommend WHAT to advertise by real performance + fatigue (Studio improvement #1). Today recommend/reason.ts
// ranks a product only by "advertised?" + discount depth. The app now has live winner + fatigue signals, so
// Studio can be proactive: the single most valuable thing to make is a FRESH variant of a proven winner whose
// creative is now fatiguing (the refresh moment). PURE: the caller supplies each product's signals (pulled
// from the winner/fatigue engines); this combines them into one explainable ranking. Never invents a number.

export type ProductPerfSignal = {
  productId: string;
  advertised: boolean;
  discountPct: number; // 0..100
  bestRoas?: number | null; // best ROAS across this product's live ads (null/absent = unknown)
  fatiguing?: boolean; // a live ad for this product is fatiguing/fatigued
  spendRs?: number; // live spend behind this product (weights the refresh urgency)
};

export type ProductPriority = "refresh-winner" | "new-whitespace" | "test-offer" | "scale-working" | "low";
export type ProductRank = { productId: string; score: number; priority: ProductPriority; reason: string };

const WINNER_ROAS = 1.5; // at/above this a live product counts as "working" for refresh/scale intent

// One product -> {score 0..100, priority, plain reason}. The order of the checks IS the priority ladder.
export function rankProduct(s: ProductPerfSignal): ProductRank {
  const roas = typeof s.bestRoas === "number" ? s.bestRoas : null;
  const spend = s.spendRs ?? 0;

  // 1. A proven winner that is now fatiguing = make a fresh variant NOW. Highest, weighted by spend at risk.
  if (s.advertised && roas != null && roas >= WINNER_ROAS && s.fatiguing) {
    const score = Math.min(100, 80 + Math.min(20, Math.round(spend / 1000)));
    return { productId: s.productId, score, priority: "refresh-winner", reason: `Winner at ${roas.toFixed(2)}x ROAS but the creative is tiring - make a fresh variant now.` };
  }
  // 2. Not advertised at all + a real offer = white-space to test.
  if (!s.advertised && s.discountPct > 0) {
    const score = Math.min(75, 45 + Math.round(s.discountPct / 4));
    return { productId: s.productId, score, priority: "new-whitespace", reason: `${s.discountPct}% off and no ad yet - a strong offer to test.` };
  }
  // 3. Not advertised, no offer = ad-ready white-space, lower.
  if (!s.advertised) {
    return { productId: s.productId, score: 40, priority: "new-whitespace", reason: "Ad-ready, not advertised yet." };
  }
  // 4. Advertised + a live offer worth testing a new angle on.
  if (s.discountPct > 0 && (roas == null || roas < WINNER_ROAS)) {
    return { productId: s.productId, score: 30, priority: "test-offer", reason: `Advertised but not winning yet - ${s.discountPct}% off is worth a new angle.` };
  }
  // 5. Advertised winner holding steady = it's working, leave it (lowest priority to remake).
  if (roas != null && roas >= WINNER_ROAS) {
    return { productId: s.productId, score: 15, priority: "scale-working", reason: `Working at ${roas.toFixed(2)}x - scale it before remaking it.` };
  }
  return { productId: s.productId, score: 10, priority: "low", reason: "Advertised, no strong signal to remake." };
}

// Rank a catalogue. Stable desc by score; ties keep input order.
export function rankProducts(signals: ProductPerfSignal[]): ProductRank[] {
  return signals
    .map((s, index) => ({ r: rankProduct(s), index }))
    .sort((a, b) => b.r.score - a.r.score || a.index - b.index)
    .map((d) => d.r);
}
