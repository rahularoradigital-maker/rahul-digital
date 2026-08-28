import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Request-deduped current user for the /app segment. Uses getClaims() rather than getUser():
// this project has asymmetric (ES256) JWT signing keys, so getClaims verifies the access token
// LOCALLY with WebCrypto - no network round-trip to the Auth server on every page render. getUser()
// hit the network every time; the proxy (middleware) already refreshed the session for this request,
// so here we only need to verify it. React cache() collapses the layout + loader to one verify.
//
// Returns just { id, email } - the only fields callers use (getClaims returns claims, not a full
// User object). A transient failure must NOT throw: this runs in the /app LAYOUT, whose errors
// escape app/app/error.tsx and would hard-500 every route. Treat any failure as "no user".
export const getCurrentUser = cache(async (): Promise<{ id: string; email?: string } | null> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (!sub) return null;
    return { id: sub, email: typeof data.claims.email === "string" ? data.claims.email : undefined };
  } catch {
    return null;
  }
});
