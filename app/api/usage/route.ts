import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsage } from "@/lib/billing/meter";

// Read-only token meter for the in-app usage bar. Own-user only. Never throws (getUsage fails to a
// zero-usage free view), so the meter can render on every app page without risk.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const usage = await getUsage(user.id);
  return NextResponse.json(usage);
}
