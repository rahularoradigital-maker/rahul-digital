import "server-only";
import { createAdminClient } from "./supabase/admin.ts";

// Consolidated read for a cached AI insight (cleanup #6: consolidate DB access). The "latest cached content of
// a type for a user" query lived inline in both the positioning route (GET) and the server positioning
// section - the same four-line query in two places. One helper now, so the shape (table, columns, ordering,
// user scoping) is defined once and other insight readers can adopt it. Scoped to the user's own rows.
export async function loadLatestInsight(userId: string, type: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("creative_insights")
    .select("content")
    .eq("user_id", userId)
    .eq("type", type)
    .order("updated_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.content as string | undefined) ?? null;
}
