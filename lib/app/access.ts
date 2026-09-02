import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/app/user";
import { isAdminEmail } from "@/lib/admin";

// Private-beta access gate (see docs/access-control-plan.md). AUTHENTICATION ("you have an account") is NOT
// AUTHORIZATION ("you may use the product"). A signed-in user is entitled only when their access_state is in
// PRODUCT_OK. Everything else fails CLOSED to the waitlist. Admins are short-circuited off the env allowlist so
// a data problem can never lock staff out. This gate runs IN FRONT of tenancy scoping, never replacing it.

export type AccessState = "WAITLIST" | "INVITED" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "ADMIN";

const PRODUCT_OK: ReadonlySet<AccessState> = new Set<AccessState>(["APPROVED", "ACTIVE", "ADMIN"]);

// One cached read per request. Service-role so it works regardless of RLS. FAIL CLOSED: any error, missing
// row, or unknown value => no product access (never a 500 in the /app layout, matching the never-throw rule).
export const getAccessState = cache(async (): Promise<{ userId: string; email?: string; state: AccessState } | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  if (isAdminEmail(user.email)) return { userId: user.id, email: user.email, state: "ADMIN" }; // allowlist brake
  try {
    const { data } = await createAdminClient().from("profiles").select("access_state").eq("id", user.id).maybeSingle();
    const state = (data?.access_state as AccessState) ?? "WAITLIST"; // no row => waitlist
    return { userId: user.id, email: user.email, state };
  } catch {
    return { userId: user.id, email: user.email, state: "WAITLIST" }; // DB hiccup => deny product, not crash
  }
});

export async function canAccessProduct(): Promise<boolean> {
  const a = await getAccessState();
  return !!a && PRODUCT_OK.has(a.state);
}

export async function canAccessAdmin(): Promise<boolean> {
  const a = await getAccessState();
  return a?.state === "ADMIN"; // mirrors isAdminEmail
}

export async function canAccessBilling(): Promise<boolean> {
  return canAccessProduct(); // no billing plane yet; alias so call sites are future-proof
}

// For Server Components / pages: redirect a non-entitled user to the waitlist screen.
export async function requireProductAccess(): Promise<void> {
  const a = await getAccessState();
  if (!a) redirect("/login");
  if (!PRODUCT_OK.has(a.state)) redirect("/waitlist");
}

// For route handlers: returns a Response to send instead of redirecting, or null when access is allowed.
// Call it as the FIRST line after the route's own getUser() 401, ALWAYS before any expensive integration.
export async function guardProductApi(): Promise<Response | null> {
  const a = await getAccessState();
  if (!a) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!PRODUCT_OK.has(a.state)) return Response.json({ error: "Access pending approval" }, { status: 403 });
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Route wrappers (Phase-0 audit, P1 architecture). The getUser+guardProductApi preamble was copy-pasted 35x
// across 34 route files with 8 drifting variants, and was missing on 5 mutating handlers because a copy-paste
// idiom cannot enforce completeness. These make auth+authz a PRIMITIVE: wrap the handler, and the gate is
// applied by construction. `user` comes from the request-cached getAccessState(), so a wrapped handler gets
// the user id/email with NO extra getUser() round-trip. Error envelopes are uniform ({ error }, 401/403).
// ---------------------------------------------------------------------------------------------------------

export type ApiUser = { id: string; email?: string };
type ProductHandler<Ctx> = (ctx: Ctx & { user: ApiUser }, request: Request) => Promise<Response> | Response;

/**
 * Wrap a route handler so it runs ONLY for a signed-in, product-entitled user (401 / 403 otherwise, fail-closed).
 * Usage: `export const POST = withProductApi(async ({ user }, req) => { ... })`.
 * Next.js passes (request, context) - context (route params) is forwarded on `ctx` untouched.
 */
export function withProductApi<Ctx extends object = object>(handler: ProductHandler<Ctx>) {
  return async (request: Request, ctx?: Ctx): Promise<Response> => {
    const a = await getAccessState();
    if (!a) return Response.json({ error: "Not signed in" }, { status: 401 });
    if (!PRODUCT_OK.has(a.state)) return Response.json({ error: "Access pending approval" }, { status: 403 });
    return handler({ ...(ctx ?? ({} as Ctx)), user: { id: a.userId, email: a.email } }, request);
  };
}

/** Admin-only variant: 401 when signed out, 403 unless the session is on the ADMIN_EMAILS allowlist. */
export function withAdminApi<Ctx extends object = object>(handler: ProductHandler<Ctx>) {
  return async (request: Request, ctx?: Ctx): Promise<Response> => {
    const a = await getAccessState();
    if (!a) return Response.json({ error: "Not signed in" }, { status: 401 });
    if (a.state !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });
    return handler({ ...(ctx ?? ({} as Ctx)), user: { id: a.userId, email: a.email } }, request);
  };
}
