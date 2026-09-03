import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { loadPatterns, loadOpportunities, saveOpportunities } from "@/lib/creative-os/store";
import { detectOpportunities } from "@/lib/creative-os/opportunity";

// Creative Intelligence OS — Opportunity Detection surface.
// GET  ?brandId=…  → the stored opportunities for a brand.
// POST { brandId } → generate opportunities from the market patterns (competitor/social) via the pure engine,
//                    persist them, and return them. Deterministic (no external call). Auth + product gated.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const brandId = request.nextUrl.searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  const opportunities = await loadOpportunities(user.id, brandId);
  return NextResponse.json({ opportunities, count: opportunities.length });
}

export async function POST(request: NextRequest) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { brandId?: string };
  if (!body.brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

  // Market = what competitors/social are doing; opportunities are the gaps in that map.
  const all = await loadPatterns(user.id, {});
  const market = all.filter((p) => p.source === "competitor" || p.source === "social");
  const drafts = detectOpportunities(market);
  const saved = await saveOpportunities(user.id, body.brandId, drafts);
  return NextResponse.json({ generated: drafts.length, saved, opportunities: drafts });
}
