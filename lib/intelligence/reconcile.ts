// Self-proving accuracy: the pure diff + drift + verdict engine of source reconciliation (charter §6/§93/§94,
// §129). Given TWO independent values for the same critical metric - e.g. AdBrain's stored number vs a fresh
// Meta pull, or two calc paths - it decides whether they MATCH, DRIFT a little, or CONFLICT, and how much to
// lower downstream confidence. The data-layer lane supplies the second path; this file is the deterministic
// judgement + a rollup, fully testable. Rule (§129): on real conflict, never silently pick the nicer number -
// surface it and lower confidence (or HOLD).

export type ReconStatus = "match" | "minor_drift" | "conflict";

// Calibration constants (tune here, not the logic). Drift is a share of the larger magnitude, so it is
// symmetric and scale-free.
const MATCH_UNDER = 0.01; // < 1% apart = the same number (rounding / timing)
const DRIFT_UNDER = 0.05; // 1-5% = minor drift (worth noting, still usable)
// >= 5% = conflict.

export type Reconciliation = {
  metric: string;
  a: number;
  b: number;
  sourceA: string;
  sourceB: string;
  driftPct: number; // 0..1, |a-b| / max(|a|,|b|)
  status: ReconStatus;
  confidencePenalty: 0 | 1 | 2; // 0 keep, 1 lower one tier, 2 lower two tiers / HOLD
  note: string;
};

export function reconcile(
  metric: string,
  a: number,
  b: number,
  sourceA: string,
  sourceB: string,
): Reconciliation {
  const denom = Math.max(Math.abs(a), Math.abs(b));
  // Both zero -> perfect match (nothing to spend/earn). One zero, other not -> full conflict.
  const driftPct = denom === 0 ? 0 : Math.abs(a - b) / denom;
  const status: ReconStatus = driftPct < MATCH_UNDER ? "match" : driftPct < DRIFT_UNDER ? "minor_drift" : "conflict";
  const confidencePenalty = status === "match" ? 0 : status === "minor_drift" ? 1 : 2;
  const pct = (driftPct * 100).toFixed(1);
  const note =
    status === "match"
      ? `${sourceA} and ${sourceB} agree on ${metric} (within ${pct}%).`
      : status === "minor_drift"
        ? `${metric} drifts ${pct}% between ${sourceA} and ${sourceB} - usable, but lower the confidence a notch.`
        : `${metric} CONFLICTS ${pct}% between ${sourceA} (${a}) and ${sourceB} (${b}). Do not trust it blindly - reconcile the definitions before deciding.`;
  return { metric, a, b, sourceA, sourceB, driftPct, status, confidencePenalty, note };
}

export type ReconSummary = { checked: number; matches: number; drifts: number; conflicts: number; worstDriftPct: number; trustworthy: boolean };

// Roll up a batch across metrics. `trustworthy` is false if ANY critical metric is in conflict - the account's
// data health can't be called good while a headline number disagrees between sources.
export function reconSummary(recs: Reconciliation[]): ReconSummary {
  const conflicts = recs.filter((r) => r.status === "conflict").length;
  return {
    checked: recs.length,
    matches: recs.filter((r) => r.status === "match").length,
    drifts: recs.filter((r) => r.status === "minor_drift").length,
    conflicts,
    worstDriftPct: recs.reduce((m, r) => Math.max(m, r.driftPct), 0),
    trustworthy: conflicts === 0,
  };
}
