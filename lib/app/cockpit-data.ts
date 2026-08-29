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
import { after } from "next/server";
import { getCurrentUser } from "@/lib/app/user";
import { fetchLiveCockpit, type AccountMetrics, type ProcessedCounts, type ScopeTotals, type CatalogMode } from "@/lib/meta-sync";
import type { FunnelMetrics } from "@/lib/metrics/funnel-metrics";
import type { MarginalRead } from "@/lib/scoring/marginal";
import type { DataQuality } from "@/lib/scoring/data-quality";
import type { DiversityRead } from "@/lib/creative/diversity";
import type { DailyPoint } from "@/lib/cockpit/daily-series";
import type { LevelFunnels } from "@/lib/cockpit/level-funnel";
import type { CockpitView } from "@/lib/cockpit/analyze";
import { parseWeights } from "@/lib/rules/verdict";
import { recordDecisionTriples } from "@/lib/audit/record";

export type { AccountMetrics } from "@/lib/meta-sync";

// Date-window constants live in a client-safe module (no server imports); re-exported
// here so server pages keep a single import site for the loader + windows.
export { WINDOWS, parseDays } from "./windows";

export type ConnectReason = "not_connected" | "error" | "no_data" | "syncing";
export type PerfBreakdown = { authMs: number; scopeMs: number; cockpitMs: number; totalMs: number; freshness: string };

// Discriminated on `connected`: a page either has real data to render, or it does
// not and must render the Connect/empty state. There is deliberately no sample view.
export type CockpitData =
  | { connected: true; view: CockpitView; metrics: AccountMetrics; scopeTotals: ScopeTotals; funnel: FunnelMetrics; marginal: MarginalRead; dataQuality: DataQuality; ownDiversity: DiversityRead | null; dailySeries: DailyPoint[]; funnelLevels?: LevelFunnels; accountName: string; accountId: string; dateParam: string; adsAnalyzed: number; processed: ProcessedCounts; days: number; syncedAt?: string; stale?: boolean; perf?: PerfBreakdown; userEmail?: string }
  | { connected: false; days: number; reason: ConnectReason; accountName?: string; errorNote?: string; userEmail?: string };

/**
 * Load the cockpit for the logged-in user over `days`. Redirects to /login if there
 * is no session. Never throws and never returns sample data: a missing/broken/empty
 * Meta connection comes back as `{ connected: false, reason }` for the page to handle.
 */
