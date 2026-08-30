// Kill switches + feature flags. Two layers, precedence deliberate:
//   1. ENV VAR (process.env) - the GUARANTEED brake. `KILL_AI=1` halts AI even if the DB is down or absent.
//      Ops can always stop the system with an env var, no table required. This wins over everything.
//   2. system_flags table (0016) - the no-redeploy runtime layer, read via the service-role client and
//      cached briefly so it never adds latency to a hot path. Best-effort: if it can't be read, we fall back
//      to the safe default (kills default OFF = keep running; features default to their code default).
//
// The precedence + parsing is a PURE function (decideKill / decideFeature) so it is unit-testable with no DB
// (scripts/check-flags.ts). The async wrappers add the cached DB read. Admin client is imported lazily so
// this module never pulls server-only code into a client bundle.

export type KillKey = "ai" | "meta_sync" | "creative_studio" | "competitor_market" | (string & {});
export type FeatureKey = "influencer_hunt" | "judgment_cards" | (string & {});

export class KillSwitchError extends Error {
  key: string;
  constructor(key: string) {
    super(`Feature '${key}' is halted by a kill switch`);
    this.name = "KillSwitchError";
    this.key = key;
  }
}

// ---- PURE precedence core (testable) --------------------------------------
// A kill switch is ON (halted) if the env var is truthy OR the DB row says enabled. Env truthy wins outright.
export function decideKill(envValue: string | undefined, dbEnabled: boolean | null): boolean {
  if (isTruthy(envValue)) return true;
  return dbEnabled === true;
}
// A feature is ON if: env explicitly sets it (1/0 wins), else the DB row, else the code default.
export function decideFeature(envValue: string | undefined, dbEnabled: boolean | null, codeDefault: boolean): boolean {
  if (envValue !== undefined && envValue !== "") return isTruthy(envValue);
  if (dbEnabled !== null) return dbEnabled;
  return codeDefault;
}
function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}
export function killEnvName(key: string): string {
  return `KILL_${key.toUpperCase()}`;
}
export function featureEnvName(key: string): string {
  return `FEATURE_${key.toUpperCase()}`;
}

// ---- Cached DB layer ------------------------------------------------------
type FlagRow = { enabled: boolean };
let cache: { at: number; rows: Map<string, boolean> } | null = null;
const TTL_MS = 30_000;

async function dbFlags(): Promise<Map<string, boolean>> {
  const now = cacheNow();
  if (cache && now - cache.at < TTL_MS) return cache.rows;
  const rows = new Map<string, boolean>();
  try {
    const { createAdminClient } = await import("../supabase/admin.ts");
    const admin = createAdminClient();
    const { data } = await admin.from("system_flags").select("key, enabled");
    for (const r of (data ?? []) as ({ key: string } & FlagRow)[]) rows.set(r.key, r.enabled);
  } catch {
    // table missing / DB down -> empty map -> safe defaults. Env var is still the guaranteed brake.
  }
  cache = { at: now, rows };
  return rows;
}
// Date.now indirection kept in one spot so the cache is easy to reason about (and would be mockable).
function cacheNow(): number {
  return Date.now();
}

/** Invalidate the cache immediately after a flag is flipped, so the change takes effect at once. */
export function clearFlagCache(): void {
  cache = null;
}

// ---- Public API -----------------------------------------------------------
/** Is this feature HALTED by a kill switch? Env var wins; else the cached DB flag; else false (running). */
export async function isKilled(key: KillKey): Promise<boolean> {
  const rows = await dbFlags();
  return decideKill(process.env[killEnvName(key)], rows.has(key) ? rows.get(key)! : null);
}

/** Throw KillSwitchError if halted. Use at the top of a dangerous/expensive path. */
export async function assertNotKilled(key: KillKey): Promise<void> {
  if (await isKilled(key)) throw new KillSwitchError(key);
}

/** Is this feature ON? Env explicit (1/0) wins; else DB; else the code default. */
export async function isFeatureEnabled(key: FeatureKey, codeDefault = true): Promise<boolean> {
  const rows = await dbFlags();
  return decideFeature(process.env[featureEnvName(key)], rows.has(key) ? rows.get(key)! : null, codeDefault);
}
