import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVitalName, isValidVitalValue, rateVital } from "@/lib/vitals/rate";

// S6 (scale plan): the RUM beacon sink. The client (components/app/vitals-reporter) sends ONE Core Web Vital
// per request via navigator.sendBeacon on page hide. Deliberately tiny + best-effort: it validates the metric
// with the same pure module the gate tests, attributes it to the signed-in user when a session rides along,
// and writes one row. It NEVER blocks or errors the client (a beacon ignores the response) and never trusts
// the client's rating - the server recomputes it. No auth REQUIRED (a beacon may fire post-navigation), so it
// stays cheap and cannot leak anything (write-only; RLS default-deny).
export const runtime = "nodejs";

type Body = { name?: unknown; value?: unknown; path?: unknown };

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const name = String(body.name ?? "");
  const value = Number(body.value);
  if (!isVitalName(name) || !isValidVitalValue(name, value)) {
    return NextResponse.json({ ok: false }, { status: 400 }); // reject junk before any DB write
  }
  // Bound the path to a short, query-stripped string so a hostile beacon can't write a huge blob.
  const rawPath = typeof body.path === "string" ? body.path : "";
  const path = rawPath.split("?")[0].slice(0, 128) || null;

  // Best-effort user attribution: a beacon usually carries the session cookie, but must still record when it
  // does not (anonymous row). getUser never throws here (createClient reads cookies only).
  let userId: string | null = null;
  try {
    const { data } = await (await createClient()).auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    await createAdminClient().from("web_vitals").insert({
      user_id: userId,
      metric: name,
      value,
      rating: rateVital(name, value), // server-computed, never trust the client's label
      path,
    });
  } catch {
    // Recording RUM must never surface an error to the page; drop it silently (table may be absent pre-migration).
  }
  return NextResponse.json({ ok: true });
}
