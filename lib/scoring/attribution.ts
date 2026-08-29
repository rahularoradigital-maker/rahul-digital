// Attribution-lag guard for DIRECTIONAL reads. Meta attributes conversions (and their revenue) for
// days AFTER the click, so the most recent day(s) of any window always UNDER-report purchases/revenue -
// a still-settling tail that slopes downward regardless of the ad's real performance. Any read of a
// DIRECTION (trend up/down, fatigue trajectory, day-to-day stability) that includes that tail reads a
// false decline on essentially every conversion ad near the window edge, which then biases the
// leaderboard, the winner/loser gates, the fatigue radar, and the "money at risk" figure.
//
// Rule: drop the still-settling tail before computing any slope/variance. Headline TOTALS deliberately
// keep the full window (they must match Ads Manager); only directional reads trim. Bounded so short
// windows are never gutted: we never leave fewer than MIN_SETTLED_DAYS, and a window that short is not
// trimmed at all (a slightly biased read beats no read).
//
// Pure, no I/O. Shared by scoring.ts and scoring/fatigue.ts (a standalone module so neither imports the
// other - avoids a cycle).

export const ATTRIBUTION_TAIL_DAYS = 2; // today is always partial; the day before is usually still settling
const MIN_SETTLED_DAYS = 3; // trend/variance need at least this many points to mean anything

// Return the rows whose date is NOT in the most-recent `tail` distinct dates. Rows are matched by
// their `date` field, so multiple ad rows sharing a date are dropped together. Order is preserved.
export function settledRows<T extends { date: string }>(rows: T[], tail = ATTRIBUTION_TAIL_DAYS): T[] {
  const dates = [...new Set(rows.map((r) => r.date))].sort(); // ascending YYYY-MM-DD
  const keepCount = Math.max(MIN_SETTLED_DAYS, dates.length - tail);
  if (keepCount >= dates.length) return rows; // window too short to trim and still read a direction
  const keep = new Set(dates.slice(0, keepCount));
  return rows.filter((r) => keep.has(r.date));
}
