import { getCurrentUser } from "@/lib/app/user";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadLatestDiscovery } from "@/lib/influencer/store";
import { InfluencerHunt, MatchingPanel, CreatorCards } from "@/components/app/influencer/influencer-hunt";
import { RunButton } from "@/components/app/influencer/run-button";

// Influencer Hunt: brand-matched creator discovery + transparent, formula-driven ranking. If the account has
// a stored run, we render the real ranked creators instantly (a re-run is an explicit button). Otherwise we
// show a "Find creators" trigger + a clearly-labelled sample preview so the UX is never empty.

export const maxDuration = 300;

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "recently";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export default async function InfluencerPage() {
  const user = await getCurrentUser();
  const session = user ? await getUserMetaSession(user.id) : null;
  const run = user && session ? await loadLatestDiscovery(user.id, session.activeExternalId) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight">Influencer Hunt</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">
          Find the creators most likely to be strategically valuable for this brand - ranked by a transparent formula, with evidence and
          confidence on every field, and an honest &ldquo;why this creator&rdquo; behind each rank.
        </p>
      </div>

      {run && run.ranked.length > 0 ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] text-[var(--ink-muted)]">
              <span className="font-medium text-[var(--ink)]">{run.ranked.length} creators</span> ranked for{" "}
              <span className="font-medium text-[var(--ink)]">{session?.activeAccountName ?? "your account"}</span> · refreshed {timeAgo(run.createdAt)}
              {run.stats ? ` · from ${run.stats.enriched} profiles` : ""}
            </div>
            <RunButton label="Re-run hunt" hunting="Hunting..." />
          </div>
          {run.target ? <MatchingPanel target={run.target} /> : null}
          <CreatorCards ranked={run.ranked} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
            <h2 className="text-[17px] font-medium">Find the best creators for {session?.activeAccountName ?? "your brand"}</h2>
            <p className="mt-1.5 max-w-2xl text-[13px] text-[var(--ink-muted)]">
              We read your brand from Market (category, products, market), search Instagram for relevant creators, pull each profile, and
              rank them on the transparent quality formula. Uses your ScrapeCreators credits.
            </p>
            <div className="mt-4">
              <RunButton label="Find creators" hunting="Hunting creators..." />
            </div>
          </div>
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Example output (sample data)</div>
            <InfluencerHunt />
          </div>
        </div>
      )}
    </div>
  );
}
