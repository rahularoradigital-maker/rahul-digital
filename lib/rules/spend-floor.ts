// J1: the spend floor runs first, at ingest, before any scoring. Nothing is scored,
// compared, graded or recommended unless it spent above the floor in the last 7 days
// (currency auto-detected upstream per J1/5A.1). Below-floor items are held as
// "not enough data yet, keep testing", re-checked daily — never deleted, never scored.

/** Floor thresholds by currency. INTERNAL CALIBRATION (owner anchor, editable). */
export const SPEND_FLOOR = { inr: 300, usd: 5 }; // calibrate-at-build

/** The minimum an item must carry into the floor: its id, its currency, and last-7d spend. */
export type FloorItem = {
  id: string;
  spendLast7dInr?: number;
  spendLast7dUsd?: number;
  currency: "INR" | "USD";
};

/**
 * Split items at the spend floor. `scored` keeps only items whose last-7-day spend
 * in the item's own currency strictly exceeds the floor; everything else goes to
 * `lowData` ("not enough data yet, keep testing"), never deleted. Missing spend for
 * the item's currency is treated as 0 → lowData. Pure: input is neither mutated nor
 * deleted from.
 */
export function applySpendFloor<T extends FloorItem>(
  items: T[],
): { scored: T[]; lowData: T[] } {
  const scored: T[] = [];
  const lowData: T[] = [];
  for (const item of items) {
    const spend =
      item.currency === "INR"
        ? item.spendLast7dInr ?? 0
        : item.spendLast7dUsd ?? 0;
    const floor = item.currency === "INR" ? SPEND_FLOOR.inr : SPEND_FLOOR.usd;
    if (spend > floor) scored.push(item);
    else lowData.push(item);
  }
  return { scored, lowData };
}
