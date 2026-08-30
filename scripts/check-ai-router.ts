// Verifies the AI model router (docs/plans/ai-model-routing.md): every task is routed to a model with
// a fallback, heavy tasks default to a strong model (not gemini-lite), and each provider whose key is
// present answers a tiny live call. Run live with: node --experimental-strip-types --env-file=.env.local
// scripts/check-ai-router.ts  (in CI without keys it does static checks only).

import { ROUTES } from "../lib/ai/config.ts";
import type { TaskKind } from "../lib/ai/tasks.ts";
import { anthropic } from "../lib/ai/providers/anthropic.ts";
import { openai } from "../lib/ai/providers/openai.ts";
import { gemini } from "../lib/ai/providers/gemini.ts";
import { runTaskText } from "../lib/ai/router.ts";

let fail = 0;
function ok(cond: boolean, msg: string): void {
  console.log(cond ? "  ok   " : "  FAIL ", msg);
  if (!cond) fail++;
}

const KINDS: TaskKind[] = ["ask", "analyze-text", "positioning", "concept-gen", "creative-vision", "brand-profile", "decision-verdict"];
const PROVIDERS = new Set(["gemini", "openai", "anthropic"]);

console.log("Static routing config:");
for (const k of KINDS) {
  const r = ROUTES[k];
  ok(!!r, `route exists: ${k}`);
  if (!r) continue;
  ok(PROVIDERS.has(r.primary.provider) && !!r.primary.model, `${k}: valid primary (${r.primary.provider}/${r.primary.model})`);
  ok(r.fallbacks.length >= 1, `${k}: has >=1 fallback (${r.fallbacks.length})`);
  ok(r.kind === "text" || r.kind === "json", `${k}: valid mode ${r.kind}`);
}
ok(ROUTES["concept-gen"].primary.provider !== "gemini" || !!process.env.AI_PROVIDER_CONCEPT_GEN, "concept-gen primary is a heavy (non-gemini-lite) model by default");
ok(ROUTES["decision-verdict"].primary.provider !== "gemini" || !!process.env.AI_PROVIDER_DECISION_VERDICT, "decision-verdict primary is a heavy model by default");

console.log("\nLive provider smoke (skips a provider when its key is absent):");
async function smoke(name: string, present: boolean, fn: () => Promise<string | null>): Promise<void> {
  if (!present) {
    console.log("  skip  ", `${name} (no key in env)`);
    return;
  }
  const out = await fn();
  ok(typeof out === "string" && out.length > 0, `${name} answered live: "${(out ?? "").slice(0, 40).replace(/\s+/g, " ")}"`);
}
await smoke("anthropic", !!process.env.ANTHROPIC_API_KEY, () => anthropic.text(process.env.AI_MODEL_CLAUDE_LIGHT || "claude-haiku-4-5-20251001", "Reply with only the word ok."));
await smoke("openai", !!process.env.OPENAI_API_KEY, () => openai.text(process.env.AI_MODEL_OPENAI_LIGHT || "gpt-4o-mini", "Reply with only the word ok."));
await smoke("gemini", !!process.env.GEMINI_API_KEY, () => gemini.text("", "Reply with only the word ok."));
await smoke(
  "router runTaskText(ask) end-to-end + fallback",
  !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
  () => runTaskText("ask", "Reply with only the word ok."),
);

console.log(fail === 0 ? "\nAI-ROUTER GREEN" : `\nAI-ROUTER RED (${fail} failure(s))`);
process.exit(fail === 0 ? 0 : 1);
