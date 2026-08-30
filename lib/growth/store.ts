import "server-only";
import { createAdminClient } from "../supabase/admin.ts";
import type { Brief } from "./brief.ts";

// Persist + read the growth agent's daily briefs (owner-internal). Service-role only; never customer-exposed.
// Best-effort: a store failure logs but never throws into the cron (a failed save must not crash the run).

export async function saveBrief(brief: Brief): Promise<void> {
  try {
    const admin = createAdminClient();
    const day = brief.generatedAt.slice(0, 10);
    const { error } = await admin.from("growth_briefs").upsert(
      {
        day,
        generated_at: brief.generatedAt,
        discovered: brief.discovered,
        draftable: brief.topOpportunities.length,
        demand_signals: brief.demandSignals.length,
        brief: brief as unknown as Record<string, unknown>,
      },
      { onConflict: "day" },
    );
    if (error) console.warn(`[growth] saveBrief failed: ${error.message}`);
  } catch (err) {
    console.warn("[growth] saveBrief failed:", err instanceof Error ? err.message : err);
  }
}

export async function latestBrief(): Promise<Brief | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("growth_briefs").select("brief").order("generated_at", { ascending: false }).limit(1).maybeSingle();
    return (data?.brief as Brief | undefined) ?? null;
  } catch {
    return null;
  }
}
