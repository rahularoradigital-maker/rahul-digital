import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncShopifyProducts } from "@/lib/creative-production/shopify/sync";

// Creative Production — sync the connected store's product catalogue into shopify_products. A big catalogue
// takes time, so the caller must keep the request open (the function stays alive for the active request, up
// to maxDuration). The outcome is also recorded in shopify_sync_state so an early-abort caller can still see
// it land. Auth-gated. Same function the background/cron sync will call.
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const res = await syncShopifyProducts(user.id);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error ?? "Sync failed." }, { status: 502 });
  return NextResponse.json({ ok: true, productsSeen: res.productsSeen, shopDomain: res.shopDomain });
}
