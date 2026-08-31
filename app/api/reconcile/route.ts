import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadReconcile } from "@/lib/reconcile/store";

// Reconcile-with-Meta: spend / revenue / ROAS / ad-count for the active account under each scope (whole,
// exclude-catalog, active, with-purchases, active+purchases), so AdBrain's whole-account number and a
// filtered Meta view can be lined up. Read-only.
export const maxDuration = 60;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const lb = Number(new URL(req.url).searchParams.get("lookbackDays"));
  const bundle = await loadReconcile(user.id, { lookbackDays: Number.isFinite(lb) && lb > 0 ? lb : undefined });
  if (!bundle) return NextResponse.json({ error: "No stored ad data for the active account yet." }, { status: 404 });
  return NextResponse.json(bundle);
}
