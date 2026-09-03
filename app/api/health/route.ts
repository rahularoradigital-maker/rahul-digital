import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

// Liveness + data-health probe for uptime monitors and ops. It answers the two questions that matter for
// "is AdScale actually working right now": is background sync healthy, and is automation armed.
//
// Security (P0): the UNAUTHENTICATED response is ONLY { status, time } - enough for an uptime monitor
// (200 vs 503 is preserved). The detail (which AI vendors are configured, how many customer accounts
// exist, when the sync last ran, whether automation is dead) is reconnaissance and is returned only to an
// admin session. Previously all of it was public.

export const dynamic = "force-dynamic";

const STALE_AFTER_DAYS = 3; // matches lib/data-quality.ts
// A daily cron should touch ad_sync_state at least once every ~26h (24h cadence + slack). If the newest
// sync run is older than this, automation is effectively DEAD even when CRON_SECRET is set - the exact
// blind spot that let a stopped cron report "ok" while change-history + event data silently went stale.
const AUTOMATION_STALE_HOURS = 26;

export async function GET() {
  const startedOk = true;
  let db: "up" | "down" = "up";
  let syncAccounts = 0;
  let syncErrors = 0;
  let syncStale = 0;
  let lastRunAt: string | null = null; // newest ad_sync_state.updated_at = when ANY sync last actually ran
  let changeAccounts = 0; // rows in change_sync_state = accounts whose change-history has ever ingested
  let changeErrors = 0;
  let rollupAccounts = 0; // rows in account_rollups (instant-app precompute)
  let rollupFresh = 0; // ...of those, computed within AUTOMATION_STALE_HOURS
  let rollupOldestAgeHours: number | null = null;
  let recentConflicts = 0; // account_verifications (store-vs-Meta) that were NOT trustworthy, last 7d

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("ad_sync_state").select("last_ok, last_synced_date, updated_at");
    if (error) db = "down";
    const rows = (data ?? []) as { last_ok: boolean | null; last_synced_date: string | null; updated_at: string | null }[];
    syncAccounts = rows.length;
    const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const r of rows) {
      if (r.last_ok === false) syncErrors++;
      if (!r.last_synced_date || r.last_synced_date < staleCutoff) syncStale++;
      if (r.updated_at && (!lastRunAt || r.updated_at > lastRunAt)) lastRunAt = r.updated_at;
    }
    // Change-history ingestion health (separate pipeline: /activities -> ad_changes). Empty across all
    // accounts means the media-buyer Change-Impact feature has no data to show.
    const { data: cData } = await admin.from("change_sync_state").select("last_ok");
    const cRows = (cData ?? []) as { last_ok: boolean | null }[];
    changeAccounts = cRows.length;
    for (const r of cRows) if (r.last_ok === false) changeErrors++;
    // Instant-app rollup coverage: how many accounts have a precomputed rollup, and how many are fresh. A
    // dead rollup path shows as fresh << connected here, the same way automationStale surfaces a dead cron.
    const { data: rData } = await admin.from("account_rollups").select("computed_at").eq("window_days", 90);
    const rRows = (rData ?? []) as { computed_at: string | null }[];
    rollupAccounts = rRows.length;
    const rollupCutoff = Date.now() - AUTOMATION_STALE_HOURS * 3_600_000;
    let oldestMs: number | null = null;
    for (const r of rRows) {
      const t = r.computed_at ? Date.parse(r.computed_at) : NaN;
      if (Number.isFinite(t)) {
        if (t >= rollupCutoff) rollupFresh++;
        if (oldestMs === null || t < oldestMs) oldestMs = t;
      }
    }
    rollupOldestAgeHours = oldestMs === null ? null : Math.round((Date.now() - oldestMs) / 3_600_000);
    // Data-trust: any store-vs-Meta verification that CONFLICTED in the last 7 days (a real accuracy alarm).
    const conflictCutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { count: cCount } = await admin
      .from("account_verifications")
      .select("id", { count: "exact", head: true })
      .eq("trustworthy", false)
      .gte("created_at", conflictCutoff);
    recentConflicts = cCount ?? 0;
  } catch {
    db = "down";
  }

  const cronConfigured = Boolean(process.env.CRON_SECRET); // false => nightly auto-refresh is disabled
  // Did automation actually RUN recently? (not just: is the secret set). This is what catches a dead cron.
  const lastRunAgeHours = lastRunAt ? Math.round((Date.now() - Date.parse(lastRunAt)) / 3_600_000) : null;
  const automationStale = syncAccounts > 0 && (lastRunAgeHours === null || lastRunAgeHours > AUTOMATION_STALE_HOURS);
  const healthy = startedOk && db === "up" && syncErrors === 0 && cronConfigured && !automationStale;

  // Config visibility (presence only, never key values). realImages mirrors registry.getImageProvider:
  // OpenAI (GPT-Image) is the default - active when explicitly chosen OR when unset with an OpenAI key;
  // Google (Nano Banana) when explicitly chosen OR the fallback default (unset, no OpenAI key, Gemini key);
  // otherwise stub placeholders. IMAGE_PROVIDER=stub forces placeholders.
  const imgChoice = (process.env.IMAGE_PROVIDER ?? "").toLowerCase();
  const openaiActive = (imgChoice === "openai" || imgChoice === "") && Boolean(process.env.OPENAI_API_KEY);
  const googleActive = (imgChoice === "google" || (imgChoice === "" && !process.env.OPENAI_API_KEY)) && Boolean(process.env.GEMINI_API_KEY);
  const providers = {
    imageProvider: process.env.IMAGE_PROVIDER ?? null,
    imageModel: process.env.IMAGE_MODEL ?? null,
    effectiveImageProvider: imgChoice === "stub" ? "stub" : openaiActive ? "openai" : googleActive ? "google" : "stub",
    realImages: imgChoice !== "stub" && (openaiActive || googleActive),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };

  const httpStatus = healthy ? 200 : 503;
  const time = new Date().toISOString();

  // Detail only for an admin session (same gate as the admin routes). A missing/invalid session, or a
  // Supabase hiccup while checking it, yields the minimal public shape - never the detail by accident.
  let admin = false;
  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    admin = isAdminEmail(user?.email ?? null);
  } catch {
    admin = false;
  }
  if (!admin) return NextResponse.json({ status: healthy ? "ok" : "degraded", time }, { status: httpStatus });

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      db,
      cronConfigured,
      automationStale, // true => no sync has run within AUTOMATION_STALE_HOURS: the cron is likely dead
      providers,
      sync: {
        accounts: syncAccounts,
        withErrors: syncErrors,
        stale: syncStale,
        lastRunAt, // when a sync last actually ran (bumped by cron OR manual /api/ingest/run)
        lastRunAgeHours,
        changeHistory: { accounts: changeAccounts, withErrors: changeErrors }, // 0 accounts => Change-Impact has no data
        rollups: { accounts: rollupAccounts, fresh: rollupFresh, connected: syncAccounts, oldestAgeHours: rollupOldestAgeHours, recentConflicts }, // fresh << connected => behind; recentConflicts>0 => a headline disagreed with Meta
      },
      time,
    },
    { status: httpStatus },
  );
}
