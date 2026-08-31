import { getCurrentUser } from "@/lib/app/user";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadReconcile } from "@/lib/reconcile/store";
import { ReconcileView } from "@/components/app/reconcile/reconcile-view";

// Reconcile page: lines up AdBrain's whole-account numbers against the filtered scopes a Meta view uses, so
// any "your numbers differ from Meta" question is answerable at a glance. Server-rendered from the store.
export const maxDuration = 60;

export default async function ReconcilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const header = (
    <div>
      <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">Reconcile with Meta</h1>
      <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
        AdBrain reports the whole account; a filtered Meta view (active delivery + results) shows a subset. Here is the same data
        under each scope, so the difference in spend and ROAS is explainable rather than a surprise.
      </p>
    </div>
  );

  const session = await getUserMetaSession(user.id);
  if (!session) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5 text-[14px] text-[var(--ink-muted)]">Connect a Meta ad account to reconcile.</div>
      </div>
    );
  }

  const bundle = await loadReconcile(user.id);
  return (
    <div className="space-y-6">
      {header}
      {bundle ? (
        <ReconcileView report={bundle.report} accountName={bundle.accountName} since={bundle.since} until={bundle.until} />
      ) : (
        <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5 text-[14px] text-[var(--ink-muted)]">
          This brand hasn&apos;t synced yet. It syncs automatically in the background - check back shortly and the reconciliation will appear here.
        </div>
      )}
    </div>
  );
}
