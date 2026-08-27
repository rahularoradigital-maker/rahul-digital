// Data-quality engine: before trusting a read, look at the raw daily series and
// decide how much to believe it. Pure, no I/O, no fabrication. It never rewrites
// the numbers - it emits flags plus a confidence penalty so a downstream score
// can be de-rated instead of manufacturing a conclusion from thin or broken data.
//
// Each detector documents its threshold as a calibrate-at-build constant so the
// bar can be tuned in one place once real accounts are observed.

export type QualityRow = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
};

export type QualityFlag = {
  code: string;
  label: string;
  severity: "info" | "warning" | "critical";
};

export type DataQuality = {
  reliable: boolean;
  confidencePenalty: number; // 0 (clean) .. 1 (unusable), subtract from a base confidence
  flags: QualityFlag[];
  days: number;
  note: string;
};

// ---- Calibrate-at-build constants (tune once real accounts are observed) ----
const SMALL_SAMPLE_WARNING_DAYS = 4; // fewer delivery days than this is thin
const SMALL_SAMPLE_CRITICAL_DAYS = 2; // this few delivery days cannot show a trend at all
const MIN_PURCHASES = 10; // below this, conversion ratios are noise
const SPEND_SHOCK_RATIO = 3; // day-over-day spend swing above this distorts trends
const DELIVERY_GAP_DAYS = 2; // a zero-impression run this long between active days = pause/relaunch
const OUTLIER_SIGMA = 3; // a spend day this far above the mean is an outlier

// Penalty each severity subtracts from confidence.
const SEVERITY_PENALTY: Record<QualityFlag["severity"], number> = {
  info: 0.05,
  warning: 0.2,
  critical: 0.4,
};

function sum(rows: QualityRow[], pick: (r: QualityRow) => number): number {
  return rows.reduce((acc, r) => acc + pick(r), 0);
}

// Fewer than N delivery days, or too few purchases, means the read is thin. Too
// few days is worse than too few purchases, so day-count drives the severity.
function smallSample(rows: QualityRow[]): QualityFlag | null {
  const deliveryDays = rows.filter((r) => r.impressions > 0).length;
  const totalPurchases = sum(rows, (r) => r.purchases);
  if (deliveryDays <= SMALL_SAMPLE_CRITICAL_DAYS) {
    return { code: "small_sample", label: `Only ${deliveryDays} delivery day(s) - too short to trust`, severity: "critical" };
  }
  if (deliveryDays < SMALL_SAMPLE_WARNING_DAYS || totalPurchases < MIN_PURCHASES) {
    return { code: "small_sample", label: `Thin sample: ${deliveryDays} delivery day(s), ${totalPurchases} purchase(s)`, severity: "warning" };
  }
  return null;
}

// A budget shock (spend jumping or collapsing more than N-fold day over day) makes
// a trend line lie. Only compare days that both delivered spend, so a pause is not
// double-counted here (delivery_gap owns that).
function spendShock(rows: QualityRow[]): QualityFlag | null {
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].spend;
    const cur = rows[i].spend;
    if (prev > 0 && cur > 0) {
      const ratio = cur > prev ? cur / prev : prev / cur;
      if (ratio > SPEND_SHOCK_RATIO) {
        return { code: "spend_shock", label: `Spend swung ${ratio.toFixed(1)}x day-over-day`, severity: "warning" };
      }
    }
  }
  return null;
}

// A run of >= N zero-impression days sitting between two active days is a pause or
// relaunch - the before and after are really two different campaigns stitched together.
function deliveryGap(rows: QualityRow[]): QualityFlag | null {
  const active = rows.map((r) => r.impressions > 0);
  const first = active.indexOf(true);
  const last = active.lastIndexOf(true);
  if (first === -1 || last <= first) return null;
  let run = 0;
  let longest = 0;
  for (let i = first + 1; i < last; i++) {
    run = active[i] ? 0 : run + 1;
    if (run > longest) longest = run;
  }
  if (longest >= DELIVERY_GAP_DAYS) {
    return { code: "delivery_gap", label: `${longest}-day zero-impression gap mid-series (pause/relaunch)`, severity: "warning" };
  }
  return null;
}

// A single spend day more than OUTLIER_SIGMA above the mean can drag every average.
// Flagged as info: it is a heads-up, not proof the read is wrong.
function outlierDay(rows: QualityRow[]): QualityFlag | null {
  if (rows.length < 2) return null;
  const spends = rows.map((r) => r.spend);
  const mean = spends.reduce((a, b) => a + b, 0) / spends.length;
  const variance = spends.reduce((a, b) => a + (b - mean) ** 2, 0) / spends.length;
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return null;
  const ceiling = mean + OUTLIER_SIGMA * stdev;
  if (spends.some((s) => s > ceiling)) {
    return { code: "outlier_day", label: "A spend day sits >3 sigma above the mean", severity: "info" };
  }
  return null;
}

// Spend went out but nothing came back. Almost always a tracking gap (pixel down,
// attribution window), not a genuine zero return, so warn rather than believe it.
function zeroRevenueWithSpend(rows: QualityRow[]): QualityFlag | null {
  const totalSpend = sum(rows, (r) => r.spend);
  const totalRevenue = sum(rows, (r) => r.revenue);
  if (totalSpend > 0 && totalRevenue === 0) {
    return { code: "zero_revenue_with_spend", label: "Spend with zero revenue - likely a tracking gap", severity: "warning" };
  }
  return null;
}

export function assessDataQuality(rows: QualityRow[]): DataQuality {
  const flags = [
    smallSample(rows),
    spendShock(rows),
    deliveryGap(rows),
    outlierDay(rows),
    zeroRevenueWithSpend(rows),
  ].filter((f): f is QualityFlag => f !== null);

  const rawPenalty = flags.reduce((acc, f) => acc + SEVERITY_PENALTY[f.severity], 0);
  const confidencePenalty = Math.min(1, rawPenalty);
  const hasCritical = flags.some((f) => f.severity === "critical");
  const reliable = !hasCritical && confidencePenalty < 0.5;

  const note = flags.length === 0
    ? `Clean series over ${rows.length} day(s): no data-quality issues detected.`
    : `${flags.length} data-quality issue(s) (${flags.map((f) => f.code).join(", ")}); de-rate confidence by ${confidencePenalty.toFixed(2)}.`;

  return { reliable, confidencePenalty, flags, days: rows.length, note };
}
