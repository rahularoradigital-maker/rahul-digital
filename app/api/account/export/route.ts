import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guardProductApi } from "@/lib/app/access";
import { buildUserExport } from "@/lib/account/export";

// GDPR data portability: download the SIGNED-IN user's own data as JSON. Product-gated + own-user (a user can
// only ever export their own data), read-only, and scrubbed of secrets by buildUserExport. Returned as a file
// attachment so the browser saves it directly.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const data = await buildUserExport(user.id);
  const filename = `adscale-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
