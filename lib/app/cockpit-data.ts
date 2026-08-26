// Shared data loader for every /app page. Handles auth and pulls the live cockpit
// for the chosen window.
//
// HARD RULE (product): the app only ever shows a user's REAL Meta account data.
// There is no sample/placeholder data anywhere in the rendered app. If nothing real
// is available (not connected, a sync error, or no ads spent in the window) the page
// shows a Connect/empty state, never fabricated numbers. Every section page uses this
// so the rule lives in exactly one place.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchLiveCockpit } from "@/lib/meta-sync";
import type { CockpitView } from "@/lib/cockpit/analyze";

// Date-window constants live in a client-safe module (no server imports); re-exported
// here so server pages keep a single import site for the loader + windows.
export { WINDOWS, parseDays } from "./windows";

export type ConnectReason = "not_connected" | "error" | "no_data";

// Discriminated on `connected`: a page either has real data to render, or it does
// not and must render the Connect/empty state. There is deliberately no sample view.
export type CockpitData =
  | { connected: true; view: CockpitView; accountName: string; adsAnalyzed: number; days: number; userEmail?: string }
  | { connected: false; days: number; reason: ConnectReason; accountName?: string; errorNote?: string; userEmail?: string };

/**
 * Load the cockpit for the logged-in user over `days`. Redirects to /login if there
 * is no session. Never throws and never returns sample data: a missing/broken/empty
 * Meta connection comes back as `{ connected: false, reason }` for the page to handle.
 */
export async function loadCockpit(days: number): Promise<CockpitData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userEmail = user.email ?? undefined;

  const live = await fetchLiveCockpit(user.id, days);

  if (live.status === "connected" && live.adsAnalyzed > 0) {
    return { connected: true, view: live.view, accountName: live.accountName, adsAnalyzed: live.adsAnalyzed, days, userEmail };
  }

  // Connected but nothing spent in the window is a real, honest "no data yet" state,
  // distinct from never having connected or a sync error.
  if (live.status === "connected") {
    return { connected: false, days, reason: "no_data", accountName: live.accountName, userEmail };
  }
  if (live.status === "error") {
    return { connected: false, days, reason: "error", errorNote: live.message, userEmail };
  }
  return { connected: false, days, reason: "not_connected", userEmail };
}
