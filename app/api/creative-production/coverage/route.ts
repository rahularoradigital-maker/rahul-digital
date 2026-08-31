import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { loadFormatCoverage } from "@/lib/creative-production/formats/coverage-store";

// Creative Studio - format diversity / test coverage for the current brand.
//   GET -> { total, testedCount, byCategory, recommended, rows } across the 42 best-performing formats.
// Read-only; brand-isolated inside loadFormatCoverage.
export const maxDuration = 30;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;
  const coverage = await loadFormatCoverage(user.id);
  return NextResponse.json(coverage);
}
