// Runnable check for the revenue connector seam (MER / nCAC math).
// node --experimental-strip-types scripts/check-revenue.ts
import assert from "node:assert/strict";
import { sumRevenue, computeMer, computeNcac, type RevenueRow } from "../lib/connectors/revenue.ts";

const rows: RevenueRow[] = [
  { date: "2026-08-01", revenue: 100000, orders: 200, newCustomers: 120, newCustomerRevenue: 60000 },
  { date: "2026-08-02", revenue: 50000, orders: 100, newCustomers: 60, newCustomerRevenue: 30000 },
];
const t = sumRevenue(rows);
assert.equal(t.revenue, 150000);
assert.equal(t.orders, 300);
assert.equal(t.newCustomers, 180);

// MER = revenue / spend; nCAC = spend / new customers.
assert.equal(computeMer(150000, 75000), 2);
assert.equal(computeNcac(75000, 180), 75000 / 180);

// Zero denominators return null (the honest insufficient_data gate), never NaN/Infinity.
assert.equal(computeMer(150000, 0), null);
assert.equal(computeNcac(75000, 0), null);
assert.equal(sumRevenue([]).revenue, 0);

console.log("PASS: revenue connector (MER / nCAC) checks");
