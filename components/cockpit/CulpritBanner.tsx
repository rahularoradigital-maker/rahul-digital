import type { DailyPoint } from "@/lib/cockpit/daily-series";
import type { LevelFunnels } from "@/lib/cockpit/level-funnel";
import { diagnoseCulprit } from "@/lib/scoring/culprit";

// The one place the app points at a paused/ended entity - as the CAUSE of a recent drop, not a to-do. Answers
// the top-1% buyer's first question when the account dips: "what did I turn off?" Renders nothing unless
// results actually fell AND a stopped contributor explains it (no false alarms). Pure server component.
export function CulpritBanner({ dailySeries, funnelLevels }: { dailySeries: DailyPoint[]; funnelLevels?: LevelFunnels }) {
  const campaigns = funnelLevels?.campaign ?? [];
  if (!dailySeries.length || !campaigns.length) return null;
  const asOf = dailySeries.reduce<string | null>((m, p) => (m === null || p.date > m ? p.date : m), null);
  const account = dailySeries.map((p) => ({ date: p.date, spend: p.spend, revenue: p.revenue, purchases: p.purchases }));
  const groups = campaigns.map((g) => ({ id: g.id, name: g.name, daily: g.daily }));

  const d = diagnoseCulprit(account, groups, asOf);
  if (!d.summary) return null;

  return (
    <div className="rounded-[10px] border border-[var(--warn-ink)]/25 bg-[var(--warn-bg)] p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 rounded-full bg-[var(--warn-ink)]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--warn-ink)]">Why results dropped</span>
        <p className="text-[13px] leading-snug text-[var(--ink)]">{d.summary}</p>
      </div>
    </div>
  );
}
