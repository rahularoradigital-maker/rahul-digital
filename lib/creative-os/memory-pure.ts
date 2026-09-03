// Phase 11 — Creative Performance Memory, PURE. Classifies a tested creative and rolls performance up to the
// PATTERNS it used, so the system learns "which hook / angle / persona actually wins" — the loop's memory.
// No I/O; the DB read/link lives in a thin wrapper. Judged against the ACCOUNT's own bar (no universal number).

export const CREATIVE_RESULTS = ["winner", "loser", "promising", "inconclusive", "fatigued", "untested"] as const;
export type CreativeResult = (typeof CREATIVE_RESULTS)[number];

export type TestMetrics = { spend: number; roas: number | null; impressions: number; fatigued?: boolean };

// Classify one creative against the account's average ROAS. Volume-gated: too little spend/impressions => we do
// not pretend to know (inconclusive/untested), mirroring the app's spend-gated trust discipline.
export function classifyResult(m: TestMetrics, accountAvgRoas: number | null, opts: { minSpend?: number } = {}): CreativeResult {
  const minSpend = opts.minSpend ?? 0;
  if (m.spend <= 0 || m.impressions <= 0) return "untested";
  if (m.fatigued) return "fatigued";
  if (m.spend < minSpend || m.roas == null || accountAvgRoas == null) return "inconclusive";
  if (m.roas >= accountAvgRoas * 1.2) return "winner";
  if (m.roas <= accountAvgRoas * 0.5) return "loser";
  if (m.roas >= accountAvgRoas) return "promising";
  return "inconclusive";
}

export type TestRecord = { patternIds: string[]; result: CreativeResult };
export type PatternWinRate = { patternId: string; tests: number; wins: number; winRate: number };

// Per-pattern win-rate across tested creatives: a pattern "wins" when its creative was a winner. Only counts
// decisive tests (winner/loser/promising) so inconclusive/untested don't dilute the rate. This is what lets the
// strategist prefer proven patterns over guesses.
export function patternWinRates(records: TestRecord[]): PatternWinRate[] {
  const agg = new Map<string, { tests: number; wins: number }>();
  for (const r of records) {
    const decisive = r.result === "winner" || r.result === "loser" || r.result === "promising";
    if (!decisive) continue;
    const win = r.result === "winner";
    for (const id of r.patternIds) {
      const a = agg.get(id) ?? { tests: 0, wins: 0 };
      a.tests += 1;
      if (win) a.wins += 1;
      agg.set(id, a);
    }
  }
  return [...agg.entries()]
    .map(([patternId, a]) => ({ patternId, tests: a.tests, wins: a.wins, winRate: a.tests ? a.wins / a.tests : 0 }))
    .sort((x, y) => y.winRate - x.winRate || y.tests - x.tests);
}
