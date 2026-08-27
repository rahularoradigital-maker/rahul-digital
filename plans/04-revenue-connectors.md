# [plan-04] Revenue Connectors — unlock MER / nCAC / contribution economics

## Defect

Economic truth needs store revenue, and the app has **none connected**. The `RevenueSource` seam
and the math (`computeMer`, `computeNcac`) exist, but with no Shopify/GA4/Triple-Whale feed, MER
and nCAC are permanently `insufficient_data`, the two economic KPI cards are dead decoys, and the
J7 confidence ladder caps every economic action at 0.45 until Shopify lands. The app can grade
creative (Meta owns that) but cannot grade *business* outcomes.

## Symptoms

- MER + nCAC KPI cards always show "Connect Shopify" — permanent dead surface. (ties to plan-01)
- Blended ROAS is Meta-attributed only; no MER (revenue ÷ spend) or contribution ROAS.
- `lib/confidence.ts` `CEILING_ECONOMIC` holds economic confidence at 0.45 (Meta-only) → 0.90
  (Shopify) — the app tells the user to connect, but there is nothing to connect to.
- No new-vs-returning split → no true nCAC, no new-customer efficiency.

## Fix sequence

1. Implement one `RevenueSource` — Shopify first (largest DTC surface): OAuth, `fetchRevenue`
   returning `RevenueRow[]` (revenue, orders, newCustomers, newCustomerRevenue) per day.
2. Wire it into `meta-sync`/cockpit-data so `scopeTotals` gains store revenue; compute MER + nCAC
   and light up the KPI cards with real values + a source/fact label.
3. Feed `connectedSources` + `actionClass` into `computeConfidence` so the J7 ceiling actually
   rises when Shopify connects.
4. Add GA4 and Triple Whale behind the same interface (no scoring-engine changes).

## Test matrix

| Sources connected | MER | nCAC | Economic confidence ceiling |
|---|---|---|---|
| Meta only | insufficient_data | insufficient_data | 0.45 |
| + Shopify | real value + OFFICIAL/DERIVED label | real value | 0.90 |
| + GA4 + 3P | reconciled | reconciled | 0.95 |

## Out of scope

Attribution modelling / MMM. This plan connects first-party revenue; advanced attribution is a
later track.
