import { getCurrentUser } from "@/lib/app/user";
import { getUserMetaSession } from "@/lib/meta-sync";
import { analyzeAccountChanges } from "@/lib/scoring/change-analysis";
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

  const analysis = await analyzeAccountChanges(user.id, session.activeExternalId);

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
