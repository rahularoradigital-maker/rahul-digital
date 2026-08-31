import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { loadFunnelReport } from "@/lib/funnel/store";

// Funnel diagnosis for the current account: stage-tagged ads + the weakest funnel step named against the
// account's own best same-objective ad. Deterministic, no AI. Read-only.
export const maxDuration = 120;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;
  const lb = Number(new URL(req.url).searchParams.get("lookbackDays"));
  const bundle = await loadFunnelReport(user.id, { lookbackDays: Number.isFinite(lb) && lb > 0 ? lb : undefined });
  if (!bundle) return NextResponse.json({ error: "No stored ad data for the active account yet." }, { status: 404 });
  return NextResponse.json(bundle);
}
