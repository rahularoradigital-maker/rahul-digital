import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { accountStoreTag } from "@/lib/cache";
import { getCurrentUser } from "@/lib/app/user";
import { getUserMetaSession } from "@/lib/meta-sync";
import { resolveCockpitScope } from "@/lib/app/cockpit-data";
import { loadFunnelReport } from "@/lib/funnel/store";
import { ConnectState } from "@/components/app/connect-state";
import { FunnelReportView } from "@/components/app/funnel/funnel-report";
import { DataFreshness } from "@/components/app/data-freshness";

// Funnel page: deterministic funnel-step diagnosis. Tags each ad TOF/MOF/BOF and names the single weakest
// step against the account's own best same-objective ad - refusing to answer when it cannot trust the data.
// Server-rendered from the stored ad_metrics; no AI, no live pull.
export const maxDuration = 120;

export default async function FunnelPage() {
  const user = await getCurrentUser();
  if (!user) return null; // the /app layout gates auth; belt-and-braces

  const session = await getUserMetaSession(user.id);
  const header = (
    <div>
      <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">Funnel</h1>
      <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
        Every number here is arithmetic you can check by hand. Each ad is compared only to your own best ad with
        the same goal, and the report holds (says so) rather than naming a leak it cannot trust.
      </p>
    </div>
  );

  if (!session) {
    return (
      <div className="space-y-6">
        {header}
        <ConnectState reason="not_connected" days={90} />
      </div>
    );
  }

  // Honor the topbar filters (Catalog / Objective / Campaign / Window), the same ones the Cockpit applies, so
  // "Catalog: Excluded" actually hides catalog ads here and the selected date range drives the diagnosis.
  const scope = resolveCockpitScope(await cookies(), 90);
  const filters = {
    catalog: scope.catalog,
    objectives: scope.objectives,
    events: scope.events,
    campaignIds: scope.campaignId ? scope.campaignId.split(",").filter(Boolean) : undefined,
    explicitWindow: scope.explicitWindow,
    lookbackDays: scope.explicitWindow ? undefined : scope.lookbackDays,
  };
  // Perf (Phase-0 audit): measured 15.5s cold / 11.9s warm on the live account - a full in-window
  // ad_metrics + ad_meta scan re-run on every visit for data that changes once a day. Cached in the platform
  // data cache keyed by user + account + the exact topbar scope + today's date (the default window rolls
  // daily); the ingest busts the account tag on each successful hop, 6h TTL as the backstop. The scope is
  // resolved from cookies OUT HERE - request APIs are not allowed inside the cached function.
  const today = new Date().toISOString().slice(0, 10);
  const bundle = await unstable_cache(
    () => loadFunnelReport(user.id, filters),
    ["funnel-report", user.id, session.activeExternalId, JSON.stringify(filters), today],
    { revalidate: 6 * 3600, tags: [accountStoreTag(user.id, session.activeExternalId)] },
  )();

  return (
    <div className="space-y-6">
      {header}
      <DataFreshness userId={user.id} accountExternalId={session.activeExternalId} />
      {bundle ? (
        <FunnelReportView report={bundle.report} accountName={bundle.accountName} accountId={bundle.accountId} since={bundle.since} until={bundle.until} />
      ) : (
        <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5 text-[14px] text-[var(--ink-muted)]">
          This brand hasn&apos;t synced yet. It syncs automatically in the background - check back shortly and your funnel diagnosis will appear here.
        </div>
      )}
    </div>
  );
}
