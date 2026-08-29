// Creative Production — Shopify product normalize (PURE, no I/O, unit-tested by scripts/check-cp-shopify-normalize.ts).
// Turns one Admin GraphQL product node into the flat shopify_products row shape. Never invents data: a
// field the API omits is null. Reused by the sync job and safe to test without a live store.

// The GraphQL products query (Admin API 2026-07). Cursor-paginated on the products connection; nested
// connections (images/variants/collections/metafields) are first-N (enough to characterise a product).
export const PRODUCTS_QUERY = `query CpProducts($cursor: String) {
  products(first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        title
        handle
        description
        productType
        vendor
        tags
        status
        totalInventory
        onlineStoreUrl
        featuredImage { url altText width height }
        seo { title description }
        images(first: 10) { edges { node { url altText width height } } }
        variants(first: 20) { edges { node { id title price compareAtPrice sku inventoryQuantity availableForSale } } }
        collections(first: 10) { edges { node { id title handle } } }
        metafields(first: 20) { edges { node { namespace key value type } } }
      }
    }
  }
}`;

type Edge<T> = { node: T };
type Conn<T> = { edges?: Edge<T>[] } | null | undefined;

export type ShopifyProductNode = {
  id?: string;
  title?: string;
  handle?: string;
  description?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  status?: string;
  totalInventory?: number | null;
  onlineStoreUrl?: string | null;
  featuredImage?: { url?: string; altText?: string | null; width?: number; height?: number } | null;
  seo?: { title?: string | null; description?: string | null } | null;
  images?: Conn<{ url?: string; altText?: string | null; width?: number; height?: number }>;
  variants?: Conn<{ id?: string; title?: string; price?: string | null; compareAtPrice?: string | null; sku?: string | null; inventoryQuantity?: number | null; availableForSale?: boolean }>;
  collections?: Conn<{ id?: string; title?: string; handle?: string }>;
  metafields?: Conn<{ namespace?: string; key?: string; value?: string; type?: string }>;
};

export type NormalizedProduct = {
  productId: string;
  handle: string | null;
  title: string | null;
  description: string | null;
  productType: string | null;
  vendor: string | null;
  status: string | null;
  onlineStoreUrl: string | null;
  featuredImageUrl: string | null;
  totalInventory: number | null;
  price: number | null; // min variant price (for quick display/sort)
  compareAtPrice: number | null; // compare-at of the min-price variant, when present
  tags: string[];
  images: { url: string; altText: string | null }[];
  variants: { id: string; title: string | null; price: number | null; compareAtPrice: number | null; sku: string | null; inventoryQuantity: number | null; availableForSale: boolean }[];
  collections: { id: string; title: string | null; handle: string | null }[];
  seo: { title: string | null; description: string | null } | null;
  metafields: { namespace: string; key: string; value: string; type: string | null }[];
};

const edges = <T>(c: Conn<T>): T[] => (c?.edges ?? []).map((e) => e.node);
const money = (v: string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Normalize one product node. Returns null only when the node has no id (cannot be keyed) - dropped, never faked.
export function normalizeProduct(node: ShopifyProductNode): NormalizedProduct | null {
  if (!node?.id) return null;
  const variants = edges(node.variants).map((v) => ({
    id: String(v.id ?? ""),
    title: v.title ?? null,
    price: money(v.price),
    compareAtPrice: money(v.compareAtPrice),
    sku: v.sku ?? null,
    inventoryQuantity: v.inventoryQuantity ?? null,
    availableForSale: Boolean(v.availableForSale),
  }));
  // Min-price variant drives the card price + its own compare-at (so a discount shows correctly).
  const priced = variants.filter((v) => v.price != null).sort((a, b) => (a.price as number) - (b.price as number));
  const lead = priced[0];
  return {
    productId: String(node.id),
    handle: node.handle ?? null,
    title: node.title ?? null,
    description: node.description ?? null,
    productType: node.productType ?? null,
    vendor: node.vendor ?? null,
    status: node.status ?? null,
    onlineStoreUrl: node.onlineStoreUrl ?? null,
    featuredImageUrl: node.featuredImage?.url ?? null,
    totalInventory: node.totalInventory ?? null,
    price: lead?.price ?? null,
    compareAtPrice: lead?.compareAtPrice ?? null,
    tags: Array.isArray(node.tags) ? node.tags : [],
    images: edges(node.images).map((i) => ({ url: String(i.url ?? ""), altText: i.altText ?? null })).filter((i) => i.url),
    variants,
    collections: edges(node.collections).map((c) => ({ id: String(c.id ?? ""), title: c.title ?? null, handle: c.handle ?? null })),
    seo: node.seo ? { title: node.seo.title ?? null, description: node.seo.description ?? null } : null,
    metafields: edges(node.metafields).map((m) => ({ namespace: String(m.namespace ?? ""), key: String(m.key ?? ""), value: String(m.value ?? ""), type: m.type ?? null })),
  };
}

// Normalize the full products page response -> rows + the next cursor (null when done).
export function normalizeProductsPage(json: unknown): { products: NormalizedProduct[]; nextCursor: string | null } {
  const data = (json as { data?: { products?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string }; edges?: Edge<ShopifyProductNode>[] } } })?.data?.products;
  const products = (data?.edges ?? []).map((e) => normalizeProduct(e.node)).filter((p): p is NormalizedProduct => p !== null);
  const nextCursor = data?.pageInfo?.hasNextPage ? data?.pageInfo?.endCursor ?? null : null;
  return { products, nextCursor };
}

