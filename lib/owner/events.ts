import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The Owner Control Center event recorder (spec Section 39): one append-only shape for meaningful business
// events (login, signup, connector connected, feature used). Fire-and-forget: recording must NEVER block or
// fail the action it describes. This is the spine funnels/retention/feature-usage are computed from later.

export type OwnerEventType = "login" | "signup" | "connector.connected" | "connector.disconnected" | "feature.used" | (string & {});

export function logEvent(eventType: OwnerEventType, opts: { userId?: string | null; feature?: string | null; meta?: Record<string, unknown> } = {}): void {
  const row = { event_type: eventType, user_id: opts.userId ?? null, feature: opts.feature ?? null, meta: opts.meta ?? null };
  void createAdminClient()
    .from("owner_events")
    .insert(row)
    .then(undefined, (e) => console.error("[owner_events] insert failed (recoverable)", e instanceof Error ? e.message : e));
}

export type RecentEvent = { at: string; eventType: string; userId: string | null; feature: string | null };

export async function listRecentEvents(limit = 40): Promise<RecentEvent[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("owner_events").select("created_at, event_type, user_id, feature").order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((r) => ({ at: (r as { created_at: string }).created_at, eventType: (r as { event_type: string }).event_type, userId: (r as { user_id: string | null }).user_id, feature: (r as { feature: string | null }).feature }));
  } catch {
    return [];
  }
}
