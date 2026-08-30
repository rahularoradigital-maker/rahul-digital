// Note: intentionally NOT "server-only" - it is reachable from the AI router's import graph (via ai/usage),
// which the check:ai gate loads in plain Node. Node-safe (process.env + fetch); the Upstash creds are
// non-public env, so a client import would simply no-op, never leak.
import { fetchWithTimeout } from "./http.ts";

// Minimal Upstash Redis REST client (no SDK; raw fetch). One command per call. Returns the `result` or null
// (never throws) when unconfigured or on any error, so every caller degrades gracefully. Shared by the
// distributed rate limiter's siblings and the AI-usage counter.

export function upstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function upstash(cmd: (string | number)[]): Promise<unknown | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetchWithTimeout(
      url,
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) },
      3_000,
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { result?: unknown };
    return j.result ?? null;
  } catch {
    return null;
  }
}
