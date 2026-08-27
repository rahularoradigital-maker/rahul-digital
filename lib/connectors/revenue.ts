// The revenue-source seam: Shopify / Triple Whale / GA4 all implement RevenueSource and feed
// ONE normalized RevenueRow, so MER and nCAC (today gated as insufficient_data) compute the
// same way regardless of platform. This is the typed connector interface from orchestration-
// plan.md - not LangGraph, just a clean contract each connector fills. Pure math here; the
// live connectors (with their OAuth) plug in later without touching the scoring engines.

export type RevenueRow = {
  date: string; // YYYY-MM-DD
  revenue: number; // total store revenue attributed to the window
  orders: number;
  newCustomers: number; // first-time buyers (for nCAC)
  newCustomerRevenue: number; // revenue from first-time buyers
};

export interface RevenueSource {
  id: "shopify" | "triple_whale" | "ga4";
  fetchRevenue(window: { since: string; until: string }): Promise<RevenueRow[]>;
}

export type RevenueTotals = { revenue: number; orders: number; newCustomers: number; newCustomerRevenue: number };

export function sumRevenue(rows: RevenueRow[]): RevenueTotals {
  return rows.reduce(
    (t, r) => ({
      revenue: t.revenue + r.revenue,
      orders: t.orders + r.orders,
      newCustomers: t.newCustomers + r.newCustomers,
      newCustomerRevenue: t.newCustomerRevenue + r.newCustomerRevenue,
    }),
    { revenue: 0, orders: 0, newCustomers: 0, newCustomerRevenue: 0 },
  );
}

// MER (marketing efficiency ratio) = total store revenue / total ad spend. Null when spend is 0
// (never a fabricated ratio) - the exact gate the cockpit shows until a revenue source connects.
export function computeMer(totalRevenue: number, adSpend: number): number | null {
  return adSpend > 0 ? totalRevenue / adSpend : null;
}

// nCAC (new-customer acquisition cost) = ad spend / new customers. Null when there are no new
// customers to divide by.
export function computeNcac(adSpend: number, newCustomers: number): number | null {
  return newCustomers > 0 ? adSpend / newCustomers : null;
}
