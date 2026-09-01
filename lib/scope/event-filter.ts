// The optimization-EVENT scope predicate, in ONE place. Used by both the cockpit read (from-store) and the
// funnel read (funnel/store) so "strict, every screen" means the SAME rule everywhere - fix it once here.
//
// Rule: no events selected -> keep every ad (filter off). Events selected -> keep an ad only if it HAS a
// stored optimization event AND that event is one of the selected ones. Ads with a null event are dropped
// while a filter is active (they can't be attributed to the chosen event), so selecting "Add to cart" shows
// exactly those and removes the rest. Caller passes a Set for O(1) membership over large ad lists.
export function passesEventFilter(ev: string | null | undefined, selected: Set<string> | null | undefined): boolean {
  if (!selected || selected.size === 0) return true;
  return ev != null && selected.has(ev);
}
