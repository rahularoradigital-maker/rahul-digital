// Single-flight (ISSUE 07): dedupe concurrent async work by key. N callers asking for the same key
// while a call is in flight all await the SAME promise, so an expensive upstream op (a cold Meta
// pull) runs once instead of once per caller - no thundering herd. The entry is removed in finally,
// so a rejected call is never cached: the next caller retries cleanly. The map only ever holds keys
// with work in flight, so it is self-bounding (no memory leak).
export function createSingleFlight<V>() {
  const inflight = new Map<string, Promise<V>>();
  return function run(key: string, fn: () => Promise<V>): Promise<V> {
    const existing = inflight.get(key);
    if (existing) return existing;
    const p = fn().finally(() => {
      if (inflight.get(key) === p) inflight.delete(key);
    });
    inflight.set(key, p);
    return p;
  };
}
