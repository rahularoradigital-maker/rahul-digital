import "server-only";
import { runTaskText } from "@/lib/ai/router";
import { compose } from "@/lib/ai/compose";
import { KNOWN_KINDS, normalizeOperation, type RawInterpretation } from "./contract.ts";
import type { Operation, OperationSource } from "./types.ts";

// Stage 2 of the spine: turn an intent (an Ask question, a brief, an operation) into a TYPED Operation.
// The model ONLY classifies the request and copies the user's own words into slots as hints - it is told, in
// as many words, never to compute or decide a budget number or threshold. The deterministic contract
// (normalizeOperation) then enforces the shape. The request is fenced as untrusted (compose) so it cannot
// inject instructions. Runs through the central router (budgets + kill-switch already apply). No execution.

const SYSTEM =
  "You are AdScale's intent INTERPRETER. Read the user's request and classify it into EXACTLY ONE operation " +
  `kind from this list: ${KNOWN_KINDS.join(", ")}. ` +
  "Then extract slots you can find: scope (account, or the ad/ad set/campaign named), target (the object " +
  "acted on), direction (increase | decrease | pause | resume), magnitudeHint (the user's RAW phrase such as " +
  '"20%" or "double"), objective, note. ' +
  "HARD RULES: do NOT compute, decide, estimate, or invent any budget number, percentage, or threshold - " +
  "magnitudeHint is only the user's literal words, never a value you chose. If the request is a question, use " +
  'kind "answer". If it names an action but is missing what that action needs, still return the kind and leave ' +
  "the slot out (do not guess). Provide a short clarify question only when something is genuinely missing. " +
  "Respond with ONLY minified JSON: {kind, slots, toolHint, clarify, evidence}. No markdown, no prose.";

// Robust JSON parse (mirrors lib/creative-production/intelligence/llm-json.ts): tolerate a stray code fence
// or leading prose, else pull the first {...} block; null on total failure so the caller degrades cleanly.
function parseJson(out: string | null): RawInterpretation | null {
  if (!out) return null;
  const cleaned = out.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as RawInterpretation;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as RawInterpretation;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Interpret a raw request into a typed Operation. `context` is an optional compact account snapshot (already
 * safe/real) that helps the model resolve a named target; it is fenced as untrusted like the request.
 * Never executes anything. On a null/failed model reply, returns a needs_clarification "answer" Operation.
 */
export async function interpretIntent(intentText: string, source: OperationSource, context?: string): Promise<Operation> {
  const clean = String(intentText ?? "").trim().slice(0, 500);
  if (!clean) return normalizeOperation({ kind: "answer" }, source, "");
  const segments = [{ label: "user_request", content: clean }];
  if (context) segments.push({ label: "account_context", content: context });
  const out = await runTaskText("interpret-intent", compose(SYSTEM, segments));
  return normalizeOperation(parseJson(out), source, clean);
}
