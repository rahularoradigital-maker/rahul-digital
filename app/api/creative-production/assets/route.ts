import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedAssetUrl } from "@/lib/creative-production/pipeline";
import { getActiveBrandId } from "@/lib/tenancy/resolve";

// Creative Studio - the asset library + human review (Phases 10 + 22 UI).
//   GET  ?productId  -> stored assets (with short-lived signed SVG urls, QA status, approval)
//   POST {creativeId, approval} -> APPROVE / REJECT / mark review. DRAFTS only; never auto-publishes to Meta.
export const maxDuration = 60;

const VALID = new Set(["approved", "rejected", "review", "draft"]);

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Brand isolation: only the CURRENT brand's assets (not every brand this user can touch). No active brand
  // means no creative to show.
  const brandId = await getActiveBrandId(user.id);
  if (!brandId) return NextResponse.json({ assets: [] });
  const productId = new URL(req.url).searchParams.get("productId");
  let q = createAdminClient().from("cp_assets").select("*").eq("user_id", user.id).eq("brand_id", brandId).order("created_at", { ascending: false }).limit(200);
  if (productId) q = q.eq("product_id", productId);
  const { data } = await q;

  const assets = await Promise.all(
    (data ?? []).map(async (r) => ({
      creativeId: r.creative_id as string,
      conceptId: r.concept_id as string,
      productId: r.product_id as string,
      formatId: r.format_id as string,
      provider: r.provider as string,
      qa: r.qa,
      approval: r.approval as string,
      costUsd: Number(r.cost_usd ?? 0),
      createdAt: r.created_at as string,
      url: await signedAssetUrl(r.storage_path as string),
    })),
  );
  return NextResponse.json({ assets });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { creativeId, approval } = (await req.json().catch(() => ({}))) as { creativeId?: string; approval?: string };
  if (!creativeId || !approval || !VALID.has(approval)) return NextResponse.json({ error: "creativeId + valid approval required" }, { status: 400 });

  // Can only approve/reject assets in the brand you're currently in.
  const brandId = await getActiveBrandId(user.id);
  if (!brandId) return NextResponse.json({ error: "No active brand" }, { status: 400 });
  const { error } = await createAdminClient().from("cp_assets").update({ approval }).eq("user_id", user.id).eq("brand_id", brandId).eq("creative_id", creativeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
