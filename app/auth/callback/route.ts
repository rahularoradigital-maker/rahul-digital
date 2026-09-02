import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/owner/events";

// Security: `next` is attacker-controllable via the link. Only a same-origin ABSOLUTE PATH is honoured;
// anything else ("//evil.com", "/\evil.com", "@evil.com", "https://evil.com") falls back to /app. Without
// this, `${origin}${next}` let `?next=@evil.com` redirect off-site under the real domain (open redirect +
// login-CSRF). Resolved with `new URL(next, origin)` so the origin is always ours.
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/app";
  return raw;
}

/** Handles the magic-link / email-confirmation redirect from Supabase. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      logEvent("login", { userId: user?.id ?? null }); // owner-analytics: a real sign-in landed
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
