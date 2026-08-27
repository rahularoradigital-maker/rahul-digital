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
  | { connected: true; view: CockpitView; metrics: AccountMetrics; accountName: string; accountId: string; dateParam: string; adsAnalyzed: number; days: number; userEmail?: string }
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

  // Date window set by the topbar (a cookie, so it scopes every page globally). Either a
  // preset ("days:<n>") or an explicit custom range ("range:<from>:<to>"). Absent = fall
  // back to the `days` argument the page derived from ?days.
  const win = parseWindowCookie(cookieStore.get("adbrain.window")?.value);
  const lookbackDays = win?.kind === "days" ? win.days : win?.kind === "range" ? rangeDays(win.since, win.until) : days;
  const explicitWindow = win?.kind === "range" ? { since: win.since, until: win.until } : undefined;
  const effectiveDays = lookbackDays;

  // The exact date window the user is viewing, formatted for the Ads Manager `date` param
  // ("YYYY-MM-DD_YYYY-MM-DD") so ad deep links open on the same window. An explicit custom
  // range is used verbatim; otherwise it is the last `effectiveDays` ending today (UTC).
  const dateParam = explicitWindow
    ? `${explicitWindow.since}_${explicitWindow.until}`
    : `${new Date(Date.now() - effectiveDays * 86_400_000).toISOString().slice(0, 10)}_${new Date().toISOString().slice(0, 10)}`;

  const live = await fetchLiveCockpit(user.id, lookbackDays, campaignId, objectives, explicitWindow);

  if (live.status === "connected" && live.adsAnalyzed > 0) {
    return { connected: true, view: live.view, metrics: live.metrics, accountName: live.accountName, accountId: live.accountExternalId, dateParam, adsAnalyzed: live.adsAnalyzed, days: effectiveDays, userEmail };
  }

  // Connected but nothing spent in the window is a real, honest "no data yet" state,
  // distinct from never having connected or a sync error.
  if (live.status === "connected") {
    return { connected: false, days: effectiveDays, reason: "no_data", accountName: live.accountName, userEmail };
  }
  if (live.status === "error") {
    return { connected: false, days: effectiveDays, reason: "error", errorNote: live.message, userEmail };
  }
  return { connected: false, days: effectiveDays, reason: "not_connected", userEmail };
}

// Parse the adbrain.window cookie. "days:<n>" -> preset; "range:<from>:<to>" -> custom
// range (validated YYYY-MM-DD, from <= to). Anything malformed returns null (caller falls
// back to the ?days-derived default), so a bad cookie never breaks the load.
type ParsedWindow = { kind: "days"; days: number } | { kind: "range"; since: string; until: string };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseWindowCookie(raw?: string): ParsedWindow | null {
  if (!raw) return null;
  if (raw.startsWith("days:")) {
    const n = Number(raw.slice(5));
    return Number.isFinite(n) && n > 0 ? { kind: "days", days: n } : null;
  }
  if (raw.startsWith("range:")) {
    const [since, until] = raw.slice(6).split(":");
    if (ISO_DATE.test(since) && ISO_DATE.test(until) && since <= until) return { kind: "range", since, until };
  }
  return null;
}

// Inclusive day span of a range, so the "Last N days" label stays a sensible number.
function rangeDays(since: string, until: string): number {
  const ms = new Date(until).getTime() - new Date(since).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}
