import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { searchCompanies } from "@/lib/scrapecreators";

// Competitor discovery: search Meta brand pages by keyword so the user clicks a suggestion
// instead of hunting for an Ad Library URL. Read-only; auth-gated. Returns page ids the pull
// route then uses. Honest failures (no key / API error) come back as a message, not a crash.

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });

  try {
    const results = await searchCompanies(q, 10);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Search failed" }, { status: 502 });
  }
}
