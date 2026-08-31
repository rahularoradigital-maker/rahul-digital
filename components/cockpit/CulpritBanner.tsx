import type { DailyPoint } from "@/lib/cockpit/daily-series";
import type { LevelFunnels } from "@/lib/cockpit/level-funnel";
import { diagnoseCulprit } from "@/lib/scoring/culprit";
import { recentStatusStops } from "@/lib/scoring/status-stops";
import { getCurrentUser } from "@/lib/app/user";

// The one place the app points at a paused/ended entity - as the CAUSE of a recent drop, not a to-do. Answers
// the top-1% buyer's first question when the account dips: "what did I turn off?" Renders nothing unless
// results actually fell AND a stopped contributor explains it (no false alarms). Corroborates the inferred
// stop with the real logged change (who / when) when the change log has it; falls back to inferred otherwise.
export async function CulpritBanner({ dailySeries, funnelLevels, accountId }: { dailySeries: DailyPoint[]; funnelLevels?: LevelFunnels; accountId?: string }) {
  const campaigns = funnelLevels?.campaign ?? [];
  const adsets = funnelLevels?.adset ?? [];
  if (!dailySeries.length || (!campaigns.length && !adsets.length)) return null;
  const asOf = dailySeries.reduce<string | null>((m, p) => (m === null || p.date > m ? p.date : m), null);
  const since = dailySeries.reduce<string | null>((m, p) => (m === null || p.date < m ? p.date : m), null);
  const account = dailySeries.map((p) => ({ date: p.date, spend: p.spend, revenue: p.revenue, purchases: p.purchases }));
  const toGroups = (gs: typeof campaigns) => gs.map((g) => ({ id: g.id, name: g.name, daily: g.daily }));

  // Logged status changes (who paused what, when) to corroborate the inferred stop. Best-effort - an empty map
  // just means the diagnostic uses its inferred wording. Tenant-scoped by the signed-in user.
  let statusEvents: Map<string, { date: string; actorName: string | null }> | undefined;
  try {
    const user = accountId && since ? await getCurrentUser() : null;
    if (user && accountId && since) statusEvents = await recentStatusStops(user.id, accountId, since);
  } catch {
    statusEvents = undefined;
  }

  // Prefer AD-SET grain (a paused ad set inside a live campaign is the common case); fall back to campaign.
  const atAdset = adsets.length ? diagnoseCulprit(account, toGroups(adsets), asOf, "ad set", statusEvents) : null;
  const atCampaign = campaigns.length ? diagnoseCulprit(account, toGroups(campaigns), asOf, "campaign", statusEvents) : null;
  const d = atAdset?.summary ? atAdset : atCampaign;
  if (!d?.summary) return null;

  return (
    <div className="rounded-[10px] border border-[var(--warn-ink)]/25 bg-[var(--warn-bg)] p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 rounded-full bg-[var(--warn-ink)]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--warn-ink)]">Why results dropped</span>
        <p className="text-[13px] leading-snug text-[var(--ink)]">{d.summary}</p>
      </div>
    </div>
  );
}
