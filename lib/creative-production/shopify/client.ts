import "server-only";
import { fetchWithTimeout } from "@/lib/http";
import { isPublicHttpsUrl } from "@/lib/ssrf";

// Creative Production — Shopify Admin GraphQL client. POST to the shop's graphql.json with the encrypted
// access token in the X-Shopify-Access-Token header (server-side only; never reaches the browser). Reads
// extensions.cost so the caller can pace against the leaky-bucket rate limit. Admin API 2026-07 (GraphQL
// only; REST is legacy). Throws on a non-OK response so the sync records the error.

const SHOPIFY_TIMEOUT_MS = 20_000;

export type ShopifyCost = { available: number; restoreRate: number; requested: number; actual: number } | null;

export function shopifyEndpoint(shopDomain: string, apiVersion = "2026-07"): string {
  return `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
}

/** Run one GraphQL query against a shop. Returns the parsed body + the cost/throttle info for pacing. */
export async function shopifyGraphQL<T = unknown>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {},
  apiVersion = "2026-07",
): Promise<{ data: T; cost: ShopifyCost }> {
  const endpoint = shopifyEndpoint(shopDomain, apiVersion);
  // SSRF guard: shopDomain drives the request origin. Verify it is a public https host before sending the
  // access token anywhere - never POST a credential to an internal/rebound address.
  if (!(await isPublicHttpsUrl(endpoint))) throw new Error("Shopify endpoint host is not a public address");
  const res = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
      body: JSON.stringify({ query, variables }),
      redirect: "manual",
    },
    SHOPIFY_TIMEOUT_MS,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Shopify ${res.status}: ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: T; errors?: unknown; extensions?: { cost?: { requestedQueryCost?: number; actualQueryCost?: number; throttleStatus?: { currentlyAvailable?: number; restoreRate?: number } } } };
  if (json.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors).slice(0, 300)}`);
  }
  const c = json.extensions?.cost;
  const cost: ShopifyCost = c
    ? { available: c.throttleStatus?.currentlyAvailable ?? 0, restoreRate: c.throttleStatus?.restoreRate ?? 0, requested: c.requestedQueryCost ?? 0, actual: c.actualQueryCost ?? 0 }
    : null;
  return { data: (json.data ?? {}) as T, cost };
}

// Pause just long enough to refill for the NEXT query when the bucket is running low. Pure-ish (setTimeout).
// If we have < the next requested cost available, wait (deficit / restoreRate) seconds. No-op when healthy.
export async function paceForNext(cost: ShopifyCost, nextRequested: number): Promise<void> {
  if (!cost || cost.restoreRate <= 0) return;
  const deficit = nextRequested - cost.available;
  if (deficit <= 0) return;
  const waitMs = Math.min(5000, Math.ceil((deficit / cost.restoreRate) * 1000));
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
}
