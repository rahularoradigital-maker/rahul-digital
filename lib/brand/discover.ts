// Stage 2 (auto competitor discovery) - the PURE part: turn a confirmed brand profile into a small
// set of Ad Library search queries, and shortlist the search results into candidate competitors.
// No I/O here (the route does the ScrapeCreators search + pull), so this is unit-testable.

export type Candidate = { pageId: string; name: string; category: string | null; likes: number | null; verified: boolean };

// Build up to `max` distinct, specific search queries from the profile. Sub-categories and key
// products are more discriminating than the broad category, so they come first.
export function buildSearchQueries(category: string | null, subcategories: string[], keyProducts: string[], max = 5): string[] {
  const raw = [...subcategories, ...keyProducts, ...(category ? [category] : [])];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of raw) {
    const t = (c ?? "").trim();
    const k = t.toLowerCase();
    if (t.length >= 3 && !seen.has(k)) {
      seen.add(k);
      out.push(t);
      if (out.length >= max) break;
    }
  }
  return out;
}

// The distinctive token of the user's OWN brand name, so its own pages can be excluded from the
// competitor shortlist. Takes the part before the first separator ("Soch Apparels - 2022" -> "soch
// apparels"), then the first word.
export function ownBrandToken(ownBrandName: string): string {
  const head = (ownBrandName.split(/[-–|(]/)[0] ?? ownBrandName).trim().toLowerCase();
  return (head.split(/\s+/)[0] ?? head).trim();
}

// Dedupe candidates by pageId, drop the user's own brand pages, and rank by (verified, likes) so the
// real brand pages surface above small/unverified namesakes. Caps the list.
export function shortlistCandidates(all: Candidate[], ownBrandName: string, limit = 10): Candidate[] {
  const own = ownBrandToken(ownBrandName);
  const byId = new Map<string, Candidate>();
  for (const c of all) if (c.pageId && !byId.has(c.pageId)) byId.set(c.pageId, c);
  return [...byId.values()]
    .filter((c) => (own.length >= 3 ? !c.name.toLowerCase().includes(own) : true))
    .sort((a, b) => Number(b.verified) - Number(a.verified) || (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, limit);
}
