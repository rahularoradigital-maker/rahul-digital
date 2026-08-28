import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Record the operator's judgment on a recommendation (the RLEF preference label): approve /
// dismiss / modify. Updates today's decision_triple for that ad + window. Best-effort; never
// throws user-facing detail. This is the expert-feedback signal the audit spine is built on.

const VALID = new Set(["approve", "dismiss", "modify"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  let body: { adId?: string; timeWindow?: string; judgment?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const { adId, timeWindow, judgment } = body;
  if (!adId || !timeWindow || !judgment || !VALID.has(judgment)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid fields" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("decision_triples")
      .update({ judgment })
      .eq("user_id", user.id)
      .eq("ad_id", adId)
      .eq("time_window", timeWindow)
      .eq("snapshot_day", today)
      .select("id");
    if (error) return NextResponse.json({ ok: false, error: "Could not save" }, { status: 500 });
    // A filter chain matching zero rows returns error:null with an empty array. Without this check
    // the button would flip to "Approved" even though nothing was recorded.
    if (!data || data.length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to record against yet" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
