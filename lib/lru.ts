// Tiny bounded LRU map. Caps entry count so a long-lived serverless instance can't accumulate an
// unbounded set of key permutations (ISSUE 09: every in-process cache needs a memory bound, not just
// logical expiry). get() and set() mark a key most-recently-used; when full, set() evicts the
// least-recently-used entry. It exposes the same get/set/delete/keys/size surface the cockpit cache
// already uses, so it drops in for a plain Map with no caller changes.
export class LruMap<K, V> {
  private readonly max: number;
  private readonly m = new Map<K, V>();
  constructor(max: number) {
    this.max = Math.max(1, max);
  }
  get(key: K): V | undefined {
    const v = this.m.get(key);
    if (v !== undefined) {
      this.m.delete(key);
      this.m.set(key, v); // re-insert at the tail = most-recently-used
    }
    return v;
  }
  set(key: K, value: V): void {
    if (this.m.has(key)) this.m.delete(key);
    this.m.set(key, value);
    if (this.m.size > this.max) {
      const oldest = this.m.keys().next().value; // Map preserves insertion order; head = LRU
      if (oldest !== undefined) this.m.delete(oldest);
    }
  }
  delete(key: K): boolean {
    return this.m.delete(key);
  }
  keys(): IterableIterator<K> {
    return this.m.keys();
  }
  clear(): void {
    this.m.clear();
  }
  get size(): number {
    return this.m.size;
  }
}
