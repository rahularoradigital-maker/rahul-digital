import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceRules, DEFAULT_RULES, type AutomationRules } from "./rules.ts";

// Per-account automation-rules store (Phase A2). Service-role reads/writes with an app-level user_id filter
// (the tenancy pattern used by notifications/rollups; the table is RLS default-deny). account = the connected
// Meta ad-account id, or "*" for the account-wide default. Never throws on read - a DB hiccup falls back to
// DEFAULT_RULES so the pipeline degrades safely.

export async function getAccountRules(userId: string, account: string = "*"): Promise<AutomationRules> {
  try {
    const { data } = await createAdminClient()
      .from("account_rules")
      .select("rules")
      .eq("user_id", userId)
      .eq("account_external_id", account)
      .maybeSingle();
    return coerceRules(data?.rules);
  } catch {
    return DEFAULT_RULES;
  }
}

// Merge a partial patch onto the stored rules (so the UI can save one field), coerced at the trust boundary,
// then upsert. Returns the saved, coerced rules.
export async function saveAccountRules(userId: string, account: string, patch: unknown): Promise<AutomationRules> {
  const current = await getAccountRules(userId, account);
  const merged = coerceRules({ ...current, ...((patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>) });
  await createAdminClient()
    .from("account_rules")
    .upsert({ user_id: userId, account_external_id: account, rules: merged, updated_at: new Date().toISOString() }, { onConflict: "user_id,account_external_id" })
    .then(undefined, (e) => console.error("[account_rules] save failed (recoverable)", e));
  return merged;
}
