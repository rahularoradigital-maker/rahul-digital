// Deduplication: the same creator can surface through two providers. Canonical identity = platform + the
// platform's stable user id (NOT the handle, which can change). When merging two views of one creator, keep
// the higher-confidence value per field, so provenance + confidence always reflect the best source we have.
// Pure. Never invents - a field UNKNOWN in both stays UNKNOWN.

import type { CreatorIdentity, Evidence, Confidence } from "./types";

export function canonicalKey(id: CreatorIdentity): string {
  return `${id.platform}:${id.platformUserId}`;
}

const RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1, none: 0 };

/** Pick the stronger of two evidence values (higher confidence wins; ties keep the first's real value). */
export function pickBetter<T>(a: Evidence<T>, b: Evidence<T>): Evidence<T> {
  if (RANK[b.confidence] > RANK[a.confidence]) return b;
  // Same confidence but a is UNKNOWN and b has a value -> take b.
  if (RANK[a.confidence] === RANK[b.confidence] && a.value === null && b.value !== null) return b;
  return a;
}
