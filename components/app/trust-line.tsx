import { loadVerificationHistory } from "@/lib/rollups/verification";

// "Verified against Meta" line for the reconcile screen (10x #1 self-proving accuracy, user-facing surface).
// Reads the latest LOGGED store-vs-Meta verification (one indexed row, NO live Meta call - the on-demand
// /api/account/verify and the automatic post-sync check both write these), and states plainly whether our
// headline matches Meta. Renders nothing until a first verification exists, or on any read failure - never
// blocks, never fabricates a "verified" it hasn't actually checked.
export async function TrustLine({ userId, accountExternalId }: { userId: string; accountExternalId: string | null }) {
  if (!accountExternalId) return null;
  let last;
  try {
    [last] = await loadVerificationHistory(userId, accountExternalId, 1);
  } catch {
    return null;
  }
  if (!last) return null;

  const pct = Math.round(last.worstDriftPct * 100);
  const when = relativeDay(last.createdAt);

  if (!last.trustworthy) {
    return (
      <p className="mt-1 text-[12px] text-[var(--warn-ink,#92400e)]">
        These numbers differ from Meta by {pct}% (last checked {when}). We show the stored figure; a re-sync refreshes it.
      </p>
    );
  }
  return (
    <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
      Verified against Meta{pct > 0 ? ` — within ${pct}%` : ""} (checked {when}).
    </p>
  );
}

function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return "just now";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
