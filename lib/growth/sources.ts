import "server-only";
import { createAdminClient } from "../supabase/admin.ts";
import { SOURCE_DEFS, healthFor, type SourceDef, type SourceHealth } from "./source-defs.ts";

// Source Registry (spec section 5). The canonical list of Scout's discovery sources + their live health.
// Static definitions (source-defs.ts) describe each source; recordSourceRun() persists health after every run
// so the owner sees what's working / degraded / needs setup.

export { SOURCE_DEFS, healthFor };
export type { SourceDef, SourceHealth };

// Persist the outcome of one source's run. Best-effort; never throws into the cron.
export async function recordSourceRun(sourceId: string, ok: boolean, count: number): Promise<void> {
  const def = SOURCE_DEFS.find((s) => s.source_id === sourceId);
  if (!def) return;
  const health = healthFor(ok, count);
  const now = new Date().toISOString();
  try {
    const admin = createAdminClient();
    await admin.from("growth_sources").upsert(
      {
        source_id: sourceId,
        platform: def.platform,
        method: def.method,
        status: def.status,
        health,
        note: def.note ?? null,
        last_count: ok ? count : 0,
        ...(ok ? { last_success: now } : { last_failure: now }),
        updated_at: now,
      },
      { onConflict: "source_id" },
    );
  } catch {
    /* registry is observability - a write failure never breaks discovery */
  }
}

export type SourceRow = SourceDef & { health: SourceHealth; last_success: string | null; last_count: number };

export async function listSources(): Promise<SourceRow[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("growth_sources").select("source_id,platform,method,status,health,note,last_success,last_count");
    const byId = new Map((data ?? []).map((r) => [r.source_id as string, r]));
    // Merge the static defs with live health, so a never-run source still lists (health 'unknown').
    return SOURCE_DEFS.map((d) => {
      const r = byId.get(d.source_id) as Record<string, unknown> | undefined;
      return { ...d, health: (r?.health as SourceHealth) ?? "unknown", last_success: (r?.last_success as string) ?? null, last_count: (r?.last_count as number) ?? 0 };
    });
  } catch {
    return SOURCE_DEFS.map((d) => ({ ...d, health: "unknown" as SourceHealth, last_success: null, last_count: 0 }));
  }
}
