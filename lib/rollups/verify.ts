import "server-only";
import type { TokenSet } from "@/lib/ad-source";
import { loadAccountRollup } from "@/lib/rollups/account";
import { reconHeadlines, summaryStatus, ROLLUP_WINDOW_DAYS } from "@/lib/rollups/pure";
import { recordVerification } from "@/lib/rollups/verification";
import { fetchScopeInsights } from "@/lib/meta-source";
import { captureError } from "@/lib/observability";
import type { ReconSummary } from "@/lib/intelligence/reconcile";

// Self-proving accuracy (10x #1), shared by the on-demand endpoint AND the automatic post-sync check. Diffs
// the stored rollup (our store) vs a FRESH live Meta pull, records the verdict (append-only trend), and
// returns it. Fails HONEST: no rollup or Meta unreachable -> a typed reason, never a fabricated "match".

export type VerifyOutcome =
  | { ok: true; status: string; trustworthy: boolean; summary: ReconSummary; store: { spend: number; revenue: number }; meta: { spend: number; revenue: number }; window: { since: string; until: string }; notes: string[] }
  | { ok: false; reason: "no_rollup" | "meta_unreachable" };

export async function verifyAndLog(userId: string, account: string, token: TokenSet, windowDays: number = ROLLUP_WINDOW_DAYS): Promise<VerifyOutcome> {
  const rollup = await loadAccountRollup(userId, account, windowDays);
  if (!rollup) return { ok: false, reason: "no_rollup" };

  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
  let live: { spend: number; revenue: number };
  try {
    const insights = await fetchScopeInsights(account, since, token, undefined, until);
    live = { spend: insights.spend, revenue: insights.revenue };
  } catch (e) {
    captureError(e, { fn: "verifyAndLog", account });
    return { ok: false, reason: "meta_unreachable" };
  }

  const { recs, summary } = reconHeadlines({ spend: rollup.spend, revenue: rollup.revenue }, live, "store", "meta");
  const status = summaryStatus(summary);
  await recordVerification(userId, account, {
    windowDays,
    spendStore: rollup.spend,
    spendMeta: live.spend,
    revenueStore: rollup.revenue,
    revenueMeta: live.revenue,
    worstDriftPct: summary.worstDriftPct,
    status,
    trustworthy: summary.trustworthy,
  });
  return { ok: true, status, trustworthy: summary.trustworthy, summary, store: { spend: rollup.spend, revenue: rollup.revenue }, meta: live, window: { since, until }, notes: recs.map((r) => r.note) };
}
