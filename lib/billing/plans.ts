// Pricing plan config + token weights. PURE (no I/O, no server-only) so the gate can exercise it in plain Node.
// The token weights are the Phase 0 MEASURED cost basis (docs/PRICING-PHASE0-COST-2026-09-01.md), kept here as
// config - NOT hardcoded at the call sites - so re-tuning when the image model price changes is a one-line edit.

export type PlanId = "free" | "starter" | "growth" | "scale";

export const PLANS: Record<PlanId, { tokens: number; imageGen: boolean; label: string }> = {
  free: { tokens: 50, imageGen: false, label: "Free" },
  starter: { tokens: 1500, imageGen: true, label: "Starter" },
  growth: { tokens: 7500, imageGen: true, label: "Growth" },
  scale: { tokens: 25000, imageGen: true, label: "Scale" },
};

export type TokenAction = "analysis" | "chat" | "concept" | "image";

// Weighted by measured cost: analysis ~Rs0.04 -> 1; chat ~Rs0.04 -> 1; concept ~Rs0.83 -> 2; image ~Rs6-11 -> 20
// (20 keeps every paid tier >=83% margin even if a user does nothing but generate images at the priciest model).
export const ACTION_TOKENS: Record<TokenAction, number> = { analysis: 1, chat: 1, concept: 2, image: 20 };

// Actions that produce an AI image. Blocked on plans without imageGen (Free) BEFORE any spend - this is the
// single rule that keeps a free user's cost near zero and the free tier <= Rs100.
export const IMAGE_ACTIONS: ReadonlySet<TokenAction> = new Set<TokenAction>(["image"]);

export function planFor(id: string | null | undefined): PlanId {
  return id && id in PLANS ? (id as PlanId) : "free";
}

export function tokensFor(action: TokenAction): number {
  return ACTION_TOKENS[action];
}

export function isImageAllowed(plan: PlanId): boolean {
  return PLANS[plan].imageGen;
}

// UTC 'YYYY-MM'; a new month is a new key => monthly reset with no cron. Pure so the gate can pin it.
export function periodOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
