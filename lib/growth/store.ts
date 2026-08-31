import "server-only";
import { createAdminClient } from "../supabase/admin.ts";
import type { Brief } from "./brief.ts";
import type { Opportunity } from "./engine.ts";

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

// --- Approval queue (growth_drafts) ---
export type DraftRow = { id: string; day: string; platform: string; community: string | null; url: string; title: string | null; decision: string; score: number; may_mention: boolean; draft: string | null; status: string };

// Queue the day's DRAFT/REQUEST_APPROVAL opportunities for review. Upsert on url so a re-run never duplicates a
// thread; an already-reviewed row keeps its status (only the draft text refreshes). Best-effort.
export async function saveDrafts(day: string, opportunities: Opportunity[]): Promise<void> {
  const rows = opportunities
    .filter((o) => o.decision === "DRAFT" || o.decision === "REQUEST_APPROVAL")
    .map((o) => ({
      day,
      platform: o.conversation.platform,
      community: o.conversation.community,
      url: o.conversation.url,
      title: o.conversation.title ?? null,
      decision: o.decision,
      score: Math.round(o.score * 100),
      may_mention: o.promote.mayMention,
      draft: o.draft ?? null,
    }));
  if (rows.length === 0) return;
  try {
    const admin = createAdminClient();
    // ignoreDuplicates keeps a human-reviewed row's status intact on the next run (we don't clobber a decision).
    const { error } = await admin.from("growth_drafts").upsert(rows, { onConflict: "url", ignoreDuplicates: true });
    if (error) console.warn(`[growth] saveDrafts failed: ${error.message}`);
  } catch (err) {
    console.warn("[growth] saveDrafts failed:", err instanceof Error ? err.message : err);
  }
}

export async function pendingDrafts(limit = 25): Promise<DraftRow[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("growth_drafts").select("id,day,platform,community,url,title,decision,score,may_mention,draft,status").eq("status", "pending").order("score", { ascending: false }).limit(limit);
    return (data ?? []) as DraftRow[];
  } catch {
    return [];
  }
}

// Record the owner's review decision. Returns whether a row was updated. Never posts anything - status only.
export async function setDraftStatus(id: string, status: "approved" | "dismissed" | "posted", reviewerId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("growth_drafts").update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() }).eq("id", id).select("id");
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
