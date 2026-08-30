import "server-only";
import { fetchWithTimeout } from "./http.ts";
import { createRateLimiter } from "./rate-limit.ts";

// Distributed fixed-window rate limit via Upstash Redis REST (no SDK; raw fetch, matching the app's
// convention). Atomic across ALL serverless instances via one tiny Lua script (INCR, set the TTL only on
// the first hit, return count + remaining TTL) - real flood control, unlike the per-instance map.
//
// Keyless-graceful + fail-open: returns to the in-process limiter when Upstash is not configured, and if a
// Redis call errors or times out it also falls back rather than blocking a legitimate user. Set
// UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to switch the whole app to distributed limiting with
// zero code change.

const SCRIPT =
  "local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {c, redis.call('PTTL',KEYS[1])}";

export function upstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// One Upstash EVAL. Returns null (never throws) when unconfigured or on any error, so the caller falls back.
async function checkUpstash(key: string, windowMs: number, max: number): Promise<{ limited: boolean; retryAfterMs: number } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["EVAL", SCRIPT, "1", `rl:${key}`, String(windowMs)]),
      },
      2_000, // a slow Redis must never pin the request - fall back instead
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { result?: [number, number] };
    const count = j.result?.[0] ?? 0;
    const pttl = j.result?.[1] ?? 0;
    if (!count) return null;
    return { limited: count > max, retryAfterMs: Math.max(0, pttl) };
  } catch {
    return null;
  }
}

// Lazily-created in-process fallback limiters, one per (windowMs,max) config.
const inproc = new Map<string, ReturnType<typeof createRateLimiter>>();
function inprocLimiter(windowMs: number, max: number) {
  const k = `${windowMs}:${max}`;
  let l = inproc.get(k);
  if (!l) {
    l = createRateLimiter({ windowMs, max });
    inproc.set(k, l);
  }
  return l;
}

// The one entry point routes should call. Distributed when Upstash is set, else per-instance.
export async function enforceRateLimit(key: string, opts: { windowMs: number; max: number }): Promise<{ limited: boolean; retryAfterMs: number }> {
  const dist = await checkUpstash(key, opts.windowMs, opts.max);
  if (dist) return dist;
  return inprocLimiter(opts.windowMs, opts.max)(key);
}
