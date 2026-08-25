// Data Quality Engine (brief.md DATA QUALITY; metric dictionary category N).
// N is the GATE, not a report tab: it runs before any recommendation is surfaced
// and stamps whether the underlying rows are trustworthy. If data is thin, gappy,
// duplicated, or shows tracking shifts, AdBrain says so instead of acting on it.
// Pure: no I/O, no deps, no Date.now — all time math comes from the rows themselves.

import type { MetricsRow } from "./ad-source.ts";

export type DQCode =
  | "MISSING_DAYS"
  | "SMALL_SAMPLE"
  | "OUTLIER_SPEND"
  | "DUPLICATE_ROWS"
  | "ZERO_DENOMINATOR"
  | "STALE_DATA"
  | "TRACKING_SHIFT";

export type DQSeverity = "info" | "warn" | "block";

export type DQFlag = { code: DQCode; detail: string; severity: DQSeverity };

export type DataQualityResult =
  | { status: "ok"; flags: DQFlag[]; trustworthy: boolean; completeness: number /* 0-1 */ }
  | { status: "insufficient_data" };

// Thresholds — INTERNAL CALIBRATION, calibrate-at-build (rule 5: no arbitrary
// thresholds presented as truth; these are starting points, learned per account).
const MIN_ROWS = 7; // below this, any comparison is noise (N3) → block
const OUTLIER_SPEND_K = 5; // a day's total spend > K x median daily spend → warn
const STALE_AFTER_DAYS = 3; // last observed day more than this behind the expected end → info

const DAY_MS = 86_400_000;

/** YYYY-MM-DD → whole days since epoch (UTC). Pure calendar math. */
function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function assessDataQuality(
  rows: MetricsRow[],
  opts?: { expectedDays?: number },
): DataQualityResult {
  if (rows.length === 0) return { status: "insufficient_data" };

  const flags: DQFlag[] = [];

  // DUPLICATE_ROWS: the (adExternalId, date) pair is the natural key of a daily
  // metrics row; a duplicate means double-counted spend/revenue → block.
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const r of rows) {
    const key = `${r.adExternalId}|${r.date}`;
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  if (dupes.size > 0) {
    flags.push({
      code: "DUPLICATE_ROWS",
      detail: `${dupes.size} duplicate (ad, date) pair(s): ${[...dupes].slice(0, 3).join("; ")}`,
      severity: "block",
    });
  }

  // SMALL_SAMPLE (N3): too few rows to support any decision → block.
  if (rows.length < MIN_ROWS) {
    flags.push({
      code: "SMALL_SAMPLE",
      detail: `${rows.length} row(s) < minimum ${MIN_ROWS}`,
      severity: "block",
    });
  }

  // Calendar coverage between min and max observed date.
  const days = [...new Set(rows.map((r) => r.date))].sort();
  const minDay = dayNumber(days[0]);
  const maxDay = dayNumber(days[days.length - 1]);
  const spanDays = maxDay - minDay + 1;
  const expected = Math.max(opts?.expectedDays ?? spanDays, spanDays);
  const completeness = Math.min(1, days.length / expected);

  // MISSING_DAYS: gaps inside the observed span, plus any shortfall vs expectedDays.
  const missing = expected - days.length;
  if (missing > 0) {
    const gaps = spanDays - days.length;
    flags.push({
      code: "MISSING_DAYS",
      detail:
        `${missing} of ${expected} expected day(s) missing between ${days[0]} and ${days[days.length - 1]}` +
        (gaps > 0 ? ` (${gaps} calendar gap(s) inside the span)` : ""),
      severity: "warn",
    });
  }

  // STALE_DATA: only checkable when the caller states the expected window
  // (pure — we never read the wall clock). Expected end = first day + expectedDays - 1.
  if (opts?.expectedDays !== undefined) {
    const expectedEnd = minDay + opts.expectedDays - 1;
    const behind = expectedEnd - maxDay;
    if (behind > STALE_AFTER_DAYS) {
      flags.push({
        code: "STALE_DATA",
        detail: `last data day ${days[days.length - 1]} is ${behind} day(s) behind the expected end of the window`,
        severity: "info",
      });
    }
  }

  // OUTLIER_SPEND: a day's total spend far above the median daily spend suggests
  // a data glitch or an unmarked budget event — either way, flag before trusting.
  const spendByDay = new Map<string, number>();
  for (const r of rows) spendByDay.set(r.date, (spendByDay.get(r.date) ?? 0) + r.spend);
  const dailySpends = [...spendByDay.values()].sort((a, b) => a - b);
  const median = dailySpends[Math.floor(dailySpends.length / 2)];
  if (median > 0) {
    for (const [date, spend] of spendByDay) {
      if (spend > OUTLIER_SPEND_K * median) {
        flags.push({
          code: "OUTLIER_SPEND",
          detail: `spend ${spend} on ${date} is > ${OUTLIER_SPEND_K}x the median daily spend (${median})`,
          severity: "warn",
        });
      }
    }
  }

  // TRACKING_SHIFT (N5): impossible funnels — more clicks than impressions, or
  // purchases with zero clicks — signal a pixel/CAPI change, not real behaviour.
  const impossible = rows.filter(
    (r) => (r.impressions > 0 && r.clicks > r.impressions) || (r.purchases > 0 && r.clicks === 0),
  );
  if (impossible.length > 0) {
    flags.push({
      code: "TRACKING_SHIFT",
      detail: `${impossible.length} row(s) with clicks > impressions or purchases without clicks (first: ${impossible[0].adExternalId} ${impossible[0].date})`,
      severity: "warn",
    });
  }

  // ZERO_DENOMINATOR: every row zero on a rate denominator → the dependent
  // metrics (CTR/CVR/ROAS) cannot exist for this window (see lib/rules/metrics.ts).
  const zeroDenoms = (["impressions", "clicks", "spend"] as const).filter((f) =>
    rows.every((r) => r[f] === 0),
  );
  if (zeroDenoms.length > 0) {
    flags.push({
      code: "ZERO_DENOMINATOR",
      detail: `all rows have zero ${zeroDenoms.join(", ")}; dependent rate metrics are undefined`,
      severity: "warn",
    });
  }

  return {
    status: "ok",
    flags,
    trustworthy: flags.every((f) => f.severity !== "block"),
    completeness,
  };
}

// Honesty-gate floor — INTERNAL CALIBRATION, matches the "low" confidence band.
const MIN_CONFIDENCE = 0.3;

/**
 * The honesty gate every feature calls before showing a recommendation:
 * blocked data or low confidence → the recommendation is withheld, with the reason.
 */
export function gateRecommendation(
  dq: DataQualityResult,
  confidenceScore: number,
): { allowed: boolean; reason?: string } {
  if (dq.status === "insufficient_data") {
    return { allowed: false, reason: "insufficient data: no metrics rows to assess" };
  }
  const blocks = dq.flags.filter((f) => f.severity === "block");
  if (blocks.length > 0) {
    return { allowed: false, reason: `data quality block: ${blocks.map((f) => f.detail).join("; ")}` };
  }
  if (confidenceScore < MIN_CONFIDENCE) {
    return {
      allowed: false,
      reason: `confidence ${confidenceScore.toFixed(2)} below the ${MIN_CONFIDENCE} floor`,
    };
  }
  return { allowed: true };
}
