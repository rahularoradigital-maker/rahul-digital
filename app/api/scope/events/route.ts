import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";

// Distinct optimization EVENTS the signed-in user's ads actually optimize for (ad_meta.optimization_event:
// the ad set's promoted_object.custom_event_type, e.g. ADD_TO_CART / PURCHASE, or its optimization_goal).
// Powers the topbar Event filter. Returns ONLY events that exist in the store - never a hardcoded guess -
// so the picker can't offer an event that would empty every screen. Empty array = no event data synced yet
// (the column populates on the next full sync), which the switcher renders as a disabled "sync to enable".
// User-scoped via the auth session + RLS on ad_meta, so one user never sees another's events.

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ events: [] }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const { data } = await supabase
    .from("ad_meta")
    .select("optimization_event")
    .eq("user_id", user.id)
    .not("optimization_event", "is", null)
    .limit(5000);

  const events = Array.from(new Set((data ?? []).map((r) => (r as { optimization_event: string | null }).optimization_event).filter((e): e is string => !!e))).sort();
  return NextResponse.json({ events });
}
