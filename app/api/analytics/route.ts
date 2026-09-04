import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTrackablePath, normalizePath, refHost } from "@/lib/analytics/classify";

// First-party analytics beacon sink. The client sends only { path, event }; the server derives the referrer
// host from the Referer header and a DAILY, non-reversible visitor hash from ip+ua (which are NEVER stored).
// Public + write-only + best-effort (a beacon ignores the response). No cookies, no PII stored -> no consent
// banner needed. Rejects non-website paths (/app, /api, files) so product usage isn't counted as traffic.
export const runtime = "nodejs";

type Body = { path?: unknown; event?: unknown };

// Daily visitor hash: hash(date + ip + ua + salt). Rotates every day (privacy: not cross-day linkable) and is
// one-way. The raw ip/ua are used only to compute it and are never written anywhere.
function visitorHash(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT ?? process.env.TOKEN_ENC_KEY ?? "adscale-analytics";
  return createHash("sha256").update(`${day}|${ip}|${ua}|${salt}`).digest("hex").slice(0, 32);
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const path = normalizePath(body.path);
  const event = body.event === "read" ? "read" : "view";
  if (!path || !isTrackablePath(path)) return NextResponse.json({ ok: false }, { status: 400 });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "0.0.0.0";
  const ua = request.headers.get("user-agent") ?? "";
  const selfHost = request.nextUrl.hostname;

  try {
    await createAdminClient().from("page_views").insert({
      path,
      ref_host: refHost(request.headers.get("referer"), selfHost),
      visitor_hash: visitorHash(ip, ua),
      event,
    });
  } catch {
    // Analytics must never surface an error to the page; drop silently (table may be absent pre-migration).
  }
  return NextResponse.json({ ok: true });
}
