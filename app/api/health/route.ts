import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Liveness + data-health probe for uptime monitors and ops. Returns AGGREGATE counts only - never any
// tenant's rows, ids, or errors - so it is safe to expose without auth. It answers the two questions that
// matter for "is AdBrain actually working right now": is background sync healthy, and is automation armed.

export const dynamic = "force-dynamic";

const STALE_AFTER_DAYS = 3; // matches lib/data-quality.ts

export async function GET() {
  const startedOk = true;
  let db: "up" | "down" = "up";
  let syncAccounts = 0;
  let syncErrors = 0;
  let syncStale = 0;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("ad_sync_state").select("last_ok, last_synced_date");
    if (error) db = "down";
    const rows = (data ?? []) as { last_ok: boolean | null; last_synced_date: string | null }[];
    syncAccounts = rows.length;
    const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const r of rows) {
      if (r.last_ok === false) syncErrors++;
      if (!r.last_synced_date || r.last_synced_date < staleCutoff) syncStale++;
    }
  } catch {
    db = "down";
  }

  const cronConfigured = Boolean(process.env.CRON_SECRET); // false => nightly auto-refresh is disabled
  const healthy = startedOk && db === "up" && syncErrors === 0 && cronConfigured;

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

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      db,
      cronConfigured,
      providers,
      sync: { accounts: syncAccounts, withErrors: syncErrors, stale: syncStale },
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
