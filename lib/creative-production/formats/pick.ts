// Choose which ad formats to generate: the platform's base set filtered to the user's requested ids, with a
// SAFE FALLBACK to the full set when no ids are given or none match (never generate zero by accident). Pure +
// gated (scripts/check-cp-pick-formats.ts). Used by the generate route so the fallback rule is testable.
export function pickFormats<T extends { id: string }>(base: T[], formatIds?: string[] | null): T[] {
  if (!formatIds || formatIds.length === 0) return base;
  const picked = base.filter((f) => formatIds.includes(f.id));
  return picked.length ? picked : base;
}
