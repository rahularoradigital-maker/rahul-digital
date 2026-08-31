import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/app/user";
import { getUserMetaSession } from "@/lib/meta-sync";
import { resolveCockpitScope } from "@/lib/app/cockpit-data";
import { loadFunnelReport } from "@/lib/funnel/store";
import { FunnelReportView } from "@/components/app/funnel/funnel-report";

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
        <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5 text-[14px] text-[var(--ink-muted)]">
          Connect a Meta ad account to diagnose your funnel.
        </div>
      </div>
    );
  }

  // Honor the topbar filters (Catalog / Objective / Campaign / Window), the same ones the Cockpit applies, so
  // "Catalog: Excluded" actually hides catalog ads here and the selected date range drives the diagnosis.
  const scope = resolveCockpitScope(await cookies(), 90);
  const bundle = await loadFunnelReport(user.id, {
    catalog: scope.catalog,
    objectives: scope.objectives,
    campaignIds: scope.campaignId ? scope.campaignId.split(",").filter(Boolean) : undefined,
    explicitWindow: scope.explicitWindow,
    lookbackDays: scope.explicitWindow ? undefined : scope.lookbackDays,
  });

  return (
    <div className="space-y-6">
      {header}
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
