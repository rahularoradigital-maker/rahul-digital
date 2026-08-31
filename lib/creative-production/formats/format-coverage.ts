// Creative Production - FORMAT DIVERSITY / TEST COVERAGE (pure, no I/O; gated by
// scripts/check-cp-format-coverage.ts). Answers Rahul's "what have we tested, what should we test next":
// given the executional formats a brand has already generated, report coverage across the 42 and recommend
// the next formats to try - deliberately steering toward UNDER-EXPLORED categories so the brand tests a
// diverse spread (a media buyer's edge is testing many angles), not ten variations of one look.
import { AD_FORMAT_LIBRARY, type FormatCategory } from "./ad-format-library.ts";

export type CoverageRow = { id: string; name: string; category: FormatCategory; awarenessStage: string; tested: boolean };
export type CategoryCoverage = { category: FormatCategory; tested: number; total: number };
export type Coverage = {
  total: number; // 42
  testedCount: number;
  rows: CoverageRow[]; // every format, in library order, with tested flag
  byCategory: CategoryCoverage[];
  recommended: CoverageRow[]; // the next formats to test (untested, diversity-first), capped
};

const RECOMMEND_CAP = 8;

// Deterministic coverage + recommendations. Recommendations = untested formats ordered so the LEAST-explored
// categories come first (fewest already-tested in that category), then library order - a stable, explainable
// "test these next" list. No randomness (would break resume/determinism); ties break by library position.
export function computeCoverage(usedFormatIds: string[]): Coverage {
  const used = new Set(usedFormatIds);
  const rows: (CoverageRow & { index: number })[] = AD_FORMAT_LIBRARY.map((f, index) => ({
    id: f.id, name: f.name, category: f.category, awarenessStage: f.awarenessStage, tested: used.has(f.id), index,
  }));

  const categories = [...new Set(AD_FORMAT_LIBRARY.map((f) => f.category))];
  const byCategory: CategoryCoverage[] = categories.map((category) => {
    const inCat = rows.filter((r) => r.category === category);
    return { category, tested: inCat.filter((r) => r.tested).length, total: inCat.length };
  });
  const testedPerCat = new Map(byCategory.map((bc) => [bc.category, bc.tested]));

  const recommended = rows
    .filter((r) => !r.tested)
    .sort((a, b) => (testedPerCat.get(a.category)! - testedPerCat.get(b.category)!) || a.index - b.index)
    .slice(0, RECOMMEND_CAP)
    .map(strip);

  return {
    total: rows.length,
    testedCount: rows.filter((r) => r.tested).length,
    rows: rows.map(strip),
    byCategory,
    recommended,
  };
}

function strip(r: CoverageRow & { index: number }): CoverageRow {
  const { index: _index, ...rest } = r;
  void _index;
  return rest;
}
