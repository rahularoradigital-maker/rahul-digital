import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { loadPatterns } from "@/lib/creative-os/store";
import { isPatternType } from "@/lib/creative-os/schema";

// Creative Intelligence OS — read the signed-in user's creative patterns (the Creative Database), optionally
// filtered by ?brandId and ?type. Auth + product gated; user-scoped read.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const brandId = request.nextUrl.searchParams.get("brandId");
  const typeRaw = request.nextUrl.searchParams.get("type");
  const type = typeRaw && isPatternType(typeRaw) ? typeRaw : undefined;

  const patterns = await loadPatterns(user.id, { brandId: brandId ?? undefined, type });
  return NextResponse.json({ patterns, count: patterns.length });
}
