// One runnable check for the Shopify product normalize (Creative Production). No frameworks.
// Run: node --experimental-strip-types scripts/check-cp-shopify-normalize.ts
import assert from "node:assert/strict";
import { normalizeProduct, normalizeProductsPage, normalizeShopDomain, type ShopifyProductNode } from "../lib/creative-production/shopify/normalize.ts";

// A node with no id cannot be keyed -> dropped, never faked.
assert.equal(normalizeProduct({} as ShopifyProductNode), null, "no id -> null");

// Full node maps every field; min-price variant drives price + its own compare-at (so a discount shows).
const node: ShopifyProductNode = {
  id: "gid://shopify/Product/1",
  title: "Aloe Serum",
  handle: "aloe-serum",
  description: "Hydrating serum",
  productType: "Skincare",
  vendor: "Soch",
  tags: ["new", "bestseller"],
  status: "ACTIVE",
  totalInventory: 42,
  onlineStoreUrl: "https://store.com/products/aloe-serum",
  featuredImage: { url: "https://img/1.jpg", altText: "front" },
  seo: { title: "Aloe Serum SEO", description: "buy aloe" },
  images: { edges: [{ node: { url: "https://img/1.jpg", altText: "front" } }, { node: { url: "https://img/2.jpg", altText: null } }] },
  variants: {
    edges: [
      { node: { id: "v2", title: "Large", price: "40.00", compareAtPrice: "50.00", sku: "L", inventoryQuantity: 5, availableForSale: true } },
      { node: { id: "v1", title: "Small", price: "25.00", compareAtPrice: "30.00", sku: "S", inventoryQuantity: 10, availableForSale: true } },
    ],
  },
  collections: { edges: [{ node: { id: "c1", title: "Serums", handle: "serums" } }] },
  metafields: { edges: [{ node: { namespace: "reviews", key: "rating", value: "4.8", type: "number_decimal" } }] },
};
const p = normalizeProduct(node)!;
assert.equal(p.productId, "gid://shopify/Product/1");
assert.equal(p.title, "Aloe Serum");
assert.equal(p.price, 25, "min-price variant drives the price");
assert.equal(p.compareAtPrice, 30, "compare-at is the min-price variant's own");
assert.equal(p.variants.length, 2);
assert.equal(p.images.length, 2, "images flattened from edges");
assert.deepEqual(p.tags, ["new", "bestseller"]);
assert.equal(p.collections[0].handle, "serums");
assert.equal(p.metafields[0].value, "4.8");
assert.equal(p.featuredImageUrl, "https://img/1.jpg");

// Sparse node: missing fields become null / [] (never invented).
const sparse = normalizeProduct({ id: "gid://shopify/Product/2" })!;
assert.equal(sparse.title, null, "missing title -> null");
assert.equal(sparse.price, null, "no variants -> null price, not 0");
assert.deepEqual(sparse.images, []);
assert.deepEqual(sparse.tags, []);
assert.equal(sparse.seo, null);

// Page normalize: extracts products + the next cursor only when hasNextPage.
const page = {
  data: { products: { pageInfo: { hasNextPage: true, endCursor: "CUR1" }, edges: [{ node }, { node: { id: "gid://shopify/Product/3", title: "B" } }] } },
};
const { products, nextCursor } = normalizeProductsPage(page);
assert.equal(products.length, 2, "both products normalized");
assert.equal(nextCursor, "CUR1", "next cursor returned while hasNextPage");
const lastPage = normalizeProductsPage({ data: { products: { pageInfo: { hasNextPage: false }, edges: [{ node }] } } });
assert.equal(lastPage.nextCursor, null, "no cursor on the last page");

// Shop domain normalize: strips scheme/path, lowercases; rejects junk.
assert.equal(normalizeShopDomain("https://My-Store.myshopify.com/admin"), "my-store.myshopify.com");
assert.equal(normalizeShopDomain("  store.com  "), "store.com");
assert.equal(normalizeShopDomain("not a domain"), null, "spaces -> null");
assert.equal(normalizeShopDomain("nodot"), null, "no dot -> null");

console.log("PASS: Shopify product normalize (field mapping, min-price, sparse->null, pagination, domain)");
