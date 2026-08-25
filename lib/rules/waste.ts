// Deterministic wasted-spend detector (rules engine = source of truth).
// Flags spend that is very likely doing no useful work, in two buckets:
//   (a) below-floor spend  — total spend over the window is under a configured floor,
//       i.e. the ad never got enough budget to prove itself; that spend is noise.
//   (b) fatigued spend     — the ad is past its fatigue half-life, so recent spend
//       (the last 3 days) is being poured into a creative that has stopped working.
// Refuses to compute on empty input (never invents a rupee figure).

import type { MetricsRow } from "../ad-source.ts";
import { fatigue } from "./fatigue.ts";

export type WasteResult =
  | { status: "ok"; wastedRs: number; reasons: string[] }
  | { status: "insufficient_data" };

export type WasteConfig = { spendFloorRs: number };

const RECENT_WINDOW = 3; // "recent" spend = last 3 days, matches the fatigue trend window

export function wasteForAd(
  rows: MetricsRow[],
  cfg: WasteConfig,
): WasteResult {
  if (rows.length === 0) return { status: "insufficient_data" };

  const reasons: string[] = [];
  let wastedRs = 0;

  const totalSpend = rows.reduce((acc, r) => acc + r.spend, 0);

  // Bucket (a): below-floor spend. The whole window's spend is considered wasted
  // because the ad never crossed the budget needed to read a real signal.
  if (totalSpend < cfg.spendFloorRs) {
    wastedRs += totalSpend;
    reasons.push("below_floor");
  }

  // Bucket (b): fatigued spend. Only counts when fatigue() has enough data AND says
  // the ad is past half-life; then the last 3 days of spend are treated as wasted.
  const fat = fatigue(rows);
  if (fat.status === "ok" && fat.pastHalfLife) {
    const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const recentSpend = ordered
      .slice(-RECENT_WINDOW)
      .reduce((acc, r) => acc + r.spend, 0);
    wastedRs += recentSpend;
    reasons.push("fatigued");
  }
  // ceiling: buckets (a) and (b) can double-count if a below-floor ad is also
  // fatigued; acceptable for an MVP flag whose job is to surface waste, not bill it.

  return { status: "ok", wastedRs, reasons };
}
