// Date-only strings (YYYY-MM-DD) for Graph time_range, computed in a target REPORTING timezone (ISSUE
// 29) so a window matches Meta's calendar, not the server's UTC clock. tz null -> UTC (the prior
// behavior, so a missing timezone never breaks a window). en-CA formats as YYYY-MM-DD. Day subtraction
// is done on the calendar date (not hour arithmetic), so it is DST-safe. `now` is injectable so the
// behavior is deterministically testable.
export function calendarDate(tz: string | null, offsetDays: number, now: Date = new Date()): string {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz ?? "UTC" }).format(now);
  if (offsetDays === 0) return todayStr;
  const d = new Date(`${todayStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}
export const todayIn = (tz: string | null, now?: Date): string => calendarDate(tz, 0, now);
export const daysAgo = (n: number, tz: string | null = null, now?: Date): string => calendarDate(tz, n, now);
