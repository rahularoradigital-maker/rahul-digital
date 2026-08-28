import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 renamed `middleware` to `proxy`. This runs on every matched request:
 * it refreshes the Supabase session cookie and gates the /app area.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = path === "/app" || path.startsWith("/app/");

  // Public pages (landing, /login, /signup, marketing) never need an auth check.
  // Skipping Supabase entirely here means a Supabase or edge-runtime hiccup can
  // NEVER 500 a public page. Only the /app area does the session check below.
  if (!isProtected) {
    return NextResponse.next({ request });
  }

  // Before Supabase keys are configured, let /app render (it self-redirects home).
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  let user = null;

  // Even inside /app, a Supabase/runtime hiccup must never 500: on failure we
  // treat the request as unauthenticated and redirect to /login below.
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    // getClaims() verifies the JWT LOCALLY (this project uses asymmetric ES256 signing keys), so
    // most requests do NOT hit the Auth server - unlike getUser(), which was a network round-trip on
    // every /app request. It still refreshes the session when the token is near expiry, writing the
    // new cookies through the setAll callback above, so session refresh is preserved.
    // IMPORTANT: keep this immediately after createServerClient - do not run logic in between, or
    // the refresh-on-expiry can drop sessions intermittently.
    const { data } = await supabase.auth.getClaims();
    user = data?.claims?.sub ? { id: data.claims.sub } : null;
  } catch {
    user = null;
  }

  // We only reach here for /app paths. Unauthenticated -> login.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets and image optimization.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
