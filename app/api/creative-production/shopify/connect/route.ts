import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveShopifyConnection } from "@/lib/creative-production/shopify/store";
import { shopifyGraphQL } from "@/lib/creative-production/shopify/client";
import { normalizeShopDomain } from "@/lib/creative-production/shopify/normalize";
import { syncPublicShopifyProducts } from "@/lib/creative-production/shopify/public-sync";

// Creative Production — connect a Shopify store. PRIMARY path: the user pastes only their store URL; we read
// the shop's OWN public product feed (/products.json), which needs no token or store access. OPTIONAL upgrade:
// a custom-app Admin API token for private/full data (unpublished, inventory, metafields). Auth-gated. The
// full public-app OAuth flow lives in ../authorize + ../callback.
export const maxDuration = 60;

const SHOP_QUERY = `query { shop { name myshopifyDomain } }`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { shopDomain?: string; accessToken?: string; urlOnly?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const shopDomain = normalizeShopDomain(String(body.shopDomain ?? ""));
  if (!shopDomain) return NextResponse.json({ error: "Enter a valid store URL, e.g. your-store.com." }, { status: 400 });

  // PRIMARY path: no token -> read the public storefront feed and pull the whole published catalogue.
  if (body.urlOnly || !body.accessToken) {
    const res = await syncPublicShopifyProducts(user.id, shopDomain);
    if (!res.ok) return NextResponse.json({ error: res.error ?? "Could not read products from that URL." }, { status: 400 });
    await saveShopifyConnection(user.id, res.shopDomain, null, "public_feed", "2026-07", "url_public", res.currency);
    return NextResponse.json({ ok: true, status: "url_public", shopDomain: res.shopDomain, productsSeen: res.productsSeen, currency: res.currency });
  }

  const accessToken = String(body.accessToken).trim();
  // Validate the token live before storing it - a bad token or wrong domain fails fast with a clear message.
  try {
    const { data } = await shopifyGraphQL<{ shop?: { name?: string; myshopifyDomain?: string } }>(shopDomain, accessToken, SHOP_QUERY);
    const shopName = data.shop?.name;
    if (!shopName) throw new Error("no shop returned");
    const ok = await saveShopifyConnection(user.id, data.shop?.myshopifyDomain ?? shopDomain, accessToken, "read_products");
    if (!ok) return NextResponse.json({ error: "Could not save the connection. Please try again." }, { status: 500 });
    return NextResponse.json({ ok: true, status: "connected", shopDomain: data.shop?.myshopifyDomain ?? shopDomain, shopName });
  } catch (e) {
    return NextResponse.json({ error: `Could not reach that store with this token (${e instanceof Error ? e.message : "failed"}). Check the domain and that the custom app has read_products.` }, { status: 400 });
  }
}
