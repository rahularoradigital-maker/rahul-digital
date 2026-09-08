import "server-only";
import { fetchLiveCockpit } from "@/lib/meta-sync";
import { routeFor, matchTarget, type ToolName } from "./routing.ts";
import type { Operation } from "./types.ts";

// Stage 4 of the spine: dispatch an interpreted Operation to the right EXISTING tool and normalize its output.
// A3 does NOT execute or generate anything - for budget/pause/diagnose it runs the (already warm) cockpit read
// and returns the real per-ad evidence a proposal/diagnosis is built from; for creative it points at the Studio
// (no image generation here); for a plain question it defers to Ask. The deterministic proposal numbers come in
// A4, human approval in A5 - dispatch only gathers the honest read.

export type DispatchTarget = { id: string; name: string; spendRs: number; revenueRs: number; roas: number | null };
export type DispatchResult = {
  tool: ToolName;
  routeTo: string;
  status: "ready" | "target_not_found" | "not_connected" | "no_op";
  target?: DispatchTarget | null;
  read?: Record<string, unknown>;
  note?: string;
};

export async function dispatch(operation: Operation, userId: string): Promise<DispatchResult> {
  const r = routeFor(operation.kind);

  if (r.tool === "ask") return { tool: r.tool, routeTo: r.routeTo, status: "no_op", note: "Plain question - answered by Ask, no tool run." };
  if (r.tool === "creative") return { tool: r.tool, routeTo: r.routeTo, status: "ready", note: "Prepare this in the Studio. No image is generated here." };

  // cockpit tool: reuse the warm cockpit read (no new heavy fetch, no writes).
  const live = await fetchLiveCockpit(userId, 14);
  if (live.status !== "connected") return { tool: r.tool, routeTo: r.routeTo, status: "not_connected", note: "Connect a Meta ad account to read this." };
  const v = live.view;
  const rows = (v.leaderboard ?? []).map((a) => ({
    id: String(a.id),
    name: String(a.name),
    adsetName: a.adsetName ?? null,
    campaignName: a.campaignName ?? null,
    spendRs: a.spendRs,
    revenueRs: a.revenueRs,
    roas: a.roas ?? null,
    verdict: a.verdict,
    action: a.action,
    why: a.why,
  }));

  if (r.needsTarget) {
    const query = operation.slots.target ?? operation.slots.scope ?? "";
    const hit = matchTarget(rows, query);
    if (!hit) {
      return { tool: r.tool, routeTo: r.routeTo, status: "target_not_found", note: `I could not find "${query}" among your analysed ads. Name the exact ad, ad set, or campaign.` };
    }
    return {
      tool: r.tool,
      routeTo: r.routeTo,
      status: "ready",
      target: { id: hit.id, name: hit.name, spendRs: hit.spendRs, revenueRs: hit.revenueRs, roas: hit.roas },
      read: { verdict: hit.verdict, action: hit.action, why: hit.why },
      note: "Real read of the named target - the evidence a proposal or diagnosis is built from.",
    };
  }

  // Account-level diagnose: return account health + the top do-this items (all real, from the cockpit).
  return {
    tool: r.tool,
    routeTo: r.routeTo,
    status: "ready",
    read: {
      accountHealth: v.accountHealth,
      topActions: (v.doThis ?? []).slice(0, 5).map((a) => ({ ad: a.adName, action: a.label, why: a.why })),
    },
    note: "Account-level read from the cockpit.",
  };
}
