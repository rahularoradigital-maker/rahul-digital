import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getShopifyConnectionStatus } from "@/lib/creative-production/shopify/store";
import { deriveBrandDNA, saveBrandOverride, loadEffectiveBrandDNA } from "@/lib/creative-production/intelligence/brand-dna";
import type { BrandDNAOverride } from "@/lib/creative-production/types";

// Creative Studio - Brand DNA + Brand Control Panel (Phase 4 UI).
//   GET                              -> the effective brand DNA (derived + override)
//   POST {action:"derive"}           -> (re)derive from the store's own homepage, return effective
//   POST {action:"override", override}-> save user overrides, return effective
//   POST {action:"reset"}            -> "Use Brand Defaults" (clear override), return effective
export const maxDuration = 60;

async function scope(userId: string): Promise<string | null> {
  const conn = await getShopifyConnectionStatus(userId);
  return conn?.shopDomain ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;
  const scopeKey = await scope(user.id);
  if (!scopeKey) return NextResponse.json({ error: "No connected store." }, { status: 400 });
  return NextResponse.json({ brand: await loadEffectiveBrandDNA(user.id, scopeKey) });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const scopeKey = await scope(user.id);
  if (!scopeKey) return NextResponse.json({ error: "No connected store." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; override?: BrandDNAOverride };
  const action = body.action ?? "derive";

  if (action === "derive") {
    await deriveBrandDNA(user.id, scopeKey, { websiteUrl: scopeKey, shopName: scopeKey.split(".")[0] ?? null });
  } else if (action === "override") {
    await saveBrandOverride(user.id, scopeKey, body.override ?? {});
  } else if (action === "reset") {
    await saveBrandOverride(user.id, scopeKey, null);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ brand: await loadEffectiveBrandDNA(user.id, scopeKey) });
}
