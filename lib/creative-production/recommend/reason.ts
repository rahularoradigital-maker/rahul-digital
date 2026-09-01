// Plain-English, GROUNDED reason for a product recommendation. Based ONLY on whether the product is already
// advertised (own asset history) and the offer depth — never an invented ad-performance claim. Pure + gated
// (scripts/check-cp-recommend-reason.ts). "advertised" wins over discount so a covered product reads correctly.
export function recommendReason(advertised: boolean, discountPct: number): string {
  if (advertised) return "Already advertised — you have ads for this";
  if (discountPct > 0) return `${discountPct}% off, not advertised yet — a strong offer to test`;
  return "Ad-ready, not advertised yet";
}