export async function loadCockpit(days: number): Promise<CockpitData> {
  // Stage timing (ISSUE: speed baseline) - negligible overhead, surfaced on the page via ?perf=1 so
  // the warm-path breakdown (auth vs scope vs cockpit read/compute) is measurable, not guessed.
  const tStart = performance.now();
  // Independent: the user (React-cached, deduped with the layout's call) and the cookie store have
  // no dependency, so resolve them together instead of one after the other.
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  if (!user) redirect("/login");
  const userEmail = user.email ?? undefined;
  const tAuth = performance.now();

  const { lookbackDays, campaignId, objectives, explicitWindow, weights, catalog } = resolveCockpitScope(cookieStore, days);
  const effectiveDays = lookbackDays;

  // The exact date window the user is viewing, formatted for the Ads Manager `date` param
  // ("YYYY-MM-DD_YYYY-MM-DD") so ad deep links open on the same window. An explicit custom
  // range is used verbatim; otherwise it is the last `effectiveDays` ending today (UTC).
  const dateParam = explicitWindow
    ? `${explicitWindow.since}_${explicitWindow.until}`
    : `${new Date(Date.now() - effectiveDays * 86_400_000).toISOString().slice(0, 10)}_${new Date().toISOString().slice(0, 10)}`;

  const tScope = performance.now();
  const live = await fetchLiveCockpit(user.id, lookbackDays, campaignId, objectives, explicitWindow, weights, catalog);
  const tCockpit = performance.now();
  const perf = {
    authMs: Math.round(tAuth - tStart),
    scopeMs: Math.round(tScope - tAuth),
    cockpitMs: Math.round(tCockpit - tScope),
    totalMs: Math.round(tCockpit - tStart),
    freshness: live.status === "connected" ? (live.stale ? "stale" : "fresh") : live.status,
  };

  if (live.status === "connected" && live.adsAnalyzed > 0) {
    // Log the run's recommendations as labeled triples (deferred, deduped per day). Best-effort.
    try {
      after(() => recordDecisionTriples(user.id, live.accountExternalId, dateParam, live.view));
    } catch {
      // after() unavailable outside a request scope; skip logging rather than fail the load.
    }
    return { connected: true, view: live.view, metrics: live.metrics, scopeTotals: live.scopeTotals, funnel: live.funnel, marginal: live.marginal, dataQuality: live.dataQuality, ownDiversity: live.ownDiversity, dailySeries: live.dailySeries, funnelLevels: live.funnelLevels, accountName: live.accountName, accountId: live.accountExternalId, dateParam, adsAnalyzed: live.adsAnalyzed, processed: live.processed, days: effectiveDays, syncedAt: live.syncedAt, stale: live.stale, perf, userEmail };
  }

  // Connected but nothing spent in the window is a real, honest "no data yet" state,
  // distinct from never having connected or a sync error.
  if (live.status === "connected") {
    return { connected: false, days: effectiveDays, reason: "no_data", accountName: live.accountName, userEmail };
  }
  if (live.status === "error") {
    // A cold pull that exceeded its in-request cap returns a "Still syncing" message: the background
    // pull is still warming the cache (e.g. right after switching a filter/window). That is a transient
    // LOADING state, not a connection failure - render it as an auto-refreshing loader, not a scary
    // "could not reach your account / reconnect" error.
    const syncing = (live.message ?? "").startsWith("Still syncing");
    return { connected: false, days: effectiveDays, reason: syncing ? "syncing" : "error", errorNote: syncing ? undefined : live.message, userEmail };
  }
  return { connected: false, days: effectiveDays, reason: "not_connected", userEmail };
}

// Minimal shape of what we read from the cookie store (works for both next/headers cookies()
// and a route handler's request cookies), so this helper stays decoupled from Next internals.
type CookieReader = { get(name: string): { value: string } | undefined };

/**
 * Resolve the scope filters (window / campaign / objective / weights) the topbar wrote into cookies
 * into the exact argument tuple fetchLiveCockpit takes. Shared by loadCockpit AND /api/ask so both
 * compute the SAME cache key - Ask reuses the dashboard's already-warm cockpit instead of triggering
 * its own separate cold pull, and answers about the window the user is actually viewing.
 */
// PRODUCT RULE: comparison and ranking ALWAYS use a fixed 90-day day-wise self-baseline (an ad is
// ranked against the account's own last 90 days, day by day - stable, not a noisy short window). The
// whole app analyzes this one window, so headline totals, KPI cards, funnel, and the leaderboard are
// all consistent. The Dates toggle no longer changes the analysis window; every surface is 90 days.
export const COMPARISON_DAYS = 90;

export function resolveCockpitScope(cookieStore: CookieReader, _defaultDays: number) {
  const campaignId = cookieStore.get("adbrain.campaign")?.value || undefined;
  const objectivesRaw = cookieStore.get("adbrain.objectives")?.value || "";
  const objectives = objectivesRaw ? objectivesRaw.split(",").filter(Boolean) : [];
  const weights = parseWeights(cookieStore.get("adbrain.weights")?.value) ?? undefined;
  // Catalog include/exclude (topbar objective filter). Only the explicit "exclude" opts out;
  // anything else (unset, or a stale value) stays the default "include" = current behavior.
  const catalog: CatalogMode = cookieStore.get("adbrain.catalog")?.value === "exclude" ? "exclude" : "include";
  // Fixed 90-day window everywhere: the Dates cookie is intentionally ignored so ranking is always the
  // 90-day day-wise baseline. explicitWindow is always undefined now (no custom range narrows the
  // comparison); the cast keeps the {since,until}|undefined shape callers still destructure and type on.
  return {
    lookbackDays: COMPARISON_DAYS,
    campaignId,
    objectives,
    explicitWindow: undefined as { since: string; until: string } | undefined,
    weights,
    catalog,
  };
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
