import { encryptToken, decryptToken } from "./crypto.ts";

// Runtime-managed provider keys. The owner sets/rotates these in the admin console; they are stored AES-GCM
// encrypted (lib/crypto, master key in env) and resolved at runtime so a change takes effect without a
// redeploy. DB value OVERRIDES env (so the admin can override), else falls back to env. Node-safe (crypto is
// node-safe; the admin client is imported lazily) so this can sit in the AI router's import graph.
//
// SECURITY BOUNDARY: only swappable PROVIDER keys are managed here. Bootstrap secrets (Supabase keys, the
// encryption key itself, Meta app secret, CRON secret) MUST stay in env - the enc key can't encrypt itself,
// and those protect everything else. isManagedKey enforces this allowlist server-side.

export const MANAGEABLE_KEYS = ["GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "SCRAPECREATORS_API_KEY", "ALERT_WEBHOOK_URL"] as const;
export type ManagedKey = (typeof MANAGEABLE_KEYS)[number];
export function isManagedKey(name: string): name is ManagedKey {
  return (MANAGEABLE_KEYS as readonly string[]).includes(name);
}

const cache = new Map<string, { at: number; value: string }>();
const TTL_MS = 60_000;

// Resolve a key value: cached; DB (encrypted) wins over env; env is the fallback. Never throws.
export async function resolveKey(name: string): Promise<string> {
  const c = cache.get(name);
  if (c && Date.now() - c.at < TTL_MS) return c.value;
  let value = process.env[name] ?? "";
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createAdminClient().from("provider_keys").select("encrypted_value").eq("name", name).maybeSingle();
    if (data?.encrypted_value) value = decryptToken((data as { encrypted_value: string }).encrypted_value);
  } catch {
    /* DB unavailable -> use env */
  }
  cache.set(name, { at: Date.now(), value });
  return value;
}

// Set/rotate a managed key (encrypt + upsert; keep last4 for display only). Server usage only.
export async function setKey(name: string, value: string, updatedBy: string | null): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient()
    .from("provider_keys")
    .upsert({ name, encrypted_value: encryptToken(value), last4: value.length >= 4 ? value.slice(-4) : "", updated_at: new Date().toISOString(), updated_by: updatedBy }, { onConflict: "name" });
  cache.delete(name);
}

// Remove a managed key (revert to env, if any).
export async function deleteKey(name: string): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().from("provider_keys").delete().eq("name", name);
  cache.delete(name);
}

const KEY_LABELS: Record<ManagedKey, string> = {
  GEMINI_API_KEY: "Gemini (AI)",
  OPENAI_API_KEY: "OpenAI",
  ANTHROPIC_API_KEY: "Anthropic",
  SCRAPECREATORS_API_KEY: "ScrapeCreators (competitors)",
  ALERT_WEBHOOK_URL: "Alerts webhook",
};

export type KeyStatus = { name: string; label: string; source: "db" | "env" | "none"; last4: string | null; updatedAt: string | null };

// Status for the admin UI: which keys are set + from where + last4. The raw value is NEVER returned.
export async function keyStatus(): Promise<KeyStatus[]> {
  const dbRows = new Map<string, { last4: string | null; updated_at: string }>();
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createAdminClient().from("provider_keys").select("name, last4, updated_at");
    for (const r of (data ?? []) as { name: string; last4: string | null; updated_at: string }[]) dbRows.set(r.name, { last4: r.last4, updated_at: r.updated_at });
  } catch {
    /* empty */
  }
  return MANAGEABLE_KEYS.map((name): KeyStatus => {
    const label = KEY_LABELS[name];
    const db = dbRows.get(name);
    if (db) return { name, label, source: "db", last4: db.last4, updatedAt: db.updated_at };
    const env = process.env[name];
    if (env) return { name, label, source: "env", last4: env.slice(-4), updatedAt: null };
    return { name, label, source: "none", last4: null, updatedAt: null };
  });
}
