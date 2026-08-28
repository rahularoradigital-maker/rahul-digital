// Tiny in-process fixed-window rate limiter. No dependency by design: it guards small public
// endpoints (e.g. the demo-lead form), not the whole app. ponytail: per-instance only - Vercel runs
// several serverless instances, so this caps casual scripted spam from one IP but is NOT distributed
// flood control; move to an edge / Upstash limit if real abuse appears. The map is swept of expired
// entries when it grows, so stale keys can't accumulate forever (ISSUE 09's lesson: every in-process
// map needs a memory bound, not just logical expiry).

type Window = { count: number; resetAt: number };

// `now` is injectable so the behavior is deterministically testable (see scripts/check-rate-limit.ts).
export function createRateLimiter(opts: { windowMs: number; max: number; maxKeys?: number }) {
  const { windowMs, max, maxKeys = 10_000 } = opts;
  const hits = new Map<string, Window>();
  return function check(key: string, now: number = Date.now()): { limited: boolean; retryAfterMs: number } {
    if (hits.size > maxKeys) {
      for (const [k, w] of hits) if (now > w.resetAt) hits.delete(k);
    }
    const w = hits.get(key);
    if (!w || now > w.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return { limited: false, retryAfterMs: 0 };
    }
    w.count++;
    return { limited: w.count > max, retryAfterMs: Math.max(0, w.resetAt - now) };
  };
}
