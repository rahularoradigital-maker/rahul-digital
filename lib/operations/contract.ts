// PURE operation contract (Track A, Phase A1). No I/O, no server-only, RELATIVE imports so the runnable
// check (scripts/check-operation-contract.ts) loads it in plain node. This is the DETERMINISTIC half of
// interpretation: the AI proposes a raw classification, and normalizeOperation() enforces the contract -
// a known kind, the slots that kind requires, sanitized hint-only fields, and NO authoritative number ever
// carried from the model. The AI decides WHAT; this code guarantees the shape is correct.
import type { Operation, OperationKind, OperationSlots, OperationSource } from "./types.ts";

export const KNOWN_KINDS: OperationKind[] = [
  "propose_budget_change",
  "propose_pause",
  "brief_new_campaign",
  "launch_creative",
  "diagnose",
  "answer",
];

const DIRECTIONS = new Set(["increase", "decrease", "pause", "resume"]);

// The slots each kind REQUIRES before it can move past interpretation. Missing any -> needs_clarification,
// so the system asks ONE question instead of guessing (matches "do not guess" in the spec).
const REQUIRED: Record<OperationKind, (keyof OperationSlots)[]> = {
  propose_budget_change: ["target", "direction"],
  propose_pause: ["target"],
  brief_new_campaign: ["objective"],
  launch_creative: ["target"],
  diagnose: [], // defaults to the whole account
  answer: [], // plain Q&A never needs slots
};

// The one clarifying question to ask when an action kind is missing what it needs. Specific, not generic.
function clarifyFor(kind: OperationKind, missing: (keyof OperationSlots)[]): string {
  if (kind === "propose_budget_change") {
    if (missing.includes("target") && missing.includes("direction")) return "Which ad, ad set, or campaign, and do you want to raise or lower its budget?";
    if (missing.includes("target")) return "Which ad, ad set, or campaign should the budget change apply to?";
    return "Do you want to raise or lower the budget?";
  }
  if (kind === "propose_pause") return "Which ad, ad set, or campaign should I propose pausing?";
  if (kind === "brief_new_campaign") return "What is the campaign objective (for example prospecting, retargeting, or sales)?";
  if (kind === "launch_creative") return "Which product or concept should the ad be for?";
  return "Could you rephrase that as a clear action or a question about your account?";
}

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
};

export type RawInterpretation = {
  kind?: string;
  slots?: Record<string, unknown>;
  toolHint?: string;
  clarify?: string;
  evidence?: unknown;
};

// Keep ONLY the allow-listed hint fields, sanitized. Crucially there is NO numeric field: a model that tries
// to set an authoritative budget/threshold cannot smuggle it through - magnitudeHint keeps just the raw
// phrase as a string, and the real number is computed deterministically later (A4).
function cleanSlots(raw: Record<string, unknown> | undefined): OperationSlots {
  const s = raw ?? {};
  const dir = str(s.direction, 16)?.toLowerCase();
  return {
    scope: str(s.scope, 120),
    target: str(s.target, 120),
    direction: dir && DIRECTIONS.has(dir) ? (dir as OperationSlots["direction"]) : null,
    magnitudeHint: str(s.magnitudeHint, 40),
    objective: str(s.objective, 80),
    note: str(s.note, 300),
  };
}

/**
 * Turn the model's raw classification into a contract-valid Operation, deterministically.
 *  - unknown/empty kind -> needs_clarification (never a guessed action).
 *  - a known action kind missing its required slots -> needs_clarification + one specific question.
 *  - otherwise -> draft, with sanitized hint-only slots.
 * `intentText` is the sanitized original request, always preserved for the audit trail.
 */
export function normalizeOperation(raw: RawInterpretation | null, source: OperationSource, intentText: string): Operation {
  const base = {
    source,
    intentText: intentText.slice(0, 500),
    evidence: Array.isArray(raw?.evidence) ? raw!.evidence.filter((e): e is string => typeof e === "string").slice(0, 8) : [],
  };
  const kind = raw?.kind && (KNOWN_KINDS as string[]).includes(raw.kind) ? (raw.kind as OperationKind) : null;
  if (!kind) {
    return { ...base, kind: "answer", status: "needs_clarification", slots: {}, clarify: clarifyFor("answer", []) };
  }
  const slots = cleanSlots(raw?.slots);
  const missing = REQUIRED[kind].filter((k) => slots[k] === undefined || slots[k] === null);
  const toolHint = str(raw?.toolHint, 40);
  if (missing.length > 0) {
    return { ...base, kind, status: "needs_clarification", slots, toolHint, clarify: str(raw?.clarify, 200) ?? clarifyFor(kind, missing) };
  }
  return { ...base, kind, status: "draft", slots, toolHint };
}
