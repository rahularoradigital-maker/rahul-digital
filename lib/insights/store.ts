import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/observability";

// Store for cached AI insights (Brand Brain / Concepts / positioning output) - Phase-0 audit P1: this query
// lived INSIDE app/app/creative/page.tsx, i.e. a service-role (RLS-bypassing) read whose only tenant
// isolation was a hand-written .eq("user_id") in a page file that anyone editing layout would touch. The
// store layer is where tenancy predicates belong (and where a boundary lint can check them).
//
// Best-effort: a miss or a DB hiccup returns {} (the Generate button shows), never throws - but the failure
// is captured, not swallowed.

export async function loadCreativeInsights(userId: string, accountId: string): Promise<Record<string, string>> {
  try {
    const { data } = await createAdminClient()
      .from("creative_insights")
      .select("type, content")
      .eq("user_id", userId)
      .eq("account_external_id", accountId);
    const out: Record<string, string> = {};
    for (const row of (data ?? []) as { type: string; content: string }[]) out[row.type] = row.content;
    return out;
  } catch (e) {
    captureError(e, { fn: "loadCreativeInsights" });
    return {};
  }
}
