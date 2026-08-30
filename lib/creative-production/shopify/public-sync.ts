import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWithTimeout } from "@/lib/http";
import { isPublicHttpsUrl } from "@/lib/ssrf";
import { normalizePublicPage, type NormalizedProduct } from "./normalize";

// Creative Production - NO-TOKEN Shopify ingest via the public storefront feed (`/products.json`). The user
// pastes only their store URL; we detect Shopify and page through the public catalogue. This is the shop's
// OWN public data (any browser can load it), so it needs no store access. Mirrors syncShopifyProducts:
// idempotent upsert into shopify_products, outcome recorded in shopify_sync_state, never throws. Full/private
// data (unpublished products, inventory, metafields) still needs the custom-app token path.

const PAGE_SIZE = 250; // Shopify public feed max per page
const MAX_PAGES = 40; // up to 10k products; runaway guard
const UPSERT_BATCH = 250;
// A real browser UA + Accept: some storefronts vary behaviour by client; keep it a plain public GET.
const HEADERS = { "User-Agent": "Mozilla/5.0 (AdBrain product sync)", Accept: "application/json" };

export type PublicFetchResult = { ok: boolean; isShopify: boolean; origin: string; products: NormalizedProduct[]; currency: string | null; error?: string };

// Read the storefront's active currency from the homepage (Shopify injects `Shopify.currency={"active":"INR"...}`).
// Best-effort: null if not found (UI then shows the bare amount). One small GET, never throws.
async function detectCurrency(origin: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(origin, { headers: HEADERS, redirect: "manual" }, 12_000);
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/) ?? html.match(/"currency"\s*:\s*"([A-Z]{3})"/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

// Normalize any user input ("store.com", "https://store.com/collections/x") to a clean origin.
export function toOrigin(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

// Fetch + detect + paginate the public feed. isShopify:false means the URL did not serve a Shopify feed.
export async function fetchPublicShopifyProducts(rawUrl: string): Promise<PublicFetchResult> {
  const origin = toOrigin(rawUrl);
  if (!origin) return { ok: false, isShopify: false, origin: "", products: [], currency: null, error: "That does not look like a valid website URL." };
  // SSRF guard: the origin is USER-SUPPLIED. Verify it is a public https host (not localhost / a private or
  // metadata IP / a DNS-rebind) BEFORE any fetch, so this cannot be used to probe internal services.
  if (!(await isPublicHttpsUrl(origin))) return { ok: false, isShopify: false, origin, products: [], currency: null, error: "That store URL could not be verified as a public web address." };

  const all: NormalizedProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let json: unknown;
    try {
      const res = await fetchWithTimeout(`${origin}/products.json?limit=${PAGE_SIZE}&page=${page}`, { headers: HEADERS, redirect: "manual" }, 15_000);
      if (!res.ok) {
        if (page === 1) return { ok: false, isShopify: false, origin, products: [], currency: null, error: `The store did not return a public product feed (HTTP ${res.status}). It may not be Shopify, or the storefront is password-protected.` };
        break; // a later page failing just ends pagination with what we have
      }
      json = await res.json();
    } catch {
      if (page === 1) return { ok: false, isShopify: false, origin, products: [], currency: null, error: "Could not read a public product feed from that URL. It may not be a Shopify store." };
      break;
    }
    const { products, isShopify } = normalizePublicPage(json, origin);
    if (page === 1 && !isShopify) return { ok: false, isShopify: false, origin, products: [], currency: null, error: "That URL is not a Shopify store (no public product feed found)." };
    if (products.length === 0) break;
    all.push(...products);
    if (products.length < PAGE_SIZE) break; // last page
  }
  const currency = await detectCurrency(origin);
  return { ok: true, isShopify: true, origin, products: all, currency };
}

function toRow(userId: string, shopDomain: string, p: NormalizedProduct) {
  return {
    user_id: userId, shop_domain: shopDomain, product_id: p.productId, handle: p.handle, title: p.title,
    description: p.description, product_type: p.productType, vendor: p.vendor, status: p.status,
    online_store_url: p.onlineStoreUrl, featured_image_url: p.featuredImageUrl, total_inventory: p.totalInventory,
    price: p.price, compare_at_price: p.compareAtPrice, tags: p.tags, images: p.images, variants: p.variants,
    collections: p.collections, seo: p.seo, metafields: p.metafields, updated_at: new Date().toISOString(),
  };
}

export type PublicSyncResult = { ok: boolean; productsSeen: number; shopDomain: string; currency: string | null; error?: string };

// Fetch the public feed and upsert it into shopify_products. shopDomain = the store host (the scope key the
// rest of the pipeline reads). Records shopify_sync_state. Never throws.
export async function syncPublicShopifyProducts(userId: string, rawUrl: string): Promise<PublicSyncResult> {
  const fetched = await fetchPublicShopifyProducts(rawUrl);
  const shopDomain = fetched.origin.replace(/^https?:\/\//, "");
  if (!fetched.ok) return { ok: false, productsSeen: 0, shopDomain, currency: null, error: fetched.error };

  const admin = createAdminClient();
  const writeState = (fields: Record<string, unknown>) =>
    admin.from("shopify_sync_state").upsert({ user_id: userId, shop_domain: shopDomain, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields }, { onConflict: "user_id,shop_domain" }).then(undefined, () => {});

  try {
    for (let i = 0; i < fetched.products.length; i += UPSERT_BATCH) {
      const chunk = fetched.products.slice(i, i + UPSERT_BATCH).map((p) => toRow(userId, shopDomain, p));
      const { error } = await admin.from("shopify_products").upsert(chunk, { onConflict: "user_id,shop_domain,product_id" });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : "save failed";
    await writeState({ last_ok: false, last_error: error.slice(0, 500), products_seen: fetched.products.length });
    return { ok: false, productsSeen: 0, shopDomain, currency: fetched.currency, error };
  }

  await writeState({ last_ok: true, last_error: null, products_seen: fetched.products.length, last_synced_at: new Date().toISOString() });
  return { ok: true, productsSeen: fetched.products.length, shopDomain, currency: fetched.currency };
}
