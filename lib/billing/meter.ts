import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, IMAGE_ACTIONS, planFor, tokensFor, periodOf, type PlanId, type TokenAction } from "./plans";

// Product token meter (pricing Phase 2). Enforcement = spendTokens BEFORE the AI runs; the atomic cap lives in
// the spend_tokens() DB function (migration 0024) so concurrent requests can't both slip past the allowance.
// Fail behavior is deliberate: the imageGen/plan check fails CLOSED (default free -> images blocked) because
// that is the real cost guard; the over-cap RPC fails OPEN on a DB error, because a metering hiccup must not
// break a paying user's product for the sake of one uncounted (near-zero-cost) action.

export type SpendResult =
  | { ok: true; used: number; allowance: number; remaining: number }
  | { ok: false; reason: "image_not_in_plan" | "over_cap"; used: number; allowance: number; remaining: number };

async function planId(userId: string): Promise<PlanId> {
  try {
    const { data } = await createAdminClient().from("profiles").select("plan").eq("id", userId).maybeSingle();
    return planFor(data?.plan as string | null | undefined);
  } catch {
    return "free"; // fail closed to the cheapest, image-blocked plan
  }
}

async function usedThisPeriod(userId: string): Promise<number> {
  try {
    const { data } = await createAdminClient()
      .from("token_usage")
      .select("tokens_used")
      .eq("user_id", userId)
      .eq("period", periodOf(new Date()))
      .maybeSingle();
    return Number(data?.tokens_used ?? 0);
  } catch {
    return 0;
  }
}

export async function spendTokens(userId: string, action: TokenAction): Promise<SpendResult> {
  const plan = await planId(userId);
  const allowance = PLANS[plan].tokens;

  // Free (no imageGen) can never generate an image - checked before any spend, fails closed.
  if (IMAGE_ACTIONS.has(action) && !PLANS[plan].imageGen) {
    const used = await usedThisPeriod(userId);
    return { ok: false, reason: "image_not_in_plan", used, allowance, remaining: Math.max(0, allowance - used) };
  }

  const weight = tokensFor(action);
  const period = periodOf(new Date());
  try {
    const { data, error } = await createAdminClient().rpc("spend_tokens", {
      p_user: userId,
      p_period: period,
      p_weight: weight,
      p_allowance: allowance,
    });
    if (error) throw error;
    const used = data as number | null;
    if (used == null) {
      // Over cap: reject. Report the allowance as used so the meter reads full.
      return { ok: false, reason: "over_cap", used: allowance, allowance, remaining: 0 };
    }
    return { ok: true, used, allowance, remaining: Math.max(0, allowance - used) };
  } catch (e) {
    // Fail OPEN on a metering DB error (rare): allow the action, but do not fabricate a usage number.
    console.error("[meter] spend_tokens RPC failed (allowing, uncounted)", e instanceof Error ? e.message : e);
    const used = await usedThisPeriod(userId);
    return { ok: true, used, allowance, remaining: Math.max(0, allowance - used) };
  }
}

// Read-only meter for the usage bar. Never throws (fails to a zero-usage free view).
export async function getUsage(userId: string): Promise<{
  plan: PlanId;
  planLabel: string;
  used: number;
  allowance: number;
  remaining: number;
  pct: number;
  imageGen: boolean;
}> {
  const plan = await planId(userId);
  const used = await usedThisPeriod(userId);
  const allowance = PLANS[plan].tokens;
  return {
    plan,
    planLabel: PLANS[plan].label,
    used,
    allowance,
    remaining: Math.max(0, allowance - used),
    pct: allowance ? Math.min(100, Math.round((used / allowance) * 100)) : 0,
    imageGen: PLANS[plan].imageGen,
  };
}
