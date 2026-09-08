// Deterministic operation validation (Track A, Phase A4). PURE, no I/O, no server-only, RELATIVE imports so the
// runnable check loads it in plain node. THIS is "the less AI, the better": the interpreter only carried the
// user's raw phrase ("20%") as a hint; here deterministic code parses it, checks it against the account rules
// and the real read, and COMPUTES the safe proposal number. The AI never decides the figure. Nothing executes.
import type { AutomationRules } from "./rules.ts";
import type { Operation } from "./types.ts";

// The real read the validator judges against (from the A3 dispatch): the target's actual ROAS + verdict + the
// names needed to test protected-campaign rules.
export type ValidationRead = {
  roas?: number | null;
  verdict?: string;
  name?: string;
  campaignName?: string | null;
  adsetName?: string | null;
};

export type ValidationResult = {
  status: "validated" | "blocked" | "not_applicable"; // validated may still carry adjustment notes (e.g. capped)
  violations: string[]; // plain-English reasons: hard blocks AND soft adjustments the user should see
  computed?: Record<string, unknown>; // the DETERMINISTIC proposal (never an AI-chosen number)
};

// Parse the user's raw magnitude phrase into a percent, deterministically. Words map to fixed values; a bare
// number is taken as given. Unparseable -> null (we then refuse to invent a number).
export function parsePercent(hint: string | undefined | null): number | null {
  const s = String(hint ?? "").toLowerCase().trim();
  if (!s) return null;
  if (/\bdouble\b/.test(s)) return 100;
  if (/\btriple\b/.test(s)) return 200;
  if (/\b(half|halve)\b/.test(s)) return 50;
  const m = s.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (m) {
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Validate an interpreted operation against the account rules (the relevant slice from A2) and the real read
 * (from A3). Only the action kinds have parameters to validate; reads (diagnose/answer/creative) are
 * not_applicable. The computed proposal number is derived here by code, never taken from the model.
 */
export function validateOperation(operation: Operation, rules: Partial<AutomationRules>, read: ValidationRead): ValidationResult {
  if (operation.kind === "propose_budget_change") {
    const dir = operation.slots.direction; // increase | decrease | ...
    const requested = parsePercent(operation.slots.magnitudeHint);
    // FLOOR ROAS: never scale a target UP that is below the do-not-scale-below floor. A hard block.
    if (dir === "increase" && rules.minRoas != null && read.roas != null && read.roas < rules.minRoas) {
      return { status: "blocked", violations: [`Target ROAS ${read.roas.toFixed(2)} is below your floor of ${rules.minRoas}. Not scaling it up.`], computed: { direction: dir, requestedPct: requested } };
    }
    // No number given, and we never invent one.
    if (requested == null) {
      return { status: "blocked", violations: ["No amount given. Say how much to change the budget (for example 20%)."] };
    }
    const violations: string[] = [];
    const cap = rules.maxBudgetStepPct ?? null;
    let applied = requested;
    let capped = false;
    if (cap != null && requested > cap) {
      applied = cap;
      capped = true;
      violations.push(`Requested ${requested}% exceeds your max budget step of ${cap}%. Capped to ${cap}%.`);
    } else if (cap == null) {
      violations.push("No max budget-step rule set. Using the requested amount. Set a cap in Settings to bound future changes.");
    }
    return { status: "validated", violations, computed: { direction: dir, requestedPct: requested, appliedPct: applied, capped } };
  }

  if (operation.kind === "propose_pause") {
    const protectedList = rules.protectedCampaigns ?? [];
    const hay = `${read.name ?? ""} ${read.campaignName ?? ""} ${read.adsetName ?? ""}`.toLowerCase();
    const hit = protectedList.find((p) => p.trim() && hay.includes(p.toLowerCase()));
    if (hit) {
      return { status: "blocked", violations: [`"${hit}" is a protected campaign. Not proposing a pause.`], computed: { action: "pause", target: read.name ?? null } };
    }
    return { status: "validated", violations: [], computed: { action: "pause", target: read.name ?? null } };
  }

  // diagnose / answer / creative briefs: nothing to validate at the parameter level.
  return { status: "not_applicable", violations: [] };
}
