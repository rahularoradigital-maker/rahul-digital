import { getCurrentUser } from "@/lib/app/user";
import { getUserMetaSession } from "@/lib/meta-sync";
import { unstable_cache } from "next/cache";
import { analyzeAccountChanges, changeAnalysisTag } from "@/lib/scoring/change-analysis";
import { ConnectState } from "@/components/app/connect-state";
import { ChangeImpactSection } from "@/components/app/changes/change-impact-section";

// Change Impact page: measures each media-buyer change's before/after effect and ranks buyers + change-types.
// Server-rendered; reads the account's ad_changes + ad_metrics through the engine (Phases 1/3/4).
export const maxDuration = 300;

export default async function ChangesPage() {
  const user = await getCurrentUser();
  if (!user) return null; // the /app layout gates auth; this is a belt-and-braces guard

  const session = await getUserMetaSession(user.id);
  if (!session) {
    return (
      <div className="space-y-6">
        <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">Change Impact</h1>
        <ConnectState reason="not_connected" days={90} />
      </div>
    );
  }

  // Perf (Phase-0 audit): measured 16.5s cold / 11.1s warm on the live account - an uncached 120-day
  // multi-page scan re-run on EVERY visit for data that changes once a day. Cached in the platform data
  // cache (survives across serverless invocations, unlike an in-process map) keyed by user + account; the
  // ingest busts the tag on each successful hop, with a 6h TTL as the backstop.
  const analysis = await unstable_cache(
    () => analyzeAccountChanges(user.id, session.activeExternalId),
    ["change-analysis", user.id, session.activeExternalId],
    { revalidate: 6 * 3600, tags: [changeAnalysisTag(user.id, session.activeExternalId)] },
  )();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">Change Impact</h1>
        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
          Every budget, status, targeting, and creative change, scored by its measured before/after effect on the
          objective&apos;s own metric. Correlation with controls (settled window + volume gate), not proof of cause.
        </p>
      </div>
      <ChangeImpactSection analysis={analysis} />
    </div>
  );
}
