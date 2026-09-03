import { getCurrentUser } from "@/lib/app/user";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadLatestDiscovery } from "@/lib/influencer/store";
import { loadShortlistIds } from "@/lib/influencer/shortlist";
import { CreatorsExplorer } from "@/components/app/creators/creators-explorer";
import { RunButton } from "@/components/app/influencer/run-button";
import { Card, CardContent } from "@/components/ui/card";
import { relativeTime, daysSince } from "@/lib/relative-time";

// Creators: the shadcn/ui build of Influencer Hunt - the same real, reel-driven shortlist with a full filter
// panel (engagement band, min followers, region, gender, confidence). Reads the latest stored run.

export const maxDuration = 60;

export default async function CreatorsPage() {
  const user = await getCurrentUser();
  const session = user ? await getUserMetaSession(user.id) : null;
  const run = user && session ? await loadLatestDiscovery(user.id, session.activeExternalId) : null;
  const savedIds = user && session ? [...await loadShortlistIds(user.id, session.activeExternalId)] : [];
  // §24 freshness: run.createdAt was loaded but never shown - a weeks-old shortlist looked current. Surface
  // its age, and nudge a re-run once it's old enough to likely be stale.
  const runAge = run ? relativeTime(run.createdAt) : null;
  const runDays = daysSince(run?.createdAt);
  const runStale = runDays != null && runDays > 14;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-normal tracking-tight">Influencer Hunt</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Brand-matched creator shortlist, scored on a reel-driven formula. Filter by engagement, size, region, gender, and confidence.
          </p>
          {run && run.ranked.length > 0 && runAge ? (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Discovered {runAge}.{runStale ? " These may be out of date - re-run for a fresh set." : ""}
            </p>
          ) : null}
        </div>
        {run && run.ranked.length > 0 ? <RunButton label="Re-run hunt" hunting="Hunting…" /> : null}
      </div>

      {run && run.ranked.length > 0 ? (
        <CreatorsExplorer creators={run.ranked} accountName={session?.activeAccountName ?? "your account"} savedIds={savedIds} />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-[17px] font-medium">Find creators for {session?.activeAccountName ?? "your brand"}</h2>
              <p className="mt-1.5 max-w-2xl text-[13px] text-muted-foreground">Run a hunt to discover real creators from your brand&apos;s hashtags, ranked on brand fit, reach, engagement, consistency and safety.</p>
            </div>
            <RunButton label="Find creators" hunting="Hunting creators…" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
