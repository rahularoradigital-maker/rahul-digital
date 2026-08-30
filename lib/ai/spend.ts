import { currentAiUserId, currentAiTask } from "./context.ts";
import { costUsd } from "./token-pricing.ts";

// Record one AI provider call's token usage + USD cost into ai_usage, attributed to the current request's
// user + task (from AsyncLocalStorage). Fire-and-forget: recording spend must NEVER block or fail an AI
// response. Called by each provider adapter after a successful call.
// NOTE: not "server-only", and the admin client is imported LAZILY inside the async body - the adapters sit
// in the router's import graph which the check:ai gate loads in plain Node, so a top-level server-only import
// (admin) would break the gate. The dynamic import only runs server-side at call time.
export function recordSpend(input: { provider: string; model: string; promptTokens: number; completionTokens: number }): void {
  const prompt = Math.max(0, Math.trunc(input.promptTokens || 0));
  const completion = Math.max(0, Math.trunc(input.completionTokens || 0));
  const row = {
    user_id: currentAiUserId(),
    task: currentAiTask(),
    provider: input.provider,
    model: input.model,
    prompt_tokens: prompt,
    completion_tokens: completion,
    cost_usd: costUsd(input.model, prompt, completion),
  };
  void (async () => {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      await createAdminClient().from("ai_usage").insert(row);
    } catch (e) {
      console.error("[ai_usage] insert failed (recoverable)", e instanceof Error ? e.message : e);
    }
  })();
}
