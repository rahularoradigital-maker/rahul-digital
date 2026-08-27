// Shared data loader for every /app page. Handles auth and pulls the live cockpit
// for the chosen window.
//
// HARD RULE (product): the app only ever shows a user's REAL Meta account data.
// There is no sample/placeholder data anywhere in the rendered app. If nothing real
// is available (not connected, a sync error, or no ads spent in the window) the page
// shows a Connect/empty state, never fabricated numbers. Every section page uses this
// so the rule lives in exactly one place.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/app/user";
import { fetchLiveCockpit, type AccountMetrics } from "@/lib/meta-sync";
import type { CockpitView } from "@/lib/cockpit/analyze";

export type { AccountMetrics } from "@/lib/meta-sync";

// Date-window constants live in a client-safe module (no server imports); re-exported
// here so server pages keep a single import site for the loader + windows.
export { WINDOWS, parseDays } from "./windows";

export type ConnectReason = "not_connected" | "error" | "no_data";

// Discriminated on `connected`: a page either has real data to render, or it does
// not and must render the Connect/empty state. There is deliberately no sample view.
export type CockpitData =
  | { connected: true; view: CockpitView; metrics: AccountMetrics; accountName: string; accountId: string; adsAnalyzed: number; days: number; userEmail?: string }
  | { connected: false; days: number; reason: ConnectReason; accountName?: string; errorNote?: string; userEmail?: string };

/**
 * Load the cockpit for the logged-in user over `days`. Redirects to /login if there
 * is no session. Never throws and never returns sample data: a missing/broken/empty
 * Meta connection comes back as `{ connected: false, reason }` for the page to handle.
 */
export async function loadCockpit(days: number): Promise<CockpitData> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const userEmail = user.email ?? undefined;

  // Optional campaign filter set by the topbar campaign picker (a cookie, so it scopes
  // every page globally without threading a param through each one). Empty = all campaigns.
  const cookieStore = await cookies();
  const campaignId = cookieStore.get("adbrain.campaign")?.value || undefined;
  const objectivesRaw = cookieStore.get("adbrain.objectives")?.value || "";
  const objectives = objectivesRaw ? objectivesRaw.split(",").filter(Boolean) : [];

  const live = await fetchLiveCockpit(user.id, days, campaignId, objectives);

  if (live.status === "connected" && live.adsAnalyzed > 0) {
    return { connected: true, view: live.view, metrics: live.metrics, accountName: live.accountName, accountId: live.accountExternalId, adsAnalyzed: live.adsAnalyzed, days, userEmail };
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
