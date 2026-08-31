import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { resolveUserContext } from "@/lib/tenancy/resolve";

// The brands this signed-in user may switch between - resolved through tenancy (org membership + per-brand
// grants), NOT the raw account list. This is what the brand switcher renders, so a user can never even see
// a brand outside their org/grants.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;

  const ctx = await resolveUserContext(user.id);
  const activeBrandId = ctx.accounts.find((a) => a.isActive)?.brandId ?? null;
  const brands = ctx.brands
    .map((b) => ({
      id: b.id,
      name: b.name,
      orgName: b.orgName,
      active: b.id === activeBrandId,
      accountCount: ctx.accounts.filter((a) => a.brandId === b.id).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ brands, activeBrandId });
}
