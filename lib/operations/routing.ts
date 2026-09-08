// Dispatcher routing, PURE half (Track A, Phase A3). No I/O, no server-only, RELATIVE imports so the runnable
// check loads it in plain node. routeFor() maps an operation kind to the EXISTING purpose-built tool it should
// use; matchTarget() resolves the object the user named (an ad / ad set / campaign) against the account's real
// rows. Deterministic - the tool choice and the target match are not an AI guess.
import type { OperationKind } from "./types.ts";

// A3 wires the tools the current kinds need: the cockpit read (health + per-ad verdict/why - the evidence a
// budget/pause proposal or a diagnosis is built from), the Studio (creative), and Ask (plain Q&A). Funnel /
// change-intelligence / judgment are additional cockpit-adjacent tools to route here as those kinds get first-
// class operations; they are reachable from the same cockpit read today.
export type ToolName = "cockpit" | "creative" | "ask";

export type Route = { tool: ToolName; routeTo: string; needsTarget: boolean };

const ROUTES: Record<OperationKind, Route> = {
  propose_budget_change: { tool: "cockpit", routeTo: "/app", needsTarget: true },
  propose_pause: { tool: "cockpit", routeTo: "/app", needsTarget: true },
  diagnose: { tool: "cockpit", routeTo: "/app/funnel", needsTarget: false },
  brief_new_campaign: { tool: "creative", routeTo: "/app/creative-production", needsTarget: false },
  launch_creative: { tool: "creative", routeTo: "/app/creative-production", needsTarget: false },
  answer: { tool: "ask", routeTo: "ask", needsTarget: false },
};

export function routeFor(kind: OperationKind): Route {
  return ROUTES[kind] ?? { tool: "ask", routeTo: "ask", needsTarget: false };
}

type Named = { id: string; name: string; adsetName?: string | null; campaignName?: string | null };

// Resolve the user's named target against real account rows: exact id, then exact name, then a case-insensitive
// substring on name / ad set / campaign. Returns the FULL row (generic) so the caller keeps its metrics. Null
// when nothing matches - the dispatcher then says so honestly instead of acting on the wrong object.
export function matchTarget<T extends Named>(rows: T[], query: string | undefined | null): T | null {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return null;
  const byId = rows.find((r) => r.id.toLowerCase() === q);
  if (byId) return byId;
  const byName = rows.find((r) => r.name.toLowerCase() === q);
  if (byName) return byName;
  return (
    rows.find((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.adsetName ?? "").toLowerCase().includes(q) ||
      (r.campaignName ?? "").toLowerCase().includes(q),
    ) ?? null
  );
}
