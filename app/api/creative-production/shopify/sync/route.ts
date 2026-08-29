import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncShopifyProducts } from "@/lib/creative-production/shopify/sync";
import { syncPublicShopifyProducts } from "@/lib/creative-production/shopify/public-sync";
import { readShopifyConnection, getShopifyConnectionStatus } from "@/lib/creative-production/shopify/store";

// Creative Production — re-sync the connected store's catalogue into shopify_products. Handles BOTH connection
// kinds: a token connection uses the Admin GraphQL sync; a URL-only (public feed) connection re-reads
// /products.json. Big catalogues take time, so the caller keeps the request open (up to maxDuration); the
// outcome is also recorded in shopify_sync_state. Auth-gated.
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Token connection -> Admin API sync. Otherwise fall back to the public-feed re-read.
  const token = await readShopifyConnection(user.id);
  const res = token
    ? await syncShopifyProducts(user.id)
    : await (async () => {
        const status = await getShopifyConnectionStatus(user.id);
        if (!status) return { ok: false, productsSeen: 0, shopDomain: "", error: "No connected store." };
        return syncPublicShopifyProducts(user.id, status.shopDomain);
      })();

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error ?? "Sync failed." }, { status: 502 });
  return NextResponse.json({ ok: true, productsSeen: res.productsSeen, shopDomain: res.shopDomain });
}
