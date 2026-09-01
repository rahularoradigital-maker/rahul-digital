// AI daily-cost guardrail (control-plane P0-3). If today's AI spend exceeds AI_DAILY_COST_BUDGET (USD), the
// router pauses AI (returns null, which every caller already degrades gracefully) - a hard ceiling against
// runaway cost. Unset = a sane DEFAULT cap (resolveDailyBudget); set "0"/"none" to disable. The check is
// CACHED (~60s) so it adds no per-call latency, and FAIL-OPEN:
// a DB hiccup must never halt the whole app. Node-safe (admin imported lazily) so the router graph still
// loads in the check:ai gate.
// ponytail: sums today's ai_usage rows in JS - trivial at current volume; swap for a SQL sum RPC at scale.

// Pure threshold (testable): over budget only when a positive budget is set and total exceeds it.
export function overBudget(totalUsd: number, budgetUsd: number): boolean {
  return budgetUsd > 0 && totalUsd > budgetUsd;
}

// Security: there must ALWAYS be a daily AI-spend ceiling unless it is explicitly disabled. When
// AI_DAILY_COST_BUDGET is unset we fall back to this sane default (generous for the current flash-lite +
// fingerprint-once volume, so it never trips in normal use, but caps a runaway). Set the env to "0"/"none"
// to disable, or to any USD number to override.
const DEFAULT_DAILY_USD = 25;
export function resolveDailyBudget(raw: string | undefined): number {
  if (raw === "0" || raw?.trim().toLowerCase() === "none") return 0; // explicitly disabled
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_USD;
}

let cache: { at: number; exceeded: boolean } | null = null;
const TTL_MS = 60_000;

export async function aiBudgetExceeded(): Promise<boolean> {
  const budget = resolveDailyBudget(process.env.AI_DAILY_COST_BUDGET);
  if (!(budget > 0)) return false; // explicitly disabled ("0"/"none")
  if (cache && Date.now() - cache.at < TTL_MS) return cache.exceeded;

  let exceeded = false;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { data } = await createAdminClient().from("ai_usage").select("cost_usd").gte("created_at", start.toISOString());
    const total = (data ?? []).reduce((s, r) => s + Number((r as { cost_usd: number }).cost_usd || 0), 0);
    exceeded = overBudget(total, budget);
  } catch {
    exceeded = false; // fail-open
  }
  cache = { at: Date.now(), exceeded };
  return exceeded;
}