// ---------- Public storefront feed (/products.json) — the NO-TOKEN path ----------
// Every Shopify storefront serves its published catalogue at `${origin}/products.json?limit=250&page=N`.
// It is the shop's OWN public data (what any shopper's browser can load), so no API token / store access
// is needed. The schema differs from Admin GraphQL (snake_case, string prices, images.src, no status/
// inventory/collections), so it gets its own mapper into the SAME NormalizedProduct row shape. Only
// published products appear, and inventory/collections/metafields are absent (marked null/[]), never faked.
export type PublicProductNode = {
  id?: number | string;
  title?: string;
  handle?: string;
  body_html?: string | null;
  product_type?: string | null;
  vendor?: string | null;
  tags?: string[] | string;
  images?: { src?: string; alt?: string | null; width?: number; height?: number }[];
  variants?: { id?: number | string; title?: string; price?: string | null; compare_at_price?: string | null; sku?: string | null; available?: boolean; inventory_quantity?: number | null }[];
};

const stripHtml = (v: string | null | undefined): string | null => {
  if (v == null) return null;
  const t = v.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t || null;
};

// Normalize one public product. `origin` (e.g. https://store.com) builds the product URL the feed omits.
export function normalizePublicProduct(node: PublicProductNode, origin: string): NormalizedProduct | null {
  if (node?.id == null) return null;
  const variants = (node.variants ?? []).map((v) => ({
    id: String(v.id ?? ""),
    title: v.title ?? null,
    price: money(v.price),
    compareAtPrice: money(v.compare_at_price),
    sku: v.sku ?? null,
    inventoryQuantity: v.inventory_quantity ?? null,
    availableForSale: Boolean(v.available),
  }));
  const priced = variants.filter((v) => v.price != null).sort((a, b) => (a.price as number) - (b.price as number));
  const lead = priced[0];
  const images = (node.images ?? []).map((i) => ({ url: String(i.src ?? ""), altText: i.alt ?? null })).filter((i) => i.url);
  const tags = Array.isArray(node.tags) ? node.tags : typeof node.tags === "string" ? node.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  return {
    productId: String(node.id),
    handle: node.handle ?? null,
    title: node.title ?? null,
    description: stripHtml(node.body_html),
    productType: node.product_type ?? null,
    vendor: node.vendor ?? null,
    status: "active", // the public feed only lists published/active products
    onlineStoreUrl: node.handle ? `${origin.replace(/\/$/, "")}/products/${node.handle}` : null,
    featuredImageUrl: images[0]?.url ?? null,
    totalInventory: null,
    price: lead?.price ?? null,
    compareAtPrice: lead?.compareAtPrice ?? null,
    tags,
    images,
    variants,
    collections: [],
    seo: null,
    metafields: [],
  };
}

// Normalize one public feed page. Returns the products (empty array ends pagination). A response with no
// `products` array is NOT a Shopify feed -> products: [] and isShopify:false so the caller can say so.
export function normalizePublicPage(json: unknown, origin: string): { products: NormalizedProduct[]; isShopify: boolean } {
  const arr = (json as { products?: PublicProductNode[] })?.products;
  if (!Array.isArray(arr)) return { products: [], isShopify: false };
  return { products: arr.map((n) => normalizePublicProduct(n, origin)).filter((p): p is NormalizedProduct => p !== null), isShopify: true };
}

// Normalize a shop domain to the canonical "<store>.myshopify.com" (or a custom domain, lowercased, no
// scheme/path). Returns null when it clearly is not a domain, so we never store junk.
export function normalizeShopDomain(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s || !s.includes(".") || /\s/.test(s)) return null;
  return s;
}
