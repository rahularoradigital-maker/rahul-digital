import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveShopifyConnection } from "@/lib/creative-production/shopify/store";
import { shopifyGraphQL } from "@/lib/creative-production/shopify/client";
import { normalizeShopDomain } from "@/lib/creative-production/shopify/normalize";

// Creative Production — connect a Shopify store via a CUSTOM-APP Admin API token (the fast path: the store
// owner creates a custom app in Shopify admin, grants read_products, and pastes the Admin API access token).
// We validate the token with one lightweight query before storing it encrypted. Auth-gated (a user connects
// only their own store). The full public-app OAuth flow lives in ../authorize + ../callback.
export const maxDuration = 30;

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
  if (!shopDomain) return NextResponse.json({ error: "Enter a valid store domain, e.g. your-store.myshopify.com." }, { status: 400 });

  // URL-only fallback (no token yet): store the domain so the UI shows it, degrade features gracefully.
  if (body.urlOnly || !body.accessToken) {
    const ok = await saveShopifyConnection(user.id, shopDomain, null, null);
    return ok
      ? NextResponse.json({ ok: true, status: "url_only", shopDomain })
      : NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
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
