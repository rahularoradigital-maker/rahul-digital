import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { shopifyGraphQL, paceForNext, type ShopifyCost } from "./client";
import { PRODUCTS_QUERY, normalizeProductsPage, type NormalizedProduct } from "./normalize";
import { readShopifyConnection } from "./store";

// Creative Production — Shopify product sync. Complete coverage: cursor-paginate the whole catalogue into
// shopify_products (no cap), upserting each page as it arrives so a run cut short still makes progress and
// the next run resumes (idempotent on (user_id, shop_domain, product_id)). Records the outcome in
// shopify_sync_state (last_ok/last_error/products_seen) for observability. Never throws - mirrors the
// syncAdMetrics pattern. Background job / hold-connection route only (a big catalogue takes time).

const UPSERT_BATCH = 250;
const MAX_PAGES = 400; // 50 products/page -> up to 20k products; runaway guard

export type ShopifySyncResult = { productsSeen: number; ok: boolean; error?: string; shopDomain?: string };

function toRow(userId: string, shopDomain: string, p: NormalizedProduct) {
  return {
    user_id: userId,
    shop_domain: shopDomain,
    product_id: p.productId,
    handle: p.handle,
    title: p.title,
    description: p.description,
    product_type: p.productType,
    vendor: p.vendor,
    status: p.status,
    online_store_url: p.onlineStoreUrl,
    featured_image_url: p.featuredImageUrl,
    total_inventory: p.totalInventory,
    price: p.price,
    compare_at_price: p.compareAtPrice,
    tags: p.tags,
    images: p.images,
    variants: p.variants,
    collections: p.collections,
    seo: p.seo,
    metafields: p.metafields,
    updated_at: new Date().toISOString(),
  };
}

export async function syncShopifyProducts(userId: string): Promise<ShopifySyncResult> {
  const admin = createAdminClient();
  const conn = await readShopifyConnection(userId);
  if (!conn) return { productsSeen: 0, ok: false, error: "No connected Shopify store." };
  const { shopDomain, accessToken, apiVersion } = conn;

  const writeState = (fields: Record<string, unknown>) =>
    admin
      .from("shopify_sync_state")
      .upsert({ user_id: userId, shop_domain: shopDomain, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields }, { onConflict: "user_id,shop_domain" })
      .then(undefined, () => {});

  const seen = new Set<string>();
  const persist = async (products: NormalizedProduct[]) => {
    if (products.length === 0) return;
    for (let i = 0; i < products.length; i += UPSERT_BATCH) {
      const chunk = products.slice(i, i + UPSERT_BATCH).map((p) => toRow(userId, shopDomain, p));
      const { error } = await admin.from("shopify_products").upsert(chunk, { onConflict: "user_id,shop_domain,product_id" });
      if (error) throw new Error(`upsert: ${error.message}`);
    }
    products.forEach((p) => seen.add(p.productId));
  };

  try {
    let cursor: string | null = null;
    let lastCost: ShopifyCost = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      await paceForNext(lastCost, 60); // the products query costs ~50; wait if the bucket is low
      const { data, cost } = await shopifyGraphQL(shopDomain, accessToken, PRODUCTS_QUERY, { cursor }, apiVersion);
      lastCost = cost;
      const { products, nextCursor } = normalizeProductsPage(data);
      await persist(products);
      if (!nextCursor) break;
      cursor = nextCursor;
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : "sync failed";
    await writeState({ last_ok: false, last_error: error.slice(0, 500), products_seen: seen.size });
    return { productsSeen: seen.size, ok: false, error, shopDomain };
  }

  await writeState({ last_ok: true, last_error: null, products_seen: seen.size, last_synced_at: new Date().toISOString() });
  return { productsSeen: seen.size, ok: true, shopDomain };
}
