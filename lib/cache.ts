// Cache seam (ADR-0004). In-memory impl now; swap for Redis/edge at P1 behind this interface.
// Caches fingerprints, prompt prefixes, and computed rule outputs so 10k users don't recompute.

// Data-cache tag for everything derived from ONE account's store (ad_metrics / ad_meta / ad_changes). Pages
// that cache a store-derived read tag it; the ingest busts it on every successful hop, so a fresh sync is
// visible on the next request without each page inventing its own invalidation.
export const accountStoreTag = (userId: string, accountExternalId: string) => `account-store:${userId}:${accountExternalId}`;

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

type Entry = { value: unknown; expiresAt: number | null };

// `now` is injectable so TTL expiry is testable without sleeping.
export class InMemoryCache implements Cache {
  private store = new Map<string, Entry>();
  private now: () => number;
  // Note: explicit field + assignment (not a constructor parameter property), because Node's
  // --experimental-strip-types strip-only mode does not support parameter properties.
  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  async get<T>(key: string): Promise<T | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return e.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? this.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}
